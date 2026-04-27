/**
 * @fileoverview Unit tests for Plugin SPI types and registry
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  PluginLifecycleStateSchema,
  PluginManifestSchema,
  PluginSandboxPolicySchema,
  PluginSpiTypeSchema,
  PluginSpiRegistry,
  createBuiltinPlugin,
  listBuiltinPluginIds,
  createGithubAdapterPlugin,
  createCrmAdapterPlugin,
  createGameDevAdapterPlugin,
  createAssetProductionAdapterPlugin,
  createLivestreamAdapterPlugin,
  createBasicPlannerPlugin,
  createCodingPresenterPlugin,
  createCodingRetrieverPlugin,
  createGrowthPresenterPlugin,
  createGrowthRetrieverPlugin,
  createOperationsPresenterPlugin,
  createOperationsRetrieverPlugin,
  createGameDevRetrieverPlugin,
  createAssetProductionRetrieverPlugin,
  createLivestreamRetrieverPlugin,
  createBasicEvaluatorPlugin,
} from "../../../src/plugins/index.js";

test("PluginSpiRegistry can be instantiated and has expected methods", () => {
  const registry = new PluginSpiRegistry();
  assert.ok(typeof registry.register === "function");
  assert.ok(typeof registry.get === "function");
  assert.ok(typeof registry.list === "function");
});

test("PluginSpiRegistry.register and get work correctly", () => {
  const registry = new PluginSpiRegistry();
  const plugin = createBasicPlannerPlugin();

  registry.register(plugin);
  const retrieved = registry.get(plugin.pluginId);

  assert.ok(retrieved !== null);
  assert.equal(retrieved?.pluginId, plugin.pluginId);
});

test("PluginSpiRegistry.list returns all registered plugins", () => {
  const registry = new PluginSpiRegistry();
  registry.register(createBasicPlannerPlugin());
  registry.register(createBasicEvaluatorPlugin());

  const plugins = registry.list();
  assert.ok(plugins.length >= 2);
});

test("PluginSpiRegistry returns null for unknown plugin ID", () => {
  const registry = new PluginSpiRegistry();
  const result = registry.get("nonexistent.plugin.id");
  assert.equal(result, null);
});

test("PluginLifecycleStateSchema is a valid schema object", () => {
  assert.ok(PluginLifecycleStateSchema != null);
  assert.ok(typeof PluginLifecycleStateSchema === "object");
});

test("PluginManifestSchema is a valid schema object", () => {
  assert.ok(PluginManifestSchema != null);
  assert.ok(typeof PluginManifestSchema === "object");
});

test("PluginSandboxPolicySchema is a valid schema object", () => {
  assert.ok(PluginSandboxPolicySchema != null);
  assert.ok(typeof PluginSandboxPolicySchema === "object");
});

test("PluginSpiTypeSchema is a valid schema object", () => {
  assert.ok(PluginSpiTypeSchema != null);
  assert.ok(typeof PluginSpiTypeSchema === "object");
});

test("createBuiltinPlugin returns null for unknown plugin ID", () => {
  const plugin = createBuiltinPlugin("unknown.plugin.id");
  assert.equal(plugin, null);
});

test("createBuiltinPlugin returns plugin for known coding retriever", () => {
  const plugin = createBuiltinPlugin("plugin.coding.retriever");
  assert.ok(plugin !== null);
  assert.equal(plugin!.pluginId, "plugin.coding.retriever");
});

test("createBuiltinPlugin returns plugin for basic planner", () => {
  const plugin = createBuiltinPlugin("plugin.core.basic-planner");
  assert.ok(plugin !== null);
  assert.equal(plugin!.pluginId, "plugin.core.basic-planner");
});

test("createBuiltinPlugin returns plugin for basic evaluator", () => {
  const plugin = createBuiltinPlugin("plugin.core.basic-evaluator");
  assert.ok(plugin !== null);
  assert.equal(plugin!.pluginId, "plugin.core.basic-evaluator");
});

test("createBuiltinPlugin returns adapter plugins", () => {
  const github = createBuiltinPlugin("plugin.shared.github_adapter");
  assert.ok(github !== null);

  const crm = createBuiltinPlugin("plugin.growth.crm_adapter");
  assert.ok(crm !== null);

  const gameDev = createBuiltinPlugin("plugin.gamedev.unity_adapter");
  assert.ok(gameDev !== null);

  const assetProd = createBuiltinPlugin("plugin.assetproduction.figma_adapter");
  assert.ok(assetProd !== null);

  const livestream = createBuiltinPlugin("plugin.livestream.obs_adapter");
  assert.ok(livestream !== null);
});

test("createBuiltinPlugin returns retriever plugins", () => {
  const coding = createBuiltinPlugin("plugin.coding.retriever");
  assert.ok(coding !== null);

  const operations = createBuiltinPlugin("plugin.operations.retriever");
  assert.ok(operations !== null);

  const growth = createBuiltinPlugin("plugin.growth.retriever");
  assert.ok(growth !== null);

  const gameDev = createBuiltinPlugin("plugin.gamedev.retriever");
  assert.ok(gameDev !== null);

  const assetProd = createBuiltinPlugin("plugin.assetproduction.retriever");
  assert.ok(assetProd !== null);

  const livestream = createBuiltinPlugin("plugin.livestream.retriever");
  assert.ok(livestream !== null);
});

test("createBuiltinPlugin returns presenter plugins", () => {
  const coding = createBuiltinPlugin("plugin.coding.presenter");
  assert.ok(coding !== null);

  const growth = createBuiltinPlugin("plugin.growth.presenter");
  assert.ok(growth !== null);

  const operations = createBuiltinPlugin("plugin.operations.presenter");
  assert.ok(operations !== null);
});

test("listBuiltinPluginIds returns all expected plugin IDs", () => {
  const ids = listBuiltinPluginIds();

  // Check that all expected plugin types are present
  assert.ok(ids.includes("plugin.coding.retriever"));
  assert.ok(ids.includes("plugin.coding.presenter"));
  assert.ok(ids.includes("plugin.core.basic-planner"));
  assert.ok(ids.includes("plugin.core.basic-evaluator"));
  assert.ok(ids.includes("plugin.shared.github_adapter"));
  assert.ok(ids.includes("plugin.operations.retriever"));
  assert.ok(ids.includes("plugin.operations.presenter"));
  assert.ok(ids.includes("plugin.growth.retriever"));
  assert.ok(ids.includes("plugin.growth.presenter"));
  assert.ok(ids.includes("plugin.growth.crm_adapter"));
  assert.ok(ids.includes("plugin.gamedev.retriever"));
  assert.ok(ids.includes("plugin.gamedev.unity_adapter"));
  assert.ok(ids.includes("plugin.assetproduction.retriever"));
  assert.ok(ids.includes("plugin.assetproduction.figma_adapter"));
  assert.ok(ids.includes("plugin.livestream.retriever"));
  assert.ok(ids.includes("plugin.livestream.obs_adapter"));
});

test("each builtin plugin factory creates valid plugin structure", () => {
  const pluginFactories = [
    createGithubAdapterPlugin,
    createCrmAdapterPlugin,
    createGameDevAdapterPlugin,
    createAssetProductionAdapterPlugin,
    createLivestreamAdapterPlugin,
    createBasicPlannerPlugin,
    createCodingPresenterPlugin,
    createCodingRetrieverPlugin,
    createGrowthPresenterPlugin,
    createGrowthRetrieverPlugin,
    createOperationsPresenterPlugin,
    createOperationsRetrieverPlugin,
    createGameDevRetrieverPlugin,
    createAssetProductionRetrieverPlugin,
    createLivestreamRetrieverPlugin,
    createBasicEvaluatorPlugin,
  ];

  for (const factory of pluginFactories) {
    const plugin = factory();
    assert.ok(plugin != null);
    assert.ok(plugin.pluginId.length > 0);
    assert.ok(plugin.version.length > 0);
    assert.ok(Array.isArray(plugin.capabilityIds));
  }
});
