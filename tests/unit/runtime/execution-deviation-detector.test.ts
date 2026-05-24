import test from "node:test";
import assert from "node:assert/strict";

import { ExecutionDeviationDetector, type ExecutionDeviation } from "../../../src/platform/five-plane-execution/dispatcher/execution-deviation-detector.js";
import type { Plan } from "../../../src/platform/five-plane-orchestration/oapeflir/types/index.js";
import type { FeedbackBatch } from "../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";
import { deriveFeedbackTrustScore, type FeedbackSignal } from "../../../src/platform/five-plane-orchestration/oapeflir/types/feedback-signal.js";

function createMockPlan(overrides: Partial<Plan> = {}): Plan {
  return {
    taskId: "task_test_123",
    workflowId: "workflow_test",
    planId: "plan_test",
    ...overrides,
  } as Plan;
}

function createMockFeedback(overrides: Partial<FeedbackBatch> = {}): FeedbackBatch {
  return {
    feedbackId: "feedback_test",
    batchId: "batch_test",
    taskId: "task_test_123",
    executionId: null,
    planId: "plan_test",
    outcome: "completed",
    signals: [],
    emittedAt: 1,
    ...overrides,
  } as FeedbackBatch;
}

function createSignal(overrides: Partial<FeedbackSignal> & Pick<FeedbackSignal, "signalId" | "taskId" | "source" | "category" | "severity">): FeedbackSignal {
  const trustFactors = {
    sourceReliability: 0.7,
    historicalAccuracy: 0.7,
    authenticatedSource: true,
    attackSurfaceExposure: 0.2,
    holdoutOverlap: 0,
  };
  return {
    payload: {},
    stepOutputRefs: [],
    timestamp: 1,
    trustFactors,
    feedbackTrustScore: deriveFeedbackTrustScore(trustFactors),
    ...overrides,
  };
}

test("ExecutionDeviationDetector.detect returns empty array for successful outcome", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = createMockPlan();
  const feedback = createMockFeedback({ outcome: "completed" });

  const deviations = detector.detect(plan, feedback);

  assert.deepEqual(deviations, []);
});

test("ExecutionDeviationDetector.detect returns deviation for repairable outcome", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = createMockPlan();
  const feedback = createMockFeedback({ outcome: "repairable" });

  const deviations = detector.detect(plan, feedback);

  assert.equal(deviations.length, 1);
  assert.equal(deviations[0]!.deviationId.startsWith("deviation_"), true);
  assert.equal(deviations[0]!.taskId, plan.taskId);
  assert.equal(deviations[0]!.severity, "high");
  assert.equal(deviations[0]!.reasonCode, "execution.repairable");
  assert.equal(deviations[0]!.summary, "Execution outcome drifted to repairable");
});

test("ExecutionDeviationDetector.detect returns deviation for failed outcome", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = createMockPlan();
  const feedback = createMockFeedback({ outcome: "failed" });

  const deviations = detector.detect(plan, feedback);

  assert.equal(deviations.length, 1);
  assert.equal(deviations[0]!.severity, "critical");
  assert.equal(deviations[0]!.reasonCode, "execution.failed");
  assert.equal(deviations[0]!.summary, "Execution outcome drifted to failed");
});

test("ExecutionDeviationDetector.detect returns deviation for escalated outcome", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = createMockPlan();
  const feedback = createMockFeedback({ outcome: "escalated" });

  const deviations = detector.detect(plan, feedback);

  assert.equal(deviations.length, 1);
  assert.equal(deviations[0]!.severity, "critical");
  assert.equal(deviations[0]!.reasonCode, "execution.escalated");
});

test("ExecutionDeviationDetector.detect returns deviation for timeout signal", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = createMockPlan();
  const feedback = createMockFeedback({
    outcome: "completed",
    signals: [createSignal({
      signalId: "sig_timeout",
      taskId: "task_test_123",
      source: "execution",
      category: "timeout",
      severity: "error",
      payload: {
        reasonCode: "execution_timeout",
        summary: "Execution timed out",
      },
    })],
  });

  const deviations = detector.detect(plan, feedback);

  assert.equal(deviations.length, 1);
  assert.equal(deviations[0]!.severity, "high");
  assert.equal(deviations[0]!.reasonCode, "execution.timeout");
  assert.equal(deviations[0]!.summary, "Execution exceeded expected timing budget.");
});

test("ExecutionDeviationDetector.detect returns multiple deviations for both outcome and timeout", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = createMockPlan();
  const feedback = createMockFeedback({
    outcome: "failed",
    signals: [createSignal({
      signalId: "sig_timeout",
      taskId: "task_test_123",
      source: "execution",
      category: "timeout",
      severity: "error",
      payload: {
        reasonCode: "execution_timeout",
        summary: "Execution timed out",
      },
    })],
  });

  const deviations = detector.detect(plan, feedback);

  assert.equal(deviations.length, 2);
  assert.ok(deviations.some(d => d.reasonCode === "execution.failed"));
  assert.ok(deviations.some(d => d.reasonCode === "execution.timeout"));
});

test("ExecutionDeviationDetector.detect does not return deviation for non-timeout signals", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = createMockPlan();
  const feedback = createMockFeedback({
    outcome: "completed",
    signals: [
      createSignal({
        signalId: "sig_partial",
        taskId: "task_test_123",
        source: "execution",
        category: "partial",
        severity: "warning",
        payload: { reasonCode: "memory_high", summary: "Memory usage high" },
      }),
      createSignal({
        signalId: "sig_success",
        taskId: "task_test_123",
        source: "validation",
        category: "success",
        severity: "info",
        payload: { reasonCode: "low_confidence", summary: "Low confidence" },
      }),
    ],
  });

  const deviations = detector.detect(plan, feedback);

  assert.equal(deviations.length, 0);
});

test("ExecutionDeviationDetector.detect collapses multiple timeout signals into one deviation", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = createMockPlan();
  const feedback = createMockFeedback({
    outcome: "completed",
    signals: [
      createSignal({
        signalId: "sig_timeout_1",
        taskId: "task_test_123",
        source: "execution",
        category: "timeout",
        severity: "error",
        payload: { reasonCode: "execution_timeout", summary: "Execution timed out" },
      }),
      createSignal({
        signalId: "sig_timeout_2",
        taskId: "task_test_123",
        source: "execution",
        category: "timeout",
        severity: "error",
        payload: { reasonCode: "step_timeout", summary: "Step timed out" },
      }),
    ],
  });

  const deviations = detector.detect(plan, feedback);

  assert.equal(deviations.length, 1);
  assert.equal(deviations[0]!.reasonCode, "execution.timeout");
});

test("ExecutionDeviationDetector.detect includes correct detectedAt timestamp", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = createMockPlan();
  const feedback = createMockFeedback({ outcome: "failed" });

  const before = Date.now();
  const deviations = detector.detect(plan, feedback);
  const after = Date.now();

  assert.equal(deviations.length, 1);
  assert.ok(deviations[0]!.detectedAt >= before);
  assert.ok(deviations[0]!.detectedAt <= after);
});
