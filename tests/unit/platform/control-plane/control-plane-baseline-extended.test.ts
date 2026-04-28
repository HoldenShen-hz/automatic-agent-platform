/**
 * Extended unit tests for Control Plane Baseline functions
 * Tests listControlPlaneCapabilityBaselines and resolveControlPlaneCapabilityBaseline
 * with additional edge cases and validation
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  CONTROL_PLANE_CAPABILITY_BASELINES,
  listControlPlaneCapabilityBaselines,
  resolveControlPlaneCapabilityBaseline,
  type ControlPlaneCapabilityId,
} from "../../../../src/platform/control-plane/control-plane-baseline.js";

test("listControlPlaneCapabilityBaselines returns all capability baselines", () => {
  const baselines = listControlPlaneCapabilityBaselines();

  assert.ok(baselines.length > 0);
  assert.equal(baselines.length, CONTROL_PLANE_CAPABILITY_BASELINES.length);
});

test("listControlPlaneCapabilityBaselines returns frozen array", () => {
  const baselines = listControlPlaneCapabilityBaselines();

  assert.equal(Object.isFrozen(baselines), true);
});

test("each baseline has required fields", () => {
  const baselines = listControlPlaneCapabilityBaselines();

  for (const baseline of baselines) {
    assert.ok(baseline.capabilityId);
    assert.ok(baseline.entryModule);
    assert.ok(baseline.description);
    assert.ok(Array.isArray(baseline.baselineServices));
    assert.ok(baseline.baselineServices.length > 0);
  }
});

test("all capability IDs are unique", () => {
  const baselines = listControlPlaneCapabilityBaselines();
  const ids = baselines.map((b) => b.capabilityId);
  const uniqueIds = new Set(ids);

  assert.equal(ids.length, uniqueIds.size);
});

test("resolveControlPlaneCapabilityBaseline resolves all valid capability IDs", () => {
  const baselines = listControlPlaneCapabilityBaselines();

  for (const baseline of baselines) {
    const resolved = resolveControlPlaneCapabilityBaseline(baseline.capabilityId);
    assert.equal(resolved.capabilityId, baseline.capabilityId);
    assert.equal(resolved.entryModule, baseline.entryModule);
  }
});

test("resolveControlPlaneCapabilityBaseline throws for unknown capability", () => {
  assert.throws(
    () => resolveControlPlaneCapabilityBaseline("unknown-capability" as ControlPlaneCapabilityId),
    /control_plane_capability.not_found/,
  );
});

test("all capability IDs are valid ControlPlaneCapabilityId type", () => {
  const validIds: ControlPlaneCapabilityId[] = [
    "approval-center",
    "audit-export",
    "compliance",
    "config-center",
    "cost-alert",
    "iam",
    "incident-control",
    "policy-center",
    "replay-repair-control",
    "risk-control",
    "rollout-controller",
    "tenant",
  ];

  const baselines = listControlPlaneCapabilityBaselines();
  const baselineIds = baselines.map((b) => b.capabilityId);

  for (const id of validIds) {
    assert.ok(
      baselineIds.includes(id),
      `Expected ${id} to be in baseline capability IDs`,
    );
  }
});

test("entryModule paths are valid TypeScript module paths", () => {
  const baselines = listControlPlaneCapabilityBaselines();

  for (const baseline of baselines) {
    assert.ok(baseline.entryModule.startsWith("src/platform/control-plane/"));
    assert.ok(baseline.entryModule.endsWith(".ts") || baseline.entryModule.endsWith("/index.ts"));
  }
});

test("approval-center baseline has correct structure", () => {
  const baseline = resolveControlPlaneCapabilityBaseline("approval-center");

  assert.equal(baseline.capabilityId, "approval-center");
  assert.ok(baseline.description.length > 0);
  assert.ok(baseline.baselineServices.includes("ApprovalService"));
});

test("incident-control baseline includes DoctorService and ReleasePipelineService", () => {
  const baseline = resolveControlPlaneCapabilityBaseline("incident-control");

  assert.ok(baseline.baselineServices.includes("DoctorService"));
  assert.ok(baseline.baselineServices.includes("ReleasePipelineService"));
});

test("risk-control baseline includes RiskEvaluationEngine", () => {
  const baseline = resolveControlPlaneCapabilityBaseline("risk-control");

  assert.ok(baseline.baselineServices.includes("RiskEvaluationEngine"));
});

test("compliance baseline includes ErasureRequestService", () => {
  const baseline = resolveControlPlaneCapabilityBaseline("compliance");

  assert.ok(baseline.baselineServices.includes("ErasureRequestService"));
});

test("config-center baseline includes ConfigGovernanceService and ConfigVersioningService", () => {
  const baseline = resolveControlPlaneCapabilityBaseline("config-center");

  assert.ok(baseline.baselineServices.includes("ConfigGovernanceService"));
  assert.ok(baseline.baselineServices.includes("ConfigVersioningService"));
});

test("rollout-controller baseline includes TrafficRoutingService", () => {
  const baseline = resolveControlPlaneCapabilityBaseline("rollout-controller");

  assert.ok(baseline.baselineServices.includes("TrafficRoutingService"));
});

test("tenant baseline includes TenantManagementService", () => {
  const baseline = resolveControlPlaneCapabilityBaseline("tenant");

  assert.ok(baseline.baselineServices.includes("TenantManagementService"));
});

test("audit-export baseline includes AuditExportService", () => {
  const baseline = resolveControlPlaneCapabilityBaseline("audit-export");

  assert.ok(baseline.baselineServices.includes("AuditExportService"));
});

test("cost-alert baseline includes CostAlertService", () => {
  const baseline = resolveControlPlaneCapabilityBaseline("cost-alert");

  assert.ok(baseline.baselineServices.includes("CostAlertService"));
});

test("iam baseline includes SecretManagementService", () => {
  const baseline = resolveControlPlaneCapabilityBaseline("iam");

  assert.ok(baseline.baselineServices.includes("SecretManagementService"));
});

test("policy-center baseline includes PolicyRegistryService", () => {
  const baseline = resolveControlPlaneCapabilityBaseline("policy-center");

  assert.ok(baseline.baselineServices.includes("PolicyRegistryService"));
});

test("replay-repair-control baseline includes ReplayRepairControlService", () => {
  const baseline = resolveControlPlaneCapabilityBaseline("replay-repair-control");

  assert.ok(baseline.baselineServices.includes("ReplayRepairControlService"));
});

test("baseline services arrays are readonly", () => {
  const baseline = resolveControlPlaneCapabilityBaseline("approval-center");

  assert.equal(Object.isFrozen(baseline.baselineServices), true);
});

test("baseline descriptions are non-empty", () => {
  const baselines = listControlPlaneCapabilityBaselines();

  for (const baseline of baselines) {
    assert.ok(baseline.description.length > 0, `Empty description for ${baseline.capabilityId}`);
  }
});

test("each baseline description mentions the capability", () => {
  const baselines = listControlPlaneCapabilityBaselines();
  const expectedKeywords: Record<string, string[]> = {
    "approval-center": ["approval"],
    "audit-export": ["audit", "export"],
    "compliance": ["compliance", "erasure"],
    "config-center": ["config", "configuration", "rollout"],
    "cost-alert": ["cost", "budget", "alert"],
    iam: ["iam", "secret", "sandbox"],
    "incident-control": ["incident", "doctor", "deployment"],
    "policy-center": ["policy"],
    "replay-repair-control": ["replay", "repair"],
    "risk-control": ["risk", "safety"],
    "rollout-controller": ["rollout", "traffic"],
    tenant: ["tenant", "tenancy"],
  };

  for (const baseline of baselines) {
    const description = baseline.description.toLowerCase();
    assert.ok(
      expectedKeywords[baseline.capabilityId]?.some((keyword) => description.includes(keyword)) ?? false,
      `Description for ${baseline.capabilityId} should be relevant`,
    );
  }
});
