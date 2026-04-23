import assert from "node:assert/strict";
import test from "node:test";
import { buildFivePlaneRuntimeCatalog, FIVE_PLANE_RUNTIME_CATALOG_SERVICE_ID, registerFivePlaneRuntimeCatalog, } from "../../../src/platform/five-plane-runtime-bootstrap.js";
import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";
test("five-plane runtime bootstrap builds the full five-plane catalog", () => {
    const catalog = buildFivePlaneRuntimeCatalog();
    assert.equal(catalog.interfacePlane.length, 6);
    assert.equal(catalog.controlPlane.length, 12);
    assert.equal(catalog.orchestrationPlane.length, 8);
    assert.equal(catalog.executionPlane.length, 14);
    assert.equal(catalog.stateEvidencePlane.length, 10);
});
test("five-plane runtime bootstrap registers plane catalogs in the service registry", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const catalog = registerFivePlaneRuntimeCatalog(registry);
        assert.equal(catalog.orchestrationPlane.some((item) => item.capabilityId === "harness"), true);
        assert.equal(registry.isInitialized(FIVE_PLANE_RUNTIME_CATALOG_SERVICE_ID), true);
        assert.equal(registry.isInitialized("plane.interface.catalog"), true);
        assert.equal(registry.isInitialized("plane.interface.bootstrap"), true);
        assert.equal(registry.isInitialized("plane.control.catalog"), true);
        assert.equal(registry.isInitialized("plane.control.bootstrap"), true);
        assert.equal(registry.isInitialized("plane.orchestration.catalog"), true);
        assert.equal(registry.isInitialized("plane.orchestration.bootstrap"), true);
        assert.equal(registry.isInitialized("plane.execution.catalog"), true);
        assert.equal(registry.isInitialized("plane.execution.bootstrap"), true);
        assert.equal(registry.isInitialized("plane.state-evidence.catalog"), true);
        assert.equal(registry.isInitialized("plane.state-evidence.bootstrap"), true);
    }
    finally {
        await registry.reset();
    }
});
//# sourceMappingURL=five-plane-runtime-bootstrap.test.js.map