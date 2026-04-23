/**
 * @fileoverview Unit tests for src/platform/execution/hot-upgrade/
 * Tests HotUpgradeService, HotUpgradeServiceAsync, repositories, and factory.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { HOT_UPGRADE_DDL, HotUpgradeService } from "../../../../../src/platform/execution/hot-upgrade/hot-upgrade-service.js";
import { createHotUpgradeService } from "../../../../../src/platform/execution/hot-upgrade/hot-upgrade-factory.js";
import { createHotUpgradeRepository } from "../../../../../src/platform/execution/hot-upgrade/hot-upgrade-repository.js";
import { SqliteHotUpgradeRepository } from "../../../../../src/platform/execution/hot-upgrade/hot-upgrade-repository-sqlite.js";
import { createTempWorkspace, cleanupPath } from "../../../../helpers/fs.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helper: create in-memory SQLite database with schema
// ─────────────────────────────────────────────────────────────────────────────

function createInMemoryDb(): SqliteDatabase {
  const db = new SqliteDatabase(":memory:");
  db.connection.exec(HOT_UPGRADE_DDL);
  return db;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: mock AsyncSqlDatabase for HotUpgradeServiceAsync tests
// ─────────────────────────────────────────────────────────────────────────────

interface MockAsyncQueryResult {
  rows: Record<string, unknown>[];
  rowCount: number;
}

function createMockAsyncDb() {
  const storage: Map<string, Record<string, unknown>[]> = new Map();

  return {
    storage,
    asyncConnection: {
      async execute(sql: string, ...params: unknown[]): Promise<{ rowCount: number }> {
        // INSERT handling
        if (sql.trim().toUpperCase().startsWith("INSERT")) {
          const tableName = extractTableName(sql);
          const rows = storage.get(tableName) ?? [];
          const row: Record<string, unknown> = {};
          const columns = extractColumns(sql);
          columns.forEach((col, i) => {
            row[col] = params[i];
          });
          rows.push(row);
          storage.set(tableName, rows);
          return { rowCount: 1 };
        }
        // SELECT handling - just return empty for now
        return { rowCount: 0 };
      },
    },
    transaction: async function <T>(fn: (conn: unknown) => Promise<T>): Promise<T> {
      return fn(this.asyncConnection);
    },
  };
}

function extractTableName(sql: string): string {
  const match = sql.match(/INTO\s+(\w+)/i) ?? sql.match(/UPDATE\s+(\w+)/i) ?? sql.match(/FROM\s+(\w+)/i);
  return match ? match[1]! : "";
}

function extractColumns(sql: string): string[] {
  const match = sql.match(/\(([^)]+)\)\s+VALUES/i);
  if (!match) return [];
  return match[1]!.split(",").map((c) => c.trim().split(" ").pop()!);
}

// ─────────────────────────────────────────────────────────────────────────────
// HotUpgradeService (sync) tests
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

test("HotUpgradeService isUpgradeSafe returns incompatible when no record exists", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const result = service.isUpgradeSafe("v1.0", "v2.0");

  assert.equal(result.safe, false);
  assert.equal(result.compatibilityLevel, "incompatible");
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

test("HotUpgradeService createUpgradePlan creates plan with batches", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [
    { targetId: "node1", targetType: "coordinator" as const, currentVersion: "v1.0", targetVersion: "v2.0" },
    { targetId: "node2", targetType: "coordinator" as const, currentVersion: "v1.0", targetVersion: "v2.0" },
    { targetId: "node3", targetType: "worker_pool" as const, currentVersion: "v1.0", targetVersion: "v2.0" },
  ];

  const plan = service.createUpgradePlan("upgrade-1", targets);

  assert.ok(plan.planId.startsWith("upln_"));
  assert.equal(plan.upgradeId, "upgrade-1");
  assert.equal(plan.targets.length, 3);
  assert.ok(plan.batches.length > 0);
  assert.equal(plan.status, "pending");
  assert.equal(plan.currentPhase, "canary");
});

test("HotUpgradeService createUpgradePlan uses custom policy", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = Array.from({ length: 20 }, (_, i) => ({
    targetId: `node${i}`,
    targetType: "coordinator" as const,
    currentVersion: "v1.0",
    targetVersion: "v2.0",
  }));

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
});

test("HotUpgradeService getUpgradePlan retrieves existing plan", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [
    { targetId: "node1", targetType: "coordinator" as const, currentVersion: "v1.0", targetVersion: "v2.0" },
  ];

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

  const targets = [
    { targetId: "node1", targetType: "coordinator" as const, currentVersion: "v1.0", targetVersion: "v2.0" },
  ];

  service.createUpgradePlan("upgrade-1", targets);
  service.createUpgradePlan("upgrade-2", targets);

  const pendingPlans = service.getUpgradePlansByStatus("pending");
  const completedPlans = service.getUpgradePlansByStatus("completed");

  assert.equal(pendingPlans.length, 2);
  assert.equal(completedPlans.length, 0);
});

test("HotUpgradeService startUpgrade starts upgrade and first batch", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [
    { targetId: "node1", targetType: "coordinator" as const, currentVersion: "v1.0", targetVersion: "v2.0" },
  ];

  const plan = service.createUpgradePlan("upgrade-1", targets);
  const result = service.startUpgrade(plan.planId);

  assert.equal(result.started, true);
  assert.equal(result.upgradeId, "upgrade-1");
  assert.ok(result.firstBatch !== null);
  assert.equal(result.firstBatch!.status, "in_progress");
});

test("HotUpgradeService startUpgrade fails for non-existent plan", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const result = service.startUpgrade("non-existent-plan-id");

  assert.equal(result.started, false);
  assert.equal(result.reasonCode, "plan_not_found");
});

test("HotUpgradeService startUpgrade fails for already started upgrade", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [
    { targetId: "node1", targetType: "coordinator" as const, currentVersion: "v1.0", targetVersion: "v2.0" },
  ];

  const plan = service.createUpgradePlan("upgrade-1", targets);
  service.startUpgrade(plan.planId);
  const secondStart = service.startUpgrade(plan.planId);

  assert.equal(secondStart.started, false);
  assert.equal(secondStart.reasonCode, "upgrade_not_pending");
});

test("HotUpgradeService startBatch starts pending batch", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [
    { targetId: "node1", targetType: "coordinator" as const, currentVersion: "v1.0", targetVersion: "v2.0" },
    { targetId: "node2", targetType: "coordinator" as const, currentVersion: "v1.0", targetVersion: "v2.0" },
  ];

  const plan = service.createUpgradePlan("upgrade-1", targets);
  const firstBatch = plan.batches[0]!;
  const result = service.startBatch(firstBatch.batchId);

  assert.equal(result.started, true);
  assert.ok(result.batch !== null);
  assert.equal(result.batch!.status, "in_progress");
});

test("HotUpgradeService startBatch fails for non-existent batch", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const result = service.startBatch("non-existent-batch-id");

  assert.equal(result.started, false);
  assert.equal(result.reasonCode, "batch_not_found");
});

test("HotUpgradeService startBatch fails for already started batch", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [
    { targetId: "node1", targetType: "coordinator" as const, currentVersion: "v1.0", targetVersion: "v2.0" },
  ];

  const plan = service.createUpgradePlan("upgrade-1", targets);
  const firstBatch = plan.batches[0]!;
  service.startBatch(firstBatch.batchId);
  const secondStart = service.startBatch(firstBatch.batchId);

  assert.equal(secondStart.started, false);
  assert.equal(secondStart.reasonCode, "batch_not_pending");
});

test("HotUpgradeService completeBatch completes batch with passing health checks", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [
    { targetId: "node1", targetType: "coordinator" as const, currentVersion: "v1.0", targetVersion: "v2.0" },
  ];

  const plan = service.createUpgradePlan("upgrade-1", targets);
  const firstBatch = plan.batches[0]!;
  service.startBatch(firstBatch.batchId);

  const healthChecks = [
    {
      checkId: "check-1",
      checkType: "worker_health" as const,
      passed: true,
      message: "ok",
      checkedAt: new Date().toISOString(),
      details: {},
    },
  ];

  const result = service.completeBatch(firstBatch.batchId, healthChecks);

  assert.equal(result.completed, true);
  assert.equal(result.allPassed, true);
  assert.equal(result.batch!.status, "completed");
});

test("HotUpgradeService completeBatch triggers rollback on failing health checks", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [
    { targetId: "node1", targetType: "coordinator" as const, currentVersion: "v1.0", targetVersion: "v2.0" },
  ];

  const plan = service.createUpgradePlan("upgrade-1", targets);
  const firstBatch = plan.batches[0]!;
  service.startBatch(firstBatch.batchId);

  const healthChecks = [
    {
      checkId: "check-1",
      checkType: "worker_health" as const,
      passed: false,
      message: "failed",
      checkedAt: new Date().toISOString(),
      details: {},
    },
  ];

  const result = service.completeBatch(firstBatch.batchId, healthChecks);

  assert.equal(result.completed, true);
  assert.equal(result.allPassed, false);
  assert.equal(result.triggerRollback, true);
  assert.equal(result.batch!.status, "failed");
});

test("HotUpgradeService completeBatch with rollback disabled does not trigger rollback", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [
    { targetId: "node1", targetType: "coordinator" as const, currentVersion: "v1.0", targetVersion: "v2.0" },
  ];

  const plan = service.createUpgradePlan("upgrade-1", targets, { rollbackOnFailure: false });
  const firstBatch = plan.batches[0]!;
  service.startBatch(firstBatch.batchId);

  const healthChecks = [
    {
      checkId: "check-1",
      checkType: "worker_health" as const,
      passed: false,
      message: "failed",
      checkedAt: new Date().toISOString(),
      details: {},
    },
  ];

  const result = service.completeBatch(firstBatch.batchId, healthChecks);

  assert.equal(result.triggerRollback, false);
});

test("HotUpgradeService triggerRollback creates rollback trigger", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [
    { targetId: "node1", targetType: "coordinator" as const, currentVersion: "v1.0", targetVersion: "v2.0" },
  ];

  const plan = service.createUpgradePlan("upgrade-1", targets);
  service.startUpgrade(plan.planId);

  const result = service.triggerRollback("upgrade-1", "manual", "Manual rollback requested");

  assert.equal(result.triggered, true);
  assert.ok(result.triggerRecord !== null);
  assert.equal(result.triggerRecord!.reasonCode, "manual");
  assert.equal(result.triggerRecord!.message, "Manual rollback requested");
});

test("HotUpgradeService getUpgradeProgress returns progress", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [
    { targetId: "node1", targetType: "coordinator" as const, currentVersion: "v1.0", targetVersion: "v2.0" },
  ];

  const plan = service.createUpgradePlan("upgrade-1", targets);
  service.startUpgrade(plan.planId);

  const progress = service.getUpgradeProgress("upgrade-1");

  assert.ok(progress !== null);
  assert.equal(progress!.upgradeId, "upgrade-1");
  assert.equal(progress!.totalBatches, 1);
  assert.ok(progress!.currentBatchNumber >= 0);
});

test("HotUpgradeService getUpgradeProgress returns null for non-existent upgrade", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const progress = service.getUpgradeProgress("non-existent-upgrade-id");

  assert.equal(progress, null);
});

test("HotUpgradeService recordAudit creates audit entry", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [
    { targetId: "node1", targetType: "coordinator" as const, currentVersion: "v1.0", targetVersion: "v2.0" },
  ];

  const plan = service.createUpgradePlan("upgrade-1", targets);
  service.startUpgrade(plan.planId);

  const auditLog = service.getUpgradeAuditLog("upgrade-1");

  assert.ok(auditLog.length > 0);
  assert.equal(auditLog[0]!.eventType, "upgrade_started");
});

test("HotUpgradeService computeBatches with single target", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  const targets = [
    { targetId: "node1", targetType: "coordinator" as const, currentVersion: "v1.0", targetVersion: "v2.0" },
  ];

  const plan = service.createUpgradePlan("upgrade-1", targets);

  // With 1 target, 10% canary = 1 target, but min is 1
  // With 3 canary batches requested but only 1 target, only 1 batch exists
  assert.equal(plan.batches.length, 1);
  assert.equal(plan.batches[0]!.batchNumber, 1);
});

test("HotUpgradeService default health gates are built", () => {
  const db = createInMemoryDb();
  const service = new HotUpgradeService(db);

  // Access default policy health gates through a plan
  const targets = [
    { targetId: "node1", targetType: "coordinator" as const, currentVersion: "v1.0", targetVersion: "v2.0" },
  ];

  const plan = service.createUpgradePlan("upgrade-1", targets);

  assert.ok(plan.policy.healthGates.length > 0);
  assert.equal(plan.policy.healthGates[0]!.gateType, "worker_ready");
});

// ─────────────────────────────────────────────────────────────────────────────
// createHotUpgradeRepository factory tests
// ─────────────────────────────────────────────────────────────────────────────

test("createHotUpgradeRepository returns SqliteHotUpgradeRepository for sqlite driver", () => {
  const mockHandle = {
    driver: "sqlite" as const,
    sql: createInMemoryDb(),
    asyncSql: {} as any,
  };

  const repo = createHotUpgradeRepository(mockHandle);

  assert.ok(repo instanceof SqliteHotUpgradeRepository);
});

test("createHotUpgradeRepository returns PostgresHotUpgradeRepository for postgres driver", () => {
  const mockHandle = {
    driver: "postgres" as const,
    sql: {} as any,
    asyncSql: createMockAsyncDb(),
  };

  const repo = createHotUpgradeRepository(mockHandle);

  // PostgresHotUpgradeRepository is not directly importable here, but we can check it has the right interface
  assert.ok(repo !== null);
  assert.ok(typeof repo.upsertVersionCompatibility === "function");
  assert.ok(typeof repo.getVersionCompatibility === "function");
});

// ─────────────────────────────────────────────────────────────────────────────
// createHotUpgradeService factory tests
// ─────────────────────────────────────────────────────────────────────────────

test("createHotUpgradeService creates service for sqlite backend", () => {
  const mockHandle = {
    driver: "sqlite" as const,
    sql: createInMemoryDb(),
    asyncSql: createMockAsyncDb(),
  };

  const service = createHotUpgradeService(mockHandle);

  assert.ok(service !== null);
  assert.ok(typeof service.registerVersionCompatibility === "function");
  assert.ok(typeof service.createUpgradePlan === "function");
});

test("createHotUpgradeService creates service for postgres backend", () => {
  const mockHandle = {
    driver: "postgres" as const,
    sql: {} as any,
    asyncSql: createMockAsyncDb(),
  };

  const service = createHotUpgradeService(mockHandle);

  assert.ok(service !== null);
  assert.ok(typeof service.registerVersionCompatibility === "function");
  assert.ok(typeof service.createUpgradePlan === "function");
});

// ─────────────────────────────────────────────────────────────────────────────
// SqliteHotUpgradeRepository direct tests
// ─────────────────────────────────────────────────────────────────────────────

test("SqliteHotUpgradeRepository upsertVersionCompatibility inserts new record", async () => {
  const db = createInMemoryDb();
  const repo = new SqliteHotUpgradeRepository(db);

  await repo.upsertVersionCompatibility({
    fromVersion: "v1.0",
    toVersion: "v2.0",
    compatibilityLevel: "full",
    migrationRequired: false,
    rollbackSupported: true,
  });

  const result = await repo.getVersionCompatibility("v1.0", "v2.0");

  assert.ok(result !== null);
  assert.equal(result!.fromVersion, "v1.0");
  assert.equal(result!.toVersion, "v2.0");
  assert.equal(result!.compatibilityLevel, "full");
});

test("SqliteHotUpgradeRepository upsertVersionCompatibility updates existing record", async () => {
  const db = createInMemoryDb();
  const repo = new SqliteHotUpgradeRepository(db);

  await repo.upsertVersionCompatibility({
    fromVersion: "v1.0",
    toVersion: "v2.0",
    compatibilityLevel: "full",
    migrationRequired: false,
    rollbackSupported: true,
  });

  await repo.upsertVersionCompatibility({
    fromVersion: "v1.0",
    toVersion: "v2.0",
    compatibilityLevel: "n_minus_1",
    migrationRequired: true,
    rollbackSupported: false,
  });

  const result = await repo.getVersionCompatibility("v1.0", "v2.0");

  assert.ok(result !== null);
  assert.equal(result!.compatibilityLevel, "n_minus_1");
  assert.equal(result!.migrationRequired, true);
  assert.equal(result!.rollbackSupported, false);
});

test("SqliteHotUpgradeRepository insertUpgradePlan and getUpgradePlan", async () => {
  const db = createInMemoryDb();
  const repo = new SqliteHotUpgradeRepository(db);

  const plan = {
    planId: "plan_123",
    upgradeId: "upgrade_456",
    createdAt: new Date().toISOString(),
    targets: [],
    batches: [],
    policy: {
      canaryPercent: 10,
      canaryBatches: 3,
      batchSize: 33,
      healthGates: [],
      rollbackOnFailure: true,
      maxUpgradeDurationMs: 1800000,
      compatibilityCheckEnabled: true,
    },
    currentPhase: "canary" as const,
    status: "pending" as const,
    startedAt: null,
    completedAt: null,
    rollbackTriggeredAt: null,
    rollbackReason: null,
  };

  await repo.insertUpgradePlan(plan);

  const retrieved = await repo.getUpgradePlan("plan_123");

  assert.ok(retrieved !== null);
  assert.equal(retrieved!.planId, "plan_123");
  assert.equal(retrieved!.upgradeId, "upgrade_456");
  assert.equal(retrieved!.status, "pending");
});

test("SqliteHotUpgradeRepository listUpgradePlansByStatus", async () => {
  const db = createInMemoryDb();
  const repo = new SqliteHotUpgradeRepository(db);

  const plan1 = {
    planId: "plan_1",
    upgradeId: "upgrade_1",
    createdAt: new Date().toISOString(),
    targets: [],
    batches: [],
    policy: { canaryPercent: 10, canaryBatches: 3, batchSize: 33, healthGates: [], rollbackOnFailure: true, maxUpgradeDurationMs: 1800000, compatibilityCheckEnabled: true },
    currentPhase: "canary" as const,
    status: "pending" as const,
    startedAt: null,
    completedAt: null,
    rollbackTriggeredAt: null,
    rollbackReason: null,
  };

  const plan2 = {
    planId: "plan_2",
    upgradeId: "upgrade_2",
    createdAt: new Date().toISOString(),
    targets: [],
    batches: [],
    policy: { canaryPercent: 10, canaryBatches: 3, batchSize: 33, healthGates: [], rollbackOnFailure: true, maxUpgradeDurationMs: 1800000, compatibilityCheckEnabled: true },
    currentPhase: "canary" as const,
    status: "pending" as const,
    startedAt: null,
    completedAt: null,
    rollbackTriggeredAt: null,
    rollbackReason: null,
  };

  await repo.insertUpgradePlan(plan1);
  await repo.insertUpgradePlan(plan2);

  const pendingPlans = await repo.listUpgradePlansByStatus("pending");
  const completedPlans = await repo.listUpgradePlansByStatus("completed");

  assert.equal(pendingPlans.length, 2);
  assert.equal(completedPlans.length, 0);
});

test("SqliteHotUpgradeRepository insertUpgradeBatch and getUpgradeBatch", async () => {
  const db = createInMemoryDb();
  const repo = new SqliteHotUpgradeRepository(db);

  const batch = {
    batchId: "batch_123",
    upgradeId: "upgrade_456",
    batchNumber: 1,
    targetNodes: ["node1", "node2"],
    targetVersion: "v2.0",
    startedAt: new Date().toISOString(),
    completedAt: null,
    status: "pending" as const,
    healthChecks: [],
  };

  await repo.insertUpgradeBatch(batch);

  const retrieved = await repo.getUpgradeBatch("batch_123");

  assert.ok(retrieved !== null);
  assert.equal(retrieved!.batchId, "batch_123");
  assert.equal(retrieved!.batchNumber, 1);
  assert.deepEqual(retrieved!.targetNodes, ["node1", "node2"]);
});

test("SqliteHotUpgradeRepository listUpgradeBatchesByPlan", async () => {
  const db = createInMemoryDb();
  const repo = new SqliteHotUpgradeRepository(db);

  const batch1 = {
    batchId: "batch_1",
    upgradeId: "upgrade_456",
    batchNumber: 1,
    targetNodes: ["node1"],
    targetVersion: "v2.0",
    startedAt: new Date().toISOString(),
    completedAt: null,
    status: "pending" as const,
    healthChecks: [],
  };

  const batch2 = {
    batchId: "batch_2",
    upgradeId: "upgrade_456",
    batchNumber: 2,
    targetNodes: ["node2"],
    targetVersion: "v2.0",
    startedAt: new Date().toISOString(),
    completedAt: null,
    status: "pending" as const,
    healthChecks: [],
  };

  await repo.insertUpgradeBatch(batch1);
  await repo.insertUpgradeBatch(batch2);

  const batches = await repo.listUpgradeBatchesByPlan("upgrade_456");

  assert.equal(batches.length, 2);
  assert.equal(batches[0]!.batchNumber, 1);
  assert.equal(batches[1]!.batchNumber, 2);
});

test("SqliteHotUpgradeRepository updateUpgradeBatch updates status", async () => {
  const db = createInMemoryDb();
  const repo = new SqliteHotUpgradeRepository(db);

  const batch = {
    batchId: "batch_123",
    upgradeId: "upgrade_456",
    batchNumber: 1,
    targetNodes: ["node1"],
    targetVersion: "v2.0",
    startedAt: new Date().toISOString(),
    completedAt: null,
    status: "pending" as const,
    healthChecks: [],
  };

  await repo.insertUpgradeBatch(batch);

  const healthChecks = [
    {
      checkId: "check_1",
      checkType: "worker_health" as const,
      passed: true,
      message: "ok",
      checkedAt: new Date().toISOString(),
      details: {},
    },
  ];

  await repo.updateUpgradeBatch("batch_123", "completed", new Date().toISOString(), healthChecks);

  const retrieved = await repo.getUpgradeBatch("batch_123");

  assert.equal(retrieved!.status, "completed");
  assert.ok(retrieved!.completedAt !== null);
});

test("SqliteHotUpgradeRepository insertRollbackTrigger and listRollbackTriggersByUpgrade", async () => {
  const db = createInMemoryDb();
  const repo = new SqliteHotUpgradeRepository(db);

  const trigger = {
    triggerId: "trigger_123",
    upgradeId: "upgrade_456",
    reasonCode: "health_check_failed" as const,
    message: "Health check failed",
    detectedAt: new Date().toISOString(),
    metadata: { batchId: "batch_789" },
  };

  await repo.insertRollbackTrigger(trigger);

  const triggers = await repo.listRollbackTriggersByUpgrade("upgrade_456");

  assert.equal(triggers.length, 1);
  assert.equal(triggers[0]!.triggerId, "trigger_123");
  assert.equal(triggers[0]!.reasonCode, "health_check_failed");
});

test("SqliteHotUpgradeRepository insertUpgradeAudit and listUpgradeAudits", async () => {
  const db = createInMemoryDb();
  const repo = new SqliteHotUpgradeRepository(db);

  const audit = {
    id: "audit_123",
    upgradeId: "upgrade_456",
    eventType: "upgrade_started",
    actor: "system",
    message: "Upgrade started",
    details: { planId: "plan_789" },
    occurredAt: new Date().toISOString(),
  };

  await repo.insertUpgradeAudit(audit);

  const audits = await repo.listUpgradeAudits("upgrade_456");

  assert.equal(audits.length, 1);
  assert.equal(audits[0]!.eventType, "upgrade_started");
  assert.equal(audits[0]!.actor, "system");
});

test("SqliteHotUpgradeRepository listUpgradeAudits respects limit", async () => {
  const db = createInMemoryDb();
  const repo = new SqliteHotUpgradeRepository(db);

  for (let i = 0; i < 10; i++) {
    await repo.insertUpgradeAudit({
      id: `audit_${i}`,
      upgradeId: "upgrade_456",
      eventType: "test_event",
      actor: "system",
      message: `Audit ${i}`,
      details: null,
      occurredAt: new Date().toISOString(),
    });
  }

  const audits = await repo.listUpgradeAudits("upgrade_456", 5);

  assert.equal(audits.length, 5);
});

test("SqliteHotUpgradeRepository updateUpgradePlanStatus with all fields", async () => {
  const db = createInMemoryDb();
  const repo = new SqliteHotUpgradeRepository(db);

  const plan = {
    planId: "plan_123",
    upgradeId: "upgrade_456",
    createdAt: new Date().toISOString(),
    targets: [],
    batches: [],
    policy: { canaryPercent: 10, canaryBatches: 3, batchSize: 33, healthGates: [], rollbackOnFailure: true, maxUpgradeDurationMs: 1800000, compatibilityCheckEnabled: true },
    currentPhase: "canary" as const,
    status: "pending" as const,
    startedAt: null,
    completedAt: null,
    rollbackTriggeredAt: null,
    rollbackReason: null,
  };

  await repo.insertUpgradePlan(plan);

  await repo.updateUpgradePlanStatus("plan_123", "in_progress", {
    startedAt: new Date().toISOString(),
  });

  const retrieved = await repo.getUpgradePlan("plan_123");

  assert.equal(retrieved!.status, "in_progress");
  assert.ok(retrieved!.startedAt !== null);
});

test("SqliteHotUpgradeRepository updateUpgradePlanStatus with rollback fields", async () => {
  const db = createInMemoryDb();
  const repo = new SqliteHotUpgradeRepository(db);

  const plan = {
    planId: "plan_123",
    upgradeId: "upgrade_456",
    createdAt: new Date().toISOString(),
    targets: [],
    batches: [],
    policy: { canaryPercent: 10, canaryBatches: 3, batchSize: 33, healthGates: [], rollbackOnFailure: true, maxUpgradeDurationMs: 1800000, compatibilityCheckEnabled: true },
    currentPhase: "canary" as const,
    status: "in_progress" as const,
    startedAt: new Date().toISOString(),
    completedAt: null,
    rollbackTriggeredAt: null,
    rollbackReason: null,
  };

  await repo.insertUpgradePlan(plan);

  await repo.updateUpgradePlanStatus("plan_123", "failed", {
    rollbackTriggeredAt: new Date().toISOString(),
    rollbackReason: "Health check failed",
  });

  const retrieved = await repo.getUpgradePlan("plan_123");

  assert.equal(retrieved!.status, "failed");
  assert.ok(retrieved!.rollbackTriggeredAt !== null);
  assert.equal(retrieved!.rollbackReason, "Health check failed");
});

test("SqliteHotUpgradeRepository getVersionCompatibility returns null for non-existent", async () => {
  const db = createInMemoryDb();
  const repo = new SqliteHotUpgradeRepository(db);

  const result = await repo.getVersionCompatibility("non", "existent");

  assert.equal(result, null);
});

test("SqliteHotUpgradeRepository getUpgradeBatch returns null for non-existent", async () => {
  const db = createInMemoryDb();
  const repo = new SqliteHotUpgradeRepository(db);

  const result = await repo.getUpgradeBatch("non-existent");

  assert.equal(result, null);
});

test("SqliteHotUpgradeRepository getUpgradePlan returns null for non-existent", async () => {
  const db = createInMemoryDb();
  const repo = new SqliteHotUpgradeRepository(db);

  const result = await repo.getUpgradePlan("non-existent");

  assert.equal(result, null);
});

test("SqliteHotUpgradeRepository listRollbackTriggersByUpgrade returns empty for non-existent", async () => {
  const db = createInMemoryDb();
  const repo = new SqliteHotUpgradeRepository(db);

  const result = await repo.listRollbackTriggersByUpgrade("non-existent");

  assert.deepEqual(result, []);
});

test("SqliteHotUpgradeRepository listUpgradeAudits returns empty for non-existent", async () => {
  const db = createInMemoryDb();
  const repo = new SqliteHotUpgradeRepository(db);

  const result = await repo.listUpgradeAudits("non-existent");

  assert.deepEqual(result, []);
});
