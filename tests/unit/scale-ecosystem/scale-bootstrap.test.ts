import assert from "node:assert/strict";
import test from "node:test";

import {
  buildScaleBootstrap,
  registerScaleBootstrap,
  SCALE_BOOTSTRAP_SERVICE_ID,
  SCALE_CATALOG_SERVICE_ID,
} from "../../../src/scale-ecosystem/scale-bootstrap.js";
import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";

test("scale bootstrap exposes canonical W4 scale services [scale-bootstrap]", () => {
  const bootstrap = buildScaleBootstrap();
  assert.equal(bootstrap.capabilityGroupId, "scale-ecosystem");
  assert.deepEqual(bootstrap.registeredServiceIds, [
    SCALE_CATALOG_SERVICE_ID,
    SCALE_BOOTSTRAP_SERVICE_ID,
  ]);
  assert.equal(bootstrap.catalog.length, 11);
});

test("scale bootstrap registers services in the service registry [scale-bootstrap]", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const bootstrap = registerScaleBootstrap(registry);
    assert.equal(bootstrap.catalog.some((item) => item.capabilityId === "integration"), true);
    assert.equal(registry.isInitialized(SCALE_CATALOG_SERVICE_ID), true);
    assert.equal(registry.isInitialized(SCALE_BOOTSTRAP_SERVICE_ID), true);
  } finally {
    await registry.reset();
  }
});
