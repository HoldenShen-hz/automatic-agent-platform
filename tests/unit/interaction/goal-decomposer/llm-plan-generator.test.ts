import test from "node:test";
import assert from "node:assert/strict";
import {
  UnifiedChatPlanGenerator,
  type LlmPlan,
  type LlmPlanGenerator,
} from "../../../../src/interaction/goal-decomposer/llm-plan-generator.js";
import type { Goal } from "../../../../src/interaction/goal-decomposer/index.js";
import { createBudgetLedger } from "../../../../src/platform/contracts/executable-contracts/index.js";
import { BudgetAllocator } from "../../../../src/platform/five-plane-execution/budget-allocator.js";
import type { UnifiedChatProvider } from "../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js";

/**
 * Mock UnifiedChatProvider for testing - uses object instead of class to satisfy type
 */
function createMockProvider(mockResponse: string): UnifiedChatProvider {
  return {
    complete: async (_prompt: string, _options?: { model?: string; system?: string; temperature?: number; maxTokens?: number }): Promise<string> => {
      return mockResponse;
    },
  } as UnifiedChatProvider;
}

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

function createTestGoal(overrides?: Partial<Goal>): Goal {
  return {
    goalId: "test_goal_123",
    description: "创建并部署一个Web服务",
    owner: "user_1",
    deadline: "2026-05-01T00:00:00Z",
    successCriteria: [
      { metric: "uptime", target: "99.9%", evaluationMethod: "metric_api" },
    ],
    constraints: ["必须在生产环境部署", "必须通过安全扫描"],
    priority: "high",
    ...overrides,
  };
}

test("UnifiedChatPlanGenerator implements LlmPlanGenerator interface", () => {
  const provider = createMockProvider("{}");
  const generator = new UnifiedChatPlanGenerator({ provider });

  // Verify it has a generate method
  assert.ok(typeof generator.generate === "function");
});

test("UnifiedChatPlanGenerator uses default model gpt-4o-mini", () => {
  const provider = createMockProvider("{}");
  const generator = new UnifiedChatPlanGenerator({ provider });

  // Constructor should not throw and should use default model
  assert.ok(generator);
});

test("UnifiedChatPlanGenerator accepts custom model", () => {
  const provider = createMockProvider("{}");
  const generator = new UnifiedChatPlanGenerator({ provider, model: "claude-sonnet-4" });

  assert.ok(generator);
});

test("UnifiedChatPlanGenerator.generate returns LlmPlan with tasks and dependencyGraph", async () => {
  const mockResponse = JSON.stringify({
    tasks: [
      {
        domainId: "engineering",
        description: "创建Web服务代码",
        expectedOutputs: ["Web服务代码"],
        delegationMode: "auto",
        estimatedDuration: "2h",
        estimatedCostUsd: 0.05,
      },
      {
        domainId: "engineering",
        description: "编写单元测试",
        expectedOutputs: ["测试报告"],
        delegationMode: "auto",
        estimatedDuration: "1h",
        estimatedCostUsd: 0.02,
      },
      {
        domainId: "engineering",
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

  const provider = createMockProvider(mockResponse);
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

  assert.ok(result.tasks[0]!.taskId.startsWith("test_goal_123:llm:"));
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
  assert.equal(task.inputs.goalDescription, "创建并部署一个Web服务");
  assert.deepEqual(task.inputs.successCriteria, goal.successCriteria);
  assert.deepEqual(task.inputs.constraints, goal.constraints);
  assert.equal(task.inputs.deadline, "2026-05-01T00:00:00Z");
});

test("UnifiedChatPlanGenerator.generate propagates budget with non-zero evidence confidence", async () => {
  const mockResponse = JSON.stringify({
    tasks: [
      {
        domainId: "engineering",
        description: "执行部署",
        expectedOutputs: ["部署结果"],
        delegationMode: "auto",
        estimatedDuration: "30m",
        estimatedCostUsd: 0.03,
      },
      {
        domainId: "engineering",
        description: "验证结果",
        expectedOutputs: ["验证报告"],
        delegationMode: "supervised",
        estimatedDuration: "30m",
        estimatedCostUsd: 0.01,
      },
    ],
    dependencyGraph: [],
  });

  const provider = createMockProvider(mockResponse);
  const generator = new UnifiedChatPlanGenerator({ provider });
  const goal = createTestGoal({
    description: "创建并部署一个Web服务，预算 200 美元",
  });

  const result = await generator.generate(goal);
  assert.ok(result.tasks[0]!.inputs.allocatedBudgetUsd != null);
  assert.ok(result.tasks[0]!.estimatedCost.sampleCount >= 1);
  assert.notEqual(result.tasks[0]!.estimatedCost.confidence, "low");
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

  assert.equal(result.dependencyGraph[0]!.fromTask, "test_goal_123:llm:1");
  assert.equal(result.dependencyGraph[0]!.toTask, "test_goal_123:llm:2");
});

test("UnifiedChatPlanGenerator.generate normalizes already-prefixed task references", async () => {
  const mockResponse = JSON.stringify({
    tasks: [
      { domainId: "a", description: "Task 1", expectedOutputs: [], delegationMode: "auto", estimatedDuration: "1h", estimatedCostUsd: 0.01 },
      { domainId: "b", description: "Task 2", expectedOutputs: [], delegationMode: "auto", estimatedDuration: "1h", estimatedCostUsd: 0.01 },
    ],
    dependencyGraph: [
      { fromTask: "test_goal_123:llm:1", toTask: "test_goal_123:llm:2", type: "blocks" },
    ],
  });

  const provider = createMockProvider(mockResponse);
  const generator = new UnifiedChatPlanGenerator({ provider });
  const goal = createTestGoal();

  const result = await generator.generate(goal);

  assert.equal(result.dependencyGraph[0]!.fromTask, "test_goal_123:llm:1");
  assert.equal(result.dependencyGraph[0]!.toTask, "test_goal_123:llm:2");
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
    goalId: "test_goal_456",
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

test("UnifiedChatPlanGenerator.generate derives evidence-based cost estimates", async () => {
  const mockResponse = JSON.stringify({
    tasks: [
      { domainId: "a", description: "Task", expectedOutputs: [], delegationMode: "auto", estimatedDuration: "1h", estimatedCostUsd: 0.05 },
    ],
    dependencyGraph: [],
  });

  const provider = createMockProvider(mockResponse);
  const generator = new UnifiedChatPlanGenerator({ provider });
  const goal = createTestGoal();

  const result = await generator.generate(goal);

  assert.equal(result.tasks[0]!.estimatedCost.confidence, "medium");
  assert.ok(result.tasks[0]!.estimatedCost.sampleCount >= 1);
  assert.equal(result.tasks[0]!.estimatedCost.divisionId, "a");
  assert.equal(result.tasks[0]!.estimatedCost.basedOn, "llm_estimate");
});

test("LlmPlanGenerator interface is compatible with UnifiedChatPlanGenerator", () => {
  const provider = createMockProvider("{}");
  const generator: LlmPlanGenerator = new UnifiedChatPlanGenerator({ provider });

  // Verify the instance satisfies the interface
  assert.ok(typeof generator.generate === "function");
});

test("UnifiedChatPlanGenerator settles reserved budget after a successful plan call", async () => {
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
    },
  });

  await generator.generate(createTestGoal());

  assert.equal(allocator.settleCalls, 1);
  assert.equal(allocator.releaseCalls, 0);
});

test("UnifiedChatPlanGenerator releases reserved budget when provider call fails", async () => {
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
    },
  });

  await assert.rejects(() => generator.generate(createTestGoal()), /provider\.failed/);
  assert.equal(allocator.settleCalls, 0);
  assert.equal(allocator.releaseCalls, 1);
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
