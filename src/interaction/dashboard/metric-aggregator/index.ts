import type { TaskStatus, WorkflowStatus } from "../../../platform/contracts/types/status.js";

export interface TaskMetricSnapshot {
  readonly total: number;
  readonly done: number;
  readonly inProgress: number;
  readonly failed: number;
}

export interface WorkflowMetricSnapshot {
  readonly total: number;
  readonly running: number;
  readonly paused: number;
  readonly completed: number;
  readonly failed: number;
}

export interface SystemHealthSnapshot {
  readonly uptime: number;
  readonly errorRate: number;
  readonly p50LatencyMs: number;
  readonly p99LatencyMs: number;
  readonly queueDepth: number;
  readonly activeWorkers: number;
}

export interface CostMetricSnapshot {
  readonly totalCostUsd: number;
  readonly budgetUtilizationPercent: number;
  readonly forecastCostUsd: number;
  readonly costPerTask: number;
}

export interface ApprovalMetricSnapshot {
  readonly pendingCount: number;
  readonly avgWaitTimeMs: number;
  readonly resolvedLast24h: number;
}

export interface AlertMetricSnapshot {
  readonly criticalCount: number;
  readonly highCount: number;
  readonly normalCount: number;
  readonly lowCount: number;
}

export interface DashboardMetricSummary {
  readonly tasks: TaskMetricSnapshot;
  readonly workflows: WorkflowMetricSnapshot;
  readonly system: SystemHealthSnapshot;
  readonly cost: CostMetricSnapshot;
  readonly approvals: ApprovalMetricSnapshot;
  readonly alerts: AlertMetricSnapshot;
  readonly activeAgents: number;
  readonly successRate: number;
  readonly avgDurationMs: number;
}

// §43: Time-series metric entry for temporal aggregation
export interface MetricTimeSeriesEntry {
  readonly timestamp: string;
  readonly total: number;
  readonly done: number;
  readonly inProgress: number;
  readonly failed: number;
  readonly successRate: number;
  readonly latencyMs?: number;
}

// §43.2: Aggregated metrics within a time window
export interface WindowedMetricAggregation {
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly windowSizeMs: number;
  readonly totalTasks: number;
  readonly completedTasks: number;
  readonly failedTasks: number;
  readonly successRate: number;
  readonly p50LatencyMs: number;
  readonly p95LatencyMs: number;
  readonly p99LatencyMs: number;
  readonly throughput: number; // tasks per minute
}

// §43.3: Trend calculation result
export interface MetricTrend {
  readonly direction: "up" | "down" | "stable";
  readonly deltaPercent: number;
  readonly confidence: "low" | "medium" | "high";
}

// §43.4: SLO comparison result
export interface SloComparison {
  readonly sloTarget: number; // e.g., 0.99 for 99% success rate
  readonly currentValue: number;
  readonly gap: number; // positive = below SLO, negative = above SLO
  readonly status: "healthy" | "at_risk" | "breached";
  readonly burnRate?: number; // for error rate SLOs
}

// §43.5: Domain-level grouping
export interface DomainGroupedMetrics {
  readonly domainId: string;
  readonly taskCount: number;
  readonly successRate: number;
  readonly avgLatencyMs: number;
  readonly errorRate: number;
}

export interface MetricAggregatorOptions {
  readonly defaultSloTarget?: number;
  readonly defaultWindowSizeMs?: number;
  readonly enableTrendCalculation?: boolean;
}

const DEFAULT_SLO_TARGET = 0.95; // 95% success rate default
const DEFAULT_WINDOW_SIZE_MS = 5 * 60 * 1000; // 5 minute window
const DEFAULT_LATENCY_SLO_MS = 2000; // 2s P99 latency SLO

function computePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)] ?? 0;
}

function deriveTaskMetrics(statuses: readonly string[]): TaskMetricSnapshot {
  return {
    total: statuses.length,
    done: statuses.filter((item): item is TaskStatus => item === "done").length,
    inProgress: statuses.filter((item): item is TaskStatus => item === "in_progress").length,
    failed: statuses.filter((item): item is TaskStatus => item === "failed").length,
  };
}

function deriveWorkflowMetrics(statuses: readonly string[]): WorkflowMetricSnapshot {
  return {
    total: statuses.length,
    running: statuses.filter((item): item is WorkflowStatus => item === "running").length,
    paused: statuses.filter((item): item is WorkflowStatus => item === "paused" || item === "awaiting_decision").length,
    completed: statuses.filter((item): item is WorkflowStatus => item === "completed").length,
    failed: statuses.filter((item): item is WorkflowStatus => item === "failed").length,
  };
}

function deriveSystemHealth(
  healthStatus: string,
  queueDepth: number,
  workerCount: number,
  latenciesMs?: [number, number],
): SystemHealthSnapshot {
  const errorRate = healthStatus === "ok" ? 0.01 : healthStatus === "degraded" ? 0.05 : 0.15;
  return {
    uptime: healthStatus === "ok" ? 99.9 : healthStatus === "degraded" ? 95 : 85,
    errorRate: Number(errorRate.toFixed(4)),
    p50LatencyMs: latenciesMs ? latenciesMs[0] : 250,
    p99LatencyMs: latenciesMs ? latenciesMs[1] : 2000,
    queueDepth,
    activeWorkers: workerCount,
  };
}

function deriveCostMetrics(totalCost: number, budgetLimit: number, taskCount: number): CostMetricSnapshot {
  return {
    totalCostUsd: Number(totalCost.toFixed(2)),
    budgetUtilizationPercent: budgetLimit > 0 ? Math.min(100, Number((totalCost / budgetLimit * 100).toFixed(2))) : 0,
    forecastCostUsd: Number((totalCost * 1.2).toFixed(2)),
    costPerTask: taskCount > 0 ? Number((totalCost / taskCount).toFixed(4)) : 0,
  };
}

function deriveApprovalMetrics(pendingCount: number, resolvedLast24h: number): ApprovalMetricSnapshot {
  return {
    pendingCount,
    avgWaitTimeMs: pendingCount > 10 ? 30000 : pendingCount > 5 ? 15000 : 5000,
    resolvedLast24h,
  };
}

function deriveAlertMetrics(alertCounts: Record<string, number>): AlertMetricSnapshot {
  return {
    criticalCount: alertCounts["critical"] ?? 0,
    highCount: alertCounts["high"] ?? 0,
    normalCount: alertCounts["normal"] ?? 0,
    lowCount: alertCounts["low"] ?? 0,
  };
}

/**
 * @deprecated Use aggregateWindowedMetrics or buildDashboardMetricsWithAggregation instead
 */
export function summarizeTaskMetrics(statuses: readonly string[]): TaskMetricSnapshot {
  return {
    total: statuses.length,
    done: statuses.filter((item) => item === "done").length,
    inProgress: statuses.filter((item) => item === "in_progress").length,
    failed: statuses.filter((item) => item === "failed").length,
  };
}

/**
 * §43.2: Aggregate metrics within a time window.
 *
 * @param timeSeries - Time-series entries within the window
 * @param windowSizeMs - Window size in milliseconds
 */
export function aggregateWindowedMetrics(
  timeSeries: readonly MetricTimeSeriesEntry[],
  windowSizeMs: number,
): WindowedMetricAggregation {
  if (timeSeries.length === 0) {
    const now = new Date().toISOString();
    return {
      windowStart: now,
      windowEnd: now,
      windowSizeMs,
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      successRate: 1.0,
      p50LatencyMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      throughput: 0,
    };
  }

  const sortedEntries = [...timeSeries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const windowStart = sortedEntries[0]!.timestamp;
  const windowEnd = sortedEntries[sortedEntries.length - 1]!.timestamp;

  const totalTasks = timeSeries.reduce((sum, e) => sum + e.total, 0);
  const completedTasks = timeSeries.reduce((sum, e) => sum + e.done, 0);
  const failedTasks = timeSeries.reduce((sum, e) => sum + e.failed, 0);
  const successRate = totalTasks > 0 ? completedTasks / totalTasks : 1.0;

  // Collect latency values for percentile calculation
  const latencyValues = timeSeries
    .filter((e) => e.latencyMs != null)
    .map((e) => e.latencyMs as number);

  const windowDurationMs = new Date(windowEnd).getTime() - new Date(windowStart).getTime();
  const windowDurationMinutes = Math.max(1, windowDurationMs / 60000);
  const throughput = completedTasks / windowDurationMinutes;

  return {
    windowStart,
    windowEnd,
    windowSizeMs,
    totalTasks,
    completedTasks,
    failedTasks,
    successRate: Number(successRate.toFixed(4)),
    p50LatencyMs: computePercentile(latencyValues, 50),
    p95LatencyMs: computePercentile(latencyValues, 95),
    p99LatencyMs: computePercentile(latencyValues, 99),
    throughput: Number(throughput.toFixed(2)),
  };
}

/**
 * §43.3: Calculate trend between two metric values.
 */
export function calculateMetricTrend(current: number, previous: number): MetricTrend {
  if (previous === 0) {
    return { direction: "stable", deltaPercent: 0, confidence: "low" };
  }
  const deltaPercent = ((current - previous) / previous) * 100;
  const direction = deltaPercent > 5 ? "up" : deltaPercent < -5 ? "down" : "stable";
  const confidence: MetricTrend["confidence"] = previous > 10 ? "high" : previous > 5 ? "medium" : "low";
  return {
    direction,
    deltaPercent: Number(deltaPercent.toFixed(2)),
    confidence,
  };
}

/**
 * §43.4: Compare current metric value against SLO target.
 */
export function compareSloValue(
  currentValue: number,
  sloTarget: number,
  metricType: "success_rate" | "latency" = "success_rate",
): SloComparison {
  if (metricType === "success_rate") {
    // For success rate, higher is better
    const gap = sloTarget - currentValue;
    const status = gap > 0.05 ? "breached" : gap > 0.01 ? "at_risk" : "healthy";
    return {
      sloTarget,
      currentValue: Number(currentValue.toFixed(4)),
      gap: Number(gap.toFixed(4)),
      status,
    };
  } else {
    // For latency, lower is better
    const gap = currentValue - sloTarget;
    const status = gap > sloTarget * 0.5 ? "breached" : gap > sloTarget * 0.1 ? "at_risk" : "healthy";
    return {
      sloTarget,
      currentValue: Number(currentValue.toFixed(2)),
      gap: Number(gap.toFixed(2)),
      status,
    };
  }
}

/**
 * §43.5: Group metrics by domain.
 */
export function groupMetricsByDomain(
  domainMetrics: readonly { domainId: string; total: number; done: number; failed: number; latencyMs?: number }[],
): DomainGroupedMetrics[] {
  return domainMetrics.map((dm) => {
    const successRate = dm.total > 0 ? dm.done / dm.total : 1.0;
    const errorRate = dm.total > 0 ? dm.failed / dm.total : 0;
    return {
      domainId: dm.domainId,
      taskCount: dm.total,
      successRate: Number(successRate.toFixed(4)),
      avgLatencyMs: dm.latencyMs ?? 0,
      errorRate: Number(errorRate.toFixed(4)),
    };
  });
}

/**
 * MetricAggregator provides comprehensive metric aggregation per §43.2-43.5.
 */
export class MetricAggregator {
  private readonly defaultSloTarget: number;
  private readonly defaultWindowSizeMs: number;
  private readonly enableTrendCalculation: boolean;
  private readonly timeSeriesHistory: MetricTimeSeriesEntry[] = [];
  private readonly maxHistoryEntries: number;

  public constructor(options?: MetricAggregatorOptions) {
    this.defaultSloTarget = options?.defaultSloTarget ?? DEFAULT_SLO_TARGET;
    this.defaultWindowSizeMs = options?.defaultWindowSizeMs ?? DEFAULT_WINDOW_SIZE_MS;
    this.enableTrendCalculation = options?.enableTrendCalculation ?? true;
    this.maxHistoryEntries = 1000; // Keep up to 1000 time-series entries
  }

  /**
   * Add a time-series entry to the history.
   */
  public addTimeSeriesEntry(entry: MetricTimeSeriesEntry): void {
    this.timeSeriesHistory.push(entry);
    // Trim history to max entries
    if (this.timeSeriesHistory.length > this.maxHistoryEntries) {
      this.timeSeriesHistory.splice(0, this.timeSeriesHistory.length - this.maxHistoryEntries);
    }
  }

  /**
   * Get aggregated metrics for the default window.
   */
  public getWindowedAggregation(windowSizeMs?: number): WindowedMetricAggregation {
    const windowMs = windowSizeMs ?? this.defaultWindowSizeMs;
    const cutoffTime = Date.now() - windowMs;
    const windowEntries = this.timeSeriesHistory.filter(
      (e) => new Date(e.timestamp).getTime() >= cutoffTime,
    );
    return aggregateWindowedMetrics(windowEntries, windowMs);
  }

  /**
   * Calculate SLO comparison for success rate.
   */
  public getSloComparison(currentSuccessRate: number, sloTarget?: number): SloComparison {
    return compareSloValue(
      currentSuccessRate,
      sloTarget ?? this.defaultSloTarget,
      "success_rate",
    );
  }

  /**
   * Calculate SLO comparison for latency.
   */
  public getLatencySloComparison(p99LatencyMs: number, sloTarget?: number): SloComparison {
    return compareSloValue(
      p99LatencyMs,
      sloTarget ?? DEFAULT_LATENCY_SLO_MS,
      "latency",
    );
  }

  /**
   * Get trend for success rate over the history.
   */
  public getSuccessRateTrend(): MetricTrend | null {
    if (this.timeSeriesHistory.length < 2) return null;
    const sorted = [...this.timeSeriesHistory].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
    const midpoint = Math.floor(sorted.length / 2);
    const olderEntries = sorted.slice(0, midpoint);
    const newerEntries = sorted.slice(midpoint);
    const olderRate = olderEntries.reduce((sum, e) => sum + e.successRate, 0) / olderEntries.length;
    const newerRate = newerEntries.reduce((sum, e) => sum + e.successRate, 0) / newerEntries.length;
    return calculateMetricTrend(newerRate, olderRate);
  }

  /**
   * Get all time-series history.
   */
  public getTimeSeriesHistory(): readonly MetricTimeSeriesEntry[] {
    return this.timeSeriesHistory;
  }
}

export function buildDashboardMetrics(options: {
  taskStatuses: readonly string[];
  workflowStatuses: readonly string[];
  healthStatus?: string;
  queueDepth?: number;
  workerCount?: number;
  p50LatencyMs?: number;
  p99LatencyMs?: number;
  totalCostUsd?: number;
  budgetLimit?: number;
  pendingApprovals?: number;
  resolvedApprovals24h?: number;
  alertCounts?: Record<string, number>;
}): DashboardMetricSummary {
  const {
    taskStatuses = [],
    workflowStatuses = [],
    healthStatus = "ok",
    queueDepth = 0,
    workerCount = 0,
    p50LatencyMs = 250,
    p99LatencyMs = 2000,
    totalCostUsd = 0,
    budgetLimit = 10000,
    pendingApprovals = 0,
    resolvedApprovals24h = 0,
    alertCounts = {},
  } = options;

  const taskMetrics = deriveTaskMetrics(taskStatuses);
  const workflowMetrics = deriveWorkflowMetrics(workflowStatuses);
  const systemHealth = deriveSystemHealth(healthStatus, queueDepth, workerCount, [p50LatencyMs, p99LatencyMs]);
  const costMetrics = deriveCostMetrics(totalCostUsd, budgetLimit, taskMetrics.total);
  const approvalMetrics = deriveApprovalMetrics(pendingApprovals, resolvedApprovals24h);
  const alertMetrics = deriveAlertMetrics(alertCounts);

  const completedCount = taskMetrics.done;
  const failedCount = taskMetrics.failed;
  const successRate = taskMetrics.total > 0 ? completedCount / taskMetrics.total : 1.0;
  const errorRate = taskMetrics.total > 0 ? failedCount / taskMetrics.total : 0;

  // Calculate active agents as in-progress tasks
  const activeAgents = taskMetrics.inProgress;

  // Estimate avg duration from queue depth and completion rate
  const avgDurationMs = completedCount > 0 ? Math.round((queueDepth * 1000) / Math.max(1, completedCount)) : 0;

  return {
    tasks: taskMetrics,
    workflows: workflowMetrics,
    system: systemHealth,
    cost: costMetrics,
    approvals: approvalMetrics,
    alerts: alertMetrics,
    activeAgents,
    successRate: Number(successRate.toFixed(4)),
    avgDurationMs,
  };
}

/**
 * Build dashboard metrics with full temporal aggregation and SLO comparison per §43.2-43.5.
 */
export function buildDashboardMetricsWithAggregation(options: {
  taskStatuses: readonly string[];
  workflowStatuses: readonly string[];
  healthStatus?: string;
  queueDepth?: number;
  workerCount?: number;
  p50LatencyMs?: number;
  p99LatencyMs?: number;
  totalCostUsd?: number;
  budgetLimit?: number;
  pendingApprovals?: number;
  resolvedApprovals24h?: number;
  alertCounts?: Record<string, number>;
  domainMetrics?: readonly { domainId: string; total: number; done: number; failed: number; latencyMs?: number }[];
  timeSeriesHistory?: readonly MetricTimeSeriesEntry[];
  sloTarget?: number;
}): {
  summary: DashboardMetricSummary;
  windowedAggregation: WindowedMetricAggregation;
  sloComparison: SloComparison;
  latencySloComparison: SloComparison;
  domainGroupedMetrics: DomainGroupedMetrics[];
  successRateTrend: MetricTrend | null;
} {
  const {
    taskStatuses = [],
    workflowStatuses = [],
    healthStatus = "ok",
    queueDepth = 0,
    workerCount = 0,
    p50LatencyMs = 250,
    p99LatencyMs = 2000,
    totalCostUsd = 0,
    budgetLimit = 10000,
    pendingApprovals = 0,
    resolvedApprovals24h = 0,
    alertCounts = {},
    domainMetrics = [],
    timeSeriesHistory = [],
    sloTarget = DEFAULT_SLO_TARGET,
  } = options;

  const summary = buildDashboardMetrics({
    taskStatuses,
    workflowStatuses,
    healthStatus,
    queueDepth,
    workerCount,
    p50LatencyMs,
    p99LatencyMs,
    totalCostUsd,
    budgetLimit,
    pendingApprovals,
    resolvedApprovals24h,
    alertCounts,
  });

  const windowedAggregation = aggregateWindowedMetrics(timeSeriesHistory, DEFAULT_WINDOW_SIZE_MS);
  const sloComparison = compareSloValue(summary.successRate, sloTarget, "success_rate");
  const latencySloComparison = compareSloValue(p99LatencyMs, DEFAULT_LATENCY_SLO_MS, "latency");
  const domainGroupedMetrics = groupMetricsByDomain(domainMetrics);

  // Calculate trend if we have enough history
  let successRateTrend: MetricTrend | null = null;
  if (timeSeriesHistory.length >= 2) {
    const sorted = [...timeSeriesHistory].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
    const midpoint = Math.floor(sorted.length / 2);
    const olderEntries = sorted.slice(0, midpoint);
    const newerEntries = sorted.slice(midpoint);
    const olderRate = olderEntries.reduce((sum, e) => sum + e.successRate, 0) / olderEntries.length;
    const newerRate = newerEntries.reduce((sum, e) => sum + e.successRate, 0) / newerEntries.length;
    successRateTrend = calculateMetricTrend(newerRate, olderRate);
  }

  return {
    summary,
    windowedAggregation,
    sloComparison,
    latencySloComparison,
    domainGroupedMetrics,
    successRateTrend,
  };
}