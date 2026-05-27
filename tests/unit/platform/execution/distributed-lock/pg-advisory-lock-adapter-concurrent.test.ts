/**
 * [SYS-REL-2.2] PgAdvisoryLockAdapter Concurrency Tests
 *
 * Tests for concurrent acquireAsync and releaseAsync operations
 * to verify that PostgreSQL advisory lock correctly handles concurrency.
 *
 * PostgreSQL advisory locks are process-level locks managed by the database,
 * so concurrent acquire/release from multiple connections should be handled correctly.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { PgAdvisoryLockAdapter } from "../../../../../src/platform/five-plane-execution/distributed-lock/pg-advisory-lock-adapter.js";
import { runConcurrentInvariant } from "../../../../helpers/concurrent-runner.js";

// =============================================================================
// Mock driver helpers
// =============================================================================

type MockPostgresDriver = {
  end: () => Promise<void>;
  (strings: TemplateStringsArray, ...values: any[]): Promise<Array<{ [key: string]: any }>>;
};

function createMockDriver(options: {
  queryFn?: (strings: TemplateStringsArray, ...values: any[]) => Promise<Array<{ [key: string]: any }>>;
  endFn?: () => Promise<void>;
} = {}): MockPostgresDriver {
  const { queryFn = async () => [{ acquired: true }], endFn = async () => {} } = options;
  const mockFn = (async (strings: TemplateStringsArray, ...values: any[]) => queryFn(strings, ...values)) as MockPostgresDriver;
  mockFn.end = endFn;
  return mockFn;
}

function createAdapterWithMockDriver(mockDriver: MockPostgresDriver): PgAdvisoryLockAdapter {
  const adapter = new PgAdvisoryLockAdapter({ dsn: "postgresql://test:test@localhost/test" });
  (adapter as any).sql = mockDriver;
  (adapter as any).connected = true;
  return adapter;
}

// =============================================================================
// Concurrent acquire tests
// =============================================================================

test("[SYS-REL-2.2] concurrent acquireAsync - only one worker acquires the lock [pg-advisory-lock-adapter-concurrent]", async () => {
  // Track how many times pg_try_advisory_lock succeeds
  let acquireCount = 0;

  const mockDriver = createMockDriver({
    queryFn: async () => {
      acquireCount++;
      // Only the first call succeeds (simulating PostgreSQL behavior)
      return [{ acquired: acquireCount === 1 }];
    },
  });
  const adapter = createAdapterWithMockDriver(mockDriver);

  const concurrency = 5;
  const results = await runConcurrentInvariant(
    async (workerId: number) => {
      const result = await adapter.acquireAsync({ lockKey: "shared-lock", owner: `worker-${workerId}`, ttlMs: 30000 });
      return result;
    },
    { concurrency },
  );

  const succeeded = results.values.filter((v) => v.acquired);
  const failed = results.values.filter((v) => !v.acquired);

  // CRITICAL INVARIANT: Only ONE worker should successfully acquire the lock
  assert.equal(succeeded.length, 1, `Expected exactly 1 successful acquire among ${concurrency} workers, got ${succeeded.length}`);
  assert.equal(failed.length, concurrency - 1, `Expected ${concurrency - 1} failed acquires`);
  assert.equal(results.errors.length, 0, "No errors should occur");
});

test("[SYS-REL-2.2] concurrent acquireAsync on same key - second acquire returns false [pg-advisory-lock-adapter-concurrent]", async () => {
  let callCount = 0;

  const mockDriver = createMockDriver({
    queryFn: async () => {
      callCount++;
      // First succeeds, second+ fails (lock already held)
      return [{ acquired: callCount === 1 }];
    },
  });
  const adapter = createAdapterWithMockDriver(mockDriver);

  // Two workers try to acquire the same lock at the same time
  const [result1, result2] = await Promise.allSettled([
    adapter.acquireAsync({ lockKey: "same-key", owner: "worker-1", ttlMs: 30000 }),
    adapter.acquireAsync({ lockKey: "same-key", owner: "worker-2", ttlMs: 30000 }),
  ]);

  const succeeded = [result1, result2].filter((r) => r.status === "fulfilled" && r.value.acquired);
  const failed = [result1, result2].filter((r) => r.status === "fulfilled" && !r.value.acquired);

  // Exactly one should succeed
  assert.equal(succeeded.length, 1, "Expected exactly 1 successful acquire");
  assert.equal(failed.length, 1, "Expected exactly 1 failed acquire");
});

test("[SYS-REL-2.2] concurrent acquireAsync with many workers - only one gets the lock [pg-advisory-lock-adapter-concurrent]", async () => {
  let acquireCount = 0;
  const workers = 10;

  const mockDriver = createMockDriver({
    queryFn: async () => {
      acquireCount++;
      return [{ acquired: acquireCount === 1 }];
    },
  });
  const adapter = createAdapterWithMockDriver(mockDriver);

  const promises = Array.from({ length: workers }, (_, i) =>
    adapter.acquireAsync({ lockKey: "contested-lock", owner: `worker-${i}`, ttlMs: 30000 }),
  );

  const results = await Promise.allSettled(promises);
  const succeeded = results.filter((r) => r.status === "fulfilled" && (r as PromiseFulfilledResult<{ acquired: boolean }>).value.acquired);

  // CRITICAL INVARIANT: Only ONE worker should acquire
  assert.equal(succeeded.length, 1, `Expected exactly 1 successful acquire among ${workers} workers, got ${succeeded.length}`);
});

// =============================================================================
// Concurrent release tests
// =============================================================================

test("[SYS-REL-2.2] releaseAsync by non-owner returns false [pg-advisory-lock-adapter-concurrent]", async () => {
  const mockDriver = createMockDriver({
    queryFn: async () => [{ pg_advisory_unlock: true }],
  });
  const adapter = createAdapterWithMockDriver(mockDriver);

  // First acquire the lock
  await adapter.acquireAsync({ lockKey: "test-lock", owner: "owner-1", ttlMs: 30000 });

  const result = await adapter.releaseAsync("test-lock", "non-owner");
  assert.equal(result, false, "releaseAsync rejects non-owner before hitting PostgreSQL");
});

test("[SYS-REL-2.2] concurrent releaseAsync - only owner can release [pg-advisory-lock-adapter-concurrent]", async () => {
  let releaseCallCount = 0;

  const mockDriver = createMockDriver({
    queryFn: async (strings: TemplateStringsArray) => {
      const query = strings.join("?");
      if (query.includes("pg_try_advisory_lock")) {
        return [{ acquired: true, fencing_token: 1 }];
      }
      releaseCallCount++;
      return [{ released: true }];
    },
  });
  const adapter = createAdapterWithMockDriver(mockDriver);

  await adapter.acquireAsync({ lockKey: "release-lock", owner: "owner-1", ttlMs: 30000 });

  const results = await Promise.allSettled([
    adapter.releaseAsync("release-lock", "owner-1"),
    adapter.releaseAsync("release-lock", "non-owner"),
  ]);

  const fulfilled = results.filter((r) => r.status === "fulfilled") as Array<PromiseFulfilledResult<boolean>>;
  assert.deepEqual(fulfilled.map((r) => r.value), [true, false]);
  assert.equal(releaseCallCount, 1, "Only owner-matched release should reach pg_advisory_unlock");
});

test("[SYS-REL-2.2] releaseAsync by non-owner - release succeeds but lock may persist [pg-advisory-lock-adapter-concurrent]", async () => {
  // Track if release was actually called to distinguish test phases
  let releaseCalled = false;

  const mockDriver = createMockDriver({
    queryFn: async (strings: TemplateStringsArray) => {
      const query = strings.join("?");
      if (query.includes("pg_try_advisory_lock")) {
        return [{ acquired: true }];
      }
      if (query.includes("pg_advisory_unlock")) {
        releaseCalled = true;
        return [{ pg_advisory_unlock: true }];
      }
      return [{}];
    },
  });
  const adapter = createAdapterWithMockDriver(mockDriver);

  // Acquire the lock
  const acquireResult = await adapter.acquireAsync({ lockKey: "persist-lock", owner: "owner-1", ttlMs: 30000 });
  assert.equal(acquireResult.acquired, true, "Initial acquire should succeed");

  const releaseResult = await adapter.releaseAsync("persist-lock", "non-owner");

  assert.equal(releaseResult, false, "releaseAsync returns false for non-owner");
  assert.equal(releaseCalled, false, "pg_advisory_unlock should not have been called");
});

test("[SYS-REL-2.2] concurrent acquireAsync followed by releaseAsync - clean handover [pg-advisory-lock-adapter-concurrent]", async () => {
  // Track lock state: null = available, string = held by owner
  let lockState: { held: boolean; owner: string | null } = { held: false, owner: null };
  let queryCount = 0;

  const mockDriver = createMockDriver({
    queryFn: async (strings: TemplateStringsArray) => {
      const query = strings.join("?");
      queryCount++;
      if (query.includes("pg_try_advisory_lock")) {
        if (!lockState.held) {
          lockState = { held: true, owner: `worker-${queryCount}` };
          return [{ acquired: true, fencing_token: queryCount }];
        }
        return [{ acquired: false }];
      }
      if (query.includes("pg_advisory_unlock")) {
        lockState = { held: false, owner: null };
        return [{ released: true }];
      }
      return [{}];
    },
  });
  const adapter = createAdapterWithMockDriver(mockDriver);

  // Worker 1 acquires
  const acquireResult = await adapter.acquireAsync({ lockKey: "handover-lock", owner: "worker-1", ttlMs: 30000 });
  assert.equal(acquireResult.acquired, true, "Worker 1 should acquire");
  assert.equal(acquireResult.lock!.owner, "worker-1", "Owner should be worker-1");

  // Worker 2 tries to acquire (should fail - lock already held)
  const acquireResult2 = await adapter.acquireAsync({ lockKey: "handover-lock", owner: "worker-2", ttlMs: 30000 });
  assert.equal(acquireResult2.acquired, false, "Worker 2 should fail to acquire");

  // Worker 1 releases
  const releaseResult = await adapter.releaseAsync("handover-lock", "worker-1");
  assert.equal(releaseResult, true, "Worker 1 should release");

  // Now worker 2 should be able to acquire
  const acquireResult3 = await adapter.acquireAsync({ lockKey: "handover-lock", owner: "worker-2", ttlMs: 30000 });
  assert.equal(acquireResult3.acquired, true, "Worker 2 should acquire after release");
  assert.equal(acquireResult3.lock!.owner, "worker-2", "Owner should be worker-2");
});

test("[SYS-REL-2.2] runConcurrentInvariant for acquire concurrency [pg-advisory-lock-adapter-concurrent]", async () => {
  let acquireCount = 0;

  const mockDriver = createMockDriver({
    queryFn: async () => {
      acquireCount++;
      return [{ acquired: acquireCount === 1 }];
    },
  });
  const adapter = createAdapterWithMockDriver(mockDriver);

  const result = await runConcurrentInvariant(
    async (workerId: number) => {
      return adapter.acquireAsync({ lockKey: "invariant-lock", owner: `worker-${workerId}`, ttlMs: 30000 });
    },
    { concurrency: 5 },
  );

  const succeeded = result.values.filter((v) => v.acquired);

  // Verify the invariant: exactly one success
  assert.equal(succeeded.length, 1, `Expected exactly 1 successful acquire, got ${succeeded.length}`);
  assert.equal(result.errors.length, 0, "No errors should occur");
});
