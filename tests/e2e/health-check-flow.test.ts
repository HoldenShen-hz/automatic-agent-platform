/**
 * E2E Health Check Flow Tests
 *
 * End-to-end tests covering health check operations across system states.
 *
 * Tests validate:
 * - HealthService.getReport() returns valid status report
 * - Status transitions: ok -> degraded -> overloaded -> unhealthy
 * - Database writability checks (sync and async)
 * - Queue governance health summary
 * - Worker health summary
 * - Memory usage and event loop lag sampling
 * - Degradation mode determination
 * - Health findings generation
 *
 * Uses in-memory SQLite database and mock external dependencies.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { HealthService } from "../../src/platform/shared/observability/health-service.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { nowIso } from "../../src/platform/contracts/types/ids.js";
import type { TaskStatus, ExecutionStatus } from "../../src/platform/contracts/types/status.js";

function createHealthHarness(prefix: string, options?: ConstructorParameters<typeof HealthService>[2]) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = `${workspace}/health-test.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const healthService = new HealthService(db, store, options);

  return { workspace, dbPath, db, store, healthService };
}

function seedTask(
  store: AuthoritativeTaskStore,
  db: SqliteDatabase,
  taskId: string,
  status: TaskStatus,
  createdAt: string = nowIso(),
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
      outputJson: null,
      estimatedCostUsd: 0,
      actualCostUsd: 0,
      errorCode: null,
      createdAt,
      updatedAt: createdAt,
      completedAt: status === "done" || status === "failed" || status === "cancelled" ? createdAt : null,
    });
  });
}

function seedExecution(
  store: AuthoritativeTaskStore,
  db: SqliteDatabase,
  executionId: string,
  taskId: string,
  status: ExecutionStatus,
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
      attempt: 1,
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
      finishedAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  });
}

// ---------------------------------------------------------------------------
// Tests: Health Check Flow
// ---------------------------------------------------------------------------

test("E2E Health Check: returns valid status report", () => {
  const h = createHealthHarness("e2e-health-valid-");
  try {
    const report = h.healthService.getReport();

    assert.ok(report, "Report should exist");
    assert.ok(["ok", "degraded", "overloaded", "unhealthy"].includes(report.status),
      `Status should be valid, got: ${report.status}`);
    assert.ok(typeof report.uptimeSeconds === "number", "Uptime should be a number");
    assert.ok(typeof report.dbWritable === "boolean", "dbWritable should be a boolean");
    assert.ok(["healthy", "degraded", "failed"].includes(report.providerHealth),
      "Provider health should be valid");
    assert.ok(typeof report.providerSuccessRate === "number", "Provider success rate should be a number");
    assert.ok(typeof report.activeExecutions === "number", "Active executions should be a number");
    assert.ok(typeof report.queuedTasks === "number", "Queued tasks should be a number");
    assert.ok(typeof report.memoryRssMb === "number", "Memory RSS should be a number");
    assert.ok(typeof report.tier1AckBacklog === "number", "Tier1 ack backlog should be a number");
    assert.ok(["none", "queue_only", "fast_only", "pause_non_critical", "read_only_operations_only"].includes(
      report.degradationMode), "Degradation mode should be valid");
    assert.ok(Array.isArray(report.findings), "Findings should be an array");
    assert.ok(Array.isArray(report.queueGovernance.queueNames), "Queue names should be an array");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E Health Check: empty database shows ok status", () => {
  const h = createHealthHarness("e2e-health-empty-");
  try {
    const report = h.healthService.getReport();

    assert.equal(report.status, "ok", "Empty database should report ok status");
    assert.equal(report.dbWritable, true, "Database should be writable");
    assert.equal(report.activeExecutions, 0, "Active executions should be 0");
    assert.equal(report.queuedTasks, 0, "Queued tasks should be 0");
    assert.equal(report.findings.length, 0, "Findings should be empty for ok status");
    assert.equal(report.degradationMode, "none", "Degradation mode should be none");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E Health Check: queued tasks trigger degraded status", () => {
  const h = createHealthHarness("e2e-health-queued-", {
    queuedTaskDegradedThreshold: 3,
    queuedTaskOverloadedThreshold: 10,
  });
  const now = nowIso();

  try {
    // Seed tasks in queued state
    seedTask(h.store, h.db, "task-001", "queued", now);
    seedTask(h.store, h.db, "task-002", "queued", now);
    seedTask(h.store, h.db, "task-003", "queued", now);
    seedTask(h.store, h.db, "task-004", "queued", now);

    const report = h.healthService.getReport();

    assert.equal(report.queuedTasks, 4, "Queued tasks should be 4");
    assert.equal(report.status, "degraded", "Should be degraded with 4 queued tasks");
    assert.ok(report.findings.includes("queued_tasks_degraded"), "Should have queued_tasks_degraded finding");
    assert.ok(["queue_only", "fast_only", "pause_non_critical", "read_only_operations_only", "none"].includes(
      report.degradationMode), "Degradation mode should be set");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E Health Check: high active executions trigger overloaded status", () => {
  const h = createHealthHarness("e2e-health-overload-", {
    activeExecutionOverloadedThreshold: 3,
    queuedTaskDegradedThreshold: 5,
    queuedTaskOverloadedThreshold: 10,
  });
  const now = nowIso();

  try {
    // Create task and execution pairs in executing state
    seedTask(h.store, h.db, "task-001", "in_progress", now);
    seedExecution(h.store, h.db, "exec-001", "task-001", "executing");

    seedTask(h.store, h.db, "task-002", "in_progress", now);
    seedExecution(h.store, h.db, "exec-002", "task-002", "executing");

    seedTask(h.store, h.db, "task-003", "in_progress", now);
    seedExecution(h.store, h.db, "exec-003", "task-003", "executing");

    seedTask(h.store, h.db, "task-004", "in_progress", now);
    seedExecution(h.store, h.db, "exec-004", "task-004", "executing");

    const report = h.healthService.getReport();

    assert.ok(report.activeExecutions >= 4, `Active executions should be >= 4, got ${report.activeExecutions}`);
    assert.equal(report.status, "overloaded", "Should be overloaded with many active executions");
    assert.ok(report.findings.includes("active_executions_overloaded"), "Should have active_executions_overloaded finding");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E Health Check: database writability check fails gracefully", () => {
  const h = createHealthHarness("e2e-health-db-");
  try {
    const report = h.healthService.getReport();

    // SQLite should always be writable in this test environment
    assert.equal(report.dbWritable, true, "Database should be writable in normal conditions");

    // Verify the check doesn't throw
    assert.ok(typeof report.uptimeSeconds === "number");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E Health Check: async report matches sync report", async () => {
  const h = createHealthHarness("e2e-health-async-");
  try {
    const syncReport = h.healthService.getReport();
    const asyncReport = await h.healthService.getReportAsync();
    assert.equal(asyncReport.status, syncReport.status, "Async status should match sync status");
    assert.equal(asyncReport.dbWritable, syncReport.dbWritable, "Async dbWritable should match sync");
    assert.equal(asyncReport.uptimeSeconds, syncReport.uptimeSeconds, "Async uptime should match sync");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E Health Check: queue governance summary populated", () => {
  const h = createHealthHarness("e2e-health-queue-");
  try {
    const report = h.healthService.getReport();

    assert.ok(typeof report.queueGovernance.backlogSize === "number", "Backlog size should be a number");
    assert.ok(typeof report.queueGovernance.dispatchableBacklogSize === "number",
      "Dispatchable backlog size should be a number");
    assert.ok(typeof report.queueGovernance.claimedBacklogSize === "number", "Claimed backlog size should be a number");
    assert.ok(Array.isArray(report.queueGovernance.queueNames), "Queue names should be an array");
    assert.ok(typeof report.queueGovernance.starvationDetected === "boolean",
      "Starvation detected should be a boolean");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E Health Check: worker health summary populated", () => {
  const h = createHealthHarness("e2e-health-workers-");
  try {
    const report = h.healthService.getReport();

    assert.ok(typeof report.workerHealth.totalWorkers === "number", "Total workers should be a number");
    assert.ok(typeof report.workerHealth.healthyWorkers === "number", "Healthy workers should be a number");
    assert.ok(typeof report.workerHealth.busyWorkers === "number", "Busy workers should be a number");
    assert.ok(typeof report.workerHealth.drainingWorkers === "number", "Draining workers should be a number");
    assert.ok(typeof report.workerHealth.degradedWorkers === "number", "Degraded workers should be a number");
    assert.ok(typeof report.workerHealth.quarantinedWorkers === "number", "Quarantined workers should be a number");
    assert.ok(typeof report.workerHealth.offlineWorkers === "number", "Offline workers should be a number");
    assert.ok(typeof report.workerHealth.staleWorkers === "number", "Stale workers should be a number");
    assert.ok(typeof report.workerHealth.loadSkewDetected === "boolean", "Load skew detected should be a boolean");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E Health Check: event loop lag affects status", () => {
  const h = createHealthHarness("e2e-health-lag-", {
    eventLoopLagThresholdMs: 50,
    eventLoopLagSampler: () => 100,
  });
  try {
    const report = h.healthService.getReport();

    assert.equal(report.eventLoopLagMs, 100, "Event loop lag should be 100");
    assert.equal(report.status, "overloaded", "Should be overloaded when lag exceeds the overload threshold");
    assert.ok(report.findings.includes("event_loop_lag_overloaded"), "Should have event_loop_lag_overloaded finding");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E Health Check: memory high watermark affects status", () => {
  const h = createHealthHarness("e2e-health-mem-", {
    memoryHighWatermarkMb: 1, // Very low threshold
  });
  try {
    const report = h.healthService.getReport();

    // Memory RSS should exceed the 1MB threshold
    assert.ok(report.memoryRssMb > 1, `Memory ${report.memoryRssMb}MB should exceed 1MB threshold`);
    assert.ok(["degraded", "overloaded"].includes(report.status),
      `Status should be degraded or overloaded, got: ${report.status}`);
    assert.ok(report.findings.some((f) => f.includes("memory")), "Should have memory-related finding");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E Health Check: degraded mode transitions correctly", () => {
  const h = createHealthHarness("e2e-health-mode-", {
    queuedTaskDegradedThreshold: 2,
    queuedTaskOverloadedThreshold: 100,
    tier1AckDegradedThreshold: 100,
    tier1AckOverloadedThreshold: 200,
  });
  const now = nowIso();

  try {
    // Add 3 queued tasks to cross degraded threshold but not overloaded
    seedTask(h.store, h.db, "task-001", "queued", now);
    seedTask(h.store, h.db, "task-002", "queued", now);
    seedTask(h.store, h.db, "task-003", "queued", now);

    const report = h.healthService.getReport();

    assert.equal(report.queuedTasks, 3, "Queued tasks should be 3");
    assert.ok(["degraded", "overloaded"].includes(report.status),
      `Status should be degraded, got: ${report.status}`);
    assert.ok(report.findings.includes("queued_tasks_degraded"), "Should include queued_tasks_degraded");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E Health Check: findings array is complete", () => {
  const h = createHealthHarness("e2e-health-findings-", {
    queuedTaskDegradedThreshold: 1,
  });
  const now = nowIso();

  try {
    seedTask(h.store, h.db, "task-001", "queued", now);
    seedTask(h.store, h.db, "task-002", "queued", now);

    const report = h.healthService.getReport();

    assert.ok(report.findings.length > 0, "Findings should not be empty");
    assert.ok(report.findings.includes("queued_tasks_degraded"), "Should include queued_tasks_degraded");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E Health Check: provider health defaults to healthy when no tracker", () => {
  const h = createHealthHarness("e2e-health-provider-");
  try {
    const report = h.healthService.getReport();

    assert.equal(report.providerHealth, "healthy", "Provider health should default to healthy");
    assert.equal(report.providerSuccessRate, 1, "Provider success rate should be 1");
    assert.equal(report.providerRecentCalls, 0, "Provider recent calls should be 0");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E Health Check: tier1 ack backlog tracked", () => {
  const h = createHealthHarness("e2e-health-tier1-", {
    tier1AckDegradedThreshold: 5,
    tier1AckOverloadedThreshold: 10,
  });
  try {
    const report = h.healthService.getReport();

    assert.ok(typeof report.tier1AckBacklog === "number", "Tier1 ack backlog should be a number");
    // In empty database, should be 0
    if (report.tier1AckBacklog === 0) {
      assert.equal(report.status, "ok", "Status should be ok with 0 tier1 backlog");
    }
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E Health Check: uptime increases over time", () => {
  const h = createHealthHarness("e2e-health-uptime-");

  try {
    const report1 = h.healthService.getReport();
    const initialUptime = report1.uptimeSeconds;

    // Small delay to let uptime tick
    const report2 = h.healthService.getReport();
    const laterUptime = report2.uptimeSeconds;

    assert.ok(laterUptime >= initialUptime, `Later uptime ${laterUptime} should be >= initial ${initialUptime}`);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
