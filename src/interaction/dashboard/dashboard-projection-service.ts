/**
 * Dashboard Projection Service
 *
 * Provides incremental dashboard updates using projections as the data source.
 * Supports delta-based updates instead of full queries.
 *
 * Architecture: §43 Dashboard - Dashboard with incremental updates
 * @see docs_zh/architecture/00-platform-architecture.md §43
 */

import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import type { TaskBoardItem } from "../../platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { ProjectionRecord } from "../../platform/five-plane-state-evidence/projections/index.js";
import type { TypedEventType } from "../../platform/five-plane-state-evidence/events/typed-event-bus.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DashboardDelta {
  readonly deltaId: string;
  readonly timestamp: string;
  readonly tenantId: string | null;
  readonly visibilityScope: "tenant" | "global";
  readonly changes: readonly DashboardChange[];
  readonly affectedMetrics: readonly string[];
}

export interface DashboardChange {
  readonly changeType: "task_created" | "task_updated" | "task_completed" | "task_failed" | "incident_opened" | "incident_resolved" | "system_health_changed";
  readonly entityId: string;
  readonly previousValue?: unknown;
  readonly newValue: unknown;
}

export interface DashboardProjectionConfig {
  readonly projectionNames: readonly string[];
  readonly emitDebounceMs: number;
}

const DEFAULT_CONFIG: DashboardProjectionConfig = {
  projectionNames: ["task_summary", "incident_summary", "workflow_summary"],
  emitDebounceMs: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Projection Service
// ─────────────────────────────────────────────────────────────────────────────

export class DashboardProjectionService {
  private readonly config: DashboardProjectionConfig;
  private readonly stagedDeltas: DashboardDelta[] = [];
  private readonly readyDeltas: DashboardDelta[] = [];
  private lastEmittedAt: string | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config?: Partial<DashboardProjectionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Processes a projection record change and generates dashboard delta.
   *
   * @param record - Updated projection record
   * @returns Generated dashboard delta or null if no significant change
   */
  public processProjectionUpdate(record: ProjectionRecord): DashboardDelta | null {
    const changes = this.deriveChanges(record);
    if (changes.length === 0) return null;

    // Projections are typically tenant-scoped unless they are system-level
    const rawState = record.state as Record<string, unknown>;
    const isSystemProjection = record.projectionName === "system_health";
    const tenantId = isSystemProjection ? null : ((rawState as { tenantId?: string })?.tenantId ?? null);

    const delta: DashboardDelta = {
      deltaId: newId("delta"),
      timestamp: nowIso(),
      tenantId,
      visibilityScope: isSystemProjection ? "global" : "tenant",
      changes,
      affectedMetrics: this.deriveAffectedMetrics(changes),
    };

    this.stagedDeltas.push(delta);
    this.scheduleEmit();

    return delta;
  }

  /**
   * Processes an event and generates dashboard delta.
   *
   * @param eventType - Type of event
   * @param payload - Event payload
   * @returns Generated dashboard delta or null if no significant change
   */
  public processEvent(eventType: TypedEventType, payload: unknown): DashboardDelta | null {
    const changeType = this.deriveChangeType(eventType, payload);
    if (!changeType) return null;

    const entityId = this.extractEntityId(payload, eventType);
    const change: DashboardChange = {
      changeType,
      entityId,
      newValue: payload,
    };

    // System health events are global; all others are tenant-scoped
    const isSystemHealth = eventType === "system.health.changed";
    const rawPayload = payload as Record<string, unknown>;
    const tenantId = isSystemHealth ? null : (rawPayload?.tenantId as string ?? null);

    const delta: DashboardDelta = {
      deltaId: newId("delta"),
      timestamp: nowIso(),
      tenantId,
      visibilityScope: isSystemHealth ? "global" : "tenant",
      changes: [change],
      affectedMetrics: this.deriveAffectedMetrics([change]),
    };

    this.stagedDeltas.push(delta);
    this.scheduleEmit();

    return delta;
  }

  /**
   * Legacy benchmark helper retained for older performance suites.
   */
  public generateProjection(input: {
    taskId: string;
    executionId?: string;
    timestamp?: string;
  }): DashboardProjectionState {
    return this.buildStateFromProjections([
      {
        projectionId: newId("projection"),
        sourceEventId: input.executionId ?? input.taskId,
        projectionName: "task_summary",
        entityRef: input.taskId,
        state: {
          taskId: input.taskId,
          executionId: input.executionId ?? null,
          taskStatus: "running",
          tenantId: null,
          latencyMs: 0,
        },
        updatedAt: input.timestamp ?? nowIso(),
      },
    ]);
  }

  /**
   * Gets all pending deltas since last emission.
   *
   * @returns Array of pending deltas
   */
  public getPendingDeltas(): readonly DashboardDelta[] {
    return [...this.readyDeltas, ...this.stagedDeltas];
  }

  /**
   * Consumes and clears all pending deltas.
   *
   * @returns Array of consumed deltas
   */
  public consumePendingDeltas(): readonly DashboardDelta[] {
    const consumed = [...this.readyDeltas];
    this.readyDeltas.length = 0;
    this.lastEmittedAt = nowIso();
    return consumed;
  }

  /**
   * Checks if there are pending deltas ready to emit.
   */
  public hasPendingDeltas(): boolean {
    return this.readyDeltas.length > 0 || this.stagedDeltas.length > 0;
  }

  /**
   * Forces immediate emission of pending deltas (bypasses debounce).
   *
   * @returns Array of emitted deltas
   */
  public flush(): readonly DashboardDelta[] {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.promoteStagedDeltas();
    return this.consumePendingDeltas();
  }

  /**
   * Builds current dashboard state from projection records.
   *
   * @param projections - Array of projection records
   * @returns Aggregated dashboard state
   */
  public buildStateFromProjections(projections: readonly ProjectionRecord[]): DashboardProjectionState {
    let taskCount = 0;
    let incidentCount = 0;
    let workflowCount = 0;
    const tasksByStatus = new Map<string, number>();
    const incidentsByPriority = new Map<string, number>();

    // KPI accumulators
    let completedCount = 0;
    let failedCount = 0;
    let totalDurationMs = 0;
    let activeAgentCount = 0;
    let pendingQueueCount = 0;
    const latencySamples: number[] = [];
    let budgetCurrentUsd = 0;
    let budgetLimitUsd = 0;

    for (const projection of projections) {
      const state = projection.state as Record<string, unknown>;
      switch (projection.projectionName) {
        case "task_summary":
          taskCount++;
          const status = String(state.taskStatus ?? "unknown");
          tasksByStatus.set(status, (tasksByStatus.get(status) ?? 0) + 1);
          // KPI: success/failure counts
          if (status === "completed" || status === "done") {
            completedCount++;
            if (typeof state.durationMs === "number") {
              totalDurationMs += state.durationMs;
            }
            if (typeof state.latencyMs === "number") {
              latencySamples.push(state.latencyMs);
            }
          } else if (status === "failed") {
            failedCount++;
          }
          break;
        case "incident_summary":
          incidentCount++;
          const priority = String(state.priority ?? "normal");
          incidentsByPriority.set(priority, (incidentsByPriority.get(priority) ?? 0) + 1);
          break;
        case "workflow_summary":
          workflowCount++;
          break;
        case "worker_status_projection":
          // KPI: active agents (workers with status "active" or "claiming")
          if (state.status === "active" || state.status === "claiming") {
            activeAgentCount++;
          }
          break;
        case "dispatch_projection":
          // KPI: queue depth (pending dispatch tickets)
          if (state.status === "pending") {
            pendingQueueCount++;
          }
          break;
        case "cost_dashboard":
          // KPI: budget utilization
          if (typeof state.currentCostUsd === "number") {
            budgetCurrentUsd += state.currentCostUsd;
          }
          if (typeof state.limitUsd === "number") {
            budgetLimitUsd += state.limitUsd;
          }
          break;
      }
    }

    // Compute derived KPIs
    const totalTerminalCount = completedCount + failedCount;
    const successRate = totalTerminalCount > 0 ? completedCount / totalTerminalCount : 0;
    const errorRate = totalTerminalCount > 0 ? failedCount / totalTerminalCount : 0;
    const avgDurationMs = completedCount > 0 ? totalDurationMs / completedCount : 0;
    const budgetUtilizationPercent = budgetLimitUsd > 0 ? (budgetCurrentUsd / budgetLimitUsd) * 100 : 0;

    // Compute latency percentiles
    const sortedLatencies = [...latencySamples].sort((a, b) => a - b);
    const p50LatencyMs = sortedLatencies.length > 0
      ? sortedLatencies[Math.floor(sortedLatencies.length * 0.5)] ?? 0
      : 0;
    const p99LatencyMs = sortedLatencies.length > 0
      ? sortedLatencies[Math.min(Math.floor(sortedLatencies.length * 0.99), sortedLatencies.length - 1)] ?? 0
      : 0;

    return {
      totalTasks: taskCount,
      tasksByStatus: Object.fromEntries(tasksByStatus),
      totalIncidents: incidentCount,
      incidentsByPriority: Object.fromEntries(incidentsByPriority),
      totalWorkflows: workflowCount,
      lastUpdatedAt: nowIso(),
      // KPI fields
      successRate: Math.round(successRate * 100) / 100,
      avgDurationMs: Math.round(avgDurationMs),
      activeAgents: activeAgentCount,
      queueDepth: pendingQueueCount,
      errorRate: Math.round(errorRate * 100) / 100,
      p50LatencyMs: Math.round(p50LatencyMs),
      p99LatencyMs: Math.round(p99LatencyMs),
      budgetUtilizationPercent: Math.round(budgetUtilizationPercent * 100) / 100,
    };
  }

  /**
   * Clears all pending deltas without emitting.
   */
  public clearPendingDeltas(): void {
    this.readyDeltas.length = 0;
    this.stagedDeltas.length = 0;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  // ─── Private Methods ─────────────────────────────────────────────────────

  private deriveChanges(record: ProjectionRecord): DashboardChange[] {
    const changes: DashboardChange[] = [];

    switch (record.projectionName) {
      case "task_summary":
        changes.push({
          changeType: this.inferTaskChangeType(record),
          entityId: record.entityRef,
          previousValue: undefined,
          newValue: record.state,
        });
        break;
      case "incident_summary":
        changes.push({
          changeType: record.state.resolved ? "incident_resolved" : "incident_opened",
          entityId: record.entityRef,
          previousValue: undefined,
          newValue: record.state,
        });
        break;
      case "workflow_summary":
        changes.push({
          changeType: "task_updated",
          entityId: record.entityRef,
          previousValue: undefined,
          newValue: record.state,
        });
        break;
    }

    return changes;
  }

  private inferTaskChangeType(record: ProjectionRecord): DashboardChange["changeType"] {
    const status = String(record.state.taskStatus ?? "");
    switch (status) {
      case "done":
      case "completed":
        return "task_completed";
      case "failed":
        return "task_failed";
      default:
        return "task_updated";
    }
  }

  private deriveChangeType(eventType: TypedEventType, payload: unknown): DashboardChange["changeType"] | null {
    if (eventType === "task:status_changed") {
      const status = this.extractStatusValue(payload);
      if (status === "done" || status === "completed") {
        return "task_completed";
      }
      if (status === "failed") {
        return "task_failed";
      }
      return "task_updated";
    }
    if (eventType.startsWith("task.created")) return "task_created";
    if (eventType.startsWith("task.updated")) return "task_updated";
    if (eventType.startsWith("task.completed")) return "task_completed";
    if (eventType.startsWith("task.failed")) return "task_failed";
    if (eventType.startsWith("incident.opened")) return "incident_opened";
    if (eventType.startsWith("incident.resolved")) return "incident_resolved";
    if (eventType.startsWith("system.health")) return "system_health_changed";
    return null;
  }

  private extractStatusValue(payload: unknown): string | null {
    if (payload == null || typeof payload !== "object") {
      return null;
    }
    const obj = payload as Record<string, unknown>;
    const value = obj.toStatus ?? obj.newStatus ?? obj.status;
    return typeof value === "string" ? value.toLowerCase() : null;
  }

  private extractEntityId(payload: unknown, eventType: TypedEventType): string {
    if (payload && typeof payload === "object") {
      const obj = payload as Record<string, unknown>;
      if (obj.taskId) return String(obj.taskId);
      if (obj.incidentId) return String(obj.incidentId);
      if (obj.workflowId) return String(obj.workflowId);
      if (obj.entityRef) return String(obj.entityRef);
    }
    return eventType;
  }

  private deriveAffectedMetrics(changes: readonly DashboardChange[]): string[] {
    const metrics = new Set<string>();

    for (const change of changes) {
      switch (change.changeType) {
        case "task_created":
          metrics.add("totalTasks");
          metrics.add("tasksByStatus.pending");
          break;
        case "task_completed":
          metrics.add("totalTasks");
          metrics.add("tasksByStatus.done");
          break;
        case "task_failed":
          metrics.add("totalTasks");
          metrics.add("tasksByStatus.failed");
          metrics.add("incidentCount");
          break;
        case "task_updated":
          metrics.add("totalTasks");
          break;
        case "incident_opened":
          metrics.add("incidentCount");
          metrics.add("incidentsByPriority");
          break;
        case "incident_resolved":
          metrics.add("incidentCount");
          metrics.add("incidentsByPriority");
          break;
        case "system_health_changed":
          metrics.add("systemHealth");
          break;
      }
    }

    return [...metrics];
  }

  private scheduleEmit(): void {
    if (this.config.emitDebounceMs <= 0) {
      this.promoteStagedDeltas();
      return;
    }
    if (this.debounceTimer !== null) return;

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.promoteStagedDeltas();
    }, this.config.emitDebounceMs);
  }

  private promoteStagedDeltas(): void {
    if (this.stagedDeltas.length === 0) {
      return;
    }
    this.readyDeltas.push(...this.stagedDeltas);
    this.stagedDeltas.length = 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Projection State
// ─────────────────────────────────────────────────────────────────────────────

export interface DashboardProjectionState {
  readonly totalTasks: number;
  readonly tasksByStatus: Record<string, number>;
  readonly totalIncidents: number;
  readonly incidentsByPriority: Record<string, number>;
  readonly totalWorkflows: number;
  readonly lastUpdatedAt: string;
  // KPI fields
  readonly successRate: number;
  readonly avgDurationMs: number;
  readonly activeAgents: number;
  readonly queueDepth: number;
  readonly errorRate: number;
  readonly p50LatencyMs: number;
  readonly p99LatencyMs: number;
  readonly budgetUtilizationPercent: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────

export function createDashboardProjectionService(
  config?: Partial<DashboardProjectionConfig>,
): DashboardProjectionService {
  return new DashboardProjectionService(config);
}
