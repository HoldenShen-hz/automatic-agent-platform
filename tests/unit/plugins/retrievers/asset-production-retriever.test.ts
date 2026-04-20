import assert from "node:assert/strict";
import test from "node:test";

import { createAssetProductionRetrieverPlugin } from "../../../../src/plugins/retrievers/asset-production-retriever.js";

test("AssetProductionRetriever type exports are correct", () => {
  const plugin = createAssetProductionRetrieverPlugin();
  assert.ok(plugin !== undefined);
});

test("AssetProductionRetriever has correct plugin metadata", () => {
  const plugin = createAssetProductionRetrieverPlugin();

  assert.equal(plugin.pluginId, "plugin.assetproduction.retriever");
  assert.equal(plugin.domainId, "assetproduction");
  assert.equal(plugin.spiType, "retriever");
});

test("AssetProductionRetriever has correct capabilityIds", () => {
  const plugin = createAssetProductionRetrieverPlugin();

  assert.deepEqual(plugin.capabilityIds, ["knowledge.retrieve", "domain.observe", "assetproduction.figma_search"]);
});

test("AssetProductionRetriever.initialize is no-op", async () => {
  const plugin = createAssetProductionRetrieverPlugin();
  assert.ok(plugin.initialize !== undefined);
  await plugin.initialize();
});

test("AssetProductionRetriever.healthCheck returns true", async () => {
  const plugin = createAssetProductionRetrieverPlugin();
  assert.ok(plugin.healthCheck !== undefined);
  const result = await plugin.healthCheck();
  assert.equal(result, true);
});

test("AssetProductionRetriever.shutdown returns undefined", async () => {
  const plugin = createAssetProductionRetrieverPlugin();
  assert.ok(plugin.shutdown !== undefined);
  const result = await plugin.shutdown();
  assert.equal(result, undefined);
});

test("AssetProductionRetriever.retrieve returns results", async () => {
  const plugin = createAssetProductionRetrieverPlugin();

  const results = await plugin.retrieve({
    taskId: "task_123",
    intent: "find figma file",
    context: {},
    tokenBudget: 1000,
  });

  assert.ok(Array.isArray(results));
  assert.ok(results.length >= 2);
  assert.ok(results.every(r => r.knowledgeRef.startsWith("knowledge:")));
});

test("AssetProductionRetriever.retrieve respects tokenBudget", async () => {
  const plugin = createAssetProductionRetrieverPlugin();

  const smallBudget = await plugin.retrieve({
    taskId: "task_small",
    intent: "design token",
    context: {},
    tokenBudget: 200,
  });

  const largeBudget = await plugin.retrieve({
    taskId: "task_large",
    intent: "design token",
    context: {},
    tokenBudget: 2000,
  });

  assert.ok(smallBudget.length >= 2);
  assert.ok(largeBudget.length <= 8);
});

test("AssetProductionRetriever.retrieve includes context fields in search", async () => {
  const plugin = createAssetProductionRetrieverPlugin();

  const results = await plugin.retrieve({
    taskId: "task_ctx",
    intent: "brand asset",
    context: { file: "hero_image", format: "png", brand: "acme" },
    tokenBudget: 1000,
  });

  assert.ok(results.length > 0);
});

test("AssetProductionRetriever.retrieve returns results with correct structure", async () => {
  const plugin = createAssetProductionRetrieverPlugin();

  const results = await plugin.retrieve({
    taskId: "task_struct",
    intent: "figma file",
    context: {},
    tokenBudget: 1000,
  });

  for (const result of results) {
    assert.ok(typeof result.knowledgeRef === "string");
    // Optional fields may be undefined (use 'in' check for optional properties)
    assert.ok(!('snippet' in result) || typeof result.snippet === "string");
    assert.ok(!('score' in result) || typeof result.score === "number");
    assert.ok(!('namespace' in result) || typeof result.namespace === "string");
    assert.ok(!('chunkId' in result) || typeof result.chunkId === "string");
    assert.ok(!('documentId' in result) || typeof result.documentId === "string");
    assert.ok(!('matchType' in result) || typeof result.matchType === "string");
  }
});

test("AssetProductionRetriever.retrieve returns namespaces starting with assetprod/", async () => {
  const plugin = createAssetProductionRetrieverPlugin();

  const results = await plugin.retrieve({
    taskId: "task_ns",
    intent: "figma",
    context: {},
    tokenBudget: 1000,
  });

  for (const result of results) {
    if ('namespace' in result && result.namespace !== undefined) {
      assert.ok(result.namespace.startsWith("assetprod/"), `Expected namespace to start with assetprod/, got ${result.namespace}`);
    }
  }
});
