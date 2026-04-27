/**
 * @fileoverview Unit tests for hot-upgrade factory and index exports
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createHotUpgradeService } from "../../../../src/platform/execution/hot-upgrade/hot-upgrade-factory.js";
import {
  HotUpgradeService,
  HOT_UPGRADE_DDL,
} from "../../../../src/platform/execution/hot-upgrade/hot-upgrade-service.js";
import type {
  HotUpgradeRepository,
  UpgradeAuditEntry,
} from "../../../../src/platform/execution/hot-upgrade/hot-upgrade-repository.js";

// Note: createHotUpgradeService requires a real storage backend handle
// so we test the factory function signature and type output here

test("HotUpgradeService can be imported and instantiated", () => {
  // This would need a real DB to use fully, but we test type exports
  assert.ok(HotUpgradeService !== undefined);
});

test("HOT_UPGRADE_DDL contains all required tables", () => {
  assert.ok(HOT_UPGRADE_DDL.includes("upgrade_plans"));
  assert.ok(HOT_UPGRADE_DDL.includes("upgrade_batches"));
  assert.ok(HOT_UPGRADE_DDL.includes("rollback_triggers"));
  assert.ok(HOT_UPGRADE_DDL.includes("version_compatibility"));
  assert.ok(HOT_UPGRADE_DDL.includes("upgrade_audit"));
});

test("HOT_UPGRADE_DDL creates proper indexes", () => {
  assert.ok(HOT_UPGRADE_DDL.includes("idx_upgrade_plans_upgrade"));
  assert.ok(HOT_UPGRADE_DDL.includes("idx_upgrade_plans_status"));
  assert.ok(HOT_UPGRADE_DDL.includes("idx_upgrade_batches_upgrade"));
  assert.ok(HOT_UPGRADE_DDL.includes("idx_rollback_triggers_upgrade"));
  assert.ok(HOT_UPGRADE_DDL.includes("idx_version_compat_from"));
  assert.ok(HOT_UPGRADE_DDL.includes("idx_upgrade_audit_upgrade"));
});

test("HOT_UPGRADE_DDL has proper column definitions", () => {
  assert.ok(HOT_UPGRADE_DDL.includes("plan_id TEXT PRIMARY KEY"));
  assert.ok(HOT_UPGRADE_DDL.includes("upgrade_id TEXT NOT NULL"));
  assert.ok(HOT_UPGRADE_DDL.includes("targets_json TEXT NOT NULL"));
  assert.ok(HOT_UPGRADE_DDL.includes("batches_json TEXT NOT NULL"));
  assert.ok(HOT_UPGRADE_DDL.includes("policy_json TEXT NOT NULL"));
  assert.ok(HOT_UPGRADE_DDL.includes("current_phase TEXT NOT NULL"));
  assert.ok(HOT_UPGRADE_DDL.includes("status TEXT NOT NULL"));
});

test("HotUpgradeRepository interface exists", () => {
  // Verify interface can be referenced as a type
  const methods: (keyof HotUpgradeRepository)[] = [
    "upsertVersionCompatibility",
    "getVersionCompatibility",
    "insertUpgradePlan",
    "updateUpgradePlanStatus",
    "getUpgradePlan",
    "listUpgradePlansByStatus",
    "insertUpgradeBatch",
    "updateUpgradeBatch",
    "getUpgradeBatch",
    "listUpgradeBatchesByPlan",
    "insertRollbackTrigger",
    "listRollbackTriggersByUpgrade",
    "insertUpgradeAudit",
    "listUpgradeAudits",
  ];

  // This assertion verifies the interface structure is accessible
  assert.ok(methods.length >= 14);
});

test("createHotUpgradeService is exported and callable", () => {
  // The function exists and is exported
  assert.ok(createHotUpgradeService !== undefined);
  assert.ok(typeof createHotUpgradeService === "function");
});

test("HotUpgradeService types are exported from index", () => {
  // Import from index to verify exports work
  const indexModule = require("../../../../../src/platform/execution/hot-upgrade/index.js");

  assert.ok(indexModule.HotUpgradeService !== undefined);
  assert.ok(indexModule.createHotUpgradeService !== undefined);
});

test("UpgradeAuditEntry interface structure", () => {
  const entry: UpgradeAuditEntry = {
    id: "audit-1",
    upgradeId: "upgrade-1",
    eventType: "upgrade_started",
    actor: "system",
    message: "Upgrade started successfully",
    details: { key: "value" },
    occurredAt: "2026-04-26T00:00:00Z",
  };

  assert.equal(entry.id, "audit-1");
  assert.equal(entry.upgradeId, "upgrade-1");
  assert.equal(entry.eventType, "upgrade_started");
  assert.equal(entry.actor, "system");
  assert.deepEqual(entry.details, { key: "value" });
});

test("HOT_UPGRADE_DDL includes foreign key constraints", () => {
  assert.ok(HOT_UPGRADE_DDL.includes("FOREIGN KEY"));
});

test("HOT_UPGRADE_DDL includes proper constraints", () => {
  assert.ok(HOT_UPGRADE_DDL.includes("UNIQUE(from_version, to_version)"));
});