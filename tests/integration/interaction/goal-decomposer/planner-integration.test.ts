import assert from "node:assert/strict";
import test from "node:test";

import { buildExecutionBatches } from "../../../../src/interaction/goal-decomposer/planner/index.js";
import { validateGoalDecomposition } from "../../../../src/interaction/goal-decomposer/validator/index.js";
import { GoalDecompositionService } from "../../../../src/interaction/goal-decomposer/index.js";

test("integration: planner and validator work together", async () => {
  const service = new GoalDecompositionService();
  const result = await service.decompose("创建一个营销活动并追踪效果");

  // Build execution batches from decomposition
  const taskIds = result.tasks.map((t) => t.taskId);
  const edges = result.dependencyGraph.map((d) => ({ fromTask: d.fromTask, toTask: d.toTask }));
  const batches = buildExecutionBatches(taskIds, edges);

  // Validate the decomposition
  const findings = validateGoalDecomposition(result);

  assert.ok(batches.length > 0);
  assert.deepEqual(findings, []);
});

test("integration: dependency graph analysis with complex DAG", async () => {
  const service = new GoalDecompositionService();
  const result = await service.decompose("发起春季营销 campaign 并追踪 ROI");

  const taskIds = result.tasks.map((t) => t.taskId);
  const edges = result.dependencyGraph.map((d) => ({ fromTask: d.fromTask, toTask: d.toTask }));
  const batches = buildExecutionBatches(taskIds, edges);

  // Batches should maintain topological order
  for (let i = 1; i < batches.length; i++) {
    for (const currentTask of batches[i]!) {
      for (const prevBatch of batches.slice(0, i)) {
        for (const prevTask of prevBatch) {
          // Verify no edge from prevTask to currentTask exists going backward
          const backwardEdge = edges.find((e) => e.fromTask === currentTask && e.toTask === prevTask);
          assert.equal(backwardEdge, undefined);
        }
      }
    }
  }
});

test("integration: GoalDecompositionService with template and validator", async () => {
  const service = new GoalDecompositionService();
  const goal = {
    goalId: "goal_validate_test",
    description: "在周五发布新版本到生产环境",
    owner: "engineering",
    successCriteria: [],
    constraints: [],
    priority: "critical",
  };

  const result = await service.decompose(goal);
  const findings = validateGoalDecomposition(result);

  // Critical priority should require human review but not generate validation errors
  assert.ok(result.requiresHumanReview === true);
  assert.deepEqual(findings, []);
});

test("integration: batch execution planning for release launch", async () => {
  const service = new GoalDecompositionService();
  const result = await service.decompose("发布新版本到生产环境包括验证和回滚准备");

  const taskIds = result.tasks.map((t) => t.taskId);
  const edges = result.dependencyGraph.map((d) => ({ fromTask: d.fromTask, toTask: d.toTask }));
  const batches = buildExecutionBatches(taskIds, edges);

  // At least 2 batches for sequential release steps
  assert.ok(batches.length >= 2);

  // Validate no cycles
  const findings = validateGoalDecomposition(result);
  assert.ok(!findings.includes("goal_decomposition.cycle_detected"));
});
