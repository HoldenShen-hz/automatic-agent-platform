/**
 * Metrics Service Unit Tests
 *
 * Tests for MetricsService that aggregates runtime metrics from the database
 * including task counts, workflow metrics, execution metrics, recovery metrics,
 * step performance, cost metrics, approval metrics, event metrics, and runtime health.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { MetricsService } from "../../../../src/platform/shared/observability/metrics-service.js";
import { HealthService } from "../../../../src/platform/shared/observability/health-service.js";

// =============================================================================
// Helper to create mock database
// =============================================================================

interface MockPreparedStatement {
  sql: string;
  all: () => Array<Record<string, unknown>>;
  get: () => Record<string, unknown>;
}

interface MockConnection {
  prepare: (sql: string) => MockPreparedStatement;
}

function createMockDb(initialRows: Record<string, Record<string, unknown>[]> = {}): { connection: MockConnection } {
  const rows: Record<string, Record<string, unknown>[]> = { ...initialRows };

  return {
    connection: {
      prepare: (sql: string) => ({
        sql,
        all: () => rows[sql] ?? [],
        get: () => rows[sql]?.[0] ?? {},
      }),
    },
  };
}

// =============================================================================
// Common SQL used by MetricsService
// =============================================================================

const TASK_WINDOW_SQL = `SELECT MIN(created_at) AS firstTaskCreatedAt, MAX(updated_at) AS lastTaskUpdatedAt FROM tasks`;

const TASK_COUNTS_SQL = `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(CASE WHEN status IN ('done', 'failed', 'cancelled') THEN 1 ELSE 0 END), 0) AS terminalCount,
         COALESCE(SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END), 0) AS successCount,
         COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS failedCount,
         COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelledCount,
         COALESCE(SUM(CASE WHEN status NOT IN ('done', 'failed', 'cancelled') THEN 1 ELSE 0 END), 0) AS activeCount
       FROM tasks`;

const WORKFLOW_COUNTS_SQL = `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS completedCount,
         COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS failedCount,
         COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelledCount,
         COALESCE(SUM(CASE WHEN retry_count > 0 THEN 1 ELSE 0 END), 0) AS retriedCount
       FROM workflow_state`;

const EXECUTION_COUNTS_SQL = `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(CASE WHEN status IN ('created', 'prechecking', 'executing', 'blocked') THEN 1 ELSE 0 END), 0) AS activeCount,
         COALESCE(SUM(CASE WHEN attempt > 1 THEN 1 ELSE 0 END), 0) AS retryAttemptCount,
         COALESCE(SUM(CASE WHEN status = 'superseded' THEN 1 ELSE 0 END), 0) AS supersededCount
       FROM executions`;

const RECOVERY_COUNTS_SQL = `SELECT
         COUNT(DISTINCT e.task_id) AS taskCount,
         COUNT(DISTINCT CASE WHEN t.status = 'done' THEN e.task_id END) AS successfulTaskCount,
         COALESCE(SUM(CASE WHEN e.event_type = 'recovery:decision_recorded' THEN 1 ELSE 0 END), 0) AS decisionCount,
         COALESCE(SUM(CASE WHEN e.event_type = 'recovery:repair_applied' THEN 1 ELSE 0 END), 0) AS repairEventCount,
         COALESCE(SUM(CASE WHEN e.event_type = 'recovery:dead_lettered' THEN 1 ELSE 0 END), 0) AS deadLetterCount,
         COALESCE(SUM(CASE WHEN e.event_type = 'recovery:cancelled' THEN 1 ELSE 0 END), 0) AS cancelledCount
       FROM events e
       LEFT JOIN tasks t ON t.id = e.task_id
       WHERE e.task_id IS NOT NULL
         AND e.event_type LIKE 'recovery:%'`;

const APPROVAL_COUNTS_SQL = `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(CASE WHEN status = 'requested' THEN 1 ELSE 0 END), 0) AS pendingCount,
         COALESCE(SUM(CASE WHEN status != 'requested' THEN 1 ELSE 0 END), 0) AS resolvedCount,
         COUNT(DISTINCT task_id) AS taskTriggerCount
       FROM approvals`;

const EVENT_COUNTS_SQL = `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(CASE WHEN event_tier = 'tier_1' THEN 1 ELSE 0 END), 0) AS tier1Count,
         COALESCE(SUM(CASE WHEN event_tier = 'tier_2' THEN 1 ELSE 0 END), 0) AS tier2Count,
         COALESCE(SUM(CASE WHEN event_tier = 'tier_3' THEN 1 ELSE 0 END), 0) AS tier3Count
       FROM events`;

const ACK_COUNTS_SQL = `SELECT
         COALESCE(SUM(CASE WHEN a.status = 'pending' THEN 1 ELSE 0 END), 0) AS pendingTier1AckCount,
         COALESCE(SUM(CASE WHEN a.status = 'failed' THEN 1 ELSE 0 END), 0) AS failedTier1AckCount
       FROM event_consumer_acks a
       INNER JOIN events e ON e.id = a.event_id
       WHERE e.event_tier = 'tier_1'`;

const COST_SQL = `SELECT
         CASE
           WHEN (SELECT COUNT(*) FROM cost_events) > 0
             THEN COALESCE((SELECT SUM(cost_usd) FROM cost_events), 0)
           ELSE COALESCE(SUM(actual_cost_usd), 0)
         END AS totalActualCostUsd,
         AVG(actual_cost_usd) AS averageActualCostUsdPerTask,
         AVG(CASE WHEN status = 'done' THEN actual_cost_usd END) AS averageActualCostUsdPerSuccessfulTask
       FROM tasks`;

const STEP_DURATIONS_SQL = `SELECT duration_ms AS durationMs, token_cost AS tokenCost FROM workflow_step_outputs ORDER BY duration_ms ASC`;

function createMinimalMockDb(): { connection: MockConnection } {
  return createMockDb({
    [TASK_WINDOW_SQL]: [{ firstTaskCreatedAt: null, lastTaskUpdatedAt: null }],
    [TASK_COUNTS_SQL]: [{ total: 0, terminalCount: 0, successCount: 0, failedCount: 0, cancelledCount: 0, activeCount: 0 }],
    [WORKFLOW_COUNTS_SQL]: [{ total: 0, completedCount: 0, failedCount: 0, cancelledCount: 0, retriedCount: 0 }],
    [EXECUTION_COUNTS_SQL]: [{ total: 0, activeCount: 0, retryAttemptCount: 0, supersededCount: 0 }],
    [RECOVERY_COUNTS_SQL]: [{ taskCount: 0, successfulTaskCount: 0, decisionCount: 0, repairEventCount: 0, deadLetterCount: 0, cancelledCount: 0 }],
    [APPROVAL_COUNTS_SQL]: [{ total: 0, pendingCount: 0, resolvedCount: 0, taskTriggerCount: 0 }],
    [EVENT_COUNTS_SQL]: [{ total: 0, tier1Count: 0, tier2Count: 0, tier3Count: 0 }],
    [ACK_COUNTS_SQL]: [{ pendingTier1AckCount: 0, failedTier1AckCount: 0 }],
    [COST_SQL]: [{ totalActualCostUsd: 0, averageActualCostUsdPerTask: null, averageActualCostUsdPerSuccessfulTask: null }],
    [STEP_DURATIONS_SQL]: [],
  });
}

// =============================================================================
// MetricsService buildSummary
// =============================================================================

test("MetricsService buildSummary returns complete runtime metrics summary", () => {
  const mockDb = createMockDb({
    [TASK_WINDOW_SQL]: [
      { firstTaskCreatedAt: "2024-01-01T00:00:00Z", lastTaskUpdatedAt: "2024-01-02T00:00:00Z" },
    ],
    [TASK_COUNTS_SQL]: [
      { total: 100, terminalCount: 80, successCount: 60, failedCount: 15, cancelledCount: 5, activeCount: 20 },
    ],
    [WORKFLOW_COUNTS_SQL]: [
      { total: 50, completedCount: 40, failedCount: 5, cancelledCount: 3, retriedCount: 10 },
    ],
    [EXECUTION_COUNTS_SQL]: [
      { total: 30, activeCount: 10, retryAttemptCount: 5, supersededCount: 2 },
    ],
    [RECOVERY_COUNTS_SQL]: [
      { taskCount: 20, successfulTaskCount: 18, decisionCount: 25, repairEventCount: 10, deadLetterCount: 2, cancelledCount: 1 },
    ],
    [APPROVAL_COUNTS_SQL]: [
      { total: 50, pendingCount: 5, resolvedCount: 45, taskTriggerCount: 30 },
    ],
    [EVENT_COUNTS_SQL]: [
      { total: 200, tier1Count: 50, tier2Count: 80, tier3Count: 70 },
    ],
    [ACK_COUNTS_SQL]: [
      { pendingTier1AckCount: 3, failedTier1AckCount: 1 },
    ],
    [COST_SQL]: [
      { totalActualCostUsd: 150.50, averageActualCostUsdPerTask: 1.505, averageActualCostUsdPerSuccessfulTask: 1.25 },
    ],
    [STEP_DURATIONS_SQL]: [
      { durationMs: 100, tokenCost: 500 },
      { durationMs: 200, tokenCost: 1000 },
      { durationMs: 300, tokenCost: 1500 },
    ],
  });

  // Create minimal health service
  const healthService = new HealthService(
    // @ts-expect-error - we're passing a mock instead of real AuthoritativeSqlDatabase
    { connection: { prepare: () => ({ get: () => ({}) }) } },
    { retentionLimit: 10 },
  );

  const metricsService = new MetricsService(
    // @ts-expect-error - mock db
    mockDb,
    healthService,
  );

  const summary = metricsService.buildSummary("2024-01-15T12:00:00Z");

  assert.equal(summary.generatedAt, "2024-01-15T12:00:00Z");
  assert.equal(summary.window.firstTaskCreatedAt, "2024-01-01T00:00:00Z");
  assert.equal(summary.window.lastTaskUpdatedAt, "2024-01-02T00:00:00Z");

  // Task metrics
  assert.equal(summary.taskMetrics.total, 100);
  assert.equal(summary.taskMetrics.terminalCount, 80);
  assert.equal(summary.taskMetrics.successCount, 60);
  assert.equal(summary.taskMetrics.failedCount, 15);
  assert.equal(summary.taskMetrics.cancelledCount, 5);
  assert.equal(summary.taskMetrics.activeCount, 20);

  // Workflow metrics
  assert.equal(summary.workflowMetrics.total, 50);
  assert.equal(summary.workflowMetrics.completedCount, 40);

  // Execution metrics
  assert.equal(summary.executionMetrics.total, 30);
  assert.equal(summary.executionMetrics.activeCount, 10);

  // Step metrics
  assert.equal(summary.stepMetrics.total, 3);
  assert.equal(summary.stepMetrics.totalTokenCost, 3000);

  // Cost metrics
  assert.equal(summary.costMetrics.totalActualCostUsd, 150.5);
});

test("MetricsService buildSummary handles empty database", () => {
  const emptyMockDb = createMinimalMockDb();

  const healthService = new HealthService(
    // @ts-expect-error - mock
    { connection: { prepare: () => ({ get: () => ({}) }) } },
    { retentionLimit: 10 },
  );

  const metricsService = new MetricsService(
    // @ts-expect-error - mock
    emptyMockDb,
    healthService,
  );

  const summary = metricsService.buildSummary();

  assert.ok(summary.generatedAt != null);
  assert.equal(summary.taskMetrics.total, 0);
  assert.equal(summary.workflowMetrics.total, 0);
  assert.equal(summary.executionMetrics.total, 0);
  assert.equal(summary.stepMetrics.total, 0);
});

test("MetricsService buildSummary calculates successRate and completionRate correctly", () => {
  const mockDb = createMockDb({
    [TASK_WINDOW_SQL]: [
      { firstTaskCreatedAt: null, lastTaskUpdatedAt: null },
    ],
    [TASK_COUNTS_SQL]: [{ total: 100, terminalCount: 80, successCount: 40, failedCount: 20, cancelledCount: 20, activeCount: 20 }],
    [WORKFLOW_COUNTS_SQL]: [{ total: 0, completedCount: 0, failedCount: 0, cancelledCount: 0, retriedCount: 0 }],
    [EXECUTION_COUNTS_SQL]: [{ total: 0, activeCount: 0, retryAttemptCount: 0, supersededCount: 0 }],
    [RECOVERY_COUNTS_SQL]: [
      { taskCount: 0, successfulTaskCount: 0, decisionCount: 0, repairEventCount: 0, deadLetterCount: 0, cancelledCount: 0 },
    ],
    [APPROVAL_COUNTS_SQL]: [{ total: 0, pendingCount: 0, resolvedCount: 0, taskTriggerCount: 0 }],
    [EVENT_COUNTS_SQL]: [{ total: 0, tier1Count: 0, tier2Count: 0, tier3Count: 0 }],
    [ACK_COUNTS_SQL]: [{ pendingTier1AckCount: 0, failedTier1AckCount: 0 }],
    [COST_SQL]: [{ totalActualCostUsd: 0, averageActualCostUsdPerTask: null, averageActualCostUsdPerSuccessfulTask: null }],
    [STEP_DURATIONS_SQL]: [],
  });

  const healthService = new HealthService(
    // @ts-expect-error - mock
    { connection: { prepare: () => ({ get: () => ({}) }) } },
    { retentionLimit: 10 },
  );

  const metricsService = new MetricsService(
    // @ts-expect-error - mock
    mockDb,
    healthService,
  );

  const summary = metricsService.buildSummary();

  // successRate = 40/80 = 0.5
  assert.equal(summary.taskMetrics.successRate, 0.5);
  // completionRate = 80/100 = 0.8
  assert.equal(summary.taskMetrics.completionRate, 0.8);
});

test("MetricsService buildSummary handles NaN and Infinity from database", () => {
  const mockDb = createMockDb({
    [TASK_WINDOW_SQL]: [{ firstTaskCreatedAt: null, lastTaskUpdatedAt: null }],
    [TASK_COUNTS_SQL]: [{ total: 0, terminalCount: 0, successCount: 0, failedCount: 0, cancelledCount: 0, activeCount: 0 }],
    [WORKFLOW_COUNTS_SQL]: [{ total: 0, completedCount: 0, failedCount: 0, cancelledCount: 0, retriedCount: 0 }],
    [EXECUTION_COUNTS_SQL]: [{ total: 0, activeCount: 0, retryAttemptCount: 0, supersededCount: 0 }],
    [RECOVERY_COUNTS_SQL]: [
      { taskCount: 0, successfulTaskCount: 0, decisionCount: 0, repairEventCount: 0, deadLetterCount: 0, cancelledCount: 0 },
    ],
    [APPROVAL_COUNTS_SQL]: [{ total: 0, pendingCount: 0, resolvedCount: 0, taskTriggerCount: 0 }],
    [EVENT_COUNTS_SQL]: [{ total: 0, tier1Count: 0, tier2Count: 0, tier3Count: 0 }],
    [ACK_COUNTS_SQL]: [{ pendingTier1AckCount: 0, failedTier1AckCount: 0 }],
    [COST_SQL]: [
      { totalActualCostUsd: NaN, averageActualCostUsdPerTask: Infinity, averageActualCostUsdPerSuccessfulTask: -Infinity },
    ],
    [STEP_DURATIONS_SQL]: [],
  });

  const healthService = new HealthService(
    // @ts-expect-error - mock
    { connection: { prepare: () => ({ get: () => ({}) }) } },
    { retentionLimit: 10 },
  );

  const metricsService = new MetricsService(
    // @ts-expect-error - mock
    mockDb,
    healthService,
  );

  const summary = metricsService.buildSummary();

  // NaN should be converted to 0
  assert.equal(summary.costMetrics.totalActualCostUsd, 0);
  // Infinity should be converted to 0
  assert.equal(summary.costMetrics.averageActualCostUsdPerTask, 0);
  assert.equal(summary.costMetrics.averageActualCostUsdPerSuccessfulTask, 0);
});

test("MetricsService buildSummary calculates workflow retry rate", () => {
  const mockDb = createMockDb({
    [TASK_WINDOW_SQL]: [{ firstTaskCreatedAt: null, lastTaskUpdatedAt: null }],
    [TASK_COUNTS_SQL]: [{ total: 0, terminalCount: 0, successCount: 0, failedCount: 0, cancelledCount: 0, activeCount: 0 }],
    [WORKFLOW_COUNTS_SQL]: [{ total: 100, completedCount: 80, failedCount: 10, cancelledCount: 5, retriedCount: 25 }],
    [EXECUTION_COUNTS_SQL]: [{ total: 0, activeCount: 0, retryAttemptCount: 0, supersededCount: 0 }],
    [RECOVERY_COUNTS_SQL]: [
      { taskCount: 0, successfulTaskCount: 0, decisionCount: 0, repairEventCount: 0, deadLetterCount: 0, cancelledCount: 0 },
    ],
    [APPROVAL_COUNTS_SQL]: [{ total: 0, pendingCount: 0, resolvedCount: 0, taskTriggerCount: 0 }],
    [EVENT_COUNTS_SQL]: [{ total: 0, tier1Count: 0, tier2Count: 0, tier3Count: 0 }],
    [ACK_COUNTS_SQL]: [{ pendingTier1AckCount: 0, failedTier1AckCount: 0 }],
    [COST_SQL]: [{ totalActualCostUsd: 0, averageActualCostUsdPerTask: null, averageActualCostUsdPerSuccessfulTask: null }],
    [STEP_DURATIONS_SQL]: [],
  });

  const healthService = new HealthService(
    // @ts-expect-error - mock
    { connection: { prepare: () => ({ get: () => ({}) }) } },
    { retentionLimit: 10 },
  );

  const metricsService = new MetricsService(
    // @ts-expect-error - mock
    mockDb,
    healthService,
  );

  const summary = metricsService.buildSummary();

  // retryRate = 25/100 = 0.25
  assert.equal(summary.workflowMetrics.retryRate, 0.25);
});

test("MetricsService buildSummary includes runtime health metrics", () => {
  const mockDb = createMinimalMockDb();

  const healthService = new HealthService(
    // @ts-expect-error - mock
    { connection: { prepare: () => ({ get: () => ({}) }) } },
    { retentionLimit: 10 },
  );

  const metricsService = new MetricsService(
    // @ts-expect-error - mock
    mockDb,
    healthService,
  );

  const summary = metricsService.buildSummary();

  // Should include runtime health info
  assert.ok(summary.runtimeMetrics != null);
  assert.ok("status" in summary.runtimeMetrics);
  assert.ok("degradationMode" in summary.runtimeMetrics);
  assert.ok("providerSuccessRate" in summary.runtimeMetrics);
});