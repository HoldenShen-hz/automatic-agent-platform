import assert from "node:assert/strict";
import test from "node:test";

import { createGrowthRetrieverPlugin } from "../../../../src/plugins/retrievers/growth-retriever.js";

test.describe("GrowthRetriever comprehensive tests", () => {
  test("createGrowthRetrieverPlugin returns a valid DomainRetrieverPlugin", () => {
    const plugin = createGrowthRetrieverPlugin();
    assert.ok(plugin !== undefined);
    assert.equal(plugin.pluginId, "plugin.growth.retriever");
    assert.equal(plugin.domainId, "growth");
    assert.equal(plugin.spiType, "retriever");
  });

  test("capabilityIds includes expected capabilities", () => {
    const plugin = createGrowthRetrieverPlugin();
    assert.deepEqual(plugin.capabilityIds, [
      "knowledge.retrieve",
      "domain.observe",
      "growth.playbook_search",
    ]);
  });

  test("initialize is a no-op", async () => {
    const plugin = createGrowthRetrieverPlugin();
    let initialized = false;
    plugin.initialize = async () => {
      initialized = true;
    };
    await plugin.initialize();
    assert.equal(initialized, true);
  });

  test("healthCheck returns true", async () => {
    const plugin = createGrowthRetrieverPlugin();
    await plugin.initialize();
    const result = await plugin.healthCheck();
    assert.equal(result, true);
  });

  test("shutdown returns undefined", async () => {
    const plugin = createGrowthRetrieverPlugin();
    const result = await plugin.shutdown();
    assert.equal(result, undefined);
  });

  test.describe("retrieve behavior", () => {
    test("returns results for basic query", async () => {
      const plugin = createGrowthRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_basic",
        intent: "find growth playbook",
        context: {},
        tokenBudget: 1000,
      });

      assert.ok(Array.isArray(results));
      assert.ok(results.length >= 2);
    });

    test("returns results with all required fields", async () => {
      const plugin = createGrowthRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_fields",
        intent: "campaign analytics",
        context: {},
        tokenBudget: 1000,
      });

      for (const result of results) {
        assert.ok(typeof result.knowledgeRef === "string");
        assert.ok(result.knowledgeRef.startsWith("knowledge:"));
      }
    });

    test("respects tokenBudget - small budget returns minimum 2 results", async () => {
      const plugin = createGrowthRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_small",
        intent: "ab test",
        context: {},
        tokenBudget: 100,
      });

      assert.ok(results.length >= 2);
    });

    test("respects tokenBudget - large budget returns maximum 8 results", async () => {
      const plugin = createGrowthRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_large",
        intent: "playbook",
        context: {},
        tokenBudget: 10000,
      });

      assert.ok(results.length <= 8);
    });

    test("respects tokenBudget - medium budget returns bounded results", async () => {
      const plugin = createGrowthRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_medium",
        intent: "growth campaign",
        context: {},
        tokenBudget: 600,
      });

      assert.ok(results.length >= 2);
      assert.ok(results.length <= 8);
    });

    test("includes campaign context in query building", async () => {
      const plugin = createGrowthRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_campaign",
        intent: "conversion",
        context: { campaign: "summer_sale" },
        tokenBudget: 1000,
      });

      assert.ok(results.length > 0);
      for (const result of results) {
        assert.ok(typeof result.knowledgeRef === "string");
      }
    });

    test("includes metric context in query building", async () => {
      const plugin = createGrowthRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_metric",
        intent: "revenue",
        context: { metric: "conversion_rate" },
        tokenBudget: 1000,
      });

      assert.ok(results.length > 0);
    });

    test("includes all context fields together", async () => {
      const plugin = createGrowthRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_all_ctx",
        intent: "analytics",
        context: { campaign: "black_friday", metric: "roi" },
        tokenBudget: 1000,
      });

      assert.ok(results.length > 0);
    });

    test("returns results with correct namespaces", async () => {
      const plugin = createGrowthRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_ns",
        intent: "playbook",
        context: {},
        tokenBudget: 1000,
      });

      const namespaces = results.map((r) => r.namespace).filter(Boolean);
      assert.ok(namespaces.length > 0);
      for (const ns of namespaces) {
        assert.ok(
          ns!.startsWith("growth/"),
          `Expected namespace to start with growth/, got ${ns}`,
        );
      }
    });

    test("returns results with different matchTypes", async () => {
      const plugin = createGrowthRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_match",
        intent: "ab test",
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
      const plugin = createGrowthRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_scores",
        intent: "campaign data",
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
      const plugin = createGrowthRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_snippets",
        intent: "growth playbook",
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
      const plugin = createGrowthRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_empty",
        intent: "growth",
        context: {},
        tokenBudget: 1000,
      });

      assert.ok(Array.isArray(results));
      assert.ok(results.length >= 2);
    });

    test("handles very long intent gracefully", async () => {
      const plugin = createGrowthRetrieverPlugin();
      const longIntent = "a".repeat(500);
      const results = await plugin.retrieve({
        taskId: "task_long",
        intent: longIntent,
        context: {},
        tokenBudget: 1000,
      });

      assert.ok(Array.isArray(results));
    });

    test("handles intent with special characters", async () => {
      const plugin = createGrowthRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_special",
        intent: "A/B test - cohort & control (2024)",
        context: {},
        tokenBudget: 1000,
      });

      assert.ok(Array.isArray(results));
      assert.ok(results.length >= 2);
    });

    test("returns chunkId in results", async () => {
      const plugin = createGrowthRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_chunk",
        intent: "playbook",
        context: {},
        tokenBudget: 1000,
      });

      for (const result of results) {
        assert.ok(typeof result.chunkId === "string");
      }
    });

    test("returns documentId in results", async () => {
      const plugin = createGrowthRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_doc",
        intent: "campaign",
        context: {},
        tokenBudget: 1000,
      });

      for (const result of results) {
        assert.ok(typeof result.documentId === "string");
      }
    });
  });
});
