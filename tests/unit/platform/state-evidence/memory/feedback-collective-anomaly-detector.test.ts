import assert from "node:assert/strict";
import test from "node:test";

import {
  FeedbackCollectiveAnomalyDetector,
  type FeedbackAggregateSignal,
} from "../../../../../src/platform/five-plane-state-evidence/memory/feedback-collective-anomaly-detector.js";

test("FeedbackCollectiveAnomalyDetector.evaluate returns normal when delta is within threshold", () => {
  const detector = new FeedbackCollectiveAnomalyDetector(100, 0.1);
  const signal: FeedbackAggregateSignal = {
    segmentId: "segment_a",
    sampleCount: 100,
    positiveRatio: 0.55,
    historicalPositiveRatio: 0.50,
  };

  const result = detector.evaluate(signal);

  assert.equal(result.segmentId, "segment_a");
  assert.equal(result.biasSuspected, false);
  assert.equal(result.delta, 0.05);
  assert.equal(result.reasonCode, "feedback.normal");
});

test("FeedbackCollectiveAnomalyDetector.evaluate returns bias_suspected when delta exceeds threshold", () => {
  const detector = new FeedbackCollectiveAnomalyDetector(100, 0.1);
  const signal: FeedbackAggregateSignal = {
    segmentId: "segment_b",
    sampleCount: 100,
    positiveRatio: 0.70,
    historicalPositiveRatio: 0.50,
  };

  const result = detector.evaluate(signal);

  assert.equal(result.segmentId, "segment_b");
  assert.equal(result.biasSuspected, true);
  assert.equal(result.delta, 0.2);
  assert.equal(result.reasonCode, "feedback.bias_suspected");
});

test("FeedbackCollectiveAnomalyDetector.evaluate ignores samples below minSampleCount", () => {
  const detector = new FeedbackCollectiveAnomalyDetector(100, 0.01);
  const signal: FeedbackAggregateSignal = {
    segmentId: "segment_c",
    sampleCount: 50, // Below threshold
    positiveRatio: 0.90, // Very high delta
    historicalPositiveRatio: 0.10,
  };

  const result = detector.evaluate(signal);

  assert.equal(result.biasSuspected, false);
  assert.equal(result.reasonCode, "feedback.normal");
});

test("FeedbackCollectiveAnomalyDetector.evaluate treats negative delta at exact threshold as normal", () => {
  const detector = new FeedbackCollectiveAnomalyDetector(100, 0.1);
  const signal: FeedbackAggregateSignal = {
    segmentId: "segment_d",
    sampleCount: 100,
    positiveRatio: 0.40,
    historicalPositiveRatio: 0.50,
  };

  const result = detector.evaluate(signal);

  assert.equal(result.biasSuspected, false);
  assert.equal(result.delta, -0.1);
  assert.equal(result.reasonCode, "feedback.normal");
});

test("FeedbackCollectiveAnomalyDetector.evaluate uses exact minSampleCount as threshold", () => {
  const detector = new FeedbackCollectiveAnomalyDetector(100, 0.1);
  const signal: FeedbackAggregateSignal = {
    segmentId: "segment_e",
    sampleCount: 100, // Exactly at threshold
    positiveRatio: 0.65,
    historicalPositiveRatio: 0.50,
  };

  const result = detector.evaluate(signal);

  assert.equal(result.biasSuspected, true); // 0.15 > 0.1
  assert.equal(result.delta, 0.15);
});

test("FeedbackCollectiveAnomalyDetector.evaluate handles zero delta", () => {
  const detector = new FeedbackCollectiveAnomalyDetector(100, 0.1);
  const signal: FeedbackAggregateSignal = {
    segmentId: "segment_f",
    sampleCount: 100,
    positiveRatio: 0.50,
    historicalPositiveRatio: 0.50,
  };

  const result = detector.evaluate(signal);

  assert.equal(result.biasSuspected, false);
  assert.equal(result.delta, 0);
  assert.equal(result.reasonCode, "feedback.normal");
});

test("FeedbackCollectiveAnomalyDetector.evaluate handles small delta at exact threshold", () => {
  const detector = new FeedbackCollectiveAnomalyDetector(100, 0.05);
  const signal: FeedbackAggregateSignal = {
    segmentId: "segment_g",
    sampleCount: 100,
    positiveRatio: 0.55,
    historicalPositiveRatio: 0.50,
  };

  const result = detector.evaluate(signal);

  // 0.05 is exactly at threshold - Math.abs(0.05) > 0.05 is false, so not suspected
  assert.equal(result.biasSuspected, false);
  assert.equal(result.delta, 0.05);
});

test("FeedbackCollectiveAnomalyDetector.evaluate rounds delta to 4 decimal places", () => {
  const detector = new FeedbackCollectiveAnomalyDetector(100, 0.1);
  const signal: FeedbackAggregateSignal = {
    segmentId: "segment_h",
    sampleCount: 100,
    positiveRatio: 0.5555,
    historicalPositiveRatio: 0.3333,
  };

  const result = detector.evaluate(signal);

  assert.equal(result.delta, 0.2222);
});

test("FeedbackCollectiveAnomalyDetector.evaluate handles very large sample counts", () => {
  const detector = new FeedbackCollectiveAnomalyDetector(1000, 0.05);
  const signal: FeedbackAggregateSignal = {
    segmentId: "segment_i",
    sampleCount: 1_000_000,
    positiveRatio: 0.60,
    historicalPositiveRatio: 0.50,
  };

  const result = detector.evaluate(signal);

  assert.equal(result.biasSuspected, true);
  assert.equal(result.delta, 0.1);
});

test("FeedbackCollectiveAnomalyDetector.evaluate handles zero historical ratio", () => {
  const detector = new FeedbackCollectiveAnomalyDetector(100, 0.1);
  const signal: FeedbackAggregateSignal = {
    segmentId: "segment_j",
    sampleCount: 100,
    positiveRatio: 0.50,
    historicalPositiveRatio: 0,
  };

  const result = detector.evaluate(signal);

  assert.equal(result.biasSuspected, true);
  assert.equal(result.delta, 0.5);
});

test("FeedbackCollectiveAnomalyDetector.evaluate handles both ratios at zero", () => {
  const detector = new FeedbackCollectiveAnomalyDetector(100, 0.1);
  const signal: FeedbackAggregateSignal = {
    segmentId: "segment_k",
    sampleCount: 100,
    positiveRatio: 0,
    historicalPositiveRatio: 0,
  };

  const result = detector.evaluate(signal);

  assert.equal(result.biasSuspected, false);
  assert.equal(result.delta, 0);
});
