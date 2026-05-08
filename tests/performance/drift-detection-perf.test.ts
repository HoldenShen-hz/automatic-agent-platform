/**
 * Performance Test: Drift Detection / Changepoint Detection
 * G4 Benchmark — ChangepointDetectorService.detect() P99 < 5ms
 *
 * Design target: Changepoint detection <5ms P99
 * Tests the drift detection algorithms (CUSUM, Bayesian, KL-JS) performance.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  ChangepointDetectorService,
  type DriftSample,
  type DriftDetectorConfig,
} from "../../src/ops-maturity/drift-detection/changepoint-detector/index.js";

const DEFAULT_DRIFT_DETECTOR_CONFIG: DriftDetectorConfig = {
  minSampleSize: 10,
  samplesPerHour: 1,
  zscoreThreshold: 2.0,
  zscoreHighSeverity: 3.0,
  zscoreMediumSeverity: 2.5,
  cusumBoundaryMultiplier: 5.0,
  cusumSlackMultiplier: 0.5,
  cusumHighSeverityMultiplier: 2.5,
  cusumMediumSeverityMultiplier: 1.5,
  bayesianConfidenceLevel: 0.95,
  bayesianHighSeverity: 0.99,
  bayesianMediumSeverity: 0.95,
  kljsDivergenceThreshold: 0.1,
  kljsHighSeverity: 0.2,
  kljsMediumSeverity: 0.1,
  distributionAssumption: "normal",
  falsePositiveRate: 0.05,
  falsePositiveWindowSize: 100,
  minSamplesBetweenAlerts: 10,
};

/**
 * Generate synthetic drift samples for testing.
 */
function generateDriftSamples(count: number, baselineMean: number, recentMean: number, recentStartIndex: number): DriftSample[] {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    observedAt: new Date(now - (count - i) * 60 * 60 * 1000).toISOString(),
    score: i >= recentStartIndex ? recentMean + (Math.random() - 0.5) * 2 : baselineMean + (Math.random() - 0.5) * 2,
  }));
}

/**
 * Generate stable samples with no drift.
 */
function generateStableSamples(count: number, mean: number): DriftSample[] {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    observedAt: new Date(now - (count - i) * 60 * 60 * 1000).toISOString(),
    score: mean + (Math.random() - 0.5) * 0.5,
  }));
}

test("performance: ChangepointDetectorService.detect() CUSUM 1h window P99 < 5ms", () => {
  const service = new ChangepointDetectorService(DEFAULT_DRIFT_DETECTOR_CONFIG);
  const samples = generateDriftSamples(100, 50, 70, 80); // 20% drift in recent samples
  const iterations = 1000;

  // Warmup
  for (let i = 0; i < 10; i++) {
    service.detect(samples, ["1h"]);
  }

  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    service.detect(samples, ["1h"]);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`ChangepointDetector CUSUM 1h: P50=${p50.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 5,
    `ChangepointDetector CUSUM 1h P99 latency ${p99.toFixed(3)}ms exceeds 5ms target`,
  );

  assert.ok(
    p50 < 2,
    `ChangepointDetector CUSUM 1h P50 latency ${p50.toFixed(3)}ms seems unexpectedly high`,
  );
});

test("performance: ChangepointDetectorService.detect() CUSUM 6h window P99 < 5ms", () => {
  const service = new ChangepointDetectorService(DEFAULT_DRIFT_DETECTOR_CONFIG);
  const samples = generateDriftSamples(150, 50, 70, 120);
  const iterations = 1000;

  // Warmup
  for (let i = 0; i < 10; i++) {
    service.detect(samples, ["6h"]);
  }

  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    service.detect(samples, ["6h"]);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`ChangepointDetector CUSUM 6h: P50=${p50.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 5,
    `ChangepointDetector CUSUM 6h P99 latency ${p99.toFixed(3)}ms exceeds 5ms target`,
  );
});

test("performance: ChangepointDetectorService.detect() CUSUM 24h window P99 < 5ms", () => {
  const service = new ChangepointDetectorService(DEFAULT_DRIFT_DETECTOR_CONFIG);
  const samples = generateDriftSamples(200, 50, 70, 160);
  const iterations = 1000;

  // Warmup
  for (let i = 0; i < 10; i++) {
    service.detect(samples, ["24h"]);
  }

  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    service.detect(samples, ["24h"]);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`ChangepointDetector CUSUM 24h: P50=${p50.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 5,
    `ChangepointDetector CUSUM 24h P99 latency ${p99.toFixed(3)}ms exceeds 5ms target`,
  );
});

test("performance: ChangepointDetectorService.detect() Bayesian 7d window P99 < 10ms", () => {
  const service = new ChangepointDetectorService(DEFAULT_DRIFT_DETECTOR_CONFIG);
  const samples = generateDriftSamples(400, 50, 75, 320); // Strong drift
  const iterations = 500;

  // Warmup
  for (let i = 0; i < 5; i++) {
    service.detect(samples, ["7d"]);
  }

  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    service.detect(samples, ["7d"]);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`ChangepointDetector Bayesian 7d: P50=${p50.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 10,
    `ChangepointDetector Bayesian 7d P99 latency ${p99.toFixed(3)}ms exceeds 10ms target`,
  );
});

test("performance: ChangepointDetectorService.detect() multi-window (all) P99 < 15ms", () => {
  const service = new ChangepointDetectorService(DEFAULT_DRIFT_DETECTOR_CONFIG);
  const samples = generateDriftSamples(400, 50, 70, 320);
  const iterations = 500;

  // Warmup
  for (let i = 0; i < 5; i++) {
    service.detect(samples, ["1h", "6h", "24h", "7d"]);
  }

  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    service.detect(samples, ["1h", "6h", "24h", "7d"]);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`ChangepointDetector multi-window: P50=${p50.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 15,
    `ChangepointDetector multi-window P99 latency ${p99.toFixed(3)}ms exceeds 15ms target`,
  );
});

test("performance: ChangepointDetectorService.detectAll() P99 < 20ms", () => {
  const service = new ChangepointDetectorService(DEFAULT_DRIFT_DETECTOR_CONFIG);
  const samples = generateDriftSamples(400, 50, 70, 320);
  const iterations = 300;

  // Warmup
  for (let i = 0; i < 3; i++) {
    service.detectAll(samples);
  }

  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    service.detectAll(samples);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`ChangepointDetector detectAll: P50=${p50.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 20,
    `ChangepointDetector detectAll P99 latency ${p99.toFixed(3)}ms exceeds 20ms target`,
  );
});

test("performance: ChangepointDetectorService stable samples (no drift) P99 < 5ms", () => {
  const service = new ChangepointDetectorService(DEFAULT_DRIFT_DETECTOR_CONFIG);
  const samples = generateStableSamples(100, 50);
  const iterations = 1000;

  // Warmup
  for (let i = 0; i < 10; i++) {
    service.detect(samples, ["1h"]);
  }

  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    service.detect(samples, ["1h"]);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`ChangepointDetector stable: P50=${p50.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 5,
    `ChangepointDetector stable P99 latency ${p99.toFixed(3)}ms exceeds 5ms target`,
  );
});

test("performance: ChangepointDetectorService throughput > 200 ops/sec", () => {
  const service = new ChangepointDetectorService(DEFAULT_DRIFT_DETECTOR_CONFIG);
  const samples = generateDriftSamples(100, 50, 70, 80);
  const iterations = 200;

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    service.detect(samples, ["1h"]);
  }
  const elapsed = performance.now() - start;

  const opsPerSec = (iterations / elapsed) * 1000;

  console.log(`ChangepointDetector throughput: ${opsPerSec.toFixed(0)} ops/sec`);

  assert.ok(
    opsPerSec > 200,
    `ChangepointDetector throughput ${opsPerSec.toFixed(0)} ops/sec should be > 200 ops/sec`,
  );
});

test("performance: ChangepointDetectorService with custom config P99 < 5ms", () => {
  const customConfig: DriftDetectorConfig = {
    ...DEFAULT_DRIFT_DETECTOR_CONFIG,
    minSampleSize: 20,
    zscoreThreshold: 2.5,
    cusumBoundaryMultiplier: 4.0,
  };
  const service = new ChangepointDetectorService(customConfig);
  const samples = generateDriftSamples(100, 50, 70, 80);
  const iterations = 1000;

  // Warmup
  for (let i = 0; i < 10; i++) {
    service.detect(samples, ["1h"]);
  }

  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    service.detect(samples, ["1h"]);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;

  console.log(`ChangepointDetector custom config: P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 5,
    `ChangepointDetector custom config P99 latency ${p99.toFixed(3)}ms exceeds 5ms target`,
  );
});

test("performance: ChangepointDetectorService getMetadata() P99 < 1ms", () => {
  const service = new ChangepointDetectorService(DEFAULT_DRIFT_DETECTOR_CONFIG);
  const samples = generateDriftSamples(100, 50, 70, 80);
  const iterations = 5000;

  // Warmup
  for (let i = 0; i < 10; i++) {
    service.detect(samples, ["1h"]);
    service.getMetadata();
  }

  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    service.getMetadata();
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;

  console.log(`ChangepointDetector getMetadata: P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 1,
    `ChangepointDetector getMetadata P99 latency ${p99.toFixed(3)}ms exceeds 1ms target`,
  );
});
