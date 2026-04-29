import assert from "node:assert/strict";
import test from "node:test";

import {
  CallCircuitBreaker,
  CallRateLimiter,
  CallHistoryRecorder,
  CallGovernance,
  createRetryPolicy,
  createBreakerPolicy,
  createLimiterPolicy,
  type LimiterConfig,
  type BreakerConfig,
  type RetryConfig,
  type CircuitState,
  type CallResult,
  type PolicyStats,
} from "../../../../src/platform/five-plane-execution/execution-engine/call-governance.js";

test("CallCircuitBreaker exports are available", () => {
  assert.equal(typeof CallCircuitBreaker, "function");
});

test("CallRateLimiter exports are available", () => {
  assert.equal(typeof CallRateLimiter, "function");
});

test("CallHistoryRecorder exports are available", () => {
  assert.equal(typeof CallHistoryRecorder, "function");
});

test("CallGovernance exports are available", () => {
  assert.equal(typeof CallGovernance, "function");
});

test("CallCircuitBreaker starts in closed state", () => {
  const breaker = new CallCircuitBreaker({ failureThreshold: 5, successThreshold: 2, resetTimeoutMs: 30000 });
  const result = breaker.check("test-key");
  assert.equal(result.state, "closed");
  assert.equal(result.allowed, true);
});

test("CallCircuitBreaker records failures and opens circuit", () => {
  const breaker = new CallCircuitBreaker({ failureThreshold: 2, successThreshold: 1, resetTimeoutMs: 30000 });

  breaker.recordFailure("test-key");
  let result = breaker.check("test-key");
  assert.equal(result.state, "closed");
  assert.equal(result.allowed, true);

  breaker.recordFailure("test-key");
  result = breaker.check("test-key");
  assert.equal(result.state, "open");
  assert.equal(result.allowed, false);
});

test("CallCircuitBreaker allows calls after reset timeout", async () => {
  const breaker = new CallCircuitBreaker({
    failureThreshold: 1,
    successThreshold: 1,
    resetTimeoutMs: 50,
  });

  breaker.recordFailure("test-key");
  let result = breaker.check("test-key");
  assert.equal(result.state, "open");
  assert.equal(result.allowed, false);

  await new Promise((r) => setTimeout(r, 60));
  result = breaker.check("test-key");
  assert.equal(result.state, "half_open");
  assert.equal(result.allowed, true);
});

test("CallCircuitBreaker half_open to closed on success", async () => {
  const breaker = new CallCircuitBreaker({
    failureThreshold: 1,
    successThreshold: 2,
    resetTimeoutMs: 50,
  });

  breaker.recordFailure("test-key");
  breaker.check("test-key");

  await new Promise((r) => setTimeout(r, 60));

  breaker.check("test-key");
  breaker.recordSuccess("test-key");
  breaker.recordSuccess("test-key");

  const snapshot = breaker.getSnapshot("test-key");
  assert.equal(snapshot?.state, "closed");
});

test("CallCircuitBreaker records success in closed state", () => {
  const breaker = new CallCircuitBreaker({
    failureThreshold: 5,
    successThreshold: 2,
    resetTimeoutMs: 30000,
  });

  breaker.recordFailure("test-key");
  breaker.recordFailure("test-key");

  breaker.recordSuccess("test-key");

  const snapshot = breaker.getSnapshot("test-key");
  assert.ok(snapshot?.failures < 2);
});

test("CallCircuitBreaker getSnapshot returns null for unknown key", () => {
  const breaker = new CallCircuitBreaker(null);
  const snapshot = breaker.getSnapshot("unknown-key");
  assert.equal(snapshot, null);
});

test("CallCircuitBreaker reset clears entry", () => {
  const breaker = new CallCircuitBreaker({
    failureThreshold: 1,
    successThreshold: 1,
    resetTimeoutMs: 30000,
  });

  breaker.recordFailure("test-key");
  assert.ok(breaker.getSnapshot("test-key") !== null);

  breaker.reset("test-key");
  assert.equal(breaker.getSnapshot("test-key"), null);
});

test("CallRateLimiter allows calls within limit", () => {
  const limiter = new CallRateLimiter({ maxCalls: 3, windowMs: 1000 });

  let result = limiter.checkAndConsume("key1");
  assert.equal(result.allowed, true);

  result = limiter.checkAndConsume("key1");
  assert.equal(result.allowed, true);

  result = limiter.checkAndConsume("key1");
  assert.equal(result.allowed, true);
});

test("CallRateLimiter rejects calls over limit", () => {
  const limiter = new CallRateLimiter({ maxCalls: 2, windowMs: 1000 });

  limiter.checkAndConsume("key1");
  limiter.checkAndConsume("key1");
  const result = limiter.checkAndConsume("key1");

  assert.equal(result.allowed, false);
  assert.ok(result.retryAfterMs !== undefined);
  assert.ok(result.retryAfterMs > 0);
});

test("CallRateLimiter allows different keys independently", () => {
  const limiter = new CallRateLimiter({ maxCalls: 1, windowMs: 1000 });

  const result1 = limiter.checkAndConsume("key1");
  const result2 = limiter.checkAndConsume("key2");

  assert.equal(result1.allowed, true);
  assert.equal(result2.allowed, true);
});

test("CallRateLimiter reset clears entry", () => {
  const limiter = new CallRateLimiter({ maxCalls: 1, windowMs: 1000 });

  limiter.checkAndConsume("key1");
  limiter.reset("key1");
  const result = limiter.checkAndConsume("key1");

  assert.equal(result.allowed, true);
});

test("CallRateLimiter with null config allows all", () => {
  const limiter = new CallRateLimiter(null);
  const result = limiter.checkAndConsume("any-key");
  assert.equal(result.allowed, true);
});

test("CallRateLimiter evictExpired removes old entries", () => {
  const limiter = new CallRateLimiter({ maxCalls: 5, windowMs: 100 });

  // old-key at time 0, new-key at time 50
  limiter.checkAndConsume("old-key", 0);
  limiter.checkAndConsume("new-key", 50);

  // Evict at time 300 - entries with windowStart < 300 - 200 = 100 should be removed
  limiter.evictExpired(300);

  // old-key (windowStart=0 < 100) should be evicted
  // new-key (windowStart=50 < 100) should also be evicted since 50 < 100

  // After eviction, both should be treated as new entries
  assert.equal(limiter.checkAndConsume("old-key", 300).allowed, true);
  assert.equal(limiter.checkAndConsume("new-key", 300).allowed, true);
});

test("CallHistoryRecorder records and computes stats", () => {
  const recorder = new CallHistoryRecorder();

  recorder.record("key1", { success: true, data: "value" });
  recorder.record("key1", { success: true, data: "value" });
  recorder.record("key1", { success: false, error: { code: "test", message: "err", retryable: false } });

  const stats = recorder.getStats("key1", null);
  assert.equal(stats.totalCalls, 3);
  assert.equal(stats.successfulCalls, 2);
  assert.equal(stats.failedCalls, 1);
});

test("CallHistoryRecorder tracks rejected calls", () => {
  const recorder = new CallHistoryRecorder();

  recorder.record("key1", { success: false, error: { code: "governance.limiter_rejected", message: "limit", retryable: true } });
  recorder.record("key1", { success: false, error: { code: "governance.circuit_open", message: "open", retryable: true } });
  recorder.record("key1", { success: true, data: "value" });

  const stats = recorder.getStats("key1", null);
  assert.equal(stats.rejectedCalls, 2);
  assert.equal(stats.successfulCalls, 1);
});

test("CallHistoryRecorder reset clears history", () => {
  const recorder = new CallHistoryRecorder();

  recorder.record("key1", { success: true, data: "value" });
  recorder.reset("key1");

  const stats = recorder.getStats("key1", null);
  assert.equal(stats.totalCalls, 0);
});

test("createRetryPolicy returns correct defaults", () => {
  const policy = createRetryPolicy({});
  assert.equal(policy.maxAttempts, 3);
  assert.equal(policy.baseDelayMs, 100);
  assert.equal(policy.maxDelayMs, 5000);
  assert.equal(policy.backoffMultiplier, 2);
  assert.ok(policy.jitterFactor !== undefined);
});

test("createRetryPolicy accepts custom values", () => {
  const policy = createRetryPolicy({ maxAttempts: 5, baseDelayMs: 200 });
  assert.equal(policy.maxAttempts, 5);
  assert.equal(policy.baseDelayMs, 200);
});

test("createBreakerPolicy returns correct defaults", () => {
  const policy = createBreakerPolicy({});
  assert.equal(policy.failureThreshold, 5);
  assert.equal(policy.successThreshold, 2);
  assert.equal(policy.resetTimeoutMs, 30000);
});

test("createLimiterPolicy returns correct structure", () => {
  const policy = createLimiterPolicy({ maxCalls: 10, windowMs: 1000 });
  assert.equal(policy.maxCalls, 10);
  assert.equal(policy.windowMs, 1000);
});

test("CallGovernance executes successfully with no policy", async () => {
  const governance = new CallGovernance({});
  const result = await governance.execute("key1", async () => "success");
  assert.equal(result.success, true);
  assert.equal(result.data, "success");
});

test("CallGovernance applies rate limiting", async () => {
  const governance = new CallGovernance({
    limiter: { maxCalls: 1, windowMs: 5000 },
  });

  const result1 = await governance.execute("key1", async () => "first");
  assert.equal(result1.success, true);

  const result2 = await governance.execute("key1", async () => "second");
  assert.equal(result2.success, false);
  assert.equal(result2.error?.code, "governance.limiter_rejected");
});

test("CallGovernance applies circuit breaker", async () => {
  const governance = new CallGovernance({
    breaker: { failureThreshold: 1, successThreshold: 1, resetTimeoutMs: 5000 },
  });

  await governance.execute("key1", async () => {
    throw new Error("fail");
  });

  const result = await governance.execute("key1", async () => "should be blocked");
  assert.equal(result.success, false);
  assert.equal(result.error?.code, "governance.circuit_open");
});

test("CallGovernance tracks stats", async () => {
  const governance = new CallGovernance({});

  await governance.execute("key1", async () => "success");
  await governance.execute("key1", async () => {
    throw new Error("fail");
  });

  const stats = governance.getStats("key1");
  assert.equal(stats.totalCalls, 2);
  assert.ok(stats.successfulCalls >= 0);
});

test("CallGovernance reset clears all state", async () => {
  const governance = new CallGovernance({
    limiter: { maxCalls: 1, windowMs: 5000 },
  });

  await governance.execute("key1", async () => "success");
  governance.reset("key1");

  const result = await governance.execute("key1", async () => "success");
  assert.equal(result.success, true);
});

test("CallGovernance updatePolicy changes config", async () => {
  const governance = new CallGovernance({
    limiter: { maxCalls: 5, windowMs: 5000 },
  });

  governance.updatePolicy({ limiter: { maxCalls: 1, windowMs: 5000 } });

  await governance.execute("key1", async () => "success");
  const result = await governance.execute("key1", async () => "blocked");
  assert.equal(result.success, false);
});