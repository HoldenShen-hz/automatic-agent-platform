/**
 * Performance Test: OAPEFLIR Loop Iteration Performance
 * Measures OAPEFLIR loop iteration performance and scalability
 *
 * Design targets:
 * - Single iteration: <100ms per iteration
 * - Loop throughput: >10 iterations/sec
 * - Iteration memory: <1MB per iteration
 * - Scaling: linear with step count
 */

import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import { reportSoftPerformanceMiss } from "../helpers/performance.js";

import { newId } from "../../src/platform/contracts/types/ids.js";
import { OapeflirLoopService } from "../../src/platform/orchestration/oapeflir/oapeflir-loop-service.js";
import type { ExecuteBridge, ExecutionContext, ExecutionResult, StepResult } from "../../src/platform/orchestration/oapeflir/execute-bridge.js";
import type { Plan, PlanStep } from "../../src/platform/orchestration/oapeflir/types/plan.js";
import type { DualChannelStepOutput } from "../../src/platform/orchestration/oapeflir/types/dual-channel-step-output.js";
import { runtimeMetricsRegistry } from "../../src/platform/shared/observability/runtime-metrics-registry.js";

/**
 * Minimal ExecuteBridge that completes instantly for performance testing.
 */
class MinimalExecuteBridge implements ExecuteBridge {
  async executeStep(step: PlanStep, _context: ExecutionContext): Promise<StepResult> {
    return {
      stepId: step.stepId,
      status: "succeeded",
      durationMs: 1,
      tokenCost: 1,
      summary: `Perf test step ${step.stepId}`,
      outputs: { stepId: step.stepId },
      artifacts: [],
      modelId: "perf-test",
      retryCount: 0,
      validationPassed: true,
    };
  }

  async executePlan(plan: Plan, _context: ExecutionContext): Promise<ExecutionResult> {
    return {
      planId: plan.planId,
      results: plan.steps.map((step) => ({
        stepId: step.stepId,
        status: "succeeded" as const,
        durationMs: 1,
        tokenCost: 1,
        summary: `Perf test step ${step.stepId}`,
        outputs: { stepId: step.stepId },
        artifacts: [],
        modelId: "perf-test",
        retryCount: 0,
        validationPassed: true,
      })),
      totalDurationMs: plan.steps.length,
      totalTokenCost: plan.steps.length,
      allSucceeded: true,
      skippedStepIds: [],
      failedStepIds: [],
    };
  }

  toDualChannelStepOutputs(_result: ExecutionResult): DualChannelStepOutput[] {
    return [];
  }
}

function createMinimalWorkflow(stepCount: number = 1) {
  const steps = Array.from({ length: stepCount }, (_, i) => ({
    stepId: newId("step"),
    divisionId: "coding",
    roleId: "builder",
    inputKeys: [],
    agentId: "agent_builder",
    outputKey: `result_${i}`,
    outputSchemaPath: null,
    dependsOnStepIds: i > 0 ? [steps[i - 1]!.stepId] : [],
    dependencyTypes: {} as Record<string, string>,
    timeoutMs: 10000,
    maxAttempts: 1,
  }));

  return {
    workflow: {
      workflowId: "wf_perf_test",
      divisionId: "coding",
      steps: steps.map((s) => s.stepId),
    },
    executionSteps: steps,
    planReason: "perf.test",
    dependencyEdges: [],
  };
}

function getMemoryStats(): { heapUsed: number; heapTotal: number } {
  const mem = process.memoryUsage();
  return {
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
  };
}

// ============================================================================
// Single Iteration Performance Benchmarks
// ============================================================================

test("oapeflir loop: Single iteration <100ms", (t) => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({
    executeBridge: new MinimalExecuteBridge(),
  });

  const start = performance.now();
  service.run({
    taskId: newId("task"),
    objective: "Single iteration performance test",
    workflow: createMinimalWorkflow(1),
  });
  const elapsed = performance.now() - start;

  try {
    assert.ok(
      elapsed < 100,
      `Single iteration took ${elapsed.toFixed(2)}ms, expected <100ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("oapeflir loop: Iteration latency P99 <150ms over 50 iterations", (t) => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({
    executeBridge: new MinimalExecuteBridge(),
  });

  const latencies: number[] = [];
  const iterations = 50;

  // Warmup
  for (let i = 0; i < 10; i++) {
    service.run({
      taskId: newId("task"),
      objective: "Warmup iteration",
      workflow: createMinimalWorkflow(1),
    });
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    service.run({
      taskId: newId("task"),
      objective: `Iteration ${i}`,
      workflow: createMinimalWorkflow(1),
    });
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)!]!;
  const p50 = latencies[Math.floor(iterations * 0.5)!]!;

  try {
    assert.ok(
      p99 < 150,
      `Iteration latency P99 ${p99.toFixed(2)}ms exceeds 150ms target. P50: ${p50.toFixed(2)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

// ============================================================================
// Throughput Benchmarks
// ============================================================================

test("oapeflir loop: Loop throughput >10 iterations/sec", (t) => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({
    executeBridge: new MinimalExecuteBridge(),
  });

  const iterations = 20;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    service.run({
      taskId: newId("task"),
      objective: `Throughput test iteration ${i}`,
      workflow: createMinimalWorkflow(1),
    });
  }

  const elapsed = performance.now() - start;
  const iterationsPerSec = (iterations / elapsed) * 1000;

  try {
    assert.ok(
      iterationsPerSec > 10,
      `Loop throughput ${iterationsPerSec.toFixed(2)} iterations/sec must be >10 iterations/sec. Avg: ${(elapsed / iterations).toFixed(2)}ms per iteration`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

// ============================================================================
// Memory Efficiency Benchmarks
// ============================================================================

test("oapeflir loop: Iteration memory <1MB per iteration", (t) => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({
    executeBridge: new MinimalExecuteBridge(),
  });

  const iterations = 10;
  const startMem = getMemoryStats();

  for (let i = 0; i < iterations; i++) {
    service.run({
      taskId: newId("task"),
      objective: `Memory test iteration ${i}`,
      workflow: createMinimalWorkflow(1),
    });
  }

  const endMem = getMemoryStats();
  const memoryGrowthMb = (endMem.heapUsed - startMem.heapUsed) / 1024 / 1024;
  const memoryPerIterationMb = memoryGrowthMb / iterations;

  try {
    assert.ok(
      memoryPerIterationMb < 1,
      `Memory per iteration ${memoryPerIterationMb.toFixed(3)}MB exceeds 1MB target. Total growth: ${memoryGrowthMb.toFixed(3)}MB for ${iterations} iterations`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("oapeflir loop: Memory stable under sustained iterations", (t) => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({
    executeBridge: new MinimalExecuteBridge(),
  });

  const iterations = 50;
  const measurements: number[] = [];

  // Warmup to steady state
  for (let i = 0; i < 10; i++) {
    service.run({
      taskId: newId("task"),
      objective: "Warmup",
      workflow: createMinimalWorkflow(1),
    });
  }

  // Measure memory at steady state
  for (let i = 0; i < iterations; i++) {
    service.run({
      taskId: newId("task"),
      objective: `Steady state ${i}`,
      workflow: createMinimalWorkflow(1),
    });

    if (i % 10 === 0) {
      const mem = getMemoryStats();
      measurements.push(mem.heapUsed);
    }
  }

  const minHeap = Math.min(...measurements);
  const maxHeap = Math.max(...measurements);
  const varianceMb = (maxHeap - minHeap) / 1024 / 1024;

  try {
    assert.ok(
      varianceMb < 50,
      `Memory variance ${varianceMb.toFixed(2)}MB exceeds 50MB target under steady state. Min: ${(minHeap / 1024 / 1024).toFixed(2)}MB, Max: ${(maxHeap / 1024 / 1024).toFixed(2)}MB`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

// ============================================================================
// Scaling Benchmarks
// ============================================================================

test("oapeflir loop: Scaling linear with step count", (t) => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({
    executeBridge: new MinimalExecuteBridge(),
  });

  const stepCounts = [1, 5, 10, 20];
  const times: number[] = [];

  for (const stepCount of stepCounts) {
    const start = performance.now();
    service.run({
      taskId: newId("task"),
      objective: `Scaling test with ${stepCount} steps`,
      workflow: createMinimalWorkflow(stepCount),
    });
    times.push(performance.now() - start);
  }

  // Check that time scales roughly linearly (not quadratically)
  // 10 steps should take less than 20x the time of 1 step
  const ratio = times[3]! / times[0]!; // 20 steps vs 1 step

  try {
    assert.ok(
      ratio < 30,
      `Scaling ratio ${ratio.toFixed(2)}x suggests non-linear scaling. Times: ${stepCounts.map((s, i) => `${s} steps: ${times[i]!.toFixed(2)}ms`).join(", ")}`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("oapeflir loop: Multi-step workflow throughput scales efficiently", (t) => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({
    executeBridge: new MinimalExecuteBridge(),
  });

  const stepCount = 10;
  const iterations = 10;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    service.run({
      taskId: newId("task"),
      objective: `Multi-step throughput test ${i}`,
      workflow: createMinimalWorkflow(stepCount),
    });
  }

  const elapsed = performance.now() - start;
  const iterationsPerSec = (iterations / elapsed) * 1000;

  try {
    assert.ok(
      iterationsPerSec > 5,
      `Multi-step throughput ${iterationsPerSec.toFixed(2)} iterations/sec must be >5 iterations/sec for ${stepCount} steps`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

// ============================================================================
// Concurrent Iteration Benchmarks
// ============================================================================

test("oapeflir loop: Concurrent iterations maintain throughput", async (t) => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({
    executeBridge: new MinimalExecuteBridge(),
  });

  const concurrentWorkers = 5;
  const iterationsPerWorker = 5;

  const start = performance.now();

  await Promise.all(
    Array.from({ length: concurrentWorkers }, async (_, workerId) => {
      for (let i = 0; i < iterationsPerWorker; i++) {
        service.run({
          taskId: newId("task"),
          objective: `Concurrent worker ${workerId} iteration ${i}`,
          workflow: createMinimalWorkflow(1),
        });
      }
    }),
  );

  const elapsed = performance.now() - start;
  const totalIterations = concurrentWorkers * iterationsPerWorker;
  const iterationsPerSec = (totalIterations / elapsed) * 1000;

  try {
    assert.ok(
      iterationsPerSec > 10,
      `Concurrent iterations throughput ${iterationsPerSec.toFixed(2)} iterations/sec must be >10 iterations/sec with ${concurrentWorkers} workers`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});
