import assert from "node:assert/strict";
import test from "node:test";

import {
  roundCurrency,
  roundRatio,
  clamp,
  summarizeBudgetProposal,
  buildRecommendedBudgetPolicy,
} from "../../../../src/ops-maturity/drift-detection/evolution-mvp-support.js";

test("roundCurrency rounds to 4 decimal places", () => {
  assert.equal(roundCurrency(1.12345), 1.1235);
  assert.equal(roundCurrency(1.12344), 1.1234);
  assert.equal(roundCurrency(1.123456789), 1.1235);
});

test("roundCurrency handles integers", () => {
  assert.equal(roundCurrency(100), 100);
});

test("roundCurrency handles negative numbers", () => {
  // Math.round rounds toward +Infinity for both positive and negative
  // -1.12345 * 10000 = -11234.5 -> Math.round(-11234.5) = -11234 -> /10000 = -1.1234
  assert.equal(roundCurrency(-1.12345), -1.1234);
});

test("roundCurrency handles zero", () => {
  assert.equal(roundCurrency(0), 0);
});

test("roundRatio rounds to 3 decimal places", () => {
  assert.equal(roundRatio(1.12345), 1.123);
  assert.equal(roundRatio(1.12344), 1.123);
  assert.equal(roundRatio(1.123456), 1.123);
});

test("roundRatio handles integers", () => {
  assert.equal(roundRatio(100), 100);
});

test("roundRatio handles negative numbers", () => {
  assert.equal(roundRatio(-1.12345), -1.123);
});

test("clamp returns value when within range", () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(0, 0, 10), 0);
  assert.equal(clamp(10, 0, 10), 10);
});

test("clamp returns min when value is below", () => {
  assert.equal(clamp(-5, 0, 10), 0);
  assert.equal(clamp(-100, 0, 10), 0);
});

test("clamp returns max when value is above", () => {
  assert.equal(clamp(15, 0, 10), 10);
  assert.equal(clamp(100, 0, 10), 10);
});

test("clamp handles floating point values", () => {
  assert.equal(clamp(0.5, 0, 1), 0.5);
  assert.equal(clamp(0.25, 0.5, 1), 0.5);
  assert.equal(clamp(1.5, 0, 1), 1);
});

test("summarizeBudgetProposal generates correct summary", () => {
  const summary = summarizeBudgetProposal(
    "division",
    "div-123",
    {
      sampleSize: 10,
      observedAverageCostUsd: 0.05,
      successRate: 0.95,
      currentPolicy: {
        maxTaskCostUsd: 0.10,
        maxDailyCostUsd: 1.0,
        maxMonthlyCostUsd: 10.0,
        warnAtRatio: 0.8,
        mode: "supervised",
      },
      recommendedPolicy: {
        maxTaskCostUsd: 0.12,
        maxDailyCostUsd: 1.2,
        maxMonthlyCostUsd: 12.0,
        warnAtRatio: 0.85,
        mode: "supervised",
      },
      proposalReason: "Normal adjustment",
    }
  );

  assert.ok(summary.includes("division:div-123"));
  assert.ok(summary.includes("0.0500 USD"));
  assert.ok(summary.includes("10 samples"));
  assert.ok(summary.includes("0.1000 -> 0.1200"));
});

test("buildRecommendedBudgetPolicy throws for sampleSize < 3", () => {
  assert.throws(
    () =>
      buildRecommendedBudgetPolicy({
        taskId: "task_123",
        sourceAgentId: "agent_456",
        scopeType: "division",
        scopeRef: "tenant-789",
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
    (e: unknown) => (e as Error)?.message?.includes("insufficient_budget_samples")
  );
});

test("buildRecommendedBudgetPolicy throws for invalid successRate", () => {
  assert.throws(
    () =>
      buildRecommendedBudgetPolicy({
        taskId: "task_123",
        sourceAgentId: "agent_456",
        scopeType: "division",
        scopeRef: "tenant-789",
        proposalReason: "Test",
        sampleSize: 10,
        observedAverageCostUsd: 0.05,
        successRate: 1.5,
        currentPolicy: {
          maxTaskCostUsd: 0.10,
          maxDailyCostUsd: 1.0,
          maxMonthlyCostUsd: 10.0,
          warnAtRatio: 0.8,
          mode: "supervised",
        },
      }),
    (e: unknown) => (e as Error)?.message?.includes("invalid_success_rate")
  );
});

test("buildRecommendedBudgetPolicy throws for zero observed cost", () => {
  assert.throws(
    () =>
      buildRecommendedBudgetPolicy({
        taskId: "task_123",
        sourceAgentId: "agent_456",
        scopeType: "division",
        scopeRef: "tenant-789",
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
    (e: unknown) => (e as Error)?.message?.includes("invalid_observed_cost")
  );
});

test("buildRecommendedBudgetPolicy increases limit when near threshold", () => {
  const result = buildRecommendedBudgetPolicy({
    taskId: "task_123",
    sourceAgentId: "agent_456",
    scopeType: "division",
    scopeRef: "tenant-789",
    proposalReason: "Test",
    sampleSize: 10,
    observedAverageCostUsd: 0.09, // 90% of current limit
    successRate: 0.7,
    currentPolicy: {
      maxTaskCostUsd: 0.10,
      maxDailyCostUsd: 1.0,
      maxMonthlyCostUsd: 10.0,
      warnAtRatio: 0.8,
      mode: "supervised",
    },
  });

  // Should increase maxTaskCostUsd
  assert.ok(result.maxTaskCostUsd >= 0.10);
});

test("buildRecommendedBudgetPolicy decreases limit when well below", () => {
  const result = buildRecommendedBudgetPolicy({
    taskId: "task_123",
    sourceAgentId: "agent_456",
    scopeType: "division",
    scopeRef: "tenant-789",
    proposalReason: "Test",
    sampleSize: 10,
    observedAverageCostUsd: 0.04, // 40% of current limit
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
  assert.ok(result.maxTaskCostUsd <= 0.10);
});

test("buildRecommendedBudgetPolicy clamps warnAtRatio to valid range", () => {
  const result = buildRecommendedBudgetPolicy({
    taskId: "task_123",
    sourceAgentId: "agent_456",
    scopeType: "division",
    scopeRef: "tenant-789",
    proposalReason: "Test",
    sampleSize: 10,
    observedAverageCostUsd: 0.05,
    successRate: 0.9,
    currentPolicy: {
      maxTaskCostUsd: 0.10,
      maxDailyCostUsd: 1.0,
      maxMonthlyCostUsd: 10.0,
      warnAtRatio: 0.99, // Too high, should be clamped
      mode: "supervised",
    },
  });

  assert.ok(result.warnAtRatio <= 0.95);
  assert.ok(result.warnAtRatio >= 0.65);
});
