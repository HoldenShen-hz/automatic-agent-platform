import test from "node:test";
import assert from "node:assert/strict";

import { ExecutionDeviationDetector, type ExecutionDeviation } from "../../../src/platform/five-plane-execution/dispatcher/execution-deviation-detector.js";
import type { Plan } from "../../../src/orchestration/oapeflir/types/index.js";
import type { FeedbackBatch } from "../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";

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
    batchId: "batch_test",
    outcome: "succeeded",
    signals: [],
    metrics: {},
    ...overrides,
  } as FeedbackBatch;
}

test("ExecutionDeviationDetector.detect returns empty array for successful outcome", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = createMockPlan();
  const feedback = createMockFeedback({ outcome: "succeeded" });

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
    outcome: "succeeded",
    signals: [{ category: "timeout", code: "execution_timeout", message: "Execution timed out" }],
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
    signals: [{ category: "timeout", code: "execution_timeout", message: "Execution timed out" }],
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
    outcome: "succeeded",
    signals: [
      { category: "resource", code: "memory_high", message: "Memory usage high" },
      { category: "quality", code: "low_confidence", message: "Low confidence" },
    ],
  });

  const deviations = detector.detect(plan, feedback);

  assert.equal(deviations.length, 0);
});

test("ExecutionDeviationDetector.detect collapses multiple timeout signals into one deviation", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = createMockPlan();
  const feedback = createMockFeedback({
    outcome: "succeeded",
    signals: [
      { category: "timeout", code: "execution_timeout", message: "Execution timed out" },
      { category: "timeout", code: "step_timeout", message: "Step timed out" },
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
