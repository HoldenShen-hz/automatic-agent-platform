import assert from "node:assert/strict";
import test from "node:test";

import {
  buildControlPlaneBootstrap,
  CONTROL_PLANE_BOOTSTRAP_SERVICE_ID,
  CONTROL_PLANE_CATALOG_SERVICE_ID,
  registerControlPlaneBootstrap,
} from "../../../../src/platform/five-plane-control-plane/control-plane-bootstrap.js";
import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";

test("control plane bootstrap exposes canonical control services", () => {
  const bootstrap = buildControlPlaneBootstrap();
  assert.equal(bootstrap.planeId, "control-plane");
  assert.deepEqual(bootstrap.registeredServiceIds, [
    CONTROL_PLANE_CATALOG_SERVICE_ID,
    CONTROL_PLANE_BOOTSTRAP_SERVICE_ID,
  ]);
  assert.equal(bootstrap.catalog.some((item) => item.capabilityId === "approval-center"), true);
  assert.equal(bootstrap.catalog.some((item) => item.capabilityId === "tenant"), true);
});

test("control plane bootstrap registers control services in the service registry", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const bootstrap = registerControlPlaneBootstrap(registry);
    assert.equal(bootstrap.catalog.length, 12);
    assert.equal(registry.isInitialized(CONTROL_PLANE_CATALOG_SERVICE_ID), true);
    assert.equal(registry.isInitialized(CONTROL_PLANE_BOOTSTRAP_SERVICE_ID), true);
  } finally {
    await registry.reset();
  }
});
