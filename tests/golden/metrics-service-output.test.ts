/**
 * Golden Test: Metrics Service Output Structure
 *
 * Verifies metrics service produces consistent runtime metrics summary
 * for SLO evaluation, governance reporting, and observability dashboards.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { MetricsService } from "../../src/platform/shared/observability/metrics-service.js";
import { HealthService } from "../../src/platform/shared/observability/health-service.js";
import { seedTaskAndExecution } from "../helpers/seed.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { assertGolden } from "../helpers/golden.js";

test("golden: metrics service buildSummary has expected structure", () => {
  const workspace = createTempWorkspace("aa-golden-metrics-");

  const dbPath = `${workspace}/metrics.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  const healthService = new HealthService(db, store);
  const metricsService = new MetricsService(db, healthService);

  // Create some tasks for metrics
  seedTaskAndExecution(db, store, {
    taskId: "metrics_task_001",
    executionId: "metrics_exec_001",
    traceId: "metrics-trace-1",
  });
  seedTaskAndExecution(db, store, {
    taskId: "metrics_task_002",
    executionId: "metrics_exec_002",
    traceId: "metrics-trace-2",
  });

  const summary = metricsService.buildSummary();

  // Verify top-level structure
  assert.ok(summary, "Summary should exist");
  assert.ok(summary.generatedAt, "Should have generatedAt");
  assert.ok(summary.window, "Should have window");
  assert.ok(summary.taskMetrics, "Should have taskMetrics");
  assert.ok(summary.workflowMetrics, "Should have workflowMetrics");
  assert.ok(summary.executionMetrics, "Should have executionMetrics");
  assert.ok(summary.recoveryMetrics, "Should have recoveryMetrics");
  assert.ok(summary.stepMetrics, "Should have stepMetrics");
  assert.ok(summary.costMetrics, "Should have costMetrics");
  assert.ok(summary.approvalMetrics, "Should have approvalMetrics");
  assert.ok(summary.eventMetrics, "Should have eventMetrics");
  assert.ok(summary.runtimeMetrics, "Should have runtimeMetrics");

  assertGolden("metrics-service-summary-structure", {
    // Note: generatedAt excluded as it changes per run
    window: {
      hasFirstTaskCreatedAt: summary.window.firstTaskCreatedAt !== null,
      hasLastTaskUpdatedAt: summary.window.lastTaskUpdatedAt !== null,
    },
    hasTaskMetrics: summary.taskMetrics.total >= 0,
    hasWorkflowMetrics: summary.workflowMetrics !== undefined,
    hasExecutionMetrics: summary.executionMetrics !== undefined,
    hasRecoveryMetrics: summary.recoveryMetrics !== undefined,
    hasStepMetrics: summary.stepMetrics !== undefined,
    hasCostMetrics: summary.costMetrics !== undefined,
    hasApprovalMetrics: summary.approvalMetrics !== undefined,
    hasEventMetrics: summary.eventMetrics !== undefined,
    hasRuntimeMetrics: summary.runtimeMetrics !== undefined,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: metrics service task metrics have correct structure", () => {
  const workspace = createTempWorkspace("aa-golden-metrics-task-");

  const dbPath = `${workspace}/metrics-task.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  const healthService = new HealthService(db, store);
  const metricsService = new MetricsService(db, healthService);

  // Create tasks with different statuses
  seedTaskAndExecution(db, store, {
    taskId: "metrics_task_status_001",
    executionId: "metrics_exec_status_001",
    traceId: "metrics-status-trace-1",
  });

  const summary = metricsService.buildSummary();
  const taskMetrics = summary.taskMetrics;

  // Verify task metrics structure
  assert.ok(typeof taskMetrics.total === "number", "total should be number");
  assert.ok(typeof taskMetrics.terminalCount === "number", "terminalCount should be number");
  assert.ok(typeof taskMetrics.successCount === "number", "successCount should be number");
  assert.ok(typeof taskMetrics.failedCount === "number", "failedCount should be number");
  assert.ok(typeof taskMetrics.cancelledCount === "number", "cancelledCount should be number");
  assert.ok(typeof taskMetrics.activeCount === "number", "activeCount should be number");
  assert.ok(typeof taskMetrics.successRate === "number", "successRate should be number");
  assert.ok(typeof taskMetrics.completionRate === "number", "completionRate should be number");

  // Verify derived ratios are between 0 and 1 (or 0 when no data)
  assert.ok(taskMetrics.successRate >= 0 && taskMetrics.successRate <= 1, "successRate should be between 0 and 1");
  assert.ok(taskMetrics.completionRate >= 0 && taskMetrics.completionRate <= 1, "completionRate should be between 0 and 1");

  assertGolden("metrics-service-task-metrics", {
    total: taskMetrics.total,
    terminalCount: taskMetrics.terminalCount,
    successCount: taskMetrics.successCount,
    failedCount: taskMetrics.failedCount,
    activeCount: taskMetrics.activeCount,
    successRate: taskMetrics.successRate,
    completionRate: taskMetrics.completionRate,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: metrics service runtime metrics include health data", () => {
  const workspace = createTempWorkspace("aa-golden-metrics-runtime-");

  const dbPath = `${workspace}/metrics-runtime.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  const healthService = new HealthService(db, store);
  const metricsService = new MetricsService(db, healthService);

  const summary = metricsService.buildSummary();
  const runtime = summary.runtimeMetrics;

  // Verify runtime metrics include health data
  assert.ok(runtime, "Runtime metrics should exist");
  assert.ok(["ok", "degraded", "overloaded", "unhealthy"].includes(runtime.status), "Status should be valid health status");
  assert.ok(typeof runtime.degradationMode === "string", "degradationMode should be string");
  assert.ok(typeof runtime.providerSuccessRate === "number", "providerSuccessRate should be number");
  assert.ok(typeof runtime.activeExecutions === "number", "activeExecutions should be number");
  assert.ok(typeof runtime.queuedTasks === "number", "queuedTasks should be number");
  assert.ok(typeof runtime.tier1AckBacklog === "number", "tier1AckBacklog should be number");
  assert.ok(Array.isArray(runtime.findings), "findings should be array");

  assertGolden("metrics-service-runtime-metrics", {
    status: runtime.status,
    degradationMode: runtime.degradationMode,
    providerSuccessRate: runtime.providerSuccessRate,
    activeExecutions: runtime.activeExecutions,
    queuedTasks: runtime.queuedTasks,
    tier1AckBacklog: runtime.tier1AckBacklog,
    findingsCount: runtime.findings.length,
    hasQueueGovernance: runtime.queueGovernance !== undefined,
    hasWorkerHealth: runtime.workerHealth !== undefined,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: metrics service cost and step metrics have correct structure", () => {
  const workspace = createTempWorkspace("aa-golden-metrics-cost-");

  const dbPath = `${workspace}/metrics-cost.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  const healthService = new HealthService(db, store);
  const metricsService = new MetricsService(db, healthService);

  const summary = metricsService.buildSummary();

  // Verify cost metrics structure
  assert.ok(typeof summary.costMetrics.totalActualCostUsd === "number", "totalActualCostUsd should be number");
  assert.ok(summary.costMetrics.averageActualCostUsdPerTask === null || typeof summary.costMetrics.averageActualCostUsdPerTask === "number", "averageActualCostUsdPerTask should be number or null");
  assert.ok(summary.costMetrics.averageActualCostUsdPerSuccessfulTask === null || typeof summary.costMetrics.averageActualCostUsdPerSuccessfulTask === "number", "averageActualCostUsdPerSuccessfulTask should be number or null");

  // Verify step metrics structure
  assert.ok(typeof summary.stepMetrics.total === "number", "stepMetrics.total should be number");
  assert.ok(summary.stepMetrics.averageDurationMs === null || typeof summary.stepMetrics.averageDurationMs === "number", "averageDurationMs should be number or null");
  assert.ok(summary.stepMetrics.p95DurationMs === null || typeof summary.stepMetrics.p95DurationMs === "number", "p95DurationMs should be number or null");
  assert.ok(summary.stepMetrics.averageTokenCost === null || typeof summary.stepMetrics.averageTokenCost === "number", "averageTokenCost should be number or null");
  assert.ok(typeof summary.stepMetrics.totalTokenCost === "number", "totalTokenCost should be number");

  assertGolden("metrics-service-cost-step-metrics", {
    totalActualCostUsd: summary.costMetrics.totalActualCostUsd,
    hasAverageCostPerTask: summary.costMetrics.averageActualCostUsdPerTask !== null,
    stepTotal: summary.stepMetrics.total,
    hasAverageDuration: summary.stepMetrics.averageDurationMs !== null,
    hasP95Duration: summary.stepMetrics.p95DurationMs !== null,
    totalTokenCost: summary.stepMetrics.totalTokenCost,
  });

  db.close();
  cleanupPath(workspace);
});
