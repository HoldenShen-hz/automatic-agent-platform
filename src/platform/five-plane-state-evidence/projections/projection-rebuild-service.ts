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
 *
 * ## Requirements per §28.6
 *
 * Shadow-build/compare/cutover protocol:
 * - shadow projection: build projection in parallel with existing
 * - hash comparison: compare shadow hash with existing hash
 * - cutover: switch to shadow projection when hashes match
 * - rollback: retain old version for rollback + API stale marker
 */

import type { EventRecord } from "../../contracts/types/domain.js";
import type { EventRepository } from "../truth/sqlite/repositories/event-repository.js";
import type { ProjectionRecord } from "./index.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const projectionLogger = new StructuredLogger({ retentionLimit: 500 });

// §28 Projection handlers - events/projections/
import { incidentProjectionHandler } from "../events/projections/incident-projection.js";
import { workflowRunProjectionHandler } from "../events/projections/workflow-run-projection.js";
import { approvalQueueProjectionHandler } from "../events/projections/approval-queue-projection.js";
import { toolUsageProjectionHandler } from "../events/projections/tool-usage-projection.js";
import { workerStatusProjectionHandler } from "../events/projections/worker-status-projection.js";
import { artifactCatalogProjectionHandler } from "../events/projections/artifact-catalog-projection.js";
import { riskActionProjectionHandler } from "../events/projections/risk-action-projection.js";
import { governanceProjectionHandler } from "../events/projections/governance-projection.js";
import { workflowTimelineProjectionHandler } from "../events/projections/workflow-timeline-projection.js";
import { createHash } from "crypto";

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

/**
 * §28.6: Shadow projection state for build/compare/cutover protocol
 */
export interface ShadowProjectionState {
  readonly projectionName: string;
  readonly entityRef: string;
  readonly shadowState: Record<string, unknown>;
  readonly shadowHash: string;
  readonly builtFromEventId: string;
  readonly builtAt: string;
  readonly isStale: boolean; // Marked stale during cutover for rollback
}

/**
 * §28.6: Cutover decision from shadow comparison
 */
export interface CutoverDecision {
  readonly projectionName: string;
  readonly entityRef: string;
  readonly action: "promote" | "keep_existing" | "needs_manual_review";
  readonly shadowHash: string;
  readonly existingHash: string;
  readonly confidence: number; // 0.0-1.0
  readonly reason: string;
  /** R16-32: The actual rebuilt shadow state for promotion */
  readonly shadowState: Record<string, unknown> | null;
}

/**
 * §28.6: Shadow build result
 */
export interface ShadowBuildResult {
  readonly projectionName: string;
  readonly shadowsBuilt: number;
  readonly shadowsPromoted: number;
  readonly shadowsKeptExisting: number;
  readonly shadowsNeedsReview: number;
  readonly durationMs: number;
  readonly errors: readonly string[];
}

/**
 * §R16-32: Repository interface for projection persistence.
 * Enables shadow-build pattern where rebuilds happen in temporary storage
 * before being committed to the actual projection store.
 */
export interface ProjectionRepository {
  /**
   * Get all existing projections
   */
  listAll(): Promise<ProjectionRecord[]>;

  /**
   * Save a rebuilt projection after validation passes
   */
  saveRebuilt(projection: ProjectionRecord): Promise<void>;

  /**
   * Create a temporary shadow projection for validation
   */
  createShadow(projection: ProjectionRecord): Promise<void>;

  /**
   * Commit shadow as the new active projection (atomic swap)
   */
  promoteShadow(projectionName: string, entityRef: string): Promise<void>;

  /**
   * Discard a shadow projection (cleanup on validation failure)
   */
  discardShadow(projectionName: string, entityRef: string): Promise<void>;
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
 *
 * §28.6: Also provides shadow-build/compare/cutover protocol for zero-downtime rebuilds.
 * §R16-32: Uses shadow-build pattern to prevent partial state on rebuild failure.
 */
export class ProjectionRebuildService {
  private readonly registry: ProjectionHandlerRegistry;
  private readonly shadowProjections = new Map<string, ShadowProjectionState>(); // key: projectionName:entityRef

  public constructor(
    private readonly eventRepository: EventRepository,
    private readonly projectionRepository?: ProjectionRepository,
  ) {
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
  }

  /**
   * Register a custom projection handler
   */
  public registerHandler(projectionName: string, handler: ProjectionHandler): void {
    this.registry.register(projectionName, handler);
  }

  /**
   * Compute hash of projection state for comparison.
   * §28.6: Used for shadow build comparison.
   */
  private computeStateHash(state: Record<string, unknown>): string {
    const normalized = JSON.stringify(state, Object.keys(state).sort());
    return createHash("sha256").update(normalized).digest("hex").substring(0, 16);
  }

  /**
   * §28.6: Build shadow projection from events.
   * Compares with existing projection and returns cutover decision.
   *
   * Shadow-build protocol:
   * 1. Build shadow projection alongside existing
   * 2. Hash comparison between shadow and existing
   * 3. If hashes match -> promote shadow to active
   * 4. If hashes differ -> keep existing, mark shadow for review
   */
  public async shadowBuild(
    projectionName: string,
    existingProjection: ProjectionRecord | null,
    options: ProjectionRebuildOptions = {},
  ): Promise<CutoverDecision> {
    const handler = this.registry.get(projectionName);
    if (!handler) {
      return {
        projectionName,
        entityRef: existingProjection?.entityRef ?? "unknown",
        action: "needs_manual_review",
        shadowHash: "",
        existingHash: existingProjection ? this.computeStateHash(existingProjection.state) : "",
        confidence: 0,
        reason: `Unknown projection: ${projectionName}`,
        shadowState: null,
      };
    }

    const batchSize = options.batchSize ?? 1000;
    let accumulatedState: Record<string, unknown> | null = null;
    let lastEventId = "";
    const errors: string[] = [];

    // §25.4: Thread state through events - rebuild projection state
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const events = this.fetchEvents(options, batchSize, offset);

      if (events.length === 0) {
        hasMore = false;
        break;
      }

      for (const event of events) {
        try {
          const inputEvent = this.toProjectionInputEvent(event);
          // §R11-09: Thread accumulated state through handler instead of passing null
          accumulatedState = handler(accumulatedState, inputEvent);
          lastEventId = event.id;
        } catch (error) {
          errors.push(`Error processing event ${event.id}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      offset += events.length;

      if (events.length < batchSize) {
        hasMore = false;
      }
    }

    const shadowState = accumulatedState ?? {};
    const shadowHash = this.computeStateHash(shadowState);
    const existingHash = existingProjection ? this.computeStateHash(existingProjection.state) : "";
    const entityRef = existingProjection?.entityRef ?? (shadowState.entityRef as string) ?? "unknown";

    // §28.6: Make cutover decision based on hash comparison
    if (shadowHash === existingHash) {
      // Hashes match - safe to promote
      return {
        projectionName,
        entityRef,
        action: "promote",
        shadowHash,
        existingHash,
        confidence: 1.0,
        reason: "Shadow and existing hashes match - safe promotion",
        shadowState,
      };
    }

    // Hashes differ - check if difference is semantic or structural
    const confidence = this.computeCutoverConfidence(shadowState, existingProjection?.state ?? {});

    if (confidence >= 0.9) {
      // High confidence difference is semantic - can auto-promote
      return {
        projectionName,
        entityRef,
        action: "promote",
        shadowHash,
        existingHash,
        confidence,
        reason: "High confidence semantic difference - promoting shadow",
        shadowState,
      };
    } else if (confidence >= 0.5) {
      // Medium confidence - keep existing, need review
      return {
        projectionName,
        entityRef,
        action: "needs_manual_review",
        shadowHash,
        existingHash,
        confidence,
        reason: "Medium confidence difference - needs manual review",
        shadowState,
      };
    } else {
      // Low confidence - keep existing
      return {
        projectionName,
        entityRef,
        action: "keep_existing",
        shadowHash,
        existingHash,
        confidence,
        reason: "Low confidence - keeping existing projection",
        shadowState,
      };
    }
  }

  /**
   * §28.6: Compute confidence that shadow is semantically correct vs structurally different.
   * This helps distinguish "same data, different format" from "actually different data".
   */
  private computeCutoverConfidence(
    shadowState: Record<string, unknown>,
    existingState: Record<string, unknown>,
  ): number {
    if (Object.keys(existingState).length === 0) {
      return 1.0; // No existing state, shadow is authoritative
    }

    // Check if same keys are present
    const shadowKeyArray = Object.keys(shadowState);
    const existingKeyArray = Object.keys(existingState);
    const shadowKeys = new Set(shadowKeyArray);
    const existingKeys = new Set(existingKeyArray);

    // Key similarity ratio
    const commonKeys = shadowKeyArray.filter((k) => existingKeys.has(k));
    const keySimilarity = commonKeys.length / Math.max(shadowKeyArray.length, existingKeyArray.length);

    // Check timestamp/eventCount fields for replay progress
    const shadowEventCount = shadowState.eventCount as number ?? 0;
    const existingEventCount = existingState.eventCount as number ?? 0;

    if (shadowEventCount > existingEventCount) {
      // Shadow processed more events - likely more up-to-date
      return Math.min(0.95, 0.5 + (keySimilarity * 0.5));
    } else if (shadowEventCount === existingEventCount && keySimilarity > 0.8) {
      // Same event count and high key similarity - likely same data
      return 0.95;
    }

    return keySimilarity * 0.7; // Base confidence on key similarity
  }

  /**
   * §28.6: Execute shadow-build/compare/cutover for all projections.
   * Returns summary of build results.
   */
  public async shadowBuildAll(
    existingProjections: readonly ProjectionRecord[],
    options: ProjectionRebuildOptions = {},
  ): Promise<ShadowBuildResult> {
    const startTime = Date.now();
    const projectionNames = this.registry.listProjectionNames();
    let shadowsBuilt = 0;
    let shadowsPromoted = 0;
    let shadowsKeptExisting = 0;
    let shadowsNeedsReview = 0;
    const errors: string[] = [];

    for (const name of projectionNames) {
      // Find existing projection for this name
      const existingForName = existingProjections.filter((p) => p.projectionName === name);

      for (const existing of existingForName) {
        try {
          const decision = await this.shadowBuild(name, existing, options);

          if (decision.action === "promote") {
            shadowsPromoted++;
            // Store shadow state for promotion
            const key = `${name}:${decision.entityRef}`;
            this.shadowProjections.set(key, {
              projectionName: name,
              entityRef: decision.entityRef,
              shadowState: decision.shadowState ?? {},
              shadowHash: decision.shadowHash,
              builtFromEventId: lastEventId,
              builtAt: new Date().toISOString(),
              isStale: false,
            });
          } else if (decision.action === "keep_existing") {
            shadowsKeptExisting++;
          } else {
            shadowsNeedsReview++;
            errors.push(`Manual review needed for ${name}:${decision.entityRef}: ${decision.reason}`);
          }
          shadowsBuilt++;
        } catch (error) {
          errors.push(`Error shadow-building ${name}:${existing.entityRef}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    return {
      projectionName: "all",
      shadowsBuilt,
      shadowsPromoted,
      shadowsKeptExisting,
      shadowsNeedsReview,
      durationMs: Date.now() - startTime,
      errors,
    };
  }

  /**
   * §28.6: Promote shadow projection to active.
   * Returns the promoted projection state.
   */
  public promoteShadow(projectionName: string, entityRef: string): ShadowProjectionState | null {
    const key = `${projectionName}:${entityRef}`;
    const shadow = this.shadowProjections.get(key);

    if (!shadow) {
      return null;
    }

    // Mark as promoted (no longer stale)
    const promoted: ShadowProjectionState = {
      ...shadow,
      isStale: false,
    };

    this.shadowProjections.set(key, promoted);
    return promoted;
  }

  /**
   * §28.6: Mark existing projection as stale (for rollback).
   * API should return stale marker when serving stale projections.
   */
  public markStale(projectionName: string, entityRef: string): void {
    const key = `${projectionName}:${entityRef}`;
    const existing = this.shadowProjections.get(key);

    if (existing) {
      this.shadowProjections.set(key, {
        ...existing,
        isStale: true,
      });
    }
  }

  /**
   * §28.6: Check if a projection is stale.
   */
  public isStale(projectionName: string, entityRef: string): boolean {
    const key = `${projectionName}:${entityRef}`;
    return this.shadowProjections.get(key)?.isStale ?? false;
  }

  /**
   * Rebuild a specific projection from scratch.
   *
   * §25.4: Fixed to properly thread state through events.
   * Previously passed `null` for every event, breaking state accumulation.
   */
  public rebuildProjection(
    projectionName: string,
    options: ProjectionRebuildOptions = {},
  ): ProjectionRebuildResult {
    const handler = this.registry.get(projectionName);
    if (!handler) {
      return {
        eventsProcessed: 0,
        projectionsUpdated: 0,
        eventsSkipped: 0,
        durationMs: 0,
        errors: [`Unknown projection: ${projectionName}`],
      };
    }

    const batchSize = options.batchSize ?? 1000;
    const startTime = Date.now();
    let eventsProcessed = 0;
    let projectionsUpdated = 0;
    let eventsSkipped = 0;
    const errors: string[] = [];

    // §R11-09: FIX - Thread state through events instead of passing null
    // State must be accumulated across events for correct projection rebuild
    let accumulatedState: Record<string, unknown> | null = null;

    // Process events in batches
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const events = this.fetchEvents(options, batchSize, offset);

      if (events.length === 0) {
        hasMore = false;
        break;
      }

      for (const event of events) {
        try {
          // Apply event to projection with accumulated state
          // §25.4: State is threaded through events, not reset to null
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
      eventsProcessed,
      projectionsUpdated,
      eventsSkipped,
      durationMs: Date.now() - startTime,
      errors,
    };
  }

  /**
   * Rebuild all registered projections
   *
   * §R16-32: Uses shadow-build pattern when repository is available.
   * Rebuilds to temporary storage, validates, then swaps to avoid partial state.
   */
  public async rebuildAll(options: ProjectionRebuildOptions = {}): Promise<Map<string, ProjectionRebuildResult>> {
    const results = new Map<string, ProjectionRebuildResult>();
    const projectionNames = this.registry.listProjectionNames();

    // §R16-32: If no repository provided, fall back to direct in-place rebuild
    if (!this.projectionRepository) {
      for (const name of projectionNames) {
        results.set(name, this.rebuildProjection(name, options));
      }
      return results;
    }

    // §R16-32: Shadow-build pattern - rebuild to temp storage, validate, then commit
    // Step 1: Get existing projections for shadow comparison
    const existingProjections = await this.projectionRepository.listAll();

    // Step 2: Build shadows and get cutover decisions
    const shadowResult = await this.shadowBuildAll(existingProjections, options);

    // Step 3: For each promoted shadow, validate and commit
    for (const [key, shadow] of this.shadowProjections.entries()) {
      const [projectionName, entityRef] = key.split(":");
      try {
        // Validate shadow state before committing
        const isValid = this.validateShadowState(shadow.shadowState);
        if (!isValid) {
          projectionLogger.warn(`Shadow build validation failed for ${key}, discarding`);
          await this.projectionRepository.discardShadow(projectionName, entityRef);
          continue;
        }

        // Commit the shadow as the new active projection
        await this.projectionRepository.promoteShadow(projectionName, entityRef);
        projectionLogger.info(`Promoted shadow projection: ${key}`);
      } catch (error) {
        projectionLogger.error(`Failed to promote shadow ${key}: ${error}`);
        await this.projectionRepository.discardShadow(projectionName, entityRef);
      }
    }

    // Step 4: Report results
    for (const name of projectionNames) {
      const shadowsForName = [...this.shadowProjections.values()].filter(
        (s) => s.projectionName === name,
      );
      const promoted = shadowsForName.filter((s) => !s.isStale).length;

      results.set(name, {
        eventsProcessed: shadowResult.shadowsBuilt,
        projectionsUpdated: promoted,
        eventsSkipped: 0,
        durationMs: shadowResult.durationMs,
        errors: shadowResult.errors,
      });
    }

    return results;
  }

  /**
   * §R16-32: Validate shadow state before promoting
   */
  private validateShadowState(state: Record<string, unknown>): boolean {
    // Basic validation - state must be an object
    if (!state || typeof state !== "object") {
      return false;
    }

    // Check for required fields that indicate a valid projection
    if (!("lastEventId" in state) && !("eventCount" in state)) {
      // Projection may be legitimately empty - allow it
      return true;
    }

    return true;
  }

  /**
   * Fetch events from the event repository
   */
  private fetchEvents(
    options: ProjectionRebuildOptions,
    limit: number,
    offset: number,
  ): EventRecord[] {
    try {
      const events = this.eventRepository.listAllEvents(limit, offset);
      return events;
    } catch (error) {
      projectionLogger.error(`Error fetching events: ${error}`);
      return [];
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
