import assert from "node:assert/strict";
import test from "node:test";

import { AutoRollbackService, type RolloutMetrics } from "../../../../../src/platform/orchestration/improve-rollout/auto-rollback-service.js";
import type { RolloutRecord } from "../../../../../src/platform/orchestration/oapeflir/types/rollout-record.js";

function createMockRolloutRecord(overrides: Partial<RolloutRecord> = {}): RolloutRecord {
  return {
    recordId: "rollout-1",
    candidateId: "candidate-1",
    level: "canary_5",
    previousLevel: "shadow",
    strategyVersionId: "strategy-v1",
    status: "canary_5",
    transitionedAt: Date.now() - 300_000,
    approvedBy: "approver-1",
    guardrailReasonCodes: [],
    evidence: [],
    ...overrides,
  } as RolloutRecord;
}

function createMetrics(overrides: Partial<RolloutMetrics> = {}): RolloutMetrics {
  return {
    requestCount: 100,
    failureRate: 0.01,
    p99LatencyMs: 200,
    baselineP99LatencyMs: 150,
    observationWindowMs: 120_000,
    ...overrides,
  };
}

test("AutoRollbackService evaluate returns rollback=false with sufficient metrics", () => {
  const service = new AutoRollbackService();
  const metrics = createMetrics();

  const decision = service.evaluate(createMockRolloutRecord(), metrics);

  assert.equal(decision.rollback, false);
  assert.ok(decision.reasonCodes.length === 0);
});

test("AutoRollbackService evaluate triggers rollback when failure rate exceeds threshold", () => {
  const service = new AutoRollbackService({ maxFailureRate: 0.05 });
  const metrics = createMetrics({ failureRate: 0.10 });

  const decision = service.evaluate(createMockRolloutRecord(), metrics);

  assert.equal(decision.rollback, true);
  assert.ok(decision.reasonCodes.includes("rollout.failure_rate_exceeded"));
});

test("AutoRollbackService evaluate triggers rollback when latency multiplier exceeds threshold", () => {
  const service = new AutoRollbackService({ maxLatencyMultiplier: 2.0 });
  const metrics = createMetrics({
    p99LatencyMs: 400,
    baselineP99LatencyMs: 150,
  });

  const decision = service.evaluate(createMockRolloutRecord(), metrics);

  assert.equal(decision.rollback, true);
  assert.ok(decision.reasonCodes.includes("rollout.latency_multiplier_exceeded"));
});

test("AutoRollbackService evaluate returns insufficient sample when requestCount is too low", () => {
  const service = new AutoRollbackService({ minimumRequestCount: 100 });
  const metrics = createMetrics({ requestCount: 50 });

  const decision = service.evaluate(createMockRolloutRecord(), metrics);

  assert.equal(decision.rollback, false);
  assert.ok(decision.reasonCodes.includes("rollout.metrics_insufficient_sample"));
});

test("AutoRollbackService evaluate returns insufficient window when observation window is too short", () => {
  const service = new AutoRollbackService({ minimumObservationWindowMs: 120_000 });
  const metrics = createMetrics({ observationWindowMs: 60_000 });

  const decision = service.evaluate(createMockRolloutRecord(), metrics);

  assert.equal(decision.rollback, false);
  assert.ok(decision.reasonCodes.includes("rollout.metrics_insufficient_window"));
});

test("AutoRollbackService uses default config when no overrides provided", () => {
  const service = new AutoRollbackService();
  const metrics = createMetrics({
    requestCount: 100,
    failureRate: 0.10,
    p99LatencyMs: 1000,
    baselineP99LatencyMs: 100,
  });

  const decision = service.evaluate(createMockRolloutRecord(), metrics);

  assert.equal(decision.rollback, true);
  assert.ok(decision.reasonCodes.includes("rollout.failure_rate_exceeded"));
  assert.ok(decision.reasonCodes.includes("rollout.latency_multiplier_exceeded"));
});

test("AutoRollbackService evaluate handles zero baseline latency", () => {
  const service = new AutoRollbackService();
  const metrics = createMetrics({
    baselineP99LatencyMs: 0,
    p99LatencyMs: 100,
  });

  const decision = service.evaluate(createMockRolloutRecord(), metrics);

  // Zero baseline becomes 1, so 100/1 = 100 > 2 (maxLatencyMultiplier), triggers rollback
  assert.equal(decision.rollback, true);
  assert.ok(decision.reasonCodes.includes("rollout.latency_multiplier_exceeded"));
});

test("AutoRollbackService evaluate triggers rollback with both failure and latency violations", () => {
  const service = new AutoRollbackService({
    maxFailureRate: 0.03,
    maxLatencyMultiplier: 1.5,
  });
  const metrics = createMetrics({
    failureRate: 0.05,
    p99LatencyMs: 400,
    baselineP99LatencyMs: 200,
  });

  const decision = service.evaluate(createMockRolloutRecord(), metrics);

  assert.equal(decision.rollback, true);
  assert.ok(decision.reasonCodes.includes("rollout.failure_rate_exceeded"));
  assert.ok(decision.reasonCodes.includes("rollout.latency_multiplier_exceeded"));
  assert.equal(decision.reasonCodes.length, 2);
});

test("AutoRollbackService evaluate accepts exact threshold values as pass", () => {
  const service = new AutoRollbackService({ maxFailureRate: 0.05 });
  const metrics = createMetrics({ failureRate: 0.05 });

  const decision = service.evaluate(createMockRolloutRecord(), metrics);

  assert.equal(decision.rollback, false);
});

test("AutoRollbackService evaluate accepts below threshold latency multiplier", () => {
  const service = new AutoRollbackService({ maxLatencyMultiplier: 2.0 });
  const metrics = createMetrics({
    p99LatencyMs: 300,
    baselineP99LatencyMs: 200,
  });

  const decision = service.evaluate(createMockRolloutRecord(), metrics);

  assert.equal(decision.rollback, false);
});

test("AutoRollbackService evaluate handles missing observationWindowMs using default", () => {
  const service = new AutoRollbackService({ minimumObservationWindowMs: 60_000 });
  const { observationWindowMs: _observationWindowMs, ...metrics } = createMetrics();

  const decision = service.evaluate(createMockRolloutRecord(), metrics);

  // When observationWindowMs is undefined, it uses config.minimumObservationWindowMs
  // which equals the threshold, so it doesn't fail the check
  assert.equal(decision.rollback, false);
  assert.ok(!decision.reasonCodes.includes("rollout.metrics_insufficient_window"));
});

test("AutoRollbackService partial config override preserves defaults", () => {
  const service = new AutoRollbackService({ maxFailureRate: 0.02 });
  const metrics = createMetrics({
    failureRate: 0.03,
    p99LatencyMs: 100,
    baselineP99LatencyMs: 200,
  });

  const decision = service.evaluate(createMockRolloutRecord(), metrics);

  assert.equal(decision.rollback, true);
  assert.ok(decision.reasonCodes.includes("rollout.failure_rate_exceeded"));
});

test("AutoRollbackService with zero minimumRequestCount accepts any count", () => {
  const service = new AutoRollbackService({ minimumRequestCount: 0 });
  const metrics = createMetrics({ requestCount: 1 });

  const decision = service.evaluate(createMockRolloutRecord(), metrics);

  assert.ok(!decision.reasonCodes.includes("rollout.metrics_insufficient_sample"));
});

test("AutoRollbackService evaluate returns both violations when both thresholds exceeded", () => {
  const service = new AutoRollbackService({
    maxFailureRate: 0.01,
    maxLatencyMultiplier: 1.5,
  });
  const metrics = createMetrics({
    requestCount: 200,
    failureRate: 0.05,
    p99LatencyMs: 400,
    baselineP99LatencyMs: 200,
    observationWindowMs: 120_000,
  });

  const decision = service.evaluate(createMockRolloutRecord(), metrics);

  assert.equal(decision.rollback, true);
  assert.ok(decision.reasonCodes.includes("rollout.failure_rate_exceeded"));
  assert.ok(decision.reasonCodes.includes("rollout.latency_multiplier_exceeded"));
});

test("AutoRollbackService evaluate with very high minimumRequestCount", () => {
  const service = new AutoRollbackService({ minimumRequestCount: 1000 });
  const metrics = createMetrics({ requestCount: 999 });

  const decision = service.evaluate(createMockRolloutRecord(), metrics);

  assert.equal(decision.rollback, false);
  assert.ok(decision.reasonCodes.includes("rollout.metrics_insufficient_sample"));
});

test("AutoRollbackService evaluate handles very small latency multiplier", () => {
  const service = new AutoRollbackService({ maxLatencyMultiplier: 1.01 });
  const metrics = createMetrics({
    p99LatencyMs: 205,
    baselineP99LatencyMs: 200,
  });

  const decision = service.evaluate(createMockRolloutRecord(), metrics);

  assert.equal(decision.rollback, true);
  assert.ok(decision.reasonCodes.includes("rollout.latency_multiplier_exceeded"));
});
