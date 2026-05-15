import assert from "node:assert/strict";
import test from "node:test";

import {
  HotUpgradeService,
  HOT_UPGRADE_DDL,
} from "../../../src/platform/five-plane-execution/hot-upgrade/hot-upgrade-service.js";
import { SqliteDatabase } from "../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../helpers/fs.js";
import { join } from "node:path";

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "hot-upgrade.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  db.connection.exec(HOT_UPGRADE_DDL);
  return { workspace, db };
}

test("registerVersionCompatibility stores compatibility record", () => {
  const h = createHarness("aa-compat-reg-");
  try {
    const service = new HotUpgradeService(h.db);
    service.registerVersionCompatibility({
      fromVersion: "v1.0.0",
      toVersion: "v1.1.0",
      compatibilityLevel: "n_minus_1",
      migrationRequired: false,
      rollbackSupported: true,
    });

    const compat = service.getVersionCompatibility("v1.0.0", "v1.1.0");
    assert.ok(compat);
    assert.equal(compat!.compatibilityLevel, "n_minus_1");
    assert.equal(compat!.rollbackSupported, true);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("getVersionCompatibility returns null for unknown pair", () => {
  const h = createHarness("aa-compat-unknown-");
  try {
    const service = new HotUpgradeService(h.db);
    const compat = service.getVersionCompatibility("unknown", "v1.1.0");
    assert.equal(compat, null);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("isUpgradeSafe returns safe for compatible versions", () => {
  const h = createHarness("aa-upgrade-safe-");
  try {
    const service = new HotUpgradeService(h.db);
    service.registerVersionCompatibility({
      fromVersion: "v1.0.0",
      toVersion: "v1.1.0",
      compatibilityLevel: "full",
      migrationRequired: false,
      rollbackSupported: true,
    });

    const result = service.isUpgradeSafe("v1.0.0", "v1.1.0");
    assert.equal(result.safe, true);
    assert.equal(result.compatibilityLevel, "full");
    assert.equal(result.supportsRollback, true);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("isUpgradeSafe returns unsafe for incompatible versions", () => {
  const h = createHarness("aa-upgrade-unsafe-");
  try {
    const service = new HotUpgradeService(h.db);
    service.registerVersionCompatibility({
      fromVersion: "v1.0.0",
      toVersion: "v2.0.0",
      compatibilityLevel: "incompatible",
      migrationRequired: true,
      rollbackSupported: false,
    });

    const result = service.isUpgradeSafe("v1.0.0", "v2.0.0");
    assert.equal(result.safe, false);
    assert.equal(result.compatibilityLevel, "incompatible");
    assert.equal(result.supportsRollback, false);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("createUpgradePlan creates plan with batches", () => {
  const h = createHarness("aa-plan-create-");
  try {
    const service = new HotUpgradeService(h.db);
    const targets = [
      { targetId: "worker-1", targetType: "worker_pool" as const, currentVersion: "v1.0.0", targetVersion: "v1.1.0" },
      { targetId: "worker-2", targetType: "worker_pool" as const, currentVersion: "v1.0.0", targetVersion: "v1.1.0" },
      { targetId: "worker-3", targetType: "worker_pool" as const, currentVersion: "v1.0.0", targetVersion: "v1.1.0" },
      { targetId: "worker-4", targetType: "worker_pool" as const, currentVersion: "v1.0.0", targetVersion: "v1.1.0" },
    ];

    const plan = service.createUpgradePlan("upgrade-001", targets);

    assert.ok(plan.planId);
    assert.equal(plan.upgradeId, "upgrade-001");
    assert.equal(plan.targets.length, 4);
    assert.ok(plan.batches.length > 0);
    assert.equal(plan.status, "pending");
    assert.equal(plan.currentPhase, "canary");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("getUpgradePlan retrieves plan by id", () => {
  const h = createHarness("aa-plan-get-");
  try {
    const service = new HotUpgradeService(h.db);
    const targets = [
      { targetId: "worker-1", targetType: "worker_pool" as const, currentVersion: "v1.0.0", targetVersion: "v1.1.0" },
    ];

    const created = service.createUpgradePlan("upgrade-002", targets);
    const retrieved = service.getUpgradePlan(created.planId);

    assert.ok(retrieved);
    assert.equal(retrieved!.upgradeId, "upgrade-002");
    assert.equal(retrieved!.targets.length, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("getUpgradePlansByStatus filters by status", () => {
  const h = createHarness("aa-plan-filter-");
  try {
    const service = new HotUpgradeService(h.db);
    service.createUpgradePlan("upgrade-pending", [
      { targetId: "w1", targetType: "worker_pool", currentVersion: "v1", targetVersion: "v2" },
    ]);
    service.createUpgradePlan("upgrade-in-progress", [
      { targetId: "w2", targetType: "worker_pool", currentVersion: "v1", targetVersion: "v2" },
    ]);

    const pendingPlans = service.getUpgradePlansByStatus("pending");
    const inProgressPlans = service.getUpgradePlansByStatus("in_progress");

    assert.ok(pendingPlans.length >= 1);
    assert.equal(inProgressPlans.length, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("startUpgrade transitions plan to in_progress", () => {
  const h = createHarness("aa-start-upgrade-");
  try {
    const service = new HotUpgradeService(h.db);
    const plan = service.createUpgradePlan("upgrade-003", [
      { targetId: "worker-1", targetType: "worker_pool", currentVersion: "v1.0.0", targetVersion: "v1.1.0" },
    ]);

    const result = service.startUpgrade(plan.planId);

    assert.equal(result.started, true);
    assert.ok(result.firstBatch);

    const updatedPlan = service.getUpgradePlan(plan.planId);
    assert.equal(updatedPlan!.status, "in_progress");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("startUpgrade fails for non-pending plan", () => {
  const h = createHarness("aa-start-fail-");
  try {
    const service = new HotUpgradeService(h.db);
    const plan = service.createUpgradePlan("upgrade-004", [
      { targetId: "worker-1", targetType: "worker_pool", currentVersion: "v1.0.0", targetVersion: "v1.1.0" },
    ]);

    service.startUpgrade(plan.planId);
    const result2 = service.startUpgrade(plan.planId);

    assert.equal(result2.started, false);
    assert.equal(result2.reasonCode, "upgrade_not_pending");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("completeBatch marks batch as completed when health checks pass", () => {
  const h = createHarness("aa-complete-batch-");
  try {
    const service = new HotUpgradeService(h.db);
    const plan = service.createUpgradePlan("upgrade-005", [
      { targetId: "worker-1", targetType: "worker_pool", currentVersion: "v1.0.0", targetVersion: "v1.1.0" },
    ]);

    service.startUpgrade(plan.planId);
    const batch = plan.batches[0]!;

    const healthChecks = [
      {
        checkId: "check-1",
        checkType: "worker_health" as const,
        passed: true,
        message: "Worker healthy",
        checkedAt: new Date().toISOString(),
        details: {},
      },
    ];

    const result = service.completeBatch(batch.batchId, healthChecks);

    assert.equal(result.completed, true);
    assert.equal(result.allPassed, true);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("completeBatch triggers rollback when health checks fail", () => {
  const h = createHarness("aa-rollback-batch-");
  try {
    const service = new HotUpgradeService(h.db);
    const plan = service.createUpgradePlan("upgrade-006", [
      { targetId: "worker-1", targetType: "worker_pool", currentVersion: "v1.0.0", targetVersion: "v1.1.0" },
    ], { rollbackOnFailure: true });

    service.startUpgrade(plan.planId);
    const batch = plan.batches[0]!;

    const healthChecks = [
      {
        checkId: "check-1",
        checkType: "worker_health" as const,
        passed: false,
        message: "Worker unhealthy",
        checkedAt: new Date().toISOString(),
        details: {},
      },
    ];

    const result = service.completeBatch(batch.batchId, healthChecks);

    assert.equal(result.allPassed, false);
    assert.equal(result.triggerRollback, true);

    const updatedPlan = service.getUpgradePlan(plan.planId);
    assert.equal(updatedPlan!.status, "failed");
    assert.ok(updatedPlan!.rollbackTriggeredAt);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("triggerRollback records rollback trigger", () => {
  const h = createHarness("aa-trigger-rollback-");
  try {
    const service = new HotUpgradeService(h.db);
    const plan = service.createUpgradePlan("upgrade-007", [
      { targetId: "worker-1", targetType: "worker_pool", currentVersion: "v1.0.0", targetVersion: "v1.1.0" },
    ]);

    service.startUpgrade(plan.planId);

    const result = service.triggerRollback(plan.upgradeId, "manual", "Manual rollback triggered");

    assert.equal(result.triggered, true);
    assert.ok(result.triggerRecord);
    assert.equal(result.triggerRecord!.reasonCode, "manual");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("getUpgradeProgress returns correct progress metrics", () => {
  const h = createHarness("aa-progress-");
  try {
    const service = new HotUpgradeService(h.db);
    const plan = service.createUpgradePlan("upgrade-008", [
      { targetId: "worker-1", targetType: "worker_pool", currentVersion: "v1.0.0", targetVersion: "v1.1.0" },
      { targetId: "worker-2", targetType: "worker_pool", currentVersion: "v1.0.0", targetVersion: "v1.1.0" },
    ]);

    service.startUpgrade(plan.planId);

    const progress = service.getUpgradeProgress(plan.upgradeId);

    assert.ok(progress);
    assert.equal(progress!.upgradeId, plan.upgradeId);
    assert.equal(progress!.status, "in_progress");
    assert.equal(progress!.totalBatches, plan.batches.length);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("recordAudit creates audit entry", () => {
  const h = createHarness("aa-audit-");
  try {
    const service = new HotUpgradeService(h.db);
    const plan = service.createUpgradePlan("upgrade-009", [
      { targetId: "worker-1", targetType: "worker_pool", currentVersion: "v1.0.0", targetVersion: "v1.1.0" },
    ]);

    service.recordAudit(plan.upgradeId, "test_event", "test_actor", "Test message", { key: "value" });

    const auditLog = service.getUpgradeAuditLog(plan.upgradeId);
    assert.ok(auditLog.length > 0);
    assert.equal(auditLog[0]!.eventType, "test_event");
    assert.equal(auditLog[0]!.actor, "test_actor");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("getUpgradeAuditLog returns audit entries", () => {
  const h = createHarness("aa-audit-log-");
  try {
    const service = new HotUpgradeService(h.db);
    const plan = service.createUpgradePlan("upgrade-010", [
      { targetId: "worker-1", targetType: "worker_pool", currentVersion: "v1.0.0", targetVersion: "v1.1.0" },
    ]);

    service.recordAudit(plan.upgradeId, "event_1", "actor_1", "First event", {});
    service.recordAudit(plan.upgradeId, "event_2", "actor_2", "Second event", {});

    const auditLog = service.getUpgradeAuditLog(plan.upgradeId, 10);
    assert.equal(auditLog.length, 2);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("upgrade with no rollbackOnFailure does not trigger rollback", () => {
  const h = createHarness("aa-no-rollback-");
  try {
    const service = new HotUpgradeService(h.db);
    const plan = service.createUpgradePlan("upgrade-011", [
      { targetId: "worker-1", targetType: "worker_pool", currentVersion: "v1.0.0", targetVersion: "v1.1.0" },
    ], { rollbackOnFailure: false });

    service.startUpgrade(plan.planId);
    const batch = plan.batches[0]!;

    const healthChecks = [
      {
        checkId: "check-1",
        checkType: "worker_health" as const,
        passed: false,
        message: "Worker unhealthy",
        checkedAt: new Date().toISOString(),
        details: {},
      },
    ];

    const result = service.completeBatch(batch.batchId, healthChecks);

    assert.equal(result.triggerRollback, false);

    const updatedPlan = service.getUpgradePlan(plan.planId);
    assert.equal(updatedPlan!.status, "failed");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
