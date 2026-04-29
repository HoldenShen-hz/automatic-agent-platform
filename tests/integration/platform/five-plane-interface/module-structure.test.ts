import { strict as assert } from "node:assert";
import { test } from "node:test";

// This integration test tests the module loading and module structure
// at the five-plane-interface boundary level

test("interface-plane-baseline module can be imported", async () => {
  const module = await import("../../../../src/platform/five-plane-interface/interface-plane-baseline.js");
  assert.ok(typeof module.listInterfaceCapabilityBaselines === "function");
  assert.ok(typeof module.resolveInterfaceCapabilityBaseline === "function");
  assert.ok(Array.isArray(module.INTERFACE_CAPABILITY_BASELINES));
});

test("interface-plane-bootstrap module can be imported", async () => {
  const module = await import("../../../../src/platform/five-plane-interface/interface-plane-bootstrap.js");
  assert.ok(typeof module.buildInterfacePlaneBootstrap === "function");
  assert.ok(typeof module.registerInterfacePlaneBootstrap === "function");
  assert.equal(module.INTERFACE_PLANE_CATALOG_SERVICE_ID, "plane.interface.catalog");
  assert.equal(module.INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID, "plane.interface.bootstrap");
});

test("interface-plane-bootstrap builds correct bootstrap", async () => {
  const { buildInterfacePlaneBootstrap, INTERFACE_PLANE_CATALOG_SERVICE_ID, INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID } =
    await import("../../../../src/platform/five-plane-interface/interface-plane-bootstrap.js");

  const bootstrap = buildInterfacePlaneBootstrap();
  assert.equal(bootstrap.planeId, "interface");
  assert.ok(Array.isArray(bootstrap.catalog));
  assert.equal(bootstrap.catalog.length, 6);
  assert.ok(bootstrap.registeredServiceIds.includes(INTERFACE_PLANE_CATALOG_SERVICE_ID));
  assert.ok(bootstrap.registeredServiceIds.includes(INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID));
});

test("interface-plane-baseline has all six capability baselines", async () => {
  const { INTERFACE_CAPABILITY_BASELINES } =
    await import("../../../../src/platform/five-plane-interface/interface-plane-baseline.js");

  const ids = INTERFACE_CAPABILITY_BASELINES.map((b: { capabilityId: string }) => b.capabilityId);
  assert.ok(ids.includes("api"), "should have api capability");
  assert.ok(ids.includes("channel-gateway"), "should have channel-gateway capability");
  assert.ok(ids.includes("console-backend"), "should have console-backend capability");
  assert.ok(ids.includes("ingress"), "should have ingress capability");
  assert.ok(ids.includes("scheduler"), "should have scheduler capability");
  assert.ok(ids.includes("webhook"), "should have webhook capability");
});