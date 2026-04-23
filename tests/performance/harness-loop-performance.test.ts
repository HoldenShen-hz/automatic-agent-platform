import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HarnessRuntimeService, HarnessLoopController, type ConstraintPack, type HarnessLoopInput } from "../../src/platform/orchestration/harness/index.js";
import { newId } from "../../src/platform/contracts/types/ids.js";

const createMockConstraintPack = (): ConstraintPack => ({
  policyIds: [],
  approvalMode: "none",
  autonomyMode: "manual",
  toolPolicy: { allowedTools: [] },
  risk_policy: { maxRiskScore: 100, escalationThreshold: 80 },
  output_policy: { requiredEvidence: [], redactSensitiveData: false },
  budget: {
    maxSteps: 300,
    maxDurationMs: 60000,
    maxCost: 100000,
  },
});

const ACTIONS: ("retry_same_plan" | "replan" | "accept")[] = [
  "retry_same_plan",
  "replan",
  "accept",
];

describe("HarnessLoopController Performance Benchmarks", () => {
  describe("recordIteration throughput", () => {
    it("should handle 10000 recordIteration calls at > 100000 ops/sec", () => {
      const controller = new HarnessLoopController(createMockConstraintPack());
      const iterations = 10000;

      // Warm up
      for (let i = 0; i < 100; i++) {
        controller.recordIteration(0.1);
      }

      // Reset to clean state
      const freshController = new HarnessLoopController(createMockConstraintPack());

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        freshController.recordIteration(0.1);
      }
      const end = performance.now();

      const durationMs = end - start;
      const opsPerSec = (iterations / durationMs) * 1000;

      assert.ok(
        opsPerSec > 100000,
        `recordIteration throughput ${opsPerSec.toFixed(0)} ops/sec should be > 100000 ops/sec`,
      );
    });
  });

  describe("recordReplan throughput", () => {
    it("should handle 10000 recordReplan calls", () => {
      const controller = new HarnessLoopController(createMockConstraintPack());
      const iterations = 10000;

      // Warm up
      for (let i = 0; i < 100; i++) {
        controller.recordReplan();
      }

      // Reset to clean state
      const freshController = new HarnessLoopController(createMockConstraintPack());

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        freshController.recordReplan();
      }
      const end = performance.now();

      const durationMs = end - start;
      const opsPerSec = (iterations / durationMs) * 1000;

      assert.ok(
        opsPerSec > 80000,
        `recordReplan throughput ${opsPerSec.toFixed(0)} ops/sec should be > 80000 ops/sec`,
      );
    });
  });

  describe("getGuardViolation latency", () => {
    it("should evaluate getGuardViolation 50000 times with avg latency < 1µs", () => {
      const controller = new HarnessLoopController(createMockConstraintPack());
      const iterations = 50000;

      // Warm up
      for (let i = 0; i < 100; i++) {
        controller.getGuardViolation();
      }

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        controller.getGuardViolation();
      }
      const end = performance.now();

      const durationNs = (end - start) * 1_000_000;
      const avgLatencyNs = durationNs / iterations;

      assert.ok(
        avgLatencyNs < 1000,
        `getGuardViolation avg latency ${avgLatencyNs.toFixed(2)}ns should be < 1000ns (1µs)`,
      );
    });
  });

  describe("evaluateProgress throughput", () => {
    it("should handle 10000 evaluateProgress calls with different actions", () => {
      const controller = new HarnessLoopController(createMockConstraintPack());
      const iterations = 10000;

      // Warm up
      for (let i = 0; i < 100; i++) {
        controller.evaluateProgress("retry_same_plan", true);
      }

      // Reset to clean state
      const freshController = new HarnessLoopController(createMockConstraintPack());

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        const action = ACTIONS[i % ACTIONS.length]!;
        freshController.evaluateProgress(action, true);
      }
      const end = performance.now();

      const durationMs = end - start;
      const opsPerSec = (iterations / durationMs) * 1000;

      assert.ok(
        opsPerSec > 50000,
        `evaluateProgress throughput ${opsPerSec.toFixed(0)} ops/sec should be > 50000 ops/sec`,
      );
    });
  });

  describe("getState/getGuards latency", () => {
    it("should measure readout performance for getState", () => {
      const controller = new HarnessLoopController(createMockConstraintPack());
      const iterations = 100000;

      // Warm up
      for (let i = 0; i < 100; i++) {
        controller.getState();
      }

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        controller.getState();
      }
      const end = performance.now();

      const durationNs = (end - start) * 1_000_000;
      const avgLatencyNs = durationNs / iterations;

      assert.ok(
        avgLatencyNs < 500,
        `getState avg latency ${avgLatencyNs.toFixed(2)}ns should be < 500ns`,
      );
    });

    it("should measure readout performance for getGuards", () => {
      const controller = new HarnessLoopController(createMockConstraintPack());
      const iterations = 100000;

      // Warm up
      for (let i = 0; i < 100; i++) {
        controller.getGuards();
      }

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        controller.getGuards();
      }
      const end = performance.now();

      const durationNs = (end - start) * 1_000_000;
      const avgLatencyNs = durationNs / iterations;

      assert.ok(
        avgLatencyNs < 500,
        `getGuards avg latency ${avgLatencyNs.toFixed(2)}ns should be < 500ns`,
      );
    });
  });

  describe("Full loop iteration performance", () => {
    it("should simulate 100 complete loop cycles efficiently", () => {
      const controller = new HarnessLoopController(createMockConstraintPack());
      const cycles = 100;

      // Warm up
      const warmupController = new HarnessLoopController(createMockConstraintPack());
      for (let i = 0; i < 100; i++) {
        warmupController.recordIteration(0.1);
        warmupController.evaluateProgress("retry_same_plan", true);
      }

      const start = performance.now();
      for (let cycle = 0; cycle < cycles; cycle++) {
        controller.recordIteration(0.1);
        controller.evaluateProgress("retry_same_plan", true);
      }
      const end = performance.now();

      const durationMs = end - start;
      const cyclesPerSec = (cycles / durationMs) * 1000;

      assert.ok(
        cyclesPerSec > 1000,
        `Full loop cycles ${cyclesPerSec.toFixed(0)} cycles/sec should be > 1000 cycles/sec`,
      );
    });
  });

  describe("runLoop iteration throughput", () => {
    const createLoopInput = (overrides: Partial<HarnessLoopInput> = {}): HarnessLoopInput => ({
      taskId: newId("task"),
      domainId: newId("domain"),
      constraintPack: createMockConstraintPack(),
      plannerOutput: { plan: "test plan", steps: ["step1", "step2"] },
      generatorOutput: { result: "test result", artifacts: [] },
      evaluatorOutput: { evaluation: "passed", details: {} },
      evaluatorScore: 0.85,
      riskScore: 50,
      requestedTools: ["tool_a", "tool_b", "tool_c"],
      producedEvidenceRefs: ["evidence_1"],
      requiresHuman: false,
      iteration: 1,
      ...overrides,
    });

    it("should execute runLoop iterations at > 500 ops/sec", () => {
      const service = new HarnessRuntimeService();
      const iterations = 500;

      // Warm up with a single iteration
      const warmupInput = createLoopInput({ evaluatorScore: 0.9 });
      service.runLoop(warmupInput);

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        // Each runLoop completes in one iteration due to evaluatorScore >= 0.75
        service.runLoop(createLoopInput({ evaluatorScore: 0.9, taskId: newId("task") }));
      }
      const end = performance.now();

      const durationMs = end - start;
      const opsPerSec = (iterations / durationMs) * 1000;

      assert.ok(
        opsPerSec > 500,
        `runLoop iteration throughput ${opsPerSec.toFixed(0)} ops/sec should be > 500 ops/sec`,
      );
    });

    it("should handle replan-triggering runLoop at > 300 ops/sec", () => {
      const service = new HarnessRuntimeService();
      const iterations = 300;

      // Warm up
      const warmupInput = createLoopInput({ evaluatorScore: 0.3 }); // Low score triggers replan
      service.runLoop(warmupInput);

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        // Low score triggers replan which stops the loop
        service.runLoop(createLoopInput({ evaluatorScore: 0.3, taskId: newId("task") }));
      }
      const end = performance.now();

      const durationMs = end - start;
      const opsPerSec = (iterations / durationMs) * 1000;

      assert.ok(
        opsPerSec > 300,
        `runLoop replan throughput ${opsPerSec.toFixed(0)} ops/sec should be > 300 ops/sec`,
      );
    });

    it("should handle multi-iteration runLoop at > 100 cycles/sec", () => {
      const service = new HarnessRuntimeService();
      const iterations = 100;

      // Warm up
      const warmupInput = createLoopInput({
        evaluatorScore: 0.6, // Triggers retry_same_plan, continuing loop
        constraintPack: {
          ...createMockConstraintPack(),
          budget: { maxSteps: 30, maxDurationMs: 60000, maxCost: 100000 },
        },
      });
      service.runLoop(warmupInput);

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        // Score 0.6 triggers retry_same_plan, which continues until max steps
        service.runLoop(createLoopInput({
          evaluatorScore: 0.6,
          taskId: newId("task"),
          constraintPack: {
            ...createMockConstraintPack(),
            budget: { maxSteps: 30, maxDurationMs: 60000, maxCost: 100000 },
          },
        }));
      }
      const end = performance.now();

      const durationMs = end - start;
      const cyclesPerSec = (iterations / durationMs) * 1000;

      assert.ok(
        cyclesPerSec > 100,
        `runLoop multi-iteration throughput ${cyclesPerSec.toFixed(0)} cycles/sec should be > 100 cycles/sec`,
      );
    });

    it("should handle runLoop with human escalation at > 400 ops/sec", () => {
      const service = new HarnessRuntimeService();
      const iterations = 400;

      // Warm up
      const warmupInput = createLoopInput({ riskScore: 95 }); // High risk triggers escalation
      service.runLoop(warmupInput);

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        service.runLoop(createLoopInput({ riskScore: 95, taskId: newId("task") }));
      }
      const end = performance.now();

      const durationMs = end - start;
      const opsPerSec = (iterations / durationMs) * 1000;

      assert.ok(
        opsPerSec > 400,
        `runLoop escalation throughput ${opsPerSec.toFixed(0)} ops/sec should be > 400 ops/sec`,
      );
    });
  });
});
