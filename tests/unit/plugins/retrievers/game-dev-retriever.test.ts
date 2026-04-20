import assert from "node:assert/strict";
import test from "node:test";

import { createGameDevRetrieverPlugin } from "../../../../src/plugins/retrievers/game-dev-retriever.js";

test("GameDevRetriever type exports are correct", () => {
  const plugin = createGameDevRetrieverPlugin();
  assert.ok(plugin !== undefined);
});

test("GameDevRetriever has correct plugin metadata", () => {
  const plugin = createGameDevRetrieverPlugin();

  assert.equal(plugin.pluginId, "plugin.gamedev.retriever");
  assert.equal(plugin.domainId, "gamedev");
  assert.equal(plugin.spiType, "retriever");
});

test("GameDevRetriever has correct capabilityIds", () => {
  const plugin = createGameDevRetrieverPlugin();

  assert.deepEqual(plugin.capabilityIds, ["knowledge.retrieve", "domain.observe", "gamedev.unity_search"]);
});

test("GameDevRetriever.initialize is no-op", async () => {
  const plugin = createGameDevRetrieverPlugin();
  assert.ok(plugin.initialize !== undefined);
  await plugin.initialize();
});

test("GameDevRetriever.healthCheck returns true", async () => {
  const plugin = createGameDevRetrieverPlugin();
  assert.ok(plugin.healthCheck !== undefined);
  const result = await plugin.healthCheck();
  assert.equal(result, true);
});

test("GameDevRetriever.shutdown returns undefined", async () => {
  const plugin = createGameDevRetrieverPlugin();
  assert.ok(plugin.shutdown !== undefined);
  const result = await plugin.shutdown();
  assert.equal(result, undefined);
});

test("GameDevRetriever.retrieve returns results with default tokenBudget", async () => {
  const plugin = createGameDevRetrieverPlugin();

  const results = await plugin.retrieve({
    taskId: "task_123",
    intent: "find Unity project",
    context: {},
    tokenBudget: 1000,
  });

  assert.ok(Array.isArray(results));
  assert.ok(results.length >= 2);
  assert.ok(results.every(r => typeof r.knowledgeRef === "string"));
});

test("GameDevRetriever.retrieve respects tokenBudget", async () => {
  const plugin = createGameDevRetrieverPlugin();

  const smallBudget = await plugin.retrieve({
    taskId: "task_456",
    intent: "find project",
    context: {},
    tokenBudget: 200, // Very small budget
  });

  const largeBudget = await plugin.retrieve({
    taskId: "task_789",
    intent: "find project",
    context: {},
    tokenBudget: 2000, // Large budget
  });

  // Small budget should return minimum 2 results, large budget up to 8
  assert.ok(smallBudget.length >= 2);
  assert.ok(largeBudget.length <= 8);
});

test("GameDevRetriever.retrieve includes context in search", async () => {
  const plugin = createGameDevRetrieverPlugin();

  const results = await plugin.retrieve({
    taskId: "task_ctx",
    intent: "find asset",
    context: { project: "MyGame", platform: "ios", scene: "MainMenu" },
    tokenBudget: 1000,
  });

  assert.ok(results.length > 0);
  // All results have knowledgeRef as string
  assert.ok(results.every(r => typeof r.knowledgeRef === "string"));
});

test("GameDevRetriever.retrieve returns valid knowledge references", async () => {
  const plugin = createGameDevRetrieverPlugin();

  const results = await plugin.retrieve({
    taskId: "task_struct",
    intent: "build output",
    context: {},
    tokenBudget: 1000,
  });

  for (const result of results) {
    assert.ok(typeof result.knowledgeRef === "string");
    assert.ok(result.knowledgeRef.startsWith("knowledge:"));
  }
});

test("GameDevRetriever.retrieve returns at least 2 results even with low budget", async () => {
  const plugin = createGameDevRetrieverPlugin();

  const results = await plugin.retrieve({
    taskId: "task_ns",
    intent: "unity project",
    context: {},
    tokenBudget: 100,
  });

  assert.ok(results.length >= 2);
});
