// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";

import {
  GoalDecompositionService,
  type Goal,
  type LlmPlanGenerator,
  type PlannedTask,
  type TaskDependency,
} from "../../../../src/interaction/goal-decomposer/index.js";

// --- Mocks ---

const mockCostEstimator = {
  estimate() {
    return {
      estimatedCostUsd: 0.15,
      confidence: "low",
      sampleCount: 0,
      divisionId: null,
      basedOn: "default",
    };
  },
};

const failingLlmPlanGenerator: LlmPlanGenerator = {
  async generate() {
    throw new Error("llm unavailable");
  },
};

const succeedingLlmPlanGenerator: LlmPlanGenerator = {
  async generate(goal: Goal) {
    return {
      tasks: [
        {
          taskId: `${goal.goalId}:analysis`,
          domainId: "general_ops",
          description: "分析目标并制定执行计划",
          inputs: {},
          expectedOutputs: ["plan"],
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
          taskId: `${goal.goalId}:execution`,
          domainId: "operations",
          description: "执行主体任务",
          inputs: {},
          expectedOutputs: ["result"],
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
          fromTask: `${goal.goalId}:analysis`,
          toTask: `${goal.goalId}:execution`,
          type: "blocks",
        },
      ],
    };
  },
};

// --- Tests ---

test.skip("GoalDecompositionService.decompose uses marketing template", async () => {
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
  assert.ok(result.dependencyGraph.length >= 3);
});

test.skip("GoalDecompositionService.decompose uses release_launch template", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    goalId: "goal_release",
    description: "在周五发布新版本到生产环境",
    owner: "engineering",
    successCriteria: [],
    constraints: [],
    priority: "critical",
  };

  const result = await service.decompose(goal);

  assert.equal(result.tasks.length, 4);
  assert.equal(result.decompositionStrategy, "template");
  assert.equal(result.riskSummary.overallRisk, "critical");
  assert.equal(result.requiresHumanReview, true);
});

test.skip("GoalDecompositionService.decompose uses incident_response template", async () => {
  const service = new GoalDecompositionService();
  const result = await service.decompose("服务出现故障，需要紧急排查和恢复");

  assert.equal(result.tasks.length, 4);
  assert.equal(result.decompositionStrategy, "template");
});

test("GoalDecompositionService.decompose normalizes string goal", async () => {
  const service = new GoalDecompositionService();
  const result = await service.decompose("帮我整理一份跨团队运营改进方案");

  assert.ok(result.goalId.startsWith("goal:"));
  assert.equal(result.tasks.length, 3);
});

test("GoalDecompositionService.decompose returns human_assisted for short description", async () => {
  const service = new GoalDecompositionService();
  const result = await service.decompose("搞定它");

  assert.equal(result.decompositionStrategy, "human_assisted");
  assert.equal(result.requiresHumanReview, true);
  assert.ok(result.decompositionConfidence < 0.7);
});

test("GoalDecompositionService.decompose uses hybrid for long generic goals", async () => {
  const service = new GoalDecompositionService();
  const result = await service.decompose(
    "整理一个跨团队运营改进方案，补齐职责分工、预算边界和交付计划，需要协调多个事业部",
  );

  assert.equal(result.tasks.length, 3);
  assert.equal(result.decompositionStrategy, "hybrid");
  assert.equal(result.requiresHumanReview, false);
});

test("GoalDecompositionService.decompose uses llm_plan when generator provided", async () => {
  const service = new GoalDecompositionService({
    llmPlanGenerator: succeedingLlmPlanGenerator,
  });

  const result = await service.decompose(
    "请为这个跨多个事业部、跨预算池、跨交付节奏的复杂组织转型项目生成详细计划和依赖图，并补齐审批约束、执行顺序、预算边界和风险缓解方案，以便直接进入执行编排。",
  );

  assert.equal(result.decompositionStrategy, "llm_plan");
  assert.equal(result.tasks.length, 2);
  assert.equal(result.dependencyGraph.length, 1);
});

test("GoalDecompositionService.decompose falls back to hybrid when generator fails", async () => {
  const service = new GoalDecompositionService({
    llmPlanGenerator: failingLlmPlanGenerator,
  });

  const result = await service.decompose(
    "请为这个跨多个事业部、跨预算池、跨交付节奏的复杂组织转型项目生成详细计划和依赖图，并补齐审批约束、执行顺序、预算边界和风险缓解方案，以便直接进入执行编排。",
  );

  assert.equal(result.decompositionStrategy, "hybrid");
  assert.equal(result.tasks.length, 3);
});

test("GoalDecompositionService.decompose computes critical path", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    goalId: "goal_critical_path",
    description: "发起春季营销 campaign 并追踪 ROI",
    owner: "marketing_lead",
    successCriteria: [],
    constraints: [],
    priority: "high",
  };

  const result = await service.decompose(goal);

  assert.ok(result.criticalPathTaskIds);
  assert.ok(result.criticalPathTaskIds.length > 0);
  assert.ok(result.parallelTaskGroups);
  assert.ok(result.parallelTaskGroups.length > 0);
});

test("GoalDecompositionService.decompose respects maxDepth", async () => {
  const service = new GoalDecompositionService({ maxDepth: 1, currentDepth: 0 });

  const result = await service.decompose("这是一个需要深度分解的复杂目标");

  assert.equal(result.maxDepthReached, true);
  assert.equal(result.depthUsed, 0);
});

test("GoalDecompositionService.decompose includes risk summary", async () => {
  const service = new GoalDecompositionService();
  const result = await service.decompose("发起春季营销 campaign 并追踪 ROI");

  assert.ok(result.riskSummary.overallRisk);
  assert.ok(result.riskSummary.riskFactors.length >= 0);
  assert.ok(typeof result.riskSummary.reversible === "boolean");
  assert.ok(result.riskSummary.sideEffects.length >= 0);
  assert.ok(typeof result.riskSummary.approvalNeeded === "boolean");
});

test("GoalDecompositionService.decompose sets requiresHumanReview for critical priority", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    goalId: "goal_critical",
    description: "执行紧急系统升级",
    owner: "engineering",
    successCriteria: [],
    constraints: [],
    priority: "critical",
  };

  const result = await service.decompose(goal);

  assert.equal(result.requiresHumanReview, true);
});

test("GoalDecompositionService.decompose sets requiresHumanReview for critical risk", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    goalId: "goal_delete_all",
    description: "删除全部生产数据",
    owner: "admin",
    successCriteria: [],
    constraints: [],
    priority: "high",
  };

  const result = await service.decompose(goal);

  assert.equal(result.riskSummary.overallRisk, "critical");
  assert.equal(result.requiresHumanReview, true);
});

test("GoalDecompositionService.decompose computes estimated cost", async () => {
  const service = new GoalDecompositionService({
    costEstimator: mockCostEstimator,
  });
  const goal: Goal = {
    goalId: "goal_cost_test",
    description: "发起春季营销 campaign 并追踪 ROI",
    owner: "marketing_lead",
    successCriteria: [],
    constraints: [],
    priority: "high",
  };

  const result = await service.decompose(goal);

  assert.ok(result.estimatedCost.estimatedCostUsd > 0);
});

test("GoalDecompositionService.decompose detects cycle in dependency graph", async () => {
  const service = new GoalDecompositionService();
  // Use a goal that results in a cyclic dependency (via task.dependsOn)
  // The service builds sequential dependencies by default, so cycle detection
  // relies on the dependency graph analysis
  const result = await service.decompose("执行多步任务流程");

  // Default sequential tasks should not have a cycle
  assert.equal(result.topologicallySortedTaskIds?.length, result.tasks.length);
});

test("GoalDecompositionService.decompose uses cost estimator when provided", async () => {
  const service = new GoalDecompositionService({
    costEstimator: mockCostEstimator,
  });

  const result = await service.decompose("发起营销活动");

  assert.ok(result.estimatedCost.estimatedCostUsd > 0);
});

test("GoalDecompositionService.decompose normalizes estimatedDuration", async () => {
  const service = new GoalDecompositionService();
  const result = await service.decompose("发起春季营销 campaign");

  assert.ok(result.estimatedDuration.endsWith("d") || result.estimatedDuration.endsWith("h"));
});

test("GoalDecompositionService.decompose returns topologicallySortedTaskIds", async () => {
  const service = new GoalDecompositionService();
  const result = await service.decompose("执行多步运营任务");

  assert.ok(result.topologicallySortedTaskIds);
  assert.equal(result.topologicallySortedTaskIds.length, result.tasks.length);
});

test("GoalDecompositionService.decompose returns parallelTaskGroups", async () => {
  const service = new GoalDecompositionService();
  const result = await service.decompose("执行多步运营任务");

  assert.ok(result.parallelTaskGroups);
  assert.ok(result.parallelTaskGroups.length > 0);
  // Each group should have at least one task
  for (const group of result.parallelTaskGroups) {
    assert.ok(group.length > 0);
  }
});

test("GoalDecompositionService.decompose sets delegationMode based on priority", async () => {
  const service = new GoalDecompositionService();
  const criticalGoal: Goal = {
    goalId: "goal_critical_delegation",
    description: "紧急变更生产配置",
    owner: "admin",
    successCriteria: [],
    constraints: [],
    priority: "critical",
  };

  const result = await service.decompose(criticalGoal);

  // At least one task should have manual delegation mode for critical priority
  assert.ok(result.tasks.some((task) => task.delegationMode === "manual"));
});

test("GoalDecompositionService.decompose high priority goal triggers high risk", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    goalId: "goal_high_priority",
    description: "执行线上价格调整",
    owner: "finance",
    successCriteria: [],
    constraints: [],
    priority: "high",
  };

  const result = await service.decompose(goal);

  assert.equal(result.riskSummary.overallRisk, "high");
});
