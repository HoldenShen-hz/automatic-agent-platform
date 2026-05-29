import assert from "node:assert/strict";
import test from "node:test";

import {
  createGameDevRetrieverPlugin,
  createGameDevRetrieverPluginWithOptions,
} from "../../../../src/plugins/retrievers/game-dev-retriever.js";

test("GameDevRetriever exposes the expected plugin metadata", () => {
  const plugin = createGameDevRetrieverPlugin();

  assert.equal(plugin.pluginId, "plugin.gamedev.retriever");
  assert.equal(plugin.domainId, "game-dev");
  assert.equal(plugin.spiType, "retriever");
  assert.deepEqual(plugin.capabilityIds, [
    "knowledge.retrieve",
    "domain.observe",
    "gamedev.unity_search",
  ]);
});

test("GameDevRetriever optional lifecycle hooks resolve safely", async () => {
  const plugin = createGameDevRetrieverPluginWithOptions({
    healthCheck: async () => true,
  });

  await plugin.initialize?.();
  assert.equal(await plugin.healthCheck?.(), true);
  assert.equal(await plugin.shutdown?.(), undefined);
});

test("GameDevRetriever retrieve returns bounded knowledge results with current fields", async () => {
  const plugin = createGameDevRetrieverPlugin();
  const smallBudget = await plugin.retrieve({
    taskId: "task-small",
    intent: "unity build",
    context: {},
    tokenBudget: 100,
  });
  const richContext = await plugin.retrieve({
    taskId: "task-rich",
    intent: "asset",
    context: { project: "RPGGame", platform: "android", scene: "BattleArena" },
    tokenBudget: 1000,
  });

  assert.equal(smallBudget.length >= 2, true);
  assert.equal(richContext.length <= 5, true);
  for (const result of richContext) {
    assert.equal(typeof result.knowledgeRef, "string");
    assert.equal(result.knowledgeRef.startsWith("knowledge:"), true);
    assert.equal(result.namespace?.startsWith("gamedev/") ?? false, true);
    assert.equal(["semantic", "keyword", "structural"].includes(result.matchType ?? ""), true);
    if (result.score !== undefined) {
      assert.equal(result.score >= 0 && result.score <= 1, true);
    }
  }
});
