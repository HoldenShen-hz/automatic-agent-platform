import test from "node:test";
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

test("HarnessLoopController recordIteration should handle 10000 calls at > 100000 ops/sec", () => {
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

test("HarnessLoopController recordReplan should handle 10000 calls at > 80000 ops/sec", () => {
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

test("HarnessLoopController getGuardViolation should evaluate 50000 times with avg latency < 1µs", () => {
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

test("HarnessLoopController evaluateProgress should handle 10000 calls with different actions at > 50000 ops/sec", () => {
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

test("HarnessLoopController getState should measure readout performance at < 500ns avg latency", () => {
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

test("HarnessLoopController getGuards should measure readout performance at < 500ns avg latency", () => {
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

test("HarnessLoopController should simulate 100 complete loop cycles efficiently at > 1000 cycles/sec", () => {
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

test("HarnessRuntimeService runLoop should execute iterations at > 500 ops/sec", () => {
  const service = new HarnessRuntimeService();
  const iterations = 500;

  // Warm up with a single iteration
  const warmupInput = {
    taskId: newId("task"),
    domainId: newId("domain"),
    constraintPack: createMockConstraintPack(),
    plannerOutput: { plan: "test plan", steps: ["step1", "step2"] },
    generatorOutput: { result: "test result", artifacts: [] },
    evaluatorOutput: { evaluation: "passed", details: {} },
    evaluatorScore: 0.9,
    riskScore: 50,
    requestedTools: ["tool_a", "tool_b", "tool_c"],
    producedEvidenceRefs: ["evidence_1"],
    requiresHuman: false,
    iteration: 1,
  };
  service.runLoop(warmupInput);

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    // Each runLoop completes in one iteration due to evaluatorScore >= 0.75
    service.runLoop({
      taskId: newId("task"),
      domainId: newId("domain"),
      constraintPack: createMockConstraintPack(),
      plannerOutput: { plan: "test plan", steps: ["step1", "step2"] },
      generatorOutput: { result: "test result", artifacts: [] },
      evaluatorOutput: { evaluation: "passed", details: {} },
      evaluatorScore: 0.9,
      riskScore: 50,
      requestedTools: ["tool_a", "tool_b", "tool_c"],
      producedEvidenceRefs: ["evidence_1"],
      requiresHuman: false,
      iteration: 1,
    });
  }
  const end = performance.now();

  const durationMs = end - start;
  const opsPerSec = (iterations / durationMs) * 1000;

  assert.ok(
    opsPerSec > 500,
    `runLoop iteration throughput ${opsPerSec.toFixed(0)} ops/sec should be > 500 ops/sec`,
  );
});

test("HarnessRuntimeService runLoop with replan should handle at > 300 ops/sec", () => {
  const service = new HarnessRuntimeService();
  const iterations = 300;

  // Warm up
  const warmupInput = {
    taskId: newId("task"),
    domainId: newId("domain"),
    constraintPack: createMockConstraintPack(),
    plannerOutput: { plan: "test plan", steps: ["step1", "step2"] },
    generatorOutput: { result: "test result", artifacts: [] },
    evaluatorOutput: { evaluation: "failed", details: {} },
    evaluatorScore: 0.3,
    riskScore: 50,
    requestedTools: ["tool_a", "tool_b", "tool_c"],
    producedEvidenceRefs: ["evidence_1"],
    requiresHuman: false,
    iteration: 1,
  };
  service.runLoop(warmupInput);

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    // Low score triggers replan which stops the loop
    service.runLoop({
      taskId: newId("task"),
      domainId: newId("domain"),
      constraintPack: createMockConstraintPack(),
      plannerOutput: { plan: "test plan", steps: ["step1", "step2"] },
      generatorOutput: { result: "test result", artifacts: [] },
      evaluatorOutput: { evaluation: "failed", details: {} },
      evaluatorScore: 0.3,
      riskScore: 50,
      requestedTools: ["tool_a", "tool_b", "tool_c"],
      producedEvidenceRefs: ["evidence_1"],
      requiresHuman: false,
      iteration: 1,
    });
  }
  const end = performance.now();

  const durationMs = end - start;
  const opsPerSec = (iterations / durationMs) * 1000;

  assert.ok(
    opsPerSec > 300,
    `runLoop replan throughput ${opsPerSec.toFixed(0)} ops/sec should be > 300 ops/sec`,
  );
});

test("HarnessRuntimeService runLoop with multi-iteration should handle at > 100 cycles/sec", () => {
  const service = new HarnessRuntimeService();
  const iterations = 100;

  // Warm up
  const warmupInput = {
    taskId: newId("task"),
    domainId: newId("domain"),
    constraintPack: {
      ...createMockConstraintPack(),
      budget: { maxSteps: 30, maxDurationMs: 60000, maxCost: 100000 },
    },
    plannerOutput: { plan: "test plan", steps: ["step1", "step2"] },
    generatorOutput: { result: "test result", artifacts: [] },
    evaluatorOutput: { evaluation: "needs_improvement", details: {} },
    evaluatorScore: 0.6,
    riskScore: 50,
    requestedTools: ["tool_a", "tool_b", "tool_c"],
    producedEvidenceRefs: ["evidence_1"],
    requiresHuman: false,
    iteration: 1,
  };
  service.runLoop(warmupInput);

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    // Score 0.6 triggers retry_same_plan, which continues until max steps
    service.runLoop({
      taskId: newId("task"),
      domainId: newId("domain"),
      constraintPack: {
        ...createMockConstraintPack(),
        budget: { maxSteps: 30, maxDurationMs: 60000, maxCost: 100000 },
      },
      plannerOutput: { plan: "test plan", steps: ["step1", "step2"] },
      generatorOutput: { result: "test result", artifacts: [] },
      evaluatorOutput: { evaluation: "needs_improvement", details: {} },
      evaluatorScore: 0.6,
      riskScore: 50,
      requestedTools: ["tool_a", "tool_b", "tool_c"],
      producedEvidenceRefs: ["evidence_1"],
      requiresHuman: false,
      iteration: 1,
    });
  }
  const end = performance.now();

  const durationMs = end - start;
  const cyclesPerSec = (iterations / durationMs) * 1000;

  assert.ok(
    cyclesPerSec > 100,
    `runLoop multi-iteration throughput ${cyclesPerSec.toFixed(0)} cycles/sec should be > 100 cycles/sec`,
  );
});

test("HarnessRuntimeService runLoop with human escalation should handle at > 400 ops/sec", () => {
  const service = new HarnessRuntimeService();
  const iterations = 400;

  // Warm up
  const warmupInput = {
    taskId: newId("task"),
    domainId: newId("domain"),
    constraintPack: createMockConstraintPack(),
    plannerOutput: { plan: "test plan", steps: ["step1", "step2"] },
    generatorOutput: { result: "test result", artifacts: [] },
    evaluatorOutput: { evaluation: "passed", details: {} },
    evaluatorScore: 0.85,
    riskScore: 95,
    requestedTools: ["tool_a", "tool_b", "tool_c"],
    producedEvidenceRefs: ["evidence_1"],
    requiresHuman: false,
    iteration: 1,
  };
  service.runLoop(warmupInput);

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    service.runLoop({
      taskId: newId("task"),
      domainId: newId("domain"),
      constraintPack: createMockConstraintPack(),
      plannerOutput: { plan: "test plan", steps: ["step1", "step2"] },
      generatorOutput: { result: "test result", artifacts: [] },
      evaluatorOutput: { evaluation: "passed", details: {} },
      evaluatorScore: 0.85,
      riskScore: 95,
      requestedTools: ["tool_a", "tool_b", "tool_c"],
      producedEvidenceRefs: ["evidence_1"],
      requiresHuman: false,
      iteration: 1,
    });
  }
  const end = performance.now();

  const durationMs = end - start;
  const opsPerSec = (iterations / durationMs) * 1000;

  assert.ok(
    opsPerSec > 400,
    `runLoop escalation throughput ${opsPerSec.toFixed(0)} ops/sec should be > 400 ops/sec`,
  );
});
