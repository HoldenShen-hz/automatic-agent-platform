import assert from "node:assert/strict";
import test from "node:test";

import {
  buildControlPlaneBootstrap,
  registerControlPlaneBootstrap,
  CONTROL_PLANE_CATALOG_SERVICE_ID,
  CONTROL_PLANE_BOOTSTRAP_SERVICE_ID,
  type ControlPlaneBootstrap,
} from "../../../../src/platform/five-plane-control-plane/control-plane-bootstrap.js";
import { listControlPlaneCapabilityBaselines } from "../../../../src/platform/five-plane-control-plane/control-plane-baseline.js";

test("buildControlPlaneBootstrap returns correct planeId", () => {
  const bootstrap = buildControlPlaneBootstrap();
  assert.equal(bootstrap.planeId, "control-plane");
});

test("buildControlPlaneBootstrap returns catalog with all capability baselines", () => {
  const bootstrap = buildControlPlaneBootstrap();
  const baselines = listControlPlaneCapabilityBaselines();
  assert.equal(bootstrap.catalog.length, baselines.length);
  assert.ok(bootstrap.catalog.every((b) => baselines.includes(b)));
});

test("buildControlPlaneBootstrap returns registeredServiceIds with catalog and bootstrap service ids", () => {
  const bootstrap = buildControlPlaneBootstrap();
  assert.equal(bootstrap.registeredServiceIds.length, 2);
  assert.ok(bootstrap.registeredServiceIds.includes(CONTROL_PLANE_CATALOG_SERVICE_ID));
  assert.ok(bootstrap.registeredServiceIds.includes(CONTROL_PLANE_BOOTSTRAP_SERVICE_ID));
});

test("buildControlPlaneBootstrap returns frozen object", () => {
  const bootstrap = buildControlPlaneBootstrap();
  assert.equal(Object.isFrozen(bootstrap), true);
});

test("buildControlPlaneBootstrap returns frozen catalog array", () => {
  const bootstrap = buildControlPlaneBootstrap();
  assert.equal(Object.isFrozen(bootstrap.catalog), true);
});

test("buildControlPlaneBootstrap catalog contains expected control plane capabilities", () => {
  const bootstrap = buildControlPlaneBootstrap();
  const capabilityIds = bootstrap.catalog.map((b) => b.capabilityId);

  // All control plane capabilities should be present
  assert.ok(capabilityIds.includes("approval-center"));
  assert.ok(capabilityIds.includes("audit-export"));
  assert.ok(capabilityIds.includes("compliance"));
  assert.ok(capabilityIds.includes("config-center"));
  assert.ok(capabilityIds.includes("cost-alert"));
  assert.ok(capabilityIds.includes("iam"));
  assert.ok(capabilityIds.includes("incident-control"));
  assert.ok(capabilityIds.includes("policy-center"));
  assert.ok(capabilityIds.includes("replay-repair-control"));
  assert.ok(capabilityIds.includes("risk-control"));
  assert.ok(capabilityIds.includes("rollout-controller"));
  assert.ok(capabilityIds.includes("tenant"));
});

test("buildControlPlaneBootstrap catalog entries have required fields", () => {
  const bootstrap = buildControlPlaneBootstrap();
  for (const baseline of bootstrap.catalog) {
    assert.ok(typeof baseline.capabilityId === "string");
    assert.ok(typeof baseline.entryModule === "string");
    assert.ok(typeof baseline.description === "string");
    assert.ok(Array.isArray(baseline.baselineServices));
    assert.ok(baseline.baselineServices.length > 0);
  }
});

test("registerControlPlaneBootstrap returns ControlPlaneBootstrap", () => {
  const bootstrap = registerControlPlaneBootstrap();
  assert.equal(bootstrap.planeId, "control-plane");
  assert.ok(Array.isArray(bootstrap.catalog));
  assert.ok(Array.isArray(bootstrap.registeredServiceIds));
});

test("CONTROL_PLANE_CATALOG_SERVICE_ID has expected value", () => {
  assert.equal(CONTROL_PLANE_CATALOG_SERVICE_ID, "plane.control.catalog");
});

test("CONTROL_PLANE_BOOTSTRAP_SERVICE_ID has expected value", () => {
  assert.equal(CONTROL_PLANE_BOOTSTRAP_SERVICE_ID, "plane.control.bootstrap");
});

test("ControlPlaneBootstrap interface shape is correct", () => {
  const bootstrap = buildControlPlaneBootstrap();

  // TypeScript interface validation at runtime
  const typedBootstrap = bootstrap as ControlPlaneBootstrap;
  assert.equal(typedBootstrap.planeId, "control-plane");
  assert.ok(Array.isArray(typedBootstrap.catalog));
  assert.ok(Array.isArray(typedBootstrap.registeredServiceIds));
});
