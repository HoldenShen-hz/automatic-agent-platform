import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInterfacePlaneBootstrap,
  INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID,
  INTERFACE_PLANE_CATALOG_SERVICE_ID,
  registerInterfacePlaneBootstrap,
} from "../../../../src/platform/interface/interface-plane-bootstrap.js";
import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";

test("interface plane bootstrap exposes canonical interface services", () => {
  const bootstrap = buildInterfacePlaneBootstrap();
  assert.equal(bootstrap.planeId, "interface");
  assert.deepEqual(bootstrap.registeredServiceIds, [
    INTERFACE_PLANE_CATALOG_SERVICE_ID,
    INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID,
  ]);
  assert.equal(bootstrap.catalog.some((item) => item.capabilityId === "api"), true);
  assert.equal(bootstrap.catalog.some((item) => item.capabilityId === "webhook"), true);
});

test("interface plane bootstrap registers interface services in the service registry", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const bootstrap = registerInterfacePlaneBootstrap(registry);
    assert.equal(bootstrap.catalog.length, 6);
    assert.equal(registry.isInitialized(INTERFACE_PLANE_CATALOG_SERVICE_ID), true);
    assert.equal(registry.isInitialized(INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID), true);
  } finally {
    await registry.reset();
  }
});
