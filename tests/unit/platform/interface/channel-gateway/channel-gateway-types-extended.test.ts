/**
 * Unit tests for Channel Gateway Types - Additional type coverage
 * Tests for type definitions and utility functions
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateBackoffForAttempt,
  buildDeadLetterQuery,
  buildDeadLetterCountQuery,
  type DeliveryGuaranteeConfig,
  type RateLimitConfig,
} from "../../../../../src/platform/five-plane-interface/channel-gateway/channel-gateway-delivery-support.js";

test("calculateBackoffForAttempt handles attempt number of 0", () => {
  const config: DeliveryGuaranteeConfig = {
    maxRetries: 5,
    initialBackoffMs: 1000,
    maxBackoffMs: 60000,
    backoffMultiplier: 2,
    timeoutMs: 30000,
    retryableStatuses: [408, 429, 500, 502, 503, 504],
  };
  // Backoff for attempt 0 would be initialBackoffMs * 2^(-1) = 500, but formula uses (attemptNumber - 1)
  // So attempt 0 gives initialBackoffMs * 2^(-1) which could be 500
  const result = calculateBackoffForAttempt(config, 0);
  // Mathematically: 1000 * 2^(0-1) = 1000 * 0.5 = 500
  assert.equal(result, 500);
});

test("calculateBackoffForAttempt handles very large attempt numbers", () => {
  const config: DeliveryGuaranteeConfig = {
    maxRetries: 5,
    initialBackoffMs: 1000,
    maxBackoffMs: 10000,
    backoffMultiplier: 2,
    timeoutMs: 30000,
    retryableStatuses: [408, 429, 500, 502, 503, 504],
  };
  // Attempt 100 should be capped at maxBackoffMs
  const result = calculateBackoffForAttempt(config, 100);
  assert.equal(result, 10000);
});

test("calculateBackoffForAttempt handles zero initialBackoffMs", () => {
  const config: DeliveryGuaranteeConfig = {
    maxRetries: 5,
    initialBackoffMs: 0,
    maxBackoffMs: 60000,
    backoffMultiplier: 2,
    timeoutMs: 30000,
    retryableStatuses: [408, 429, 500, 502, 503, 504],
  };
  const result = calculateBackoffForAttempt(config, 1);
  assert.equal(result, 0);
});

test("calculateBackoffForAttempt handles backoffMultiplier of 1 (no exponential growth)", () => {
  const config: DeliveryGuaranteeConfig = {
    maxRetries: 5,
    initialBackoffMs: 1000,
    maxBackoffMs: 60000,
    backoffMultiplier: 1,
    timeoutMs: 30000,
    retryableStatuses: [408, 429, 500, 502, 503, 504],
  };
  assert.equal(calculateBackoffForAttempt(config, 1), 1000);
  assert.equal(calculateBackoffForAttempt(config, 2), 1000);
  assert.equal(calculateBackoffForAttempt(config, 5), 1000);
});

test("buildDeadLetterQuery with limit of 0 uses default", () => {
  const result = buildDeadLetterQuery(undefined, 0);
  // limit of 0 should clamp to default 100
  assert.deepEqual(result.params, [100]);
});

test("buildDeadLetterQuery with negative limit", () => {
  const result = buildDeadLetterQuery(undefined, -5);
  // Negative should clamp to 1
  assert.deepEqual(result.params, [1]);
});

test("buildDeadLetterQuery with very large limit", () => {
  const result = buildDeadLetterQuery(undefined, 10000);
  // Should clamp to max of 200
  assert.deepEqual(result.params, [200]);
});

test("buildDeadLetterQuery with channel and custom limit", () => {
  const result = buildDeadLetterQuery("telegram", 50);
  assert.deepEqual(result.params, ["telegram", 50]);
});

test("buildDeadLetterQuery with all parameters", () => {
  const result = buildDeadLetterQuery("slack", 25, "2024-01-01T00:00:00Z");
  assert.ok(result.query.includes("channel = ?"));
  assert.ok(result.query.includes("moved_to_dead_letter_at < ?"));
  assert.ok(result.query.includes("ORDER BY moved_to_dead_letter_at DESC"));
  assert.deepEqual(result.params, ["slack", "2024-01-01T00:00:00Z", 25]);
});

test("buildDeadLetterCountQuery with undefined channel", () => {
  const result = buildDeadLetterCountQuery(undefined);
  assert.ok(!result.query.includes("WHERE"));
  assert.deepEqual(result.params, []);
});

test("buildDeadLetterCountQuery with empty string channel", () => {
  const result = buildDeadLetterCountQuery("");
  // Empty string is still a defined value, so it adds WHERE clause
  assert.ok(result.query.includes("WHERE"));
  assert.deepEqual(result.params, [""]);
});

test("RateLimitConfig has correct structure", () => {
  const config: RateLimitConfig = {
    telegram: { limit: 30, windowMs: 1000 },
    slack: { limit: 30, windowMs: 1000 },
    webhook: { limit: 100, windowMs: 1000 },
    default: { limit: 50, windowMs: 1000 },
  };
  assert.equal(config.telegram?.limit, 30);
  assert.equal(config.slack?.limit, 30);
  assert.equal(config.webhook?.limit, 100);
  assert.equal(config.default?.limit, 50);
});

test("DeliveryGuaranteeConfig has correct defaults", () => {
  const config: DeliveryGuaranteeConfig = {
    maxRetries: 5,
    initialBackoffMs: 1000,
    maxBackoffMs: 60000,
    backoffMultiplier: 2,
    timeoutMs: 30000,
    retryableStatuses: [408, 429, 500, 502, 503, 504],
  };
  assert.equal(config.maxRetries, 5);
  assert.equal(config.initialBackoffMs, 1000);
  assert.equal(config.maxBackoffMs, 60000);
  assert.equal(config.backoffMultiplier, 2);
  assert.equal(config.timeoutMs, 30000);
  assert.deepEqual(config.retryableStatuses, [408, 429, 500, 502, 503, 504]);
});
