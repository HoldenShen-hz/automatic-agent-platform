/**
 * Metrics Service
 *
 * Aggregates runtime metrics from the database to produce a comprehensive metrics summary.
 * This summary includes task counts, workflow metrics, execution metrics, recovery metrics,
 * step performance metrics, cost metrics, approval metrics, event metrics, and runtime health.
 *
 * The service queries SQLite directly to build statistics over various windows and is
 * primarily used by OperationsGovernanceService for SLO evaluation and reporting.
 *
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/contracts/observability_contract.md | Observability Contract}
 */

import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import { nowIso } from "../../contracts/types/ids.js";
import type { HealthStatusReport } from "./health-service.js";
import { HealthService } from "./health-service.js";

/**
 * Summary of runtime metrics across all tasks, workflows, and executions.
 * Used for SLO evaluation, governance reporting, and observability dashboards.
 */
export interface RuntimeMetricsSummary {
  generatedAt: string;
  window: {
    firstTaskCreatedAt: string | null;
    lastTaskUpdatedAt: string | null;
  };
  taskMetrics: {
    total: number;
    terminalCount: number;
    successCount: number;
    failedCount: number;
    cancelledCount: number;
    activeCount: number;
    successRate: number;
    completionRate: number;
  };
  workflowMetrics: {
    total: number;
    completedCount: number;
    failedCount: number;
    cancelledCount: number;
    retriedCount: number;
    retryRate: number;
  };
  executionMetrics: {
    total: number;
    activeCount: number;
    retryAttemptCount: number;
    retryRate: number;
    supersededCount: number;
  };
  recoveryMetrics: {
    taskCount: number;
    successfulTaskCount: number;
    successRate: number;
    decisionCount: number;
    repairEventCount: number;
    deadLetterCount: number;
    cancelledCount: number;
  };
  stepMetrics: {
    total: number;
    averageDurationMs: number | null;
    p95DurationMs: number | null;
    averageTokenCost: number | null;
    totalTokenCost: number;
  };
  costMetrics: {
    totalActualCostUsd: number;
    averageActualCostUsdPerTask: number | null;
    averageActualCostUsdPerSuccessfulTask: number | null;
  };
  approvalMetrics: {
    total: number;
    pendingCount: number;
    resolvedCount: number;
    taskTriggerCount: number;
    taskTriggerRate: number;
  };
  eventMetrics: {
    total: number;
    tier1Count: number;
    tier2Count: number;
    tier3Count: number;
    pendingTier1AckCount: number;
    failedTier1AckCount: number;
  };
  runtimeMetrics: {
    status: HealthStatusReport["status"];
    degradationMode: HealthStatusReport["degradationMode"];
    providerSuccessRate: number;
    activeExecutions: number;
    queuedTasks: number;
    eventLoopLagMs: number | null;
    memoryRssMb: number;
    tier1AckBacklog: number;
    queueGovernance: HealthStatusReport["queueGovernance"];
    workerHealth: HealthStatusReport["workerHealth"];
    findings: string[];
  };
}

/**
 * MetricsService aggregates database statistics into runtime metric summaries.
 * Used for governance reporting, SLO evaluation, and observability.
 */
export class MetricsService {
  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    private readonly healthService: HealthService,
  ) {}

  /**
   * Builds a comprehensive metrics summary by querying the database.
   * Includes task counts, workflow metrics, execution metrics, recovery metrics,
   * step performance, cost metrics, approval metrics, event metrics, and runtime health.
   */
  public buildSummary(generatedAt: string = nowIso()): RuntimeMetricsSummary {
    // Query task creation/update window
    const taskWindow = this.selectRow<{
      firstTaskCreatedAt: string | null;
      lastTaskUpdatedAt: string | null;
    }>(`SELECT MIN(created_at) AS firstTaskCreatedAt, MAX(updated_at) AS lastTaskUpdatedAt FROM tasks`);

    // Query task status counts
    const taskCounts = this.selectRow<{
      total: number;
      terminalCount: number;
      successCount: number;
      failedCount: number;
      cancelledCount: number;
      activeCount: number;
    }>(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status IN ('done', 'failed', 'cancelled') THEN 1 ELSE 0 END) AS terminalCount,
         SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS successCount,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failedCount,
         SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelledCount,
         SUM(CASE WHEN status NOT IN ('done', 'failed', 'cancelled') THEN 1 ELSE 0 END) AS activeCount
       FROM tasks`,
    );

    // Query workflow status counts
    const workflowCounts = this.selectRow<{
      total: number;
      completedCount: number;
      failedCount: number;
      cancelledCount: number;
      retriedCount: number;
    }>(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completedCount,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failedCount,
         SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelledCount,
         SUM(CASE WHEN retry_count > 0 THEN 1 ELSE 0 END) AS retriedCount
       FROM workflow_state`,
    );

    // Query execution status counts
    const executionCounts = this.selectRow<{
      total: number;
      activeCount: number;
      retryAttemptCount: number;
      supersededCount: number;
    }>(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status IN ('created', 'prechecking', 'executing', 'blocked') THEN 1 ELSE 0 END) AS activeCount,
         SUM(CASE WHEN attempt > 1 THEN 1 ELSE 0 END) AS retryAttemptCount,
         SUM(CASE WHEN status = 'superseded' THEN 1 ELSE 0 END) AS supersededCount
       FROM executions`,
    );

    // Query recovery event counts
    const recoveryCounts = this.selectRow<{
      taskCount: number;
      successfulTaskCount: number;
      decisionCount: number;
      repairEventCount: number;
      deadLetterCount: number;
      cancelledCount: number;
    }>(
      `SELECT
         COUNT(DISTINCT e.task_id) AS taskCount,
         COUNT(DISTINCT CASE WHEN t.status = 'done' THEN e.task_id END) AS successfulTaskCount,
         SUM(CASE WHEN e.event_type = 'recovery:decision_recorded' THEN 1 ELSE 0 END) AS decisionCount,
         SUM(CASE WHEN e.event_type = 'recovery:repair_applied' THEN 1 ELSE 0 END) AS repairEventCount,
         SUM(CASE WHEN e.event_type = 'recovery:dead_lettered' THEN 1 ELSE 0 END) AS deadLetterCount,
         SUM(CASE WHEN e.event_type = 'recovery:cancelled' THEN 1 ELSE 0 END) AS cancelledCount
       FROM events e
       LEFT JOIN tasks t ON t.id = e.task_id
       WHERE e.task_id IS NOT NULL
         AND e.event_type LIKE 'recovery:%'`,
    );

    // Query approval counts
    const approvalCounts = this.selectRow<{
      total: number;
      pendingCount: number;
      resolvedCount: number;
      taskTriggerCount: number;
    }>(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'requested' THEN 1 ELSE 0 END) AS pendingCount,
         SUM(CASE WHEN status != 'requested' THEN 1 ELSE 0 END) AS resolvedCount,
         COUNT(DISTINCT task_id) AS taskTriggerCount
       FROM approvals`,
    );

    // Query event tier counts
    const eventCounts = this.selectRow<{
      total: number;
      tier1Count: number;
      tier2Count: number;
      tier3Count: number;
    }>(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN event_tier = 'tier_1' THEN 1 ELSE 0 END) AS tier1Count,
         SUM(CASE WHEN event_tier = 'tier_2' THEN 1 ELSE 0 END) AS tier2Count,
         SUM(CASE WHEN event_tier = 'tier_3' THEN 1 ELSE 0 END) AS tier3Count
       FROM events`,
    );

    // Query event consumer ack counts (for tier-1 pending/failed acks)
    const ackCounts = this.selectRow<{
      pendingTier1AckCount: number;
      failedTier1AckCount: number;
    }>(
      `SELECT
         COALESCE(SUM(CASE WHEN a.status = 'pending' THEN 1 ELSE 0 END), 0) AS pendingTier1AckCount,
         COALESCE(SUM(CASE WHEN a.status = 'failed' THEN 1 ELSE 0 END), 0) AS failedTier1AckCount
       FROM event_consumer_acks a
       INNER JOIN events e ON e.id = a.event_id
       WHERE e.event_tier = 'tier_1'`,
    );

    // Query cost metrics
    const costCounts = this.selectRow<{
      totalActualCostUsd: number;
      averageActualCostUsdPerTask: number | null;
      averageActualCostUsdPerSuccessfulTask: number | null;
    }>(
      `SELECT
         COALESCE(SUM(actual_cost_usd), 0) AS totalActualCostUsd,
         AVG(actual_cost_usd) AS averageActualCostUsdPerTask,
         AVG(CASE WHEN status = 'done' THEN actual_cost_usd END) AS averageActualCostUsdPerSuccessfulTask
       FROM tasks`,
    );

    // Query step durations and token costs for performance metrics
    const stepRows = this.db.connection
      .prepare(`SELECT duration_ms AS durationMs, token_cost AS tokenCost FROM workflow_step_outputs ORDER BY duration_ms ASC`)
      .all() as Array<{ durationMs: number; tokenCost: number }>;

    // Get current health status
    const health = this.healthService.getReport();

    // Calculate derived metrics
    const durations = stepRows.map((row) => Number(row.durationMs ?? 0));
    const tokenCosts = stepRows.map((row) => Number(row.tokenCost ?? 0));
    const totalTokenCost = tokenCosts.reduce((sum, value) => sum + value, 0);

    return {
      generatedAt,
      window: {
        firstTaskCreatedAt: taskWindow.firstTaskCreatedAt,
        lastTaskUpdatedAt: taskWindow.lastTaskUpdatedAt,
      },
      taskMetrics: {
        total: taskCounts.total,
        terminalCount: taskCounts.terminalCount,
        successCount: taskCounts.successCount,
        failedCount: taskCounts.failedCount,
        cancelledCount: taskCounts.cancelledCount,
        activeCount: taskCounts.activeCount,
        successRate: ratio(taskCounts.successCount, taskCounts.terminalCount),
        completionRate: ratio(taskCounts.terminalCount, taskCounts.total),
      },
      workflowMetrics: {
        total: workflowCounts.total,
        completedCount: workflowCounts.completedCount,
        failedCount: workflowCounts.failedCount,
        cancelledCount: workflowCounts.cancelledCount,
        retriedCount: workflowCounts.retriedCount,
        retryRate: ratio(workflowCounts.retriedCount, workflowCounts.total),
      },
      executionMetrics: {
        total: executionCounts.total,
        activeCount: executionCounts.activeCount,
        retryAttemptCount: executionCounts.retryAttemptCount,
        retryRate: ratio(executionCounts.retryAttemptCount, executionCounts.total),
        supersededCount: executionCounts.supersededCount,
      },
      recoveryMetrics: {
        taskCount: recoveryCounts.taskCount,
        successfulTaskCount: recoveryCounts.successfulTaskCount,
        successRate: ratio(recoveryCounts.successfulTaskCount, recoveryCounts.taskCount),
        decisionCount: recoveryCounts.decisionCount,
        repairEventCount: recoveryCounts.repairEventCount,
        deadLetterCount: recoveryCounts.deadLetterCount,
        cancelledCount: recoveryCounts.cancelledCount,
      },
      stepMetrics: {
        total: stepRows.length,
        averageDurationMs: average(durations),
        p95DurationMs: percentile(durations, 0.95),
        averageTokenCost: average(tokenCosts),
        totalTokenCost: roundMetric(totalTokenCost),
      },
      costMetrics: {
        totalActualCostUsd: roundMetric(costCounts.totalActualCostUsd),
        averageActualCostUsdPerTask: roundNullable(costCounts.averageActualCostUsdPerTask),
        averageActualCostUsdPerSuccessfulTask: roundNullable(costCounts.averageActualCostUsdPerSuccessfulTask),
      },
      approvalMetrics: {
        total: approvalCounts.total,
        pendingCount: approvalCounts.pendingCount,
        resolvedCount: approvalCounts.resolvedCount,
        taskTriggerCount: approvalCounts.taskTriggerCount,
        taskTriggerRate: ratio(approvalCounts.taskTriggerCount, taskCounts.total),
      },
      eventMetrics: {
        total: eventCounts.total,
        tier1Count: eventCounts.tier1Count,
        tier2Count: eventCounts.tier2Count,
        tier3Count: eventCounts.tier3Count,
        pendingTier1AckCount: ackCounts.pendingTier1AckCount,
        failedTier1AckCount: ackCounts.failedTier1AckCount,
      },
      runtimeMetrics: {
        status: health.status,
        degradationMode: health.degradationMode,
        providerSuccessRate: health.providerSuccessRate,
        activeExecutions: health.activeExecutions,
        queuedTasks: health.queuedTasks,
        eventLoopLagMs: health.eventLoopLagMs,
        memoryRssMb: health.memoryRssMb,
        tier1AckBacklog: health.tier1AckBacklog,
        queueGovernance: health.queueGovernance,
        workerHealth: health.workerHealth,
        findings: health.findings,
      },
    };
  }

  /**
   * Executes a SQL query and returns the first row with normalized values.
   * Converts non-finite numbers to 0 to ensure consistent types.
   */
  private selectRow<T extends Record<string, unknown>>(sql: string): T {
    const row = (this.db.connection.prepare(sql).get() ?? {}) as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(row)) {
      normalized[key] =
        typeof value === "number"
          ? Number.isFinite(value)
            ? value
            : 0
          : value;
    }

    return normalized as T;
  }
}

/**
 * Calculates a ratio, returning 0 if denominator is non-positive.
 */
function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }
  return roundMetric(numerator / denominator);
}

/**
 * Calculates the average of a list of values, returning null for empty arrays.
 */
function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return roundMetric(values.reduce((sum, value) => sum + value, 0) / values.length);
}

/**
 * Calculates a percentile value from a sorted array.
 */
function percentile(values: number[], quantile: number): number | null {
  if (values.length === 0) {
    return null;
  }
  const index = Math.max(0, Math.ceil(values.length * quantile) - 1);
  return roundMetric(values[index] ?? values[values.length - 1]!);
}

/**
 * Rounds a nullable value, returning null if input is null.
 */
function roundNullable(value: number | null): number | null {
  return value == null ? null : roundMetric(value);
}

/**
 * Rounds a metric value to 4 decimal places for display consistency.
 */
function roundMetric(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
