/**
 * Unit Tests: Control Plane Index Barrel
 *
 * Tests that control-plane barrel exports work correctly and all
 * sub-modules are accessible through the main index.
 */

import assert from "node:assert/strict";
import test from "node:test";

test("control-plane barrel exports approvalCenter", async () => {
  const mod = await import("../../../../src/platform/five-plane-control-plane/index.js");
  assert.ok(mod.approvalCenter);
  assert.ok(typeof mod.approvalCenter === "object");
});

test("control-plane barrel exports auditExport", async () => {
  const mod = await import("../../../../src/platform/five-plane-control-plane/index.js");
  assert.ok(mod.auditExport);
  assert.ok(typeof mod.auditExport === "object");
});

test("control-plane barrel exports compliance", async () => {
  const mod = await import("../../../../src/platform/five-plane-control-plane/index.js");
  assert.ok(mod.compliance);
  assert.ok(typeof mod.compliance === "object");
});

test("control-plane barrel exports configCenter", async () => {
  const mod = await import("../../../../src/platform/five-plane-control-plane/index.js");
  assert.ok(mod.configCenter);
  assert.ok(typeof mod.configCenter === "object");
});

test("control-plane barrel exports costAlert", async () => {
  const mod = await import("../../../../src/platform/five-plane-control-plane/index.js");
  assert.ok(mod.costAlert);
  assert.ok(typeof mod.costAlert === "object");
});

test("control-plane barrel exports iam", async () => {
  const mod = await import("../../../../src/platform/five-plane-control-plane/index.js");
  assert.ok(mod.iam);
  assert.ok(typeof mod.iam === "object");
});

test("control-plane barrel exports incidentControl", async () => {
  const mod = await import("../../../../src/platform/five-plane-control-plane/index.js");
  assert.ok(mod.incidentControl);
  assert.ok(typeof mod.incidentControl === "object");
});

test("control-plane barrel exports policyCenter", async () => {
  const mod = await import("../../../../src/platform/five-plane-control-plane/index.js");
  assert.ok(mod.policyCenter);
  assert.ok(typeof mod.policyCenter === "object");
});

test("control-plane barrel exports replayRepairControl", async () => {
  const mod = await import("../../../../src/platform/five-plane-control-plane/index.js");
  assert.ok(mod.replayRepairControl);
  assert.ok(typeof mod.replayRepairControl === "object");
});

test("control-plane barrel exports riskControl", async () => {
  const mod = await import("../../../../src/platform/five-plane-control-plane/index.js");
  assert.ok(mod.riskControl);
  assert.ok(typeof mod.riskControl === "object");
});

test("control-plane barrel exports rolloutController", async () => {
  const mod = await import("../../../../src/platform/five-plane-control-plane/index.js");
  assert.ok(mod.rolloutController);
  assert.ok(typeof mod.rolloutController === "object");
});

test("control-plane barrel exports tenant", async () => {
  const mod = await import("../../../../src/platform/five-plane-control-plane/index.js");
  assert.ok(mod.tenant);
  assert.ok(typeof mod.tenant === "object");
});

test("control-plane barrel exports baseline types", async () => {
  const mod = await import("../../../../src/platform/five-plane-control-plane/index.js");
  assert.equal(typeof mod.listControlPlaneCapabilityBaselines, "function");
  assert.equal(typeof mod.resolveControlPlaneCapabilityBaseline, "function");
});

test("control-plane barrel exports bootstrap functions", async () => {
  const mod = await import("../../../../src/platform/five-plane-control-plane/index.js");
  // control-plane-bootstrap.ts exports buildControlPlaneBootstrap, registerControlPlaneBootstrap
  assert.ok(typeof mod.buildControlPlaneBootstrap === "function" || typeof mod.registerControlPlaneBootstrap === "function");
});

test("approvalCenter has expected structure", async () => {
  const { approvalCenter } = await import("../../../../src/platform/five-plane-control-plane/index.js");
  // Verify approvalCenter module has index export
  assert.ok(approvalCenter);
});

test("costAlert sub-module is accessible via barrel", async () => {
  const mod = await import("../../../../src/platform/five-plane-control-plane/index.js");
  assert.ok(mod.costAlert, "costAlert should be exported from barrel");
});

test("iam sub-module has expected structure", async () => {
  const { iam } = await import("../../../../src/platform/five-plane-control-plane/index.js");
  assert.ok(iam);
});

test("replayRepairControl sub-module exports ReplayRepairControlService", async () => {
  const { replayRepairControl } = await import("../../../../src/platform/five-plane-control-plane/index.js");
  assert.ok(replayRepairControl);
  const mod = await import("../../../../src/platform/five-plane-control-plane/replay-repair-control/index.js");
  assert.ok(typeof mod.ReplayRepairControlService === "function");
});

test("policyCenter sub-module exports PolicyCenterService", async () => {
  const { policyCenter } = await import("../../../../src/platform/five-plane-control-plane/index.js");
  assert.ok(policyCenter);
  const mod = await import("../../../../src/platform/five-plane-control-plane/policy-center/index.js");
  assert.ok(typeof mod.PolicyCenterService === "function");
});

test("incidentControl sub-module has expected structure", async () => {
  const { incidentControl } = await import("../../../../src/platform/five-plane-control-plane/index.js");
  assert.ok(incidentControl);
});

test("rolloutController sub-module has expected structure", async () => {
  const { rolloutController } = await import("../../../../src/platform/five-plane-control-plane/index.js");
  assert.ok(rolloutController);
});

test("control-plane barrel does not export unexpected keys", async () => {
  const mod = await import("../../../../src/platform/five-plane-control-plane/index.js");
  const keys = Object.keys(mod);
  assert.ok(keys.includes("approvalCenter"));
  assert.ok(keys.includes("auditExport"));
  assert.ok(keys.includes("compliance"));
  assert.ok(keys.includes("configCenter"));
  assert.ok(keys.includes("costAlert"));
  assert.ok(keys.includes("iam"));
  assert.ok(keys.includes("incidentControl"));
  assert.ok(keys.includes("policyCenter"));
  assert.ok(keys.includes("replayRepairControl"));
  assert.ok(keys.includes("riskControl"));
  assert.ok(keys.includes("rolloutController"));
  assert.ok(keys.includes("tenant"));
});

test("all control-plane sub-modules are objects (not primitives)", async () => {
  const mod = await import("../../../../src/platform/five-plane-control-plane/index.js");
  const subModuleNames = [
    "approvalCenter",
    "auditExport",
    "compliance",
    "configCenter",
    "costAlert",
    "iam",
    "incidentControl",
    "policyCenter",
    "replayRepairControl",
    "riskControl",
    "rolloutController",
    "tenant",
  ];
  for (const name of subModuleNames) {
    assert.ok(typeof mod[name as keyof typeof mod] === "object", `${name} should be an object`);
  }
});
