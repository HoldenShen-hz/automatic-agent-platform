import assert from "node:assert/strict";
import test from "node:test";
import { buildDomainsRuntimeCatalog, registerDomainsRuntimeCatalog, DOMAINS_RUNTIME_CATALOG_SERVICE_ID, } from "../../src/domains-runtime-catalog.js";
import { ServiceRegistry } from "../../src/platform/shared/lifecycle/service-registry.js";
test("domains runtime catalog aggregates all W5 phase groups", () => {
    const catalog = buildDomainsRuntimeCatalog();
    assert.equal(catalog.phase9a.length, 4);
    assert.equal(catalog.phase9b.length, 4);
    assert.equal(catalog.phase9c.length, 4);
    assert.equal(catalog.phase9d.length, 4);
    assert.equal(catalog.phase9e.length, 4);
    assert.equal(catalog.phase9f.length, 4);
});
test("domains runtime catalog registers aggregated services", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const catalog = registerDomainsRuntimeCatalog(registry);
        assert.equal(catalog.phase9a.some((item) => item.domainId === "coding"), true);
        assert.equal(catalog.phase9b.some((item) => item.domainId === "quant-trading"), true);
        assert.equal(catalog.phase9f.some((item) => item.domainId === "marketing"), true);
        assert.equal(registry.isInitialized(DOMAINS_RUNTIME_CATALOG_SERVICE_ID), true);
    }
    finally {
        await registry.reset();
    }
});
//# sourceMappingURL=domains-runtime-catalog.test.js.map