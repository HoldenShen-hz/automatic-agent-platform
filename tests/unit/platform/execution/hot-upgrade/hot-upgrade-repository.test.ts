import assert from "node:assert/strict";
import test from "node:test";

import { createHotUpgradeRepository, type HotUpgradeRepository, type UpgradeAuditEntry } from "../../../../../src/platform/execution/hot-upgrade/hot-upgrade-repository.js";

const mockSqliteBackend = {
  driver: "sqlite",
  sql: {} as any,
};

const mockPostgresBackend = {
  driver: "postgres",
  sql: {} as any,
  asyncSql: {} as any,
};

test("createHotUpgradeRepository creates repository for SQLite backend", () => {
  const repo = createHotUpgradeRepository(mockSqliteBackend);

  assert.ok(repo);
  assert.equal(typeof repo.upsertVersionCompatibility, "function");
  assert.equal(typeof repo.insertUpgradePlan, "function");
  assert.equal(typeof repo.insertUpgradeBatch, "function");
  assert.equal(typeof repo.insertRollbackTrigger, "function");
  assert.equal(typeof repo.insertUpgradeAudit, "function");
});

test("createHotUpgradeRepository creates repository for PostgreSQL backend", () => {
  const repo = createHotUpgradeRepository(mockPostgresBackend);

  assert.ok(repo);
  assert.equal(typeof repo.upsertVersionCompatibility, "function");
});

test("HotUpgradeRepository interface has all required methods for version compatibility", () => {
  const repo = createHotUpgradeRepository(mockSqliteBackend);

  assert.equal(typeof repo.upsertVersionCompatibility, "function");
  assert.equal(typeof repo.getVersionCompatibility, "function");
});

test("HotUpgradeRepository interface has all required methods for upgrade plans", () => {
  const repo = createHotUpgradeRepository(mockSqliteBackend);

  assert.equal(typeof repo.insertUpgradePlan, "function");
  assert.equal(typeof repo.updateUpgradePlanStatus, "function");
  assert.equal(typeof repo.getUpgradePlan, "function");
  assert.equal(typeof repo.listUpgradePlansByStatus, "function");
});

test("HotUpgradeRepository interface has all required methods for upgrade batches", () => {
  const repo = createHotUpgradeRepository(mockSqliteBackend);

  assert.equal(typeof repo.insertUpgradeBatch, "function");
  assert.equal(typeof repo.updateUpgradeBatch, "function");
  assert.equal(typeof repo.getUpgradeBatch, "function");
  assert.equal(typeof repo.listUpgradeBatchesByPlan, "function");
});

test("HotUpgradeRepository interface has all required methods for rollback triggers", () => {
  const repo = createHotUpgradeRepository(mockSqliteBackend);

  assert.equal(typeof repo.insertRollbackTrigger, "function");
  assert.equal(typeof repo.listRollbackTriggersByUpgrade, "function");
});

test("HotUpgradeRepository interface has all required methods for audit", () => {
  const repo = createHotUpgradeRepository(mockSqliteBackend);

  assert.equal(typeof repo.insertUpgradeAudit, "function");
  assert.equal(typeof repo.listUpgradeAudits, "function");
});

test("UpgradeAuditEntry interface structure", () => {
  const entry: UpgradeAuditEntry = {
    id: "audit_1",
    upgradeId: "upgrade_1",
    eventType: "upgrade_started",
    actor: "system",
    message: "Upgrade process initiated",
    details: { fromVersion: "1.0", toVersion: "2.0" },
    occurredAt: "2026-04-26T10:00:00Z",
  };

  assert.equal(entry.id, "audit_1");
  assert.equal(entry.upgradeId, "upgrade_1");
  assert.equal(entry.eventType, "upgrade_started");
  assert.ok(entry.details);
});

test("UpgradeAuditEntry details can be null", () => {
  const entry: UpgradeAuditEntry = {
    id: "audit_1",
    upgradeId: "upgrade_1",
    eventType: "upgrade_completed",
    actor: "system",
    message: "Upgrade completed successfully",
    details: null,
    occurredAt: "2026-04-26T11:00:00Z",
  };

  assert.equal(entry.details, null);
});

test("createHotUpgradeRepository returns same implementation type for same backend", () => {
  const sqliteRepo1 = createHotUpgradeRepository(mockSqliteBackend);
  const sqliteRepo2 = createHotUpgradeRepository(mockSqliteBackend);

  // Both should be the same implementation type
  assert.equal(sqliteRepo1.constructor.name, sqliteRepo2.constructor.name);
});

test("createHotUpgradeRepository returns different implementation types for different backends", () => {
  const sqliteRepo = createHotUpgradeRepository(mockSqliteBackend);
  const postgresRepo = createHotUpgradeRepository(mockPostgresBackend);

  // They should be different implementation types
  assert.notEqual(sqliteRepo.constructor.name, postgresRepo.constructor.name);
});
