import assert from "node:assert/strict";
import test from "node:test";

import { ChangepointDetectorService } from "../../../../../src/ops-maturity/drift-detection/changepoint-detector/index.js";

test("ChangepointDetectorService detects large score shifts", () => {
  const service = new ChangepointDetectorService();
  const result = service.detect([
    { observedAt: "2026-04-20T00:00:00.000Z", score: 0.9 },
    { observedAt: "2026-04-20T00:01:00.000Z", score: 0.88 },
    { observedAt: "2026-04-20T00:02:00.000Z", score: 0.87 },
    { observedAt: "2026-04-20T00:03:00.000Z", score: 0.5 },
    { observedAt: "2026-04-20T00:04:00.000Z", score: 0.45 },
    { observedAt: "2026-04-20T00:05:00.000Z", score: 0.4 },
  ]);

  assert.equal(result.detected, true);
  assert.equal(result.reasonCode, "drift.changepoint_detected");
  assert.equal(result.recommendedAction, "freeze");
});

test("ChangepointDetectorService reports stable when recent scores stay within threshold", () => {
  const service = new ChangepointDetectorService();
  const result = service.detect([
    { observedAt: "2026-04-20T00:00:00.000Z", score: 0.9 },
    { observedAt: "2026-04-20T00:01:00.000Z", score: 0.89 },
    { observedAt: "2026-04-20T00:02:00.000Z", score: 0.88 },
    { observedAt: "2026-04-20T00:03:00.000Z", score: 0.87 },
    { observedAt: "2026-04-20T00:04:00.000Z", score: 0.86 },
    { observedAt: "2026-04-20T00:05:00.000Z", score: 0.85 },
  ], 3, 3);

  assert.equal(result.detected, false);
  assert.equal(result.reasonCode, "drift.stable");
  assert.equal(result.severity, "none");
  assert.ok(result.relativeShift > -0.1);
});

test("ChangepointDetectorService reports insufficient data when baseline window is too small", () => {
  const service = new ChangepointDetectorService();
  const result = service.detect([
    { observedAt: "2026-04-20T00:00:00.000Z", score: 0.9 },
    { observedAt: "2026-04-20T00:01:00.000Z", score: 0.7 },
    { observedAt: "2026-04-20T00:02:00.000Z", score: 0.6 },
  ], 2, 2);

  assert.equal(result.detected, false);
  assert.equal(result.reasonCode, "drift.insufficient_data");
  assert.equal(result.baselineMean, 0.9);
  assert.ok(Math.abs(result.recentMean - 0.65) < 1e-9);
});

test("ChangepointDetectorService reports insufficient data for empty samples", () => {
  const service = new ChangepointDetectorService();
  const result = service.detect([]);

  assert.equal(result.detected, false);
  assert.equal(result.reasonCode, "drift.insufficient_data");
  assert.equal(result.baselineMean, 0);
  assert.equal(result.recentMean, 0);
  assert.equal(result.relativeShift, 0);
});

test("ChangepointDetectorService keeps relative shift at zero when baseline mean is zero", () => {
  const service = new ChangepointDetectorService();
  const result = service.detect([
    { observedAt: "2026-04-20T00:00:00.000Z", score: 0 },
    { observedAt: "2026-04-20T00:01:00.000Z", score: 0 },
    { observedAt: "2026-04-20T00:02:00.000Z", score: 0 },
    { observedAt: "2026-04-20T00:03:00.000Z", score: 0 },
    { observedAt: "2026-04-20T00:04:00.000Z", score: 0 },
    { observedAt: "2026-04-20T00:05:00.000Z", score: 0 },
  ], 3, 3);

  assert.equal(result.detected, false);
  assert.equal(result.reasonCode, "drift.stable");
  assert.equal(result.baselineMean, 0);
  assert.equal(result.recentMean, 0);
  assert.equal(result.relativeShift, 0);
});

test("ChangepointDetectorService reports insufficient data when recent window is effectively empty", () => {
  const service = new ChangepointDetectorService();
  const result = service.detect([
    { observedAt: "2026-04-20T00:00:00.000Z", score: 0.9 },
  ], 1, -1);

  assert.equal(result.detected, false);
  assert.equal(result.reasonCode, "drift.insufficient_data");
  assert.ok(result.baselineMean >= 0);
  assert.ok(result.recentMean >= 0);
});

test("ChangepointDetectorService exposes sample-size and distribution metadata", () => {
  const service = new ChangepointDetectorService({
    minSampleSize: 8,
    distributionAssumption: "poisson",
    falsePositiveRate: 0.01,
  });
  const result = service.detect([
    { observedAt: "2026-04-20T00:00:00.000Z", score: 0.9 },
    { observedAt: "2026-04-20T00:01:00.000Z", score: 0.7 },
    { observedAt: "2026-04-20T00:02:00.000Z", score: 0.6 },
  ]);

  assert.equal(result.sampleSize, 3);
  assert.equal(result.minSampleSize, 8);
  assert.equal(result.distributionAssumption, "poisson");
  assert.equal(result.falsePositiveRate, 0.01);
});

test("ChangepointDetectorService suppresses repeated alerts inside false-positive window", () => {
  const service = new ChangepointDetectorService({
    minSampleSize: 6,
    minSamplesBetweenAlerts: 5,
  });
  const first = service.detect([
    { observedAt: "2026-04-20T00:00:00.000Z", score: 1.0 },
    { observedAt: "2026-04-20T01:00:00.000Z", score: 1.0 },
    { observedAt: "2026-04-20T02:00:00.000Z", score: 1.0 },
    { observedAt: "2026-04-20T03:00:00.000Z", score: 0.6 },
    { observedAt: "2026-04-20T04:00:00.000Z", score: 0.6 },
    { observedAt: "2026-04-20T05:00:00.000Z", score: 0.6 },
  ], 3, 3);
  const second = service.detect([
    { observedAt: "2026-04-20T00:00:00.000Z", score: 1.0 },
    { observedAt: "2026-04-20T01:00:00.000Z", score: 1.0 },
    { observedAt: "2026-04-20T02:00:00.000Z", score: 1.0 },
    { observedAt: "2026-04-20T03:00:00.000Z", score: 0.6 },
    { observedAt: "2026-04-20T04:00:00.000Z", score: 0.6 },
    { observedAt: "2026-04-20T05:00:00.000Z", score: 0.6 },
    { observedAt: "2026-04-20T06:00:00.000Z", score: 0.6 },
  ], 4, 3);

  assert.equal(first.detected, true);
  assert.equal(second.detected, false);
  assert.equal(second.reasonCode, "drift.false_positive_suppressed");
});

test("ChangepointDetectorService uses downgrade/throttle actions for medium drift and builds response plan", () => {
  const service = new ChangepointDetectorService();
  const result = service.detect([
    { observedAt: "2026-04-20T00:00:00.000Z", score: 1.0 },
    { observedAt: "2026-04-20T01:00:00.000Z", score: 1.0 },
    { observedAt: "2026-04-20T02:00:00.000Z", score: 1.0 },
    { observedAt: "2026-04-20T03:00:00.000Z", score: 0.8 },
    { observedAt: "2026-04-20T04:00:00.000Z", score: 0.79 },
    { observedAt: "2026-04-20T05:00:00.000Z", score: 0.78 },
  ], 3, 3);

  assert.equal(result.detected, true);
  assert.equal(result.recommendedAction, "downgrade");

  const plan = service.buildResponsePlan({
    subjectId: "agent-a",
    subjectType: "agent",
    generatedAt: "2026-04-20T06:00:00.000Z",
    linkedSignalId: "drift_sig_1",
    baselineRef: "baseline:v1",
    result,
  });

  assert.ok(plan);
  assert.equal(plan?.primaryAction, "downgrade");
  assert.deepEqual(plan?.fallbackActions, ["throttle", "require_review"]);
});

test("ChangepointDetectorService detectAll evaluates canonical 1h/7d/30d/90d windows", () => {
  const service = new ChangepointDetectorService({ samplesPerHour: 0.05, minSampleSize: 20 });
  const samples = Array.from({ length: 120 }, (_, index) => ({
    observedAt: new Date(Date.UTC(2026, 0, 1, index)).toISOString(),
    score: index < 80 ? 1 : 0.7,
    metrics: {
      successRate: index < 80 ? 0.95 : 0.8,
      overrideRate: index < 80 ? 0.02 : 0.08,
      averageCostUsd: index < 80 ? 0.2 : 0.35,
      toolUsageShift: index < 80 ? 0.05 : 0.2,
      incidentCount: index < 80 ? 1 : 3,
    },
  }));

  const results = service.detectAll(samples);

  assert.deepEqual(results.map((result) => result.windowType), ["1h", "7d", "30d", "90d"]);
  assert.ok(results.every((result) => typeof result.algorithmScore === "number"));
  assert.ok(results.every((result) => "success_rate_drop" in result.evaluatedDimensions));
});
