import test from "node:test";
import assert from "node:assert/strict";
import {
  HarnessLoopController,
  type HarnessLoopGuards,
  type HarnessLoopState,
  type HarnessLoopProgress,
} from "../../../../../src/platform/five-plane-orchestration/harness/loop/index.js";
import type { ConstraintPack, HarnessDecisionAction } from "../../../../../src/platform/five-plane-orchestration/harness/index.js";

function createConstraintPack(overrides: Partial<ConstraintPack> = {}): ConstraintPack {
  return {
    policyIds: ["policy.default"],
    approvalMode: "supervised",
    autonomyMode: "supervised",
    toolPolicy: { allowedTools: ["read", "summarize"] },
    risk_policy: { maxRiskScore: 70, escalationThreshold: 55 },
    output_policy: { requiredEvidence: ["risk_profile"], redactSensitiveData: true },
    budget: { maxSteps: 9, maxCost: 5, maxDurationMs: 60_000 },
    ...overrides,
  };
}

test("HarnessLoopController constructor computes maxIterations from budget.maxSteps / 3", () => {
  const controller = new HarnessLoopController(createConstraintPack({ budget: { maxSteps: 9, maxCost: 5, maxDurationMs: 60_000 } }));
  assert.equal(controller.getGuards().maxIterations, 3);

  const controller2 = new HarnessLoopController(createConstraintPack({ budget: { maxSteps: 30, maxCost: 10, maxDurationMs: 120_000 } }));
  assert.equal(controller2.getGuards().maxIterations, 10);
});

test("HarnessLoopController constructor keeps at least 1 maxIteration when maxSteps is below one full loop", () => {
  const controller = new HarnessLoopController(createConstraintPack({ budget: { maxSteps: 1, maxCost: 5, maxDurationMs: 60_000 } }));
  assert.equal(controller.getGuards().maxIterations, 1);

  const controller2 = new HarnessLoopController(createConstraintPack({ budget: { maxSteps: 0, maxCost: 5, maxDurationMs: 60_000 } }));
  assert.equal(controller2.getGuards().maxIterations, 1);
});

test("HarnessLoopController constructor sets default guards", () => {
  const controller = new HarnessLoopController(createConstraintPack());
  const guards = controller.getGuards();

  assert.equal(guards.maxReplans, 3);
  assert.equal(guards.maxDurationMs, 60_000);
  assert.equal(guards.maxCost, 5);
});

test("HarnessLoopController constructor accepts overrides", () => {
  const controller = new HarnessLoopController(createConstraintPack(), {
    maxIterations: 10,
    maxReplans: 5,
    maxDurationMs: 120_000,
    maxCost: 20,
  });
  const guards = controller.getGuards();

  assert.equal(guards.maxIterations, 10);
  assert.equal(guards.maxReplans, 5);
  assert.equal(guards.maxDurationMs, 120_000);
  assert.equal(guards.maxCost, 20);
});

test("HarnessLoopController constructor accepts initialState", () => {
  const controller = new HarnessLoopController(createConstraintPack(), {}, {
    iteration: 5,
    replanCount: 2,
    totalCost: 1.5,
  });
  const state = controller.getState();

  assert.equal(state.iteration, 5);
  assert.equal(state.replanCount, 2);
  assert.equal(state.totalCost, 1.5);
  assert.ok(state.startedAt > 0);
});

test("HarnessLoopController.recordIteration increments iteration and accumulates cost", () => {
  const controller = new HarnessLoopController(createConstraintPack());
  controller.recordIteration(0.5);
  controller.recordIteration(1.0);

  const state = controller.getState();
  assert.equal(state.iteration, 2);
  assert.equal(state.totalCost, 1.5);
});

test("HarnessLoopController.recordIteration handles decimal cost precision", () => {
  const controller = new HarnessLoopController(createConstraintPack());
  controller.recordIteration(0.1);
  controller.recordIteration(0.2);
  controller.recordIteration(0.3);

  const state = controller.getState();
  assert.equal(state.totalCost, 0.6);
});

test("HarnessLoopController.recordReplan increments replanCount", () => {
  const controller = new HarnessLoopController(createConstraintPack());
  controller.recordReplan();
  controller.recordReplan();

  const state = controller.getState();
  assert.equal(state.replanCount, 2);
});

test("HarnessLoopController.getGuardViolation returns null when no violations", () => {
  const controller = new HarnessLoopController(createConstraintPack());
  assert.equal(controller.getGuardViolation(), null);
});

test("HarnessLoopController.getGuardViolation returns max_iterations_reached", () => {
  const controller = new HarnessLoopController(createConstraintPack({ budget: { maxSteps: 3, maxCost: 5, maxDurationMs: 60_000 } }));
  controller.recordIteration();
  controller.recordIteration();
  controller.recordIteration();

  assert.equal(controller.getGuardViolation(), "harness.guard.max_iterations_reached");
});

test("HarnessLoopController.getGuardViolation returns max_replans_reached", () => {
  const controller = new HarnessLoopController(createConstraintPack(), { maxReplans: 2 });
  controller.recordReplan();
  controller.recordReplan();
  controller.recordReplan();

  assert.equal(controller.getGuardViolation(), "harness.guard.max_replans_reached");
});

test("HarnessLoopController.getGuardViolation returns max_cost_exceeded", () => {
  const controller = new HarnessLoopController(createConstraintPack({ budget: { maxSteps: 9, maxCost: 2, maxDurationMs: 60_000 } }));
  controller.recordIteration(1.5);
  controller.recordIteration(1.5);

  assert.equal(controller.getGuardViolation(), "harness.guard.max_cost_exceeded");
});

test("HarnessLoopController.getGuardViolation returns max_duration_exceeded", () => {
  const controller = new HarnessLoopController(createConstraintPack({ budget: { maxSteps: 9, maxCost: 5, maxDurationMs: 1000 } }), {}, {
    startedAt: Date.now() - 2000,
  });

  assert.equal(controller.getGuardViolation(), "harness.guard.max_duration_exceeded");
});

test("HarnessLoopController.getGuardViolation accepts custom now parameter", () => {
  const controller = new HarnessLoopController(createConstraintPack({ budget: { maxSteps: 9, maxCost: 5, maxDurationMs: 1000 } }), {}, {
    startedAt: 0,
  });

  // With startedAt=0 and now=5000, diff is 5000 which exceeds maxDurationMs of 1000
  const result = controller.getGuardViolation(5000);
  assert.equal(result, "harness.guard.max_duration_exceeded");
});

test("HarnessLoopController.shouldContinue returns false when guard violation exists", () => {
  const controller = new HarnessLoopController(createConstraintPack({ budget: { maxSteps: 3, maxCost: 5, maxDurationMs: 60_000 } }));
  controller.recordIteration();
  controller.recordIteration();
  controller.recordIteration();

  assert.equal(controller.shouldContinue("replan", true), false);
});

test("HarnessLoopController.shouldContinue returns false when no remaining iterations", () => {
  const controller = new HarnessLoopController(createConstraintPack());
  assert.equal(controller.shouldContinue("replan", false), false);
});

test("HarnessLoopController.shouldContinue returns true for retry_same_plan with remaining iterations", () => {
  const controller = new HarnessLoopController(createConstraintPack());
  assert.equal(controller.shouldContinue("retry_same_plan", true), true);
});

test("HarnessLoopController.shouldContinue returns true for replan with remaining iterations", () => {
  const controller = new HarnessLoopController(createConstraintPack());
  assert.equal(controller.shouldContinue("replan", true), true);
});

test("HarnessLoopController.shouldContinue returns false for accept", () => {
  const controller = new HarnessLoopController(createConstraintPack());
  assert.equal(controller.shouldContinue("accept", true), false);
});

test("HarnessLoopController.shouldContinue returns false for abort", () => {
  const controller = new HarnessLoopController(createConstraintPack());
  assert.equal(controller.shouldContinue("abort", true), false);
});

test("HarnessLoopController.shouldContinue returns false for escalate_to_human", () => {
  const controller = new HarnessLoopController(createConstraintPack());
  assert.equal(controller.shouldContinue("escalate_to_human", true), false);
});

test("HarnessLoopController.evaluateProgress returns violation when guard violated", () => {
  const controller = new HarnessLoopController(createConstraintPack({ budget: { maxSteps: 3, maxCost: 5, maxDurationMs: 60_000 } }));
  controller.recordIteration();
  controller.recordIteration();
  controller.recordIteration();

  const progress = controller.evaluateProgress("replan", true);

  assert.equal(progress.shouldContinue, false);
  assert.equal(progress.violation, "harness.guard.max_iterations_reached");
  assert.ok(progress.reasonCodes.includes("harness.guard.max_iterations_reached"));
});

test("HarnessLoopController.evaluateProgress returns iteration_exhausted when no remaining and action requires iteration", () => {
  const controller = new HarnessLoopController(createConstraintPack());

  const progressRetry = controller.evaluateProgress("retry_same_plan", false);
  assert.equal(progressRetry.shouldContinue, false);
  assert.equal(progressRetry.violation, null);
  assert.ok(progressRetry.reasonCodes.includes("harness.guard.iteration_input_exhausted"));

  const progressReplan = controller.evaluateProgress("replan", false);
  assert.equal(progressReplan.shouldContinue, false);
  assert.ok(progressReplan.reasonCodes.includes("harness.guard.iteration_input_exhausted"));
});

test("HarnessLoopController.evaluateProgress returns shouldContinue for valid replan with iterations", () => {
  const controller = new HarnessLoopController(createConstraintPack());
  const progress = controller.evaluateProgress("replan", true);

  assert.equal(progress.shouldContinue, true);
  assert.equal(progress.violation, null);
  assert.deepEqual(progress.reasonCodes, []);
});

test("HarnessLoopController.evaluateProgress returns shouldContinue for valid retry_same_plan with iterations", () => {
  const controller = new HarnessLoopController(createConstraintPack());
  const progress = controller.evaluateProgress("retry_same_plan", true);

  assert.equal(progress.shouldContinue, true);
  assert.equal(progress.violation, null);
  assert.deepEqual(progress.reasonCodes, []);
});

test("HarnessLoopController.evaluateProgress returns shouldContinue false for accept action", () => {
  const controller = new HarnessLoopController(createConstraintPack());
  const progress = controller.evaluateProgress("accept", true);

  assert.equal(progress.shouldContinue, false);
  assert.equal(progress.violation, null);
  assert.deepEqual(progress.reasonCodes, []);
});

test("HarnessLoopController.getState returns immutable snapshot", () => {
  const controller = new HarnessLoopController(createConstraintPack());
  const state1 = controller.getState();
  controller.recordIteration(1.0);
  const state2 = controller.getState();

  assert.notEqual(state1.iteration, state2.iteration);
  assert.notEqual(state1.totalCost, state2.totalCost);
});

test("HarnessLoopController.getGuards returns immutable snapshot", () => {
  const controller = new HarnessLoopController(createConstraintPack());
  const guards = controller.getGuards();

  assert.equal(guards.maxIterations, 3);
  assert.equal(guards.maxReplans, 3);
  assert.equal(guards.maxDurationMs, 60_000);
  assert.equal(guards.maxCost, 5);
});

test("HarnessLoopController state transitions: iteration and replan tracking", () => {
  const controller = new HarnessLoopController(createConstraintPack(), { maxReplans: 2 });

  assert.equal(controller.getState().iteration, 0);
  assert.equal(controller.getState().replanCount, 0);

  controller.recordIteration();
  assert.equal(controller.getState().iteration, 1);

  controller.recordReplan();
  assert.equal(controller.getState().replanCount, 1);

  controller.recordIteration();
  assert.equal(controller.getState().iteration, 2);

  controller.recordReplan();
  assert.equal(controller.getState().replanCount, 2);
});

test("HarnessLoopController multiple guards evaluated in priority order", () => {
  const controller = new HarnessLoopController(createConstraintPack({ budget: { maxSteps: 3, maxCost: 5, maxDurationMs: 60_000 } }), {}, {
    startedAt: Date.now() - 2000,
    iteration: 2,
  });

  // Duration is checked first in getGuardViolation but both should return a violation
  const violation = controller.getGuardViolation();
  assert.ok(violation !== null);
});

test("HarnessLoopController all HarnessDecisionAction types handled in shouldContinue", () => {
  const controller = new HarnessLoopController(createConstraintPack());
  const actions: HarnessDecisionAction[] = ["accept", "retry_same_plan", "replan", "escalate_to_human", "downgrade_mode", "abort"];

  for (const action of actions) {
    const result = controller.shouldContinue(action, true);
    if (action === "retry_same_plan" || action === "replan") {
      assert.equal(result, true, `Expected true for ${action}`);
    } else {
      assert.equal(result, false, `Expected false for ${action}`);
    }
  }
});

test("HarnessLoopController progress evaluation with accept action stops loop", () => {
  const controller = new HarnessLoopController(createConstraintPack());
  const progress = controller.evaluateProgress("accept", true);

  assert.equal(progress.shouldContinue, false);
});

test("HarnessLoopController progress evaluation with downgrade_mode stops loop", () => {
  const controller = new HarnessLoopController(createConstraintPack());
  const progress = controller.evaluateProgress("downgrade_mode", true);

  assert.equal(progress.shouldContinue, false);
});

test("HarnessLoopController handles zero cost iteration", () => {
  const controller = new HarnessLoopController(createConstraintPack());
  controller.recordIteration(0);

  assert.equal(controller.getState().iteration, 1);
  assert.equal(controller.getState().totalCost, 0);
});
