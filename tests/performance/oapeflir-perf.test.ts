/**
 * Performance Test: OAPEFLIR Full Loop
 * G4 Benchmark — O→A→P→E→F complete loop < 30s P99
 *
 * Design target: Full loop <30s P99 (§7.4)
 * Tests the complete OAPEFLIR cycle with minimal mock infrastructure.
 */

import assert from "node:assert/strict";
import test from "node:test";
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

function createMinimalWorkflow() {
  return {
    workflow: {
      workflowId: "wf_perf_test",
      divisionId: "coding",
      steps: [],
    },
    executionSteps: [
      {
        stepId: newId("step"),
        divisionId: "coding",
        roleId: "builder",
        inputKeys: [],
        agentId: "agent_builder",
        outputKey: "result",
        outputSchemaPath: null,
        dependsOnStepIds: [],
        dependencyTypes: {},
        timeoutMs: 10000,
        maxAttempts: 1,
      },
    ],
    planReason: "perf.test",
    dependencyEdges: [],
  };
}

test("performance: OAPEFLIR full loop (happy path) < 30s P99", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({
    executeBridge: new MinimalExecuteBridge(),
  });

  const latencies: number[] = [];
  const iterations = 10; // Full loop is expensive, only run 10 iterations

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await service.run({
      taskId: newId("task"),
      objective: "Simple performance test task",
      workflow: createMinimalWorkflow(),
    });
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;
  const max = latencies[latencies.length - 1]!;

  assert.ok(
    p99 < 30_000,
    `OAPEFLIR full loop P99 latency ${(p99 / 1000).toFixed(3)}s exceeds 30s target`,
  );

  assert.ok(
    p50 < 15_000,
    `OAPEFLIR full loop P50 latency ${(p50 / 1000).toFixed(3)}s seems unexpectedly high`,
  );

  // Log results for reference
  console.log(`OAPEFLIR full loop: P50=${(p50 / 1000).toFixed(3)}s, P99=${(p99 / 1000).toFixed(3)}s, max=${(max / 1000).toFixed(3)}s`);
});

test("performance: OAPEFLIR loop single iteration baseline", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({
    executeBridge: new MinimalExecuteBridge(),
  });

  const start = performance.now();
  await service.run({
    taskId: newId("task"),
    objective: "Simple performance test task",
    workflow: createMinimalWorkflow(),
  });
  const latency = performance.now() - start;

  assert.ok(
    latency < 30_000,
    `OAPEFLIR loop single iteration ${(latency / 1000).toFixed(3)}s exceeds 30s target`,
  );

  console.log(`OAPEFLIR single iteration: ${(latency / 1000).toFixed(3)}s`);
});
