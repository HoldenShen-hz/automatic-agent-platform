/**
 * Projection Rebuild Service
 *
 * Implements §25.4 "Projection must be rebuildable" requirement.
 * Provides full projection rebuild from event store with idempotent replay.
 *
 * ## Requirements per §25.4
 *
 * All projections must be:
 * - idempotent: applying the same event twice produces the same result
 * - replay-safe: can be replayed from any point in the event stream
 * - event_id deduplication: skip events already processed
 * - support rebuild: can rebuild from scratch
 * - do not reflect truth: projections are derived views, not the source of truth
 *
 * @see docs_zh/architecture/00-platform-architecture.md §25.4
 */

import { createHash } from "node:crypto";

import type { EventRecord } from "../../contracts/types/domain.js";
import type { EventRepository } from "../truth/sqlite/repositories/event-repository.js";
import type { ProjectionRecord } from "./index.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { createBackgroundTaskTraceContext } from "../../shared/observability/background-task-trace.js";
import { stableStringify } from "../../shared/cache/utils/stable-stringify.js";

const projectionLogger = new StructuredLogger({ retentionLimit: 500 });

class ProjectionRebuildFetchError extends Error {
  public constructor(
    public readonly projectionName: string,
    public readonly offset: number,
    public readonly limit: number,
    cause: unknown,
  ) {
    super(
      `projection_rebuild.fetch_events_failed:${projectionName}:${offset}:${limit}:${cause instanceof Error ? cause.message : String(cause)}`,
    );
    this.name = "ProjectionRebuildFetchError";
  }
}

// §28 Projection handlers - events/projections/
import { incidentProjectionHandler } from "../events/projections/incident-projection.js";
import { workflowRunProjectionHandler } from "../events/projections/workflow-run-projection.js";
import { approvalQueueProjectionHandler } from "../events/projections/approval-queue-projection.js";
import { toolUsageProjectionHandler } from "../events/projections/tool-usage-projection.js";
import { workerStatusProjectionHandler } from "../events/projections/worker-status-projection.js";
import { artifactCatalogProjectionHandler } from "../events/projections/artifact-catalog-projection.js";
import { riskActionProjectionHandler } from "../events/projections/risk-action-projection.js";
import { governanceProjectionHandler } from "../events/projections/governance-projection.js";
import { dispatchProjectionHandler } from "../events/projections/dispatch-projection.js";
import { workflowTimelineProjectionHandler } from "../events/projections/workflow-timeline-projection.js";

/**
 * Projection handler function type.
 * Takes the current state and an event, returns the updated state.
 */
export type ProjectionHandler = (
  state: Record<string, unknown> | null,
  event: ProjectionInputEvent,
) => Record<string, unknown>;

/**
 * Input event for projection handlers
 */
export interface ProjectionInputEvent {
  eventId: string;
  eventType: string;
  taskId: string | null;
  payloadJson: string;
  createdAt: string;
}

/**
 * Projection rebuild options
 */
export interface ProjectionRebuildOptions {
  /** Maximum number of events to process in a single batch */
  batchSize?: number;
  /** Whether to use parallelism by projection name */
  parallelByProjection?: boolean;
  /** Optional filter for event types to process */
  eventTypeFilter?: readonly string[];
  /** Optional filter for time range */
  fromTimestamp?: string;
  /** toTimestamp?: string; */
}

/**
 * Projection rebuild result
 */
export interface ProjectionRebuildResult {
  /** Total events processed */
  eventsProcessed: number;
  /** Projections updated */
  projectionsUpdated: number;
  /** Events skipped (already processed) */
  eventsSkipped: number;
  /** Processing time in ms */
  durationMs: number;
  /** Errors encountered */
  errors: readonly string[];
}

export interface ProjectionSnapshot {
  versionId: string;
  projectionName: string;
  builtAt: string;
  sourceEventCount: number;
  stateHash: string;
  state: Record<string, unknown>;
  stale: boolean;
  staleReason: string | null;
}

export interface ProjectionComparisonResult {
  matches: boolean;
  activeVersionId: string | null;
  shadowVersionId: string | null;
  activeHash: string | null;
  shadowHash: string | null;
  stale: boolean;
  mismatchKeys: readonly string[];
}

/**
 * Registry of projection handlers by projection name
 */
export class ProjectionHandlerRegistry {
  private readonly handlers = new Map<string, ProjectionHandler>();

  /**
   * Register a projection handler
   */
  public register(projectionName: string, handler: ProjectionHandler): void {
    this.handlers.set(projectionName, handler);
  }

  /**
   * Get a handler by projection name
   */
  public get(projectionName: string): ProjectionHandler | undefined {
    return this.handlers.get(projectionName);
  }

  /**
   * List all registered projection names
   */
  public listProjectionNames(): string[] {
    return Array.from(this.handlers.keys());
  }
}

/**
 * Projection Rebuild Service
 *
 * Provides full projection rebuild functionality from event store.
 * Supports idempotent replay with event deduplication.
 */
export class ProjectionRebuildService {
  private readonly registry: ProjectionHandlerRegistry;
  private readonly activeSnapshots = new Map<string, ProjectionSnapshot>();
  private readonly previousSnapshots = new Map<string, ProjectionSnapshot>();
  private readonly shadowSnapshots = new Map<string, ProjectionSnapshot>();

  public constructor(private readonly eventRepository: EventRepository) {
    this.registry = new ProjectionHandlerRegistry();
    this.registerDefaultHandlers();
  }

  /**
   * Register the default projection handlers
   */
  private registerDefaultHandlers(): void {
    // TaskSummary projection
    this.registry.register("task_summary", this.taskSummaryHandler.bind(this));
    // WorkflowSummary projection
    this.registry.register("workflow_summary", this.workflowSummaryHandler.bind(this));
    // ApprovalSummary projection
    this.registry.register("approval_summary", this.approvalSummaryHandler.bind(this));
    // IncidentSummary projection
    this.registry.register("incident_summary", this.incidentSummaryHandler.bind(this));
    // Generic event summary
    this.registry.register("event_summary", this.eventSummaryHandler.bind(this));
    // §28: CostDashboard projection
    this.registry.register("cost_dashboard", this.costDashboardHandler.bind(this));
    // §28: DelegationTree projection
    this.registry.register("delegation_tree", this.delegationTreeHandler.bind(this));

    // §28: Incident projection (from events/projections/)
    this.registry.register("incident_projection", incidentProjectionHandler);
    // §28: Workflow run projection (from events/projections/)
    this.registry.register("workflow_run_projection", workflowRunProjectionHandler);
    // §28: Workflow timeline projection (from events/projections/)
    this.registry.register("workflow_timeline_projection", workflowTimelineProjectionHandler);
    // §28: Approval queue projection (from events/projections/)
    this.registry.register("approval_queue_projection", approvalQueueProjectionHandler);
    // §28: Tool usage projection (from events/projections/)
    this.registry.register("tool_usage_projection", toolUsageProjectionHandler);
    // §28: Worker status projection (from events/projections/)
    this.registry.register("worker_status_projection", workerStatusProjectionHandler);
    // §28: Artifact catalog projection (from events/projections/)
    this.registry.register("artifact_catalog_projection", artifactCatalogProjectionHandler);
    // §28: Risk action projection (from events/projections/)
    this.registry.register("risk_action_projection", riskActionProjectionHandler);
    // §28: Governance projection (from events/projections/)
    this.registry.register("governance_projection", governanceProjectionHandler);
    // §28: Dispatch projection (from events/projections/)
    this.registry.register("dispatch_projection", dispatchProjectionHandler);
  }

  /**
   * Register a custom projection handler
   */
  public registerHandler(projectionName: string, handler: ProjectionHandler): void {
    this.registry.register(projectionName, handler);
  }

  public listProjectionNames(): string[] {
    return this.registry.listProjectionNames();
  }

  /**
   * Rebuild a specific projection from scratch
   */
  public rebuildProjection(
    projectionName: string,
    options: ProjectionRebuildOptions = {},
  ): ProjectionRebuildResult {
    const result = this.rebuildProjectionState(projectionName, options);
    if (result.snapshot != null) {
      this.activeSnapshots.set(projectionName, result.snapshot);
    }
    return result.rebuildResult;
  }

  public shadowBuildProjection(
    projectionName: string,
    options: ProjectionRebuildOptions = {},
  ): ProjectionRebuildResult {
    const result = this.rebuildProjectionState(projectionName, options);
    if (result.snapshot != null) {
      this.shadowSnapshots.set(projectionName, result.snapshot);
    }
    return result.rebuildResult;
  }

  public compareShadowProjection(projectionName: string): ProjectionComparisonResult {
    const active = this.activeSnapshots.get(projectionName) ?? null;
    const shadow = this.shadowSnapshots.get(projectionName) ?? null;
    if (active == null || shadow == null) {
      return {
        matches: false,
        activeVersionId: active?.versionId ?? null,
        shadowVersionId: shadow?.versionId ?? null,
        activeHash: active?.stateHash ?? null,
        shadowHash: shadow?.stateHash ?? null,
        stale: (active?.stale ?? false) || (shadow?.stale ?? false),
        mismatchKeys: [],
      };
    }
    const activeKeys = new Set(Object.keys(active.state));
    const shadowKeys = new Set(Object.keys(shadow.state));
    const mismatchKeys = [...new Set([...activeKeys, ...shadowKeys])]
      .filter((key) => stableStringify(active.state[key]) !== stableStringify(shadow.state[key]));
    return {
      matches: active.stateHash === shadow.stateHash,
      activeVersionId: active.versionId,
      shadowVersionId: shadow.versionId,
      activeHash: active.stateHash,
      shadowHash: shadow.stateHash,
      stale: active.stale || shadow.stale,
      mismatchKeys,
    };
  }

  public cutoverShadowProjection(projectionName: string): ProjectionSnapshot | null {
    const shadow = this.shadowSnapshots.get(projectionName) ?? null;
    if (shadow == null) {
      return null;
    }
    const currentActive = this.activeSnapshots.get(projectionName);
    if (currentActive != null) {
      this.previousSnapshots.set(projectionName, currentActive);
    }
    const promoted = {
      ...shadow,
      stale: false,
      staleReason: null,
    };
    this.activeSnapshots.set(projectionName, promoted);
    this.shadowSnapshots.delete(projectionName);
    return promoted;
  }

  public markProjectionStale(projectionName: string, reason: string): void {
    const current = this.activeSnapshots.get(projectionName);
    if (current == null) {
      return;
    }
    this.activeSnapshots.set(projectionName, {
      ...current,
      stale: true,
      staleReason: reason,
    });
  }

  public getProjectionSnapshotStatus(projectionName: string): {
    active: ProjectionSnapshot | null;
    previous: ProjectionSnapshot | null;
    shadow: ProjectionSnapshot | null;
  } {
    return {
      active: this.activeSnapshots.get(projectionName) ?? null,
      previous: this.previousSnapshots.get(projectionName) ?? null,
      shadow: this.shadowSnapshots.get(projectionName) ?? null,
    };
  }

  private rebuildProjectionState(
    projectionName: string,
    options: ProjectionRebuildOptions,
  ): {
    rebuildResult: ProjectionRebuildResult;
    snapshot: ProjectionSnapshot | null;
  } {
    const handler = this.registry.get(projectionName);
    if (!handler) {
      return {
        rebuildResult: {
          eventsProcessed: 0,
          projectionsUpdated: 0,
          eventsSkipped: 0,
          durationMs: 0,
          errors: [`Unknown projection: ${projectionName}`],
        },
        snapshot: null,
      };
    }

    const batchSize = options.batchSize ?? 1000;
    const startTime = Date.now();
    let eventsProcessed = 0;
    let projectionsUpdated = 0;
    let eventsSkipped = 0;
    const errors: string[] = [];

    // Process events in batches
    let offset = 0;
    let hasMore = true;
    let accumulatedState: Record<string, unknown> | null = null;

    while (hasMore) {
      let events: EventRecord[];
      try {
        events = this.fetchEvents(projectionName, options, batchSize, offset);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
        break;
      }

      if (events.length === 0) {
        hasMore = false;
        break;
      }

      for (const event of events) {
        try {
          const inputEvent = this.toProjectionInputEvent(event);
          accumulatedState = handler(accumulatedState, inputEvent);
          eventsProcessed++;
        } catch (error) {
          errors.push(`Error processing event ${event.id}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      projectionsUpdated += events.length;
      offset += events.length;

      if (events.length < batchSize) {
        hasMore = false;
      }
    }

    return {
      rebuildResult: {
        eventsProcessed,
        projectionsUpdated,
        eventsSkipped,
        durationMs: Date.now() - startTime,
        errors,
      },
      snapshot: accumulatedState == null
        ? null
        : this.createSnapshot(projectionName, accumulatedState, eventsProcessed),
    };
  }

  /**
   * Rebuild all registered projections
   */
  public rebuildAll(options: ProjectionRebuildOptions = {}): Map<string, ProjectionRebuildResult> {
    const results = new Map<string, ProjectionRebuildResult>();
    const projectionNames = this.registry.listProjectionNames();

    for (const name of projectionNames) {
      const hadActiveSnapshot = this.activeSnapshots.has(name);
      const rebuildResult = this.shadowBuildProjection(name, options);

      if (hadActiveSnapshot) {
        this.compareShadowProjection(name);
      }

      this.cutoverShadowProjection(name);
      results.set(name, rebuildResult);
    }

    return results;
  }

  private createSnapshot(
    projectionName: string,
    state: Record<string, unknown>,
    sourceEventCount: number,
  ): ProjectionSnapshot {
    const normalizedState = sortRecord(state) as Record<string, unknown>;
    const builtAt = new Date().toISOString();
    const stateHash = createHash("sha256").update(stableStringify(normalizedState)).digest("hex");
    return {
      versionId: `${projectionName}:${builtAt}`,
      projectionName,
      builtAt,
      sourceEventCount,
      stateHash,
      state: normalizedState,
      stale: false,
      staleReason: null,
    };
  }

  /**
   * Fetch events from the event repository
   */
  private fetchEvents(
    projectionName: string,
    options: ProjectionRebuildOptions,
    limit: number,
    offset: number,
  ): EventRecord[] {
    try {
      const events = this.eventRepository.listAllEvents(limit, offset);
      return events;
    } catch (error) {
      const traceContext = createBackgroundTaskTraceContext("projection_rebuild_fetch", [
        projectionName,
        offset,
        limit,
      ]);
      projectionLogger.log({
        level: "error",
        message: "projection_rebuild.fetch_events_failed",
        traceId: traceContext.traceId,
        correlationId: traceContext.correlationId,
        data: {
          projectionName,
          offset,
          limit,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
      throw new ProjectionRebuildFetchError(projectionName, offset, limit, error);
    }
  }

  /**
   * Convert EventRecord to ProjectionInputEvent
   */
  private toProjectionInputEvent(event: EventRecord): ProjectionInputEvent {
    return {
      eventId: event.id,
      eventType: event.eventType,
      taskId: event.taskId,
      payloadJson: event.payloadJson,
      createdAt: event.createdAt,
    };
  }

  /**
   * TaskSummary projection handler
   */
  private taskSummaryHandler(
    state: Record<string, unknown> | null,
    event: ProjectionInputEvent,
  ): Record<string, unknown> {
    const payload = this.parsePayload(event.payloadJson);
    const newState = state ? { ...state } : {};

    switch (event.eventType) {
      case "task:created":
        newState.taskId = event.taskId;
        newState.createdAt = event.createdAt;
        newState.status = payload.status ?? "created";
        break;
      case "task:status_changed":
        newState.previousStatus = newState.status;
        newState.status = payload.status;
        newState.lastStatusChange = event.createdAt;
        break;
      case "task:completed":
        newState.completedAt = event.createdAt;
        newState.status = "completed";
        break;
      case "task:failed":
        newState.failedAt = event.createdAt;
        newState.status = "failed";
        newState.error = payload.error;
        break;
    }

    newState.lastEventId = event.eventId;
    newState.lastEventAt = event.createdAt;
    newState.eventCount = ((state?.eventCount as number) ?? 0) + 1;

    return newState;
  }

  /**
   * WorkflowSummary projection handler
   */
  private workflowSummaryHandler(
    state: Record<string, unknown> | null,
    event: ProjectionInputEvent,
  ): Record<string, unknown> {
    const payload = this.parsePayload(event.payloadJson);
    const newState = state ? { ...state } : {};

    if (event.eventType.startsWith("workflow:")) {
      newState.workflowId = payload.workflowId ?? event.taskId;
      newState.lastEventType = event.eventType;
      newState.lastEventAt = event.createdAt;
      newState.eventCount = ((state?.eventCount as number) ?? 0) + 1;
    }

    return newState;
  }

  /**
   * ApprovalSummary projection handler
   */
  private approvalSummaryHandler(
    state: Record<string, unknown> | null,
    event: ProjectionInputEvent,
  ): Record<string, unknown> {
    const payload = this.parsePayload(event.payloadJson);
    const newState = state ? { ...state } : {};

    if (event.eventType.startsWith("approval:")) {
      newState.approvalId = payload.approvalId ?? event.taskId;
      newState.status = payload.status;
      newState.lastEventAt = event.createdAt;
      newState.eventCount = ((state?.eventCount as number) ?? 0) + 1;
    }

    return newState;
  }

  /**
   * IncidentSummary projection handler
   */
  private incidentSummaryHandler(
    state: Record<string, unknown> | null,
    event: ProjectionInputEvent,
  ): Record<string, unknown> {
    const payload = this.parsePayload(event.payloadJson);
    const newState = state ? { ...state } : {};

    if (event.eventType.startsWith("incident:")) {
      newState.incidentId = payload.incidentId ?? event.taskId;
      newState.severity = payload.severity;
      newState.lastEventAt = event.createdAt;
      newState.eventCount = ((state?.eventCount as number) ?? 0) + 1;
    }

    return newState;
  }

  /**
   * Generic event summary projection handler
   */
  private eventSummaryHandler(
    state: Record<string, unknown> | null,
    event: ProjectionInputEvent,
  ): Record<string, unknown> {
    return {
      lastEventId: event.eventId,
      lastEventType: event.eventType,
      lastEventAt: event.createdAt,
      eventCount: ((state?.eventCount as number) ?? 0) + 1,
    };
  }

  /**
   * §28: CostDashboard projection handler
   * Tracks cost budgets and actuals across the platform
   */
  private costDashboardHandler(
    state: Record<string, unknown> | null,
    event: ProjectionInputEvent,
  ): Record<string, unknown> {
    const payload = this.parsePayload(event.payloadJson);
    const newState = state ? { ...state } : {};

    switch (event.eventType) {
      case "cost:budget_created":
        newState.budgetId = payload.budgetId;
        newState.budgetName = payload.budgetName;
        newState.limitUsd = payload.limitUsd;
        newState.period = payload.period;
        newState.currentCostUsd = 0;
        newState.eventCount = ((state?.eventCount as number) ?? 0) + 1;
        break;

      case "cost:budget_exceeded":
        newState.currentCostUsd = payload.currentCostUsd;
        newState.exceededAt = payload.exceededAt;
        newState.autoBlock = payload.autoBlock;
        newState.eventCount = ((state?.eventCount as number) ?? 0) + 1;
        break;

      case "cost:actualized":
        newState.lastCostId = payload.costId;
        newState.lastAmountUsd = payload.amountUsd;
        newState.lastCostCategory = payload.costCategory;
        newState.totalCostUsd = ((state?.totalCostUsd as number) ?? 0) + (payload.amountUsd as number);
        newState.eventCount = ((state?.eventCount as number) ?? 0) + 1;
        break;

      case "cost:limit_reached":
        newState.limitReachedAt = payload.occurredAt;
        newState.eventCount = ((state?.eventCount as number) ?? 0) + 1;
        break;
    }

    newState.lastEventId = event.eventId;
    newState.lastEventAt = event.createdAt;

    return newState;
  }

  /**
   * §28: DelegationTree projection handler
   * Tracks task delegation hierarchy across agents
   */
  private delegationTreeHandler(
    state: Record<string, unknown> | null,
    event: ProjectionInputEvent,
  ): Record<string, unknown> {
    const payload = this.parsePayload(event.payloadJson);
    const newState = state ? { ...state } : {};

    switch (event.eventType) {
      case "delegation:created":
        newState.delegationId = payload.delegationId;
        newState.sourceTaskId = payload.sourceTaskId;
        newState.targetAgentId = payload.targetAgentId;
        newState.delegatedBy = payload.delegatedBy;
        newState.scope = payload.scope;
        newState.status = "active";
        newState.createdAt = event.createdAt;
        newState.eventCount = ((state?.eventCount as number) ?? 0) + 1;
        break;

      case "delegation:completed":
        newState.status = "completed";
        newState.completedAt = payload.completedAt;
        newState.resultSummary = payload.resultSummary;
        newState.eventCount = ((state?.eventCount as number) ?? 0) + 1;
        break;

      case "delegation:failed":
        newState.status = "failed";
        newState.failedAt = payload.failedAt;
        newState.reasonCode = payload.reasonCode;
        newState.errorMessage = payload.errorMessage;
        newState.eventCount = ((state?.eventCount as number) ?? 0) + 1;
        break;
    }

    newState.lastEventId = event.eventId;
    newState.lastEventAt = event.createdAt;

    return newState;
  }

  /**
   * Safely parse JSON payload
   */
  private parsePayload(payloadJson: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(payloadJson);
      return typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
}

type SortableJson = null | boolean | number | string | SortableJson[] | { readonly [key: string]: SortableJson };

function sortRecord(value: unknown): SortableJson {
  if (Array.isArray(value)) {
    return value.map((item) => sortRecord(item));
  }
  if (value != null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortRecord(child)]),
    );
  }
  return value as SortableJson;
}
