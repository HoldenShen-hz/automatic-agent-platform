import assert from "node:assert/strict";
import test from "node:test";

import {
  CHANNEL_DELIVERY_DDL,
  DEFAULT_DELIVERY_CONFIG,
  DEFAULT_RATE_LIMIT_CONFIG,
  calculateBackoffForAttempt,
  toDeliveryMessageRecord,
  buildDeadLetterQuery,
  buildDeadLetterCountQuery,
  type DeliveryAttempt,
  type DeliveryReceipt,
  type DeliveryFailureResolution,
  type SignatureVerificationResult,
  type ReplayProtectionResult,
  type DeliveryGuaranteeConfig,
  type RateLimitConfig,
  type RateLimitResult,
  type DeadLetterEntry,
  type PendingDelivery,
  type RetryableDelivery,
  type DeliveryMessageRecord,
} from "../../../../../src/platform/interface/channel-gateway/channel-gateway-delivery-support.js";

test("DeliveryAttempt status accepts valid values", () => {
  const statuses: DeliveryAttempt["status"][] = ["pending", "success", "failed", "retrying"];
  assert.equal(statuses.length, 4);
});

test("DeliveryReceipt status accepts valid values", () => {
  const statuses: DeliveryReceipt["status"][] = ["delivered", "failed", "pending_retry"];
  assert.equal(statuses.length, 3);
});

test("DeliveryReceipt finalStatus accepts valid values", () => {
  const finalStatuses: DeliveryReceipt["finalStatus"][] = ["success", "permanent_failure", "exhausted_retries"];
  assert.equal(finalStatuses.length, 3);
});

test("DeliveryFailureResolution outcome accepts valid values", () => {
  const outcomes: DeliveryFailureResolution["outcome"][] = ["retry_scheduled", "dead_lettered"];
  assert.equal(outcomes.length, 2);
});

test("RateLimitResult structure is correct", () => {
  const result: RateLimitResult = {
    allowed: true,
    currentCount: 5,
    limit: 50,
    windowMs: 1000,
  };
  assert.equal(result.allowed, true);
  assert.equal(result.currentCount, 5);
});

test("RateLimitResult allows optional retryAfterMs", () => {
  const result: RateLimitResult = {
    allowed: false,
    currentCount: 50,
    limit: 50,
    windowMs: 1000,
    retryAfterMs: 500,
  };
  assert.equal(result.retryAfterMs, 500);
});

test("calculateBackoffForAttempt uses exponential backoff", () => {
  const config: DeliveryGuaranteeConfig = {
    maxRetries: 5,
    initialBackoffMs: 1000,
    maxBackoffMs: 60000,
    backoffMultiplier: 2,
    timeoutMs: 30000,
    retryableStatuses: [408, 429, 500, 502, 503, 504],
  };

  // Attempt 1: 1000 * 2^0 = 1000
  assert.equal(calculateBackoffForAttempt(config, 1), 1000);
  // Attempt 2: 1000 * 2^1 = 2000
  assert.equal(calculateBackoffForAttempt(config, 2), 2000);
  // Attempt 3: 1000 * 2^2 = 4000
  assert.equal(calculateBackoffForAttempt(config, 3), 4000);
});

test("calculateBackoffForAttempt respects maxBackoffMs", () => {
  const config: DeliveryGuaranteeConfig = {
    maxRetries: 5,
    initialBackoffMs: 1000,
    maxBackoffMs: 5000,
    backoffMultiplier: 2,
    timeoutMs: 30000,
    retryableStatuses: [408, 429, 500, 502, 503, 504],
  };

  // Attempt 5: 1000 * 2^4 = 16000, but capped at 5000
  assert.equal(calculateBackoffForAttempt(config, 5), 5000);
  // Attempt 10: would be 512000, capped at 5000
  assert.equal(calculateBackoffForAttempt(config, 10), 5000);
});

test("toDeliveryMessageRecord returns null for undefined input", () => {
  const result = toDeliveryMessageRecord(undefined);
  assert.equal(result, null);
});

test("toDeliveryMessageRecord converts row correctly", () => {
  const row = { attempts: 3, max_retries: 5 };
  const result = toDeliveryMessageRecord(row);
  assert.notEqual(result, null);
  assert.equal(result!.attempts, 3);
  assert.equal(result!.maxRetries, 5);
});

test("toDeliveryMessageRecord converts numeric values correctly", () => {
  const row = { attempts: 5, max_retries: 10 };
  const result = toDeliveryMessageRecord(row);
  assert.notEqual(result, null);
  assert.equal(result!.attempts, 5);
  assert.equal(result!.maxRetries, 10);
});

test("buildDeadLetterQuery with no channel filter", () => {
  const { query, params } = buildDeadLetterQuery();
  assert.ok(query.includes("SELECT * FROM gateway_dead_letters"));
  assert.ok(query.includes("ORDER BY moved_to_dead_letter_at DESC"));
  assert.ok(query.includes("LIMIT ?"));
  assert.equal(params.length, 1);
  assert.equal(params[0], 100);
});

test("buildDeadLetterQuery with channel filter", () => {
  const { query, params } = buildDeadLetterQuery("slack");
  assert.ok(query.includes("SELECT * FROM gateway_dead_letters"));
  assert.ok(query.includes("WHERE channel = ?"));
  assert.ok(query.includes("ORDER BY moved_to_dead_letter_at DESC"));
  assert.equal(params.length, 2);
  assert.equal(params[0], "slack");
  assert.equal(params[1], 100);
});

test("buildDeadLetterQuery with custom limit", () => {
  const { query, params } = buildDeadLetterQuery(undefined, 50);
  assert.equal(params.length, 1);
  assert.equal(params[0], 50);
});

test("buildDeadLetterCountQuery with no channel filter", () => {
  const { query, params } = buildDeadLetterCountQuery();
  assert.ok(query.includes("SELECT channel, COUNT(*) as count FROM gateway_dead_letters"));
  assert.ok(query.includes("GROUP BY channel"));
  assert.equal(params.length, 0);
});

test("buildDeadLetterCountQuery with channel filter", () => {
  const { query, params } = buildDeadLetterCountQuery("webhook");
  assert.ok(query.includes("SELECT channel, COUNT(*) as count FROM gateway_dead_letters"));
  assert.ok(query.includes("WHERE channel = ?"));
  assert.ok(query.includes("GROUP BY channel"));
  assert.equal(params.length, 1);
  assert.equal(params[0], "webhook");
});

test("DEFAULT_DELIVERY_CONFIG has correct values", () => {
  assert.equal(DEFAULT_DELIVERY_CONFIG.maxRetries, 5);
  assert.equal(DEFAULT_DELIVERY_CONFIG.initialBackoffMs, 1000);
  assert.equal(DEFAULT_DELIVERY_CONFIG.maxBackoffMs, 60000);
  assert.equal(DEFAULT_DELIVERY_CONFIG.backoffMultiplier, 2);
  assert.equal(DEFAULT_DELIVERY_CONFIG.timeoutMs, 30000);
  assert.deepEqual(DEFAULT_DELIVERY_CONFIG.retryableStatuses, [408, 429, 500, 502, 503, 504]);
});

test("DEFAULT_RATE_LIMIT_CONFIG has all channels", () => {
  assert.ok(DEFAULT_RATE_LIMIT_CONFIG.telegram);
  assert.ok(DEFAULT_RATE_LIMIT_CONFIG.slack);
  assert.ok(DEFAULT_RATE_LIMIT_CONFIG.webhook);
  assert.ok(DEFAULT_RATE_LIMIT_CONFIG.default);

  assert.equal(DEFAULT_RATE_LIMIT_CONFIG.telegram!.limit, 30);
  assert.equal(DEFAULT_RATE_LIMIT_CONFIG.slack!.limit, 30);
  assert.equal(DEFAULT_RATE_LIMIT_CONFIG.webhook!.limit, 100);
  assert.equal(DEFAULT_RATE_LIMIT_CONFIG.default!.limit, 50);
});

test("CHANNEL_DELIVERY_DDL contains required tables", () => {
  assert.ok(CHANNEL_DELIVERY_DDL.includes("delivery_messages"));
  assert.ok(CHANNEL_DELIVERY_DDL.includes("delivery_attempts"));
  assert.ok(CHANNEL_DELIVERY_DDL.includes("replay_nonces"));
  assert.ok(CHANNEL_DELIVERY_DDL.includes("gateway_dead_letters"));
  assert.ok(CHANNEL_DELIVERY_DDL.includes("gateway_rate_limits"));
});

test("CHANNEL_DELIVERY_DDL contains required indexes", () => {
  assert.ok(CHANNEL_DELIVERY_DDL.includes("idx_delivery_messages_status"));
  assert.ok(CHANNEL_DELIVERY_DDL.includes("idx_delivery_attempts_message"));
  assert.ok(CHANNEL_DELIVERY_DDL.includes("idx_gateway_dead_letters_channel"));
  assert.ok(CHANNEL_DELIVERY_DDL.includes("idx_gateway_rate_limits_channel_window"));
});

test("PendingDelivery structure is correct", () => {
  const delivery: PendingDelivery = {
    messageId: "msg_123",
    channel: "slack",
    targetId: "target_456",
    payload: { text: "Hello" },
    attempts: 0,
    maxRetries: 5,
    createdAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(delivery.messageId, "msg_123");
  assert.equal(delivery.channel, "slack");
  assert.equal(delivery.attempts, 0);
  assert.equal(delivery.maxRetries, 5);
});

test("RetryableDelivery structure is correct", () => {
  const delivery: RetryableDelivery = {
    messageId: "msg_123",
    channel: "slack",
    targetId: "target_456",
    payload: { text: "Hello" },
    attempts: 2,
    maxRetries: 5,
    nextRetryAt: "2026-04-14T00:01:00.000Z",
  };
  assert.equal(delivery.attempts, 2);
  assert.equal(delivery.nextRetryAt, "2026-04-14T00:01:00.000Z");
});

test("DeadLetterEntry structure is correct", () => {
  const entry: DeadLetterEntry = {
    messageId: "msg_123",
    channel: "webhook",
    targetId: "target_456",
    payload: { text: "Failed message" },
    failureReason: "timeout",
    lastErrorMessage: "Connection refused",
    lastResponseStatus: 504,
    attempts: 5,
    firstFailedAt: "2026-04-14T00:00:00.000Z",
    movedToDeadLetterAt: "2026-04-14T00:05:00.000Z",
  };
  assert.equal(entry.failureReason, "timeout");
  assert.equal(entry.lastResponseStatus, 504);
  assert.equal(entry.attempts, 5);
});
