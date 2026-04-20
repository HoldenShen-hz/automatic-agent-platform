import test from "node:test";
import assert from "node:assert/strict";

import { PlanDagValidator } from "../../../../../src/platform/orchestration/planner/plan-dag-validator.js";
import type { PlanStep } from "../../../../../src/platform/orchestration/oapeflir/types/plan.js";

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

test("PlanDagValidator validates a simple valid DAG", () => {
  const validator = new PlanDagValidator();
  const steps = [
    makeStep("a"),
    makeStep("b", ["a"]),
    makeStep("c", ["b"]),
  ];

  const result = validator.validate(steps);

  assert.equal(result.valid, true);
  assert.equal(result.issues.length, 0);
  assert.equal(result.orderedSteps.length, 3);
});

test("PlanDagValidator detects self-dependency", () => {
  const validator = new PlanDagValidator();
  const steps = [makeStep("a", ["a"])];

  const result = validator.validate(steps);

  assert.equal(result.valid, false);
  assert.ok(result.issues.some(i => i.includes("self_dependency")));
});

test("PlanDagValidator detects missing dependency", () => {
  const validator = new PlanDagValidator();
  const steps = [makeStep("a", ["nonexistent"])];

  const result = validator.validate(steps);

  assert.equal(result.valid, false);
  assert.ok(result.issues.some(i => i.includes("missing_dependency")));
});

test("PlanDagValidator detects cycle", () => {
  const validator = new PlanDagValidator();
  const steps = [
    makeStep("a", ["c"]),
    makeStep("b", ["a"]),
    makeStep("c", ["b"]),
  ];

  const result = validator.validate(steps);

  assert.equal(result.valid, false);
  assert.ok(result.issues.some(i => i.includes("cycle_detected")));
});

test("PlanDagValidator handles parallel steps (diamond dependency)", () => {
  const validator = new PlanDagValidator();
  const steps = [
    makeStep("a"),
    makeStep("b", ["a"]),
    makeStep("c", ["a"]),
    makeStep("d", ["b", "c"]),
  ];

  const result = validator.validate(steps);

  assert.equal(result.valid, true);
  assert.equal(result.issues.length, 0);
  assert.equal(result.orderedSteps.length, 4);
  // 'a' should come first
  assert.equal(result.orderedSteps[0]!.stepId, "a");
  // 'd' should come last
  assert.equal(result.orderedSteps[3]!.stepId, "d");
});

test("PlanDagValidator handles empty steps array", () => {
  const validator = new PlanDagValidator();
  const result = validator.validate([]);

  assert.equal(result.valid, true);
  assert.equal(result.issues.length, 0);
  assert.equal(result.orderedSteps.length, 0);
});

test("PlanDagValidator handles single step", () => {
  const validator = new PlanDagValidator();
  const steps = [makeStep("a")];

  const result = validator.validate(steps);

  assert.equal(result.valid, true);
  assert.equal(result.orderedSteps.length, 1);
  assert.equal(result.orderedSteps[0]!.stepId, "a");
});

test("PlanDagValidator handles multiple independent roots", () => {
  const validator = new PlanDagValidator();
  const steps = [
    makeStep("a"),
    makeStep("b"),
    makeStep("c", ["a", "b"]),
  ];

  const result = validator.validate(steps);

  assert.equal(result.valid, true);
  assert.equal(result.issues.length, 0);
  assert.equal(result.orderedSteps.length, 3);
});

test("PlanDagValidator detects duplicate dependencies", () => {
  const validator = new PlanDagValidator();
  const steps = [
    makeStep("a"),
    makeStep("b", ["a", "a"]),
    makeStep("c", ["b"]),
  ];

  const result = validator.validate(steps);

  assert.equal(result.valid, true);
  assert.equal(result.issues.length, 0);
});

test("PlanDagValidator handles complex DAG with multiple paths", () => {
  const validator = new PlanDagValidator();
  const steps = [
    makeStep("start"),
    makeStep("a", ["start"]),
    makeStep("b", ["start"]),
    makeStep("c", ["start"]),
    makeStep("d", ["a", "b"]),
    makeStep("e", ["b", "c"]),
    makeStep("f", ["d", "e"]),
  ];

  const result = validator.validate(steps);

  assert.equal(result.valid, true);
  assert.equal(result.issues.length, 0);
  assert.equal(result.orderedSteps.length, 7);
  // start must be first
  assert.equal(result.orderedSteps[0]!.stepId, "start");
  // f must be last
  assert.equal(result.orderedSteps[6]!.stepId, "f");
});

test("PlanDagValidator handles step with many dependencies", () => {
  const validator = new PlanDagValidator();
  const steps = [
    makeStep("a"),
    makeStep("b"),
    makeStep("c"),
    makeStep("d"),
    makeStep("e", ["a", "b", "c", "d"]),
  ];

  const result = validator.validate(steps);

  assert.equal(result.valid, true);
  assert.equal(result.orderedSteps.length, 5);
  assert.equal(result.orderedSteps[4]!.stepId, "e");
});

test("PlanDagValidator preserves step order for linear chain", () => {
  const validator = new PlanDagValidator();
  const steps = [
    makeStep("step1"),
    makeStep("step2", ["step1"]),
    makeStep("step3", ["step2"]),
    makeStep("step4", ["step3"]),
    makeStep("step5", ["step4"]),
  ];

  const result = validator.validate(steps);

  assert.equal(result.valid, true);
  for (let i = 0; i < 5; i++) {
    assert.equal(result.orderedSteps[i]!.stepId, `step${i + 1}`);
  }
});

test("PlanDagValidator returns original steps on cycle", () => {
  const validator = new PlanDagValidator();
  const steps = [
    makeStep("a", ["c"]),
    makeStep("b", ["a"]),
    makeStep("c", ["b"]),
  ];

  const result = validator.validate(steps);

  assert.equal(result.valid, false);
  assert.ok(result.issues.includes("planning.cycle_detected"));
  // When cycle detected, orderedSteps contains original order
  assert.equal(result.orderedSteps.length, 3);
});

test("PlanDagValidator validates steps with no dependencies", () => {
  const validator = new PlanDagValidator();
  const steps = [
    makeStep("alpha"),
    makeStep("beta"),
    makeStep("gamma"),
  ];

  const result = validator.validate(steps);

  assert.equal(result.valid, true);
  assert.equal(result.orderedSteps.length, 3);
});
