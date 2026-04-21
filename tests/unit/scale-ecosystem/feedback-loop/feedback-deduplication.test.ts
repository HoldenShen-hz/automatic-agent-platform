/**
 * Feedback Deduplication Tests
 *
 * Tests for feedback deduplication logic in the signal preprocessor.
 * Covers: deduplication branches, occurrence counting, mergedSignalIds handling.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { SignalPreprocessor } from "../../../../src/scale-ecosystem/feedback-loop/collector/signal-preprocessor.js";
import type { FeedbackSignal } from "../../../../src/platform/orchestration/oapeflir/types/feedback-signal.js";

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

// =============================================================================
// deduplicate - basic functionality
// =============================================================================

test("deduplicate removes exact duplicate signals", () => {
  const preprocessor = new SignalPreprocessor();
  const signals = [
    createSignal({ signalId: "sig_1", stepOutputRefs: ["step:1"] }),
    createSignal({ signalId: "sig_2", stepOutputRefs: ["step:1"] }),
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

test("deduplicate does not merge signals with different stepOutputRefs", () => {
  const preprocessor = new SignalPreprocessor();
  const signals = [
    createSignal({ signalId: "sig_1", stepOutputRefs: ["step:1", "step:2"] }),
    createSignal({ signalId: "sig_2", stepOutputRefs: ["step:2", "step:3"] }),
  ];

  const result = preprocessor.deduplicate(signals);

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

test("deduplicate tracks mergedSignalIds on duplicate", () => {
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

test("deduplicate handles undefined mergedSignalIds in existing payload", () => {
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

test("deduplicate sorts results by timestamp ascending", () => {
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

test("deduplicate treats signals with different reasonCode as different", () => {
  const preprocessor = new SignalPreprocessor();
  const signals = [
    createSignal({ signalId: "sig_1", stepOutputRefs: ["step:1"], payload: { reasonCode: "ERR_A" } }),
    createSignal({ signalId: "sig_2", stepOutputRefs: ["step:1"], payload: { reasonCode: "ERR_B" } }),
  ];

  const result = preprocessor.deduplicate(signals);

  assert.equal(result.length, 2);
});

test("deduplicate treats signals with different summary as different", () => {
  const preprocessor = new SignalPreprocessor();
  const signals = [
    createSignal({ signalId: "sig_1", stepOutputRefs: ["step:1"], payload: { summary: "Issue A" } }),
    createSignal({ signalId: "sig_2", stepOutputRefs: ["step:1"], payload: { summary: "Issue B" } }),
  ];

  const result = preprocessor.deduplicate(signals);

  assert.equal(result.length, 2);
});

test("deduplicate filters whitespace-only strings from stepOutputRefs on merge", () => {
  const preprocessor = new SignalPreprocessor();
  const signals = [
    createSignal({ signalId: "sig_1", stepOutputRefs: ["step:1"] }),
    createSignal({ signalId: "sig_2", stepOutputRefs: ["  ", "step:1"] }),
  ];

  const result = preprocessor.deduplicate(signals);

  assert.equal(result.length, 1);
  assert.deepEqual(result[0]?.stepOutputRefs, ["step:1"]);
});
