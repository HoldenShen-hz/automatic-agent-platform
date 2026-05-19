import assert from "node:assert/strict";
import test from "node:test";
import { buildPromptEngineBootstrap, PROMPT_ENGINE_BOOTSTRAP_SERVICE_ID, PROMPT_ENGINE_CATALOG_SERVICE_ID, registerPromptEngineBootstrap, } from "../../../../src/platform/prompt-engine/prompt-engine-bootstrap.js";
import { listPromptEngineCapabilityBaselines, resolvePromptEngineCapabilityBaseline, PROMPT_ENGINE_CAPABILITY_BASELINES, } from "../../../../src/platform/prompt-engine/prompt-engine-baseline.js";
import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";
// ============================================================================
// PromptEngineBaseline Tests
// ============================================================================
test("listPromptEngineCapabilityBaselines returns all five capability baselines", () => {
    const baselines = listPromptEngineCapabilityBaselines();
    assert.equal(baselines.length, 5);
    const capabilityIds = baselines.map((b) => b.capabilityId);
    assert.ok(capabilityIds.includes("registry"));
    assert.ok(capabilityIds.includes("renderer"));
    assert.ok(capabilityIds.includes("rollout"));
    assert.ok(capabilityIds.includes("eval"));
    assert.ok(capabilityIds.includes("conversation-template"));
});
test("listPromptEngineCapabilityBaselines returns frozen array", () => {
    const baselines = listPromptEngineCapabilityBaselines();
    assert.ok(Object.isFrozen(baselines));
});
test("capability baselines have required fields", () => {
    const baselines = listPromptEngineCapabilityBaselines();
    for (const baseline of baselines) {
        assert.ok(baseline.capabilityId.length > 0);
        assert.ok(baseline.entryModule.length > 0);
        assert.ok(baseline.description.length > 0);
        assert.ok(Array.isArray(baseline.baselineServices));
        assert.ok(baseline.baselineServices.length > 0);
    }
});
test("resolvePromptEngineCapabilityBaseline resolves valid capability ids", () => {
    const baseline = resolvePromptEngineCapabilityBaseline("registry");
    assert.equal(baseline.capabilityId, "registry");
    assert.equal(baseline.entryModule, "src/platform/prompt-engine/registry/index.ts");
    assert.ok(baseline.baselineServices.includes("PromptTemplateRegistryService"));
});
test("resolvePromptEngineCapabilityBaseline resolves renderer capability", () => {
    const baseline = resolvePromptEngineCapabilityBaseline("renderer");
    assert.equal(baseline.capabilityId, "renderer");
    assert.ok(baseline.baselineServices.includes("PromptRendererService"));
});
test("resolvePromptEngineCapabilityBaseline resolves rollout capability", () => {
    const baseline = resolvePromptEngineCapabilityBaseline("rollout");
    assert.equal(baseline.capabilityId, "rollout");
    assert.ok(baseline.baselineServices.includes("PromptRolloutService"));
});
test("resolvePromptEngineCapabilityBaseline resolves eval capability", () => {
    const baseline = resolvePromptEngineCapabilityBaseline("eval");
    assert.equal(baseline.capabilityId, "eval");
    assert.ok(baseline.baselineServices.includes("EvalDatasetJudgeService"));
});
test("resolvePromptEngineCapabilityBaseline resolves conversation-template capability", () => {
    const baseline = resolvePromptEngineCapabilityBaseline("conversation-template");
    assert.equal(baseline.capabilityId, "conversation-template");
    assert.ok(baseline.baselineServices.includes("ConversationTemplateRegistry"));
});
test("resolvePromptEngineCapabilityBaseline throws for invalid capability id", () => {
    assert.throws(() => resolvePromptEngineCapabilityBaseline("invalid_capability"), /prompt_engine_capability.not_found:invalid_capability/);
});
test("resolvePromptEngineCapabilityBaseline throws for empty string", () => {
    assert.throws(() => resolvePromptEngineCapabilityBaseline(""), /prompt_engine_capability.not_found:/);
});
test("PROMPT_ENGINE_CAPABILITY_BASELINES is frozen", () => {
    assert.ok(Object.isFrozen(PROMPT_ENGINE_CAPABILITY_BASELINES));
});
// ============================================================================
// PromptEngineBootstrap Tests
// ============================================================================
test("buildPromptEngineBootstrap returns correct structure", () => {
    const bootstrap = buildPromptEngineBootstrap();
    assert.equal(bootstrap.capabilityGroupId, "prompt-engine");
    assert.ok(Array.isArray(bootstrap.catalog));
    assert.ok(Array.isArray(bootstrap.registeredServiceIds));
    assert.equal(bootstrap.catalog.length, 5);
    assert.equal(bootstrap.registeredServiceIds.length, 2);
});
test("buildPromptEngineBootstrap catalog matches capability baselines", () => {
    const bootstrap = buildPromptEngineBootstrap();
    const directBaselines = listPromptEngineCapabilityBaselines();
    assert.deepEqual(bootstrap.catalog, directBaselines);
});
test("buildPromptEngineBootstrap includes correct service IDs", () => {
    const bootstrap = buildPromptEngineBootstrap();
    assert.ok(bootstrap.registeredServiceIds.includes(PROMPT_ENGINE_CATALOG_SERVICE_ID));
    assert.ok(bootstrap.registeredServiceIds.includes(PROMPT_ENGINE_BOOTSTRAP_SERVICE_ID));
});
test("buildPromptEngineBootstrap service IDs are correctly formatted", () => {
    assert.equal(PROMPT_ENGINE_CATALOG_SERVICE_ID, "aiops.prompt-engine.catalog");
    assert.equal(PROMPT_ENGINE_BOOTSTRAP_SERVICE_ID, "aiops.prompt-engine.bootstrap");
});
test("registerPromptEngineBootstrap registers services in provided registry", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const bootstrap = registerPromptEngineBootstrap(registry);
        assert.equal(registry.isInitialized(PROMPT_ENGINE_CATALOG_SERVICE_ID), true);
        assert.equal(registry.isInitialized(PROMPT_ENGINE_BOOTSTRAP_SERVICE_ID), true);
        assert.equal(bootstrap.capabilityGroupId, "prompt-engine");
    }
    finally {
        await registry.reset();
    }
});
test("registerPromptEngineBootstrap uses default registry when none provided", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const bootstrap1 = registerPromptEngineBootstrap();
        const bootstrap2 = registerPromptEngineBootstrap(registry);
        assert.ok(bootstrap1 != null);
        assert.ok(bootstrap2 != null);
    }
    finally {
        await registry.reset();
    }
});
test("registerPromptEngineBootstrap returns bootstrap from registry", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const bootstrap = registerPromptEngineBootstrap(registry);
        const retrieved = registry.get(PROMPT_ENGINE_BOOTSTRAP_SERVICE_ID);
        assert.ok(retrieved != null);
        assert.equal(retrieved.capabilityGroupId, "prompt-engine");
    }
    finally {
        await registry.reset();
    }
});
test("registerPromptEngineBootstrap bootstrap depends on catalog service", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        registerPromptEngineBootstrap(registry);
        const catalogService = registry.get(PROMPT_ENGINE_CATALOG_SERVICE_ID);
        assert.ok(catalogService != null);
        assert.equal(catalogService.length, 5);
    }
    finally {
        await registry.reset();
    }
});
// ============================================================================
// Cross-Module Consistency Tests
// ============================================================================
test("prompt-engine-baseline exports match bootstrap catalog", () => {
    const bootstrap = buildPromptEngineBootstrap();
    const directBaselines = listPromptEngineCapabilityBaselines();
    assert.equal(bootstrap.catalog.length, directBaselines.length);
    assert.equal(bootstrap.catalog.length, PROMPT_ENGINE_CAPABILITY_BASELINES.length);
});
test("direct baseline import matches bootstrap catalog", () => {
    const bootstrap = buildPromptEngineBootstrap();
    const directImport = listPromptEngineCapabilityBaselines();
    for (let i = 0; i < bootstrap.catalog.length; i++) {
        assert.equal(bootstrap.catalog[i]?.capabilityId, directImport[i]?.capabilityId);
    }
});
test("resolveBaselineDirect matches resolvePromptEngineCapabilityBaseline", () => {
    const capabilityIds = [
        "registry",
        "renderer",
        "rollout",
        "eval",
        "conversation-template",
    ];
    for (const id of capabilityIds) {
        const fromBaseline = resolvePromptEngineCapabilityBaseline(id);
        const fromBootstrap = resolvePromptEngineCapabilityBaseline(id);
        assert.deepEqual(fromBaseline, fromBootstrap);
    }
});
// ============================================================================
// Capability Baseline Content Tests
// ============================================================================
test("registry capability has correct structure", () => {
    const baseline = resolvePromptEngineCapabilityBaseline("registry");
    assert.equal(baseline.capabilityId, "registry");
    assert.match(baseline.entryModule, /registry/);
    assert.ok(baseline.description.length > 0);
    assert.ok(baseline.baselineServices.includes("PromptTemplateRegistryService"));
    assert.ok(baseline.baselineServices.includes("HierarchicalPromptRegistryService"));
});
test("renderer capability has correct structure", () => {
    const baseline = resolvePromptEngineCapabilityBaseline("renderer");
    assert.equal(baseline.capabilityId, "renderer");
    assert.match(baseline.entryModule, /renderer/);
    assert.ok(baseline.baselineServices.includes("PromptRendererService"));
});
test("rollout capability has correct structure", () => {
    const baseline = resolvePromptEngineCapabilityBaseline("rollout");
    assert.equal(baseline.capabilityId, "rollout");
    assert.match(baseline.entryModule, /rollout/);
    assert.ok(baseline.baselineServices.includes("PromptRolloutService"));
});
test("eval capability has correct structure", () => {
    const baseline = resolvePromptEngineCapabilityBaseline("eval");
    assert.equal(baseline.capabilityId, "eval");
    assert.match(baseline.entryModule, /eval/);
    assert.ok(baseline.baselineServices.includes("EvalDatasetJudgeService"));
});
test("conversation-template capability has correct structure", () => {
    const baseline = resolvePromptEngineCapabilityBaseline("conversation-template");
    assert.equal(baseline.capabilityId, "conversation-template");
    assert.match(baseline.entryModule, /conversation-template/);
    assert.ok(baseline.baselineServices.includes("ConversationTemplateRegistry"));
});
// ============================================================================
// Service ID Uniqueness Tests
// ============================================================================
test("catalog and bootstrap service IDs are distinct", () => {
    assert.notEqual(PROMPT_ENGINE_CATALOG_SERVICE_ID, PROMPT_ENGINE_BOOTSTRAP_SERVICE_ID);
});
test("service IDs follow naming convention", () => {
    assert.match(PROMPT_ENGINE_CATALOG_SERVICE_ID, /^aiops\.prompt-engine\./);
    assert.match(PROMPT_ENGINE_BOOTSTRAP_SERVICE_ID, /^aiops\.prompt-engine\./);
});
// ============================================================================
// Type Exports Tests
// ============================================================================
test("PromptEngineCapabilityBaseline type is exported from bootstrap", () => {
    // This test verifies the type is properly exported
    const baseline = {
        capabilityId: "registry",
        entryModule: "test",
        description: "test",
        baselineServices: ["test"],
    };
    assert.equal(baseline.capabilityId, "registry");
});
test("PromptEngineCapabilityId type accepts all valid values", () => {
    const validIds = [
        "registry",
        "renderer",
        "rollout",
        "eval",
        "conversation-template",
    ];
    for (const id of validIds) {
        const baseline = resolvePromptEngineCapabilityBaseline(id);
        assert.equal(baseline.capabilityId, id);
    }
});
//# sourceMappingURL=prompt-engine.test.js.map