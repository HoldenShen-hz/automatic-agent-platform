export interface TaskMetricSnapshot {
  readonly total: number;
  readonly done: number;
  readonly inProgress: number;
  readonly failed: number;
}

export function summarizeTaskMetrics(statuses: readonly string[]): TaskMetricSnapshot {
  return {
    total: statuses.length,
    done: statuses.filter((item) => item === "done").length,
    inProgress: statuses.filter((item) => item === "in_progress").length,
    failed: statuses.filter((item) => item === "failed").length,
  };
}
