import assert from "node:assert/strict";
import test from "node:test";

import { buildEdgeExecutionPlan } from "../../../../../src/ops-maturity/edge-runtime/edge-orchestrator/index.js";

test("buildEdgeExecutionPlan creates plan with given task ids", () => {
  const result = buildEdgeExecutionPlan(["task-1", "task-2"]);

  assert.deepStrictEqual(result.orderedTaskIds, ["task-1", "task-2"]);
  assert.equal(result.syncRequired, true);
  assert.equal(result.priority, "normal");
});

test("buildEdgeExecutionPlan accepts custom priority", () => {
  const result = buildEdgeExecutionPlan(["task-1"], "high");

  assert.equal(result.priority, "high");
});

test("buildEdgeExecutionPlan accepts low priority", () => {
  const result = buildEdgeExecutionPlan(["task-1"], "low");

  assert.equal(result.priority, "low");
});

test("buildEdgeExecutionPlan handles empty task list", () => {
  const result = buildEdgeExecutionPlan([]);

  assert.deepStrictEqual(result.orderedTaskIds, []);
});
