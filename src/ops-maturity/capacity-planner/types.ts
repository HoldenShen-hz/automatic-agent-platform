export interface CapacitySnapshot {
  readonly timestamp: string;
  readonly divisionId: string;
  readonly activeTasks: number;
  readonly queuedTasks: number;
  readonly activeExecutions: number;
  readonly workerCount: number;
  readonly avgLatencyMs: number;
  readonly successRate: number;
  readonly resourceUtilization: number;
}

export interface ForecastRequest {
  readonly divisionId: string;
  readonly horizonHours: number;
  readonly currentSnapshot: CapacitySnapshot;
  readonly historicalSnapshots: readonly CapacitySnapshot[];
  readonly confidenceLevel: number;
}

export interface ResourceAllocation {
  readonly currentWorkers: number;
  readonly recommendedWorkers: number;
  readonly utilizationPercent: number;
  readonly recommendations: readonly string[];
}
