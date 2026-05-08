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
  assert.equal(result.baselineMean, 0);
  assert.equal(result.recentMean, 0);
});
