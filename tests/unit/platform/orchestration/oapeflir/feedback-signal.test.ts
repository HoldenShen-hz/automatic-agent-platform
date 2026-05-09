import assert from "node:assert/strict";
import test from "node:test";

import {
  getFeedbackPromotionEligibility,
  parseFeedbackSignal,
  FeedbackSignalSchema,
} from "../../../../../src/platform/orchestration/oapeflir/types/feedback-signal.js";

test("parseFeedbackSignal parses valid signal", () => {
  const valid = {
    signalId: "sig_123",
    taskId: "task_456",
    source: "execution",
    category: "success",
    severity: "info",
    payload: {},
    stepOutputRefs: [],
    timestamp: 1000,
  };

  const result = parseFeedbackSignal(valid);
  assert.equal(result.signalId, "sig_123");
  assert.equal(result.taskId, "task_456");
  assert.equal(result.source, "execution");
  assert.equal(result.category, "success");
});

test("parseFeedbackSignal applies defaults", () => {
  const minimal = {
    signalId: "sig_123",
    taskId: "task_456",
    source: "user",
    category: "failure",
    severity: "error",
    timestamp: 2000,
  };

  const result = parseFeedbackSignal(minimal);
  assert.deepEqual(result.payload, {});
  assert.deepEqual(result.stepOutputRefs, []);
  assert.equal(typeof result.feedbackTrustScore, "number");
  assert.equal(result.trustFactors.authenticatedSource, false);
});

test("parseFeedbackSignal rejects empty signalId", () => {
  const invalid = {
    signalId: "",
    taskId: "task_456",
    source: "execution",
    category: "success",
    severity: "info",
    timestamp: 1000,
  };

  assert.throws(() => parseFeedbackSignal(invalid));
});

test("parseFeedbackSignal rejects empty taskId", () => {
  const invalid = {
    signalId: "sig_123",
    taskId: "",
    source: "execution",
    category: "success",
    severity: "info",
    timestamp: 1000,
  };

  assert.throws(() => parseFeedbackSignal(invalid));
});

test("parseFeedbackSignal accepts all valid sources", () => {
  const sources = ["execution", "user", "hitl", "validation", "system"] as const;
  for (const source of sources) {
    const signal = {
      signalId: "sig_123",
      taskId: "task_456",
      source,
      category: "success",
      severity: "info",
      timestamp: 1000,
    };
    const result = parseFeedbackSignal(signal);
    assert.equal(result.source, source);
  }
});

test("parseFeedbackSignal accepts all valid categories", () => {
  // R19-14 fix: Updated to include blocker and regression categories
  const categories = ["success", "failure", "correction", "timeout", "partial", "blocker", "regression"] as const;
  for (const category of categories) {
    const signal = {
      signalId: "sig_123",
      taskId: "task_456",
      source: "execution",
      category,
      severity: "info",
      timestamp: 1000,
    };
    const result = parseFeedbackSignal(signal);
    assert.equal(result.category, category);
  }
});

test("parseFeedbackSignal accepts all valid severities", () => {
  const severities = ["info", "warning", "error", "critical"] as const;
  for (const severity of severities) {
    const signal = {
      signalId: "sig_123",
      taskId: "task_456",
      source: "execution",
      category: "failure",
      severity,
      timestamp: 1000,
    };
    const result = parseFeedbackSignal(signal);
    assert.equal(result.severity, severity);
  }
});

test("parseFeedbackSignal rejects invalid source", () => {
  const invalid = {
    signalId: "sig_123",
    taskId: "task_456",
    source: "invalid_source",
    category: "success",
    severity: "info",
    timestamp: 1000,
  };

  assert.throws(() => parseFeedbackSignal(invalid));
});

test("parseFeedbackSignal rejects negative timestamp", () => {
  const invalid = {
    signalId: "sig_123",
    taskId: "task_456",
    source: "execution",
    category: "success",
    severity: "info",
    timestamp: -1,
  };

  assert.throws(() => parseFeedbackSignal(invalid));
});

test("FeedbackSignalSchema rejects non-integer timestamp", () => {
  const signal = {
    signalId: "sig_123",
    taskId: "task_456",
    source: "execution",
    category: "success",
    severity: "info",
    timestamp: 1.5,
    payload: {},
    stepOutputRefs: [],
  };

  assert.throws(() => FeedbackSignalSchema.parse(signal));
});

test("parseFeedbackSignal derives trust score from canonical trust factors", () => {
  const result = parseFeedbackSignal({
    signalId: "sig_trust",
    taskId: "task_trust",
    source: "user",
    category: "correction",
    severity: "warning",
    timestamp: 1000,
    trustFactors: {
      sourceReliability: 0.9,
      historicalAccuracy: 0.8,
      authenticatedSource: true,
      attackSurfaceExposure: 0.1,
      holdoutOverlap: 0,
    },
  });

  assert.ok(result.feedbackTrustScore > 0.8);
  assert.equal(getFeedbackPromotionEligibility(result).eligible, true);
});

test("parseFeedbackSignal marks low-trust overlapping signals ineligible for direct promotion", () => {
  const result = parseFeedbackSignal({
    signalId: "sig_low_trust",
    taskId: "task_low_trust",
    source: "system",
    category: "failure",
    severity: "error",
    timestamp: 1000,
    trustFactors: {
      sourceReliability: 0.2,
      historicalAccuracy: 0.3,
      authenticatedSource: false,
      attackSurfaceExposure: 0.8,
      holdoutOverlap: 0.2,
    },
  });

  const eligibility = getFeedbackPromotionEligibility(result);
  assert.equal(eligibility.eligible, false);
  assert.ok(eligibility.reasons.includes("holdout_overlap_detected"));
  assert.ok(eligibility.reasons.includes("unauthenticated_source"));
});
