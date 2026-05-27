import assert from "node:assert/strict";
import test from "node:test";

import {
  buildExecutionPlaneBootstrap,
  EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID,
  EXECUTION_PLANE_CATALOG_SERVICE_ID,
  registerExecutionPlaneBootstrap,
} from "../../../../src/platform/five-plane-execution/execution-plane-bootstrap.js";
import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";

test("execution plane bootstrap exposes canonical execution services [execution-plane-bootstrap]", () => {
  const bootstrap = buildExecutionPlaneBootstrap();
  assert.equal(bootstrap.planeId, "execution");
  assert.deepEqual(bootstrap.registeredServiceIds, [
    EXECUTION_PLANE_CATALOG_SERVICE_ID,
    EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID,
  ]);
  assert.equal(bootstrap.catalog.some((item) => item.capabilityId === "dispatcher"), true);
  assert.equal(bootstrap.catalog.some((item) => item.capabilityId === "tool-executor"), true);
});

test("execution plane bootstrap registers execution services in the service registry [execution-plane-bootstrap]", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const bootstrap = registerExecutionPlaneBootstrap(registry);
    assert.equal(bootstrap.catalog.length, 14);
    assert.equal(registry.isInitialized(EXECUTION_PLANE_CATALOG_SERVICE_ID), true);
    assert.equal(registry.isInitialized(EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID), true);
  } finally {
    await registry.reset();
  }
});
