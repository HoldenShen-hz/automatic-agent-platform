import test from "node:test";
import assert from "node:assert/strict";
import { HarnessLoopController } from "../../../../../../src/platform/orchestration/harness/loop/index.js";
import type { ConstraintPack } from "../../../../../../src/platform/orchestration/harness/index.js";

function createMockConstraintPack(overrides: Partial<ConstraintPack["budget"]> = {}): ConstraintPack {
  return {
    policyIds: [],
    approvalMode: "none",
    autonomyMode: "manual",
    tool_policy: { allowedTools: [] },
    risk_policy: { maxRiskScore: 100, escalationThreshold: 80 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budget: {
      maxSteps: 30,
      maxDurationMs: 60000,
      maxCost: 100,
      ...overrides,
    },
  };
}

test("HarnessLoopController constructor computes maxIterations from budget.maxSteps / 3", () => {
  const pack = createMockConstraintPack({ maxSteps: 30 });
  const controller = new HarnessLoopController(pack);
  const guards = controller.getGuards();
  assert.equal(guards.maxIterations, 10, "maxIterations should be floor(30/3) = 10");
});

test("HarnessLoopController constructor allows zero iterations for very small maxSteps", () => {
  const pack1 = createMockConstraintPack({ maxSteps: 1 });
  const controller1 = new HarnessLoopController(pack1);
  assert.equal(controller1.getGuards().maxIterations, 0, "maxIterations should be floor(1/3) = 0");

  const pack2 = createMockConstraintPack({ maxSteps: 0 });
  const controller2 = new HarnessLoopController(pack2);
  assert.equal(controller2.getGuards().maxIterations, 0, "maxIterations should remain 0 when maxSteps is 0");
});

test("HarnessLoopController constructor applies overrides", () => {
  const pack = createMockConstraintPack({ maxSteps: 30, maxCost: 100, maxDurationMs: 60000 });
  const controller = new HarnessLoopController(
    pack,
    { maxIterations: 5, maxReplans: 2, maxCost: 50, maxDurationMs: 5000 },
  );
  const guards = controller.getGuards();
  assert.equal(guards.maxIterations, 5, "maxIterations should be overridden to 5");
  assert.equal(guards.maxReplans, 2, "maxReplans should be overridden to 2");
  assert.equal(guards.maxCost, 50, "maxCost should be overridden to 50");
  assert.equal(guards.maxDurationMs, 5000, "maxDurationMs should be overridden to 5000");
});

test("HarnessLoopController constructor respects initialState", () => {
  const pack = createMockConstraintPack({ maxSteps: 30 });
  const controller = new HarnessLoopController(
    pack,
    {},
    { iteration: 5, replanCount: 2, totalCost: 25, startedAt: 1000000 },
  );
  const state = controller.getState();
  assert.equal(state.iteration, 5, "iteration should be initialized to 5");
  assert.equal(state.replanCount, 2, "replanCount should be initialized to 2");
  assert.equal(state.totalCost, 25, "totalCost should be initialized to 25");
  assert.equal(state.startedAt, 1000000, "startedAt should be initialized to 1000000");
});

test("HarnessLoopController recordIteration increments iteration and accumulates cost", () => {
  const controller = new HarnessLoopController(createMockConstraintPack());
  assert.equal(controller.getState().iteration, 0);

  controller.recordIteration(10);
  assert.equal(controller.getState().iteration, 1);
  assert.equal(controller.getState().totalCost, 10);

  controller.recordIteration(15);
  assert.equal(controller.getState().iteration, 2);
  assert.equal(controller.getState().totalCost, 25);
});

test("HarnessLoopController recordIteration with cost=0 does not add cost", () => {
  const controller = new HarnessLoopController(createMockConstraintPack());
  controller.recordIteration(0);
  assert.equal(controller.getState().iteration, 1);
  assert.equal(controller.getState().totalCost, 0);
});

test("HarnessLoopController recordIteration rounds totalCost to 6 decimal places", () => {
  const controller = new HarnessLoopController(createMockConstraintPack());
  controller.recordIteration(0.123456789);
  assert.equal(controller.getState().totalCost, 0.123457, "should round to 6 decimal places");

  controller.recordIteration(0.000001);
  assert.equal(controller.getState().totalCost, 0.123458, "should continue rounding correctly");
});

test("HarnessLoopController recordReplan increments replanCount", () => {
  const controller = new HarnessLoopController(createMockConstraintPack());
  assert.equal(controller.getState().replanCount, 0);

  controller.recordReplan();
  assert.equal(controller.getState().replanCount, 1);

  controller.recordReplan();
  assert.equal(controller.getState().replanCount, 2);
});

test("HarnessLoopController shouldContinue returns false when guard is violated", () => {
  const pack = createMockConstraintPack({ maxSteps: 6 }); // maxIterations = 2
  const controller = new HarnessLoopController(pack);

  controller.recordIteration();
  controller.recordIteration();
  // iteration = 2, maxIterations = 2, so iteration >= maxIterations → guard violation

  assert.equal(controller.shouldContinue("retry_same_plan", true), false, "should return false when guard violated");
});

test("HarnessLoopController shouldContinue returns false when hasRemainingIterations is false", () => {
  const controller = new HarnessLoopController(createMockConstraintPack());
  assert.equal(controller.shouldContinue("retry_same_plan", false), false);
  assert.equal(controller.shouldContinue("replan", false), false);
});

test("HarnessLoopController shouldContinue returns true for retry_same_plan with no violations", () => {
  const controller = new HarnessLoopController(createMockConstraintPack());
  assert.equal(controller.shouldContinue("retry_same_plan", true), true);
});

test("HarnessLoopController shouldContinue returns true for replan with no violations", () => {
  const controller = new HarnessLoopController(createMockConstraintPack());
  assert.equal(controller.shouldContinue("replan", true), true);
});

test("HarnessLoopController shouldContinue returns false for other actions", () => {
  const controller = new HarnessLoopController(createMockConstraintPack());
  assert.equal(controller.shouldContinue("accept", true), false);
  assert.equal(controller.shouldContinue("escalate_to_human", true), false);
  assert.equal(controller.shouldContinue("downgrade_mode", true), false);
  assert.equal(controller.shouldContinue("abort", true), false);
});

test("HarnessLoopController getGuardViolation returns null when no guard is violated", () => {
  const controller = new HarnessLoopController(createMockConstraintPack());
  assert.equal(controller.getGuardViolation(), null);
});

test("HarnessLoopController getGuardViolation returns max_iterations_reached", () => {
  const pack = createMockConstraintPack({ maxSteps: 6 }); // maxIterations = 2
  const controller = new HarnessLoopController(pack);

  controller.recordIteration();
  assert.equal(controller.getGuardViolation(), null);

  controller.recordIteration();
  assert.equal(controller.getGuardViolation(), "harness.guard.max_iterations_reached");
});

test("HarnessLoopController getGuardViolation returns max_replans_reached", () => {
  const controller = new HarnessLoopController(createMockConstraintPack());

  controller.recordReplan();
  controller.recordReplan();
  assert.equal(controller.getGuardViolation(), null, "replanCount=2, maxReplans=3, not violated");

  controller.recordReplan();
  // replanCount=3, maxReplans=3, still not > so not violated
  assert.equal(controller.getGuardViolation(), null);

  controller.recordReplan();
  // replanCount=4 > maxReplans=3, violated
  assert.equal(controller.getGuardViolation(), "harness.guard.max_replans_reached");
});

test("HarnessLoopController getGuardViolation returns max_cost_exceeded", () => {
  const pack = createMockConstraintPack({ maxCost: 50 });
  const controller = new HarnessLoopController(pack);

  controller.recordIteration(25);
  assert.equal(controller.getGuardViolation(), null);

  controller.recordIteration(25);
  // totalCost=50, maxCost=50, not exceeded (need >)
  assert.equal(controller.getGuardViolation(), null);

  controller.recordIteration(1);
  // totalCost=51 > maxCost=50
  assert.equal(controller.getGuardViolation(), "harness.guard.max_cost_exceeded");
});

test("HarnessLoopController getGuardViolation returns max_duration_exceeded", () => {
  const pack = createMockConstraintPack({ maxDurationMs: 100 });
  const startedAt = Date.now() - 200; // Started 200ms ago
  const controller = new HarnessLoopController(pack, {}, { startedAt });

  assert.equal(controller.getGuardViolation(), "harness.guard.max_duration_exceeded");
});

test("HarnessLoopController getGuardViolation uses provided now parameter", () => {
  const pack = createMockConstraintPack({ maxDurationMs: 100 });
  const startedAt = Date.now() - 50;
  const controller = new HarnessLoopController(pack, {}, { startedAt });

  // With now=Date.now()-50, elapsed=50 which is NOT > 100, so no violation
  assert.equal(controller.getGuardViolation(Date.now() - 50), null);

  // With now=Date.now(), elapsed=50 which is NOT > 100
  assert.equal(controller.getGuardViolation(Date.now()), null);

  // With elapsed > maxDurationMs
  assert.equal(controller.getGuardViolation(Date.now() + 100), "harness.guard.max_duration_exceeded");
});

test("HarnessLoopController evaluateProgress returns violation when guard violated", () => {
  const pack = createMockConstraintPack({ maxSteps: 6 }); // maxIterations = 2
  const controller = new HarnessLoopController(pack);
  controller.recordIteration();
  controller.recordIteration();

  const progress = controller.evaluateProgress("retry_same_plan", true);
  assert.equal(progress.shouldContinue, false);
  assert.equal(progress.violation, "harness.guard.max_iterations_reached");
  assert.deepStrictEqual(progress.reasonCodes, ["harness.guard.max_iterations_reached"]);
});

test("HarnessLoopController evaluateProgress returns iteration_input_exhausted", () => {
  const controller = new HarnessLoopController(createMockConstraintPack());

  const progress = controller.evaluateProgress("retry_same_plan", false);
  assert.equal(progress.shouldContinue, false);
  assert.equal(progress.violation, null);
  assert.deepStrictEqual(progress.reasonCodes, ["harness.guard.iteration_input_exhausted"]);

  const progress2 = controller.evaluateProgress("replan", false);
  assert.equal(progress2.shouldContinue, false);
  assert.deepStrictEqual(progress2.reasonCodes, ["harness.guard.iteration_input_exhausted"]);
});

test("HarnessLoopController evaluateProgress returns shouldContinue=true for valid case", () => {
  const controller = new HarnessLoopController(createMockConstraintPack());

  const progress = controller.evaluateProgress("retry_same_plan", true);
  assert.equal(progress.shouldContinue, true);
  assert.equal(progress.violation, null);
  assert.deepStrictEqual(progress.reasonCodes, []);

  const progress2 = controller.evaluateProgress("replan", true);
  assert.equal(progress2.shouldContinue, true);
});

test("HarnessLoopController getState returns immutable state", () => {
  const controller = new HarnessLoopController(createMockConstraintPack());
  const state = controller.getState();

  // Type should be Readonly
  const _state: Readonly<{ iteration: number; replanCount: number; startedAt: number; totalCost: number }> = state;

  // Verify properties exist and are correct
  assert.equal(state.iteration, 0);
  assert.equal(state.replanCount, 0);
  assert.equal(state.totalCost, 0);
  assert.ok(state.startedAt > 0);
});

test("HarnessLoopController getGuards returns immutable guards", () => {
  const controller = new HarnessLoopController(createMockConstraintPack({ maxSteps: 30 }));
  const guards = controller.getGuards();

  // Type should be Readonly
  const _guards: Readonly<{ maxIterations: number; maxReplans: number; maxDurationMs: number; maxCost: number }> = guards;

  // Verify properties exist and are correct
  assert.equal(guards.maxIterations, 10);
  assert.equal(guards.maxReplans, 3);
  assert.equal(guards.maxDurationMs, 60000);
  assert.equal(guards.maxCost, 100);
});

test("HarnessLoopController evaluateProgress: retry_same_plan action vs other actions", () => {
  const controller = new HarnessLoopController(createMockConstraintPack());

  // accept action should return shouldContinue=false (not retry_same_plan or replan)
  const acceptProgress = controller.evaluateProgress("accept", true);
  assert.equal(acceptProgress.shouldContinue, false);

  // retry_same_plan should continue
  const retryProgress = controller.evaluateProgress("retry_same_plan", true);
  assert.equal(retryProgress.shouldContinue, true);

  // replan should continue
  const replanProgress = controller.evaluateProgress("replan", true);
  assert.equal(replanProgress.shouldContinue, true);
});
