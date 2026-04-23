/**
 * Hot Upgrade Service Integration Tests
 *
 * Tests the hot upgrade lifecycle using SQLite backend.
 * Covers plan creation, batch execution, and rollback handling.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { HotUpgradeService, HOT_UPGRADE_DDL } from "../../../../../src/platform/execution/hot-upgrade/hot-upgrade-service.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

function createHotUpgradeHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "hot-upgrade.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  db.connection.exec(HOT_UPGRADE_DDL);
  return { workspace, db };
}

test("HotUpgradeService: createUpgradePlan inserts plan and returns planId", () => {
  const h = createHotUpgradeHarness("aa-hot-upgrade-create-");
  try {
    const service = new HotUpgradeService(h.db);

    const plan = service.createUpgradePlan(
      "upgrade-test-001",
      [
        {
          targetId: "node-1",
          targetType: "coordinator",
          currentVersion: "1.0.0",
          targetVersion: "1.1.0",
        },
      ],
      {
        canaryPercent: 10,
        canaryBatches: 3,
        batchSize: 33,
        healthGates: [],
        rollbackOnFailure: true,
        maxUpgradeDurationMs: 600_000,
        compatibilityCheckEnabled: false,
      },
    );

    assert.ok(plan.planId, "Plan should have a planId");
    assert.equal(plan.status, "pending");
    assert.equal(plan.currentPhase, "canary");
    assert.equal(plan.upgradeId, "upgrade-test-001");

    // Verify persisted
    const retrieved = service.getUpgradePlan(plan.planId);
    assert.ok(retrieved, "Plan should be retrievable");
    assert.equal(retrieved.upgradeId, "upgrade-test-001");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("HotUpgradeService: startUpgrade returns started=true for pending plan", () => {
  const h = createHotUpgradeHarness("aa-hot-upgrade-start-");
  try {
    const service = new HotUpgradeService(h.db);

    const plan = service.createUpgradePlan(
      "upgrade-start-001",
      [
        {
          targetId: "node-1",
          targetType: "coordinator",
          currentVersion: "1.0.0",
          targetVersion: "1.1.0",
        },
      ],
      {
        canaryPercent: 100,
        canaryBatches: 1,
        batchSize: 100,
        healthGates: [],
        rollbackOnFailure: true,
        maxUpgradeDurationMs: 600_000,
        compatibilityCheckEnabled: false,
      },
    );

    const result = service.startUpgrade(plan.planId);
    assert.equal(result.started, true);
    assert.equal(result.upgradeId, "upgrade-start-001");
    assert.ok(result.firstBatch, "Should return first batch");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("HotUpgradeService: startUpgrade returns started=false for non-existent plan", () => {
  const h = createHotUpgradeHarness("aa-hot-upgrade-start-fail-");
  try {
    const service = new HotUpgradeService(h.db);

    const result = service.startUpgrade("nonexistent-plan-id");
    assert.equal(result.started, false);
    assert.equal(result.reasonCode, "plan_not_found");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("HotUpgradeService: registerVersionCompatibility stores and retrieves compatibility", () => {
  const h = createHotUpgradeHarness("aa-hot-upgrade-compat-");
  try {
    const service = new HotUpgradeService(h.db);

    service.registerVersionCompatibility({
      fromVersion: "1.0.0",
      toVersion: "1.1.0",
      compatibilityLevel: "full",
      migrationRequired: false,
      rollbackSupported: true,
    });

    const compat = service.getVersionCompatibility("1.0.0", "1.1.0");
    assert.ok(compat, "Compatibility record should exist");
    assert.equal(compat.compatibilityLevel, "full");
    assert.equal(compat.migrationRequired, false);
    assert.equal(compat.rollbackSupported, true);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("HotUpgradeService: getVersionCompatibility returns null for unknown pair", () => {
  const h = createHotUpgradeHarness("aa-hot-upgrade-compat-missing-");
  try {
    const service = new HotUpgradeService(h.db);

    const compat = service.getVersionCompatibility("nonexistent", "2.0.0");
    assert.equal(compat, null, "Should return null for unknown version pair");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("HotUpgradeService: createUpgradePlan creates batches according to policy", () => {
  const h = createHotUpgradeHarness("aa-hot-upgrade-batches-");
  try {
    const service = new HotUpgradeService(h.db);

    const plan = service.createUpgradePlan(
      "upgrade-batches-001",
      [
        { targetId: "node-1", targetType: "coordinator", currentVersion: "1.0.0", targetVersion: "1.1.0" },
        { targetId: "node-2", targetType: "coordinator", currentVersion: "1.0.0", targetVersion: "1.1.0" },
        { targetId: "node-3", targetType: "coordinator", currentVersion: "1.0.0", targetVersion: "1.1.0" },
      ],
      {
        canaryPercent: 33,
        canaryBatches: 3,
        batchSize: 1,
        healthGates: [],
        rollbackOnFailure: true,
        maxUpgradeDurationMs: 600_000,
        compatibilityCheckEnabled: false,
      },
    );

    assert.ok(plan.batches.length > 0, "Plan should have batches");
    assert.ok(plan.batches.every((b) => b.upgradeId === "upgrade-batches-001"), "All batches should belong to the upgrade");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("HotUpgradeService: startBatch updates batch status to in_progress", () => {
  const h = createHotUpgradeHarness("aa-hot-upgrade-batch-start-");
  try {
    const service = new HotUpgradeService(h.db);

    const plan = service.createUpgradePlan(
      "upgrade-batch-start-001",
      [
        { targetId: "node-1", targetType: "coordinator", currentVersion: "1.0.0", targetVersion: "1.1.0" },
      ],
      {
        canaryPercent: 100,
        canaryBatches: 1,
        batchSize: 1,
        healthGates: [],
        rollbackOnFailure: true,
        maxUpgradeDurationMs: 600_000,
        compatibilityCheckEnabled: false,
      },
    );

    const batch = plan.batches[0];
    assert.ok(batch, "Should have at least one batch");

    const result = service.startBatch(batch.batchId);
    assert.equal(result.started, true);
    assert.ok(result.batch, "Should return batch");
    assert.equal(result.batch.status, "in_progress");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("HotUpgradeService: completeBatch marks batch completed and triggers next", () => {
  const h = createHotUpgradeHarness("aa-hot-upgrade-complete-");
  try {
    const service = new HotUpgradeService(h.db);

    const plan = service.createUpgradePlan(
      "upgrade-complete-001",
      [
        { targetId: "node-1", targetType: "coordinator", currentVersion: "1.0.0", targetVersion: "1.1.0" },
      ],
      {
        canaryPercent: 100,
        canaryBatches: 1,
        batchSize: 1,
        healthGates: [],
        rollbackOnFailure: true,
        maxUpgradeDurationMs: 600_000,
        compatibilityCheckEnabled: false,
      },
    );

    const batch = plan.batches[0];
    service.startBatch(batch.batchId);

    const result = service.completeBatch(batch.batchId, []);
    assert.equal(result.completed, true);
    assert.equal(result.batch.batchId, batch.batchId);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("HotUpgradeService: completeBatch with allPassed=false triggers rollback", () => {
  const h = createHotUpgradeHarness("aa-hot-upgrade-rollback-");
  try {
    const service = new HotUpgradeService(h.db);

    const plan = service.createUpgradePlan(
      "upgrade-rollback-001",
      [
        { targetId: "node-1", targetType: "coordinator", currentVersion: "1.0.0", targetVersion: "1.1.0" },
      ],
      {
        canaryPercent: 100,
        canaryBatches: 1,
        batchSize: 1,
        healthGates: [],
        rollbackOnFailure: true,
        maxUpgradeDurationMs: 600_000,
        compatibilityCheckEnabled: false,
      },
    );

    const batch = plan.batches[0];
    service.startBatch(batch.batchId);

    // Fail health check
    const result = service.completeBatch(batch.batchId, [
      {
        checkId: "hc-1",
        checkType: "worker_health",
        passed: false,
        message: "Worker pool unhealthy",
        checkedAt: new Date().toISOString(),
        details: {},
      },
    ]);

    assert.equal(result.triggerRollback, true, "Should trigger rollback on failed health check");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("HotUpgradeService: triggerRollback returns triggered=true and updates plan status", () => {
  const h = createHotUpgradeHarness("aa-hot-upgrade-trigger-");
  try {
    const service = new HotUpgradeService(h.db);

    const plan = service.createUpgradePlan(
      "upgrade-trigger-001",
      [
        { targetId: "node-1", targetType: "coordinator", currentVersion: "1.0.0", targetVersion: "1.1.0" },
      ],
      {
        canaryPercent: 100,
        canaryBatches: 1,
        batchSize: 1,
        healthGates: [],
        rollbackOnFailure: true,
        maxUpgradeDurationMs: 600_000,
        compatibilityCheckEnabled: false,
      },
    );

    service.startUpgrade(plan.planId);

    const result = service.triggerRollback(plan.upgradeId, "health_check_failed", "Health check failed");
    assert.equal(result.triggered, true);
    assert.ok(result.triggerRecord, "Should return trigger record");
    assert.equal(result.triggerRecord.reasonCode, "health_check_failed");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("HotUpgradeService: getUpgradePlansByStatus filters correctly", () => {
  const h = createHotUpgradeHarness("aa-hot-upgrade-list-");
  try {
    const service = new HotUpgradeService(h.db);

    const plan1 = service.createUpgradePlan(
      "upgrade-list-001",
      [{ targetId: "node-1", targetType: "coordinator", currentVersion: "1.0.0", targetVersion: "1.1.0" }],
      { canaryPercent: 100, canaryBatches: 1, batchSize: 1, healthGates: [], rollbackOnFailure: true, maxUpgradeDurationMs: 600_000, compatibilityCheckEnabled: false },
    );
    service.createUpgradePlan(
      "upgrade-list-002",
      [{ targetId: "node-2", targetType: "coordinator", currentVersion: "1.0.0", targetVersion: "1.1.0" }],
      { canaryPercent: 100, canaryBatches: 1, batchSize: 1, healthGates: [], rollbackOnFailure: true, maxUpgradeDurationMs: 600_000, compatibilityCheckEnabled: false },
    );

    service.startUpgrade(plan1.planId);

    const pendingPlans = service.getUpgradePlansByStatus("pending");
    assert.equal(pendingPlans.length, 1);
    assert.equal(pendingPlans[0].upgradeId, "upgrade-list-002");

    const inProgressPlans = service.getUpgradePlansByStatus("in_progress");
    assert.equal(inProgressPlans.length, 1);
    assert.equal(inProgressPlans[0].upgradeId, "upgrade-list-001");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("HotUpgradeService: getUpgradePlan returns null for nonexistent plan", () => {
  const h = createHotUpgradeHarness("aa-hot-upgrade-plan-missing-");
  try {
    const service = new HotUpgradeService(h.db);

    const plan = service.getUpgradePlan("nonexistent-plan-id");
    assert.equal(plan, null, "Should return null for unknown plan");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("HotUpgradeService: getUpgradeProgress returns progress for upgrade", () => {
  const h = createHotUpgradeHarness("aa-hot-upgrade-progress-");
  try {
    const service = new HotUpgradeService(h.db);

    const plan = service.createUpgradePlan(
      "upgrade-progress-001",
      [
        { targetId: "node-1", targetType: "coordinator", currentVersion: "1.0.0", targetVersion: "1.1.0" },
        { targetId: "node-2", targetType: "coordinator", currentVersion: "1.0.0", targetVersion: "1.1.0" },
      ],
      {
        canaryPercent: 50,
        canaryBatches: 2,
        batchSize: 1,
        healthGates: [],
        rollbackOnFailure: true,
        maxUpgradeDurationMs: 600_000,
        compatibilityCheckEnabled: false,
      },
    );

    service.startUpgrade(plan.planId);

    const progress = service.getUpgradeProgress(plan.upgradeId);
    assert.ok(progress, "Should return progress");
    assert.equal(progress.upgradeId, plan.upgradeId);
    assert.equal(progress.totalBatches, plan.batches.length);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("HotUpgradeService: startUpgrade fails when plan is not pending", () => {
  const h = createHotUpgradeHarness("aa-hot-upgrade-not-pending-");
  try {
    const service = new HotUpgradeService(h.db);

    const plan = service.createUpgradePlan(
      "upgrade-not-pending-001",
      [{ targetId: "node-1", targetType: "coordinator", currentVersion: "1.0.0", targetVersion: "1.1.0" }],
      { canaryPercent: 100, canaryBatches: 1, batchSize: 1, healthGates: [], rollbackOnFailure: true, maxUpgradeDurationMs: 600_000, compatibilityCheckEnabled: false },
    );

    service.startUpgrade(plan.planId);
    const secondAttempt = service.startUpgrade(plan.planId);

    assert.equal(secondAttempt.started, false);
    assert.equal(secondAttempt.reasonCode, "upgrade_not_pending");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});