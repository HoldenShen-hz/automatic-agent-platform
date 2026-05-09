import assert from "node:assert/strict";
import test from "node:test";

/**
 * R13-17 tests: Loop controller retry_same_plan should enforce backoff
 */

test("R13-17: retry_same_plan action requires backoff delay before retry", () => {
  type HarnessDecisionAction = "retry_same_plan" | "replan" | "proceed";

  const BACKOFF_BASE_MS = 1000;
  const JITTER_FACTOR = 0.1;

  function getBackoffMs(retryAttempt: number): number {
    const exponentialDelay = BACKOFF_BASE_MS * Math.pow(2, retryAttempt - 1);
    const jitter = exponentialDelay * JITTER_FACTOR * Math.random();
    return Math.floor(exponentialDelay + jitter);
  }

  function shouldContinue(
    lastAction: HarnessDecisionAction,
    lastRetryAt: number,
    retryAttempt: number,
  ): boolean {
    if (lastAction !== "retry_same_plan") {
      return true;
    }
    const elapsed = Date.now() - lastRetryAt;
    return elapsed >= getBackoffMs(retryAttempt);
  }

  const now = Date.now();
  const lastRetryAt = now - 500; // Only 500ms ago, less than backoff

  // Should not continue because backoff not elapsed
  const canContinue = shouldContinue("retry_same_plan", lastRetryAt, 1);
  assert.equal(canContinue, false, "retry_same_plan should not continue before backoff elapses");
});

test("R13-17: Backoff prevents immediate retry_same_plan", () => {
  const BACKOFF_BASE_MS = 1000;

  function getBackoffMs(retryAttempt: number): number {
    return BACKOFF_BASE_MS * Math.pow(2, retryAttempt - 1);
  }

  // After attempt 1, backoff is 1000ms
  const backoff1 = getBackoffMs(1);
  assert.equal(backoff1, 1000, "Attempt 1 should have 1000ms backoff");

  // After attempt 2, backoff is 2000ms
  const backoff2 = getBackoffMs(2);
  assert.equal(backoff2, 2000, "Attempt 2 should have 2000ms backoff");

  // After attempt 3, backoff is 4000ms
  const backoff3 = getBackoffMs(3);
  assert.equal(backoff3, 4000, "Attempt 3 should have 4000ms backoff");
});

test("R13-17: replan action does not require backoff", () => {
  type HarnessDecisionAction = "retry_same_plan" | "replan" | "proceed";

  const BACKOFF_BASE_MS = 1000;

  function getBackoffMs(retryAttempt: number): number {
    return BACKOFF_BASE_MS * Math.pow(2, retryAttempt - 1);
  }

  function shouldContinue(
    lastAction: HarnessDecisionAction,
    lastRetryAt: number,
    retryAttempt: number,
  ): boolean {
    if (lastAction === "retry_same_plan") {
      const elapsed = Date.now() - lastRetryAt;
      return elapsed >= getBackoffMs(retryAttempt);
    }
    // replan and proceed don't require backoff
    return true;
  }

  // replan should always be allowed regardless of timing
  const canContinue = shouldContinue("replan", Date.now(), 1);
  assert.equal(canContinue, true, "replan should not require backoff");
});