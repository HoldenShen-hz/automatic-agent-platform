import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { HaProgramService } from "../../../../src/scale-ecosystem/multi-region/ha-program-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

/**
 * Tests for issue 1913: overallStatus === "coordinator" or "postgres" branch
 * condition is always true - never returns "warning".
 *
 * The bug was that the condition checked if coordinator/postgres exist as
 * components (always true) instead of checking if they are NOT ready.
 *
 * FIX VERIFICATION:
 * - "pass": All components ready
 * - "fail": Critical components (coordinator, postgres) are NOT ready
 * - "warning": Critical components are ready but non-critical (redis_queue, distributed_lock) are NOT ready
 */
test("ISSUE-1913: overallStatus returns 'warning' when only non-critical components are not ready", () => {
  const workspace = createTempWorkspace("aa-ha-program-warning-");
  const dbPath = join(workspace, "ha-warning.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  try {
    const store = new AuthoritativeTaskStore(db);
    const service = new HaProgramService(store);

    // Insert readiness records for critical components only (coordinator and postgres)
    // Redis queue and distributed lock are NOT ready - should result in "warning"
    store.release.insertEnvironmentReadinessRecord({
      environment: "staging",
      componentType: "external_service",
      componentId: "ha_coordinator",
      status: "ready",
      checkedAt: new Date().toISOString(),
    });
    store.release.insertEnvironmentReadinessRecord({
      environment: "staging",
      componentType: "external_service",
      componentId: "postgres_primary",
      status: "ready",
      checkedAt: new Date().toISOString(),
    });
    // Note: NOT inserting redis_queue or distributed_lock records

    const report = service.buildReport({ environment: "staging" });

    // Critical components are ready, non-critical are not ready -> should be "warning"
    assert.equal(report.overallStatus, "warning",
      `Expected "warning" when critical components ready but non-critical not ready, got "${report.overallStatus}"`);

    // Verify critical components show as ready
    const coordinator = report.components.find(c => c.componentId === "coordinator");
    const postgres = report.components.find(c => c.componentId === "postgres");
    assert.ok(coordinator?.ready, "Coordinator should be ready");
    assert.ok(postgres?.ready, "Postgres should be ready");

    // Verify non-critical components show as NOT ready
    const redisQueue = report.components.find(c => c.componentId === "redis_queue");
    const distributedLock = report.components.find(c => c.componentId === "distributed_lock");
    assert.ok(!redisQueue?.ready, "Redis queue should NOT be ready");
    assert.ok(!distributedLock?.ready, "Distributed lock should NOT be ready");
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("ISSUE-1913: overallStatus returns 'fail' when critical component (coordinator) is not ready", () => {
  const workspace = createTempWorkspace("aa-ha-program-fail-");
  const dbPath = join(workspace, "ha-fail.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  try {
    const store = new AuthoritativeTaskStore(db);
    const service = new HaProgramService(store);

    // Only postgres is ready - coordinator is NOT ready -> should be "fail"
    store.release.insertEnvironmentReadinessRecord({
      environment: "staging",
      componentType: "external_service",
      componentId: "postgres_primary",
      status: "ready",
      checkedAt: new Date().toISOString(),
    });
    // Note: NOT inserting ha_coordinator record

    const report = service.buildReport({ environment: "staging" });

    // Coordinator not ready -> should be "fail"
    assert.equal(report.overallStatus, "fail",
      `Expected "fail" when coordinator is not ready, got "${report.overallStatus}"`);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("ISSUE-1913: overallStatus returns 'fail' when critical component (postgres) is not ready", () => {
  const workspace = createTempWorkspace("aa-ha-program-fail-pg-");
  const dbPath = join(workspace, "ha-fail-pg.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  try {
    const store = new AuthoritativeTaskStore(db);
    const service = new HaProgramService(store);

    // Only coordinator is ready - postgres is NOT ready -> should be "fail"
    store.release.insertEnvironmentReadinessRecord({
      environment: "staging",
      componentType: "external_service",
      componentId: "ha_coordinator",
      status: "ready",
      checkedAt: new Date().toISOString(),
    });
    // Note: NOT inserting postgres_primary record

    const report = service.buildReport({ environment: "staging" });

    // Postgres not ready -> should be "fail"
    assert.equal(report.overallStatus, "fail",
      `Expected "fail" when postgres is not ready, got "${report.overallStatus}"`);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("ISSUE-1913: overallStatus returns 'pass' when all components are ready", () => {
  const workspace = createTempWorkspace("aa-ha-program-pass-");
  const dbPath = join(workspace, "ha-pass.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  try {
    const store = new AuthoritativeTaskStore(db);
    const service = new HaProgramService(store);

    // All components are ready
    store.release.insertEnvironmentReadinessRecord({
      environment: "staging",
      componentType: "external_service",
      componentId: "ha_coordinator",
      status: "ready",
      checkedAt: new Date().toISOString(),
    });
    store.release.insertEnvironmentReadinessRecord({
      environment: "staging",
      componentType: "external_service",
      componentId: "postgres_primary",
      status: "ready",
      checkedAt: new Date().toISOString(),
    });
    store.release.insertEnvironmentReadinessRecord({
      environment: "staging",
      componentType: "external_service",
      componentId: "redis_queue",
      status: "ready",
      checkedAt: new Date().toISOString(),
    });
    store.release.insertEnvironmentReadinessRecord({
      environment: "staging",
      componentType: "external_service",
      componentId: "distributed_lock",
      status: "ready",
      checkedAt: new Date().toISOString(),
    });

    const report = service.buildReport({ environment: "staging" });

    // All components ready -> should be "pass"
    assert.equal(report.overallStatus, "pass",
      `Expected "pass" when all components are ready, got "${report.overallStatus}"`);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("HaProgramService in multi-region exports correct interfaces", () => {
  const workspace = createTempWorkspace("aa-ha-program-interfaces-");
  const dbPath = join(workspace, "ha-interfaces.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  try {
    const store = new AuthoritativeTaskStore(db);
    const service = new HaProgramService(store);
    const report = service.buildReport({ environment: "dev" });

    // Verify report structure
    assert.ok(typeof report.reportId === "string");
    assert.ok(typeof report.generatedAt === "string");
    assert.ok(typeof report.environment === "string");
    assert.ok(report.overallStatus === "pass" || report.overallStatus === "fail" || report.overallStatus === "warning");
    assert.ok(typeof report.activeWorkerCount === "number");
    assert.ok(typeof report.activeLeaseCount === "number");
    assert.ok(Array.isArray(report.components));
    assert.ok(report.components.length === 4);

    // Verify component structure
    for (const component of report.components) {
      assert.ok(["coordinator", "postgres", "redis_queue", "distributed_lock"].includes(component.componentId));
      assert.ok(typeof component.currentMode === "string");
      assert.ok(typeof component.targetMode === "string");
      assert.ok(typeof component.ready === "boolean");
      assert.ok(Array.isArray(component.blockers));
    }

    // Verify rollout phases
    assert.ok(Array.isArray(report.rolloutPhases));
    assert.ok(report.rolloutPhases.length === 3);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});