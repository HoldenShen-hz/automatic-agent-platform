/**
 * Feedback Deduplication Tests
 *
 * Tests for feedback deduplication logic in the signal preprocessor.
 * Covers: deduplication branches, occurrence counting, mergedSignalIds handling.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { SignalPreprocessor } from "../../../../src/scale-ecosystem/feedback-loop/collector/signal-preprocessor.js";
import {
  deriveFeedbackTrustScore,
  parseFeedbackSignal,
  type FeedbackSignal,
  type FeedbackTrustFactors,
} from "../../../../src/platform/five-plane-orchestration/oapeflir/types/feedback-signal.js";

const defaultTrustFactors: FeedbackTrustFactors = {
  sourceReliability: 0.9,
  historicalAccuracy: 0.9,
  authenticatedSource: true,
  attackSurfaceExposure: 0.1,
  holdoutOverlap: 0,
};

function createSignal(overrides: Partial<FeedbackSignal> = {}): FeedbackSignal {
  const trustFactors = overrides.trustFactors ?? defaultTrustFactors;
  return parseFeedbackSignal({
    signalId: "sig_test_1",
    taskId: "task_1",
    source: "execution",
    category: "failure",
    severity: "error",
    payload: {},
    stepOutputRefs: [],
    timestamp: 1000,
    trustFactors,
    feedbackTrustScore: overrides.feedbackTrustScore ?? deriveFeedbackTrustScore(trustFactors),
    ...overrides,
  });
}

// =============================================================================
// deduplicate - basic functionality
// =============================================================================

test("deduplicate removes exact duplicate signals [feedback-deduplication]", () => {
  const preprocessor = new SignalPreprocessor();
  const signals = [
    createSignal({ signalId: "sig_1", stepOutputRefs: ["step:1"] }),
    createSignal({ signalId: "sig_2", stepOutputRefs: ["step:1"] }),
  ];

  const result = preprocessor.deduplicate(signals);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.stepOutputRefs.length, 1);
});

test("deduplicate preserves non-duplicate signals [feedback-deduplication]", () => {
  const preprocessor = new SignalPreprocessor();
  const signals = [
    createSignal({ signalId: "sig_1", stepOutputRefs: ["step:1"], category: "failure" }),
    createSignal({ signalId: "sig_2", stepOutputRefs: ["step:2"], category: "success" }),
  ];

  const result = preprocessor.deduplicate(signals);

  assert.equal(result.length, 2);
});

test("deduplicate increments occurrenceCount on merge [feedback-deduplication]", () => {
  const preprocessor = new SignalPreprocessor();
  const signals = [
    createSignal({ signalId: "sig_1", stepOutputRefs: ["step:1"], payload: { occurrenceCount: 1 } }),
    createSignal({ signalId: "sig_2", stepOutputRefs: ["step:1"], payload: { occurrenceCount: 1 } }),
  ];

  const result = preprocessor.deduplicate(signals);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.payload.occurrenceCount, 2);
});

test("deduplicate handles empty array [feedback-deduplication]", () => {
  const preprocessor = new SignalPreprocessor();
  const result = preprocessor.deduplicate([]);
  assert.equal(result.length, 0);
});

test("deduplicate filters empty stepOutputRefs in merge [feedback-deduplication]", () => {
  const preprocessor = new SignalPreprocessor();
  const signals = [
    createSignal({ signalId: "sig_1", stepOutputRefs: [] }),
    createSignal({ signalId: "sig_2", stepOutputRefs: [] }),
  ];

  const result = preprocessor.deduplicate(signals);

  assert.equal(result.length, 1);
});

test("deduplicate does not merge signals with different stepOutputRefs [feedback-deduplication]", () => {
  const preprocessor = new SignalPreprocessor();
  const signals = [
    createSignal({ signalId: "sig_1", stepOutputRefs: ["step:1", "step:2"] }),
    createSignal({ signalId: "sig_2", stepOutputRefs: ["step:2", "step:3"] }),
  ];

  const result = preprocessor.deduplicate(signals);

  assert.equal(result.length, 2);
});

test("deduplicate merges signals with identical keys including stepOutputRefs [feedback-deduplication]", () => {
  const preprocessor = new SignalPreprocessor();
  const signals = [
    createSignal({ signalId: "sig_1", stepOutputRefs: ["step:1"] }),
    createSignal({ signalId: "sig_2", stepOutputRefs: ["step:1"] }),
  ];

  const result = preprocessor.deduplicate(signals);

  assert.equal(result.length, 1);
  assert.deepEqual(result[0]?.stepOutputRefs.sort(), ["step:1"]);
});

test("deduplicate tracks mergedSignalIds on duplicate [feedback-deduplication]", () => {
  const preprocessor = new SignalPreprocessor();
  const signals = [
    createSignal({ signalId: "sig_1", stepOutputRefs: ["step:1"] }),
    createSignal({ signalId: "sig_2", stepOutputRefs: ["step:1"] }),
    createSignal({ signalId: "sig_3", stepOutputRefs: ["step:1"] }),
  ];

  const result = preprocessor.deduplicate(signals);

  assert.equal(result.length, 1);
  const mergedIds = (result[0]?.payload as Record<string, unknown>).mergedSignalIds as string[] | undefined;
  assert.ok(mergedIds);
  assert.ok(mergedIds.includes("sig_1"));
  assert.ok(mergedIds.includes("sig_2"));
  assert.ok(mergedIds.includes("sig_3"));
});

test("deduplicate handles undefined mergedSignalIds in existing payload [feedback-deduplication]", () => {
  const preprocessor = new SignalPreprocessor();
  const signals = [
    createSignal({ signalId: "sig_1", stepOutputRefs: ["step:1"], payload: {} }),
    createSignal({ signalId: "sig_2", stepOutputRefs: ["step:1"], payload: {} }),
  ];

  const result = preprocessor.deduplicate(signals);

  assert.equal(result.length, 1);
  const mergedIds = (result[0]?.payload as Record<string, unknown>).mergedSignalIds as string[] | undefined;
  assert.ok(mergedIds);
});

test("deduplicate sorts results by timestamp ascending [feedback-deduplication]", () => {
  const preprocessor = new SignalPreprocessor();
  const signals = [
    createSignal({ signalId: "sig_1", stepOutputRefs: ["step:1"], timestamp: 3000 }),
    createSignal({ signalId: "sig_2", stepOutputRefs: ["step:1"], timestamp: 1000 }),
    createSignal({ signalId: "sig_3", stepOutputRefs: ["step:1"], timestamp: 2000 }),
  ];

  const result = preprocessor.deduplicate(signals);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.timestamp, 1000);
});

test("deduplicate treats signals with different reasonCode as different [feedback-deduplication]", () => {
  const preprocessor = new SignalPreprocessor();
  const signals = [
    createSignal({ signalId: "sig_1", stepOutputRefs: ["step:1"], payload: { reasonCode: "ERR_A" } }),
    createSignal({ signalId: "sig_2", stepOutputRefs: ["step:1"], payload: { reasonCode: "ERR_B" } }),
  ];

  const result = preprocessor.deduplicate(signals);

  assert.equal(result.length, 2);
});

test("deduplicate treats signals with different summary as different [feedback-deduplication]", () => {
  const preprocessor = new SignalPreprocessor();
  const signals = [
    createSignal({ signalId: "sig_1", stepOutputRefs: ["step:1"], payload: { summary: "Issue A" } }),
    createSignal({ signalId: "sig_2", stepOutputRefs: ["step:1"], payload: { summary: "Issue B" } }),
  ];

  const result = preprocessor.deduplicate(signals);

  assert.equal(result.length, 2);
});

test("deduplicate filters whitespace-only strings from stepOutputRefs on merge [feedback-deduplication]", () => {
  const preprocessor = new SignalPreprocessor();
  const signals = [
    createSignal({ signalId: "sig_1", stepOutputRefs: ["step:1"] }),
    createSignal({ signalId: "sig_2", stepOutputRefs: ["  ", "step:1"] }),
  ];

  const result = preprocessor.deduplicate(signals);

  assert.equal(result.length, 1);
  assert.deepEqual(result[0]?.stepOutputRefs, ["step:1"]);
});
