import assert from "node:assert/strict";
import test from "node:test";

import { HarnessLoopController } from "../../../../../src/platform/orchestration/harness/loop/index.js";
import type { HarnessDecisionAction } from "../../../../../src/platform/orchestration/harness/index.js";
import type { ConstraintPack } from "../../../../../src/platform/orchestration/harness/index.js";

function createTestConstraintPack(overrides: Partial<ConstraintPack["budget"]> = {}): ConstraintPack {
  return {
    policyIds: ["policy-1"],
    approvalMode: "required",
    autonomyMode: "auto",
    toolPolicy: { allowedTools: ["tool-a", "tool-b"] },
    risk_policy: { maxRiskScore: 0.8, escalationThreshold: 0.6 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budget: {
      maxSteps: 30,
      maxCost: 100,
      maxDurationMs: 60000,
      ...overrides,
    },
  };
}

test("HarnessLoopController constructor sets default guards from constraintPack", () => {
  const pack = createTestConstraintPack({ maxSteps: 30, maxCost: 200, maxDurationMs: 90000 });
  const controller = new HarnessLoopController(pack);

  // maxIterations = floor(maxSteps / 3) = floor(30 / 3) = 10
  assert.equal(controller.getGuards().maxIterations, 10);
  assert.equal(controller.getGuards().maxReplans, 3);
  assert.equal(controller.getGuards().maxCost, 200);
  assert.equal(controller.getGuards().maxDurationMs, 90000);
});

test("HarnessLoopController constructor allows guard overrides", () => {
  const pack = createTestConstraintPack({ maxSteps: 30 });
  const controller = new HarnessLoopController(pack, { maxIterations: 5, maxReplans: 10 });

  assert.equal(controller.getGuards().maxIterations, 5);
  assert.equal(controller.getGuards().maxReplans, 10);
});

test("HarnessLoopController initial state starts at 0 iterations", () => {
  const pack = createTestConstraintPack();
  const controller = new HarnessLoopController(pack);

  assert.equal(controller.getState().iteration, 0);
  assert.equal(controller.getState().replanCount, 0);
  assert.equal(controller.getState().totalCost, 0);
});

test("HarnessLoopController constructor accepts initial state overrides", () => {
  const pack = createTestConstraintPack();
  const controller = new HarnessLoopController(pack, {}, { iteration: 5, replanCount: 2, totalCost: 50 });

  assert.equal(controller.getState().iteration, 5);
  assert.equal(controller.getState().replanCount, 2);
  assert.equal(controller.getState().totalCost, 50);
});

test("HarnessLoopController.recordIteration increments iteration and accumulates cost", () => {
  const pack = createTestConstraintPack();
  const controller = new HarnessLoopController(pack);

  controller.recordIteration(10);
  assert.equal(controller.getState().iteration, 1);
  assert.equal(controller.getState().totalCost, 10);

  controller.recordIteration(15);
  assert.equal(controller.getState().iteration, 2);
  assert.equal(controller.getState().totalCost, 25);

  controller.recordIteration(0);
  assert.equal(controller.getState().iteration, 3);
  assert.equal(controller.getState().totalCost, 25);
});

test("HarnessLoopController.recordIteration rounds cost to 6 decimal places", () => {
  const pack = createTestConstraintPack();
  const controller = new HarnessLoopController(pack);

  controller.recordIteration(0.123456789);
  controller.recordIteration(0.987654321);

  assert.equal(controller.getState().totalCost, 1.110111);
});

test("HarnessLoopController.recordReplan increments replanCount", () => {
  const pack = createTestConstraintPack();
  const controller = new HarnessLoopController(pack);

  controller.recordReplan();
  assert.equal(controller.getState().replanCount, 1);

  controller.recordReplan();
  assert.equal(controller.getState().replanCount, 2);

  controller.recordReplan();
  assert.equal(controller.getState().replanCount, 3);
});

test("HarnessLoopController.getGuardViolation returns null when no violations", () => {
  const pack = createTestConstraintPack({ maxCost: 100, maxDurationMs: 60000 });
  const controller = new HarnessLoopController(pack);

  assert.equal(controller.getGuardViolation(), null);
});

test("HarnessLoopController.getGuardViolation returns violation when maxIterations reached", () => {
  const pack = createTestConstraintPack({ maxSteps: 3 }); // maxIterations = floor(3/3) = 1
  const controller = new HarnessLoopController(pack, {}, { iteration: 1 });

  assert.equal(controller.getGuardViolation(), "harness.guard.max_iterations_reached");
});

test("HarnessLoopController.getGuardViolation returns violation when maxReplans exceeded", () => {
  const pack = createTestConstraintPack();
  const controller = new HarnessLoopController(pack, { maxReplans: 2 }, { replanCount: 3 });

  assert.equal(controller.getGuardViolation(), "harness.guard.max_replans_reached");
});

test("HarnessLoopController.getGuardViolation returns violation when maxCost exceeded", () => {
  const pack = createTestConstraintPack({ maxCost: 50 });
  const controller = new HarnessLoopController(pack, {}, { totalCost: 51 });

  assert.equal(controller.getGuardViolation(), "harness.guard.max_cost_exceeded");
});

test("HarnessLoopController.getGuardViolation returns violation when maxDurationMs exceeded", () => {
  const pack = createTestConstraintPack({ maxDurationMs: 1000 });
  const startedAt = Date.now() - 2000;
  const controller = new HarnessLoopController(pack, {}, { startedAt });

  assert.equal(controller.getGuardViolation(), "harness.guard.max_duration_exceeded");
});

test("HarnessLoopController.shouldContinue returns false when guard violation exists", () => {
  const pack = createTestConstraintPack({ maxSteps: 3 });
  const controller = new HarnessLoopController(pack, {}, { iteration: 1 });

  assert.equal(controller.shouldContinue("retry_same_plan", true), false);
});

test("HarnessLoopController.shouldContinue returns false when no remaining iterations", () => {
  const pack = createTestConstraintPack();
  const controller = new HarnessLoopController(pack);

  assert.equal(controller.shouldContinue("retry_same_plan", false), false);
});

test("HarnessLoopController.shouldContinue returns true for retry_same_plan with remaining iterations", () => {
  const pack = createTestConstraintPack({ maxSteps: 30 }); // maxIterations = 10
  const controller = new HarnessLoopController(pack, {}, { iteration: 5 });

  assert.equal(controller.shouldContinue("retry_same_plan", true), true);
});

test("HarnessLoopController.shouldContinue returns true for replan with remaining iterations", () => {
  const pack = createTestConstraintPack({ maxSteps: 30 });
  const controller = new HarnessLoopController(pack, {}, { iteration: 5 });

  assert.equal(controller.shouldContinue("replan", true), true);
});

test("HarnessLoopController.shouldContinue returns false for accept action", () => {
  const pack = createTestConstraintPack();
  const controller = new HarnessLoopController(pack);

  assert.equal(controller.shouldContinue("accept", true), false);
});

test("HarnessLoopController.shouldContinue returns false for abort action", () => {
  const pack = createTestConstraintPack();
  const controller = new HarnessLoopController(pack);

  assert.equal(controller.shouldContinue("abort", true), false);
});

test("HarnessLoopController.shouldContinue returns false for escalate_to_human action", () => {
  const pack = createTestConstraintPack();
  const controller = new HarnessLoopController(pack);

  assert.equal(controller.shouldContinue("escalate_to_human", true), false);
});

test("HarnessLoopController.shouldContinue returns false for downgrade_mode action", () => {
  const pack = createTestConstraintPack();
  const controller = new HarnessLoopController(pack);

  assert.equal(controller.shouldContinue("downgrade_mode", true), false);
});

test("HarnessLoopController.evaluateProgress returns violation when guard violated", () => {
  const pack = createTestConstraintPack({ maxSteps: 3 });
  const controller = new HarnessLoopController(pack, {}, { iteration: 1 });

  const progress = controller.evaluateProgress("retry_same_plan", true);

  assert.equal(progress.shouldContinue, false);
  assert.equal(progress.violation, "harness.guard.max_iterations_reached");
  assert.deepEqual(progress.reasonCodes, ["harness.guard.max_iterations_reached"]);
});

test("HarnessLoopController.evaluateProgress returns no continuation when input exhausted", () => {
  const pack = createTestConstraintPack();
  const controller = new HarnessLoopController(pack);

  const progress = controller.evaluateProgress("retry_same_plan", false);

  assert.equal(progress.shouldContinue, false);
  assert.equal(progress.violation, null);
  assert.deepEqual(progress.reasonCodes, ["harness.guard.iteration_input_exhausted"]);
});

test("HarnessLoopController.evaluateProgress returns no continuation when input exhausted with replan", () => {
  const pack = createTestConstraintPack();
  const controller = new HarnessLoopController(pack);

  const progress = controller.evaluateProgress("replan", false);

  assert.equal(progress.shouldContinue, false);
  assert.equal(progress.violation, null);
  assert.deepEqual(progress.reasonCodes, ["harness.guard.iteration_input_exhausted"]);
});

test("HarnessLoopController.evaluateProgress returns continue for valid retry", () => {
  const pack = createTestConstraintPack({ maxSteps: 30 });
  const controller = new HarnessLoopController(pack, {}, { iteration: 5 });

  const progress = controller.evaluateProgress("retry_same_plan", true);

  assert.equal(progress.shouldContinue, true);
  assert.equal(progress.violation, null);
  assert.deepEqual(progress.reasonCodes, []);
});

test("HarnessLoopController.evaluateProgress returns continue for valid replan", () => {
  const pack = createTestConstraintPack({ maxSteps: 30 });
  const controller = new HarnessLoopController(pack, {}, { iteration: 5 });

  const progress = controller.evaluateProgress("replan", true);

  assert.equal(progress.shouldContinue, true);
  assert.equal(progress.violation, null);
  assert.deepEqual(progress.reasonCodes, []);
});

test("HarnessLoopController.getState returns immutable state snapshot", () => {
  const pack = createTestConstraintPack();
  const controller = new HarnessLoopController(pack);

  const state1 = controller.getState();
  controller.recordIteration(10);
  const state2 = controller.getState();

  assert.notEqual(state1, state2);
  assert.equal(state1.iteration, 0);
  assert.equal(state2.iteration, 1);
  assert.equal(state1.totalCost, 0);
  assert.equal(state2.totalCost, 10);
});

test("HarnessLoopController.getGuards returns immutable guards snapshot", () => {
  const pack = createTestConstraintPack();
  const controller = new HarnessLoopController(pack);

  const guards = controller.getGuards();
  assert.equal(guards.maxIterations, 10); // floor(30/3)
  assert.equal(guards.maxReplans, 3);
  assert.equal(guards.maxCost, 100);
  assert.equal(guards.maxDurationMs, 60000);
});

test("HarnessLoopController handles maxSteps less than 3", () => {
  const pack = createTestConstraintPack({ maxSteps: 2 });
  const controller = new HarnessLoopController(pack);

  // maxIterations = floor(2/3) = 0, so even iteration 0 should trigger violation
  assert.equal(controller.getGuards().maxIterations, 0);
  assert.equal(controller.getGuardViolation(), "harness.guard.max_iterations_reached");
});

test("HarnessLoopController handles maxSteps of 0", () => {
  const pack = createTestConstraintPack({ maxSteps: 0 });
  const controller = new HarnessLoopController(pack);

  // maxIterations = floor(0/3) = 0
  assert.equal(controller.getGuards().maxIterations, 0);
});

test("HarnessLoopController handles very large maxSteps", () => {
  const pack = createTestConstraintPack({ maxSteps: 1000000 });
  const controller = new HarnessLoopController(pack);

  assert.equal(controller.getGuards().maxIterations, Math.floor(1000000 / 3));
});

test("HarnessLoopController handles very small maxDurationMs", () => {
  const pack = createTestConstraintPack({ maxDurationMs: 1 });
  const controller = new HarnessLoopController(pack, {}, { startedAt: Date.now() - 2 });

  assert.equal(controller.getGuardViolation(), "harness.guard.max_duration_exceeded");
});

test("HarnessLoopController with custom startedAt in initial state", () => {
  const pack = createTestConstraintPack({ maxDurationMs: 5000 });
  const pastTime = Date.now() - 10000;
  const controller = new HarnessLoopController(pack, {}, { startedAt: pastTime });

  assert.equal(controller.getState().startedAt, pastTime);
  assert.equal(controller.getGuardViolation(), "harness.guard.max_duration_exceeded");
});

test("HarnessLoopController recordIteration with fractional costs", () => {
  const pack = createTestConstraintPack({ maxCost: 1 });
  const controller = new HarnessLoopController(pack);

  controller.recordIteration(0.1);
  controller.recordIteration(0.2);
  controller.recordIteration(0.3);

  assert.equal(controller.getState().iteration, 3);
  assert.equal(controller.getState().totalCost, 0.6);
});

test("HarnessLoopController replan tracking independent of iteration", () => {
  const pack = createTestConstraintPack();
  const controller = new HarnessLoopController(pack, { maxReplans: 5 });

  controller.recordIteration(10);
  controller.recordReplan();
  controller.recordIteration(20);
  controller.recordReplan();

  const state = controller.getState();
  assert.equal(state.iteration, 2);
  assert.equal(state.replanCount, 2);
});

test("HarnessLoopController evaluateProgress with accept action stops even with remaining iterations", () => {
  const pack = createTestConstraintPack({ maxSteps: 30 });
  const controller = new HarnessLoopController(pack, {}, { iteration: 5 });

  const progress = controller.evaluateProgress("accept", true);

  // shouldContinue is based on shouldContinue() which returns false for accept
  assert.equal(progress.shouldContinue, false);
  assert.equal(progress.violation, null);
});