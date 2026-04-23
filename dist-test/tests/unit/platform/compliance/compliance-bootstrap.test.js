import assert from "node:assert/strict";
import test from "node:test";
import { buildComplianceBootstrap, COMPLIANCE_BOOTSTRAP_SERVICE_ID, COMPLIANCE_CATALOG_SERVICE_ID, registerComplianceBootstrap, } from "../../../../src/platform/compliance/compliance-bootstrap.js";
import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";
test("compliance bootstrap exposes canonical compliance services", () => {
    const bootstrap = buildComplianceBootstrap();
    assert.equal(bootstrap.capabilityGroupId, "compliance");
    assert.deepEqual(bootstrap.registeredServiceIds, [
        COMPLIANCE_CATALOG_SERVICE_ID,
        COMPLIANCE_BOOTSTRAP_SERVICE_ID,
    ]);
    assert.equal(bootstrap.catalog.length, 5);
});
test("compliance bootstrap registers services in the service registry", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const bootstrap = registerComplianceBootstrap(registry);
        assert.equal(bootstrap.catalog.some((item) => item.capabilityId === "erasure"), true);
        assert.equal(registry.isInitialized(COMPLIANCE_CATALOG_SERVICE_ID), true);
        assert.equal(registry.isInitialized(COMPLIANCE_BOOTSTRAP_SERVICE_ID), true);
    }
    finally {
        await registry.reset();
    }
});
//# sourceMappingURL=compliance-bootstrap.test.js.map