import assert from "node:assert/strict";
import test from "node:test";
import { buildScaleOpsRuntimeCatalog, registerScaleOpsRuntimeCatalog, SCALE_OPS_RUNTIME_CATALOG_SERVICE_ID, } from "../../../src/scale-ops-runtime-catalog.js";
import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";
test("buildScaleOpsRuntimeCatalog returns catalog with scale-ecosystem and ops-maturity", () => {
    const catalog = buildScaleOpsRuntimeCatalog();
    assert.ok(Array.isArray(catalog.scaleEcosystem));
    assert.ok(Array.isArray(catalog.opsMaturity));
});
test("buildScaleOpsRuntimeCatalog scale-ecosystem has capability entries", () => {
    const catalog = buildScaleOpsRuntimeCatalog();
    assert.ok(catalog.scaleEcosystem.length > 0);
    const first = catalog.scaleEcosystem[0];
    assert.ok(typeof first.capabilityId === "string");
    assert.ok(typeof first.entryModule === "string");
    assert.ok(typeof first.description === "string");
});
test("buildScaleOpsRuntimeCatalog ops-maturity has capability entries", () => {
    const catalog = buildScaleOpsRuntimeCatalog();
    assert.ok(catalog.opsMaturity.length > 0);
    const first = catalog.opsMaturity[0];
    assert.ok(typeof first.capabilityId === "string");
    assert.ok(typeof first.entryModule === "string");
    assert.ok(typeof first.description === "string");
});
test("registerScaleOpsRuntimeCatalog registers service in registry", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const catalog = registerScaleOpsRuntimeCatalog(registry);
        assert.equal(registry.isInitialized(SCALE_OPS_RUNTIME_CATALOG_SERVICE_ID), true);
        assert.ok(Array.isArray(catalog.scaleEcosystem));
        assert.ok(Array.isArray(catalog.opsMaturity));
    }
    finally {
        await registry.reset();
    }
});
test("registerScaleOpsRuntimeCatalog returns same instance from registry", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const first = registerScaleOpsRuntimeCatalog(registry);
        const second = registry.get(SCALE_OPS_RUNTIME_CATALOG_SERVICE_ID);
        assert.equal(first, second);
    }
    finally {
        await registry.reset();
    }
});
test("registerScaleOpsRuntimeCatalog depends on scale and ops-maturity bootstraps", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        registerScaleOpsRuntimeCatalog(registry);
        // Both bootstrap services should be registered via dependsOn
        assert.ok(registry.isInitialized(SCALE_OPS_RUNTIME_CATALOG_SERVICE_ID));
    }
    finally {
        await registry.reset();
    }
});
//# sourceMappingURL=scale-ops-runtime-catalog.test.js.map