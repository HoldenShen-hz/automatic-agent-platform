import assert from "node:assert/strict";
import test from "node:test";
import { DistributedRateLimiter } from "../../../../../src/platform/interface/ingress/distributed-rate-limiter.js";
test("DistributedRateLimiter uses in-memory fallback when no Redis configured", async () => {
    const limiter = new DistributedRateLimiter({
        maxCalls: 3,
        windowMs: 1000,
    });
    // First 3 calls should be allowed
    for (let i = 0; i < 3; i++) {
        const result = await limiter.checkAndConsume("tenant:abc");
        assert.equal(result.allowed, true);
        assert.equal(result.remaining, 3 - i - 1);
    }
    // 4th call should be rejected
    const rejected = await limiter.checkAndConsume("tenant:abc");
    assert.equal(rejected.allowed, false);
    assert.equal(rejected.remaining, 0);
    assert.ok(rejected.retryAfterMs !== undefined);
});
test("DistributedRateLimiter resets after window expires", async () => {
    const limiter = new DistributedRateLimiter({
        maxCalls: 2,
        windowMs: 50,
    });
    assert.equal((await limiter.checkAndConsume("key1")).allowed, true);
    assert.equal((await limiter.checkAndConsume("key1")).allowed, true);
    assert.equal((await limiter.checkAndConsume("key1")).allowed, false);
    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 60));
    assert.equal((await limiter.checkAndConsume("key1")).allowed, true);
});
test("DistributedRateLimiter tracks separate keys independently", async () => {
    const limiter = new DistributedRateLimiter({
        maxCalls: 2,
        windowMs: 1000,
    });
    // Exhaust key1
    assert.equal((await limiter.checkAndConsume("key1")).allowed, true);
    assert.equal((await limiter.checkAndConsume("key1")).allowed, true);
    assert.equal((await limiter.checkAndConsume("key1")).allowed, false);
    // key2 should still be allowed
    assert.equal((await limiter.checkAndConsume("key2")).allowed, true);
    assert.equal((await limiter.checkAndConsume("key2")).allowed, true);
});
test("DistributedRateLimiter applies custom config defaults", async () => {
    const limiter = new DistributedRateLimiter({});
    assert.equal((await limiter.checkAndConsume("default_key")).allowed, true);
});
//# sourceMappingURL=distributed-rate-limiter.test.js.map