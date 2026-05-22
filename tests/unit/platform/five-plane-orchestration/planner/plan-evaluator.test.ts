/**
 * Plan Evaluator Unit Tests
 */

import assert from "node:assert/strict";
import test from "node:test";

import { PlanEvaluator } from "../../../../../src/platform/five-plane-orchestration/planner/plan-evaluator.js";

function makeAssessment(overrides: Partial<{
  risk: "low" | "medium" | "high" | "critical";
  complexity: "trivial" | "simple" | "moderate" | "complex" | "critical";
  approvalPolicy: { required: boolean };
  resourceAllocation: { maxTokens: number; timeoutMs: number };
}> = {}): {
  risk: "low" | "medium" | "high" | "critical";
  complexity: "trivial" | "simple" | "moderate" | "complex" | "critical";
  approvalPolicy: { required: boolean };
  resourceAllocation: { maxTokens: number; timeoutMs: number };
} {
  return {
    risk: "medium",
    complexity: "moderate",
    approvalPolicy: { required: false },
    resourceAllocation: { maxTokens: 10000, timeoutMs: 60000 },
    ...overrides,
  };
}

function makePlan(overrides: Partial<{
  steps: Array<{ stepId: string; action: string; timeout: number; retryPolicy: { maxRetries: number; backoffMs: number }; dependencies: string[] }>;
}> = {}): {
  planId: string;
  taskId: string;
  version: number;
  strategy: "linear";
  steps: Array<{ stepId: string; action: string; timeout: number; retryPolicy: { maxRetries: number; backoffMs: number }; dependencies: string[]; title: string }>;
  createdAt: number;
} {
  return {
    planId: "plan-001",
    taskId: "task-001",
    version: 1,
    strategy: "linear",
    steps: [],
    createdAt: Date.now(),
    ...overrides,
  };
}

test("PlanEvaluator.evaluate returns issues for empty plan", () => {
  const evaluator = new PlanEvaluator();
  const plan = makePlan({ steps: [] });
  const result = evaluator.evaluate(plan, makeAssessment());

  assert.ok(!result.viable);
  assert.ok(result.issues.includes("planning.empty_plan"));
});

test("PlanEvaluator.evaluate flags missing critical approval", () => {
  const evaluator = new PlanEvaluator();
  const plan = makePlan({
    steps: [{
      stepId: "step-1",
      action: "execute",
      timeout: 60000,
      retryPolicy: { maxRetries: 0, backoffMs: 250 },
      dependencies: [],
      title: "Test step",
    }],
  });
  const assessment = makeAssessment({ risk: "critical", approvalPolicy: { required: false } });
  const result = evaluator.evaluate(plan, assessment);

  assert.ok(!result.viable);
  assert.ok(result.issues.includes("planning.missing_critical_approval_constraint"));
});

test("PlanEvaluator.evaluate detects DAG issues", () => {
  const evaluator = new PlanEvaluator();
  const plan = makePlan({
    steps: [{
      stepId: "step-1",
      action: "execute",
      timeout: 60000,
      retryPolicy: { maxRetries: 0, backoffMs: 250 },
      dependencies: ["step-1"], // self-dependency
      title: "Test step",
    }],
  });
  const result = evaluator.evaluate(plan, makeAssessment());

  assert.ok(!result.viable);
  assert.ok(result.issues.some(i => i.includes("self_dependency")));
});

test("PlanEvaluator.evaluate detects resource budget exceeded", () => {
  const evaluator = new PlanEvaluator();
  // Create many steps that exceed token budget
  const steps = Array.from({ length: 20 }, (_, i) => ({
    stepId: `step-${i}`,
    action: "execute" as const,
    timeout: 60000,
    retryPolicy: { maxRetries: 0, backoffMs: 250 },
    dependencies: [],
    title: `Step ${i}`,
  }));
  const plan = makePlan({ steps });
  const assessment = makeAssessment({ resourceAllocation: { maxTokens: 100, timeoutMs: 60000 } });
  const result = evaluator.evaluate(plan, assessment);

  assert.ok(!result.viable);
  assert.ok(result.issues.some(i => i.includes("resource_budget_exceeded")));
});

test("PlanEvaluator.evaluate returns viable for valid plan", () => {
  const evaluator = new PlanEvaluator();
  const plan = makePlan({
    steps: [{
      stepId: "step-1",
      action: "execute",
      timeout: 60000,
      retryPolicy: { maxRetries: 0, backoffMs: 250 },
      dependencies: [],
      title: "Valid step",
    }],
  });
  const result = evaluator.evaluate(plan, makeAssessment());

  assert.ok(result.viable);
  assert.equal(result.issues.length, 0);
});

test("PlanEvaluator.produceEvaluationReport returns valid report", () => {
  const evaluator = new PlanEvaluator();
  const plan = makePlan({
    steps: [{
      stepId: "step-1",
      action: "execute",
      timeout: 60000,
      retryPolicy: { maxRetries: 0, backoffMs: 250 },
      dependencies: [],
      title: "Valid step",
    }],
  });
  const report = evaluator.produceEvaluationReport(plan, makeAssessment());

  assert.ok(typeof report.passed === "boolean");
  assert.ok(typeof report.score === "number");
  assert.ok(report.evaluationId.length > 0);
  assert.ok(report.evaluatedAt > 0);
});

test("PlanEvaluator.produceEvaluationReport recommends proceed for viable plan", () => {
  const evaluator = new PlanEvaluator();
  const plan = makePlan({
    steps: [{
      stepId: "step-1",
      action: "execute",
      timeout: 60000,
      retryPolicy: { maxRetries: 0, backoffMs: 250 },
      dependencies: [],
      title: "Valid step",
    }],
  });
  const report = evaluator.produceEvaluationReport(plan, makeAssessment());

  assert.equal(report.recommendation, "proceed_to_execute");
});

test("PlanEvaluator.produceEvaluationReport recommends require_human_approval for critical risk", () => {
  const evaluator = new PlanEvaluator();
  const plan = makePlan({
    steps: [{
      stepId: "step-1",
      action: "execute",
      timeout: 60000,
      retryPolicy: { maxRetries: 0, backoffMs: 250 },
      dependencies: [],
      title: "Critical step",
    }],
  });
  const report = evaluator.produceEvaluationReport(plan, makeAssessment({ risk: "critical" }));

  assert.equal(report.recommendation, "require_human_approval");
});

test("PlanEvaluator.produceEvaluationReport recommends reduce_scope for budget issues", () => {
  const evaluator = new PlanEvaluator();
  const plan = makePlan({
    steps: Array.from({ length: 20 }, (_, i) => ({
      stepId: `step-${i}`,
      action: "execute" as const,
      timeout: 60000,
      retryPolicy: { maxRetries: 0, backoffMs: 250 },
      dependencies: [],
      title: `Step ${i}`,
    })),
  });
  const report = evaluator.produceEvaluationReport(plan, makeAssessment({ resourceAllocation: { maxTokens: 100, timeoutMs: 60000 } }));

  assert.equal(report.recommendation, "reduce_scope_or_allocate_more_budget");
});

test("PlanEvaluator.produceEvaluationReport includes issues from evaluation", () => {
  const evaluator = new PlanEvaluator();
  const plan = makePlan({ steps: [] });
  const report = evaluator.produceEvaluationReport(plan, makeAssessment());

  assert.ok(report.issues.length > 0);
});

test("PlanEvaluator.evaluate estimates cost and token budget", () => {
  const evaluator = new PlanEvaluator();
  const plan = makePlan({
    steps: [{
      stepId: "step-1",
      action: "execute",
      timeout: 60000,
      retryPolicy: { maxRetries: 0, backoffMs: 250 },
      dependencies: [],
      title: "Test",
    }],
  });
  const result = evaluator.evaluate(plan, makeAssessment());

  assert.ok(result.estimatedCostUsd >= 0);
  assert.ok(result.estimatedTokenBudget >= 0);
});