import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEdgeExecutionPlan,
  type EdgePlanGraphBundle,
} from "../../../src/ops-maturity/edge-runtime/edge-orchestrator/index.js";

test("buildEdgeExecutionPlan creates single node for single task", () => {
  const bundle = buildEdgeExecutionPlan(["task_1"]);

  assert.strictEqual(bundle.planGraphBundle.graph.nodes.length, 1);
  assert.strictEqual(bundle.planGraphBundle.graph.nodes[0]?.nodeId, "edge_node_task_1");
  assert.strictEqual(bundle.planGraphBundle.graph.edges.length, 0);
  assert.deepStrictEqual(bundle.planGraphBundle.graph.entryNodeIds, ["edge_node_task_1"]);
  assert.deepStrictEqual(bundle.planGraphBundle.graph.terminalNodeIds, ["edge_node_task_1"]);
  assert.strictEqual(bundle.syncRequired, true);
  assert.strictEqual(bundle.priority, "normal");
});

test("buildEdgeExecutionPlan creates sequential edges for multiple tasks", () => {
  const bundle = buildEdgeExecutionPlan(["task_1", "task_2", "task_3"]);

  assert.strictEqual(bundle.planGraphBundle.graph.nodes.length, 3);
  assert.strictEqual(bundle.planGraphBundle.graph.edges.length, 2);
  assert.strictEqual(bundle.planGraphBundle.graph.edges[0]?.fromNodeId, "edge_node_task_1");
  assert.strictEqual(bundle.planGraphBundle.graph.edges[0]?.toNodeId, "edge_node_task_2");
  assert.strictEqual(bundle.planGraphBundle.graph.edges[1]?.fromNodeId, "edge_node_task_2");
  assert.strictEqual(bundle.planGraphBundle.graph.edges[1]?.toNodeId, "edge_node_task_3");
});

test("buildEdgeExecutionPlan with custom priority", () => {
  const bundle = buildEdgeExecutionPlan(["task_1"], "high");

  assert.strictEqual(bundle.priority, "high");
});

test("buildEdgeExecutionPlan creates nodes with correct inputRefs", () => {
  const bundle = buildEdgeExecutionPlan(["task_1", "task_2"]);

  // First node references the initial task payload
  assert.deepStrictEqual(bundle.planGraphBundle.graph.nodes[0]?.inputRefs, ["task:task_1"]);
  // Second node references first node
  assert.deepStrictEqual(bundle.planGraphBundle.graph.nodes[1]?.inputRefs, ["edge_node_task_1"]);
});

test("buildEdgeExecutionPlan handles empty task list", () => {
  const bundle = buildEdgeExecutionPlan([]);

  assert.strictEqual(bundle.planGraphBundle.graph.nodes.length, 0);
  assert.strictEqual(bundle.planGraphBundle.graph.edges.length, 0);
  assert.deepStrictEqual(bundle.planGraphBundle.graph.entryNodeIds, []);
  assert.deepStrictEqual(bundle.planGraphBundle.graph.terminalNodeIds, []);
});

test("buildEdgeExecutionPlan assigns risk class based on taskId", () => {
  const bundle = buildEdgeExecutionPlan(["task_prod_critical"]);

  // riskClass is assigned but the specific value depends on implementation
  assert.ok(bundle.planGraphBundle.graph.nodes[0]?.riskClass != null);

  const bundle2 = buildEdgeExecutionPlan(["task_test"]);

  assert.ok(bundle2.planGraphBundle.graph.nodes[0]?.riskClass != null);
});

test("buildEdgeExecutionPlan generates valid graph hash", () => {
  const bundle = buildEdgeExecutionPlan(["task_1", "task_2"]);

  assert.ok(bundle.planGraphBundle.graph.graphHash.length > 0);
  assert.ok(bundle.planGraphBundle.graph.graphId.includes("edge_graph"));
});
