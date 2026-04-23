/**
 * ObservationDelta — incremental change between two TaskSituation snapshots.
 *
 * §A.6: Tracks what changed between observation cycles to support
 * efficient diff-based processing and change-triggered replanning.
 */
export interface ObservationDelta {
    /** Situation this delta applies to */
    taskId: string;
    /** Timestamp of the previous snapshot */
    previousTimestamp: number;
    /** Timestamp of the current snapshot */
    currentTimestamp: number;
    /** Fields that were added */
    addedFields: string[];
    /** Fields that were removed */
    removedFields: string[];
    /** Fields that changed value */
    changedFields: string[];
    /** Previous values for changed fields (keyed by field path) */
    previousValues: Record<string, unknown>;
    /** Current values for changed fields (keyed by field path) */
    currentValues: Record<string, unknown>;
    /** Numeric metrics that changed (keyed by metric name) */
    metricDeltas: Record<string, {
        previous: number;
        current: number;
        delta: number;
    }>;
    /** Blockers added */
    newBlockers: string[];
    /** Blockers resolved */
    resolvedBlockers: string[];
    /** Whether the change is significant enough to trigger replanning */
    significant: boolean;
}
