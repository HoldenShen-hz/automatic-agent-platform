import assert from "node:assert/strict";
import test from "node:test";
import { buildPromptEngineBootstrap, PROMPT_ENGINE_BOOTSTRAP_SERVICE_ID, PROMPT_ENGINE_CATALOG_SERVICE_ID, registerPromptEngineBootstrap, } from "../../../../src/platform/prompt-engine/prompt-engine-bootstrap.js";
import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";
test("prompt-engine bootstrap exposes canonical prompt-engine services", () => {
    const bootstrap = buildPromptEngineBootstrap();
    assert.equal(bootstrap.capabilityGroupId, "prompt-engine");
    assert.deepEqual(bootstrap.registeredServiceIds, [
        PROMPT_ENGINE_CATALOG_SERVICE_ID,
        PROMPT_ENGINE_BOOTSTRAP_SERVICE_ID,
    ]);
    assert.equal(bootstrap.catalog.length, 5);
});
test("prompt-engine bootstrap registers services in the service registry", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const bootstrap = registerPromptEngineBootstrap(registry);
        assert.equal(bootstrap.catalog.some((item) => item.capabilityId === "rollout"), true);
        assert.equal(registry.isInitialized(PROMPT_ENGINE_CATALOG_SERVICE_ID), true);
        assert.equal(registry.isInitialized(PROMPT_ENGINE_BOOTSTRAP_SERVICE_ID), true);
    }
    finally {
        await registry.reset();
    }
});
//# sourceMappingURL=prompt-engine-bootstrap.test.js.map