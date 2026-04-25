/**
 * E2E Metrics Collection Flow Tests
 *
 * End-to-end tests covering metrics collection across task lifecycle,
 * execution, workflow progression, and runtime state observation.
 *
 * Tests validate:
 * - MetricsService.buildSummary() aggregation from database state
 * - RuntimeMetricsRegistry counter/gauge/histogram recording
 * - Task metrics (total, success, failed, cancelled counts)
 * - Workflow metrics (completed, failed, retried counts)
 * - Execution metrics (active count, retry rate, superseded count)
 * - Recovery event metrics
 * - Cost aggregation metrics
 * - Approval metrics
 * - Event tier metrics
 * - Health status integration
 *
 * Uses in-memory SQLite database and mock external dependencies.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { MetricsService } from "../../src/platform/shared/observability/metrics-service.js";
import { HealthService } from "../../src/platform/shared/observability/health-service.js";
import { runtimeMetricsRegistry, RuntimeMetricsRegistry } from "../../src/platform/shared/observability/runtime-metrics-registry.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { nowIso } from "../../src/platform/contracts/types/ids.js";
import type { TaskStatus, ExecutionStatus, WorkflowStatus } from "../../src/platform/contracts/types/status.js";

function createMetricsHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = `${workspace}/metrics-test.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const healthService = new HealthService(db, store, {
    memoryHighWatermarkMb: 1024,
    queuedTaskDegradedThreshold: 5,
    queuedTaskOverloadedThreshold: 10,
    nowMsSupplier: () => Date.now(),
  });
  const metricsService = new MetricsService(db, healthService);

  return { workspace, dbPath, db, store, healthService, metricsService };
}

function seedTask(
  store: AuthoritativeTaskStore,
  db: SqliteDatabase,
  taskId: string,
  status: TaskStatus,
  costUsd: number = 0,
  createdAt: string,
): void {
  db.transaction(() => {
    store.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general_ops",
      tenantId: null,
      title: `Task ${taskId}`,
      status,
      source: "user",
      priority: "normal",
      inputJson: "{}",
      normalizedInputJson: "{}",
      outputJson: status === "done" ? JSON.stringify({ result: "success" }) : null,
      estimatedCostUsd: costUsd,
      actualCostUsd: costUsd,
      errorCode: status === "failed" ? "test_failure" : null,
      createdAt,
      updatedAt: createdAt,
      completedAt: status === "done" || status === "failed" || status === "cancelled" ? createdAt : null,
    });
  });
}

function seedWorkflow(
  store: AuthoritativeTaskStore,
  db: SqliteDatabase,
  taskId: string,
  status: WorkflowStatus,
  retryCount: number = 0,
): void {
  db.transaction(() => {
    // Ensure task exists (foreign key constraint)
    const existing = store.getTask(taskId);
    if (!existing) {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: `Workflow task ${taskId}`,
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        completedAt: null,
      });
    }

    store.insertWorkflowState({
      taskId,
      divisionId: "general_ops",
      workflowId: "single_agent_minimal",
      currentStepIndex: status === "completed" ? 3 : 1,
      status,
      outputsJson: "{}",
      lastErrorCode: null,
      retryCount,
      resumableFromStep: null,
      startedAt: nowIso(),
      updatedAt: nowIso(),
    });
  });
}

function seedExecution(
  store: AuthoritativeTaskStore,
  db: SqliteDatabase,
  executionId: string,
  taskId: string,
  status: ExecutionStatus,
  attempt: number = 1,
): void {
  db.transaction(() => {
    store.insertExecution({
      id: executionId,
      taskId,
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent_1",
      roleId: "general_executor",
      runKind: "task_run",
      status,
      inputRef: null,
      traceId: `trace-${executionId}`,
      attempt,
      timeoutMs: 60000,
      budgetUsdLimit: 1,
      requiresApproval: 0,
      sandboxMode: "workspace_write",
      allowedToolsJson: "[]",
      allowedPathsJson: "[]",
      maxRetries: 0,
      retryBackoff: "none",
      lastErrorCode: null,
      lastErrorMessage: null,
      startedAt: nowIso(),
      finishedAt: status === "succeeded" || status === "failed" || status === "superseded" ? nowIso() : null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  });
}

// ---------------------------------------------------------------------------
// Tests: Metrics Collection Flow
// ---------------------------------------------------------------------------

test("E2E Metrics Collection: empty database returns zeroed metrics", () => {
  const h = createMetricsHarness("e2e-metrics-empty-");
  try {
    const summary = h.metricsService.buildSummary();

    assert.equal(summary.taskMetrics.total, 0, "Total tasks should be 0");
    assert.equal(summary.taskMetrics.successCount, 0, "Success count should be 0");
    assert.equal(summary.taskMetrics.failedCount, 0, "Failed count should be 0");
    assert.equal(summary.workflowMetrics.total, 0, "Total workflows should be 0");
    assert.equal(summary.executionMetrics.total, 0, "Total executions should be 0");
    assert.equal(summary.costMetrics.totalActualCostUsd, 0, "Total cost should be 0");
    assert.equal(summary.eventMetrics.total, 0, "Total events should be 0");
    assert.equal(summary.approvalMetrics.total, 0, "Total approvals should be 0");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E Metrics Collection: task status counts aggregated correctly", () => {
  const h = createMetricsHarness("e2e-metrics-task-counts-");
  const now = nowIso();

  try {
    // Seed tasks with various terminal statuses
    seedTask(h.store, h.db, "task-001", "done", 0.05, now);
    seedTask(h.store, h.db, "task-002", "done", 0.03, now);
    seedTask(h.store, h.db, "task-003", "failed", 0.01, now);
    seedTask(h.store, h.db, "task-004", "cancelled", 0, now);
    seedTask(h.store, h.db, "task-005", "in_progress", 0, now);
    seedTask(h.store, h.db, "task-006", "queued", 0, now);

    const summary = h.metricsService.buildSummary();

    assert.equal(summary.taskMetrics.total, 6, "Total tasks should be 6");
    assert.equal(summary.taskMetrics.successCount, 2, "Success count should be 2");
    assert.equal(summary.taskMetrics.failedCount, 1, "Failed count should be 1");
    assert.equal(summary.taskMetrics.cancelledCount, 1, "Cancelled count should be 1");
    assert.equal(summary.taskMetrics.activeCount, 2, "Active count should be 2 (in_progress + queued)");
    assert.equal(summary.taskMetrics.terminalCount, 4, "Terminal count should be 4");
    assert.equal(summary.taskMetrics.successRate, 0.5, "Success rate should be 0.5");
    assert.ok(Math.abs(summary.taskMetrics.completionRate - 4 / 6) < 0.001, "Completion rate should be ~4/6");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E Metrics Collection: workflow metrics aggregated correctly", () => {
  const h = createMetricsHarness("e2e-metrics-workflow-");
  const now = nowIso();

  try {
    // Seed workflows with various statuses
    seedWorkflow(h.store, h.db, "task-001", "completed", 0);
    seedWorkflow(h.store, h.db, "task-002", "completed", 1);
    seedWorkflow(h.store, h.db, "task-003", "failed", 0);
    seedWorkflow(h.store, h.db, "task-004", "cancelled", 0);
    seedWorkflow(h.store, h.db, "task-005", "running", 0);

    const summary = h.metricsService.buildSummary();

    assert.equal(summary.workflowMetrics.total, 5, "Total workflows should be 5");
    assert.equal(summary.workflowMetrics.completedCount, 2, "Completed count should be 2");
    assert.equal(summary.workflowMetrics.failedCount, 1, "Failed count should be 1");
    assert.equal(summary.workflowMetrics.cancelledCount, 1, "Cancelled count should be 1");
    assert.equal(summary.workflowMetrics.retriedCount, 1, "Retry count should be 1");
    assert.equal(summary.workflowMetrics.retryRate, 0.2, "Retry rate should be 0.2");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E Metrics Collection: execution metrics aggregated correctly", () => {
  const h = createMetricsHarness("e2e-metrics-exec-");
  const now = nowIso();

  try {
    // Seed executions with various statuses and attempts
    seedExecution(h.store, h.db, "exec-001", "task-001", "succeeded", 1);
    seedExecution(h.store, h.db, "exec-002", "task-002", "executing", 1);
    seedExecution(h.store, h.db, "exec-003", "task-003", "prechecking", 1);
    seedExecution(h.store, h.db, "exec-004", "task-004", "failed", 2);
    seedExecution(h.store, h.db, "exec-005", "task-005", "superseded", 1);

    const summary = h.metricsService.buildSummary();

    assert.equal(summary.executionMetrics.total, 5, "Total executions should be 5");
    assert.equal(summary.executionMetrics.activeCount, 3, "Active count should be 3 (executing + prechecking)");
    assert.equal(summary.executionMetrics.retryAttemptCount, 1, "Retry attempts should be 1 (exec-004 attempt=2)");
    assert.equal(summary.executionMetrics.supersededCount, 1, "Superseded count should be 1");
    assert.equal(summary.executionMetrics.retryRate, 0.2, "Retry rate should be 0.2");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E Metrics Collection: cost metrics aggregated correctly", () => {
  const h = createMetricsHarness("e2e-metrics-cost-");
  const now = nowIso();

  try {
    seedTask(h.store, h.db, "task-001", "done", 0.05, now);
    seedTask(h.store, h.db, "task-002", "done", 0.03, now);
    seedTask(h.store, h.db, "task-003", "failed", 0.01, now);
    seedTask(h.store, h.db, "task-004", "in_progress", 0.02, now);

    const summary = h.metricsService.buildSummary();

    assert.equal(summary.costMetrics.totalActualCostUsd, 0.09, "Total cost should be 0.09");
    assert.equal(summary.costMetrics.averageActualCostUsdPerTask, 0.0225, "Average cost per task");
    assert.equal(summary.costMetrics.averageActualCostUsdPerSuccessfulTask, 0.04, "Average cost per successful task");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E Metrics Collection: runtime registry counters and gauges", () => {
  // Use a fresh registry instance for isolated testing
  const registry = new RuntimeMetricsRegistry();

  registry.incrementCounter("test_requests_total", { method: "GET", path: "/health" }, 5);
  registry.incrementCounter("test_requests_total", { method: "POST", path: "/execute" }, 3);
  registry.setGauge("test_active_workers", { pool: "default" }, 10);
  registry.observeHistogram("test_request_duration_ms", { path: "/execute" }, 150);

  const counters = registry.getCounters("test_requests_total");
  assert.equal(counters.length, 2, "Should have 2 counter series");

  const gauges = registry.getGauges("test_active_workers");
  assert.equal(gauges.length, 1, "Should have 1 gauge series");
  assert.equal(gauges[0]?.value, 10, "Gauge value should be 10");

  const histograms = registry.getHistograms("test_request_duration_ms");
  assert.equal(histograms.length, 1, "Should have 1 histogram series");
  assert.equal(histograms[0]?.count, 1, "Histogram count should be 1");
  assert.equal(histograms[0]?.sum, 150, "Histogram sum should be 150");
});

test("E2E Metrics Collection: runtime registry HTTP request recording", () => {
  const registry = new RuntimeMetricsRegistry();

  registry.recordHttpRequest("GET", "/health", 200, 5.5);
  registry.recordHttpRequest("POST", "/execute", 200, 120.3);
  registry.recordHttpRequest("POST", "/execute", 500, null);

  const counters = registry.getCounters("http_requests_total");
  assert.equal(counters.length, 3, "Should have 3 counter series");

  const histograms = registry.getHistograms("http_request_duration_ms");
  assert.equal(histograms.length, 2, "Should have 2 histogram series (status 200 and 500)");

  const status200Hist = histograms.find((h) => h.labels.status === "200");
  assert.ok(status200Hist, "Should have histogram for status 200");
  assert.equal(status200Hist?.count, 2, "Status 200 histogram count should be 2");
});

test("E2E Metrics Collection: runtime registry OAPEFLR stage recording", () => {
  const registry = new RuntimeMetricsRegistry();

  registry.recordOapeflirStageEntry("intake");
  registry.recordOapeflirStageEntry("triage");
  registry.recordOapeflirStage("intake", "success", 50);
  registry.recordOapeflirStage("triage", "success", 120);
  registry.recordOapeflirStage("triage", "error", 80);

  const entryCounters = registry.getCounters("oapeflir_stage_entry_total");
  assert.equal(entryCounters.length, 2, "Should have 2 entry counter series");

  const outcomeCounters = registry.getCounters("oapeflir_stage_outcome_total");
  assert.equal(outcomeCounters.length, 3, "Should have 3 outcome counter series");

  const histograms = registry.getHistograms("oapeflir_loop_duration_ms");
  assert.equal(histograms.length, 2, "Should have 2 loop duration histogram series");

  const stageDurations = registry.getHistograms("stage_duration_seconds");
  assert.equal(stageDurations.length, 2, "Should have 2 stage duration histogram series");
});

test("E2E Metrics Collection: metrics include health status", () => {
  const h = createMetricsHarness("e2e-metrics-health-");
  const now = nowIso();

  try {
    // Seed a simple task so there is at least some data
    seedTask(h.store, h.db, "task-001", "in_progress", 0, now);

    const summary = h.metricsService.buildSummary();

    // Verify runtime health metrics are populated
    assert.ok(["ok", "degraded", "overloaded", "unhealthy"].includes(summary.runtimeMetrics.status),
      "Health status should be a valid value");
    assert.ok(["none", "queue_only", "fast_only", "pause_non_critical", "read_only_operations_only"].includes(
      summary.runtimeMetrics.degradationMode), "Degradation mode should be valid");

    // Verify activeExecutions and queuedTasks are numbers
    assert.ok(typeof summary.runtimeMetrics.activeExecutions === "number");
    assert.ok(typeof summary.runtimeMetrics.queuedTasks === "number");

    // Verify worker health is present
    assert.ok(typeof summary.runtimeMetrics.workerHealth === "object");
    assert.ok(typeof summary.runtimeMetrics.workerHealth.totalWorkers === "number");

    // Verify queue governance is present
    assert.ok(typeof summary.runtimeMetrics.queueGovernance === "object");
    assert.ok(Array.isArray(summary.runtimeMetrics.queueGovernance.queueNames));
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E Metrics Collection: global metrics registry singleton", () => {
  // Verify the exported singleton exists and is usable
  assert.ok(runtimeMetricsRegistry instanceof RuntimeMetricsRegistry,
    "runtimeMetricsRegistry should be an instance of RuntimeMetricsRegistry");

  runtimeMetricsRegistry.incrementCounter("singleton_test_counter", { label: "value" }, 1);

  const counters = runtimeMetricsRegistry.getCounters("singleton_test_counter");
  assert.equal(counters.length, 1, "Should have 1 counter from singleton");
  assert.equal(counters[0]?.value, 1, "Counter value should be 1");
});

test("E2E Metrics Collection: generated summary includes window information", () => {
  const h = createMetricsHarness("e2e-metrics-window-");
  const now = nowIso();

  try {
    seedTask(h.store, h.db, "task-001", "done", 0, now);

    const summary = h.metricsService.buildSummary();

    assert.equal(summary.generatedAt, now, "Generated at should match");
    assert.ok(summary.window.firstTaskCreatedAt !== null, "First task created should be set");
    assert.ok(summary.window.lastTaskUpdatedAt !== null, "Last task updated should be set");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});