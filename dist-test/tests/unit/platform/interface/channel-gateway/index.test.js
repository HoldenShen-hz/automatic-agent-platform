import assert from "node:assert/strict";
import test from "node:test";
// Barrel test for gateway module
import { CHANNEL_DELIVERY_DDL, DEFAULT_DELIVERY_CONFIG, DEFAULT_RATE_LIMIT_CONFIG, UserPortalService, calculateBackoffForAttempt, } from "../../../../../src/platform/interface/channel-gateway/index.js";
test("CHANNEL_DELIVERY_DDL is a non-empty string", () => {
    assert.ok(typeof CHANNEL_DELIVERY_DDL === "string");
    assert.ok(CHANNEL_DELIVERY_DDL.length > 0);
    assert.ok(CHANNEL_DELIVERY_DDL.includes("CREATE TABLE"));
});
test("DEFAULT_DELIVERY_CONFIG has correct structure", () => {
    assert.equal(DEFAULT_DELIVERY_CONFIG.maxRetries, 5);
    assert.equal(DEFAULT_DELIVERY_CONFIG.initialBackoffMs, 1000);
    assert.equal(DEFAULT_DELIVERY_CONFIG.maxBackoffMs, 60000);
    assert.equal(DEFAULT_DELIVERY_CONFIG.backoffMultiplier, 2);
    assert.equal(DEFAULT_DELIVERY_CONFIG.timeoutMs, 30000);
    assert.deepEqual(DEFAULT_DELIVERY_CONFIG.retryableStatuses, [408, 429, 500, 502, 503, 504]);
});
test("DEFAULT_RATE_LIMIT_CONFIG has correct structure", () => {
    assert.ok(DEFAULT_RATE_LIMIT_CONFIG.telegram);
    assert.ok(DEFAULT_RATE_LIMIT_CONFIG.slack);
    assert.ok(DEFAULT_RATE_LIMIT_CONFIG.webhook);
    assert.ok(DEFAULT_RATE_LIMIT_CONFIG.default);
    assert.equal(DEFAULT_RATE_LIMIT_CONFIG.telegram.limit, 30);
    assert.equal(DEFAULT_RATE_LIMIT_CONFIG.slack.limit, 30);
    assert.equal(DEFAULT_RATE_LIMIT_CONFIG.webhook.limit, 100);
});
test("calculateBackoffForAttempt returns correct backoff", () => {
    const config = {
        maxRetries: 5,
        initialBackoffMs: 1000,
        maxBackoffMs: 60000,
        backoffMultiplier: 2,
        timeoutMs: 30000,
        retryableStatuses: [408, 429, 500, 502, 503, 504],
    };
    // First attempt: 1000 * 2^0 = 1000
    assert.equal(calculateBackoffForAttempt(config, 1), 1000);
    // Second attempt: 1000 * 2^1 = 2000
    assert.equal(calculateBackoffForAttempt(config, 2), 2000);
    // Third attempt: 1000 * 2^2 = 4000
    assert.equal(calculateBackoffForAttempt(config, 3), 4000);
});
test("calculateBackoffForAttempt caps at maxBackoffMs", () => {
    const config = {
        maxRetries: 10,
        initialBackoffMs: 1000,
        maxBackoffMs: 10000,
        backoffMultiplier: 2,
        timeoutMs: 30000,
        retryableStatuses: [408, 429, 500, 502, 503, 504],
    };
    // Should cap at 10000 for high attempt numbers
    assert.equal(calculateBackoffForAttempt(config, 10), 10000);
    assert.equal(calculateBackoffForAttempt(config, 20), 10000);
});
test("DeadLetterEntry structure is correct", () => {
    const entry = {
        messageId: "msg_123",
        channel: "slack",
        targetId: "target_456",
        payload: { content: "test" },
        failureReason: "timeout",
        lastErrorMessage: "Connection timed out",
        lastResponseStatus: 504,
        attempts: 3,
        firstFailedAt: "2026-04-14T00:00:00.000Z",
        movedToDeadLetterAt: "2026-04-14T00:05:00.000Z",
    };
    assert.equal(entry.messageId, "msg_123");
    assert.equal(entry.channel, "slack");
    assert.equal(entry.attempts, 3);
});
test("PendingDelivery structure is correct", () => {
    const delivery = {
        messageId: "msg_789",
        channel: "webhook",
        targetId: "target_abc",
        payload: { data: "test" },
        attempts: 1,
        maxRetries: 5,
        createdAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(delivery.messageId, "msg_789");
    assert.equal(delivery.maxRetries, 5);
});
test("RetryableDelivery structure is correct", () => {
    const delivery = {
        messageId: "msg_retry",
        channel: "telegram",
        targetId: "target_retry",
        payload: { data: "retry test" },
        attempts: 2,
        maxRetries: 5,
        nextRetryAt: "2026-04-14T00:01:00.000Z",
    };
    assert.equal(delivery.attempts, 2);
    assert.ok(delivery.nextRetryAt !== null);
});
test("DeliveryMessageRecord structure is correct", () => {
    const record = {
        attempts: 3,
        maxRetries: 5,
    };
    assert.equal(record.attempts, 3);
    assert.equal(record.maxRetries, 5);
});
test("UserPortalService is exported from gateway barrel", () => {
    assert.equal(typeof UserPortalService, "function");
});
//# sourceMappingURL=index.test.js.map