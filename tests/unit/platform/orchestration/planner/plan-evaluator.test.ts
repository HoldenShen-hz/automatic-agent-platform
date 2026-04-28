import test from "node:test";
import assert from "node:assert/strict";

import { PlanEvaluator } from "../../../../../src/platform/orchestration/planner/plan-evaluator.js";

function createAssessment(overrides: {
  risk?: "low" | "medium" | "high" | "critical";
  maxTokens?: number;
  approvalRequired?: boolean;
} = {}): Parameters<PlanEvaluator["evaluate"]>[1] {
  return {
    taskId: "task_eval",
    timestamp: Date.now(),
    situationRef: "task_situation:task_eval:1",
    phase: "pre-execution",
    complexity: "simple",
    risk: overrides.risk ?? "medium",
    riskAssessment: { level: overrides.risk ?? "medium", factors: [] },
    routingDecision: { division: "coding", workflow: "multi-step", rationale: "test" },
    resourceAllocation: {
      modelClass: "small",
      maxTokens: overrides.maxTokens ?? 10000,
      timeoutMs: 60000,
    },
    approvalPolicy: { required: overrides.approvalRequired ?? false, level: "none" },
    executionMode: "auto",
    suggestedActions: [],
  };
}

function createPlanStep(overrides: {
  stepId?: string;
  dependencies?: string[];
  timeout?: number;
  maxRetries?: number;
} = {}): Parameters<PlanEvaluator["evaluate"]>[0]["steps"][0] {
  return {
    stepId: overrides.stepId ?? "step_1",
    action: "execute",
    title: "test step",
    inputs: {},
    outputs: [],
    dependencies: overrides.dependencies ?? [],
    status: "pending",
    timeout: overrides.timeout ?? 1000,
    retryPolicy: { maxRetries: overrides.maxRetries ?? 0, backoffMs: 0 },
  };
}

function createPlan(steps: ReturnType<typeof createPlanStep>[]): Parameters<PlanEvaluator["evaluate"]>[0] {
  return {
    planId: "plan_eval",
    taskId: "task_eval",
    assessmentRef: "assessment:task_eval:1",
    version: 1,
    strategy: "linear",
    steps,
    createdAt: Date.now(),
  };
}

test("PlanEvaluator.produceEvaluationReport returns EvaluationReport with required fields", () => {
  const evaluator = new PlanEvaluator();
  const plan = createPlan([createPlanStep()]);
  const assessment = createAssessment();

  const report = evaluator.produceEvaluationReport(plan, assessment);

  assert.ok(report.evaluationId, "evaluationId should exist");
  assert.ok(typeof report.passed === "boolean", "passed should be boolean");
  assert.ok(typeof report.score === "number", "score should be number");
  assert.ok(Array.isArray(report.issues), "issues should be array");
  assert.ok(report.recommendation, "recommendation should exist");
  assert.ok(typeof report.confidence === "number", "confidence should be number");
  assert.ok(report.evaluatedAt, "evaluatedAt should exist");
});

test("PlanEvaluator.produceEvaluationReport passes viable low-risk plan", () => {
  const evaluator = new PlanEvaluator();
  const plan = createPlan([createPlanStep()]);
  const assessment = createAssessment({ risk: "low" });

  const report = evaluator.produceEvaluationReport(plan, assessment);

  assert.equal(report.passed, true, "low risk plan should pass");
  assert.ok(report.score >= 0.5, "score should be >= 0.5");
});

test("PlanEvaluator.produceEvaluationReport fails critical risk plan without approval", () => {
  const evaluator = new PlanEvaluator();
  const plan = createPlan([createPlanStep()]);
  const assessment = createAssessment({ risk: "critical", approvalRequired: false });

  const report = evaluator.produceEvaluationReport(plan, assessment);

  assert.equal(report.passed, false, "critical risk without approval should fail");
  assert.ok(report.issues.some(i => i.includes("critical")), "should report critical issue");
});

test("PlanEvaluator.produceEvaluationReport recommends require_human_approval for critical risk", () => {
  const evaluator = new PlanEvaluator();
  const plan = createPlan([createPlanStep()]);
  const assessment = createAssessment({ risk: "critical", approvalRequired: false });

  const report = evaluator.produceEvaluationReport(plan, assessment);

  assert.equal(report.recommendation, "require_human_approval");
});

test("PlanEvaluator.produceEvaluationReport recommends proceed_to_execute for viable medium risk plan", () => {
  const evaluator = new PlanEvaluator();
  const plan = createPlan([createPlanStep()]);
  const assessment = createAssessment({ risk: "medium" });

  const report = evaluator.produceEvaluationReport(plan, assessment);

  assert.equal(report.recommendation, "proceed_to_execute");
});

test("PlanEvaluator.produceEvaluationReport recommends fix_dag_structure for cycle", () => {
  const evaluator = new PlanEvaluator();
  const plan = createPlan([
    createPlanStep({ stepId: "a", dependencies: ["c"] }),
    createPlanStep({ stepId: "b", dependencies: ["a"] }),
    createPlanStep({ stepId: "c", dependencies: ["b"] }),
  ]);
  const assessment = createAssessment({ maxTokens: 50000 });

  const report = evaluator.produceEvaluationReport(plan, assessment);

  assert.equal(report.passed, false);
  assert.equal(report.recommendation, "fix_dag_structure");
});

test("PlanEvaluator.evaluate returns estimatedCostUsd that is NOT hardcoded to steps.length * 1000", () => {
  const evaluator = new PlanEvaluator();

  // Single step with small timeout
  const singleStepPlan = createPlan([createPlanStep({ stepId: "single", timeout: 100 })]);
  const singleResult = evaluator.evaluate(singleStepPlan, createAssessment({ maxTokens: 50000 }));

  // Many steps with large timeouts
  const manyStepsPlan = createPlan([
    createPlanStep({ stepId: "s1", timeout: 5000, dependencies: [] }),
    createPlanStep({ stepId: "s2", timeout: 5000, dependencies: ["s1"] }),
    createPlanStep({ stepId: "s3", timeout: 5000, dependencies: ["s2"] }),
    createPlanStep({ stepId: "s4", timeout: 5000, dependencies: ["s3"] }),
  ]);
  const manyResult = evaluator.evaluate(manyStepsPlan, createAssessment({ maxTokens: 50000 }));

  // Cost should scale with timeouts, not just step count
  // If it were hardcoded as steps.length * 1000:
  //   single step = 1 * 1000 = 1000
  //   4 steps = 4 * 1000 = 4000
  // But actual cost uses timeout + retry overhead, so with 5000ms timeouts:
  //   single: ~1000 * 0.00001 = 0.01
  //   4 steps: ~(5000+5000+5000+5000) * 0.00001 = 0.2
  // The cost difference should be proportional to accumulated timeout, not step count
  assert.ok(
    manyResult.estimatedCostUsd > singleResult.estimatedCostUsd,
    "cost should increase with more steps/timeouts, not be hardcoded"
  );

  // The ratio should reflect the actual timeout differences
  // single step has 100ms timeout, 4 steps have 20000ms total
  // ratio should be roughly 200:1 in timeout, so cost ratio should be similar
  const ratio = manyResult.estimatedCostUsd / singleResult.estimatedCostUsd;
  assert.ok(ratio > 10, `cost ratio (${ratio}) should reflect timeout differences, not hardcoded step multiplier`);
});

test("PlanEvaluator.evaluate returns estimatedTokenBudget that scales with DAG structure", () => {
  const evaluator = new PlanEvaluator();

  // Linear chain: 3 steps
  const linearPlan = createPlan([
    createPlanStep({ stepId: "a", dependencies: [] }),
    createPlanStep({ stepId: "b", dependencies: ["a"] }),
    createPlanStep({ stepId: "c", dependencies: ["b"] }),
  ]);
  const linearResult = evaluator.evaluate(linearPlan, createAssessment({ maxTokens: 50000 }));

  // Diamond DAG: same 4 steps but parallel structure
  const diamondPlan = createPlan([
    createPlanStep({ stepId: "a", dependencies: [] }),
    createPlanStep({ stepId: "b", dependencies: ["a"] }),
    createPlanStep({ stepId: "c", dependencies: ["a"] }),
    createPlanStep({ stepId: "d", dependencies: ["b", "c"] }),
  ]);
  const diamondResult = evaluator.evaluate(diamondPlan, createAssessment({ maxTokens: 50000 }));

  // Both have similar step counts (3 vs 4) but different structure
  // Token budget should reflect depth and parallel branches
  assert.ok(diamondResult.estimatedTokenBudget >= linearResult.estimatedTokenBudget,
    "diamond structure should have equal or higher token budget due to parallel branches");
});

test("PlanEvaluator.evaluate returns different costs for different risk levels", () => {
  const evaluator = new PlanEvaluator();
  const plan = createPlan([createPlanStep(), createPlanStep()]);

  const lowRiskResult = evaluator.evaluate(plan, createAssessment({ risk: "low" }));
  const criticalRiskResult = evaluator.evaluate(plan, createAssessment({ risk: "critical" }));

  // Critical risk should have higher estimated cost due to risk multiplier
  // Risk multipliers: low=1.0, medium=1.5, high=2.0, critical=3.0
  assert.ok(
    criticalRiskResult.estimatedCostUsd > lowRiskResult.estimatedCostUsd,
    "critical risk should have higher cost than low risk"
  );
  assert.ok(
    criticalRiskResult.estimatedTokenBudget > lowRiskResult.estimatedTokenBudget,
    "critical risk should have higher token budget than low risk"
  );
});

test("PlanEvaluator.evaluate marks plan non-viable when resource budget exceeded", () => {
  const evaluator = new PlanEvaluator();

  // Plan with 4 steps that will exceed small token budget
  const plan = createPlan([
    createPlanStep({ stepId: "a", dependencies: [] }),
    createPlanStep({ stepId: "b", dependencies: ["a"] }),
    createPlanStep({ stepId: "c", dependencies: ["b"] }),
    createPlanStep({ stepId: "d", dependencies: ["c"] }),
  ]);
  const assessment = createAssessment({ maxTokens: 100 }); // Very small budget

  const result = evaluator.evaluate(plan, assessment);

  assert.equal(result.viable, false);
  assert.ok(result.issues.some(i => i.includes("resource_budget_exceeded")));
});

test("PlanEvaluator.evaluate marks plan non-viable for empty plan", () => {
  const evaluator = new PlanEvaluator();
  const plan = createPlan([]);
  const assessment = createAssessment();

  const result = evaluator.evaluate(plan, assessment);

  assert.equal(result.viable, false);
  assert.ok(result.issues.includes("planning.empty_plan"));
});

test("PlanEvaluator.evaluate marks plan non-viable for critical risk without approval", () => {
  const evaluator = new PlanEvaluator();
  const plan = createPlan([createPlanStep()]);
  const assessment = createAssessment({ risk: "critical", approvalRequired: false });

  const result = evaluator.evaluate(plan, assessment);

  assert.equal(result.viable, false);
  assert.ok(result.issues.includes("planning.missing_critical_approval_constraint"));
});

test("PlanEvaluator.evaluate marks plan viable for critical risk with approval", () => {
  const evaluator = new PlanEvaluator();
  const plan = createPlan([createPlanStep()]);
  const assessment = createAssessment({ risk: "critical", approvalRequired: true });

  const result = evaluator.evaluate(plan, assessment);

  assert.equal(result.viable, true);
  assert.ok(!result.issues.some(i => i.includes("critical")));
});

test("PlanEvaluator.produceEvaluationReport returns score based on viability and risk", () => {
  const evaluator = new PlanEvaluator();

  const viablePlan = createPlan([createPlanStep()]);
  const viableReport = evaluator.produceEvaluationReport(viablePlan, createAssessment({ risk: "low" }));

  const nonViablePlan = createPlan([createPlanStep({ stepId: "bad", dependencies: ["bad"] })]);
  const nonViableReport = evaluator.produceEvaluationReport(nonViablePlan, createAssessment({ maxTokens: 50000 }));

  assert.ok(viableReport.score > nonViableReport.score, "viable plan should have higher score");
});

test("PlanEvaluator.produceEvaluationReport confidence reflects DAG validity", () => {
  const evaluator = new PlanEvaluator();

  const validPlan = createPlan([createPlanStep()]);
  const validReport = evaluator.produceEvaluationReport(validPlan, createAssessment());

  const invalidPlan = createPlan([
    createPlanStep({ stepId: "a", dependencies: ["b"] }),
    createPlanStep({ stepId: "b", dependencies: ["a"] }), // cycle
  ]);
  const invalidReport = evaluator.produceEvaluationReport(invalidPlan, createAssessment({ maxTokens: 50000 }));

  assert.ok(validReport.confidence > invalidReport.confidence, "valid DAG should have higher confidence");
});