export interface TaskMetricSnapshot {
    readonly total: number;
    readonly done: number;
    readonly inProgress: number;
    readonly failed: number;
}
export declare function summarizeTaskMetrics(statuses: readonly string[]): TaskMetricSnapshot;
