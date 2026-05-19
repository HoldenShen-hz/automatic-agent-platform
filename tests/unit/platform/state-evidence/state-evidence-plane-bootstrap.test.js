import assert from "node:assert/strict";
import test from "node:test";
import { buildStateEvidencePlaneBootstrap, registerStateEvidencePlaneBootstrap, STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID, STATE_EVIDENCE_PLANE_CATALOG_SERVICE_ID, } from "../../../../src/platform/state-evidence/state-evidence-plane-bootstrap.js";
import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";
test("state-evidence plane bootstrap exposes canonical evidence services", () => {
    const bootstrap = buildStateEvidencePlaneBootstrap();
    assert.equal(bootstrap.planeId, "state-evidence");
    assert.deepEqual(bootstrap.registeredServiceIds, [
        STATE_EVIDENCE_PLANE_CATALOG_SERVICE_ID,
        STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID,
    ]);
    assert.equal(bootstrap.catalog.some((item) => item.capabilityId === "truth"), true);
    assert.equal(bootstrap.catalog.some((item) => item.capabilityId === "dlq"), true);
});
test("state-evidence plane bootstrap registers evidence services in the service registry", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const bootstrap = registerStateEvidencePlaneBootstrap(registry);
        assert.equal(bootstrap.catalog.length, 10);
        assert.equal(registry.isInitialized(STATE_EVIDENCE_PLANE_CATALOG_SERVICE_ID), true);
        assert.equal(registry.isInitialized(STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID), true);
    }
    finally {
        await registry.reset();
    }
});
//# sourceMappingURL=state-evidence-plane-bootstrap.test.js.map