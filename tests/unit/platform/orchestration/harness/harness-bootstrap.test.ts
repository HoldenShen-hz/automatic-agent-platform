import assert from "node:assert/strict";
import test from "node:test";

import {
  buildHarnessBootstrap,
  HARNESS_BOOTSTRAP_SERVICE_ID,
  HARNESS_CATALOG_SERVICE_ID,
  registerHarnessBootstrap,
} from "../../../../../src/platform/orchestration/harness/harness-bootstrap.js";
import { ServiceRegistry } from "../../../../../src/platform/shared/lifecycle/service-registry.js";

test("harness bootstrap exposes canonical harness services", () => {
  const bootstrap = buildHarnessBootstrap();
  assert.equal(bootstrap.capabilityGroupId, "harness");
  assert.deepEqual(bootstrap.registeredServiceIds, [
    HARNESS_CATALOG_SERVICE_ID,
    HARNESS_BOOTSTRAP_SERVICE_ID,
  ]);
  assert.equal(bootstrap.catalog.length, 4);
});

test("harness bootstrap registers services in the service registry", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const bootstrap = registerHarnessBootstrap(registry);
    assert.equal(bootstrap.catalog.some((item) => item.capabilityId === "hitl"), true);
    assert.equal(registry.isInitialized(HARNESS_CATALOG_SERVICE_ID), true);
    assert.equal(registry.isInitialized(HARNESS_BOOTSTRAP_SERVICE_ID), true);
  } finally {
    await registry.reset();
  }
});
