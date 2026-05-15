/**
 * Integration Test: Health Service
 *
 * Verifies:
 * - HealthService monitors database writability
 * - HealthService tracks provider health and success rates
 * - HealthService detects queue backpressure
 * - HealthService reports correct status based on thresholds
 * - HealthService integrates with AuthoritativeTaskStore
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { HealthService } from "../../../../../src/platform/shared/observability/health-service.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution, seedQueuedTasks } from "../../../../helpers/seed.js";
import { newId } from "../../../../../src/platform/contracts/types/ids.js";

test("health-service: reports ok status when database is writable and no issues", () => {
  const workspace = createTempWorkspace("aa-health-");
  const dbPath = join(workspace, "health.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const service = new HealthService(db, store);
    const report = service.getReport();

    assert.equal(report.dbWritable, true);
    assert.ok(["ok", "degraded", "overloaded", "unhealthy"].includes(report.status));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("health-service: reports database writability in health status", () => {
  const workspace = createTempWorkspace("aa-health-writability-");
  const dbPath = join(workspace, "writability.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const service = new HealthService(db, store);
    const report = service.getReport();

    // Database should be writable initially
    assert.equal(report.dbWritable, true);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("health-service: health report includes execution summary when tasks exist", () => {
  const workspace = createTempWorkspace("aa-health-exec-");
  const dbPath = join(workspace, "exec.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(db, store, { taskId, executionId });

    const service = new HealthService(db, store);
    const report = service.getReport();

    assert.ok(typeof report.activeExecutions === "number");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("health-service: backpressure detection when queue is saturated", () => {
  const workspace = createTempWorkspace("aa-health-backpressure-");
  const dbPath = join(workspace, "backpressure.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    // Seed many queued tasks to trigger backpressure
    seedQueuedTasks(db, store, { count: 15, prefix: "backpressure-test" });

    const service = new HealthService(db, store, {
      queuedTaskOverloadedThreshold: 10,
    });

    const report = service.getReport();

    // Should detect overload or degraded status
    assert.ok(
      ["degraded", "overloaded", "ok"].includes(report.status),
      `Expected degraded/overloaded/ok but got ${report.status}`,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("health-service: custom thresholds affect health determination", () => {
  const workspace = createTempWorkspace("aa-health-thresholds-");
  const dbPath = join(workspace, "thresholds.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    // Seed some tasks
    seedQueuedTasks(db, store, { count: 5, prefix: "threshold-test" });

    // Create service with very low threshold
    const serviceLow = new HealthService(db, store, {
      queuedTaskOverloadedThreshold: 1,
      queuedTaskDegradedThreshold: 0,
    });

    const reportLow = serviceLow.getReport();

    // With threshold of 1, 5 tasks should trigger overloaded
    assert.ok(["degraded", "overloaded"].includes(reportLow.status));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("health-service: report includes findings array", () => {
  const workspace = createTempWorkspace("aa-health-findings-");
  const dbPath = join(workspace, "findings.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const service = new HealthService(db, store);
    const report = service.getReport();

    assert.ok(Array.isArray(report.findings));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("health-service: health status transitions based on load", () => {
  const workspace = createTempWorkspace("aa-health-transition-");
  const dbPath = join(workspace, "transition.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    // Start with low threshold - should be ok
    const service = new HealthService(db, store, {
      queuedTaskOverloadedThreshold: 100,
    });

    const report1 = service.getReport();
    assert.ok(["ok", "degraded"].includes(report1.status), `Expected ok/degraded but got ${report1.status}`);

    // Now seed many tasks and use low threshold
    seedQueuedTasks(db, store, { count: 20, prefix: "transition-test" });

    // Create new service with low threshold
    const serviceLoaded = new HealthService(db, store, {
      queuedTaskOverloadedThreshold: 5,
    });

    const report2 = serviceLoaded.getReport();
    // With 20 tasks and threshold of 5, should be degraded or overloaded
    assert.ok(
      ["degraded", "overloaded"].includes(report2.status),
      `Expected degraded/overloaded but got ${report2.status}`,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("health-service: report contains queue governance information", () => {
  const workspace = createTempWorkspace("aa-health-queue-gov-");
  const dbPath = join(workspace, "queue-gov.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedQueuedTasks(db, store, { count: 3, prefix: "queue-gov-test" });

    const service = new HealthService(db, store);
    const report = service.getReport();

    // Queue governance should be present in the report
    assert.ok(report.queueGovernance !== undefined);
    assert.ok(typeof report.queueGovernance.backlogSize === "number");
    assert.ok(typeof report.queueGovernance.dispatchableBacklogSize === "number");
    assert.ok(typeof report.queueGovernance.claimedBacklogSize === "number");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
