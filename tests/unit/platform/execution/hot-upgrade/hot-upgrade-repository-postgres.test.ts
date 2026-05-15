import assert from "node:assert/strict";
import test from "node:test";

import { PostgresHotUpgradeRepository } from "../../../../../src/platform/five-plane-execution/hot-upgrade/hot-upgrade-repository-postgres.js";
import type { HotUpgradeRepository, UpgradeAuditEntry } from "../../../../../src/platform/five-plane-execution/hot-upgrade/hot-upgrade-repository.js";
import type { UpgradePlan, UpgradeBatch, VersionCompatibility, RollbackTrigger } from "../../../../../src/platform/five-plane-execution/hot-upgrade/hot-upgrade-service.js";

// Mock AsyncSqlDatabase
function createMockAsyncDb() {
  const storage: Record<string, unknown[]> = {
    version_compatibility: [],
    upgrade_plans: [],
    upgrade_batches: [],
    rollback_triggers: [],
    upgrade_audit: [],
  };

  return {
    asyncConnection: {
      execute: async (sql: string, ...args: unknown[]) => {
        if (sql.includes("INSERT INTO version_compatibility") || sql.includes("ON CONFLICT")) {
          storage.version_compatibility.push({
            id: args[0],
            from_version: args[1],
            to_version: args[2],
            compatibility_level: args[3],
            migration_required: args[4],
            rollback_supported: args[5],
          });
          return { rowCount: 1 };
        } else if (sql.includes("INSERT INTO upgrade_plans")) {
          storage.upgrade_plans.push({
            plan_id: args[0],
            upgrade_id: args[1],
            created_at: args[2],
            targets_json: args[3],
            batches_json: args[4],
            policy_json: args[5],
            current_phase: args[6],
            status: args[7],
            started_at: args[8],
            completed_at: args[9],
            rollback_triggered_at: args[10],
            rollback_reason: args[11],
          });
          return { rowCount: 1 };
        } else if (sql.includes("INSERT INTO upgrade_batches")) {
          storage.upgrade_batches.push({
            batch_id: args[0],
            upgrade_id: args[1],
            batch_number: args[2],
            target_nodes_json: args[3],
            target_version: args[4],
            started_at: args[5],
            completed_at: args[6],
            status: args[7],
            health_checks_json: args[8],
          });
          return { rowCount: 1 };
        } else if (sql.includes("INSERT INTO rollback_triggers")) {
          storage.rollback_triggers.push({
            trigger_id: args[0],
            upgrade_id: args[1],
            reason_code: args[2],
            message: args[3],
            detected_at: args[4],
            metadata_json: args[5],
          });
          return { rowCount: 1 };
        } else if (sql.includes("INSERT INTO upgrade_audit")) {
          storage.upgrade_audit.push({
            id: args[0],
            upgrade_id: args[1],
            event_type: args[2],
            actor: args[3],
            message: args[4],
            details_json: args[5],
            occurred_at: args[6],
          });
          return { rowCount: 1 };
        } else if (sql.includes("UPDATE upgrade_plans")) {
          return { rowCount: 1 };
        } else if (sql.includes("UPDATE upgrade_batches")) {
          return { rowCount: 1 };
        }
        return { rowCount: 0 };
      },
    },
    storage,
  };
}

test("PostgresHotUpgradeRepository is instantiable", () => {
  const mockDb = createMockAsyncDb() as any;
  const repo = new PostgresHotUpgradeRepository(mockDb);
  assert.ok(repo instanceof PostgresHotUpgradeRepository);
});

test("PostgresHotUpgradeRepository implements HotUpgradeRepository interface", () => {
  const mockDb = createMockAsyncDb() as any;
  const repo = new PostgresHotUpgradeRepository(mockDb);

  // Version Compatibility
  assert.equal(typeof repo.upsertVersionCompatibility, "function");
  assert.equal(typeof repo.getVersionCompatibility, "function");

  // Upgrade Plans
  assert.equal(typeof repo.insertUpgradePlan, "function");
  assert.equal(typeof repo.updateUpgradePlanStatus, "function");
  assert.equal(typeof repo.getUpgradePlan, "function");
  assert.equal(typeof repo.listUpgradePlansByStatus, "function");

  // Upgrade Batches
  assert.equal(typeof repo.insertUpgradeBatch, "function");
  assert.equal(typeof repo.updateUpgradeBatch, "function");
  assert.equal(typeof repo.getUpgradeBatch, "function");
  assert.equal(typeof repo.listUpgradeBatchesByPlan, "function");

  // Rollback Triggers
  assert.equal(typeof repo.insertRollbackTrigger, "function");
  assert.equal(typeof repo.listRollbackTriggersByUpgrade, "function");

  // Audit
  assert.equal(typeof repo.insertUpgradeAudit, "function");
  assert.equal(typeof repo.listUpgradeAudits, "function");
});

test("PostgresHotUpgradeRepository.upsertVersionCompatibility inserts compatibility record with ON CONFLICT", async () => {
  const mockDb = createMockAsyncDb() as any;
  const repo = new PostgresHotUpgradeRepository(mockDb);

  const compat: VersionCompatibility = {
    fromVersion: "1.0.0",
    toVersion: "2.0.0",
    compatibilityLevel: "n_minus_1",
    migrationRequired: true,
    rollbackSupported: true,
  };

  await repo.upsertVersionCompatibility(compat);

  assert.equal(mockDb.storage.version_compatibility.length, 1);
  const saved = mockDb.storage.version_compatibility[0] as any;
  assert.equal(saved.from_version, "1.0.0");
  assert.equal(saved.to_version, "2.0.0");
  assert.equal(saved.compatibility_level, "n_minus_1");
  assert.equal(saved.migration_required, 1);
  assert.equal(saved.rollback_supported, 1);
});

test("PostgresHotUpgradeRepository.insertUpgradePlan inserts plan record", async () => {
  const mockDb = createMockAsyncDb() as any;
  const repo = new PostgresHotUpgradeRepository(mockDb);

  const plan: UpgradePlan = {
    planId: "plan-123",
    upgradeId: "upgrade-456",
    createdAt: "2024-01-01T00:00:00.000Z",
    targets: [],
    batches: [],
    policy: {
      canaryPercent: 10,
      canaryBatches: 1,
      batchSize: 5,
      healthGates: [],
      rollbackOnFailure: true,
      maxUpgradeDurationMs: 3600000,
      compatibilityCheckEnabled: true,
    },
    currentPhase: "canary",
    status: "pending",
    startedAt: null,
    completedAt: null,
    rollbackTriggeredAt: null,
    rollbackReason: null,
  };

  await repo.insertUpgradePlan(plan);

  assert.equal(mockDb.storage.upgrade_plans.length, 1);
  const saved = mockDb.storage.upgrade_plans[0] as any;
  assert.equal(saved.plan_id, "plan-123");
  assert.equal(saved.upgrade_id, "upgrade-456");
  assert.equal(saved.status, "pending");
});

test("PostgresHotUpgradeRepository.insertUpgradeBatch inserts batch record", async () => {
  const mockDb = createMockAsyncDb() as any;
  const repo = new PostgresHotUpgradeRepository(mockDb);

  const batch: UpgradeBatch = {
    batchId: "batch-123",
    upgradeId: "upgrade-456",
    batchNumber: 1,
    targetNodes: ["node-1", "node-2"],
    targetVersion: "2.0.0",
    startedAt: "2024-01-01T00:00:00.000Z",
    completedAt: null,
    status: "pending",
    healthChecks: [],
  };

  await repo.insertUpgradeBatch(batch);

  assert.equal(mockDb.storage.upgrade_batches.length, 1);
  const saved = mockDb.storage.upgrade_batches[0] as any;
  assert.equal(saved.batch_id, "batch-123");
  assert.equal(saved.upgrade_id, "upgrade-456");
  assert.equal(saved.batch_number, 1);
});

test("PostgresHotUpgradeRepository.insertRollbackTrigger inserts trigger record", async () => {
  const mockDb = createMockAsyncDb() as any;
  const repo = new PostgresHotUpgradeRepository(mockDb);

  const trigger: RollbackTrigger = {
    triggerId: "trigger-123",
    upgradeId: "upgrade-456",
    reasonCode: "health_check_failed",
    message: "Health check failed",
    detectedAt: "2024-01-01T00:00:00.000Z",
    metadata: { checkId: "check-1" },
  };

  await repo.insertRollbackTrigger(trigger);

  assert.equal(mockDb.storage.rollback_triggers.length, 1);
  const saved = mockDb.storage.rollback_triggers[0] as any;
  assert.equal(saved.trigger_id, "trigger-123");
  assert.equal(saved.upgrade_id, "upgrade-456");
  assert.equal(saved.reason_code, "health_check_failed");
});

test("PostgresHotUpgradeRepository.insertUpgradeAudit inserts audit record", async () => {
  const mockDb = createMockAsyncDb() as any;
  const repo = new PostgresHotUpgradeRepository(mockDb);

  const entry: UpgradeAuditEntry = {
    id: "audit-123",
    upgradeId: "upgrade-456",
    eventType: "upgrade_started",
    actor: "system",
    message: "Upgrade started",
    details: { planId: "plan-123" },
    occurredAt: "2024-01-01T00:00:00.000Z",
  };

  await repo.insertUpgradeAudit(entry);

  assert.equal(mockDb.storage.upgrade_audit.length, 1);
  const saved = mockDb.storage.upgrade_audit[0] as any;
  assert.equal(saved.id, "audit-123");
  assert.equal(saved.upgrade_id, "upgrade-456");
  assert.equal(saved.event_type, "upgrade_started");
});

test("PostgresHotUpgradeRepository.updateUpgradePlanStatus updates plan status", async () => {
  const mockDb = createMockAsyncDb() as any;
  const repo = new PostgresHotUpgradeRepository(mockDb);

  await repo.updateUpgradePlanStatus("plan-123", "in_progress", {
    startedAt: "2024-01-01T00:00:00.000Z",
  });

  // Verify no errors thrown - the mock just returns { rowCount: 1 }
  assert.ok(true);
});

test("PostgresHotUpgradeRepository.updateUpgradeBatch updates batch status", async () => {
  const mockDb = createMockAsyncDb() as any;
  const repo = new PostgresHotUpgradeRepository(mockDb);

  await repo.updateUpgradeBatch("batch-123", "completed", "2024-01-01T00:00:00.000Z", []);

  // Verify no errors thrown - the mock just returns { rowCount: 1 }
  assert.ok(true);
});
