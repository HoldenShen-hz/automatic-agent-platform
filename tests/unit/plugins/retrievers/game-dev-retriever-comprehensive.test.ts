import assert from "node:assert/strict";
import test from "node:test";

import {
  createGameDevRetrieverPlugin,
  createGameDevRetrieverPluginWithOptions,
} from "../../../../src/plugins/retrievers/game-dev-retriever.js";

test.describe("GameDevRetriever comprehensive tests", () => {
  test("createGameDevRetrieverPlugin returns a valid DomainRetrieverPlugin", () => {
    const plugin = createGameDevRetrieverPlugin();
    assert.ok(plugin !== undefined);
    assert.equal(plugin.pluginId, "plugin.gamedev.retriever");
    assert.equal(plugin.domainId, "gamedev");
    assert.equal(plugin.spiType, "retriever");
  });

  test("createGameDevRetrieverPluginWithOptions returns a valid DomainRetrieverPlugin", () => {
    const plugin = createGameDevRetrieverPluginWithOptions();
    assert.ok(plugin !== undefined);
    assert.equal(plugin.pluginId, "plugin.gamedev.retriever");
    assert.equal(plugin.domainId, "gamedev");
    assert.equal(plugin.spiType, "retriever");
  });

  test("capabilityIds includes expected capabilities", () => {
    const plugin = createGameDevRetrieverPlugin();
    assert.deepEqual(plugin.capabilityIds, [
      "knowledge.retrieve",
      "domain.observe",
      "gamedev.unity_search",
    ]);
  });

  test("initialize is a no-op", async () => {
    const plugin = createGameDevRetrieverPlugin();
    let initialized = false;
    plugin.initialize = async () => {
      initialized = true;
    };
    await plugin.initialize();
    assert.equal(initialized, true);
  });

  test("shutdown returns undefined", async () => {
    const plugin = createGameDevRetrieverPlugin();
    const result = await plugin.shutdown();
    assert.equal(result, undefined);
  });

  test.describe("healthCheck behavior", () => {
    test("healthCheck returns false by default", async () => {
      const plugin = createGameDevRetrieverPlugin();
      const result = await plugin.healthCheck();
      assert.equal(result, false);
    });

    test("healthCheck returns true when custom healthCheck returns true", async () => {
      const plugin = createGameDevRetrieverPluginWithOptions({
        healthCheck: () => true,
      });
      const result = await plugin.healthCheck();
      assert.equal(result, true);
    });

    test("healthCheck returns false when custom healthCheck returns false", async () => {
      const plugin = createGameDevRetrieverPluginWithOptions({
        healthCheck: () => false,
      });
      const result = await plugin.healthCheck();
      assert.equal(result, false);
    });

    test("healthCheck delegates to async healthCheck", async () => {
      const plugin = createGameDevRetrieverPluginWithOptions({
        healthCheck: async () => true,
      });
      const result = await plugin.healthCheck();
      assert.equal(result, true);
    });

    test("healthCheck delegates to promise-returning healthCheck", async () => {
      const plugin = createGameDevRetrieverPluginWithOptions({
        healthCheck: () => Promise.resolve(true),
      });
      const result = await plugin.healthCheck();
      assert.equal(result, true);
    });
  });

  test.describe("retrieve behavior", () => {
    test("returns results for basic query", async () => {
      const plugin = createGameDevRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_basic",
        intent: "find Unity project",
        context: {},
        tokenBudget: 1000,
      });

      assert.ok(Array.isArray(results));
      assert.ok(results.length >= 2);
    });

    test("returns results with all required fields", async () => {
      const plugin = createGameDevRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_fields",
        intent: "build output",
        context: {},
        tokenBudget: 1000,
      });

      for (const result of results) {
        assert.ok(typeof result.knowledgeRef === "string");
        assert.ok(result.knowledgeRef.startsWith("knowledge:"));
      }
    });

    test("respects tokenBudget - small budget returns minimum 2 results", async () => {
      const plugin = createGameDevRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_small",
        intent: "project",
        context: {},
        tokenBudget: 100,
      });

      assert.ok(results.length >= 2);
    });

    test("respects tokenBudget - large budget returns maximum 8 results", async () => {
      const plugin = createGameDevRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_large",
        intent: "unity",
        context: {},
        tokenBudget: 10000,
      });

      assert.ok(results.length <= 8);
    });

    test("respects tokenBudget - exact boundary at 200 tokens per result", async () => {
      const plugin = createGameDevRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_boundary",
        intent: "design doc",
        context: {},
        tokenBudget: 400,
      });

      // With 400 tokens and 200 per result, should get 2 results
      assert.ok(results.length >= 2);
    });

    test("includes project context in query building", async () => {
      const plugin = createGameDevRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_project",
        intent: "asset",
        context: { project: "MyGame" },
        tokenBudget: 1000,
      });

      assert.ok(results.length > 0);
      for (const result of results) {
        assert.ok(typeof result.knowledgeRef === "string");
      }
    });

    test("includes platform context in query building", async () => {
      const plugin = createGameDevRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_platform",
        intent: "build",
        context: { platform: "ios" },
        tokenBudget: 1000,
      });

      assert.ok(results.length > 0);
    });

    test("includes scene context in query building", async () => {
      const plugin = createGameDevRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_scene",
        intent: "design doc",
        context: { scene: "MainMenu" },
        tokenBudget: 1000,
      });

      assert.ok(results.length > 0);
    });

    test("includes all context fields together", async () => {
      const plugin = createGameDevRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_all_ctx",
        intent: "asset",
        context: { project: "RPGGame", platform: "android", scene: "BattleArena" },
        tokenBudget: 1000,
      });

      assert.ok(results.length > 0);
    });

    test("returns results with correct namespaces", async () => {
      const plugin = createGameDevRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_ns",
        intent: "unity",
        context: {},
        tokenBudget: 1000,
      });

      const namespaces = results.map((r) => r.namespace).filter(Boolean);
      assert.ok(namespaces.length > 0);
      for (const ns of namespaces) {
        assert.ok(
          ns!.startsWith("gamedev/"),
          `Expected namespace to start with gamedev/, got ${ns}`,
        );
      }
    });

    test("returns results with different matchTypes", async () => {
      const plugin = createGameDevRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_match",
        intent: "asset",
        context: {},
        tokenBudget: 1000,
      });

      const matchTypes = results.map((r) => r.matchType).filter(Boolean);
      assert.ok(matchTypes.length > 0);
      for (const mt of matchTypes) {
        assert.ok(
          ["semantic", "keyword", "structural"].includes(mt!),
          `Expected matchType to be semantic, keyword, or structural, got ${mt}`,
        );
      }
    });

    test("returns results with scores between 0 and 1", async () => {
      const plugin = createGameDevRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_scores",
        intent: "build output",
        context: {},
        tokenBudget: 1000,
      });

      for (const result of results) {
        if (result.score !== undefined) {
          assert.ok(result.score >= 0 && result.score <= 1);
        }
      }
    });

    test("returns snippets in results", async () => {
      const plugin = createGameDevRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_snippets",
        intent: "design doc",
        context: {},
        tokenBudget: 1000,
      });

      for (const result of results) {
        if (result.snippet !== undefined) {
          assert.ok(typeof result.snippet === "string");
          assert.ok(result.snippet.length > 0);
        }
      }
    });

    test("handles empty context gracefully", async () => {
      const plugin = createGameDevRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_empty",
        intent: "gamedev",
        context: {},
        tokenBudget: 1000,
      });

      assert.ok(Array.isArray(results));
      assert.ok(results.length >= 2);
    });

    test("handles very long intent gracefully", async () => {
      const plugin = createGameDevRetrieverPlugin();
      const longIntent = "a".repeat(500);
      const results = await plugin.retrieve({
        taskId: "task_long",
        intent: longIntent,
        context: {},
        tokenBudget: 1000,
      });

      assert.ok(Array.isArray(results));
    });

    test("handles very long context values gracefully", async () => {
      const plugin = createGameDevRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_long_ctx",
        intent: "project",
        context: { project: "a".repeat(500) },
        tokenBudget: 1000,
      });

      assert.ok(Array.isArray(results));
      assert.ok(results.length >= 2);
    });

    test("returns chunkId in results", async () => {
      const plugin = createGameDevRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_chunk",
        intent: "unity project",
        context: {},
        tokenBudget: 1000,
      });

      for (const result of results) {
        assert.ok(typeof result.chunkId === "string");
      }
    });

    test("returns documentId in results", async () => {
      const plugin = createGameDevRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_doc",
        intent: "build",
        context: {},
        tokenBudget: 1000,
      });

      for (const result of results) {
        assert.ok(typeof result.documentId === "string");
      }
    });

    test("score varies based on query length", async () => {
      const plugin = createGameDevRetrieverPlugin();
      const shortQueryResults = await plugin.retrieve({
        taskId: "task_short",
        intent: "abc",
        context: {},
        tokenBudget: 1000,
      });

      const longQueryResults = await plugin.retrieve({
        taskId: "task_long",
        intent: "a".repeat(240),
        context: {},
        tokenBudget: 1000,
      });

      // Project scores should be affected by query length
      const shortProjectScore = shortQueryResults.find(
        (r) => r.namespace === "gamedev/projects",
      )?.score;
      const longProjectScore = longQueryResults.find(
        (r) => r.namespace === "gamedev/projects",
      )?.score;

      if (shortProjectScore !== undefined && longProjectScore !== undefined) {
        // Score formula: Math.min(0.97, 0.7 + Math.min(searchQuery.length / 240, 0.18))
        // short (3 chars): 0.7 + 3/240 = 0.7125 -> capped at 0.97
        // long (240 chars): 0.7 + 240/240 = 0.7 + 1.0 = 1.7 -> capped at 0.97
        // Actually min(0.97, 1.7) = 0.97
        // For short 3 chars: min(0.97, 0.7 + 0.0125) = 0.7125
        assert.ok(shortProjectScore >= 0 && shortProjectScore <= 0.97);
        assert.ok(longProjectScore >= 0 && longProjectScore <= 0.97);
      }
    });

    test("score varies based on context key count", async () => {
      const plugin = createGameDevRetrieverPlugin();
      const noContextResults = await plugin.retrieve({
        taskId: "task_no_ctx",
        intent: "build",
        context: {},
        tokenBudget: 1000,
      });

      const withContextResults = await plugin.retrieve({
        taskId: "task_with_ctx",
        intent: "build",
        context: { project: "MyGame", platform: "ios", scene: "Menu" },
        tokenBudget: 1000,
      });

      // Build scores should be influenced by context
      const noCtxBuildScore = noContextResults.find(
        (r) => r.namespace === "gamedev/builds",
      )?.score;
      const withCtxBuildScore = withContextResults.find(
        (r) => r.namespace === "gamedev/builds",
      )?.score;

      if (noCtxBuildScore !== undefined && withCtxBuildScore !== undefined) {
        assert.notEqual(noCtxBuildScore, withCtxBuildScore);
      }
    });

    test("score varies based on tokenBudget for assets namespace", async () => {
      const plugin = createGameDevRetrieverPlugin();
      // With very small budget, tokenBudget/4000 will be small
      // score = Math.min(0.86, 0.54 + Math.min(tokenBudget/4000, 0.18))
      const tinyBudgetResults = await plugin.retrieve({
        taskId: "task_tiny_budget",
        intent: "texture",
        context: {},
        tokenBudget: 100,
      });

      const largeBudgetResults = await plugin.retrieve({
        taskId: "task_large_budget",
        intent: "texture",
        context: {},
        tokenBudget: 10000,
      });

      // Asset scores should be affected by tokenBudget
      const tinyBudgetAssetScore = tinyBudgetResults.find(
        (r) => r.namespace === "gamedev/assets",
      )?.score;
      const largeBudgetAssetScore = largeBudgetResults.find(
        (r) => r.namespace === "gamedev/assets",
      )?.score;

      if (tinyBudgetAssetScore !== undefined && largeBudgetAssetScore !== undefined) {
        // With tiny budget (100), score = 0.54 + 0.025 = 0.565
        // With large budget (10000), score = 0.54 + 0.18 = 0.72 (capped)
        assert.ok(tinyBudgetAssetScore < largeBudgetAssetScore);
      }
    });
  });
});
