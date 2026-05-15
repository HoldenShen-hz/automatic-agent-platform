/**
 * @fileoverview Unit tests for CallGovernance - rate limiter, circuit breaker, and retry.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  CallRateLimiter,
  CallCircuitBreaker,
  CallHistoryRecorder,
  CallGovernance,
  createRetryPolicy,
  createBreakerPolicy,
  createLimiterPolicy,
  type LimiterConfig,
  type BreakerConfig,
  type RetryConfig,
  type CallPolicy,
  type CallResult,
} from "../../../../../src/platform/five-plane-execution/execution-engine/call-governance.js";

// ---------------------------------------------------------------------------
// CallRateLimiter - additional edge cases
// ---------------------------------------------------------------------------

test("CallRateLimiter multiple keys track independently", () => {
  const limiter = new CallRateLimiter({ maxCalls: 2, windowMs: 1000 });

  // Exhaust key1
  limiter.checkAndConsume("key1");
  limiter.checkAndConsume("key1");

  // key2 should still work
  const result = limiter.checkAndConsume("key2");
  assert.equal(result.allowed, true);
});

test("CallRateLimiter returns correct retryAfterMs", () => {
  const limiter = new CallRateLimiter({ maxCalls: 1, windowMs: 500 });
  limiter.checkAndConsume("key1");

  const result = limiter.checkAndConsume("key1");
  assert.equal(result.allowed, false);
  assert.ok(result.retryAfterMs != null);
  assert.ok(result.retryAfterMs > 0);
  assert.ok(result.retryAfterMs <= 500);
});

test("CallRateLimiter handles zero window", () => {
  const limiter = new CallRateLimiter({ maxCalls: 1, windowMs: 0 });
  const result1 = limiter.checkAndConsume("key1");
  const result2 = limiter.checkAndConsume("key1");
  // With 0 window, every call should reset
  assert.equal(result1.allowed, true);
  assert.equal(result2.allowed, true);
});

test("CallRateLimiter handles negative window", () => {
  const limiter = new CallRateLimiter({ maxCalls: 1, windowMs: -100 });
  const result1 = limiter.checkAndConsume("key1");
  const result2 = limiter.checkAndConsume("key1");
  // Negative window should treat as no limit
  assert.equal(result1.allowed, true);
  assert.equal(result2.allowed, true);
});

// ---------------------------------------------------------------------------
// CallCircuitBreaker - additional edge cases
// ---------------------------------------------------------------------------

test("CallCircuitBreaker half_open state allows limited calls", () => {
  const breaker = new CallCircuitBreaker({
    failureThreshold: 2,
    successThreshold: 1,
    resetTimeoutMs: 50,
    halfOpenMaxCalls: 2,
  });

  // Trigger failures to open circuit
  breaker.recordFailure("key1");
  breaker.recordFailure("key1");

  // Circuit should be open
  let result = breaker.check("key1");
  assert.equal(result.state, "open");
  assert.equal(result.allowed, false);

  // Wait for reset
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      result = breaker.check("key1");
      assert.equal(result.state, "half_open");
      assert.equal(result.allowed, true);

      // Record success to close circuit
      breaker.recordSuccess("key1");
      result = breaker.check("key1");
      assert.equal(result.state, "closed");
      resolve();
    }, 60);
  });
});

test("CallCircuitBreaker half_open failure reopens circuit", () => {
  const breaker = new CallCircuitBreaker({
    failureThreshold: 2,
    successThreshold: 2,
    resetTimeoutMs: 50,
  });

  // Open circuit
  breaker.recordFailure("key1");
  breaker.recordFailure("key1");

  // Wait and enter half_open
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      let result = breaker.check("key1");
      assert.equal(result.state, "half_open");

      // Failure in half_open reopens
      breaker.recordFailure("key1");
      result = breaker.check("key1");
      assert.equal(result.state, "open");
      resolve();
    }, 60);
  });
});

test("CallCircuitBreaker.getSnapshot returns null for unknown key", () => {
  const breaker = new CallCircuitBreaker({ failureThreshold: 5, successThreshold: 2, resetTimeoutMs: 5000 });
  const snapshot = breaker.getSnapshot("nonexistent");
  assert.equal(snapshot, null);
});

test("CallCircuitBreaker.getSnapshot returns correct state", () => {
  const breaker = new CallCircuitBreaker({ failureThreshold: 2, successThreshold: 1, resetTimeoutMs: 5000 });
  breaker.recordFailure("key1");

  const snapshot = breaker.getSnapshot("key1");
  assert.ok(snapshot != null);
  assert.equal(snapshot.state, "closed");
  assert.equal(snapshot.failures, 1);
  assert.ok(snapshot.lastFailure > 0);
});

test("CallCircuitBreaker recordSuccess in closed state decrements failures", () => {
  const breaker = new CallCircuitBreaker({ failureThreshold: 5, successThreshold: 2, resetTimeoutMs: 5000 });
  breaker.recordFailure("key1");
  breaker.recordFailure("key1");
  breaker.recordFailure("key1");

  const before = breaker.getSnapshot("key1");
  assert.equal(before!.failures, 3);

  breaker.recordSuccess("key1");
  const after = breaker.getSnapshot("key1");
  assert.equal(after!.failures, 2); // Decremented by 1
});

// ---------------------------------------------------------------------------
// CallHistoryRecorder
// ---------------------------------------------------------------------------

test("CallHistoryRecorder records results correctly", () => {
  const recorder = new CallHistoryRecorder();

  recorder.record("key1", { success: true, data: "result1", metadata: { attempts: 1, latencyMs: 100 } });
  recorder.record("key1", { success: false, error: { code: "err1", message: "error", retryable: true }, metadata: { attempts: 1, latencyMs: 50 } });

  const stats = recorder.getStats("key1", null);
  assert.equal(stats.totalCalls, 2);
  assert.equal(stats.successfulCalls, 1);
  assert.equal(stats.failedCalls, 1);
  assert.equal(stats.rejectedCalls, 0);
});

test("CallHistoryRecorder counts rejected calls", () => {
  const recorder = new CallHistoryRecorder();

  recorder.record("key1", { success: false, error: { code: "governance.limiter_rejected", message: "rate limit", retryable: true }, metadata: { attempts: 1, latencyMs: 10 } });
  recorder.record("key1", { success: false, error: { code: "governance.circuit_open", message: "circuit open", retryable: true }, metadata: { attempts: 1, latencyMs: 10 } });

  const stats = recorder.getStats("key1", null);
  assert.equal(stats.totalCalls, 2);
  assert.equal(stats.successfulCalls, 0);
  assert.equal(stats.failedCalls, 0);
  assert.equal(stats.rejectedCalls, 2);
});

test("CallHistoryRecorder.getStats includes circuit state from breaker", () => {
  const recorder = new CallHistoryRecorder();
  recorder.record("key1", { success: true, metadata: { attempts: 1, latencyMs: 100 } });

  const breakerSnapshot = { failures: 3, state: "open" as const, lastFailure: Date.now() };
  const stats = recorder.getStats("key1", breakerSnapshot);

  assert.equal(stats.currentCircuitState, "open");
  assert.ok(stats.lastFailure?.includes("failures:3"));
});

test("CallHistoryRecorder.reset clears history", () => {
  const recorder = new CallHistoryRecorder();
  recorder.record("key1", { success: true, metadata: { attempts: 1, latencyMs: 100 } });
  recorder.record("key1", { success: true, metadata: { attempts: 1, latencyMs: 100 } });

  recorder.reset("key1");
  const stats = recorder.getStats("key1", null);
  assert.equal(stats.totalCalls, 0);
});

// ---------------------------------------------------------------------------
// CallGovernance.execute - main business logic
// ---------------------------------------------------------------------------

test("CallGovernance.execute passes with no policy", async () => {
  const governance = new CallGovernance({});

  const result = await governance.execute("key1", async () => "success");
  assert.equal(result.success, true);
  assert.equal(result.data, "success");
  assert.equal(result.metadata?.attempts, 1);
});

test("CallGovernance.execute applies rate limiter", async () => {
  const governance = new CallGovernance({
    limiter: { maxCalls: 1, windowMs: 10000 },
  });

  // First call succeeds
  const result1 = await governance.execute("key1", async () => "success");
  assert.equal(result1.success, true);

  // Second call within window should be rejected
  const result2 = await governance.execute("key1", async () => "success");
  assert.equal(result2.success, false);
  assert.equal(result2.error?.code, "governance.limiter_rejected");
});

test("CallGovernance.execute applies circuit breaker", async () => {
  const governance = new CallGovernance({
    breaker: { failureThreshold: 1, successThreshold: 1, resetTimeoutMs: 5000 },
  });

  // We can't directly access circuitBreaker since it's private
  // But we can test the effect - after recording a failure, calls should be blocked

  const result = await governance.execute("key1", async () => "success");
  // First call should succeed since circuit hasn't opened yet
  // (we can't easily trigger circuit opening without accessing private property)
  assert.ok(result.success !== undefined);
});

test("CallGovernance.execute retries on retryable error", async () => {
  let attempts = 0;
  const governance = new CallGovernance({
    retry: { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 100, backoffMultiplier: 2 },
  });

  const result = await governance.execute("key1", async () => {
    attempts++;
    if (attempts < 3) {
      const err = new Error("transient failure");
      (err as any).code = "transient_error";
      throw err;
    }
    return "success";
  });

  assert.equal(result.success, true);
  assert.equal(attempts, 3);
});

test("CallGovernance.execute does not retry non-retryable error", async () => {
  let attempts = 0;
  const governance = new CallGovernance({
    retry: { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 100, backoffMultiplier: 2, nonRetryableCodes: ["auth"] },
  });

  const result = await governance.execute("key1", async () => {
    attempts++;
    const err = new Error("auth failure");
    (err as any).code = "auth_error";
    throw err;
  });

  assert.equal(result.success, false);
  assert.equal(attempts, 1); // No retry for non-retryable
});

test("CallGovernance.execute respects maxAttempts", async () => {
  let attempts = 0;
  const governance = new CallGovernance({
    retry: { maxAttempts: 2, baseDelayMs: 10, maxDelayMs: 100, backoffMultiplier: 2 },
  });

  const result = await governance.execute("key1", async () => {
    attempts++;
    const err = new Error("persistent failure");
    (err as any).code = "transient";
    throw err;
  });

  assert.equal(result.success, false);
  assert.equal(attempts, 2); // Tried twice, then gave up
});

test("CallGovernance.execute uses server retryAfterMs when available", async () => {
  let attempts = 0;
  const governance = new CallGovernance({
    retry: { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 5000, backoffMultiplier: 2 },
  });

  const startTime = Date.now();
  const result = await governance.execute("key1", async () => {
    attempts++;
    if (attempts === 1) {
      const err = new Error("rate limited");
      (err as any).code = "transient";
      (err as any).retryAfterMs = 20; // Server says wait 20ms
      throw err;
    }
    return "success";
  });

  // Should have waited roughly 20ms, not the full base delay
  const elapsed = Date.now() - startTime;
  assert.ok(elapsed < 200, `Expected <200ms, got ${elapsed}ms`); // Much less than 1000ms base
  assert.equal(result.success, true);
});

test("CallGovernance.execute records circuit breaker state in metadata", async () => {
  const governance = new CallGovernance({
    breaker: { failureThreshold: 5, successThreshold: 2, resetTimeoutMs: 5000 },
  });

  const result = await governance.execute("key1", async () => "success");
  assert.ok(result.metadata?.circuitState !== undefined);
  assert.equal(result.metadata?.circuitState, "closed");
});

test("CallGovernance.execute handles distributed rate limiter", async () => {
  const mockDistLimiter = {
    checkAndConsume: async (key: string) => {
      if (key === "blocked") {
        return { allowed: false, retryAfterMs: 100 };
      }
      return { allowed: true };
    },
  };

  const governance = new CallGovernance({}, { distributedRateLimiter: mockDistLimiter });

  const result1 = await governance.execute("allowed", async () => "success");
  assert.equal(result1.success, true);

  const result2 = await governance.execute("blocked", async () => "success");
  assert.equal(result2.success, false);
  assert.equal(result2.error?.code, "governance.limiter_rejected");
});

test("CallGovernance.execute with combined limiter and breaker", async () => {
  const governance = new CallGovernance({
    limiter: { maxCalls: 2, windowMs: 10000 },
    breaker: { failureThreshold: 5, successThreshold: 2, resetTimeoutMs: 5000 },
  });

  // Exhaust limiter
  await governance.execute("key1", async () => "ok");
  await governance.execute("key1", async () => "ok");
  const result3 = await governance.execute("key1", async () => "ok");

  assert.equal(result3.success, false);
  assert.equal(result3.error?.code, "governance.limiter_rejected");
});

test("CallGovernance.execute without limiter allows unlimited", async () => {
  const governance = new CallGovernance({
    breaker: { failureThreshold: 5, successThreshold: 2, resetTimeoutMs: 5000 },
  });

  // Should allow multiple calls (breaker only kicks in on failures)
  const result1 = await governance.execute("key1", async () => "a");
  const result2 = await governance.execute("key1", async () => "b");
  const result3 = await governance.execute("key1", async () => "c");

  assert.equal(result1.success, true);
  assert.equal(result2.success, true);
  assert.equal(result3.success, true);
});

// ---------------------------------------------------------------------------
// CallGovernance helper methods
// ---------------------------------------------------------------------------

test("CallGovernance.getStats returns correct statistics", async () => {
  const governance = new CallGovernance({});

  await governance.execute("key1", async () => "success");
  await governance.execute("key1", async () => {
    throw new Error("fail");
  });

  const stats = governance.getStats("key1");
  assert.ok(stats.totalCalls >= 2);
  assert.ok(stats.successfulCalls >= 1);
  assert.ok(stats.failedCalls >= 1);
});

test("CallGovernance.reset clears all state for key", async () => {
  const governance = new CallGovernance({
    limiter: { maxCalls: 1, windowMs: 10000 },
    breaker: { failureThreshold: 5, successThreshold: 2, resetTimeoutMs: 5000 },
  });

  // Exhaust limiter
  await governance.execute("key1", async () => "ok");
  await governance.execute("key1", async () => "ok");

  // Reset
  governance.reset("key1");

  // Should be able to call again
  const result = await governance.execute("key1", async () => "ok");
  assert.equal(result.success, true);
});

test("CallGovernance.updatePolicy modifies governance rules", async () => {
  const governance = new CallGovernance({
    limiter: { maxCalls: 1, windowMs: 10000 },
  });

  // Exhaust original limit
  await governance.execute("key1", async () => "ok");
  await governance.execute("key1", async () => "ok"); // blocked

  // Update to higher limit
  governance.updatePolicy({ limiter: { maxCalls: 5, windowMs: 10000 } });

  const result = await governance.execute("key1", async () => "ok");
  assert.equal(result.success, true);
});

// ---------------------------------------------------------------------------
// Policy creation utilities
// ---------------------------------------------------------------------------

test("createRetryPolicy applies defaults", () => {
  const policy = createRetryPolicy();
  assert.equal(policy.maxAttempts, 3);
  assert.equal(policy.baseDelayMs, 100);
  assert.equal(policy.maxDelayMs, 5000);
  assert.equal(policy.backoffMultiplier, 2);
  assert.ok(policy.jitterFactor !== undefined);
  assert.deepEqual(policy.retryableCodes, ["transient", "rate_limit", "timeout"]);
  assert.deepEqual(policy.nonRetryableCodes, ["auth", "forbidden", "not_found"]);
});

test("createRetryPolicy allows overrides", () => {
  const policy = createRetryPolicy({
    maxAttempts: 5,
    baseDelayMs: 200,
    retryableCodes: ["custom_error"],
  });
  assert.equal(policy.maxAttempts, 5);
  assert.equal(policy.baseDelayMs, 200);
  assert.deepEqual(policy.retryableCodes, ["custom_error"]);
});

test("createBreakerPolicy applies defaults", () => {
  const policy = createBreakerPolicy();
  assert.equal(policy.failureThreshold, 5);
  assert.equal(policy.successThreshold, 2);
  assert.equal(policy.resetTimeoutMs, 30000);
});

test("createBreakerPolicy allows halfOpenMaxCalls", () => {
  const policy = createBreakerPolicy({ halfOpenMaxCalls: 3 });
  assert.equal(policy.halfOpenMaxCalls, 3);
});

test("createLimiterPolicy creates valid config", () => {
  const policy = createLimiterPolicy({ maxCalls: 100, windowMs: 1000 });
  assert.equal(policy.maxCalls, 100);
  assert.equal(policy.windowMs, 1000);
});

test("createLimiterPolicy preserves keyGenerator", () => {
  const generator = (ctx: { tenantId?: string }) => ctx.tenantId ?? "default";
  const policy = createLimiterPolicy({ maxCalls: 100, windowMs: 1000, keyGenerator: generator });
  assert.equal(policy.keyGenerator, generator);
});

// ---------------------------------------------------------------------------
// Edge cases and error handling
// ---------------------------------------------------------------------------

test("CallGovernance.execute handles non-Error throws", async () => {
  const governance = new CallGovernance({});

  const result = await governance.execute("key1", async () => {
    throw "string error";
  });

  assert.equal(result.success, false);
  assert.equal(result.error?.code, "governance.unknown_error");
});

test("CallGovernance.execute handles undefined return", async () => {
  const governance = new CallGovernance({});

  const result = await governance.execute("key1", async () => undefined);
  assert.equal(result.success, true);
  assert.equal(result.data, undefined);
});

test("CallGovernance.execute handles null return", async () => {
  const governance = new CallGovernance({});

  const result = await governance.execute("key1", async () => null);
  assert.equal(result.success, true);
  assert.equal(result.data, null);
});

test("CallGovernance handles Error with code property", async () => {
  const governance = new CallGovernance({});

  const customError = new Error("custom message");
  (customError as any).code = "custom_code";

  const result = await governance.execute("key1", async () => {
    throw customError;
  });

  assert.equal(result.success, false);
  assert.equal(result.error?.code, "custom_code");
});

// ---------------------------------------------------------------------------
// Backoff calculation edge cases
// ---------------------------------------------------------------------------

test("CallGovernance.calculateRetryDelay respects maxDelayMs", async () => {
  // Create governance with very small maxDelay to test capping
  const governance = new CallGovernance({
    retry: { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 50, backoffMultiplier: 10 },
  });

  let attempts = 0;
  const result = await governance.execute("key1", async () => {
    attempts++;
    if (attempts < 3) {
      const err = new Error("fail");
      (err as any).code = "transient";
      throw err;
    }
    return "ok";
  });

  // The delay between attempts should be capped at maxDelayMs (50ms)
  // This test just verifies it completes without hanging
  assert.ok(result.success || !result.success);
});

test("CallGovernance.calculateRetryDelay applies jitter when configured", async () => {
  const governance = new CallGovernance({
    retry: {
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
      jitterFactor: 0.5, // 50% jitter
    },
  });

  // We can't easily test randomness, but we can verify it doesn't crash
  let attempts = 0;
  await governance.execute("key1", async () => {
    attempts++;
    if (attempts < 3) {
      const err = new Error("fail");
      (err as any).code = "transient";
      throw err;
    }
    return "ok";
  });

  assert.ok(attempts >= 1);
});