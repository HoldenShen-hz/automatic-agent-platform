import assert from "node:assert/strict";
import test from "node:test";

import type {
  LicenseTier,
  RegisterEnvironmentReadinessInput,
  CapabilityRequirementRef,
  EnterpriseCapabilityDefinition,
  EnterpriseCapabilityMatrixEntry,
  EnterpriseCapabilitySummary,
  EnterpriseCapabilityMatrixReport,
  EnterpriseCapabilityMatrixRunInput,
  EnterpriseCapabilityMatrixRunResult,
  EnterpriseCapabilityMatrixExportResult,
  EnterpriseCapabilityMatrixServiceOptions,
} from "../../../../src/scale-ecosystem/marketplace/enterprise-capability-matrix-service.js";
import type { EnvironmentName, DeploymentMode, EnvironmentReadinessComponentType } from "../../../../src/platform/contracts/types/domain.js";

test("LicenseTier accepts all valid values", () => {
  const tiers: LicenseTier[] = ["community", "professional", "enterprise"];
  assert.equal(tiers.length, 3);

  for (const tier of tiers) {
    const result: LicenseTier = tier;
    assert.ok(result === tier);
  }
});

test("EnvironmentName accepts all valid values", () => {
  const names: EnvironmentName[] = ["dev", "test", "staging", "pre-prod", "prod"];
  assert.equal(names.length, 5);
});

test("DeploymentMode accepts all valid values", () => {
  const modes: DeploymentMode[] = ["cloud_shared", "private_cloud", "on_prem"];
  assert.equal(modes.length, 3);
});

test("EnvironmentReadinessComponentType accepts all valid values", () => {
  const types: EnvironmentReadinessComponentType[] = [
    "provider",
    "gateway",
    "sandbox",
    "worker_fleet",
    "artifact_store",
  ];
  assert.equal(types.length, 5);
});

test("RegisterEnvironmentReadinessInput structure is correct", () => {
  const input: RegisterEnvironmentReadinessInput = {
    readinessId: "ready_123",
    environment: "prod",
    componentType: "provider",
    componentId: "aws_primary",
    credentialReady: true,
    secondaryGates: { ssl: true, backup: true },
    owner: "ops_team",
    lastVerifiedAt: "2026-04-14T00:00:00.000Z",
    isActive: true,
    notes: "All systems operational",
  };

  assert.equal(input.readinessId, "ready_123");
  assert.equal(input.environment, "prod");
  assert.equal(input.componentType, "provider");
  assert.equal(input.credentialReady, true);
  assert.equal(input.isActive, true);
});

test("RegisterEnvironmentReadinessInput allows minimal definition", () => {
  const input: RegisterEnvironmentReadinessInput = {
    environment: "staging",
    componentType: "gateway",
    componentId: "gateway_primary",
    credentialReady: true,
    owner: "platform_team",
  };

  assert.equal(input.environment, "staging");
  assert.equal(input.secondaryGates, undefined);
  assert.equal(input.isActive, undefined);
  assert.equal(input.notes, undefined);
});

test("CapabilityRequirementRef structure is correct", () => {
  const ref: CapabilityRequirementRef = {
    componentType: "sandbox",
    componentId: "sandbox_primary",
    gateKey: "isolation",
  };

  assert.equal(ref.componentType, "sandbox");
  assert.equal(ref.gateKey, "isolation");
});

test("CapabilityRequirementRef allows minimal definition", () => {
  const ref: CapabilityRequirementRef = {
    componentType: "worker_fleet",
    componentId: "workers_primary",
  };

  assert.equal(ref.componentType, "worker_fleet");
  assert.equal(ref.gateKey, undefined);
});

test("EnterpriseCapabilityDefinition structure is correct", () => {
  const def: EnterpriseCapabilityDefinition = {
    capabilityKey: "admin_console",
    displayName: "Admin Console",
    requiredTier: "professional",
    supportedDeploymentModes: ["cloud_shared", "on_prem"],
    readinessRequirements: [
      { componentType: "provider", componentId: "provider_primary" },
      { componentType: "gateway", componentId: "gateway_primary" },
    ],
  };

  assert.equal(def.capabilityKey, "admin_console");
  assert.equal(def.requiredTier, "professional");
  assert.equal(def.supportedDeploymentModes.length, 2);
  assert.equal(def.readinessRequirements.length, 2);
});

test("EnterpriseCapabilityMatrixEntry structure is correct", () => {
  const entry: EnterpriseCapabilityMatrixEntry = {
    capabilityKey: "sso",
    displayName: "Single Sign-On",
    status: "available",
    requiredTier: "enterprise",
    requiredDeploymentModes: ["cloud_shared", "private_cloud", "on_prem"],
    reasonCodes: ["all_gates_passed"],
    readiness: [
      {
        componentType: "provider",
        componentId: "okta_idp",
        gateKey: "saml_config",
        status: "ready",
        recordId: "ready_sso_1",
      },
    ],
  };

  assert.equal(entry.capabilityKey, "sso");
  assert.equal(entry.status, "available");
  assert.equal(entry.reasonCodes.length, 1);
  assert.equal(entry.readiness.length, 1);
});

test("EnterpriseCapabilityMatrixEntry status accepts all valid values", () => {
  const statuses: EnterpriseCapabilityMatrixEntry["status"][] = [
    "available",
    "degraded",
    "blocked",
  ];

  for (const status of statuses) {
    const entry: EnterpriseCapabilityMatrixEntry = {
      capabilityKey: "admin_console",
      displayName: "Admin Console",
      status,
      requiredTier: "professional",
      requiredDeploymentModes: ["cloud_shared"],
      reasonCodes: ["test"],
      readiness: [],
    };
    assert.ok(entry.status === status);
  }
});

test("EnterpriseCapabilitySummary structure is correct", () => {
  const summary: EnterpriseCapabilitySummary = {
    available: 7,
    degraded: 2,
    blocked: 1,
    total: 10,
    overallVerdict: "partial",
  };

  assert.equal(summary.total, 10);
  assert.equal(summary.available, 7);
  assert.equal(summary.degraded, 2);
  assert.equal(summary.overallVerdict, "partial");
});

test("EnterpriseCapabilitySummary overallVerdict accepts all valid values", () => {
  const verdicts: EnterpriseCapabilitySummary["overallVerdict"][] = [
    "ready",
    "partial",
    "blocked",
  ];

  for (const verdict of verdicts) {
    const summary: EnterpriseCapabilitySummary = {
      available: 5,
      degraded: 0,
      blocked: 0,
      total: 5,
      overallVerdict: verdict,
    };
    assert.ok(summary.overallVerdict === verdict);
  }
});

test("EnterpriseCapabilityMatrixReport structure is correct", () => {
  const report: EnterpriseCapabilityMatrixReport = {
    reportId: "report_cap_123",
    generatedAt: "2026-04-14T00:00:00.000Z",
    environment: "prod",
    deploymentMode: "cloud_shared",
    tier: "enterprise",
    accountId: "acc_456",
    workspaceId: null,
    tenantId: "tenant_abc",
    summary: {
      available: 8,
      degraded: 1,
      blocked: 1,
      total: 10,
      overallVerdict: "partial",
    },
    entries: [],
  };

  assert.equal(report.reportId, "report_cap_123");
  assert.equal(report.tier, "enterprise");
  assert.equal(report.environment, "prod");
  assert.equal(report.summary.overallVerdict, "partial");
});

test("EnterpriseCapabilityMatrixRunInput structure is correct", () => {
  const input: EnterpriseCapabilityMatrixRunInput = {
    accountId: "acc_xyz",
    workspaceId: "ws_123",
    tenantId: "tenant_xyz",
    environment: "prod",
    deploymentMode: "private_cloud",
    generatedAt: "2026-04-14T12:00:00.000Z",
  };

  assert.equal(input.accountId, "acc_xyz");
  assert.equal(input.environment, "prod");
  assert.equal(input.deploymentMode, "private_cloud");
});

test("EnterpriseCapabilityMatrixRunInput allows minimal definition", () => {
  const input: EnterpriseCapabilityMatrixRunInput = {
    environment: "staging",
    deploymentMode: "on_prem",
  };

  assert.equal(input.accountId, undefined);
  assert.equal(input.tenantId, undefined);
});

test("EnterpriseCapabilityMatrixServiceOptions structure is correct", () => {
  const options: EnterpriseCapabilityMatrixServiceOptions = {
    artifactStoreOptions: {
      rootDir: "/var/capabilities/artifacts",
    },
    capabilityDefinitions: [],
  };

  assert.ok(options.artifactStoreOptions !== undefined);
  assert.equal(options.artifactStoreOptions?.rootDir, "/var/capabilities/artifacts");
});

test("EnterpriseCapabilityMatrixServiceOptions allows empty options", () => {
  const options: EnterpriseCapabilityMatrixServiceOptions = {};
  assert.equal(options.artifactStoreOptions, undefined);
  assert.equal(options.capabilityDefinitions, undefined);
});
