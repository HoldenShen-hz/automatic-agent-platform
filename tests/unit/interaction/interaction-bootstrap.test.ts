import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInteractionBootstrap,
  INTERACTION_BOOTSTRAP_SERVICE_ID,
  INTERACTION_CATALOG_SERVICE_ID,
  registerInteractionBootstrap,
} from "../../../src/interaction/interaction-bootstrap.js";
import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";

test("interaction bootstrap exposes canonical W3 interaction services", () => {
  const bootstrap = buildInteractionBootstrap();
  assert.equal(bootstrap.capabilityGroupId, "interaction");
  assert.deepEqual(bootstrap.registeredServiceIds, [
    INTERACTION_CATALOG_SERVICE_ID,
    INTERACTION_BOOTSTRAP_SERVICE_ID,
  ]);
  assert.equal(bootstrap.catalog.length, 6);
});

test("interaction bootstrap registers services in the service registry", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const bootstrap = registerInteractionBootstrap(registry);
    assert.equal(bootstrap.catalog.some((item) => item.capabilityId === "ux"), true);
    assert.equal(registry.isInitialized(INTERACTION_CATALOG_SERVICE_ID), true);
    assert.equal(registry.isInitialized(INTERACTION_BOOTSTRAP_SERVICE_ID), true);
  } finally {
    await registry.reset();
  }
});
