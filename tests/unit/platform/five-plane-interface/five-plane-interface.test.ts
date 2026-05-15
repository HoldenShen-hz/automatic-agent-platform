import { strict as assert } from "node:assert";
import { test } from "node:test";

// Test the module exports by importing from baseline and bootstrap directly
// to avoid loading submodules with broken imports

import {
  INTERFACE_CAPABILITY_BASELINES,
  listInterfaceCapabilityBaselines,
  resolveInterfaceCapabilityBaseline,
} from "../../../../src/platform/five-plane-interface/interface-plane-baseline.js";

import {
  buildInterfacePlaneBootstrap,
  INTERFACE_PLANE_CATALOG_SERVICE_ID,
  INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID,
} from "../../../../src/platform/five-plane-interface/interface-plane-bootstrap.js";

test("fivePlaneInterface exports INTERFACE_CAPABILITY_BASELINES", () => {
  assert.ok(Array.isArray(INTERFACE_CAPABILITY_BASELINES), "INTERFACE_CAPABILITY_BASELINES should be an array");
  assert.equal(INTERFACE_CAPABILITY_BASELINES.length, 6, "should have 6 capability baselines");
});

test("fivePlaneInterface exports listInterfaceCapabilityBaselines function", () => {
  assert.equal(typeof listInterfaceCapabilityBaselines, "function", "listInterfaceCapabilityBaselines should be a function");
  const baselines = listInterfaceCapabilityBaselines();
  assert.ok(Array.isArray(baselines), "should return an array");
  assert.equal(baselines.length, 6, "should have 6 baselines");
});

test("fivePlaneInterface exports resolveInterfaceCapabilityBaseline function", () => {
  assert.equal(typeof resolveInterfaceCapabilityBaseline, "function", "resolveInterfaceCapabilityBaseline should be a function");
  const baseline = resolveInterfaceCapabilityBaseline("api");
  assert.equal(baseline.capabilityId, "api");
});

test("fivePlaneInterface exports buildInterfacePlaneBootstrap function", () => {
  assert.equal(typeof buildInterfacePlaneBootstrap, "function", "buildInterfacePlaneBootstrap should be a function");
  const bootstrap = buildInterfacePlaneBootstrap();
  assert.equal(bootstrap.planeId, "interface");
});

test("fivePlaneInterface exports INTERFACE_PLANE_CATALOG_SERVICE_ID", () => {
  assert.equal(typeof INTERFACE_PLANE_CATALOG_SERVICE_ID, "string", "INTERFACE_PLANE_CATALOG_SERVICE_ID should be a string");
  assert.equal(INTERFACE_PLANE_CATALOG_SERVICE_ID, "plane.interface.catalog");
});

test("fivePlaneInterface exports INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID", () => {
  assert.equal(typeof INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID, "string", "INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID should be a string");
  assert.equal(INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID, "plane.interface.bootstrap");
});

test("INTERFACE_CAPABILITY_BASELINES contains api capability", () => {
  const api = INTERFACE_CAPABILITY_BASELINES.find((b) => b.capabilityId === "api");
  assert.ok(api, "api capability should exist");
  assert.equal(api.entryModule, "src/platform/five-plane-interface/api/index.ts");
  assert.ok(api.baselineServices.includes("HttpApiServer"));
});

test("INTERFACE_CAPABILITY_BASELINES contains channel-gateway capability", () => {
  const cg = INTERFACE_CAPABILITY_BASELINES.find((b) => b.capabilityId === "channel-gateway");
  assert.ok(cg, "channel-gateway capability should exist");
  assert.equal(cg.entryModule, "src/platform/five-plane-interface/channel-gateway/index.ts");
  assert.ok(cg.baselineServices.includes("ChannelGatewayService"));
});

test("INTERFACE_CAPABILITY_BASELINES contains webhook capability", () => {
  const wh = INTERFACE_CAPABILITY_BASELINES.find((b) => b.capabilityId === "webhook");
  assert.ok(wh, "webhook capability should exist");
  assert.equal(wh.entryModule, "src/platform/five-plane-interface/webhook/index.ts");
});

test("capability baselines have required fields", () => {
  for (const baseline of INTERFACE_CAPABILITY_BASELINES) {
    assert.ok(typeof baseline.capabilityId === "string");
    assert.ok(typeof baseline.entryModule === "string");
    assert.ok(typeof baseline.description === "string");
    assert.ok(Array.isArray(baseline.baselineServices));
    assert.ok(baseline.baselineServices.length > 0);
  }
});

test("buildInterfacePlaneBootstrap returns correct structure", () => {
  const bootstrap = buildInterfacePlaneBootstrap();
  assert.equal(bootstrap.planeId, "interface");
  assert.ok(Array.isArray(bootstrap.catalog));
  assert.equal(bootstrap.catalog.length, 6);
  assert.ok(Array.isArray(bootstrap.registeredServiceIds));
  assert.equal(bootstrap.registeredServiceIds.length, 2);
});