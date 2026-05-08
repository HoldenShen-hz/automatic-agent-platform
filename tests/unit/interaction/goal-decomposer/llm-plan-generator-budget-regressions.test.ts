import assert from "node:assert/strict";
import test from "node:test";

import { UnifiedChatPlanGenerator } from "../../../../src/interaction/goal-decomposer/llm-plan-generator.js";
import type { Goal } from "../../../../src/interaction/goal-decomposer/index.js";
import type { UnifiedChatProvider } from "../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js";

function createMockProvider(mockResponse: string): UnifiedChatProvider {
  return {
    complete: async (): Promise<string> => mockResponse,
  } as UnifiedChatProvider;
}

function createTestGoal(overrides?: Partial<Goal>): Goal {
  return {
    goalId: "test_goal_123",
    description: "创建并部署一个Web服务",
    owner: "user_1",
    deadline: "2026-05-01T00:00:00Z",
    successCriteria: [],
    constraints: ["必须通过安全扫描"],
    priority: "high",
    ...overrides,
  };
}

test("UnifiedChatPlanGenerator records non-zero samples for LLM-derived cost estimates", async () => {
  const provider = createMockProvider(JSON.stringify({
    tasks: [
      { domainId: "engineering", description: "Task", expectedOutputs: [], delegationMode: "auto", estimatedDuration: "1h", estimatedCostUsd: 0.05 },
    ],
    dependencyGraph: [],
  }));
  const generator = new UnifiedChatPlanGenerator({ provider });

  const result = await generator.generate(createTestGoal());

  assert.equal(result.tasks[0]!.estimatedCost.confidence, "medium");
  assert.equal(result.tasks[0]!.estimatedCost.sampleCount, 1);
  assert.equal(result.tasks[0]!.estimatedCost.divisionId, "engineering");
});

test("UnifiedChatPlanGenerator propagates the goal budget proportionally to child tasks", async () => {
  const provider = createMockProvider(JSON.stringify({
    tasks: [
      { domainId: "engineering", description: "Task 1", expectedOutputs: [], delegationMode: "auto", estimatedDuration: "1h", estimatedCostUsd: 1 },
      { domainId: "finance", description: "Task 2", expectedOutputs: [], delegationMode: "supervised", estimatedDuration: "2h", estimatedCostUsd: 3 },
    ],
    dependencyGraph: [],
  }));
  const generator = new UnifiedChatPlanGenerator({ provider });

  const result = await generator.generate(createTestGoal({
    description: "执行跨域项目并控制 budget $40",
    constraints: ["总预算 $40", "必须审批跨域支出"],
  }));

  assert.equal(result.tasks[0]!.inputs.allocatedBudgetUsd, 10);
  assert.equal(result.tasks[1]!.inputs.allocatedBudgetUsd, 30);
  assert.equal(result.tasks[0]!.constraintEnvelope.budgetLimitUsd, 10);
  assert.equal(result.tasks[1]!.constraintEnvelope.budgetLimitUsd, 30);
});
