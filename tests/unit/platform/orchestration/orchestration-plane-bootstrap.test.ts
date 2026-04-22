import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOrchestrationPlaneBootstrap,
  ORCHESTRATION_PLANE_BOOTSTRAP_SERVICE_ID,
  ORCHESTRATION_PLANE_CATALOG_SERVICE_ID,
  registerOrchestrationPlaneBootstrap,
} from "../../../../src/platform/orchestration/orchestration-plane-bootstrap.js";
import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";

test("orchestration plane bootstrap exposes canonical orchestration services", () => {
  const bootstrap = buildOrchestrationPlaneBootstrap();
  assert.equal(bootstrap.planeId, "orchestration");
  assert.deepEqual(bootstrap.registeredServiceIds, [
    ORCHESTRATION_PLANE_CATALOG_SERVICE_ID,
    ORCHESTRATION_PLANE_BOOTSTRAP_SERVICE_ID,
  ]);
  assert.equal(bootstrap.catalog.some((item) => item.capabilityId === "harness"), true);
  assert.equal(bootstrap.catalog.some((item) => item.capabilityId === "oapeflir"), true);
});

test("orchestration plane bootstrap registers orchestration services in the service registry", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const bootstrap = registerOrchestrationPlaneBootstrap(registry);
    assert.equal(bootstrap.catalog.length, 8);
    assert.equal(registry.isInitialized(ORCHESTRATION_PLANE_CATALOG_SERVICE_ID), true);
    assert.equal(registry.isInitialized(ORCHESTRATION_PLANE_BOOTSTRAP_SERVICE_ID), true);
  } finally {
    await registry.reset();
  }
});
