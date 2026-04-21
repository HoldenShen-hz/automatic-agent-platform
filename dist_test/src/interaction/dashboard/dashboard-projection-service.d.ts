/**
 * Dashboard Projection Service
 *
 * Provides incremental dashboard updates using projections as the data source.
 * Supports delta-based updates instead of full queries.
 *
 * Architecture: §43 仪表盘 - Dashboard with incremental updates
 * @see docs_zh/architecture/00-platform-architecture.md §43
 */
import type { ProjectionRecord } from "../../platform/state-evidence/projections/index.js";
import type { TypedEventType } from "../../platform/state-evidence/events/typed-event-bus.js";
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
export declare class DashboardProjectionService {
    private readonly config;
    private readonly pendingDeltas;
    private lastEmittedAt;
    private debounceTimer;
    constructor(config?: Partial<DashboardProjectionConfig>);
    /**
     * Processes a projection record change and generates dashboard delta.
     *
     * @param record - Updated projection record
     * @returns Generated dashboard delta or null if no significant change
     */
    processProjectionUpdate(record: ProjectionRecord): DashboardDelta | null;
    /**
     * Processes an event and generates dashboard delta.
     *
     * @param eventType - Type of event
     * @param payload - Event payload
     * @returns Generated dashboard delta or null if no significant change
     */
    processEvent(eventType: TypedEventType, payload: unknown): DashboardDelta | null;
    /**
     * Gets all pending deltas since last emission.
     *
     * @returns Array of pending deltas
     */
    getPendingDeltas(): readonly DashboardDelta[];
    /**
     * Consumes and clears all pending deltas.
     *
     * @returns Array of consumed deltas
     */
    consumePendingDeltas(): readonly DashboardDelta[];
    /**
     * Checks if there are pending deltas ready to emit.
     */
    hasPendingDeltas(): boolean;
    /**
     * Forces immediate emission of pending deltas (bypasses debounce).
     *
     * @returns Array of emitted deltas
     */
    flush(): readonly DashboardDelta[];
    /**
     * Builds current dashboard state from projection records.
     *
     * @param projections - Array of projection records
     * @returns Aggregated dashboard state
     */
    buildStateFromProjections(projections: readonly ProjectionRecord[]): DashboardProjectionState;
    /**
     * Clears all pending deltas without emitting.
     */
    clearPendingDeltas(): void;
    private deriveChanges;
    private inferTaskChangeType;
    private deriveChangeType;
    private extractEntityId;
    private deriveAffectedMetrics;
    private scheduleEmit;
}
export interface DashboardProjectionState {
    readonly totalTasks: number;
    readonly tasksByStatus: Record<string, number>;
    readonly totalIncidents: number;
    readonly incidentsByPriority: Record<string, number>;
    readonly totalWorkflows: number;
    readonly lastUpdatedAt: string;
}
export declare function createDashboardProjectionService(config?: Partial<DashboardProjectionConfig>): DashboardProjectionService;
