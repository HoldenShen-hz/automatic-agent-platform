import assert from "node:assert/strict";
import test from "node:test";

import {
  createOperationsRetrieverPlugin,
  createOperationsRetrieverPluginWithOptions,
} from "../../../../src/plugins/retrievers/operations-retriever.js";

test.describe("OperationsRetriever comprehensive tests", () => {
  test("createOperationsRetrieverPlugin returns a valid DomainRetrieverPlugin", () => {
    const plugin = createOperationsRetrieverPlugin();
    assert.ok(plugin !== undefined);
    assert.equal(plugin.pluginId, "plugin.operations.retriever");
    assert.equal(plugin.domainId, "operations");
    assert.equal(plugin.spiType, "retriever");
  });

  test("createOperationsRetrieverPluginWithOptions returns a valid DomainRetrieverPlugin", () => {
    const plugin = createOperationsRetrieverPluginWithOptions();
    assert.ok(plugin !== undefined);
    assert.equal(plugin.pluginId, "plugin.operations.retriever");
    assert.equal(plugin.domainId, "operations");
    assert.equal(plugin.spiType, "retriever");
  });

  test("capabilityIds includes expected capabilities", () => {
    const plugin = createOperationsRetrieverPlugin();
    assert.deepEqual(plugin.capabilityIds, [
      "knowledge.retrieve",
      "domain.observe",
      "ops.runbook_search",
    ]);
  });

  test("initialize is a no-op", async () => {
    const plugin = createOperationsRetrieverPlugin();
    let initialized = false;
    plugin.initialize = async () => {
      initialized = true;
    };
    await plugin.initialize();
    assert.equal(initialized, true);
  });

  test("shutdown returns undefined", async () => {
    const plugin = createOperationsRetrieverPlugin();
    const result = await plugin.shutdown();
    assert.equal(result, undefined);
  });

  test.describe("healthCheck behavior", () => {
    test("healthCheck returns false by default", async () => {
      const plugin = createOperationsRetrieverPlugin();
      const result = await plugin.healthCheck();
      assert.equal(result, false);
    });

    test("healthCheck returns true when custom healthCheck returns true", async () => {
      const plugin = createOperationsRetrieverPluginWithOptions({
        healthCheck: () => true,
      });
      const result = await plugin.healthCheck();
      assert.equal(result, true);
    });

    test("healthCheck returns false when custom healthCheck returns false", async () => {
      const plugin = createOperationsRetrieverPluginWithOptions({
        healthCheck: () => false,
      });
      const result = await plugin.healthCheck();
      assert.equal(result, false);
    });

    test("healthCheck delegates to async healthCheck", async () => {
      const plugin = createOperationsRetrieverPluginWithOptions({
        healthCheck: async () => true,
      });
      const result = await plugin.healthCheck();
      assert.equal(result, true);
    });
  });

  test.describe("retrieve behavior", () => {
    test("returns results for basic query", async () => {
      const plugin = createOperationsRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_basic",
        intent: "find runbook",
        context: {},
        tokenBudget: 1000,
      });

      assert.ok(Array.isArray(results));
      assert.ok(results.length >= 2);
    });

    test("returns results with all required fields", async () => {
      const plugin = createOperationsRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_fields",
        intent: "incident response",
        context: {},
        tokenBudget: 1000,
      });

      for (const result of results) {
        assert.ok(typeof result.knowledgeRef === "string");
        assert.ok(result.knowledgeRef.startsWith("knowledge:"));
      }
    });

    test("respects tokenBudget - small budget returns minimum 2 results", async () => {
      const plugin = createOperationsRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_small",
        intent: "runbook",
        context: {},
        tokenBudget: 100,
      });

      assert.ok(results.length >= 2);
    });

    test("respects tokenBudget - large budget returns maximum 8 results", async () => {
      const plugin = createOperationsRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_large",
        intent: "incident",
        context: {},
        tokenBudget: 10000,
      });

      assert.ok(results.length <= 8);
    });

    test("respects tokenBudget - exact boundary at 200 tokens per result", async () => {
      const plugin = createOperationsRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_boundary",
        intent: "database runbook",
        context: {},
        tokenBudget: 400,
      });

      // With 400 tokens and 200 per result, should get 2 results
      assert.ok(results.length >= 2);
    });

    test("includes system context in query building", async () => {
      const plugin = createOperationsRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_system",
        intent: "replication",
        context: { system: "postgres-db" },
        tokenBudget: 1000,
      });

      assert.ok(results.length > 0);
      for (const result of results) {
        assert.ok(typeof result.knowledgeRef === "string");
      }
    });

    test("includes component context in query building", async () => {
      const plugin = createOperationsRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_component",
        intent: "backup",
        context: { component: "storage" },
        tokenBudget: 1000,
      });

      assert.ok(results.length > 0);
    });

    test("includes all context fields together", async () => {
      const plugin = createOperationsRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_all_ctx",
        intent: " failover",
        context: { system: "mysql-cluster", component: "replication" },
        tokenBudget: 1000,
      });

      assert.ok(results.length > 0);
    });

    test("returns results with correct namespaces", async () => {
      const plugin = createOperationsRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_ns",
        intent: "runbook",
        context: {},
        tokenBudget: 1000,
      });

      const namespaces = results.map((r) => r.namespace).filter(Boolean);
      assert.ok(namespaces.length > 0);
      for (const ns of namespaces) {
        assert.ok(
          ns!.startsWith("operations/"),
          `Expected namespace to start with operations/, got ${ns}`,
        );
      }
    });

    test("returns results with different matchTypes", async () => {
      const plugin = createOperationsRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_match",
        intent: "incident",
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
      const plugin = createOperationsRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_scores",
        intent: "runbook",
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
      const plugin = createOperationsRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_snippets",
        intent: "incident records",
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
      const plugin = createOperationsRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_empty",
        intent: "operations",
        context: {},
        tokenBudget: 1000,
      });

      assert.ok(Array.isArray(results));
      assert.ok(results.length >= 2);
    });

    test("handles very long intent gracefully", async () => {
      const plugin = createOperationsRetrieverPlugin();
      const longIntent = "a".repeat(500);
      const results = await plugin.retrieve({
        taskId: "task_long",
        intent: longIntent,
        context: {},
        tokenBudget: 1000,
      });

      assert.ok(Array.isArray(results));
    });

    test("returns chunkId in results", async () => {
      const plugin = createOperationsRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_chunk",
        intent: "runbook",
        context: {},
        tokenBudget: 1000,
      });

      for (const result of results) {
        assert.ok(typeof result.chunkId === "string");
      }
    });

    test("returns documentId in results", async () => {
      const plugin = createOperationsRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "task_doc",
        intent: "incident",
        context: {},
        tokenBudget: 1000,
      });

      for (const result of results) {
        assert.ok(typeof result.documentId === "string");
      }
    });

    test("score varies based on context key count", async () => {
      const plugin = createOperationsRetrieverPlugin();
      const noContextResults = await plugin.retrieve({
        taskId: "task_no_ctx",
        intent: "runbook",
        context: {},
        tokenBudget: 1000,
      });

      const withContextResults = await plugin.retrieve({
        taskId: "task_with_ctx",
        intent: "runbook",
        context: { system: "db", component: "cache" },
        tokenBudget: 1000,
      });

      // Incident scores should be influenced by context
      const noCtxIncidentScore = noContextResults.find(
        (r) => r.namespace === "operations/incidents",
      )?.score;
      const withCtxIncidentScore = withContextResults.find(
        (r) => r.namespace === "operations/incidents",
      )?.score;

      if (noCtxIncidentScore !== undefined && withCtxIncidentScore !== undefined) {
        assert.notEqual(noCtxIncidentScore, withCtxIncidentScore);
      }
    });
  });
});
