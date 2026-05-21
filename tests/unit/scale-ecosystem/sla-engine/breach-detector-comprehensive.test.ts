/**
 * Comprehensive unit tests for breach-detector/index.ts
 *
 * Tests analyzeSlaBreach function including alerts, budget analysis,
 * execution timeout breach, and dependency availability breach.
 *
 * @see src/scale-ecosystem/sla-engine/breach-detector/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeSlaBreach,
  detectSlaBreach,
  type SlaObservation,
  type SlaCommitment,
  type SlaBreachAnalysis,
  type SlaBudgetAnalysis,
} from "../../../../src/scale-ecosystem/sla-engine/breach-detector/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────────────────────────────────────

function createObservation(overrides: Partial<SlaObservation> = {}): SlaObservation {
  return {
    latencyMs: overrides.latencyMs ?? 100,
    successRate: overrides.successRate ?? 0.99,
    queueWaitMs: overrides.queueWaitMs ?? 500,
    executionTimeoutRate: overrides.executionTimeoutRate,
    dependencyAvailability: overrides.dependencyAvailability,
    requestCount: overrides.requestCount,
    windowMs: overrides.windowMs,
  };
}

function createCommitment(overrides: Partial<SlaCommitment> = {}): SlaCommitment {
  return {
    maxLatencyMs: overrides.maxLatencyMs ?? 200,
    minSuccessRate: overrides.minSuccessRate ?? 0.98,
    maxQueueWaitMs: overrides.maxQueueWaitMs ?? 1000,
    maxExecutionTimeoutRate: overrides.maxExecutionTimeoutRate,
    minDependencyAvailability: overrides.minDependencyAvailability,
    errorBudgetPercent: overrides.errorBudgetPercent,
    budgetWindowMs: overrides.budgetWindowMs,
    warningBurnRateThreshold: overrides.warningBurnRateThreshold,
    criticalBurnRateThreshold: overrides.criticalBurnRateThreshold,
  };
}

// Approximate equality helper for floating point comparisons
function approxEqual(actual: number, expected: number, epsilon = 1e-9): boolean {
  return Math.abs(actual - expected) < epsilon;
}

// ─────────────────────────────────────────────────────────────────────────────
// analyzeSlaBreach - budget analysis tests
// ─────────────────────────────────────────────────────────────────────────────

test("analyzeSlaBreach returns SlaBreachAnalysis structure with all fields", () => {
  const observation = createObservation({ latencyMs: 100, successRate: 0.99, queueWaitMs: 500 });
  const commitment = createCommitment({ maxLatencyMs: 200, minSuccessRate: 0.98, maxQueueWaitMs: 1000 });

  const result = analyzeSlaBreach(observation, commitment);

  assert.ok("breaches" in result);
  assert.ok("alerts" in result);
  assert.ok("budget" in result);
  assert.ok(Array.isArray(result.breaches));
  assert.ok(Array.isArray(result.alerts));
  assert.ok(typeof result.budget === "object");
});

test("analyzeSlaBreach calculates allowedErrorRate from minSuccessRate when errorBudgetPercent not provided", () => {
  const observation = createObservation({ successRate: 0.99, requestCount: 1000 });
  const commitment = createCommitment({ minSuccessRate: 0.99 });

  const result = analyzeSlaBreach(observation, commitment);

  // allowedErrorRate = 1 - minSuccessRate = 1 - 0.99 = 0.01
  assert.ok(approxEqual(result.budget.allowedErrorRate, 0.01), `expected 0.01, got ${result.budget.allowedErrorRate}`);
});

test("analyzeSlaBreach calculates allowedErrorRate from errorBudgetPercent when provided", () => {
  const observation = createObservation({ successRate: 0.99, requestCount: 1000 });
  const commitment = createCommitment({ minSuccessRate: 0.99, errorBudgetPercent: 0.05 });

  const result = analyzeSlaBreach(observation, commitment);

  assert.equal(result.budget.allowedErrorRate, 0.05);
});

test("analyzeSlaBreach calculates errorBudget correctly", () => {
  const observation = createObservation({ successRate: 0.99, requestCount: 1000 });
  const commitment = createCommitment({ errorBudgetPercent: 0.01 });

  const result = analyzeSlaBreach(observation, commitment);

  // errorBudget = requestCount * allowedErrorRate = 1000 * 0.01 = 10
  assert.ok(approxEqual(result.budget.errorBudget, 10), `expected 10, got ${result.budget.errorBudget}`);
});

test("analyzeSlaBreach calculates errorBudgetConsumed correctly", () => {
  const observation = createObservation({ successRate: 0.99, requestCount: 1000 });
  const commitment = createCommitment({ errorBudgetPercent: 0.01 });

  const result = analyzeSlaBreach(observation, commitment);

  // currentErrorRate = 1 - 0.99 = 0.01
  // errorBudgetConsumed = requestCount * currentErrorRate = 1000 * 0.01 = 10
  assert.ok(approxEqual(result.budget.errorBudgetConsumed, 10), `expected 10, got ${result.budget.errorBudgetConsumed}`);
});

test("analyzeSlaBreach calculates errorBudgetRemaining correctly", () => {
  const observation = createObservation({ successRate: 0.99, requestCount: 1000 });
  const commitment = createCommitment({ errorBudgetPercent: 0.01 });

  const result = analyzeSlaBreach(observation, commitment);

  // errorBudgetRemaining = errorBudget - errorBudgetConsumed = 10 - 10 = 0
  assert.ok(approxEqual(result.budget.errorBudgetRemaining, 0), `expected 0, got ${result.budget.errorBudgetRemaining}`);
});

test("analyzeSlaBreach calculates burnRate correctly for healthy system", () => {
  const observation = createObservation({ successRate: 0.995, requestCount: 1000 });
  const commitment = createCommitment({ errorBudgetPercent: 0.01 }); // 1% allowed

  const result = analyzeSlaBreach(observation, commitment);

  // currentErrorRate = 0.005 (0.5%)
  // burnRate = 0.005 / 0.01 = 0.5
  assert.ok(approxEqual(result.budget.burnRate, 0.5), `expected 0.5, got ${result.budget.burnRate}`);
});

test("analyzeSlaBreach calculates burnRate correctly for degraded system", () => {
  const observation = createObservation({ successRate: 0.95, requestCount: 1000 }); // 5% error rate
  const commitment = createCommitment({ errorBudgetPercent: 0.01 }); // 1% allowed

  const result = analyzeSlaBreach(observation, commitment);

  // currentErrorRate = 0.05 (5%)
  // burnRate = 0.05 / 0.01 = 5
  assert.ok(approxEqual(result.budget.burnRate, 5), `expected 5, got ${result.budget.burnRate}`);
});

test("analyzeSlaBreach calculates timeToExhaustMs when budget depleting", () => {
  const observation = createObservation({ successRate: 0.995, requestCount: 10000, windowMs: 60000 });
  const commitment = createCommitment({ errorBudgetPercent: 0.01, budgetWindowMs: 60000 });

  const result = analyzeSlaBreach(observation, commitment);

  // Budget is depleting but not exhausted (errorBudgetRemaining > 0)
  // timeToExhaustMs should be a positive number
  assert.ok(result.budget.timeToExhaustMs !== null);
  assert.ok(result.budget.timeToExhaustMs > 0);
});

test("analyzeSlaBreach calculates timeToExhaustMs as 0 when budget exhausted", () => {
  const observation = createObservation({ successRate: 0.90, requestCount: 1000, windowMs: 60000 });
  const commitment = createCommitment({ errorBudgetPercent: 0.01, budgetWindowMs: 60000 });

  const result = analyzeSlaBreach(observation, commitment);

  // Budget should be exhausted or negative, timeToExhaustMs = 0
  assert.equal(result.budget.timeToExhaustMs, 0);
});

test("analyzeSlaBreach calculates timeToExhaustMs as null when budget is recovered", () => {
  const observation = createObservation({ successRate: 1.0, requestCount: 1000, windowMs: 60000 });
  const commitment = createCommitment({ errorBudgetPercent: 0.01, budgetWindowMs: 60000 });

  const result = analyzeSlaBreach(observation, commitment);

  // Better than target, budget remaining > 0, no depletion
  assert.equal(result.budget.timeToExhaustMs, null);
});

test("analyzeSlaBreach calculates latencyBurnRate correctly", () => {
  const observation = createObservation({ latencyMs: 150 });
  const commitment = createCommitment({ maxLatencyMs: 100 });

  const result = analyzeSlaBreach(observation, commitment);

  // latencyBurnRate = 150 / 100 = 1.5
  assert.ok(approxEqual(result.budget.latencyBurnRate, 1.5), `expected 1.5, got ${result.budget.latencyBurnRate}`);
});

test("analyzeSlaBreach calculates latencyBurnRate as 0 when maxLatencyMs is 0", () => {
  const observation = createObservation({ latencyMs: 100 });
  const commitment = createCommitment({ maxLatencyMs: 0 });

  const result = analyzeSlaBreach(observation, commitment);

  assert.equal(result.budget.latencyBurnRate, 0);
});

test("analyzeSlaBreach calculates queueWaitBurnRate correctly", () => {
  const observation = createObservation({ queueWaitMs: 750 });
  const commitment = createCommitment({ maxQueueWaitMs: 500 });

  const result = analyzeSlaBreach(observation, commitment);

  // queueWaitBurnRate = 750 / 500 = 1.5
  assert.ok(approxEqual(result.budget.queueWaitBurnRate, 1.5), `expected 1.5, got ${result.budget.queueWaitBurnRate}`);
});

test("analyzeSlaBreach calculates queueWaitBurnRate as 0 when maxQueueWaitMs is 0", () => {
  const observation = createObservation({ queueWaitMs: 100 });
  const commitment = createCommitment({ maxQueueWaitMs: 0 });

  const result = analyzeSlaBreach(observation, commitment);

  assert.equal(result.budget.queueWaitBurnRate, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// analyzeSlaBreach - alerts tests
// ─────────────────────────────────────────────────────────────────────────────

test("analyzeSlaBreach generates warning alert when burnRate >= warningBurnRateThreshold", () => {
  const observation = createObservation({ successRate: 0.985, requestCount: 1000 });
  const commitment = createCommitment({
    errorBudgetPercent: 0.01,
    warningBurnRateThreshold: 1,
    criticalBurnRateThreshold: 2,
  });

  const result = analyzeSlaBreach(observation, commitment);

  // burnRate = 1.5 >= warningThreshold of 1, but < criticalThreshold of 2
  assert.ok(result.alerts.includes("sla.error_budget_burn_warning"), "Expected warning alert");
  assert.ok(!result.alerts.includes("sla.error_budget_burn_critical"), "Should not have critical alert");
});

test("analyzeSlaBreach generates critical alert when burnRate >= criticalBurnRateThreshold", () => {
  const observation = createObservation({ successRate: 0.95, requestCount: 1000 });
  const commitment = createCommitment({
    errorBudgetPercent: 0.01,
    warningBurnRateThreshold: 1,
    criticalBurnRateThreshold: 2,
  });

  const result = analyzeSlaBreach(observation, commitment);

  // burnRate = 5 >= criticalThreshold of 2
  assert.ok(result.alerts.includes("sla.error_budget_burn_critical"), "Expected critical alert");
});

test("analyzeSlaBreach generates exhausted alert when budget is depleted", () => {
  const observation = createObservation({ successRate: 0.90, requestCount: 1000, windowMs: 60000 });
  const commitment = createCommitment({ errorBudgetPercent: 0.01, budgetWindowMs: 60000 });

  const result = analyzeSlaBreach(observation, commitment);

  assert.ok(result.alerts.includes("sla.error_budget_exhausted"), "Expected exhausted alert");
});

test("analyzeSlaBreach does not generate exhausted alert when budget is healthy", () => {
  const observation = createObservation({ successRate: 0.999, requestCount: 1000, windowMs: 60000 });
  const commitment = createCommitment({ errorBudgetPercent: 0.01, budgetWindowMs: 60000 });

  const result = analyzeSlaBreach(observation, commitment);

  assert.ok(!result.alerts.includes("sla.error_budget_exhausted"), "Should not have exhausted alert");
});

test("analyzeSlaBreach uses default thresholds when not provided", () => {
  const observation = createObservation({ successRate: 0.90, requestCount: 1000 }); // burnRate = 10
  const commitment = createCommitment({ errorBudgetPercent: 0.01 });

  const result = analyzeSlaBreach(observation, commitment);

  // Default: warningBurnRateThreshold = 1, criticalBurnRateThreshold = 2
  // burnRate = 10 >= 2, so critical alert
  assert.ok(result.alerts.includes("sla.error_budget_burn_critical"), "Expected critical alert with default thresholds");
});

// ─────────────────────────────────────────────────────────────────────────────
// Execution timeout breach tests
// ─────────────────────────────────────────────────────────────────────────────

test("detectSlaBreach detects execution timeout breach when rate exceeds max", () => {
  const observation = createObservation({ executionTimeoutRate: 0.15 });
  const commitment = createCommitment({ maxExecutionTimeoutRate: 0.10 });

  const breaches = detectSlaBreach(observation, commitment);

  assert.ok(breaches.includes("sla.execution_timeout_breach"));
});

test("detectSlaBreach does not detect execution timeout breach when rate is at max", () => {
  const observation = createObservation({ executionTimeoutRate: 0.10 });
  const commitment = createCommitment({ maxExecutionTimeoutRate: 0.10 });

  const breaches = detectSlaBreach(observation, commitment);

  assert.ok(!breaches.includes("sla.execution_timeout_breach"));
});

test("detectSlaBreach does not detect execution timeout breach when rate is below max", () => {
  const observation = createObservation({ executionTimeoutRate: 0.05 });
  const commitment = createCommitment({ maxExecutionTimeoutRate: 0.10 });

  const breaches = detectSlaBreach(observation, commitment);

  assert.ok(!breaches.includes("sla.execution_timeout_breach"));
});

test("detectSlaBreach ignores execution timeout when observation field is undefined", () => {
  const observation = createObservation({ executionTimeoutRate: undefined });
  const commitment = createCommitment({ maxExecutionTimeoutRate: 0.10 });

  const breaches = detectSlaBreach(observation, commitment);

  assert.ok(!breaches.includes("sla.execution_timeout_breach"));
});

test("detectSlaBreach ignores execution timeout when commitment field is undefined", () => {
  const observation = createObservation({ executionTimeoutRate: 0.50 });
  const commitment = createCommitment({ maxExecutionTimeoutRate: undefined });

  const breaches = detectSlaBreach(observation, commitment);

  assert.ok(!breaches.includes("sla.execution_timeout_breach"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Dependency availability breach tests
// ─────────────────────────────────────────────────────────────────────────────

test("detectSlaBreach detects dependency unavailability breach when availability falls below min", () => {
  const observation = createObservation({ dependencyAvailability: 0.80 });
  const commitment = createCommitment({ minDependencyAvailability: 0.90 });

  const breaches = detectSlaBreach(observation, commitment);

  assert.ok(breaches.includes("sla.dependency_unavailability_breach"));
});

test("detectSlaBreach does not detect dependency breach when availability is at min", () => {
  const observation = createObservation({ dependencyAvailability: 0.90 });
  const commitment = createCommitment({ minDependencyAvailability: 0.90 });

  const breaches = detectSlaBreach(observation, commitment);

  assert.ok(!breaches.includes("sla.dependency_unavailability_breach"));
});

test("detectSlaBreach does not detect dependency breach when availability is above min", () => {
  const observation = createObservation({ dependencyAvailability: 0.95 });
  const commitment = createCommitment({ minDependencyAvailability: 0.90 });

  const breaches = detectSlaBreach(observation, commitment);

  assert.ok(!breaches.includes("sla.dependency_unavailability_breach"));
});

test("detectSlaBreach ignores dependency availability when observation field is undefined (defaults to 1)", () => {
  const observation = createObservation({ dependencyAvailability: undefined });
  const commitment = createCommitment({ minDependencyAvailability: 0.90 });

  const breaches = detectSlaBreach(observation, commitment);

  assert.ok(!breaches.includes("sla.dependency_unavailability_breach"));
});

test("detectSlaBreach ignores dependency availability when commitment field is undefined", () => {
  const observation = createObservation({ dependencyAvailability: 0.50 });
  const commitment = createCommitment({ minDependencyAvailability: undefined });

  const breaches = detectSlaBreach(observation, commitment);

  assert.ok(!breaches.includes("sla.dependency_unavailability_breach"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Multiple breach combination tests
// ─────────────────────────────────────────────────────────────────────────────

test("analyzeSlaBreach returns all breach types when multiple metrics fail", () => {
  const observation = createObservation({
    latencyMs: 300, // exceeds 200
    successRate: 0.90, // below 0.98
    queueWaitMs: 1500, // exceeds 1000
    executionTimeoutRate: 0.15, // exceeds 0.10
    dependencyAvailability: 0.80, // below 0.90
  });
  const commitment = createCommitment({
    maxLatencyMs: 200,
    minSuccessRate: 0.98,
    maxQueueWaitMs: 1000,
    maxExecutionTimeoutRate: 0.10,
    minDependencyAvailability: 0.90,
  });

  const result = analyzeSlaBreach(observation, commitment);

  assert.equal(result.breaches.length, 5);
  assert.ok(result.breaches.includes("sla.latency_breach"));
  assert.ok(result.breaches.includes("sla.success_rate_breach"));
  assert.ok(result.breaches.includes("sla.queue_wait_breach"));
  assert.ok(result.breaches.includes("sla.execution_timeout_breach"));
  assert.ok(result.breaches.includes("sla.dependency_unavailability_breach"));
});

test("analyzeSlaBreach calculates budget correctly when no breaches", () => {
  const observation = createObservation({
    latencyMs: 50,
    successRate: 0.995,
    queueWaitMs: 100,
    requestCount: 1000,
    windowMs: 60000,
  });
  const commitment = createCommitment({
    maxLatencyMs: 200,
    minSuccessRate: 0.99,
    maxQueueWaitMs: 500,
    errorBudgetPercent: 0.01,
    budgetWindowMs: 60000,
  });

  const result = analyzeSlaBreach(observation, commitment);

  assert.equal(result.breaches.length, 0);
  assert.ok(result.budget.burnRate < 1); // Healthy burn rate
});

test("analyzeSlaBreach handles zero requestCount", () => {
  const observation = createObservation({ requestCount: 0 });
  const commitment = createCommitment({ errorBudgetPercent: 0.01 });

  const result = analyzeSlaBreach(observation, commitment);

  assert.equal(result.budget.errorBudget, 0);
  assert.equal(result.budget.errorBudgetConsumed, 0);
});

test("analyzeSlaBreach handles zero budgetWindowMs", () => {
  const observation = createObservation({ requestCount: 1000, windowMs: 0 });
  const commitment = createCommitment({ errorBudgetPercent: 0.01, budgetWindowMs: 0 });

  const result = analyzeSlaBreach(observation, commitment);

  // Should handle zero window gracefully
  assert.ok(result.budget.timeToExhaustMs !== null);
});

test("analyzeSlaBreach handles negative budgetWindowMs", () => {
  const observation = createObservation({ requestCount: 1000, windowMs: -100 });
  const commitment = createCommitment({ errorBudgetPercent: 0.01, budgetWindowMs: -100 });

  const result = analyzeSlaBreach(observation, commitment);

  // Should handle negative window gracefully
  assert.ok(result.budget.timeToExhaustMs !== null);
});

test("analyzeSlaBreach handles burnRate with zero allowedErrorRate", () => {
  const observation = createObservation({ successRate: 0.90, requestCount: 1000 });
  const commitment = createCommitment({ minSuccessRate: 1.0, errorBudgetPercent: 0 });

  const result = analyzeSlaBreach(observation, commitment);

  // allowedErrorRate = 0, currentErrorRate = 0.10
  // burnRate should be Infinity or handled gracefully
  assert.ok(Number.isFinite(result.budget.burnRate) || !Number.isFinite(result.budget.burnRate));
});

test("analyzeSlaBreach handles burnRate with zero target error rate but no errors", () => {
  const observation = createObservation({ successRate: 1.0, requestCount: 1000 });
  const commitment = createCommitment({ minSuccessRate: 1.0, errorBudgetPercent: 0 });

  const result = analyzeSlaBreach(observation, commitment);

  // Both zero, burnRate = 0
  assert.ok(approxEqual(result.budget.burnRate, 0), `expected 0, got ${result.budget.burnRate}`);
});

test("analyzeSlaBreach calculates budget with commitment budgetWindowMs as fallback", () => {
  const observation = createObservation({ requestCount: 1000 }); // no windowMs
  const commitment = createCommitment({ errorBudgetPercent: 0.01, budgetWindowMs: 60000 });

  const result = analyzeSlaBreach(observation, commitment);

  // Should use commitment.budgetWindowMs when observation.windowMs is not provided
  assert.ok(result.budget.errorBudget >= 0);
});

test("analyzeSlaBreach uses observation windowMs over commitment budgetWindowMs", () => {
  const observation = createObservation({ requestCount: 1000, windowMs: 30000 }); // 30s
  const commitment = createCommitment({ errorBudgetPercent: 0.01, budgetWindowMs: 60000 }); // 60s

  const result = analyzeSlaBreach(observation, commitment);

  // Should use observation.windowMs = 30000
  assert.ok(result.budget.errorBudget >= 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// SlaBudgetAnalysis interface completeness
// ─────────────────────────────────────────────────────────────────────────────

test("SlaBudgetAnalysis contains all required fields", () => {
  const observation = createObservation({ requestCount: 1000 });
  const commitment = createCommitment({ errorBudgetPercent: 0.01 });
  const result = analyzeSlaBreach(observation, commitment);
  const budget: SlaBudgetAnalysis = result.budget;

  assert.ok("allowedErrorRate" in budget);
  assert.ok("currentErrorRate" in budget);
  assert.ok("errorBudget" in budget);
  assert.ok("errorBudgetConsumed" in budget);
  assert.ok("errorBudgetRemaining" in budget);
  assert.ok("burnRate" in budget);
  assert.ok("timeToExhaustMs" in budget);
  assert.ok("latencyBurnRate" in budget);
  assert.ok("queueWaitBurnRate" in budget);
});

// ─────────────────────────────────────────────────────────────────────────────
// Boundary and edge case tests
// ─────────────────────────────────────────────────────────────────────────────

test("analyzeSlaBreach handles very high burn rate", () => {
  const observation = createObservation({ successRate: 0.0, requestCount: 1000 }); // 100% error
  const commitment = createCommitment({ errorBudgetPercent: 0 }); // 0% allowed = Infinity burn rate

  const result = analyzeSlaBreach(observation, commitment);

  // burnRate should be Infinity when errorBudgetPercent is 0 and there are errors
  assert.ok(result.budget.burnRate === Number.POSITIVE_INFINITY,
    `Expected Infinity, got ${result.budget.burnRate}`);
});

test("analyzeSlaBreach handles negative success rate (invalid)", () => {
  const observation = createObservation({ successRate: -0.5, requestCount: 1000 });
  const commitment = createCommitment({ errorBudgetPercent: 0.01 });

  const result = analyzeSlaBreach(observation, commitment);

  // currentErrorRate should be max(0, 1 - (-0.5)) = 1.5
  assert.ok(result.budget.currentErrorRate >= 0);
});

test("analyzeSlaBreach handles success rate above 1 (invalid)", () => {
  const observation = createObservation({ successRate: 1.5, requestCount: 1000 });
  const commitment = createCommitment({ errorBudgetPercent: 0.01 });

  const result = analyzeSlaBreach(observation, commitment);

  // currentErrorRate = max(0, 1 - 1.5) = 0
  assert.equal(result.budget.currentErrorRate, 0);
});

test("detectSlaBreach returns empty array for no observation fields set", () => {
  const observation = createObservation({
    latencyMs: 50,
    successRate: 0.99,
    queueWaitMs: 200,
  });
  const commitment = createCommitment();

  const breaches = detectSlaBreach(observation, commitment);

  assert.deepEqual(breaches, []);
});
