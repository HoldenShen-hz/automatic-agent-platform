import assert from "node:assert/strict";
import test from "node:test";

import {
  buildScaleOpsRuntimeCatalog,
  registerScaleOpsRuntimeCatalog,
  SCALE_OPS_RUNTIME_CATALOG_SERVICE_ID,
} from "../../src/scale-ops-runtime-catalog.js";
import { ServiceRegistry } from "../../src/platform/shared/lifecycle/service-registry.js";

test("scale-ops runtime catalog aggregates all W4 capability groups", () => {
  const catalog = buildScaleOpsRuntimeCatalog();
  assert.equal(catalog.scaleEcosystem.length, 6);
  assert.equal(catalog.opsMaturity.length, 12);
});

test("scale-ops runtime catalog registers aggregated services", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const catalog = registerScaleOpsRuntimeCatalog(registry);
    assert.equal(catalog.scaleEcosystem.some((item) => item.capabilityId === "feedback-loop"), true);
    assert.equal(catalog.opsMaturity.some((item) => item.capabilityId === "platform-ops-agent"), true);
    assert.equal(registry.isInitialized(SCALE_OPS_RUNTIME_CATALOG_SERVICE_ID), true);
  } finally {
    await registry.reset();
  }
});
