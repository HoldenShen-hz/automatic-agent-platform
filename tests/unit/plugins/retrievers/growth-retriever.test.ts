import assert from "node:assert/strict";
import test from "node:test";

import { createGrowthRetrieverPlugin } from "../../../../src/plugins/retrievers/growth-retriever.js";

test("GrowthRetriever type exports are correct", () => {
  const plugin = createGrowthRetrieverPlugin();
  assert.ok(plugin !== undefined);
});

test("GrowthRetriever has correct plugin metadata", () => {
  const plugin = createGrowthRetrieverPlugin();

  assert.equal(plugin.pluginId, "plugin.growth.retriever");
  assert.equal(plugin.domainId, "growth");
  assert.equal(plugin.spiType, "retriever");
});

test("GrowthRetriever has correct capabilityIds", () => {
  const plugin = createGrowthRetrieverPlugin();

  assert.deepEqual(plugin.capabilityIds, ["knowledge.retrieve", "domain.observe", "growth.playbook_search"]);
});

test("GrowthRetriever.initialize is no-op", async () => {
  const plugin = createGrowthRetrieverPlugin();
  assert.ok(plugin.initialize !== undefined);
  await plugin.initialize();
});

test("GrowthRetriever.healthCheck returns true", async () => {
  const plugin = createGrowthRetrieverPlugin();
  assert.ok(plugin.healthCheck !== undefined);
  const result = await plugin.healthCheck();
  assert.equal(result, true);
});

test("GrowthRetriever.shutdown returns undefined", async () => {
  const plugin = createGrowthRetrieverPlugin();
  assert.ok(plugin.shutdown !== undefined);
  const result = await plugin.shutdown();
  assert.equal(result, undefined);
});

test("GrowthRetriever.retrieve returns results with default tokenBudget", async () => {
  const plugin = createGrowthRetrieverPlugin();

  const results = await plugin.retrieve({
    taskId: "task_123",
    intent: "find growth playbook",
    context: {},
    tokenBudget: 1000,
  });

  assert.ok(Array.isArray(results));
  assert.ok(results.length >= 2);
  assert.ok(results.every(r => typeof r.knowledgeRef === "string"));
});

test("GrowthRetriever.retrieve respects tokenBudget", async () => {
  const plugin = createGrowthRetrieverPlugin();

  const smallBudget = await plugin.retrieve({
    taskId: "task_456",
    intent: "campaign data",
    context: {},
    tokenBudget: 200,
  });

  const largeBudget = await plugin.retrieve({
    taskId: "task_789",
    intent: "campaign data",
    context: {},
    tokenBudget: 2000,
  });

  assert.ok(smallBudget.length >= 2);
  assert.ok(largeBudget.length <= 8);
});

test("GrowthRetriever.retrieve includes context in search", async () => {
  const plugin = createGrowthRetrieverPlugin();

  const results = await plugin.retrieve({
    taskId: "task_ctx",
    intent: "AB test results",
    context: { campaign: "summer_sale", metric: "conversion" },
    tokenBudget: 1000,
  });

  assert.ok(results.length > 0);
  assert.ok(results.every(r => typeof r.knowledgeRef === "string"));
});

test("GrowthRetriever.retrieve returns valid knowledge references", async () => {
  const plugin = createGrowthRetrieverPlugin();

  const results = await plugin.retrieve({
    taskId: "task_struct",
    intent: "growth playbook",
    context: {},
    tokenBudget: 1000,
  });

  for (const result of results) {
    assert.ok(typeof result.knowledgeRef === "string");
    assert.ok(result.knowledgeRef.startsWith("knowledge:"));
  }
});

test("GrowthRetriever.retrieve returns at least 2 results even with low budget", async () => {
  const plugin = createGrowthRetrieverPlugin();

  const results = await plugin.retrieve({
    taskId: "task_min",
    intent: "playbook",
    context: {},
    tokenBudget: 100,
  });

  assert.ok(results.length >= 2);
});
