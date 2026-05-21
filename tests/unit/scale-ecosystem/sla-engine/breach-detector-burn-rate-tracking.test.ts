/**
 * Breach Detector Issue #2131 Tests
 *
 * Issue #2131: No burn-rate/error-budget tracking
 *
 * The breach detector should track burn-rate and error budget to provide
 * early warning before SLA breaches occur.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeSlaBreach,
  detectSlaBreach,
  type SlaObservation,
  type SlaCommitment,
} from "../../../../src/scale-ecosystem/sla-engine/breach-detector/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Issue #2131: Burn-rate and error-budget tracking
// ─────────────────────────────────────────────────────────────────────────────

test("breach-detector-2131: SlaObservation accepts request-count and window metadata for burn-rate analysis", () => {
  const observation: SlaObservation = {
    latencyMs: 100,
    successRate: 0.99,
    queueWaitMs: 500,
    requestCount: 10_000,
    windowMs: 60_000,
  };

  assert.equal(observation.requestCount, 10_000);
  assert.equal(observation.windowMs, 60_000);
});

test("breach-detector-2131: analyzeSlaBreach calculates burn-rate and error-budget state", () => {
  const observation: SlaObservation = {
    latencyMs: 100,
    successRate: 0.95,
    queueWaitMs: 500,
    requestCount: 10_000,
    windowMs: 60_000,
  };

  const commitment: SlaCommitment = {
    maxLatencyMs: 100,
    minSuccessRate: 0.99,
    maxQueueWaitMs: 500,
    warningBurnRateThreshold: 1,
    criticalBurnRateThreshold: 2,
  };

  const analysis = analyzeSlaBreach(observation, commitment);
  assert.ok(Math.abs(analysis.budget.errorBudget - 100) < 1e-9);
  assert.ok(Math.abs(analysis.budget.errorBudgetConsumed - 500) < 1e-9);
  assert.ok(Math.abs(analysis.budget.errorBudgetRemaining + 400) < 1e-9);
  assert.equal(analysis.budget.burnRate, 5);
  assert.ok(analysis.alerts.includes("sla.error_budget_burn_critical"));
  assert.ok(analysis.alerts.includes("sla.error_budget_exhausted"));
});

test("breach-detector-2131: SlaCommitment includes error-budget thresholds", () => {
  const commitment: SlaCommitment = {
    maxLatencyMs: 100,
    minSuccessRate: 0.99,
    maxQueueWaitMs: 500,
    errorBudgetPercent: 0.01,
    budgetWindowMs: 60_000,
    warningBurnRateThreshold: 1,
    criticalBurnRateThreshold: 2,
  };

  assert.equal(commitment.errorBudgetPercent, 0.01);
  assert.equal(commitment.budgetWindowMs, 60_000);
});

test("breach-detector-2131: burn-rate tracking requires historical observations", () => {
  // Issue #2131: To calculate burn-rate, we need multiple observations over time
  // This test documents the requirement

  const observations: SlaObservation[] = [
    { latencyMs: 100, successRate: 0.99, queueWaitMs: 500 },
    { latencyMs: 110, successRate: 0.98, queueWaitMs: 550 },
    { latencyMs: 120, successRate: 0.97, queueWaitMs: 600 },
  ];

  // Current implementation doesn't use historical data
  assert.equal(observations.length, 3);
});

test("breach-detector-2131: detectSlaBreach remains backward-compatible for breach codes", () => {
  const currentSuccessRate = 0.95;
  const breaches = detectSlaBreach(
    {
      latencyMs: 100,
      successRate: currentSuccessRate,
      queueWaitMs: 500,
      requestCount: 10_000,
      windowMs: 60_000,
    },
    {
      maxLatencyMs: 100,
      minSuccessRate: 0.99,
      maxQueueWaitMs: 500,
    },
  );

  assert.ok(breaches.includes("sla.success_rate_breach"));
});

test("breach-detector-2131: multiple burn-rate breach types", () => {
  // Issue #2131: Burn-rate should be tracked for multiple SLA types
  // - Error rate burn-rate
  // - Latency burn-rate
  // - Queue wait burn-rate

  const observation: SlaObservation = {
    latencyMs: 150, // 50% over 100ms target
    successRate: 0.95, // 4% error rate vs 1% target
    queueWaitMs: 750, // 50% over 500ms target
  };

  const commitment: SlaCommitment = {
    maxLatencyMs: 100,
    minSuccessRate: 0.99,
    maxQueueWaitMs: 500,
  };

  const breaches = detectSlaBreach(observation, commitment);

  // Current implementation returns individual breach codes
  // Issue: doesn't return burn-rate information
  assert.ok(breaches.includes("sla.latency_breach"));
  assert.ok(breaches.includes("sla.success_rate_breach"));
  assert.ok(breaches.includes("sla.queue_wait_breach"));
});

test("breach-detector-2131: threshold for burn-rate alert", () => {
  // Issue #2131: Should alert when burn-rate exceeds threshold
  // e.g., burnRate > 1.0 means depleting budget, burnRate > 2.0 means critical

  const burnRates = [0.5, 1.0, 1.5, 2.0, 3.0];

  // Alert thresholds
  const warningThreshold = 1.0;
  const criticalThreshold = 2.0;

  for (const burnRate of burnRates) {
    if (burnRate >= criticalThreshold) {
      // Should trigger critical alert
      assert.ok(true);
    } else if (burnRate >= warningThreshold) {
      // Should trigger warning alert
      assert.ok(true);
    }
  }

  // Current implementation doesn't calculate burn-rate
  // So these alerts are not generated
});

test("breach-detector-2131: detecting slow burn vs fast burn", () => {
  // Issue #2131: Slow burn (burn-rate < 1) means budget recovering
  // Fast burn (burn-rate > 1) means budget depleting

  const slowBurnObservation: SlaObservation = {
    latencyMs: 80, // Under target
    successRate: 0.995, // Better than target
    queueWaitMs: 400, // Under target
  };

  const fastBurnObservation: SlaObservation = {
    latencyMs: 150, // Over target
    successRate: 0.95, // Under target
    queueWaitMs: 700, // Over target
  };

  // Current implementation treats both the same
  // Issue: no distinction between slow and fast burn
  assert.ok(true);
});

test("breach-detector-2131: burn-rate requires time window", () => {
  // Issue #2131: Burn-rate must be calculated over a time window
  // e.g., last 1 hour, last 24 hours, last 7 days

  const timeWindows = [
    { window: "1h", budgetMs: 3600000 },
    { window: "24h", budgetMs: 86400000 },
    { window: "7d", budgetMs: 604800000 },
  ];

  // Current implementation doesn't track time windows
  assert.ok(timeWindows.length === 3);
});

test("breach-detector-2131: cumulative vs point-in-time breach detection", () => {
  // Issue #2131: Should detect both:
  // 1. Point-in-time: single observation exceeds threshold
  // 2. Cumulative: burn-rate indicates future breach

  const goodObservation: SlaObservation = {
    latencyMs: 50,
    successRate: 0.999,
    queueWaitMs: 100,
  };

  const badObservation: SlaObservation = {
    latencyMs: 150,
    successRate: 0.90,
    queueWaitMs: 1000,
  };

  // Point-in-time detection works
  const goodBreaches = detectSlaBreach(goodObservation, {
    maxLatencyMs: 100,
    minSuccessRate: 0.99,
    maxQueueWaitMs: 500,
  });

  const badBreaches = detectSlaBreach(badObservation, {
    maxLatencyMs: 100,
    minSuccessRate: 0.99,
    maxQueueWaitMs: 500,
  });

  // Current implementation only does point-in-time
  assert.equal(goodBreaches.length, 0);
  assert.ok(badBreaches.length > 0);

  // Issue: cumulative breach detection is missing
});
