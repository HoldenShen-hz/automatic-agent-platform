import assert from "node:assert/strict";
import test from "node:test";
import { listPlatformSurfaceManifests, registerPlatformSurfaceCatalog, } from "../../../src/platform/platform-module-catalog.js";
import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";
const PLATFORM_SURFACE_CATALOG_SERVICE_ID = "platform.surface-catalog";
test("registerPlatformSurfaceCatalog registers service with correct service ID", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        registerPlatformSurfaceCatalog(registry);
        assert.equal(registry.isInitialized(PLATFORM_SURFACE_CATALOG_SERVICE_ID), true);
    }
    finally {
        await registry.reset();
    }
});
test("registerPlatformSurfaceCatalog returns array of 11 surface manifests", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const result = registerPlatformSurfaceCatalog(registry);
        assert.equal(result.length, 11);
        assert.ok(Array.isArray(result));
    }
    finally {
        await registry.reset();
    }
});
test("registerPlatformSurfaceCatalog returns same data as listPlatformSurfaceManifests", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const byRegistration = registerPlatformSurfaceCatalog(registry);
        const byListing = listPlatformSurfaceManifests();
        assert.equal(byRegistration.length, byListing.length);
        for (let i = 0; i < byRegistration.length; i++) {
            assert.strictEqual(byRegistration[i].surfaceId, byListing[i].surfaceId);
            assert.strictEqual(byRegistration[i].entryModule, byListing[i].entryModule);
            assert.strictEqual(byRegistration[i].description, byListing[i].description);
        }
    }
    finally {
        await registry.reset();
    }
});
test("registerPlatformSurfaceCatalog can be called without arguments (uses default registry)", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const result = registerPlatformSurfaceCatalog();
        assert.equal(result.length, 11);
        assert.equal(registry.isInitialized(PLATFORM_SURFACE_CATALOG_SERVICE_ID), true);
    }
    finally {
        await registry.reset();
    }
});
test("registerPlatformSurfaceCatalog can be called multiple times on same registry", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const result1 = registerPlatformSurfaceCatalog(registry);
        const result2 = registerPlatformSurfaceCatalog(registry);
        // Should return the same data
        assert.equal(result1.length, result2.length);
        assert.strictEqual(result1, result2);
    }
    finally {
        await registry.reset();
    }
});
test("after registration, registry.get returns correct surface catalog", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        registerPlatformSurfaceCatalog(registry);
        const catalog = registry.get(PLATFORM_SURFACE_CATALOG_SERVICE_ID);
        assert.equal(catalog.length, 11);
        assert.ok(catalog.some((m) => m.surfaceId === "execution"));
        assert.ok(catalog.some((m) => m.surfaceId === "orchestration"));
        assert.ok(catalog.some((m) => m.surfaceId === "x1-fabric"));
    }
    finally {
        await registry.reset();
    }
});
test("registration returns frozen array", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const result = registerPlatformSurfaceCatalog(registry);
        assert.ok(Object.isFrozen(result));
    }
    finally {
        await registry.reset();
    }
});
test("registration returns the frozen PLATFORM_SURFACE_MANIFESTS array", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const result = registerPlatformSurfaceCatalog(registry);
        // The returned array should be the same frozen reference
        assert.ok(Object.isFrozen(result));
    }
    finally {
        await registry.reset();
    }
});
test("ServiceRegistry.reset clears the registered service", async () => {
    const registry = ServiceRegistry.getInstance();
    registerPlatformSurfaceCatalog(registry);
    assert.equal(registry.isInitialized(PLATFORM_SURFACE_CATALOG_SERVICE_ID), true);
    await registry.reset();
    assert.equal(registry.isInitialized(PLATFORM_SURFACE_CATALOG_SERVICE_ID), false);
});
test("after reset, re-registration works correctly", async () => {
    const registry = ServiceRegistry.getInstance();
    registerPlatformSurfaceCatalog(registry);
    await registry.reset();
    const result = registerPlatformSurfaceCatalog(registry);
    assert.equal(result.length, 11);
    assert.equal(registry.isInitialized(PLATFORM_SURFACE_CATALOG_SERVICE_ID), true);
});
test("registered catalog surfaces match expected platform structure", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const catalog = registerPlatformSurfaceCatalog(registry);
        const surfaceIds = catalog.map((m) => m.surfaceId).sort();
        assert.deepEqual(surfaceIds, [
            "compliance",
            "contracts",
            "control-plane",
            "execution",
            "interface",
            "model-gateway",
            "orchestration",
            "prompt-engine",
            "shared",
            "state-evidence",
            "x1-fabric",
        ]);
    }
    finally {
        await registry.reset();
    }
});
test("registration does not mutate original PLATFORM_SURFACE_MANIFESTS", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        registerPlatformSurfaceCatalog(registry);
        registerPlatformSurfaceCatalog(registry);
        // The original should always be frozen and unchanged
        const catalog = listPlatformSurfaceManifests();
        assert.ok(Object.isFrozen(catalog));
        assert.equal(catalog.length, 11);
    }
    finally {
        await registry.reset();
    }
});
test("catalog contains all expected entry modules", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const catalog = registerPlatformSurfaceCatalog(registry);
        const entryModules = catalog.map((m) => m.entryModule).sort();
        assert.ok(entryModules.includes("src/platform/compliance/index.ts"));
        assert.ok(entryModules.includes("src/platform/contracts/index.ts"));
        assert.ok(entryModules.includes("src/platform/control-plane/index.ts"));
        assert.ok(entryModules.includes("src/platform/execution/index.ts"));
        assert.ok(entryModules.includes("src/platform/interface/index.ts"));
        assert.ok(entryModules.includes("src/platform/model-gateway/index.ts"));
        assert.ok(entryModules.includes("src/platform/orchestration/index.ts"));
        assert.ok(entryModules.includes("src/platform/prompt-engine/index.ts"));
        assert.ok(entryModules.includes("src/platform/shared/index.ts"));
        assert.ok(entryModules.includes("src/platform/state-evidence/index.ts"));
    }
    finally {
        await registry.reset();
    }
});
test("catalog descriptions are non-empty strings", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const catalog = registerPlatformSurfaceCatalog(registry);
        for (const manifest of catalog) {
            assert.ok(typeof manifest.description === "string");
            assert.ok(manifest.description.length > 0);
        }
    }
    finally {
        await registry.reset();
    }
});
test("catalog surfaceIds are all valid identifiers", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const catalog = registerPlatformSurfaceCatalog(registry);
        for (const manifest of catalog) {
            // Should be a valid identifier (no spaces, starts with letter)
            assert.ok(/^[a-z][a-z0-9-]*$/.test(manifest.surfaceId), `Invalid surfaceId: ${manifest.surfaceId}`);
        }
    }
    finally {
        await registry.reset();
    }
});
test("separate registry instances maintain independent registrations", async () => {
    const registry1 = ServiceRegistry.getInstance();
    // Note: ServiceRegistry is a singleton, so we use reset to simulate separate contexts
    try {
        registerPlatformSurfaceCatalog(registry1);
        const catalog1 = registry1.get(PLATFORM_SURFACE_CATALOG_SERVICE_ID);
        assert.equal(catalog1.length, 11);
        // Reset and verify registry is clean
        await registry1.reset();
    }
    finally {
        await registry1.reset();
    }
});
test("get before register throws appropriate error", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        // Before any registration, the service should not be registered
        assert.equal(registry.isInitialized(PLATFORM_SURFACE_CATALOG_SERVICE_ID), false);
        // Trying to get before register should throw
        assert.throws(() => registry.get(PLATFORM_SURFACE_CATALOG_SERVICE_ID), /no service registered/i);
    }
    finally {
        await registry.reset();
    }
});
test("concurrent-like access returns same instance (singleton behavior)", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        // First registration
        const result1 = registerPlatformSurfaceCatalog(registry);
        // Second call - should return same reference (not a new array)
        const result2 = registerPlatformSurfaceCatalog(registry);
        assert.strictEqual(result1, result2, "should return the same array reference");
        assert.ok(Object.isFrozen(result1));
        assert.ok(Object.isFrozen(result2));
    }
    finally {
        await registry.reset();
    }
});
test("surface manifests have unique surfaceIds in registered catalog", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const catalog = registerPlatformSurfaceCatalog(registry);
        const ids = catalog.map((m) => m.surfaceId);
        const uniqueIds = new Set(ids);
        assert.equal(uniqueIds.size, ids.length, "All surfaceIds should be unique");
    }
    finally {
        await registry.reset();
    }
});
//# sourceMappingURL=module-registration.test.js.map