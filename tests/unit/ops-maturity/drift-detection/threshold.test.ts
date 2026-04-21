/**
 * Unit tests for drift detection thresholds per §17 spec
 * - 24-hour sliding window
 * - -10% relative change threshold
 * - Maps to SEV3 events
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  ChangepointDetectorService,
  type DriftSample,
  type ChangepointDetectionResult,
} from "../../../../src/ops-maturity/drift-detection/changepoint-detector/index.js";

test("ChangepointDetectorService uses 24h baseline window", () => {
  const service = new ChangepointDetectorService();

  // Create 24 samples (24 hours of hourly data) with stable baseline
  const now = new Date("2026-04-21T12:00:00.000Z");
  const samples: DriftSample[] = [];
  for (let i = 0; i < 24; i++) {
    samples.push({
      observedAt: new Date(now.getTime() - (23 - i) * 3600000).toISOString(),
      score: 0.95, // Stable high score
    });
  }
  // Add recent samples that show -10% drop
  for (let i = 0; i < 3; i++) {
    samples.push({
      observedAt: new Date(now.getTime() + (i + 1) * 3600000).toISOString(),
      score: 0.85, // ~10% drop
    });
  }

  const result = service.detect(samples);

  assert.strictEqual(result.detected, true);
  assert.strictEqual(result.severity, "SEV3");
});

test("ChangepointDetectorService detects -10% relative change", () => {
  const service = new ChangepointDetectorService();

  // Baseline: 100% (score = 1.0)
  const samples: DriftSample[] = [];
  for (let i = 0; i < 24; i++) {
    samples.push({
      observedAt: new Date(Date.now() - (23 - i) * 3600000).toISOString(),
      score: 1.0,
    });
  }
  // Recent: 90% (score = 0.9) - exactly -10%
  for (let i = 0; i < 3; i++) {
    samples.push({
      observedAt: new Date(Date.now() + (i + 1) * 3600000).toISOString(),
      score: 0.9,
    });
  }

  const result = service.detect(samples);

  assert.strictEqual(result.detected, true);
  assert.ok(result.relativeShift <= -0.10, `Expected relative shift <= -0.10, got ${result.relativeShift}`);
  assert.strictEqual(result.severity, "SEV3");
  assert.strictEqual(result.reasonCode, "drift.changepoint_detected");
});

test("ChangepointDetectorService does not detect -9% change (below threshold)", () => {
  const service = new ChangepointDetectorService();

  // Baseline: score = 1.0
  const samples: DriftSample[] = [];
  for (let i = 0; i < 24; i++) {
    samples.push({
      observedAt: new Date(Date.now() - (23 - i) * 3600000).toISOString(),
      score: 1.0,
    });
  }
  // Recent: score = 0.91 - only -9% drop
  for (let i = 0; i < 3; i++) {
    samples.push({
      observedAt: new Date(Date.now() + (i + 1) * 3600000).toISOString(),
      score: 0.91,
    });
  }

  const result = service.detect(samples);

  assert.strictEqual(result.detected, false);
  assert.strictEqual(result.severity, "none");
});

test("ChangepointDetectorService detects -15% change (well below threshold)", () => {
  const service = new ChangepointDetectorService();

  // Baseline: score = 1.0
  const samples: DriftSample[] = [];
  for (let i = 0; i < 24; i++) {
    samples.push({
      observedAt: new Date(Date.now() - (23 - i) * 3600000).toISOString(),
      score: 1.0,
    });
  }
  // Recent: score = 0.85 - -15% drop
  for (let i = 0; i < 3; i++) {
    samples.push({
      observedAt: new Date(Date.now() + (i + 1) * 3600000).toISOString(),
      score: 0.85,
    });
  }

  const result = service.detect(samples);

  assert.strictEqual(result.detected, true);
  assert.ok(result.relativeShift <= -0.10);
  assert.strictEqual(result.severity, "SEV3");
});

test("ChangepointDetectorService returns SEV3 severity on drift detection", () => {
  const service = new ChangepointDetectorService();

  // Significant degradation: score drops from 0.9 to 0.7
  const samples: DriftSample[] = [];
  for (let i = 0; i < 24; i++) {
    samples.push({
      observedAt: new Date(Date.now() - (23 - i) * 3600000).toISOString(),
      score: 0.9,
    });
  }
  for (let i = 0; i < 3; i++) {
    samples.push({
      observedAt: new Date(Date.now() + (i + 1) * 3600000).toISOString(),
      score: 0.7,
    });
  }

  const result = service.detect(samples);

  assert.strictEqual(result.detected, true);
  assert.strictEqual(result.severity, "SEV3");
});

test("ChangepointDetectorService returns none severity when stable", () => {
  const service = new ChangepointDetectorService();

  // Stable scores throughout
  const samples: DriftSample[] = [];
  for (let i = 0; i < 30; i++) {
    samples.push({
      observedAt: new Date(Date.now() - (29 - i) * 3600000).toISOString(),
      score: 0.95 + (Math.random() * 0.02 - 0.01), // Slight variation around 0.95
    });
  }

  const result = service.detect(samples);

  assert.strictEqual(result.detected, false);
  assert.strictEqual(result.severity, "none");
  assert.strictEqual(result.reasonCode, "drift.stable");
});

test("ChangepointDetectorService handles insufficient data", () => {
  const service = new ChangepointDetectorService();

  // Only 5 samples - not enough for 24h baseline
  const samples: DriftSample[] = [];
  for (let i = 0; i < 5; i++) {
    samples.push({
      observedAt: new Date(Date.now() - (4 - i) * 3600000).toISOString(),
      score: 0.9,
    });
  }

  const result = service.detect(samples);

  assert.strictEqual(result.detected, false);
  assert.strictEqual(result.severity, "none");
  assert.strictEqual(result.reasonCode, "drift.insufficient_data");
});

test("ChangepointDetectorService reports absolute and relative shift", () => {
  const service = new ChangepointDetectorService();

  // Baseline: 0.8, Recent: 0.64 (20% drop)
  const samples: DriftSample[] = [];
  for (let i = 0; i < 24; i++) {
    samples.push({
      observedAt: new Date(Date.now() - (23 - i) * 3600000).toISOString(),
      score: 0.8,
    });
  }
  for (let i = 0; i < 3; i++) {
    samples.push({
      observedAt: new Date(Date.now() + (i + 1) * 3600000).toISOString(),
      score: 0.64,
    });
  }

  const result = service.detect(samples);

  assert.ok(result.detected, "Should detect changepoint");
  assert.strictEqual(result.baselineMean, 0.8);
  assert.strictEqual(result.recentMean, 0.64);
  assert.strictEqual(result.absoluteShift, -0.16);
  assert.ok(Math.abs(result.relativeShift - (-0.20)) < 0.001, `Expected relative shift ~-0.20, got ${result.relativeShift}`);
});

test("ChangepointDetectorService default baseline window is 24 hours", () => {
  const service = new ChangepointDetectorService();

  // Create exactly 24 baseline samples + 3 recent samples
  const samples: DriftSample[] = [];
  for (let i = 0; i < 24; i++) {
    samples.push({
      observedAt: new Date(Date.now() - (23 - i) * 3600000).toISOString(),
      score: 1.0,
    });
  }
  // 3 recent samples with 10% drop
  for (let i = 0; i < 3; i++) {
    samples.push({
      observedAt: new Date(Date.now() + (i + 1) * 3600000).toISOString(),
      score: 0.9,
    });
  }

  // Default parameters should use 24h baseline window
  const result = service.detect(samples);

  assert.strictEqual(result.detected, true, "Should detect with default 24h window");
});

test("ChangepointDetectorService can use custom window sizes", () => {
  const service = new ChangepointDetectorService();

  // Create 12 samples for 12h baseline + 3 recent samples
  const samples: DriftSample[] = [];
  for (let i = 0; i < 12; i++) {
    samples.push({
      observedAt: new Date(Date.now() - (11 - i) * 3600000).toISOString(),
      score: 1.0,
    });
  }
  for (let i = 0; i < 3; i++) {
    samples.push({
      observedAt: new Date(Date.now() + (i + 1) * 3600000).toISOString(),
      score: 0.9,
    });
  }

  // Use 12h baseline instead of 24h
  const result = service.detect(samples, 12, 3);

  assert.strictEqual(result.detected, true);
});

test("ChangepointDetectorService negative shift indicates performance degradation", () => {
  const service = new ChangepointDetectorService();

  // Performance score drops from 0.9 to 0.72 (-20%)
  const samples: DriftSample[] = [];
  for (let i = 0; i < 24; i++) {
    samples.push({
      observedAt: new Date(Date.now() - (23 - i) * 3600000).toISOString(),
      score: 0.9,
    });
  }
  for (let i = 0; i < 3; i++) {
    samples.push({
      observedAt: new Date(Date.now() + (i + 1) * 3600000).toISOString(),
      score: 0.72,
    });
  }

  const result = service.detect(samples);

  assert.strictEqual(result.detected, true);
  assert.ok(result.relativeShift < 0, "Relative shift should be negative for degradation");
  assert.strictEqual(result.severity, "SEV3");
});
