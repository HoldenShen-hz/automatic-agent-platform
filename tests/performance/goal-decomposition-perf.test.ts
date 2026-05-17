/**
 * Performance Test: Goal Decomposition Service
 * G4 Benchmark — GoalDecompositionService.decompose() P99 < 100ms
 *
 * Design target: Goal decomposition <100ms P99
 * Tests the plan generation latency for goal decomposition.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { newId } from "../../src/platform/contracts/types/ids.js";
import { GoalDecompositionService, type Goal } from "../../src/interaction/goal-decomposer/index.js";
import type { LlmPlanGenerator, LlmPlan } from "../../src/interaction/goal-decomposer/llm-plan-generator.js";

/**
 * Mock LLM plan generator that completes instantly for performance testing.
 */
class MockLlmPlanGenerator implements LlmPlanGenerator {
  public managesBudgetReservations = false;

  async generate(goal: Goal): Promise<LlmPlan> {
    // Simulate minimal LLM call latency
    const tasks = [
      {
        taskId: `${goal.goalId}:llm:1`,
        domainId: "general_ops",
        description: "Analyze goal requirements and constraints",
        inputs: {
          goalDescription: goal.description,
          successCriteria: goal.successCriteria,
          constraints: goal.constraints,
          deadline: goal.deadline ?? null,
        },
        expectedOutputs: ["analysis_result"],
        delegationMode: "auto" as const,
        estimatedDuration: "2h",
        estimatedCost: {
          estimatedCostUsd: 0.02,
          confidence: "medium" as const,
          sampleCount: 3,
          divisionId: null,
          basedOn: "llm_plan_proportional",
        },
        constraintEnvelope: {
          budgetLimitUsd: null,
          riskTolerance: "medium" as const,
          requiresApproval: false,
          requiredPermissions: [],
          requiredCapabilities: [],
        },
      },
      {
        taskId: `${goal.goalId}:llm:2`,
        domainId: "general_ops",
        description: "Execute main task and produce results",
        inputs: {
          goalDescription: goal.description,
          successCriteria: goal.successCriteria,
          constraints: goal.constraints,
          deadline: goal.deadline ?? null,
        },
        expectedOutputs: ["task_result"],
        delegationMode: "auto" as const,
        estimatedDuration: "4h",
        estimatedCost: {
          estimatedCostUsd: 0.03,
          confidence: "medium" as const,
          sampleCount: 3,
          divisionId: null,
          basedOn: "llm_plan_proportional",
        },
        constraintEnvelope: {
          budgetLimitUsd: null,
          riskTolerance: "medium" as const,
          requiresApproval: false,
          requiredPermissions: [],
          requiredCapabilities: [],
        },
      },
    ];

    return {
      tasks,
      dependencyGraph: [
        { fromTask: tasks[0]!.taskId, toTask: tasks[1]!.taskId, type: "blocks" as const },
      ],
    };
  }
}

/**
 * Create a test goal.
 */
function createTestGoal(description: string, priority: Goal["priority"] = "normal"): Goal {
  return {
    goalId: newId("goal"),
    description,
    owner: "test-owner",
    successCriteria: [
      { metric: "completion", target: "100%", evaluationMethod: "automated_test" as const },
    ],
    constraints: ["constraint1", "constraint2"],
    priority,
  };
}

async function decomposeFreshGoal(
  service: GoalDecompositionService,
  description: string,
  priority: Goal["priority"] = "normal",
): Promise<void> {
  await service.decompose(createTestGoal(description, priority));
}

test("performance: GoalDecompositionService.decompose() simple goal P99 < 50ms", async () => {
  const service = new GoalDecompositionService({
    llmPlanGenerator: new MockLlmPlanGenerator(),
  });

  const iterations = 200;

  // Warmup
  for (let i = 0; i < 5; i++) {
    await decomposeFreshGoal(service, "Build a simple feature");
  }

  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await decomposeFreshGoal(service, "Build a simple feature");
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`GoalDecomposition simple: P50=${p50.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 50,
    `GoalDecomposition simple P99 latency ${p99.toFixed(3)}ms exceeds 50ms target`,
  );

  assert.ok(
    p50 < 25,
    `GoalDecomposition simple P50 latency ${p50.toFixed(3)}ms seems unexpectedly high`,
  );
});

test("performance: GoalDecompositionService.decompose() complex goal P99 < 100ms", async () => {
  const service = new GoalDecompositionService({
    llmPlanGenerator: new MockLlmPlanGenerator(),
  });

  const description =
    "Implement a comprehensive marketing campaign with multiple channels including social media, email, and content marketing with detailed ROI tracking and analytics";
  const iterations = 200;

  // Warmup
  for (let i = 0; i < 5; i++) {
    await decomposeFreshGoal(service, description);
  }

  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await decomposeFreshGoal(service, description);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`GoalDecomposition complex: P50=${p50.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 100,
    `GoalDecomposition complex P99 latency ${p99.toFixed(3)}ms exceeds 100ms target`,
  );
});

test("performance: GoalDecompositionService.decompose() without LLM generator P99 < 30ms", async () => {
  const service = new GoalDecompositionService({
    llmPlanGenerator: null, // No LLM, use template only
  });

  const description = "Execute a release launch with multiple phases";
  const iterations = 300;

  // Warmup
  for (let i = 0; i < 10; i++) {
    await decomposeFreshGoal(service, description);
  }

  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await decomposeFreshGoal(service, description);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`GoalDecomposition template-only: P50=${p50.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 30,
    `GoalDecomposition template-only P99 latency ${p99.toFixed(3)}ms exceeds 30ms target`,
  );
});

test("performance: GoalDecompositionService.decompose() critical priority P99 < 100ms", async () => {
  const service = new GoalDecompositionService({
    llmPlanGenerator: new MockLlmPlanGenerator(),
  });

  const description = "Deploy critical hotfix to production";
  const iterations = 200;

  // Warmup
  for (let i = 0; i < 5; i++) {
    await decomposeFreshGoal(service, description, "critical");
  }

  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await decomposeFreshGoal(service, description, "critical");
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`GoalDecomposition critical: P50=${p50.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 100,
    `GoalDecomposition critical P99 latency ${p99.toFixed(3)}ms exceeds 100ms target`,
  );
});

test("performance: GoalDecompositionService.decompose() marketing template P99 < 80ms", async () => {
  const service = new GoalDecompositionService({
    llmPlanGenerator: new MockLlmPlanGenerator(),
  });

  const description = "Run a Facebook and Instagram advertising campaign with creative assets";
  const iterations = 200;

  // Warmup
  for (let i = 0; i < 5; i++) {
    await decomposeFreshGoal(service, description);
  }

  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await decomposeFreshGoal(service, description);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`GoalDecomposition marketing: P50=${p50.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 80,
    `GoalDecomposition marketing P99 latency ${p99.toFixed(3)}ms exceeds 80ms target`,
  );
});

test("performance: GoalDecompositionService.decompose() incident response template P99 < 80ms", async () => {
  const service = new GoalDecompositionService({
    llmPlanGenerator: new MockLlmPlanGenerator(),
  });

  const description =
    "Investigate and resolve the production outage affecting user authentication";
  const iterations = 200;

  // Warmup
  for (let i = 0; i < 5; i++) {
    await decomposeFreshGoal(service, description);
  }

  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await decomposeFreshGoal(service, description);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`GoalDecomposition incident: P50=${p50.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 80,
    `GoalDecomposition incident P99 latency ${p99.toFixed(3)}ms exceeds 80ms target`,
  );
});

test("performance: GoalDecompositionService.decompose() throughput > 10 ops/sec", async () => {
  const service = new GoalDecompositionService({
    llmPlanGenerator: new MockLlmPlanGenerator(),
  });

  const description = "Execute multi-step workflow with dependencies";
  const iterations = 20;

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    await decomposeFreshGoal(service, description);
  }
  const elapsed = performance.now() - start;

  const opsPerSec = (iterations / elapsed) * 1000;

  console.log(`GoalDecomposition throughput: ${opsPerSec.toFixed(1)} ops/sec`);

  assert.ok(
    opsPerSec > 10,
    `GoalDecomposition throughput ${opsPerSec.toFixed(1)} ops/sec should be > 10 ops/sec`,
  );
});

test("performance: GoalDecompositionService.decompose() with budget control P99 < 100ms", async () => {
  const service = new GoalDecompositionService({
    llmPlanGenerator: new MockLlmPlanGenerator(),
    budgetControl: {
      policy: {
        mode: "hard_limit",
        maxTaskCostUsd: 1.0,
        maxDailyCostUsd: 10.0,
        maxMonthlyCostUsd: 100.0,
      },
      currentTaskCostUsd: 0.01,
      currentDailyCostUsd: 0.5,
      currentMonthlyCostUsd: 5.0,
      tenantId: "tenant:test",
      harnessRunId: newId("harness_run"),
      traceId: newId("trace"),
      emittedBy: "test",
      estimatedLlmPlanCostUsd: 0.05,
    },
  });

  const description = "Execute task with budget constraints";
  const iterations = 150;

  // Warmup
  for (let i = 0; i < 5; i++) {
    await decomposeFreshGoal(service, description);
  }

  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await decomposeFreshGoal(service, description);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`GoalDecomposition with budget: P50=${p50.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 100,
    `GoalDecomposition with budget P99 latency ${p99.toFixed(3)}ms exceeds 100ms target`,
  );
});

test("performance: GoalDecompositionService.decompose() string input P99 < 50ms", async () => {
  const service = new GoalDecompositionService({
    llmPlanGenerator: new MockLlmPlanGenerator(),
  });
  const baseDescription = "Simple task description";

  const iterations = 200;

  // Warmup
  for (let i = 0; i < 5; i++) {
    await service.decompose(`${baseDescription} warmup ${i}`);
  }

  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await service.decompose(`${baseDescription} run ${i}`);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`GoalDecomposition string input: P50=${p50.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 50,
    `GoalDecomposition string input P99 latency ${p99.toFixed(3)}ms exceeds 50ms target`,
  );
});
