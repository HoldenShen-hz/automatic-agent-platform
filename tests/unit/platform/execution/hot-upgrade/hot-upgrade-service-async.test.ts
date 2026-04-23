/**
 * @fileoverview Unit tests for HotUpgradeServiceAsync
 * Tests the async version of the hot upgrade service.
 */

// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";

import { HotUpgradeServiceAsync } from "../../../../../src/platform/execution/hot-upgrade/hot-upgrade-service-async.js";
import type { HotUpgradeRepository } from "../../../../../src/platform/execution/hot-upgrade/hot-upgrade-repository.js";
import type { UpgradePlan, UpgradeBatch, VersionCompatibility, RollbackTrigger, HealthCheckResult, UpgradeTarget } from "../../../../../src/platform/execution/hot-upgrade/hot-upgrade-service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Mock repository implementation
// ─────────────────────────────────────────────────────────────────────────────

interface MockRepoState {
  versionCompat: Map<string, VersionCompatibility>;
  plans: Map<string, UpgradePlan>;
  plansByStatus: Map<string, UpgradePlan[]>;
  batches: Map<string, UpgradeBatch>;
  batchesByUpgrade: Map<string, UpgradeBatch[]>;
  rollbackTriggers: Map<string, RollbackTrigger[]>;
  audits: Map<string, Array<{ id: string; upgradeId: string; eventType: string; actor: string; message: string; details: Record<string, unknown> | null; occurredAt: string }>>;
}

function createMockRepo(): HotUpgradeRepository & { mockState: MockRepoState } {
  const state: MockRepoState = {
    versionCompat: new Map(),
    plans: new Map(),
    plansByStatus: new Map(),
    batches: new Map(),
    batchesByUpgrade: new Map(),
    rollbackTriggers: new Map(),
    audits: new Map(),
  };

  return {
    mockState: state,

    async upsertVersionCompatibility(compat: VersionCompatibility): Promise<void> {
      state.versionCompat.set(`${compat.fromVersion}_${compat.toVersion}`, compat);
    },

    async getVersionCompatibility(fromVersion: string, toVersion: string): Promise<VersionCompatibility | null> {
      return state.versionCompat.get(`${fromVersion}_${toVersion}`) ?? null;
    },

    async insertUpgradePlan(plan: UpgradePlan): Promise<void> {
      state.plans.set(plan.planId, plan);
      const statusList = state.plansByStatus.get(plan.status) ?? [];
      statusList.push(plan);
      state.plansByStatus.set(plan.status, statusList);
    },

    async updateUpgradePlanStatus(planId: string, status: string, updatedFields?: { startedAt?: string; completedAt?: string; rollbackTriggeredAt?: string; rollbackReason?: string }): Promise<void> {
      const plan = state.plans.get(planId);
      if (plan) {
        // Update plansByStatus index: remove from old status list, add to new one
        const oldStatus = plan.status;
        if (oldStatus !== status) {
          const oldList = state.plansByStatus.get(oldStatus) ?? [];
          state.plansByStatus.set(oldStatus, oldList.filter((p) => p.planId !== planId));
          const newList = state.plansByStatus.get(status) ?? [];
          newList.push(plan);
          state.plansByStatus.set(status, newList);
        }
        plan.status = status as UpgradePlan["status"];
        if (updatedFields?.startedAt !== undefined) plan.startedAt = updatedFields.startedAt;
        if (updatedFields?.completedAt !== undefined) plan.completedAt = updatedFields.completedAt;
        if (updatedFields?.rollbackTriggeredAt !== undefined) plan.rollbackTriggeredAt = updatedFields.rollbackTriggeredAt;
        if (updatedFields?.rollbackReason !== undefined) plan.rollbackReason = updatedFields.rollbackReason;
      }
    },

    async getUpgradePlan(planId: string): Promise<UpgradePlan | null> {
      return state.plans.get(planId) ?? null;
    },

    async listUpgradePlansByStatus(status: string): Promise<UpgradePlan[]> {
      return state.plansByStatus.get(status) ?? [];
    },

    async insertUpgradeBatch(batch: UpgradeBatch): Promise<void> {
      state.batches.set(batch.batchId, batch);
      const upgradeBatches = state.batchesByUpgrade.get(batch.upgradeId) ?? [];
      upgradeBatches.push(batch);
      state.batchesByUpgrade.set(batch.upgradeId, upgradeBatches);
    },

    async updateUpgradeBatch(batchId: string, status: string, completedAt: string | null, healthChecks: HealthCheckResult[]): Promise<void> {
      const batch = state.batches.get(batchId);
      if (batch) {
        batch.status = status as UpgradeBatch["status"];
        batch.completedAt = completedAt;
        batch.healthChecks = healthChecks;
      }
    },

    async getUpgradeBatch(batchId: string): Promise<UpgradeBatch | null> {
      return state.batches.get(batchId) ?? null;
    },

    async listUpgradeBatchesByPlan(upgradeId: string): Promise<UpgradeBatch[]> {
      return state.batchesByUpgrade.get(upgradeId) ?? [];
    },

    async insertRollbackTrigger(trigger: RollbackTrigger): Promise<void> {
      const triggers = state.rollbackTriggers.get(trigger.upgradeId) ?? [];
      triggers.push(trigger);
      state.rollbackTriggers.set(trigger.upgradeId, triggers);
    },

    async listRollbackTriggersByUpgrade(upgradeId: string): Promise<RollbackTrigger[]> {
      return state.rollbackTriggers.get(upgradeId) ?? [];
    },

    async insertUpgradeAudit(entry): Promise<void> {
      const audits = state.audits.get(entry.upgradeId) ?? [];
      audits.push(entry);
      state.audits.set(entry.upgradeId, audits);
    },

    async listUpgradeAudits(upgradeId: string, limit = 100): Promise<any[]> {
      const audits = state.audits.get(upgradeId) ?? [];
      return audits.slice(0, limit);
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock AsyncSqlDatabase
// ─────────────────────────────────────────────────────────────────────────────

function createMockAsyncDb() {
  return {
    asyncConnection: {
      async execute(_sql: string, ..._params: unknown[]): Promise<{ rowCount: number }> {
        return { rowCount: 0 };
      },
    },
    transaction: async function <T>(fn: (conn: unknown) => Promise<T>): Promise<T> {
      return fn(this.asyncConnection);
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HotUpgradeServiceAsync tests
// ─────────────────────────────────────────────────────────────────────────────

test("HotUpgradeServiceAsync registerVersionCompatibility stores compat", async () => {
  const repo = createMockRepo();
  const db = createMockAsyncDb();
  const service = new HotUpgradeServiceAsync(db, repo);

  await service.registerVersionCompatibility({
    fromVersion: "v1.0",
    toVersion: "v2.0",
    compatibilityLevel: "full",
    migrationRequired: false,
    rollbackSupported: true,
  });

  const result = await service.getVersionCompatibility("v1.0", "v2.0");

  assert.ok(result !== null);
  assert.equal(result!.fromVersion, "v1.0");
  assert.equal(result!.toVersion, "v2.0");
  assert.equal(result!.compatibilityLevel, "full");
});

test("HotUpgradeServiceAsync getVersionCompatibility returns null for non-existent", async () => {
  const repo = createMockRepo();
  const db = createMockAsyncDb();
  const service = new HotUpgradeServiceAsync(db, repo);

  const result = await service.getVersionCompatibility("non", "existent");

  assert.equal(result, null);
});

test("HotUpgradeServiceAsync isUpgradeSafe returns incompatible when no record", async () => {
  const repo = createMockRepo();
  const db = createMockAsyncDb();
  const service = new HotUpgradeServiceAsync(db, repo);

  const result = await service.isUpgradeSafe("v1.0", "v2.0");

  assert.equal(result.safe, false);
  assert.equal(result.compatibilityLevel, "incompatible");
  assert.equal(result.reasonCode, "no_compatibility_record");
});

test("HotUpgradeServiceAsync isUpgradeSafe returns safe for full compat", async () => {
  const repo = createMockRepo();
  const db = createMockAsyncDb();
  const service = new HotUpgradeServiceAsync(db, repo);

  await service.registerVersionCompatibility({
    fromVersion: "v1.0",
    toVersion: "v2.0",
    compatibilityLevel: "full",
    migrationRequired: false,
    rollbackSupported: true,
  });

  const result = await service.isUpgradeSafe("v1.0", "v2.0");

  assert.equal(result.safe, true);
  assert.equal(result.compatibilityLevel, "full");
  assert.equal(result.requiresMigration, false);
  assert.equal(result.supportsRollback, true);
});

test("HotUpgradeServiceAsync isUpgradeSafe returns safe for n_minus_1 compat", async () => {
  const repo = createMockRepo();
  const db = createMockAsyncDb();
  const service = new HotUpgradeServiceAsync(db, repo);

  await service.registerVersionCompatibility({
    fromVersion: "v1.0",
    toVersion: "v2.0",
    compatibilityLevel: "n_minus_1",
    migrationRequired: true,
    rollbackSupported: true,
  });

  const result = await service.isUpgradeSafe("v1.0", "v2.0");

  assert.equal(result.safe, true);
  assert.equal(result.compatibilityLevel, "n_minus_1");
  assert.equal(result.requiresMigration, true);
});

test("HotUpgradeServiceAsync isUpgradeSafe returns unsafe for incompatible", async () => {
  const repo = createMockRepo();
  const db = createMockAsyncDb();
  const service = new HotUpgradeServiceAsync(db, repo);

  await service.registerVersionCompatibility({
    fromVersion: "v1.0",
    toVersion: "v2.0",
    compatibilityLevel: "incompatible",
    migrationRequired: false,
    rollbackSupported: false,
  });

  const result = await service.isUpgradeSafe("v1.0", "v2.0");

  assert.equal(result.safe, false);
  assert.equal(result.compatibilityLevel, "incompatible");
});

test("HotUpgradeServiceAsync createUpgradePlan creates plan with batches", async () => {
  const repo = createMockRepo();
  const db = createMockAsyncDb();
  const service = new HotUpgradeServiceAsync(db, repo);

  const targets: UpgradeTarget[] = [
    { targetId: "node1", targetType: "coordinator", currentVersion: "v1.0", targetVersion: "v2.0" },
    { targetId: "node2", targetType: "coordinator", currentVersion: "v1.0", targetVersion: "v2.0" },
  ];

  const plan = await service.createUpgradePlan("upgrade-1", targets);

  assert.ok(plan.planId.startsWith("upln_"));
  assert.equal(plan.upgradeId, "upgrade-1");
  assert.equal(plan.targets.length, 2);
  assert.ok(plan.batches.length > 0);
  assert.equal(plan.status, "pending");
  assert.equal(plan.currentPhase, "canary");
});

test("HotUpgradeServiceAsync createUpgradePlan with custom policy", async () => {
  const repo = createMockRepo();
  const db = createMockAsyncDb();
  const service = new HotUpgradeServiceAsync(db, repo);

  const targets: UpgradeTarget[] = Array.from({ length: 20 }, (_, i) => ({
    targetId: `node${i}`,
    targetType: "coordinator" as const,
    currentVersion: "v1.0",
    targetVersion: "v2.0",
  }));

  const plan = await service.createUpgradePlan("upgrade-1", targets, {
    canaryPercent: 50,
    canaryBatches: 2,
    batchSize: 5,
  });

  assert.equal(plan.batches[0]!.targetNodes.length, 10);
  assert.equal(plan.batches[1]!.targetNodes.length, 10);
  assert.equal(plan.policy.canaryPercent, 50);
});

test("HotUpgradeServiceAsync getUpgradePlan retrieves plan", async () => {
  const repo = createMockRepo();
  const db = createMockAsyncDb();
  const service = new HotUpgradeServiceAsync(db, repo);

  const targets: UpgradeTarget[] = [
    { targetId: "node1", targetType: "coordinator", currentVersion: "v1.0", targetVersion: "v2.0" },
  ];

  const created = await service.createUpgradePlan("upgrade-1", targets);
  const retrieved = await service.getUpgradePlan(created.planId);

  assert.ok(retrieved !== null);
  assert.equal(retrieved!.planId, created.planId);
});

test("HotUpgradeServiceAsync getUpgradePlan returns null for non-existent", async () => {
  const repo = createMockRepo();
  const db = createMockAsyncDb();
  const service = new HotUpgradeServiceAsync(db, repo);

  const result = await service.getUpgradePlan("non-existent");

  assert.equal(result, null);
});

test("HotUpgradeServiceAsync getUpgradePlansByStatus retrieves by status", async () => {
  const repo = createMockRepo();
  const db = createMockAsyncDb();
  const service = new HotUpgradeServiceAsync(db, repo);

  const targets: UpgradeTarget[] = [
    { targetId: "node1", targetType: "coordinator", currentVersion: "v1.0", targetVersion: "v2.0" },
  ];

  await service.createUpgradePlan("upgrade-1", targets);
  await service.createUpgradePlan("upgrade-2", targets);

  const pendingPlans = await service.getUpgradePlansByStatus("pending");

  assert.equal(pendingPlans.length, 2);
});

test("HotUpgradeServiceAsync startUpgrade starts upgrade", async () => {
  const repo = createMockRepo();
  const db = createMockAsyncDb();
  const service = new HotUpgradeServiceAsync(db, repo);

  const targets: UpgradeTarget[] = [
    { targetId: "node1", targetType: "coordinator", currentVersion: "v1.0", targetVersion: "v2.0" },
  ];

  const plan = await service.createUpgradePlan("upgrade-1", targets);
  const result = await service.startUpgrade(plan.planId);

  assert.equal(result.started, true);
  assert.equal(result.upgradeId, "upgrade-1");
  assert.ok(result.firstBatch !== null);
});

test("HotUpgradeServiceAsync startUpgrade fails for non-existent plan", async () => {
  const repo = createMockRepo();
  const db = createMockAsyncDb();
  const service = new HotUpgradeServiceAsync(db, repo);

  const result = await service.startUpgrade("non-existent");

  assert.equal(result.started, false);
  assert.equal(result.reasonCode, "plan_not_found");
});

test("HotUpgradeServiceAsync startUpgrade fails for non-pending status", async () => {
  const repo = createMockRepo();
  const db = createMockAsyncDb();
  const service = new HotUpgradeServiceAsync(db, repo);

  const targets: UpgradeTarget[] = [
    { targetId: "node1", targetType: "coordinator", currentVersion: "v1.0", targetVersion: "v2.0" },
  ];

  const plan = await service.createUpgradePlan("upgrade-1", targets);
  await service.startUpgrade(plan.planId);
  const secondStart = await service.startUpgrade(plan.planId);

  assert.equal(secondStart.started, false);
  assert.equal(secondStart.reasonCode, "upgrade_not_pending");
});

test("HotUpgradeServiceAsync startBatch starts pending batch", async () => {
  const repo = createMockRepo();
  const db = createMockAsyncDb();
  const service = new HotUpgradeServiceAsync(db, repo);

  const targets: UpgradeTarget[] = [
    { targetId: "node1", targetType: "coordinator", currentVersion: "v1.0", targetVersion: "v2.0" },
  ];

  const plan = await service.createUpgradePlan("upgrade-1", targets);
  const firstBatch = plan.batches[0]!;
  const result = await service.startBatch(firstBatch.batchId);

  assert.equal(result.started, true);
  assert.equal(result.batch!.status, "in_progress");
});

test("HotUpgradeServiceAsync startBatch fails for non-existent batch", async () => {
  const repo = createMockRepo();
  const db = createMockAsyncDb();
  const service = new HotUpgradeServiceAsync(db, repo);

  const result = await service.startBatch("non-existent");

  assert.equal(result.started, false);
  assert.equal(result.reasonCode, "batch_not_found");
});

test("HotUpgradeServiceAsync startBatch fails for non-pending batch", async () => {
  const repo = createMockRepo();
  const db = createMockAsyncDb();
  const service = new HotUpgradeServiceAsync(db, repo);

  const targets: UpgradeTarget[] = [
    { targetId: "node1", targetType: "coordinator", currentVersion: "v1.0", targetVersion: "v2.0" },
  ];

  const plan = await service.createUpgradePlan("upgrade-1", targets);
  const firstBatch = plan.batches[0]!;
  await service.startBatch(firstBatch.batchId);
  const secondStart = await service.startBatch(firstBatch.batchId);

  assert.equal(secondStart.started, false);
  assert.equal(secondStart.reasonCode, "batch_not_pending");
});

test("HotUpgradeServiceAsync completeBatch completes with passing health checks", async () => {
  const repo = createMockRepo();
  const db = createMockAsyncDb();
  const service = new HotUpgradeServiceAsync(db, repo);

  const targets: UpgradeTarget[] = [
    { targetId: "node1", targetType: "coordinator", currentVersion: "v1.0", targetVersion: "v2.0" },
  ];

  const plan = await service.createUpgradePlan("upgrade-1", targets);
  const firstBatch = plan.batches[0]!;
  await service.startBatch(firstBatch.batchId);

  const healthChecks: HealthCheckResult[] = [
    {
      checkId: "check-1",
      checkType: "worker_health",
      passed: true,
      message: "ok",
      checkedAt: new Date().toISOString(),
      details: {},
    },
  ];

  const result = await service.completeBatch(firstBatch.batchId, healthChecks);

  assert.equal(result.completed, true);
  assert.equal(result.allPassed, true);
  assert.equal(result.batch!.status, "completed");
});

test("HotUpgradeServiceAsync completeBatch triggers rollback on failure", async () => {
  const repo = createMockRepo();
  const db = createMockAsyncDb();
  const service = new HotUpgradeServiceAsync(db, repo);

  const targets: UpgradeTarget[] = [
    { targetId: "node1", targetType: "coordinator", currentVersion: "v1.0", targetVersion: "v2.0" },
  ];

  const plan = await service.createUpgradePlan("upgrade-1", targets);
  // Use startUpgrade instead of startBatch directly so plan status is "in_progress"
  await service.startUpgrade(plan.planId);

  const healthChecks: HealthCheckResult[] = [
    {
      checkId: "check-1",
      checkType: "worker_health",
      passed: false,
      message: "failed",
      checkedAt: new Date().toISOString(),
      details: {},
    },
  ];

  const result = await service.completeBatch(plan.batches[0]!.batchId, healthChecks);

  assert.equal(result.allPassed, false);
  assert.equal(result.triggerRollback, true);
  assert.equal(result.batch!.status, "failed");
});

test("HotUpgradeServiceAsync completeBatch with rollback disabled does not trigger rollback", async () => {
  const repo = createMockRepo();
  const db = createMockAsyncDb();
  const service = new HotUpgradeServiceAsync(db, repo);

  const targets: UpgradeTarget[] = [
    { targetId: "node1", targetType: "coordinator", currentVersion: "v1.0", targetVersion: "v2.0" },
  ];

  const plan = await service.createUpgradePlan("upgrade-1", targets, { rollbackOnFailure: false });
  const firstBatch = plan.batches[0]!;
  await service.startBatch(firstBatch.batchId);

  const healthChecks: HealthCheckResult[] = [
    {
      checkId: "check-1",
      checkType: "worker_health",
      passed: false,
      message: "failed",
      checkedAt: new Date().toISOString(),
      details: {},
    },
  ];

  const result = await service.completeBatch(firstBatch.batchId, healthChecks);

  assert.equal(result.triggerRollback, false);
});

test("HotUpgradeServiceAsync triggerRollback creates rollback trigger", async () => {
  const repo = createMockRepo();
  const db = createMockAsyncDb();
  const service = new HotUpgradeServiceAsync(db, repo);

  const targets: UpgradeTarget[] = [
    { targetId: "node1", targetType: "coordinator", currentVersion: "v1.0", targetVersion: "v2.0" },
  ];

  const plan = await service.createUpgradePlan("upgrade-1", targets);
  await service.startUpgrade(plan.planId);

  const result = await service.triggerRollback("upgrade-1", "manual", "Manual rollback requested");

  assert.equal(result.triggered, true);
  assert.ok(result.triggerRecord !== null);
  assert.equal(result.triggerRecord!.reasonCode, "manual");
});

test("HotUpgradeServiceAsync recordAudit creates audit entry", async () => {
  const repo = createMockRepo();
  const db = createMockAsyncDb();
  const service = new HotUpgradeServiceAsync(db, repo);

  await service.recordAudit("upgrade-1", "test_event", "system", "Test message", { key: "value" });

  const auditLog = await service.getUpgradeAuditLog("upgrade-1");

  assert.ok(auditLog.length > 0);
  assert.equal(auditLog[0]!.eventType, "test_event");
  assert.equal(auditLog[0]!.actor, "system");
});

test("HotUpgradeServiceAsync getUpgradeAuditLog returns audit entries", async () => {
  const repo = createMockRepo();
  const db = createMockAsyncDb();
  const service = new HotUpgradeServiceAsync(db, repo);

  await service.recordAudit("upgrade-1", "event1", "actor1", "Message 1", {});
  await service.recordAudit("upgrade-1", "event2", "actor2", "Message 2", {});

  const log = await service.getUpgradeAuditLog("upgrade-1");

  assert.equal(log.length, 2);
});

test("HotUpgradeServiceAsync default policy values", () => {
  const repo = createMockRepo();
  const db = createMockAsyncDb();
  const service = new HotUpgradeServiceAsync(db, repo);

  // Default values should be set in the service
  assert.ok(service !== null);
});

test("HotUpgradeServiceAsync custom options sets default policy", () => {
  const repo = createMockRepo();
  const db = createMockAsyncDb();

  const service = new HotUpgradeServiceAsync(db, repo, {
    defaultPolicy: {
      canaryPercent: 20,
      canaryBatches: 5,
    },
  });

  assert.ok(service !== null);
});

test("HotUpgradeServiceAsync computeBatches with single target", async () => {
  const repo = createMockRepo();
  const db = createMockAsyncDb();
  const service = new HotUpgradeServiceAsync(db, repo);

  const targets: UpgradeTarget[] = [
    { targetId: "node1", targetType: "coordinator", currentVersion: "v1.0", targetVersion: "v2.0" },
  ];

  const plan = await service.createUpgradePlan("upgrade-1", targets);

  // With 1 target and 10% canary (min 1), single batch
  assert.equal(plan.batches.length, 1);
  assert.equal(plan.batches[0]!.batchNumber, 1);
});

test("HotUpgradeServiceAsync health gates are set from policy", async () => {
  const repo = createMockRepo();
  const db = createMockAsyncDb();
  const service = new HotUpgradeServiceAsync(db, repo);

  const targets: UpgradeTarget[] = [
    { targetId: "node1", targetType: "coordinator", currentVersion: "v1.0", targetVersion: "v2.0" },
  ];

  const plan = await service.createUpgradePlan("upgrade-1", targets);

  assert.ok(plan.policy.healthGates.length > 0);
});
