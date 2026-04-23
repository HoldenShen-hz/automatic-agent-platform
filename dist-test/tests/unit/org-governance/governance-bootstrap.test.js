import assert from "node:assert/strict";
import test from "node:test";
import { buildGovernanceBootstrap, GOVERNANCE_BOOTSTRAP_SERVICE_ID, GOVERNANCE_CATALOG_SERVICE_ID, registerGovernanceBootstrap, } from "../../../src/org-governance/governance-bootstrap.js";
import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";
test("governance bootstrap exposes canonical W3 governance services", () => {
    const bootstrap = buildGovernanceBootstrap();
    assert.equal(bootstrap.capabilityGroupId, "org-governance");
    assert.deepEqual(bootstrap.registeredServiceIds, [
        GOVERNANCE_CATALOG_SERVICE_ID,
        GOVERNANCE_BOOTSTRAP_SERVICE_ID,
    ]);
    assert.equal(bootstrap.catalog.length, 6);
});
test("governance bootstrap registers services in the service registry", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const bootstrap = registerGovernanceBootstrap(registry);
        assert.equal(bootstrap.catalog.some((item) => item.capabilityId === "sso-scim"), true);
        assert.equal(registry.isInitialized(GOVERNANCE_CATALOG_SERVICE_ID), true);
        assert.equal(registry.isInitialized(GOVERNANCE_BOOTSTRAP_SERVICE_ID), true);
    }
    finally {
        await registry.reset();
    }
});
//# sourceMappingURL=governance-bootstrap.test.js.map