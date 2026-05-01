/**
 * Unit tests for concurrent-runner helper
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  runConcurrentInvariant,
  runConcurrentStateModification,
  runCriticalSectionTest,
} from "../../helpers/concurrent-runner.js";

test("runConcurrentInvariant executes workers concurrently", async () => {
  const results = await runConcurrentInvariant(
    async (workerId) => workerId * 2,
    { concurrency: 5 }
  );

  assert.equal(results.success, true);
  assert.equal(results.errors.length, 0);
  assert.equal(results.values.length, 5);
  assert.deepEqual(results.values.sort(), [0, 2, 4, 6, 8]);
});

test("runConcurrentInvariant collects errors from workers", async () => {
  const results = await runConcurrentInvariant(
    async (workerId) => {
      if (workerId === 2) {
        throw new Error("worker error");
      }
      return workerId;
    },
    { concurrency: 5 }
  );

  assert.equal(results.success, false);
  assert.equal(results.errors.length, 1);
  assert.equal(results.values.length, 4);
});

test("runConcurrentInvariant respects timeout", async () => {
  await assert.rejects(
    async () => {
      await runConcurrentInvariant(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return "slow";
        },
        { concurrency: 2, timeout: 50 }
      );
    },
    { message: "Concurrent test timed out" }
  );
});

test("runConcurrentInvariant with zero concurrency", async () => {
  const results = await runConcurrentInvariant(
    async (workerId) => workerId,
    { concurrency: 0 }
  );

  assert.equal(results.success, true);
  assert.equal(results.values.length, 0);
  assert.equal(results.errors.length, 0);
});

test("runConcurrentStateModification tracks completed operations", async () => {
  const results = await runConcurrentStateModification(
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
    },
    { concurrency: 10 }
  );

  assert.equal(results.completed, 10);
  assert.equal(results.errors.length, 0);
});

test("runConcurrentStateModification collects errors", async () => {
  const results = await runConcurrentStateModification(
    async () => {
      throw new Error("operation failed");
    },
    { concurrency: 5 }
  );

  assert.equal(results.completed, 0);
  assert.equal(results.errors.length, 5);
});

test("runConcurrentStateModification respects timeout", async () => {
  await assert.rejects(
    async () => {
      await runConcurrentStateModification(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
        },
        { concurrency: 2, timeout: 50 }
      );
    },
    { message: "Concurrent test timed out" }
  );
});

test("runCriticalSectionTest returns violations and maxConcurrent", async () => {
  let criticalSectionHeld = false;

  const acquire = async (): Promise<{ acquired: boolean; holder?: number }> => {
    if (criticalSectionHeld) {
      return { acquired: false };
    }
    criticalSectionHeld = true;
    return { acquired: true, holder: 1 };
  };

  const release = async () => {
    criticalSectionHeld = false;
  };

  const results = await runCriticalSectionTest(acquire, release, { concurrency: 3 });

  assert.equal(results.violations, 0);
  assert.equal(results.maxConcurrent, 1);
});

test("runCriticalSectionTest detects violations when already held", async () => {
  let holdCount = 0;

  const acquire = async (): Promise<{ acquired: boolean; holder?: number }> => {
    holdCount++;
    // Always acquire successfully but don't track - simulates a broken lock
    return { acquired: true, holder: holdCount };
  };

  const release = async () => {
    // Do nothing - simulates broken release
  };

  const results = await runCriticalSectionTest(acquire, release, { concurrency: 5 });

  assert.equal(results.violations, 4); // 4 violations when 5 workers all acquire
  assert.ok(results.maxConcurrent >= 1);
});
