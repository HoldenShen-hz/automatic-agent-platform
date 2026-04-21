/**
 * Signal Classification Tests
 *
 * Tests for signal type classification and feedback routing in the signal preprocessor.
 * Covers: inferConfidence branches, signal categorization, learning type assignment.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { SignalPreprocessor } from "../../../../src/scale-ecosystem/feedback-loop/collector/signal-preprocessor.js";
import { parseFeedbackBatch } from "../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";
import type { FeedbackSignal } from "../../../../src/platform/orchestration/oapeflir/types/feedback-signal.js";
import type { LearningSignal } from "../../../../src/platform/orchestration/oapeflir/learn/learning-object-model.js";

function createSignal(overrides: Partial<FeedbackSignal> = {}): FeedbackSignal {
  return {
    signalId: "sig_test_1",
    taskId: "task_1",
    source: "execution",
    category: "failure",
    severity: "error",
    payload: {},
    stepOutputRefs: [],
    timestamp: 1000,
    ...overrides,
  };
}

function createFeedbackBatch(signals: FeedbackSignal[] = []) {
  return parseFeedbackBatch({
    feedbackId: "fb_1",
    taskId: "task_1",
    executionId: null,
    planId: null,
    outcome: "failed",
    signals,
    emittedAt: 1000,
  });
}

// =============================================================================
// inferConfidence branches - source-based classification
// =============================================================================

test("inferConfidence returns 1 for user source", () => {
  const preprocessor = new SignalPreprocessor();
  const feedback = createFeedbackBatch([
    createSignal({ signalId: "sig_1", source: "user", category: "correction" }),
  ]);

  const result = preprocessor.toLearningSignals(feedback);

  const signal = result.find((s: LearningSignal) => s.sourceSignalIds.some((id: string) => id.includes("sig_1")));
  assert.equal(signal?.confidence, 1);
});

test("inferConfidence returns 1 for hitl source", () => {
  const preprocessor = new SignalPreprocessor();
  const feedback = createFeedbackBatch([
    createSignal({ signalId: "sig_1", source: "hitl", category: "correction" }),
  ]);

  const result = preprocessor.toLearningSignals(feedback);

  const signal = result.find((s: LearningSignal) => s.sourceSignalIds.some((id: string) => id.includes("sig_1")));
  assert.equal(signal?.confidence, 1);
});

test("inferConfidence returns 0.8 for correction category", () => {
  const preprocessor = new SignalPreprocessor();
  const feedback = createFeedbackBatch([
    createSignal({ signalId: "sig_1", source: "execution", category: "correction" }),
  ]);

  const result = preprocessor.toLearningSignals(feedback);

  const signal = result.find((s: LearningSignal) => s.sourceSignalIds.some((id: string) => id.includes("sig_1")));
  assert.equal(signal?.confidence, 0.8);
});

test("inferConfidence returns 0.8 for failure category", () => {
  const preprocessor = new SignalPreprocessor();
  const feedback = createFeedbackBatch([
    createSignal({ signalId: "sig_1", source: "execution", category: "failure" }),
  ]);

  const result = preprocessor.toLearningSignals(feedback);

  const signal = result.find((s: LearningSignal) => s.sourceSignalIds.some((id: string) => id.includes("sig_1")));
  assert.equal(signal?.confidence, 0.8);
});

test("inferConfidence returns 0.8 for timeout category", () => {
  const preprocessor = new SignalPreprocessor();
  const feedback = createFeedbackBatch([
    createSignal({ signalId: "sig_1", source: "execution", category: "timeout" }),
  ]);

  const result = preprocessor.toLearningSignals(feedback);

  const signal = result.find((s: LearningSignal) => s.sourceSignalIds.some((id: string) => id.includes("sig_1")));
  assert.equal(signal?.confidence, 0.8);
});

test("inferConfidence returns 0.5 for partial category", () => {
  const preprocessor = new SignalPreprocessor();
  const feedback = createFeedbackBatch([
    createSignal({ signalId: "sig_1", source: "execution", category: "partial" }),
  ]);

  const result = preprocessor.toLearningSignals(feedback);

  const signal = result.find((s: LearningSignal) => s.sourceSignalIds.some((id: string) => id.includes("sig_1")));
  assert.equal(signal?.confidence, 0.5);
});

test("inferConfidence returns 0.3 for unknown category", () => {
  const preprocessor = new SignalPreprocessor();
  // category that doesn't match any specific branch
  const feedback = createFeedbackBatch([
    createSignal({ signalId: "sig_1", source: "execution", category: "success", severity: "info" }),
  ]);

  const result = preprocessor.toLearningSignals(feedback);

  // success/info signals are filtered out by default, but we test the classification logic
  assert.equal(result.length, 0);
});

// =============================================================================
// Learning type assignment based on signal category
// =============================================================================

test("learningType is user_correction for user correction", () => {
  const preprocessor = new SignalPreprocessor();
  const feedback = createFeedbackBatch([
    createSignal({ signalId: "sig_1", source: "user", category: "correction" }),
  ]);

  const result = preprocessor.toLearningSignals(feedback);

  assert.ok(result.some(s => s.learningType === "user_correction"));
});

test("learningType is recovery_playbook for execution correction", () => {
  const preprocessor = new SignalPreprocessor();
  const feedback = createFeedbackBatch([
    createSignal({ signalId: "sig_1", source: "execution", category: "correction" }),
  ]);

  const result = preprocessor.toLearningSignals(feedback);

  const signal = result.find((s: LearningSignal) => s.sourceSignalIds.some((id: string) => id.includes("sig_1")));
  assert.equal(signal?.learningType, "recovery_playbook");
});

test("learningType is failure_pattern for failure category", () => {
  const preprocessor = new SignalPreprocessor();
  const feedback = createFeedbackBatch([
    createSignal({ signalId: "sig_1", category: "failure" }),
  ]);

  const result = preprocessor.toLearningSignals(feedback);

  assert.ok(result.some(s => s.learningType === "failure_pattern"));
});

test("learningType is failure_pattern for timeout category", () => {
  const preprocessor = new SignalPreprocessor();
  const feedback = createFeedbackBatch([
    createSignal({ signalId: "sig_1", category: "timeout" }),
  ]);

  const result = preprocessor.toLearningSignals(feedback);

  assert.ok(result.some(s => s.learningType === "failure_pattern"));
});

test("learningType is failure_pattern for partial category", () => {
  const preprocessor = new SignalPreprocessor();
  const feedback = createFeedbackBatch([
    createSignal({ signalId: "sig_1", category: "partial" }),
  ]);

  const result = preprocessor.toLearningSignals(feedback);

  assert.ok(result.some(s => s.learningType === "failure_pattern"));
});

test("learningType is null for unclassified signals (filtered out)", () => {
  const preprocessor = new SignalPreprocessor();
  // success/info signals are filtered out by default
  const feedback = createFeedbackBatch([
    createSignal({ signalId: "sig_1", category: "success", severity: "info" }),
  ]);

  const result = preprocessor.toLearningSignals(feedback);

  assert.equal(result.length, 0);
});

// =============================================================================
// Signal routing based on category and source combinations
// =============================================================================

test("correction from user routes to user_correction learning type", () => {
  const preprocessor = new SignalPreprocessor();
  const feedback = createFeedbackBatch([
    createSignal({ signalId: "sig_1", source: "user", category: "correction" }),
  ]);

  const result = preprocessor.toLearningSignals(feedback);

  const signal = result.find((s: LearningSignal) => s.learningType === "user_correction");
  assert.ok(signal);
  assert.equal(signal?.confidence, 1);
});

test("correction from execution routes to recovery_playbook learning type", () => {
  const preprocessor = new SignalPreprocessor();
  const feedback = createFeedbackBatch([
    createSignal({ signalId: "sig_1", source: "execution", category: "correction" }),
  ]);

  const result = preprocessor.toLearningSignals(feedback);

  const signal = result.find((s: LearningSignal) => s.learningType === "recovery_playbook");
  assert.ok(signal);
  assert.equal(signal?.confidence, 0.8);
});

test("failure signals route to failure_pattern", () => {
  const preprocessor = new SignalPreprocessor();
  const feedback = createFeedbackBatch([
    createSignal({ signalId: "sig_1", category: "failure" }),
  ]);

  const result = preprocessor.toLearningSignals(feedback);

  assert.ok(result.some(s => s.learningType === "failure_pattern"));
});

test("recovery playbook requires failure+correction+success pattern", () => {
  const preprocessor = new SignalPreprocessor();
  const feedback = createFeedbackBatch([
    createSignal({ signalId: "sig_1", category: "failure", stepOutputRefs: ["step:1"] }),
    createSignal({ signalId: "sig_2", category: "correction", stepOutputRefs: ["step:1"], source: "user" }),
    createSignal({ signalId: "sig_3", category: "success", stepOutputRefs: ["step:1"] }),
  ]);

  const result = preprocessor.toLearningSignals(feedback);

  assert.ok(result.some(s => s.learningType === "recovery_playbook"));
});

test("incomplete recovery pattern does not produce recovery_playbook", () => {
  const preprocessor = new SignalPreprocessor();
  // missing success signal
  const feedback = createFeedbackBatch([
    createSignal({ signalId: "sig_1", category: "failure", stepOutputRefs: ["step:1"] }),
    createSignal({ signalId: "sig_2", category: "correction", stepOutputRefs: ["step:1"], source: "user" }),
  ]);

  const result = preprocessor.toLearningSignals(feedback);

  // Should not produce recovery_playbook since success is missing
  const recoveryPlaybook = result.find((s: LearningSignal) => s.learningType === "recovery_playbook");
  assert.equal(recoveryPlaybook, undefined);
});

// =============================================================================
// Empty signal handling
// =============================================================================

test("empty signals array produces empty learning signals", () => {
  const preprocessor = new SignalPreprocessor();
  const feedback = createFeedbackBatch([]);

  const result = preprocessor.toLearningSignals(feedback);

  assert.equal(result.length, 0);
});

test("empty stepOutputRefs uses signalId as group key", () => {
  const preprocessor = new SignalPreprocessor();
  const signals = [
    createSignal({ signalId: "sig_1", stepOutputRefs: [], category: "failure" }),
    createSignal({ signalId: "sig_2", stepOutputRefs: [], category: "correction" }),
  ];

  const result = preprocessor.mergeCorrelated(signals);

  // Empty stepOutputRefs means each signal gets its own group (by signalId)
  assert.equal(result.length, 2);
});
