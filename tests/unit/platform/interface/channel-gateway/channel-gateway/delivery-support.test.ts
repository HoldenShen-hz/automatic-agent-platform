import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateBackoffForAttempt,
  toDeliveryMessageRecord,
  buildDeadLetterQuery,
  buildDeadLetterCountQuery,
  CHANNEL_DELIVERY_DDL,
  DEFAULT_DELIVERY_CONFIG,
  DEFAULT_RATE_LIMIT_CONFIG,
} from "../../../../../../src/platform/interface/channel-gateway/channel-gateway-delivery-support.js";

test("calculateBackoffForAttempt computes exponential backoff", () => {
  const config = { ...DEFAULT_DELIVERY_CONFIG };
  assert.equal(calculateBackoffForAttempt(config, 1), 1000); // initialBackoffMs * 2^0
  assert.equal(calculateBackoffForAttempt(config, 2), 2000); // initialBackoffMs * 2^1
  assert.equal(calculateBackoffForAttempt(config, 3), 4000); // initialBackoffMs * 2^2
});

test("calculateBackoffForAttempt respects maxBackoffMs", () => {
  const config = { ...DEFAULT_DELIVERY_CONFIG, initialBackoffMs: 1000, maxBackoffMs: 3000, backoffMultiplier: 2 };
  assert.equal(calculateBackoffForAttempt(config, 1), 1000);
  assert.equal(calculateBackoffForAttempt(config, 2), 2000);
  assert.equal(calculateBackoffForAttempt(config, 3), 3000); // capped at maxBackoffMs
  assert.equal(calculateBackoffForAttempt(config, 10), 3000); // still capped
});

test("calculateBackoffForAttempt handles custom config", () => {
  const config = { initialBackoffMs: 500, maxBackoffMs: 8000, backoffMultiplier: 2, maxRetries: 3, timeoutMs: 5000, retryableStatuses: [500] };
  assert.equal(calculateBackoffForAttempt(config, 1), 500);
  assert.equal(calculateBackoffForAttempt(config, 2), 1000);
  assert.equal(calculateBackoffForAttempt(config, 3), 2000);
  assert.equal(calculateBackoffForAttempt(config, 4), 4000);
});

test("toDeliveryMessageRecord returns null for undefined", () => {
  assert.equal(toDeliveryMessageRecord(undefined), null);
});

test("toDeliveryMessageRecord converts row correctly", () => {
  const row = { attempts: 3, max_retries: 5 };
  const result = toDeliveryMessageRecord(row);
  assert.deepEqual(result, { attempts: 3, maxRetries: 5 });
});

test("toDeliveryMessageRecord handles string values from SQLite", () => {
  const row = { attempts: "2", max_retries: "7" } as any;
  const result = toDeliveryMessageRecord(row);
  assert.deepEqual(result, { attempts: 2, maxRetries: 7 });
});

test("toDeliveryMessageRecord handles zero values", () => {
  const row = { attempts: 0, max_retries: 0 };
  const result = toDeliveryMessageRecord(row);
  assert.deepEqual(result, { attempts: 0, maxRetries: 0 });
});

test("buildDeadLetterQuery returns basic query", () => {
  const result = buildDeadLetterQuery();
  assert.ok(result.query.includes("SELECT * FROM gateway_dead_letters"));
  assert.ok(result.query.includes("ORDER BY moved_to_dead_letter_at DESC"));
  assert.ok(result.query.includes("LIMIT ?"));
  assert.deepEqual(result.params, [100]); // default limit
});

test("buildDeadLetterQuery filters by channel", () => {
  const result = buildDeadLetterQuery("telegram");
  assert.ok(result.query.includes("WHERE channel = ?"));
  assert.deepEqual(result.params, ["telegram", 100]);
});

test("buildDeadLetterQuery uses custom limit", () => {
  const result = buildDeadLetterQuery(undefined, 50);
  assert.deepEqual(result.params, [50]);
});

test("buildDeadLetterQuery filters by channel with custom limit", () => {
  const result = buildDeadLetterQuery("slack", 25);
  assert.ok(result.query.includes("WHERE channel = ?"));
  assert.deepEqual(result.params, ["slack", 25]);
});

test("buildDeadLetterCountQuery returns basic query", () => {
  const result = buildDeadLetterCountQuery();
  assert.ok(result.query.includes("SELECT channel, COUNT(*)"));
  assert.ok(result.query.includes("FROM gateway_dead_letters"));
  assert.ok(result.query.includes("GROUP BY channel"));
  assert.deepEqual(result.params, []);
});

test("buildDeadLetterCountQuery filters by channel", () => {
  const result = buildDeadLetterCountQuery("webhook");
  assert.ok(result.query.includes("WHERE channel = ?"));
  assert.deepEqual(result.params, ["webhook"]);
});

test("CHANNEL_DELIVERY_DDL contains required tables", () => {
  assert.ok(CHANNEL_DELIVERY_DDL.includes("CREATE TABLE IF NOT EXISTS delivery_messages"));
  assert.ok(CHANNEL_DELIVERY_DDL.includes("CREATE TABLE IF NOT EXISTS delivery_attempts"));
  assert.ok(CHANNEL_DELIVERY_DDL.includes("CREATE TABLE IF NOT EXISTS replay_nonces"));
  assert.ok(CHANNEL_DELIVERY_DDL.includes("CREATE TABLE IF NOT EXISTS gateway_dead_letters"));
  assert.ok(CHANNEL_DELIVERY_DDL.includes("CREATE TABLE IF NOT EXISTS gateway_rate_limits"));
});

test("CHANNEL_DELIVERY_DDL contains required indexes", () => {
  assert.ok(CHANNEL_DELIVERY_DDL.includes("CREATE INDEX IF NOT EXISTS idx_delivery_messages_status"));
  assert.ok(CHANNEL_DELIVERY_DDL.includes("CREATE INDEX IF NOT EXISTS idx_delivery_attempts_message"));
  assert.ok(CHANNEL_DELIVERY_DDL.includes("CREATE INDEX IF NOT EXISTS idx_gateway_dead_letters_channel"));
  assert.ok(CHANNEL_DELIVERY_DDL.includes("CREATE INDEX IF NOT EXISTS idx_gateway_rate_limits_channel_window"));
});

test("DEFAULT_DELIVERY_CONFIG has correct values", () => {
  assert.equal(DEFAULT_DELIVERY_CONFIG.maxRetries, 5);
  assert.equal(DEFAULT_DELIVERY_CONFIG.initialBackoffMs, 1000);
  assert.equal(DEFAULT_DELIVERY_CONFIG.maxBackoffMs, 60000);
  assert.equal(DEFAULT_DELIVERY_CONFIG.backoffMultiplier, 2);
  assert.equal(DEFAULT_DELIVERY_CONFIG.timeoutMs, 30000);
  assert.deepEqual(DEFAULT_DELIVERY_CONFIG.retryableStatuses, [408, 429, 500, 502, 503, 504]);
});

test("DEFAULT_RATE_LIMIT_CONFIG has correct values", () => {
  assert.equal(DEFAULT_RATE_LIMIT_CONFIG.telegram?.limit, 30);
  assert.equal(DEFAULT_RATE_LIMIT_CONFIG.telegram?.windowMs, 1000);
  assert.equal(DEFAULT_RATE_LIMIT_CONFIG.slack?.limit, 30);
  assert.equal(DEFAULT_RATE_LIMIT_CONFIG.slack?.windowMs, 1000);
  assert.equal(DEFAULT_RATE_LIMIT_CONFIG.webhook?.limit, 100);
  assert.equal(DEFAULT_RATE_LIMIT_CONFIG.webhook?.windowMs, 1000);
  assert.equal(DEFAULT_RATE_LIMIT_CONFIG.default?.limit, 50);
  assert.equal(DEFAULT_RATE_LIMIT_CONFIG.default?.windowMs, 1000);
});
