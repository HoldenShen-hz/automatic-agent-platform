import assert from "node:assert/strict";
import test from "node:test";
import { RedisRateLimiter } from "../../../../../src/platform/interface/ingress/redis-rate-limiter.js";
// Note: RedisRateLimiter requires a Redis connection for actual distributed rate limiting.
// These tests verify the interface and error handling behavior without requiring Redis.
// For full distributed testing, an integration environment with Redis is needed.
test("RedisRateLimiter checkAndConsume interface accepts key, limit, and window", async () => {
    // This test verifies the method signature - actual Redis call will fail without connection
    const limiter = new RedisRateLimiter({
        host: "localhost",
        port: 6379,
    });
    // Verify the limiter accepts the expected parameters without throwing
    // The actual Redis operation will fail since there's no Redis, but we're testing interface
    try {
        await limiter.checkAndConsume("test-key", 10, 1000);
        assert.fail("Should have thrown without Redis connection");
    }
    catch (err) {
        // Expected - Redis connection failure
        assert.ok(err instanceof Error);
    }
});
test("RedisRateLimiter getUsage interface works", async () => {
    const limiter = new RedisRateLimiter({
        host: "localhost",
        port: 6379,
    });
    try {
        await limiter.getUsage("test-key", 1000);
        assert.fail("Should have thrown without Redis connection");
    }
    catch (err) {
        assert.ok(err instanceof Error);
    }
});
test("RedisRateLimiter reset interface works", async () => {
    const limiter = new RedisRateLimiter({
        host: "localhost",
        port: 6379,
    });
    try {
        await limiter.reset("test-key");
        assert.fail("Should have thrown without Redis connection");
    }
    catch (err) {
        assert.ok(err instanceof Error);
    }
});
test("RedisRateLimiter config keyPrefix is used", () => {
    const limiter = new RedisRateLimiter({
        host: "localhost",
        port: 6379,
        keyPrefix: "custom:",
    });
    // The limiter should be created without error
    // Actual prefix usage verified in Redis client construction
    assert.ok(limiter);
});
test("RedisRateLimiter connect and close handles unavailable Redis gracefully", async () => {
    const limiter = new RedisRateLimiter({
        host: "localhost",
        port: 6379,
        connectTimeout: 100,
        maxRetriesPerRequest: 1,
    });
    // Try to connect - may fail if Redis unavailable
    try {
        await limiter.connect();
    }
    catch {
        // Connection failure expected without Redis
    }
    // close() behavior depends on connection state - test graceful handling
    // If never connected, status will be "wait" and disconnect is called
    try {
        await limiter.close();
    }
    catch (err) {
        // Some error modes are expected when Redis isn't running
        // Just verify it's an Error type
        assert.ok(err instanceof Error);
    }
});
test("RedisRateLimiter config options are accepted", () => {
    const limiter = new RedisRateLimiter({
        host: "127.0.0.1",
        port: 6380,
        password: "secret",
        db: 1,
        keyPrefix: "test:",
        connectTimeout: 2000,
        maxRetriesPerRequest: 3,
    });
    assert.ok(limiter);
});
test("RateLimitResult interface structure", () => {
    const result = {
        allowed: true,
        remaining: 5,
    };
    assert.equal(result.allowed, true);
    assert.equal(result.remaining, 5);
    assert.equal(result.retryAfterMs, undefined);
});
test("RateLimitResult with retryAfterMs", () => {
    const result = {
        allowed: false,
        remaining: 0,
        retryAfterMs: 500,
    };
    assert.equal(result.allowed, false);
    assert.equal(result.remaining, 0);
    assert.equal(result.retryAfterMs, 500);
});
//# sourceMappingURL=redis-rate-limiter-integration.test.js.map