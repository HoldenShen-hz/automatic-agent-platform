/**
 * Circuit Breaker Tests - Issue #2088, #2097
 *
 * Tests for the circuit breaker pattern implementation focusing on:
 * - Issue #2088: failureRate formula should be failures/totalRequests not failures/windowSec
 * - Issue #2097: No minimum sample size - 3 failures opens even with 1000 successes
 */

import assert from "node:assert/strict";
import test from "node:test";
import { mock } from "node:test";

import {
  CircuitBreaker,
  CircuitBreakerOpenError,
} from "../../../../../src/platform/model-gateway/provider-registry/circuit-breaker.js";

// ============================================================================
// Issue #2088: failureRate formula bug
// ============================================================================

test("CircuitBreaker failure rate uses totalRequests denominator (failures/totalRequests)", async () => {
  mock.timers.enable({ apis: ["Date"] });

  try {
    // Create breaker with high consecutive threshold so rate-based opening is the trigger
    const breaker = new CircuitBreaker({
      name: "rate-division-test",
      failureThreshold: 100, // High threshold to avoid consecutive trigger
      resetTimeoutMs: 10000,
      halfOpenSuccessThreshold: 2,
      monitorWindowMs: 60_000,
    });

    // Scenario: 1 failure out of 1 total request = 100% failure rate
    // Should open even with just 1 failure since it's 100% failure rate
    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("single-failure"); }),
      { message: "single-failure" },
    );

    // With only 1 failure out of 1 total request = 100% > 50%, circuit should open
    assert.equal(breaker.getState(), "open");
  } finally {
    mock.timers.reset();
  }
});

test("CircuitBreaker with many successes before failures should still calculate rate correctly", async () => {
  mock.timers.enable({ apis: ["Date"] });

  try {
    const breaker = new CircuitBreaker({
      name: "rate-with-many-successes",
      failureThreshold: 100,
      resetTimeoutMs: 10000,
      halfOpenSuccessThreshold: 2,
      monitorWindowMs: 60_000,
    });

    // 100 successes, then 1 failure
    // Failure rate = 1 / (100 + 1) = ~0.99% < 50%, should NOT open
    for (let i = 0; i < 100; i++) {
      await breaker.execute(async () => "ok");
    }

    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail"); }),
      { message: "fail" },
    );

    // 1 failure out of 101 total = ~0.99% < 50%, circuit should stay closed
    assert.equal(breaker.getState(), "closed");
  } finally {
    mock.timers.reset();
  }
});

// ============================================================================
// Issue #2097: No minimum sample size
// ============================================================================

test("CircuitBreaker should have minimum sample size before opening due to rate", async () => {
  mock.timers.enable({ apis: ["Date"] });

  try {
    const breaker = new CircuitBreaker({
      name: "min-sample-test",
      failureThreshold: 100,
      resetTimeoutMs: 10000,
      halfOpenSuccessThreshold: 2,
      monitorWindowMs: 60_000,
    });

    // 1000 successes, then 3 failures
    // These 3 consecutive failures should open via consecutive failures mechanism
    // Only if the rate-based opening doesn't properly account for high sample size
    for (let i = 0; i < 1000; i++) {
      await breaker.execute(async () => "ok");
    }

    // 3 consecutive failures should open the circuit regardless of total count
    // Issue #2097: 3 failures should NOT open when there are 1000 successes
    // because the failure rate is 3/1003 = 0.3% << 50%
    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail1"); }),
      { message: "fail1" },
    );
    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail2"); }),
      { message: "fail2" },
    );
    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail3"); }),
      { message: "fail3" },
    );

    // With 1000 successes and 3 failures:
    // Failure rate = 3/1003 = ~0.3%
    // But consecutive failures = 3 >= threshold of 100 for rate-based?
    // The issue is that 3 consecutive failures opens circuit even with 1000 successes

    // Actually the current code opens circuit if:
    // 1. consecutiveFailures >= failureThreshold, OR
    // 2. getRecentFailureRate() >= 0.5
    //
    // With failureThreshold=100, consecutive failures (3) is NOT >= 100
    // But getRecentFailureRate() calculation seems to be the issue
    // The code uses (failures/windowSec)*10 which is wrong

    // Let's check what the actual state is
    const state = breaker.getState();
    assert.equal(state, "closed", "3 failures out of 1003 requests should NOT open circuit (rate is ~0.3%)");
  } finally {
    mock.timers.reset();
  }
});

test("CircuitBreaker rate-based opening with sufficient sample size", async () => {
  mock.timers.enable({ apis: ["Date"] });

  try {
    const breaker = new CircuitBreaker({
      name: "rate-sufficient-sample",
      failureThreshold: 100,
      resetTimeoutMs: 10000,
      halfOpenSuccessThreshold: 2,
      monitorWindowMs: 60_000,
    });

    // 10 successes, then 10 failures -> 50% rate
    for (let i = 0; i < 10; i++) {
      await breaker.execute(async () => "ok");
    }

    for (let i = 0; i < 10; i++) {
      await assert.rejects(
        () => breaker.execute(async () => { throw new Error(`fail${i}`); }),
        /fail/,
      );
    }

    // 10 failures / 20 total = 50% >= 50%, should open
    assert.equal(breaker.getState(), "open");
  } finally {
    mock.timers.reset();
  }
});

test("CircuitBreaker 51% failure rate should open", async () => {
  mock.timers.enable({ apis: ["Date"] });

  try {
    const breaker = new CircuitBreaker({
      name: "rate-51-percent",
      failureThreshold: 100,
      resetTimeoutMs: 10000,
      halfOpenSuccessThreshold: 2,
      monitorWindowMs: 60_000,
    });

    // 49 successes, 51 failures -> 51% failure rate
    for (let i = 0; i < 49; i++) {
      await breaker.execute(async () => "ok");
    }

    for (let i = 0; i < 51; i++) {
      await assert.rejects(
        () => breaker.execute(async () => { throw new Error(`fail${i}`); }),
        /fail/,
      );
    }

    // 51 failures / 100 total = 51% >= 50%, should open
    assert.equal(breaker.getState(), "open");
  } finally {
    mock.timers.reset();
  }
});

test("CircuitBreaker exactly 50% failure rate should open", async () => {
  mock.timers.enable({ apis: ["Date"] });

  try {
    const breaker = new CircuitBreaker({
      name: "rate-50-percent",
      failureThreshold: 100,
      resetTimeoutMs: 10000,
      halfOpenSuccessThreshold: 2,
      monitorWindowMs: 60_000,
    });

    // 50 successes, 50 failures -> exactly 50% failure rate
    for (let i = 0; i < 50; i++) {
      await breaker.execute(async () => "ok");
    }

    for (let i = 0; i < 50; i++) {
      await assert.rejects(
        () => breaker.execute(async () => { throw new Error(`fail${i}`); }),
        /fail/,
      );
    }

    // 50 failures / 100 total = 50% >= 50%, should open
    assert.equal(breaker.getState(), "open");
  } finally {
    mock.timers.reset();
  }
});

test("CircuitBreaker 49% failure rate should stay closed", async () => {
  mock.timers.enable({ apis: ["Date"] });

  try {
    const breaker = new CircuitBreaker({
      name: "rate-49-percent",
      failureThreshold: 100,
      resetTimeoutMs: 10000,
      halfOpenSuccessThreshold: 2,
      monitorWindowMs: 60_000,
    });

    // 51 successes, 49 failures -> 49% failure rate
    for (let i = 0; i < 51; i++) {
      await breaker.execute(async () => "ok");
    }

    for (let i = 0; i < 49; i++) {
      await assert.rejects(
        () => breaker.execute(async () => { throw new Error(`fail${i}`); }),
        /fail/,
      );
    }

    // 49 failures / 100 total = 49% < 50%, should stay closed
    assert.equal(breaker.getState(), "closed");
  } finally {
    mock.timers.reset();
  }
});

// ============================================================================
// State transition tests
// ============================================================================

test("CircuitBreaker opens after reset timeout when in half_open", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });

  try {
    const breaker = new CircuitBreaker({
      name: "timeout-half-open",
      failureThreshold: 1,
      resetTimeoutMs: 50,
      halfOpenSuccessThreshold: 1,
      monitorWindowMs: 60_000,
    });

    // Open the circuit
    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail"); }),
      { message: "fail" },
    );
    assert.equal(breaker.getState(), "open");

    // Advance time past reset timeout
    mock.timers.tick(60);
    assert.equal(breaker.getState(), "half_open");

    // Success in half_open should close
    await breaker.execute(async () => "success");
    assert.equal(breaker.getState(), "closed");
  } finally {
    mock.timers.reset();
  }
});

test("CircuitBreaker failure in half_open returns to open", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });

  try {
    const breaker = new CircuitBreaker({
      name: "half-open-failure",
      failureThreshold: 1,
      resetTimeoutMs: 50,
      halfOpenSuccessThreshold: 3,
      monitorWindowMs: 60_000,
    });

    // Open the circuit
    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail"); }),
      { message: "fail" },
    );
    assert.equal(breaker.getState(), "open");

    // Advance time to half_open
    mock.timers.tick(60);
    assert.equal(breaker.getState(), "half_open");

    // Failure in half_open goes back to open
    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("probe-fail"); }),
      { message: "probe-fail" },
    );
    assert.equal(breaker.getState(), "open");
  } finally {
    mock.timers.reset();
  }
});

// ============================================================================
// Metrics tests
// ============================================================================

test("CircuitBreaker getMetrics returns correct values", async () => {
  mock.timers.enable({ apis: ["Date"] });

  try {
    const breaker = new CircuitBreaker({
      name: "metrics-test",
      failureThreshold: 3,
      resetTimeoutMs: 1000,
      halfOpenSuccessThreshold: 2,
      monitorWindowMs: 60_000,
    });

    await breaker.execute(async () => "ok");
    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail"); }),
      { message: "fail" },
    );

    const metrics = breaker.getMetrics();

    assert.equal(metrics.state, "closed");
    assert.equal(metrics.failures, 1);
    assert.equal(metrics.successes, 1);
    assert.ok(metrics.consecutiveFailures >= 0);
    assert.ok(metrics.consecutiveSuccesses >= 0);
  } finally {
    mock.timers.reset();
  }
});

test("CircuitBreaker metrics nextAttemptAt is null when closed", () => {
  const breaker = new CircuitBreaker({
    name: "closed-metrics",
    failureThreshold: 5,
    resetTimeoutMs: 1000,
    halfOpenSuccessThreshold: 2,
    monitorWindowMs: 60_000,
  });

  const metrics = breaker.getMetrics();
  assert.equal(metrics.nextAttemptAt, null);
});

test("CircuitBreaker metrics nextAttemptAt is set when open", async () => {
  mock.timers.enable({ apis: ["Date"] });

  try {
    const breaker = new CircuitBreaker({
      name: "open-metrics",
      failureThreshold: 1,
      resetTimeoutMs: 5000,
      halfOpenSuccessThreshold: 2,
      monitorWindowMs: 60_000,
    });

    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail"); }),
      { message: "fail" },
    );

    const metrics = breaker.getMetrics();
    assert.equal(metrics.state, "open");
    assert.ok(metrics.nextAttemptAt !== null);
    assert.ok(metrics.nextAttemptAt > Date.now());
  } finally {
    mock.timers.reset();
  }
});

// ============================================================================
// Error handling tests
// ============================================================================

test("CircuitBreakerOpenError contains circuit name and retry info", () => {
  const error = new CircuitBreakerOpenError("Circuit open", "test-circuit", 5000);
  assert.equal(error.circuitName, "test-circuit");
  assert.equal(error.retryAfterMs, 5000);
  assert.ok(error.message.includes("test-circuit"));
});

test("CircuitBreaker execute throws CircuitBreakerOpenError when open", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });

  try {
    const breaker = new CircuitBreaker({
      name: "reject-when-open",
      failureThreshold: 1,
      resetTimeoutMs: 10000,
      halfOpenSuccessThreshold: 2,
      monitorWindowMs: 60_000,
    });

    // Open the circuit
    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail"); }),
      { message: "fail" },
    );

    // Subsequent calls should be rejected
    await assert.rejects(
      () => breaker.execute(async () => "should-fail"),
      (err: unknown) => err instanceof CircuitBreakerOpenError,
    );
  } finally {
    mock.timers.reset();
  }
});

test("CircuitBreaker onStateChange callback is called on transition", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });

  try {
    const stateChanges: Array<{ oldState: string; newState: string }> = [];
    const breaker = new CircuitBreaker({
      name: "state-change-callback",
      failureThreshold: 1,
      resetTimeoutMs: 50,
      halfOpenSuccessThreshold: 2,
      monitorWindowMs: 60_000,
      onStateChange: (payload) => {
        stateChanges.push({ oldState: payload.oldState, newState: payload.newState });
      },
    });

    // Trigger failure
    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail"); }),
      { message: "fail" },
    );

    assert.equal(stateChanges.length, 1);
    assert.equal(stateChanges[0].oldState, "closed");
    assert.equal(stateChanges[0].newState, "open");

    // Advance time and trigger half_open
    mock.timers.tick(60);
    assert.equal(breaker.getState(), "half_open");

    assert.ok(stateChanges.length >= 2);
    assert.equal(stateChanges[1].oldState, "open");
    assert.equal(stateChanges[1].newState, "half_open");
  } finally {
    mock.timers.reset();
  }
});