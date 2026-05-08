import assert from "node:assert/strict";
import test from "node:test";

import { PlanEvaluator } from "../../../../../src/platform/orchestration/planner/plan-evaluator.js";

function createValidAssessment(overrides: Partial<{
  risk: "low" | "medium" | "high" | "critical";
  maxTokens: number;
  approvalRequired: boolean;
}> = {}): Parameters<PlanEvaluator["evaluate"]>[1] {
  return {
    taskId: "task_test",
    timestamp: Date.now(),
    situationRef: "task_situation:task_test:1",
    phase: "pre-execution",
    complexity: "simple",
    risk: overrides.risk ?? "low",
    riskAssessment: { level: overrides.risk ?? "low", factors: [] },
    routingDecision: { division: "coding", workflow: "single-step", rationale: "test" },
    resourceAllocation: { modelClass: "small", maxTokens: overrides.maxTokens ?? 10000, timeoutMs: 1000 },
    approvalPolicy: { required: overrides.approvalRequired ?? false, level: "none" },
    executionMode: "auto",
    suggestedActions: [],
  };
}

function createValidPlanStep(overrides: Partial<{
  stepId: string;
  dependencies: string[];
}> = {}): Parameters<PlanEvaluator["evaluate"]>[0]["steps"][0] {
  return {
    stepId: overrides.stepId ?? "step_1",
    action: "execute",
    title: "test step",
    inputs: {},
    outputs: [],
    dependencies: overrides.dependencies ?? [],
    status: "pending",
    timeout: 1000,
    retryPolicy: { maxRetries: 0, backoffMs: 0 },
  };
}

test("PlanEvaluator flags self dependency and missing dependencies", () => {
  const evaluator = new PlanEvaluator();
  const evaluation = evaluator.evaluate(
    {
      planId: "plan_invalid",
      taskId: "task_invalid",
      assessmentRef: "assessment:task_invalid:1",
      version: 1,
      strategy: "linear",
      steps: [
        {
          ...createValidPlanStep({ stepId: "step_a", dependencies: ["step_a", "missing_step"] }),
        },
      ],
      createdAt: Date.now(),
    },
    createValidAssessment({ maxTokens: 500 }),
  );

  assert.equal(evaluation.viable, false);
  assert.ok(evaluation.issues.some(i => i.includes("self_dependency")));
  assert.ok(evaluation.issues.some(i => i.includes("missing_dependency")));
  assert.ok(evaluation.issues.includes("planning.resource_budget_exceeded"));
});

test("PlanEvaluator returns viable for valid plan with sufficient token budget", () => {
  const evaluator = new PlanEvaluator();
  const evaluation = evaluator.evaluate(
    {
      planId: "plan_valid",
      taskId: "task_valid",
      assessmentRef: "assessment:task_valid:1",
      version: 1,
      strategy: "linear",
      steps: [createValidPlanStep()],
      createdAt: Date.now(),
    },
    createValidAssessment({ maxTokens: 10000 }),
  );

  assert.equal(evaluation.viable, true);
  assert.equal(evaluation.issues.length, 0);
  assert.equal(evaluation.riskLevel, "low");
});

test("PlanEvaluator detects empty plan", () => {
  const evaluator = new PlanEvaluator();
  const evaluation = evaluator.evaluate(
    {
      planId: "plan_empty",
      taskId: "task_empty",
      assessmentRef: "assessment:task_empty:1",
      version: 1,
      strategy: "linear",
      steps: [],
      createdAt: Date.now(),
    },
    createValidAssessment(),
  );

  assert.equal(evaluation.viable, false);
  assert.ok(evaluation.issues.includes("planning.empty_plan"));
});

test("PlanEvaluator flags critical risk without approval constraint", () => {
  const evaluator = new PlanEvaluator();
  const evaluation = evaluator.evaluate(
    {
      planId: "plan_critical",
      taskId: "task_critical",
      assessmentRef: "assessment:task_critical:1",
      version: 1,
      strategy: "linear",
      steps: [createValidPlanStep()],
      createdAt: Date.now(),
    },
    createValidAssessment({ risk: "critical", approvalRequired: false }),
  );

  assert.equal(evaluation.viable, false);
  assert.ok(evaluation.issues.includes("planning.missing_critical_approval_constraint"));
  assert.equal(evaluation.riskLevel, "critical");
});

test("PlanEvaluator allows critical risk with approval constraint", () => {
  const evaluator = new PlanEvaluator();
  const evaluation = evaluator.evaluate(
    {
      planId: "plan_critical_approved",
      taskId: "task_critical_approved",
      assessmentRef: "assessment:task_critical_approved:1",
      version: 1,
      strategy: "linear",
      steps: [createValidPlanStep()],
      createdAt: Date.now(),
    },
    createValidAssessment({ risk: "critical", approvalRequired: true }),
  );

  assert.equal(evaluation.viable, true);
  assert.ok(!evaluation.issues.some(i => i.includes("critical")));
});

test("PlanEvaluator returns multiple issues", () => {
  const evaluator = new PlanEvaluator();
  const evaluation = evaluator.evaluate(
    {
      planId: "plan_multi",
      taskId: "task_multi",
      assessmentRef: "assessment:task_multi:1",
      version: 1,
      strategy: "linear",
      steps: [
        createValidPlanStep({ stepId: "step_a", dependencies: ["step_a"] }),
        createValidPlanStep({ stepId: "step_b", dependencies: ["missing"] }),
      ],
      createdAt: Date.now(),
    },
    createValidAssessment({ maxTokens: 500 }),
  );

  assert.equal(evaluation.viable, false);
  assert.ok(evaluation.issues.length >= 2);
});

test("PlanEvaluator returns viable for plan within exact token budget", () => {
  const evaluator = new PlanEvaluator();
  const evaluation = evaluator.evaluate(
    {
      planId: "plan_exact_budget",
      taskId: "task_exact_budget",
      assessmentRef: "assessment:task_exact_budget:1",
      version: 1,
      strategy: "linear",
      steps: [createValidPlanStep()],
      createdAt: Date.now(),
    },
    createValidAssessment({ maxTokens: 5000 }),
  );

  assert.equal(evaluation.viable, true);
  assert.equal(evaluation.issues.length, 0);
});

test("PlanEvaluator flags plan slightly over token budget", () => {
  const evaluator = new PlanEvaluator();
  const evaluation = evaluator.evaluate(
    {
      planId: "plan_over_budget",
      taskId: "task_over_budget",
      assessmentRef: "assessment:task_over_budget:1",
      version: 1,
      strategy: "linear",
      steps: [createValidPlanStep()],
      createdAt: Date.now(),
    },
    createValidAssessment({ maxTokens: 100 }),
  );

  assert.equal(evaluation.viable, false);
  assert.ok(evaluation.issues.includes("planning.resource_budget_exceeded"));
});
