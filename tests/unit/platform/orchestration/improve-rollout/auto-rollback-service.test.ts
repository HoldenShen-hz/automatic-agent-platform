import assert from "node:assert/strict";
import test from "node:test";

import { AutoRollbackService, type RolloutMetrics, type AutoRollbackConfig } from "../../../../../src/platform/orchestration/improve-rollout/auto-rollback-service.js";
import type { RolloutRecord } from "../../../../../src/platform/orchestration/oapeflir/types/rollout-record.js";

function makeRolloutRecord(overrides: Partial<RolloutRecord> = {}): RolloutRecord {
  return {
    recordId: "record-" + Math.random().toString(36).slice(2),
    candidateId: "candidate-1",
    level: "canary_5",
    previousLevel: "shadow",
    strategyVersionId: "strategy-version-1",
    status: "canary_5",
    transitionedAt: Date.now(),
    guardrailReasonCodes: [],
    evidence: [],
    ...overrides,
  };
}

function makeMetrics(overrides: Partial<RolloutMetrics> = {}): RolloutMetrics {
  return {
    requestCount: 100,
    failureRate: 0.01,
    p99LatencyMs: 200,
    baselineP99LatencyMs: 100,
    observationWindowMs: 120_000,
    ...overrides,
  };
}

test("AutoRollbackService evaluates metrics and does not rollback when within thresholds", () => {
  const service = new AutoRollbackService();
  const rollout = makeRolloutRecord({ status: "canary_5" });
  const metrics = makeMetrics({
    requestCount: 100,
    failureRate: 0.01,
    p99LatencyMs: 150,
    baselineP99LatencyMs: 100,
  });

  const decision = service.evaluate(rollout, metrics);

  assert.equal(decision.rollback, false);
  assert.ok(decision.reasonCodes.length === 0);
});

test("AutoRollbackService triggers rollback when failure rate exceeds maxFailureRate", () => {
  const service = new AutoRollbackService();
  const rollout = makeRolloutRecord({ status: "canary_5" });
  const metrics = makeMetrics({
    requestCount: 100,
    failureRate: 0.10,
    p99LatencyMs: 150,
    baselineP99LatencyMs: 100,
  });

  const decision = service.evaluate(rollout, metrics);

  assert.equal(decision.rollback, true);
  assert.ok(decision.reasonCodes.includes("rollout.failure_rate_exceeded"));
});

test("AutoRollbackService triggers rollback when latency multiplier exceeds maxLatencyMultiplier", () => {
  const service = new AutoRollbackService();
  const rollout = makeRolloutRecord({ status: "canary_5" });
  const metrics = makeMetrics({
    requestCount: 100,
    failureRate: 0.01,
    p99LatencyMs: 300,
    baselineP99LatencyMs: 100,
  });

  const decision = service.evaluate(rollout, metrics);

  assert.equal(decision.rollback, true);
  assert.ok(decision.reasonCodes.includes("rollout.latency_multiplier_exceeded"));
});

test("AutoRollbackService returns insufficient sample when requestCount below minimumRequestCount", () => {
  const service = new AutoRollbackService();
  const rollout = makeRolloutRecord({ status: "canary_5" });
  const metrics = makeMetrics({
    requestCount: 5,
    failureRate: 0.01,
    p99LatencyMs: 150,
    baselineP99LatencyMs: 100,
  });

  const decision = service.evaluate(rollout, metrics);

  assert.equal(decision.rollback, false);
  assert.ok(decision.reasonCodes.includes("rollout.metrics_insufficient_sample"));
});

test("AutoRollbackService returns insufficient window when observationWindowMs below minimum", () => {
  const service = new AutoRollbackService();
  const rollout = makeRolloutRecord({ status: "canary_5" });
  const metrics = makeMetrics({
    requestCount: 100,
    failureRate: 0.01,
    p99LatencyMs: 150,
    baselineP99LatencyMs: 100,
    observationWindowMs: 30_000,
  });

  const decision = service.evaluate(rollout, metrics);

  assert.equal(decision.rollback, false);
  assert.ok(decision.reasonCodes.includes("rollout.metrics_insufficient_window"));
});

test("AutoRollbackService uses default config when no config provided", () => {
  const service = new AutoRollbackService();
  const rollout = makeRolloutRecord({ status: "canary_5" });
  const metrics = makeMetrics({
    requestCount: 100,
    failureRate: 0.01,
    p99LatencyMs: 150,
    baselineP99LatencyMs: 100,
  });

  const decision = service.evaluate(rollout, metrics);

  assert.equal(decision.rollback, false);
});

test("AutoRollbackService applies custom config overrides", () => {
  const config: Partial<AutoRollbackConfig> = {
    maxFailureRate: 0.02,
    maxLatencyMultiplier: 1.5,
    minimumRequestCount: 50,
    minimumObservationWindowMs: 30_000,
  };
  const service = new AutoRollbackService(config);
  const rollout = makeRolloutRecord({ status: "canary_5" });
  const metrics = makeMetrics({
    requestCount: 100,
    failureRate: 0.03,
    p99LatencyMs: 200,
    baselineP99LatencyMs: 100,
    observationWindowMs: 60_000,
  });

  const decision = service.evaluate(rollout, metrics);

  assert.equal(decision.rollback, true);
  assert.ok(decision.reasonCodes.includes("rollout.failure_rate_exceeded"));
  assert.ok(decision.reasonCodes.includes("rollout.latency_multiplier_exceeded"));
});

test("AutoRollbackService handles zero baseline latency gracefully", () => {
  const service = new AutoRollbackService();
  const rollout = makeRolloutRecord({ status: "canary_5" });
  const metrics = makeMetrics({
    requestCount: 100,
    failureRate: 0.01,
    p99LatencyMs: 1,
    baselineP99LatencyMs: 0,
  });

  const decision = service.evaluate(rollout, metrics);

  // baselineLatency becomes Math.max(0, 1) = 1, so ratio is 1/1 = 1, which is <= 2
  assert.equal(decision.rollback, false);
});

test("AutoRollbackService returns both failure rate and latency reasons when both exceeded", () => {
  const service = new AutoRollbackService();
  const rollout = makeRolloutRecord({ status: "canary_5" });
  const metrics = makeMetrics({
    requestCount: 100,
    failureRate: 0.10,
    p99LatencyMs: 300,
    baselineP99LatencyMs: 100,
  });

  const decision = service.evaluate(rollout, metrics);

  assert.equal(decision.rollback, true);
  assert.ok(decision.reasonCodes.includes("rollout.failure_rate_exceeded"));
  assert.ok(decision.reasonCodes.includes("rollout.latency_multiplier_exceeded"));
  assert.equal(decision.reasonCodes.length, 2);
});

test("AutoRollbackService handles missing observationWindowMs in metrics", () => {
  const service = new AutoRollbackService();
  const rollout = makeRolloutRecord({ status: "canary_5" });
  const metrics: RolloutMetrics = {
    requestCount: 100,
    failureRate: 0.01,
    p99LatencyMs: 150,
    baselineP99LatencyMs: 100,
  };

  const decision = service.evaluate(rollout, metrics);

  // Should use config minimumObservationWindowMs (60_000) since metrics.observationWindowMs is undefined
  assert.equal(decision.rollback, false);
});

test("AutoRollbackService evaluates stable status rollout", () => {
  const service = new AutoRollbackService();
  const rollout = makeRolloutRecord({ status: "stable" });
  const metrics = makeMetrics({
    requestCount: 500,
    failureRate: 0.001,
    p99LatencyMs: 110,
    baselineP99LatencyMs: 100,
  });

  const decision = service.evaluate(rollout, metrics);

  assert.equal(decision.rollback, false);
});
