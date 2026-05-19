import assert from "node:assert/strict";
import test from "node:test";
import { 
// Schema exports
PluginLifecycleStateSchema, PluginManifestSchema, PluginSandboxPolicySchema, PluginSpiTypeSchema, 
// Registry
PluginSpiRegistry, 
// Builtin plugin factories
createBuiltinPlugin, listBuiltinPluginIds, 
// Re-exported adapters
createAssetProductionAdapterPlugin, createCrmAdapterPlugin, createGameDevAdapterPlugin, createGithubAdapterPlugin, createLivestreamAdapterPlugin, 
// Re-exported planners
createBasicPlannerPlugin, 
// Re-exported presenters
createCodingPresenterPlugin, createGrowthPresenterPlugin, createOperationsPresenterPlugin, 
// Re-exported retrievers
createAssetProductionRetrieverPlugin, createCodingRetrieverPlugin, createGameDevRetrieverPlugin, createGrowthRetrieverPlugin, createLivestreamRetrieverPlugin, createOperationsRetrieverPlugin, 
// Re-exported validators
createBasicEvaluatorPlugin, } from "../../src/plugins/index.js";
test("plugins root barrel exports all plugin types", () => {
    // Verify types are exported (compile-time check)
    const plannerPlugin = undefined;
    const presenterPlugin = undefined;
    const retrieverPlugin = undefined;
    const validatorPlugin = undefined;
    const adapterPlugin = undefined;
    const context = undefined;
    const state = undefined;
    const manifest = undefined;
    const policy = undefined;
    const spiType = undefined;
    // All types should be defined (not undefined at compile time)
    assert.ok(typeof plannerPlugin !== "function");
    assert.ok(typeof presenterPlugin !== "function");
    assert.ok(typeof retrieverPlugin !== "function");
    assert.ok(typeof validatorPlugin !== "function");
    assert.ok(typeof adapterPlugin !== "function");
});
test("plugins root barrel exports schema validators", () => {
    assert.ok(PluginLifecycleStateSchema !== undefined);
    assert.ok(PluginManifestSchema !== undefined);
    assert.ok(PluginSandboxPolicySchema !== undefined);
    assert.ok(PluginSpiTypeSchema !== undefined);
});
test("PluginSpiTypeSchema accepts valid values", () => {
    const validTypes = ["retriever", "validator", "planner", "presenter", "adapter"];
    for (const type of validTypes) {
        const result = PluginSpiTypeSchema.safeParse(type);
        assert.equal(result.success, true, `Expected "${type}" to be valid`);
    }
});
test("PluginSpiTypeSchema rejects invalid values", () => {
    const result = PluginSpiTypeSchema.safeParse("invalid");
    assert.equal(result.success, false);
});
test("PluginLifecycleStateSchema accepts valid states", () => {
    const validStates = ["registered", "loaded", "active", "inactive", "unloaded", "degraded", "disabled"];
    for (const state of validStates) {
        const result = PluginLifecycleStateSchema.safeParse(state);
        assert.equal(result.success, true, `Expected "${state}" to be valid`);
    }
});
test("PluginLifecycleStateSchema rejects invalid states", () => {
    const result = PluginLifecycleStateSchema.safeParse("invalid_state");
    assert.equal(result.success, false);
});
test("PluginSandboxPolicySchema has expected shape", () => {
    const policy = PluginSandboxPolicySchema.parse({});
    assert.equal(typeof policy, "object");
    assert.equal(policy.timeoutMs, 5000);
    assert.equal(policy.allowFilesystemWrite, false);
    assert.equal(policy.allowNetworkEgress, false);
    assert.ok(Array.isArray(policy.allowedKnowledgeNamespaces));
    assert.equal(policy.maxConcurrentInvocations, 1);
    assert.equal(policy.maxQueuedInvocations, 8);
    assert.equal(policy.runtimeIsolation, "serialized_in_process");
    assert.equal(policy.cooldownMs, 0);
});
test("PluginManifestSchema has required fields", () => {
    const manifest = PluginManifestSchema.parse({
        pluginId: "test.plugin",
        name: "Test Plugin",
        version: "1.0.0",
        owner: "test",
        spiTypes: ["retriever"],
        publicSdkSurface: "test",
    });
    assert.equal(manifest.pluginId, "test.plugin");
    assert.equal(manifest.name, "Test Plugin");
    assert.equal(manifest.version, "1.0.0");
    assert.deepEqual(manifest.spiTypes, ["retriever"]);
});
test("PluginSpiRegistry can be instantiated", () => {
    const registry = new PluginSpiRegistry();
    assert.ok(registry !== undefined);
});
test("PluginSpiRegistry.register returns a record", () => {
    const registry = new PluginSpiRegistry();
    const plugin = createBasicPlannerPlugin();
    const record = registry.register(plugin);
    assert.ok(record !== undefined);
    assert.equal(record.lifecycleState, "registered");
    assert.equal(record.manifest.pluginId, "plugin.core.basic-planner");
    assert.ok(record.failureCount === 0);
    assert.ok(record.lastHealthCheckAt === null);
});
test("PluginSpiRegistry.get retrieves registered plugin", () => {
    const registry = new PluginSpiRegistry();
    const plugin = createBasicPlannerPlugin();
    registry.register(plugin);
    const record = registry.get("plugin.core.basic-planner");
    assert.ok(record !== null);
    assert.equal(record.manifest.pluginId, "plugin.core.basic-planner");
});
test("PluginSpiRegistry.get returns null for unregistered plugin", () => {
    const registry = new PluginSpiRegistry();
    const record = registry.get("nonexistent.plugin");
    assert.equal(record, null);
});
test("PluginSpiRegistry.list returns all registered plugins", () => {
    const registry = new PluginSpiRegistry();
    registry.register(createBasicPlannerPlugin());
    registry.register(createBasicEvaluatorPlugin());
    const list = registry.list();
    assert.equal(list.length, 2);
});
test("PluginSpiRegistry.listByDomain filters by domain", () => {
    const registry = new PluginSpiRegistry();
    registry.register(createGrowthRetrieverPlugin());
    registry.register(createOperationsRetrieverPlugin());
    registry.register(createCodingRetrieverPlugin());
    const growthPlugins = registry.listByDomain("growth");
    assert.equal(growthPlugins.length, 1);
    assert.equal(growthPlugins[0].manifest.domainIds[0], "growth");
});
test("PluginSpiRegistry.listByDomain with spiType filter", () => {
    const registry = new PluginSpiRegistry();
    registry.register(createBasicPlannerPlugin());
    registry.register(createBasicEvaluatorPlugin());
    registry.register(createGrowthPresenterPlugin());
    const planners = registry.listByDomain("core", "planner");
    assert.equal(planners.length, 1);
    assert.equal(planners[0].plugin.spiType, "planner");
});
test("PluginSpiRegistry.resolve returns plugin instance", () => {
    const registry = new PluginSpiRegistry();
    registry.register(createBasicPlannerPlugin());
    const plugin = registry.resolve("plugin.core.basic-planner");
    assert.ok(plugin !== null);
    assert.equal(plugin.pluginId, "plugin.core.basic-planner");
});
test("PluginSpiRegistry.resolve returns null for unregistered plugin", () => {
    const registry = new PluginSpiRegistry();
    const plugin = registry.resolve("nonexistent.plugin");
    assert.equal(plugin, null);
});
test("createBuiltinPlugin returns plugins for valid ids", () => {
    const plugin = createBuiltinPlugin("plugin.core.basic-planner");
    assert.ok(plugin !== null);
    assert.equal(plugin.pluginId, "plugin.core.basic-planner");
});
test("createBuiltinPlugin returns null for invalid ids", () => {
    const plugin = createBuiltinPlugin("plugin.does.not.exist");
    assert.equal(plugin, null);
});
test("listBuiltinPluginIds returns all builtin plugin ids", () => {
    const ids = listBuiltinPluginIds();
    assert.ok(ids.length > 0);
    assert.ok(ids.includes("plugin.core.basic-planner"));
    assert.ok(ids.includes("plugin.core.basic-evaluator"));
    assert.ok(ids.includes("plugin.coding.retriever"));
    assert.ok(ids.includes("plugin.coding.presenter"));
    assert.ok(ids.includes("plugin.shared.github_adapter"));
});
test("createBuiltinPlugin returns retriever plugins", () => {
    const retrieverIds = [
        "plugin.coding.retriever",
        "plugin.growth.retriever",
        "plugin.operations.retriever",
        "plugin.gamedev.retriever",
        "plugin.assetproduction.retriever",
        "plugin.livestream.retriever",
    ];
    for (const id of retrieverIds) {
        const plugin = createBuiltinPlugin(id);
        assert.ok(plugin !== null, `Expected ${id} to be created`);
        assert.equal(plugin.spiType, "retriever", `Expected ${id} to be a retriever`);
    }
});
test("createBuiltinPlugin returns presenter plugins", () => {
    const presenterIds = [
        "plugin.coding.presenter",
        "plugin.growth.presenter",
        "plugin.operations.presenter",
    ];
    for (const id of presenterIds) {
        const plugin = createBuiltinPlugin(id);
        assert.ok(plugin !== null, `Expected ${id} to be created`);
        assert.equal(plugin.spiType, "presenter", `Expected ${id} to be a presenter`);
    }
});
test("createBuiltinPlugin returns adapter plugins", () => {
    const adapterIds = [
        "plugin.shared.github_adapter",
        "plugin.growth.crm_adapter",
        "plugin.gamedev.unity_adapter",
        "plugin.assetproduction.figma_adapter",
        "plugin.livestream.obs_adapter",
    ];
    for (const id of adapterIds) {
        const plugin = createBuiltinPlugin(id);
        assert.ok(plugin !== null, `Expected ${id} to be created`);
        assert.equal(plugin.spiType, "adapter", `Expected ${id} to be an adapter`);
    }
});
test("plugins root barrel re-exports all adapter factories", () => {
    const adapters = [
        createAssetProductionAdapterPlugin,
        createCrmAdapterPlugin,
        createGameDevAdapterPlugin,
        createGithubAdapterPlugin,
        createLivestreamAdapterPlugin,
    ];
    for (const createAdapter of adapters) {
        const adapter = createAdapter();
        assert.ok(adapter !== undefined);
        assert.equal(adapter.spiType, "adapter");
    }
});
test("plugins root barrel re-exports all presenter factories", () => {
    const presenters = [
        createCodingPresenterPlugin,
        createGrowthPresenterPlugin,
        createOperationsPresenterPlugin,
    ];
    for (const createPresenter of presenters) {
        const presenter = createPresenter();
        assert.ok(presenter !== undefined);
        assert.equal(presenter.spiType, "presenter");
    }
});
test("plugins root barrel re-exports all retriever factories", () => {
    const retrievers = [
        createAssetProductionRetrieverPlugin,
        createCodingRetrieverPlugin,
        createGameDevRetrieverPlugin,
        createGrowthRetrieverPlugin,
        createLivestreamRetrieverPlugin,
        createOperationsRetrieverPlugin,
    ];
    for (const createRetriever of retrievers) {
        const retriever = createRetriever();
        assert.ok(retriever !== undefined);
        assert.equal(retriever.spiType, "retriever");
    }
});
test("PluginSpiRegistry can register validator and invoke it", async () => {
    const registry = new PluginSpiRegistry();
    const validator = createBasicEvaluatorPlugin();
    registry.register(validator);
    const plugin = registry.resolve("plugin.core.basic-evaluator");
    assert.ok(plugin !== null);
    // Access the plugin's validate method through any since we know it's a validator
    const validateFn = plugin.validate;
    assert.ok(typeof validateFn === "function");
    const result = await validateFn({
        stepId: "test_step",
        machineOutput: {
            stepId: "test_step",
            outputRef: "output_1",
            payload: { name: "test", count: 42 },
        },
        contract: {
            requiredFields: ["name", "count"],
            fieldTypes: { name: "string", count: "number" },
        },
    });
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
});
test("PluginSpiRegistry can register planner and invoke suggestWorkflow", async () => {
    const registry = new PluginSpiRegistry();
    const planner = createBasicPlannerPlugin();
    registry.register(planner);
    const plugin = registry.resolve("plugin.core.basic-planner");
    assert.ok(plugin !== null);
    const suggestFn = plugin.suggestWorkflow;
    assert.ok(typeof suggestFn === "function");
    const result = await suggestFn({
        taskId: "task_test",
        intent: "test task",
        assessment: {
            taskId: "task_test",
            timestamp: Date.now(),
            situationRef: "situation_1",
            phase: "pre-execution",
            complexity: "simple",
            risk: "low",
            riskAssessment: {
                level: "low",
                factors: [],
            },
            routingDecision: {
                division: "core",
                workflow: "default",
                rationale: "test",
            },
            resourceAllocation: {
                modelClass: "standard",
                maxTokens: 1000,
                timeoutMs: 60000,
            },
            approvalPolicy: {
                required: false,
            },
            executionMode: "auto",
            suggestedActions: [],
        },
    });
    assert.ok(result !== null);
    assert.equal(result.workflowId, "workflow.core.simple");
});
//# sourceMappingURL=plugins.test.js.map