import assert from "node:assert/strict";
import test from "node:test";

import { PlanDagValidator } from "../../../../../src/platform/five-plane-orchestration/planner/plan-dag-validator.js";
import type { PlanStep } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/plan.js";

function makeStep(overrides: Partial<PlanStep> = {}): PlanStep {
  return {
    stepId: overrides.stepId ?? "step-1",
    action: overrides.action ?? "execute",
    title: overrides.title ?? "Step 1",
    inputs: overrides.inputs ?? {},
    outputs: overrides.outputs ?? [],
    dependencies: overrides.dependencies ?? [],
    status: overrides.status ?? "pending",
    timeout: overrides.timeout ?? 1_000,
    retryPolicy: overrides.retryPolicy ?? { maxRetries: 0, backoffMs: 0 },
    ...(overrides.outputSchemaPath !== undefined ? { outputSchemaPath: overrides.outputSchemaPath } : {}),
  };
}

test("PlanDagValidator accepts valid DAGs and produces topological order", () => {
  const validator = new PlanDagValidator();
  const steps = [
    makeStep({ stepId: "step-1", title: "root" }),
    makeStep({ stepId: "step-2", dependencies: ["step-1"], title: "branch-a" }),
    makeStep({ stepId: "step-3", dependencies: ["step-1"], title: "branch-b" }),
    makeStep({ stepId: "step-4", dependencies: ["step-2", "step-3"], title: "join" }),
  ];

  const result = validator.validate(steps);

  assert.equal(result.valid, true);
  assert.deepEqual(result.orderedSteps.map((step) => step.stepId), ["step-1", "step-2", "step-3", "step-4"]);
});

test("PlanDagValidator flags missing dependencies and self-dependencies", () => {
  const validator = new PlanDagValidator();

  const result = validator.validate([
    makeStep({ stepId: "step-1", dependencies: ["step-1", "step-404"] }),
  ]);

  assert.equal(result.valid, false);
  assert.ok(result.issues.includes("planning.self_dependency:step-1"));
  assert.ok(result.issues.includes("planning.missing_dependency:step-1:step-404"));
});

test("PlanDagValidator detects structural cycles", () => {
  const validator = new PlanDagValidator();

  const result = validator.validate([
    makeStep({ stepId: "step-1", dependencies: ["step-2"] }),
    makeStep({ stepId: "step-2", dependencies: ["step-1"] }),
  ]);

  assert.equal(result.valid, false);
  assert.ok(result.issues.includes("planning.cycle_detected"));
});

test("PlanDagValidator validates title, timeout, and retry policy fields", () => {
  const validator = new PlanDagValidator();

  const result = validator.validate([
    makeStep({
      stepId: "step-1",
      title: "",
      timeout: 0,
      retryPolicy: { maxRetries: -1, backoffMs: 0 },
    }),
  ]);

  assert.equal(result.valid, false);
  assert.ok(result.issues.includes("planning.missing_title:step-1"));
  assert.ok(result.issues.includes("planning.invalid_timeout:step-1"));
  assert.ok(result.issues.includes("planning.invalid_retry_max:step-1"));
});

test("PlanDagValidator analyzeWorstPath returns the most expensive chain", () => {
  const validator = new PlanDagValidator();
  const steps = [
    makeStep({ stepId: "step-1", timeout: 1_000 }),
    makeStep({ stepId: "step-2", dependencies: ["step-1"], timeout: 5_000 }),
    makeStep({ stepId: "step-3", dependencies: ["step-1"], timeout: 500 }),
    makeStep({ stepId: "step-4", dependencies: ["step-2", "step-3"], timeout: 2_000 }),
  ];

  const result = validator.analyzeWorstPath(steps);

  assert.ok(result);
  assert.deepEqual(result?.pathNodeIds, ["step-1", "step-2", "step-4"]);
  assert.equal(result?.estimatedTimeoutMs, 8_000);
  assert.equal(result?.estimatedCost, 8_000);
});
