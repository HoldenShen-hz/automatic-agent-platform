import assert from "node:assert/strict";
import test from "node:test";
import { INTERACTION_GOVERNANCE_RUNTIME_CATALOG_SERVICE_ID, buildInteractionGovernanceRuntimeCatalog, registerInteractionGovernanceRuntimeCatalog, } from "../../src/interaction-governance-runtime-catalog.js";
import { ServiceRegistry } from "../../src/platform/shared/lifecycle/service-registry.js";
test("interaction-governance runtime catalog aggregates all W3 capability groups", () => {
    const catalog = buildInteractionGovernanceRuntimeCatalog();
    assert.equal(catalog.interaction.length, 6);
    assert.equal(catalog.governance.length, 6);
});
test("interaction-governance runtime catalog registers aggregated services", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const catalog = registerInteractionGovernanceRuntimeCatalog(registry);
        assert.equal(catalog.governance.some((item) => item.capabilityId === "delegated-governance"), true);
        assert.equal(registry.isInitialized(INTERACTION_GOVERNANCE_RUNTIME_CATALOG_SERVICE_ID), true);
    }
    finally {
        await registry.reset();
    }
});
//# sourceMappingURL=interaction-governance-runtime-catalog.test.js.map