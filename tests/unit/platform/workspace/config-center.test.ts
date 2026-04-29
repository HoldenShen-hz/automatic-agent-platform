/**
 * Unit Tests: Config Center
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  ConfigAuditService,
  type ConfigAuditRecord,
  type AuditAction,
} from "../../../../src/platform/five-plane-control-plane/config-center/config-audit-service.js";

import {
  ConfigVersioningService,
  type ConfigVersion,
  type ConfigSnapshot,
} from "../../../../src/platform/five-plane-control-plane/config-center/config-versioning-service.js";

import {
  HierarchicalConfigLoader,
  type ConfigNode,
} from "../../../../src/platform/five-plane-control-plane/config-center/hierarchical-config-loader.js";

import {
  ConfigRolloutService,
  type RolloutTarget,
  type RolloutStatus,
} from "../../../../src/platform/five-plane-control-plane/config-center/config-rollout-service.js";

import {
  ConfigStore,
  type StoredConfig,
} from "../../../../src/platform/five-plane-control-plane/config-center/config-store.js";

import {
  ProtectedGovernanceIntegrityService,
  type ProtectedGovernanceDriftReport,
} from "../../../../src/platform/five-plane-control-plane/config-center/protected-governance-integrity-service.js";

// ============================================================================
// Config Audit Service Tests
// ============================================================================

test("ConfigAuditService records config change", () => {
  const service = new ConfigAuditService();

  const record = service.recordChange({
    configKey: "feature_flags.enabled",
    action: "update",
    previousValue: "false",
    newValue: "true",
    changedBy: "admin",
    tenantId: "tenant_123",
  });

  assert.equal(record.configKey, "feature_flags.enabled");
  assert.equal(record.action, "update");
  assert.equal(record.previousValue, "false");
  assert.equal(record.newValue, "true");
  assert.equal(record.changedBy, "admin");
  assert.ok(record.auditedAt.length > 0);
});

test("ConfigAuditService queries changes by tenant", () => {
  const service = new ConfigAuditService();

  service.recordChange({
    configKey: "rate_limit.max_requests",
    action: "update",
    changedBy: "admin",
    tenantId: "tenant_123",
  });

  service.recordChange({
    configKey: "timeout.default",
    action: "update",
    changedBy: "admin",
    tenantId: "tenant_456",
  });

  const changes = service.queryChangesByTenant("tenant_123");

  assert.equal(changes.length, 1);
  assert.equal(changes[0].configKey, "rate_limit.max_requests");
});

test("ConfigAuditService detects drift from baseline", () => {
  const service = new ConfigAuditService();

  service.recordChange({
    configKey: "security.jwt_expiry",
    action: "update",
    previousValue: "3600",
    newValue: "7200",
    changedBy: "unauthorized_user",
    tenantId: "tenant_123",
  });

  const drift = service.detectDrift({
    configKey: "security.jwt_expiry",
    baselineValue: "3600",
    tenantId: "tenant_123",
  });

  assert.equal(drift.drifted, true);
  assert.equal(drift.currentValue, "7200");
});

// ============================================================================
// Config Versioning Service Tests
// ============================================================================

test("ConfigVersioningService creates config version", () => {
  const service = new ConfigVersioningService();

  const version = service.createVersion({
    configKey: "database.pool_size",
    value: 25,
    versionNumber: 1,
    createdBy: "admin",
    tenantId: "tenant_123",
  });

  assert.equal(version.configKey, "database.pool_size");
  assert.equal(version.value, 25);
  assert.equal(version.versionNumber, 1);
  assert.ok(version.versionId.length > 0);
  assert.ok(version.createdAt.length > 0);
});

test("ConfigVersioningService retrieves config history", () => {
  const service = new ConfigVersioningService();

  service.createVersion({
    configKey: "cache.ttl",
    value: 300,
    versionNumber: 1,
    createdBy: "admin",
    tenantId: "tenant_123",
  });

  service.createVersion({
    configKey: "cache.ttl",
    value: 600,
    versionNumber: 2,
    createdBy: "admin",
    tenantId: "tenant_123",
  });

  const history = service.getVersionHistory("cache.ttl", "tenant_123");

  assert.equal(history.length, 2);
  assert.equal(history[0].versionNumber, 2);
  assert.equal(history[1].versionNumber, 1);
});

test("ConfigVersioningService rolls back to previous version", () => {
  const service = new ConfigVersioningService();

  service.createVersion({
    configKey: "api.rate_limit",
    value: 100,
    versionNumber: 1,
    createdBy: "admin",
    tenantId: "tenant_123",
  });

  service.createVersion({
    configKey: "api.rate_limit",
    value: 200,
    versionNumber: 2,
    createdBy: "admin",
    tenantId: "tenant_123",
  });

  const rollback = service.rollback("api.rate_limit", "tenant_123");

  assert.ok(rollback.success);
  assert.equal(rollback.newVersionNumber, 3);
});

// ============================================================================
// Hierarchical Config Loader Tests
// ============================================================================

test("HierarchicalConfigLoader resolves platform config", () => {
  const loader = new HierarchicalConfigLoader();

  loader.load({
    level: "platform",
    key: "default_timeout",
    value: 30,
  });

  const resolved = loader.resolve("default_timeout", "platform");

  assert.equal(resolved?.value, 30);
});

test("HierarchicalConfigLoader tenant overrides platform", () => {
  const loader = new HierarchicalConfigLoader();

  loader.load({ level: "platform", key: "max_retries", value: 3 });
  loader.load({ level: "tenant", key: "max_retries", value: 5, tenantId: "tenant_123" });

  const globalResolved = loader.resolve("max_retries");
  const tenantResolved = loader.resolve("max_retries", "tenant", "tenant_123");

  assert.equal(globalResolved?.value, 3);
  assert.equal(tenantResolved?.value, 5);
});

test("HierarchicalConfigLoader workspace overrides tenant", () => {
  const loader = new HierarchicalConfigLoader();

  loader.load({ level: "tenant", key: "log_level", value: "info", tenantId: "tenant_123" });
  loader.load({ level: "workspace", key: "log_level", value: "debug", workspaceId: "ws_001" });

  const tenantResolved = loader.resolve("log_level", "tenant", "tenant_123");
  const workspaceResolved = loader.resolve("log_level", "workspace", "ws_001");

  assert.equal(tenantResolved?.value, "info");
  assert.equal(workspaceResolved?.value, "debug");
});

// ============================================================================
// Config Rollout Service Tests
// ============================================================================

test("ConfigRolloutService initiates rollout", () => {
  const service = new ConfigRolloutService();

  const rollout = service.initiateRollout({
    configKey: "feature.new_ui",
    targetValue: true,
    targets: [{ targetId: "tenant_123", targetType: "tenant" }],
    rolloutStrategy: "gradual",
    percentage: 10,
  });

  assert.equal(rollout.configKey, "feature.new_ui");
  assert.equal(rollout.status, "in_progress");
  assert.equal(rollout.percentage, 10);
  assert.ok(rollout.rolloutId.length > 0);
});

test("ConfigRolloutService pauses rollout", () => {
  const service = new ConfigRolloutService();

  const rollout = service.initiateRollout({
    configKey: "feature.beta",
    targetValue: true,
    targets: [{ targetId: "tenant_123", targetType: "tenant" }],
    rolloutStrategy: "all_at_once",
  });

  const paused = service.pauseRollout(rollout.rolloutId);

  assert.equal(paused.status, "paused");
});

test("ConfigRolloutService completes rollout", () => {
  const service = new ConfigRolloutService();

  const rollout = service.initiateRollout({
    configKey: "feature.stable",
    targetValue: true,
    targets: [{ targetId: "tenant_123", targetType: "tenant" }],
    rolloutStrategy: "all_at_once",
  });

  const completed = service.completeRollout(rollout.rolloutId);

  assert.equal(completed.status, "completed");
  assert.ok(completed.completedAt.length > 0);
});

// ============================================================================
// Config Store Tests
// ============================================================================

test("ConfigStore stores and retrieves config", () => {
  const store = new ConfigStore();

  store.set("database.pool_size", 25, "tenant_123");

  const retrieved = store.get("database.pool_size", "tenant_123");

  assert.equal(retrieved?.value, 25);
  assert.equal(retrieved?.tenantId, "tenant_123");
});

test("ConfigStore returns null for missing config", () => {
  const store = new ConfigStore();

  const retrieved = store.get("nonexistent.key", "tenant_123");

  assert.equal(retrieved, null);
});

// ============================================================================
// Protected Governance Integrity Service Tests
// ============================================================================

test("ProtectedGovernanceIntegrityService detects drift", () => {
  const service = new ProtectedGovernanceIntegrityService();

  const report = service.detectDrift({
    protectedConfigKey: "security.min_password_length",
    expectedValue: 12,
    actualValue: 8,
    tenantId: "tenant_123",
  });

  assert.equal(report.hasDrift, true);
  assert.equal(report.protectedConfigKey, "security.min_password_length");
  assert.equal(report.severity, "high");
});

test("ProtectedGovernanceIntegrityService returns no drift when values match", () => {
  const service = new ProtectedGovernanceIntegrityService();

  const report = service.detectDrift({
    protectedConfigKey: "security.min_password_length",
    expectedValue: 12,
    actualValue: 12,
    tenantId: "tenant_123",
  });

  assert.equal(report.hasDrift, false);
});
