import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";

import {
  CallGovernance,
  CallCircuitBreaker,
  CallHistoryRecorder,
  CallRateLimiter,
  type DistributedRateLimiterLike,
  createRetryPolicy,
  createBreakerPolicy,
  createLimiterPolicy,
} from "../../../src/platform/execution/execution-engine/call-governance.js";

test("CallRateLimiter enforces per-key windows independently", () => {
  const limiter = new CallRateLimiter({ maxCalls: 1, windowMs: 1000 });

  assert.equal(limiter.checkAndConsume("alpha").allowed, true);
  assert.equal(limiter.checkAndConsume("alpha").allowed, false);
  assert.equal(limiter.checkAndConsume("beta").allowed, true);
});

test("CallCircuitBreaker exposes reusable state transitions", () => {
  const breaker = new CallCircuitBreaker({
    failureThreshold: 2,
    successThreshold: 1,
    resetTimeoutMs: 50,
  });

  breaker.check("svc");
  breaker.recordFailure("svc");
  breaker.check("svc");
  breaker.recordFailure("svc");

  assert.equal(breaker.check("svc").state, "open");
  assert.equal(breaker.getSnapshot("svc")?.state, "open");
});

test("CallHistoryRecorder keeps bounded stats independent of governance orchestration", () => {
  const history = new CallHistoryRecorder();
  history.record("svc", { success: true });
  history.record("svc", { success: false, error: { code: "provider.failed", message: "x", retryable: false } });
  history.record("svc", { success: false, error: { code: "governance.circuit_open", message: "x", retryable: true } });

  const stats = history.getStats("svc", {
    failures: 2,
    state: "open",
    lastFailure: Date.parse("2026-04-11T10:00:00.000Z"),
  });
  assert.equal(stats.totalCalls, 3);
  assert.equal(stats.successfulCalls, 1);
  assert.equal(stats.failedCalls, 1);
  assert.equal(stats.rejectedCalls, 1);
  assert.equal(stats.currentCircuitState, "open");
});

test("CallGovernance execute succeeds when call succeeds", async () => {
  const gov = new CallGovernance({});
  const result = await gov.execute("key1", async () => "hello");
  assert.equal(result.success, true);
  assert.equal(result.data, "hello");
  assert.equal(result.metadata?.attempts, 1);
});

test("CallGovernance execute fails when call throws with non-retryable code", async () => {
  // Must provide nonRetryableCodes in retry policy for "auth" to be recognized
  const gov = new CallGovernance({
    retry: { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 100, backoffMultiplier: 2, nonRetryableCodes: ["auth"] },
  });
  const result = await gov.execute("key1", async () => {
    const err = Object.assign(new Error("auth failure"), { code: "auth_failure" });
    throw err;
  });
  assert.equal(result.success, false);
  assert.equal(result.error?.code, "auth_failure");
  assert.equal(result.error?.retryable, false);
  assert.equal(result.metadata?.attempts, 1); // no retries
});

test("CallGovernance limiter rejects at maxCalls", async () => {
  const gov = new CallGovernance({
    limiter: { maxCalls: 2, windowMs: 1000 },
  });

  await gov.execute("limit_key", async () => "ok");
  await gov.execute("limit_key", async () => "ok");
  const third = await gov.execute("limit_key", async () => "ok");

  assert.equal(third.success, false);
  assert.equal(third.error?.code, "governance.limiter_rejected");
  assert.equal(third.error?.retryable, true);
  assert.ok(third.error?.retryAfterMs != null);
});

test("CallGovernance can use a distributed rate limiter when provided", async () => {
  const calls: string[] = [];
  const distributedRateLimiter: DistributedRateLimiterLike = {
    async checkAndConsume(key: string) {
      calls.push(key);
      return {
        allowed: calls.length < 2,
        retryAfterMs: calls.length < 2 ? undefined : 250,
      };
    },
  };

  const gov = new CallGovernance(
    { limiter: { maxCalls: 99, windowMs: 1000 } },
    { distributedRateLimiter },
  );

  const first = await gov.execute("distributed_key", async () => "ok");
  const second = await gov.execute("distributed_key", async () => "blocked");

  assert.equal(first.success, true);
  assert.equal(second.success, false);
  assert.equal(second.error?.code, "governance.limiter_rejected");
  assert.equal(second.error?.retryAfterMs, 250);
  assert.deepEqual(calls, ["distributed_key", "distributed_key"]);
});

test("CallGovernance limiter window resets after windowMs", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });

  try {
    const gov = new CallGovernance({
      limiter: { maxCalls: 1, windowMs: 50 },
    });

    const first = await gov.execute("window_key", async () => "first");
    assert.equal(first.success, true);

    const second = await gov.execute("window_key", async () => "should fail");
    assert.equal(second.success, false);

    mock.timers.tick(60);

    const third = await gov.execute("window_key", async () => "after window");
    assert.equal(third.success, true);
  } finally {
    mock.timers.reset();
  }
});

test("CallGovernance retry retries on retryable errors", async () => {
  let attempts = 0;
  const gov = new CallGovernance({
    retry: { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 100, backoffMultiplier: 2 },
  });

  const result = await gov.execute("retry_key", async () => {
    attempts++;
    if (attempts < 3) {
      const err = Object.assign(new Error("transient error"), { code: "transient" });
      throw err;
    }
    return "success on attempt 3";
  });

  assert.equal(result.success, true);
  assert.equal(result.data, "success on attempt 3");
  assert.equal(result.metadata?.attempts, 3);
});

test("CallGovernance retry does not retry on non-retryable errors", async () => {
  let attempts = 0;
  const gov = new CallGovernance({
    retry: {
      maxAttempts: 3,
      baseDelayMs: 10,
      maxDelayMs: 100,
      backoffMultiplier: 2,
      retryableCodes: ["transient"],
      nonRetryableCodes: ["auth"],
    },
  });

  const result = await gov.execute("noretry_key", async () => {
    attempts++;
    const err = Object.assign(new Error("auth failure"), { code: "auth_failure" });
    throw err;
  });

  assert.equal(result.success, false);
  assert.equal(result.metadata?.attempts, 1); // no retries
});

test("CallGovernance circuit breaker opens after failure threshold", async () => {
  const gov = new CallGovernance({
    breaker: { failureThreshold: 3, successThreshold: 2, resetTimeoutMs: 1000 },
    retry: { maxAttempts: 1, baseDelayMs: 10, maxDelayMs: 100, backoffMultiplier: 2 },
  });

  // Fail 3 times to open the breaker
  for (let i = 0; i < 3; i++) {
    await gov.execute("breaker_key", async () => { throw new Error("fail"); });
  }

  // Next call should be rejected by breaker
  const result = await gov.execute("breaker_key", async () => "should not run");
  assert.equal(result.success, false);
  assert.equal(result.error?.code, "governance.circuit_open");
  assert.equal(result.metadata?.circuitState, "open");
});

test("CallGovernance circuit breaker half-open after resetTimeout", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });

  try {
    const gov = new CallGovernance({
      breaker: { failureThreshold: 2, successThreshold: 1, resetTimeoutMs: 50 },
      retry: { maxAttempts: 1, baseDelayMs: 10, maxDelayMs: 100, backoffMultiplier: 2 },
    });

    await gov.execute("hb_key", async () => { throw new Error("fail"); });
    await gov.execute("hb_key", async () => { throw new Error("fail"); });

    mock.timers.tick(60);

    const result = await gov.execute("hb_key", async () => "half-open success");
    assert.equal(result.success, true);
    assert.equal(result.metadata?.circuitState, "half_open");
  } finally {
    mock.timers.reset();
  }
});

test("CallGovernance getStats returns correct counts", async () => {
  const gov = new CallGovernance({});

  await gov.execute("stats_key", async () => "ok");
  await gov.execute("stats_key", async () => { throw new Error("fail"); });
  await gov.execute("stats_key", async () => "ok");

  const stats = gov.getStats("stats_key");
  assert.equal(stats.totalCalls, 3);
  assert.equal(stats.successfulCalls, 2);
  assert.equal(stats.failedCalls, 1);
  assert.equal(stats.rejectedCalls, 0);
});

test("CallGovernance getStats counts rejections separately", async () => {
  const gov = new CallGovernance({
    limiter: { maxCalls: 1, windowMs: 1000 },
  });

  await gov.execute("rej_key", async () => "ok");
  await gov.execute("rej_key", async () => "should fail");
  await gov.execute("rej_key", async () => "should fail again");

  const stats = gov.getStats("rej_key");
  assert.equal(stats.totalCalls, 3);
  assert.equal(stats.successfulCalls, 1);
  assert.equal(stats.failedCalls, 0);
  assert.equal(stats.rejectedCalls, 2);
});

test("CallGovernance reset clears all state", async () => {
  const gov = new CallGovernance({
    limiter: { maxCalls: 1, windowMs: 10000 },
  });

  await gov.execute("reset_key", async () => "ok");
  await gov.execute("reset_key", async () => "rejected");
  assert.equal(gov.getStats("reset_key").rejectedCalls, 1);

  gov.reset("reset_key");
  const after = await gov.execute("reset_key", async () => "ok");
  assert.equal(after.success, true);
  assert.equal(gov.getStats("reset_key").totalCalls, 1);
});

test("createRetryPolicy has correct defaults", () => {
  const policy = createRetryPolicy();
  assert.equal(policy.maxAttempts, 3);
  assert.equal(policy.baseDelayMs, 100);
  assert.equal(policy.maxDelayMs, 5000);
  assert.equal(policy.backoffMultiplier, 2);
  assert.equal(policy.jitterFactor, 0.1);
  assert.ok(policy.retryableCodes!.includes("transient"));
  assert.ok(policy.nonRetryableCodes!.includes("auth"));
});

test("createBreakerPolicy has correct defaults", () => {
  const policy = createBreakerPolicy();
  assert.equal(policy.failureThreshold, 5);
  assert.equal(policy.successThreshold, 2);
  assert.equal(policy.resetTimeoutMs, 30000);
});

test("createLimiterPolicy requires maxCalls and windowMs", () => {
  const policy = createLimiterPolicy({ maxCalls: 10, windowMs: 1000 });
  assert.equal(policy.maxCalls, 10);
  assert.equal(policy.windowMs, 1000);
});

test("CallGovernance updatePolicy merges correctly", async () => {
  const gov = new CallGovernance({
    limiter: { maxCalls: 5, windowMs: 1000 },
  });

  // Use up some limiter capacity
  for (let i = 0; i < 4; i++) {
    await gov.execute("update_key", async () => "ok");
  }

  // Update policy to higher limit
  gov.updatePolicy({ limiter: { maxCalls: 10, windowMs: 1000 } });

  // Now can make more calls
  for (let i = 0; i < 5; i++) {
    const r = await gov.execute("update_key", async () => "ok");
    assert.equal(r.success, true);
  }
});

test("CallGovernance retry delay has exponential backoff", async () => {
  const gov = new CallGovernance({
    retry: { maxAttempts: 4, baseDelayMs: 1, maxDelayMs: 10, backoffMultiplier: 2, jitterFactor: 0 },
  });

  let attempts = 0;
  const result = await gov.execute("delay_key", async () => {
    attempts++;
    if (attempts < 4) {
      const err = new Error("retryable");
      (err as typeof err & { code: string }).code = "transient";
      throw err;
    }
    return "done";
  });

  assert.equal(attempts, 4, "Should have made 4 attempts with retries");
  assert.equal(result.success, true);
  assert.equal(result.metadata?.attempts, 4);
});

test("CallGovernance with retryAfterMs from error uses that delay", async () => {
  const gov = new CallGovernance({
    retry: { maxAttempts: 2, baseDelayMs: 10000, maxDelayMs: 10000, backoffMultiplier: 2 },
  });

  let attempts = 0;
  const result = await gov.execute("retryafter_key", async () => {
    attempts++;
    if (attempts < 2) {
      // retryAfterMs: 1 overrides the 10000ms baseDelayMs, keeping the test fast
      const err = Object.assign(new Error("rate limited"), { code: "rate_limit", retryAfterMs: 1 });
      throw err;
    }
    return "done";
  });

  // Verify retryAfterMs was used - should only attempt twice and complete quickly
  assert.equal(attempts, 2, "Should have retried with retryAfterMs");
  assert.equal(result.success, true);
});
