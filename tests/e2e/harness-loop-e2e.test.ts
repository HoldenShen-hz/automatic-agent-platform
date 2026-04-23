/**
 * E2E Harness Loop Controller Tests
 *
 * End-to-end tests covering the full lifecycle of the HarnessLoopController
 * from creation through termination across all guard conditions.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { HarnessLoopController } from "../../src/platform/orchestration/harness/loop/index.js";
import type { ConstraintPack } from "../../src/platform/orchestration/harness/index.js";

function createConstraintPack(overrides: Partial<ConstraintPack["budget"]> = {}): ConstraintPack {
  return {
    policyIds: ["policy-1"],
    approvalMode: "none",
    autonomyMode: "auto",
    toolPolicy: { allowedTools: ["tool-a", "tool-b"] },
    risk_policy: {
      maxRiskScore: 5,
      escalationThreshold: 8,
    },
    output_policy: {
      requiredEvidence: ["result"],
      redactSensitiveData: false,
    },
    budget: {
      maxSteps: 30,
      maxCost: 100,
      maxDurationMs: 60000,
      ...overrides,
    },
  };
}

test("E2E: Happy path loop - create controller, iterate with costs, evaluate, all guards pass, complete", (t) => {
  const pack = createConstraintPack({ maxSteps: 30, maxCost: 100, maxDurationMs: 60000 });
  const controller = new HarnessLoopController(pack);

  // Verify initial state
  const initialState = controller.getState();
  assert.equal(initialState.iteration, 0, "Initial iteration should be 0");
  assert.equal(initialState.replanCount, 0, "Initial replan count should be 0");
  assert.equal(initialState.totalCost, 0, "Initial cost should be 0");

  // Iterate a few times with costs
  controller.recordIteration(10);
  controller.recordIteration(15);
  controller.recordIteration(20);

  const afterIterations = controller.getState();
  assert.equal(afterIterations.iteration, 3, "Should have 3 iterations");
  assert.equal(afterIterations.totalCost, 45, "Total cost should be 45");

  // Evaluate progress with retry_same_plan action - should continue
  let progress = controller.evaluateProgress("retry_same_plan", true);
  assert.equal(progress.shouldContinue, true, "Should continue with retry_same_plan");
  assert.equal(progress.violation, null, "No violation should be reported");

  // Another iteration
  controller.recordIteration(5);
  assert.equal(controller.getState().iteration, 4, "Should have 4 iterations");

  // Evaluate with replan action - should continue
  progress = controller.evaluateProgress("replan", true);
  assert.equal(progress.shouldContinue, true, "Should continue with replan");

  // Final accept - loop completes
  progress = controller.evaluateProgress("accept", false);
  assert.equal(progress.shouldContinue, false, "Should not continue after accept");
  assert.deepStrictEqual(progress.reasonCodes, [], "No reason codes for accept");
});

test("E2E: Max iterations termination - loop until maxIterations hit, verify proper termination", (t) => {
  // maxIterations is calculated as Math.max(1, Math.floor(maxSteps / 3))
  // With maxSteps=30, maxIterations = 10
  const pack = createConstraintPack({ maxSteps: 30 });
  const controller = new HarnessLoopController(pack);

  const guards = controller.getGuards();
  assert.equal(guards.maxIterations, 10, "maxIterations should be 10 for maxSteps=30");

  // Iterate up to but not including max
  for (let i = 0; i < 9; i++) {
    controller.recordIteration();
    const progress = controller.evaluateProgress("replan", true);
    assert.equal(progress.shouldContinue, true, `Should continue at iteration ${i + 1}`);
  }

  // At iteration 9, state.iteration=9, still < maxIterations(10)
  assert.equal(controller.getState().iteration, 9);

  // Record iteration 10 - now iteration=10, which is >= maxIterations(10)
  controller.recordIteration();
  assert.equal(controller.getState().iteration, 10);

  // Should have guard violation now
  const violation = controller.getGuardViolation();
  assert.equal(violation, "harness.guard.max_iterations_reached", "Should report max iterations violation");

  // Progress evaluation should stop
  const progress = controller.evaluateProgress("replan", true);
  assert.equal(progress.shouldContinue, false, "Should not continue after max iterations");
  assert.equal(progress.violation, "harness.guard.max_iterations_reached");
  assert.deepStrictEqual(progress.reasonCodes, ["harness.guard.max_iterations_reached"]);
});

test("E2E: Max replans termination - trigger max replans, verify termination", (t) => {
  const pack = createConstraintPack();
  const controller = new HarnessLoopController(pack);

  const guards = controller.getGuards();
  assert.equal(guards.maxReplans, 3, "maxReplans should be 3 by default");

  // Record replans up to but not including max
  for (let i = 0; i < 3; i++) {
    controller.recordReplan();
    const state = controller.getState();
    assert.equal(state.replanCount, i + 1, `Replan count should be ${i + 1}`);
    const progress = controller.evaluateProgress("replan", true);
    assert.equal(progress.shouldContinue, true, `Should continue at replan ${i + 1}`);
  }

  // After 3 replans, replanCount=3, which is NOT > maxReplans(3)
  assert.equal(controller.getState().replanCount, 3);
  assert.equal(controller.getGuardViolation(), null, "No violation at exactly maxReplans");

  // One more replan - replanCount=4, which is > maxReplans(3)
  controller.recordReplan();
  assert.equal(controller.getState().replanCount, 4);

  const violation = controller.getGuardViolation();
  assert.equal(violation, "harness.guard.max_replans_reached", "Should report max replans violation");

  const progress = controller.evaluateProgress("replan", true);
  assert.equal(progress.shouldContinue, false, "Should not continue after max replans");
  assert.equal(progress.violation, "harness.guard.max_replans_reached");
});

test("E2E: Max cost termination - iterate until cost limit exceeded", (t) => {
  const pack = createConstraintPack({ maxCost: 50 });
  const controller = new HarnessLoopController(pack);

  const guards = controller.getGuards();
  assert.equal(guards.maxCost, 50, "maxCost should be 50");

  // Add iterations with costs that don't exceed limit
  controller.recordIteration(10);
  controller.recordIteration(15);
  controller.recordIteration(20); // Total: 45, still < 50

  assert.equal(controller.getState().totalCost, 45);
  assert.equal(controller.getGuardViolation(), null, "No violation at cost 45");

  // Next iteration pushes over limit
  controller.recordIteration(6); // Total: 51, > 50
  assert.equal(controller.getState().totalCost, 51);

  const violation = controller.getGuardViolation();
  assert.equal(violation, "harness.guard.max_cost_exceeded", "Should report max cost violation");

  const progress = controller.evaluateProgress("retry_same_plan", true);
  assert.equal(progress.shouldContinue, false, "Should not continue after max cost");
  assert.equal(progress.violation, "harness.guard.max_cost_exceeded");

  // Cost rounding precision - verify toFixed(6) works correctly
  const pack2 = createConstraintPack({ maxCost: 0.01 });
  const controller2 = new HarnessLoopController(pack2);
  controller2.recordIteration(0.003);
  controller2.recordIteration(0.004);
  controller2.recordIteration(0.005); // Total: 0.012 > 0.01

  const violation2 = controller2.getGuardViolation();
  assert.equal(violation2, "harness.guard.max_cost_exceeded", "Should handle small cost values");
});

test("E2E: Max duration termination - start loop, wait for duration to expire", (t) => {
  const pack = createConstraintPack({ maxDurationMs: 50 });
  // Start with a timestamp 100ms in the past
  const startedAt = Date.now() - 100;
  const controller = new HarnessLoopController(pack, {}, { startedAt });

  const guards = controller.getGuards();
  assert.equal(guards.maxDurationMs, 50, "maxDurationMs should be 50");

  // Initially no violation (not enough time passed since startedAt)
  let violation = controller.getGuardViolation(Date.now() - 50);
  assert.equal(violation, null, "No violation when duration not yet exceeded");

  // But with current time, should be in violation
  violation = controller.getGuardViolation(Date.now());
  assert.equal(violation, "harness.guard.max_duration_exceeded", "Should report duration violation");

  const progress = controller.evaluateProgress("replan", true);
  assert.equal(progress.shouldContinue, false, "Should not continue after duration exceeded");
  assert.equal(progress.violation, "harness.guard.max_duration_exceeded");
  assert.deepStrictEqual(progress.reasonCodes, ["harness.guard.max_duration_exceeded"]);

  // Verify state is preserved correctly
  const state = controller.getState();
  assert.equal(state.startedAt, startedAt, "startedAt should be preserved");
});

test("E2E: Retry same plan flow - full retry_same_plan loop cycle with progress evaluation", (t) => {
  const pack = createConstraintPack({ maxSteps: 15 }); // maxIterations = 5
  const controller = new HarnessLoopController(pack);

  // Simulate retry_same_plan flow - each iteration retries the same plan
  let iteration = 0;
  let lastAction: "retry_same_plan" | "replan" | "accept" = "retry_same_plan";

  while (iteration < 5) {
    const progress = controller.evaluateProgress(lastAction, true);

    if (!progress.shouldContinue) {
      break;
    }

    controller.recordIteration();
    iteration++;
  }

  assert.equal(iteration, 5, "Should complete 5 iterations with retry_same_plan");

  // At iteration 5, should be terminated by max iterations
  const finalProgress = controller.evaluateProgress("retry_same_plan", true);
  assert.equal(finalProgress.shouldContinue, false, "Should stop after max iterations");
  assert.equal(finalProgress.violation, "harness.guard.max_iterations_reached");
});

test("E2E: Replan flow - full replan loop cycle with replan counting", (t) => {
  const pack = createConstraintPack();
  const controller = new HarnessLoopController(pack);

  // Simulate replan flow - each iteration may trigger a replan
  // Note: getGuardViolation uses replanCount > maxReplans (strictly greater)
  // So replanCount=3 with maxReplans=3 is still ok (3 > 3 is false)
  // Only when replanCount=4 does it violate
  let iteration = 0;
  const lastAction: "retry_same_plan" | "replan" | "accept" = "replan";

  while (iteration < 4) {
    const progress = controller.evaluateProgress(lastAction, true);

    if (!progress.shouldContinue) {
      break;
    }

    controller.recordIteration();
    controller.recordReplan(); // Each iteration also triggers a replan
    iteration++;
  }

  assert.equal(iteration, 4, "Should complete 4 iterations with replan");
  assert.equal(controller.getState().replanCount, 4, "Should have 4 replans");

  // At replanCount=4, maxReplans=3, violation triggers (4 > 3)
  const progress = controller.evaluateProgress("replan", true);
  assert.equal(progress.shouldContinue, false, "Should stop after max replans");
  assert.equal(progress.violation, "harness.guard.max_replans_reached");
});

test("E2E: All guards checked on each iteration - verify all 4 guards are evaluated each time", (t) => {
  const pack = createConstraintPack({
    maxSteps: 30,    // maxIterations = 10
    maxCost: 100,
    maxDurationMs: 60000,
  });
  const controller = new HarnessLoopController(pack);

  // Override maxDuration to a short window for testing
  const shortDurationController = new HarnessLoopController(
    createConstraintPack({ maxDurationMs: 1000 }),
    {},
    { startedAt: Date.now() - 2000 } // Started 2 seconds ago
  );

  // Record iterations and costs
  controller.recordIteration(25);
  controller.recordIteration(25);
  controller.recordIteration(25); // Total: 75

  shortDurationController.recordIteration(10);

  // Verify all guards are checked via getGuardViolation
  // This tests that all 4 conditions are evaluated in a single call
  const violation1 = controller.getGuardViolation();
  assert.equal(violation1, null, "No guard violation yet");

  const violation2 = shortDurationController.getGuardViolation();
  assert.equal(violation2, "harness.guard.max_duration_exceeded", "Duration guard should trigger");

  // Verify evaluateProgress returns correct violation
  const progress = shortDurationController.evaluateProgress("retry_same_plan", true);
  assert.equal(progress.shouldContinue, false);
  assert.equal(progress.violation, "harness.guard.max_duration_exceeded");
  assert.ok(progress.reasonCodes.includes("harness.guard.max_duration_exceeded"));

  // Test that shouldContinue returns false when any guard is violated
  assert.equal(controller.shouldContinue("replan", true), true, "Should continue when no guards violated");
  assert.equal(shortDurationController.shouldContinue("replan", true), false, "Should not continue when duration exceeded");

  // Test that hasRemainingIterations=false also prevents continuation
  assert.equal(controller.shouldContinue("replan", false), false, "Should not continue when no remaining iterations");

  // Verify getState and getGuards return consistent data
  const state = controller.getState();
  const guards = controller.getGuards();
  assert.ok(state.iteration < guards.maxIterations, "iteration should be less than maxIterations");
  assert.ok(state.replanCount <= guards.maxReplans, "replanCount should be <= maxReplans");
  assert.ok(state.totalCost <= guards.maxCost, "totalCost should be <= maxCost");
});

test("E2E: Guard evaluation order - iteration guard takes precedence over replan guard", (t) => {
  const pack = createConstraintPack({ maxSteps: 6 }); // maxIterations = 2
  const controller = new HarnessLoopController(pack);

  // Hit both iteration and replan limits
  controller.recordIteration();
  controller.recordIteration(); // iteration = 2, maxIterations = 2

  controller.recordReplan();
  controller.recordReplan();
  controller.recordReplan();
  controller.recordReplan(); // replanCount = 4, maxReplans = 3

  const violation = controller.getGuardViolation();
  // Iteration check comes first in the code
  assert.equal(violation, "harness.guard.max_iterations_reached", "Iteration guard should trigger first");
});

test("E2E: Override guards via constructor - custom guard values", (t) => {
  const pack = createConstraintPack({ maxSteps: 30 }); // Would be maxIterations=10 normally
  const controller = new HarnessLoopController(
    pack,
    { maxIterations: 5, maxReplans: 2, maxCost: 50, maxDurationMs: 1000 },
    { startedAt: Date.now() - 2000 }
  );

  const guards = controller.getGuards();
  assert.equal(guards.maxIterations, 5, "maxIterations should be overridden to 5");
  assert.equal(guards.maxReplans, 2, "maxReplans should be overridden to 2");
  assert.equal(guards.maxCost, 50, "maxCost should be overridden to 50");
  assert.equal(guards.maxDurationMs, 1000, "maxDurationMs should be overridden to 1000");

  // Verify overridden guards work
  controller.recordIteration();
  controller.recordIteration();
  controller.recordIteration(); // iteration = 3, but maxIterations = 5, so ok

  controller.recordReplan();
  controller.recordReplan(); // replanCount = 2, maxReplans = 2, still ok (not >)

  controller.recordReplan(); // replanCount = 3 > maxReplans(2)
  const violation = controller.getGuardViolation();
  assert.equal(violation, "harness.guard.max_replans_reached", "Should respect overridden maxReplans");
});

test("E2E: Initial state override - start with custom iteration/cost/replan values", (t) => {
  const pack = createConstraintPack({ maxSteps: 30 });
  const controller = new HarnessLoopController(
    pack,
    {},
    { iteration: 5, replanCount: 2, totalCost: 50 }
  );

  const state = controller.getState();
  assert.equal(state.iteration, 5, "Should start with iteration 5");
  assert.equal(state.replanCount, 2, "Should start with replanCount 2");
  assert.equal(state.totalCost, 50, "Should start with totalCost 50");
  assert.ok(state.startedAt > 0, "startedAt should be set");

  // Continue from there
  controller.recordIteration(10);
  assert.equal(controller.getState().iteration, 6, "Should increment from initial iteration");
  assert.equal(controller.getState().totalCost, 60, "Should add cost correctly");
});

test("E2E: Cost precision - verify toFixed(6) handles decimal arithmetic correctly", (t) => {
  const pack = createConstraintPack({ maxCost: 1 });
  const controller = new HarnessLoopController(pack);

  // Add many small costs to test precision
  controller.recordIteration(0.1);
  controller.recordIteration(0.2);
  controller.recordIteration(0.3);
  controller.recordIteration(0.3);
  controller.recordIteration(0.1); // Total: 1.0 exactly

  assert.equal(controller.getState().totalCost, 1.0, "Cost should be exactly 1.0");
  assert.equal(controller.getGuardViolation(), null, "No violation at exactly max cost");

  controller.recordIteration(0.000001); // Just over 1.0
  assert.ok(controller.getState().totalCost > 1, "Cost should be slightly over 1");
  assert.equal(controller.getGuardViolation(), "harness.guard.max_cost_exceeded", "Should detect cost overflow");
});
