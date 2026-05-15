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

test("ExecutionDeviationDetector detect returns empty array when outcome is completed", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan("task-1");
  const feedback = makeFeedback("completed");
  const deviations = detector.detect(plan, feedback);
  assert.equal(deviations.length, 0);
});

test("ExecutionDeviationDetector detect returns deviation for repairable outcome", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan("task-1");
  const feedback = makeFeedback("repairable");
  const deviations = detector.detect(plan, feedback);
  assert.equal(deviations.length, 1);
  assert.equal(deviations[0]!.severity, "high");
  assert.equal(deviations[0]!.reasonCode, "execution.repairable");
  assert.equal(deviations[0]!.taskId, "task-1");
});

test("ExecutionDeviationDetector detect returns deviation for failed outcome", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan("task-2");
  const feedback = makeFeedback("failed");
  const deviations = detector.detect(plan, feedback);
  assert.equal(deviations.length, 1);
  assert.equal(deviations[0]!.severity, "critical");
  assert.equal(deviations[0]!.reasonCode, "execution.failed");
  assert.equal(deviations[0]!.taskId, "task-2");
});

test("ExecutionDeviationDetector detect returns deviation for escalated outcome", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan("task-3");
  const feedback = makeFeedback("escalated");
  const deviations = detector.detect(plan, feedback);
  assert.equal(deviations.length, 1);
  assert.equal(deviations[0]!.severity, "critical");
  assert.equal(deviations[0]!.reasonCode, "execution.escalated");
});

test("ExecutionDeviationDetector detect returns timeout signal deviation", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan("task-1");
  const timeoutSignal: FeedbackSignal = {
    signalId: "sig-1",
    taskId: "task-1",
    source: "execution",
    category: "timeout",
    severity: "error",
    payload: { message: "timed out" },
    stepOutputRefs: [],
    timestamp: Date.now(),
  };
  const feedback = makeFeedback("completed", [timeoutSignal]);
  const deviations = detector.detect(plan, feedback);
  assert.equal(deviations.length, 1);
  assert.equal(deviations[0]!.severity, "high");
  assert.equal(deviations[0]!.reasonCode, "execution.timeout");
  assert.equal(deviations[0]!.summary, "Execution exceeded expected timing budget.");
});

test("ExecutionDeviationDetector detect returns multiple deviations when both outcome and timeout", () => {
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
});

test("ExecutionDeviationDetector detect returns deviation with newId format", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan("task-1");
  const feedback = makeFeedback("failed");
  const deviations = detector.detect(plan, feedback);
  assert.match(deviations[0]!.deviationId, /^deviation_/);
});

test("ExecutionDeviationDetector detect returns deviation with detectedAt timestamp", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan("task-1");
  const feedback = makeFeedback("failed");
  const before = Date.now();
  const deviations = detector.detect(plan, feedback);
  const after = Date.now();
  assert.ok(deviations[0]!.detectedAt >= before);
  assert.ok(deviations[0]!.detectedAt <= after);
});

test("ExecutionDeviationDetector detect ignores non-timeout signals", () => {
  const costSignal: FeedbackSignal = {
    signalId: "sig-2",
    taskId: "task-1",
    source: "system",
    category: "failure",
    severity: "warning",
    payload: { message: "high cost" },
    stepOutputRefs: [],
    timestamp: Date.now(),
  };
  const qualitySignal: FeedbackSignal = {
    signalId: "sig-3",
    taskId: "task-1",
    source: "user",
    category: "correction",
    severity: "info",
    payload: { message: "low quality" },
    stepOutputRefs: [],
    timestamp: Date.now(),
  };
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan("task-1");
  const feedback = makeFeedback("completed", [costSignal, qualitySignal]);
  const deviations = detector.detect(plan, feedback);
  assert.equal(deviations.length, 0);
});

// ---------------------------------------------------------------------------
// Additional deviation detection scenarios
// ---------------------------------------------------------------------------

test("ExecutionDeviationDetector detect returns critical severity for escalated outcome", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan("task-escalated");
  const feedback = makeFeedback("escalated");
  const deviations = detector.detect(plan, feedback);
  assert.equal(deviations.length, 1);
  assert.equal(deviations[0]!.severity, "critical");
  assert.equal(deviations[0]!.reasonCode, "execution.escalated");
  assert.equal(deviations[0]!.summary, "Execution outcome drifted to escalated");
});

test("ExecutionDeviationDetector detect returns high severity for repairable outcome", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan("task-repairable");
  const feedback = makeFeedback("repairable");
  const deviations = detector.detect(plan, feedback);
  assert.equal(deviations.length, 1);
  assert.equal(deviations[0]!.severity, "high");
  assert.equal(deviations[0]!.reasonCode, "execution.repairable");
  assert.equal(deviations[0]!.summary, "Execution outcome drifted to repairable");
});

test("ExecutionDeviationDetector detect handles multiple timeout signals", () => {
  const timeoutSignal1: FeedbackSignal = {
    signalId: "sig-1",
    taskId: "task-1",
    source: "execution",
    category: "timeout",
    severity: "error",
    payload: { message: "step timed out" },
    stepOutputRefs: [],
    timestamp: Date.now(),
  };
  const timeoutSignal2: FeedbackSignal = {
    signalId: "sig-2",
    taskId: "task-1",
    source: "execution",
    category: "timeout",
    severity: "error",
    payload: { message: "overall timed out" },
    stepOutputRefs: [],
    timestamp: Date.now(),
  };
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan("task-1");
  const feedback = makeFeedback("completed", [timeoutSignal1, timeoutSignal2]);
  const deviations = detector.detect(plan, feedback);
  // Should still only return 1 deviation (timeout is deduplicated by category)
  assert.equal(deviations.length, 1);
  assert.equal(deviations[0]!.reasonCode, "execution.timeout");
});

test("ExecutionDeviationDetector detect combines outcome and timeout deviations", () => {
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
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan("task-1");
  const feedback = makeFeedback("failed", [timeoutSignal]);
  const deviations = detector.detect(plan, feedback);
  assert.equal(deviations.length, 2);
  // Check that we have both a failed deviation and a timeout deviation
  const reasonCodes = deviations.map(d => d.reasonCode);
  assert.ok(reasonCodes.includes("execution.failed"));
  assert.ok(reasonCodes.includes("execution.timeout"));
});

test("ExecutionDeviationDetector detect handles escalated with timeout", () => {
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
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan("task-1");
  const feedback = makeFeedback("escalated", [timeoutSignal]);
  const deviations = detector.detect(plan, feedback);
  assert.equal(deviations.length, 2);
  const reasonCodes = deviations.map(d => d.reasonCode);
  assert.ok(reasonCodes.includes("execution.escalated"));
  assert.ok(reasonCodes.includes("execution.timeout"));
});

test("ExecutionDeviationDetector detect handles repairable with timeout", () => {
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
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan("task-1");
  const feedback = makeFeedback("repairable", [timeoutSignal]);
  const deviations = detector.detect(plan, feedback);
  assert.equal(deviations.length, 2);
  const reasonCodes = deviations.map(d => d.reasonCode);
  assert.ok(reasonCodes.includes("execution.repairable"));
  assert.ok(reasonCodes.includes("execution.timeout"));
});

test("ExecutionDeviationDetector detect returns deviations with unique IDs", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan("task-1");
  const feedback1 = makeFeedback("failed");
  const feedback2 = makeFeedback("repairable");
  const deviations1 = detector.detect(plan, feedback1);
  const deviations2 = detector.detect(plan, feedback2);
  assert.notEqual(deviations1[0]!.deviationId, deviations2[0]!.deviationId);
});

test("ExecutionDeviationDetector detect uses correct taskId from plan", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan("unique-task-id-12345");
  const feedback = makeFeedback("failed");
  const deviations = detector.detect(plan, feedback);
  assert.equal(deviations[0]!.taskId, "unique-task-id-12345");
});

test("ExecutionDeviationDetector detect sets detectedAt within reasonable range", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan("task-1");
  const feedback = makeFeedback("failed");
  const before = Date.now() - 1000;
  const deviations = detector.detect(plan, feedback);
  const after = Date.now() + 1000;
  assert.ok(deviations[0]!.detectedAt >= before);
  assert.ok(deviations[0]!.detectedAt <= after);
});
