import assert from "node:assert/strict";
import test from "node:test";

import { CircuitBreaker } from "../../../../../src/platform/model-gateway/provider-registry/circuit-breaker.js";

test("CircuitBreaker integration: closed -> open -> half_open -> closed", async () => {
  const cb = new CircuitBreaker({
    name: "integration-test",
    failureThreshold: 3,
    resetTimeoutMs: 50,
    halfOpenSuccessThreshold: 2,
  });

  // Start in closed state
  assert.equal(cb.getState(), "closed");

  // Trigger failures to open circuit
  cb.onFailure();
  cb.onFailure();
  cb.onFailure();
  assert.equal(cb.getState(), "open");

  // Wait for reset timeout
  await new Promise(resolve => setTimeout(resolve, 60));

  // Should transition to half_open
  assert.equal(cb.getState(), "half_open");

  // Successes should close circuit
  cb.onSuccess();
  assert.equal(cb.getState(), "half_open");
  cb.onSuccess();
  assert.equal(cb.getState(), "closed");
});

test("CircuitBreaker integration: half_open failure returns to open", async () => {
  const cb = new CircuitBreaker({
    name: "integration-test-2",
    failureThreshold: 1,
    resetTimeoutMs: 30,
    halfOpenSuccessThreshold: 3,
  });

  cb.onFailure();
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.equal(cb.getState(), "half_open");

  cb.onSuccess();
  cb.onFailure();
  assert.equal(cb.getState(), "open");
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

  await new Promise(resolve => setTimeout(resolve, 60));

  const metrics2 = cb.getMetrics();
  assert.equal(metrics2.state, "half_open");
});

test("CircuitBreaker rapid recovery and re-failure", async () => {
  const cb = new CircuitBreaker({
    name: "rapid-test",
    failureThreshold: 2,
    resetTimeoutMs: 20,
    halfOpenSuccessThreshold: 2,
  });

  cb.onFailure();
  cb.onFailure();
  assert.equal(cb.getState(), "open");

  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(cb.getState(), "half_open");

  cb.onFailure();
  assert.equal(cb.getState(), "open");

  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(cb.getState(), "half_open");

  cb.onSuccess();
  cb.onSuccess();
  assert.equal(cb.getState(), "closed");
});
