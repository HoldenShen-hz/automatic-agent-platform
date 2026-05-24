import assert from "node:assert/strict";
import test from "node:test";

import { CallGovernance, type CallPolicy } from "../../../../../src/platform/five-plane-execution/execution-engine/call-governance.js";

test("CallGovernance invokes onRetry before each retry attempt", async () => {
  const retryCalls: Array<{ attempt: number; code: string; retryAfterMs?: number }> = [];
  const policy: CallPolicy = {
    retry: {
      maxAttempts: 3,
      baseDelayMs: 1,
      maxDelayMs: 5,
      backoffMultiplier: 1,
      onRetry: async ({ attempt, error }) => {
        retryCalls.push({
          attempt,
          code: error.code,
          ...(error.retryAfterMs == null ? {} : { retryAfterMs: error.retryAfterMs }),
        });
      },
    },
  };
  const governance = new CallGovernance(policy);
  let callCount = 0;

  const result = await governance.execute("test-key", async () => {
    callCount += 1;
    if (callCount < 3) {
      const error = new Error("rate limited") as Error & { code?: string; retryAfterMs?: number };
      error.code = "rate_limit";
      error.retryAfterMs = 7;
      throw error;
    }
    return "ok";
  });

  assert.equal(result.success, true);
  assert.equal(result.metadata?.attempts, 3);
  assert.deepEqual(retryCalls.map((item) => item.attempt), [2, 3]);
  assert.equal(retryCalls[0]?.code, "rate_limit");
  assert.equal(retryCalls[0]?.retryAfterMs, 7);
});

test("CallGovernance does not call onRetry when execution succeeds immediately", async () => {
  const retryCalls: number[] = [];
  const governance = new CallGovernance({
    retry: {
      maxAttempts: 3,
      baseDelayMs: 1,
      maxDelayMs: 5,
      backoffMultiplier: 1,
      onRetry: async ({ attempt }) => {
        retryCalls.push(attempt);
      },
    },
  });

  const result = await governance.execute("test-key", async () => "immediate-success");

  assert.equal(result.success, true);
  assert.equal(result.metadata?.attempts, 1);
  assert.deepEqual(retryCalls, []);
});

test("CallGovernance stops retrying when nonRetryableCodes match", async () => {
  const retryCalls: number[] = [];
  const governance = new CallGovernance({
    retry: {
      maxAttempts: 3,
      baseDelayMs: 1,
      maxDelayMs: 5,
      backoffMultiplier: 1,
      nonRetryableCodes: ["auth"],
      onRetry: async ({ attempt }) => {
        retryCalls.push(attempt);
      },
    },
  });

  const result = await governance.execute("test-key", async () => {
    const error = new Error("auth failure") as Error & { code?: string };
    error.code = "auth_invalid_token";
    throw error;
  });

  assert.equal(result.success, false);
  assert.equal(result.error?.code, "governance.unknown_error");
  assert.deepEqual(retryCalls, []);
});

test("CallGovernance reports limiter rejection without executing the call", async () => {
  const governance = new CallGovernance(
    {},
    {
      distributedRateLimiter: {
        checkAndConsume: async () => ({ allowed: false, retryAfterMs: 25 }),
      },
    },
  );
  let executed = false;

  const result = await governance.execute("limited-key", async () => {
    executed = true;
    return "never";
  });

  assert.equal(executed, false);
  assert.equal(result.success, false);
  assert.equal(result.error?.code, "governance.limiter_rejected");
  assert.equal(result.error?.retryAfterMs, 25);
});
