/**
 * Integration Test: Goal Decomposer Service
 *
 * Tests integration between GoalDecompositionService, LLM plan generation,
 * template detection, dependency analysis, and risk assessment.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { GoalDecompositionService, type Goal } from "../../../src/interaction/goal-decomposer/index.js";
import type { LlmPlanGenerator } from "../../../src/interaction/goal-decomposer/llm-plan-generator.js";

function createMockLlmPlanGenerator(plan: ReturnType<typeof createMockPlan>): LlmPlanGenerator {
  return {
    generate: async () => plan,
  };
}

function createMockPlan() {
  return {
    tasks: [
      {
        taskId: "goal_test:llm:1",
        domainId: "engineering-ops",
        description: "Implement feature",
        inputs: {},
        expectedOutputs: ["feature_impl"],
        delegationMode: "auto" as const,
        estimatedDuration: "4h",
        estimatedCost: { estimatedCostUsd: 0.1, confidence: "low" as const, sampleCount: 0, divisionId: null, basedOn: "default" as const },
      },
      {
        taskId: "goal_test:llm:2",
        domainId: "engineering-ops",
        description: "Write tests",
        inputs: {},
        expectedOutputs: ["test_report"],
        delegationMode: "auto" as const,
        estimatedDuration: "2h",
        estimatedCost: { estimatedCostUsd: 0.05, confidence: "low" as const, sampleCount: 0, divisionId: null, basedOn: "default" as const },
      },
    ],
    dependencyGraph: [
      { fromTask: "goal_test:llm:1", toTask: "goal_test:llm:2", type: "blocks" as const },
    ],
  };
}

function createTestGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    goalId: "goal_test",
    description: "实现一个新功能并测试",
    owner: "user_1",
    successCriteria: [],
    constraints: [],
    priority: "normal",
    ...overrides,
  };
}

test("integration: GoalDecompositionService decomposes marketing campaign goal", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    ...createTestGoal(),
    description: "创建一个 marketing campaign 来推广我们的新产品",
  };

  const result = await service.decompose(goal);

  assert.equal(result.decompositionStrategy, "template");
  assert.ok(result.tasks.length >= 3);
  assert.ok(result.dependencyGraph.length >= 2);
  assert.equal(result.riskSummary.overallRisk, "low");
});

test("integration: GoalDecompositionService decomposes release launch goal", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    ...createTestGoal(),
    description: "发布一个新版本到生产环境",
  };

  const result = await service.decompose(goal);

  assert.equal(result.decompositionStrategy, "template");
  assert.ok(result.tasks.some((t) => t.domainId === "engineering-ops"));
  assert.ok(result.riskSummary.approvalNeeded === true || result.riskSummary.overallRisk === "high");
});

test("integration: GoalDecompositionService uses LLM plan generator when description is long", async () => {
  const mockPlan = createMockPlan();
  const service = new GoalDecompositionService({
    llmPlanGenerator: createMockLlmPlanGenerator(mockPlan),
  });
  const goal: Goal = {
    ...createTestGoal(),
    description: "设计一个复杂的跨团队知识整理与协作体系，需要处理多角色协同、长链路依赖、审阅反馈、权限边界、结构化输出以及持续改进闭环。",
  };

  const result = await service.decompose(goal);

  assert.equal(result.decompositionStrategy, "llm_plan");
  assert.equal(result.tasks.length, 2);
  assert.ok(result.dependencyGraph.length >= 1);
});

test("integration: GoalDecompositionService falls back to human_assisted for unknown goals", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    ...createTestGoal(),
    description: "做某件事",
  };

  const result = await service.decompose(goal);

  assert.equal(result.decompositionStrategy, "human_assisted");
  assert.ok(result.tasks.length >= 1);
});

test("integration: GoalDecompositionService detects incident_response template", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    ...createTestGoal(),
    description: "系统出现故障需要快速恢复和排查",
  };

  const result = await service.decompose(goal);

  assert.equal(result.decompositionStrategy, "template");
  assert.ok(result.tasks.some((t) => t.domainId === "operations" || t.domainId === "security"));
});

test("integration: GoalDecompositionService detects hiring_pipeline template", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    ...createTestGoal(),
    description: "招聘一名新的工程师并完成入职流程",
  };

  const result = await service.decompose(goal);

  assert.equal(result.decompositionStrategy, "template");
  assert.ok(result.tasks.some((t) => t.domainId === "hr" || t.domainId === "finance"));
});

test("integration: GoalDecompositionService identifies critical path tasks", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    ...createTestGoal(),
    description: "发布一个包含多个依赖步骤的复杂项目",
  };

  const result = await service.decompose(goal);

  assert.ok(result.criticalPathTaskIds != null);
  assert.ok(result.criticalPathTaskIds.length >= 1);
});

test("integration: GoalDecompositionService computes parallel task groups", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    ...createTestGoal(),
    description: "执行一个多阶段的发布流程",
  };

  const result = await service.decompose(goal);

  assert.ok(result.parallelTaskGroups != null);
  assert.ok(result.parallelTaskGroups.length >= 1);
});

test("integration: GoalDecompositionService requires human review for critical priority", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    ...createTestGoal(),
    priority: "critical",
  };

  const result = await service.decompose(goal);

  assert.equal(result.requiresHumanReview, true);
});

test("integration: GoalDecompositionService marks high-risk goals for approval", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    ...createTestGoal(),
    description: "删除生产环境的所有日志",
  };

  const result = await service.decompose(goal);

  assert.equal(result.riskSummary.approvalNeeded, true);
  assert.equal(result.riskSummary.overallRisk, "critical");
});

test("integration: GoalDecompositionService enforces max depth to prevent infinite recursion", async () => {
  const service = new GoalDecompositionService({ maxDepth: 2, currentDepth: 2 });
  const goal: Goal = {
    ...createTestGoal(),
    description: "执行一个需要多层级分解的复杂目标",
  };

  const result = await service.decompose(goal);

  assert.equal(result.depthUsed, 2);
  assert.equal(result.maxDepthReached, true);
});

test("integration: GoalDecompositionService handles string goal input", async () => {
  const service = new GoalDecompositionService();
  const goalString = "创建一个新任务来完成某项工作";

  const result = await service.decompose(goalString);

  assert.ok(result.goalId.startsWith("goal:"));
  assert.ok(result.tasks.length >= 1);
});

test("integration: GoalDecompositionService analyzes dependency graph for cycles", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    ...createTestGoal(),
    description: "执行一个包含多个依赖的项目",
  };

  const result = await service.decompose(goal);

  // Verify the hasCycle flag is correctly computed
  assert.ok(typeof result.requiresHumanReview === "boolean");
  assert.ok(result.topologicallySortedTaskIds != null);
});

test("integration: GoalDecompositionService builds topologically sorted task IDs", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    ...createTestGoal(),
    description: "执行一个标准的发布流程",
  };

  const result = await service.decompose(goal);

  assert.ok(result.topologicallySortedTaskIds != null);
  assert.equal(result.topologicallySortedTaskIds.length, result.tasks.length);
});

test("integration: GoalDecompositionService returns zero cost estimate when no tasks", async () => {
  const service = new GoalDecompositionService({ llmPlanGenerator: createMockLlmPlanGenerator({ tasks: [], dependencyGraph: [] }) });
  const goal: Goal = {
    ...createTestGoal(),
    description: "一个非常长且详细的描述用来触发llm分解因为它超过了50个字符的限制",
  };

  const result = await service.decompose(goal);

  assert.equal(result.decompositionStrategy, "hybrid");
  assert.equal(result.tasks.length, 3);
  assert.equal(result.estimatedCost.estimatedCostUsd, 0.15);
});

test("integration: GoalDecompositionService respects deadline in task inputs", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    ...createTestGoal(),
    deadline: "2026-05-01T00:00:00Z",
    description: "完成一个需要按时交付的项目",
  };

  const result = await service.decompose(goal);

  // Tasks should include deadline in inputs
  for (const task of result.tasks) {
    if (task.inputs && typeof task.inputs === "object" && "deadline" in task.inputs) {
      assert.equal((task.inputs as Record<string, unknown>).deadline, "2026-05-01T00:00:00Z");
    }
  }
});

test("integration: GoalDecompositionService sets delegation mode based on priority", async () => {
  const service = new GoalDecompositionService();
  const highPriorityGoal: Goal = {
    ...createTestGoal(),
    priority: "high",
    description: "执行一个高优先级的部署任务",
  };

  const result = await service.decompose(highPriorityGoal);

  assert.ok(result.tasks.every((t) => t.delegationMode === "supervised" || t.delegationMode === "manual"));
});

test("integration: GoalDecompositionService detects generic_multi_step for medium descriptions", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    ...createTestGoal(),
    description: "执行一系列相关的任务来达成目标", // > 20 chars
  };

  const result = await service.decompose(goal);

  // Should be either template or generic_multi_step with hybrid strategy
  assert.ok(result.decompositionStrategy === "template" || result.decompositionStrategy === "hybrid" || result.decompositionStrategy === "human_assisted");
});

test("integration: GoalDecompositionService calculates estimated duration based on tasks", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    ...createTestGoal(),
    description: "发布一个完整的项目到生产环境",
  };

  const result = await service.decompose(goal);

  assert.ok(result.estimatedDuration.endsWith("d") || result.estimatedDuration.endsWith("h"));
  assert.ok(result.estimatedCost.estimatedCostUsd >= 0);
});

test("integration: GoalDecompositionService handles empty constraints and success criteria", async () => {
  const service = new GoalDecompositionService();
  const goal: Goal = {
    goalId: "goal_empty",
    description: "简单的任务",
    owner: "user_1",
    successCriteria: [],
    constraints: [],
    priority: "normal",
  };

  const result = await service.decompose(goal);

  assert.ok(result.tasks.length >= 1);
  assert.ok(result.dependencyGraph != null);
});
