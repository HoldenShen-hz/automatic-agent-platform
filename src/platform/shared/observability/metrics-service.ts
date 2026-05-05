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
  /** Per §4.1 contract: attempt-level metrics with duration percentiles */
  attemptMetrics: {
    total: number;
    activeCount: number;
    retryAttemptCount: number;
    recoveryAttemptCount: number;
    averageDurationMs: number | null;
    p95DurationMs: number | null;
  };
  /** Per §4.1 contract: OAPEFLIR loop-level view metrics */
  oapeflirViewMetrics: {
    loopCount: number;
    completedLoopCount: number;
    failedLoopCount: number;
    averageLoopDurationMs: number | null;
    convergenceRate: number;
  };
  /** Per §4.1 contract: per-stage view metrics for OAPEFLIR 8 stages */
  stageViewMetrics: {
    observe: { count: number; durationMs: number | null; failureCount: number; timeoutCount: number };
    assess: { count: number; durationMs: number | null; failureCount: number; timeoutCount: number };
    plan: { count: number; durationMs: number | null; failureCount: number; timeoutCount: number };
    execute: { count: number; durationMs: number | null; failureCount: number; timeoutCount: number };
    feedback: { count: number; durationMs: number | null; failureCount: number; timeoutCount: number };
    learn: { count: number; durationMs: number | null; failureCount: number; timeoutCount: number };
    improve: { count: number; durationMs: number | null; failureCount: number; timeoutCount: number };
    release: { count: number; durationMs: number | null; failureCount: number; timeoutCount: number };
  };
  /** Per §4.1 contract: feedback signal metrics */
  feedbackMetrics: {
    receivedCount: number;
    classifiedCount: number;
    consumedCount: number;
    positiveCount: number;
    negativeCount: number;
    correctionCount: number;
  };
  /** Per §4.1 contract: learning object metrics */
  learningMetrics: {
    objectCreatedCount: number;
    validatedCount: number;
    promotedCount: number;
    rejectedCount: number;
  };
  /** Per §4.1 contract: improvement candidate metrics */
  improvementMetrics: {
    candidateProposedCount: number;
    acceptedCount: number;
    rejectedCount: number;
    guardrailBlockedCount: number;
  };
  /** Per §4.1 contract: release progression metrics */
  releaseMetrics: {
    startedCount: number;
    advancedCount: number;
    completedCount: number;
    rolledBackCount: number;
    currentLevel: number;
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

    // Query harness_runs counts (R4-42: harness.* metrics gap fix)
    const harnessRunCounts = this.selectRow<{
      total: number;
      completedCount: number;
      failedCount: number;
      abortedCount: number;
      activeCount: number;
    }>(
      `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS completedCount,
         COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS failedCount,
         COALESCE(SUM(CASE WHEN status = 'aborted' THEN 1 ELSE 0 END), 0) AS abortedCount,
         COALESCE(SUM(CASE WHEN status NOT IN ('completed', 'failed', 'aborted') THEN 1 ELSE 0 END), 0) AS activeCount
       FROM harness_runs`,
    );

    // Query node_runs counts (R4-42: harness.* metrics gap fix)
    const nodeRunCounts = this.selectRow<{
      total: number;
      readyCount: number;
      runningCount: number;
      succeededCount: number;
      failedCount: number;
      retryCount: number;
      blockedCount: number;
    }>(
      `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END), 0) AS readyCount,
         COALESCE(SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END), 0) AS runningCount,
         COALESCE(SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END), 0) AS succeededCount,
         COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS failedCount,
         COALESCE(SUM(CASE WHEN attempt_count > 0 THEN 1 ELSE 0 END), 0) AS retryCount,
         COALESCE(SUM(CASE WHEN status IN ('awaiting_hitl', 'policy_blocked', 'dependency_failed') THEN 1 ELSE 0 END), 0) AS blockedCount
       FROM node_runs`,
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

    // Query attempt metrics (R7-5: attemptMetrics per §4.1 contract)
    const attemptCounts = this.selectRow<{
      total: number;
      activeCount: number;
      retryAttemptCount: number;
      recoveryAttemptCount: number;
    }>(
      `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(CASE WHEN status IN ('created', 'prechecking', 'executing', 'blocked') THEN 1 ELSE 0 END), 0) AS activeCount,
         COALESCE(SUM(CASE WHEN attempt > 1 THEN 1 ELSE 0 END), 0) AS retryAttemptCount,
         COALESCE((SELECT COUNT(*) FROM events ev WHERE ev.execution_id = executions.id AND ev.event_type LIKE 'recovery:%'), 0) AS recoveryAttemptCount
       FROM executions`,
    );

    // Query attempt durations for percentile calculation
    const attemptDurationRows = this.db.connection
      .prepare(`SELECT (julianday(finished_at) - julianday(started_at)) * 86400000 AS durationMs FROM executions WHERE finished_at IS NOT NULL AND started_at IS NOT NULL ORDER BY durationMs ASC`)
      .all() as Array<{ durationMs: number }>;
    const attemptDurations = attemptDurationRows.map((row) => Number(row.durationMs ?? 0));

    // Query OAPEFLIR loop metrics (R7-5: oapeflirViewMetrics per §4.1 contract)
    const loopCounts = this.selectRow<{
      loopCount: number;
      completedLoopCount: number;
      failedLoopCount: number;
      totalDurationMs: number;
    }>(
      `SELECT
         COUNT(*) AS loopCount,
         COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS completedLoopCount,
         COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS failedLoopCount,
         COALESCE(SUM(duration_ms), 0) AS totalDurationMs
       FROM harness_loops`,
    );

    // Query stage view metrics (R7-5: stageViewMetrics per §4.1 contract)
    const stageCounts = this.selectRow<{
      observeCount: number; observeDurationMs: number; observeFailureCount: number; observeTimeoutCount: number;
      assessCount: number; assessDurationMs: number; assessFailureCount: number; assessTimeoutCount: number;
      planCount: number; planDurationMs: number; planFailureCount: number; planTimeoutCount: number;
      executeCount: number; executeDurationMs: number; executeFailureCount: number; executeTimeoutCount: number;
      feedbackCount: number; feedbackDurationMs: number; feedbackFailureCount: number; feedbackTimeoutCount: number;
      learnCount: number; learnDurationMs: number; learnFailureCount: number; learnTimeoutCount: number;
      improveCount: number; improveDurationMs: number; improveFailureCount: number; improveTimeoutCount: number;
      releaseCount: number; releaseDurationMs: number; releaseFailureCount: number; releaseTimeoutCount: number;
    }>(
      `SELECT
         COALESCE(SUM(CASE WHEN stage = 'observe' THEN 1 ELSE 0 END), 0) AS observeCount,
         COALESCE(SUM(CASE WHEN stage = 'observe' THEN duration_ms END), 0) AS observeDurationMs,
         COALESCE(SUM(CASE WHEN stage = 'observe' AND status = 'failed' THEN 1 ELSE 0 END), 0) AS observeFailureCount,
         COALESCE(SUM(CASE WHEN stage = 'observe' AND status = 'timed_out' THEN 1 ELSE 0 END), 0) AS observeTimeoutCount,
         COALESCE(SUM(CASE WHEN stage = 'assess' THEN 1 ELSE 0 END), 0) AS assessCount,
         COALESCE(SUM(CASE WHEN stage = 'assess' THEN duration_ms END), 0) AS assessDurationMs,
         COALESCE(SUM(CASE WHEN stage = 'assess' AND status = 'failed' THEN 1 ELSE 0 END), 0) AS assessFailureCount,
         COALESCE(SUM(CASE WHEN stage = 'assess' AND status = 'timed_out' THEN 1 ELSE 0 END), 0) AS assessTimeoutCount,
         COALESCE(SUM(CASE WHEN stage = 'plan' THEN 1 ELSE 0 END), 0) AS planCount,
         COALESCE(SUM(CASE WHEN stage = 'plan' THEN duration_ms END), 0) AS planDurationMs,
         COALESCE(SUM(CASE WHEN stage = 'plan' AND status = 'failed' THEN 1 ELSE 0 END), 0) AS planFailureCount,
         COALESCE(SUM(CASE WHEN stage = 'plan' AND status = 'timed_out' THEN 1 ELSE 0 END), 0) AS planTimeoutCount,
         COALESCE(SUM(CASE WHEN stage = 'execute' THEN 1 ELSE 0 END), 0) AS executeCount,
         COALESCE(SUM(CASE WHEN stage = 'execute' THEN duration_ms END), 0) AS executeDurationMs,
         COALESCE(SUM(CASE WHEN stage = 'execute' AND status = 'failed' THEN 1 ELSE 0 END), 0) AS executeFailureCount,
         COALESCE(SUM(CASE WHEN stage = 'execute' AND status = 'timed_out' THEN 1 ELSE 0 END), 0) AS executeTimeoutCount,
         COALESCE(SUM(CASE WHEN stage = 'feedback' THEN 1 ELSE 0 END), 0) AS feedbackCount,
         COALESCE(SUM(CASE WHEN stage = 'feedback' THEN duration_ms END), 0) AS feedbackDurationMs,
         COALESCE(SUM(CASE WHEN stage = 'feedback' AND status = 'failed' THEN 1 ELSE 0 END), 0) AS feedbackFailureCount,
         COALESCE(SUM(CASE WHEN stage = 'feedback' AND status = 'timed_out' THEN 1 ELSE 0 END), 0) AS feedbackTimeoutCount,
         COALESCE(SUM(CASE WHEN stage = 'learn' THEN 1 ELSE 0 END), 0) AS learnCount,
         COALESCE(SUM(CASE WHEN stage = 'learn' THEN duration_ms END), 0) AS learnDurationMs,
         COALESCE(SUM(CASE WHEN stage = 'learn' AND status = 'failed' THEN 1 ELSE 0 END), 0) AS learnFailureCount,
         COALESCE(SUM(CASE WHEN stage = 'learn' AND status = 'timed_out' THEN 1 ELSE 0 END), 0) AS learnTimeoutCount,
         COALESCE(SUM(CASE WHEN stage = 'improve' THEN 1 ELSE 0 END), 0) AS improveCount,
         COALESCE(SUM(CASE WHEN stage = 'improve' THEN duration_ms END), 0) AS improveDurationMs,
         COALESCE(SUM(CASE WHEN stage = 'improve' AND status = 'failed' THEN 1 ELSE 0 END), 0) AS improveFailureCount,
         COALESCE(SUM(CASE WHEN stage = 'improve' AND status = 'timed_out' THEN 1 ELSE 0 END), 0) AS improveTimeoutCount,
         COALESCE(SUM(CASE WHEN stage = 'release' THEN 1 ELSE 0 END), 0) AS releaseCount,
         COALESCE(SUM(CASE WHEN stage = 'release' THEN duration_ms END), 0) AS releaseDurationMs,
         COALESCE(SUM(CASE WHEN stage = 'release' AND status = 'failed' THEN 1 ELSE 0 END), 0) AS releaseFailureCount,
         COALESCE(SUM(CASE WHEN stage = 'release' AND status = 'timed_out' THEN 1 ELSE 0 END), 0) AS releaseTimeoutCount
       FROM stage_samples`,
    );

    // Query feedback metrics (R7-5: feedbackMetrics per §4.1 contract)
    const feedbackCounts = this.selectRow<{
      receivedCount: number;
      classifiedCount: number;
      consumedCount: number;
      positiveCount: number;
      negativeCount: number;
      correctionCount: number;
    }>(
      `SELECT
         COUNT(*) AS receivedCount,
         COALESCE(SUM(CASE WHEN classification IS NOT NULL THEN 1 ELSE 0 END), 0) AS classifiedCount,
         COALESCE(SUM(CASE WHEN consumed_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS consumedCount,
         COALESCE(SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END), 0) AS positiveCount,
         COALESCE(SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END), 0) AS negativeCount,
         COALESCE(SUM(CASE WHEN kind = 'correction' THEN 1 ELSE 0 END), 0) AS correctionCount
       FROM feedback_signals`,
    );

    // Query learning metrics (R7-5: learningMetrics per §4.1 contract)
    const learningCounts = this.selectRow<{
      objectCreatedCount: number;
      validatedCount: number;
      promotedCount: number;
      rejectedCount: number;
    }>(
      `SELECT
         COUNT(*) AS objectCreatedCount,
         COALESCE(SUM(CASE WHEN validation_status = 'validated' THEN 1 ELSE 0 END), 0) AS validatedCount,
         COALESCE(SUM(CASE WHEN promotion_status = 'promoted' THEN 1 ELSE 0 END), 0) AS promotedCount,
         COALESCE(SUM(CASE WHEN promotion_status = 'rejected' THEN 1 ELSE 0 END), 0) AS rejectedCount
       FROM learning_objects`,
    );

    // Query improvement metrics (R7-5: improvementMetrics per §4.1 contract)
    const improvementCounts = this.selectRow<{
      candidateProposedCount: number;
      acceptedCount: number;
      rejectedCount: number;
      guardrailBlockedCount: number;
    }>(
      `SELECT
         COUNT(*) AS candidateProposedCount,
         COALESCE(SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END), 0) AS acceptedCount,
         COALESCE(SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END), 0) AS rejectedCount,
         COALESCE(SUM(CASE WHEN blocked_by_guardrail = 1 THEN 1 ELSE 0 END), 0) AS guardrailBlockedCount
       FROM improvement_candidates`,
    );

    // Query release metrics (R7-5: releaseMetrics per §4.1 contract)
    const releaseCounts = this.selectRow<{
      startedCount: number;
      advancedCount: number;
      completedCount: number;
      rolledBackCount: number;
      maxLevel: number;
    }>(
      `SELECT
         COALESCE(SUM(CASE WHEN status IN ('started', 'in_progress') THEN 1 ELSE 0 END), 0) AS startedCount,
         COALESCE(SUM(CASE WHEN status = 'advanced' THEN 1 ELSE 0 END), 0) AS advancedCount,
         COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS completedCount,
         COALESCE(SUM(CASE WHEN status = 'rolled_back' THEN 1 ELSE 0 END), 0) AS rolledBackCount,
         COALESCE(MAX(level), 0) AS maxLevel
       FROM release_records`,
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
      harnessRunMetrics: {
        total: harnessRunCounts.total,
        completedCount: harnessRunCounts.completedCount,
        failedCount: harnessRunCounts.failedCount,
        abortedCount: harnessRunCounts.abortedCount,
        activeCount: harnessRunCounts.activeCount,
        successRate: ratio(harnessRunCounts.completedCount, harnessRunCounts.total),
      },
      nodeRunMetrics: {
        total: nodeRunCounts.total,
        readyCount: nodeRunCounts.readyCount,
        runningCount: nodeRunCounts.runningCount,
        succeededCount: nodeRunCounts.succeededCount,
        failedCount: nodeRunCounts.failedCount,
        retryCount: nodeRunCounts.retryCount,
        blockedCount: nodeRunCounts.blockedCount,
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
      // R7-5: New metrics per §4.1 contract
      attemptMetrics: {
        total: attemptCounts.total,
        activeCount: attemptCounts.activeCount,
        retryAttemptCount: attemptCounts.retryAttemptCount,
        recoveryAttemptCount: attemptCounts.recoveryAttemptCount,
        averageDurationMs: average(attemptDurations),
        p95DurationMs: percentile(attemptDurations, 0.95),
      },
      oapeflirViewMetrics: {
        loopCount: loopCounts.loopCount,
        completedLoopCount: loopCounts.completedLoopCount,
        failedLoopCount: loopCounts.failedLoopCount,
        averageLoopDurationMs: loopCounts.loopCount > 0 ? roundMetric(loopCounts.totalDurationMs / loopCounts.loopCount) : null,
        convergenceRate: ratio(loopCounts.completedLoopCount, loopCounts.loopCount),
      },
      stageViewMetrics: {
        observe: {
          count: stageCounts.observeCount,
          durationMs: stageCounts.observeCount > 0 ? roundMetric(stageCounts.observeDurationMs / stageCounts.observeCount) : null,
          failureCount: stageCounts.observeFailureCount,
          timeoutCount: stageCounts.observeTimeoutCount,
        },
        assess: {
          count: stageCounts.assessCount,
          durationMs: stageCounts.assessCount > 0 ? roundMetric(stageCounts.assessDurationMs / stageCounts.assessCount) : null,
          failureCount: stageCounts.assessFailureCount,
          timeoutCount: stageCounts.assessTimeoutCount,
        },
        plan: {
          count: stageCounts.planCount,
          durationMs: stageCounts.planCount > 0 ? roundMetric(stageCounts.planDurationMs / stageCounts.planCount) : null,
          failureCount: stageCounts.planFailureCount,
          timeoutCount: stageCounts.planTimeoutCount,
        },
        execute: {
          count: stageCounts.executeCount,
          durationMs: stageCounts.executeCount > 0 ? roundMetric(stageCounts.executeDurationMs / stageCounts.executeCount) : null,
          failureCount: stageCounts.executeFailureCount,
          timeoutCount: stageCounts.executeTimeoutCount,
        },
        feedback: {
          count: stageCounts.feedbackCount,
          durationMs: stageCounts.feedbackCount > 0 ? roundMetric(stageCounts.feedbackDurationMs / stageCounts.feedbackCount) : null,
          failureCount: stageCounts.feedbackFailureCount,
          timeoutCount: stageCounts.feedbackTimeoutCount,
        },
        learn: {
          count: stageCounts.learnCount,
          durationMs: stageCounts.learnCount > 0 ? roundMetric(stageCounts.learnDurationMs / stageCounts.learnCount) : null,
          failureCount: stageCounts.learnFailureCount,
          timeoutCount: stageCounts.learnTimeoutCount,
        },
        improve: {
          count: stageCounts.improveCount,
          durationMs: stageCounts.improveCount > 0 ? roundMetric(stageCounts.improveDurationMs / stageCounts.improveCount) : null,
          failureCount: stageCounts.improveFailureCount,
          timeoutCount: stageCounts.improveTimeoutCount,
        },
        release: {
          count: stageCounts.releaseCount,
          durationMs: stageCounts.releaseCount > 0 ? roundMetric(stageCounts.releaseDurationMs / stageCounts.releaseCount) : null,
          failureCount: stageCounts.releaseFailureCount,
          timeoutCount: stageCounts.releaseTimeoutCount,
        },
      },
      feedbackMetrics: {
        receivedCount: feedbackCounts.receivedCount,
        classifiedCount: feedbackCounts.classifiedCount,
        consumedCount: feedbackCounts.consumedCount,
        positiveCount: feedbackCounts.positiveCount,
        negativeCount: feedbackCounts.negativeCount,
        correctionCount: feedbackCounts.correctionCount,
      },
      learningMetrics: {
        objectCreatedCount: learningCounts.objectCreatedCount,
        validatedCount: learningCounts.validatedCount,
        promotedCount: learningCounts.promotedCount,
        rejectedCount: learningCounts.rejectedCount,
      },
      improvementMetrics: {
        candidateProposedCount: improvementCounts.candidateProposedCount,
        acceptedCount: improvementCounts.acceptedCount,
        rejectedCount: improvementCounts.rejectedCount,
        guardrailBlockedCount: improvementCounts.guardrailBlockedCount,
      },
      releaseMetrics: {
        startedCount: releaseCounts.startedCount,
        advancedCount: releaseCounts.advancedCount,
        completedCount: releaseCounts.completedCount,
        rolledBackCount: releaseCounts.rolledBackCount,
        currentLevel: releaseCounts.maxLevel,
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
