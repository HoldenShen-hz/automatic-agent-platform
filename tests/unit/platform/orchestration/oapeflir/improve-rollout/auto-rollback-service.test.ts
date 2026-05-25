import test from "node:test";
import assert from "node:assert/strict";

import { AutoRollbackService, type RolloutMetrics } from "../../../../../../src/platform/five-plane-orchestration/oapeflir/improve-rollout/auto-rollback-service.js";

test("AutoRollbackService evaluates insufficient sample size", () => {
  const service = new AutoRollbackService();
  const metrics: RolloutMetrics = {
    requestCount: 5,
    failureRate: 0.1,
    p99LatencyMs: 100,
    baselineP99LatencyMs: 50,
  };

  const result = service.evaluate({} as any, metrics);
  assert.equal(result.evaluable, false);
  assert.equal(result.rollback, false);
  assert.ok(result.reasonCodes.includes("rollout.metrics_insufficient_sample"));
});

test("AutoRollbackService evaluates insufficient observation window", () => {
  const service = new AutoRollbackService();
  const metrics: RolloutMetrics = {
    requestCount: 100,
    failureRate: 0.1,
    p99LatencyMs: 100,
    baselineP99LatencyMs: 50,
    observationWindowMs: 30_000,
  };

  const result = service.evaluate({} as any, metrics);
  assert.equal(result.evaluable, false);
  assert.equal(result.rollback, false);
  assert.ok(result.reasonCodes.includes("rollout.metrics_insufficient_window"));
});

test("AutoRollbackService triggers rollback on high failure rate", () => {
  const service = new AutoRollbackService({ maxFailureRate: 0.05 });
  const metrics: RolloutMetrics = {
    requestCount: 100,
    failureRate: 0.1,
    p99LatencyMs: 50,
    baselineP99LatencyMs: 50,
    observationWindowMs: 120_000,
  };

  const result = service.evaluate({} as any, metrics);
  assert.equal(result.evaluable, true);
  assert.equal(result.rollback, true);
  assert.ok(result.reasonCodes.includes("rollout.failure_rate_exceeded"));
});

test("AutoRollbackService triggers rollback on high latency multiplier", () => {
  const service = new AutoRollbackService({ maxLatencyMultiplier: 1.5 });
  const metrics: RolloutMetrics = {
    requestCount: 100,
    failureRate: 0.01,
    p99LatencyMs: 200,
    baselineP99LatencyMs: 100,
    observationWindowMs: 120_000,
  };

  const result = service.evaluate({} as any, metrics);
  assert.equal(result.rollback, true);
  assert.ok(result.reasonCodes.includes("rollout.latency_multiplier_exceeded"));
});

test("AutoRollbackService does not rollback when metrics are healthy", () => {
  const service = new AutoRollbackService();
  const metrics: RolloutMetrics = {
    requestCount: 100,
    failureRate: 0.01,
    p99LatencyMs: 55,
    baselineP99LatencyMs: 50,
    observationWindowMs: 120_000,
  };

  const result = service.evaluate({} as any, metrics);
  assert.equal(result.evaluable, true);
  assert.equal(result.rollback, false);
  assert.deepEqual(result.reasonCodes, []);
});

test("AutoRollbackService triggers rollback with multiple violations", () => {
  const service = new AutoRollbackService({ maxFailureRate: 0.02, maxLatencyMultiplier: 1.2 });
  const metrics: RolloutMetrics = {
    requestCount: 100,
    failureRate: 0.1,
    p99LatencyMs: 200,
    baselineP99LatencyMs: 100,
    observationWindowMs: 120_000,
  };

  const result = service.evaluate({} as any, metrics);
  assert.equal(result.rollback, true);
  assert.ok(result.reasonCodes.includes("rollout.failure_rate_exceeded"));
  assert.ok(result.reasonCodes.includes("rollout.latency_multiplier_exceeded"));
});

test("AutoRollbackService uses default config values", () => {
  const service = new AutoRollbackService();
  const metrics: RolloutMetrics = {
    requestCount: 100,
    failureRate: 0.1,
    p99LatencyMs: 200,
    baselineP99LatencyMs: 100,
    observationWindowMs: 120_000,
  };

  const result = service.evaluate({} as any, metrics);
  assert.equal(result.rollback, true);
});

test("AutoRollbackService accepts custom config", () => {
  const service = new AutoRollbackService({
    maxFailureRate: 0.2,
    maxLatencyMultiplier: 3,
    minimumRequestCount: 50,
    minimumObservationWindowMs: 30_000,
  });

  const metrics: RolloutMetrics = {
    requestCount: 50,
    failureRate: 0.15,
    p99LatencyMs: 150,
    baselineP99LatencyMs: 100,
    observationWindowMs: 30_000,
  };

  const result = service.evaluate({} as any, metrics);
  assert.equal(result.rollback, false);
});

test("AutoRollbackService handles zero baseline latency by treating as minimum 1", () => {
  const service = new AutoRollbackService({ maxLatencyMultiplier: 15 });
  const metrics: RolloutMetrics = {
    requestCount: 100,
    failureRate: 0.01,
    p99LatencyMs: 10,
    baselineP99LatencyMs: 0,
    observationWindowMs: 120_000,
  };

  const result = service.evaluate({} as any, metrics);
  // Zero baseline is treated as 1, so 10/1 = 10. With maxLatencyMultiplier of 15, it should NOT rollback
  assert.equal(result.rollback, false);
  assert.deepEqual(result.reasonCodes, []);
});

test("AutoRollbackService triggers rollback with zero baseline when latency is too high", () => {
  const service = new AutoRollbackService({ maxLatencyMultiplier: 5 });
  const metrics: RolloutMetrics = {
    requestCount: 100,
    failureRate: 0.01,
    p99LatencyMs: 10,
    baselineP99LatencyMs: 0,
    observationWindowMs: 120_000,
  };

  const result = service.evaluate({} as any, metrics);
  // Zero baseline is treated as 1, so 10/1 = 10 which exceeds maxLatencyMultiplier of 5
  assert.equal(result.rollback, true);
  assert.ok(result.reasonCodes.includes("rollout.latency_multiplier_exceeded"));
});

test("AutoRollbackService returns insufficient_window when observation window is too small", () => {
  const service = new AutoRollbackService({
    minimumObservationWindowMs: 60_000,
  });
  const metrics: RolloutMetrics = {
    requestCount: 100,
    failureRate: 0.01,
    p99LatencyMs: 100,
    baselineP99LatencyMs: 100,
    observationWindowMs: 30_000, // Less than minimumObservationWindowMs (60_000)
  };

  const result = service.evaluate({} as any, metrics);

  assert.equal(result.rollback, false);
  assert.ok(result.reasonCodes.includes("rollout.metrics_insufficient_window"));
});

test("AutoRollbackService uses minimumObservationWindowMs from config when observationWindowMs is null", () => {
  const service = new AutoRollbackService({
    minimumObservationWindowMs: 60_000,
  });
  const metrics: RolloutMetrics = {
    requestCount: 100,
    failureRate: 0.01,
    p99LatencyMs: 100,
    baselineP99LatencyMs: 100,
    observationWindowMs: null as any, // null triggers fallback to minimumObservationWindowMs
  };

  const result = service.evaluate({} as any, metrics);

  // null ?? 60000 = 60000, which is >= minimumObservationWindowMs (60000), so no insufficient_window error
  assert.equal(result.rollback, false);
  assert.ok(!result.reasonCodes.includes("rollout.metrics_insufficient_window"));
});

test("AutoRollbackService uses default minimum when observationWindowMs is undefined", () => {
  const service = new AutoRollbackService({
    minimumObservationWindowMs: 60_000,
  });
  const metrics: RolloutMetrics = {
    requestCount: 100,
    failureRate: 0.01,
    p99LatencyMs: 100,
    baselineP99LatencyMs: 100,
    // observationWindowMs is undefined - not provided
  };

  const result = service.evaluate({} as any, metrics);

  // undefined ?? 60000 = 60000, which is >= minimumObservationWindowMs (60000)
  // So no rollback and no insufficient_window error
  assert.equal(result.rollback, false);
  assert.ok(!result.reasonCodes.includes("rollout.metrics_insufficient_window"));
});
