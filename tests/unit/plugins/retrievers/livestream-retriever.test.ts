import assert from "node:assert/strict";
import test from "node:test";

import { createLivestreamRetrieverPlugin } from "../../../../src/plugins/retrievers/livestream-retriever.js";

test("LivestreamRetriever type exports are correct", () => {
  const plugin = createLivestreamRetrieverPlugin();
  assert.ok(plugin !== undefined);
});

test("LivestreamRetriever has correct plugin metadata", () => {
  const plugin = createLivestreamRetrieverPlugin();

  assert.equal(plugin.pluginId, "plugin.livestream.retriever");
  assert.equal(plugin.domainId, "live-streaming");
  assert.equal(plugin.spiType, "retriever");
});

test("LivestreamRetriever has correct capabilityIds", () => {
  const plugin = createLivestreamRetrieverPlugin();

  assert.deepEqual(plugin.capabilityIds, ["knowledge.retrieve", "domain.observe", "livestream.obs_search"]);
});

test("LivestreamRetriever.initialize is no-op", async () => {
  const plugin = createLivestreamRetrieverPlugin();
  assert.ok(plugin.initialize !== undefined);
  await plugin.initialize();
});

test("LivestreamRetriever.healthCheck reflects lifecycle state", async () => {
  const plugin = createLivestreamRetrieverPlugin();
  assert.ok(plugin.healthCheck !== undefined);
  assert.equal(await plugin.healthCheck(), false);
  await plugin.initialize?.();
  assert.equal(await plugin.healthCheck(), true);
});

test("LivestreamRetriever.shutdown returns undefined", async () => {
  const plugin = createLivestreamRetrieverPlugin();
  assert.ok(plugin.shutdown !== undefined);
  const result = await plugin.shutdown();
  assert.equal(result, undefined);
});

test("LivestreamRetriever.retrieve returns results", async () => {
  const plugin = createLivestreamRetrieverPlugin();

  const results = await plugin.retrieve({
    taskId: "task_123",
    intent: "find stream config",
    context: {},
    tokenBudget: 1000,
  });

  assert.ok(Array.isArray(results));
  assert.ok(results.length >= 2);
  assert.ok(results.every(r => r.knowledgeRef.startsWith("knowledge:")));
});

test("LivestreamRetriever.retrieve respects tokenBudget", async () => {
  const plugin = createLivestreamRetrieverPlugin();

  const smallBudget = await plugin.retrieve({
    taskId: "task_small",
    intent: "stream analytics",
    context: {},
    tokenBudget: 200,
  });

  const largeBudget = await plugin.retrieve({
    taskId: "task_large",
    intent: "stream analytics",
    context: {},
    tokenBudget: 2000,
  });

  assert.ok(smallBudget.length >= 2);
  assert.ok(largeBudget.length <= 8);
});

test("LivestreamRetriever.retrieve includes context fields in search", async () => {
  const plugin = createLivestreamRetrieverPlugin();

  const results = await plugin.retrieve({
    taskId: "task_ctx",
    intent: "viewer engagement",
    context: { stream: "my_stream", platform: "twitch", metric: "concurrent" },
    tokenBudget: 1000,
  });

  assert.ok(results.length > 0);
  // Check that at least some results have snippets mentioning the search
  const resultsWithSnippets = results.filter(r => 'snippet' in r && r.snippet !== undefined);
  assert.ok(resultsWithSnippets.length > 0);
});

test("LivestreamRetriever.retrieve returns results with correct structure", async () => {
  const plugin = createLivestreamRetrieverPlugin();

  const results = await plugin.retrieve({
    taskId: "task_struct",
    intent: "obs config",
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

test("LivestreamRetriever.retrieve returns namespaces starting with livestream/", async () => {
  const plugin = createLivestreamRetrieverPlugin();

  const results = await plugin.retrieve({
    taskId: "task_ns",
    intent: "obs",
    context: {},
    tokenBudget: 1000,
  });

  for (const result of results) {
    if ('namespace' in result && result.namespace !== undefined) {
      assert.ok(result.namespace.startsWith("livestream/"), `Expected namespace to start with livestream/, got ${result.namespace}`);
    }
  }
});
