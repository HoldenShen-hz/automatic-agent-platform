import assert from "node:assert/strict";
import test from "node:test";

import {
  GoalDecompositionService,
  type Goal,
  type LlmPlanGenerator,
  type PlannedTask,
  type TaskDependency,
} from "../../../../src/interaction/goal-decomposer/index.js";
import type { CostEstimate } from "../../../../src/scale-ecosystem/marketplace/cost-estimation-service.js";

function createTestGoal(overrides?: Partial<Goal>): Goal {
  return {
    goalId: "test_goal_001",
    description: "创建一个Web服务并部署到生产环境",
    owner: "user_1",
    deadline: "2026-05-01T00:00:00Z",
    successCriteria: [
      { metric: "uptime", target: "99.9%", evaluationMethod: "metric_api" },
    ],
    constraints: ["必须通过安全扫描", "预算不超过5000元"],
    priority: "high",
    ...overrides,
  };
}

// R5-18: Call depth enforcement - tests for delegation chain depth limit and global call_depth hard cap
test("GoalDecompositionService enforces maxDelegationDepth via delegation_depth_exceeded error", async () => {
  const service = new GoalDecompositionService({
    maxDelegationDepth: 2,
    currentDepth: 3, // exceeds maxDelegationDepth of 2
  });

  await assert.rejects(
    async () => service.decompose(createTestGoal()),
    /goal_decomposer.delegation_depth_exceeded/,
  );
});

test("GoalDecompositionService enforces callDepth cap via call_depth_exceeded error", async () => {
  const service = new GoalDecompositionService({
    maxDelegationDepth: 10,
    callDepth: 5,
    currentDepth: 6, // exceeds callDepth of 5
  });

  await assert.rejects(
    async () => service.decompose(createTestGoal()),
    /goal_decomposer.call_depth_exceeded/,
  );
});

test("GoalDecompositionService uses default call depth limits when not specified", async () => {
  const service = new GoalDecompositionService();
  // Should not throw when currentDepth is 0 (default)
  const result = await service.decompose(createTestGoal());
  assert.equal(result.goalId, "test_goal_001");
});

test("GoalDecompositionService respects maxDepth limit and sets maxDepthReached flag", async () => {
  const service = new GoalDecompositionService({
    maxDepth: 2,
    currentDepth: 2, // reaches maxDepth
  });

  const result = await service.decompose(createTestGoal());
  assert.equal(result.maxDepthReached, true);
  assert.equal(result.depthUsed, 2);
});

test("GoalDecompositionService does not set maxDepthReached when depth is below limit", async () => {
  const service = new GoalDecompositionService({
    maxDepth: 5,
    currentDepth: 1,
  });

  const result = await service.decompose(createTestGoal());
  assert.equal(result.maxDepthReached, false);
  assert.equal(result.depthUsed, 1);
});

// R5-28: Capability validation - tests for requiredCapabilities propagation
test("GoalDecompositionService extracts analytics capability from dashboard/report constraints", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    goalId: "capability_test_1",
    description: "创建营销报表和数据分析看板",
    owner: "user_1",
    successCriteria: [],
    constraints: ["需要dashboard和ROI分析"],
    priority: "normal",
  };

  const result = await service.decompose(goal);

  // Check that at least one task has constraintEnvelope with requiredCapabilities
  const tasksWithCapabilities = result.tasks.filter(
    (task) => task.constraintEnvelope?.requiredCapabilities?.length > 0,
  );
  assert.ok(tasksWithCapabilities.length > 0, "Expected at least one task with requiredCapabilities");
  const allCapabilities = tasksWithCapabilities.flatMap(
    (task) => task.constraintEnvelope?.requiredCapabilities ?? [],
  );
  assert.ok(allCapabilities.includes("analytics"), "Expected 'analytics' capability to be detected");
});

test("GoalDecompositionService extracts approval_workflow capability from approval constraints", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    goalId: "capability_test_2",
    description: "需要审批的工作流程",
    owner: "user_1",
    successCriteria: [],
    constraints: ["需要approval审批流程"],
    priority: "high",
  };

  const result = await service.decompose(goal);
  const allCapabilities = result.tasks.flatMap(
    (task) => task.constraintEnvelope?.requiredCapabilities ?? [],
  );
  assert.ok(allCapabilities.includes("approval_workflow"), "Expected 'approval_workflow' capability");
});

test("GoalDecompositionService propagates requiredCapabilities to constraint envelope", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    goalId: "capability_test_3",
    description: "分析报表和审批",
    owner: "user_1",
    successCriteria: [],
    constraints: ["需要dashboard和分析", "approval审批"],
    priority: "normal",
  };

  const result = await service.decompose(goal);
  const envelope = result.plannerHandoff.constraintEnvelope;
  assert.ok(envelope.requiredCapabilities.length > 0);
  assert.ok(envelope.requiredCapabilities.includes("analytics"));
  assert.ok(envelope.requiredCapabilities.includes("approval_workflow"));
});

test("GoalDecompositionService extracts deployment permission from deploy constraints", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    goalId: "permission_test_1",
    description: "部署应用到生产环境",
    owner: "user_1",
    successCriteria: [],
    constraints: ["需要deploy到生产"],
    priority: "critical",
  };

  const result = await service.decompose(goal);
  const envelope = result.plannerHandoff.constraintEnvelope;
  assert.ok(envelope.requiredPermissions.includes("deployment:write"));
});

test("GoalDecompositionService extracts destructive permission from delete constraints", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    goalId: "permission_test_2",
    description: "删除所有测试数据",
    owner: "user_1",
    successCriteria: [],
    constraints: ["delete删除所有数据"],
    priority: "high",
  };

  const result = await service.decompose(goal);
  const envelope = result.plannerHandoff.constraintEnvelope;
  assert.ok(envelope.requiredPermissions.includes("destructive:write"));
});

// R5-19: Budget proportional allocation - tests for budgetAllocations to subtasks
test("GoalDecompositionService calculates proportional budget allocation based on task costs", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    goalId: "budget_test_1",
    description: "测试budget预算",
    owner: "user_1",
    successCriteria: [],
    constraints: ["预算5000元"],
    priority: "normal",
  };

  const result = await service.decompose(goal);
  const envelope = result.plannerHandoff.constraintEnvelope;

  assert.ok(envelope.budgetAllocations, "Expected budgetAllocations to be present");
  assert.ok(envelope.budgetAllocations!.length > 0, "Expected at least one budget allocation");

  // Sum of allocated budgets should approximately equal total budget limit
  const totalAllocated = envelope.budgetAllocations!.reduce(
    (sum, alloc) => sum + alloc.budgetUsd,
    0,
  );
  assert.ok(totalAllocated <= 5000.01, "Total allocated should not exceed budget limit after rounding");
});

test("GoalDecompositionService distributes budget proportionally based on estimated costs", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    goalId: "budget_test_2",
    description: "测试预算分配",
    owner: "user_1",
    successCriteria: [],
    constraints: ["预算100美元"],
    priority: "normal",
  };

  const result = await service.decompose(goal);
  const envelope = result.plannerHandoff.constraintEnvelope;
  const allocations = envelope.budgetAllocations!;

  // Calculate expected proportions based on task costs
  const totalTaskCost = result.tasks.reduce(
    (sum, task) => sum + task.estimatedCost.estimatedCostUsd,
    0,
  );

  for (const allocation of allocations) {
    const task = result.tasks.find((t) => t.taskId === allocation.taskId);
    assert.ok(task, `Expected to find task ${allocation.taskId}`);
    const expectedProportion = task!.estimatedCost.estimatedCostUsd / totalTaskCost;
    const expectedBudget = 100 * expectedProportion;
    // Allow some tolerance for rounding
    assert.ok(
      Math.abs(allocation.budgetUsd - expectedBudget) < 1,
      `Budget for ${allocation.taskId} should be proportional`,
    );
  }
});

test("GoalDecompositionService applies risk multiplier to budget allocation", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    goalId: "budget_risk_test",
    description: "高风险部署任务",
    owner: "user_1",
    successCriteria: [],
    constraints: ["预算10000元", "deploy发布"],
    priority: "critical",
  };

  const result = await service.decompose(goal);
  const envelope = result.plannerHandoff.constraintEnvelope;
  const allocations = envelope.budgetAllocations!;

  // Critical priority tasks should have higher risk multipliers
  const criticalTasks = allocations.filter((a) => {
    const task = result.tasks.find((t) => t.taskId === a.taskId);
    return task?.constraintEnvelope?.riskTolerance === "critical";
  });

  for (const allocation of allocations) {
    assert.ok(allocation.riskMultiplier > 0, "Risk multiplier should be positive");
    if (allocation.riskMultiplier > 1) {
      // High/critical risk tasks get multipliers > 1
      assert.ok(
        ["high", "critical"].includes(
          result.tasks.find((t) => t.taskId === allocation.taskId)?.constraintEnvelope?.riskTolerance ?? "",
        ),
      );
    }
  }
});

test("GoalDecompositionService handles goal without budget constraint", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    goalId: "no_budget_test",
    description: "普通任务",
    owner: "user_1",
    successCriteria: [],
    constraints: [],
    priority: "normal",
  };

  const result = await service.decompose(goal);
  const envelope = result.plannerHandoff.constraintEnvelope;
  assert.equal(envelope.budgetLimitUsd, null);
  assert.deepEqual(envelope.budgetAllocations, []);
});

// R5-42: Risk propagation - tests for riskPropagation to subtasks
test("GoalDecompositionService propagates risk levels to subtasks", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    goalId: "risk_test_1",
    description: "普通风险任务",
    owner: "user_1",
    successCriteria: [],
    constraints: [],
    priority: "normal",
  };

  const result = await service.decompose(goal);
  const envelope = result.plannerHandoff.constraintEnvelope;

  assert.ok(envelope.riskPropagation, "Expected riskPropagation to be present");
  assert.equal(envelope.riskPropagation!.length, result.tasks.length);

  for (const rp of envelope.riskPropagation!) {
    assert.ok(
      ["low", "medium", "high", "critical"].includes(rp.riskLevel),
      `Invalid risk level: ${rp.riskLevel}`,
    );
  }
});

test("GoalDecompositionService assigns higher risk to critical priority goals", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    goalId: "risk_critical",
    description: "关键生产部署",
    owner: "user_1",
    successCriteria: [],
    constraints: ["deploy发布到production"],
    priority: "critical",
  };

  const result = await service.decompose(goal);
  const envelope = result.plannerHandoff.constraintEnvelope;

  // Critical priority should result in low risk tolerance for tasks
  for (const rp of envelope.riskPropagation!) {
    const task = result.tasks.find((t) => t.taskId === rp.taskId);
    assert.equal(
      task?.constraintEnvelope?.riskTolerance,
      "low",
      "Critical priority should result in low risk tolerance",
    );
  }
});

test("GoalDecompositionService builds risk summary with risk factors", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    goalId: "risk_summary_test",
    description: "部署应用到生产环境",
    owner: "user_1",
    successCriteria: [],
    constraints: ["必须在生产环境部署"],
    priority: "high",
  };

  const result = await service.decompose(goal);

  assert.ok(result.riskSummary);
  assert.ok(
    ["low", "medium", "high", "critical"].includes(result.riskSummary.overallRisk),
  );
  assert.ok(Array.isArray(result.riskSummary.riskFactors));
  assert.ok(result.riskSummary.approvalNeeded === true || result.riskSummary.approvalNeeded === false);
});

test("GoalDecompositionService marks critical goals as requiring approval", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    goalId: "approval_critical",
    description: "删除生产环境数据",
    owner: "user_1",
    successCriteria: [],
    constraints: ["delete删除生产数据"],
    priority: "critical",
  };

  const result = await service.decompose(goal);
  assert.equal(result.riskSummary.overallRisk, "critical");
  assert.equal(result.requiresHumanReview, true);
});

test("GoalDecompositionService detects reversibility based on goal description", async () => {
  const service = new GoalDecompositionService();
  const reversibleGoal: Goal = {
    goalId: "reversible_test",
    description: "创建一个报告",
    owner: "user_1",
    successCriteria: [],
    constraints: [],
    priority: "normal",
  };

  const nonReversibleGoal: Goal = {
    goalId: "nonreversible_test",
    description: "删除所有数据",
    owner: "user_1",
    successCriteria: [],
    constraints: [],
    priority: "normal",
  };

  const reversibleResult = await service.decompose(reversibleGoal);
  const nonReversibleResult = await service.decompose(nonReversibleGoal);

  assert.equal(reversibleResult.riskSummary.reversible, true);
  assert.equal(nonReversibleResult.riskSummary.reversible, false);
});

// R9-46: Template matching with DomainRecipe - tests for detectTemplate
test("GoalDecompositionService matches marketing_campaign template", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    goalId: "template_marketing",
    description: "发起春季营销campaign并追踪ROI",
    owner: "marketing_lead",
    successCriteria: [],
    constraints: [],
    priority: "high",
  };

  const result = await service.decompose(goal);
  assert.equal(result.decompositionStrategy, "template");
  assert.equal(result.tasks.length, 4);
  assert.ok(result.tasks.some((t) => t.domainId === "content_production"));
  assert.ok(result.tasks.some((t) => t.domainId === "advertising"));
});

test("GoalDecompositionService matches release_launch template", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    goalId: "template_release",
    description: "发布新版本到生产环境",
    owner: "engineering",
    successCriteria: [],
    constraints: [],
    priority: "high",
  };

  const result = await service.decompose(goal);
  assert.equal(result.decompositionStrategy, "template");
  assert.ok(result.tasks.some((t) => t.domainId === "engineering_ops"));
  assert.ok(result.tasks.some((t) => t.domainId === "quality_assurance"));
});

test("GoalDecompositionService matches incident_response template", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    goalId: "template_incident",
    description: "处理线上故障恢复",
    owner: "ops_team",
    successCriteria: [],
    constraints: [],
    priority: "critical",
  };

  const result = await service.decompose(goal);
  assert.equal(result.decompositionStrategy, "template");
  assert.ok(result.tasks.some((t) => t.domainId === "operations"));
  assert.ok(result.tasks.some((t) => t.domainId === "security"));
});

test("GoalDecompositionService matches hiring_pipeline template", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    goalId: "template_hiring",
    description: "招聘新工程师并安排入职",
    owner: "hr_team",
    successCriteria: [],
    constraints: [],
    priority: "normal",
  };

  const result = await service.decompose(goal);
  assert.equal(result.decompositionStrategy, "template");
  assert.ok(result.tasks.some((t) => t.domainId === "hr"));
  assert.ok(result.tasks.some((t) => t.domainId === "legal"));
});

test("GoalDecompositionService falls back to generic_multi_step for long unmatched descriptions", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    goalId: "template_generic",
    description: "整理一个跨团队运营改进方案，补齐职责分工、预算边界和交付计划",
    owner: "operations",
    successCriteria: [],
    constraints: [],
    priority: "normal",
  };

  const result = await service.decompose(goal);
  assert.ok(
    result.decompositionStrategy === "hybrid" || result.decompositionStrategy === "llm_plan",
  );
});

test("GoalDecompositionService returns human_assisted for short unmatched descriptions", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    goalId: "template_human",
    description: "搞定它",
    owner: "user_1",
    successCriteria: [],
    constraints: [],
    priority: "normal",
  };

  const result = await service.decompose(goal);
  assert.equal(result.decompositionStrategy, "human_assisted");
  assert.equal(result.requiresHumanReview, true);
});

// Task graph construction tests
test("GoalDecompositionService constructs task graph with correct dependency structure", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    goalId: "graph_test",
    description: "发起春季营销campaign",
    owner: "marketing",
    successCriteria: [],
    constraints: [],
    priority: "high",
  };

  const result = await service.decompose(goal);

  assert.ok(Array.isArray(result.dependencyGraph));
  assert.ok(result.dependencyGraph.length > 0);
  assert.ok(Array.isArray(result.topologicallySortedTaskIds));
  assert.equal(result.topologicallySortedTaskIds.length, result.tasks.length);
});

test("GoalDecompositionService detects cycles in dependency graph", async () => {
  const llmPlanGenerator: LlmPlanGenerator = {
    async generate(goal) {
      return {
        tasks: [
          {
            taskId: `${goal.goalId}:llm:1`,
            domainId: "a",
            description: "Task 1",
            inputs: {},
            expectedOutputs: ["out1"],
            delegationMode: "auto",
            estimatedDuration: "1h",
            estimatedCost: { estimatedCostUsd: 0.01, confidence: "low", sampleCount: 0, divisionId: null, basedOn: "default" },
          },
          {
            taskId: `${goal.goalId}:llm:2`,
            domainId: "b",
            description: "Task 2",
            inputs: {},
            expectedOutputs: ["out2"],
            delegationMode: "auto",
            estimatedDuration: "1h",
            estimatedCost: { estimatedCostUsd: 0.01, confidence: "low", sampleCount: 0, divisionId: null, basedOn: "default" },
          },
          {
            taskId: `${goal.goalId}:llm:3`,
            domainId: "c",
            description: "Task 3",
            inputs: {},
            expectedOutputs: ["out3"],
            delegationMode: "auto",
            estimatedDuration: "1h",
            estimatedCost: { estimatedCostUsd: 0.01, confidence: "low", sampleCount: 0, divisionId: null, basedOn: "default" },
          },
        ],
        dependencyGraph: [
          { fromTask: `${goal.goalId}:llm:1`, toTask: `${goal.goalId}:llm:2`, type: "blocks" },
          { fromTask: `${goal.goalId}:llm:2`, toTask: `${goal.goalId}:llm:3`, type: "blocks" },
          { fromTask: `${goal.goalId}:llm:3`, toTask: `${goal.goalId}:llm:1`, type: "blocks" }, // creates cycle
        ],
      };
    },
  };

  const service = new GoalDecompositionService({ llmPlanGenerator });
  const result = await service.decompose({
    goalId: "cycle_goal",
    description:
      "这是一个需要多个相互依赖步骤、跨多个执行阶段持续协作并带有复杂依赖关系的任务，用于验证 LLM 规划分支中的循环检测逻辑是否生效。",
    owner: "user_1",
    successCriteria: [],
    constraints: [],
    priority: "normal",
  });

  assert.equal(result.decompositionStrategy, "llm_plan");
  assert.equal(result.taskGraphDraft.validationMessages.some((m) => m.includes("cycle")), true);
});

test("GoalDecompositionService calculates critical path in task graph", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    goalId: "critical_path_test",
    description: "发起营销活动并追踪效果",
    owner: "marketing",
    successCriteria: [],
    constraints: [],
    priority: "high",
  };

  const result = await service.decompose(goal);

  assert.ok(result.criticalPathTaskIds);
  assert.ok(result.criticalPathTaskIds.length > 0);
});

test("GoalDecompositionService identifies parallel task groups", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    goalId: "parallel_test",
    description: "发起营销活动",
    owner: "marketing",
    successCriteria: [],
    constraints: [],
    priority: "high",
  };

  const result = await service.decompose(goal);

  assert.ok(result.parallelTaskGroups);
  assert.ok(result.parallelTaskGroups.length > 0);
});

test("GoalDecompositionService normalizes string goal input to Goal", async () => {
  const service = new GoalDecompositionService();
  const result = await service.decompose("简单任务描述");

  assert.equal(result.goalId.startsWith("goal:"), true);
  assert.equal(result.tasks.length, 3); // default generic tasks
});

test("GoalDecompositionService calculates estimated duration based on tasks", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    goalId: "duration_test",
    description: "发起营销活动",
    owner: "marketing",
    successCriteria: [],
    constraints: [],
    priority: "high",
  };

  const result = await service.decompose(goal);

  assert.ok(result.estimatedDuration.endsWith("d"));
  const durationValue = parseInt(result.estimatedDuration.replace("d", ""), 10);
  assert.ok(durationValue >= 1);
});

test("GoalDecompositionService sets lifecycle state to decomposed", async () => {
  const service = new GoalDecompositionService();
  const result = await service.decompose(createTestGoal());

  assert.equal(result.lifecycleState, "decomposed");
});

test("GoalDecompositionService populates goalGraphDraft correctly", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    goalId: "draft_test",
    description: "测试草图",
    owner: "user_1",
    successCriteria: [],
    constraints: [],
    priority: "normal",
  };

  const result = await service.decompose(goal);

  assert.equal(result.goalGraphDraft.goalId, "draft_test");
  assert.equal(result.goalGraphDraft.lifecycleState, "decomposed");
  assert.ok(result.goalGraphDraft.constraintEnvelope);
  assert.ok(result.goalGraphDraft.evidenceRefs.length > 0);
});

test("GoalDecompositionService populates taskGraphDraft correctly", async () => {
  const service = new GoalDecompositionService();
  const result = await service.decompose(createTestGoal());

  assert.equal(result.taskGraphDraft.goalId, "test_goal_001");
  assert.equal(result.taskGraphDraft.graphId, "test_goal_001:task_graph_draft");
  assert.equal(result.taskGraphDraft.tasks.length, result.tasks.length);
  assert.equal(result.taskGraphDraft.normalized, true); // no cycles in default template
});

test("GoalDecompositionService populates plannerHandoff correctly", async () => {
  const service = new GoalDecompositionService();
  const result = await service.decompose(createTestGoal());

  assert.equal(result.plannerHandoff.goalId, "test_goal_001");
  assert.equal(result.plannerHandoff.state, "ready_for_planner");
  assert.equal(result.plannerHandoff.graphId, "test_goal_001:task_graph_draft");
  assert.ok(result.plannerHandoff.constraintEnvelope);
});

test("GoalDecompositionService calculates decomposition confidence correctly", async () => {
  const service = new GoalDecompositionService();

  // Template-based should have higher confidence
  const templateResult = await service.decompose("发起营销campaign");
  assert.equal(templateResult.decompositionConfidence, 0.88);

  // Human assisted should have lower confidence
  const humanResult = await service.decompose("搞定");
  assert.ok(humanResult.decompositionConfidence < 0.7);
});
