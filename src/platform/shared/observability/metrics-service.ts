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
  harnessRunMetrics: {
    total: number;
    completedCount: number;
    failedCount: number;
    abortedCount: number;
    activeCount: number;
    successRate: number;
  };
  nodeRunMetrics: {
    total: number;
    readyCount: number;
    runningCount: number;
    succeededCount: number;
    failedCount: number;
    retryCount: number;
    blockedCount: number;
  };
  attemptMetrics: {
    total: number;
    activeCount: number;
    retryAttemptCount: number;
    recoveryAttemptCount: number;
    averageDurationMs: number | null;
    p95DurationMs: number | null;
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
  oapeflirViewMetrics: {
    loopCount: number;
    completedLoopCount: number;
    failedLoopCount: number;
    averageLoopDurationMs: number | null;
    convergenceRate: number;
  };
  stageViewMetrics: {
    observe: StageViewMetric;
    assess: StageViewMetric;
    plan: StageViewMetric;
    execute: StageViewMetric;
    feedback: StageViewMetric;
    learn: StageViewMetric;
    improve: StageViewMetric;
    release: StageViewMetric;
  };
  feedbackMetrics: {
    receivedCount: number;
    classifiedCount: number;
    consumedCount: number;
    positiveCount: number;
    negativeCount: number;
    correctionCount: number;
  };
  learningMetrics: {
    objectCreatedCount: number;
    validatedCount: number;
    promotedCount: number;
    rejectedCount: number;
  };
  improvementMetrics: {
    candidateProposedCount: number;
    acceptedCount: number;
    rejectedCount: number;
    guardrailBlockedCount: number;
  };
  releaseMetrics: {
    startedCount: number;
    advancedCount: number;
    completedCount: number;
    rolledBackCount: number;
    currentLevel: string | null;
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

export interface StageViewMetric {
  count: number;
  averageDurationMs: number | null;
  failureCount: number;
  timeoutCount: number;
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
         COALESCE(SUM(CASE WHEN status IN ('done', 'failed', 'cancelled') THEN 1 ELSE 0 END), 0) AS terminalCount,
         COALESCE(SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END), 0) AS successCount,
         COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS failedCount,
         COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelledCount,
         COALESCE(SUM(CASE WHEN status NOT IN ('done', 'failed', 'cancelled') THEN 1 ELSE 0 END), 0) AS activeCount
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
         COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS completedCount,
         COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS failedCount,
         COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelledCount,
         COALESCE(SUM(CASE WHEN retry_count > 0 THEN 1 ELSE 0 END), 0) AS retriedCount
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
         COALESCE(SUM(CASE WHEN status IN ('created', 'prechecking', 'executing', 'blocked') THEN 1 ELSE 0 END), 0) AS activeCount,
         COALESCE(SUM(CASE WHEN attempt > 1 THEN 1 ELSE 0 END), 0) AS retryAttemptCount,
         COALESCE(SUM(CASE WHEN status = 'superseded' THEN 1 ELSE 0 END), 0) AS supersededCount
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
         COALESCE(SUM(CASE WHEN e.event_type = 'recovery:decision_recorded' THEN 1 ELSE 0 END), 0) AS decisionCount,
         COALESCE(SUM(CASE WHEN e.event_type = 'recovery:repair_applied' THEN 1 ELSE 0 END), 0) AS repairEventCount,
         COALESCE(SUM(CASE WHEN e.event_type = 'recovery:dead_lettered' THEN 1 ELSE 0 END), 0) AS deadLetterCount,
         COALESCE(SUM(CASE WHEN e.event_type = 'recovery:cancelled' THEN 1 ELSE 0 END), 0) AS cancelledCount
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
         COALESCE(SUM(CASE WHEN status = 'requested' THEN 1 ELSE 0 END), 0) AS pendingCount,
         COALESCE(SUM(CASE WHEN status != 'requested' THEN 1 ELSE 0 END), 0) AS resolvedCount,
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
         COALESCE(SUM(CASE WHEN event_tier = 'tier_1' THEN 1 ELSE 0 END), 0) AS tier1Count,
         COALESCE(SUM(CASE WHEN event_tier = 'tier_2' THEN 1 ELSE 0 END), 0) AS tier2Count,
         COALESCE(SUM(CASE WHEN event_tier = 'tier_3' THEN 1 ELSE 0 END), 0) AS tier3Count
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
         CASE
           WHEN (SELECT COUNT(*) FROM cost_events) > 0
             THEN COALESCE((SELECT SUM(cost_usd) FROM cost_events), 0)
           ELSE COALESCE(SUM(actual_cost_usd), 0)
         END AS totalActualCostUsd,
         AVG(actual_cost_usd) AS averageActualCostUsdPerTask,
         AVG(CASE WHEN status = 'done' THEN actual_cost_usd END) AS averageActualCostUsdPerSuccessfulTask
       FROM tasks`,
    );

    // Query step durations and token costs for performance metrics
    const stepRows = this.db.connection
      .prepare(`SELECT duration_ms AS durationMs, token_cost AS tokenCost FROM workflow_step_outputs ORDER BY duration_ms ASC`)
      .all() as Array<{ durationMs: number; tokenCost: number }>;
    const feedbackCounts = this.selectRowOrDefault<{
      receivedCount: number;
      classifiedCount: number;
      consumedCount: number;
      positiveCount: number;
      negativeCount: number;
      correctionCount: number;
    }>(
      `SELECT
         COALESCE(SUM(CASE WHEN event_type LIKE 'feedback:%' THEN 1 ELSE 0 END), 0) AS receivedCount,
         COALESCE(SUM(CASE WHEN event_type IN ('feedback:classified', 'feedback:signal_preprocessed') THEN 1 ELSE 0 END), 0) AS classifiedCount,
         COALESCE(SUM(CASE WHEN event_type IN ('feedback:consumed', 'feedback:signal_consumed') THEN 1 ELSE 0 END), 0) AS consumedCount,
         COALESCE(SUM(CASE WHEN event_type LIKE 'feedback:%positive%' THEN 1 ELSE 0 END), 0) AS positiveCount,
         COALESCE(SUM(CASE WHEN event_type LIKE 'feedback:%negative%' THEN 1 ELSE 0 END), 0) AS negativeCount,
         COALESCE(SUM(CASE WHEN event_type LIKE 'feedback:%correction%' THEN 1 ELSE 0 END), 0) AS correctionCount
       FROM events`,
      {
        receivedCount: 0,
        classifiedCount: 0,
        consumedCount: 0,
        positiveCount: 0,
        negativeCount: 0,
        correctionCount: 0,
      },
    );
    const learningCounts = this.selectRowOrDefault<{
      objectCreatedCount: number;
      validatedCount: number;
      promotedCount: number;
      rejectedCount: number;
    }>(
      `SELECT
         COALESCE(SUM(CASE WHEN event_type IN ('learning:artifact_created', 'learning:object_created') THEN 1 ELSE 0 END), 0) AS objectCreatedCount,
         COALESCE(SUM(CASE WHEN event_type IN ('learning:validated', 'learning:object_validated') THEN 1 ELSE 0 END), 0) AS validatedCount,
         COALESCE(SUM(CASE WHEN event_type IN ('learning:object_promoted', 'learning:promoted') THEN 1 ELSE 0 END), 0) AS promotedCount,
         COALESCE(SUM(CASE WHEN event_type IN ('learning:rejected', 'learning:quarantined') THEN 1 ELSE 0 END), 0) AS rejectedCount
       FROM events`,
      {
        objectCreatedCount: 0,
        validatedCount: 0,
        promotedCount: 0,
        rejectedCount: 0,
      },
    );
    const improvementCounts = this.selectRowOrDefault<{
      candidateProposedCount: number;
      acceptedCount: number;
      rejectedCount: number;
      guardrailBlockedCount: number;
    }>(
      `SELECT
         COALESCE(SUM(CASE WHEN event_type LIKE 'improvement:%proposed%' THEN 1 ELSE 0 END), 0) AS candidateProposedCount,
         COALESCE(SUM(CASE WHEN event_type LIKE 'improvement:%accepted%' THEN 1 ELSE 0 END), 0) AS acceptedCount,
         COALESCE(SUM(CASE WHEN event_type LIKE 'improvement:%rejected%' THEN 1 ELSE 0 END), 0) AS rejectedCount,
         COALESCE(SUM(CASE WHEN event_type LIKE 'improvement:%guardrail_blocked%' THEN 1 ELSE 0 END), 0) AS guardrailBlockedCount
       FROM events`,
      {
        candidateProposedCount: 0,
        acceptedCount: 0,
        rejectedCount: 0,
        guardrailBlockedCount: 0,
      },
    );
    const releaseCounts = this.selectRowOrDefault<{
      startedCount: number;
      advancedCount: number;
      completedCount: number;
      rolledBackCount: number;
      currentLevel: string | null;
    }>(
      `SELECT
         COALESCE(SUM(CASE WHEN event_type LIKE 'release:%started%' THEN 1 ELSE 0 END), 0) AS startedCount,
         COALESCE(SUM(CASE WHEN event_type LIKE 'release:%advanced%' THEN 1 ELSE 0 END), 0) AS advancedCount,
         COALESCE(SUM(CASE WHEN event_type LIKE 'release:%completed%' THEN 1 ELSE 0 END), 0) AS completedCount,
         COALESCE(SUM(CASE WHEN event_type LIKE 'release:%rollback%' THEN 1 ELSE 0 END), 0) AS rolledBackCount,
         NULL AS currentLevel
       FROM events`,
      {
        startedCount: 0,
        advancedCount: 0,
        completedCount: 0,
        rolledBackCount: 0,
        currentLevel: null,
      },
    );

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
      harnessRunMetrics: {
        total: taskCounts.total,
        completedCount: taskCounts.successCount,
        failedCount: taskCounts.failedCount,
        abortedCount: taskCounts.cancelledCount,
        activeCount: taskCounts.activeCount,
        successRate: ratio(taskCounts.successCount, taskCounts.terminalCount),
      },
      nodeRunMetrics: {
        total: executionCounts.total,
        readyCount: executionCounts.activeCount,
        runningCount: executionCounts.activeCount,
        succeededCount: taskCounts.successCount,
        failedCount: taskCounts.failedCount,
        retryCount: executionCounts.retryAttemptCount,
        blockedCount: 0,
      },
      attemptMetrics: {
        total: stepRows.length,
        activeCount: executionCounts.activeCount,
        retryAttemptCount: executionCounts.retryAttemptCount,
        recoveryAttemptCount: recoveryCounts.decisionCount,
        averageDurationMs: average(durations),
        p95DurationMs: percentile(durations, 0.95),
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
      oapeflirViewMetrics: {
        loopCount: workflowCounts.total,
        completedLoopCount: workflowCounts.completedCount,
        failedLoopCount: workflowCounts.failedCount,
        averageLoopDurationMs: average(durations),
        convergenceRate: ratio(workflowCounts.completedCount, workflowCounts.total),
      },
      stageViewMetrics: buildDefaultStageViewMetrics(stepRows.length, average(durations), taskCounts.failedCount),
      feedbackMetrics: feedbackCounts,
      learningMetrics: learningCounts,
      improvementMetrics: improvementCounts,
      releaseMetrics: releaseCounts,
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

  private selectRowOrDefault<T extends Record<string, unknown>>(sql: string, fallback: T): T {
    try {
      const row = this.selectRow<T>(sql);
      return { ...fallback, ...row };
    } catch {
      return fallback;
    }
  }
}

function buildDefaultStageViewMetrics(
  totalCount: number,
  averageDurationMs: number | null,
  failureCount: number,
): RuntimeMetricsSummary["stageViewMetrics"] {
  const base: StageViewMetric = {
    count: totalCount,
    averageDurationMs,
    failureCount,
    timeoutCount: 0,
  };
  return {
    observe: base,
    assess: base,
    plan: base,
    execute: base,
    feedback: { ...base, count: 0, failureCount: 0 },
    learn: { ...base, count: 0, failureCount: 0 },
    improve: { ...base, count: 0, failureCount: 0 },
    release: { ...base, count: 0, failureCount: 0 },
  };
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
