/**
 * Plan DAG Validator Unit Tests
 */

import assert from "node:assert/strict";
import test from "node:test";

import { PlanDagValidator } from "../../../../../src/platform/five-plane-orchestration/planner/plan-dag-validator.js";

function makeStep(overrides: Partial<{
  stepId: string;
  action: string;
  title: string;
  timeout: number;
  retryPolicy: { maxRetries: number; backoffMs: number };
  dependencies: string[];
  inputs: Record<string, unknown>;
}> = {}): {
  stepId: string;
  action: string;
  title: string;
  timeout: number;
  retryPolicy: { maxRetries: number; backoffMs: number };
  dependencies: string[];
  status: string;
  inputs: Record<string, unknown>;
  outputs: string[];
} {
  return {
    stepId: "step-1",
    action: "execute",
    title: "Step 1",
    timeout: 60000,
    retryPolicy: { maxRetries: 0, backoffMs: 250 },
    dependencies: [],
    status: "pending",
    inputs: {},
    outputs: [],
    ...overrides,
  };
}

test("PlanDagValidator.validate returns valid for empty steps", () => {
  const validator = new PlanDagValidator();
  const result = validator.validate([]);

  assert.equal(result.valid, true);
  assert.equal(result.issues.length, 0);
});

test("PlanDagValidator.validate returns valid for single step", () => {
  const validator = new PlanDagValidator();
  const steps = [makeStep({ stepId: "step-1", title: "Initialize" })];
  const result = validator.validate(steps);

  assert.equal(result.valid, true);
  assert.ok(result.orderedSteps.length >= 1);
});

test("PlanDagValidator.validate detects self-dependency", () => {
  const validator = new PlanDagValidator();
  const steps = [makeStep({ stepId: "step-1", dependencies: ["step-1"] })];
  const result = validator.validate(steps);

  assert.equal(result.valid, false);
  assert.ok(result.issues.some(i => i.includes("self_dependency")));
});

test("PlanDagValidator.validate detects missing dependency", () => {
  const validator = new PlanDagValidator();
  const steps = [makeStep({ stepId: "step-1", dependencies: ["non-existent"] })];
  const result = validator.validate(steps);

  assert.equal(result.valid, false);
  assert.ok(result.issues.some(i => i.includes("missing_dependency")));
});

test("PlanDagValidator.validate detects cycle", () => {
  const validator = new PlanDagValidator();
  const steps = [
    makeStep({ stepId: "step-1", dependencies: ["step-2"] }),
    makeStep({ stepId: "step-2", dependencies: ["step-1"] }),
  ];
  const result = validator.validate(steps);

  assert.equal(result.valid, false);
  assert.ok(result.issues.some(i => i.includes("cycle")));
});

test("PlanDagValidator.validate returns correct ordering for linear DAG", () => {
  const validator = new PlanDagValidator();
  const steps = [
    makeStep({ stepId: "step-1", title: "First" }),
    makeStep({ stepId: "step-2", dependencies: ["step-1"], title: "Second" }),
    makeStep({ stepId: "step-3", dependencies: ["step-2"], title: "Third" }),
  ];
  const result = validator.validate(steps);

  assert.equal(result.valid, true);
  assert.equal(result.orderedSteps[0]?.stepId, "step-1");
  assert.equal(result.orderedSteps[1]?.stepId, "step-2");
  assert.equal(result.orderedSteps[2]?.stepId, "step-3");
});

test("PlanDagValidator.validate handles parallel branches", () => {
  const validator = new PlanDagValidator();
  const steps = [
    makeStep({ stepId: "step-1", title: "Root" }),
    makeStep({ stepId: "step-2", dependencies: ["step-1"], title: "Branch A" }),
    makeStep({ stepId: "step-3", dependencies: ["step-1"], title: "Branch B" }),
    makeStep({ stepId: "step-4", dependencies: ["step-2", "step-3"], title: "Join" }),
  ];
  const result = validator.validate(steps);

  assert.equal(result.valid, true);
  assert.equal(result.orderedSteps.length, 4);
  // step-4 should come after both step-2 and step-3
  const step4Index = result.orderedSteps.findIndex(s => s.stepId === "step-4");
  const step2Index = result.orderedSteps.findIndex(s => s.stepId === "step-2");
  const step3Index = result.orderedSteps.findIndex(s => s.stepId === "step-3");
  assert.ok(step4Index > step2Index);
  assert.ok(step4Index > step3Index);
});

test("PlanDagValidator.validate detects missing title", () => {
  const validator = new PlanDagValidator();
  const steps = [makeStep({ stepId: "step-1", title: "" })];
  const result = validator.validate(steps);

  assert.equal(result.valid, false);
  assert.ok(result.issues.some(i => i.includes("missing_title")));
});

test("PlanDagValidator.validate detects invalid timeout", () => {
  const validator = new PlanDagValidator();
  const steps = [makeStep({ stepId: "step-1", timeout: 0 })];
  const result = validator.validate(steps);

  assert.equal(result.valid, false);
  assert.ok(result.issues.some(i => i.includes("invalid_timeout")));
});

test("PlanDagValidator.validate detects invalid retry max", () => {
  const validator = new PlanDagValidator();
  const steps = [makeStep({ stepId: "step-1", retryPolicy: { maxRetries: -1, backoffMs: 250 } })];
  const result = validator.validate(steps);

  assert.equal(result.valid, false);
  assert.ok(result.issues.some(i => i.includes("invalid_retry_max")));
});

test("PlanDagValidator.analyzeWorstPath returns null for empty steps", () => {
  const validator = new PlanDagValidator();
  const result = validator.analyzeWorstPath([]);

  assert.equal(result, null);
});

test("PlanDagValidator.analyzeWorstPath returns path for linear chain", () => {
  const validator = new PlanDagValidator();
  const steps = [
    makeStep({ stepId: "step-1", timeout: 1000, retryPolicy: { maxRetries: 0, backoffMs: 100 } }),
    makeStep({ stepId: "step-2", dependencies: ["step-1"], timeout: 2000, retryPolicy: { maxRetries: 1, backoffMs: 100 } }),
    makeStep({ stepId: "step-3", dependencies: ["step-2"], timeout: 1500, retryPolicy: { maxRetries: 0, backoffMs: 100 } }),
  ];
  const result = validator.analyzeWorstPath(steps);

  assert.ok(result !== null);
  assert.ok(result.pathNodeIds.length >= 1);
  assert.ok(result.estimatedTimeoutMs > 0);
});

test("PlanDagValidator.analyzeWorstPath finds highest cost path", () => {
  const validator = new PlanDagValidator();
  // Create a diamond shape where step-2 and step-3 are parallel but step-2 is slower
  const steps = [
    makeStep({ stepId: "step-1", timeout: 1000, retryPolicy: { maxRetries: 0, backoffMs: 100 } }),
    makeStep({ stepId: "step-2", dependencies: ["step-1"], timeout: 5000, retryPolicy: { maxRetries: 0, backoffMs: 100 } }),
    makeStep({ stepId: "step-3", dependencies: ["step-1"], timeout: 1000, retryPolicy: { maxRetries: 0, backoffMs: 100 } }),
    makeStep({ stepId: "step-4", dependencies: ["step-2", "step-3"], timeout: 1000, retryPolicy: { maxRetries: 0, backoffMs: 100 } }),
  ];
  const result = validator.analyzeWorstPath(steps);

  assert.ok(result !== null);
  // step-2 path should be more expensive
  assert.ok(result.estimatedCost >= 5000);
});