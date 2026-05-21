/**
 * @fileoverview Unit tests for execution deviation detector
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionDeviationDetector } from "../../../../../src/platform/five-plane-execution/dispatcher/execution-deviation-detector.js";

import type { Plan } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/index.js";
import type { FeedbackBatch } from "../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";

function makePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: "plan_1",
    taskId: "task_1",
    version: 1,
    rootStepId: "step_1",
    steps: [],
    createdAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  } as Plan;
}

function makeFeedback(overrides: Partial<FeedbackBatch> = {}): FeedbackBatch {
  return {
    batchId: "batch_1",
    outcome: "succeeded",
    signals: [],
    ...overrides,
  } as FeedbackBatch;
}

test("detect returns empty array when outcome is succeeded", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan();
  const feedback = makeFeedback({ outcome: "succeeded" });

  const deviations = detector.detect(plan, feedback);

  assert.deepEqual(deviations, []);
});

test("detect returns deviation when outcome is repairable", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan({ taskId: "task_repairable" });
  const feedback = makeFeedback({ outcome: "repairable" });

  const deviations = detector.detect(plan, feedback);

  assert.equal(deviations.length, 1);
  assert.equal(deviations[0]!.severity, "high");
  assert.equal(deviations[0]!.reasonCode, "execution.repairable");
  assert.equal(deviations[0]!.taskId, "task_repairable");
});

test("detect returns deviation when outcome is failed", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan({ taskId: "task_failed" });
  const feedback = makeFeedback({ outcome: "failed" });

  const deviations = detector.detect(plan, feedback);

  assert.equal(deviations.length, 1);
  assert.equal(deviations[0]!.severity, "critical");
  assert.equal(deviations[0]!.reasonCode, "execution.failed");
});

test("detect returns deviation when outcome is escalated", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan({ taskId: "task_escalated" });
  const feedback = makeFeedback({ outcome: "escalated" });

  const deviations = detector.detect(plan, feedback);

  assert.equal(deviations.length, 1);
  assert.equal(deviations[0]!.severity, "critical");
  assert.equal(deviations[0]!.reasonCode, "execution.escalated");
});

test("detect returns timeout deviation when signal has timeout category", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan({ taskId: "task_timeout" });
  const feedback = makeFeedback({
    outcome: "succeeded",
    signals: [{ category: "timeout", message: "Execution timed out", data: {} }],
  });

  const deviations = detector.detect(plan, feedback);

  assert.equal(deviations.length, 1);
  assert.equal(deviations[0]!.severity, "high");
  assert.equal(deviations[0]!.reasonCode, "execution.timeout");
});

test("detect returns multiple deviations when both outcome is failed and timeout signal", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan({ taskId: "task_multi" });
  const feedback = makeFeedback({
    outcome: "failed",
    signals: [{ category: "timeout", message: "Execution timed out", data: {} }],
  });

  const deviations = detector.detect(plan, feedback);

  assert.equal(deviations.length, 2);
  assert.ok(deviations.some(d => d.reasonCode === "execution.failed"));
  assert.ok(deviations.some(d => d.reasonCode === "execution.timeout"));
});

test("detect does not return timeout deviation when no timeout signal", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan({ taskId: "task_no_timeout" });
  const feedback = makeFeedback({
    outcome: "succeeded",
    signals: [{ category: "error", message: "Some error", data: {} }],
  });

  const deviations = detector.detect(plan, feedback);

  assert.equal(deviations.length, 0);
});

test("detect assigns unique deviationId to each deviation", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan({ taskId: "task_unique" });
  const feedback = makeFeedback({
    outcome: "failed",
    signals: [{ category: "timeout", message: "Timed out", data: {} }],
  });

  const deviations = detector.detect(plan, feedback);

  assert.equal(deviations.length, 2);
  assert.notEqual(deviations[0]!.deviationId, deviations[1]!.deviationId);
});

test("detect includes current timestamp in detectedAt", () => {
  const detector = new ExecutionDeviationDetector();
  const plan = makePlan();
  const feedback = makeFeedback({ outcome: "failed" });

  const before = Date.now();
  const deviations = detector.detect(plan, feedback);
  const after = Date.now();

  assert.ok(deviations[0]!.detectedAt >= before);
  assert.ok(deviations[0]!.detectedAt <= after);
});