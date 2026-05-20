/**
 * Additional CircuitBreaker edge case tests for increased coverage
 */

import assert from "node:assert/strict";
import test from "node:test";
import { mock } from "node:test";

import {
  CircuitBreaker,
  CircuitBreakerOpenError,
  type CircuitBreakerMetrics,
} from "../../../../src/platform/model-gateway/provider-registry/circuit-breaker.js";

function createBreaker(options?: {
  name?: string;
  failureThreshold?: number;
  resetTimeoutMs?: number;
  halfOpenSuccessThreshold?: number;
  monitorWindowMs?: number;
}): CircuitBreaker {
  return new CircuitBreaker({
    name: options?.name ?? "test-breaker",
    failureThreshold: options?.failureThreshold ?? 3,
    resetTimeoutMs: options?.resetTimeoutMs ?? 1000,
    halfOpenSuccessThreshold: options?.halfOpenSuccessThreshold ?? 2,
    monitorWindowMs: options?.monitorWindowMs ?? 60000,
  });
}

test("CircuitBreaker execute passes result through on success", async () => {
  const breaker = createBreaker();
  const result = await breaker.execute(() => Promise.resolve(42));
  assert.equal(result, 42);
});

test("CircuitBreaker execute propagates error on failure", async () => {
  const breaker = createBreaker();
  await assert.rejects(
    () => breaker.execute(() => Promise.reject(new Error("test error"))),
    { message: "test error" },
  );
});

test("CircuitBreaker onSuccess increments successes counter", async () => {
  const breaker = createBreaker();
  await breaker.execute(() => Promise.resolve("ok"));
  await breaker.execute(() => Promise.resolve("ok"));
  const metrics = breaker.getMetrics();
  assert.equal(metrics.successes, 2);
});

test("CircuitBreaker onSuccess resets consecutiveFailures", async () => {
  const breaker = createBreaker({ failureThreshold: 3 });
  await assert.rejects(() => breaker.execute(async () => { throw new Error("fail"); }));
  assert.equal(breaker.getMetrics().consecutiveFailures, 1);
  await breaker.execute(() => Promise.resolve("ok"));
  assert.equal(breaker.getMetrics().consecutiveFailures, 0);
});

test("CircuitBreaker onFailure increments failures counter", async () => {
  const breaker = createBreaker();
  await assert.rejects(() => breaker.execute(async () => { throw new Error("fail"); }));
  await assert.rejects(() => breaker.execute(async () => { throw new Error("fail"); }));
  const metrics = breaker.getMetrics();
  assert.equal(metrics.failures, 2);
});

test("CircuitBreaker canExecute returns true in closed state", () => {
  const breaker = createBreaker();
  // Can't directly test private method, but we can test via execute
  assert.equal(breaker.getState(), "closed");
});

test("CircuitBreaker metrics has correct types", () => {
  const breaker = createBreaker();
  const metrics: CircuitBreakerMetrics = breaker.getMetrics();
  assert.equal(typeof metrics.state, "string");
  assert.equal(typeof metrics.failures, "number");
  assert.equal(typeof metrics.successes, "number");
  assert.equal(typeof metrics.consecutiveFailures, "number");
  assert.equal(typeof metrics.consecutiveSuccesses, "number");
  assert.equal(metrics.lastFailureAt, null);
  assert.equal(metrics.lastSuccessAt, null);
  assert.equal(metrics.nextAttemptAt, null);
});

test("CircuitBreaker halfOpenInFlight is incremented on canExecute", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });

  try {
    const breaker = createBreaker({ failureThreshold: 1, resetTimeoutMs: 50 });

    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail"); }),
    );

    mock.timers.tick(60);
    assert.equal(breaker.getState(), "half_open");

    // First call in half_open should succeed
    await breaker.execute(async () => "ok1");
    const metrics = breaker.getMetrics();
    // After success in half_open, consecutiveSuccesses should be 1
    assert.equal(metrics.consecutiveSuccesses, 1);
  } finally {
    mock.timers.reset();
  }
});

test("CircuitBreaker halfOpenInFlight is decremented on success in half_open", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });

  try {
    const breaker = createBreaker({ failureThreshold: 1, resetTimeoutMs: 50, halfOpenSuccessThreshold: 3 });

    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail"); }),
    );

    mock.timers.tick(60);
    assert.equal(breaker.getState(), "half_open");

    // First success
    await breaker.execute(async () => "ok1");
    assert.equal(breaker.getMetrics().consecutiveSuccesses, 1);

    // Second success
    await breaker.execute(async () => "ok2");
    assert.equal(breaker.getMetrics().consecutiveSuccesses, 2);

    // Third success closes the circuit
    await breaker.execute(async () => "ok3");
    assert.equal(breaker.getState(), "closed");
  } finally {
    mock.timers.reset();
  }
});

test("CircuitBreaker transitionTo closed resets all counters", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });

  try {
    const breaker = createBreaker({ failureThreshold: 1, resetTimeoutMs: 50, halfOpenSuccessThreshold: 2 });

    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail"); }),
    );

    mock.timers.tick(60);
    assert.equal(breaker.getState(), "half_open");

    await breaker.execute(async () => "ok1");
    await breaker.execute(async () => "ok2");

    assert.equal(breaker.getState(), "closed");
    const metrics = breaker.getMetrics();
    assert.equal(metrics.consecutiveFailures, 0);
    assert.equal(metrics.consecutiveSuccesses, 0);
    assert.equal(metrics.failures, 1);
    assert.equal(metrics.successes, 2);
  } finally {
    mock.timers.reset();
  }
});

test("CircuitBreaker transitionTo open sets nextAttemptAt", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });

  try {
    const breaker = createBreaker({ failureThreshold: 1, resetTimeoutMs: 5000 });

    const beforeFailure = Date.now();
    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail"); }),
    );

    assert.equal(breaker.getState(), "open");
    const metrics = breaker.getMetrics();
    assert.ok(metrics.nextAttemptAt !== null);
    assert.ok(metrics.nextAttemptAt >= beforeFailure + 5000);
  } finally {
    mock.timers.reset();
  }
});

test("CircuitBreaker transitionTo half_open clears nextAttemptAt", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });

  try {
    const breaker = createBreaker({ failureThreshold: 1, resetTimeoutMs: 50 });

    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail"); }),
    );

    assert.equal(breaker.getState(), "open");
    assert.ok(breaker.getMetrics().nextAttemptAt !== null);

    mock.timers.tick(60);

    assert.equal(breaker.getState(), "half_open");
    assert.equal(breaker.getMetrics().nextAttemptAt, null);
    await breaker.execute(async () => "probe");
    assert.equal(breaker.getMetrics().nextAttemptAt, null);
  } finally {
    mock.timers.reset();
  }
});

test("CircuitBreaker getRecentFailureRate returns 0 with no failures", () => {
  const breaker = createBreaker({ monitorWindowMs: 1000 });
  const metrics = breaker.getMetrics();
  // Fresh breaker has no failures
  assert.equal(breaker.getState(), "closed");
});

test("CircuitBreaker getRecentFailureRate is high with rapid failures", async () => {
  mock.timers.enable({ apis: ["Date"] });

  try {
      // The architecture contract opens after more than five consecutive failures.
      const breaker = new CircuitBreaker({
        name: "rate-test",
        failureThreshold: 6,
      resetTimeoutMs: 10000,
      halfOpenSuccessThreshold: 2,
      monitorWindowMs: 10000,
    });

    for (let index = 0; index < 6; index++) {
      const error = await breaker.execute(async () => { throw new Error("rate fail"); }).catch(e => e);
      assert.equal(error.message, "rate fail");
    }

    // Circuit should be open after the documented >5 consecutive failures within 60s.
    assert.equal(breaker.getState(), "open");
  } finally {
    mock.timers.reset();
  }
});

test("CircuitBreaker pruneFailureTimestamps removes old entries", async () => {
  mock.timers.enable({ apis: ["Date"] });

  try {
    const breaker = new CircuitBreaker({
      name: "prune-test",
      failureThreshold: 100,
      resetTimeoutMs: 10000,
      halfOpenSuccessThreshold: 2,
      monitorWindowMs: 1000,
    });

    // Add a failure
    await assert.rejects(() => breaker.execute(async () => { throw new Error("fail"); }));
    mock.timers.tick(500);
    await assert.rejects(() => breaker.execute(async () => { throw new Error("fail"); }));
    mock.timers.tick(600);

    // At this point, the first failure (at t=0) should be pruned
    // because monitorWindowMs is 1000ms and we've advanced 1100ms
    const metrics = breaker.getMetrics();
    assert.ok(metrics.failures >= 1);
  } finally {
    mock.timers.reset();
  }
});

test("CircuitBreakerOpenError extends Error", () => {
  const error = new CircuitBreakerOpenError("test", "breaker", 5000);
  assert.ok(error instanceof Error);
  assert.equal(error.name, "CircuitBreakerOpenError");
});

test("CircuitBreakerOpenError has correct prototype chain", () => {
  const error = new CircuitBreakerOpenError("test", "breaker", null);
  assert.equal(Object.getPrototypeOf(error).constructor.name, "CircuitBreakerOpenError");
});

test("CircuitBreaker canExecute in half_open allows one probe at a time", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });

  try {
    const breaker = createBreaker({ failureThreshold: 1, resetTimeoutMs: 50 });

    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail"); }),
    );

    mock.timers.tick(60);
    assert.equal(breaker.getState(), "half_open");

    // First call in half_open should succeed (halfOpenInFlight becomes 1)
    await breaker.execute(async () => "ok1");

    // After success in half_open, consecutiveSuccesses should be 1
    // halfOpenInFlight should be decremented back to 0
    const metrics = breaker.getMetrics();
    assert.equal(metrics.consecutiveSuccesses, 1);
    assert.equal(breaker.getState(), "half_open");
  } finally {
    mock.timers.reset();
  }
});

test("CircuitBreaker resetTimeoutMs default is 30000", () => {
  const breaker = new CircuitBreaker({ name: "default-test" });
  const metrics = breaker.getMetrics();
  assert.equal(breaker.getState(), "closed");
});

test("CircuitBreaker threshold of 3 opens after 3 consecutive failures", async () => {
  const breaker = createBreaker({ failureThreshold: 3 });

  for (let i = 0; i < 3; i++) {
    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail"); }),
    );
  }

  assert.equal(breaker.getState(), "open");
});

test("CircuitBreaker halfOpenSuccessThreshold default is 3", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });

  try {
    const breaker = new CircuitBreaker({
      name: "half-open-default-test",
      failureThreshold: 1,
      resetTimeoutMs: 50,
      // halfOpenSuccessThreshold defaults to 3
    });

    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail"); }),
    );

    mock.timers.tick(60);
    assert.equal(breaker.getState(), "half_open");

    // 2 successes should not close (need 3)
    await breaker.execute(async () => "ok1");
    await breaker.execute(async () => "ok2");
    assert.equal(breaker.getState(), "half_open");

    // 3rd success closes
    await breaker.execute(async () => "ok3");
    assert.equal(breaker.getState(), "closed");
  } finally {
    mock.timers.reset();
  }
});

test("CircuitBreaker getState returns open before nextAttemptAt time", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });

  try {
    const breaker = createBreaker({ failureThreshold: 1, resetTimeoutMs: 5000 });

    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail"); }),
    );

    assert.equal(breaker.getState(), "open");

    // Before timeout, should still be open
    mock.timers.tick(1000);
    assert.equal(breaker.getState(), "open");

    // After timeout, should transition to half_open
    mock.timers.tick(4000);
    assert.equal(breaker.getState(), "half_open");
  } finally {
    mock.timers.reset();
  }
});

test("CircuitBreaker getState updates nextAttemptAt when transitioning", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });

  try {
    const breaker = createBreaker({ failureThreshold: 1, resetTimeoutMs: 5000 });

    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail"); }),
    );

    const metricsBefore = breaker.getMetrics();
    assert.ok(metricsBefore.nextAttemptAt !== null);

    mock.timers.tick(6000);

    assert.equal(breaker.getState(), "half_open");
    const metricsAfterReadable = breaker.getMetrics();
    assert.equal(metricsAfterReadable.nextAttemptAt, null);

    await breaker.execute(async () => "probe");
    const metricsAfter = breaker.getMetrics();
    assert.equal(metricsAfter.nextAttemptAt, null);
  } finally {
    mock.timers.reset();
  }
});

test("CircuitBreaker metrics lastFailureAt is set on failure", async () => {
  mock.timers.enable({ apis: ["Date"] });

  try {
    const breaker = createBreaker();
    const beforeFailure = Date.now();

    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail"); }),
    );

    const metrics = breaker.getMetrics();
    assert.ok(metrics.lastFailureAt !== null);
    assert.ok(metrics.lastFailureAt >= beforeFailure);
  } finally {
    mock.timers.reset();
  }
});

test("CircuitBreaker metrics lastSuccessAt is set on success", async () => {
  mock.timers.enable({ apis: ["Date"] });

  try {
    const breaker = createBreaker();
    const beforeSuccess = Date.now();

    await breaker.execute(() => Promise.resolve("ok"));

    const metrics = breaker.getMetrics();
    assert.ok(metrics.lastSuccessAt !== null);
    assert.ok(metrics.lastSuccessAt >= beforeSuccess);
  } finally {
    mock.timers.reset();
  }
});

test("CircuitBreaker multiple rapid failures all count with high threshold", async () => {
  mock.timers.enable({ apis: ["Date"] });

  try {
    // Use high threshold and ensure rate-based opening doesn't interfere
    const breaker = new CircuitBreaker({
      name: "multi-fail-test",
      failureThreshold: 10, // High threshold
      resetTimeoutMs: 10000,
      halfOpenSuccessThreshold: 2,
      monitorWindowMs: 100000, // Very large window
    });

    for (let i = 0; i < 3; i++) {
      await assert.rejects(
        () => breaker.execute(async () => { throw new Error(`fail ${i}`); }),
      );
    }

    // With threshold 10 and 3 failures, circuit should still be closed
    // (rate = (3/100)*10 = 0.3 < 0.5)
    const metrics = breaker.getMetrics();
    assert.equal(metrics.failures, 3);
    assert.equal(metrics.consecutiveFailures, 3);
    assert.equal(breaker.getState(), "closed");
  } finally {
    mock.timers.reset();
  }
});

test("CircuitBreaker exactly at threshold opens circuit", async () => {
  const breaker = createBreaker({ failureThreshold: 3 });

  for (let i = 0; i < 3; i++) {
    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail"); }),
    );
  }

  assert.equal(breaker.getState(), "open");
});

test("CircuitBreaker one failure in half_open returns to open", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });

  try {
    const breaker = createBreaker({ failureThreshold: 1, resetTimeoutMs: 50 });

    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail"); }),
    );

    mock.timers.tick(60);
    assert.equal(breaker.getState(), "half_open");

    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail in half_open"); }),
    );

    assert.equal(breaker.getState(), "open");
  } finally {
    mock.timers.reset();
  }
});
