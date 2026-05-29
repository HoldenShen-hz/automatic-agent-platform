import assert from "node:assert/strict";
import test from "node:test";

import {
  createAssetProductionAdapterPlugin,
  createBasicEvaluatorPlugin,
  createBasicPlannerPlugin,
  buildHashedCredentialFingerprint,
  createCodingPresenterPlugin,
  createCodingRetrieverPlugin,
  createGithubAdapterPlugin,
  createCrmAdapterPlugin,
  createGameDevAdapterPlugin,
  createLivestreamAdapterPlugin,
  createGrowthPresenterPlugin,
  createOperationsPresenterPlugin,
  createGrowthRetrieverPlugin,
  createOperationsRetrieverPlugin,
  createGameDevRetrieverPlugin,
  createAssetProductionRetrieverPlugin,
  createLivestreamRetrieverPlugin,
  listBuiltinPluginIds,
  createBuiltinPlugin,
  PluginSpiRegistry,
  PluginLifecycleStateSchema,
  PluginManifestSchema,
  PluginSandboxPolicySchema,
  PluginSpiTypeSchema,
} from "../../../src/plugins/index.js";
import * as PluginsIndex from "../../../src/plugins/index.js";

test("plugins root barrel exposes canonical plugin factories", () => {
  assert.equal(typeof createGithubAdapterPlugin, "function");
  assert.equal(typeof createAssetProductionAdapterPlugin, "function");
  assert.equal(typeof createBasicPlannerPlugin, "function");
  assert.equal(typeof createCodingPresenterPlugin, "function");
  assert.equal(typeof createCodingRetrieverPlugin, "function");
  assert.equal(typeof createBasicEvaluatorPlugin, "function");
});

test("plugins root barrel preserves builtin registry exports", () => {
  assert.ok(listBuiltinPluginIds().length > 0);
});

test("plugins root barrel exposes all adapter factories", () => {
  assert.equal(typeof createGithubAdapterPlugin, "function");
  assert.equal(typeof createCrmAdapterPlugin, "function");
  assert.equal(typeof createGameDevAdapterPlugin, "function");
  assert.equal(typeof createAssetProductionAdapterPlugin, "function");
  assert.equal(typeof createLivestreamAdapterPlugin, "function");
  assert.equal(typeof buildHashedCredentialFingerprint, "function");
});

test("plugins root barrel exposes all presenter factories", () => {
  assert.equal(typeof createCodingPresenterPlugin, "function");
  assert.equal(typeof createGrowthPresenterPlugin, "function");
  assert.equal(typeof createOperationsPresenterPlugin, "function");
});

test("plugins root barrel exposes all retriever factories", () => {
  assert.equal(typeof createCodingRetrieverPlugin, "function");
  assert.equal(typeof createGrowthRetrieverPlugin, "function");
  assert.equal(typeof createOperationsRetrieverPlugin, "function");
  assert.equal(typeof createGameDevRetrieverPlugin, "function");
  assert.equal(typeof createAssetProductionRetrieverPlugin, "function");
  assert.equal(typeof createLivestreamRetrieverPlugin, "function");
});

test("plugins root barrel exposes PluginSpiRegistry", () => {
  assert.equal(typeof PluginSpiRegistry, "function");
});

test("plugins root barrel exposes plugin schemas", () => {
  assert.equal(typeof PluginLifecycleStateSchema, "object");
  assert.equal(typeof PluginManifestSchema, "object");
  assert.equal(typeof PluginSandboxPolicySchema, "object");
  assert.equal(typeof PluginSpiTypeSchema, "object");
});

test("createBuiltinPlugin returns null for unknown plugin", () => {
  const plugin = createBuiltinPlugin("unknown.plugin.id");
  assert.equal(plugin, null);
});

test("createBuiltinPlugin returns plugin for known plugin id", () => {
  const plugin = createBuiltinPlugin("plugin.coding.retriever");
  assert.ok(plugin !== null);
  assert.equal(plugin!.pluginId, "plugin.coding.retriever");
});

test("PluginSpiRegistry can be instantiated", () => {
  const registry = new PluginSpiRegistry();
  assert.ok(registry !== undefined);
});

test("plugins root barrel does not leak builtin registry internals", () => {
  assert.equal("PluginMarketplaceRegistry" in PluginsIndex, false);
  assert.equal("BundleRevocationRegistry" in PluginsIndex, false);
});

test("listBuiltinPluginIds returns all expected plugin ids", () => {
  const ids = listBuiltinPluginIds();
  assert.ok(ids.includes("plugin.coding.retriever"));
  assert.ok(ids.includes("plugin.core.basic-planner"));
  assert.ok(ids.includes("plugin.core.basic-evaluator"));
});
