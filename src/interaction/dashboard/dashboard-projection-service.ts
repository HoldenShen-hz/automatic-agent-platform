/**
 * Dashboard Projection Service
 *
 * Provides incremental dashboard updates using projections as the data source.
 * Supports delta-based updates instead of full queries.
 *
 * Architecture: §43 仪表盘 - Dashboard with incremental updates
 * @see docs_zh/architecture/00-platform-architecture.md §43
 */

import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import type { TaskBoardItem } from "../../platform/state-evidence/truth/authoritative-task-store.js";
import type { SystemSituation } from "../../platform/shared/observability/system-situation-model.js";
import type { ProjectionRecord } from "../../platform/state-evidence/projections/index.js";
import type { TypedEventType } from "../../platform/state-evidence/events/typed-event-bus.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DashboardDelta {
  readonly deltaId: string;
  readonly timestamp: string;
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
  emitDebounceMs: 100,
};

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Projection Service
// ─────────────────────────────────────────────────────────────────────────────

export class DashboardProjectionService {
  private readonly config: DashboardProjectionConfig;
  private readonly pendingDeltas: DashboardDelta[] = [];
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

    const delta: DashboardDelta = {
      deltaId: newId("delta"),
      timestamp: nowIso(),
      changes,
      affectedMetrics: this.deriveAffectedMetrics(changes),
    };

    this.pendingDeltas.push(delta);
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
    const changeType = this.deriveChangeType(eventType);
    if (!changeType) return null;

    const entityId = this.extractEntityId(payload, eventType);
    const change: DashboardChange = {
      changeType,
      entityId,
      newValue: payload,
    };

    const delta: DashboardDelta = {
      deltaId: newId("delta"),
      timestamp: nowIso(),
      changes: [change],
      affectedMetrics: this.deriveAffectedMetrics([change]),
    };

    this.pendingDeltas.push(delta);
    this.scheduleEmit();

    return delta;
  }

  /**
   * Gets all pending deltas since last emission.
   *
   * @returns Array of pending deltas
   */
  public getPendingDeltas(): readonly DashboardDelta[] {
    return [...this.pendingDeltas];
  }

  /**
   * Consumes and clears all pending deltas.
   *
   * @returns Array of consumed deltas
   */
  public consumePendingDeltas(): readonly DashboardDelta[] {
    const consumed = [...this.pendingDeltas];
    this.pendingDeltas.length = 0;
    this.lastEmittedAt = nowIso();
    return consumed;
  }

  /**
   * Checks if there are pending deltas ready to emit.
   */
  public hasPendingDeltas(): boolean {
    return this.pendingDeltas.length > 0;
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

    for (const projection of projections) {
      switch (projection.projectionName) {
        case "task_summary":
          taskCount++;
          const status = String(projection.state.taskStatus ?? "unknown");
          tasksByStatus.set(status, (tasksByStatus.get(status) ?? 0) + 1);
          break;
        case "incident_summary":
          incidentCount++;
          const priority = String(projection.state.priority ?? "normal");
          incidentsByPriority.set(priority, (incidentsByPriority.get(priority) ?? 0) + 1);
          break;
        case "workflow_summary":
          workflowCount++;
          break;
      }
    }

    return {
      totalTasks: taskCount,
      tasksByStatus: Object.fromEntries(tasksByStatus),
      totalIncidents: incidentCount,
      incidentsByPriority: Object.fromEntries(incidentsByPriority),
      totalWorkflows: workflowCount,
      lastUpdatedAt: nowIso(),
    };
  }

  /**
   * Clears all pending deltas without emitting.
   */
  public clearPendingDeltas(): void {
    this.pendingDeltas.length = 0;
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

  private deriveChangeType(eventType: TypedEventType): DashboardChange["changeType"] | null {
    if (eventType.startsWith("task.created")) return "task_created";
    if (eventType.startsWith("task.updated")) return "task_updated";
    if (eventType.startsWith("task.completed")) return "task_completed";
    if (eventType.startsWith("task.failed")) return "task_failed";
    if (eventType.startsWith("incident.opened")) return "incident_opened";
    if (eventType.startsWith("incident.resolved")) return "incident_resolved";
    if (eventType.startsWith("system.health")) return "system_health_changed";
    return null;
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
    if (this.debounceTimer !== null) return;

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      // In real implementation, this would emit to WebSocket clients
      // For now, deltas are consumed via consumePendingDeltas()
    }, this.config.emitDebounceMs);
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
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────

export function createDashboardProjectionService(
  config?: Partial<DashboardProjectionConfig>,
): DashboardProjectionService {
  return new DashboardProjectionService(config);
}
