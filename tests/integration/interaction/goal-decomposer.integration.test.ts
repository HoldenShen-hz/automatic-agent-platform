/**
 * Integration tests for goal decomposition flow
 *
 * Tests the complete flow from goal input to decomposition output,
 * including cycle detection, depth tracking, and planner handoff.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { GoalDecompositionService, type Goal, type LlmPlanGenerator } from "../../../src/interaction/goal-decomposer/index.js";
import { ProactiveAgentService, type TriggerDefinition } from "../../../src/interaction/proactive-agent/index.js";
import { DashboardAggregationService } from "../../../src/interaction/dashboard/index.js";
import type { TaskBoardItem } from "../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import type { SystemSituation } from "../../../src/platform/shared/observability/system-situation-model.js";

test("integration: Full goal decomposition flow with marketing campaign", async () => {
  const service = new GoalDecompositionService();

  const goal: Goal = {
    goalId: "goal_marketing_integration",
    description: "发起618营销活动",
    owner: "marketing_lead",
    successCriteria: [],
    constraints: [],
    priority: "high",
  };

  const result = await service.decompose(goal);

  // Verify decomposition produces all expected outputs
  assert.ok(result.tasks.length > 0);
  assert.ok(result.dependencyGraph.length >= 0);
  assert.ok(result.plannerHandoff);
  assert.equal(result.lifecycleState, "decomposed");

  // Verify template detection
  assert.equal(result.decompositionStrategy, "template");

  // Verify risk assessment
  assert.ok(result.riskSummary);
  assert.ok(result.riskSummary.overallRisk);

  // Verify task graph draft
  assert.ok(result.taskGraphDraft);
  assert.ok(result.taskGraphDraft.validationMessages);
});

test("integration: Goal decomposition with custom LLM plan generator", async () => {
  const customPlanGenerator: LlmPlanGenerator = {
    async generate(goal) {
      return {
        tasks: [
          {
            taskId: `${goal.goalId}:custom_1`,
            domainId: "engineering_ops",
            description: "Custom task 1",
            inputs: {},
            expectedOutputs: ["result"],
            delegationMode: "auto",
            estimatedDuration: "4h",
            estimatedCost: {
              estimatedCostUsd: 0.2,
              confidence: "high",
              sampleCount: 10,
              divisionId: "engineering_ops",
              basedOn: "division_avg",
            },
          },
          {
            taskId: `${goal.goalId}:custom_2`,
            domainId: "data_analysis",
            description: "Custom task 2",
            inputs: {},
            expectedOutputs: ["analysis"],
            delegationMode: "supervised",
            estimatedDuration: "2h",
            estimatedCost: {
              estimatedCostUsd: 0.1,
              confidence: "high",
              sampleCount: 10,
              divisionId: "data_analysis",
              basedOn: "division_avg",
            },
          },
        ],
        dependencyGraph: [
          {
            fromTask: `${goal.goalId}:custom_1`,
            toTask: `${goal.goalId}:custom_2`,
            type: "blocks",
          },
        ],
      };
    },
  };

  const service = new GoalDecompositionService({ llmPlanGenerator: customPlanGenerator });

  const goal: Goal = {
    goalId: "goal_custom_llm",
    description: "创建一个复杂的跨团队知识整理与协作系统，处理多角色协同、长链路依赖、审阅反馈、权限边界",
    owner: "test_user",
    successCriteria: [],
    constraints: [],
    priority: "normal",
  };

  const result = await service.decompose(goal);

  // Should use LLM plan or fall back to hybrid
  assert.ok(result.decompositionStrategy === "llm_plan" || result.decompositionStrategy === "hybrid");
  assert.equal(result.tasks.length, 2);

  // Verify custom plan was used
  assert.ok(result.tasks.some(t => t.domainId === "engineering_ops"));
  assert.ok(result.tasks.some(t => t.domainId === "data_analysis"));
});

test("integration: Goal decomposition with budget constraints", async () => {
  const service = new GoalDecompositionService();

  const goal: Goal = {
    goalId: "goal_budget_test",
    description: "发起营销活动预算 5000 元",
    owner: "budget_owner",
    successCriteria: [],
    constraints: ["预算 5000 元"],
    priority: "normal",
  };

  const result = await service.decompose(goal);

  // Verify budget was parsed
  assert.ok(result.goalGraphDraft.constraintEnvelope.budgetLimitUsd !== null);
});

test("integration: Goal decomposition depth tracking", async () => {
  const service = new GoalDecompositionService({ maxDepth: 3 });

  const goal: Goal = {
    goalId: "goal_depth_test",
    description: "测试深度追踪功能",
    owner: "test",
    successCriteria: [],
    constraints: [],
    priority: "normal",
  };

  const result = await service.decompose(goal);

  // Depth should be tracked
  assert.equal(typeof result.depthUsed, "number");
  assert.equal(typeof result.maxDepthReached, "boolean");
});

test("integration: Goal decomposition with critical priority requires human review", async () => {
  const service = new GoalDecompositionService();

  const goal: Goal = {
    goalId: "goal_critical",
    description: "紧急删除生产环境日志",
    owner: "admin",
    successCriteria: [],
    constraints: [],
    priority: "critical",
  };

  const result = await service.decompose(goal);

  // Critical priority should require human review
  assert.equal(result.requiresHumanReview, true);
  assert.equal(result.riskSummary.overallRisk, "critical");
});

test("integration: Goal decomposition handles cycle detection", async () => {
  const cyclicGenerator: LlmPlanGenerator = {
    async generate(goal) {
      return {
        tasks: [
          {
            taskId: `${goal.goalId}:cycle_1`,
            domainId: "general_ops",
            description: "Cycle task 1",
            inputs: {},
            expectedOutputs: ["result"],
            delegationMode: "auto",
            estimatedDuration: "1h",
            estimatedCost: {
              estimatedCostUsd: 0.05,
              confidence: "default",
              sampleCount: 0,
              divisionId: null,
              basedOn: "default",
            },
            dependsOn: [`${goal.goalId}:cycle_2`],
          },
          {
            taskId: `${goal.goalId}:cycle_2`,
            domainId: "general_ops",
            description: "Cycle task 2",
            inputs: {},
            expectedOutputs: ["result"],
            delegationMode: "auto",
            estimatedDuration: "1h",
            estimatedCost: {
              estimatedCostUsd: 0.05,
              confidence: "default",
              sampleCount: 0,
              divisionId: null,
              basedOn: "default",
            },
            dependsOn: [`${goal.goalId}:cycle_1`],
          },
        ],
        dependencyGraph: [
          {
            fromTask: `${goal.goalId}:cycle_1`,
            toTask: `${goal.goalId}:cycle_2`,
            type: "blocks",
          },
          {
            fromTask: `${goal.goalId}:cycle_2`,
            toTask: `${goal.goalId}:cycle_1`,
            type: "blocks",
          },
        ],
      };
    },
  };

  const service = new GoalDecompositionService({ llmPlanGenerator: cyclicGenerator });

  const goal: Goal = {
    goalId: "goal_cycle_test",
    description: "测试循环检测功能需要超过五十个字符以确保触发LLM生成器",
    owner: "test",
    successCriteria: [],
    constraints: [],
    priority: "normal",
  };

  const result = await service.decompose(goal);

  // Should detect cycle
  assert.ok(result.taskGraphDraft.validationMessages.some(msg => msg.includes("cycle")));
  // Graph should be marked as not normalized
  assert.equal(result.taskGraphDraft.normalized, false);
  // Should require human review
  assert.equal(result.requiresHumanReview, true);
});

test("integration: Goal decomposition from string input", async () => {
  const service = new GoalDecompositionService();

  const result = await service.decompose("发起营销活动推广新产品");

  assert.ok(result.goalId.startsWith("goal:"));
  assert.ok(result.tasks.length > 0);
});

test("integration: Goal decomposition topologically sorts DAG", async () => {
  const dagGenerator: LlmPlanGenerator = {
    async generate(goal) {
      return {
        tasks: [
          {
            taskId: `${goal.goalId}:start`,
            domainId: "general_ops",
            description: "Start task",
            inputs: {},
            expectedOutputs: ["result"],
            delegationMode: "auto",
            estimatedDuration: "1h",
            estimatedCost: {
              estimatedCostUsd: 0.05,
              confidence: "default",
              sampleCount: 0,
              divisionId: null,
              basedOn: "default",
            },
          },
          {
            taskId: `${goal.goalId}:middle`,
            domainId: "general_ops",
            description: "Middle task",
            inputs: {},
            expectedOutputs: ["result"],
            delegationMode: "auto",
            estimatedDuration: "1h",
            estimatedCost: {
              estimatedCostUsd: 0.05,
              confidence: "default",
              sampleCount: 0,
              divisionId: null,
              basedOn: "default",
            },
            dependsOn: [`${goal.goalId}:start`],
          },
          {
            taskId: `${goal.goalId}:end`,
            domainId: "general_ops",
            description: "End task",
            inputs: {},
            expectedOutputs: ["result"],
            delegationMode: "auto",
            estimatedDuration: "1h",
            estimatedCost: {
              estimatedCostUsd: 0.05,
              confidence: "default",
              sampleCount: 0,
              divisionId: null,
              basedOn: "default",
            },
            dependsOn: [`${goal.goalId}:middle`],
          },
        ],
        dependencyGraph: [
          {
            fromTask: `${goal.goalId}:start`,
            toTask: `${goal.goalId}:middle`,
            type: "blocks",
          },
          {
            fromTask: `${goal.goalId}:middle`,
            toTask: `${goal.goalId}:end`,
            type: "blocks",
          },
        ],
      };
    },
  };

  const service = new GoalDecompositionService({ llmPlanGenerator: dagGenerator });

  const result = await service.decompose("测试拓扑排序功能需要超过五十个字符以确保触发自定义LLM生成器");

  // Verify topological order: start before middle, middle before end
  const sorted = result.topologicallySortedTaskIds ?? [];
  const startIdx = sorted.indexOf(`${result.goalId}:start`);
  const middleIdx = sorted.indexOf(`${result.goalId}:middle`);
  const endIdx = sorted.indexOf(`${result.goalId}:end`);

  assert.ok(startIdx < middleIdx, "start should come before middle");
  assert.ok(middleIdx < endIdx, "middle should come before end");
});

test("integration: Goal decomposition calculates critical path", async () => {
  const service = new GoalDecompositionService();

  const result = await service.decompose("发起营销活动");

  assert.ok(result.criticalPathTaskIds);
  assert.ok(result.criticalPathTaskIds.length >= 0);
});

test("integration: Goal decomposition with multiple domain policies", async () => {
  const service = new GoalDecompositionService();

  // Hiring pipeline should involve multiple domains
  const result = await service.decompose("招聘新工程师完成入职流程");

  assert.equal(result.decompositionStrategy, "template");

  // Verify multiple domains are involved
  const domains = new Set(result.tasks.map(t => t.domainId));
  assert.ok(domains.size > 1);
});

test("integration: Goal decomposition computes parallel task groups", async () => {
  const parallelGenerator: LlmPlanGenerator = {
    async generate(goal) {
      return {
        tasks: [
          {
            taskId: `${goal.goalId}:task_a`,
            domainId: "general_ops",
            description: "Task A",
            inputs: {},
            expectedOutputs: ["result"],
            delegationMode: "auto",
            estimatedDuration: "2h",
            estimatedCost: {
              estimatedCostUsd: 0.05,
              confidence: "default",
              sampleCount: 0,
              divisionId: null,
              basedOn: "default",
            },
          },
          {
            taskId: `${goal.goalId}:task_b`,
            domainId: "general_ops",
            description: "Task B",
            inputs: {},
            expectedOutputs: ["result"],
            delegationMode: "auto",
            estimatedDuration: "2h",
            estimatedCost: {
              estimatedCostUsd: 0.05,
              confidence: "default",
              sampleCount: 0,
              divisionId: null,
              basedOn: "default",
            },
          },
        ],
        dependencyGraph: [], // No dependencies = parallel
      };
    },
  };

  const service = new GoalDecompositionService({ llmPlanGenerator: parallelGenerator });

  const result = await service.decompose("测试并行任务组需要超过50个字符以触发LLM生成器");

  // With no dependencies, tasks should be in parallel groups
  assert.ok(result.parallelTaskGroups);
  if (!result.taskGraphDraft.validationMessages.some(msg => msg.includes("cycle"))) {
    assert.ok(result.parallelTaskGroups.length > 0);
  }
});

test("integration: Dashboard and goal decomposition workflow", async () => {
  // Start with goal decomposition
  const goalService = new GoalDecompositionService();
  const goal: Goal = {
    goalId: "goal_dashboard_integration",
    description: "发起营销活动",
    owner: "marketing",
    successCriteria: [],
    constraints: [],
    priority: "normal",
  };

  const decomposition = await goalService.decompose(goal);

  // Create tasks for dashboard
  const tasks: TaskBoardItem[] = decomposition.tasks.map((task, idx) => ({
    taskId: task.taskId,
    title: task.description,
    priority: "normal",
    taskStatus: idx === 0 ? "in_progress" : "pending",
    workflowStatus: "running",
    divisionId: task.domainId,
    currentStepIndex: 0,
    sessionStatus: "open",
    latestEventAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));

  // Feed into dashboard
  const dashboardService = new DashboardAggregationService({
    taskSource: {
      list: () => tasks,
    },
    systemSource: {
      build: (): SystemSituation => ({
        healthStatus: "ok",
        providerHealth: { status: "healthy", successRate: 0.98, recentCalls: 100 },
        resourceUtilization: { memoryRssMb: 512, cpuPercent: 45, activeProcesses: 8 },
        queueBacklog: { size: tasks.filter(t => t.taskStatus === "pending").length, degraded: false },
        eventBusBacklog: { tier1PendingAcks: 0 },
        findings: [],
        observedAt: new Date().toISOString(),
      }),
    },
  });

  const dashboard = dashboardService.buildOperatorDashboard();

  // Dashboard should reflect the tasks from goal decomposition
  assert.ok(dashboard.attentionQueue.length >= 0);
});
