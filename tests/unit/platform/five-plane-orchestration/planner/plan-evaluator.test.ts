import assert from "node:assert/strict";
import test from "node:test";

import { PlanEvaluator, estimateMaxConcurrency, estimatePlanTokens } from "../../../../../src/platform/five-plane-orchestration/planner/plan-evaluator.js";
import type { Plan, UnifiedAssessment } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/index.js";

function createAssessment(overrides: Partial<UnifiedAssessment> = {}): UnifiedAssessment {
  return {
    taskId: "task-plan-eval",
    timestamp: Date.now(),
    situationRef: "assessment:task-plan-eval",
    phase: "pre-execution",
    complexity: "moderate",
    risk: "low",
    riskAssessment: { level: "low", factors: [] },
    routingDecision: { division: "coding", workflow: "default", rationale: "test" },
    resourceAllocation: {
      modelClass: "medium",
      maxTokens: 10_000,
      timeoutMs: 60_000,
    },
    approvalPolicy: { required: false, level: "none" },
    executionMode: "auto",
    suggestedActions: [],
    ...overrides,
  };
}

function createPlan(overrides: Partial<Plan> = {}): Plan {
  return {
    planId: "plan-1",
    taskId: "task-plan-eval",
    version: 1,
    assessmentRef: "assessment:task-plan-eval",
    strategy: "linear",
    steps: [{
      stepId: "step-1",
      action: "read",
      title: "Read task",
      inputs: {},
      outputs: ["notes"],
      dependencies: [],
      status: "pending",
      timeout: 1_000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    }],
    createdAt: Date.now(),
    ...overrides,
  };
}

test("PlanEvaluator rejects empty plans", () => {
  const evaluator = new PlanEvaluator();
  const result = evaluator.evaluate(createPlan({ steps: [] }), createAssessment());

  assert.equal(result.viable, false);
  assert.ok(result.issues.includes("planning.empty_plan"));
});

test("PlanEvaluator requires approval for critical risk plans", () => {
  const evaluator = new PlanEvaluator();
  const result = evaluator.evaluate(
    createPlan(),
    createAssessment({ risk: "critical", approvalPolicy: { required: false, level: "none" } }),
  );

  assert.equal(result.viable, false);
  assert.ok(result.issues.includes("planning.missing_critical_approval_constraint"));
});

test("PlanEvaluator detects DAG problems and budget pressure", () => {
  const evaluator = new PlanEvaluator();
  const result = evaluator.evaluate(
    createPlan({
      steps: [{
        stepId: "step-1",
        action: "execute",
        title: "Loop forever",
        inputs: {},
        dependencies: ["step-1"],
        status: "pending",
        timeout: 60_000,
        retryPolicy: { maxRetries: 0, backoffMs: 0 },
      }],
    }),
    createAssessment({ resourceAllocation: { modelClass: "small", maxTokens: 100, timeoutMs: 60_000 } }),
  );

  assert.equal(result.viable, false);
  assert.ok(result.issues.some((issue) => issue.includes("self_dependency")));
  assert.ok(result.estimatedTokenBudget > 0);
});

test("PlanEvaluator reports parallelism pressure against worker capacity", () => {
  const evaluator = new PlanEvaluator();
  const plan = createPlan({
    steps: [
      {
        stepId: "step-1",
        action: "read",
        title: "Read A",
        inputs: {},
        dependencies: [],
        status: "pending",
        timeout: 1_000,
        retryPolicy: { maxRetries: 0, backoffMs: 0 },
      },
      {
        stepId: "step-2",
        action: "read",
        title: "Read B",
        inputs: {},
        dependencies: [],
        status: "pending",
        timeout: 1_000,
        retryPolicy: { maxRetries: 0, backoffMs: 0 },
      },
    ],
  });
  const assessment = createAssessment({
    resourceAllocation: {
      modelClass: "medium",
      maxTokens: 10_000,
      timeoutMs: 60_000,
      workerPoolCapacity: 1,
    },
  });

  const result = evaluator.evaluate(plan, assessment);
  assert.ok(result.issues.includes("planning.parallelism_limit_exceeded:2>1"));
  assert.equal(estimateMaxConcurrency(plan), 2);
});

test("PlanEvaluator produces execution recommendations", () => {
  const evaluator = new PlanEvaluator();
  const report = evaluator.produceEvaluationReport(createPlan(), createAssessment());
  const estimate = estimatePlanTokens(createPlan());

  assert.equal(report.recommendation, "proceed_to_execute");
  assert.equal(report.passed, true);
  assert.equal(report.estimatedTokenBudget, estimate.totalTokens);
  assert.ok(report.estimatedCostUsd >= 0);
});
