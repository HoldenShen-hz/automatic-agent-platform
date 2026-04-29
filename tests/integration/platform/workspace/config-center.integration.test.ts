/**
 * Integration Tests: Config Center
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  ConfigAuditService,
} from "../../../../../src/platform/five-plane-control-plane/config-center/config-audit-service.js";

import {
  ConfigVersioningService,
} from "../../../../../src/platform/five-plane-control-plane/config-center/config-versioning-service.js";

import {
  HierarchicalConfigLoader,
} from "../../../../../src/platform/five-plane-control-plane/config-center/hierarchical-config-loader.js";

import {
  ConfigRolloutService,
} from "../../../../../src/platform/five-plane-control-plane/config-center/config-rollout-service.js";

import {
  ConfigStore,
} from "../../../../../src/platform/five-plane-control-plane/config-center/config-store.js";

import {
  ProtectedGovernanceIntegrityService,
} from "../../../../../src/platform/five-plane-control-plane/config-center/protected-governance-integrity-service.js";

// ============================================================================
// Config Center End-to-End Integration Tests
// ============================================================================

test("integration: config change creates audit trail with versioning", () => {
  const auditService = new ConfigAuditService();
  const versionService = new ConfigVersioningService();

  auditService.recordChange({
    configKey: "database.pool_size",
    action: "update",
    previousValue: "10",
    newValue: "25",
    changedBy: "dba_team",
    tenantId: "tenant_config_001",
  });

  versionService.createVersion({
    configKey: "database.pool_size",
    value: 25,
    versionNumber: 1,
    createdBy: "dba_team",
    tenantId: "tenant_config_001",
  });

  const auditTrail = auditService.queryChangesByTenant("tenant_config_001");
  const versions = versionService.getVersionHistory("database.pool_size", "tenant_config_001");

  assert.equal(auditTrail.length, 1);
  assert.equal(versions.length, 1);
  assert.equal(auditTrail[0].newValue, "25");
  assert.equal(versions[0].value, 25);
});

test("integration: hierarchical config resolution", () => {
  const loader = new HierarchicalConfigLoader();

  loader.load({ level: "platform", key: "log_level", value: "info" });
  loader.load({ level: "tenant", key: "log_level", value: "debug", tenantId: "tenant_hier_001" });
  loader.load({ level: "workspace", key: "log_level", value: "trace", workspaceId: "ws_hier_001", tenantId: "tenant_hier_001" });

  const platformValue = loader.resolve("log_level", "platform");
  const tenantValue = loader.resolve("log_level", "tenant", "tenant_hier_001");
  const workspaceValue = loader.resolve("log_level", "workspace", "ws_hier_001");

  assert.equal(platformValue?.value, "info");
  assert.equal(tenantValue?.value, "debug");
  assert.equal(workspaceValue?.value, "trace");
});

test("integration: config rollout with gradual percentage increase", () => {
  const rolloutService = new ConfigRolloutService();

  const rollout = rolloutService.initiateRollout({
    configKey: "feature.beta_flag",
    targetValue: true,
    targets: [{ targetId: "tenant_rollout_001", targetType: "tenant" }],
    rolloutStrategy: "gradual",
    percentage: 10,
  });

  assert.equal(rollout.status, "in_progress");
  assert.equal(rollout.percentage, 10);

  rolloutService.updateRolloutPercentage(rollout.rolloutId, 25);
  const updated1 = rolloutService.getRollout(rollout.rolloutId);
  assert.equal(updated1.percentage, 25);

  rolloutService.updateRolloutPercentage(rollout.rolloutId, 50);
  const updated2 = rolloutService.getRollout(rollout.rolloutId);
  assert.equal(updated2.percentage, 50);

  rolloutService.completeRollout(rollout.rolloutId);
  const completed = rolloutService.getRollout(rollout.rolloutId);
  assert.equal(completed.status, "completed");
});

test("integration: protected governance drift detection", () => {
  const integrityService = new ProtectedGovernanceIntegrityService();
  const auditService = new ConfigAuditService();

  integrityService.recordBaseline({
    protectedConfigKey: "security.min_password_length",
    expectedValue: 12,
    tenantId: "tenant_protected_001",
  });

  auditService.recordChange({
    configKey: "security.min_password_length",
    action: "update",
    previousValue: "12",
    newValue: "8",
    changedBy: "unauthorized_user",
    tenantId: "tenant_protected_001",
  });

  const drift = integrityService.detectDrift({
    protectedConfigKey: "security.min_password_length",
    expectedValue: 12,
    actualValue: 8,
    tenantId: "tenant_protected_001",
  });

  assert.equal(drift.hasDrift, true);
  assert.equal(drift.severity, "high");
});

test("integration: config store with versioning rollback", () => {
  const store = new ConfigStore();
  const versionService = new ConfigVersioningService();

  store.set("api.timeout", 30, "tenant_version_001");
  versionService.createVersion({
    configKey: "api.timeout",
    value: 30,
    versionNumber: 1,
    createdBy: "admin",
    tenantId: "tenant_version_001",
  });

  store.set("api.timeout", 60, "tenant_version_001");
  versionService.createVersion({
    configKey: "api.timeout",
    value: 60,
    versionNumber: 2,
    createdBy: "admin",
    tenantId: "tenant_version_001",
  });

  const rollback = versionService.rollback("api.timeout", "tenant_version_001");
  assert.equal(rollback.success, true);

  const current = store.get("api.timeout", "tenant_version_001");
  assert.equal(rollback.newVersionNumber, 3);
});

test("integration: full config governance workflow", () => {
  const auditService = new ConfigAuditService();
  const versionService = new ConfigVersioningService();
  const integrityService = new ProtectedGovernanceIntegrityService();

  integrityService.recordBaseline({
    protectedConfigKey: "rate_limit.max_requests",
    expectedValue: 1000,
    tenantId: "tenant_gov_001",
  });

  auditService.recordChange({
    configKey: "rate_limit.max_requests",
    action: "update",
    previousValue: "1000",
    newValue: "2000",
    changedBy: "admin",
    tenantId: "tenant_gov_001",
  });

  versionService.createVersion({
    configKey: "rate_limit.max_requests",
    value: 2000,
    versionNumber: 1,
    createdBy: "admin",
    tenantId: "tenant_gov_001",
  });

  const drift = integrityService.detectDrift({
    protectedConfigKey: "rate_limit.max_requests",
    expectedValue: 1000,
    actualValue: 2000,
    tenantId: "tenant_gov_001",
  });

  const auditTrail = auditService.queryChangesByTenant("tenant_gov_001");
  const versions = versionService.getVersionHistory("rate_limit.max_requests", "tenant_gov_001");

  assert.equal(drift.hasDrift, true);
  assert.equal(auditTrail.length, 1);
  assert.equal(versions.length, 1);
});
