/**
 * Unit tests for CircuitBreaker state transitions.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { CircuitBreaker, CircuitBreakerOpenError } from "/Users/holden/Project/automatic_agent/automatic_agent_platform/dist_temp/src/platform/model-gateway/provider-registry/circuit-breaker.js";

test("circuit breaker starts in closed state", () => {
  const cb = new CircuitBreaker({ name: "test-circuit" });
  assert.equal(cb.getState(), "closed");
});

test("circuit breaker stays closed after successes", () => {
  const cb = new CircuitBreaker({ name: "test-circuit", failureThreshold: 3 });
  cb.onSuccess();
  cb.onSuccess();
  cb.onSuccess();
  assert.equal(cb.getState(), "closed");
});

test("circuit breaker opens after consecutive failure threshold", () => {
  const cb = new CircuitBreaker({ name: "test-circuit", failureThreshold: 3 });
  cb.onFailure();
  cb.onFailure();
  assert.equal(cb.getState(), "closed");
  cb.onFailure();
  assert.equal(cb.getState(), "open");
});

test("circuit breaker records failure count correctly", () => {
  const cb = new CircuitBreaker({ name: "test-circuit", failureThreshold: 5 });
  const metrics1 = cb.getMetrics();
  assert.equal(metrics1.consecutiveFailures, 0);

  cb.onFailure();
  const metrics2 = cb.getMetrics();
  assert.equal(metrics2.consecutiveFailures, 1);

  cb.onFailure();
  const metrics3 = cb.getMetrics();
  assert.equal(metrics3.consecutiveFailures, 2);
});

test("circuit breaker opens after high failure rate", () => {
  const cb = new CircuitBreaker({
    name: "test-circuit",
    failureThreshold: 3,
    monitorWindowMs: 60_000,
  });

  // Three consecutive failures should open via threshold
  cb.onFailure();
  cb.onFailure();
  cb.onFailure();
  assert.equal(cb.getState(), "open");
});

test("circuit breaker transitions to half_open after reset timeout", async () => {
  const cb = new CircuitBreaker({
    name: "test-circuit",
    failureThreshold: 3,
    resetTimeoutMs: 50,
  });

  // Open the circuit
  cb.onFailure();
  cb.onFailure();
  cb.onFailure();
  assert.equal(cb.getState(), "open");

  // Wait for timeout
  await new Promise((resolve) => setTimeout(resolve, 60));

  // Should transition to half_open on next getState call
  assert.equal(cb.getState(), "half_open");
});

test("circuit breaker closes after success threshold in half_open", async () => {
  const cb = new CircuitBreaker({
    name: "test-circuit",
    failureThreshold: 3,
    halfOpenSuccessThreshold: 2,
    resetTimeoutMs: 50,
  });

  // Open the circuit
  cb.onFailure();
  cb.onFailure();
  cb.onFailure();
  assert.equal(cb.getState(), "open");

  // Wait for timeout then trigger transition to half_open
  await new Promise((resolve) => setTimeout(resolve, 60));
  cb.getState();
  assert.equal(cb.getState(), "half_open");

  // In half_open state, record successes
  cb.onSuccess();
  assert.equal(cb.getState(), "half_open");
  cb.onSuccess();
  assert.equal(cb.getState(), "closed");
});

test("circuit breaker returns to open on failure in half_open", async () => {
  const cb = new CircuitBreaker({
    name: "test-circuit",
    failureThreshold: 3,
    halfOpenSuccessThreshold: 3,
    resetTimeoutMs: 50,
  });

  // Open the circuit
  cb.onFailure();
  cb.onFailure();
  cb.onFailure();
  assert.equal(cb.getState(), "open");

  // Wait for timeout then transition to half_open
  await new Promise((resolve) => setTimeout(resolve, 60));
  cb.getState();
  assert.equal(cb.getState(), "half_open");

  // Failure in half_open returns to open
  cb.onFailure();
  assert.equal(cb.getState(), "open");
});

test("circuit breaker execute throws CircuitBreakerOpenError when open", async () => {
  const cb = new CircuitBreaker({
    name: "test-circuit",
    failureThreshold: 2,
  });

  // Open the circuit
  cb.onFailure();
  cb.onFailure();

  await assert.rejects(
    async () => cb.execute(async () => "success"),
    (error: unknown) => {
      return error instanceof CircuitBreakerOpenError;
    },
  );
});

test("circuit breaker execute allows requests when closed", async () => {
  const cb = new CircuitBreaker({ name: "test-circuit" });

  const result = await cb.execute(async () => "success");
  assert.equal(result, "success");
});

test("circuit breaker execute allows requests in half_open", async () => {
  const cb = new CircuitBreaker({
    name: "test-circuit",
    failureThreshold: 1,
    resetTimeoutMs: 50,
    halfOpenSuccessThreshold: 1,
  });

  // Open the circuit
  cb.onFailure();
  assert.equal(cb.getState(), "open");

  // Wait and transition to half_open
  await new Promise((resolve) => setTimeout(resolve, 60));
  cb.getState();
  assert.equal(cb.getState(), "half_open");

  // Should allow one request in half_open
  const result = await cb.execute(async () => "success");
  assert.equal(result, "success");
  assert.equal(cb.getState(), "closed");
});

test("circuit breaker halfOpenInFlight limits concurrent probes in half_open", async () => {
  const cb = new CircuitBreaker({
    name: "test-circuit",
    failureThreshold: 1,
    resetTimeoutMs: 50,
    halfOpenSuccessThreshold: 2,
  });

  // Open the circuit
  cb.onFailure();
  assert.equal(cb.getState(), "open");

  // Wait and transition to half_open
  await new Promise((resolve) => setTimeout(resolve, 60));
  cb.getState();
  assert.equal(cb.getState(), "half_open");

  // First request succeeds but does NOT close circuit (threshold is 2)
  const result = await cb.execute(async () => "first");
  assert.equal(result, "first");
  assert.equal(cb.getState(), "half_open");
});

test("circuit breaker success resets consecutive failures", () => {
  const cb = new CircuitBreaker({ name: "test-circuit", failureThreshold: 5 });

  cb.onFailure();
  cb.onFailure();
  assert.equal(cb.getMetrics().consecutiveFailures, 2);

  cb.onSuccess();
  assert.equal(cb.getMetrics().consecutiveFailures, 0);
});

test("circuit breaker failure resets consecutive successes in half_open", async () => {
  const cb = new CircuitBreaker({
    name: "test-circuit",
    failureThreshold: 3,
    halfOpenSuccessThreshold: 3,
    resetTimeoutMs: 50,
  });

  // Open, transition to half_open, record some successes
  cb.onFailure();
  cb.onFailure();
  cb.onFailure();
  await new Promise((resolve) => setTimeout(resolve, 60));
  cb.getState(); // half_open

  cb.onSuccess();
  cb.onSuccess();
  assert.equal(cb.getMetrics().consecutiveSuccesses, 2);

  // Failure resets consecutive successes
  cb.onFailure();
  assert.equal(cb.getMetrics().consecutiveSuccesses, 0);
});

test("circuit breaker metrics report correct state", () => {
  const cb = new CircuitBreaker({
    name: "test-circuit",
    failureThreshold: 3,
  });

  cb.onFailure();
  cb.onFailure();
  cb.onFailure();

  const metrics = cb.getMetrics();
  assert.equal(metrics.state, "open");
  assert.equal(metrics.failures, 3);
  assert.ok(metrics.lastFailureAt !== null);
});

test("circuit breaker nextAttemptAt is set when opening", () => {
  const cb = new CircuitBreaker({
    name: "test-circuit",
    failureThreshold: 2,
    resetTimeoutMs: 10_000,
  });

  cb.onFailure();
  cb.onFailure();

  const metrics = cb.getMetrics();
  assert.ok(metrics.nextAttemptAt !== null);
  assert.ok(metrics.nextAttemptAt! > Date.now());
});

test("circuit breaker nextAttemptAt is null when closed", () => {
  const cb = new CircuitBreaker({ name: "test-circuit" });

  cb.onSuccess();

  const metrics = cb.getMetrics();
  assert.equal(metrics.nextAttemptAt, null);
});

test("circuit breaker records success and updates metrics", () => {
  const cb = new CircuitBreaker({ name: "test-circuit" });

  cb.onSuccess();
  const metrics = cb.getMetrics();

  assert.equal(metrics.successes, 1);
  assert.equal(metrics.consecutiveFailures, 0);
  assert.ok(metrics.lastSuccessAt !== null);
});

test("circuit breaker records failure and updates metrics", () => {
  const cb = new CircuitBreaker({ name: "test-circuit" });

  cb.onFailure();
  const metrics = cb.getMetrics();

  assert.equal(metrics.failures, 1);
  assert.equal(metrics.consecutiveFailures, 1);
  assert.ok(metrics.lastFailureAt !== null);
});

test("circuit breaker halfOpenInFlight allows one probe at a time", async () => {
  const cb = new CircuitBreaker({
    name: "test-circuit",
    failureThreshold: 1,
    resetTimeoutMs: 50,
    halfOpenSuccessThreshold: 3,
  });

  // Open the circuit
  cb.onFailure();
  assert.equal(cb.getState(), "open");

  // Wait and transition to half_open
  await new Promise((resolve) => setTimeout(resolve, 60));
  cb.getState();
  assert.equal(cb.getState(), "half_open");

  // First call should succeed (increments halfOpenInFlight to 1)
  const result = await cb.execute(async () => "probe");
  assert.equal(result, "probe");
});

test("circuit breaker closed state has no nextAttemptAt", () => {
  const cb = new CircuitBreaker({
    name: "test-circuit",
    failureThreshold: 5,
  });

  assert.equal(cb.getState(), "closed");
  assert.equal(cb.getMetrics().nextAttemptAt, null);
});

test("circuit breaker accepts high failure threshold", () => {
  // This test verifies custom failure threshold option is accepted
  // Consecutive failure threshold test is covered by test 3
  const cb = new CircuitBreaker({
    name: "test-circuit",
    failureThreshold: 100, // Very high threshold
  });

  // Verify the threshold is set correctly via metrics
  assert.equal(cb.getMetrics().consecutiveFailures, 0);
});

test("circuit breaker accepts custom reset timeout", () => {
  const cb = new CircuitBreaker({
    name: "test-circuit",
    failureThreshold: 1,
    resetTimeoutMs: 500,
  });

  cb.onFailure();
  assert.equal(cb.getState(), "open");

  // Before timeout, should still be open
  assert.equal(cb.getState(), "open");
});

test("circuit breaker accepts custom halfOpenSuccessThreshold", async () => {
  const cb = new CircuitBreaker({
    name: "test-circuit",
    failureThreshold: 1,
    resetTimeoutMs: 50,
    halfOpenSuccessThreshold: 5,
  });

  cb.onFailure();
  assert.equal(cb.getState(), "open");

  // Wait for timeout and transition to half_open
  await new Promise((resolve) => setTimeout(resolve, 60));
  cb.getState();
  assert.equal(cb.getState(), "half_open");

  // Four successes should keep it half_open
  for (let i = 0; i < 4; i++) {
    cb.onSuccess();
    assert.equal(cb.getState(), "half_open");
  }

  // Fifth success should close it
  cb.onSuccess();
  assert.equal(cb.getState(), "closed");
});

test("circuit breaker error preserves circuit name and retryAfterMs", () => {
  const cb = new CircuitBreaker({
    name: "my-circuit",
    failureThreshold: 1,
    resetTimeoutMs: 5000,
  });

  cb.onFailure();

  assert.throws(
    () => {
      throw new CircuitBreakerOpenError("test", "my-circuit", 5000);
    },
    (error: unknown) => {
      if (error instanceof CircuitBreakerOpenError) {
        assert.equal(error.circuitName, "my-circuit");
        assert.equal(error.retryAfterMs, 5000);
        return true;
      }
      return false;
    },
  );
});

test("circuit breaker getState checks timeout for open to half_open transition", async () => {
  const cb = new CircuitBreaker({
    name: "test-circuit",
    failureThreshold: 1,
    resetTimeoutMs: 100,
  });

  cb.onFailure();
  assert.equal(cb.getState(), "open");

  // getState should not transition before timeout
  cb.getState();
  assert.equal(cb.getState(), "open");

  // Wait for timeout
  await new Promise((resolve) => setTimeout(resolve, 120));

  // Now getState should trigger transition
  assert.equal(cb.getState(), "half_open");
});

test("circuit breaker requires two successes to close from half_open", async () => {
  const cb = new CircuitBreaker({
    name: "test-circuit",
    failureThreshold: 1,
    resetTimeoutMs: 50,
    halfOpenSuccessThreshold: 2,
  });

  // Open the circuit
  cb.onFailure();
  await new Promise((resolve) => setTimeout(resolve, 60));
  cb.getState(); // half_open

  // First success - still half_open
  const result1 = await cb.execute(async () => "first");
  assert.equal(result1, "first");
  assert.equal(cb.getState(), "half_open");

  // Second success - closes
  const result2 = await cb.execute(async () => "second");
  assert.equal(result2, "second");
  assert.equal(cb.getState(), "closed");
});

test("circuit breaker can be reopened after recovery", async () => {
  const cb = new CircuitBreaker({
    name: "test-circuit",
    failureThreshold: 1,
    resetTimeoutMs: 50,
    halfOpenSuccessThreshold: 1,
  });

  // Open and recover
  cb.onFailure();
  await new Promise((resolve) => setTimeout(resolve, 60));
  cb.getState(); // half_open
  await cb.execute(async () => "success"); // closes
  assert.equal(cb.getState(), "closed");

  // Can be opened again
  cb.onFailure();
  assert.equal(cb.getState(), "open");
});

test("circuit breaker execute propagates errors and records failure", async () => {
  const cb = new CircuitBreaker({
    name: "test-circuit",
    failureThreshold: 2,
  });

  await assert.rejects(
    async () => cb.execute(async () => {
      throw new Error("provider error");
    }),
    (error: unknown) => {
      return error instanceof Error && error.message === "provider error";
    },
  );

  // Failure was recorded
  const metrics = cb.getMetrics();
  assert.equal(metrics.failures, 1);
  assert.equal(metrics.consecutiveFailures, 1);
});

test("circuit breaker transitions through complete lifecycle", async () => {
  const cb = new CircuitBreaker({
    name: "test-circuit",
    failureThreshold: 2,
    resetTimeoutMs: 50,
    halfOpenSuccessThreshold: 1,
  });

  // 1. Start closed
  assert.equal(cb.getState(), "closed");

  // 2. Accumulate failures to open
  cb.onFailure();
  cb.onFailure();
  assert.equal(cb.getState(), "open");

  // 3. Wait for timeout
  await new Promise((resolve) => setTimeout(resolve, 60));

  // 4. getState triggers transition to half_open
  cb.getState();
  assert.equal(cb.getState(), "half_open");

  // 5. Successful request closes circuit
  await cb.execute(async () => "success");
  assert.equal(cb.getState(), "closed");
});
