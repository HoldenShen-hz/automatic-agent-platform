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

/**
 * Workflow-level metric snapshot covering multi-step execution states.
 */
export interface WorkflowMetricSnapshot {
  readonly total: number;
  readonly active: number;
  readonly completed: number;
  readonly failed: number;
  readonly cancelled: number;
  readonly averageStepCount: number;
  readonly p95StepCount: number;
}

/**
 * System health snapshot covering platform-wide health indicators.
 */
export interface SystemHealthSnapshot {
  readonly score: number;
  readonly status: "ok" | "degraded" | "unhealthy";
  readonly queueBacklogSize: number;
  readonly findingCount: number;
  readonly providerHealthStatus: "healthy" | "degraded" | "failed";
  readonly providerSuccessRate: number;
}

/**
 * Queue-level metric snapshot covering job queue performance.
 */
export interface QueueMetricSnapshot {
  readonly totalQueues: number;
  readonly totalDepth: number;
  readonly totalEnqueuedPerMinute: number;
  readonly totalDequeuedPerMinute: number;
  readonly averageWaitTimeMs: number;
  readonly p95WaitTimeMs: number;
  readonly totalFailedJobs: number;
  readonly overallSuccessRate: number;
}

/**
 * Cost metric snapshot covering spend across domains and agents.
 */
export interface CostMetricSnapshot {
  readonly totalCostUsd: number;
  readonly costPerDomain: ReadonlyMap<string, number>;
  readonly costPerAgent: ReadonlyMap<string, number>;
  readonly costTrend: "increasing" | "stable" | "decreasing";
  readonly forecastCostUsd: number;
  readonly budgetUtilizationPercent: number;
}

/**
 * Derives workflow metrics from workflow statuses and step counts.
 */
export function deriveWorkflowMetrics(
  workflowStatuses: readonly string[],
  stepCounts: readonly number[],
): WorkflowMetricSnapshot {
  const total = workflowStatuses.length;
  const active = workflowStatuses.filter((s) => s === "active" || s === "pending").length;
  const completed = workflowStatuses.filter((s) => s === "completed").length;
  const failed = workflowStatuses.filter((s) => s === "failed").length;
  const cancelled = workflowStatuses.filter((s) => s === "cancelled").length;

  const sortedSteps = [...stepCounts].sort((a, b) => a - b);
  const avgSteps = stepCounts.length > 0
    ? stepCounts.reduce((sum, c) => sum + c, 0) / stepCounts.length
    : 0;
  const p95Index = Math.floor(sortedSteps.length * 0.95);
  const p95Steps = sortedSteps.length > 0
    ? sortedSteps[p95Index] ?? sortedSteps[sortedSteps.length - 1]!
    : 0;

  return {
    total,
    active,
    completed,
    failed,
    cancelled,
    averageStepCount: avgSteps,
    p95StepCount: p95Steps,
  };
}

/**
 * Derives system health snapshot from health score and situation data.
 */
export function deriveSystemHealthMetrics(
  score: number,
  status: "ok" | "degraded" | "unhealthy",
  queueBacklogSize: number,
  findingCount: number,
  providerHealthStatus: "healthy" | "degraded" | "failed",
  providerSuccessRate: number,
): SystemHealthSnapshot {
  return {
    score,
    status,
    queueBacklogSize,
    findingCount,
    providerHealthStatus,
    providerSuccessRate,
  };
}

/**
 * Derives queue metrics from queue statistics.
 */
export function deriveQueueMetrics(
  queueDepths: readonly number[],
  enqueuedPerMinute: readonly number[],
  dequeuedPerMinute: readonly number[],
  averageWaitTimesMs: readonly number[],
  p95WaitTimesMs: readonly number[],
  failedJobs: readonly number[],
): QueueMetricSnapshot {
  const totalDepth = queueDepths.reduce((sum, d) => sum + d, 0);
  const totalEnqueued = enqueuedPerMinute.reduce((sum, e) => sum + e, 0);
  const totalDequeued = dequeuedPerMinute.reduce((sum, d) => sum + d, 0);
  const totalFailed = failedJobs.reduce((sum, f) => sum + f, 0);

  const avgWait = averageWaitTimesMs.length > 0
    ? averageWaitTimesMs.reduce((sum, w) => sum + w, 0) / averageWaitTimesMs.length
    : 0;

  const sortedP95 = [...p95WaitTimesMs].sort((a, b) => a - b);
  const p95Index = Math.floor(sortedP95.length * 0.95);
  const p95Wait = sortedP95.length > 0
    ? sortedP95[p95Index] ?? sortedP95[sortedP95.length - 1]!
    : 0;

  const totalProcessed = totalEnqueued;
  const successRate = totalProcessed > 0 ? (totalProcessed - totalFailed) / totalProcessed : 1;

  return {
    totalQueues: queueDepths.length,
    totalDepth,
    totalEnqueuedPerMinute: totalEnqueued,
    totalDequeuedPerMinute: totalDequeued,
    averageWaitTimeMs: avgWait,
    p95WaitTimeMs: p95Wait,
    totalFailedJobs: totalFailed,
    overallSuccessRate: successRate,
  };
}

/**
 * Derives cost metrics from cost data per domain and agent.
 */
export function deriveCostMetrics(
  costPerDomain: ReadonlyMap<string, number>,
  costPerAgent: ReadonlyMap<string, number>,
  previousCostUsd: number,
  forecastCostUsd: number,
  budgetLimitUsd: number,
): CostMetricSnapshot {
  const totalCostUsd = Array.from(costPerDomain.values()).reduce((sum, c) => sum + c, 0);

  let trend: "increasing" | "stable" | "decreasing" = "stable";
  if (totalCostUsd > previousCostUsd * 1.05) {
    trend = "increasing";
  } else if (totalCostUsd < previousCostUsd * 0.95) {
    trend = "decreasing";
  }

  const budgetUtilization = budgetLimitUsd > 0 ? (totalCostUsd / budgetLimitUsd) * 100 : 0;

  return {
    totalCostUsd,
    costPerDomain,
    costPerAgent,
    costTrend: trend,
    forecastCostUsd,
    budgetUtilizationPercent: budgetUtilization,
  };
}
