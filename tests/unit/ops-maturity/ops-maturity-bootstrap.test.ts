import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOpsMaturityBootstrap,
  registerOpsMaturityBootstrap,
  OPS_MATURITY_BOOTSTRAP_SERVICE_ID,
  OPS_MATURITY_CATALOG_SERVICE_ID,
} from "../../../src/ops-maturity/ops-maturity-bootstrap.js";
import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";

test("ops-maturity bootstrap exposes canonical W4 maturity services", () => {
  const bootstrap = buildOpsMaturityBootstrap();
  assert.equal(bootstrap.capabilityGroupId, "ops-maturity");
  assert.deepEqual(bootstrap.registeredServiceIds, [
    OPS_MATURITY_CATALOG_SERVICE_ID,
    OPS_MATURITY_BOOTSTRAP_SERVICE_ID,
  ]);
  assert.equal(bootstrap.catalog.length, 12);
});

test("ops-maturity bootstrap registers services in the service registry", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const bootstrap = registerOpsMaturityBootstrap(registry);
    assert.equal(bootstrap.catalog.some((item) => item.capabilityId === "workflow-debugger"), true);
    assert.equal(registry.isInitialized(OPS_MATURITY_CATALOG_SERVICE_ID), true);
    assert.equal(registry.isInitialized(OPS_MATURITY_BOOTSTRAP_SERVICE_ID), true);
  } finally {
    await registry.reset();
  }
});
