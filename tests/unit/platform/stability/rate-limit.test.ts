import assert from "node:assert/strict";
import test from "node:test";

import {
  CallRateLimiter,
  createLimiterPolicy,
  type LimiterConfig,
  type LimiterContext,
} from "../../../../src/platform/five-plane-execution/execution-engine/call-governance.js";

test("CallRateLimiter exports are available", () => {
  assert.equal(typeof CallRateLimiter, "function");
  assert.equal(typeof createLimiterPolicy, "function");
});

test("CallRateLimiter allows calls up to maxCalls", () => {
  const limiter = new CallRateLimiter({ maxCalls: 5, windowMs: 1000 });

  for (let i = 0; i < 5; i++) {
    const result = limiter.checkAndConsume(`key-${i}`);
    assert.equal(result.allowed, true, `Call ${i + 1} should be allowed`);
  }
});

test("CallRateLimiter blocks calls exceeding maxCalls", () => {
  const limiter = new CallRateLimiter({ maxCalls: 2, windowMs: 1000 });

  limiter.checkAndConsume("key");
  limiter.checkAndConsume("key");
  const result = limiter.checkAndConsume("key");

  assert.equal(result.allowed, false);
  assert.ok(result.retryAfterMs !== undefined);
  assert.ok(result.retryAfterMs > 0);
});

test("CallRateLimiter provides correct retryAfterMs", () => {
  const limiter = new CallRateLimiter({ maxCalls: 1, windowMs: 1000 });
  const now = Date.now();

  limiter.checkAndConsume("key", now);
  const result = limiter.checkAndConsume("key", now + 100);

  assert.equal(result.allowed, false);
  assert.ok(result.retryAfterMs !== undefined);
  assert.ok(result.retryAfterMs >= 900);
});

test("CallRateLimiter window resets after windowMs", () => {
  const limiter = new CallRateLimiter({ maxCalls: 1, windowMs: 100 });

  limiter.checkAndConsume("key", 0);
  const blocked = limiter.checkAndConsume("key", 50);
  assert.equal(blocked.allowed, false);

  const allowed = limiter.checkAndConsume("key", 110);
  assert.equal(allowed.allowed, true);
});

test("CallRateLimiter separate windows per key", () => {
  const limiter = new CallRateLimiter({ maxCalls: 1, windowMs: 1000 });

  limiter.checkAndConsume("key-a");
  limiter.checkAndConsume("key-b");

  assert.equal(limiter.checkAndConsume("key-a").allowed, false);
  assert.equal(limiter.checkAndConsume("key-b").allowed, false);
});

test("CallRateLimiter reset clears specific key", () => {
  const limiter = new CallRateLimiter({ maxCalls: 1, windowMs: 1000 });

  limiter.checkAndConsume("key-a");
  limiter.checkAndConsume("key-b");

  limiter.reset("key-a");

  assert.equal(limiter.checkAndConsume("key-a").allowed, true);
  assert.equal(limiter.checkAndConsume("key-b").allowed, false);
});

test("CallRateLimiter null config allows all", () => {
  const limiter = new CallRateLimiter(null);
  const result = limiter.checkAndConsume("any-key");
  assert.equal(result.allowed, true);
});

test("CallRateLimiter undefined config allows all", () => {
  const limiter = new CallRateLimiter(undefined);
  const result = limiter.checkAndConsume("any-key");
  assert.equal(result.allowed, true);
});

test("CallRateLimiter evictExpired removes old entries", () => {
  const limiter = new CallRateLimiter({ maxCalls: 5, windowMs: 100 });

  limiter.checkAndConsume("old-key", 0);
  limiter.checkAndConsume("new-key", 0);

  limiter.evictExpired(300);

  const oldResult = limiter.checkAndConsume("old-key", 300);
  assert.equal(oldResult.allowed, true);
});

test("CallRateLimiter evictExpired preserves recent entries", () => {
  const limiter = new CallRateLimiter({ maxCalls: 1, windowMs: 100 });

  limiter.checkAndConsume("recent-key", 100);
  limiter.evictExpired(150);

  const result = limiter.checkAndConsume("recent-key", 150);
  assert.equal(result.allowed, false);
});

test("CallRateLimiter updateConfig changes limit", () => {
  const limiter = new CallRateLimiter({ maxCalls: 2, windowMs: 1000 });

  limiter.checkAndConsume("key");
  limiter.checkAndConsume("key");
  assert.equal(limiter.checkAndConsume("key").allowed, false);

  limiter.updateConfig({ maxCalls: 3, windowMs: 1000 });
  assert.equal(limiter.checkAndConsume("key").allowed, true);
});

test("createLimiterPolicy creates correct config", () => {
  const policy = createLimiterPolicy({ maxCalls: 100, windowMs: 60000 });
  assert.equal(policy.maxCalls, 100);
  assert.equal(policy.windowMs, 60000);
});

test("LimiterContext interface structure", () => {
  const context: LimiterContext = {
    provider: "openai",
    model: "gpt-4",
    tenantId: "tenant-123",
    taskId: "task-456",
    endpoint: "/v1/chat/completions",
  };

  assert.equal(context.provider, "openai");
  assert.equal(context.model, "gpt-4");
  assert.equal(context.tenantId, "tenant-123");
  assert.equal(context.taskId, "task-456");
  assert.equal(context.endpoint, "/v1/chat/completions");
});

test("LimiterConfig interface structure", () => {
  const config: LimiterConfig = {
    maxCalls: 100,
    windowMs: 60000,
  };

  assert.equal(config.maxCalls, 100);
  assert.equal(config.windowMs, 60000);
  assert.equal(config.keyGenerator, undefined);
});

test("LimiterConfig with custom keyGenerator", () => {
  const customKey = "custom-key";
  const config: LimiterConfig = {
    maxCalls: 10,
    windowMs: 1000,
    keyGenerator: (context: LimiterContext) => {
      return context.tenantId ?? customKey;
    },
  };

  assert.ok(config.keyGenerator !== undefined);
  assert.equal(config.keyGenerator({ tenantId: "tenant-abc" }), "tenant-abc");
});

test("CallRateLimiter tracks count correctly", () => {
  const limiter = new CallRateLimiter({ maxCalls: 3, windowMs: 1000 });

  const r1 = limiter.checkAndConsume("key");
  const r2 = limiter.checkAndConsume("key");
  const r3 = limiter.checkAndConsume("key");
  const r4 = limiter.checkAndConsume("key");

  assert.equal(r1.allowed, true);
  assert.equal(r2.allowed, true);
  assert.equal(r3.allowed, true);
  assert.equal(r4.allowed, false);
});

test("CallRateLimiter sliding window behavior", () => {
  const limiter = new CallRateLimiter({ maxCalls: 2, windowMs: 100 });

  limiter.checkAndConsume("key", 0);
  limiter.checkAndConsume("key", 0);
  assert.equal(limiter.checkAndConsume("key", 0).allowed, false);

  // At t=50, window hasn't expired (50 < 100), so new call is blocked
  assert.equal(limiter.checkAndConsume("key", 50).allowed, false);

  // At t=101, window has expired (101 - 0 = 101 >= 100), so new entry created
  assert.equal(limiter.checkAndConsume("key", 101).allowed, true);
  assert.equal(limiter.checkAndConsume("key", 101).allowed, true);
  assert.equal(limiter.checkAndConsume("key", 101).allowed, false);
});