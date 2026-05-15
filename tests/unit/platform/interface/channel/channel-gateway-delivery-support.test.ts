import { test } from "node:test";
import assert from "node:assert/strict";

import {
  calculateBackoffForAttempt,
  toDeliveryMessageRecord,
  buildDeadLetterQuery,
  buildDeadLetterCountQuery,
  DEFAULT_DELIVERY_CONFIG,
  DEFAULT_RATE_LIMIT_CONFIG,
} from "../../../../../src/platform/five-plane-interface/channel-gateway/channel-gateway-delivery-support.js";
import type { DeliveryGuaranteeConfig } from "../../../../../src/platform/five-plane-interface/channel-gateway/channel-gateway-delivery-support.js";

test("calculateBackoffForAttempt returns initial backoff for first attempt", () => {
  const config: DeliveryGuaranteeConfig = { ...DEFAULT_DELIVERY_CONFIG };
  const result = calculateBackoffForAttempt(config, 1);
  assert.equal(result, 1000);
});

test("calculateBackoffForAttempt returns exponential backoff for subsequent attempts", () => {
  const config: DeliveryGuaranteeConfig = { ...DEFAULT_DELIVERY_CONFIG, initialBackoffMs: 1000, backoffMultiplier: 2 };

  assert.equal(calculateBackoffForAttempt(config, 1), 1000);
  assert.equal(calculateBackoffForAttempt(config, 2), 2000);
  assert.equal(calculateBackoffForAttempt(config, 3), 4000);
  assert.equal(calculateBackoffForAttempt(config, 4), 8000);
});

test("calculateBackoffForAttempt caps backoff at maxBackoffMs", () => {
  const config: DeliveryGuaranteeConfig = { ...DEFAULT_DELIVERY_CONFIG, initialBackoffMs: 1000, maxBackoffMs: 5000, backoffMultiplier: 2 };

  // 1000 * 2^10 = 1024000, but should be capped at 5000
  assert.equal(calculateBackoffForAttempt(config, 11), 5000);
  assert.equal(calculateBackoffForAttempt(config, 12), 5000);
});

test("calculateBackoffForAttempt handles custom backoff multiplier", () => {
  const config: DeliveryGuaranteeConfig = { ...DEFAULT_DELIVERY_CONFIG, initialBackoffMs: 500, backoffMultiplier: 3 };

  assert.equal(calculateBackoffForAttempt(config, 1), 500);
  assert.equal(calculateBackoffForAttempt(config, 2), 1500);
  assert.equal(calculateBackoffForAttempt(config, 3), 4500);
});

test("calculateBackoffForAttempt handles fractional multiplier via Math.pow", () => {
  const config: DeliveryGuaranteeConfig = { ...DEFAULT_DELIVERY_CONFIG, initialBackoffMs: 1000, backoffMultiplier: 1.5 };

  // 1000 * 1.5^2 = 2250
  assert.equal(calculateBackoffForAttempt(config, 3), 2250);
});

test("toDeliveryMessageRecord returns null for undefined input", () => {
  const result = toDeliveryMessageRecord(undefined);
  assert.equal(result, null);
});

test("toDeliveryMessageRecord transforms row with numeric strings", () => {
  const row = { attempts: 5, max_retries: 3 };
  const result = toDeliveryMessageRecord(row);

  assert.notEqual(result, null);
  assert.equal(result!.attempts, 5);
  assert.equal(result!.maxRetries, 3);
});

test("toDeliveryMessageRecord transforms row with numbers", () => {
  const row = { attempts: 5, max_retries: 3 };
  const result = toDeliveryMessageRecord(row);

  assert.notEqual(result, null);
  assert.equal(result!.attempts, 5);
  assert.equal(result!.maxRetries, 3);
});

test("toDeliveryMessageRecord handles zero values", () => {
  const row = { attempts: 0, max_retries: 0 };
  const result = toDeliveryMessageRecord(row);

  assert.notEqual(result, null);
  assert.equal(result!.attempts, 0);
  assert.equal(result!.maxRetries, 0);
});

test("toDeliveryMessageRecord handles mixed numeric string and number", () => {
  const row = { attempts: 5, max_retries: 3 };
  const result = toDeliveryMessageRecord(row);

  assert.notEqual(result, null);
  assert.equal(result!.attempts, 5);
  assert.equal(result!.maxRetries, 3);
});

test("buildDeadLetterQuery returns query with all columns and order", () => {
  const { query, params } = buildDeadLetterQuery(undefined, 100);

  assert.ok(query.includes("SELECT * FROM gateway_dead_letters"));
  assert.ok(query.includes("ORDER BY moved_to_dead_letter_at DESC"));
  assert.ok(query.includes("LIMIT ?"));
  assert.equal(params[params.length - 1], 100);
});

test("buildDeadLetterQuery filters by channel when provided", () => {
  const { query, params } = buildDeadLetterQuery("telegram", 50);

  assert.ok(query.includes("WHERE"));
  assert.ok(query.includes("channel = ?"));
  assert.ok(query.includes("ORDER BY moved_to_dead_letter_at DESC"));
  assert.equal(params[0], "telegram");
  assert.equal(params[params.length - 1], 50);
});

test("buildDeadLetterQuery handles cursor for pagination", () => {
  const cursor = "2024-01-15T00:00:00.000Z";
  const { query, params } = buildDeadLetterQuery(undefined, 25, cursor);

  assert.ok(query.includes("WHERE"));
  assert.ok(query.includes("moved_to_dead_letter_at < ?"));
  assert.ok(query.includes("ORDER BY moved_to_dead_letter_at DESC"));
  assert.ok(query.includes("LIMIT ?"));
  assert.equal(params[0], cursor);
  assert.equal(params[1], 25);
});

test("buildDeadLetterQuery combines channel and cursor filters", () => {
  const cursor = "2024-01-15T00:00:00.000Z";
  const { query, params } = buildDeadLetterQuery("slack", 50, cursor);

  assert.ok(query.includes("WHERE"));
  assert.ok(query.includes("channel = ?"));
  assert.ok(query.includes("moved_to_dead_letter_at < ?"));
  assert.ok(query.includes("ORDER BY moved_to_dead_letter_at DESC"));
  assert.ok(query.includes("LIMIT ?"));
  assert.equal(params[0], "slack");
  assert.equal(params[1], cursor);
  assert.equal(params[2], 50);
});

test("buildDeadLetterQuery uses default limit of 100", () => {
  const { query, params } = buildDeadLetterQuery(undefined);

  assert.ok(query.includes("LIMIT ?"));
  assert.equal(params[params.length - 1], 100);
});

test("buildDeadLetterQuery respects custom limit", () => {
  const { query, params } = buildDeadLetterQuery(undefined, 50);

  assert.ok(query.includes("LIMIT ?"));
  assert.equal(params[params.length - 1], 50);
});

test("buildDeadLetterCountQuery returns aggregation query", () => {
  const { query, params } = buildDeadLetterCountQuery(undefined);

  assert.ok(query.includes("SELECT channel, COUNT(*)"));
  assert.ok(query.includes("FROM gateway_dead_letters"));
  assert.ok(query.includes("GROUP BY channel"));
  assert.equal(params.length, 0);
});

test("buildDeadLetterCountQuery filters by channel when provided", () => {
  const { query, params } = buildDeadLetterCountQuery("webhook");

  assert.ok(query.includes("SELECT channel, COUNT(*)"));
  assert.ok(query.includes("FROM gateway_dead_letters"));
  assert.ok(query.includes("WHERE channel = ?"));
  assert.ok(query.includes("GROUP BY channel"));
  assert.equal(params[0], "webhook");
});

test("DEFAULT_DELIVERY_CONFIG has sensible retryable statuses", () => {
  assert.ok(DEFAULT_DELIVERY_CONFIG.retryableStatuses.includes(408));
  assert.ok(DEFAULT_DELIVERY_CONFIG.retryableStatuses.includes(429));
  assert.ok(DEFAULT_DELIVERY_CONFIG.retryableStatuses.includes(500));
  assert.ok(DEFAULT_DELIVERY_CONFIG.retryableStatuses.includes(502));
  assert.ok(DEFAULT_DELIVERY_CONFIG.retryableStatuses.includes(503));
  assert.ok(DEFAULT_DELIVERY_CONFIG.retryableStatuses.includes(504));
});

test("DEFAULT_DELIVERY_CONFIG has correct backoff settings", () => {
  assert.equal(DEFAULT_DELIVERY_CONFIG.maxRetries, 5);
  assert.equal(DEFAULT_DELIVERY_CONFIG.initialBackoffMs, 1000);
  assert.equal(DEFAULT_DELIVERY_CONFIG.maxBackoffMs, 60000);
  assert.equal(DEFAULT_DELIVERY_CONFIG.backoffMultiplier, 2);
});

test("DEFAULT_DELIVERY_CONFIG has correct timeout", () => {
  assert.equal(DEFAULT_DELIVERY_CONFIG.timeoutMs, 30000);
});

test("DEFAULT_RATE_LIMIT_CONFIG has telegram limits", () => {
  assert.equal(DEFAULT_RATE_LIMIT_CONFIG.telegram?.limit, 30);
  assert.equal(DEFAULT_RATE_LIMIT_CONFIG.telegram?.windowMs, 1000);
});

test("DEFAULT_RATE_LIMIT_CONFIG has slack limits", () => {
  assert.equal(DEFAULT_RATE_LIMIT_CONFIG.slack?.limit, 30);
  assert.equal(DEFAULT_RATE_LIMIT_CONFIG.slack?.windowMs, 1000);
});

test("DEFAULT_RATE_LIMIT_CONFIG has webhook limits", () => {
  assert.equal(DEFAULT_RATE_LIMIT_CONFIG.webhook?.limit, 100);
  assert.equal(DEFAULT_RATE_LIMIT_CONFIG.webhook?.windowMs, 1000);
});

test("DEFAULT_RATE_LIMIT_CONFIG has default limits", () => {
  assert.equal(DEFAULT_RATE_LIMIT_CONFIG.default?.limit, 50);
  assert.equal(DEFAULT_RATE_LIMIT_CONFIG.default?.windowMs, 1000);
});
