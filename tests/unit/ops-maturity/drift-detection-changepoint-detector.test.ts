import assert from "node:assert/strict";
import test from "node:test";

import {
  ChangepointDetectorService,
  type DriftSample,
} from "../../../src/ops-maturity/drift-detection/changepoint-detector/index.js";

function buildRelativeThresholdSamples(recentValue: number): DriftSample[] {
  return [
    ...Array.from({ length: 24 }, (_, index) => ({
      observedAt: new Date(index * 3_600_000).toISOString(),
      score: 1,
    })),
    ...Array.from({ length: 3 }, (_, index) => ({
      observedAt: new Date((24 + index) * 3_600_000).toISOString(),
      score: recentValue,
    })),
  ];
}

test("ChangepointDetectorService returns insufficient data when either window is empty", () => {
  const service = new ChangepointDetectorService();
  const result = service.detect([{ observedAt: "2026-04-20T00:00:00.000Z", score: 1 }], 24, 3, "24h", -0.1);

  assert.equal(result.detected, false);
  assert.equal(result.reasonCode, "drift.insufficient_data");
});

test("ChangepointDetectorService does not trigger when relative shift is barely above the threshold", () => {
  const service = new ChangepointDetectorService({ minSamplesBetweenAlerts: 0 });
  const result = service.detect(buildRelativeThresholdSamples(0.9000000001), 24, 3, "24h", -0.1);

  assert.equal(result.relativeShift < 0, true);
  assert.equal(result.detected, false);
  assert.equal(result.reasonCode, "drift.stable");
});

test("ChangepointDetectorService still triggers when the relative shift meets the threshold", () => {
  const service = new ChangepointDetectorService({ minSamplesBetweenAlerts: 0 });
  const result = service.detect(buildRelativeThresholdSamples(0.8999999999), 24, 3, "24h", -0.1);

  assert.ok(result.relativeShift <= -0.1);
  assert.equal(result.detected, true);
  assert.equal(result.reasonCode, "drift.changepoint_detected");
});

test("ChangepointDetectorService detectAll keeps canonical and legacy windows available", () => {
  const service = new ChangepointDetectorService({ minSamplesBetweenAlerts: 0 });
  const samples: DriftSample[] = Array.from({ length: 200 }, (_, index) => ({
    observedAt: new Date(index * 3_600_000).toISOString(),
    score: index < 100 ? 1 : 0.82,
  }));

  const results = service.detectAll(samples);

  assert.deepEqual(results.map((result) => result.windowType), ["1h", "6h", "24h", "7d"]);
  assert.ok(results.every((result) => typeof result.algorithm === "string"));
});
