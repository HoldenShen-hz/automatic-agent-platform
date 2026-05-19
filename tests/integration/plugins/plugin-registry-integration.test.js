/**
 * Integration Test: Plugin Registry
 *
 * Verifies plugin registry integration with builtin plugins,
 * registration, activation, and invocation flows.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { PluginSpiRegistry } from "../../../src/domains/registry/plugin-spi-registry.js";
import { createBuiltinPlugin, listBuiltinPluginIds } from "../../../src/plugins/builtin-plugin-registry.js";
test("plugin registry integration: registers and resolves builtin plugins", () => {
    const registry = new PluginSpiRegistry();
    // Register several builtin plugins
    const codingRetriever = createBuiltinPlugin("plugin.coding.retriever");
    const codingPresenter = createBuiltinPlugin("plugin.coding.presenter");
    const basicPlanner = createBuiltinPlugin("plugin.core.basic-planner");
    const basicEvaluator = createBuiltinPlugin("plugin.core.basic-evaluator");
    assert.ok(codingRetriever, "coding retriever should be created");
    assert.ok(codingPresenter, "coding presenter should be created");
    assert.ok(basicPlanner, "basic planner should be created");
    assert.ok(basicEvaluator, "basic evaluator should be created");
    registry.register(codingRetriever);
    registry.register(codingPresenter);
    registry.register(basicPlanner);
    registry.register(basicEvaluator);
    // Verify resolution
    const resolvedRetriever = registry.resolve("plugin.coding.retriever");
    assert.ok(resolvedRetriever, "should resolve registered retriever");
    assert.equal(resolvedRetriever?.spiType, "retriever");
    const resolvedPresenter = registry.resolve("plugin.coding.presenter");
    assert.ok(resolvedPresenter, "should resolve registered presenter");
    assert.equal(resolvedPresenter?.spiType, "presenter");
});
test("plugin registry integration: list shows all registered plugins", () => {
    const registry = new PluginSpiRegistry();
    registry.register(createBuiltinPlugin("plugin.coding.retriever"));
    registry.register(createBuiltinPlugin("plugin.core.basic-planner"));
    const allPlugins = registry.list();
    assert.ok(allPlugins.length >= 2, "should list registered plugins");
    const pluginIds = allPlugins.map((r) => r.manifest.pluginId);
    assert.ok(pluginIds.includes("plugin.coding.retriever"));
    assert.ok(pluginIds.includes("plugin.core.basic-planner"));
});
test("plugin registry integration: listByDomain filters correctly", () => {
    const registry = new PluginSpiRegistry();
    registry.register(createBuiltinPlugin("plugin.coding.retriever"));
    registry.register(createBuiltinPlugin("plugin.coding.presenter"));
    registry.register(createBuiltinPlugin("plugin.core.basic-planner"));
    const codingPlugins = registry.listByDomain("coding");
    assert.ok(codingPlugins.length >= 2, "should find coding domain plugins");
    const codingPluginIds = codingPlugins.map((r) => r.manifest.pluginId);
    assert.ok(codingPluginIds.includes("plugin.coding.retriever"));
    assert.ok(codingPluginIds.includes("plugin.coding.presenter"));
});
test("plugin registry integration: ensureActive activates inactive plugin", async () => {
    const registry = new PluginSpiRegistry();
    const retriever = createBuiltinPlugin("plugin.coding.retriever");
    assert.ok(retriever);
    registry.register(retriever);
    // First call should activate
    const activated = await registry.ensureActive("plugin.coding.retriever");
    assert.ok(activated, "should activate the plugin");
    assert.equal(activated.spiType, "retriever");
    // Second call should return same plugin (idempotent)
    const activatedAgain = await registry.ensureActive("plugin.coding.retriever");
    assert.ok(activatedAgain, "should return already active plugin");
});
test("plugin registry integration: deactivated plugin can be reactivated", async () => {
    const registry = new PluginSpiRegistry();
    const planner = createBuiltinPlugin("plugin.core.basic-planner");
    registry.register(planner);
    // Activate first
    await registry.ensureActive("plugin.core.basic-planner");
    // Deactivate
    await registry.deactivate("plugin.core.basic-planner");
    // Reactivate should succeed
    const reactivated = await registry.ensureActive("plugin.core.basic-planner");
    assert.ok(reactivated, "should reactivate deactivated plugin");
});
test("plugin registry integration: unknown plugin throws on ensureActive", async () => {
    const registry = new PluginSpiRegistry();
    await assert.rejects(async () => registry.ensureActive("plugin.does.not.exist"), (error) => {
        assert.ok(error instanceof Error || (typeof error === "object" && error !== null));
        return true;
    });
});
test("plugin registry integration: unload removes plugin from active state", async () => {
    const registry = new PluginSpiRegistry();
    const evaluator = createBuiltinPlugin("plugin.core.basic-evaluator");
    registry.register(evaluator);
    await registry.ensureActive("plugin.core.basic-evaluator");
    await registry.unload("plugin.core.basic-evaluator");
    const record = registry.get("plugin.core.basic-evaluator");
    assert.ok(record);
    assert.equal(record.lifecycleState, "unloaded");
});
test("plugin registry integration: builtin plugin ids are consistent", () => {
    const ids = listBuiltinPluginIds();
    assert.ok(ids.includes("plugin.coding.retriever"));
    assert.ok(ids.includes("plugin.coding.presenter"));
    assert.ok(ids.includes("plugin.core.basic-evaluator"));
    assert.ok(ids.includes("plugin.core.basic-planner"));
    assert.ok(ids.includes("plugin.shared.github_adapter"));
    assert.ok(ids.includes("plugin.operations.retriever"));
    assert.ok(ids.includes("plugin.operations.presenter"));
    assert.ok(ids.includes("plugin.growth.retriever"));
    assert.ok(ids.includes("plugin.growth.presenter"));
    assert.ok(ids.includes("plugin.gamedev.retriever"));
    assert.ok(ids.includes("plugin.assetproduction.retriever"));
    assert.ok(ids.includes("plugin.livestream.retriever"));
    // Verify no duplicates
    const uniqueIds = new Set(ids);
    assert.equal(ids.length, uniqueIds.size, "plugin ids should be unique");
});
//# sourceMappingURL=plugin-registry-integration.test.js.map