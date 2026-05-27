import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionDeviationDetector, type ExecutionDeviation } from "../../../../../src/platform/five-plane-execution/dispatcher/execution-deviation-detector.js";
import type { Plan } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/index.js";
import type { FeedbackSignal } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/feedback-signal.js";
import { parseFeedbackBatch, type FeedbackBatch } from "../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";
import { parsePlan } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/plan.js";

function makePlan(taskId: string): Plan {
  return parsePlan({
    planId: "plan-1",
    taskId,
    version: 1,
    assessmentRef: "assessment-1",
    strategy: "linear",
    steps: [{ stepId: "step-1", action: "test", timeout: 30000, retryPolicy: { type: "immediate", maxRetries: 0, backoffMs: 0 } }],
    createdAt: Date.now(),
  });
}

function makeFeedback(outcome: FeedbackBatch["outcome"], signals: FeedbackSignal[] = []): FeedbackBatch {
  return parseFeedbackBatch({
    feedbackId: "fb-1",
    taskId: "task-1",
    executionId: null,
    planId: "plan-1",
    outcome,
    signals,
    emittedAt: Date.now(),
  });
}

// ---------------------------------------------------------------------------
// Additional edge cases for ExecutionDeviationDetector
// ---------------------------------------------------------------------------

test("ExecutionDeviationDetector detect returns empty for completed outcome [execution-deviation-detector-edge]", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan("task-1");
  const feedback = makeFeedback("completed");
  const deviations = detector.detect(plan, feedback);
  assert.equal(deviations.length, 0);
});

test("ExecutionDeviationDetector detect handles empty signals array [execution-deviation-detector-edge]", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan("task-1");
  const feedback = makeFeedback("completed", []);
  const deviations = detector.detect(plan, feedback);
  assert.equal(deviations.length, 0);
});

test("ExecutionDeviationDetector detect returns repairable with high severity [execution-deviation-detector-edge]", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan("task-1");
  const feedback = makeFeedback("repairable");
  const deviations = detector.detect(plan, feedback);
  assert.equal(deviations.length, 1);
  assert.equal(deviations[0]!.severity, "high");
  assert.equal(deviations[0]!.reasonCode, "execution.repairable");
});

test("ExecutionDeviationDetector detect returns failed with critical severity [execution-deviation-detector-edge]", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan("task-1");
  const feedback = makeFeedback("failed");
  const deviations = detector.detect(plan, feedback);
  assert.equal(deviations.length, 1);
  assert.equal(deviations[0]!.severity, "critical");
  assert.equal(deviations[0]!.reasonCode, "execution.failed");
});

test("ExecutionDeviationDetector detect returns escalated with critical severity [execution-deviation-detector-edge]", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan("task-1");
  const feedback = makeFeedback("escalated");
  const deviations = detector.detect(plan, feedback);
  assert.equal(deviations.length, 1);
  assert.equal(deviations[0]!.severity, "critical");
  assert.equal(deviations[0]!.reasonCode, "execution.escalated");
});

test("ExecutionDeviationDetector detect identifies timeout signal category [execution-deviation-detector-edge]", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan("task-1");
  const timeoutSignal: FeedbackSignal = {
    signalId: "sig-1",
    taskId: "task-1",
    source: "execution",
    category: "timeout",
    severity: "error",
    payload: { message: "timed out after 30 seconds" },
    stepOutputRefs: [],
    timestamp: Date.now(),
  };
  const feedback = makeFeedback("completed", [timeoutSignal]);
  const deviations = detector.detect(plan, feedback);
  assert.equal(deviations.length, 1);
  assert.equal(deviations[0]!.reasonCode, "execution.timeout");
  assert.equal(deviations[0]!.severity, "high");
});

test("ExecutionDeviationDetector detect ignores non-timeout signals [execution-deviation-detector-edge]", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan("task-1");
  const signals: FeedbackSignal[] = [
    { signalId: "sig-1", taskId: "task-1", source: "system", category: "success", severity: "warning", payload: {}, stepOutputRefs: [], timestamp: Date.now() },
    { signalId: "sig-2", taskId: "task-1", source: "user", category: "correction", severity: "info", payload: {}, stepOutputRefs: [], timestamp: Date.now() },
    { signalId: "sig-3", taskId: "task-1", source: "execution", category: "partial", severity: "warning", payload: {}, stepOutputRefs: [], timestamp: Date.now() },
  ];
  const feedback = makeFeedback("completed", signals);
  const deviations = detector.detect(plan, feedback);
  assert.equal(deviations.length, 0);
});

test("ExecutionDeviationDetector detect combines failed outcome with timeout [execution-deviation-detector-edge]", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan("task-1");
  const timeoutSignal: FeedbackSignal = {
    signalId: "sig-1",
    taskId: "task-1",
    source: "execution",
    category: "timeout",
    severity: "error",
    payload: {},
    stepOutputRefs: [],
    timestamp: Date.now(),
  };
  const feedback = makeFeedback("failed", [timeoutSignal]);
  const deviations = detector.detect(plan, feedback);
  assert.equal(deviations.length, 2);
  const reasonCodes = deviations.map(d => d.reasonCode);
  assert.ok(reasonCodes.includes("execution.failed"));
  assert.ok(reasonCodes.includes("execution.timeout"));
});

test("ExecutionDeviationDetector detect handles multiple timeout signals (deduplicates) [execution-deviation-detector-edge]", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan("task-1");
  const signals: FeedbackSignal[] = [
    { signalId: "sig-1", taskId: "task-1", source: "execution", category: "timeout", severity: "error", payload: {}, stepOutputRefs: [], timestamp: Date.now() },
    { signalId: "sig-2", taskId: "task-1", source: "execution", category: "timeout", severity: "error", payload: {}, stepOutputRefs: [], timestamp: Date.now() },
  ];
  const feedback = makeFeedback("completed", signals);
  const deviations = detector.detect(plan, feedback);
  // Still only 1 timeout deviation (category-level deduplication)
  assert.equal(deviations.length, 1);
  assert.equal(deviations[0]!.reasonCode, "execution.timeout");
});

test("ExecutionDeviationDetector detect assigns correct taskId to each deviation [execution-deviation-detector-edge]", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan("unique-task-id-12345");
  const feedback = makeFeedback("failed");
  const deviations = detector.detect(plan, feedback);
  assert.equal(deviations.length, 1);
  assert.equal(deviations[0]!.taskId, "unique-task-id-12345");
});

test("ExecutionDeviationDetector detect sets detectedAt within reasonable range [execution-deviation-detector-edge]", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan("task-1");
  const feedback = makeFeedback("failed");
  const before = Date.now() - 1000;
  const deviations = detector.detect(plan, feedback);
  const after = Date.now() + 1000;
  assert.ok(deviations[0]!.detectedAt >= before);
  assert.ok(deviations[0]!.detectedAt <= after);
});

test("ExecutionDeviationDetector detect generates unique deviationId each call [execution-deviation-detector-edge]", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan("task-1");

  const deviations1 = detector.detect(plan, makeFeedback("failed"));
  const deviations2 = detector.detect(plan, makeFeedback("failed"));
  const deviations3 = detector.detect(plan, makeFeedback("repairable"));

  assert.notEqual(deviations1[0]!.deviationId, deviations2[0]!.deviationId);
  assert.notEqual(deviations2[0]!.deviationId, deviations3[0]!.deviationId);
});

test("ExecutionDeviationDetector detect handles minimal valid plan without error [execution-deviation-detector-edge]", () => {
  const detector = new ExecutionDeviationDetector();
  const emptyPlan = makePlan("task-empty");
  const feedback = makeFeedback("failed");
  const deviations = detector.detect(emptyPlan, feedback);
  assert.equal(deviations.length, 1);
  assert.equal(deviations[0]!.taskId, "task-empty");
});

test("ExecutionDeviationDetector detect repairable deviation has correct summary [execution-deviation-detector-edge]", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan("task-1");
  const feedback = makeFeedback("repairable");
  const deviations = detector.detect(plan, feedback);
  assert.equal(deviations[0]!.summary, "Execution outcome drifted to repairable");
});

test("ExecutionDeviationDetector detect failed deviation has correct summary [execution-deviation-detector-edge]", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan("task-1");
  const feedback = makeFeedback("failed");
  const deviations = detector.detect(plan, feedback);
  assert.equal(deviations[0]!.summary, "Execution outcome drifted to failed");
});

test("ExecutionDeviationDetector detect escalated deviation has correct summary [execution-deviation-detector-edge]", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan("task-1");
  const feedback = makeFeedback("escalated");
  const deviations = detector.detect(plan, feedback);
  assert.equal(deviations[0]!.summary, "Execution outcome drifted to escalated");
});

test("ExecutionDeviationDetector detect timeout deviation has correct summary [execution-deviation-detector-edge]", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan("task-1");
  const timeoutSignal: FeedbackSignal = {
    signalId: "sig-1",
    taskId: "task-1",
    source: "execution",
    category: "timeout",
    severity: "error",
    payload: {},
    stepOutputRefs: [],
    timestamp: Date.now(),
  };
  const feedback = makeFeedback("completed", [timeoutSignal]);
  const deviations = detector.detect(plan, feedback);
  assert.equal(deviations[0]!.summary, "Execution exceeded expected timing budget.");
});

test("ExecutionDeviationDetector detect escalation with timeout gives two deviations [execution-deviation-detector-edge]", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan("task-1");
  const timeoutSignal: FeedbackSignal = {
    signalId: "sig-1",
    taskId: "task-1",
    source: "execution",
    category: "timeout",
    severity: "error",
    payload: {},
    stepOutputRefs: [],
    timestamp: Date.now(),
  };
  const feedback = makeFeedback("escalated", [timeoutSignal]);
  const deviations = detector.detect(plan, feedback);
  assert.equal(deviations.length, 2);
  const severities = deviations.map(d => d.severity);
  assert.ok(severities.includes("critical")); // escalated
  assert.ok(severities.includes("high")); // timeout
});

test("ExecutionDeviationDetector detect repairable with timeout gives two deviations [execution-deviation-detector-edge]", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan("task-1");
  const timeoutSignal: FeedbackSignal = {
    signalId: "sig-1",
    taskId: "task-1",
    source: "execution",
    category: "timeout",
    severity: "error",
    payload: {},
    stepOutputRefs: [],
    timestamp: Date.now(),
  };
  const feedback = makeFeedback("repairable", [timeoutSignal]);
  const deviations = detector.detect(plan, feedback);
  assert.equal(deviations.length, 2);
  const severities = deviations.map(d => d.severity);
  assert.ok(severities.includes("high")); // repairable
  assert.ok(severities.includes("high")); // timeout
});

test("ExecutionDeviationDetector detect failed with timeout gives two deviations [execution-deviation-detector-edge]", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan("task-1");
  const timeoutSignal: FeedbackSignal = {
    signalId: "sig-1",
    taskId: "task-1",
    source: "execution",
    category: "timeout",
    severity: "error",
    payload: {},
    stepOutputRefs: [],
    timestamp: Date.now(),
  };
  const feedback = makeFeedback("failed", [timeoutSignal]);
  const deviations = detector.detect(plan, feedback);
  assert.equal(deviations.length, 2);
  const severities = deviations.map(d => d.severity);
  assert.ok(severities.includes("critical")); // failed
  assert.ok(severities.includes("high")); // timeout
});

test("ExecutionDeviationDetector detect ignores timeout signal with completed outcome [execution-deviation-detector-edge]", () => {
  // This is actually covered - completed outcome + timeout = 1 timeout deviation
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan("task-1");
  const timeoutSignal: FeedbackSignal = {
    signalId: "sig-1",
    taskId: "task-1",
    source: "execution",
    category: "timeout",
    severity: "error",
    payload: {},
    stepOutputRefs: [],
    timestamp: Date.now(),
  };
  const feedback = makeFeedback("completed", [timeoutSignal]);
  const deviations = detector.detect(plan, feedback);
  assert.equal(deviations.length, 1);
  assert.equal(deviations[0]!.reasonCode, "execution.timeout");
});

test("ExecutionDeviationDetector detect deviationId format is valid [execution-deviation-detector-edge]", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan("task-1");
  const feedback = makeFeedback("failed");
  const deviations = detector.detect(plan, feedback);
  // Should start with "deviation_" based on newId("deviation")
  assert.match(deviations[0]!.deviationId, /^deviation_/);
});

test("ExecutionDeviationDetector detect timeout with various payload structures [execution-deviation-detector-edge]", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan("task-1");

  const payloads = [
    {},
    { message: "custom timeout" },
    { timeoutMs: 30000 },
    { stepId: "step-1", reason: "max_retries_exceeded" },
  ];

  for (const payload of payloads) {
    const timeoutSignal: FeedbackSignal = {
      signalId: "sig-1",
      taskId: "task-1",
      source: "execution",
      category: "timeout",
      severity: "error",
      payload,
      stepOutputRefs: [],
      timestamp: Date.now(),
    };
    const feedback = makeFeedback("completed", [timeoutSignal]);
    const deviations = detector.detect(plan, feedback);
    assert.equal(deviations.length, 1, `Failed for payload: ${JSON.stringify(payload)}`);
  }
});
