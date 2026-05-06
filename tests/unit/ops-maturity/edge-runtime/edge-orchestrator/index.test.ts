import assert from "node:assert/strict";
import test from "node:test";

import { buildEdgeExecutionPlan } from "../../../../../src/ops-maturity/edge-runtime/edge-orchestrator/index.js";

test("buildEdgeExecutionPlan creates graph bundle with given task ids", () => {
  const result = buildEdgeExecutionPlan(["task-1", "task-2"]);

  assert.deepStrictEqual(
    result.planGraphBundle.graph.nodes.map((node) => node.nodeId),
    ["edge_node_task-1", "edge_node_task-2"],
  );
  assert.deepStrictEqual(
    result.planGraphBundle.graph.edges.map((edge) => [edge.fromNodeId, edge.toNodeId]),
    [["edge_node_task-1", "edge_node_task-2"]],
  );
  assert.deepStrictEqual(result.planGraphBundle.graph.entryNodeIds, ["edge_node_task-1"]);
  assert.deepStrictEqual(result.planGraphBundle.graph.terminalNodeIds, ["edge_node_task-2"]);
  assert.equal(result.syncRequired, true);
  assert.equal(result.priority, "normal");
});

test("buildEdgeExecutionPlan accepts custom priority", () => {
  const result = buildEdgeExecutionPlan(["task-1"], "high");

  assert.equal(result.priority, "high");
  assert.equal(result.planGraphBundle.schedulerPolicy.strategy, "priority_then_fifo");
});

test("buildEdgeExecutionPlan accepts low priority", () => {
  const result = buildEdgeExecutionPlan(["task-1"], "low");

  assert.equal(result.priority, "low");
  assert.equal(result.planGraphBundle.schedulerPolicy.strategy, "deterministic_fifo");
});

test("buildEdgeExecutionPlan handles empty task list", () => {
  const result = buildEdgeExecutionPlan([]);

  assert.deepStrictEqual(result.planGraphBundle.graph.nodes, []);
  assert.deepStrictEqual(result.planGraphBundle.graph.edges, []);
  assert.deepStrictEqual(result.planGraphBundle.graph.entryNodeIds, []);
  assert.deepStrictEqual(result.planGraphBundle.graph.terminalNodeIds, []);
});
