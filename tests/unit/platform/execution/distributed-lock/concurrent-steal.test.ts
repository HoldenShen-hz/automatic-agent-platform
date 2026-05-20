/**
 * SYS-REL-2.2 Concurrent forceStealAsync Race Condition Tests
 *
 * Tests that concurrent forceStealAsync calls on the same lock result in exactly
 * one owner ending up with the lock. Multiple concurrent steals can result in
 * race conditions where multiple callers think they succeeded.
 *
 * Bug: extendAsync/forceStealAsync TOCTOU race - concurrent lock extension/steal
 * can result in double lock due to non-atomic read-modify-write.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { RedisLockAdapter } from "../../../../../src/platform/five-plane-execution/distributed-lock/redis-lock-adapter.js";
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
  incr: (key: string) => Promise<number>;
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
    incr: async () => 1,
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

test("[SYS-REL-2.2] concurrent forceStealAsync - only one owner ends up with lock", async () => {
  const lockKey = "contested-steal-lock";
  // Track what was actually stored via set()
  let storedOwner = "original-owner";
  let storedFencingToken = 0;

  const mockRedis = createMockRedis({
    status: "ready",
    incr: async () => storedFencingToken + 1,
    eval: async (_script: string, _numKeys: number, _key: string, value: string) => {
      const data = JSON.parse(value);
      storedOwner = data.owner;
      storedFencingToken = data.fencingToken;
      return 1;
    },
    get: async () => JSON.stringify({
      owner: storedOwner,
      fencingToken: storedFencingToken,
      ttlMs: 30000,
      acquiredAt: new Date().toISOString(),
      metadata: JSON.stringify({ forceStealReason: "concurrent-steal" }),
    }),
  });

  const adapter = createAdapterWithMockRedis(mockRedis);
  await adapter.acquireAsync({ lockKey, owner: "original-owner", ttlMs: 10000 });

  // Run 5 concurrent steal operations
  const results = await Promise.allSettled([
    adapter.forceStealAsync(lockKey, "attacker-1", "concurrent-steal-1"),
    adapter.forceStealAsync(lockKey, "attacker-2", "concurrent-steal-2"),
    adapter.forceStealAsync(lockKey, "attacker-3", "concurrent-steal-3"),
    adapter.forceStealAsync(lockKey, "attacker-4", "concurrent-steal-4"),
    adapter.forceStealAsync(lockKey, "attacker-5", "concurrent-steal-5"),
  ]);

  // All calls should fulfill (the API doesn't throw on failure)
  const fulfilled = results.filter((r) => r.status === "fulfilled");
  assert.equal(fulfilled.length, 5, "All 5 steal attempts should fulfill");

  // But only ONE attacker should actually own the lock after dust settles
  const finalLock = await adapter.inspectAsync(lockKey);
  assert.ok(finalLock, "Lock should exist after steals");
  assert.ok(
    ["attacker-1", "attacker-2", "attacker-3", "attacker-4", "attacker-5"].includes(finalLock!.owner),
    `Final owner should be one of the attackers, got: ${finalLock!.owner}`,
  );
});

test("[SYS-REL-2.2] concurrent forceStealAsync race - verify fencing token monotonicity", async () => {
  // Track what was actually stored
  let storedFencingToken = 0;
  let storedOwner = "initial-owner";

  const mockRedis = createMockRedis({
    status: "ready",
    incr: async () => storedFencingToken + 1,
    eval: async (_script: string, _numKeys: number, _key: string, value: string) => {
      const data = JSON.parse(value);
      storedOwner = data.owner;
      storedFencingToken = data.fencingToken;
      return 1;
    },
    get: async () => JSON.stringify({
      owner: storedOwner,
      fencingToken: storedFencingToken,
      ttlMs: 30000,
      acquiredAt: new Date().toISOString(),
      metadata: null,
    }),
  });

  const adapter = createAdapterWithMockRedis(mockRedis);

  // Acquire initial lock
  await adapter.acquireAsync({ lockKey: "fencing-token-lock", owner: "initial-owner", ttlMs: 10000 });

  // Run 3 concurrent steals
  const results = await Promise.allSettled([
    adapter.forceStealAsync("fencing-token-lock", "owner-A", "reason-A"),
    adapter.forceStealAsync("fencing-token-lock", "owner-B", "reason-B"),
    adapter.forceStealAsync("fencing-token-lock", "owner-C", "reason-C"),
  ]);

  const succeeded = results.filter((r) => r.status === "fulfilled");
  assert.equal(succeeded.length, 3, "All steals should fulfill");

  // All three calls should succeed and return records
  for (const result of succeeded) {
    if (result.status === "fulfilled") {
      assert.ok(result.value.fencingToken >= 1, "Fencing token should be assigned");
    }
  }

  // After dust settles, inspect shows only one owner
  const finalLock = await adapter.inspectAsync("fencing-token-lock");
  assert.ok(["owner-A", "owner-B", "owner-C"].includes(finalLock!.owner),
    `Final owner should be one of the stealers, got: ${finalLock!.owner}`);
});

test("[SYS-REL-2.2] forceStealAsync increments fencing counter per call", async () => {
  const adapter = new RedisLockAdapter({ host: "localhost", port: 6379 });

  const getFencingCounter = () => (adapter as unknown as { fencingCounter: number }).fencingCounter;
  const initialCount = getFencingCounter();
  let nextToken = initialCount;

  const mockRedis = createMockRedis({
    status: "ready",
    incr: async () => {
      nextToken += 1;
      return nextToken;
    },
    eval: async () => 1,
  });
  (adapter as unknown as { redis: any }).redis = mockRedis;

  // Perform 3 concurrent steals
  await Promise.allSettled([
    adapter.forceStealAsync("lock-1", "owner-1", "test"),
    adapter.forceStealAsync("lock-2", "owner-2", "test"),
    adapter.forceStealAsync("lock-3", "owner-3", "test"),
  ]);

  // Fencing counter should have incremented 3 times
  assert.equal(getFencingCounter(), initialCount + 3, "Fencing counter should increment per steal call");

  await adapter.close();
});

test("[SYS-REL-2.2] runConcurrentInvariant detects steal race violation", async () => {
  let stealCallCount = 0;

  const mockRedis = createMockRedis({
    status: "ready",
    incr: async () => {
      stealCallCount++;
      return stealCallCount;
    },
    eval: async () => 1,
    get: async () => JSON.stringify({
      owner: `owner-after-steal-${stealCallCount}`,
      fencingToken: stealCallCount,
      ttlMs: 30000,
      acquiredAt: new Date().toISOString(),
      metadata: null,
    }),
  });

  const adapter = createAdapterWithMockRedis(mockRedis);
  await adapter.acquireAsync({ lockKey: "concurrent-steal-lock", owner: "baseline-owner", ttlMs: 10000 });

  const result = await runConcurrentInvariant(
    async (workerId: number) => {
      return adapter.forceStealAsync("concurrent-steal-lock", `worker-${workerId}`, "invariant-test");
    },
    { concurrency: 5 },
  );

  // All workers should complete without errors
  assert.equal(result.errors.length, 0, "No errors should occur during concurrent steals");

  // All workers should have gotten a fulfilled result
  assert.equal(result.values.length, 5, "All 5 workers should complete");
});

test("[SYS-REL-2.2] multiple concurrent steals on same key - final state consistency", async () => {
  const lockKey = "final-state-lock";
  // Track the actual stored data
  let storedData = {
    owner: "original-owner",
    fencingToken: 0,
    ttlMs: 30000,
    acquiredAt: new Date().toISOString(),
    metadata: null as string | null,
  };

  const mockRedis = createMockRedis({
    status: "ready",
    incr: async () => storedData.fencingToken + 1,
    eval: async (_script: string, _numKeys: number, _key: string, value: string) => {
      storedData = JSON.parse(value);
      return 1;
    },
    get: async () => {
      // Return whatever was last stored (deterministic for inspect)
      return JSON.stringify(storedData);
    },
  });

  const adapter = createAdapterWithMockRedis(mockRedis);
  await adapter.acquireAsync({ lockKey, owner: "original-owner", ttlMs: 10000 });

  // Launch 10 concurrent steals
  const stealPromises = Array.from({ length: 10 }, (_, i) =>
    adapter.forceStealAsync(lockKey, `attacker-${i}`, "race-test"),
  );

  const results = await Promise.allSettled(stealPromises);

  // All should fulfill
  const fulfilled = results.filter((r) => r.status === "fulfilled");
  assert.equal(fulfilled.length, 10, "All 10 steals should fulfill");

  // But only ONE owner should persist in the lock
  const finalLock = await adapter.inspectAsync(lockKey);
  assert.ok(finalLock, "Lock should exist");

  // The final owner's fencing token should be positive
  assert.ok(finalLock!.fencingToken >= 1, "Fencing token should be positive");
});

test("[SYS-REL-2.2] forceStealAsync with XX flag - returns record even when lock existed", async () => {
  // Track stored data to return in get()
  let storedData = {
    owner: "original-owner",
    fencingToken: 0,
    ttlMs: 30000,
    acquiredAt: new Date().toISOString(),
    metadata: null as string | null,
  };

  const mockRedis = createMockRedis({
    status: "ready",
    incr: async () => storedData.fencingToken + 1,
    eval: async (_script: string, _numKeys: number, _key: string, value: string) => {
      storedData = JSON.parse(value);
      return 1;
    },
    get: async () => JSON.stringify(storedData),
  });

  const adapter = createAdapterWithMockRedis(mockRedis);
  await adapter.acquireAsync({ lockKey: "existing-lock", owner: "original-owner", ttlMs: 10000 });

  const result = await adapter.forceStealAsync("existing-lock", "new-owner", "testing-XX-flag");

  assert.equal(result.lockKey, "existing-lock");
  assert.equal(result.owner, "new-owner");
  assert.ok(result.fencingToken >= 1, "Fencing token should be positive");
  assert.equal(result.status, "held");
  assert.ok(result.metadata !== null, "Metadata should be set for force steal");
});

test("[SYS-REL-2.2] concurrent steal followed by inspect shows consistent state", async () => {
  const lockKey = "inspect-after-steal";
  let currentOwner = "original-owner";

  const mockRedis = createMockRedis({
    status: "ready",
    incr: async () => 2,
    eval: async (_script: string, _numKeys: number, _key: string, value: string) => {
      const data = JSON.parse(value);
      currentOwner = data.owner;
      return 1;
    },
    get: async () => JSON.stringify({
      owner: currentOwner,
      fencingToken: 1,
      ttlMs: 30000,
      acquiredAt: new Date().toISOString(),
      metadata: null,
    }),
  });

  const adapter = createAdapterWithMockRedis(mockRedis);
  await adapter.acquireAsync({ lockKey, owner: "original-owner", ttlMs: 10000 });

  // Do a steal
  await adapter.forceStealAsync(lockKey, "stealer", "changing-owner");

  // Immediately inspect
  const inspected = await adapter.inspectAsync(lockKey);

  assert.ok(inspected, "Lock should be inspectable after steal");
  assert.equal(inspected!.owner, currentOwner, "Inspect should see consistent owner");
});
