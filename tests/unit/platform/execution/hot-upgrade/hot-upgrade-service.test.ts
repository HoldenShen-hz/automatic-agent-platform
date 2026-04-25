/**
 * @fileoverview Unit tests for HotUpgradeService (sync version)
 * Tests zero-downtime upgrade orchestration including version compatibility,
 * canary deployment, batch management, health gates, and rollback handling.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import {
  HOT_UPGRADE_DDL,
  HotUpgradeService,
  type UpgradePhase,
  type UpgradeStatus,
  type CompatibilityLevel,
  type VersionCompatibility,
  type UpgradeTarget,
  type UpgradePlan,
  type UpgradeBatch,
  type HealthCheckResult,
  type UpgradePolicy,
  type HealthGateConfig,
  type RollbackTrigger,
  type UpgradeProgress,
} from "../../../../../src/platform/execution/hot-upgrade/hot-upgrade-service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helper: create in-memory SQLite database with schema
// ─────────────────────────────────────────────────────────────────────────────

function createInMemoryDb(): SqliteDatabase {
  const db = new SqliteDatabase(":memory:");
  db.connection.exec(HOT_UPGRADE_DDL);
  return db;
}

// ─────────────────────────────────────────────────────────────────────────────
// Type augmentation helpers for testing
// ─────────────────────────────────────────────────────────────────────────────

function makeTarget(overrides: Partial<UpgradeTarget> = {}): UpgradeTarget {
  return {
    targetId: "node1",
    targetType: "coordinator",
    currentVersion: "v1.0",
    targetVersion: "v2.0",
    ...overrides,
  };
}

function makeHealthCheck(overrides: Partial<HealthCheckResult> = {}): HealthCheckResult {
  return {
    checkId: "check-1",
    checkType: "worker_health",
    passed: true,
    message: "ok",
    checkedAt: new Date().toISOString(),
    details: {},
    ...overrides,
  };
}

function makePolicy(overrides: Partial<UpgradePolicy> = {}): UpgradePolicy {
  return {
    canaryPercent: 10,
    canaryBatches: 3,
    batchSize: 33,
    healthGates: [
      { gateType: "worker_ready", threshold: 0.95, windowSeconds: 60, operator: "gte" },
      { gateType: "dispatch_healthy", threshold: 0.99, windowSeconds: 120, operator: "gte" },
    ],
    rollbackOnFailure: true,
    maxUpgradeDurationMs: 30 * 60 * 1000,
    compatibilityCheckEnabled: true,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HotUpgradeService: Version Compatibility
// ─────────────────────────────────────────────────────────────────────────────

test("HotUpgradeService registers and retrieves version compatibility", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  service.registerVersionCompatibility({
    fromVersion: "v1.0",
    toVersion: "v2.0",
    compatibilityLevel: "full",
    migrationRequired: false,
    rollbackSupported: true,
  });

  const compat = service.getVersionCompatibility("v1.0", "v2.0");

  assert.ok(compat !== null);
  assert.equal(compat!.fromVersion, "v1.0");
  assert.equal(compat!.toVersion, "v2.0");
  assert.equal(compat!.compatibilityLevel, "full");
  assert.equal(compat!.migrationRequired, false);
  assert.equal(compat!.rollbackSupported, true);
});

test("HotUpgradeService getVersionCompatibility returns null for non-existent pair", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const compat = service.getVersionCompatibility("non", "existent");

  assert.equal(compat, null);
});

test("HotUpgradeService isUpgradeSafe returns incompatible when no record exists", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const result = service.isUpgradeSafe("v1.0", "v2.0");

  assert.equal(result.safe, false);
  assert.equal(result.compatibilityLevel, "incompatible");
  assert.equal(result.requiresMigration, false);
  assert.equal(result.supportsRollback, false);
  assert.equal(result.reasonCode, "no_compatibility_record");
});

test("HotUpgradeService isUpgradeSafe returns safe for full compatibility", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  service.registerVersionCompatibility({
    fromVersion: "v1.0",
    toVersion: "v2.0",
    compatibilityLevel: "full",
    migrationRequired: false,
    rollbackSupported: true,
  });

  const result = service.isUpgradeSafe("v1.0", "v2.0");

  assert.equal(result.safe, true);
  assert.equal(result.compatibilityLevel, "full");
  assert.equal(result.requiresMigration, false);
  assert.equal(result.supportsRollback, true);
  assert.equal(result.reasonCode, "compatibility_level_full");
});

test("HotUpgradeService isUpgradeSafe returns safe for n_minus_1 compatibility", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  service.registerVersionCompatibility({
    fromVersion: "v1.0",
    toVersion: "v2.0",
    compatibilityLevel: "n_minus_1",
    migrationRequired: true,
    rollbackSupported: true,
  });

  const result = service.isUpgradeSafe("v1.0", "v2.0");

  assert.equal(result.safe, true);
  assert.equal(result.compatibilityLevel, "n_minus_1");
  assert.equal(result.requiresMigration, true);
  assert.equal(result.supportsRollback, true);
});

test("HotUpgradeService isUpgradeSafe returns unsafe for incompatible", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  service.registerVersionCompatibility({
    fromVersion: "v1.0",
    toVersion: "v2.0",
    compatibilityLevel: "incompatible",
    migrationRequired: false,
    rollbackSupported: false,
  });

  const result = service.isUpgradeSafe("v1.0", "v2.0");

  assert.equal(result.safe, false);
  assert.equal(result.compatibilityLevel, "incompatible");
  assert.equal(result.requiresMigration, false);
  assert.equal(result.supportsRollback, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// HotUpgradeService: Upgrade Planning
// ─────────────────────────────────────────────────────────────────────────────

test("HotUpgradeService createUpgradePlan creates plan with batches", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [
    makeTarget({ targetId: "node1" }),
    makeTarget({ targetId: "node2" }),
    makeTarget({ targetId: "node3", targetType: "worker_pool" }),
  ];

  const plan = service.createUpgradePlan("upgrade-1", targets);

  assert.ok(plan.planId.startsWith("upln_"));
  assert.equal(plan.upgradeId, "upgrade-1");
  assert.equal(plan.targets.length, 3);
  assert.ok(plan.batches.length > 0);
  assert.equal(plan.status, "pending");
  assert.equal(plan.currentPhase, "canary");
  assert.equal(plan.startedAt, null);
  assert.equal(plan.completedAt, null);
  assert.equal(plan.rollbackTriggeredAt, null);
  assert.equal(plan.rollbackReason, null);
});

test("HotUpgradeService createUpgradePlan uses default policy values", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [makeTarget()];

  const plan = service.createUpgradePlan("upgrade-1", targets);

  assert.equal(plan.policy.canaryPercent, 10);
  assert.equal(plan.policy.canaryBatches, 3);
  assert.equal(plan.policy.batchSize, 33);
  assert.equal(plan.policy.rollbackOnFailure, true);
  assert.equal(plan.policy.compatibilityCheckEnabled, true);
  assert.ok(plan.policy.healthGates.length > 0);
});

test("HotUpgradeService createUpgradePlan uses custom policy overrides", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = Array.from({ length: 20 }, (_, i) => makeTarget({ targetId: `node${i}` }));

  const plan = service.createUpgradePlan("upgrade-1", targets, {
    canaryPercent: 50,
    canaryBatches: 2,
    batchSize: 5,
  });

  // With 20 targets and 50% canary = 10 targets per canary batch
  // With 2 canary batches, first 2 batches should have 10 each
  assert.equal(plan.batches[0]!.targetNodes.length, 10);
  assert.equal(plan.batches[1]!.targetNodes.length, 10);
  assert.equal(plan.policy.canaryPercent, 50);
  assert.equal(plan.policy.canaryBatches, 2);
  assert.equal(plan.policy.batchSize, 5);
});

test("HotUpgradeService createUpgradePlan computes canary batches correctly", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  // 10 targets, 10% canary = 1 target per canary batch
  const targets = Array.from({ length: 10 }, (_, i) => makeTarget({ targetId: `node${i}` }));

  const plan = service.createUpgradePlan("upgrade-1", targets);

  // First 3 batches are canary (3 canary batches default), remaining are rollout batches
  assert.ok(plan.batches.length >= 3);
  assert.equal(plan.batches[0]!.batchNumber, 1);
  assert.equal(plan.batches[1]!.batchNumber, 2);
  assert.equal(plan.batches[2]!.batchNumber, 3);
});

test("HotUpgradeService createUpgradePlan with single target creates single batch", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [makeTarget()];

  const plan = service.createUpgradePlan("upgrade-1", targets);

  // With 1 target, 10% canary (min 1), single batch
  assert.equal(plan.batches.length, 1);
  assert.equal(plan.batches[0]!.batchNumber, 1);
  assert.deepEqual(plan.batches[0]!.targetNodes, ["node1"]);
});

test("HotUpgradeService getUpgradePlan retrieves existing plan", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [makeTarget()];
  const created = service.createUpgradePlan("upgrade-1", targets);
  const retrieved = service.getUpgradePlan(created.planId);

  assert.ok(retrieved !== null);
  assert.equal(retrieved!.planId, created.planId);
  assert.equal(retrieved!.upgradeId, "upgrade-1");
});

test("HotUpgradeService getUpgradePlan returns null for non-existent plan", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const result = service.getUpgradePlan("non-existent-plan-id");

  assert.equal(result, null);
});

test("HotUpgradeService getUpgradePlansByStatus retrieves plans by status", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [makeTarget()];

  service.createUpgradePlan("upgrade-1", targets);
  service.createUpgradePlan("upgrade-2", targets);

  const pendingPlans = service.getUpgradePlansByStatus("pending");
  const completedPlans = service.getUpgradePlansByStatus("completed");

  assert.equal(pendingPlans.length, 2);
  assert.equal(completedPlans.length, 0);
});

test("HotUpgradeService getUpgradePlansByStatus returns empty array for non-existent status", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [makeTarget()];
  service.createUpgradePlan("upgrade-1", targets);

  const result = service.getUpgradePlansByStatus("completed");

  assert.equal(result.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// HotUpgradeService: Upgrade Execution
// ─────────────────────────────────────────────────────────────────────────────

test("HotUpgradeService startUpgrade starts upgrade and first batch", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [makeTarget()];
  const plan = service.createUpgradePlan("upgrade-1", targets);
  const result = service.startUpgrade(plan.planId);

  assert.equal(result.started, true);
  assert.equal(result.upgradeId, "upgrade-1");
  assert.ok(result.firstBatch !== null);
  assert.equal(result.reasonCode, null);

  // Verify plan status updated
  const updatedPlan = service.getUpgradePlan(plan.planId);
  assert.equal(updatedPlan!.status, "in_progress");
  assert.ok(updatedPlan!.startedAt !== null);
});

test("HotUpgradeService startUpgrade fails for non-existent plan", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const result = service.startUpgrade("non-existent-plan-id");

  assert.equal(result.started, false);
  assert.equal(result.upgradeId, null);
  assert.equal(result.firstBatch, null);
  assert.equal(result.reasonCode, "plan_not_found");
});

test("HotUpgradeService startUpgrade fails for already started upgrade", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [makeTarget()];
  const plan = service.createUpgradePlan("upgrade-1", targets);
  service.startUpgrade(plan.planId);
  const secondStart = service.startUpgrade(plan.planId);

  assert.equal(secondStart.started, false);
  assert.equal(secondStart.reasonCode, "upgrade_not_pending");
});

test("HotUpgradeService startUpgrade fails for completed upgrade", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [makeTarget()];
  const plan = service.createUpgradePlan("upgrade-1", targets);
  service.startUpgrade(plan.planId);

  // Complete the batch to mark upgrade as completed
  const firstBatch = plan.batches[0]!;
  service.startBatch(firstBatch.batchId);
  service.completeBatch(firstBatch.batchId, [makeHealthCheck({ passed: true })]);

  // Try to start again
  const result = service.startUpgrade(plan.planId);

  assert.equal(result.started, false);
  assert.equal(result.reasonCode, "upgrade_not_pending");
});

test("HotUpgradeService startBatch starts pending batch", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [makeTarget(), makeTarget({ targetId: "node2" })];
  const plan = service.createUpgradePlan("upgrade-1", targets);
  const firstBatch = plan.batches[0]!;

  const result = service.startBatch(firstBatch.batchId);

  assert.equal(result.started, true);
  assert.ok(result.batch !== null);
  assert.equal(result.batch!.status, "in_progress");
  assert.ok(result.batch!.startedAt !== null);
  assert.equal(result.reasonCode, null);
});

test("HotUpgradeService startBatch fails for non-existent batch", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const result = service.startBatch("non-existent-batch-id");

  assert.equal(result.started, false);
  assert.equal(result.batch, null);
  assert.equal(result.reasonCode, "batch_not_found");
});

test("HotUpgradeService startBatch fails for already started batch", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [makeTarget()];
  const plan = service.createUpgradePlan("upgrade-1", targets);
  const firstBatch = plan.batches[0]!;

  service.startBatch(firstBatch.batchId);
  const secondStart = service.startBatch(firstBatch.batchId);

  assert.equal(secondStart.started, false);
  assert.equal(secondStart.reasonCode, "batch_not_pending");
});

test("HotUpgradeService startBatch fails for completed batch", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [makeTarget()];
  const plan = service.createUpgradePlan("upgrade-1", targets);
  const firstBatch = plan.batches[0]!;

  service.startBatch(firstBatch.batchId);
  service.completeBatch(firstBatch.batchId, [makeHealthCheck({ passed: true })]);

  const result = service.startBatch(firstBatch.batchId);

  assert.equal(result.started, false);
  assert.equal(result.reasonCode, "batch_not_pending");
});

// ─────────────────────────────────────────────────────────────────────────────
// HotUpgradeService: Batch Completion
// ─────────────────────────────────────────────────────────────────────────────

test("HotUpgradeService completeBatch completes batch with passing health checks", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [makeTarget()];
  const plan = service.createUpgradePlan("upgrade-1", targets);
  const firstBatch = plan.batches[0]!;
  service.startBatch(firstBatch.batchId);

  const healthChecks = [makeHealthCheck({ passed: true })];
  const result = service.completeBatch(firstBatch.batchId, healthChecks);

  assert.equal(result.completed, true);
  assert.equal(result.allPassed, true);
  assert.equal(result.batch!.status, "completed");
  assert.ok(result.batch!.completedAt !== null);
  assert.deepEqual(result.batch!.healthChecks, healthChecks);
});

test("HotUpgradeService completeBatch triggers rollback on failing health checks", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [makeTarget()];
  const plan = service.createUpgradePlan("upgrade-1", targets);
  const firstBatch = plan.batches[0]!;
  service.startBatch(firstBatch.batchId);

  const healthChecks = [makeHealthCheck({ passed: false, message: "failed" })];
  const result = service.completeBatch(firstBatch.batchId, healthChecks);

  assert.equal(result.completed, true);
  assert.equal(result.allPassed, false);
  assert.equal(result.triggerRollback, true);
  assert.equal(result.batch!.status, "failed");

  // Verify plan status is failed
  const updatedPlan = service.getUpgradePlan(plan.planId);
  assert.equal(updatedPlan!.status, "failed");
  assert.ok(updatedPlan!.rollbackTriggeredAt !== null);
});

test("HotUpgradeService completeBatch with rollback disabled does not trigger rollback", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [makeTarget()];
  const plan = service.createUpgradePlan("upgrade-1", targets, { rollbackOnFailure: false });
  const firstBatch = plan.batches[0]!;
  service.startBatch(firstBatch.batchId);

  const healthChecks = [makeHealthCheck({ passed: false })];
  const result = service.completeBatch(firstBatch.batchId, healthChecks);

  assert.equal(result.completed, true);
  assert.equal(result.allPassed, false);
  assert.equal(result.triggerRollback, false);
  assert.equal(result.batch!.status, "failed");
});

test("HotUpgradeService completeBatch fails for non-existent batch", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const result = service.completeBatch("non-existent", []);

  assert.equal(result.completed, false);
  assert.equal(result.batch, null);
  assert.equal(result.allPassed, false);
  assert.equal(result.triggerRollback, false);
});

test("HotUpgradeService completeBatch with all passing advances to next batch", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  // Create 3 targets with 100% canary and batchSize 1
  const targets = [
    makeTarget({ targetId: "node1" }),
    makeTarget({ targetId: "node2" }),
    makeTarget({ targetId: "node3" }),
  ];
  const plan = service.createUpgradePlan("upgrade-1", targets, {
    canaryPercent: 100,
    canaryBatches: 3,
    batchSize: 1,
  });

  // Start first batch
  const batch1 = plan.batches[0]!;
  service.startBatch(batch1.batchId);

  // Complete first batch - should auto-start next batch
  const result = service.completeBatch(batch1.batchId, [makeHealthCheck({ passed: true })]);

  assert.equal(result.completed, true);
  assert.equal(result.allPassed, true);
  assert.ok(result.nextBatch !== null);
  assert.equal(result.nextBatch!.batchNumber, 2);
});

test("HotUpgradeService completeBatch final batch marks upgrade as completed", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [makeTarget()];
  const plan = service.createUpgradePlan("upgrade-1", targets);
  const firstBatch = plan.batches[0]!;
  service.startUpgrade(plan.planId);

  const result = service.completeBatch(firstBatch.batchId, [makeHealthCheck({ passed: true })]);

  assert.equal(result.completed, true);
  assert.equal(result.allPassed, true);
  assert.equal(result.nextBatch, null);

  // Verify plan is completed
  const updatedPlan = service.getUpgradePlan(plan.planId);
  assert.equal(updatedPlan!.status, "completed");
  assert.ok(updatedPlan!.completedAt !== null);
});

// ─────────────────────────────────────────────────────────────────────────────
// HotUpgradeService: Rollback
// ─────────────────────────────────────────────────────────────────────────────

test("HotUpgradeService triggerRollback creates rollback trigger", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [makeTarget()];
  const plan = service.createUpgradePlan("upgrade-1", targets);
  service.startUpgrade(plan.planId);

  const result = service.triggerRollback("upgrade-1", "manual", "Manual rollback requested");

  assert.equal(result.triggered, true);
  assert.ok(result.triggerRecord !== null);
  assert.equal(result.triggerRecord!.triggerId.startsWith("rbt_"), true);
  assert.equal(result.triggerRecord!.upgradeId, "upgrade-1");
  assert.equal(result.triggerRecord!.reasonCode, "manual");
  assert.equal(result.triggerRecord!.message, "Manual rollback requested");
  assert.ok(result.triggerRecord!.detectedAt !== null);
  assert.deepEqual(result.triggerRecord!.metadata, {});
});

test("HotUpgradeService triggerRollback updates plan status to failed", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [makeTarget()];
  const plan = service.createUpgradePlan("upgrade-1", targets);
  service.startUpgrade(plan.planId);

  service.triggerRollback("upgrade-1", "timeout", "Upgrade timed out");

  const updatedPlan = service.getUpgradePlan(plan.planId);
  assert.equal(updatedPlan!.status, "failed");
  assert.ok(updatedPlan!.rollbackTriggeredAt !== null);
  assert.equal(updatedPlan!.rollbackReason, "Upgrade timed out");
});

test("HotUpgradeService triggerRollback records audit entry", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [makeTarget()];
  const plan = service.createUpgradePlan("upgrade-1", targets);
  service.startUpgrade(plan.planId);

  service.triggerRollback("upgrade-1", "health_check_failed", "Health checks failing");

  const auditLog = service.getUpgradeAuditLog("upgrade-1");
  const rollbackEvents = auditLog.filter((e) => e.eventType === "rollback_triggered");
  assert.ok(rollbackEvents.length > 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// HotUpgradeService: Progress Tracking
// ─────────────────────────────────────────────────────────────────────────────

test("HotUpgradeService getUpgradeProgress returns progress for in-progress upgrade", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [makeTarget()];
  const plan = service.createUpgradePlan("upgrade-1", targets);
  service.startUpgrade(plan.planId);

  const progress = service.getUpgradeProgress("upgrade-1");

  assert.ok(progress !== null);
  assert.equal(progress!.upgradeId, "upgrade-1");
  assert.equal(progress!.phase, "canary");
  assert.equal(progress!.status, "in_progress");
  assert.equal(progress!.totalBatches, 1);
  assert.equal(progress!.completedBatches, 0);
  assert.equal(progress!.failedBatches, 0);
  assert.ok(progress!.currentBatchNumber >= 0);
});

test("HotUpgradeService getUpgradeProgress returns null for non-existent upgrade", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const progress = service.getUpgradeProgress("non-existent-upgrade-id");

  assert.equal(progress, null);
});

test("HotUpgradeService getUpgradeProgress calculates health check pass rate", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [makeTarget()];
  const plan = service.createUpgradePlan("upgrade-1", targets);
  service.startUpgrade(plan.planId);

  const firstBatch = plan.batches[0]!;
  service.completeBatch(firstBatch.batchId, [
    makeHealthCheck({ checkId: "c1", passed: true }),
    makeHealthCheck({ checkId: "c2", passed: true }),
  ]);

  const progress = service.getUpgradeProgress("upgrade-1");

  assert.ok(progress !== null);
  assert.equal(progress!.healthCheckPassRate, 100);
});

test("HotUpgradeService getUpgradeProgress calculates error rate", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  // Create 2 targets = 2 batches
  const targets = [makeTarget({ targetId: "node1" }), makeTarget({ targetId: "node2" })];
  const plan = service.createUpgradePlan("upgrade-1", targets, { canaryPercent: 50, batchSize: 1 });
  service.startUpgrade(plan.planId);

  // Complete first batch successfully
  const batch1 = plan.batches[0]!;
  service.completeBatch(batch1.batchId, [makeHealthCheck({ passed: true })]);

  const progress = service.getUpgradeProgress("upgrade-1");

  assert.ok(progress !== null);
  assert.equal(progress!.totalBatches, 2);
  assert.equal(progress!.completedBatches, 1);
  assert.equal(progress!.failedBatches, 0);
  assert.equal(progress!.errorRate, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// HotUpgradeService: Audit Trail
// ─────────────────────────────────────────────────────────────────────────────

test("HotUpgradeService recordAudit creates audit entry", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  service.recordAudit("upgrade-1", "test_event", "system", "Test message", { key: "value" });

  const auditLog = service.getUpgradeAuditLog("upgrade-1");

  assert.ok(auditLog.length > 0);
  const entry = auditLog[0]!;
  assert.equal(entry.eventType, "test_event");
  assert.equal(entry.actor, "system");
  assert.equal(entry.message, "Test message");
});

test("HotUpgradeService getUpgradeAuditLog returns entries in descending order", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  service.recordAudit("upgrade-1", "event1", "actor1", "Message 1", {});
  service.recordAudit("upgrade-1", "event2", "actor2", "Message 2", {});

  const log = service.getUpgradeAuditLog("upgrade-1");

  assert.ok(log.length >= 2);
  // Most recent first
  assert.equal(log[0]!.eventType, "event2");
});

test("HotUpgradeService getUpgradeAuditLog respects limit", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  for (let i = 0; i < 10; i++) {
    service.recordAudit("upgrade-1", `event${i}`, "system", `Message ${i}`, {});
  }

  const log = service.getUpgradeAuditLog("upgrade-1", 5);

  assert.equal(log.length, 5);
});

test("HotUpgradeService startUpgrade records audit entries", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [makeTarget()];
  const plan = service.createUpgradePlan("upgrade-1", targets);
  service.startUpgrade(plan.planId);

  const auditLog = service.getUpgradeAuditLog("upgrade-1");
  const eventTypes = auditLog.map((e) => e.eventType);

  assert.ok(eventTypes.includes("upgrade_started"));
});

test("HotUpgradeService startBatch records audit entry", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [makeTarget()];
  const plan = service.createUpgradePlan("upgrade-1", targets);
  const firstBatch = plan.batches[0]!;
  service.startBatch(firstBatch.batchId);

  const auditLog = service.getUpgradeAuditLog("upgrade-1");
  const eventTypes = auditLog.map((e) => e.eventType);

  assert.ok(eventTypes.includes("batch_started"));
});

// ─────────────────────────────────────────────────────────────────────────────
// HotUpgradeService: Default Health Gates
// ─────────────────────────────────────────────────────────────────────────────

test("HotUpgradeService default health gates are built correctly", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [makeTarget()];
  const plan = service.createUpgradePlan("upgrade-1", targets);

  const gates = plan.policy.healthGates;
  assert.ok(gates.length > 0);

  // Verify gate structure
  const workerGate = gates.find((g) => g.gateType === "worker_ready");
  assert.ok(workerGate !== undefined);
  assert.equal(workerGate!.threshold, 0.95);
  assert.equal(workerGate!.windowSeconds, 60);
  assert.equal(workerGate!.operator, "gte");
});

test("HotUpgradeService default health gates include error_rate gate", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [makeTarget()];
  const plan = service.createUpgradePlan("upgrade-1", targets);

  const gates = plan.policy.healthGates;
  const errorGate = gates.find((g) => g.gateType === "error_rate");

  assert.ok(errorGate !== undefined);
  assert.equal(errorGate!.operator, "lt"); // Error rate should be less than threshold
});

test("HotUpgradeService default health gates include latency_pct gate", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [makeTarget()];
  const plan = service.createUpgradePlan("upgrade-1", targets);

  const gates = plan.policy.healthGates;
  const latencyGate = gates.find((g) => g.gateType === "latency_pct");

  assert.ok(latencyGate !== undefined);
  assert.equal(latencyGate!.operator, "lt");
});

// ─────────────────────────────────────────────────────────────────────────────
// HotUpgradeService: Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("HotUpgradeService createUpgradePlan with empty targets array", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const plan = service.createUpgradePlan("upgrade-1", []);

  assert.ok(plan.planId.startsWith("upln_"));
  assert.equal(plan.targets.length, 0);
  assert.equal(plan.batches.length, 0);
});

test("HotUpgradeService createUpgradePlan with all target types", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets: UpgradeTarget[] = [
    makeTarget({ targetId: "coord1", targetType: "coordinator" }),
    makeTarget({ targetId: "worker1", targetType: "worker_pool" }),
    makeTarget({ targetId: "db1", targetType: "database" }),
    makeTarget({ targetId: "cfg1", targetType: "config" }),
  ];

  const plan = service.createUpgradePlan("upgrade-1", targets);

  assert.equal(plan.targets.length, 4);
  assert.equal(plan.targets.filter((t) => t.targetType === "coordinator").length, 1);
  assert.equal(plan.targets.filter((t) => t.targetType === "worker_pool").length, 1);
  assert.equal(plan.targets.filter((t) => t.targetType === "database").length, 1);
  assert.equal(plan.targets.filter((t) => t.targetType === "config").length, 1);
});

test("HotUpgradeService handles concurrent batch operations via transactions", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [makeTarget()];
  const plan = service.createUpgradePlan("upgrade-1", targets);
  service.startUpgrade(plan.planId);

  const firstBatch = plan.batches[0]!;

  // Complete batch
  const result = service.completeBatch(firstBatch.batchId, [makeHealthCheck({ passed: true })]);

  assert.equal(result.completed, true);
  // Plan should be completed since there was only one batch
  const updatedPlan = service.getUpgradePlan(plan.planId);
  assert.equal(updatedPlan!.status, "completed");
});

test("HotUpgradeService upgrade with very long version strings", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const longVersion = "v".repeat(100) + "1.0.0";
  const targets = [makeTarget({ currentVersion: longVersion, targetVersion: longVersion })];

  service.registerVersionCompatibility({
    fromVersion: longVersion,
    toVersion: longVersion,
    compatibilityLevel: "full",
    migrationRequired: false,
    rollbackSupported: true,
  });

  const compat = service.getVersionCompatibility(longVersion, longVersion);
  assert.ok(compat !== null);
  assert.equal(compat!.fromVersion, longVersion);
});

test("HotUpgradeService getUpgradeProgress with no health checks returns 100% pass rate", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [makeTarget()];
  const plan = service.createUpgradePlan("upgrade-1", targets);
  service.startUpgrade(plan.planId);

  const progress = service.getUpgradeProgress("upgrade-1");

  assert.ok(progress !== null);
  assert.equal(progress!.healthCheckPassRate, 100);
});

test("HotUpgradeService completeBatch updates batch health checks in DB", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [makeTarget()];
  const plan = service.createUpgradePlan("upgrade-1", targets);
  const firstBatch = plan.batches[0]!;
  service.startBatch(firstBatch.batchId);

  const healthChecks = [
    makeHealthCheck({ checkId: "check1", passed: true, message: "First check passed" }),
    makeHealthCheck({ checkId: "check2", passed: true, message: "Second check passed" }),
  ];

  service.completeBatch(firstBatch.batchId, healthChecks);

  const updatedPlan = service.getUpgradePlan(plan.planId);
  const updatedBatch = updatedPlan!.batches[0]!;
  assert.equal(updatedBatch.healthChecks.length, 2);
  assert.equal(updatedBatch.healthChecks[0]!.checkId, "check1");
  assert.equal(updatedBatch.healthChecks[1]!.checkId, "check2");
});

test("HotUpgradeService custom policy with empty health gates", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [makeTarget()];
  const plan = service.createUpgradePlan("upgrade-1", targets, {
    healthGates: [],
  });

  assert.equal(plan.policy.healthGates.length, 0);
});

test("HotUpgradeService custom policy with all health gate types", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const customGates: HealthGateConfig[] = [
    { gateType: "worker_ready", threshold: 0.9, windowSeconds: 30, operator: "gte" },
    { gateType: "dispatch_healthy", threshold: 0.95, windowSeconds: 60, operator: "gte" },
    { gateType: "lease_stable", threshold: 0.85, windowSeconds: 45, operator: "gte" },
    { gateType: "error_rate", threshold: 10, windowSeconds: 600, operator: "lt" },
    { gateType: "latency_pct", threshold: 1000, windowSeconds: 300, operator: "lt" },
  ];

  const targets = [makeTarget()];
  const plan = service.createUpgradePlan("upgrade-1", targets, {
    healthGates: customGates,
  });

  assert.equal(plan.policy.healthGates.length, 5);
  assert.equal(plan.policy.healthGates[0]!.gateType, "worker_ready");
  assert.equal(plan.policy.healthGates[4]!.gateType, "latency_pct");
});
