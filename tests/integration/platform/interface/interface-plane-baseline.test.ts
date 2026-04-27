/**
 * Interface Plane Baseline Integration Tests
 *
 * Tests the InterfacePlaneBaseline capabilities including bootstrap,
 * capability resolution, and integration with ServiceRegistry.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";
import {
  INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID,
  INTERFACE_PLANE_CATALOG_SERVICE_ID,
  buildInterfacePlaneBootstrap,
  registerInterfacePlaneBootstrap,
} from "../../../../src/platform/interface/interface-plane-bootstrap.js";
import {
  listInterfaceCapabilityBaselines,
  resolveInterfaceCapabilityBaseline,
} from "../../../../src/platform/interface/interface-plane-baseline.js";

test("interface-plane-baseline: buildInterfacePlaneBootstrap creates valid bootstrap", () => {
  const bootstrap = buildInterfacePlaneBootstrap();

  assert.equal(bootstrap.planeId, "interface");
  assert.ok(Array.isArray(bootstrap.catalog));
  assert.equal(bootstrap.catalog.length, 6, "Should have 6 capability baselines");
  assert.deepEqual(
    bootstrap.registeredServiceIds,
    [INTERFACE_PLANE_CATALOG_SERVICE_ID, INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID],
  );
});

test("interface-plane-baseline: catalog contains all expected capability IDs", () => {
  const baselines = listInterfaceCapabilityBaselines();
  const capabilityIds = baselines.map((b) => b.capabilityId);

  assert.deepEqual(capabilityIds, ["api", "channel-gateway", "console-backend", "ingress", "scheduler", "webhook"]);
});

test("interface-plane-baseline: resolveInterfaceCapabilityBaseline returns correct baseline", () => {
  const apiBaseline = resolveInterfaceCapabilityBaseline("api");
  assert.equal(apiBaseline.capabilityId, "api");
  assert.ok(apiBaseline.entryModule.includes("api"));
  assert.ok(apiBaseline.baselineServices.includes("HttpApiServer"));

  const webhookBaseline = resolveInterfaceCapabilityBaseline("webhook");
  assert.equal(webhookBaseline.capabilityId, "webhook");
  assert.ok(webhookBaseline.baselineServices.includes("WebhookIngressService"));
});

test("interface-plane-baseline: resolveInterfaceCapabilityBaseline throws for unknown capability", () => {
  assert.throws(
    () => resolveInterfaceCapabilityBaseline("unknown-capability" as any),
    (err: unknown) => err instanceof Error && err.message.includes("interface_capability.not_found"),
  );
});

test("interface-plane-baseline: registerInterfacePlaneBootstrap registers services", async () => {
  const registry = new ServiceRegistry();

  const bootstrap = registerInterfacePlaneBootstrap(registry);

  assert.equal(bootstrap.planeId, "interface");
  assert.equal(registry.isInitialized(INTERFACE_PLANE_CATALOG_SERVICE_ID), true);
  assert.equal(registry.isInitialized(INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID), true);

  await registry.reset();
});

test("interface-plane-baseline: each baseline has required fields", () => {
  const baselines = listInterfaceCapabilityBaselines();

  for (const baseline of baselines) {
    assert.ok(typeof baseline.capabilityId === "string");
    assert.ok(baseline.capabilityId.length > 0);
    assert.ok(typeof baseline.entryModule === "string");
    assert.ok(baseline.entryModule.startsWith("src/platform/interface"));
    assert.ok(typeof baseline.description === "string");
    assert.ok(baseline.description.length > 10);
    assert.ok(Array.isArray(baseline.baselineServices));
    assert.ok(baseline.baselineServices.length > 0);
  }
});

test("interface-plane-baseline: all baseline services are non-empty strings", () => {
  const baselines = listInterfaceCapabilityBaselines();

  for (const baseline of baselines) {
    for (const service of baseline.baselineServices) {
      assert.ok(typeof service === "string");
      assert.ok(service.length > 0);
    }
  }
});

test("interface-plane-baseline: catalog is frozen", () => {
  const baselines = listInterfaceCapabilityBaselines();
  assert.ok(Object.isFrozen(baselines), "Baselines array should be frozen");
});

test("interface-plane-baseline: bootstrap catalog matches direct listing", () => {
  const bootstrap = buildInterfacePlaneBootstrap();
  const directList = listInterfaceCapabilityBaselines();

  assert.equal(bootstrap.catalog.length, directList.length);
  assert.deepEqual(
    bootstrap.catalog.map((b) => b.capabilityId),
    directList.map((b) => b.capabilityId),
  );
});
