import assert from "node:assert/strict";
import test from "node:test";

import {
  buildModelGatewayBootstrap,
  MODEL_GATEWAY_BOOTSTRAP_SERVICE_ID,
  MODEL_GATEWAY_CATALOG_SERVICE_ID,
  registerModelGatewayBootstrap,
} from "../../../../src/platform/model-gateway/model-gateway-bootstrap.js";
import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";

test("model-gateway bootstrap exposes canonical AI operations services", () => {
  const bootstrap = buildModelGatewayBootstrap();
  assert.equal(bootstrap.capabilityGroupId, "model-gateway");
  assert.deepEqual(bootstrap.registeredServiceIds, [
    MODEL_GATEWAY_CATALOG_SERVICE_ID,
    MODEL_GATEWAY_BOOTSTRAP_SERVICE_ID,
  ]);
  assert.equal(bootstrap.catalog.length, 6);
});

test("model-gateway bootstrap registers services in the service registry", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const bootstrap = registerModelGatewayBootstrap(registry);
    assert.equal(bootstrap.catalog.some((item) => item.capabilityId === "degradation"), true);
    assert.equal(registry.isInitialized(MODEL_GATEWAY_CATALOG_SERVICE_ID), true);
    assert.equal(registry.isInitialized(MODEL_GATEWAY_BOOTSTRAP_SERVICE_ID), true);
  } finally {
    await registry.reset();
  }
});
