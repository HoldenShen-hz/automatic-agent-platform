/**
 * Integration Test: Hot Upgrade Integration
 *
 * Verifies:
 * - Version compatibility matrix registration and queries
 * - Upgrade plan creation with canary batches
 * - Batch lifecycle (start, complete, health checks)
 * - Rollback trigger and execution
 * - Upgrade progress tracking
 * - Audit trail recording
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { HotUpgradeService, HOT_UPGRADE_DDL, type UpgradeTarget, type UpgradePolicy } from "../../../../src/platform/five-plane-execution/hot-upgrade/hot-upgrade-service.js";
import { type HealthCheckResult } from "../../../../src/platform/five-plane-execution/hot-upgrade/index.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { newId } from "../../../../src/platform/contracts/types/ids.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function createInMemoryDb(): SqliteDatabase {
  const db = new SqliteDatabase(":memory:");
  db.connection.exec(HOT_UPGRADE_DDL);
  return db;
}

function makeTarget(overrides: Partial<UpgradeTarget> = {}): UpgradeTarget {
  return {
    targetId: "node-1",
    targetType: "coordinator",
    currentVersion: "v1.0",
    targetVersion: "v2.0",
    healthCheckEndpoint: "/health",
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
// Version Compatibility Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("hot upgrade: register and retrieve version compatibility", () => {
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
  assert.equal(compat!.rollbackSupported, true);

  db.connection.close();
});

test("hot upgrade: isUpgradeSafe returns safe for full compatibility", () => {
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

  db.connection.close();
});

test("hot upgrade: isUpgradeSafe returns incompatible when no record exists", () => {
  const db = createInMemoryDb();

  const service = new HotUpgradeService(db);

  const result = service.isUpgradeSafe("v9.0", "v10.0");

  assert.equal(result.safe, false);
  assert.equal(result.compatibilityLevel, "incompatible");
  assert.equal(result.reasonCode, "no_compatibility_record");

  db.connection.close();
});

test("hot upgrade: isUpgradeSafe returns safe for n_minus_1 compatibility with migration", () => {
  const db = createInMemoryDb();

  const service = new HotUpgradeService(db);

  service.registerVersionCompatibility({
    fromVersion: "v2.0",
    toVersion: "v3.0",
    compatibilityLevel: "n_minus_1",
    migrationRequired: true,
    rollbackSupported: true,
  });

  const result = service.isUpgradeSafe("v2.0", "v3.0");

  assert.equal(result.safe, true);
  assert.equal(result.compatibilityLevel, "n_minus_1");
  assert.equal(result.requiresMigration, true);
  assert.equal(result.supportsRollback, true);

  db.connection.close();
});

test("hot upgrade: isUpgradeSafe returns unsafe for incompatible level", () => {
  const db = createInMemoryDb();

  const service = new HotUpgradeService(db);

  service.registerVersionCompatibility({
    fromVersion: "v1.0",
    toVersion: "v4.0",
    compatibilityLevel: "incompatible",
    migrationRequired: false,
    rollbackSupported: false,
  });

  const result = service.isUpgradeSafe("v1.0", "v4.0");

  assert.equal(result.safe, false);
  assert.equal(result.compatibilityLevel, "incompatible");

  db.connection.close();
});

// ─────────────────────────────────────────────────────────────────────────────
// Upgrade Plan Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("hot upgrade: createUpgradePlan persists plan to database", () => {
  const db = createInMemoryDb();

  const service = new HotUpgradeService(db);

  const targets = [
    makeTarget({ targetId: "node-1" }),
    makeTarget({ targetId: "node-2" }),
    makeTarget({ targetId: "node-3" }),
  ];

  const plan = service.createUpgradePlan("upgrade-001", targets);

  assert.ok(plan.planId != null);
  assert.equal(plan.upgradeId, "upgrade-001");
  assert.equal(plan.targets.length, 3);
  assert.equal(plan.status, "pending");
  assert.equal(plan.currentPhase, "canary");

  // Verify persisted
  const retrieved = service.getUpgradePlan(plan.planId);
  assert.ok(retrieved !== null);
  assert.equal(retrieved!.upgradeId, "upgrade-001");

  db.connection.close();
});

test("hot upgrade: createUpgradePlan computes canary batches correctly", () => {
  const db = createInMemoryDb();

  const service = new HotUpgradeService(db);

  // Create many targets to test batch splitting
  const targets = Array.from({ length: 20 }, (_, i) =>
    makeTarget({ targetId: `node-${i + 1}` }),
  );

  const policy = makePolicy({
    canaryPercent: 10,  // 2 nodes per canary batch
    canaryBatches: 3,
    batchSize: 5,
  });

  const plan = service.createUpgradePlan("upgrade-batches", targets, policy);

  // 10% of 20 = 2 nodes per canary batch, 3 canary batches = 6 nodes
  // Remaining 14 nodes at batchSize=5 = 3 batches
  // Total: 6 batches
  assert.equal(plan.batches.length, 6);
  assert.equal(plan.batches[0]!.batchNumber, 1);
  assert.equal(plan.batches[0]!.targetNodes.length, 2); // 10% of 20

  db.connection.close();
});

test("hot upgrade: getUpgradePlansByStatus filters correctly", () => {
  const db = createInMemoryDb();

  const service = new HotUpgradeService(db);

  // Create multiple plans
  const plan1 = service.createUpgradePlan("upgrade-pending", [makeTarget()]);
  const plan2 = service.createUpgradePlan("upgrade-in-progress", [makeTarget()]);
  const plan3 = service.createUpgradePlan("upgrade-completed", [makeTarget()]);

  // Start some plans
  service.startUpgrade(plan2.planId);
  service.startUpgrade(plan3.planId);
  service.completeBatch(plan3.batches[0]!.batchId, [makeHealthCheck()]);

  const pendingPlans = service.getUpgradePlansByStatus("pending");
  const inProgressPlans = service.getUpgradePlansByStatus("in_progress");
  const completedPlans = service.getUpgradePlansByStatus("completed");

  assert.equal(pendingPlans.length, 1);
  assert.equal(pendingPlans[0]!.upgradeId, "upgrade-pending");

  assert.equal(inProgressPlans.length, 1);
  assert.equal(inProgressPlans[0]!.upgradeId, "upgrade-in-progress");

  db.connection.close();
});

// ─────────────────────────────────────────────────────────────────────────────
// Batch Lifecycle Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("hot upgrade: startUpgrade transitions plan to in_progress", () => {
  const db = createInMemoryDb();

  const service = new HotUpgradeService(db);

  const plan = service.createUpgradePlan("upgrade-start", [makeTarget()]);
  assert.equal(plan.status, "pending");

  const result = service.startUpgrade(plan.planId);

  assert.equal(result.started, true);
  assert.equal(result.upgradeId, "upgrade-start");
  assert.ok(result.firstBatch !== null);

  const updated = service.getUpgradePlan(plan.planId);
  assert.equal(updated!.status, "in_progress");

  db.connection.close();
});

test("hot upgrade: startBatch transitions batch to in_progress", () => {
  const db = createInMemoryDb();

  const service = new HotUpgradeService(db);

  const plan = service.createUpgradePlan("upgrade-batch-start", [makeTarget()]);
  const firstBatch = plan.batches[0]!;

  const result = service.startBatch(firstBatch.batchId);

  assert.equal(result.started, true);
  assert.equal(result.batch!.status, "in_progress");
  assert.ok(result.batch!.startedAt.length > 0);

  db.connection.close();
});

test("hot upgrade: completeBatch with passing health checks transitions batch to completed", () => {
  const db = createInMemoryDb();

  const service = new HotUpgradeService(db);

  const plan = service.createUpgradePlan("upgrade-complete", [makeTarget()]);
  const firstBatch = plan.batches[0]!;

  service.startBatch(firstBatch.batchId);

  const healthChecks = [
    makeHealthCheck({ checkId: "hc-1", passed: true, checkType: "worker_health" }),
    makeHealthCheck({ checkId: "hc-2", passed: true, checkType: "dispatch_routing" }),
  ];

  const result = service.completeBatch(firstBatch.batchId, healthChecks);

  assert.equal(result.completed, true);
  assert.equal(result.allPassed, true);
  assert.equal(result.batch!.status, "completed");
  assert.ok(result.nextBatch !== null || result.triggerRollback === false);

  db.connection.close();
});

test("hot upgrade: completeBatch with failing health checks triggers rollback", () => {
  const db = createInMemoryDb();

  const service = new HotUpgradeService(db);

  const plan = service.createUpgradePlan("upgrade-rollback", [makeTarget()]);
  const firstBatch = plan.batches[0]!;

  service.startBatch(firstBatch.batchId);

  const healthChecks = [
    makeHealthCheck({ checkId: "hc-fail", passed: false, checkType: "worker_health", message: "Workers not ready" }),
  ];

  const result = service.completeBatch(firstBatch.batchId, healthChecks);

  assert.equal(result.completed, true);
  assert.equal(result.allPassed, false);
  assert.equal(result.batch!.status, "failed");
  assert.equal(result.triggerRollback, true);

  db.connection.close();
});

test("hot upgrade: completeBatch all batches transitions plan to completed", () => {
  const db = createInMemoryDb();

  const service = new HotUpgradeService(db);

  // Create plan with single batch to easily complete it
  const target = makeTarget({ targetId: "single-node" });
  const plan = service.createUpgradePlan("upgrade-single-batch", [target]);
  const batch = plan.batches[0]!;

  service.startBatch(batch.batchId);
  const result = service.completeBatch(batch.batchId, [makeHealthCheck()]);

  assert.equal(result.completed, true);
  assert.equal(result.allPassed, true);
  assert.equal(result.nextBatch, null); // No more batches

  const updated = service.getUpgradePlan(plan.planId);
  assert.equal(updated!.status, "completed");

  db.connection.close();
});

// ─────────────────────────────────────────────────────────────────────────────
// Rollback Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("hot upgrade: triggerRollback creates rollback trigger record", () => {
  const db = createInMemoryDb();

  const service = new HotUpgradeService(db);

  const plan = service.createUpgradePlan("upgrade-trigger-rollback", [makeTarget()]);
  service.startUpgrade(plan.planId);

  const result = service.triggerRollback(plan.upgradeId, "health_check_failed", "Health checks degraded");

  assert.equal(result.triggered, true);
  assert.ok(result.triggerRecord !== null);
  assert.equal(result.triggerRecord!.reasonCode, "health_check_failed");
  assert.equal(result.triggerRecord!.upgradeId, plan.upgradeId);

  db.connection.close();
});

test("hot upgrade: triggerRollback updates plan status to failed", () => {
  const db = createInMemoryDb();

  const service = new HotUpgradeService(db);

  const plan = service.createUpgradePlan("upgrade-rollback-status", [makeTarget()]);
  service.startUpgrade(plan.planId);

  service.triggerRollback(plan.upgradeId, "manual", "Operator initiated rollback");

  const updated = service.getUpgradePlan(plan.planId);
  assert.equal(updated!.status, "failed");
  assert.ok(updated!.rollbackTriggeredAt !== null);
  assert.equal(updated!.rollbackReason, "Operator initiated rollback");

  db.connection.close();
});

// ─────────────────────────────────────────────────────────────────────────────
// Upgrade Progress Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("hot upgrade: getUpgradeProgress tracks completed batches", () => {
  const db = createInMemoryDb();

  const service = new HotUpgradeService(db);

  const plan = service.createUpgradePlan("upgrade-progress", [makeTarget()]);
  service.startUpgrade(plan.planId);

  const progress = service.getUpgradeProgress(plan.upgradeId);

  assert.ok(progress !== null);
  assert.equal(progress!.upgradeId, plan.upgradeId);
  assert.equal(progress!.totalBatches, plan.batches.length);
  assert.ok(progress!.currentBatchNumber >= 0);

  db.connection.close();
});

test("hot upgrade: getUpgradeProgress calculates health check pass rate", () => {
  const db = createInMemoryDb();

  const service = new HotUpgradeService(db);

  const plan = service.createUpgradePlan("upgrade-health-rate", [makeTarget()]);
  service.startUpgrade(plan.planId);

  const firstBatch = plan.batches[0]!;
  service.startBatch(firstBatch.batchId);

  // 3 passing, 1 failing = 75% pass rate
  const healthChecks = [
    makeHealthCheck({ checkId: "hc-1", passed: true }),
    makeHealthCheck({ checkId: "hc-2", passed: true }),
    makeHealthCheck({ checkId: "hc-3", passed: true }),
    makeHealthCheck({ checkId: "hc-4", passed: false }),
  ];

  service.completeBatch(firstBatch.batchId, healthChecks);

  const progress = service.getUpgradeProgress(plan.upgradeId);

  assert.ok(progress !== null);
  assert.equal(progress!.healthCheckPassRate, 75);

  db.connection.close();
});

// ─────────────────────────────────────────────────────────────────────────────
// Audit Trail Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("hot upgrade: audit trail records upgrade lifecycle events", () => {
  const db = createInMemoryDb();

  const service = new HotUpgradeService(db);

  const plan = service.createUpgradePlan("upgrade-audit", [makeTarget()]);
  service.startUpgrade(plan.planId);

  const firstBatch = plan.batches[0]!;
  service.startBatch(firstBatch.batchId);
  service.completeBatch(firstBatch.batchId, [makeHealthCheck()]);

  const auditLog = service.getUpgradeAuditLog(plan.upgradeId);

  assert.ok(auditLog.length >= 4);
  assert.ok(auditLog.some((e) => e.eventType === "upgrade_started"));
  assert.ok(auditLog.some((e) => e.eventType === "batch_started"));
  assert.ok(auditLog.some((e) => e.eventType === "upgrade_completed"));

  db.connection.close();
});

test("hot upgrade: getUpgradeAuditLog respects limit parameter", () => {
  const db = createInMemoryDb();

  const service = new HotUpgradeService(db);

  const plan = service.createUpgradePlan("upgrade-audit-limit", [makeTarget()]);
  service.startUpgrade(plan.planId);

  const auditLog = service.getUpgradeAuditLog(plan.upgradeId, 5);

  assert.ok(auditLog.length <= 5);

  db.connection.close();
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Case Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("hot upgrade: startUpgrade on non-existent plan returns plan_not_found", () => {
  const db = createInMemoryDb();

  const service = new HotUpgradeService(db);

  const result = service.startUpgrade("non-existent-plan");

  assert.equal(result.started, false);
  assert.equal(result.reasonCode, "plan_not_found");

  db.connection.close();
});

test("hot upgrade: startUpgrade on already-started plan returns upgrade_not_pending", () => {
  const db = createInMemoryDb();

  const service = new HotUpgradeService(db);

  const plan = service.createUpgradePlan("upgrade-already-started", [makeTarget()]);
  service.startUpgrade(plan.planId);

  const result = service.startUpgrade(plan.planId);

  assert.equal(result.started, false);
  assert.equal(result.reasonCode, "upgrade_not_pending");

  db.connection.close();
});

test("hot upgrade: startBatch on non-pending batch returns batch_not_pending", () => {
  const db = createInMemoryDb();

  const service = new HotUpgradeService(db);

  const plan = service.createUpgradePlan("upgrade-batch-pending", [makeTarget()]);
  const firstBatch = plan.batches[0]!;

  // Start and complete the batch
  service.startBatch(firstBatch.batchId);
  service.completeBatch(firstBatch.batchId, [makeHealthCheck()]);

  // Try to start again
  const result = service.startBatch(firstBatch.batchId);

  assert.equal(result.started, false);
  assert.equal(result.reasonCode, "batch_not_pending");

  db.connection.close();
});

test("hot upgrade: multiple upgrades can exist concurrently", () => {
  const db = createInMemoryDb();

  const service = new HotUpgradeService(db);

  const plan1 = service.createUpgradePlan("upgrade-concurrent-1", [makeTarget()]);
  const plan2 = service.createUpgradePlan("upgrade-concurrent-2", [makeTarget()]);

  service.startUpgrade(plan1.planId);
  service.startUpgrade(plan2.planId);

  const progress1 = service.getUpgradeProgress(plan1.upgradeId);
  const progress2 = service.getUpgradeProgress(plan2.upgradeId);

  assert.ok(progress1 !== null);
  assert.ok(progress2 !== null);
  assert.equal(progress1!.status, "in_progress");
  assert.equal(progress2!.status, "in_progress");

  db.connection.close();
});

test("hot upgrade: rollbackOnFailure=false does not trigger rollback on batch failure", () => {
  const db = createInMemoryDb();

  const service = new HotUpgradeService(db);

  const policy = makePolicy({ rollbackOnFailure: false });
  const plan = service.createUpgradePlan("upgrade-no-rollback", [makeTarget()], policy);
  const firstBatch = plan.batches[0]!;

  service.startBatch(firstBatch.batchId);

  const healthChecks = [
    makeHealthCheck({ checkId: "hc-fail", passed: false }),
  ];

  const result = service.completeBatch(firstBatch.batchId, healthChecks);

  assert.equal(result.triggerRollback, false);
  assert.equal(result.batch!.status, "failed");

  db.connection.close();
});