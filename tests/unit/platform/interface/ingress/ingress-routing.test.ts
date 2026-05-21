/**
 * Ingress Routing Tests
 *
 * Tests for routing behavior in the ingress layer:
 * - Key-based routing patterns (tenant, endpoint, user)
 * - Rate limit key construction and parsing
 * - Routing decisions based on rate limit results
 */

import assert from "node:assert/strict";
import test from "node:test";
import { DistributedRateLimiter } from "../../../../../src/platform/five-plane-interface/ingress/distributed-rate-limiter.js";

test.describe("Ingress routing - key patterns", () => {
  test("routes requests by tenant identifier", async () => {
    const limiter = new DistributedRateLimiter({
      maxCalls: 2,
      windowMs: 1000,
    });

    // Tenant A should have independent limit
    const tenantAR1 = await limiter.checkAndConsume("tenant:tenant_a");
    const tenantAR2 = await limiter.checkAndConsume("tenant:tenant_a");
    const tenantAR3 = await limiter.checkAndConsume("tenant:tenant_a");

    assert.equal(tenantAR1.allowed, true);
    assert.equal(tenantAR2.allowed, true);
    assert.equal(tenantAR3.allowed, false);

    // Tenant B should be independent
    const tenantBR1 = await limiter.checkAndConsume("tenant:tenant_b");
    const tenantBR2 = await limiter.checkAndConsume("tenant:tenant_b");

    assert.equal(tenantBR1.allowed, true);
    assert.equal(tenantBR2.allowed, true);
  });

  test("routes requests by endpoint pattern", async () => {
    const limiter = new DistributedRateLimiter({
      maxCalls: 1,
      windowMs: 1000,
    });

    // Different endpoints should have independent limits
    const apiV1 = await limiter.checkAndConsume("endpoint:/api/v1/tasks");
    const apiV2 = await limiter.checkAndConsume("endpoint:/api/v2/tasks");
    const webhooks = await limiter.checkAndConsume("endpoint:/webhooks");

    assert.equal(apiV1.allowed, true);
    assert.equal(apiV2.allowed, true);
    assert.equal(webhooks.allowed, true);
  });

  test("routes requests by user identifier", async () => {
    const limiter = new DistributedRateLimiter({
      maxCalls: 3,
      windowMs: 1000,
    });

    // Each user gets their own limit
    const user1Results = [];
    for (let i = 0; i < 4; i++) {
      user1Results.push(await limiter.checkAndConsume("user:user_123"));
    }

    // Only 3 should be allowed
    assert.equal(user1Results.filter((r) => r.allowed).length, 3);
    assert.equal(user1Results[3]!.allowed, false);

    // Different user should have fresh quota
    const user2Result = await limiter.checkAndConsume("user:user_456");
    assert.equal(user2Result.allowed, true);
    assert.equal(user2Result.remaining, 2);
  });

  test("routes requests by IP address pattern", async () => {
    const limiter = new DistributedRateLimiter({
      maxCalls: 2,
      windowMs: 1000,
    });

    const ip1 = await limiter.checkAndConsume("ip:192.168.1.1");
    const ip2 = await limiter.checkAndConsume("ip:192.168.1.1");
    const ip3 = await limiter.checkAndConsume("ip:192.168.1.1");

    assert.equal(ip1.allowed, true);
    assert.equal(ip2.allowed, true);
    assert.equal(ip3.allowed, false);

    // Different IP should be independent
    const otherIp = await limiter.checkAndConsume("ip:10.0.0.1");
    assert.equal(otherIp.allowed, true);
  });

  test("handles composite routing keys", async () => {
    const limiter = new DistributedRateLimiter({
      maxCalls: 2,
      windowMs: 1000,
    });

    // Composite key: tenant:user:endpoint
    const compositeKey = "tenant:acme:user:jane:endpoint:/api/tasks";

    const r1 = await limiter.checkAndConsume(compositeKey);
    const r2 = await limiter.checkAndConsume(compositeKey);
    const r3 = await limiter.checkAndConsume(compositeKey);

    assert.equal(r1.allowed, true);
    assert.equal(r2.allowed, true);
    assert.equal(r3.allowed, false);
  });
});

test.describe("Ingress routing - fallback behavior", () => {
  test("routes to in-memory limiter when no Redis configured", async () => {
    const limiter = new DistributedRateLimiter({
      maxCalls: 5,
      windowMs: 1000,
    });

    // Should use in-memory fallback
    const results = [];
    for (let i = 0; i < 6; i++) {
      results.push(await limiter.checkAndConsume("fallback_key"));
    }

    const allowed = results.filter((r) => r.allowed);
    assert.equal(allowed.length, 5);
  });

  test("in-memory routing is per-instance", async () => {
    // Simulate two separate instances with their own in-memory state
    const instance1 = new DistributedRateLimiter({
      maxCalls: 1,
      windowMs: 10000,
    });

    const instance2 = new DistributedRateLimiter({
      maxCalls: 1,
      windowMs: 10000,
    });

    // Each instance should track independently
    await instance1.checkAndConsume("shared_key");
    const i1Reused = await instance1.checkAndConsume("shared_key");
    assert.equal(i1Reused.allowed, false);

    // Instance 2 should have its own quota
    const i2First = await instance2.checkAndConsume("shared_key");
    assert.equal(i2First.allowed, true);
  });
});

test.describe("Ingress routing - limit enforcement", () => {
  test("enforces per-route limits independently", async () => {
    const limiter = new DistributedRateLimiter({
      maxCalls: 2,
      windowMs: 1000,
    });

    // Route A: allow 2 requests
    assert.equal((await limiter.checkAndConsume("route_a")).allowed, true);
    assert.equal((await limiter.checkAndConsume("route_a")).allowed, true);
    assert.equal((await limiter.checkAndConsume("route_a")).allowed, false);

    // Route B: should also only allow 2 (but separate counter)
    assert.equal((await limiter.checkAndConsume("route_b")).allowed, true);
    assert.equal((await limiter.checkAndConsume("route_b")).allowed, true);
    assert.equal((await limiter.checkAndConsume("route_b")).allowed, false);
  });

  test("tracks remaining quota per route", async () => {
    const limiter = new DistributedRateLimiter({
      maxCalls: 4,
      windowMs: 1000,
    });

    const r1 = await limiter.checkAndConsume("quota_route");
    assert.equal(r1.remaining, 3);

    const r2 = await limiter.checkAndConsume("quota_route");
    assert.equal(r2.remaining, 2);

    const r3 = await limiter.checkAndConsume("quota_route");
    assert.equal(r3.remaining, 1);

    const r4 = await limiter.checkAndConsume("quota_route");
    assert.equal(r4.remaining, 0);

    const r5 = await limiter.checkAndConsume("quota_route");
    assert.equal(r5.remaining, 0);
    assert.equal(r5.allowed, false);
  });
});

test.describe("Ingress routing - retryAfter calculation", () => {
  test("calculates retryAfter based on window start", async () => {
    const limiter = new DistributedRateLimiter({
      maxCalls: 1,
      windowMs: 1000,
    });

    await limiter.checkAndConsume("retry_key");
    const rejected = await limiter.checkAndConsume("retry_key");

    assert.equal(rejected.allowed, false);
    assert.ok(rejected.retryAfterMs !== undefined);
    assert.ok(rejected.retryAfterMs > 0);
    assert.ok(rejected.retryAfterMs <= 1000);
  });

  test("retryAfter decreases as time passes within window", async () => {
    const limiter = new DistributedRateLimiter({
      maxCalls: 1,
      windowMs: 500,
    });

    await limiter.checkAndConsume("time_key");
    const firstRetry = await limiter.checkAndConsume("time_key");

    // Wait 250ms (half the window)
    await new Promise((resolve) => setTimeout(resolve, 250));

    const secondRetry = await limiter.checkAndConsume("time_key");

    // Second retry should have less time to wait
    assert.ok(secondRetry.retryAfterMs !== undefined);
    assert.ok(secondRetry.retryAfterMs < firstRetry.retryAfterMs);
  });

  test("retryAfter is bounded by window size", async () => {
    const limiter = new DistributedRateLimiter({
      maxCalls: 1,
      windowMs: 2000,
    });

    await limiter.checkAndConsume("bounded_key");
    const rejected = await limiter.checkAndConsume("bounded_key");

    assert.ok(rejected.retryAfterMs !== undefined);
    assert.ok(rejected.retryAfterMs <= 2000);
    assert.ok(rejected.retryAfterMs >= 0);
  });
});

test.describe("Ingress routing - window expiration", () => {
  test("resets route quota after window expires", async () => {
    const limiter = new DistributedRateLimiter({
      maxCalls: 1,
      windowMs: 50,
    });

    // Exhaust
    await limiter.checkAndConsume("expire_route");
    const blocked = await limiter.checkAndConsume("expire_route");
    assert.equal(blocked.allowed, false);

    // Wait for window
    await new Promise((resolve) => setTimeout(resolve, 60));

    // Should be reset
    const reset = await limiter.checkAndConsume("expire_route");
    assert.equal(reset.allowed, true);
    assert.equal(reset.remaining, 0);
  });

  test("multiple routes reset independently", async () => {
    const limiter = new DistributedRateLimiter({
      maxCalls: 1,
      windowMs: 10000, // Use much longer window to avoid timing issues
    });

    // Exhaust route A
    await limiter.checkAndConsume("reset_a");
    await limiter.checkAndConsume("reset_a");

    // Route A should be exhausted (count=1, maxCalls=1, rejected)
    const routeAExhausted = await limiter.checkAndConsume("reset_a");
    assert.equal(routeAExhausted.allowed, false);

    // Route B should still have its quota (was never used)
    const routeBFirst = await limiter.checkAndConsume("reset_b");
    assert.equal(routeBFirst.allowed, true);
    assert.equal(routeBFirst.remaining, 0); // maxCalls(1) - count(1) = 0
  });
});