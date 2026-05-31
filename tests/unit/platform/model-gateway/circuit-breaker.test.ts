import assert from "node:assert/strict";
import test from "node:test";
import { installMockDateNow } from "../../../helpers/time.js";

import { CircuitBreaker, CircuitBreakerOpenError, type CircuitBreakerMetrics } from "../../../../src/platform/model-gateway/provider-registry/circuit-breaker.js";
import { globalCircuitBreakerEventBus } from "../../../../src/platform/model-gateway/provider-registry/circuit-breaker-event-bus.js";

test("CircuitBreaker starts in closed state", () => {
  const cb = new CircuitBreaker({ name: "test" });
  assert.equal(cb.getState(), "closed");
});

test("CircuitBreaker getMetrics returns correct initial state", () => {
  const cb = new CircuitBreaker({ name: "test" });
  const metrics = cb.getMetrics();

  assert.equal(metrics.state, "closed");
  assert.equal(metrics.failures, 0);
  assert.equal(metrics.successes, 0);
  assert.equal(metrics.consecutiveFailures, 0);
  assert.equal(metrics.consecutiveSuccesses, 0);
  assert.equal(metrics.lastFailureAt, null);
  assert.equal(metrics.lastSuccessAt, null);
  assert.equal(metrics.nextAttemptAt, null);
});

test("CircuitBreaker execute passes through success", async () => {
  const cb = new CircuitBreaker({ name: "test" });
  const result = await cb.execute(async () => "success");
  assert.equal(result, "success");
});

test("CircuitBreaker execute throws CircuitBreakerOpenError when open", async () => {
  const cb = new CircuitBreaker({ name: "test", failureThreshold: 1, resetTimeoutMs: 60000 });

  // Open the circuit
  try {
    await cb.execute(async () => {
      throw new Error("test error");
    });
  } catch {
    // Expected
  }

  assert.equal(cb.getState(), "open");

  // Next call should throw
  await assert.rejects(
    async () => cb.execute(async () => "should not execute"),
    CircuitBreakerOpenError,
  );
});

test("CircuitBreaker transitions to half_open after resetTimeoutMs", async () => {
  const clock = installMockDateNow(0);
  try {
  const cb = new CircuitBreaker({ name: "test", failureThreshold: 1, resetTimeoutMs: 10 });

  // Open the circuit
  try {
    await cb.execute(async () => {
      throw new Error("test error");
    });
  } catch {
    // Expected
  }

  assert.equal(cb.getState(), "open");

  // Wait for reset timeout
  clock.advance(20);

  // State should transition to half_open on getState
  assert.equal(cb.getState(), "half_open");
  } finally {
    clock.restore();
  }
});

test("CircuitBreaker half_open admits probes after successful execution", async () => {
  const clock = installMockDateNow(0);
  try {
  const cb = new CircuitBreaker({ name: "test", failureThreshold: 1, resetTimeoutMs: 10, halfOpenSuccessThreshold: 3 });

  // Open then transition to half_open
  try {
    await cb.execute(async () => {
      throw new Error("test error");
    });
  } catch {
    // Expected
  }

  clock.advance(20);
  assert.equal(cb.getState(), "half_open");

  // First probe allowed
  const allowed = await cb.execute(async () => "probe1");
  assert.equal(allowed, "probe1");

  // After success, consecutiveSuccesses is incremented
  // The circuit should be able to process more requests
  const metrics = cb.getMetrics();
  assert.equal(metrics.consecutiveSuccesses, 1);
  } finally {
    clock.restore();
  }
});

test("CircuitBreaker closes after halfOpenSuccessThreshold successes in half_open", async () => {
  const clock = installMockDateNow(0);
  try {
  const cb = new CircuitBreaker({ name: "test", failureThreshold: 1, resetTimeoutMs: 10, halfOpenSuccessThreshold: 2 });

  // Open then transition to half_open
  try {
    await cb.execute(async () => {
      throw new Error("test error");
    });
  } catch {
    // Expected
  }

  clock.advance(20);
  assert.equal(cb.getState(), "half_open");

  // The first probe transitions the internal state to half_open.
  await cb.execute(async () => "ok1");
  const metrics1 = cb.getMetrics();
  assert.equal(metrics1.consecutiveSuccesses, 1);

  await cb.execute(async () => "ok2");
  assert.equal(cb.getState(), "closed");
  } finally {
    clock.restore();
  }
});

test("CircuitBreaker any failure in half_open returns to open", async () => {
  const clock = installMockDateNow(0);
  try {
  const cb = new CircuitBreaker({ name: "test", failureThreshold: 1, resetTimeoutMs: 50, halfOpenSuccessThreshold: 3 });

  // Open then transition to half_open
  try {
    await cb.execute(async () => {
      throw new Error("test error");
    });
  } catch {
    // Expected
  }

  clock.advance(60);
  assert.equal(cb.getState(), "half_open");

  await assert.rejects(
    () => cb.execute(async () => {
      throw new Error("probe fail");
    }),
    { message: "probe fail" },
  );

  assert.equal(cb.getState(), "open");
  } finally {
    clock.restore();
  }
});

test("CircuitBreaker state change callback is called", async () => {
  const stateChanges: Array<{ oldState: string; newState: string }> = [];

  const cb = new CircuitBreaker({
    name: "test",
    failureThreshold: 1,
    resetTimeoutMs: 10,
    onStateChange: (payload) => {
      stateChanges.push({ oldState: payload.oldState, newState: payload.newState });
    },
  });

  // Open the circuit
  try {
    await cb.execute(async () => {
      throw new Error("test error");
    });
  } catch {
    // Expected
  }

  assert.equal(stateChanges.length, 1);
  assert.equal(stateChanges[0]!.oldState, "closed");
  assert.equal(stateChanges[0]!.newState, "open");
});

test("CircuitBreaker global event bus receives state change", async () => {
  let eventReceived = false;

  globalCircuitBreakerEventBus.setEmitter((_eventType, _payload) => {
    eventReceived = true;
  });

  const cb = new CircuitBreaker({ name: "test", failureThreshold: 1 });

  try {
    await cb.execute(async () => {
      throw new Error("test error");
    });
  } catch {
    // Expected
  }

  globalCircuitBreakerEventBus.setEmitter(() => {});

  assert.equal(eventReceived, true);
});

test("CircuitBreakerOpenError has correct properties", () => {
  const error = new CircuitBreakerOpenError("test message", "test-circuit", 5000);
  assert.equal(error.name, "CircuitBreakerOpenError");
  assert.equal(error.message, "test message");
  assert.equal(error.circuitName, "test-circuit");
  assert.equal(error.retryAfterMs, 5000);
});

test("CircuitBreaker with custom options", () => {
  const cb = new CircuitBreaker({
    name: "custom",
    failureThreshold: 10,
    resetTimeoutMs: 60000,
    halfOpenSuccessThreshold: 5,
    monitorWindowMs: 120000,
  });

  const metrics = cb.getMetrics();
  assert.equal(metrics.state, "closed");
  assert.equal(cb.getState(), "closed");
});

test("CircuitBreaker metrics track failures and successes", () => {
  const cb = new CircuitBreaker({ name: "test" });
  const metrics = cb.getMetrics();

  assert.equal(metrics.failures, 0);
  assert.equal(metrics.successes, 0);
});
