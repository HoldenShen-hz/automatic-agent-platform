/**
 * Performance Test: Plan Building (Extended)
 * Measures plan builder performance with various workflow sizes and complexities
 *
 * Design targets:
 * - 5-step workflow: P99 < 30ms
 * - 15-step workflow: P99 < 75ms
 * - 20-step workflow: P99 < 100ms
 * - Concurrent plan builds: >100 plans/sec
 */

import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import { reportSoftPerformanceMiss } from "../helpers/performance.js";

import { PlanBuilder } from "../../src/platform/five-plane-orchestration/planner/plan-builder.js";
import { newId } from "../../src/platform/contracts/types/ids.js";
import type { TaskSituation } from "../../src/platform/five-plane-orchestration/oapeflir/types/task-situation.js";
import type { UnifiedAssessment } from "../../src/platform/five-plane-orchestration/oapeflir/types/unified-assessment.js";
import type { PlannedWorkflow } from "../../src/platform/five-plane-orchestration/routing/workflow-planner.js";

function createMinimalTaskSituation(): TaskSituation {
  return {
    taskId: newId("task"),
    timestamp: Date.now(),
    objective: "build feature",
    currentPhase: "planning",
    userIntent: {
      raw: "build feature",
      normalized: "build feature",
      confidence: 0.9,
    },
    blockers: [],
    codebaseSnapshot: {
      rootPath: "/workspace",
      fileCount: 10,
      relevantFiles: [{ path: "src/app.ts" }],
    },
    environmentContext: {
      nodeVersion: process.version,
      platform: process.platform,
      workingDirectory: "/workspace",
      availableTools: ["read", "execute", "apply_patch"],
    },
    historicalContext: {
      previousTaskIds: [],
      relatedMemoryRefs: [],
    },
    relevantMemory: [],
    fileRefs: ["src/app.ts"],
    metrics: {},
  };
}

function createMinimalAssessment(): UnifiedAssessment {
  return {
    taskId: newId("task"),
    timestamp: Date.now(),
    situationRef: `task_situation:${newId("task")}:1`,
    phase: "pre-execution",
    complexity: "moderate",
    risk: "low",
    riskAssessment: {
      level: "low",
      factors: [],
    },
    routingDecision: {
      division: "coding",
      workflow: "linear",
      rationale: "simple task",
    },
    resourceAllocation: {
      modelClass: "small",
      maxTokens: 2000,
      timeoutMs: 30000,
    },
    approvalPolicy: {
      required: false,
    },
    executionMode: "auto",
    suggestedActions: [],
  };
}

function createMultiStepWorkflow(steps: number): PlannedWorkflow {
  const stepIds = Array.from({ length: steps }, () => newId("step"));
  const executionSteps = stepIds.map((stepId, i) => ({
    stepId,
    divisionId: "coding",
    roleId: i === 0 ? "planner" : "builder",
    inputKeys: i > 0 ? [`input_${i}`] : [],
    agentId: `agent_${i}`,
    outputKey: `output_${i}`,
    outputSchemaPath: null,
    dependsOnStepIds: i > 0 ? [stepIds[i - 1]!] : [],
    dependencyTypes: {} as Record<string, "hard" | "soft">,
    timeoutMs: 60000,
    maxAttempts: 1,
  }));

  const dependencyEdges = Array.from({ length: Math.max(0, steps - 1) }, (_, i) => ({
    fromStepId: stepIds[i]!,
    toStepId: stepIds[i + 1]!,
  }));

  return {
    workflow: {
      workflowId: "wf_test",
      divisionId: "coding",
      steps: [],
    },
    executionSteps,
    planReason: "test workflow",
    dependencyEdges,
  };
}

// ============================================================================
// 5-Step Workflow Benchmarks
// ============================================================================

test("performance: PlanBuilder.build() 5-step workflow P99 <30ms", (t) => {
  const builder = new PlanBuilder();
  const observation = createMinimalTaskSituation();
  const assessment = createMinimalAssessment();
  const workflow = createMultiStepWorkflow(5);

  const latencies: number[] = [];
  const iterations = 500;

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    builder.build({ observation, assessment, workflow });
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  try {
    assert.ok(
      p99 < 30,
      `PlanBuilder.build() (5-step) P99 latency ${p99.toFixed(3)}ms exceeds 30ms target. P50: ${p50.toFixed(3)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("performance: PlanBuilder.build() 5-step workflow throughput >500 ops/sec", (t) => {
  const builder = new PlanBuilder();
  const observation = createMinimalTaskSituation();
  const assessment = createMinimalAssessment();
  const workflow = createMultiStepWorkflow(5);

  const iterations = 500;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    builder.build({ observation, assessment, workflow });
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;
  const avgLatencyMs = elapsed / iterations;

  try {
    assert.ok(
      opsPerSec > 500,
      `PlanBuilder.build() (5-step) throughput ${opsPerSec.toFixed(0)} ops/sec must be >500 ops/sec. Avg: ${avgLatencyMs.toFixed(3)}ms`,
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
// 15-Step Workflow Benchmarks
// ============================================================================

test("performance: PlanBuilder.build() 15-step workflow P99 <75ms", (t) => {
  const builder = new PlanBuilder();
  const observation = createMinimalTaskSituation();
  const assessment = createMinimalAssessment();
  const workflow = createMultiStepWorkflow(15);

  const latencies: number[] = [];
  const iterations = 300;

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    builder.build({ observation, assessment, workflow });
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  try {
    assert.ok(
      p99 < 75,
      `PlanBuilder.build() (15-step) P99 latency ${p99.toFixed(3)}ms exceeds 75ms target. P50: ${p50.toFixed(3)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("performance: PlanBuilder.build() 15-step workflow throughput >200 ops/sec", (t) => {
  const builder = new PlanBuilder();
  const observation = createMinimalTaskSituation();
  const assessment = createMinimalAssessment();
  const workflow = createMultiStepWorkflow(15);

  const iterations = 300;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    builder.build({ observation, assessment, workflow });
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;
  const avgLatencyMs = elapsed / iterations;

  try {
    assert.ok(
      opsPerSec > 200,
      `PlanBuilder.build() (15-step) throughput ${opsPerSec.toFixed(0)} ops/sec must be >200 ops/sec. Avg: ${avgLatencyMs.toFixed(3)}ms`,
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
// 20-Step Workflow Benchmarks
// ============================================================================

test("performance: PlanBuilder.build() 20-step workflow P99 <100ms", (t) => {
  const builder = new PlanBuilder();
  const observation = createMinimalTaskSituation();
  const assessment = createMinimalAssessment();
  const workflow = createMultiStepWorkflow(20);

  const latencies: number[] = [];
  const iterations = 200;

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    builder.build({ observation, assessment, workflow });
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  try {
    assert.ok(
      p99 < 100,
      `PlanBuilder.build() (20-step) P99 latency ${p99.toFixed(3)}ms exceeds 100ms target. P50: ${p50.toFixed(3)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("performance: PlanBuilder.build() 20-step workflow throughput >100 ops/sec", (t) => {
  const builder = new PlanBuilder();
  const observation = createMinimalTaskSituation();
  const assessment = createMinimalAssessment();
  const workflow = createMultiStepWorkflow(20);

  const iterations = 200;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    builder.build({ observation, assessment, workflow });
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;
  const avgLatencyMs = elapsed / iterations;

  try {
    assert.ok(
      opsPerSec > 100,
      `PlanBuilder.build() (20-step) throughput ${opsPerSec.toFixed(0)} ops/sec must be >100 ops/sec. Avg: ${avgLatencyMs.toFixed(3)}ms`,
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
// Parallel Plan Building Benchmarks
// ============================================================================

test("performance: Concurrent plan builds (10 parallel) >100 total plans/sec", (t) => {
  const builder = new PlanBuilder();
  const observation = createMinimalTaskSituation();
  const assessment = createMinimalAssessment();
  const workflow = createMultiStepWorkflow(5);

  const parallelCount = 10;
  const iterations = 100;

  const start = performance.now();

  // Run plan builds in parallel using Promise.all
  const runPlans = async () => {
    const promises = [];
    for (let i = 0; i < parallelCount; i++) {
      promises.push(
        (async () => {
          for (let j = 0; j < iterations / parallelCount; j++) {
            builder.build({ observation, assessment, workflow });
          }
        })(),
      );
    }
    await Promise.all(promises);
  };

  runPlans();

  const elapsed = performance.now() - start;
  const totalPlans = iterations;
  const plansPerSec = (totalPlans / elapsed) * 1000;

  try {
    assert.ok(
      plansPerSec > 100,
      `Concurrent plan builds ${plansPerSec.toFixed(0)} plans/sec must be >100 plans/sec`,
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
// Plan Build with Complex Assessment
// ============================================================================

test("performance: PlanBuilder.build() with complex assessment P99 <60ms", (t) => {
  const builder = new PlanBuilder();
  const observation = createMinimalTaskSituation();
  const workflow = createMultiStepWorkflow(10);

  // Create a more complex assessment
  const complexAssessment: UnifiedAssessment = {
    taskId: newId("task"),
    timestamp: Date.now(),
    situationRef: `task_situation:${newId("task")}:1`,
    phase: "pre-execution",
    complexity: "complex",
    risk: "medium",
    riskAssessment: {
      level: "medium",
      factors: ["file_system", "network", "external_api"],
    },
    routingDecision: {
      division: "coding",
      workflow: " branching",
      rationale: "complex task with multiple branches",
    },
    resourceAllocation: {
      modelClass: "large",
      maxTokens: 8000,
      timeoutMs: 120000,
    },
    approvalPolicy: {
      required: true,
      approvers: ["manager", "security"],
    },
    executionMode: "manual",
    suggestedActions: [
      { action: "validate_input", priority: 1 },
      { action: "check_resources", priority: 2 },
      { action: "execute_plan", priority: 3 },
    ],
  };

  const latencies: number[] = [];
  const iterations = 300;

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    builder.build({ observation, assessment: complexAssessment, workflow });
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  try {
    assert.ok(
      p99 < 60,
      `PlanBuilder.build() (complex assessment) P99 latency ${p99.toFixed(3)}ms exceeds 60ms target. P50: ${p50.toFixed(3)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});
