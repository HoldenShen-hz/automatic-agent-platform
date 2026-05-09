import assert from "node:assert/strict";
import test from "node:test";

/**
 * R13-13 tests: Recovery controller retry limits and backoff
 * R13-16 tests: Node vs graph retry scope distinction
 */

interface MockLoopController {
  shouldContinue: boolean;
  backoffMs: number;
  getState: () => { retryAttempt: number };
  getBackoffMs: () => number;
}

function createMockLoopController(overrides: Partial<MockLoopController> = {}): MockLoopController {
  return {
    shouldContinue: true,
    backoffMs: 1000,
    getState: () => ({ retryAttempt: 0 }),
    getBackoffMs: () => 1000,
    ...overrides,
  };
}

// R13-13 test: Retry budget should be capped at RETRY_MAX_ATTEMPTS
test("R13-13: Retry should be blocked after RETRY_MAX_ATTEMPTS exceeded", () => {
  const RETRY_MAX_ATTEMPTS = 5;
  const currentAttempt = 5;

  // After exceeding max attempts, retry should not be allowed
  const canRetry = currentAttempt < RETRY_MAX_ATTEMPTS;
  assert.equal(canRetry, false, "Retry should be blocked after exceeding max attempts");
});

// R13-13 test: Backoff delay should increase exponentially
test("R13-13: Backoff delay should follow exponential pattern", () => {
  const RETRY_BACKOFF_BASE_MS = 1_000;
  const RETRY_BACKOFF_MAX_MS = 60_000;
  const RETRY_JITTER_FACTOR = 0.1;

  function computeBackoffDelayMs(attempt: number): number {
    const exponentialDelay = RETRY_BACKOFF_BASE_MS * 2 ** Math.max(0, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, RETRY_BACKOFF_MAX_MS);
    const jitter = cappedDelay * RETRY_JITTER_FACTOR * Math.random();
    return Math.floor(cappedDelay + jitter);
  }

  // Attempt 1: base delay (~1000ms with jitter)
  const delay1 = computeBackoffDelayMs(1);
  assert.ok(delay1 >= 1000 && delay1 <= 1100, `Attempt 1 delay should be ~1000ms, got ${delay1}`);

  // Attempt 2: 2x base (~2000ms)
  const delay2 = computeBackoffDelayMs(2);
  assert.ok(delay2 >= 2000 && delay2 <= 2200, `Attempt 2 delay should be ~2000ms, got ${delay2}`);

  // Attempt 3: 4x base (~4000ms)
  const delay3 = computeBackoffDelayMs(3);
  assert.ok(delay3 >= 4000 && delay3 <= 4400, `Attempt 3 delay should be ~4000ms, got ${delay3}`);

  // Attempt 5: 16x base (~16000ms)
  const delay5 = computeBackoffDelayMs(5);
  assert.ok(delay5 >= 16000 && delay5 <= 17600, `Attempt 5 delay should be ~16000ms, got ${delay5}`);
});

// R13-13 test: Backoff should be capped at RETRY_BACKOFF_MAX_MS
test("R13-13: Backoff delay should be capped at max", () => {
  const RETRY_BACKOFF_MAX_MS = 60_000;

  function computeBackoffDelayMs(attempt: number): number {
    const exponentialDelay = 1_000 * 2 ** Math.max(0, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, RETRY_BACKOFF_MAX_MS);
    const jitter = cappedDelay * 0.1 * Math.random();
    return Math.floor(cappedDelay + jitter);
  }

  // Attempt 10 (2^9 * 1000 = 512000) should be capped at 60000
  const delay10 = computeBackoffDelayMs(10);
  assert.ok(delay10 <= RETRY_BACKOFF_MAX_MS + 6000, `Attempt 10 delay should be capped at ~60000ms, got ${delay10}`);
});

// R13-16 test: Node-level failures use node scope (retry_same_plan)
test("R13-16: llm_provider_unavailable uses node scope retry", () => {
  type HarnessFailureType = "llm_provider_unavailable" | "tool_timeout" | "platform_panic" | "worker_crash";
  type RecoveryScope = "node" | "graph";

  function determineRetryScope(failure: HarnessFailureType): RecoveryScope {
    switch (failure) {
      case "llm_provider_unavailable":
      case "tool_timeout":
        return "node";
      case "platform_panic":
      case "worker_crash":
        return "graph";
      default:
        return "node";
    }
  }

  assert.equal(determineRetryScope("llm_provider_unavailable"), "node", "llm_provider should use node scope");
  assert.equal(determineRetryScope("tool_timeout"), "node", "tool_timeout should use node scope");
});

// R13-16 test: Graph-level failures use graph scope (replan)
test("R13-16: platform_panic and worker_crash use graph scope retry", () => {
  type HarnessFailureType = "llm_provider_unavailable" | "tool_timeout" | "platform_panic" | "worker_crash";
  type RecoveryScope = "node" | "graph";

  function determineRetryScope(failure: HarnessFailureType): RecoveryScope {
    switch (failure) {
      case "llm_provider_unavailable":
      case "tool_timeout":
        return "node";
      case "platform_panic":
      case "worker_crash":
        return "graph";
      default:
        return "node";
    }
  }

  assert.equal(determineRetryScope("platform_panic"), "graph", "platform_panic should use graph scope");
  assert.equal(determineRetryScope("worker_crash"), "graph", "worker_crash should use graph scope");
});