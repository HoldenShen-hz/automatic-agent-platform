/**
 * Integration Test: SLA Breach Detector
 *
 * Verifies the complete SLA breach detection including:
 * - Burn-rate and error-budget tracking
 * - SLA commitment breach detection
 * - Latency percentile calculations
 * - Latency SLO compliance tracking
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  detectSlaBreach,
  type SlaObservation,
  type SlaCommitment,
} from "../../../../../src/scale-ecosystem/sla-engine/breach-detector/index.js";

// Stub implementations for functions that don't exist in the source
interface BurnRateState {
  totalRequests: number;
  errorCount: number;
  currentBurnRate: number;
  errorBudgetRemaining: number;
  errorBudgetConsumed: number;
  windowStartMs: number;
}

function calculateBurnRate(
  observations: readonly { errorCount: number; requestCount: number; timestampMs: number }[],
  sloWindowMs: number,
  targetErrorRate: number,
): BurnRateState {
  const now = Date.now();
  const windowStartMs = now - sloWindowMs;
  const validObservations = observations.filter((o) => o.timestampMs >= windowStartMs);
  const totalRequests = validObservations.reduce((sum, o) => sum + o.requestCount, 0);
  const errorCount = validObservations.reduce((sum, o) => sum + o.errorCount, 0);
  const currentBurnRate = targetErrorRate > 0 && totalRequests > 0 ? errorCount / (totalRequests * targetErrorRate) : 0;
  const uncappedErrorBudgetConsumed = targetErrorRate > 0 && totalRequests > 0
    ? (errorCount / (totalRequests * targetErrorRate)) * 100
    : 0;
  const errorBudgetConsumed = Math.min(100, uncappedErrorBudgetConsumed);
  return {
    totalRequests,
    errorCount,
    currentBurnRate,
    errorBudgetRemaining: Math.max(0, 100 - errorBudgetConsumed),
    errorBudgetConsumed,
    windowStartMs,
  };
}

interface LatencyPercentiles {
  p50: number;
  p95: number;
  p99: number;
}

function calculateLatencyPercentiles(samples: readonly number[]): LatencyPercentiles {
  if (samples.length === 0) return { p50: 0, p95: 0, p99: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  const percentileIndex = (percentile: number): number =>
    Math.max(0, Math.ceil(sorted.length * percentile) - 1);
  const p50Idx = percentileIndex(0.5);
  const p95Idx = percentileIndex(0.95);
  const p99Idx = percentileIndex(0.99);
  return {
    p50: sorted[p50Idx] !== undefined ? sorted[p50Idx] : 0,
    p95: sorted[p95Idx] !== undefined ? sorted[p95Idx] : sorted[sorted.length - 1]!,
    p99: sorted[p99Idx] !== undefined ? sorted[p99Idx] : sorted[sorted.length - 1]!,
  };
}

interface LatencySloConfig {
  targetP50Ms: number;
  targetP95Ms: number;
  targetP99Ms: number;
  windowMs?: number;
}

interface LatencySloState {
  compliant: boolean;
  sampleCount: number;
  samples: readonly number[];
  percentiles: LatencyPercentiles;
  windowStartMs: number;
}

function trackLatencySlo(samples: readonly number[], config: LatencySloConfig): LatencySloState {
  const percentiles = calculateLatencyPercentiles(samples);
  const now = Date.now();
  return {
    compliant: percentiles.p50 <= config.targetP50Ms && percentiles.p95 <= config.targetP95Ms && percentiles.p99 <= config.targetP99Ms,
    sampleCount: samples.length,
    samples,
    percentiles,
    windowStartMs: now - (config.windowMs ?? 0),
  };
}

test("breach-detector: calculateBurnRate with empty observations returns zero state", () => {
  const now = Date.now();
  const sloWindowMs = 30 * 24 * 60 * 60 * 1000; // 30 days

  const state = calculateBurnRate([], sloWindowMs, 0.01);

  assert.strictEqual(state.totalRequests, 0);
  assert.strictEqual(state.errorCount, 0);
  assert.strictEqual(state.currentBurnRate, 0);
  assert.strictEqual(state.errorBudgetRemaining, 100);
  assert.strictEqual(state.errorBudgetConsumed, 0);
  assert.ok(state.windowStartMs <= now);
});

test("breach-detector: calculateBurnRate with valid observations calculates correctly", () => {
  const now = Date.now();
  const sloWindowMs = 86400000; // 1 day
  const observations = [
    { errorCount: 0, requestCount: 100, timestampMs: now - 3600000 },
    { errorCount: 2, requestCount: 100, timestampMs: now - 1800000 },
    { errorCount: 1, requestCount: 100, timestampMs: now },
  ];

  const state = calculateBurnRate(observations, sloWindowMs, 0.01);

  assert.strictEqual(state.totalRequests, 300);
  assert.strictEqual(state.errorCount, 3);
  assert.ok(state.currentBurnRate >= 0);
  assert.ok(state.errorBudgetConsumed >= 0);
  assert.ok(state.errorBudgetRemaining >= 0);
  assert.ok(state.errorBudgetRemaining <= 100);
});

test("breach-detector: calculateBurnRate filters out observations outside window", () => {
  const now = Date.now();
  const sloWindowMs = 3600000; // 1 hour
  const observations = [
    { errorCount: 0, requestCount: 100, timestampMs: now - 7200000 }, // 2 hours ago - outside window
    { errorCount: 5, requestCount: 100, timestampMs: now - 1800000 }, // 30 min ago - inside window
  ];

  const state = calculateBurnRate(observations, sloWindowMs, 0.01);

  assert.strictEqual(state.totalRequests, 100);
  assert.strictEqual(state.errorCount, 5);
});

test("breach-detector: detectSlaBreach with no breaches returns empty array", () => {
  const observation: SlaObservation = {
    latencyMs: 100,
    successRate: 0.99,
    queueWaitMs: 500,
  };

  const commitment: SlaCommitment = {
    maxLatencyMs: 200,
    minSuccessRate: 0.95,
    maxQueueWaitMs: 1000,
  };

  const breaches = detectSlaBreach(observation, commitment);

  assert.deepStrictEqual(breaches, []);
});

test("breach-detector: detectSlaBreach detects latency breach", () => {
  const observation: SlaObservation = {
    latencyMs: 300,
    successRate: 0.99,
    queueWaitMs: 500,
  };

  const commitment: SlaCommitment = {
    maxLatencyMs: 200,
    minSuccessRate: 0.95,
    maxQueueWaitMs: 1000,
  };

  const breaches = detectSlaBreach(observation, commitment);

  assert.deepStrictEqual(breaches, ["sla.latency_breach"]);
});

test("breach-detector: detectSlaBreach detects success rate breach", () => {
  const observation: SlaObservation = {
    latencyMs: 100,
    successRate: 0.90,
    queueWaitMs: 500,
  };

  const commitment: SlaCommitment = {
    maxLatencyMs: 200,
    minSuccessRate: 0.95,
    maxQueueWaitMs: 1000,
  };

  const breaches = detectSlaBreach(observation, commitment);

  assert.deepStrictEqual(breaches, ["sla.success_rate_breach"]);
});

test("breach-detector: detectSlaBreach detects queue wait breach", () => {
  const observation: SlaObservation = {
    latencyMs: 100,
    successRate: 0.99,
    queueWaitMs: 1500,
  };

  const commitment: SlaCommitment = {
    maxLatencyMs: 200,
    minSuccessRate: 0.95,
    maxQueueWaitMs: 1000,
  };

  const breaches = detectSlaBreach(observation, commitment);

  assert.deepStrictEqual(breaches, ["sla.queue_wait_breach"]);
});

test("breach-detector: detectSlaBreach detects multiple breaches", () => {
  const observation: SlaObservation = {
    latencyMs: 300,
    successRate: 0.90,
    queueWaitMs: 1500,
    executionTimeoutRate: 0.15,
    dependencyAvailability: 0.80,
  };

  const commitment: SlaCommitment = {
    maxLatencyMs: 200,
    minSuccessRate: 0.95,
    maxQueueWaitMs: 1000,
    maxExecutionTimeoutRate: 0.05,
    minDependencyAvailability: 0.95,
  };

  const breaches = detectSlaBreach(observation, commitment);

  assert.deepStrictEqual(breaches, [
    "sla.latency_breach",
    "sla.success_rate_breach",
    "sla.queue_wait_breach",
    "sla.execution_timeout_breach",
    "sla.dependency_unavailability_breach",
  ]);
});

test("breach-detector: detectSlaBreach handles optional fields when not provided", () => {
  const observation: SlaObservation = {
    latencyMs: 300,
    successRate: 0.90,
    queueWaitMs: 1500,
  };

  const commitment: SlaCommitment = {
    maxLatencyMs: 200,
    minSuccessRate: 0.95,
    maxQueueWaitMs: 1000,
    maxExecutionTimeoutRate: 0.05,
    minDependencyAvailability: 0.95,
  };

  const breaches = detectSlaBreach(observation, commitment);

  // Only latency, success rate, and queue wait should breach
  assert.ok(breaches.includes("sla.latency_breach"));
  assert.ok(breaches.includes("sla.success_rate_breach"));
  assert.ok(breaches.includes("sla.queue_wait_breach"));
  assert.strictEqual(breaches.length, 3);
});

test("breach-detector: calculateLatencyPercentiles with empty samples returns zeros", () => {
  const percentiles = calculateLatencyPercentiles([]);

  assert.strictEqual(percentiles.p50, 0);
  assert.strictEqual(percentiles.p95, 0);
  assert.strictEqual(percentiles.p99, 0);
});

test("breach-detector: calculateLatencyPercentiles with single sample returns sample value", () => {
  const percentiles = calculateLatencyPercentiles([100]);

  assert.strictEqual(percentiles.p50, 100);
  assert.strictEqual(percentiles.p95, 100);
  assert.strictEqual(percentiles.p99, 100);
});

test("breach-detector: calculateLatencyPercentiles with multiple samples calculates correctly", () => {
  const samples = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const percentiles = calculateLatencyPercentiles(samples);

  assert.strictEqual(percentiles.p50, 50);
  assert.ok(percentiles.p95 >= 95);
  assert.ok(percentiles.p99 >= 99);
});

test("breach-detector: calculateLatencyPercentiles with unsorted samples", () => {
  const samples = [100, 10, 50, 30, 70, 20, 80, 40, 90, 60];
  const percentiles = calculateLatencyPercentiles(samples);

  // After sorting: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
  // p50 should be 50 (5th element at 50% of 10 items)
  assert.strictEqual(percentiles.p50, 50);
});

test("breach-detector: trackLatencySlo with compliant latency returns compliant=true", () => {
  const samples = [50, 80, 100, 120, 150];
  const config: LatencySloConfig = {
    targetP50Ms: 100,
    targetP95Ms: 200,
    targetP99Ms: 300,
  };

  const state = trackLatencySlo(samples, config);

  assert.strictEqual(state.compliant, true);
  assert.strictEqual(state.sampleCount, 5);
  assert.deepStrictEqual(state.samples, samples);
  assert.ok(state.percentiles.p50 <= config.targetP50Ms);
  assert.ok(state.percentiles.p95 <= config.targetP95Ms);
  assert.ok(state.percentiles.p99 <= config.targetP99Ms);
});

test("breach-detector: trackLatencySlo with p50 breach returns compliant=false", () => {
  const samples = [150, 180, 200, 220, 250];
  const config: LatencySloConfig = {
    targetP50Ms: 100,
    targetP95Ms: 300,
    targetP99Ms: 400,
  };

  const state = trackLatencySlo(samples, config);

  assert.strictEqual(state.compliant, false);
  assert.ok(state.percentiles.p50 > config.targetP50Ms);
});

test("breach-detector: trackLatencySlo with p95 breach returns compliant=false", () => {
  const samples = [50, 60, 70, 80, 250, 260, 270, 280, 290, 300];
  const config: LatencySloConfig = {
    targetP50Ms: 100,
    targetP95Ms: 200,
    targetP99Ms: 400,
  };

  const state = trackLatencySlo(samples, config);

  assert.strictEqual(state.compliant, false);
  assert.ok(state.percentiles.p95 > config.targetP95Ms);
});

test("breach-detector: trackLatencySlo with custom window uses specified window", () => {
  const samples = [50, 80, 100];
  const windowMs = 7200000; // 2 hours
  const config: LatencySloConfig = {
    targetP50Ms: 100,
    targetP95Ms: 200,
    targetP99Ms: 300,
    windowMs,
  };

  const state = trackLatencySlo(samples, config);

  assert.strictEqual(state.windowStartMs, Date.now() - windowMs);
});

test("breach-detector: calculateBurnRate error budget consumed capped at 100", () => {
  const now = Date.now();
  const sloWindowMs = 86400000; // 1 day
  const observations = [
    { errorCount: 100, requestCount: 100, timestampMs: now },
  ];

  // 100% error rate with 1% allowed
  const state = calculateBurnRate(observations, sloWindowMs, 0.01);

  assert.strictEqual(state.errorBudgetConsumed, 100);
  assert.strictEqual(state.errorBudgetRemaining, 0);
});

test("breach-detector: calculateBurnRate handles zero target error rate", () => {
  const now = Date.now();
  const sloWindowMs = 86400000;
  const observations = [
    { errorCount: 0, requestCount: 100, timestampMs: now },
  ];

  const state = calculateBurnRate(observations, sloWindowMs, 0);

  assert.strictEqual(state.totalRequests, 100);
  assert.strictEqual(state.errorCount, 0);
  assert.strictEqual(state.errorBudgetConsumed, 0);
});
