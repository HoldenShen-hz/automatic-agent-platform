import assert from "node:assert/strict";
import test from "node:test";

import { GoalDecompositionService, type Goal, type SuccessCriterion } from "../../../../src/interaction/goal-decomposer/index.js";

test("goal-decomposer SuccessCriterion requires operator and threshold fields", () => {
  const criterion: SuccessCriterion = {
    metric: "pass_rate",
    target: "deployment_quality",
    operator: ">=",
    threshold: 0.95,
    evaluationMethod: "automated_test",
  };

  assert.equal(criterion.metric, "pass_rate");
  assert.equal(criterion.operator, ">=");
  assert.equal(criterion.threshold, 0.95);
  assert.equal(criterion.evaluationMethod, "automated_test");
});

test("goal-decomposer exposes canonical planGraphBundle at the top level", async () => {
  const goal: Goal = {
    goalId: "goal-review-graph",
    description: "发布版本并检查发布后指标",
    owner: "release-manager",
    successCriteria: [{
      metric: "deploy_success_rate",
      target: "release_quality",
      operator: ">=",
      threshold: 0.95,
      evaluationMethod: "automated_test",
    }],
    constraints: ["预算 100", "需要审批"],
    priority: "high",
  };
  const service = new GoalDecompositionService();
  const result = await service.decompose(goal);

  assert.equal(result.planGraphBundle.planGraphBundleId, "goal-review-graph:plan_graph_bundle");
  assert.equal(result.planGraphBundle.planGraphBundleId, result.harnessRouting.planGraphBundle.planGraphBundleId);
  assert.ok(result.planGraphBundle.graph.nodes.length > 0);
});
