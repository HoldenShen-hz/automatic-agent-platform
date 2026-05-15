import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { HealthService } from "../../../../../src/platform/shared/observability/health-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

test("HealthService getReport returns valid status report", () => {
  const workspace = createTempWorkspace("aa-health-basic-");
  const dbPath = join(workspace, "health-basic.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const service = new HealthService(db, store);
    const report = service.getReport();

    assert.ok(report !== undefined);
    assert.ok(["ok", "degraded", "overloaded", "unhealthy"].includes(report.status));
    assert.equal(typeof report.dbWritable, "boolean");
    assert.equal(typeof report.uptimeSeconds, "number");
    assert.ok(report.uptimeSeconds >= 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService checkHealth is alias for getReport", () => {
  const workspace = createTempWorkspace("aa-health-alias-");
  const dbPath = join(workspace, "health-alias.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const service = new HealthService(db, store);
    const report = service.checkHealth();

    assert.ok(report !== undefined);
    assert.ok(["ok", "degraded", "overloaded", "unhealthy"].includes(report.status));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService getReportAsync returns valid promise", async () => {
  const workspace = createTempWorkspace("aa-health-async-");
  const dbPath = join(workspace, "health-async.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const service = new HealthService(db, store);
    const report = await service.getReportAsync();

    assert.ok(report !== undefined);
    assert.ok(["ok", "degraded", "overloaded", "unhealthy"].includes(report.status));
    assert.equal(typeof report.dbWritable, "boolean");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService report contains all required fields", () => {
  const workspace = createTempWorkspace("aa-health-fields-");
  const dbPath = join(workspace, "health-fields.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const service = new HealthService(db, store);
    const report = service.getReport();

    assert.ok("status" in report);
    assert.ok("uptimeSeconds" in report);
    assert.ok("dbWritable" in report);
    assert.ok("providerHealth" in report);
    assert.ok("providerSuccessRate" in report);
    assert.ok("providerRecentCalls" in report);
    assert.ok("activeExecutions" in report);
    assert.ok("queuedTasks" in report);
    assert.ok("eventLoopLagMs" in report);
    assert.ok("memoryRssMb" in report);
    assert.ok("tier1AckBacklog" in report);
    assert.ok("degradationMode" in report);
    assert.ok("queueGovernance" in report);
    assert.ok("workerHealth" in report);
    assert.ok("findings" in report);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService queueGovernance has correct structure", () => {
  const workspace = createTempWorkspace("aa-health-queue-struct-");
  const dbPath = join(workspace, "health-queue-struct.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const service = new HealthService(db, store);
    const report = service.getReport();

    assert.equal(typeof report.queueGovernance.backlogSize, "number");
    assert.equal(typeof report.queueGovernance.dispatchableBacklogSize, "number");
    assert.equal(typeof report.queueGovernance.claimedBacklogSize, "number");
    assert.ok(report.queueGovernance.oldestWaitSeconds === null || typeof report.queueGovernance.oldestWaitSeconds === "number");
    assert.ok(report.queueGovernance.oldestClaimAgeSeconds === null || typeof report.queueGovernance.oldestClaimAgeSeconds === "number");
    assert.ok(Array.isArray(report.queueGovernance.queueNames));
    assert.equal(typeof report.queueGovernance.starvationDetected, "boolean");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService workerHealth has correct structure", () => {
  const workspace = createTempWorkspace("aa-health-worker-struct-");
  const dbPath = join(workspace, "health-worker-struct.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const service = new HealthService(db, store);
    const report = service.getReport();

    assert.equal(typeof report.workerHealth.totalWorkers, "number");
    assert.equal(typeof report.workerHealth.healthyWorkers, "number");
    assert.equal(typeof report.workerHealth.busyWorkers, "number");
    assert.equal(typeof report.workerHealth.drainingWorkers, "number");
    assert.equal(typeof report.workerHealth.degradedWorkers, "number");
    assert.equal(typeof report.workerHealth.quarantinedWorkers, "number");
    assert.equal(typeof report.workerHealth.offlineWorkers, "number");
    assert.equal(typeof report.workerHealth.staleWorkers, "number");
    assert.equal(typeof report.workerHealth.loadSkewDetected, "boolean");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService degradationMode is valid value", () => {
  const workspace = createTempWorkspace("aa-health-deg-");
  const dbPath = join(workspace, "health-deg.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const service = new HealthService(db, store);
    const report = service.getReport();

    assert.ok([
      "none",
      "queue_only",
      "fast_only",
      "pause_non_critical",
      "read_only_operations_only",
    ].includes(report.degradationMode));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService findings is an array of strings", () => {
  const workspace = createTempWorkspace("aa-health-findings-");
  const dbPath = join(workspace, "health-findings.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const service = new HealthService(db, store);
    const report = service.getReport();

    assert.ok(Array.isArray(report.findings));
    report.findings.forEach((finding) => {
      assert.equal(typeof finding, "string");
    });

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
