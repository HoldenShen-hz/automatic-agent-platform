import assert from "node:assert/strict";
import test from "node:test";

import { ChangepointDetectorService } from "../../../../src/ops-maturity/drift-detection/changepoint-detector/index.js";

test("ChangepointDetectorService detects drift when recent mean is 10% lower than baseline", () => {
  // Baseline: 24 samples with mean = 100
  const baseline = Array.from({ length: 24 }, () => ({
    observedAt: new Date().toISOString(),
    score: 100,
  }));
  // Recent: 3 samples with mean = 88 (-12% shift)
  const recent = Array.from({ length: 3 }, () => ({
    observedAt: new Date().toISOString(),
    score: 88,
  }));
  const samples = [...baseline, ...recent];

  const result = new ChangepointDetectorService().detect(samples);

  assert.equal(result.detected, true);
  assert.equal(result.severity, "low");
  assert.ok(result.baselineMean > 0);
  assert.ok(result.recentMean < result.baselineMean);
  assert.ok(result.relativeShift < -0.10);
  assert.equal(result.reasonCode, "drift.changepoint_detected");
});

test("ChangepointDetectorService does not detect drift when recent mean is stable relative to baseline", () => {
  // All samples have the same score
  const samples = Array.from({ length: 30 }, () => ({
    observedAt: new Date().toISOString(),
    score: 50,
  }));

  const result = new ChangepointDetectorService().detect(samples);

  assert.equal(result.detected, false);
  assert.equal(result.severity, "none");
  assert.equal(result.reasonCode, "drift.stable");
});

test("ChangepointDetectorService does not detect drift for positive relative shift (improvement)", () => {
  const baseline = Array.from({ length: 24 }, () => ({
    observedAt: new Date().toISOString(),
    score: 80,
  }));
  const recent = Array.from({ length: 3 }, () => ({
    observedAt: new Date().toISOString(),
    score: 95,
  }));
  const samples = [...baseline, ...recent];

  const result = new ChangepointDetectorService().detect(samples);

  assert.equal(result.detected, false);
  assert.ok(result.relativeShift > 0);
});

test("ChangepointDetectorService returns insufficient_data when samples array is empty", () => {
  const result = new ChangepointDetectorService().detect([]);

  assert.equal(result.detected, false);
  assert.equal(result.severity, "none");
  assert.equal(result.reasonCode, "drift.insufficient_data");
  assert.equal(result.baselineMean, 0);
  assert.equal(result.recentMean, 0);
});

test("ChangepointDetectorService returns insufficient_data when baseline is smaller than recent window", () => {
  // Only 2 samples total, but recentWindow is 3 by default
  const samples = [
    { observedAt: new Date().toISOString(), score: 10 },
    { observedAt: new Date().toISOString(), score: 20 },
  ];

  const result = new ChangepointDetectorService().detect(samples, 24, 3);

  assert.equal(result.detected, false);
  assert.equal(result.reasonCode, "drift.insufficient_data");
});

test("ChangepointDetectorService handles only baseline samples with no room for recent window", () => {
  // exactly 3 samples - no room for 3-sample recent window after baseline
  const samples = Array.from({ length: 3 }, () => ({
    observedAt: new Date().toISOString(),
    score: 50,
  }));

  const result = new ChangepointDetectorService().detect(samples, 24, 3);

  assert.equal(result.detected, false);
  assert.equal(result.reasonCode, "drift.insufficient_data");
});

test("ChangepointDetectorService uses custom baseline and recent windows when provided", () => {
  const samples = Array.from({ length: 10 }, (_, i) => ({
    observedAt: new Date(Date.now() - i * 3600_000).toISOString(),
    score: i < 7 ? 100 : 85,
  }));

  const result = new ChangepointDetectorService().detect(samples, 7, 3);

  assert.equal(result.detected, true);
  assert.equal(result.severity, "medium");
});

test("ChangepointDetectorService computes correct absolute and relative shift", () => {
  const baseline = Array.from({ length: 24 }, () => ({
    observedAt: new Date().toISOString(),
    score: 50,
  }));
  const recent = Array.from({ length: 3 }, () => ({
    observedAt: new Date().toISOString(),
    score: 40,
  }));
  const samples = [...baseline, ...recent];

  const result = new ChangepointDetectorService().detect(samples);

  assert.equal(result.baselineMean, 50);
  assert.equal(result.recentMean, 40);
  assert.equal(result.absoluteShift, -10);
  assert.equal(result.relativeShift, -0.20);
});

test("ChangepointDetectorService detects at exact -10% threshold (boundary)", () => {
  const baseline = Array.from({ length: 24 }, () => ({
    observedAt: new Date().toISOString(),
    score: 100,
  }));
  const recent = Array.from({ length: 3 }, () => ({
    observedAt: new Date().toISOString(),
    score: 90,
  }));
  const samples = [...baseline, ...recent];

  const result = new ChangepointDetectorService().detect(samples);

  assert.equal(result.detected, true);
  assert.equal(result.relativeShift, -0.10);
});

test("ChangepointDetectorService does not detect just above -10% threshold", () => {
  const baseline = Array.from({ length: 24 }, () => ({
    observedAt: new Date().toISOString(),
    score: 100,
  }));
  const recent = Array.from({ length: 3 }, () => ({
    observedAt: new Date().toISOString(),
    score: 91,
  }));
  const samples = [...baseline, ...recent];

  const result = new ChangepointDetectorService().detect(samples);

  assert.equal(result.detected, false);
});

test("ChangepointDetectorService handles floating point scores with precision edge case", () => {
  const baseline = Array.from({ length: 24 }, () => ({
    observedAt: new Date().toISOString(),
    score: 0.1,
  }));
  const recent = Array.from({ length: 3 }, () => ({
    observedAt: new Date().toISOString(),
    score: 0.089,
  }));
  const samples = [...baseline, ...recent];

  const result = new ChangepointDetectorService().detect(samples);

  assert.equal(result.detected, true);
  assert.equal(result.reasonCode, "drift.changepoint_detected");
});

test("ChangepointDetectorService handles single sample in baseline and recent windows", () => {
  const samples = [
    { observedAt: new Date(Date.now() - 3600_000).toISOString(), score: 80 },
    { observedAt: new Date().toISOString(), score: 70 },
  ];

  const result = new ChangepointDetectorService().detect(samples, 1, 1);

  assert.equal(result.detected, true);
});
