import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  CONTROL_PLANE_CAPABILITY_BASELINES,
  listControlPlaneCapabilityBaselines,
  resolveControlPlaneCapabilityBaseline,
  type ControlPlaneCapabilityId,
} from "../../../../src/platform/five-plane-control-plane/control-plane-baseline.js";

test("listControlPlaneCapabilityBaselines returns all 12 capability baselines", () => {
  const baselines = listControlPlaneCapabilityBaselines();
  assert.equal(baselines.length, 12, "expected 12 capability baselines");
});

test("listControlPlaneCapabilityBaselines returns frozen array", () => {
  const baselines = listControlPlaneCapabilityBaselines();
  assert.equal(Object.isFrozen(baselines), true, "baseline array should be frozen");
});

test("listControlPlaneCapabilityBaselines returns frozen baselineServices arrays", () => {
  const baselines = listControlPlaneCapabilityBaselines();
  for (const baseline of baselines) {
    assert.equal(
      Object.isFrozen(baseline.baselineServices),
      true,
      `baselineServices for ${baseline.capabilityId} should be frozen`,
    );
  }
});

test("CONTROL_PLANE_CAPABILITY_BASELINES contains approval-center capability", () => {
  const cap = CONTROL_PLANE_CAPABILITY_BASELINES.find(
    (b) => b.capabilityId === "approval-center",
  );
  assert.ok(cap, "approval-center capability should exist");
  assert.equal(cap.entryModule, "src/platform/five-plane-control-plane/approval-center/index.ts");
  assert.ok(cap.baselineServices.includes("ApprovalService"));
  assert.ok(cap.baselineServices.includes("ApprovalFlowEngine"));
});

test("CONTROL_PLANE_CAPABILITY_BASELINES contains audit-export capability", () => {
  const cap = CONTROL_PLANE_CAPABILITY_BASELINES.find(
    (b) => b.capabilityId === "audit-export",
  );
  assert.ok(cap, "audit-export capability should exist");
  assert.equal(cap.entryModule, "src/platform/five-plane-control-plane/audit-export/index.ts");
  assert.ok(cap.baselineServices.includes("AuditExportService"));
});

test("CONTROL_PLANE_CAPABILITY_BASELINES contains compliance capability", () => {
  const cap = CONTROL_PLANE_CAPABILITY_BASELINES.find(
    (b) => b.capabilityId === "compliance",
  );
  assert.ok(cap, "compliance capability should exist");
  assert.equal(cap.entryModule, "src/platform/five-plane-control-plane/compliance/index.ts");
  assert.ok(cap.baselineServices.includes("ErasureRequestService"));
});

test("CONTROL_PLANE_CAPABILITY_BASELINES contains config-center capability", () => {
  const cap = CONTROL_PLANE_CAPABILITY_BASELINES.find(
    (b) => b.capabilityId === "config-center",
  );
  assert.ok(cap, "config-center capability should exist");
  assert.equal(cap.entryModule, "src/platform/five-plane-control-plane/config-center/index.ts");
  assert.ok(cap.baselineServices.includes("ConfigGovernanceService"));
  assert.ok(cap.baselineServices.includes("ConfigVersioningService"));
});

test("CONTROL_PLANE_CAPABILITY_BASELINES contains cost-alert capability", () => {
  const cap = CONTROL_PLANE_CAPABILITY_BASELINES.find(
    (b) => b.capabilityId === "cost-alert",
  );
  assert.ok(cap, "cost-alert capability should exist");
  assert.equal(cap.entryModule, "src/platform/five-plane-control-plane/cost-alert/index.ts");
  assert.ok(cap.baselineServices.includes("CostAlertService"));
});

test("CONTROL_PLANE_CAPABILITY_BASELINES contains iam capability", () => {
  const cap = CONTROL_PLANE_CAPABILITY_BASELINES.find((b) => b.capabilityId === "iam");
  assert.ok(cap, "iam capability should exist");
  assert.equal(cap.entryModule, "src/platform/five-plane-control-plane/iam/index.ts");
  assert.ok(cap.baselineServices.includes("SecretManagementService"));
});

test("CONTROL_PLANE_CAPABILITY_BASELINES contains incident-control capability", () => {
  const cap = CONTROL_PLANE_CAPABILITY_BASELINES.find(
    (b) => b.capabilityId === "incident-control",
  );
  assert.ok(cap, "incident-control capability should exist");
  assert.equal(cap.entryModule, "src/platform/five-plane-control-plane/incident-control/index.ts");
  assert.ok(cap.baselineServices.includes("DoctorService"));
  assert.ok(cap.baselineServices.includes("ReleasePipelineService"));
});

test("CONTROL_PLANE_CAPABILITY_BASELINES contains policy-center capability", () => {
  const cap = CONTROL_PLANE_CAPABILITY_BASELINES.find(
    (b) => b.capabilityId === "policy-center",
  );
  assert.ok(cap, "policy-center capability should exist");
  assert.equal(cap.entryModule, "src/platform/five-plane-control-plane/policy-center/index.ts");
  assert.ok(cap.baselineServices.includes("PolicyCenterService"));
});

test("CONTROL_PLANE_CAPABILITY_BASELINES contains replay-repair-control capability", () => {
  const cap = CONTROL_PLANE_CAPABILITY_BASELINES.find(
    (b) => b.capabilityId === "replay-repair-control",
  );
  assert.ok(cap, "replay-repair-control capability should exist");
  assert.equal(
    cap.entryModule,
    "src/platform/five-plane-control-plane/replay-repair-control/index.ts",
  );
  assert.ok(cap.baselineServices.includes("ReplayRepairControlService"));
});

test("CONTROL_PLANE_CAPABILITY_BASELINES contains risk-control capability", () => {
  const cap = CONTROL_PLANE_CAPABILITY_BASELINES.find(
    (b) => b.capabilityId === "risk-control",
  );
  assert.ok(cap, "risk-control capability should exist");
  assert.equal(cap.entryModule, "src/platform/five-plane-control-plane/risk-control/index.ts");
  assert.ok(cap.baselineServices.includes("RiskEvaluationEngine"));
});

test("CONTROL_PLANE_CAPABILITY_BASELINES contains rollout-controller capability", () => {
  const cap = CONTROL_PLANE_CAPABILITY_BASELINES.find(
    (b) => b.capabilityId === "rollout-controller",
  );
  assert.ok(cap, "rollout-controller capability should exist");
  assert.equal(cap.entryModule, "src/platform/five-plane-control-plane/rollout-controller/index.ts");
  assert.ok(cap.baselineServices.includes("TrafficRoutingService"));
});

test("CONTROL_PLANE_CAPABILITY_BASELINES contains tenant capability", () => {
  const cap = CONTROL_PLANE_CAPABILITY_BASELINES.find((b) => b.capabilityId === "tenant");
  assert.ok(cap, "tenant capability should exist");
  assert.equal(cap.entryModule, "src/platform/five-plane-control-plane/tenant/index.ts");
  assert.ok(cap.baselineServices.includes("TenantBoundaryRegistryService"));
});

test("resolveControlPlaneCapabilityBaseline resolves valid capability", () => {
  const baseline = resolveControlPlaneCapabilityBaseline("approval-center");
  assert.equal(baseline.capabilityId, "approval-center");
  assert.equal(baseline.entryModule, "src/platform/five-plane-control-plane/approval-center/index.ts");
});

test("resolveControlPlaneCapabilityBaseline resolves iam capability", () => {
  const baseline = resolveControlPlaneCapabilityBaseline("iam");
  assert.equal(baseline.capabilityId, "iam");
  assert.equal(baseline.entryModule, "src/platform/five-plane-control-plane/iam/index.ts");
});

test("resolveControlPlaneCapabilityBaseline throws for unknown capability", () => {
  assert.throws(
    () => resolveControlPlaneCapabilityBaseline("unknown" as ControlPlaneCapabilityId),
    /control_plane_capability.not_found:unknown/,
  );
});

test("resolveControlPlaneCapabilityBaseline throws for invalid capability id", () => {
  assert.throws(
    () => resolveControlPlaneCapabilityBaseline("not-a-real-capability" as ControlPlaneCapabilityId),
    /control_plane_capability.not_found/,
  );
});

test("capability baselines have required fields [five-plane-control-plane]", () => {
  for (const baseline of CONTROL_PLANE_CAPABILITY_BASELINES) {
    assert.ok(typeof baseline.capabilityId === "string", "capabilityId should be string");
    assert.ok(typeof baseline.entryModule === "string", "entryModule should be string");
    assert.ok(typeof baseline.description === "string", "description should be string");
    assert.ok(Array.isArray(baseline.baselineServices), "baselineServices should be array");
    assert.ok(baseline.baselineServices.length > 0, "baselineServices should not be empty");
  }
});

test("each capability baseline has unique capabilityId", () => {
  const ids = CONTROL_PLANE_CAPABILITY_BASELINES.map((b) => b.capabilityId);
  const uniqueIds = new Set(ids);
  assert.equal(ids.length, uniqueIds.size, "capabilityIds should be unique");
});

test("all ControlPlaneCapabilityId values are present in baselines", () => {
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
  const baselineIds = CONTROL_PLANE_CAPABILITY_BASELINES.map((b) => b.capabilityId);
  for (const id of validIds) {
    assert.ok(
      baselineIds.includes(id),
      `${id} should be present in CONTROL_PLANE_CAPABILITY_BASELINES`,
    );
  }
});
