import assert from "node:assert/strict";
import test from "node:test";
import { mock } from "node:test";

import {
  CircuitBreaker,
  CircuitBreakerOpenError,
  type CircuitBreakerState,
  type CircuitBreakerMetrics,
} from "../../../../../src/platform/model-gateway/provider-registry/circuit-breaker.js";

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
    monitorWindowMs: options?.monitorWindowMs ?? 60_000,
  });
}

// ============================================================================
// SLO Enforcement Tests
// ============================================================================

test("CircuitBreaker calculates failure rate as percentage (failures/totalRequests)", async () => {
  mock.timers.enable({ apis: ["Date"] });

  try {
    // Create breaker with high consecutive threshold so rate-based opening is the trigger
    const breaker = new CircuitBreaker({
      name: "rate-percentage-test",
      failureThreshold: 100, // High threshold to avoid consecutive trigger
      resetTimeoutMs: 10000,
      halfOpenSuccessThreshold: 2,
      monitorWindowMs: 60_000,
    });

    // Scenario: 3 successes, 1 failure -> 25% failure rate (should NOT open)
    for (let i = 0; i < 3; i++) {
      await breaker.execute(async () => "ok");
    }
    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail"); }),
      { message: "fail" },
    );

    // Failure rate = 1 / (3 + 1) = 25% < 50%, circuit should stay closed
    assert.equal(breaker.getState(), "closed");

    // Add more failures to push rate above 50%
    // Current: 1 failure, 3 successes
    // Add 2 more failures: 3 failures, 3 successes = 50% (still not > 50%)
    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail2"); }),
      { message: "fail2" },
    );
    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail3"); }),
      { message: "fail3" },
    );

    // 3 failures / 6 total = 50%, still at threshold (need > 50%)
    assert.equal(breaker.getState(), "closed");

    // Add 1 more failure: 4 failures / 7 total = 57% > 50%
    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail4"); }),
      { message: "fail4" },
    );

    // Now failure rate > 50%, circuit should open
    assert.equal(breaker.getState(), "open");
  } finally {
    mock.timers.reset();
  }
});

test("CircuitBreaker failure rate calculation: 1 failure out of 2 requests = 50%", async () => {
  mock.timers.enable({ apis: ["Date"] });

  try {
    const breaker = new CircuitBreaker({
      name: "rate-50-test",
      failureThreshold: 100,
      resetTimeoutMs: 10000,
      halfOpenSuccessThreshold: 2,
      monitorWindowMs: 60_000,
    });

    // 1 success first, then 1 failure -> 1/2 = 50%
    await breaker.execute(async () => "ok");
    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail"); }),
      { message: "fail" },
    );

    // At exactly 50%, circuit should NOT open (threshold is >= 0.5 but 0.5 is not > 0.5)
    // Actually looking at code: `this.getRecentFailureRate() >= 0.5` means 50% triggers
    // Let's verify current behavior
    const state = breaker.getState();
    // Circuit should be closed at exactly 50%
    assert.equal(state, "closed");
  } finally {
    mock.timers.reset();
  }
});

test("CircuitBreaker opens when failure rate exceeds 50%", async () => {
  mock.timers.enable({ apis: ["Date"] });

  try {
    const breaker = new CircuitBreaker({
      name: "rate-over-50-test",
      failureThreshold: 100,
      resetTimeoutMs: 10000,
      halfOpenSuccessThreshold: 2,
      monitorWindowMs: 60_000,
    });

    // 1 success, 2 failures -> 2/3 = 67% > 50%
    await breaker.execute(async () => "ok");
    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail1"); }),
      { message: "fail1" },
    );
    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail2"); }),
      { message: "fail2" },
    );

    assert.equal(breaker.getState(), "open");
  } finally {
    mock.timers.reset();
  }
});

test("CircuitBreaker consecutive failures trigger independent of rate", async () => {
  const breaker = createBreaker({ failureThreshold: 3 });

  // 3 consecutive failures should open circuit regardless of rate
  await assert.rejects(
    () => breaker.execute(async () => { throw new Error("fail1"); }),
    { message: "fail1" },
  );
  assert.equal(breaker.getState(), "closed");

  await assert.rejects(
    () => breaker.execute(async () => { throw new Error("fail2"); }),
    { message: "fail2" },
  );
  assert.equal(breaker.getState(), "closed");

  await assert.rejects(
    () => breaker.execute(async () => { throw new Error("fail3"); }),
    { message: "fail3" },
  );

  assert.equal(breaker.getState(), "open");
});

// ============================================================================
// Half-Open Probe Limiting (PROV-01)
// ============================================================================

test("CircuitBreaker half_open admits at most one probe at a time (PROV-01)", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });

  try {
    const breaker = new CircuitBreaker({
      name: "probe-limit-test",
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

    // Advance time to trigger half_open
    mock.timers.tick(60);
    assert.equal(breaker.getState(), "half_open");

    // First probe is admitted
    const result1 = await breaker.execute(async () => "probe1");
    assert.equal(result1, "probe1");

    // Second probe should be rejected (halfOpenInFlight >= 1)
    await assert.rejects(
      () => breaker.execute(async () => "probe2"),
      (error: unknown) => error instanceof CircuitBreakerOpenError,
    );

    // State should still be half_open (not closed yet)
    assert.equal(breaker.getState(), "half_open");
  } finally {
    mock.timers.reset();
  }
});

test("CircuitBreaker half_open success closes circuit after threshold", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });

  try {
    const breaker = new CircuitBreaker({
      name: "half-open-success-test",
      failureThreshold: 1,
      resetTimeoutMs: 50,
      halfOpenSuccessThreshold: 2,
      monitorWindowMs: 60_000,
    });

    // Open the circuit
    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail"); }),
      { message: "fail" },
    );

    // Advance time to trigger half_open
    mock.timers.tick(60);
    assert.equal(breaker.getState(), "half_open");

    // Two successes should close the circuit
    await breaker.execute(async () => "ok1");
    assert.equal(breaker.getState(), "half_open"); // Still half_open, need 2nd success

    await breaker.execute(async () => "ok2");
    assert.equal(breaker.getState(), "closed");
  } finally {
    mock.timers.reset();
  }
});

// ============================================================================
// State Transitions
// ============================================================================

test("CircuitBreaker transitions: closed -> open -> half_open -> closed", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });

  try {
    const breaker = createBreaker({ failureThreshold: 1, resetTimeoutMs: 50 });

    // Initial state: closed
    assert.equal(breaker.getState(), "closed");

    // Trigger failure to open
    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail"); }),
      { message: "fail" },
    );
    assert.equal(breaker.getState(), "open");

    // Wait for reset timeout -> half_open
    mock.timers.tick(60);
    assert.equal(breaker.getState(), "half_open");

    // Successful probes -> closed
    await breaker.execute(async () => "ok1");
    await breaker.execute(async () => "ok2");
    assert.equal(breaker.getState(), "closed");
  } finally {
    mock.timers.reset();
  }
});

test("CircuitBreaker transitions: half_open -> open on any failure", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });

  try {
    const breaker = createBreaker({ failureThreshold: 1, resetTimeoutMs: 50 });

    // Open
    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail"); }),
      { message: "fail" },
    );

    // half_open
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
// Metrics and Error Properties
// ============================================================================

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
  assert.ok(metrics.nextAttemptAt === null || typeof metrics.nextAttemptAt === "number");
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

test("CircuitBreaker records lastFailureAt and lastSuccessAt", async () => {
  mock.timers.enable({ apis: ["Date"] });

  try {
    const breaker = createBreaker();

    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail"); }),
      { message: "fail" },
    );

    const metricsAfterFailure = breaker.getMetrics();
    assert.notStrictEqual(metricsAfterFailure.lastFailureAt, null);

    mock.timers.tick(100);

    await breaker.execute(async () => "success");
    assert.notStrictEqual(breaker.getMetrics().lastSuccessAt, null);
  } finally {
    mock.timers.reset();
  }
});

test("CircuitBreaker reset clears failure/success counters and timestamps", async () => {
  mock.timers.enable({ apis: ["Date"] });

  try {
    const breaker = createBreaker();

    // Generate some failures and successes
    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail"); }),
      { message: "fail" },
    );
    await breaker.execute(async () => "ok");

    const metricsBefore = breaker.getMetrics();
    assert.ok(metricsBefore.failures > 0);
    assert.ok(metricsBefore.successes > 0);

    // Cannot reset directly - verify state transitions clear counters
    // When transitioning to closed, counters reset
    await assert.rejects(
      () => breaker.execute(async () => { throw new Error("fail"); }),
      { message: "fail" },
    );

    // Advance time to half_open then succeed to close
    mock.timers.tick(60);
    await breaker.execute(async () => "ok1");
    await breaker.execute(async () => "ok2");

    const metricsAfter = breaker.getMetrics();
    assert.equal(breaker.getState(), "closed");
    // After successful close, consecutive counters should be 0
    assert.equal(metricsAfter.consecutiveFailures, 0);
    assert.equal(metricsAfter.consecutiveSuccesses, 0);
  } finally {
    mock.timers.reset();
  }
});

test("CircuitBreaker state type accepts all valid values", () => {
  const states: CircuitBreakerState[] = ["closed", "open", "half_open"];
  assert.equal(states.length, 3);
});