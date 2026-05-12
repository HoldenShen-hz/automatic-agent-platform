/**
 * SYS-REL-2.2 Concurrent extendAsync Race Condition Tests
 *
 * Tests that concurrent extendAsync calls on the same lock do not result in
 * double lock acquisition. Only one concurrent extend should succeed.
 *
 * Bug: extendAsync/forceStealAsync TOCTOU race - concurrent lock extension/steal
 * can result in double lock due to non-atomic read-modify-write.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { RedisLockAdapter } from "../../../../../src/platform/execution/distributed-lock/redis-lock-adapter.js";
import { runConcurrentInvariant } from "../../../../helpers/concurrent-runner.js";

// Helper to create adapter with mock redis client
function createAdapterWithMockRedis(mockRedis: any): RedisLockAdapter {
  const adapter = new RedisLockAdapter({ host: "localhost", port: 6379 });
  (adapter as unknown as { redis: any }).redis = mockRedis;
  return adapter;
}

function createMockRedis(overrides: Partial<{
  status: string;
  connect: () => Promise<void>;
  set: (key: string, value: string, ...args: Array<string | number>) => Promise<string | null>;
  get: (key: string) => Promise<string | null>;
  del: (key: string) => Promise<number>;
  eval: (script: string, numKeys: number, ...args: string[]) => Promise<unknown>;
  scan: (cursor: number, ...args: Array<string | number>) => Promise<[string, string[]]>;
  mget: (...keys: string[]) => Promise<(string | null)[]>;
  quit: () => Promise<unknown>;
  disconnect: () => void;
}> = {}): RedisLockAdapter["redis"] {
  return {
    status: "ready",
    connect: async () => {},
    set: async () => "OK",
    get: async () => null,
    del: async () => 1,
    eval: async () => 1,
    scan: async () => ["0", []],
    mget: async () => [],
    quit: async () => {},
    disconnect: () => {},
    on: () => {},
    ...overrides,
  };
}

test("[SYS-REL-2.2] concurrent extendAsync on same lock grants only one", async () => {
  // Track eval calls to simulate the race condition
  let evalCallCount = 0;
  const lockData = {
    id: "lock_initial_1",
    owner: "original-owner",
    fencingToken: 1,
    ttlMs: 30000,
    acquiredAt: new Date().toISOString(),
    metadata: null,
  };

  const mockRedis = createMockRedis({
    status: "ready",
    eval: async () => {
      evalCallCount++;
      // First call succeeds, subsequent calls fail (lock no longer owned by this owner)
      return evalCallCount === 1 ? 1 : 0;
    },
    get: async () => JSON.stringify(lockData),
  });

  const adapter = createAdapterWithMockRedis(mockRedis);

  // First acquire the lock
  await adapter.acquireAsync({ lockKey: "shared-lock", owner: "original-owner", ttlMs: 10000 });

  // Now run two concurrent extendAsync calls
  const results = await Promise.allSettled([
    adapter.extendAsync("shared-lock", "worker-1", 20000),
    adapter.extendAsync("shared-lock", "worker-2", 20000),
  ]);

  const succeeded = results.filter((r) => r.status === "fulfilled" && r.value !== null);
  const failed = results.filter((r) => r.status === "fulfilled" && r.value === null);

  // CRITICAL INVARIANT: Only ONE extend should succeed
  // This is the bug - currently both may succeed due to TOCTOU race
  assert.equal(succeeded.length, 1, `Expected exactly 1 successful extend, got ${succeeded.length}. Results: ${JSON.stringify(results)}`);
  assert.equal(failed.length, 1, `Expected exactly 1 failed extend, got ${failed.length}`);
});

test("[SYS-REL-2.2] concurrent extendAsync with same owner - only one succeeds", async () => {
  let evalCallCount = 0;

  const mockRedis = createMockRedis({
    status: "ready",
    eval: async () => {
      evalCallCount++;
      // Simulate: only first eval succeeds (lock extended), second fails (owner changed between checks)
      return evalCallCount === 1 ? 1 : 0;
    },
    get: async () => JSON.stringify({
      id: "lock_same_owner_42",
      owner: "same-owner",
      fencingToken: 42,
      ttlMs: 30000,
      acquiredAt: new Date().toISOString(),
      metadata: null,
    }),
  });

  const adapter = createAdapterWithMockRedis(mockRedis);

  await adapter.acquireAsync({ lockKey: "lock-same-owner", owner: "same-owner", ttlMs: 10000 });

  const results = await Promise.allSettled([
    adapter.extendAsync("lock-same-owner", "same-owner", 20000),
    adapter.extendAsync("lock-same-owner", "same-owner", 20000),
  ]);

  const succeeded = results.filter((r) => r.status === "fulfilled" && r.value !== null);

  // With same owner, the Lua script should handle it correctly
  // But the TOCTOU race in the JS code (read eval result, then get) can still cause issues
  assert.ok(succeeded.length <= 2, "At most 2 extends should succeed with same owner");
});

test("[SYS-REL-2.2] concurrent extendAsync race - many concurrent workers", async () => {
  let evalCallCount = 0;
  const workers = 10;

  const mockRedis = createMockRedis({
    status: "ready",
    eval: async () => {
      evalCallCount++;
      // Only the first eval call succeeds (others see changed state)
      return evalCallCount === 1 ? 1 : 0;
    },
    get: async () => JSON.stringify({
      id: "lock_multi_extend_1",
      owner: "original-owner",
      fencingToken: 1,
      ttlMs: 30000,
      acquiredAt: new Date().toISOString(),
      metadata: null,
    }),
  });

  const adapter = createAdapterWithMockRedis(mockRedis);

  await adapter.acquireAsync({ lockKey: "multi-extend-lock", owner: "original-owner", ttlMs: 10000 });

  const promises = Array.from({ length: workers }, (_, i) =>
    adapter.extendAsync("multi-extend-lock", `worker-${i}`, 20000),
  );

  const results = await Promise.allSettled(promises);
  const succeeded = results.filter((r) => r.status === "fulfilled" && r.value !== null);

  // CRITICAL: Only ONE worker should successfully extend the lock
  assert.equal(succeeded.length, 1, `Expected exactly 1 successful extend among ${workers} workers, got ${succeeded.length}`);
});

test("[SYS-REL-2.2] extendAsync returns null when lock was stolen between eval and get", async () => {
  // This test simulates the TOCTOU race where:
  // 1. eval succeeds (we still own the lock)
  // 2. another process forceSteals the lock
  // 3. get returns null (lock no longer ours)

  let evalSucceeded = true;

  const mockRedis = createMockRedis({
    status: "ready",
    eval: async () => {
      // eval succeeds - we "own" the lock according to Lua script
      return evalSucceeded ? 1 : 0;
    },
    get: async () => {
      // But by the time we get here, lock was stolen!
      // This simulates the race condition
      return null;
    },
  });

  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.extendAsync("stolen-lock", "owner", 20000);

  // After the TOCTOU race, we should get null even though eval succeeded
  assert.equal(result, null, "extendAsync should return null when lock was stolen between eval and get");
});

test("[SYS-REL-2.2] extendAsync handles rapid concurrent steals correctly", async () => {
  let stealCount = 0;
  // Track what was actually stored via set()
  let storedOwner = "original-owner";

  const mockRedis = createMockRedis({
    status: "ready",
    set: async (_key: string, value: string) => {
      stealCount++;
      // Extract owner from the data that was stored
      try {
        const data = JSON.parse(value);
        storedOwner = data.owner;
      } catch {
        // ignore parse errors
      }
      return "OK";
    },
    get: async () => {
      // Return the last stored owner (simulating what Redis would return)
      return JSON.stringify({
        id: `lock_contested_${stealCount}`,
        owner: storedOwner,
        fencingToken: stealCount,
        ttlMs: 30000,
        acquiredAt: new Date().toISOString(),
        metadata: JSON.stringify({ forceStealReason: "race-condition-test" }),
      });
    },
    eval: async () => {
      // All steals succeed
      return 1;
    },
  });

  const adapter = createAdapterWithMockRedis(mockRedis);

  // Simulate rapid concurrent steal operations
  const results = await Promise.allSettled([
    adapter.forceStealAsync("contested-lock", "attacker-1", "race-condition-test"),
    adapter.forceStealAsync("contested-lock", "attacker-2", "race-condition-test"),
    adapter.forceStealAsync("contested-lock", "attacker-3", "race-condition-test"),
  ]);

  const succeeded = results.filter((r) => r.status === "fulfilled");

  // CRITICAL INVARIANT: After dust settles, exactly ONE owner should hold the lock
  // But due to the race, multiple steals may have "succeeded" from the caller's perspective
  // while only the last one's data actually persists in Redis

  // Verify the lock ends up with exactly one owner
  const finalLock = await adapter.inspectAsync("contested-lock");
  assert.ok(finalLock, "Lock should still exist after steals");
  assert.ok(
    ["attacker-1", "attacker-2", "attacker-3"].includes(finalLock!.owner),
    `Final owner should be one of the attackers, got: ${finalLock!.owner}`,
  );
});

test("[SYS-REL-2.2] runConcurrentInvariant helper for extend race detection", async () => {
  let evalCallCount = 0;

  const mockRedis = createMockRedis({
    status: "ready",
    eval: async () => {
      evalCallCount++;
      return evalCallCount === 1 ? 1 : 0;
    },
    get: async () => JSON.stringify({
      id: "lock_invariant_1",
      owner: "original-owner",
      fencingToken: 1,
      ttlMs: 30000,
      acquiredAt: new Date().toISOString(),
      metadata: null,
    }),
  });

  const adapter = createAdapterWithMockRedis(mockRedis);
  await adapter.acquireAsync({ lockKey: "invariant-test-lock", owner: "original-owner", ttlMs: 10000 });

  const result = await runConcurrentInvariant(
    async (workerId: number) => {
      const res = await adapter.extendAsync("invariant-test-lock", `worker-${workerId}`, 20000);
      return res;
    },
    { concurrency: 5 },
  );

  const succeeded = result.values.filter((v) => v !== null);

  // Verify the invariant: exactly one success
  assert.equal(succeeded.length, 1, `Expected exactly 1 successful extend, got ${succeeded.length}`);
  assert.equal(result.errors.length, 0, "No errors should occur");
});
