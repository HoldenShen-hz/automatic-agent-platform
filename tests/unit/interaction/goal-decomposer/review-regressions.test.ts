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

test("goal-decomposer exposes canonical task graph and planner handoff identifiers", async () => {
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

  assert.equal(result.goalGraphDraft.goalId, "goal-review-graph");
  assert.equal(result.taskGraphDraft.graphId, "goal-review-graph:task_graph_draft");
  assert.equal(result.plannerHandoff.graphId, result.taskGraphDraft.graphId);
  assert.ok(result.taskGraphDraft.tasks.length > 0);
});

test("goal-decomposer rejects LLM plans when dependency graph contains a cycle", async () => {
  const goal: Goal = {
    goalId: "goal-review-cycle",
    description: "这是一个没有模板命中的超长复杂目标描述，用来强制走 llm 规划分支并注入循环依赖图进行回归验证，确保规划移交流程不会继续接收非法 DAG。",
    owner: "release-manager",
    successCriteria: [],
    constraints: [],
    priority: "normal",
  };
  const service = new GoalDecompositionService({
    llmPlanGenerator: {
      async generate(goal) {
        return {
          tasks: [
            {
              taskId: `${goal.goalId}:a`,
              domainId: "general_ops",
              description: "Task A",
              inputs: {},
              expectedOutputs: ["a"],
              delegationMode: "supervised",
              estimatedDuration: "1h",
              estimatedCost: { estimatedCostUsd: 0.1, confidence: "low", sampleCount: 0, divisionId: null, basedOn: "default" },
            },
            {
              taskId: `${goal.goalId}:b`,
              domainId: "general_ops",
              description: "Task B",
              inputs: {},
              expectedOutputs: ["b"],
              delegationMode: "supervised",
              estimatedDuration: "1h",
              estimatedCost: { estimatedCostUsd: 0.1, confidence: "low", sampleCount: 0, divisionId: null, basedOn: "default" },
            },
          ],
          dependencyGraph: [
            { fromTask: `${goal.goalId}:a`, toTask: `${goal.goalId}:b`, type: "blocks" as const },
            { fromTask: `${goal.goalId}:b`, toTask: `${goal.goalId}:a`, type: "blocks" as const },
          ],
        };
      },
    },
  });

  await assert.rejects(
    async () => service.decompose(goal),
    /goal_decomposer\.cycle_detected:goal-review-cycle/,
  );
});
