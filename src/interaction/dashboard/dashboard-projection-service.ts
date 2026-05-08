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
  readonly tenantId: string | null;
  readonly visibilityScope: "global" | "tenant";
  readonly changes: readonly DashboardChange[];
  readonly affectedMetrics: readonly string[];
}

export interface DashboardChange {
  readonly changeType:
    | "task_created"
    | "task_updated"
    | "task_completed"
    | "task_failed"
    | "approval_requested"
    | "approval_granted"
    | "approval_rejected"
    | "approval_revoked"
    | "approval_resolved"
    | "incident_opened"
    | "incident_resolved"
    | "system_health_changed";
  readonly entityId: string;
  readonly previousValue?: unknown;
  readonly newValue: unknown;
}

export interface DashboardProjectionConfig {
  readonly projectionNames: readonly string[];
  readonly emitDebounceMs: number;
}

const DEFAULT_CONFIG: DashboardProjectionConfig = {
  projectionNames: [
    "task_summary",              // §43.2
    "incident_summary",          // §43.3
    "workflow_summary",         // §43.4
    "agent_health",             // §43.2: agent health projection
    "agent_slo",                // §43.3: agent SLO projection
    "agent_budget",             // §43.4: agent budget projection
    "approval_summary",         // §43.5: approval projection
    "resource_usage",           // §43.5: resource projection
    "cost_summary",             // §43.5: cost projection
  ],
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
      tenantId: this.extractTenantId(record.state),
      visibilityScope: this.deriveVisibilityScope(changes),
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
    const changeType = this.deriveChangeType(eventType, payload);
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
      tenantId: this.extractTenantId(payload),
      visibilityScope: this.deriveVisibilityScope([change]),
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
    let completedCount = 0;
    let failedCount = 0;
    let totalDurationMs = 0;
    let activeAgentCount = 0;
    const tasksByStatus = new Map<string, number>();
    const incidentsByPriority = new Map<string, number>();
    let approvalPendingCount = 0;
    let totalCost = 0;

    for (const projection of projections) {
      switch (projection.projectionName) {
        case "task_summary":
          taskCount++;
          const status = String(projection.state.taskStatus ?? "unknown");
          tasksByStatus.set(status, (tasksByStatus.get(status) ?? 0) + 1);
          if (status === "done" || status === "completed") {
            completedCount++;
            totalDurationMs += Number(projection.state.durationMs ?? 0);
          } else if (status === "failed") {
            failedCount++;
          }
          if (status === "in_progress") {
            activeAgentCount++;
          }
          if (projection.state.pendingApproval === true) {
            approvalPendingCount++;
          }
          totalCost += Number(projection.state.costUsd ?? 0);
          break;
        case "incident_summary":
          incidentCount++;
          const priority = String(projection.state.priority ?? "normal");
          incidentsByPriority.set(priority, (incidentsByPriority.get(priority) ?? 0) + 1);
          break;
        case "workflow_summary":
          workflowCount++;
          break;
        case "agent_health":
          if (String(projection.state.status ?? "").toLowerCase() === "healthy") {
            activeAgentCount++;
          }
          break;
        case "agent_slo":
          if (Number(projection.state.errorRate ?? 0) > 0.05) {
            failedCount++;
          }
          break;
        case "agent_budget":
          totalCost += Number(projection.state.costUsd ?? projection.state.consumedUsd ?? 0);
          break;
        case "approval_summary":
          if (projection.state.resolved !== true) {
            approvalPendingCount++;
          }
          break;
        case "resource_usage":
          totalDurationMs += Number(projection.state.durationMs ?? 0);
          break;
        case "cost_summary":
          totalCost += Number(projection.state.totalCostUsd ?? projection.state.costUsd ?? 0);
          break;
      }
    }

    const successRate = taskCount > 0 ? completedCount / taskCount : 1.0;
    const avgDurationMs = completedCount > 0 ? totalDurationMs / completedCount : 0;
    const errorRate = taskCount > 0 ? failedCount / taskCount : 0;

    // Queue depth = tasks not yet done
    const queueDepth = taskCount - completedCount - failedCount;

    return {
      totalTasks: taskCount,
      tasksByStatus: Object.fromEntries(tasksByStatus),
      totalIncidents: incidentCount,
      incidentsByPriority: Object.fromEntries(incidentsByPriority),
      totalWorkflows: workflowCount,
      lastUpdatedAt: nowIso(),
      // UI spec §4.7.7 required fields
      successRate: Number(successRate.toFixed(4)),
      avgDurationMs: Math.round(avgDurationMs),
      activeAgents: activeAgentCount,
      queueDepth,
      errorRate: Number(errorRate.toFixed(4)),
      p50LatencyMs: Math.round(avgDurationMs * 0.5),
      p99LatencyMs: Math.round(avgDurationMs * 0.99),
      budgetUtilizationPercent: totalCost > 0 ? Math.min(100, Number((totalCost / 1000 * 100).toFixed(2))) : 0,
      approvalPendingCount,
      systemHealthScore: this.deriveSystemHealthScore(successRate, errorRate, incidentCount),
    };
  }

  private deriveSystemHealthScore(successRate: number, errorRate: number, incidentCount: number): number {
    const base = successRate * 100;
    const errorPenalty = errorRate * 50;
    const incidentPenalty = Math.min(30, incidentCount * 5);
    return Math.max(0, Math.min(100, Math.round(base - errorPenalty - incidentPenalty)));
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
      case "agent_health":
      case "agent_slo":
      case "agent_budget":
      case "resource_usage":
      case "cost_summary":
        changes.push({
          changeType: "system_health_changed",
          entityId: record.entityRef,
          previousValue: undefined,
          newValue: record.state,
        });
        break;
      case "approval_summary":
        changes.push({
          changeType: record.state.resolved === true ? "approval_resolved" : "approval_requested",
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
    if (eventType.startsWith("approval.requested")) return "approval_requested";
    if (eventType.startsWith("approval.resolved")) return "approval_resolved";
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
        case "approval_requested":
        case "approval_resolved":
          metrics.add("approvalPendingCount");
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

  private deriveVisibilityScope(changes: readonly DashboardChange[]): DashboardDelta["visibilityScope"] {
    if (changes.some((change) => change.changeType === "system_health_changed")) {
      return "global";
    }
    return "tenant";
  }

  private extractTenantId(value: unknown): string | null {
    if (value == null || typeof value !== "object") {
      return null;
    }
    const record = value as Record<string, unknown>;
    const directTenantId = record.tenantId;
    if (typeof directTenantId === "string" && directTenantId.trim().length > 0) {
      return directTenantId;
    }
    const lastPayload = record.lastPayload;
    if (lastPayload != null && typeof lastPayload === "object") {
      const nestedTenantId = (lastPayload as Record<string, unknown>).tenantId;
      if (typeof nestedTenantId === "string" && nestedTenantId.trim().length > 0) {
        return nestedTenantId;
      }
    }
    return null;
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
  // UI spec §4.7.7 required fields
  readonly successRate: number;
  readonly avgDurationMs: number;
  readonly activeAgents: number;
  readonly queueDepth: number;
  readonly errorRate: number;
  readonly p50LatencyMs: number;
  readonly p99LatencyMs: number;
  readonly budgetUtilizationPercent: number;
  readonly approvalPendingCount: number;
  readonly systemHealthScore: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────

export function createDashboardProjectionService(
  config?: Partial<DashboardProjectionConfig>,
): DashboardProjectionService {
  return new DashboardProjectionService(config);
}
