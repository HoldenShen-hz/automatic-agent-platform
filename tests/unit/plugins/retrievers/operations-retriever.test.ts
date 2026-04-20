import assert from "node:assert/strict";
import test from "node:test";

import { createOperationsRetrieverPlugin } from "../../../../src/plugins/retrievers/operations-retriever.js";

test("OperationsRetriever type exports are correct", () => {
  const plugin = createOperationsRetrieverPlugin();
  assert.ok(plugin !== undefined);
});

test("OperationsRetriever has correct plugin metadata", () => {
  const plugin = createOperationsRetrieverPlugin();

  assert.equal(plugin.pluginId, "plugin.operations.retriever");
  assert.equal(plugin.domainId, "operations");
  assert.equal(plugin.spiType, "retriever");
});

test("OperationsRetriever has correct capabilityIds", () => {
  const plugin = createOperationsRetrieverPlugin();

  assert.deepEqual(plugin.capabilityIds, ["knowledge.retrieve", "domain.observe", "ops.runbook_search"]);
});

test("OperationsRetriever.initialize is no-op", async () => {
  const plugin = createOperationsRetrieverPlugin();
  assert.ok(plugin.initialize !== undefined);
  await plugin.initialize();
});

test("OperationsRetriever.healthCheck returns true", async () => {
  const plugin = createOperationsRetrieverPlugin();
  assert.ok(plugin.healthCheck !== undefined);
  const result = await plugin.healthCheck();
  assert.equal(result, true);
});

test("OperationsRetriever.shutdown returns undefined", async () => {
  const plugin = createOperationsRetrieverPlugin();
  assert.ok(plugin.shutdown !== undefined);
  const result = await plugin.shutdown();
  assert.equal(result, undefined);
});

test("OperationsRetriever.retrieve returns results with default tokenBudget", async () => {
  const plugin = createOperationsRetrieverPlugin();

  const results = await plugin.retrieve({
    taskId: "task_123",
    intent: "find runbook",
    context: {},
    tokenBudget: 1000,
  });

  assert.ok(Array.isArray(results));
  assert.ok(results.length >= 2);
  assert.ok(results.every(r => typeof r.knowledgeRef === "string"));
});

test("OperationsRetriever.retrieve respects tokenBudget", async () => {
  const plugin = createOperationsRetrieverPlugin();

  const smallBudget = await plugin.retrieve({
    taskId: "task_456",
    intent: "incident records",
    context: {},
    tokenBudget: 200,
  });

  const largeBudget = await plugin.retrieve({
    taskId: "task_789",
    intent: "incident records",
    context: {},
    tokenBudget: 2000,
  });

  assert.ok(smallBudget.length >= 2);
  assert.ok(largeBudget.length <= 8);
});

test("OperationsRetriever.retrieve includes context in search", async () => {
  const plugin = createOperationsRetrieverPlugin();

  const results = await plugin.retrieve({
    taskId: "task_ctx",
    intent: "runbook for database",
    context: { system: "postgres-db", component: "replication" },
    tokenBudget: 1000,
  });

  assert.ok(results.length > 0);
  assert.ok(results.every(r => typeof r.knowledgeRef === "string"));
});

test("OperationsRetriever.retrieve returns valid knowledge references", async () => {
  const plugin = createOperationsRetrieverPlugin();

  const results = await plugin.retrieve({
    taskId: "task_struct",
    intent: "incident response",
    context: {},
    tokenBudget: 1000,
  });

  for (const result of results) {
    assert.ok(typeof result.knowledgeRef === "string");
    assert.ok(result.knowledgeRef.startsWith("knowledge:"));
  }
});

test("OperationsRetriever.retrieve returns at least 2 results even with low budget", async () => {
  const plugin = createOperationsRetrieverPlugin();

  const results = await plugin.retrieve({
    taskId: "task_min",
    intent: "runbook",
    context: {},
    tokenBudget: 100,
  });

  assert.ok(results.length >= 2);
});
