/**
 * Unit Tests: Config Center Services
 *
 * Tests the actual APIs of ConfigAuditService, ConfigVersioningService,
 * HierarchicalConfigLoader, ConfigRolloutService, ConfigStore, and
 * ProtectedGovernanceIntegrityService.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ConfigAuditService } from "../../../../src/platform/five-plane-control-plane/config-center/config-audit-service.js";

import { ConfigVersioningService } from "../../../../src/platform/five-plane-control-plane/config-center/config-versioning-service.js";

import {
  HierarchicalConfigLoader,
} from "../../../../src/platform/five-plane-control-plane/config-center/hierarchical-config-loader.js";

import {
  ConfigRolloutService,
  type RolloutStage,
} from "../../../../src/platform/five-plane-control-plane/config-center/config-rollout-service.js";

import {
  ConfigStore,
} from "../../../../src/platform/five-plane-control-plane/config-center/config-store.js";

import {
  ProtectedGovernanceIntegrityService,
} from "../../../../src/platform/five-plane-control-plane/config-center/protected-governance-integrity-service.js";

// ============================================================================
// Config Audit Service Tests
// ============================================================================

test("ConfigAuditService records config creation", () => {
  const service = new ConfigAuditService();

  const entry = service.recordCreate(
    "feature_flags.enabled",
    "tenant",
    "tenant_123",
    { value: true },
    "admin",
    "Initial enablement",
  );

  assert.equal(entry.configPath, "feature_flags.enabled");
  assert.equal(entry.action, "create");
  assert.equal(entry.layer, "tenant");
  assert.equal(entry.sourceId, "tenant_123");
  assert.ok(entry.auditId.length > 0);
  assert.ok(entry.timestamp.length > 0);
});

test("ConfigAuditService records config update", () => {
  const service = new ConfigAuditService();

  const entry = service.recordUpdate(
    "rate_limit.max_requests",
    "tenant",
    "tenant_123",
    { value: 100 },
    { value: 200 },
    "admin",
    "Increasing limit",
  );

  assert.equal(entry.configPath, "rate_limit.max_requests");
  assert.equal(entry.action, "update");
  assert.ok(entry.beforeHash);
  assert.ok(entry.afterHash);
});

test("ConfigAuditService queries entries by config path", () => {
  const service = new ConfigAuditService();

  service.recordCreate("database.pool_size", "tenant", "tenant_123", { value: 25 }, "admin");

  const result = service.query({ configPath: "database.pool_size" });

  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0]?.configPath, "database.pool_size");
});

test("ConfigAuditService filters by layer", () => {
  const service = new ConfigAuditService();

  service.recordCreate("config_a", "platform", null, { value: 1 }, "system");
  service.recordCreate("config_b", "tenant", "tenant_123", { value: 2 }, "admin");

  const platformOnly = service.query({ layer: "platform" });

  assert.equal(platformOnly.entries.length, 1);
  assert.equal(platformOnly.entries[0]?.layer, "platform");
});

test("ConfigAuditService records approval", () => {
  const service = new ConfigAuditService();

  const entry = service.recordCreate(
    "security.jwt_expiry",
    "platform",
    null,
    { value: 3600 },
    "admin",
    "Initial setup",
  );

  const approved = service.recordApproval(entry.auditId, "security-admin");

  assert.ok(approved);
  assert.equal(approved?.approvalStatus, "approved");
  assert.equal(approved?.approvedBy, "security-admin");
});

test("ConfigAuditService records rejection", () => {
  const service = new ConfigAuditService();

  const entry = service.recordCreate(
    "critical.setting",
    "tenant",
    "tenant_456",
    { value: "risky" },
    "user",
    "Testing",
  );

  const rejected = service.recordRejection(entry.auditId, "admin", "Security risk");

  assert.ok(rejected);
  assert.equal(rejected?.approvalStatus, "rejected");
});

test("ConfigAuditService gets pending approvals", () => {
  const service = new ConfigAuditService();

  // Create with approval required
  service.recordCreate(
    "protected.config",
    "tenant",
    "tenant_123",
    { value: "new" },
    "user",
    "Change request",
    { approvalRequired: true },
  );

  const pending = service.getPendingApprovals("tenant");

  assert.equal(pending.length, 1);
  assert.equal(pending[0]?.approvalStatus, "pending");
});

test("ConfigAuditService gets stats for config path", () => {
  const service = new ConfigAuditService();

  service.recordCreate("test.config", "tenant", "tenant_123", { v: 1 }, "admin");
  service.recordUpdate("test.config", "tenant", "tenant_123", { v: 1 }, { v: 2 }, "admin");
  service.recordDelete("test.config", "tenant", "tenant_123", { v: 2 }, "admin");

  const stats = service.getStats("test.config", "tenant", "tenant_123");

  assert.equal(stats.totalEntries, 3);
  assert.equal(stats.createCount, 1);
  assert.equal(stats.updateCount, 1);
  assert.equal(stats.deleteCount, 1);
});

// ============================================================================
// Config Versioning Service Tests
// ============================================================================

test("ConfigVersioningService creates config version", () => {
  const service = new ConfigVersioningService();

  const snapshot = service.createVersion(
    "database.pool_size",
    "tenant",
    "tenant_123",
    { poolSize: 25 },
    "admin",
    "Initial setup",
  );

  assert.equal(snapshot.configPath, "database.pool_size");
  assert.equal(snapshot.layer, "tenant");
  assert.equal(snapshot.sourceId, "tenant_123");
  assert.ok(snapshot.versionId.length > 0);
  assert.ok(snapshot.contentHash.length > 0);
  assert.deepEqual(snapshot.content, { poolSize: 25 });
});

test("ConfigVersioningService retrieves current version", () => {
  const service = new ConfigVersioningService();

  service.createVersion(
    "cache.ttl",
    "tenant",
    "tenant_123",
    { ttl: 300 },
    "admin",
  );

  service.createVersion(
    "cache.ttl",
    "tenant",
    "tenant_123",
    { ttl: 600 },
    "admin",
  );

  const current = service.getCurrentVersion("cache.ttl", "tenant", "tenant_123");

  assert.ok(current);
  assert.deepEqual(current.content, { ttl: 600 });
});

test("ConfigVersioningService retrieves config history", () => {
  const service = new ConfigVersioningService();

  service.createVersion("api.rate_limit", "tenant", "tenant_123", { limit: 100 }, "admin");
  service.createVersion("api.rate_limit", "tenant", "tenant_123", { limit: 200 }, "admin");
  service.createVersion("api.rate_limit", "tenant", "tenant_123", { limit: 300 }, "admin");

  const history = service.getVersionHistory("api.rate_limit", "tenant", "tenant_123");

  assert.equal(history.length, 3);
  // History should be oldest first
  assert.deepEqual(history[0]?.content, { limit: 100 });
  assert.deepEqual(history[2]?.content, { limit: 300 });
});

test("ConfigVersioningService rolls back to previous version", () => {
  const service = new ConfigVersioningService();

  const v1 = service.createVersion("rollback.test", "tenant", "tenant_123", { value: "original" }, "admin");
  service.createVersion("rollback.test", "tenant", "tenant_123", { value: "modified" }, "admin");

  const rollback = service.rollback(v1.versionId, "admin", "Reverting to original");

  assert.ok(rollback);
  // Rollback creates a NEW version with old content
  assert.deepEqual(rollback.content, { value: "original" });
});

test("ConfigVersioningService computes diff between versions", () => {
  const service = new ConfigVersioningService();

  const v1 = service.createVersion("diff.test", "tenant", "tenant_123", { a: 1, b: 2 }, "admin");
  service.createVersion("diff.test", "tenant", "tenant_123", { a: 1, b: 3, c: 4 }, "admin");

  const diff = service.diffVersions(v1.versionId, service.getCurrentVersion("diff.test", "tenant", "tenant_123")!.versionId);

  assert.ok(diff);
  assert.equal(diff.additions, 1); // c:4
  assert.equal(diff.modifications, 1); // b:2->3
});

test("ConfigVersioningService creates rollback points", () => {
  const service = new ConfigVersioningService();

  service.createVersion("rollback_pt.test", "tenant", "tenant_123", { value: 1 }, "admin");

  const rollbackPoint = service.createRollbackPoint("rollback_pt.test", "tenant", "tenant_123", "admin");

  assert.ok(rollbackPoint);
  assert.equal(rollbackPoint.configPath, "rollback_pt.test");
  assert.ok(rollbackPoint.rollbackId.length > 0);
});

test("ConfigVersioningService gets rollback points", () => {
  const service = new ConfigVersioningService();

  service.createVersion("rb_points.test", "tenant", "tenant_123", { v: 1 }, "admin");
  service.createRollbackPoint("rb_points.test", "tenant", "tenant_123", "admin");

  const points = service.getRollbackPoints("rb_points.test", "tenant", "tenant_123");

  assert.equal(points.length, 1);
});

test("ConfigVersioningService gets specific version", () => {
  const service = new ConfigVersioningService();

  const created = service.createVersion("specific.test", "tenant", "tenant_123", { val: "test" }, "admin");

  const retrieved = service.getVersion(created.versionId);

  assert.ok(retrieved);
  assert.equal(retrieved?.versionId, created.versionId);
});

// ============================================================================
// Hierarchical Config Loader Tests
// ============================================================================

test("HierarchicalConfigLoader loads and merges configs", () => {
  const loader = new HierarchicalConfigLoader();

  const result = loader.loadConfig(
    { timeout: 30, retries: 3 }, // platform
    { tenant_123: { timeout: 60 } }, // tenant configs
    {}, // pack configs
    {}, // taskType configs
    "tenant_123", // activeTenantId
  );

  assert.deepEqual(result.merged.timeout, 60); // tenant overrides platform
  assert.deepEqual(result.merged.retries, 3); // platform only
});

test("HierarchicalConfigLoader applies layer precedence", () => {
  const loader = new HierarchicalConfigLoader();

  const result = loader.loadConfig(
    { level: "platform", value: 1 },
    { tenant_123: { level: "tenant", value: 2 } },
    { pack_abc: { level: "pack", value: 3 } },
    {},
    "tenant_123",
    "pack_abc",
  );

  assert.deepEqual(result.merged.level, "pack");
  assert.deepEqual(result.merged.value, 3);
});

test("HierarchicalConfigLoader returns sources in order", () => {
  const loader = new HierarchicalConfigLoader();

  const result = loader.loadConfig(
    { base: true },
    { tenant_123: { tenant: true } },
    { pack_abc: { pack: true } },
    {},
    "tenant_123",
    "pack_abc",
  );

  assert.equal(result.sources.length, 3);
  assert.equal(result.sources[0]?.layer, "platform");
  assert.equal(result.sources[1]?.layer, "tenant");
  assert.equal(result.sources[2]?.layer, "pack");
});

test("HierarchicalConfigLoader tracks layer map", () => {
  const loader = new HierarchicalConfigLoader();

  const result = loader.loadConfig(
    { platform_key: 1 },
    { tenant_123: { tenant_key: 2 } },
    {},
    {},
    "tenant_123",
  );

  assert.equal(result.layerMap.platform_key, "platform");
  assert.equal(result.layerMap.tenant_key, "tenant");
});

test("HierarchicalConfigLoader handles empty tenant", () => {
  const loader = new HierarchicalConfigLoader();

  const result = loader.loadConfig(
    { default: 42 },
    {}, // no tenant configs
    {},
    {},
    null, // no active tenant
  );

  assert.deepEqual(result.merged.default, 42);
});

test("HierarchicalConfigLoader supports environment and runtime layers", () => {
  const loader = new HierarchicalConfigLoader();

  const result = loader.loadConfig(
    { base: 1 },
    {},
    {},
    {},
    null,
    null,
    null,
    { env_dev: { env: "dev", base: 2 } }, // environment configs
    { runtime_1: { runtime: "instance-1", base: 3 } }, // runtime configs
    "env_dev", // activeEnvironmentId
    "runtime_1", // activeRuntimeId
  );

  assert.equal(result.merged.base, 3); // runtime has highest priority
  assert.equal(result.merged.env, "dev");
  assert.equal(result.merged.runtime, "instance-1");
});

// ============================================================================
// Config Rollout Service Tests
// ============================================================================

test("ConfigRolloutService starts a rollout", () => {
  const service = new ConfigRolloutService();

  const rollout = service.startRollout("feature.new_ui", "tenant", "tenant_123", 100);

  assert.equal(rollout.configPath, "feature.new_ui");
  assert.equal(rollout.layer, "tenant");
  assert.equal(rollout.sourceId, "tenant_123");
  assert.ok(rollout.rolloutId.length > 0);
});

test("ConfigRolloutService promotes rollout", () => {
  const service = new ConfigRolloutService();

  const rollout = service.startRollout("feature.test", "tenant", "tenant_123", 100);
  const promoted = service.promoteRollout(rollout.rolloutId);

  assert.ok(promoted);
  assert.notEqual(promoted.stage.phase, "pending");
});

test("ConfigRolloutService cancels rollout", () => {
  const service = new ConfigRolloutService();

  const rollout = service.startRollout("feature.cancel_me", "tenant", "tenant_123", 100);
  const cancelled = service.cancelRollout(rollout.rolloutId);

  assert.ok(cancelled);
  assert.equal(cancelled.stage.phase, "cancelled");
});

test("ConfigRolloutService gets active rollout", () => {
  const service = new ConfigRolloutService();

  const created = service.startRollout("feature.active", "tenant", "tenant_123", 100);
  const active = service.getActiveRollout("feature.active", "tenant", "tenant_123");

  assert.ok(active);
  assert.equal(active?.rolloutId, created.rolloutId);
});

test("ConfigRolloutService shouldApplyConfig determines application", () => {
  const service = new ConfigRolloutService();

  service.startRollout("feature.partial", "tenant", "tenant_123", 50);

  // With 50% rollout, deterministic hash determines application
  const decision = service.shouldApplyConfig("feature.partial", "tenant", "tenant_123", "tenant_123");

  assert.ok(decision.rolloutId != null);
  assert.ok(decision.percentage >= 0 && decision.percentage <= 100);
});

test("ConfigRolloutService gets all active rollouts", () => {
  const service = new ConfigRolloutService();

  service.startRollout("feature.1", "tenant", "tenant_1", 100);
  service.startRollout("feature.2", "tenant", "tenant_2", 100);

  const active = service.getActiveRollouts();

  assert.equal(active.length, 2);
});

test("ConfigRolloutService cleans up old completed rollouts", () => {
  const service = new ConfigRolloutService();

  service.startRollout("feature.cleanup", "tenant", "tenant_123", 100);

  // Manually complete the rollout
  const rollout = service.getActiveRollout("feature.cleanup", "tenant", "tenant_123");
  if (rollout) {
    service.cancelRollout(rollout.rolloutId);
  }

  const cleaned = service.cleanupRollouts(0); // 0ms max age = cleanup all completed

  assert.equal(cleaned, 1);
});

// ============================================================================
// Config Store Tests
// ============================================================================

test("ConfigStore stores and retrieves config", () => {
  const store = new ConfigStore();

  store.set("database.pool_size", 25);

  const retrieved = store.get<number>("database.pool_size");

  assert.equal(retrieved, 25);
});

test("ConfigStore returns undefined for missing key", () => {
  const store = new ConfigStore();

  const retrieved = store.get("nonexistent");

  assert.equal(retrieved, undefined);
});

test("ConfigStore has checks key existence", () => {
  const store = new ConfigStore();

  store.set("exists", true);

  assert.equal(store.has("exists"), true);
  assert.equal(store.has("not_exists"), false);
});

test("ConfigStore deletes key", () => {
  const store = new ConfigStore();

  store.set("to_delete", "value");
  const result = store.delete("to_delete");

  assert.equal(result, true);
  assert.equal(store.has("to_delete"), false);
});

test("ConfigStore increments version on set", () => {
  const store = new ConfigStore();

  const v1 = store.getVersion();
  store.set("key1", "value1");
  const v2 = store.getVersion();

  assert.ok(v2 > v1);
});

test("ConfigStore creates and restores snapshot", () => {
  const store = new ConfigStore();

  store.set("key1", "value1");
  store.set("key2", "value2");

  const snapshot = store.snapshot();

  assert.ok(snapshot.version > 0);
  assert.ok(snapshot.entries.key1);
  assert.ok(snapshot.entries.key2);

  // Restore
  store.clear();
  store.restore(snapshot);

  assert.equal(store.get("key1"), "value1");
  assert.equal(store.get("key2"), "value2");
});

test("ConfigStore merges values", () => {
  const store = new ConfigStore();

  store.set("existing", 1);
  store.merge({ new_key: "new_value", existing: 999 });

  assert.equal(store.get("new_key"), "new_value");
  assert.equal(store.get("existing"), 999);
});

test("ConfigStore onChange listener", () => {
  const store = new ConfigStore();

  let changeCount = 0;
  store.onChange(() => changeCount++);

  store.set("key1", "value1");
  store.set("key2", "value2");

  assert.equal(changeCount, 2);
});

// ============================================================================
// Protected Governance Integrity Service Tests
// ============================================================================

test("ProtectedGovernanceIntegrityService captures snapshot", () => {
  const service = new ProtectedGovernanceIntegrityService();

  const snapshot = service.captureSnapshot();

  assert.ok(snapshot.versionId.length > 0);
  assert.ok(snapshot.bundleHash.length > 0);
  assert.ok(snapshot.generatedAt.length > 0);
  assert.ok(Array.isArray(snapshot.surfaces));
});

test("ProtectedGovernanceIntegrityService detects tampering", () => {
  const service = new ProtectedGovernanceIntegrityService();

  const snapshot = service.captureSnapshot();
  const report = service.detectTampering(snapshot.versionId);

  assert.equal(report.checked, true);
  assert.equal(report.tampered, false);
  assert.ok(report.expectedVersion);
  assert.ok(report.currentVersion);
});

test("ProtectedGovernanceIntegrityService detects version mismatch", () => {
  const service = new ProtectedGovernanceIntegrityService();

  const report = service.detectTampering("wrong-version-id");

  assert.equal(report.checked, true);
  assert.equal(report.tampered, true);
  assert.ok(report.issues.length > 0);
});

test("ProtectedGovernanceIntegrityService captures surface details", () => {
  const service = new ProtectedGovernanceIntegrityService();

  const snapshot = service.captureSnapshot();

  const configSurface = snapshot.surfaces.find(s => s.surfaceId === "config");
  const divisionsSurface = snapshot.surfaces.find(s => s.surfaceId === "divisions");
  const agentsSurface = snapshot.surfaces.find(s => s.surfaceId === "agents");

  assert.ok(configSurface);
  assert.ok(divisionsSurface);
  assert.ok(agentsSurface);
});

test("ProtectedGovernanceIntegrityService snapshot has issues array", () => {
  const service = new ProtectedGovernanceIntegrityService();

  const snapshot = service.captureSnapshot();

  assert.ok(Array.isArray(snapshot.issues));
});

test("ProtectedGovernanceIntegrityService report has surfaces array", () => {
  const service = new ProtectedGovernanceIntegrityService();

  const report = service.detectTampering();

  assert.ok(Array.isArray(report.surfaces));
  assert.ok(report.surfaces.length > 0);
});