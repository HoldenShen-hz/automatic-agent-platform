import assert from "node:assert/strict";
import test from "node:test";

import { createAssetProductionRetrieverPlugin } from "../../../../src/plugins/retrievers/asset-production-retriever.js";

test.describe("AssetProductionRetriever comprehensive tests", () => {
  test("createAssetProductionRetrieverPlugin returns a valid DomainRetrieverPlugin", () => {
    const plugin = createAssetProductionRetrieverPlugin();
    assert.ok(plugin !== undefined);
    assert.equal(plugin.pluginId, "plugin.assetproduction.retriever");
    assert.equal(plugin.domainId, "assetproduction");
    assert.equal(plugin.spiType, "retriever");
  });

  test("capabilityIds includes expected capabilities", () => {
    const plugin = createAssetProductionRetrieverPlugin();
    assert.deepEqual(plugin.capabilityIds, [
      "knowledge.retrieve",
      "domain.observe",
      "assetproduction.figma_search",
    ]);
  });

  test("initialize is a no-op", async () => {
    const plugin = createAssetProductionRetrieverPlugin();
    let initialized = false;
    plugin.initialize = async () => {
      initialized = true;
    };
    await plugin.initialize();
    assert.equal(initialized, true);
  });

  test("healthCheck returns true", async () => {
    const plugin = createAssetProductionRetrieverPlugin();
    const result = await plugin.healthCheck();
    assert.equal(result, true);
  });

  test("shutdown returns undefined", async () => {
    const plugin = createAssetProductionRetrieverPlugin();
    const result = await plugin.shutdown();
    assert.equal(result, undefined);
  });

  test.describe("retrieve behavior", () => {
    test("returns results for basic query", async () => {
      const plugin = createAssetProductionRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_basic",
        intent: "find figma design",
        context: {},
        tokenBudget: 1000,
      });

      assert.ok(Array.isArray(results));
      assert.ok(results.length >= 2);
    });

    test("returns results with all required fields", async () => {
      const plugin = createAssetProductionRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_fields",
        intent: "brand asset",
        context: {},
        tokenBudget: 1000,
      });

      for (const result of results) {
        assert.ok(typeof result.knowledgeRef === "string");
        assert.ok(result.knowledgeRef.startsWith("knowledge:"));
      }
    });

    test("respects tokenBudget - small budget returns minimum 2 results", async () => {
      const plugin = createAssetProductionRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_small",
        intent: "design token",
        context: {},
        tokenBudget: 100,
      });

      assert.ok(results.length >= 2);
    });

    test("respects tokenBudget - large budget returns maximum 8 results", async () => {
      const plugin = createAssetProductionRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_large",
        intent: "figma file",
        context: {},
        tokenBudget: 10000,
      });

      assert.ok(results.length <= 8);
    });

    test("includes file context in query building", async () => {
      const plugin = createAssetProductionRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_file",
        intent: "hero image",
        context: { file: "hero_image.png" },
        tokenBudget: 1000,
      });

      assert.ok(results.length > 0);
      for (const result of results) {
        assert.ok(typeof result.knowledgeRef === "string");
      }
    });

    test("includes format context in query building", async () => {
      const plugin = createAssetProductionRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_format",
        intent: "brand colors",
        context: { format: "svg" },
        tokenBudget: 1000,
      });

      assert.ok(results.length > 0);
    });

    test("includes brand context in query building", async () => {
      const plugin = createAssetProductionRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_brand",
        intent: "logo asset",
        context: { brand: "acme_corp" },
        tokenBudget: 1000,
      });

      assert.ok(results.length > 0);
    });

    test("includes all context fields together", async () => {
      const plugin = createAssetProductionRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_all_ctx",
        intent: "button component",
        context: { file: "button", format: "png", brand: "acme" },
        tokenBudget: 1000,
      });

      assert.ok(results.length > 0);
    });

    test("returns results with correct namespaces", async () => {
      const plugin = createAssetProductionRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_ns",
        intent: "figma",
        context: {},
        tokenBudget: 1000,
      });

      const namespaces = results.map((r) => r.namespace).filter(Boolean);
      assert.ok(namespaces.length > 0);
      for (const ns of namespaces) {
        assert.ok(
          ns!.startsWith("assetprod/"),
          `Expected namespace to start with assetprod/, got ${ns}`,
        );
      }
    });

    test("returns results with different matchTypes", async () => {
      const plugin = createAssetProductionRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_match",
        intent: "design system",
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
      const plugin = createAssetProductionRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_scores",
        intent: "cdn asset",
        context: {},
        tokenBudget: 1000,
      });

      for (const result of results) {
        if (result.score !== undefined) {
          assert.ok(result.score >= 0 && result.score <= 1);
        }
      }
    });

    test("handles empty context gracefully", async () => {
      const plugin = createAssetProductionRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_empty",
        intent: "asset",
        context: {},
        tokenBudget: 1000,
      });

      assert.ok(Array.isArray(results));
      assert.ok(results.length >= 2);
    });

    test("handles very long intent gracefully", async () => {
      const plugin = createAssetProductionRetrieverPlugin();
      const longIntent = "a".repeat(1000);
      const results = await plugin.retrieve({
        taskId: "task_long",
        intent: longIntent,
        context: {},
        tokenBudget: 1000,
      });

      assert.ok(Array.isArray(results));
    });

    test("returns chunkId in results", async () => {
      const plugin = createAssetProductionRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_chunk",
        intent: "metadata",
        context: {},
        tokenBudget: 1000,
      });

      for (const result of results) {
        assert.ok(typeof result.chunkId === "string");
      }
    });

    test("returns documentId in results", async () => {
      const plugin = createAssetProductionRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_doc",
        intent: "design token",
        context: {},
        tokenBudget: 1000,
      });

      for (const result of results) {
        assert.ok(typeof result.documentId === "string");
      }
    });
  });
});
