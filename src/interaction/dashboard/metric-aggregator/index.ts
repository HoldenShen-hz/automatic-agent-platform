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

function deriveTaskMetrics(statuses: readonly string[]): TaskMetricSnapshot {
  return {
    total: statuses.length,
    done: statuses.filter((item) => item === "done").length,
    inProgress: statuses.filter((item) => item === "in_progress").length,
    failed: statuses.filter((item) => item === "failed").length,
  };
}

function deriveWorkflowMetrics(statuses: readonly string[]): WorkflowMetricSnapshot {
  return {
    total: statuses.length,
    running: statuses.filter((item) => item === "in_progress").length,
    paused: statuses.filter((item) => item === "paused" || item === "awaiting_decision").length,
    completed: statuses.filter((item) => item === "done").length,
    failed: statuses.filter((item) => item === "failed").length,
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

function deriveApprovalMetrics(pendingCount: number, resolved24h: number): ApprovalMetricSnapshot {
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

export function summarizeTaskMetrics(statuses: readonly string[]): TaskMetricSnapshot {
  return {
    total: statuses.length,
    done: statuses.filter((item) => item === "done").length,
    inProgress: statuses.filter((item) => item === "in_progress").length,
    failed: statuses.filter((item) => item === "failed").length,
  };
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
