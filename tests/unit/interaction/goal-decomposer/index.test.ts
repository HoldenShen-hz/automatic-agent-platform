import assert from "node:assert/strict";
import test from "node:test";

import { GoalDecompositionService, type Goal } from "../../../../src/interaction/goal-decomposer/index.js";

test("GoalDecompositionService uses marketing template and builds dependency graph", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    goalId: "goal_marketing",
    description: "发起春季营销 campaign 并追踪 ROI",
    owner: "marketing_lead",
    successCriteria: [],
    constraints: [],
    priority: "high",
  };

  const result = await service.decompose(goal);

  assert.equal(result.tasks.length, 4);
  assert.equal(result.decompositionStrategy, "template");
  assert.deepEqual(result.parallelTaskGroups?.[0], [result.tasks[0]!.taskId]);
  assert.ok(result.criticalPathTaskIds?.includes(result.tasks[2]!.taskId));
  assert.ok(result.dependencyGraph.some((dependency) => dependency.dataContract === "approved_creatives"));
});

test("GoalDecompositionService falls back to hybrid generic decomposition", async () => {
  const service = new GoalDecompositionService();

  const result = await service.decompose("整理一个跨团队运营改进方案，补齐职责分工、预算边界和交付计划");

  assert.equal(result.tasks.length, 3);
  assert.equal(result.decompositionStrategy, "hybrid");
  assert.equal(result.requiresHumanReview, false);
  assert.deepEqual(result.topologicallySortedTaskIds, result.tasks.map((task) => task.taskId));
});

test("GoalDecompositionService requests human review for unmatched short goal", async () => {
  const service = new GoalDecompositionService();

  const result = await service.decompose("搞定它");

  assert.equal(result.requiresHumanReview, true);
  assert.equal(result.decompositionConfidence < 0.7, true);
});
