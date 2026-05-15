import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { HarnessLoopController, type ConstraintPack } from "../../../../../../src/platform/five-plane-orchestration/harness/index.js";

function createMockConstraintPack(overrides: Partial<ConstraintPack["budget"]> = {}): ConstraintPack {
  return {
    policyIds: [],
    approvalMode: "none",
    autonomyMode: "manual",
    toolPolicy: { allowedTools: [] },
    risk_policy: { maxRiskScore: 100, escalationThreshold: 80 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budget: {
      maxSteps: 30,
      maxDurationMs: 100,
      maxCost: 50,
      ...overrides,
    },
  };
}

describe("HarnessLoopController", () => {
  describe("Multi-iteration progression", () => {
    it("should increment iteration count on each recordIteration call", () => {
      const controller = new HarnessLoopController(createMockConstraintPack());

      controller.recordIteration();
      assert.strictEqual(controller.getState().iteration, 1);

      controller.recordIteration();
      assert.strictEqual(controller.getState().iteration, 2);

      controller.recordIteration();
      assert.strictEqual(controller.getState().iteration, 3);

      controller.recordIteration();
      assert.strictEqual(controller.getState().iteration, 4);

      controller.recordIteration();
      assert.strictEqual(controller.getState().iteration, 5);
    });

    it("should reach iteration count of 5 after 5 calls", () => {
      const controller = new HarnessLoopController(createMockConstraintPack());

      for (let i = 0; i < 5; i++) {
        controller.recordIteration();
      }

      assert.strictEqual(controller.getState().iteration, 5);
    });
  });

  describe("Guard violation after multiple iterations", () => {
    it("should trigger max iterations guard when iteration count reaches maxIterations", () => {
      const constraintPack = createMockConstraintPack({ maxSteps: 30 });
      const controller = new HarnessLoopController(constraintPack);
      const maxIterations = controller.getGuards().maxIterations;

      for (let i = 0; i < maxIterations; i++) {
        controller.recordIteration();
      }

      const violation = controller.getGuardViolation();
      assert.strictEqual(violation, "harness.guard.max_iterations_reached");
    });

    it("should not trigger guard before reaching maxIterations", () => {
      const constraintPack = createMockConstraintPack({ maxSteps: 30 });
      const controller = new HarnessLoopController(constraintPack);
      const maxIterations = controller.getGuards().maxIterations;

      for (let i = 0; i < maxIterations - 1; i++) {
        controller.recordIteration();
      }

      const violation = controller.getGuardViolation();
      assert.strictEqual(violation, null);
    });
  });

  describe("Replan counting", () => {
    it("should increment replanCount on each recordReplan call", () => {
      const controller = new HarnessLoopController(createMockConstraintPack());

      assert.strictEqual(controller.getState().replanCount, 0);

      controller.recordReplan();
      assert.strictEqual(controller.getState().replanCount, 1);

      controller.recordReplan();
      assert.strictEqual(controller.getState().replanCount, 2);

      controller.recordReplan();
      assert.strictEqual(controller.getState().replanCount, 3);
    });

    it("should track multiple replans correctly", () => {
      const controller = new HarnessLoopController(createMockConstraintPack());
      const maxReplans = controller.getGuards().maxReplans;

      for (let i = 0; i < maxReplans + 1; i++) {
        controller.recordReplan();
      }

      const violation = controller.getGuardViolation();
      assert.strictEqual(violation, "harness.guard.max_replans_reached");
    });
  });

  describe("Cost accumulation over iterations", () => {
    it("should accumulate costs correctly across iterations", () => {
      const controller = new HarnessLoopController(createMockConstraintPack());

      controller.recordIteration(10.5);
      controller.recordIteration(20.25);
      controller.recordIteration(5.75);

      assert.strictEqual(controller.getState().totalCost, 36.5);
    });

    it("should handle fractional costs with proper precision", () => {
      const controller = new HarnessLoopController(createMockConstraintPack());

      controller.recordIteration(0.1);
      controller.recordIteration(0.2);
      controller.recordIteration(0.3);

      assert.strictEqual(controller.getState().totalCost, 0.6);
    });

    it("should exceed maxCost guard when accumulated cost is too high", () => {
      const controller = new HarnessLoopController(createMockConstraintPack());
      const maxCost = controller.getGuards().maxCost;

      controller.recordIteration(maxCost + 1);

      const violation = controller.getGuardViolation();
      assert.strictEqual(violation, "harness.guard.max_cost_exceeded");
    });
  });

  describe("Duration guard with time passage", () => {
    it("should trigger duration guard after time expires", async () => {
      const constraintPack = createMockConstraintPack({ maxDurationMs: 50 });
      const controller = new HarnessLoopController(constraintPack);

      const violationBefore = controller.getGuardViolation();
      assert.strictEqual(violationBefore, null);

      await new Promise((resolve) => setTimeout(resolve, 100));
      const violationAfter = controller.getGuardViolation();
      assert.strictEqual(violationAfter, "harness.guard.max_duration_exceeded");
    });

    it("should not trigger duration guard before time expires", async () => {
      const constraintPack = createMockConstraintPack({ maxDurationMs: 200 });
      const controller = new HarnessLoopController(constraintPack);

      await new Promise((resolve) => setTimeout(resolve, 50));
      const violation = controller.getGuardViolation();
      assert.strictEqual(violation, null);
    });
  });

  describe("Cross-iteration replan + iteration tracking", () => {
    it("should maintain consistent state when mixing replans and iterations", () => {
      const controller = new HarnessLoopController(createMockConstraintPack());

      controller.recordIteration(5);
      controller.recordReplan();
      controller.recordIteration(10);
      controller.recordReplan();
      controller.recordIteration(15);

      assert.strictEqual(controller.getState().iteration, 3);
      assert.strictEqual(controller.getState().replanCount, 2);
      assert.strictEqual(controller.getState().totalCost, 30);
    });

    it("should handle interleaved replans and iterations correctly", () => {
      const controller = new HarnessLoopController(createMockConstraintPack());

      controller.recordReplan();
      controller.recordIteration(5);
      controller.recordIteration(10);
      controller.recordReplan();
      controller.recordIteration(15);

      assert.strictEqual(controller.getState().iteration, 3);
      assert.strictEqual(controller.getState().replanCount, 2);
      assert.strictEqual(controller.getState().totalCost, 30);
    });
  });

  describe("evaluateProgress flow through full loop", () => {
    it("should transition from running to guard violation", () => {
      const constraintPack = createMockConstraintPack({ maxSteps: 30 });
      const controller = new HarnessLoopController(constraintPack);

      let progress = controller.evaluateProgress("retry_same_plan", true);
      assert.strictEqual(progress.shouldContinue, true);
      assert.strictEqual(progress.violation, null);
      assert.deepStrictEqual(progress.reasonCodes, []);

      controller.recordIteration(5);
      progress = controller.evaluateProgress("replan", true);
      assert.strictEqual(progress.shouldContinue, true);
      assert.strictEqual(progress.violation, null);

      controller.recordIteration(5);
      progress = controller.evaluateProgress("retry_same_plan", true);
      assert.strictEqual(progress.shouldContinue, true);

      controller.recordIteration(5);
      const maxIterations = controller.getGuards().maxIterations;
      for (let i = controller.getState().iteration; i < maxIterations; i++) {
        controller.recordIteration(5);
      }

      progress = controller.evaluateProgress("retry_same_plan", true);
      assert.strictEqual(progress.shouldContinue, false);
      assert.strictEqual(progress.violation, "harness.guard.max_iterations_reached");
      assert.deepStrictEqual(progress.reasonCodes, ["harness.guard.max_iterations_reached"]);
    });

    it("should report iteration_input_exhausted when no remaining iterations", () => {
      const controller = new HarnessLoopController(createMockConstraintPack());

      const progress = controller.evaluateProgress("retry_same_plan", false);
      assert.strictEqual(progress.shouldContinue, false);
      assert.strictEqual(progress.violation, null);
      assert.deepStrictEqual(progress.reasonCodes, ["harness.guard.iteration_input_exhausted"]);
    });

    it("should continue when lastAction is retry_same_plan and has remaining iterations", () => {
      const controller = new HarnessLoopController(createMockConstraintPack());

      const progress = controller.evaluateProgress("retry_same_plan", true);
      assert.strictEqual(progress.shouldContinue, true);
      assert.strictEqual(progress.violation, null);
    });

    it("should continue when lastAction is replan and has remaining iterations", () => {
      const controller = new HarnessLoopController(createMockConstraintPack());

      const progress = controller.evaluateProgress("replan", true);
      assert.strictEqual(progress.shouldContinue, true);
      assert.strictEqual(progress.violation, null);
    });

    it("should not continue when lastAction is not retry_same_plan or replan", () => {
      const controller = new HarnessLoopController(createMockConstraintPack());

      const progress = controller.evaluateProgress("accept", true);
      assert.strictEqual(progress.shouldContinue, false);
    });
  });

  describe("Cost guard threshold", () => {
    it("should trigger cost guard when accumulated cost exceeds maxCost", () => {
      const constraintPack = createMockConstraintPack({ maxCost: 50 });
      const controller = new HarnessLoopController(constraintPack);

      controller.recordIteration(30);
      assert.strictEqual(controller.getGuardViolation(), null);

      controller.recordIteration(25);
      assert.strictEqual(controller.getGuardViolation(), "harness.guard.max_cost_exceeded");
    });

    it("should allow iteration when cost is exactly at maxCost", () => {
      const constraintPack = createMockConstraintPack({ maxCost: 100 });
      const controller = new HarnessLoopController(constraintPack);

      controller.recordIteration(100);
      assert.strictEqual(controller.getGuardViolation(), null);
    });
  });

  describe("Multiple guards triggered in sequence", () => {
    it("should keep cost guard priority even after duration expires", async () => {
      const constraintPack = createMockConstraintPack({
        maxDurationMs: 50,
        maxCost: 100,
      });
      const controller = new HarnessLoopController(constraintPack);

      controller.recordIteration(150);
      let violation = controller.getGuardViolation();
      assert.strictEqual(violation, "harness.guard.max_cost_exceeded");

      await new Promise((resolve) => setTimeout(resolve, 100));
      violation = controller.getGuardViolation();
      assert.strictEqual(violation, "harness.guard.max_cost_exceeded");
    });

    it("should trigger duration guard before cost guard when duration expires first", async () => {
      const constraintPack = createMockConstraintPack({
        maxDurationMs: 50,
        maxCost: 200,
      });
      const controller = new HarnessLoopController(constraintPack);

      controller.recordIteration(50);

      await new Promise((resolve) => setTimeout(resolve, 100));
      const violation = controller.getGuardViolation();
      assert.strictEqual(violation, "harness.guard.max_duration_exceeded");
    });

    it("should respect guard priority order: iterations, replans, cost, duration", () => {
      const constraintPack = createMockConstraintPack({ maxSteps: 30 });
      const controller = new HarnessLoopController(constraintPack);

      controller.recordReplan();
      controller.recordReplan();
      controller.recordReplan();
      controller.recordReplan();

      let violation = controller.getGuardViolation();
      assert.strictEqual(violation, "harness.guard.max_replans_reached");

      const maxIterations = controller.getGuards().maxIterations;
      for (let i = 0; i < maxIterations; i++) {
        controller.recordIteration();
      }

      violation = controller.getGuardViolation();
      assert.strictEqual(violation, "harness.guard.max_iterations_reached");
    });
  });

  describe("shouldContinue", () => {
    it("should return false when guard violation exists", () => {
      const constraintPack = createMockConstraintPack({ maxSteps: 30 });
      const controller = new HarnessLoopController(constraintPack);
      const maxIterations = controller.getGuards().maxIterations;

      for (let i = 0; i < maxIterations; i++) {
        controller.recordIteration();
      }

      assert.strictEqual(controller.shouldContinue("retry_same_plan", true), false);
    });

    it("should return false when no remaining iterations", () => {
      const controller = new HarnessLoopController(createMockConstraintPack());

      assert.strictEqual(controller.shouldContinue("retry_same_plan", false), false);
    });

    it("should return true when lastAction is retry_same_plan and no guard violation", () => {
      const controller = new HarnessLoopController(createMockConstraintPack());

      assert.strictEqual(controller.shouldContinue("retry_same_plan", true), true);
    });

    it("should return true when lastAction is replan and no guard violation", () => {
      const controller = new HarnessLoopController(createMockConstraintPack());

      assert.strictEqual(controller.shouldContinue("replan", true), true);
    });

    it("should return false when lastAction is not retry_same_plan or replan", () => {
      const controller = new HarnessLoopController(createMockConstraintPack());

      assert.strictEqual(controller.shouldContinue("accept", true), false);
      assert.strictEqual(controller.shouldContinue("abort", true), false);
      assert.strictEqual(controller.shouldContinue("escalate_to_human", true), false);
    });
  });

  describe("getGuards", () => {
    it("should calculate maxIterations as Math.floor(maxSteps / 3)", () => {
      const controller = new HarnessLoopController(createMockConstraintPack({ maxSteps: 30 }));

      assert.strictEqual(controller.getGuards().maxIterations, 10);
      assert.strictEqual(controller.getGuards().maxReplans, 3);
      assert.strictEqual(controller.getGuards().maxDurationMs, 100);
      assert.strictEqual(controller.getGuards().maxCost, 50);
    });

    it("should respect guard overrides", () => {
      const controller = new HarnessLoopController(
        createMockConstraintPack(),
        { maxIterations: 5, maxReplans: 2, maxDurationMs: 1000, maxCost: 100 },
      );

      assert.strictEqual(controller.getGuards().maxIterations, 5);
      assert.strictEqual(controller.getGuards().maxReplans, 2);
      assert.strictEqual(controller.getGuards().maxDurationMs, 1000);
      assert.strictEqual(controller.getGuards().maxCost, 100);
    });
  });

  describe("getState", () => {
    it("should return initial state correctly", () => {
      const controller = new HarnessLoopController(createMockConstraintPack());
      const state = controller.getState();

      assert.strictEqual(state.iteration, 0);
      assert.strictEqual(state.replanCount, 0);
      assert.strictEqual(state.totalCost, 0);
      assert.ok(state.startedAt > 0);
    });

    it("should respect initialState overrides", () => {
      const fixedStartTime = Date.now() - 1000;
      const controller = new HarnessLoopController(
        createMockConstraintPack(),
        {},
        { iteration: 5, replanCount: 2, totalCost: 25, startedAt: fixedStartTime },
      );
      const state = controller.getState();

      assert.strictEqual(state.iteration, 5);
      assert.strictEqual(state.replanCount, 2);
      assert.strictEqual(state.totalCost, 25);
      assert.strictEqual(state.startedAt, fixedStartTime);
    });
  });
});
