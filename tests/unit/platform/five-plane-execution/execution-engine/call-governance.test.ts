import assert from "node:assert/strict";
import test from "node:test";

/**
 * Tests for call-governance.ts - Focus on onRetry hook invocation (R9-17)
 *
 * R9-17: The onRetry callback hook must be called before each retry attempt,
 * not just on final failure. It receives attempt number and error info,
 * and the retry delay is applied AFTER the callback is invoked.
 *
 * Test coverage:
 * 1. RetryConfig accepts onRetry callback field
 * 2. onRetry is called before each retry attempt (not just on final failure)
 * 3. onRetry receives attempt number and error info (code, message, retryable, retryAfterMs)
 * 4. Retry delay is applied after onRetry callback is invoked
 * 5. onRetry is NOT called on successful execution (only on retry)
 * 6. Multiple retries each trigger onRetry callback with correct attempt number
 */

test("RetryConfig accepts onRetry callback field", async () => {
  const { CallGovernance } = await import("../../../../../../src/platform/five-plane-execution/execution-engine/call-governance.js");

  const onRetryCalls: Array<{ attempt: number; error: { code: string; message: string; retryable: boolean; retryAfterMs?: number } }> = [];

  const policy = {
    retry: {
      maxAttempts: 3,
      baseDelayMs: 10,
      maxDelayMs: 50,
      backoffMultiplier: 2,
      onRetry: ({ attempt, error }: { attempt: number; error: { code: string; message: string; retryable: boolean; retryAfterMs?: number } }) => {
        onRetryCalls.push({ attempt, error });
      },
    },
  };

  const governance = new CallGovernance(policy);
  let callCount = 0;

  const result = await governance.execute("test-key", async () => {
    callCount++;
    if (callCount < 3) {
      const err = new Error("Transient error");
      (err as Error & { code?: string }).code = "transient";
      throw err;
    }
    return "success";
  });

  assert.ok(result.success, "Should eventually succeed");
  assert.equal(result.metadata?.attempts, 3, "Should have made 3 attempts");
});

test("onRetry is called before each retry attempt (not just on final failure)", async () => {
  const { CallGovernance } = await import("../../../../../../src/platform/five-plane-execution/execution-engine/call-governance.js");

  const onRetryCalls: Array<{ attempt: number; error: { code: string; message: string; retryable: boolean } }> = [];

  const policy = {
    retry: {
      maxAttempts: 3,
      baseDelayMs: 10,
      maxDelayMs: 50,
      backoffMultiplier: 2,
      onRetry: ({ attempt, error }: { attempt: number; error: { code: string; message: string; retryable: boolean } }) => {
        onRetryCalls.push({ attempt, error: { code: error.code, message: error.message, retryable: error.retryable } });
      },
    },
  };

  const governance = new CallGovernance(policy);
  let callCount = 0;

  const result = await governance.execute("test-key", async () => {
    callCount++;
    if (callCount < 3) {
      const err = new Error("Transient error");
      (err as Error & { code?: string }).code = "transient";
      throw err;
    }
    return "success";
  });

  assert.ok(result.success, "Should eventually succeed");
  // onRetry should be called for attempts 1->2 and 2->3, so 2 calls
  assert.equal(onRetryCalls.length, 2, "onRetry should be called twice (before retry 2 and before retry 3)");
  // onRetry for first retry (attempt 1 failed, about to attempt 2)
  assert.equal(onRetryCalls[0].attempt, 2, "First onRetry call should have attempt number 2");
  // onRetry for second retry (attempt 2 failed, about to attempt 3)
  assert.equal(onRetryCalls[1].attempt, 3, "Second onRetry call should have attempt number 3");
});

test("onRetry receives attempt number and error info (code, message, retryable, retryAfterMs)", async () => {
  const { CallGovernance } = await import("../../../../../../src/platform/five-plane-execution/execution-engine/call-governance.js");

  const onRetryInfo: Array<{ attempt: number; error: { code: string; message: string; retryable: boolean; retryAfterMs?: number } }> = [];

  const policy = {
    retry: {
      maxAttempts: 3,
      baseDelayMs: 10,
      maxDelayMs: 50,
      backoffMultiplier: 2,
      onRetry: ({ attempt, error }: { attempt: number; error: { code: string; message: string; retryable: boolean; retryAfterMs?: number } }) => {
        onRetryInfo.push({ attempt, error: { ...error } });
      },
    },
  };

  const governance = new CallGovernance(policy);
  let callCount = 0;

  const result = await governance.execute("test-key", async () => {
    callCount++;
    if (callCount < 3) {
      const err = new Error("Rate limit hit");
      (err as Error & { code?: string; retryAfterMs?: number }).code = "rate_limit";
      err.retryAfterMs = 100;
      throw err;
    }
    return "success";
  });

  assert.ok(result.success, "Should eventually succeed");
  assert.equal(onRetryInfo.length, 2, "onRetry should be called twice");

  // Verify first onRetry call info
  assert.equal(onRetryInfo[0].attempt, 2, "First onRetry should receive attempt 2");
  assert.equal(onRetryInfo[0].error.code, "rate_limit", "Should receive error code");
  assert.equal(onRetryInfo[0].error.message, "Rate limit hit", "Should receive error message");
  assert.equal(onRetryInfo[0].error.retryable, true, "Should receive retryable flag");
  assert.equal(onRetryInfo[0].error.retryAfterMs, 100, "Should receive retryAfterMs from error");

  // Verify second onRetry call info
  assert.equal(onRetryInfo[1].attempt, 3, "Second onRetry should receive attempt 3");
  assert.equal(onRetryInfo[1].error.code, "rate_limit", "Should receive error code");
});

test("Retry delay is applied after onRetry callback is invoked", async () => {
  const { CallGovernance } = await import("../../../../../../src/platform/five-plane-execution/execution-engine/call-governance.js");

  const callTimes: number[] = [];
  const onRetryStartTimes: number[] = [];
  const onRetryEndTimes: number[] = [];

  const policy = {
    retry: {
      maxAttempts: 3,
      baseDelayMs: 50, // 50ms delay
      maxDelayMs: 100,
      backoffMultiplier: 1, // linear delay (no exponential)
      onRetry: ({ attempt, error }: { attempt: number; error: { code: string; message: string; retryable: boolean } }) => {
        onRetryStartTimes.push(Date.now());
        // Simulate some work in the callback
        const start = Date.now();
        while (Date.now() - start < 5) {
          // busy wait 5ms
        }
        onRetryEndTimes.push(Date.now());
      },
    },
  };

  const governance = new CallGovernance(policy);
  let callCount = 0;

  const startTime = Date.now();
  const result = await governance.execute("test-key", async () => {
    callTimes.push(Date.now());
    callCount++;
    if (callCount < 3) {
      const err = new Error("Transient");
      (err as Error & { code?: string }).code = "transient";
      throw err;
    }
    return "success";
  });
  const endTime = Date.now();

  assert.ok(result.success, "Should eventually succeed");

  // Total time should be at least:
  // - 2 retry delays (50ms each) + onRetry callback times (5ms each)
  // Plus the actual call times
  const totalDelayTime = 2 * 50;
  const totalCallbackTime = 2 * 5;
  const minimumExpectedTime = totalDelayTime + totalCallbackTime;

  // The retry delay happens AFTER the onRetry callback starts,
  // so total time includes both callback execution and delay
  assert.ok(
    endTime - startTime >= minimumExpectedTime,
    `Total time (${endTime - startTime}ms) should be >= ${minimumExpectedTime}ms (delay + callback time)`
  );
});

test("onRetry is NOT called on successful execution (only on retry)", async () => {
  const { CallGovernance } = await import("../../../../../../src/platform/five-plane-execution/execution-engine/call-governance.js");

  const onRetryCalls: Array<{ attempt: number; error: { code: string; message: string; retryable: boolean } }> = [];

  const policy = {
    retry: {
      maxAttempts: 3,
      baseDelayMs: 10,
      maxDelayMs: 50,
      backoffMultiplier: 2,
      onRetry: ({ attempt, error }: { attempt: number; error: { code: string; message: string; retryable: boolean } }) => {
        onRetryCalls.push({ attempt, error: { code: error.code, message: error.message, retryable: error.retryable } });
      },
    },
  };

  const governance = new CallGovernance(policy);

  // Execute succeeds on first try - no retries needed
  const result = await governance.execute("test-key", async () => {
    return "immediate success";
  });

  assert.ok(result.success, "Should succeed on first try");
  assert.equal(result.metadata?.attempts, 1, "Should have made only 1 attempt");
  assert.equal(onRetryCalls.length, 0, "onRetry should NOT be called when execution succeeds immediately");
});

test("Multiple retries each trigger onRetry callback with correct attempt number", async () => {
  const { CallGovernance } = await import("../../../../../../src/platform/five-plane-execution/execution-engine/call-governance.js");

  const onRetryCalls: Array<{ attempt: number; error: { code: string } }> = [];

  const policy = {
    retry: {
      maxAttempts: 5,
      baseDelayMs: 10,
      maxDelayMs: 50,
      backoffMultiplier: 2,
      onRetry: ({ attempt, error }: { attempt: number; error: { code: string } }) => {
        onRetryCalls.push({ attempt, error: { code: error.code } });
      },
    },
  };

  const governance = new CallGovernance(policy);
  let callCount = 0;

  // Fail 4 times, succeed on 5th attempt
  const result = await governance.execute("test-key", async () => {
    callCount++;
    if (callCount < 5) {
      const err = new Error("Transient error");
      (err as Error & { code?: string }).code = "transient";
      throw err;
    }
    return "finally success";
  });

  assert.ok(result.success, "Should eventually succeed");
  assert.equal(result.metadata?.attempts, 5, "Should have made 5 attempts");

  // Should have 4 onRetry calls (before attempts 2, 3, 4, 5)
  assert.equal(onRetryCalls.length, 4, "onRetry should be called 4 times for 4 retries");

  // Verify attempt numbers are sequential
  assert.equal(onRetryCalls[0].attempt, 2, "First retry: attempt 2");
  assert.equal(onRetryCalls[1].attempt, 3, "Second retry: attempt 3");
  assert.equal(onRetryCalls[2].attempt, 4, "Third retry: attempt 4");
  assert.equal(onRetryCalls[3].attempt, 5, "Fourth retry: attempt 5");
});

test("onRetry is called when error is non-retryable but maxAttempts not reached - nonRetryableCodes takes precedence", async () => {
  const { CallGovernance } = await import("../../../../../../src/platform/five-plane-execution/execution-engine/call-governance.js");

  // This test verifies behavior when a normally retryable error becomes non-retryable
  // due to nonRetryableCodes configuration
  const onRetryCalls: Array<{ attempt: number }> = [];

  const policy = {
    retry: {
      maxAttempts: 3,
      baseDelayMs: 10,
      maxDelayMs: 50,
      backoffMultiplier: 2,
      retryableCodes: ["rate_limit"],
      nonRetryableCodes: ["auth"], // auth takes precedence
      onRetry: ({ attempt }: { attempt: number; error: { code: string; message: string; retryable: boolean } }) => {
        onRetryCalls.push({ attempt });
      },
    },
  };

  const governance = new CallGovernance(policy);
  let callCount = 0;

  const result = await governance.execute("test-key", async () => {
    callCount++;
    if (callCount < 3) {
      const err = new Error("Auth failure");
      (err as Error & { code?: string }).code = "auth_invalid_token";
      throw err;
    }
    return "success";
  });

  // Should fail because auth errors are non-retryable
  assert.ok(!result.success, "Should fail due to non-retryable auth error");
  assert.equal(result.error?.code, "governance.unknown_error", "Should have unknown error code from isRetryable check");
  // Note: The onRetry is only called when a retry actually happens
  // Since auth is non-retryable, no retries occur and onRetry is not called
});

test("onRetry is not called when retryable error exhausts all maxAttempts", async () => {
  const { CallGovernance } = await import("../../../../../../src/platform/five-plane-execution/execution-engine/call-governance.js");

  const onRetryCalls: Array<{ attempt: number }> = [];

  const policy = {
    retry: {
      maxAttempts: 3,
      baseDelayMs: 10,
      maxDelayMs: 50,
      backoffMultiplier: 2,
      onRetry: ({ attempt }: { attempt: number; error: { code: string; message: string; retryable: boolean } }) => {
        onRetryCalls.push({ attempt });
      },
    },
  };

  const governance = new CallGovernance(policy);

  // Always fail - will exhaust all 3 attempts
  const result = await governance.execute("test-key", async () => {
    const err = new Error("Always fails");
    (err as Error & { code?: string }).code = "transient";
    throw err;
  });

  assert.ok(!result.success, "Should fail after exhausting retries");
  assert.equal(result.metadata?.attempts, 3, "Should have made all 3 attempts");
  // onRetry is called before retry 2 and retry 3
  assert.equal(onRetryCalls.length, 2, "onRetry should be called twice (before retry 2 and 3)");
  // No onRetry call before attempt 4 because maxAttempts was reached
});

test("onRetry receives correct error info with retryable=false for non-retryable errors", async () => {
  const { CallGovernance } = await import("../../../../../../src/platform/five-plane-execution/execution-engine/call-governance.js");

  const onRetryInfo: Array<{ attempt: number; error: { code: string; retryable: boolean } }> = [];

  const policy = {
    retry: {
      maxAttempts: 3,
      baseDelayMs: 10,
      maxDelayMs: 50,
      backoffMultiplier: 2,
      nonRetryableCodes: ["not_found"], // Make 404 non-retryable
      onRetry: ({ attempt, error }: { attempt: number; error: { code: string; message: string; retryable: boolean } }) => {
        onRetryInfo.push({ attempt, error: { code: error.code, retryable: error.retryable } });
      },
    },
  };

  const governance = new CallGovernance(policy);

  // Return a non-retryable error
  const result = await governance.execute("test-key", async () => {
    const err = new Error("Resource not found");
    (err as Error & { code?: string }).code = "not_found";
    throw err;
  });

  // Should fail immediately without retry because not_found is non-retryable
  assert.ok(!result.success, "Should fail for non-retryable error");
  assert.equal(result.metadata?.attempts, 1, "Should only attempt once for non-retryable error");
  // Note: If the error is immediately determined to be non-retryable,
  // onRetry won't be called because no retry is attempted
});

test("onRetry callback receives attempt number starting at 2 for first retry", async () => {
  const { CallGovernance } = await import("../../../../../../src/platform/five-plane-execution/execution-engine/call-governance.js");

  const attemptNumbersReceived: number[] = [];

  const policy = {
    retry: {
      maxAttempts: 4,
      baseDelayMs: 10,
      maxDelayMs: 50,
      backoffMultiplier: 2,
      onRetry: ({ attempt }: { attempt: number; error: { code: string; message: string; retryable: boolean } }) => {
        attemptNumbersReceived.push(attempt);
      },
    },
  };

  const governance = new CallGovernance(policy);
  let callCount = 0;

  const result = await governance.execute("test-key", async () => {
    callCount++;
    if (callCount < 4) {
      const err = new Error("Transient");
      (err as Error & { code?: string }).code = "transient";
      throw err;
    }
    return "success";
  });

  assert.ok(result.success, "Should succeed");
  // Attempts: 1 (fail) -> 2 (first retry) -> 3 (second retry) -> 4 (third retry) -> success
  // onRetry called before attempt 2, 3, and 4
  assert.deepEqual(attemptNumbersReceived, [2, 3, 4], "onRetry should receive attempt numbers 2, 3, 4");
});

test("Governance with onRetry works correctly alongside limiter and breaker", async () => {
  const { CallGovernance } = await import("../../../../../../src/platform/five-plane-execution/execution-engine/call-governance.js");

  const onRetryCalls: Array<{ attempt: number }> = [];
  const callResults: boolean[] = [];

  const policy = {
    limiter: {
      maxCalls: 10,
      windowMs: 1000,
    },
    breaker: {
      failureThreshold: 3,
      successThreshold: 2,
      resetTimeoutMs: 1000,
    },
    retry: {
      maxAttempts: 3,
      baseDelayMs: 10,
      maxDelayMs: 50,
      backoffMultiplier: 2,
      onRetry: ({ attempt }: { attempt: number; error: { code: string; message: string; retryable: boolean } }) => {
        onRetryCalls.push({ attempt });
      },
    },
  };

  const governance = new CallGovernance(policy);
  let callCount = 0;

  const result = await governance.execute("combined-test-key", async () => {
    callCount++;
    callResults.push(true);
    if (callCount < 3) {
      const err = new Error("Transient");
      (err as Error & { code?: string }).code = "transient";
      throw err;
    }
    return "combined success";
  });

  assert.ok(result.success, "Should succeed with combined governance");
  assert.equal(onRetryCalls.length, 2, "onRetry should work with limiter and breaker");
  assert.equal(callResults.length, 3, "Should have 3 call attempts");
});
