/**
 * Concurrent Test Runner
 *
 * Provides utilities for running concurrent invariant tests.
 * Use this to verify that concurrent operations maintain invariants.
 */

export interface ConcurrentRunnerOptions {
  /** Number of concurrent workers */
  concurrency: number;
  /** Maximum time to wait for all workers (ms) */
  timeout?: number;
}

/**
 * Result of a concurrent test run.
 */
export interface ConcurrentRunResult<T> {
  /** All values returned by workers */
  values: T[];
  /** Any errors that occurred */
  errors: unknown[];
  /** Whether all workers completed successfully */
  success: boolean;
}

/**
 * Runs multiple async operations concurrently and collects results.
 *
 * Usage:
 * ```typescript
 * test("concurrent access maintains invariant", async () => {
 *   const result = await runConcurrentInvariant(
 *     async (workerId) => {
 *       // Each worker does some work
 *       return doWork(workerId);
 *     },
 *     { concurrency: 10 }
 *   );
 *
 *   assert.equal(result.errors.length, 0, "No errors should occur");
 *   assert.equal(result.values.length, 10, "All workers should complete");
 * });
 * ```
 */
export async function runConcurrentInvariant<T>(
  workerFn: (workerId: number) => Promise<T>,
  options: ConcurrentRunnerOptions,
): Promise<ConcurrentRunResult<T>> {
  const { concurrency, timeout = 30000 } = options;
  const values: T[] = [];
  const errors: unknown[] = [];
  let success = true;

  const workers = Array.from({ length: concurrency }, (_, i) => i);

  await Promise.race([
    Promise.all(
      workers.map(async (workerId) => {
        try {
          const value = await workerFn(workerId);
          values.push(value);
        } catch (err) {
          errors.push(err);
          success = false;
        }
      }),
    ),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Concurrent test timed out")), timeout),
    ),
  ]);

  return { values, errors, success };
}

/**
 * Runs concurrent operations that modify shared state and verifies
 * that the final state is consistent.
 *
 * Usage:
 * ```typescript
 * test("concurrent increments maintain correct count", async () => {
 *   let counter = 0;
 *
 *   await runConcurrentStateModification(
 *     async () => {
 *       // Read-modify-write without locking (simulating the issue)
 *       const current = counter;
 *       await delay(1); // Simulate async operation
 *       counter = current + 1;
 *     },
 *     { concurrency: 100 }
 *   );
 *
 *   // Without proper synchronization, counter may be less than 100
 *   // This test documents the invariant that should be maintained
 * });
 * ```
 */
export async function runConcurrentStateModification(
  operation: () => Promise<void>,
  options: ConcurrentRunnerOptions,
): Promise<{ completed: number; errors: unknown[] }> {
  const { concurrency, timeout = 30000 } = options;
  const errors: unknown[] = [];
  let completed = 0;

  await Promise.race([
    Promise.all(
      Array.from({ length: concurrency }, async () => {
        try {
          await operation();
          completed++;
        } catch (err) {
          errors.push(err);
        }
      }),
    ),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Concurrent test timed out")), timeout),
    ),
  ]);

  return { completed, errors };
}

/**
 * Verifies that only one worker can acquire a critical section at a time.
 */
export async function runCriticalSectionTest(
  acquire: (workerId: number) => Promise<{ acquired: boolean; holder?: number }>,
  release: () => Promise<void>,
  options: ConcurrentRunnerOptions,
): Promise<{ violations: number; maxConcurrent: number }> {
  const { concurrency } = options;
  let currentHolder: number | null = null;
  let maxConcurrent = 0;
  let violations = 0;

  const workers = Array.from({ length: concurrency }, (_, i) => i);

  await Promise.all(
    workers.map(async (workerId) => {
      const result = await acquire(workerId);
      if (result.acquired) {
        if (currentHolder !== null) {
          violations++;
        }
        currentHolder = workerId;
        maxConcurrent = Math.max(maxConcurrent, 1);
      }
      await release();
    }),
  );

  return { violations, maxConcurrent };
}
