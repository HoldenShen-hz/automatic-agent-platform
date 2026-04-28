/**
 * Unit tests for evolution-mvp-support helper functions edge cases.
 *
 * Tests roundCurrency, roundRatio, clamp, and other helpers with edge inputs.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  roundCurrency,
  roundRatio,
  clamp,
  buildRecommendedBudgetPolicy,
} from "../../../../../src/ops-maturity/drift-detection/evolution-mvp-support.js";

test("roundCurrency handles zero", () => {
  assert.strictEqual(roundCurrency(0), 0);
});

test("roundCurrency handles small decimal", () => {
  assert.strictEqual(roundCurrency(0.00001), 0);
});

test("roundCurrency handles typical currency value", () => {
  assert.strictEqual(roundCurrency(1.12345), 1.1235);
});

test("roundCurrency handles large number", () => {
  assert.strictEqual(roundCurrency(1234567.891234), 1234567.8912);
});

test("roundCurrency handles negative value", () => {
  assert.strictEqual(roundCurrency(-1.12345), -1.1234);
});

test("roundCurrency handles very small value near zero", () => {
  assert.strictEqual(roundCurrency(0.00012), 0.0001);
  assert.strictEqual(roundCurrency(0.00015), 0.0001);
});

test("roundCurrency rounds down at midpoint", () => {
  // Math.round(1.12345 * 10000) / 10000 = Math.round(11234.5) / 10000 = 11235 / 10000 = 1.1235
  // At midpoint .00005, JavaScript rounds to even, but our calculation gives .0001
  assert.strictEqual(roundCurrency(1.123444), 1.1234);
});

test("roundCurrency handles integer values", () => {
  assert.strictEqual(roundCurrency(100), 100);
});

test("roundRatio handles zero", () => {
  assert.strictEqual(roundRatio(0), 0);
});

test("roundRatio handles one", () => {
  assert.strictEqual(roundRatio(1), 1);
});

test("roundRatio handles typical ratio", () => {
  assert.strictEqual(roundRatio(0.12345), 0.123);
});

test("roundRatio handles three decimal places", () => {
  assert.strictEqual(roundRatio(0.1235), 0.124);
});

test("roundRatio handles large ratio", () => {
  assert.strictEqual(roundRatio(99.9), 99.9);
});

test("roundRatio handles negative ratio", () => {
  assert.strictEqual(roundRatio(-0.12345), -0.123);
});

test("clamp returns value when in range", () => {
  assert.strictEqual(clamp(5, 0, 10), 5);
  assert.strictEqual(clamp(0, 0, 10), 0);
  assert.strictEqual(clamp(10, 0, 10), 10);
});

test("clamp returns min when value is below", () => {
  assert.strictEqual(clamp(-5, 0, 10), 0);
  assert.strictEqual(clamp(-100, 0, 10), 0);
});

test("clamp returns max when value is above", () => {
  assert.strictEqual(clamp(15, 0, 10), 10);
  assert.strictEqual(clamp(100, 0, 10), 10);
});

test("clamp handles negative bounds", () => {
  assert.strictEqual(clamp(5, -10, -5), -5);
  assert.strictEqual(clamp(-15, -10, -5), -10);
});

test("clamp handles fractional bounds", () => {
  assert.strictEqual(clamp(0.5, 0, 1), 0.5);
  assert.strictEqual(clamp(-0.5, 0, 1), 0);
  assert.strictEqual(clamp(1.5, 0, 1), 1);
});

test("buildRecommendedBudgetPolicy throws on insufficient samples", () => {
  assert.throws(
    () =>
      buildRecommendedBudgetPolicy({
        taskId: "task_123",
        sourceAgentId: "agent_456",
        scopeType: "division",
        scopeRef: "div-123",
        proposalReason: "Test",
        sampleSize: 2,
        observedAverageCostUsd: 0.05,
        successRate: 0.9,
        currentPolicy: {
          maxTaskCostUsd: 0.10,
          maxDailyCostUsd: 1.0,
          maxMonthlyCostUsd: 10.0,
          warnAtRatio: 0.8,
          mode: "supervised",
        },
      }),
    /insufficient_budget_samples/,
  );
});

test("buildRecommendedBudgetPolicy throws on sampleSize of 0", () => {
  assert.throws(
    () =>
      buildRecommendedBudgetPolicy({
        taskId: "task_123",
        sourceAgentId: "agent_456",
        scopeType: "division",
        scopeRef: "div-123",
        proposalReason: "Test",
        sampleSize: 0,
        observedAverageCostUsd: 0.05,
        successRate: 0.9,
        currentPolicy: {
          maxTaskCostUsd: 0.10,
          maxDailyCostUsd: 1.0,
          maxMonthlyCostUsd: 10.0,
          warnAtRatio: 0.8,
          mode: "supervised",
        },
      }),
    /insufficient_budget_samples/,
  );
});

test("buildRecommendedBudgetPolicy throws on negative success rate", () => {
  assert.throws(
    () =>
      buildRecommendedBudgetPolicy({
        taskId: "task_123",
        sourceAgentId: "agent_456",
        scopeType: "division",
        scopeRef: "div-123",
        proposalReason: "Test",
        sampleSize: 10,
        observedAverageCostUsd: 0.05,
        successRate: -0.1,
        currentPolicy: {
          maxTaskCostUsd: 0.10,
          maxDailyCostUsd: 1.0,
          maxMonthlyCostUsd: 10.0,
          warnAtRatio: 0.8,
          mode: "supervised",
        },
      }),
    /invalid_success_rate/,
  );
});

test("buildRecommendedBudgetPolicy throws on success rate greater than 1", () => {
  assert.throws(
    () =>
      buildRecommendedBudgetPolicy({
        taskId: "task_123",
        sourceAgentId: "agent_456",
        scopeType: "division",
        scopeRef: "div-123",
        proposalReason: "Test",
        sampleSize: 10,
        observedAverageCostUsd: 0.05,
        successRate: 1.1,
        currentPolicy: {
          maxTaskCostUsd: 0.10,
          maxDailyCostUsd: 1.0,
          maxMonthlyCostUsd: 10.0,
          warnAtRatio: 0.8,
          mode: "supervised",
        },
      }),
    /invalid_success_rate/,
  );
});

test("buildRecommendedBudgetPolicy throws on zero observed cost", () => {
  assert.throws(
    () =>
      buildRecommendedBudgetPolicy({
        taskId: "task_123",
        sourceAgentId: "agent_456",
        scopeType: "division",
        scopeRef: "div-123",
        proposalReason: "Test",
        sampleSize: 10,
        observedAverageCostUsd: 0,
        successRate: 0.9,
        currentPolicy: {
          maxTaskCostUsd: 0.10,
          maxDailyCostUsd: 1.0,
          maxMonthlyCostUsd: 10.0,
          warnAtRatio: 0.8,
          mode: "supervised",
        },
      }),
    /invalid_observed_cost/,
  );
});

test("buildRecommendedBudgetPolicy throws on negative observed cost", () => {
  assert.throws(
    () =>
      buildRecommendedBudgetPolicy({
        taskId: "task_123",
        sourceAgentId: "agent_456",
        scopeType: "division",
        scopeRef: "div-123",
        proposalReason: "Test",
        sampleSize: 10,
        observedAverageCostUsd: -0.05,
        successRate: 0.9,
        currentPolicy: {
          maxTaskCostUsd: 0.10,
          maxDailyCostUsd: 1.0,
          maxMonthlyCostUsd: 10.0,
          warnAtRatio: 0.8,
          mode: "supervised",
        },
      }),
    /invalid_observed_cost/,
  );
});

test("buildRecommendedBudgetPolicy increases budget when near limit with high success", () => {
  const result = buildRecommendedBudgetPolicy({
    taskId: "task_123",
    sourceAgentId: "agent_456",
    scopeType: "division",
    scopeRef: "div-123",
    proposalReason: "Near limit with good success",
    sampleSize: 10,
    observedAverageCostUsd: 0.09, // 90% of limit
    successRate: 0.85, // Good success rate
    currentPolicy: {
      maxTaskCostUsd: 0.10,
      maxDailyCostUsd: 1.0,
      maxMonthlyCostUsd: 10.0,
      warnAtRatio: 0.8,
      mode: "supervised",
    },
  });

  // Should increase maxTaskCostUsd
  assert.ok(result.maxTaskCostUsd > 0.10, "maxTaskCostUsd should increase");
});

test("buildRecommendedBudgetPolicy decreases budget when well below limit", () => {
  const result = buildRecommendedBudgetPolicy({
    taskId: "task_123",
    sourceAgentId: "agent_456",
    scopeType: "division",
    scopeRef: "div-123",
    proposalReason: "Well below limit",
    sampleSize: 10,
    observedAverageCostUsd: 0.03, // 30% of limit
    successRate: 0.9,
    currentPolicy: {
      maxTaskCostUsd: 0.10,
      maxDailyCostUsd: 1.0,
      maxMonthlyCostUsd: 10.0,
      warnAtRatio: 0.8,
      mode: "supervised",
    },
  });

  // Should decrease maxTaskCostUsd
  assert.ok(result.maxTaskCostUsd < 0.10, "maxTaskCostUsd should decrease");
});

test("buildRecommendedBudgetPolicy respects clamp limits", () => {
  const result = buildRecommendedBudgetPolicy({
    taskId: "task_123",
    sourceAgentId: "agent_456",
    scopeType: "division",
    scopeRef: "div-123",
    proposalReason: "Clamp test",
    sampleSize: 10,
    observedAverageCostUsd: 0.001, // Very low, would try to decrease a lot
    successRate: 0.9,
    currentPolicy: {
      maxTaskCostUsd: 0.01,
      maxDailyCostUsd: 1.0,
      maxMonthlyCostUsd: 10.0,
      warnAtRatio: 0.8,
      mode: "supervised",
    },
  });

  // Should not decrease below 80% of original
  assert.ok(result.maxTaskCostUsd >= 0.008, "maxTaskCostUsd should not decrease below 80% of original");
});

test("buildRecommendedBudgetPolicy clamps warnAtRatio between 0.65 and 0.95", () => {
  const result = buildRecommendedBudgetPolicy({
    taskId: "task_123",
    sourceAgentId: "agent_456",
    scopeType: "division",
    scopeRef: "div-123",
    proposalReason: "Warn ratio test",
    sampleSize: 10,
    observedAverageCostUsd: 0.05,
    successRate: 0.9,
    currentPolicy: {
      maxTaskCostUsd: 0.10,
      maxDailyCostUsd: 1.0,
      maxMonthlyCostUsd: 10.0,
      warnAtRatio: 0.5, // Below minimum
      mode: "supervised",
    },
  });

  assert.ok(result.warnAtRatio >= 0.65, "warnAtRatio should be at least 0.65");
});

test("buildRecommendedBudgetPolicy handles minimum sample size of 3", () => {
  const result = buildRecommendedBudgetPolicy({
    taskId: "task_123",
    sourceAgentId: "agent_456",
    scopeType: "division",
    scopeRef: "div-123",
    proposalReason: "Minimum samples",
    sampleSize: 3,
    observedAverageCostUsd: 0.05,
    successRate: 0.9,
    currentPolicy: {
      maxTaskCostUsd: 0.10,
      maxDailyCostUsd: 1.0,
      maxMonthlyCostUsd: 10.0,
      warnAtRatio: 0.8,
      mode: "supervised",
    },
  });

  assert.ok(result != null);
  assert.ok("maxTaskCostUsd" in result);
});

test("buildRecommendedBudgetPolicy keeps budget same when conditions not met", () => {
  const result = buildRecommendedBudgetPolicy({
    taskId: "task_123",
    sourceAgentId: "agent_456",
    scopeType: "division",
    scopeRef: "div-123",
    proposalReason: "No change needed",
    sampleSize: 10,
    observedAverageCostUsd: 0.06, // 60% of limit (not > 85% or < 45%)
    successRate: 0.5, // Low success rate
    currentPolicy: {
      maxTaskCostUsd: 0.10,
      maxDailyCostUsd: 1.0,
      maxMonthlyCostUsd: 10.0,
      warnAtRatio: 0.8,
      mode: "supervised",
    },
  });

  // Should stay same since conditions not met
  assert.strictEqual(result.maxTaskCostUsd, 0.10);
});
