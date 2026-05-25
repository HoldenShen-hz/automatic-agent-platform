import assert from "node:assert/strict";
import test from "node:test";

import {
  CANARY_STAGES,
  shouldPromoteCanary,
  getNextCanaryStage,
  shouldRollbackCanary,
  calculateTrafficSplit,
} from "../../../../../src/ops-maturity/agent-lifecycle/canary-controller/index.js";

test("CANARY_STAGES contains expected values", () => {
  assert.deepStrictEqual(CANARY_STAGES, [5, 20, 50, 100]);
});

test("shouldPromoteCanary returns true when all criteria met", () => {
  const progress = {
    rolloutPercent: 30,
    successRate: 0.995,
    latencyP50Ms: 500,
    errorRate: 0.005,
    currentStage: 20 as const,
  };

  const result = shouldPromoteCanary(progress);

  assert.equal(result, true);
});

test("shouldPromoteCanary returns false when rollout too low", () => {
  const progress = {
    rolloutPercent: 10,
    successRate: 0.995,
    latencyP50Ms: 500,
    errorRate: 0.005,
    currentStage: 5 as const,
  };

  const result = shouldPromoteCanary(progress);

  assert.equal(result, false);
});

test("shouldPromoteCanary returns false when success rate too low", () => {
  const progress = {
    rolloutPercent: 30,
    successRate: 0.98,
    latencyP50Ms: 500,
    errorRate: 0.005,
    currentStage: 20 as const,
  };

  const result = shouldPromoteCanary(progress);

  assert.equal(result, false);
});

test("shouldPromoteCanary returns false when error rate too high", () => {
  const progress = {
    rolloutPercent: 30,
    successRate: 0.995,
    latencyP50Ms: 500,
    errorRate: 0.02,
    currentStage: 20 as const,
  };

  const result = shouldPromoteCanary(progress);

  assert.equal(result, false);
});

test("shouldPromoteCanary returns false when any required metric is missing or non-finite", () => {
  const progress = {
    rolloutPercent: 30,
    successRate: Number.NaN,
    latencyP50Ms: 500,
    errorRate: 0.005,
    currentStage: 20 as const,
  };

  assert.equal(shouldPromoteCanary(progress), false);
});

test("getNextCanaryStage returns next stage below current percent", () => {
  assert.equal(getNextCanaryStage(0), 5);
  assert.equal(getNextCanaryStage(10), 20);
  assert.equal(getNextCanaryStage(25), 50);
  assert.equal(getNextCanaryStage(75), 100);
});

test("getNextCanaryStage returns null when at 100%", () => {
  assert.equal(getNextCanaryStage(100), null);
});

test("shouldRollbackCanary returns true when error rate exceeds promotion ceiling", () => {
  const progress = {
    rolloutPercent: 20,
    successRate: 0.95,
    latencyP50Ms: 500,
    errorRate: 0.02,
    currentStage: 20 as const,
  };

  assert.equal(shouldRollbackCanary(progress), true);
});

test("shouldRollbackCanary returns true when success rate drops below promotion floor", () => {
  const progress = {
    rolloutPercent: 20,
    successRate: 0.98,
    latencyP50Ms: 500,
    errorRate: 0.01,
    currentStage: 20 as const,
  };

  assert.equal(shouldRollbackCanary(progress), true);
});

test("shouldRollbackCanary returns false when metrics are acceptable", () => {
  const progress = {
    rolloutPercent: 20,
    successRate: 0.995,
    latencyP50Ms: 500,
    errorRate: 0.005,
    currentStage: 20 as const,
  };

  assert.equal(shouldRollbackCanary(progress), false);
});

test("shouldRollbackCanary returns true when latency exceeds promotion ceiling", () => {
  const progress = {
    rolloutPercent: 20,
    successRate: 0.995,
    latencyP50Ms: 2500,
    errorRate: 0.005,
    currentStage: 20 as const,
  };

  assert.equal(shouldRollbackCanary(progress), true);
});

test("calculateTrafficSplit returns correct percentages", () => {
  const result = calculateTrafficSplit(20);

  assert.equal(result.canaryPercent, 20);
  assert.equal(result.stablePercent, 80);
});

test("calculateTrafficSplit rejects invalid canary stages", () => {
  assert.throws(
    () => calculateTrafficSplit(10 as 5),
    /invalid_canary_stage:10/,
  );
});
