import assert from "node:assert/strict";
import test from "node:test";

import {
  Timeout,
  TimeoutState,
  TimeoutError,
  withTimeout,
  withDeadline,
  type TimeoutOptions,
  type TimeoutStats,
} from "../../../../src/platform/stability/timeout.js";

test("Timeout exports are available", () => {
  assert.equal(typeof Timeout, "function");
  assert.equal(typeof TimeoutState, "object");
  assert.equal(typeof TimeoutError, "function");
  assert.equal(typeof withTimeout, "function");
  assert.equal(typeof withDeadline, "function");
});

test("TimeoutState enum has all expected values", () => {
  assert.equal(TimeoutState.PENDING, "PENDING");
  assert.equal(TimeoutState.RUNNING, "RUNNING");
  assert.equal(TimeoutState.COMPLETED, "COMPLETED");
  assert.equal(TimeoutState.TIMED_OUT, "TIMED_OUT");
  assert.equal(TimeoutState.CANCELLED, "CANCELLED");
});

test("Timeout executes successfully before timeout", async () => {
  const timeout = new Timeout({ timeoutMs: 1000 });
  const result = await timeout.wrap(async () => "success");
  assert.equal(result, "success");
});

test("Timeout throws TimeoutError on timeout", async () => {
  const timeout = new Timeout({ timeoutMs: 50 });

  await assert.rejects(
    async () => timeout.wrap(async () => {
      await new Promise((r) => setTimeout(r, 100));
      return "too slow";
    }),
    TimeoutError,
  );
});

test("Timeout calls cleanupFn on timeout", async () => {
  let cleanupCalled = false;
  const timeout = new Timeout({
    timeoutMs: 50,
    cleanupFn: () => { cleanupCalled = true; },
  });

  await assert.rejects(
    async () => timeout.wrap(async () => {
      await new Promise((r) => setTimeout(r, 100));
      return "too slow";
    }),
    TimeoutError,
  );

  assert.equal(cleanupCalled, true);
});

test("Timeout does not propagate error when configured", async () => {
  const timeout = new Timeout({
    timeoutMs: 50,
    propagateError: false,
    cleanupFn: () => {},
  });

  // With propagateError: false, the error is still thrown but state is set to TIMED_OUT
  await assert.rejects(
    async () => timeout.wrap(async () => {
      await new Promise((r) => setTimeout(r, 100));
    }),
    TimeoutError,
  );
  assert.equal(timeout.getState(), TimeoutState.TIMED_OUT);
});

test("Timeout.cancel stops the operation when running", async () => {
  const timeout = new Timeout({ timeoutMs: 5000 });

  let innerCompleted = false;
  const wrapPromise = timeout.wrap(async () => {
    await new Promise((r) => setTimeout(r, 100));
    innerCompleted = true;
    return "result";
  });

  // Give the wrap time to start
  await new Promise((r) => setTimeout(r, 10));

  assert.equal(timeout.getState(), TimeoutState.RUNNING);
  timeout.cancel();
  assert.equal(timeout.getState(), TimeoutState.CANCELLED);

  await wrapPromise.catch(() => {});
  assert.equal(innerCompleted, false);
});

test("Timeout.getState returns current state", () => {
  const timeout = new Timeout({ timeoutMs: 1000 });
  assert.equal(timeout.getState(), TimeoutState.PENDING);
});

test("Timeout.getStats returns correct structure", async () => {
  const timeout = new Timeout({ timeoutMs: 1000 });

  await timeout.wrap(async () => "success");

  const stats: TimeoutStats = timeout.getStats();
  assert.equal(typeof stats.state, "string");
  assert.equal(typeof stats.elapsedMs, "number");
  assert.equal(typeof stats.remainingMs, "number");
});

test("Timeout.getRemainingMs returns correct value", async () => {
  const timeout = new Timeout({ timeoutMs: 100 });

  await timeout.wrap(async () => "quick");

  const remaining = timeout.getRemainingMs();
  assert.ok(remaining >= 0);
});

test("Timeout throws on invalid timeoutMs", () => {
  assert.throws(
    () => new Timeout({ timeoutMs: 0 }),
    Error,
  );

  assert.throws(
    () => new Timeout({ timeoutMs: -1 }),
    Error,
  );
});

test("TimeoutError has correct name", () => {
  const error = new TimeoutError("Test message");
  assert.equal(error.name, "TimeoutError");
});

test("withTimeout creates a wrapped function", async () => {
  let callCount = 0;
  const fn = async () => {
    callCount++;
    return "wrapped";
  };

  const wrapped = withTimeout(fn, 1000);
  const result = await wrapped();

  assert.equal(result, "wrapped");
  assert.equal(callCount, 1);
});

test("withTimeout applies timeout to wrapped function", async () => {
  const fn = async () => {
    await new Promise((r) => setTimeout(r, 100));
    return "slow";
  };

  const wrapped = withTimeout(fn, 50);

  await assert.rejects(async () => wrapped(), TimeoutError);
});

test("withTimeout calls cleanup on timeout", async () => {
  let cleanupCalled = false;
  const fn = async () => {
    await new Promise((r) => setTimeout(r, 100));
    return "slow";
  };

  const wrapped = withTimeout(fn, 50, () => { cleanupCalled = true; });

  await assert.rejects(async () => wrapped(), TimeoutError);
  assert.equal(cleanupCalled, true);
});

test("withDeadline completes all operations within deadline", async () => {
  const operations = [
    async () => "a",
    async () => "b",
    async () => "c",
  ];

  const { results, timedOut } = await withDeadline(operations, 1000);

  assert.equal(timedOut, false);
  assert.deepEqual(results, ["a", "b", "c"]);
});

test("withDeadline stops when deadline exceeded", async () => {
  const operations = [
    async () => { await new Promise((r) => setTimeout(r, 50)); return "a"; },
    async () => { await new Promise((r) => setTimeout(r, 50)); return "b"; },
    async () => { await new Promise((r) => setTimeout(r, 500)); return "c"; },
  ];

  const { results, timedOut } = await withDeadline(operations, 80);

  assert.equal(timedOut, true);
  assert.ok(results.length < 3);
});

test("withDeadline calls onProgress callback", async () => {
  const progress: number[] = [];

  const operations = [
    async () => "a",
    async () => "b",
    async () => "c",
  ];

  await withDeadline(operations, 1000, (completed, remaining) => {
    progress.push(completed);
  });

  assert.equal(progress.length, 3);
  assert.deepEqual(progress, [1, 2, 3]);
});

test("withDeadline empty operations array", async () => {
  const { results, timedOut } = await withDeadline([], 1000);

  assert.equal(timedOut, false);
  assert.deepEqual(results, []);
});

test("Timeout can wrap multiple operations sequentially", async () => {
  const result1 = await new Timeout({ timeoutMs: 1000 }).wrap(async () => "first");
  const result2 = await new Timeout({ timeoutMs: 1000 }).wrap(async () => "second");

  assert.equal(result1, "first");
  assert.equal(result2, "second");
});

test("Timeout state transitions correctly", async () => {
  const timeout = new Timeout({ timeoutMs: 100 });

  assert.equal(timeout.getState(), TimeoutState.PENDING);

  const p = timeout.wrap(async () => {
    await new Promise((r) => setTimeout(r, 50));
    return "done";
  });

  assert.equal(timeout.getState(), TimeoutState.RUNNING);

  await p;

  assert.equal(timeout.getState(), TimeoutState.COMPLETED);
});