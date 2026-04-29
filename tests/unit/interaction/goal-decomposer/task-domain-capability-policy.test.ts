import assert from "node:assert/strict";
import test from "node:test";

import { GoalDecompositionService, type Goal } from "../../../../src/interaction/goal-decomposer/index.js";

function createService(): GoalDecompositionService {
  return new GoalDecompositionService({
    planGraphHarnessRuntime: {
      executeNext: ({ harnessRun }: { harnessRun: { harnessRunId: string } }) => ({
        nodeRun: {
          nodeRunId: `${harnessRun.harnessRunId}:node_run`,
          harnessRunId: harnessRun.harnessRunId,
        },
        nodeAttempt: {
          nodeAttemptId: `${harnessRun.harnessRunId}:node_attempt`,
        },
        receipt: {
          status: "succeeded",
        },
        events: [],
      }),
    } as never,
  });
}

test("GoalDecompositionService preserves requested capabilities and surfaces domain mismatches", async () => {
  const service = createService();
  const goal: Goal = {
    goalId: "goal-task-domain-capability",
    description: "发起营销 campaign 并追踪 ROI",
    owner: "marketing",
    successCriteria: [],
    constraints: ["需要 dashboard 分析", "需要 approval 审批"],
    priority: "high",
  };

  const result = await service.decompose(goal);
  const legalTask = result.tasks.find((task) => task.domainId === "legal");
  const analyticsTask = result.tasks.find((task) => task.domainId === "data_analysis");

  assert.ok(legalTask);
  assert.deepEqual(legalTask?.constraintEnvelope?.requiredCapabilities ?? [], ["analytics", "approval_workflow"]);
  assert.ok(analyticsTask);
  assert.deepEqual(analyticsTask?.constraintEnvelope?.requiredCapabilities ?? [], ["analytics", "approval_workflow"]);
  assert.equal(result.requiresHumanReview, true);
  assert.ok(result.taskGraphDraft.validationMessages.some((message) => message.includes("missing_capability")));
});

test("GoalDecompositionService preserves requested permissions and reports unauthorized task domains", async () => {
  const service = createService();
  const goal: Goal = {
    goalId: "goal-task-domain-permission",
    description: "发布新版本到生产环境",
    owner: "engineering",
    successCriteria: [],
    constraints: ["需要 deploy 到生产环境"],
    priority: "critical",
  };

  const result = await service.decompose(goal);
  const engineeringTask = result.tasks.find((task) => task.domainId === "engineering_ops");
  const operationsTask = result.tasks.find((task) => task.domainId === "operations");
  const analyticsTask = result.tasks.find((task) => task.domainId === "data_analysis");
  const qaTask = result.tasks.find((task) => task.domainId === "quality_assurance");

  assert.deepEqual(engineeringTask?.constraintEnvelope?.requiredPermissions ?? [], ["deployment:write"]);
  assert.deepEqual(operationsTask?.constraintEnvelope?.requiredPermissions ?? [], ["deployment:write"]);
  assert.deepEqual(analyticsTask?.constraintEnvelope?.requiredPermissions ?? [], ["deployment:write"]);
  assert.deepEqual(qaTask?.constraintEnvelope?.requiredPermissions ?? [], ["deployment:write"]);
  assert.equal(result.requiresHumanReview, true);
  assert.ok(result.taskGraphDraft.validationMessages.some((message) => message.includes("unauthorized_permission")));
});
