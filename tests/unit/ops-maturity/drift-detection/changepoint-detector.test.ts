import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ChangepointDetectorService } from "../../../../src/ops-maturity/drift-detection/changepoint-detector/index.js";

describe("ChangepointDetectorService", () => {
  const service = new ChangepointDetectorService();

  test("detects drift when recent mean is 10% lower than baseline", () => {
    // Baseline: 10 samples with mean = 100
    const baseline = Array.from({ length: 24 }, (_, i) => ({
      observedAt: new Date(Date.now() - (24 - i) * 3600_000).toISOString(),
      score: 100,
    }));
    // Recent: 3 samples with mean = 88 (-12% shift)
    const recent = Array.from({ length: 3 }, (_, i) => ({
      observedAt: new Date(Date.now() - (3 - i) * 3600_000).toISOString(),
      score: 88,
    }));
    const samples = [...baseline, ...recent];

    const result = service.detect(samples);

    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.severity, "SEV3");
    assert.ok(result.baselineMean > 0);
    assert.ok(result.recentMean < result.baselineMean);
    assert.ok(result.relativeShift < -0.10);
    assert.strictEqual(result.reasonCode, "drift.changepoint_detected");
  });

  test("does not detect drift when recent mean is stable relative to baseline", () => {
    // All samples have the same score
    const samples = Array.from({ length: 30 }, (_, i) => ({
      observedAt: new Date(Date.now() - (30 - i) * 3600_000).toISOString(),
      score: 50,
    }));

    const result = service.detect(samples);

    assert.strictEqual(result.detected, false);
    assert.strictEqual(result.severity, "none");
    assert.strictEqual(result.reasonCode, "drift.stable");
  });

  test("does not detect drift for positive relative shift (improvement)", () => {
    const baseline = Array.from({ length: 24 }, () => ({
      observedAt: new Date().toISOString(),
      score: 80,
    }));
    const recent = Array.from({ length: 3 }, () => ({
      observedAt: new Date().toISOString(),
      score: 95,
    }));
    const samples = [...baseline, ...recent];

    const result = service.detect(samples);

    assert.strictEqual(result.detected, false);
    assert.ok(result.relativeShift > 0);
  });

  test("returns insufficient_data when samples array is empty", () => {
    const result = service.detect([]);

    assert.strictEqual(result.detected, false);
    assert.strictEqual(result.severity, "none");
    assert.strictEqual(result.reasonCode, "drift.insufficient_data");
    assert.strictEqual(result.baselineMean, 0);
    assert.strictEqual(result.recentMean, 0);
  });

  test("returns insufficient_data when baseline is smaller than recent window", () => {
    // Only 2 samples total, but recentWindow is 3 by default
    const samples = [
      { observedAt: new Date().toISOString(), score: 10 },
      { observedAt: new Date().toISOString(), score: 20 },
    ];

    const result = service.detect(samples, 24, 3);

    assert.strictEqual(result.detected, false);
    assert.strictEqual(result.reasonCode, "drift.insufficient_data");
  });

  test("handles only baseline samples with no recent window", () => {
    // exactly 3 samples - no room for recent window
    const samples = Array.from({ length: 3 }, () => ({
      observedAt: new Date().toISOString(),
      score: 50,
    }));

    const result = service.detect(samples, 24, 3);

    assert.strictEqual(result.detected, false);
    assert.strictEqual(result.reasonCode, "drift.insufficient_data");
  });

  test("uses custom baseline and recent windows when provided", () => {
    const samples = Array.from({ length: 10 }, (_, i) => ({
      observedAt: new Date(Date.now() - i * 3600_000).toISOString(),
      score: i < 7 ? 100 : 85,
    }));

    const result = service.detect(samples, 7, 3);

    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.severity, "SEV3");
  });

  test("computes correct absolute and relative shift", () => {
    const baseline = Array.from({ length: 24 }, () => ({
      observedAt: new Date().toISOString(),
      score: 50,
    }));
    const recent = Array.from({ length: 3 }, () => ({
      observedAt: new Date().toISOString(),
      score: 40,
    }));
    const samples = [...baseline, ...recent];

    const result = service.detect(samples);

    assert.strictEqual(result.baselineMean, 50);
    assert.strictEqual(result.recentMean, 40);
    assert.strictEqual(result.absoluteShift, -10);
    assert.strictEqual(result.relativeShift, -0.20);
  });

  test("detects at exact -10% threshold (boundary)", () => {
    const baseline = Array.from({ length: 24 }, () => ({
      observedAt: new Date().toISOString(),
      score: 100,
    }));
    const recent = Array.from({ length: 3 }, () => ({
      observedAt: new Date().toISOString(),
      score: 90,
    }));
    const samples = [...baseline, ...recent];

    const result = service.detect(samples);

    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.relativeShift, -0.10);
  });

  test("does not detect just above -10% threshold", () => {
    const baseline = Array.from({ length: 24 }, () => ({
      observedAt: new Date().toISOString(),
      score: 100,
    }));
    const recent = Array.from({ length: 3 }, () => ({
      observedAt: new Date().toISOString(),
      score: 91,
    }));
    const samples = [...baseline, ...recent];

    const result = service.detect(samples);

    assert.strictEqual(result.detected, false);
  });

  test("handles floating point scores with precision edge case", () => {
    const baseline = Array.from({ length: 24 }, () => ({
      observedAt: new Date().toISOString(),
      score: 0.1,
    }));
    const recent = Array.from({ length: 3 }, () => ({
      observedAt: new Date().toISOString(),
      score: 0.089,
    }));
    const samples = [...baseline, ...recent];

    const result = service.detect(samples);

    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.reasonCode, "drift.changepoint_detected");
  });

  test("handles single sample in baseline and recent windows", () => {
    const samples = [
      { observedAt: new Date(Date.now() - 3600_000).toISOString(), score: 80 },
      { observedAt: new Date().toISOString(), score: 70 },
    ];

    const result = service.detect(samples, 1, 1);

    assert.strictEqual(result.detected, true);
  });
});