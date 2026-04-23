import assert from "node:assert/strict";
import test from "node:test";
import { AI_OPERATIONS_RUNTIME_CATALOG_SERVICE_ID, buildAiOperationsRuntimeCatalog, registerAiOperationsRuntimeCatalog, } from "../../../src/platform/ai-operations-runtime-catalog.js";
import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";
test("ai operations runtime catalog aggregates all W2 capability groups", () => {
    const catalog = buildAiOperationsRuntimeCatalog();
    assert.equal(catalog.modelGateway.length, 6);
    assert.equal(catalog.promptEngine.length, 5);
    assert.equal(catalog.compliance.length, 5);
    assert.equal(catalog.harness.length, 4);
});
test("ai operations runtime catalog registers aggregated services in the registry", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const catalog = registerAiOperationsRuntimeCatalog(registry);
        assert.equal(catalog.harness.some((item) => item.capabilityId === "governance"), true);
        assert.equal(registry.isInitialized(AI_OPERATIONS_RUNTIME_CATALOG_SERVICE_ID), true);
    }
    finally {
        await registry.reset();
    }
});
//# sourceMappingURL=ai-operations-runtime-catalog.test.js.map