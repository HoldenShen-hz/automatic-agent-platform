import assert from "node:assert/strict";
import test from "node:test";

import {
  CircuitBreaker,
  CircuitState,
  CircuitBreakerOpenError,
  CircuitBreakerTimeoutError,
  CircuitBreakerResetError,
  type CircuitBreakerOptions,
  type CircuitBreakerStats,
} from "../../../../src/platform/stability/circuit-breaker.js";

test("CircuitBreaker exports are available", () => {
  assert.equal(typeof CircuitBreaker, "function");
  assert.equal(typeof CircuitState, "object");
  assert.equal(typeof CircuitBreakerOpenError, "function");
  assert.equal(typeof CircuitBreakerTimeoutError, "function");
  assert.equal(typeof CircuitBreakerResetError, "function");
});

test("CircuitBreaker starts in CLOSED state", () => {
  const breaker = new CircuitBreaker();
  assert.equal(breaker.getState(), CircuitState.CLOSED);
});

test("CircuitBreaker executes successfully and returns result", async () => {
  const breaker = new CircuitBreaker();
  const result = await breaker.execute(async () => "success");
  assert.equal(result, "success");
});

test("CircuitBreaker executes with signal", async () => {
  const breaker = new CircuitBreaker();
  const result = await breaker.execute(async (signal) => {
    assert.ok(signal instanceof AbortSignal);
    return "with-signal";
  });
  assert.equal(result, "with-signal");
});

test("CircuitBreaker records failures and transitions to OPEN", async () => {
  const breaker = new CircuitBreaker({ failureThreshold: 2 });

  await assert.rejects(
    async () => breaker.execute(async () => { throw new Error("fail"); }),
    Error,
  );
  await assert.rejects(
    async () => breaker.execute(async () => { throw new Error("fail"); }),
    Error,
  );

  assert.equal(breaker.getState(), CircuitState.OPEN);
});

test("CircuitBreaker OPEN state rejects calls immediately", async () => {
  const breaker = new CircuitBreaker({ failureThreshold: 1 });

  await assert.rejects(
    async () => breaker.execute(async () => { throw new Error("fail"); }),
    Error,
  );

  await assert.rejects(
    async () => breaker.execute(async () => "should be blocked"),
    CircuitBreakerOpenError,
  );
});

test("CircuitBreaker transitions to HALF_OPEN after resetTimeout", async () => {
  const breaker = new CircuitBreaker({
    failureThreshold: 1,
    resetTimeout: 50,
  });

  await assert.rejects(
    async () => breaker.execute(async () => { throw new Error("fail"); }),
    Error,
  );

  assert.equal(breaker.getState(), CircuitState.OPEN);

  await new Promise((r) => setTimeout(r, 60));

  const result = await breaker.execute(async () => "half-open-test");
  assert.equal(result, "half-open-test");
});

test("CircuitBreaker HALF_OPEN to CLOSED on success threshold", async () => {
  const breaker = new CircuitBreaker({
    failureThreshold: 1,
    successThreshold: 2,
    resetTimeout: 50,
  });

  await assert.rejects(
    async () => breaker.execute(async () => { throw new Error("fail"); }),
    Error,
  );

  await new Promise((r) => setTimeout(r, 60));

  await breaker.execute(async () => "success1");
  await breaker.execute(async () => "success2");

  assert.equal(breaker.getState(), CircuitState.CLOSED);
});

test("CircuitBreaker HALF_OPEN to OPEN on failure", async () => {
  const breaker = new CircuitBreaker({
    failureThreshold: 1,
    successThreshold: 5,
    resetTimeout: 50,
  });

  // Open the circuit
  await assert.rejects(
    async () => breaker.execute(async () => { throw new Error("initial fail"); }),
    Error,
  );

  // Wait for reset timeout and trigger half-open
  await new Promise((r) => setTimeout(r, 60));

  // Execute a failing call in half-open state - should transition back to OPEN
  await assert.rejects(
    async () => breaker.execute(async () => { throw new Error("half-open fail"); }),
    Error,
  );

  assert.equal(breaker.getState(), CircuitState.OPEN);
});

test("CircuitBreaker timeout throws CircuitBreakerTimeoutError", async () => {
  const breaker = new CircuitBreaker({ timeout: 50 });

  await assert.rejects(
    async () => breaker.execute(async () => {
      await new Promise((r) => setTimeout(r, 100));
      return "too slow";
    }),
    CircuitBreakerTimeoutError,
  );
});

test("CircuitBreaker getStats returns correct structure", async () => {
  const breaker = new CircuitBreaker({ failureThreshold: 3 });

  const statsBefore = breaker.getStats();
  assert.equal(typeof statsBefore.state, "string");
  assert.equal(typeof statsBefore.failures, "number");
  assert.equal(typeof statsBefore.successes, "number");
  assert.ok(statsBefore.lastSuccess === null);

  await breaker.execute(async () => "success");
  const statsAfter = breaker.getStats();
  assert.equal(statsAfter.state, CircuitState.CLOSED);
  assert.ok(statsAfter.lastSuccess !== null);
});

test("CircuitBreaker reset clears all state", async () => {
  const breaker = new CircuitBreaker({ failureThreshold: 1, resetTimeout: 50 });

  await assert.rejects(
    async () => breaker.execute(async () => { throw new Error("fail"); }),
    Error,
  );
  assert.equal(breaker.getState(), CircuitState.OPEN);

  breaker.reset();

  assert.equal(breaker.getState(), CircuitState.CLOSED);
  const stats = breaker.getStats();
  assert.equal(stats.failures, 0);
  assert.equal(stats.successes, 0);
});

test("CircuitBreaker onStateChange callback is called", async () => {
  const stateChanges: Array<[CircuitState, CircuitState]> = [];

  const breaker = new CircuitBreaker({
    failureThreshold: 1,
    resetTimeout: 50,
    onStateChange: (prev, next) => {
      stateChanges.push([prev, next]);
    },
  });

  await assert.rejects(
    async () => breaker.execute(async () => { throw new Error("fail"); }),
    Error,
  );

  assert.ok(stateChanges.some(([prev, next]) =>
    prev === CircuitState.CLOSED && next === CircuitState.OPEN,
  ));
});

test("CircuitBreaker with custom options", () => {
  const breaker = new CircuitBreaker({
    failureThreshold: 10,
    successThreshold: 3,
    timeout: 5000,
    resetTimeout: 10000,
  });

  const stats = breaker.getStats();
  assert.equal(stats.state, CircuitState.CLOSED);
  assert.equal(stats.failures, 0);
});

test("CircuitBreakerOpenError has correct name", () => {
  const error = new CircuitBreakerOpenError("Circuit is open");
  assert.equal(error.name, "CircuitBreakerOpenError");
});

test("CircuitBreakerTimeoutError has correct name", () => {
  const error = new CircuitBreakerTimeoutError("Operation timed out");
  assert.equal(error.name, "CircuitBreakerTimeoutError");
});

test("CircuitBreakerResetError has correct name", () => {
  const error = new CircuitBreakerResetError("Circuit reset");
  assert.equal(error.name, "CircuitBreakerResetError");
});

test("CircuitState enum has all expected values", () => {
  assert.equal(CircuitState.CLOSED, "CLOSED");
  assert.equal(CircuitState.OPEN, "OPEN");
  assert.equal(CircuitState.HALF_OPEN, "HALF_OPEN");
});

test("CircuitBreaker executes multiple calls in CLOSED state", async () => {
  const breaker = new CircuitBreaker({ failureThreshold: 5 });

  const results = await Promise.all([
    breaker.execute(async () => "a"),
    breaker.execute(async () => "b"),
    breaker.execute(async () => "c"),
  ]);

  assert.deepEqual(results, ["a", "b", "c"]);
});

test("CircuitBreaker lastFailure and lastSuccess are tracked", async () => {
  const breaker = new CircuitBreaker({ failureThreshold: 3 });

  await breaker.execute(async () => "success");
  const stats1 = breaker.getStats();
  assert.ok(stats1.lastSuccess !== null);

  await assert.rejects(
    async () => breaker.execute(async () => { throw new Error("fail"); }),
    Error,
  );
  const stats2 = breaker.getStats();
  assert.ok(stats2.lastFailure !== null);
});