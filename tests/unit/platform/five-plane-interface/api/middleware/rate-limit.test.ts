import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  RateLimiter,
  RateLimitMiddleware,
  createRateLimiter,
  getGlobalRateLimiter,
  resetGlobalRateLimiter,
  DEFAULT_RATE_LIMIT_CONFIG,
} from "../../../../../../src/platform/five-plane-interface/api/middleware/rate-limit.js";

test("RateLimiter.check consumes token and returns allowed", () => {
  const limiter = new RateLimiter({ maxRequests: 100, windowMs: 60_000 });
  const result = limiter.check("test-key");
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 99);
});

test("RateLimiter.check returns not allowed when tokens exhausted", () => {
  const limiter = new RateLimiter({ maxRequests: 1, windowMs: 60_000 });
  limiter.check("test-key");
  const result = limiter.check("test-key");
  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
});

test("RateLimiter.check refills tokens after window passes", () => {
  const limiter = new RateLimiter({ maxRequests: 2, windowMs: 10 }); // 10ms window
  limiter.check("test-key");
  limiter.check("test-key");

  // Exhaust tokens
  const blocked = limiter.check("test-key");
  assert.equal(blocked.allowed, false);

  // Wait for window to pass
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      const allowed = limiter.check("test-key");
      assert.equal(allowed.allowed, true);
      resolve();
    }, 20);
  });
});

test("RateLimiter.generateKey uses principal when perPrincipal enabled", () => {
  const limiter = new RateLimiter({ maxRequests: 100, windowMs: 60_000, perPrincipal: true });
  const key = limiter.generateKey({ principal: "user-123" });
  assert.equal(key, "principal:user-123");
});

test("RateLimiter.generateKey uses tenant when perTenant enabled", () => {
  const limiter = new RateLimiter({ maxRequests: 100, windowMs: 60_000, perTenant: true });
  const key = limiter.generateKey({ tenantId: "tenant-abc" });
  assert.equal(key, "tenant:tenant-abc");
});

test("RateLimiter.generateKey returns global when tenant/principal partitioning is disabled", () => {
  const limiter = new RateLimiter({ maxRequests: 100, windowMs: 60_000 });
  const key = limiter.generateKey({ clientIp: "192.168.1.1" });
  assert.equal(key, "global");
});

test("RateLimiter.generateKey falls back to client IP when scoped partitioning is enabled", () => {
  const limiter = new RateLimiter({ maxRequests: 100, windowMs: 60_000, perTenant: true });
  const key = limiter.generateKey({ clientIp: "192.168.1.1" });
  assert.equal(key, "ip:192.168.1.1");
});

test("RateLimiter.generateKey returns global when no context", () => {
  const limiter = new RateLimiter({ maxRequests: 100, windowMs: 60_000 });
  const key = limiter.generateKey({});
  assert.equal(key, "global");
});

test("RateLimiter.reset clears bucket for key", () => {
  const limiter = new RateLimiter({ maxRequests: 1, windowMs: 60_000 });
  limiter.check("test-key");
  limiter.reset("test-key");

  const result = limiter.check("test-key");
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 0); // consumed one token
});

test("RateLimiter.resetAll clears all buckets", () => {
  const limiter = new RateLimiter({ maxRequests: 1, windowMs: 60_000 });
  limiter.check("key-1");
  limiter.check("key-2");
  limiter.resetAll();

  const result1 = limiter.check("key-1");
  const result2 = limiter.check("key-2");
  assert.equal(result1.allowed, true);
  assert.equal(result2.allowed, true);
});

test("RateLimiter.status returns bucket info", () => {
  const limiter = new RateLimiter({ maxRequests: 10, windowMs: 60_000 });
  limiter.check("test-key");

  const status = limiter.status("test-key");
  assert.ok(status !== null);
  assert.equal(status.tokens, 9); // consumed one
});

test("RateLimiter.status returns null for unknown key", () => {
  const limiter = new RateLimiter({ maxRequests: 10, windowMs: 60_000 });
  const status = limiter.status("unknown");
  assert.equal(status, null);
});

test("RateLimitMiddleware.middleware returns check function", () => {
  const middleware = new RateLimitMiddleware();
  const checkFn = middleware.middleware();
  assert.equal(typeof checkFn, "function");
});

test("RateLimitMiddleware.middleware uses context to generate key", () => {
  const middleware = new RateLimitMiddleware({ perTenant: true });
  const check = middleware.middleware();

  const result = check({ tenantId: "tenant-123" });
  assert.equal(result.allowed, true);
});

test("RateLimitMiddleware.getLimiter returns underlying limiter", () => {
  const middleware = new RateLimitMiddleware();
  const limiter = middleware.getLimiter();
  assert.ok(limiter instanceof RateLimiter);
});

test("createRateLimiter merges config with defaults", () => {
  const limiter = createRateLimiter({ maxRequests: 500 });
  limiter.check("test"); // Initialize bucket
  const status = limiter.status("test");
  assert.ok(status !== null);
  assert.equal(status.tokens, 499);
});

test("getGlobalRateLimiter returns singleton", () => {
  resetGlobalRateLimiter();
  const instance1 = getGlobalRateLimiter();
  const instance2 = getGlobalRateLimiter();
  assert.equal(instance1, instance2);
});

test("resetGlobalRateLimiter clears singleton", () => {
  resetGlobalRateLimiter();
  const instance1 = getGlobalRateLimiter();
  resetGlobalRateLimiter();
  const instance2 = getGlobalRateLimiter();
  assert.notEqual(instance1, instance2);
});

test("DEFAULT_RATE_LIMIT_CONFIG has correct values", () => {
  assert.equal(DEFAULT_RATE_LIMIT_CONFIG.maxRequests, 100);
  assert.equal(DEFAULT_RATE_LIMIT_CONFIG.windowMs, 60_000);
  assert.equal(DEFAULT_RATE_LIMIT_CONFIG.perTenant, true);
  assert.equal(DEFAULT_RATE_LIMIT_CONFIG.perPrincipal, false);
});

test("RateLimiter.check returns retryAfterMs when blocked", () => {
  const limiter = new RateLimiter({ maxRequests: 1, windowMs: 100 });
  limiter.check("test-key");
  const result = limiter.check("test-key");

  assert.equal(result.allowed, false);
  assert.ok(result.retryAfterMs !== null);
  assert.ok(result.retryAfterMs > 0);
});
