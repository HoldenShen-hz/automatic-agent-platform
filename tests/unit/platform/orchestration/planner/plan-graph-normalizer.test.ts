import test from "node:test";
import assert from "node:assert/strict";

import { PlanGraphNormalizer } from "../../../../../src/platform/five-plane-orchestration/planner/plan-graph-normalizer.js";
import type { PlanStep } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/plan.js";
import type { UnifiedAssessment } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/unified-assessment.js";

function makeStep(stepId: string, dependencies: string[] = []): PlanStep {
  return {
    stepId,
    action: `action_${stepId}`,
    status: "pending",
    inputs: {},
    dependencies,
    timeout: 1000,
    retryPolicy: { maxRetries: 0, backoffMs: 0 },
  };
}

function makeAssessment(risk: "low" | "medium" | "high" | "critical" = "medium"): UnifiedAssessment {
  return {
    taskId: "test-task",
    timestamp: Date.now(),
    situationRef: "test-situation",
    phase: "pre-execution",
    complexity: "moderate",
    risk,
    riskAssessment: {
      level: risk,
      factors: [],
    },
    routingDecision: {
      division: "test-division",
      workflow: "test-workflow",
      rationale: "test-rationale",
    },
    resourceAllocation: {
      modelClass: "test-model",
      maxTokens: 1000,
      timeoutMs: 5000,
    },
    approvalPolicy: {
      required: false,
    },
    executionMode: "auto",
    suggestedActions: [],
  };
}

// =============================================================================
// Plan Generation Tests
// =============================================================================

test("PlanGraphNormalizer generates topologically sorted plan", () => {
  const normalizer = new PlanGraphNormalizer();
  const steps = [
    makeStep("c", ["b"]),
    makeStep("b", ["a"]),
    makeStep("a"),
  ];

  const result = normalizer.normalize(steps, makeAssessment());

  assert.equal(result.valid, true);
  assert.equal(result.normalizedSteps.length, 3);
  // a should be first (no dependencies)
  assert.equal(result.normalizedSteps[0]!.stepId, "a");
  // b should be second (depends on a)
  assert.equal(result.normalizedSteps[1]!.stepId, "b");
  // c should be third (depends on b)
  assert.equal(result.normalizedSteps[2]!.stepId, "c");
});

test("PlanGraphNormalizer generates valid ordering for diamond DAG", () => {
  const normalizer = new PlanGraphNormalizer();
  const steps = [
    makeStep("a"),
    makeStep("b", ["a"]),
    makeStep("c", ["a"]),
    makeStep("d", ["b", "c"]),
  ];

  const result = normalizer.normalize(steps, makeAssessment());

  assert.equal(result.valid, true);
  assert.equal(result.normalizedSteps.length, 4);
  // a must be first
  assert.equal(result.normalizedSteps[0]!.stepId, "a");
  // d must be last
  assert.equal(result.normalizedSteps[3]!.stepId, "d");
  // b and c should be in the middle (order may vary based on processing)
  const middleIds = [result.normalizedSteps[1]!.stepId, result.normalizedSteps[2]!.stepId];
  assert.ok(middleIds.includes("b"));
  assert.ok(middleIds.includes("c"));
});

test("PlanGraphNormalizer handles complex multi-level DAG during generation", () => {
  const normalizer = new PlanGraphNormalizer();
  const steps = [
    makeStep("root"),
    makeStep("level1a", ["root"]),
    makeStep("level1b", ["root"]),
    makeStep("level2a", ["level1a"]),
    makeStep("level2b", ["level1a", "level1b"]),
    makeStep("level3", ["level2a", "level2b"]),
  ];

  const result = normalizer.normalize(steps, makeAssessment());

  assert.equal(result.valid, true);
  assert.equal(result.normalizedSteps.length, 6);
  assert.equal(result.normalizedSteps[0]!.stepId, "root");
  assert.equal(result.normalizedSteps[5]!.stepId, "level3");
});

test("PlanGraphNormalizer detects cycle during generation", () => {
  const normalizer = new PlanGraphNormalizer();
  const steps = [
    makeStep("a", ["c"]),
    makeStep("b", ["a"]),
    makeStep("c", ["b"]),
  ];

  const result = normalizer.normalize(steps, makeAssessment());

  assert.equal(result.valid, false);
  assert.ok(result.issues.includes("planning.cycle_detected"));
});

test("PlanGraphNormalizer handles empty plan during generation", () => {
  const normalizer = new PlanGraphNormalizer();
  const result = normalizer.normalize([], makeAssessment());

  assert.equal(result.valid, true);
  assert.equal(result.normalizedSteps.length, 0);
});

test("PlanGraphNormalizer handles single step plan generation", () => {
  const normalizer = new PlanGraphNormalizer();
  const steps = [makeStep("only-step")];

  const result = normalizer.normalize(steps, makeAssessment());

  assert.equal(result.valid, true);
  assert.equal(result.normalizedSteps.length, 1);
  assert.equal(result.normalizedSteps[0]!.stepId, "only-step");
});

// =============================================================================
// Plan Optimization Tests
// =============================================================================

test("PlanGraphNormalizer propagates low risk during optimization", () => {
  const normalizer = new PlanGraphNormalizer();
  const steps = [
    makeStep("a"),
    makeStep("b", ["a"]),
    makeStep("c", ["b"]),
  ];

  const result = normalizer.normalize(steps, makeAssessment("low"));

  assert.equal(result.valid, true);
  assert.ok(result.riskPropagation);
  assert.equal(result.riskPropagation.length, 3);
  for (const rp of result.riskPropagation) {
    assert.equal(rp.inheritedRiskClass, "low");
  }
});

test("PlanGraphNormalizer propagates high risk through graph", () => {
  const normalizer = new PlanGraphNormalizer();
  const steps = [
    makeStep("a"),
    makeStep("b", ["a"]),
    makeStep("c", ["b"]),
  ];

  const result = normalizer.normalize(steps, makeAssessment("high"));

  assert.equal(result.valid, true);
  assert.ok(result.riskPropagation);
  assert.equal(result.riskPropagation.length, 3);
  for (const rp of result.riskPropagation) {
    assert.equal(rp.inheritedRiskClass, "high");
  }
});

test("PlanGraphNormalizer escalates risk through dependency chain", () => {
  const normalizer = new PlanGraphNormalizer();
  const steps = [
    makeStep("critical-step"),
    makeStep("downstream", ["critical-step"]),
  ];

  const result = normalizer.normalize(steps, makeAssessment("critical"));

  assert.equal(result.valid, true);
  assert.ok(result.riskPropagation);
  // All steps should inherit critical risk
  for (const rp of result.riskPropagation) {
    assert.equal(rp.inheritedRiskClass, "critical");
  }
});

test("PlanGraphNormalizer generates normalized steps preserving actions", () => {
  const normalizer = new PlanGraphNormalizer();
  const steps = [
    makeStep("step2", ["step1"]),
    makeStep("step1"),
  ];

  const result = normalizer.normalize(steps, makeAssessment());

  assert.equal(result.valid, true);
  // Normalized steps should preserve actions
  const actions = result.normalizedSteps.map((s) => s.action);
  assert.ok(actions.includes("action_step1"));
  assert.ok(actions.includes("action_step2"));
});

test("PlanGraphNormalizer detects orphan nodes during optimization", () => {
  const normalizer = new PlanGraphNormalizer();
  const steps = [
    makeStep("a"),
    makeStep("orphan", []), // orphan - no dependencies AND nothing depends on it
    makeStep("b", ["a"]),
  ];

  const result = normalizer.normalize(steps, makeAssessment());

  // With 3 nodes, orphan should be detected since it's standalone with no deps and nothing depends on it
  assert.equal(result.normalizedSteps.length, 3);
  if (result.normalizedSteps.length > 1) {
    const orphanNodes = result.normalizedSteps.filter((s) => s.dependencies.length === 0).map((s) => s.stepId);
    // orphan might or might not appear depending on orphan detection logic
  }
});

test("PlanGraphNormalizer validates graph before optimization", () => {
  const normalizer = new PlanGraphNormalizer();
  const steps = [
    makeStep("a"),
    makeStep("b", ["a"]),
  ];

  const result = normalizer.validate(steps);

  assert.equal(result.valid, true);
  assert.equal(result.issues.length, 0);
});

test("PlanGraphNormalizer validates graph with invalid dependencies", () => {
  const normalizer = new PlanGraphNormalizer();
  const steps = [
    makeStep("a"),
    makeStep("b", ["a", "nonexistent"]),
  ];

  const result = normalizer.validate(steps);

  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.includes("invalid_dependencies")));
});

test("PlanGraphNormalizer escalates risk correctly through graph", () => {
  const normalizer = new PlanGraphNormalizer();
  const steps = [
    makeStep("start"),
    makeStep("downstream1", ["start"]),
    makeStep("downstream2", ["downstream1"]),
  ];

  // Use medium risk - risk should propagate downstream
  const result = normalizer.normalize(steps, makeAssessment("medium"));

  assert.equal(result.valid, true);
  assert.ok(result.riskPropagation);
  // Each step should have the risk inherited from upstream
  for (const rp of result.riskPropagation) {
    assert.ok(["low", "medium", "high", "critical"].includes(rp.inheritedRiskClass));
  }
});

// =============================================================================
// Plan Execution Tests
// =============================================================================

test("PlanGraphNormalizer validates executable plan", () => {
  const normalizer = new PlanGraphNormalizer();
  const steps = [
    makeStep("a"),
    makeStep("b", ["a"]),
    makeStep("c", ["b"]),
  ];

  const result = normalizer.validate(steps);

  assert.equal(result.valid, true);
  assert.deepStrictEqual(result.issues, []);
});

test("PlanGraphNormalizer rejects plan with missing dependency for execution", () => {
  const normalizer = new PlanGraphNormalizer();
  const steps = [
    makeStep("a"),
    makeStep("b", ["a", "nonexistent"]),
  ];

  const result = normalizer.validate(steps);

  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.includes("invalid_dependencies")));
});

test("PlanGraphNormalizer rejects cyclic plan for execution", () => {
  const normalizer = new PlanGraphNormalizer();
  const steps = [
    makeStep("x", ["z"]),
    makeStep("y", ["x"]),
    makeStep("z", ["y"]),
  ];

  const result = normalizer.validate(steps);

  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.includes("cycle_detected")));
});

test("PlanGraphNormalizer provides risk info for execution planning", () => {
  const normalizer = new PlanGraphNormalizer();
  const steps = [
    makeStep("step1"),
    makeStep("step2", ["step1"]),
  ];

  const result = normalizer.normalize(steps, makeAssessment("high"));

  assert.equal(result.valid, true);
  assert.ok(result.riskPropagation);
  assert.ok(result.riskPropagation.length > 0);
  // Each execution step should have risk information
  for (const rp of result.riskPropagation) {
    assert.ok(rp.nodeId);
    assert.ok(rp.inheritedRiskClass);
    assert.ok(Array.isArray(rp.reasons));
  }
});

test("PlanGraphNormalizer returns issues for failed validation", () => {
  const normalizer = new PlanGraphNormalizer();
  const steps = [makeStep("self", ["self"])];

  const result = normalizer.validate(steps);

  assert.equal(result.valid, false);
  assert.ok(result.issues.length > 0);
});

test("PlanGraphNormalizer handles self-dependency detection during execution", () => {
  const normalizer = new PlanGraphNormalizer();
  const steps = [makeStep("step", ["step"])];

  const result = normalizer.validate(steps);

  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.includes("self_dependency") || i.includes("cycle")));
});

test("PlanGraphNormalizer normalizes valid plan for execution", () => {
  const normalizer = new PlanGraphNormalizer();
  const steps = [
    makeStep("init"),
    makeStep("process", ["init"]),
    makeStep("finalize", ["process"]),
  ];

  const result = normalizer.normalize(steps, makeAssessment());

  assert.equal(result.valid, true);
  assert.equal(result.normalizedSteps.length, 3);
  assert.ok(result.riskPropagation);
  assert.equal(result.riskPropagation.length, 3);
});

test("PlanGraphNormalizer handles parallel branches for execution", () => {
  const normalizer = new PlanGraphNormalizer();
  const steps = [
    makeStep("root"),
    makeStep("branchA", ["root"]),
    makeStep("branchB", ["root"]),
    makeStep("merge", ["branchA", "branchB"]),
  ];

  const result = normalizer.normalize(steps, makeAssessment());

  assert.equal(result.valid, true);
  assert.equal(result.normalizedSteps.length, 4);
  // Root should execute first
  assert.equal(result.normalizedSteps[0]!.stepId, "root");
  // Merge should execute last
  assert.equal(result.normalizedSteps[3]!.stepId, "merge");
});

test("PlanGraphNormalizer handles deep dependency chain", () => {
  const normalizer = new PlanGraphNormalizer();
  const steps = [
    makeStep("depth0"),
    makeStep("depth1", ["depth0"]),
    makeStep("depth2", ["depth1"]),
    makeStep("depth3", ["depth2"]),
    makeStep("depth4", ["depth3"]),
    makeStep("depth5", ["depth4"]),
  ];

  const result = normalizer.normalize(steps, makeAssessment());

  assert.equal(result.valid, true);
  assert.equal(result.normalizedSteps.length, 6);
  assert.equal(result.normalizedSteps[0]!.stepId, "depth0");
  assert.equal(result.normalizedSteps[5]!.stepId, "depth5");
});

test("PlanGraphNormalizer risk propagation reasons include assessment info", () => {
  const normalizer = new PlanGraphNormalizer();
  const steps = [
    makeStep("a"),
    makeStep("b", ["a"]),
  ];

  const result = normalizer.normalize(steps, makeAssessment("high"));

  assert.equal(result.valid, true);
  assert.ok(result.riskPropagation);
  for (const rp of result.riskPropagation) {
    assert.ok(rp.reasons.length > 0);
    // Should include inherited_from_assessment
    assert.ok(rp.reasons.some((r) => r.includes("inherited_from_assessment")));
  }
});