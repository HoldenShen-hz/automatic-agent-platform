/**
 * Performance Test: Feedback Signal Preprocessor
 * G4 Benchmark — signal-preprocessor.preprocess() P99 < 10ms
 *
 * Design target: Feedback <10ms P99 (§7.4)
 */

import assert from "node:assert/strict";
import test from "node:test";
import { newId, nowIso } from "../../src/platform/contracts/types/ids.js";
import type { FeedbackSignal, FeedbackBatch } from "../../src/scale-ecosystem/feedback-loop/collector/index.js";
import { SignalPreprocessor } from "../../src/scale-ecosystem/feedback-loop/collector/signal-preprocessor.js";

function createTestFeedbackSignals(count: number): FeedbackSignal[] {
  const signals: FeedbackSignal[] = [];
  for (let i = 0; i < count; i++) {
    signals.push({
      signalId: newId("sig"),
      taskId: newId("task"),
      source: "execution",
      category: "failure",
      severity: "error",
      timestamp: Date.now(),
      stepOutputRefs: [newId("step")],
      payload: {
        reasonCode: `ERR_TEST_${i}`,
        summary: `Test failure signal ${i} with some reasonable summary text`,
        occurrenceCount: 1,
        mergedSignalIds: [newId("sig")],
      },
    });
  }
  return signals;
}

test("performance: signal-preprocessor P99 < 10ms", () => {
  const preprocessor = new SignalPreprocessor();
  const signals = createTestFeedbackSignals(10);

  const feedbackBatch: FeedbackBatch = {
    feedbackId: newId("fb"),
    taskId: newId("task"),
    executionId: null,
    planId: null,
    signals,
    outcome: "completed",
    emittedAt: Date.now(),
  };

  const latencies: number[] = [];
  const iterations = 1000;

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    preprocessor.toLearningSignals(feedbackBatch);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99Index = Math.floor(iterations * 0.99);
  const p99 = latencies[p99Index]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  assert.ok(
    p99 < 10,
    `signal-preprocessor P99 latency ${p99.toFixed(3)}ms exceeds 10ms target`,
  );

  // Sanity check median is reasonable
  assert.ok(
    p50 < 5,
    `signal-preprocessor P50 latency ${p50.toFixed(3)}ms seems unexpectedly high`,
  );
});

test("performance: signal-preprocessor deduplicate P99 < 5ms", () => {
  const preprocessor = new SignalPreprocessor();
  const signals = createTestFeedbackSignals(50);

  const latencies: number[] = [];
  const iterations = 1000;

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    preprocessor.deduplicate(signals);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;

  assert.ok(
    p99 < 5,
    `signal-preprocessor.deduplicate P99 latency ${p99.toFixed(3)}ms exceeds 5ms target`,
  );
});

test("performance: signal-preprocessor mergeCorrelated P99 < 8ms", () => {
  const preprocessor = new SignalPreprocessor();
  const signals = createTestFeedbackSignals(20);

  const latencies: number[] = [];
  const iterations = 1000;

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    preprocessor.mergeCorrelated(signals);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;

  assert.ok(
    p99 < 8,
    `signal-preprocessor.mergeCorrelated P99 latency ${p99.toFixed(3)}ms exceeds 8ms target`,
  );
});
