/**
 * Integration Tests: Plan DAG Validator
 *
 * Tests the PlanDagValidator which validates step dependencies
 * and produces topologically sorted execution order.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { PlanDagValidator } from "../../../../../src/platform/orchestration/planner/plan-dag-validator.js";
import type { PlanStep } from "../../../../../src/platform/orchestration/oapeflir/types/index.js";

function createStep(overrides: Partial<PlanStep> = {}): PlanStep {
  return {
    stepId: "step_" + Math.random().toString(36).slice(2, 8),
    action: "execute",
    title: "Test step",
    inputs: {},
    outputs: [],
    dependencies: [],
    status: "pending",
    timeout: 60000,
    retryPolicy: { maxRetries: 0, backoffMs: 250 },
    ...overrides,
  };
}

test("PlanDagValidator: validates valid linear dependency chain", () => {
  const validator = new PlanDagValidator();
  const steps: PlanStep[] = [
    createStep({ stepId: "step-1", dependencies: [] }),
    createStep({ stepId: "step-2", dependencies: ["step-1"] }),
    createStep({ stepId: "step-3", dependencies: ["step-2"] }),
  ];

  const result = validator.validate(steps);

  assert.equal(result.valid, true);
  assert.equal(result.issues.length, 0);
  assert.equal(result.orderedSteps.length, 3);
});

test("PlanDagValidator: detects self-dependency", () => {
  const validator = new PlanDagValidator();
  const steps: PlanStep[] = [
    createStep({ stepId: "self-step", dependencies: ["self-step"] }),
  ];

  const result = validator.validate(steps);

  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.includes("self_dependency")));
});

test("PlanDagValidator: detects missing dependency", () => {
  const validator = new PlanDagValidator();
  const steps: PlanStep[] = [
    createStep({ stepId: "orphan", dependencies: ["nonexistent"] }),
  ];

  const result = validator.validate(steps);

  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.includes("missing_dependency")));
});

test("PlanDagValidator: detects cycle in diamond pattern", () => {
  const validator = new PlanDagValidator();
  const steps: PlanStep[] = [
    createStep({ stepId: "a", dependencies: ["c"] }),
    createStep({ stepId: "b", dependencies: ["a"] }),
    createStep({ stepId: "c", dependencies: ["b"] }),
  ];

  const result = validator.validate(steps);

  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.includes("cycle")));
});

test("PlanDagValidator: produces correct topological order for diamond", () => {
  const validator = new PlanDagValidator();
  const steps: PlanStep[] = [
    createStep({ stepId: "start", dependencies: [] }),
    createStep({ stepId: "a", dependencies: ["start"] }),
    createStep({ stepId: "b", dependencies: ["start"] }),
    createStep({ stepId: "end", dependencies: ["a", "b"] }),
  ];

  const result = validator.validate(steps);

  assert.equal(result.valid, true);
  assert.equal(result.orderedSteps[0].stepId, "start");
  assert.ok(["a", "b"].includes(result.orderedSteps[1].stepId));
  assert.ok(["a", "b"].includes(result.orderedSteps[2].stepId));
  assert.equal(result.orderedSteps[3].stepId, "end");
});

test("PlanDagValidator: handles multiple roots", () => {
  const validator = new PlanDagValidator();
  const steps: PlanStep[] = [
    createStep({ stepId: "root-1", dependencies: [] }),
    createStep({ stepId: "root-2", dependencies: [] }),
    createStep({ stepId: "merge", dependencies: ["root-1", "root-2"] }),
  ];

  const result = validator.validate(steps);

  assert.equal(result.valid, true);
  assert.equal(result.orderedSteps.length, 3);
});

test("PlanDagValidator: detects cycle in partial graph", () => {
  const validator = new PlanDagValidator();
  // This graph has a cycle: a->b->c->a
  // But also has an independent node "orphan" with no dependencies
  const steps: PlanStep[] = [
    createStep({ stepId: "orphan", dependencies: [] }),
    createStep({ stepId: "a", dependencies: ["c"] }),
    createStep({ stepId: "b", dependencies: ["a"] }),
    createStep({ stepId: "c", dependencies: ["b"] }),
  ];

  const result = validator.validate(steps);

  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.includes("cycle")));
});

test("PlanDagValidator: handles complex DAG with multiple join points", () => {
  const validator = new PlanDagValidator();
  const steps: PlanStep[] = [
    createStep({ stepId: "init", dependencies: [] }),
    createStep({ stepId: "branch-a1", dependencies: ["init"] }),
    createStep({ stepId: "branch-a2", dependencies: ["init"] }),
    createStep({ stepId: "join-a", dependencies: ["branch-a1", "branch-a2"] }),
    createStep({ stepId: "branch-b1", dependencies: ["join-a"] }),
    createStep({ stepId: "branch-b2", dependencies: ["join-a"] }),
    createStep({ stepId: "final", dependencies: ["branch-b1", "branch-b2"] }),
  ];

  const result = validator.validate(steps);

  assert.equal(result.valid, true);
  assert.equal(result.orderedSteps.length, 7);
  assert.equal(result.orderedSteps[0].stepId, "init");
  assert.equal(result.orderedSteps[6].stepId, "final");
});
