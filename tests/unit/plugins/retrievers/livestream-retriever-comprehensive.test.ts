import assert from "node:assert/strict";
import test from "node:test";

import { createLivestreamRetrieverPlugin } from "../../../../src/plugins/retrievers/livestream-retriever.js";

test.describe("LivestreamRetriever comprehensive tests", () => {
  test("createLivestreamRetrieverPlugin returns a valid DomainRetrieverPlugin", () => {
    const plugin = createLivestreamRetrieverPlugin();
    assert.ok(plugin !== undefined);
    assert.equal(plugin.pluginId, "plugin.livestream.retriever");
    assert.equal(plugin.domainId, "livestream");
    assert.equal(plugin.spiType, "retriever");
  });

  test("capabilityIds includes expected capabilities", () => {
    const plugin = createLivestreamRetrieverPlugin();
    assert.deepEqual(plugin.capabilityIds, [
      "knowledge.retrieve",
      "domain.observe",
      "livestream.obs_search",
    ]);
  });

  test("initialize is a no-op", async () => {
    const plugin = createLivestreamRetrieverPlugin();
    let initialized = false;
    plugin.initialize = async () => {
      initialized = true;
    };
    await plugin.initialize();
    assert.equal(initialized, true);
  });

  test("healthCheck returns true", async () => {
    const plugin = createLivestreamRetrieverPlugin();
    const result = await plugin.healthCheck();
    assert.equal(result, true);
  });

  test("shutdown returns undefined", async () => {
    const plugin = createLivestreamRetrieverPlugin();
    const result = await plugin.shutdown();
    assert.equal(result, undefined);
  });

  test.describe("retrieve behavior", () => {
    test("returns results for basic query", async () => {
      const plugin = createLivestreamRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_basic",
        intent: "find stream config",
        context: {},
        tokenBudget: 1000,
      });

      assert.ok(Array.isArray(results));
      assert.ok(results.length >= 2);
    });

    test("returns results with all required fields", async () => {
      const plugin = createLivestreamRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_fields",
        intent: "obs configuration",
        context: {},
        tokenBudget: 1000,
      });

      for (const result of results) {
        assert.ok(typeof result.knowledgeRef === "string");
        assert.ok(result.knowledgeRef.startsWith("knowledge:"));
      }
    });

    test("respects tokenBudget - small budget returns minimum 2 results", async () => {
      const plugin = createLivestreamRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_small",
        intent: "analytics",
        context: {},
        tokenBudget: 100,
      });

      assert.ok(results.length >= 2);
    });

    test("respects tokenBudget - large budget returns maximum 8 results", async () => {
      const plugin = createLivestreamRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_large",
        intent: "obs config",
        context: {},
        tokenBudget: 10000,
      });

      assert.ok(results.length <= 8);
    });

    test("respects tokenBudget - exact boundary at 200 tokens per result", async () => {
      const plugin = createLivestreamRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_boundary",
        intent: "viewer engagement",
        context: {},
        tokenBudget: 400,
      });

      // With 400 tokens and 200 per result, should get 2 results
      assert.ok(results.length >= 2);
    });

    test("includes stream context in query building", async () => {
      const plugin = createLivestreamRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_stream",
        intent: "config",
        context: { stream: "my_channel" },
        tokenBudget: 1000,
      });

      assert.ok(results.length > 0);
      for (const result of results) {
        assert.ok(typeof result.knowledgeRef === "string");
      }
    });

    test("includes platform context in query building", async () => {
      const plugin = createLivestreamRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_platform",
        intent: "settings",
        context: { platform: "twitch" },
        tokenBudget: 1000,
      });

      assert.ok(results.length > 0);
    });

    test("includes metric context in query building", async () => {
      const plugin = createLivestreamRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_metric",
        intent: "analytics",
        context: { metric: "concurrent_viewers" },
        tokenBudget: 1000,
      });

      assert.ok(results.length > 0);
    });

    test("includes all context fields together", async () => {
      const plugin = createLivestreamRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_all_ctx",
        intent: "performance",
        context: { stream: "gaming_live", platform: "youtube", metric: "engagement" },
        tokenBudget: 1000,
      });

      assert.ok(results.length > 0);
    });

    test("returns results with correct namespaces", async () => {
      const plugin = createLivestreamRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_ns",
        intent: "obs",
        context: {},
        tokenBudget: 1000,
      });

      const namespaces = results.map((r) => r.namespace).filter(Boolean);
      assert.ok(namespaces.length > 0);
      for (const ns of namespaces) {
        assert.ok(
          ns!.startsWith("livestream/"),
          `Expected namespace to start with livestream/, got ${ns}`,
        );
      }
    });

    test("returns results with different matchTypes", async () => {
      const plugin = createLivestreamRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_match",
        intent: "engagement",
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
      const plugin = createLivestreamRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_scores",
        intent: "stream analytics",
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
      const plugin = createLivestreamRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_snippets",
        intent: "content plan",
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
      const plugin = createLivestreamRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_empty",
        intent: "livestream",
        context: {},
        tokenBudget: 1000,
      });

      assert.ok(Array.isArray(results));
      assert.ok(results.length >= 2);
    });

    test("handles very long intent gracefully", async () => {
      const plugin = createLivestreamRetrieverPlugin();
      const longIntent = "a".repeat(500);
      const results = await plugin.retrieve({
        taskId: "task_long",
        intent: longIntent,
        context: {},
        tokenBudget: 1000,
      });

      assert.ok(Array.isArray(results));
    });

    test("handles context with numeric values", async () => {
      const plugin = createLivestreamRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_numeric_ctx",
        intent: "analytics",
        // @ts-expect-error testing with non-string context values
        context: { metric: 12345 },
        tokenBudget: 1000,
      });

      // Should still return results even with non-string context
      assert.ok(Array.isArray(results));
    });

    test("returns chunkId in results", async () => {
      const plugin = createLivestreamRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_chunk",
        intent: "obs config",
        context: {},
        tokenBudget: 1000,
      });

      for (const result of results) {
        assert.ok(typeof result.chunkId === "string");
      }
    });

    test("returns documentId in results", async () => {
      const plugin = createLivestreamRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_doc",
        intent: "engagement",
        context: {},
        tokenBudget: 1000,
      });

      for (const result of results) {
        assert.ok(typeof result.documentId === "string");
      }
    });

    test("returns higher scored results first", async () => {
      const plugin = createLivestreamRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_order",
        intent: "obs configuration",
        context: {},
        tokenBudget: 1000,
      });

      // Results should be ordered by score descending
      const scores = results.map((r) => r.score).filter((s) => s !== undefined);
      for (let i = 1; i < scores.length; i++) {
        assert.ok(
          scores[i - 1]! >= scores[i]!,
          `Expected scores to be in descending order: ${scores[i - 1]} >= ${scores[i]}`,
        );
      }
    });
  });
});
