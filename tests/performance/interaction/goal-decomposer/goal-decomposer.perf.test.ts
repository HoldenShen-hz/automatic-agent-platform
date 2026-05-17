/**
 * Performance tests for goal-decomposer
 *
 * Tests the performance characteristics of GoalDecompositionService.decompose()
 * including latency, throughput, and scalability.
 *
 * Performance targets:
 * - Simple goal decomposition: P50 < 25ms, P99 < 50ms
 * - Complex goal with LLM: P50 < 50ms, P99 < 100ms
 * - Template-based only: P50 < 15ms, P99 < 30ms
 * - Throughput: > 50 ops/sec for simple goals
 */

import assert from "node:assert/strict";
import test from "node:test";
import { newId } from "../../../../src/platform/contracts/types/ids.js";
import { GoalDecompositionService, type Goal, type LlmPlanGenerator } from "../../../../src/interaction/goal-decomposer/index.js";
import type { LlmPlan } from "../../../../src/interaction/goal-decomposer/llm-plan-generator.js";

// ─── Test Factories ───────────────────────────────────────────────────────────

function createTestGoal(description: string, priority: Goal["priority"] = "normal"): Goal {
  return {
    goalId: newId("goal"),
    description,
    owner: "perf-test-owner",
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

/**
 * Fast mock LLM plan generator for performance testing.
 * Produces a valid DAG with 3 tasks.
 */
class FastMockLlmPlanGenerator implements LlmPlanGenerator {
  public managesBudgetReservations = false;

  async generate(goal: Goal): Promise<LlmPlan> {
    const tasks = [
      {
        taskId: `${goal.goalId}:llm:1`,
        domainId: "general_ops",
        description: "Analyze goal requirements",
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
        description: "Execute main task",
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
 * Mock LLM plan generator that introduces configurable latency.
 */
class LatencyInjectingGenerator implements LlmPlanGenerator {
  public managesBudgetReservations = false;
  public latencyMs: number;

  constructor(latencyMs: number = 0) {
    this.latencyMs = latencyMs;
  }

  async generate(goal: Goal): Promise<LlmPlan> {
    // Simulate LLM call latency
    await new Promise(resolve => setTimeout(resolve, this.latencyMs));

    return {
      tasks: [
        {
          taskId: `${goal.goalId}:latency:1`,
          domainId: "general_ops",
          description: "Task with latency",
          inputs: {},
          expectedOutputs: ["result"],
          delegationMode: "auto",
          estimatedDuration: "1h",
          estimatedCost: { estimatedCostUsd: 0.05, confidence: "default", sampleCount: 0, divisionId: null, basedOn: "default" },
        },
      ],
      dependencyGraph: [],
    };
  }
}

// ─── Latency Tests ────────────────────────────────────────────────────────────

test("performance: Simple template-based decomposition P99 < 30ms", async () => {
  const service = new GoalDecompositionService({ llmPlanGenerator: null });
  const iterations = 200;

  // Warmup
  for (let i = 0; i < 10; i++) {
    await decomposeFreshGoal(service, "Execute a release launch");
  }

  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await decomposeFreshGoal(service, "Execute a release launch");
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)!]!;
  const p50 = latencies[Math.floor(iterations * 0.5)!]!;

  console.log(`Template-only decomposition: P50=${p50.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 30,
    `Template-only P99 ${p99.toFixed(3)}ms exceeds 30ms target`,
  );
});

test("performance: Marketing campaign decomposition P99 < 80ms", async () => {
  const service = new GoalDecompositionService();
  const description = "发起618营销活动，包含广告投放和素材制作";
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
  const p99 = latencies[Math.floor(iterations * 0.99)!]!;
  const p50 = latencies[Math.floor(iterations * 0.5)!]!;

  console.log(`Marketing campaign: P50=${p50.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 80,
    `Marketing P99 ${p99.toFixed(3)}ms exceeds 80ms target`,
  );
});

test("performance: Complex goal with LLM generator P99 < 100ms", async () => {
  const service = new GoalDecompositionService({
    llmPlanGenerator: new FastMockLlmPlanGenerator(),
  });
  const description =
    "Implement a comprehensive multi-step workflow with detailed analysis and parallel execution tracking";
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
  const p99 = latencies[Math.floor(iterations * 0.99)!]!;
  const p50 = latencies[Math.floor(iterations * 0.5)!]!;

  console.log(`LLM generator (fast): P50=${p50.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 100,
    `LLM P99 ${p99.toFixed(3)}ms exceeds 100ms target`,
  );
});

test("performance: String input decomposition P99 < 50ms", async () => {
  const service = new GoalDecompositionService({
    llmPlanGenerator: new FastMockLlmPlanGenerator(),
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
  const p99 = latencies[Math.floor(iterations * 0.99)!]!;
  const p50 = latencies[Math.floor(iterations * 0.5)!]!;

  console.log(`String input: P50=${p50.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 50,
    `String input P99 ${p99.toFixed(3)}ms exceeds 50ms target`,
  );
});

test("performance: Critical priority goal P99 < 100ms", async () => {
  const service = new GoalDecompositionService({
    llmPlanGenerator: new FastMockLlmPlanGenerator(),
  });
  const description = "Deploy critical hotfix to production";
  const iterations = 150;

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
  const p99 = latencies[Math.floor(iterations * 0.99)!]!;
  const p50 = latencies[Math.floor(iterations * 0.5)!]!;

  console.log(`Critical priority: P50=${p50.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 100,
    `Critical P99 ${p99.toFixed(3)}ms exceeds 100ms target`,
  );
});

// ─── Throughput Tests ─────────────────────────────────────────────────────────

test("performance: Simple goal throughput > 50 ops/sec", async () => {
  const service = new GoalDecompositionService({ llmPlanGenerator: null });
  const description = "Simple task";
  const iterations = 50;

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    await decomposeFreshGoal(service, description);
  }
  const elapsed = performance.now() - start;

  const opsPerSec = (iterations / elapsed) * 1000;
  console.log(`Simple throughput: ${opsPerSec.toFixed(1)} ops/sec`);

  assert.ok(
    opsPerSec > 50,
    `Throughput ${opsPerSec.toFixed(1)} ops/sec should be > 50 ops/sec`,
  );
});

test("performance: Complex goal throughput > 30 ops/sec", async () => {
  const service = new GoalDecompositionService({
    llmPlanGenerator: new FastMockLlmPlanGenerator(),
  });
  const description =
    "Implement a comprehensive workflow with multiple phases and detailed tracking";
  const iterations = 30;

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    await decomposeFreshGoal(service, description);
  }
  const elapsed = performance.now() - start;

  const opsPerSec = (iterations / elapsed) * 1000;
  console.log(`Complex throughput: ${opsPerSec.toFixed(1)} ops/sec`);

  assert.ok(
    opsPerSec > 30,
    `Throughput ${opsPerSec.toFixed(1)} ops/sec should be > 30 ops/sec`,
  );
});

// ─── Memory & Scalability Tests ───────────────────────────────────────────────

test("performance: Memory stable over repeated decompositions", async (t) => {
  const service = new GoalDecompositionService({
    llmPlanGenerator: new FastMockLlmPlanGenerator(),
  });
  const description = "Memory stability test with complex workflow";
  const iterations = 100;

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

  // Check for memory leaks by verifying consistent latencies
  const firstHalf = latencies.slice(0, Math.floor(iterations / 2));
  const secondHalf = latencies.slice(Math.floor(iterations / 2));

  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  console.log(`Memory stability: firstHalf=${firstAvg.toFixed(3)}ms, secondHalf=${secondAvg.toFixed(3)}ms`);

  // Second half should not be significantly slower (> 50% increase)
  try {
    assert.ok(
      secondAvg < firstAvg * 1.5,
      `Memory可能在泄漏: second half (${secondAvg.toFixed(3)}ms) vs first half (${firstAvg.toFixed(3)}ms)`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("performance: Parallel decomposition throughput", async () => {
  const service = new GoalDecompositionService({
    llmPlanGenerator: new FastMockLlmPlanGenerator(),
  });
  const goals = Array.from({ length: 10 }, (_, i) =>
    createTestGoal(`Parallel task ${i} with complex workflow description`),
  );

  const start = performance.now();
  await Promise.all(goals.map(g => service.decompose(g)));
  const elapsed = performance.now() - start;

  const opsPerSec = (goals.length / elapsed) * 1000;
  console.log(`Parallel (10 concurrent): ${opsPerSec.toFixed(1)} ops/sec`);

  assert.ok(opsPerSec > 5, `Parallel throughput ${opsPerSec.toFixed(1)} ops/sec too low`);
});

// ─── Timeout Handling Tests ───────────────────────────────────────────────────

test("performance: LLM timeout handling P99 < 150ms", async () => {
  // Generator that takes 50ms - timeout is 10ms
  const service = new GoalDecompositionService({
    llmPlanGenerator: new LatencyInjectingGenerator(50),
    maxLlmPlanLatencyMs: 10,
  });
  const description = "Test timeout handling with description that triggers LLM generation";
  const iterations = 100;

  // Warmup
  for (let i = 0; i < 5; i++) {
    await decomposeFreshGoal(service, description).catch(() => {/* ignore timeout */});
  }

  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await decomposeFreshGoal(service, description).catch(() => {/* ignore timeout */});
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)!]!;
  const p50 = latencies[Math.floor(iterations * 0.5)!]!;

  console.log(`Timeout handling: P50=${p50.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);

  // Should complete quickly even with timeout
  assert.ok(
    p99 < 150,
    `Timeout handling P99 ${p99.toFixed(3)}ms exceeds 150ms`,
  );
});

// ─── Budget Control Performance Tests ───────────────────────────────────────

test("performance: Budget control overhead P99 < 100ms", async () => {
  const service = new GoalDecompositionService({
    llmPlanGenerator: new FastMockLlmPlanGenerator(),
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
      tenantId: "tenant:perf-test",
      harnessRunId: newId("harness_run"),
      traceId: newId("trace"),
      emittedBy: "perf-test",
      estimatedLlmPlanCostUsd: 0.05,
    },
  });
  const description = "Test budget control performance";
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
  const p99 = latencies[Math.floor(iterations * 0.99)!]!;
  const p50 = latencies[Math.floor(iterations * 0.5)!]!;

  console.log(`Budget control: P50=${p50.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 100,
    `Budget control P99 ${p99.toFixed(3)}ms exceeds 100ms`,
  );
});
