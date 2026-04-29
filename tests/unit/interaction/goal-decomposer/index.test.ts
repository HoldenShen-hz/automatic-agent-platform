import assert from "node:assert/strict";
import test from "node:test";

import {
  GoalDecompositionService,
  type Goal,
  type LlmPlanGenerator,
} from "../../../../src/interaction/goal-decomposer/index.js";

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

test("GoalDecompositionService uses llm_plan strategy when injected generator succeeds", async () => {
  const llmPlanGenerator: LlmPlanGenerator = {
    async generate(goal) {
      return {
        tasks: [
          {
            taskId: `${goal.goalId}:llm:1`,
            domainId: "general_ops",
            description: "分析复杂目标并拆出执行步骤",
            inputs: {},
            expectedOutputs: ["analysis"],
            delegationMode: "supervised",
            estimatedDuration: "2h",
            estimatedCost: {
              estimatedCostUsd: 0.2,
              confidence: "low",
              sampleCount: 0,
              divisionId: null,
              basedOn: "default",
            },
          },
          {
            taskId: `${goal.goalId}:llm:2`,
            domainId: "operations",
            description: "组织跨域执行和交付",
            inputs: {},
            expectedOutputs: ["delivery"],
            delegationMode: "supervised",
            estimatedDuration: "4h",
            estimatedCost: {
              estimatedCostUsd: 0.4,
              confidence: "low",
              sampleCount: 0,
              divisionId: null,
              basedOn: "default",
            },
          },
        ],
        dependencyGraph: [
          {
            fromTask: `${goal.goalId}:llm:1`,
            toTask: `${goal.goalId}:llm:2`,
            type: "blocks",
          },
        ],
      };
    },
  };

  const service = new GoalDecompositionService({ llmPlanGenerator });
  const result = await service.decompose("请为这个跨多个事业部、跨预算池、跨交付节奏的复杂组织转型项目生成详细计划和依赖图，并补齐审批约束、执行顺序、预算边界和风险缓解方案，以便直接进入执行编排。");

  assert.equal(result.decompositionStrategy, "llm_plan");
  assert.equal(result.tasks.length, 2);
  assert.equal(result.dependencyGraph.length, 1);
  assert.deepEqual(result.topologicallySortedTaskIds, result.tasks.map((task) => task.taskId));
});

test("GoalDecompositionService falls back to hybrid when llm_plan generator fails", async () => {
  const llmPlanGenerator: LlmPlanGenerator = {
    async generate() {
      throw new Error("llm unavailable");
    },
  };

  const service = new GoalDecompositionService({ llmPlanGenerator });
  const result = await service.decompose("请为这个跨多个事业部、跨预算池、跨交付节奏的复杂组织转型项目生成详细计划和依赖图，并补齐审批约束、执行顺序、预算边界和风险缓解方案，以便直接进入执行编排。");

  assert.equal(result.decompositionStrategy, "hybrid");
  assert.equal(result.tasks.length, 3);
});

test("GoalDecompositionService only gates budget and still delegates zero-cost reservation handling to generator", async () => {
  let generateCalls = 0;
  const llmPlanGenerator: LlmPlanGenerator = {
    managesBudgetReservations: true,
    async generate(goal) {
      generateCalls += 1;
      return {
        tasks: [
          {
            taskId: `${goal.goalId}:llm:1`,
            domainId: "operations",
            description: "生成零成本计划",
            inputs: {},
            expectedOutputs: ["plan"],
            delegationMode: "supervised",
            estimatedDuration: "1h",
            estimatedCost: {
              estimatedCostUsd: 0,
              confidence: "low",
              sampleCount: 0,
              divisionId: null,
              basedOn: "default",
            },
          },
        ],
        dependencyGraph: [],
      };
    },
  };

  const service = new GoalDecompositionService({
    llmPlanGenerator,
    budgetControl: {
      policy: {
        maxTaskCostUsd: 10,
        maxPackCostUsd: 20,
        maxPlatformCostUsd: 30,
        maxDailyCostUsd: 20,
        maxMonthlyCostUsd: 30,
        warnAtRatio: 0.8,
        mode: "supervised",
      },
      currentTaskCostUsd: 0,
      currentDailyCostUsd: 0,
      currentMonthlyCostUsd: 0,
      tenantId: "tenant:test",
      harnessRunId: "harness:test",
      traceId: "trace:test",
      emittedBy: "goal-decomposer-test",
      estimatedLlmPlanCostUsd: 0,
    },
  });

  const result = await service.decompose(
    "请为这个跨多个事业部、跨预算池、跨交付节奏的复杂组织转型项目生成详细计划和依赖图，并补齐审批约束、执行顺序、预算边界和风险缓解方案，以便直接进入执行编排。",
  );

  assert.equal(generateCalls, 1);
  assert.equal(result.decompositionStrategy, "llm_plan");
  assert.equal(result.tasks.length, 1);
});
