/**
 * Golden Test: Health Service Output Structure
 *
 * Verifies health service produces consistent report structure
 * with proper status fields, findings, and component health.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { SqliteDatabase } from "../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { HealthService } from "../../src/platform/shared/observability/health-service.js";
import { seedTaskAndExecution, seedQueuedTasks } from "../helpers/seed.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { assertGolden } from "../helpers/golden.js";
import { newId } from "../../src/platform/contracts/types/ids.js";

test("golden: health service report has all required fields", () => {
  const workspace = createTempWorkspace("aa-golden-health-report-");

  const dbPath = `${workspace}/health-report.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  const taskId = "health_report_task_001";
  const executionId = "health_report_exec_001";
  seedTaskAndExecution(db, store, { taskId, executionId, traceId: "health-trace" });

  const service = new HealthService(db, store);
  const report = service.getReport();

  // Verify all required fields are present
  assert.ok(report, "Report should exist");
  assert.ok(typeof report.status === "string", "Status should be string");
  assert.ok(["ok", "degraded", "overloaded", "unhealthy"].includes(report.status), "Status should be valid enum value");
  assert.ok(typeof report.uptimeSeconds === "number", "Uptime should be number");
  assert.ok(typeof report.dbWritable === "boolean", "dbWritable should be boolean");
  assert.ok(Array.isArray(report.findings), "Findings should be array");

  assertGolden("health-service-report-fields", {
    status: report.status,
    uptimeSeconds: report.uptimeSeconds,
    dbWritable: report.dbWritable,
    findingCount: report.findings.length,
    hasProviderHealth: report.providerHealth !== undefined,
    hasActiveExecutions: report.activeExecutions !== undefined,
    hasQueuedTasks: report.queuedTasks !== undefined,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: health service findings have correct structure", () => {
  const workspace = createTempWorkspace("aa-golden-health-findings-");

  const dbPath = `${workspace}/health-findings.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  const service = new HealthService(db, store);
  const report = service.getReport();

  for (const finding of report.findings) {
    assert.ok(finding, "Finding should exist");
    assert.ok(typeof finding.code === "string", "Finding code should be string");
    assert.ok(typeof finding.severity === "string", "Finding severity should be string");
    assert.ok(typeof finding.message === "string", "Finding message should be string");
    assert.ok(["debug", "info", "warn", "error", "critical"].includes(finding.severity), "Severity should be valid");
  }

  assertGolden("health-service-findings", {
    findingCount: report.findings.length,
    allHaveCode: report.findings.every((f) => f.code.length > 0),
    severities: report.findings.map((f) => f.severity),
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: health service provider health format", () => {
  const workspace = createTempWorkspace("aa-golden-health-provider-");

  const dbPath = `${workspace}/health-provider.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  const service = new HealthService(db, store);
  const report = service.getReport();

  assert.ok(report.providerHealth, "Provider health should exist");
  assert.ok(typeof report.providerHealth === "string", "Provider health should be string");
  assert.ok(["healthy", "degraded", "failed"].includes(report.providerHealth), "Provider health should be valid enum");

  assertGolden("health-service-provider-health", {
    status: report.providerHealth,
    hasSuccessRate: typeof report.providerSuccessRate === "number",
    hasRecentCalls: typeof report.providerRecentCalls === "number",
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: health service with active executions count", () => {
  const workspace = createTempWorkspace("aa-golden-health-exec-");

  const dbPath = `${workspace}/health-exec.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  // Create multiple tasks with executions
  for (let i = 1; i <= 3; i++) {
    const taskId = `health_exec_task_${String(i).padStart(3, "0")}`;
    const executionId = `health_exec_exec_${String(i).padStart(3, "0")}`;
    seedTaskAndExecution(db, store, { taskId, executionId, traceId: `health-exec-trace-${i}` });
  }

  const service = new HealthService(db, store);
  const report = service.getReport();

  assert.ok(typeof report.activeExecutions === "number", "Active executions should be number");
  assert.ok(report.activeExecutions >= 0, "Active executions should be non-negative");

  assertGolden("health-service-active-executions", {
    activeExecutions: report.activeExecutions,
    queuedTasks: report.queuedTasks,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: health service queued tasks count", () => {
  const workspace = createTempWorkspace("aa-golden-health-queued-");

  const dbPath = `${workspace}/health-queued.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  // Create queued tasks
  seedQueuedTasks(db, store, { count: 5, prefix: "health-queued" });

  const service = new HealthService(db, store);
  const report = service.getReport();

  assert.ok(typeof report.queuedTasks === "number", "Queued tasks should be number");
  assert.ok(report.queuedTasks >= 0, "Queued tasks should be non-negative");

  assertGolden("health-service-queued-tasks", {
    queuedTasks: report.queuedTasks,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: health service backpressure metrics format", () => {
  const workspace = createTempWorkspace("aa-golden-health-backpressure-");

  const dbPath = `${workspace}/health-backpressure.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  const service = new HealthService(db, store);
  const report = service.getReport();

  assert.ok(report.backpressure, "Backpressure should exist");
  assert.ok(typeof report.backpressure.status === "string", "Backpressure status should be string");
  assert.ok(typeof report.backpressure.degradationMode === "string", "Degradation mode should be string");
  assert.ok(typeof report.backpressure.tier1AckBacklog === "number", "Tier1 ack backlog should be number");

  assertGolden("health-service-backpressure", {
    status: report.backpressure.status,
    degradationMode: report.backpressure.degradationMode,
    tier1AckBacklog: report.backpressure.tier1AckBacklog,
    hasQueueGovernance: report.backpressure.queueGovernance !== undefined,
  });

  db.close();
  cleanupPath(workspace);
});
