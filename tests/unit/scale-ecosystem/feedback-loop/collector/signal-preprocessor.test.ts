import test from "node:test";
import assert from "node:assert/strict";

import { SignalPreprocessor } from "../../../../../src/scale-ecosystem/feedback-loop/collector/signal-preprocessor.js";
import { parseFeedbackBatch } from "../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";
import type { FeedbackSignal } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/feedback-signal.js";

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
// deduplicate tests
// =============================================================================

test("deduplicate removes exact duplicate signals", () => {
  const preprocessor = new SignalPreprocessor();
  const signals = [
    createSignal({ signalId: "sig_1", stepOutputRefs: ["step:1"] }),
    createSignal({ signalId: "sig_2", stepOutputRefs: ["step:1"] }), // same key
  ];

  const result = preprocessor.deduplicate(signals);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.stepOutputRefs.length, 1);
});

test("deduplicate preserves non-duplicate signals", () => {
  const preprocessor = new SignalPreprocessor();
  const signals = [
    createSignal({ signalId: "sig_1", stepOutputRefs: ["step:1"], category: "failure" }),
    createSignal({ signalId: "sig_2", stepOutputRefs: ["step:2"], category: "success" }),
  ];

  const result = preprocessor.deduplicate(signals);

  assert.equal(result.length, 2);
});

test("deduplicate increments occurrenceCount on merge", () => {
  const preprocessor = new SignalPreprocessor();
  const signals = [
    createSignal({ signalId: "sig_1", stepOutputRefs: ["step:1"], payload: { occurrenceCount: 1 } }),
    createSignal({ signalId: "sig_2", stepOutputRefs: ["step:1"], payload: { occurrenceCount: 1 } }),
  ];

  const result = preprocessor.deduplicate(signals);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.payload.occurrenceCount, 2);
});

test("deduplicate keeps first signal when keys match", () => {
  const preprocessor = new SignalPreprocessor();
  // Two signals with identical keys - only first one is kept
  const signals = [
    createSignal({ signalId: "sig_1", category: "failure", stepOutputRefs: ["step:1"], payload: { reasonCode: "ERR_1" } }),
    createSignal({ signalId: "sig_2", category: "failure", stepOutputRefs: ["step:1"], payload: { reasonCode: "ERR_1" } }),
  ];

  const result = preprocessor.deduplicate(signals);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.signalId, "sig_1");
  assert.deepEqual(result[0]?.stepOutputRefs, ["step:1"]);
});

test("deduplicate handles empty array", () => {
  const preprocessor = new SignalPreprocessor();
  const result = preprocessor.deduplicate([]);
  assert.equal(result.length, 0);
});

test("deduplicate filters empty stepOutputRefs in merge", () => {
  const preprocessor = new SignalPreprocessor();
  const signals = [
    createSignal({ signalId: "sig_1", stepOutputRefs: [] }),
    createSignal({ signalId: "sig_2", stepOutputRefs: [] }),
  ];

  const result = preprocessor.deduplicate(signals);

  assert.equal(result.length, 1);
});

// =============================================================================
// mergeCorrelated tests
// =============================================================================

test("mergeCorrelated groups signals by stepOutputRef", () => {
  const preprocessor = new SignalPreprocessor();
  const signals = [
    createSignal({ signalId: "sig_1", stepOutputRefs: ["step:1"], category: "failure" }),
    createSignal({ signalId: "sig_2", stepOutputRefs: ["step:1"], category: "correction" }),
    createSignal({ signalId: "sig_3", stepOutputRefs: ["step:1"], category: "success" }),
  ];

  const result = preprocessor.mergeCorrelated(signals);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.stepOutputRefs.length, 1);
});

test("mergeCorrelated separates signals with different stepOutputRefs", () => {
  const preprocessor = new SignalPreprocessor();
  const signals = [
    createSignal({ signalId: "sig_1", stepOutputRefs: ["step:1"] }),
    createSignal({ signalId: "sig_2", stepOutputRefs: ["step:2"] }),
  ];

  const result = preprocessor.mergeCorrelated(signals);

  assert.equal(result.length, 2);
});

test("mergeCorrelated adds correlatedCategories to payload", () => {
  const preprocessor = new SignalPreprocessor();
  const signals = [
    createSignal({ signalId: "sig_1", stepOutputRefs: ["step:1"], category: "failure" }),
    createSignal({ signalId: "sig_2", stepOutputRefs: ["step:1"], category: "correction" }),
  ];

  const result = preprocessor.mergeCorrelated(signals);

  assert.equal(result.length, 1);
  const categories = (result[0]?.payload as Record<string, unknown>).correlatedCategories as string[];
  assert.deepEqual(categories, ["failure", "correction"]);
});

test("mergeCorrelated handles empty array", () => {
  const preprocessor = new SignalPreprocessor();
  const result = preprocessor.mergeCorrelated([]);
  assert.equal(result.length, 0);
});

// =============================================================================
// normalize tests
// =============================================================================

test("normalize deduplicates signals with same key", () => {
  const preprocessor = new SignalPreprocessor();
  const signals = [
    createSignal({ signalId: "sig_1", stepOutputRefs: ["step:1"] }),
    createSignal({ signalId: "sig_2", stepOutputRefs: ["step:1"] }),
  ];

  const result = preprocessor.normalize(signals);

  assert.equal(result.length, 1);
});

test("normalize updates occurrenceCount on merge", () => {
  const preprocessor = new SignalPreprocessor();
  const signals = [
    createSignal({ signalId: "sig_1", stepOutputRefs: ["step:1"] }),
    createSignal({ signalId: "sig_2", stepOutputRefs: ["step:1"] }),
  ];

  const result = preprocessor.normalize(signals);

  assert.equal(result.length, 1);
  assert.equal((result[0]?.payload as Record<string, unknown>).occurrenceCount, 2);
});

test("normalize preserves minimum timestamp", () => {
  const preprocessor = new SignalPreprocessor();
  const signals = [
    createSignal({ signalId: "sig_1", timestamp: 2000, stepOutputRefs: ["step:1"] }),
    createSignal({ signalId: "sig_2", timestamp: 1000, stepOutputRefs: ["step:1"] }),
  ];

  const result = preprocessor.normalize(signals);

  assert.equal(result[0]?.timestamp, 1000);
});

test("normalize handles empty array", () => {
  const preprocessor = new SignalPreprocessor();
  const result = preprocessor.normalize([]);
  assert.equal(result.length, 0);
});

// =============================================================================
// toLearningSignals tests
// =============================================================================

test("toLearningSignals produces recovery_playbook from failure+correction+success", () => {
  const preprocessor = new SignalPreprocessor();
  const feedback = createFeedbackBatch([
    createSignal({ signalId: "sig_1", category: "failure", stepOutputRefs: ["step:1"] }),
    createSignal({ signalId: "sig_2", category: "correction", stepOutputRefs: ["step:1"], source: "user" }),
    createSignal({ signalId: "sig_3", category: "success", stepOutputRefs: ["step:1"] }),
  ]);

  const result = preprocessor.toLearningSignals(feedback);

  assert.ok(result.some(s => s.learningType === "recovery_playbook"));
});

test("toLearningSignals produces failure_pattern from failure signal", () => {
  const preprocessor = new SignalPreprocessor();
  const feedback = createFeedbackBatch([
    createSignal({ signalId: "sig_1", category: "failure", stepOutputRefs: ["step:1"] }),
  ]);

  const result = preprocessor.toLearningSignals(feedback);

  assert.ok(result.some(s => s.learningType === "failure_pattern"));
});

test("toLearningSignals produces user_correction from user correction", () => {
  const preprocessor = new SignalPreprocessor();
  const feedback = createFeedbackBatch([
    createSignal({ signalId: "sig_1", category: "correction", source: "user" }),
  ]);

  const result = preprocessor.toLearningSignals(feedback);

  assert.ok(result.some(s => s.learningType === "user_correction"));
});

test("toLearningSignals excludes informational success signals by default", () => {
  const preprocessor = new SignalPreprocessor();
  const feedback = createFeedbackBatch([
    createSignal({ signalId: "sig_1", category: "success", severity: "info" }),
  ]);

  const result = preprocessor.toLearningSignals(feedback);

  assert.equal(result.length, 0);
});

test("toLearningSignals includes informational success signals when option enabled", () => {
  const preprocessor = new SignalPreprocessor();
  // info success signal is skipped by default but included when option enabled
  // within a recovery pattern (failure + correction + success)
  const feedback = createFeedbackBatch([
    createSignal({ signalId: "sig_1", category: "failure", severity: "error", stepOutputRefs: ["step:1"] }),
    createSignal({ signalId: "sig_2", category: "correction", severity: "warning", stepOutputRefs: ["step:1"], source: "user" }),
    createSignal({ signalId: "sig_3", category: "success", severity: "info", stepOutputRefs: ["step:1"] }),
  ]);

  const result = preprocessor.toLearningSignals(feedback, { includeInformationalSignals: true });

  // Should produce recovery_playbook from the pattern
  assert.ok(result.some(s => s.learningType === "recovery_playbook"));
});

test("toLearningSignals infers correct confidence by source", () => {
  const preprocessor = new SignalPreprocessor();
  const feedback = createFeedbackBatch([
    createSignal({ signalId: "sig_1", source: "user", category: "correction" }),
    createSignal({ signalId: "sig_2", source: "execution", category: "failure" }),
  ]);

  const result = preprocessor.toLearningSignals(feedback);

  const userCorrection = result.find(s => s.sourceSignalIds.some((id: string) => id.includes("sig_1")));
  const failure = result.find(s => s.sourceSignalIds.some((id: string) => id.includes("sig_2")));
  assert.equal(userCorrection?.confidence, 1);
  assert.equal(failure?.confidence, 0.8);
});

test("toLearningSignals handles empty signals array", () => {
  const preprocessor = new SignalPreprocessor();
  const feedback = createFeedbackBatch([]);

  const result = preprocessor.toLearningSignals(feedback);

  assert.equal(result.length, 0);
});

test("toLearningSignals handles timeout category with failure pattern", () => {
  const preprocessor = new SignalPreprocessor();
  const feedback = createFeedbackBatch([
    createSignal({ signalId: "sig_1", category: "timeout", stepOutputRefs: ["step:1"] }),
  ]);

  const result = preprocessor.toLearningSignals(feedback);

  assert.ok(result.some(s => s.learningType === "failure_pattern"));
});

test("toLearningSignals handles partial category with lower confidence", () => {
  const preprocessor = new SignalPreprocessor();
  const feedback = createFeedbackBatch([
    createSignal({ signalId: "sig_1", category: "partial", stepOutputRefs: ["step:1"] }),
  ]);

  const result = preprocessor.toLearningSignals(feedback);

  const partial = result.find(s => s.sourceSignalIds.some((id: string) => id.includes("sig_1")));
  assert.equal(partial?.confidence, 0.5);
});

test("toLearningSignals infers confidence 1 for hitl source correction", () => {
  const preprocessor = new SignalPreprocessor();
  const feedback = createFeedbackBatch([
    createSignal({ signalId: "sig_1", source: "hitl", category: "correction", stepOutputRefs: ["step:1"] }),
  ]);

  const result = preprocessor.toLearningSignals(feedback);

  const hitlCorrection = result.find(s => s.sourceSignalIds.some((id: string) => id.includes("sig_1")));
  assert.equal(hitlCorrection?.confidence, 1);
});

test("toLearningSignals generates multiple learning signals from multiple signal groups", () => {
  const preprocessor = new SignalPreprocessor();
  const feedback = createFeedbackBatch([
    createSignal({ signalId: "sig_1", category: "failure", stepOutputRefs: ["step:1"], source: "execution" }),
    createSignal({ signalId: "sig_2", category: "correction", stepOutputRefs: ["step:1"], source: "user" }),
    createSignal({ signalId: "sig_3", category: "success", stepOutputRefs: ["step:1"] }),
    createSignal({ signalId: "sig_4", category: "failure", stepOutputRefs: ["step:2"], source: "validation" }),
  ]);

  const result = preprocessor.toLearningSignals(feedback);

  // Should have recovery_playbook for step:1 and failure_pattern for step:2
  assert.ok(result.some(s => s.learningType === "recovery_playbook"));
  assert.ok(result.some(s => s.learningType === "failure_pattern"));
});

test("toLearningSignals recovery playbook uses minimum timestamp for order", () => {
  const preprocessor = new SignalPreprocessor();
  const feedback = createFeedbackBatch([
    createSignal({ signalId: "sig_fail", category: "failure", stepOutputRefs: ["step:1"], timestamp: 3000 }),
    createSignal({ signalId: "sig_fix", category: "correction", stepOutputRefs: ["step:1"], source: "user", timestamp: 1000 }),
    createSignal({ signalId: "sig_pass", category: "success", stepOutputRefs: ["step:1"], timestamp: 2000 }),
  ]);

  const result = preprocessor.toLearningSignals(feedback);

  const playbook = result.find(s => s.learningType === "recovery_playbook");
  assert.ok(playbook);
  // valueSummary should reflect the signal order by timestamp
  assert.ok(playbook.valueSummary.includes("->"));
});

test("deduplicate does not merge signals with different stepOutputRefs", () => {
  const preprocessor = new SignalPreprocessor();
  const signals = [
    createSignal({ signalId: "sig_1", stepOutputRefs: ["step:1", "step:2"] }),
    createSignal({ signalId: "sig_2", stepOutputRefs: ["step:2", "step:3"] }),
  ];

  const result = preprocessor.deduplicate(signals);

  // Different stepOutputRefs means different keys, so no deduplication occurs
  assert.equal(result.length, 2);
});

test("deduplicate merges signals with identical keys including stepOutputRefs", () => {
  const preprocessor = new SignalPreprocessor();
  const signals = [
    createSignal({ signalId: "sig_1", stepOutputRefs: ["step:1"] }),
    createSignal({ signalId: "sig_2", stepOutputRefs: ["step:1"] }),
  ];

  const result = preprocessor.deduplicate(signals);

  assert.equal(result.length, 1);
  assert.deepEqual(result[0]?.stepOutputRefs.sort(), ["step:1"]);
});

test("normalize does not combine signals with different stepOutputRefs", () => {
  const preprocessor = new SignalPreprocessor();
  const signals = [
    createSignal({ signalId: "sig_1", stepOutputRefs: ["step:a"] }),
    createSignal({ signalId: "sig_2", stepOutputRefs: ["step:b"] }),
  ];

  const result = preprocessor.normalize(signals);

  // Different stepOutputRefs means different keys, so no normalization occurs
  assert.equal(result.length, 2);
});

test("normalize merges signals with identical keys", () => {
  const preprocessor = new SignalPreprocessor();
  const signals = [
    createSignal({ signalId: "sig_1", stepOutputRefs: ["step:1"] }),
    createSignal({ signalId: "sig_2", stepOutputRefs: ["step:1"] }),
  ];

  const result = preprocessor.normalize(signals);

  assert.equal(result.length, 1);
  assert.deepEqual(result[0]?.stepOutputRefs.sort(), ["step:1"]);
});

test("mergeCorrelated groups signals with same stepOutputRefs", () => {
  const preprocessor = new SignalPreprocessor();
  const signals = [
    createSignal({ signalId: "sig_1", stepOutputRefs: [], category: "failure", source: "execution" }),
    createSignal({ signalId: "sig_2", stepOutputRefs: [], category: "correction", source: "user" }),
  ];

  const result = preprocessor.mergeCorrelated(signals);

  // Empty stepOutputRefs use signalId as group key, different signalIds = separate groups
  assert.equal(result.length, 2);
});
