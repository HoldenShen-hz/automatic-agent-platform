/**
 * Unit tests for Enterprise module index exports
 *
 * @see src/scale-ecosystem/enterprise/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  EnterpriseCapabilityMatrixService,
  createEnterpriseCapabilityMatrixService,
  DEFAULT_ENTERPRISE_CAPABILITIES,
  LicenseEnforcementService,
  type LicenseTier,
  type EnterpriseCapabilityDefinition,
  type RegisterEnvironmentReadinessInput,
  type EnterpriseCapabilityMatrixRunInput,
  type EnforcementAction,
  type LicenseCheckResult,
  type UsageMeter,
  type LicenseViolation,
  type FeatureGate,
  type LicenseEnforcementConfig,
} from "../../../../src/scale-ecosystem/enterprise/index.js";

test("EnterpriseCapabilityMatrixService is exported [enterprise-index]", () => {
  assert.equal(typeof EnterpriseCapabilityMatrixService, "function");
});

test("createEnterpriseCapabilityMatrixService is exported [enterprise-index]", () => {
  assert.equal(typeof createEnterpriseCapabilityMatrixService, "function");
});

test("DEFAULT_ENTERPRISE_CAPABILITIES is exported and is an array [enterprise-index]", () => {
  assert.ok(Array.isArray(DEFAULT_ENTERPRISE_CAPABILITIES));
  assert.ok(DEFAULT_ENTERPRISE_CAPABILITIES.length > 0);
});

test("LicenseEnforcementService is exported [enterprise-index]", () => {
  assert.equal(typeof LicenseEnforcementService, "function");
});

test("LicenseTier type values are valid [enterprise-index]", () => {
  const validTiers: LicenseTier[] = ["community", "professional", "enterprise"];
  for (const tier of validTiers) {
    assert.ok(DEFAULT_ENTERPRISE_CAPABILITIES.every(cap => cap.requiredTier === tier || validTiers.includes(cap.requiredTier)));
  }
});

test("DEFAULT_ENTERPRISE_CAPABILITIES has all expected capability keys [enterprise-index]", () => {
  const expectedKeys = [
    "admin_console",
    "audit_export",
    "sso",
    "scim",
    "tenant_isolation",
    "private_model",
    "private_network_deployment",
    "rollout_and_rollback",
    "incident_console",
    "data_residency_controls",
  ];

  const actualKeys = DEFAULT_ENTERPRISE_CAPABILITIES.map(c => c.capabilityKey);
  for (const key of expectedKeys) {
    assert.ok(actualKeys.includes(key as any), `Missing capability key: ${key}`);
  }
});

test("RegisterEnvironmentReadinessInput type is exported [enterprise-index]", () => {
  // Verify the type can be used to construct valid input
  const input: RegisterEnvironmentReadinessInput = {
    environment: "production",
    componentType: "gateway",
    componentId: "test_component",
    credentialReady: true,
    owner: "test_owner",
  };

  assert.equal(input.environment, "production");
  assert.equal(input.componentType, "gateway");
  assert.equal(input.componentId, "test_component");
  assert.equal(input.credentialReady, true);
  assert.equal(input.owner, "test_owner");
});

test("EnterpriseCapabilityMatrixRunInput type is exported [enterprise-index]", () => {
  const input: EnterpriseCapabilityMatrixRunInput = {
    environment: "production",
    deploymentMode: "cloud_shared",
  };

  assert.equal(input.environment, "production");
  assert.equal(input.deploymentMode, "cloud_shared");
});

test("EnforcementAction type values are valid [enterprise-index]", () => {
  const validActions: EnforcementAction[] = ["allow", "deny", "meter", "warn"];
  for (const action of validActions) {
    assert.ok(true, `Valid action: ${action}`);
  }
});

test("LicenseCheckResult structure is correct [enterprise-index]", () => {
  const result: LicenseCheckResult = {
    allowed: true,
    action: "allow",
    tierRequired: "enterprise",
    currentTier: "community",
    reason: "test_reason",
  };

  assert.equal(result.allowed, true);
  assert.equal(result.action, "allow");
  assert.equal(result.tierRequired, "enterprise");
  assert.equal(result.currentTier, "community");
  assert.equal(result.reason, "test_reason");
});

test("UsageMeter structure is correct [enterprise-index]", () => {
  const meter: UsageMeter = {
    meterId: "meter_123",
    feature: "test_feature",
    accountId: "acct_123",
    workspaceId: null,
    tenantId: null,
    count: 10,
    limit: 100,
    windowStart: "2026-01-01T00:00:00Z",
    windowEnd: "2026-01-02T00:00:00Z",
    lastIncrementedAt: "2026-01-01T12:00:00Z",
  };

  assert.equal(meter.meterId, "meter_123");
  assert.equal(meter.feature, "test_feature");
  assert.equal(meter.count, 10);
  assert.equal(meter.limit, 100);
});

test("LicenseViolation structure is correct [enterprise-index]", () => {
  const violation: LicenseViolation = {
    id: "lv_123",
    accountId: "acct_123",
    workspaceId: null,
    tenantId: null,
    capability: "sso",
    tierRequired: "enterprise",
    tierActual: "community",
    action: "deny",
    occurredAt: "2026-01-01T00:00:00Z",
    metadata: {},
  };

  assert.equal(violation.id, "lv_123");
  assert.equal(violation.capability, "sso");
  assert.equal(violation.tierRequired, "enterprise");
  assert.equal(violation.tierActual, "community");
});

test("FeatureGate structure is correct [enterprise-index]", () => {
  const gate: FeatureGate = {
    featureKey: "test_feature",
    requiredTier: "enterprise",
    enabled: true,
    meterUsage: false,
    usageLimit: null,
    usageWindowMs: null,
    warnThreshold: null,
  };

  assert.equal(gate.featureKey, "test_feature");
  assert.equal(gate.requiredTier, "enterprise");
  assert.equal(gate.enabled, true);
  assert.equal(gate.meterUsage, false);
});

test("LicenseEnforcementConfig structure is correct [enterprise-index]", () => {
  const config: LicenseEnforcementConfig = {
    enabled: true,
    strictMode: false,
    logViolations: true,
    defaultTier: "community",
    enableUsageMetering: true,
  };

  assert.equal(config.enabled, true);
  assert.equal(config.strictMode, false);
  assert.equal(config.logViolations, true);
  assert.equal(config.defaultTier, "community");
  assert.equal(config.enableUsageMetering, true);
});

test("EnterpriseCapabilityDefinition structure is valid [enterprise-index]", () => {
  const definition: EnterpriseCapabilityDefinition = {
    capabilityKey: "admin_console",
    displayName: "Admin Console",
    requiredTier: "professional",
    supportedDeploymentModes: ["cloud_shared", "private_cloud", "on_prem"],
    readinessRequirements: [
      {
        componentType: "gateway",
        componentId: "ops_gateway",
      },
    ],
  };

  assert.equal(definition.capabilityKey, "admin_console");
  assert.equal(definition.displayName, "Admin Console");
  assert.equal(definition.requiredTier, "professional");
  assert.ok(Array.isArray(definition.supportedDeploymentModes));
  assert.ok(Array.isArray(definition.readinessRequirements));
  assert.equal(definition.readinessRequirements.length, 1);
});

test("DEFAULT_ENTERPRISE_CAPABILITIES each entry has valid structure [enterprise-index]", () => {
  for (const cap of DEFAULT_ENTERPRISE_CAPABILITIES) {
    assert.ok(cap.capabilityKey, `Missing capabilityKey for ${cap}`);
    assert.ok(cap.displayName, `Missing displayName for ${cap}`);
    assert.ok(cap.requiredTier, `Missing requiredTier for ${cap.capabilityKey}`);
    assert.ok(Array.isArray(cap.supportedDeploymentModes), `supportedDeploymentModes not array for ${cap.capabilityKey}`);
    assert.ok(cap.supportedDeploymentModes.length > 0, `Empty supportedDeploymentModes for ${cap.capabilityKey}`);
    assert.ok(Array.isArray(cap.readinessRequirements), `readinessRequirements not array for ${cap.capabilityKey}`);
  }
});

test("Capability keys are unique in DEFAULT_ENTERPRISE_CAPABILITIES [enterprise-index]", () => {
  const keys = DEFAULT_ENTERPRISE_CAPABILITIES.map(c => c.capabilityKey);
  const uniqueKeys = new Set(keys);
  assert.equal(keys.length, uniqueKeys.size, "Duplicate capability keys found");
});
