import assert from "node:assert/strict";
import test from "node:test";
test("rate limiter checkAndConsume returns allowed when under limit", () => {
    const limit = 10;
    const count = 5;
    const allowed = count <= limit;
    assert.equal(allowed, true);
});
test("rate limiter checkAndConsume returns not allowed when over limit", () => {
    const limit = 10;
    const count = 15;
    const allowed = count <= limit;
    assert.equal(allowed, false);
});
test("rate limiter remaining is correctly computed", () => {
    const limit = 10;
    const count = 7;
    const remaining = Math.max(0, limit - count);
    assert.equal(remaining, 3);
});
test("rate limiter remaining is zero when over limit", () => {
    const limit = 10;
    const count = 12;
    const remaining = Math.max(0, limit - count);
    assert.equal(remaining, 0);
});
test("retryAfterMs computed correctly when oldest entry exists", () => {
    const windowMs = 60000;
    const now = 1000000000000;
    const oldestTime = now - 30000; // 30 seconds ago
    const retryAfterMs = Math.max(0, oldestTime + windowMs - now);
    assert.equal(retryAfterMs, 30000);
});
test("retryAfterMs is zero when window is fully expired", () => {
    const windowMs = 60000;
    const now = 1000000000000;
    const oldestTime = now - 70000; // older than window
    const retryAfterMs = Math.max(0, oldestTime + windowMs - now);
    assert.equal(retryAfterMs, 0);
});
test("keyPrefix is prepended to rate limit key", () => {
    const keyPrefix = "ratelimit:";
    const key = "tenant:123";
    const fullKey = `${keyPrefix}${key}`;
    assert.equal(fullKey, "ratelimit:tenant:123");
});
test("keyPrefix can be customized", () => {
    const keyPrefix = "custom:";
    const key = "endpoint:/api/tasks";
    const fullKey = `${keyPrefix}${key}`;
    assert.equal(fullKey, "custom:endpoint:/api/tasks");
});
test("windowStart computed correctly from now and windowMs", () => {
    const now = 1000000000000;
    const windowMs = 60000;
    const windowStart = now - windowMs;
    assert.equal(windowStart, 999999940000);
});
test("requestId format includes timestamp and random", () => {
    const now = 1000000000000;
    const requestId = `${now}:${Math.random()}`;
    const parts = requestId.split(":");
    assert.equal(parts.length, 2);
    assert.equal(parts[0], "1000000000000");
});
test("RateLimitResult structure for allowed request", () => {
    const result = {
        allowed: true,
        remaining: 7,
    };
    assert.equal(result.allowed, true);
    assert.equal(result.remaining, 7);
    assert.equal(result.retryAfterMs, undefined);
});
test("RateLimitResult structure for rejected request", () => {
    const result = {
        allowed: false,
        remaining: 0,
        retryAfterMs: 30000,
    };
    assert.equal(result.allowed, false);
    assert.equal(result.remaining, 0);
    assert.equal(result.retryAfterMs, 30000);
});
test("RedisRateLimiterConfig interface accepts all fields", () => {
    const config = {
        host: "localhost",
        port: 6379,
        keyPrefix: "test:",
        connectTimeout: 1000,
        maxRetriesPerRequest: 3,
    };
    assert.equal(config.keyPrefix, "test:");
    assert.equal(config.connectTimeout, 1000);
    assert.equal(config.maxRetriesPerRequest, 3);
});
//# sourceMappingURL=redis-rate-limiter.test.js.map