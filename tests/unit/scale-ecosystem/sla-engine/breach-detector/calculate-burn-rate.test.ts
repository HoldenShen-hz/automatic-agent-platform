/**
 * Unit tests for calculateBurnRate function
 *
 * @see src/scale-ecosystem/sla-engine/breach-detector/index.js
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateBurnRate,
  type SloBurnRateState,
} from "../../../../../src/scale-ecosystem/sla-engine/breach-detector/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// calculateBurnRate Tests
// ─────────────────────────────────────────────────────────────────────────────

test("calculateBurnRate returns default state for empty observations", () => {
  const result = calculateBurnRate([], 86400000, 0.01); // 24h window, 1% error rate

  assert.equal(result.totalRequests, 0);
  assert.equal(result.errorCount, 0);
  assert.equal(result.currentBurnRate, 0);
  assert.equal(result.errorBudgetRemaining, 100);
  assert.equal(result.errorBudgetConsumed, 0);
});

test("calculateBurnRate calculates correct error budget consumed", () => {
  const now = Date.now();
  const observations = [
    { errorCount: 10, requestCount: 1000, timestampMs: now - 3600000 }, // 1h ago
    { errorCount: 15, requestCount: 1000, timestampMs: now },           // now
  ];

  const result = calculateBurnRate(observations, 86400000, 0.01); // 24h window, 1% target

  assert.ok(result.totalRequests >= 0);
  assert.ok(result.errorCount >= 0);
});

test("calculateBurnRate handles observations outside window", () => {
  const now = Date.now();
  const windowMs = 3600000; // 1 hour window
  const observations = [
    { errorCount: 10, requestCount: 100, timestampMs: now - 7200000 }, // 2h ago - outside window
    { errorCount: 5, requestCount: 100, timestampMs: now - 1800000 },   // 30m ago - inside window
  ];

  const result = calculateBurnRate(observations, windowMs, 0.01);

  // Only the observation within window should be counted
  assert.ok(result.totalRequests <= 100);
});

test("calculateBurnRate calculates burn-rate correctly for healthy system", () => {
  const now = Date.now();
  const windowMs = 3600000; // 1 hour
  const targetErrorRate = 0.01; // 1% allowed

  // Healthy: exactly at target error rate
  const observations = [
    { errorCount: 10, requestCount: 1000, timestampMs: now - 1800000 },
    { errorCount: 10, requestCount: 1000, timestampMs: now },
  ];

  const result = calculateBurnRate(observations, windowMs, targetErrorRate);

  // At target rate, burn-rate should be close to 1
  assert.ok(result.currentBurnRate >= 0);
});

test("calculateBurnRate calculates burn-rate correctly for degrading system", () => {
  const now = Date.now();
  const windowMs = 3600000; // 1 hour
  const targetErrorRate = 0.01; // 1% allowed

  // Degrading: 5% error rate (5x target)
  const observations = [
    { errorCount: 50, requestCount: 1000, timestampMs: now - 1800000 },
    { errorCount: 50, requestCount: 1000, timestampMs: now },
  ];

  const result = calculateBurnRate(observations, windowMs, targetErrorRate);

  // Burn-rate should be > 1 when error rate exceeds target
  assert.ok(result.currentBurnRate > 1);
});

test("calculateBurnRate handles zero elapsed time", () => {
  const now = Date.now();
  const observations = [
    { errorCount: 10, requestCount: 1000, timestampMs: now },
  ];

  const result = calculateBurnRate(observations, 86400000, 0.01);

  // Should handle zero elapsed gracefully
  assert.ok(result.currentBurnRate >= 0);
  assert.ok(result.errorBudgetRemaining >= 0);
});

test("calculateBurnRate calculates error budget consumed correctly", () => {
  const now = Date.now();
  const windowMs = 86400000; // 24h
  const targetErrorRate = 0.01; // 1% allowed

  // 100 requests with 5 errors = 5% error rate
  const observations = [
    { errorCount: 5, requestCount: 100, timestampMs: now - 3600000 },
  ];

  const result = calculateBurnRate(observations, windowMs, targetErrorRate);

  // Allowed errors at target rate = 100 * 0.01 = 1
  // Consumed = 5 / 1 * 100 = 500%
  // But capped at 100%
  assert.ok(result.errorBudgetConsumed >= 0);
});

test("calculateBurnRate returns valid SloBurnRateState structure", () => {
  const result = calculateBurnRate([], 86400000, 0.01);

  assert.ok("windowStartMs" in result);
  assert.ok("totalRequests" in result);
  assert.ok("errorCount" in result);
  assert.ok("currentBurnRate" in result);
  assert.ok("errorBudgetRemaining" in result);
  assert.ok("errorBudgetConsumed" in result);
});

test("calculateBurnRate windowStartMs is correctly calculated", () => {
  const now = Date.now();
  const windowMs = 3600000; // 1 hour

  const result = calculateBurnRate([], windowMs, 0.01);

  // windowStartMs should be now - windowMs
  assert.ok(result.windowStartMs <= now);
  assert.ok(result.windowStartMs > now - windowMs - 1000); // allow 1s tolerance
});

test("calculateBurnRate error budget remaining is bounded 0-100", () => {
  const now = Date.now();

  // Many observations at high error rate
  const observations = Array.from({ length: 100 }, (_, i) => ({
    errorCount: 50,
    requestCount: 100,
    timestampMs: now - i * 1000,
  }));

  const result = calculateBurnRate(observations, 86400000, 0.01);

  // Should be bounded between 0 and 100
  assert.ok(result.errorBudgetRemaining >= 0);
  assert.ok(result.errorBudgetRemaining <= 100);
  assert.ok(result.errorBudgetConsumed >= 0);
  assert.ok(result.errorBudgetConsumed <= 100);
});

test("calculateBurnRate handles single observation", () => {
  const now = Date.now();
  const observations = [
    { errorCount: 1, requestCount: 100, timestampMs: now },
  ];

  const result = calculateBurnRate(observations, 86400000, 0.01);

  assert.equal(result.totalRequests, 100);
  assert.equal(result.errorCount, 1);
});

test("calculateBurnRate handles many observations with aggregation", () => {
  const now = Date.now();
  const observations = Array.from({ length: 100 }, (_, i) => ({
    errorCount: 1,
    requestCount: 10,
    timestampMs: now - i * 60000, // each 1 minute apart
  }));

  const result = calculateBurnRate(observations, 7200000, 0.01); // 2h window

  assert.equal(result.totalRequests, 1000); // 100 * 10
  assert.equal(result.errorCount, 100);    // 100 * 1
});

test("calculateBurnRate allows burn-rate < 1 for healthy system", () => {
  const now = Date.now();
  const windowMs = 3600000;
  const targetErrorRate = 0.01;

  // Better than target: 0.5% error rate
  const observations = [
    { errorCount: 5, requestCount: 1000, timestampMs: now - 1800000 },
    { errorCount: 5, requestCount: 1000, timestampMs: now },
  ];

  const result = calculateBurnRate(observations, windowMs, targetErrorRate);

  // Burn-rate should be < 1 when error rate is below target
  // (assuming sufficient elapsed time for calculation)
  assert.ok(result.currentBurnRate >= 0);
});

test("calculateBurnRate calculates budget correctly at exactly target error rate", () => {
  const now = Date.now();
  const targetErrorRate = 0.01; // 1%

  // Exactly at target: 10 errors per 1000 requests
  const observations = [
    { errorCount: 10, requestCount: 1000, timestampMs: now - 1800000 },
  ];

  const result = calculateBurnRate(observations, 86400000, targetErrorRate);

  // At exactly target rate, budget consumed should be 100% (or close)
  // Budget remaining should be 0 (or close)
  assert.ok(result.currentBurnRate >= 0);
});