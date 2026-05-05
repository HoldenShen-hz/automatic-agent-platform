import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEdgeExecutionPlan,
  type EdgeExecutionPlan,
} from "../../../../src/ops-maturity/edge-runtime/edge-orchestrator/index.js";

test("buildEdgeExecutionPlan creates plan with correct taskIds", () => {
  const plan = buildEdgeExecutionPlan(["task_1", "task_2", "task_3"]);

  // R6-22 FIX: Edge execution plan now uses planGraphBundle.graph.nodes with edge_node_ prefix
  assert.deepEqual(
    plan.planGraphBundle.graph.nodes.map((n) => n.nodeId),
    ["edge_node_task_1", "edge_node_task_2", "edge_node_task_3"],
  );
  assert.equal(plan.syncRequired, true);
  assert.equal(plan.priority, "normal");
});

test("buildEdgeExecutionPlan preserves task order", () => {
  const plan = buildEdgeExecutionPlan(["task_c", "task_a", "task_b"]);
  assert.deepEqual(
    plan.planGraphBundle.graph.nodes.map((n) => n.nodeId),
    ["edge_node_task_c", "edge_node_task_a", "edge_node_task_b"],
  );
});

test("buildEdgeExecutionPlan defaults priority to normal", () => {
  const plan = buildEdgeExecutionPlan(["task_1"]);
  assert.equal(plan.priority, "normal");
});

test("buildEdgeExecutionPlan accepts explicit priority", () => {
  const lowPlan = buildEdgeExecutionPlan(["task_1"], "low");
  assert.equal(lowPlan.priority, "low");

  const highPlan = buildEdgeExecutionPlan(["task_1"], "high");
  assert.equal(highPlan.priority, "high");
});

test("buildEdgeExecutionPlan always requires sync", () => {
  const plan = buildEdgeExecutionPlan(["task_1"]);
  assert.equal(plan.syncRequired, true);
});

test("buildEdgeExecutionPlan returns empty array for empty input", () => {
  const plan = buildEdgeExecutionPlan([]);
  // R6-22 FIX: Empty input produces graph with no nodes
  assert.deepEqual(plan.planGraphBundle.graph.nodes, []);
});

test("EdgeExecutionPlan type shape is correct", () => {
  // R6-22 FIX: EdgeExecutionPlan now uses planGraphBundle structure
  const plan = buildEdgeExecutionPlan(["task_1"], "high");
  assert.equal(plan.planGraphBundle.graph.nodes.length, 1);
  assert.equal(plan.priority, "high");
});
