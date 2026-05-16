import assert from "node:assert/strict";
import test from "node:test";

import { CircuitBreaker } from "../../../../../src/platform/model-gateway/provider-registry/circuit-breaker.js";

async function withSimulatedTime<T>(operation: (advanceTime: (ms: number) => void) => Promise<T>): Promise<T> {
  const originalNow = Date.now;
  let nowMs = 1_700_000_000_000;
  Date.now = () => nowMs;
  try {
    return await operation((ms) => {
      nowMs += ms;
    });
  } finally {
    Date.now = originalNow;
  }
}

test("CircuitBreaker integration: closed -> open -> half_open -> closed", async () => {
  await withSimulatedTime(async (advanceTime) => {
    const cb = new CircuitBreaker({
      name: "integration-test",
      failureThreshold: 3,
      resetTimeoutMs: 50,
      halfOpenSuccessThreshold: 2,
    });

    assert.equal(cb.getState(), "closed");

    cb.onFailure();
    cb.onFailure();
    cb.onFailure();
    assert.equal(cb.getState(), "open");

    advanceTime(60);

    assert.equal(cb.getState(), "half_open");

    cb.onSuccess();
    assert.equal(cb.getState(), "half_open");
    cb.onSuccess();
    assert.equal(cb.getState(), "closed");
  });
});

test("CircuitBreaker integration: half_open failure returns to open", async () => {
  await withSimulatedTime(async (advanceTime) => {
    const cb = new CircuitBreaker({
      name: "integration-test-2",
      failureThreshold: 1,
      resetTimeoutMs: 30,
      halfOpenSuccessThreshold: 3,
    });

    cb.onFailure();
    advanceTime(40);
    assert.equal(cb.getState(), "half_open");

    cb.onSuccess();
    cb.onFailure();
    assert.equal(cb.getState(), "open");
  });
});

test("CircuitBreaker integration: execute respects circuit state", async () => {
  const cb = new CircuitBreaker({
    name: "integration-test-3",
    failureThreshold: 1,
    resetTimeoutMs: 100,
  });

  // Should allow execution when closed
  const result1 = await cb.execute(async () => "success");
  assert.equal(result1, "success");

  // Fail to open circuit
  cb.onFailure();
  assert.equal(cb.getState(), "open");

  // Execute should fail
  await assert.rejects(
    async () => cb.execute(async () => "should not run"),
    (err: unknown) => err instanceof Error && err.message.includes("Circuit breaker")
  );
});

test("CircuitBreaker metrics tracking across state transitions", async () => {
  await withSimulatedTime(async (advanceTime) => {
    const cb = new CircuitBreaker({
      name: "integration-test-4",
      failureThreshold: 2,
      resetTimeoutMs: 50,
    });

    cb.onSuccess();
    cb.onSuccess();
    cb.onFailure();
    cb.onFailure();

    const metrics = cb.getMetrics();
    assert.equal(metrics.successes, 2);
    assert.equal(metrics.failures, 2);
    assert.equal(metrics.consecutiveFailures, 2);
    assert.equal(metrics.state, "open");

    advanceTime(60);

    const metrics2 = cb.getMetrics();
    assert.equal(metrics2.state, "half_open");
  });
});

test("CircuitBreaker rapid recovery and re-failure", async () => {
  await withSimulatedTime(async (advanceTime) => {
    const cb = new CircuitBreaker({
      name: "rapid-test",
      failureThreshold: 2,
      resetTimeoutMs: 20,
      halfOpenSuccessThreshold: 2,
    });

    cb.onFailure();
    cb.onFailure();
    assert.equal(cb.getState(), "open");

    advanceTime(25);
    assert.equal(cb.getState(), "half_open");

    cb.onFailure();
    assert.equal(cb.getState(), "open");

    advanceTime(25);
    assert.equal(cb.getState(), "half_open");

    cb.onSuccess();
    cb.onSuccess();
    assert.equal(cb.getState(), "closed");
  });
});
