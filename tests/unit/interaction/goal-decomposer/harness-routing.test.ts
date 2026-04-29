import assert from "node:assert/strict";
import test from "node:test";

import { GoalDecompositionService, type Goal } from "../../../../src/interaction/goal-decomposer/index.js";

const goal: Goal = {
  goalId: "goal-routing-001",
  description: "发布新版本并跟踪发布后关键指标",
  owner: "release-manager",
  successCriteria: [{ metric: "release", target: "success", evaluationMethod: "automated_test" }],
  constraints: ["预算 100", "需要发布审批"],
  priority: "high",
};

test("GoalDecompositionService routes decomposed task graph into canonical plan graph harness runtime", async () => {
  const service = new GoalDecompositionService();
  const result = await service.decompose(goal);

  assert.equal(result.plannerHandoff.harnessRunId, "goal-routing-001:harness_run");
  assert.equal(result.plannerHandoff.planGraphBundleId, "goal-routing-001:plan_graph_bundle");
  assert.equal(result.harnessRouting.harnessRun.harnessRunId, "goal-routing-001:harness_run");
  assert.equal(result.harnessRouting.planGraphBundle.planGraphBundleId, "goal-routing-001:plan_graph_bundle");
  assert.equal(result.harnessRouting.planGraphBundle.validationReport.valid, true);
  assert.equal(result.harnessRouting.initialStep.nodeRun.harnessRunId, "goal-routing-001:harness_run");
  assert.equal(result.harnessRouting.initialStep.receipt.status, "succeeded");
  assert.ok(result.harnessRouting.planGraphBundle.graph.nodes.length > 0);
});
