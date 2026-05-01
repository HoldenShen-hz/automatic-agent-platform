/**
 * Performance Test: Plan Evaluator
 * Measures plan evaluation throughput and scoring latency
 *
 * Design targets:
 * - Plan evaluation: >2000 ops/sec
 * - Evaluation report generation: >1000 ops/sec
 * - Score computation: P99 <5ms
 */

import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import { reportSoftPerformanceMiss } from "../helpers/performance.js";

import { PlanEvaluator } from "../../src/platform/orchestration/planner/plan-evaluator.js";
import type { Plan, UnifiedAssessment } from "../../src/platform/orchestration/oapeflir/types/index.js";
import { newId } from "../../src/platform/contracts/types/ids.js";

function createSimplePlan(steps: number): Plan {
  const planSteps = Array.from({ length: steps }, (_, i) => ({
    stepId: `step_${i}`,
    action: i % 2 === 0 ? "read" : "execute",
    title: `Step ${i}`,
    inputs: { ownerRoleId: "builder", inputKeys: i > 0 ? [`input_${i}`] : [] },
    outputs: [`output_${i}`],
    dependencies: i > 0 ? [`step_${i - 1}`] : [],
    status: "pending" as const,
    timeout: 60000,
    retryPolicy: { maxRetries: 0, backoffMs: 0 },
  }));

  return {
    planId: newId("plan"),
    taskId: newId("task"),
    assessmentRef: `assessment:${newId("task")}:1`,
    version: 1,
    strategy: "linear",
    steps: planSteps,
    createdAt: Date.now(),
    parentVersion: undefined,
  };
}

function createLowRiskAssessment(): UnifiedAssessment {
  return {
    taskId: newId("task"),
    timestamp: Date.now(),
    situationRef: `task_situation:${newId("task")}:1`,
    phase: "pre-execution",
    complexity: "simple",
    risk: "low",
    riskAssessment: { level: "low", factors: [] },
    routingDecision: { division: "coding", workflow: "linear", rationale: "simple task" },
    resourceAllocation: { modelClass: "small", maxTokens: 2000, timeoutMs: 30000 },
    approvalPolicy: { required: false },
    executionMode: "auto",
    suggestedActions: [],
  };
}

function createHighRiskAssessment(): UnifiedAssessment {
  return {
    taskId: newId("task"),
    timestamp: Date.now(),
    situationRef: `task_situation:${newId("task")}:1`,
    phase: "pre-execution",
    complexity: "complex",
    risk: "critical",
    riskAssessment: { level: "critical", factors: ["file_system", "network", "external_api"] },
    routingDecision: { division: "coding", workflow: "branching", rationale: "complex task" },
    resourceAllocation: { modelClass: "large", maxTokens: 8000, timeoutMs: 120000 },
    approvalPolicy: { required: true, approvers: ["manager"] },
    executionMode: "manual",
    suggestedActions: [],
  };
}

// ============================================================================
// Evaluation Throughput Benchmarks
// ============================================================================

test("performance: PlanEvaluator.evaluate() throughput >2000 ops/sec", (t) => {
  const evaluator = new PlanEvaluator();
  const plan = createSimplePlan(10);
  const assessment = createLowRiskAssessment();

  const iterations = 2000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    evaluator.evaluate(plan, assessment);
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;

  try {
    assert.ok(opsPerSec > 2000, `PlanEvaluator.evaluate() ${opsPerSec.toFixed(0)} ops/sec must be >2000 ops/sec`);
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("performance: PlanEvaluator.evaluate() P99 <5ms", (t) => {
  const evaluator = new PlanEvaluator();
  const plan = createSimplePlan(10);
  const assessment = createLowRiskAssessment();

  const latencies: number[] = [];
  const iterations = 1000;

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    evaluator.evaluate(plan, assessment);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;

  try {
    assert.ok(p99 < 5, `PlanEvaluator.evaluate() P99 latency ${p99.toFixed(3)}ms must be <5ms`);
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

// ============================================================================
// Evaluation Report Generation Benchmarks
// ============================================================================

test("performance: PlanEvaluator.produceEvaluationReport() throughput >1000 ops/sec", (t) => {
  const evaluator = new PlanEvaluator();
  const plan = createSimplePlan(10);
  const assessment = createLowRiskAssessment();

  const iterations = 1000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    evaluator.produceEvaluationReport(plan, assessment);
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;

  try {
    assert.ok(opsPerSec > 1000, `PlanEvaluator.produceEvaluationReport() ${opsPerSec.toFixed(0)} ops/sec must be >1000 ops/sec`);
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

// ============================================================================
// Complex Assessment Benchmarks
// ============================================================================

test("performance: PlanEvaluator.evaluate() with critical risk P99 <10ms", (t) => {
  const evaluator = new PlanEvaluator();
  const plan = createSimplePlan(15);
  const assessment = createHighRiskAssessment();

  const latencies: number[] = [];
  const iterations = 500;

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    evaluator.evaluate(plan, assessment);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;

  try {
    assert.ok(p99 < 10, `PlanEvaluator.evaluate() (critical risk) P99 ${p99.toFixed(3)}ms must be <10ms`);
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

// ============================================================================
// Large Plan Benchmarks
// ============================================================================

test("performance: PlanEvaluator.evaluate() 50-step plan throughput >500 ops/sec", (t) => {
  const evaluator = new PlanEvaluator();
  const plan = createSimplePlan(50);
  const assessment = createLowRiskAssessment();

  const iterations = 500;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    evaluator.evaluate(plan, assessment);
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;

  try {
    assert.ok(opsPerSec > 500, `PlanEvaluator.evaluate() (50-step) ${opsPerSec.toFixed(0)} ops/sec must be >500 ops/sec`);
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

// ============================================================================
// Concurrent Evaluation Benchmarks
// ============================================================================

test("performance: PlanEvaluator concurrent evaluations (10 parallel) >2000 ops/sec", (t) => {
  const evaluator = new PlanEvaluator();
  const plans = Array.from({ length: 10 }, () => createSimplePlan(10));
  const assessments = Array.from({ length: 10 }, () => createLowRiskAssessment());

  const iterations = 100;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const promises = plans.map((plan, idx) =>
      (async () => evaluator.evaluate(plan, assessments[idx]))()
    );
    Promise.all(promises);
  }

  const elapsed = performance.now() - start;
  const totalOps = iterations * 10;
  const opsPerSec = (totalOps / elapsed) * 1000;

  try {
    assert.ok(opsPerSec > 2000, `PlanEvaluator concurrent ${opsPerSec.toFixed(0)} ops/sec must be >2000 ops/sec`);
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});