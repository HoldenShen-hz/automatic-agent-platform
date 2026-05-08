import assert from "node:assert/strict";
import test from "node:test";
import { mock } from "node:test";

import {
  CircuitBreaker,
  CircuitBreakerOpenError,
  type CircuitBreakerState,
  type CircuitBreakerMetrics,
} from "../../../../../src/platform/model-gateway/provider-registry/circuit-breaker.js";

function createBreaker(options?: { name?: string; failureThreshold?: number; resetTimeoutMs?: number; halfOpenSuccessThreshold?: number }): CircuitBreaker {
  return new CircuitBreaker({
    name: options?.name ?? "test-breaker",
    failureThreshold: options?.failureThreshold ?? 3,
    resetTimeoutMs: options?.resetTimeoutMs ?? 1000,
    halfOpenSuccessThreshold: options?.halfOpenSuccessThreshold ?? 2,
  });
}

test("CircuitBreaker starts in closed state", () => {
  const breaker = createBreaker();
  assert.equal(breaker.getState(), "closed");
});

test("CircuitBreaker records success and increments counter", async () => {
  const breaker = createBreaker();
  const result = await breaker.execute(() => Promise.resolve("success"));
  assert.equal(result, "success");
  const metrics = breaker.getMetrics();
  assert.equal(metrics.successes, 1);
});

test("CircuitBreaker records failure and increments counter", async () => {
  const breaker = createBreaker();
  await assert.rejects(
    () => breaker.execute(async () => { throw new Error("fail"); }),
    { message: "fail" },
  );
  const metrics = breaker.getMetrics();
  assert.equal(metrics.failures, 1);
  assert.equal(metrics.consecutiveFailures, 1);
});

test("CircuitBreaker opens after failure threshold", async () => {
  const breaker = createBreaker({ failureThreshold: 3 });

  for (let i = 0; i < 3; i++) {
    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail"); }),
      { message: "fail" },
    );
  }

  assert.equal(breaker.getState(), "open");
});

test("CircuitBreaker open state rejects execute immediately", async () => {
  const breaker = createBreaker({ failureThreshold: 1, resetTimeoutMs: 10000 });

  await assert.rejects(
    () => breaker.execute(async () => { throw new Error("fail"); }),
    { message: "fail" },
  );

  await assert.rejects(
    () => breaker.execute(async () => "should fail"),
    (error: unknown) => {
      assert.ok(error instanceof CircuitBreakerOpenError);
      assert.equal(error.circuitName, "test-breaker");
      return true;
    },
  );
});

test("CircuitBreaker transitions to half_open after reset timeout", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });

  try {
    const breaker = createBreaker({ failureThreshold: 1, resetTimeoutMs: 50 });

    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail"); }),
      { message: "fail" },
    );

    assert.equal(breaker.getState(), "open");

    // Advance time past reset timeout
    mock.timers.tick(60);

    assert.equal(breaker.getState(), "half_open");
  } finally {
    mock.timers.reset();
  }
});

test("CircuitBreaker closes after success threshold in half_open", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });

  try {
    const breaker = createBreaker({ failureThreshold: 1, resetTimeoutMs: 50, halfOpenSuccessThreshold: 2 });

    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail"); }),
      { message: "fail" },
    );

    // Advance time past reset timeout
    mock.timers.tick(60);

    // In half_open state
    assert.equal(breaker.getState(), "half_open");

    // Successful calls
    await breaker.execute(async () => "ok1");
    await breaker.execute(async () => "ok2");

    assert.equal(breaker.getState(), "closed");
  } finally {
    mock.timers.reset();
  }
});

test("CircuitBreaker records lastFailureAt and lastSuccessAt", async () => {
  mock.timers.enable({ apis: ["Date"] });

  try {
    const breaker = createBreaker();

    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail"); }),
      { message: "fail" },
    );

    const failureAt = Date.now();
    const metricsAfterFailure = breaker.getMetrics();
    assert.equal(metricsAfterFailure.lastFailureAt, failureAt);

    mock.timers.tick(100);

    await breaker.execute(async () => "success");
    assert.equal(breaker.getMetrics().lastSuccessAt, Date.now());
  } finally {
    mock.timers.reset();
  }
});

test("CircuitBreaker getMetrics returns correct structure", () => {
  const breaker = createBreaker();
  const metrics = breaker.getMetrics();

  assert.equal(typeof metrics.state, "string");
  assert.equal(typeof metrics.failures, "number");
  assert.equal(typeof metrics.successes, "number");
  assert.equal(typeof metrics.consecutiveFailures, "number");
  assert.equal(typeof metrics.consecutiveSuccesses, "number");
  assert.ok(metrics.lastFailureAt === null || typeof metrics.lastFailureAt === "number");
  assert.ok(metrics.lastSuccessAt === null || typeof metrics.lastSuccessAt === "number");
});

test("CircuitBreakerOpenError has correct properties", () => {
  const retryAfterMs = 5000;
  const error = new CircuitBreakerOpenError("test message", "test-circuit", retryAfterMs);

  assert.equal(error.message, "test message");
  assert.equal(error.circuitName, "test-circuit");
  assert.equal(error.retryAfterMs, retryAfterMs);
  assert.equal(error.name, "CircuitBreakerOpenError");
});

test("CircuitBreakerOpenError accepts null retryAfterMs", () => {
  const error = new CircuitBreakerOpenError("test message", "test-circuit", null);

  assert.equal(error.retryAfterMs, null);
});

test("CircuitBreaker rejects when already open from consecutive failures", async () => {
  const breaker = createBreaker({ failureThreshold: 2 });

  await assert.rejects(
    () => breaker.execute(async () => { throw new Error("fail"); }),
    { message: "fail" },
  );

  assert.equal(breaker.getState(), "closed");

  await assert.rejects(
    () => breaker.execute(async () => { throw new Error("fail"); }),
    { message: "fail" },
  );

  assert.equal(breaker.getState(), "open");

  await assert.rejects(
    () => breaker.execute(async () => "ok"),
    (error: unknown) => error instanceof CircuitBreakerOpenError,
  );
});

test("CircuitBreaker half_open to open on failure", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });

  try {
    const breaker = createBreaker({ failureThreshold: 1, resetTimeoutMs: 50 });

    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail"); }),
      { message: "fail" },
    );

    mock.timers.tick(60);
    assert.equal(breaker.getState(), "half_open");

    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail"); }),
      { message: "fail" },
    );

    assert.equal(breaker.getState(), "open");
  } finally {
    mock.timers.reset();
  }
});

test("CircuitBreakerState type accepts all valid values", () => {
  const states: CircuitBreakerState[] = ["closed", "open", "half_open"];
  assert.equal(states.length, 3);
});

test("CircuitBreaker opens when failure rate exceeds 50% within monitoring window", async () => {
  mock.timers.enable({ apis: ["Date"] });

  try {
    const breaker = new CircuitBreaker({
      name: "rate-test",
      failureThreshold: 100, // High threshold so consecutive failures don't trigger
      resetTimeoutMs: 10000,
      halfOpenSuccessThreshold: 2,
      monitorWindowMs: 1000,
      minSampleSize: 1,
    });

    // Rate-based opening now uses recentFailures / recentRequests.
    // With minSampleSize=1, the first failed request produces 1/1 = 100%.
    const error = await breaker.execute(async () => { throw new Error("rate fail"); }).catch(e => e);
    assert.equal(error.message, "rate fail");

    // After first failure, circuit should be open due to 100% recent failure rate.
    assert.equal(breaker.getState(), "open");

    // Subsequent calls should be rejected
    const openError = await breaker.execute(async () => "ok").catch(e => e);
    assert.ok(openError instanceof CircuitBreakerOpenError);
    assert.equal(openError.circuitName, "rate-test");
  } finally {
    mock.timers.reset();
  }
});
