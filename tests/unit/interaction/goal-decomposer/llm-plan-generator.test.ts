/**
 * Unit tests for llm-plan-generator.ts
 *
 * Tests UnifiedChatPlanGenerator and LLM plan generation behaviors.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  UnifiedChatPlanGenerator,
  type LlmPlan,
  type LlmPlanGenerator,
  type Goal,
} from "../../../../src/interaction/goal-decomposer/llm-plan-generator.js";
import { createBudgetLedger } from "../../../../src/platform/contracts/executable-contracts/index.js";
import { BudgetAllocator } from "../../../../src/platform/execution/budget-allocator.js";
import type { UnifiedChatProvider } from "../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js";

// ─── Test Factories ───────────────────────────────────────────────────────────

function createMockProvider(mockResponse: string): UnifiedChatProvider {
  return {
    complete: async (_prompt: string, _options?: { model?: string; system?: string; temperature?: number; maxTokens?: number }): Promise<string> => {
      return mockResponse;
    },
  } as UnifiedChatProvider;
}

function createTestGoal(overrides?: Partial<Goal>): Goal {
  return {
    goalId: "test_goal_llm",
    description: "创建并部署Web服务到生产环境",
    owner: "user_1",
    deadline: "2026-05-01T00:00:00Z",
    successCriteria: [
      { metric: "uptime", target: "99.9%", evaluationMethod: "metric_api" },
    ],
    constraints: ["必须通过安全扫描"],
    priority: "high",
    ...overrides,
  };
}

function createValidPlanResponse(): string {
  return JSON.stringify({
    tasks: [
      {
        domainId: "engineering_ops",
        description: "创建Web服务代码",
        expectedOutputs: ["Web服务代码"],
        delegationMode: "auto",
        estimatedDuration: "2h",
        estimatedCostUsd: 0.05,
      },
      {
        domainId: "engineering_ops",
        description: "编写单元测试",
        expectedOutputs: ["测试报告"],
        delegationMode: "auto",
        estimatedDuration: "1h",
        estimatedCostUsd: 0.02,
      },
      {
        domainId: "quality_assurance",
        description: "部署到生产环境",
        expectedOutputs: ["部署确认"],
        delegationMode: "supervised",
        estimatedDuration: "30m",
        estimatedCostUsd: 0.01,
      },
    ],
    dependencyGraph: [
      { fromTask: "1", toTask: "2", type: "blocks" },
      { fromTask: "2", toTask: "3", type: "blocks" },
    ],
  });
}

// ─── Basic Functionality Tests ────────────────────────────────────────────────

test("UnifiedChatPlanGenerator implements LlmPlanGenerator interface", () => {
  const provider = createMockProvider("{}");
  const generator = new UnifiedChatPlanGenerator({ provider });
  assert.ok(typeof generator.generate === "function");
});

test("UnifiedChatPlanGenerator uses default model gpt-4o-mini", () => {
  const provider = createMockProvider("{}");
  const generator = new UnifiedChatPlanGenerator({ provider });
  assert.ok(generator);
});

test("UnifiedChatPlanGenerator accepts custom model", () => {
  const provider = createMockProvider("{}");
  const generator = new UnifiedChatPlanGenerator({ provider, model: "claude-sonnet-4" });
  assert.ok(generator);
});

test("UnifiedChatPlanGenerator.generate returns LlmPlan with tasks and dependencyGraph", async () => {
  const provider = createMockProvider(createValidPlanResponse());
  const generator = new UnifiedChatPlanGenerator({ provider });
  const goal = createTestGoal();

  const result = await generator.generate(goal);

  assert.ok(Array.isArray(result.tasks));
  assert.ok(Array.isArray(result.dependencyGraph));
  assert.equal(result.tasks.length, 3);
  assert.equal(result.dependencyGraph.length, 2);
});

test("UnifiedChatPlanGenerator.generate assigns task IDs with goal prefix", async () => {
  const mockResponse = JSON.stringify({
    tasks: [
      {
        domainId: "engineering",
        description: "第一步",
        expectedOutputs: ["输出1"],
        delegationMode: "auto",
        estimatedDuration: "1h",
        estimatedCostUsd: 0.01,
      },
    ],
    dependencyGraph: [],
  });

  const provider = createMockProvider(mockResponse);
  const generator = new UnifiedChatPlanGenerator({ provider });
  const goal = createTestGoal();

  const result = await generator.generate(goal);

  assert.ok(result.tasks[0]!.taskId.startsWith("test_goal_llm:llm:"));
});

test("UnifiedChatPlanGenerator.generate includes goal context in task inputs", async () => {
  const mockResponse = JSON.stringify({
    tasks: [
      {
        domainId: "engineering",
        description: "执行部署",
        expectedOutputs: ["部署结果"],
        delegationMode: "auto",
        estimatedDuration: "30m",
        estimatedCostUsd: 0.01,
      },
    ],
    dependencyGraph: [],
  });

  const provider = createMockProvider(mockResponse);
  const generator = new UnifiedChatPlanGenerator({ provider });
  const goal = createTestGoal();

  const result = await generator.generate(goal);

  const task = result.tasks[0]!;
  assert.equal(task.inputs.goalDescription, "创建并部署Web服务到生产环境");
  assert.deepEqual(task.inputs.successCriteria, goal.successCriteria);
  assert.deepEqual(task.inputs.constraints, goal.constraints);
  assert.equal(task.inputs.deadline, "2026-05-01T00:00:00Z");
});

test("UnifiedChatPlanGenerator.generate normalizes numeric task references", async () => {
  const mockResponse = JSON.stringify({
    tasks: [
      { domainId: "a", description: "Task 1", expectedOutputs: [], delegationMode: "auto", estimatedDuration: "1h", estimatedCostUsd: 0.01 },
      { domainId: "b", description: "Task 2", expectedOutputs: [], delegationMode: "auto", estimatedDuration: "1h", estimatedCostUsd: 0.01 },
    ],
    dependencyGraph: [
      { fromTask: "1", toTask: "2", type: "blocks" },
    ],
  });

  const provider = createMockProvider(mockResponse);
  const generator = new UnifiedChatPlanGenerator({ provider });
  const goal = createTestGoal();

  const result = await generator.generate(goal);

  assert.equal(result.dependencyGraph[0]!.fromTask, "test_goal_llm:llm:1");
  assert.equal(result.dependencyGraph[0]!.toTask, "test_goal_llm:llm:2");
});

test("UnifiedChatPlanGenerator.generate normalizes already-prefixed task references", async () => {
  const mockResponse = JSON.stringify({
    tasks: [
      { domainId: "a", description: "Task 1", expectedOutputs: [], delegationMode: "auto", estimatedDuration: "1h", estimatedCostUsd: 0.01 },
      { domainId: "b", description: "Task 2", expectedOutputs: [], delegationMode: "auto", estimatedDuration: "1h", estimatedCostUsd: 0.01 },
    ],
    dependencyGraph: [
      { fromTask: "test_goal_llm:llm:1", toTask: "test_goal_llm:llm:2", type: "blocks" },
    ],
  });

  const provider = createMockProvider(mockResponse);
  const generator = new UnifiedChatPlanGenerator({ provider });
  const goal = createTestGoal();

  const result = await generator.generate(goal);

  assert.equal(result.dependencyGraph[0]!.fromTask, "test_goal_llm:llm:1");
  assert.equal(result.dependencyGraph[0]!.toTask, "test_goal_llm:llm:2");
});

test("UnifiedChatPlanGenerator.generate handles markdown-wrapped JSON response", async () => {
  const mockResponse = `\`\`\`json
{
  "tasks": [
    {
      "domainId": "engineering",
      "description": "测试任务",
      "expectedOutputs": ["结果"],
      "delegationMode": "manual",
      "estimatedDuration": "2h",
      "estimatedCostUsd": 0.03
    }
  ],
  "dependencyGraph": []
}
\`\`\``;

  const provider = createMockProvider(mockResponse);
  const generator = new UnifiedChatPlanGenerator({ provider });
  const goal = createTestGoal();

  const result = await generator.generate(goal);

  assert.equal(result.tasks.length, 1);
  assert.equal(result.tasks[0]!.description, "测试任务");
});

test("UnifiedChatPlanGenerator.generate throws on invalid JSON shape", async () => {
  const mockResponse = JSON.stringify({
    tasks: "not an array",
    dependencyGraph: [],
  });

  const provider = createMockProvider(mockResponse);
  const generator = new UnifiedChatPlanGenerator({ provider });
  const goal = createTestGoal();

  await assert.rejects(
    async () => generator.generate(goal),
    /goal_decomposer.invalid_llm_plan_shape/,
  );
});

test("UnifiedChatPlanGenerator.generate throws on missing dependencyGraph", async () => {
  const mockResponse = JSON.stringify({
    tasks: [{ domainId: "a", description: "b", expectedOutputs: [], delegationMode: "auto", estimatedDuration: "1h", estimatedCostUsd: 0.01 }],
  });

  const provider = createMockProvider(mockResponse);
  const generator = new UnifiedChatPlanGenerator({ provider });
  const goal = createTestGoal();

  await assert.rejects(
    async () => generator.generate(goal),
    /goal_decomposer.invalid_llm_plan_shape/,
  );
});

test("UnifiedChatPlanGenerator.generate preserves dependency graph structure types", async () => {
  const mockResponse = JSON.stringify({
    tasks: [
      { domainId: "a", description: "Task 1", expectedOutputs: [], delegationMode: "auto", estimatedDuration: "1h", estimatedCostUsd: 0.01 },
      { domainId: "b", description: "Task 2", expectedOutputs: [], delegationMode: "auto", estimatedDuration: "1h", estimatedCostUsd: 0.01 },
      { domainId: "c", description: "Task 3", expectedOutputs: [], delegationMode: "auto", estimatedDuration: "1h", estimatedCostUsd: 0.01 },
    ],
    dependencyGraph: [
      { fromTask: "1", toTask: "2", type: "blocks" },
      { fromTask: "2", toTask: "3", type: "provides_input" },
      { fromTask: "1", toTask: "3", type: "soft_dependency", dataContract: "shared_data" },
    ],
  });

  const provider = createMockProvider(mockResponse);
  const generator = new UnifiedChatPlanGenerator({ provider });
  const goal = createTestGoal();

  const result = await generator.generate(goal);

  assert.equal(result.dependencyGraph[0]!.type, "blocks");
  assert.equal(result.dependencyGraph[1]!.type, "provides_input");
  assert.equal(result.dependencyGraph[2]!.type, "soft_dependency");
  assert.equal(result.dependencyGraph[2]!.dataContract, "shared_data");
});

test("UnifiedChatPlanGenerator.generate handles goal without deadline", async () => {
  const mockResponse = JSON.stringify({
    tasks: [
      { domainId: "a", description: "Task", expectedOutputs: [], delegationMode: "auto", estimatedDuration: "1h", estimatedCostUsd: 0.01 },
    ],
    dependencyGraph: [],
  });

  const provider = createMockProvider(mockResponse);
  const generator = new UnifiedChatPlanGenerator({ provider });
  const goalWithoutDeadline: Goal = {
    goalId: "test_goal_no_deadline",
    description: "测试目标",
    owner: "user_2",
    successCriteria: [],
    constraints: [],
    priority: "normal",
  };

  const result = await generator.generate(goalWithoutDeadline);

  assert.equal(result.tasks[0]!.inputs.deadline, null);
});

test("UnifiedChatPlanGenerator.generate rounds estimated cost to 4 decimal places", async () => {
  const mockResponse = JSON.stringify({
    tasks: [
      { domainId: "a", description: "Task", expectedOutputs: [], delegationMode: "auto", estimatedDuration: "1h", estimatedCostUsd: 0.0123456789 },
    ],
    dependencyGraph: [],
  });

  const provider = createMockProvider(mockResponse);
  const generator = new UnifiedChatPlanGenerator({ provider });
  const goal = createTestGoal();

  const result = await generator.generate(goal);

  assert.equal(result.tasks[0]!.estimatedCost.estimatedCostUsd, 0.0123);
});

test("UnifiedChatPlanGenerator.generate uses low confidence for small cost proportion estimates", async () => {
  const mockResponse = JSON.stringify({
    tasks: [
      { domainId: "a", description: "Small Task", expectedOutputs: [], delegationMode: "auto", estimatedDuration: "1h", estimatedCostUsd: 0.005 },
      { domainId: "b", description: "Large Task", expectedOutputs: [], delegationMode: "auto", estimatedDuration: "2h", estimatedCostUsd: 0.2 },
    ],
    dependencyGraph: [{ fromTask: "1", toTask: "2", type: "blocks" }],
  });

  const provider = createMockProvider(mockResponse);
  const generator = new UnifiedChatPlanGenerator({ provider });
  const goal = createTestGoal();

  const result = await generator.generate(goal);

  assert.equal(result.tasks[0]!.estimatedCost.confidence, "low");
  assert.equal(result.tasks[0]!.estimatedCost.sampleCount, 1);
  assert.equal(result.tasks[0]!.estimatedCost.divisionId, null);
  assert.equal(result.tasks[0]!.estimatedCost.basedOn, "default");
});

test("LlmPlanGenerator interface is compatible with UnifiedChatPlanGenerator", () => {
  const provider = createMockProvider("{}");
  const generator: LlmPlanGenerator = new UnifiedChatPlanGenerator({ provider });
  assert.ok(typeof generator.generate === "function");
});

// ─── Budget Reservation Tests ─────────────────────────────────────────────────

test("UnifiedChatPlanGenerator managesBudgetReservations is true when budgetControl is provided", () => {
  const provider = createMockProvider("{}");
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 5,
    version: 0,
  });
  const generator = new UnifiedChatPlanGenerator({
    provider,
    budgetControl: {
      ledger,
      estimatedCostUsd: 0.2,
      tenantId: "tenant-1",
      traceId: "trace-1",
      emittedBy: "test",
    },
  });

  assert.equal(generator.managesBudgetReservations, true);
});

test("UnifiedChatPlanGenerator managesBudgetReservations is false when budgetControl is not provided", () => {
  const provider = createMockProvider("{}");
  const generator = new UnifiedChatPlanGenerator({ provider });

  assert.equal(generator.managesBudgetReservations, false);
});

test("UnifiedChatPlanGenerator settles reserved budget after successful plan generation", async () => {
  class SpyBudgetAllocator extends BudgetAllocator {
    public settleCalls = 0;
    public releaseCalls = 0;

    public override settle(input: Parameters<BudgetAllocator["settle"]>[0]): ReturnType<BudgetAllocator["settle"]> {
      this.settleCalls += 1;
      return super.settle(input);
    }

    public override release(input: Parameters<BudgetAllocator["release"]>[0]): ReturnType<BudgetAllocator["release"]> {
      this.releaseCalls += 1;
      return super.release(input);
    }
  }

  const provider = createMockProvider(JSON.stringify({
    tasks: [
      {
        domainId: "engineering",
        description: "执行任务",
        expectedOutputs: ["结果"],
        delegationMode: "auto",
        estimatedDuration: "1h",
        estimatedCostUsd: 0.03,
      },
    ],
    dependencyGraph: [],
  }));
  const allocator = new SpyBudgetAllocator();
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 5,
    version: 0,
  });
  const generator = new UnifiedChatPlanGenerator({
    provider,
    budgetControl: {
      allocator,
      ledger,
      estimatedCostUsd: 0.2,
      tenantId: "tenant-1",
      traceId: "trace-1",
      emittedBy: "test",
      fencingToken: "test-token",
    },
  });

  await generator.generate(createTestGoal());

  assert.equal(allocator.settleCalls, 1);
  assert.equal(allocator.releaseCalls, 0);
});

test("UnifiedChatPlanGenerator releases reserved budget when provider call fails", async () => {
  class SpyBudgetAllocator extends BudgetAllocator {
    public settleCalls = 0;
    public releaseCalls = 0;

    public override settle(input: Parameters<BudgetAllocator["settle"]>[0]): ReturnType<BudgetAllocator["settle"]> {
      this.settleCalls += 1;
      return super.settle(input);
    }

    public override release(input: Parameters<BudgetAllocator["release"]>[0]): ReturnType<BudgetAllocator["release"]> {
      this.releaseCalls += 1;
      return super.release(input);
    }
  }

  const provider = {
    complete: async (): Promise<string> => {
      throw new Error("provider.failed");
    },
  } as UnifiedChatProvider;
  const allocator = new SpyBudgetAllocator();
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 5,
    version: 0,
  });
  const generator = new UnifiedChatPlanGenerator({
    provider,
    budgetControl: {
      allocator,
      ledger,
      estimatedCostUsd: 0.2,
      tenantId: "tenant-1",
      traceId: "trace-1",
      emittedBy: "test",
      fencingToken: "test-token",
    },
  });

  await assert.rejects(() => generator.generate(createTestGoal()), /provider\.failed/);
  assert.equal(allocator.settleCalls, 0);
  assert.equal(allocator.releaseCalls, 1);
});

test("UnifiedChatPlanGenerator passes costTag to provider", async () => {
  let receivedCostTag: string | undefined;
  const provider: UnifiedChatProvider = {
    complete: async (
      _prompt: string,
      options?: { model?: string; system?: string; temperature?: number; maxTokens?: number; costTag?: string },
    ): Promise<string> => {
      receivedCostTag = options?.costTag;
      return JSON.stringify({ tasks: [], dependencyGraph: [] });
    },
  } as UnifiedChatProvider;
  const generator = new UnifiedChatPlanGenerator({ provider });

  await generator.generate(createTestGoal());

  assert.equal(receivedCostTag, "goal_decomposer.llm_plan");
});

test("UnifiedChatPlanGenerator passes traceId and tenantId when budgetControl is provided", async () => {
  let receivedTraceId: string | undefined;
  let receivedTenantId: string | undefined;
  const provider: UnifiedChatProvider = {
    complete: async (
      _prompt: string,
      options?: { model?: string; traceId?: string; tenantId?: string },
    ): Promise<string> => {
      receivedTraceId = options?.traceId;
      receivedTenantId = options?.tenantId;
      return JSON.stringify({ tasks: [], dependencyGraph: [] });
    },
  } as UnifiedChatProvider;
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 5,
    version: 0,
  });
  const generator = new UnifiedChatPlanGenerator({
    provider,
    budgetControl: {
      ledger,
      estimatedCostUsd: 0.2,
      tenantId: "tenant-1",
      traceId: "trace-abc",
      emittedBy: "test",
    },
  });

  await generator.generate(createTestGoal());

  assert.equal(receivedTraceId, "trace-abc");
  assert.equal(receivedTenantId, "tenant-1");
});

test("LlmPlan type accepts tasks and dependencyGraph", () => {
  const plan: LlmPlan = {
    tasks: [
      {
        taskId: "task_1",
        domainId: "domain",
        description: "desc",
        inputs: {},
        expectedOutputs: [],
        delegationMode: "auto",
        estimatedDuration: "1h",
        estimatedCost: {
          estimatedCostUsd: 0.01,
          confidence: "low",
          sampleCount: 0,
          divisionId: null,
          basedOn: "default",
        },
      },
    ],
    dependencyGraph: [
      { fromTask: "task_1", toTask: "task_2", type: "blocks" },
    ],
  };

  assert.equal(plan.tasks.length, 1);
  assert.equal(plan.dependencyGraph.length, 1);
});

// ─── Constraint Envelope Tests ────────────────────────────────────────────────

test("UnifiedChatPlanGenerator generates constraintEnvelope with budget allocation", async () => {
  const mockResponse = JSON.stringify({
    tasks: [
      { domainId: "a", description: "Task A", expectedOutputs: [], delegationMode: "auto", estimatedDuration: "1h", estimatedCostUsd: 0.05 },
      { domainId: "b", description: "Task B", expectedOutputs: [], delegationMode: "auto", estimatedDuration: "1h", estimatedCostUsd: 0.05 },
    ],
    dependencyGraph: [
      { fromTask: "1", toTask: "2", type: "blocks" },
    ],
  });

  const provider = createMockProvider(mockResponse);
  const generator = new UnifiedChatPlanGenerator({ provider });
  const goal = createTestGoal();

  const result = await generator.generate(goal);

  assert.ok(result.tasks[0]!.constraintEnvelope);
  assert.ok(result.tasks[1]!.constraintEnvelope);
});

test("UnifiedChatPlanGenerator propagates priority to riskTolerance", async () => {
  const mockResponse = JSON.stringify({
    tasks: [
      { domainId: "a", description: "Task", expectedOutputs: [], delegationMode: "auto", estimatedDuration: "1h", estimatedCostUsd: 0.05 },
    ],
    dependencyGraph: [],
  });

  const provider = createMockProvider(mockResponse);
  const generator = new UnifiedChatPlanGenerator({ provider });
  const goal = createTestGoal({ priority: "critical" });

  const result = await generator.generate(goal);

  assert.equal(result.tasks[0]!.constraintEnvelope.riskTolerance, "low");
});

test("UnifiedChatPlanGenerator sets high riskTolerance for normal priority", async () => {
  const mockResponse = JSON.stringify({
    tasks: [
      { domainId: "a", description: "Task", expectedOutputs: [], delegationMode: "auto", estimatedDuration: "1h", estimatedCostUsd: 0.05 },
    ],
    dependencyGraph: [],
  });

  const provider = createMockProvider(mockResponse);
  const generator = new UnifiedChatPlanGenerator({ provider });
  const goal = createTestGoal({ priority: "normal" });

  const result = await generator.generate(goal);

  assert.equal(result.tasks[0]!.constraintEnvelope.riskTolerance, "high");
});

// ─── Edge Cases ───────────────────────────────────────────────────────────────

test("UnifiedChatPlanGenerator handles empty tasks array", async () => {
  const mockResponse = JSON.stringify({
    tasks: [],
    dependencyGraph: [],
  });

  const provider = createMockProvider(mockResponse);
  const generator = new UnifiedChatPlanGenerator({ provider });
  const goal = createTestGoal();

  const result = await generator.generate(goal);

  assert.equal(result.tasks.length, 0);
});

test("UnifiedChatPlanGenerator handles empty dependencyGraph", async () => {
  const mockResponse = JSON.stringify({
    tasks: [
      { domainId: "a", description: "Task 1", expectedOutputs: [], delegationMode: "auto", estimatedDuration: "1h", estimatedCostUsd: 0.01 },
      { domainId: "b", description: "Task 2", expectedOutputs: [], delegationMode: "auto", estimatedDuration: "1h", estimatedCostUsd: 0.01 },
    ],
    dependencyGraph: [],
  });

  const provider = createMockProvider(mockResponse);
  const generator = new UnifiedChatPlanGenerator({ provider });
  const goal = createTestGoal();

  const result = await generator.generate(goal);

  assert.equal(result.dependencyGraph.length, 0);
});

test("UnifiedChatPlanGenerator handles all dependency types", async () => {
  const mockResponse = JSON.stringify({
    tasks: [
      { domainId: "a", description: "Task 1", expectedOutputs: [], delegationMode: "auto", estimatedDuration: "1h", estimatedCostUsd: 0.01 },
      { domainId: "b", description: "Task 2", expectedOutputs: [], delegationMode: "auto", estimatedDuration: "1h", estimatedCostUsd: 0.01 },
      { domainId: "c", description: "Task 3", expectedOutputs: [], delegationMode: "auto", estimatedDuration: "1h", estimatedCostUsd: 0.01 },
    ],
    dependencyGraph: [
      { fromTask: "1", toTask: "2", type: "blocks" },
      { fromTask: "2", toTask: "3", type: "provides_input" },
      { fromTask: "1", toTask: "3", type: "soft_dependency" },
    ],
  });

  const provider = createMockProvider(mockResponse);
  const generator = new UnifiedChatPlanGenerator({ provider });
  const goal = createTestGoal();

  const result = await generator.generate(goal);

  assert.equal(result.dependencyGraph.length, 3);
  assert.equal(result.dependencyGraph.filter(e => e.type === "blocks").length, 1);
  assert.equal(result.dependencyGraph.filter(e => e.type === "provides_input").length, 1);
  assert.equal(result.dependencyGraph.filter(e => e.type === "soft_dependency").length, 1);
});

test("UnifiedChatPlanGenerator handles large cost estimates", async () => {
  const mockResponse = JSON.stringify({
    tasks: [
      { domainId: "a", description: "Task", expectedOutputs: [], delegationMode: "auto", estimatedDuration: "1h", estimatedCostUsd: 999999.99 },
    ],
    dependencyGraph: [],
  });

  const provider = createMockProvider(mockResponse);
  const generator = new UnifiedChatPlanGenerator({ provider });
  const goal = createTestGoal();

  const result = await generator.generate(goal);

  assert.equal(result.tasks[0]!.estimatedCost.estimatedCostUsd, 999999.99);
});

test("UnifiedChatPlanGenerator handles medium confidence for significant cost proportion", async () => {
  const mockResponse = JSON.stringify({
    tasks: [
      { domainId: "a", description: "Task 1", expectedOutputs: [], delegationMode: "auto", estimatedDuration: "1h", estimatedCostUsd: 0.15 },
      { domainId: "b", description: "Task 2", expectedOutputs: [], delegationMode: "auto", estimatedDuration: "1h", estimatedCostUsd: 0.01 },
    ],
    dependencyGraph: [
      { fromTask: "1", toTask: "2", type: "blocks" },
    ],
  });

  const provider = createMockProvider(mockResponse);
  const generator = new UnifiedChatPlanGenerator({ provider });
  const goal = createTestGoal();

  const result = await generator.generate(goal);

  // Task 1 has 93% of total cost, should have medium confidence
  assert.equal(result.tasks[0]!.estimatedCost.confidence, "medium");
  assert.ok(result.tasks[0]!.estimatedCost.sampleCount >= 3);
});
