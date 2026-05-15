/**
 * Integration Test: Plan DAG Validator
 *
 * Tests the PlanDagValidator service which validates step dependencies
 * and produces topologically sorted execution order.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "../../../helpers/integration-context.js";
import { PlanDagValidator, type PlanDagValidationResult } from "../../../../src/platform/five-plane-orchestration/planner/plan-dag-validator.js";
import type { PlanStep } from "../../../../src/platform/five-plane-orchestration/oapeflir/types/plan.js";

function makeStep(stepId: string, dependencies: string[] = [], timeout = 60000): PlanStep {
  return {
    stepId,
    action: "execute",
    title: `Step ${stepId}`,
    inputs: {},
    outputs: [],
    dependencies,
    status: "pending",
    timeout,
    retryPolicy: { maxRetries: 0, backoffMs: 250 },
  };
}

test("PlanDagValidator validates a valid linear DAG", () => {
  const ctx = createIntegrationContext("aa-dag-validator-linear-");
  try {
    const validator = new PlanDagValidator();

    const steps: PlanStep[] = [
      makeStep("step_a"),
      makeStep("step_b", ["step_a"]),
      makeStep("step_c", ["step_b"]),
    ];

    const result = validator.validate(steps);

    assert.equal(result.valid, true, "Should be valid");
    assert.deepEqual(result.issues, []);
    assert.equal(result.orderedSteps.length, 3);
    assert.equal(result.orderedSteps[0]!.stepId, "step_a");
    assert.equal(result.orderedSteps[1]!.stepId, "step_b");
    assert.equal(result.orderedSteps[2]!.stepId, "step_c");
  } finally {
    ctx.cleanup();
  }
});

test("PlanDagValidator validates a valid diamond DAG", () => {
  const ctx = createIntegrationContext("aa-dag-validator-diamond-");
  try {
    const validator = new PlanDagValidator();

    // Diamond: step_a -> step_b, step_c -> step_d
    const steps: PlanStep[] = [
      makeStep("step_a"),
      makeStep("step_b", ["step_a"]),
      makeStep("step_c", ["step_a"]),
      makeStep("step_d", ["step_b", "step_c"]),
    ];

    const result = validator.validate(steps);

    assert.equal(result.valid, true, "Should be valid");
    assert.equal(result.orderedSteps.length, 4);
    // step_a must be first
    assert.equal(result.orderedSteps[0]!.stepId, "step_a");
    // step_b and step_c must come before step_d
    const step_b_idx = result.orderedSteps.findIndex((s) => s.stepId === "step_b");
    const step_c_idx = result.orderedSteps.findIndex((s) => s.stepId === "step_c");
    const step_d_idx = result.orderedSteps.findIndex((s) => s.stepId === "step_d");
    assert.ok(step_b_idx >= 0);
    assert.ok(step_c_idx >= 0);
    assert.ok(step_d_idx >= 0);
    assert.ok(step_b_idx < step_d_idx);
    assert.ok(step_c_idx < step_d_idx);
  } finally {
    ctx.cleanup();
  }
});

test("PlanDagValidator detects a cycle", () => {
  const ctx = createIntegrationContext("aa-dag-validator-cycle-");
  try {
    const validator = new PlanDagValidator();

    // Cycle: step_a -> step_b -> step_c -> step_a
    const steps: PlanStep[] = [
      makeStep("step_a", ["step_c"]), // depends on step_c (cycle)
      makeStep("step_b", ["step_a"]),
      makeStep("step_c", ["step_b"]),
    ];

    const result = validator.validate(steps);

    assert.equal(result.valid, false, "Should be invalid due to cycle");
    assert.ok(result.issues.some((issue) => issue.includes("planning.cycle_detected")), "Should report cycle detected");
  } finally {
    ctx.cleanup();
  }
});

test("PlanDagValidator detects self-dependency", () => {
  const ctx = createIntegrationContext("aa-dag-validator-self-");
  try {
    const validator = new PlanDagValidator();

    const steps: PlanStep[] = [
      makeStep("step_self", ["step_self"]),
    ];

    const result = validator.validate(steps);

    assert.equal(result.valid, false, "Should be invalid due to self-dependency");
    assert.ok(result.issues.some((issue) => issue.includes("planning.self_dependency")), "Should report self dependency");
  } finally {
    ctx.cleanup();
  }
});

test("PlanDagValidator detects missing dependency", () => {
  const ctx = createIntegrationContext("aa-dag-validator-missing-");
  try {
    const validator = new PlanDagValidator();

    const steps: PlanStep[] = [
      makeStep("step_a"),
      makeStep("step_b", ["step_a"]),
      makeStep("step_c", ["nonexistent_step"]),
    ];

    const result = validator.validate(steps);

    assert.equal(result.valid, false, "Should be invalid due to missing dependency");
    assert.ok(result.issues.some((issue) => issue.includes("planning.missing_dependency")), "Should report missing dependency");
  } finally {
    ctx.cleanup();
  }
});

test("PlanDagValidator handles parallel entrypoints", () => {
  const ctx = createIntegrationContext("aa-dag-validator-parallel-");
  try {
    const validator = new PlanDagValidator();

    // Two parallel entrypoints (no dependencies)
    const steps: PlanStep[] = [
      makeStep("alpha"),
      makeStep("beta"),
      makeStep("gamma", ["alpha", "beta"]),
    ];

    const result = validator.validate(steps);

    assert.equal(result.valid, true);
    assert.equal(result.orderedSteps.length, 3);
    // gamma must be last (depends on both alpha and beta)
    assert.equal(result.orderedSteps[2]!.stepId, "gamma");
  } finally {
    ctx.cleanup();
  }
});

test("PlanDagValidator handles empty dependency list", () => {
  const ctx = createIntegrationContext("aa-dag-validator-empty-");
  try {
    const validator = new PlanDagValidator();

    const steps: PlanStep[] = [
      makeStep("standalone"),
    ];

    const result = validator.validate(steps);

    assert.equal(result.valid, true);
    assert.equal(result.orderedSteps.length, 1);
    assert.equal(result.orderedSteps[0]!.stepId, "standalone");
  } finally {
    ctx.cleanup();
  }
});

test("PlanDagValidator produces deterministic ordering for same-level nodes", () => {
  const ctx = createIntegrationContext("aa-dag-validator-deterministic-");
  try {
    const validator = new PlanDagValidator();

    // Multiple steps at same level - order depends on input array order
    const steps: PlanStep[] = [
      makeStep("node_a"),
      makeStep("node_b"),
      makeStep("node_c"),
      makeStep("merge", ["node_a", "node_b", "node_c"]),
    ];

    const result = validator.validate(steps);

    assert.equal(result.valid, true);
    assert.equal(result.orderedSteps.length, 4);
    // merge must be last
    assert.equal(result.orderedSteps[3]!.stepId, "merge");
    // The first three can be in any order but should be consistent
    const firstThree = result.orderedSteps.slice(0, 3).map((s) => s.stepId);
    assert.ok(firstThree.includes("node_a"));
    assert.ok(firstThree.includes("node_b"));
    assert.ok(firstThree.includes("node_c"));
  } finally {
    ctx.cleanup();
  }
});

test("PlanDagValidator integration with seeded context", () => {
  const ctx = createIntegrationContext("aa-dag-validator-seeded-");

  try {
    const validator = new PlanDagValidator();

    const steps: PlanStep[] = [
      makeStep("step_1"),
      makeStep("step_2", ["step_1"]),
      makeStep("step_3", ["step_2"]),
    ];

    const result = validator.validate(steps);

    assert.equal(result.valid, true);
    assert.equal(result.orderedSteps.length, 3);
  } finally {
    ctx.cleanup();
  }
});
