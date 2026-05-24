import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionDeviationDetector } from "../../../../../src/platform/five-plane-execution/dispatcher/execution-deviation-detector.js";
import type { Plan } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/plan.js";
import type { FeedbackBatch } from "../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";

function createPlan(overrides: Partial<Plan> = {}): Plan {
  return {
    planId: "plan-1",
    taskId: "task-1",
    version: 1,
    assessmentRef: "assessment://1",
    strategy: "linear",
    steps: [{
      stepId: "step-1",
      action: "tool",
      inputs: {},
      outputs: ["out-1"],
      dependencies: [],
      status: "pending",
      timeout: 5_000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    }],
    createdAt: Date.now(),
    ...overrides,
  };
}

function createFeedback(overrides: Partial<FeedbackBatch> = {}): FeedbackBatch {
  return {
    feedbackId: "feedback-1",
    batchId: "batch-1",
    taskId: "task-1",
    executionId: "execution-1",
    planId: "plan-1",
    outcome: "completed",
    signals: [],
    emittedAt: Date.now(),
    ...overrides,
  };
}

test("ExecutionDeviationDetector reports failed outcomes against the plan task", () => {
  const detector = new ExecutionDeviationDetector();

  const deviations = detector.detect(
    createPlan({ taskId: "task-abc" }),
    createFeedback({ taskId: "task-abc", outcome: "failed" }),
  );

  const firstDeviation = deviations[0];
  assert.ok(firstDeviation);
  assert.equal(deviations.length, 1);
  assert.equal(firstDeviation.taskId, "task-abc");
  assert.equal(firstDeviation.severity, "critical");
  assert.equal(firstDeviation.reasonCode, "execution.failed");
});

test("ExecutionDeviationDetector reports repairable outcomes as high severity", () => {
  const detector = new ExecutionDeviationDetector();

  const deviations = detector.detect(createPlan(), createFeedback({ outcome: "repairable" }));

  const firstDeviation = deviations[0];
  assert.ok(firstDeviation);
  assert.equal(firstDeviation.severity, "high");
  assert.equal(firstDeviation.reasonCode, "execution.repairable");
});

test("ExecutionDeviationDetector reports timeout signals with canonical feedback payloads", () => {
  const detector = new ExecutionDeviationDetector();

  const deviations = detector.detect(
    createPlan(),
    createFeedback({
      signals: [{
        signalId: "signal-timeout",
        taskId: "task-1",
        source: "execution",
        category: "timeout",
        severity: "error",
        payload: { signal: "execution_timed_out" },
        stepOutputRefs: [],
        timestamp: Date.now(),
        trustFactors: {
          sourceReliability: 0.9,
          historicalAccuracy: 0.8,
          authenticatedSource: true,
          attackSurfaceExposure: 0.1,
          holdoutOverlap: 0,
        },
        feedbackTrustScore: 0.92,
      }],
    }),
  );

  const firstDeviation = deviations[0];
  assert.ok(firstDeviation);
  assert.equal(firstDeviation.reasonCode, "execution.timeout");
  assert.equal(firstDeviation.severity, "high");
});

test("ExecutionDeviationDetector combines outcome and timeout deviations", () => {
  const detector = new ExecutionDeviationDetector();

  const deviations = detector.detect(
    createPlan(),
    createFeedback({
      outcome: "escalated",
      signals: [{
        signalId: "signal-timeout",
        taskId: "task-1",
        source: "system",
        category: "timeout",
        severity: "critical",
        payload: {},
        stepOutputRefs: [],
        timestamp: Date.now(),
        trustFactors: {
          sourceReliability: 0.8,
          historicalAccuracy: 0.8,
          authenticatedSource: true,
          attackSurfaceExposure: 0.2,
          holdoutOverlap: 0,
        },
        feedbackTrustScore: 0.88,
      }],
    }),
  );

  assert.equal(deviations.length, 2);
  assert.ok(deviations.some((deviation) => deviation.reasonCode === "execution.escalated"));
  assert.ok(deviations.some((deviation) => deviation.reasonCode === "execution.timeout"));
  assert.notEqual(deviations[0]?.deviationId, deviations[1]?.deviationId);
});

test("ExecutionDeviationDetector returns no deviations for completed non-timeout feedback", () => {
  const detector = new ExecutionDeviationDetector();

  const deviations = detector.detect(
    createPlan(),
    createFeedback({
      outcome: "completed",
      signals: [{
        signalId: "signal-success",
        taskId: "task-1",
        source: "execution",
        category: "success",
        severity: "info",
        payload: {},
        stepOutputRefs: [],
        timestamp: Date.now(),
        trustFactors: {
          sourceReliability: 0.9,
          historicalAccuracy: 0.9,
          authenticatedSource: true,
          attackSurfaceExposure: 0,
          holdoutOverlap: 0,
        },
        feedbackTrustScore: 0.95,
      }],
    }),
  );

  assert.deepEqual(deviations, []);
});
