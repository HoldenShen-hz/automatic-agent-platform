import assert from "node:assert/strict";
import test from "node:test";

import {
  Retry,
  RetryResult,
  RetryTimeoutError,
  RetryAbortError,
  withRetry,
  type RetryOptions,
  type RetryExecutionOptions,
  type RetryAttempt,
  type RetryStats,
} from "../../../../src/platform/stability/retry.js";

test("Retry exports are available", () => {
  assert.equal(typeof Retry, "function");
  assert.equal(typeof RetryResult, "object");
  assert.equal(typeof RetryTimeoutError, "function");
  assert.equal(typeof RetryAbortError, "function");
  assert.equal(typeof withRetry, "function");
});

test("RetryResult enum has all expected values", () => {
  assert.equal(RetryResult.SUCCESS, "SUCCESS");
  assert.equal(RetryResult.RETRYABLE_FAILURE, "RETRYABLE_FAILURE");
  assert.equal(RetryResult.NON_RETRYABLE_FAILURE, "NON_RETRYABLE_FAILURE");
});

test("Retry executes successfully on first attempt", async () => {
  const retry = new Retry();
  const result = await retry.execute(async () => "success");
  assert.equal(result, "success");
});

test("Retry executes with signal", async () => {
  const controller = new AbortController();
  const retry = new Retry();
  const result = await retry.execute(
    async (signal) => {
      assert.ok(signal === controller.signal);
      return "with-signal";
    },
    undefined,
    { signal: controller.signal },
  );
  assert.equal(result, "with-signal");
});

test("Retry retries on failure and eventually succeeds", async () => {
  const retry = new Retry({ maxAttempts: 3 });
  let attempts = 0;

  const result = await retry.execute(async () => {
    attempts++;
    if (attempts < 3) {
      throw new Error(`Attempt ${attempts} failed`);
    }
    return "success";
  });

  assert.equal(result, "success");
  assert.equal(attempts, 3);
});

test("Retry throws after maxAttempts exceeded", async () => {
  const retry = new Retry({ maxAttempts: 2 });

  await assert.rejects(
    async () => retry.execute(async () => { throw new Error("always fails"); }),
    Error,
  );
});

test("RetryTimeoutError is thrown when maxDuration exceeded", async () => {
  const retry = new Retry({ maxDurationMs: 50, maxAttempts: 3, initialDelayMs: 60 });

  await assert.rejects(
    async () => retry.execute(async () => {
      throw new Error("retry me");
    }),
    RetryTimeoutError,
  );
});

test("RetryAbortError is thrown when signal is aborted", async () => {
  const retry = new Retry({ maxAttempts: 5 });
  const controller = new AbortController();

  // Abort before the operation starts
  controller.abort();

  await assert.rejects(
    async () => retry.execute(
      async () => {
        await new Promise((r) => setTimeout(r, 100));
        return "not reached";
      },
      undefined,
      { signal: controller.signal },
    ),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.ok(error instanceof RetryAbortError || error.name === "AbortError");
      return true;
    },
  );
});

test("Retry uses exponential backoff", async () => {
  const retry = new Retry({
    maxAttempts: 3,
    initialDelayMs: 10,
    backoffMultiplier: 2,
    jitterFactor: 0,
  });

  const delays: number[] = [];
  let lastTime = Date.now();

  await assert.rejects(
    async () => retry.execute(async () => {
      const now = Date.now();
      if (lastTime !== now) {
        delays.push(now - lastTime);
        lastTime = now;
      }
      throw new Error("fail");
    }),
    Error,
  );

  if (delays.length >= 2) {
    assert.ok(delays[1]! >= delays[0]!);
  }
});

test("Retry.executeWithResult returns RetryAttempt", async () => {
  const retry = new Retry({ maxAttempts: 2 });
  let attempts = 0;

  const attempt = await retry.executeWithResult(async () => {
    attempts++;
    if (attempts < 2) {
      throw new Error("fail");
    }
    return "success";
  });

  assert.equal(attempt.result, "success");
  assert.equal(attempt.success, true);
  assert.ok(attempt.attempt >= 1);
});

test("Retry.executeWithResult returns last attempt on failure", async () => {
  const retry = new Retry({ maxAttempts: 2 });

  const attempt = await retry.executeWithResult(async () => {
    throw new Error("always fails");
  });

  assert.equal(attempt.success, false);
  assert.ok(attempt.error instanceof Error);
});

test("Retry.getStats returns correct structure", async () => {
  const retry = new Retry();

  await retry.execute(async () => "success");
  const stats = retry.getStats();

  assert.equal(typeof stats.totalAttempts, "number");
  assert.equal(typeof stats.successfulAttempts, "number");
  assert.equal(typeof stats.failedAttempts, "number");
  assert.equal(typeof stats.totalDurationMs, "number");
});

test("Retry with custom options", () => {
  const retry = new Retry({
    maxAttempts: 5,
    initialDelayMs: 50,
    maxDelayMs: 1000,
    backoffMultiplier: 1.5,
    jitterFactor: 0.1,
    maxDurationMs: 30000,
    retryableErrors: ["NetworkError", "TimeoutError"],
  });

  assert.ok(retry instanceof Retry);
});

test("Retry with retryableErrors filter", async () => {
  const retry = new Retry({
    maxAttempts: 3,
    retryableErrors: ["NetworkError"],
  });

  await assert.rejects(
    async () => retry.execute(
      async () => { throw new Error("Non-retryable error"); },
      (error) => error.message !== "NetworkError",
    ),
    Error,
  );
});

test("Retry.withRetry decorator style", async () => {
  let callCount = 0;
  const fn = async () => {
    callCount++;
    if (callCount < 3) {
      throw new Error("fail");
    }
    return "decorated-success";
  };

  const wrapped = withRetry(fn, { maxAttempts: 3, initialDelayMs: 10 });
  const result = await wrapped();

  assert.equal(result, "decorated-success");
  assert.equal(callCount, 3);
});

test("Retry.withRetry uses default options", async () => {
  let attempts = 0;
  const fn = async () => {
    attempts++;
    throw new Error("always fails");
  };

  const wrapped = withRetry(fn);

  await assert.rejects(async () => wrapped(), Error);
  assert.ok(attempts >= 3);
});

test("Retry stats track failures correctly", async () => {
  const retry = new Retry({ maxAttempts: 2 });

  await assert.rejects(
    async () => retry.execute(async () => { throw new Error("fail"); }),
    Error,
  );

  const stats = retry.getStats();
  assert.ok(stats.failedAttempts >= 1);
});

test("Retry stats track successes correctly", async () => {
  const retry = new Retry({ maxAttempts: 3 });

  // First execute - success on first attempt
  await retry.execute(async () => "success");
  const stats1 = retry.getStats();
  assert.equal(stats1.successfulAttempts, 1);
  assert.equal(stats1.totalAttempts, 1);

  // Second execute - success on first attempt
  await retry.execute(async () => "success");
  const stats2 = retry.getStats();
  // Stats reset per execute, so this shows the second call's stats
  assert.equal(stats2.successfulAttempts, 1);
  assert.equal(stats2.totalAttempts, 1);
});

test("Retry handles non-Error thrown", async () => {
  const retry = new Retry({ maxAttempts: 2 });

  await assert.rejects(
    async () => retry.execute(async () => {
      throw "string error";
    }),
    Error,
  );
});

test("RetryAttempt interface values", async () => {
  const retry = new Retry({ maxAttempts: 1 });

  const attempt = await retry.executeWithResult(async () => "value");

  const typedAttempt: RetryAttempt<string> = attempt;
  assert.equal(typedAttempt.result, "value");
  assert.equal(typedAttempt.success, true);
});

test("RetryOptions interface defaults", () => {
  const retry = new Retry({});
  assert.ok(retry instanceof Retry);
});

test("RetryExecutionOptions signal handling", async () => {
  const retry = new Retry();

  const controller = new AbortController();
  controller.abort();

  await assert.rejects(
    async () => retry.execute(
      async () => {
        await new Promise((r) => setTimeout(r, 50));
        return "not reached";
      },
      undefined,
      { signal: controller.signal },
    ),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.ok(error instanceof RetryAbortError || error.name === "AbortError");
      return true;
    },
  );
});

test("RetryTimeoutError has correct name", () => {
  const error = new RetryTimeoutError("Test timeout");
  assert.equal(error.name, "RetryTimeoutError");
});

test("RetryAbortError has correct name", () => {
  const error = new RetryAbortError("Test abort");
  assert.equal(error.name, "RetryAbortError");
});
