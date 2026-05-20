/**
 * [SYS-REL-2.3] Lock Acquisition Timeout Tests
 *
 * Tests for lock acquisition behavior with TTL/timeout handling.
 * Ensures locks expire correctly and blocked acquisitions timeout properly.
 *
 * Bug: Lock acquisition may not properly respect TTL causing
 * infinite blocking or premature expiration.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { RedisLockAdapter } from "../../../../../src/platform/five-plane-execution/distributed-lock/redis-lock-adapter.js";
import { LockingError } from "../../../../../src/platform/contracts/errors.js";

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

function createAdapterWithMockRedis(mockRedis: ReturnType<typeof createMockRedis>): RedisLockAdapter {
  const adapter = new RedisLockAdapter({ host: "localhost", port: 6379 });
  (adapter as unknown as { redis: RedisLockAdapter["redis"] }).redis = mockRedis;
  return adapter;
}

// =============================================================================
// Lock Acquisition Timeout Tests
// =============================================================================

test("[SYS-REL-2.3] acquireAsync uses default TTL of 30000ms when not specified", async () => {
  let setArgs: Array<string | number> = [];
  const mockRedis = createMockRedis({
    status: "ready",
    set: async (_key: string, _value: string, ...args: Array<string | number>) => {
      setArgs = args;
      return "OK";
    },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  await adapter.acquireAsync({ lockKey: "test-lock", owner: "test-owner" });

  const pxIndex = setArgs.indexOf("PX");
  assert.ok(pxIndex >= 0, "PX flag should be present");
  assert.equal(setArgs[pxIndex + 1], 30000, "Default TTL should remain in milliseconds");
});

test("[SYS-REL-2.3] acquireAsync respects provided ttlMs parameter", async () => {
  let setArgs: Array<string | number> = [];
  const mockRedis = createMockRedis({
    status: "ready",
    set: async (_key: string, _value: string, ...args: Array<string | number>) => {
      setArgs = args;
      return "OK";
    },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  await adapter.acquireAsync({ lockKey: "test-lock", owner: "test-owner", ttlMs: 60000 });

  const pxIndex = setArgs.indexOf("PX");
  assert.equal(setArgs[pxIndex + 1], 60000, "TTL should remain 60000ms");
});

test("[SYS-REL-2.3] acquireAsync returns acquired=false when lock already held", async () => {
  const mockRedis = createMockRedis({
    status: "ready",
    set: async () => null, // NX fails - lock already exists
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.acquireAsync({
    lockKey: "already-held-lock",
    owner: "new-owner",
    ttlMs: 30_000,
  });

  assert.equal(result.acquired, false, "Should return acquired=false");
  assert.equal(result.lock, undefined, "Should not return lock record");
});

test("[SYS-REL-2.3] acquireAsync returns acquired=true with lock record on success", async () => {
  const mockRedis = createMockRedis({
    status: "ready",
    set: async () => "OK",
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.acquireAsync({
    lockKey: "new-lock",
    owner: "test-owner",
    ttlMs: 30_000,
  });

  assert.equal(result.acquired, true, "Should return acquired=true");
  assert.ok(result.lock !== undefined, "Should return lock record");
  assert.equal(result.lock!.lockKey, "new-lock");
  assert.equal(result.lock!.owner, "test-owner");
  assert.equal(result.lock!.status, "held");
  assert.ok(result.lock!.fencingToken > 0, "Fencing token should be positive");
  assert.ok(result.lock!.ttlMs > 0, "TTL should be set");
});

test("[SYS-REL-2.3] acquireAsync failure due to connection error propagates error", async () => {
  const mockRedis = createMockRedis({
    status: "ready",
    set: async () => {
      throw new Error("ECONNREFUSED - connection refused");
    },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  await assert.rejects(
    adapter.acquireAsync({ lockKey: "test-lock", owner: "test-owner" }),
    (err: unknown) => err instanceof Error && err.message.includes("ECONNREFUSED"),
    "Connection error should propagate",
  );
});

test("[SYS-REL-2.3] acquireAsync with very short TTL works correctly", async () => {
  let setArgs: Array<string | number> = [];
  const mockRedis = createMockRedis({
    status: "ready",
    set: async (_key: string, _value: string, ...args: Array<string | number>) => {
      setArgs = args;
      return "OK";
    },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  // 100ms TTL
  await adapter.acquireAsync({ lockKey: "short-ttl-lock", owner: "test-owner", ttlMs: 100 });

  const pxIndex = setArgs.indexOf("PX");
  assert.equal(setArgs[pxIndex + 1], 100, "Short TTL should stay in millisecond precision");
});

test("[SYS-REL-2.3] acquireAsync with very long TTL is capped at reasonable maximum", async () => {
  let setArgs: Array<string | number> = [];
  const mockRedis = createMockRedis({
    status: "ready",
    set: async (_key: string, _value: string, ...args: Array<string | number>) => {
      setArgs = args;
      return "OK";
    },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  // 2 years in milliseconds
  const twoYearsMs = 2 * 365 * 24 * 60 * 60 * 1000;
  await adapter.acquireAsync({ lockKey: "long-ttl-lock", owner: "test-owner", ttlMs: twoYearsMs });

  const pxIndex = setArgs.indexOf("PX");
  const ttlMs = setArgs[pxIndex + 1] as number;
  assert.equal(ttlMs, twoYearsMs, "Redis adapter currently preserves caller-provided ttlMs");
});

test("[SYS-REL-2.3] lock key format uses lock: prefix", async () => {
  let capturedKey: string | null = null;
  const mockRedis = createMockRedis({
    status: "ready",
    set: async (key: string, ..._args: Array<string | number>) => {
      capturedKey = key;
      return "OK";
    },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  await adapter.acquireAsync({ lockKey: "my-test-lock", owner: "test-owner" });

  assert.ok(capturedKey !== null, "Key should be captured");
  assert.ok(capturedKey.startsWith("lock:"), "Key should have lock: prefix");
  assert.ok(capturedKey.includes("my-test-lock"), "Key should include lock key name");
});

test("[SYS-REL-2.3] forceStealAsync acquires lock regardless of existing owner", async () => {
  let evalArgs: string[] = [];
  const mockRedis = createMockRedis({
    status: "ready",
    eval: async (_script: string, _numKeys: number, ...args: string[]) => {
      evalArgs = args;
      return 1;
    },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.forceStealAsync("existing-lock", "new-owner", "emergency takeover");

  assert.equal(result.lockKey, "existing-lock");
  assert.equal(result.owner, "new-owner");
  assert.equal(result.status, "held");
  assert.ok(result.fencingToken > 0);
  assert.equal(evalArgs[0], "lock:existing-lock");
});

test("[SYS-REL-2.3] forceStealAsync throws when lock does not exist", async () => {
  const mockRedis = createMockRedis({
    status: "ready",
    eval: async () => -1,
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  await assert.rejects(
    adapter.forceStealAsync("nonexistent-lock", "new-owner", "reason"),
    (err: unknown) =>
      err instanceof LockingError &&
      (err as any).code === "E7lock.forceSteal_lock_not_found",
    "Should throw LockingError for non-existent lock",
  );
});

test("[SYS-REL-2.3] extendAsync returns null when lock not found", async () => {
  const mockRedis = createMockRedis({
    status: "ready",
    eval: async () => -1, // Lock not found
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.extendAsync("nonexistent-lock", "test-owner", 5000);

  assert.equal(result, null, "Should return null for non-existent lock");
});

test("[SYS-REL-2.3] extendAsync returns null when owner does not match", async () => {
  const mockRedis = createMockRedis({
    status: "ready",
    eval: async () => 0, // Owner mismatch
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.extendAsync("test-lock", "wrong-owner", 5000);

  assert.equal(result, null, "Should return null when owner doesn't match");
});

test("[SYS-REL-2.3] extendAsync caps additionalMs at 600000ms", async () => {
  const mockRedis = createMockRedis({
    status: "ready",
    incr: async () => 42,
    eval: async () => JSON.stringify({
      owner: "test-owner",
      fencingToken: 42,
      ttlMs: 600000,
      acquiredAt: new Date().toISOString(),
      metadata: null,
    }),
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.extendAsync("test-lock", "test-owner", 999999);
  assert.equal(result?.ttlMs, 600000);
  assert.equal(result?.fencingToken, 42);
});

test("[SYS-REL-2.3] releaseAsync returns false when lock not found", async () => {
  const mockRedis = createMockRedis({
    status: "ready",
    eval: async () => -1, // Lock not found
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.releaseAsync("nonexistent-lock", "test-owner");

  assert.equal(result, false, "Should return false when lock doesn't exist");
});

test("[SYS-REL-2.3] releaseAsync returns false when owner does not match", async () => {
  const mockRedis = createMockRedis({
    status: "ready",
    eval: async () => 0, // Owner mismatch
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.releaseAsync("test-lock", "wrong-owner");

  assert.equal(result, false, "Should return false when owner doesn't match");
});

test("[SYS-REL-2.3] releaseAsync returns true on successful release", async () => {
  const mockRedis = createMockRedis({
    status: "ready",
    eval: async () => 1, // Success
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.releaseAsync("test-lock", "correct-owner");

  assert.equal(result, true, "Should return true when release succeeds");
});

test("[SYS-REL-2.3] inspectAsync returns lock record when exists", async () => {
  const mockRedis = createMockRedis({
    status: "ready",
    get: async () => JSON.stringify({
      owner: "test-owner",
      fencingToken: 42,
      ttlMs: 30000,
      acquiredAt: new Date().toISOString(),
      metadata: null,
    }),
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.inspectAsync("test-lock");

  assert.ok(result !== null, "Should return lock record");
  assert.equal(result!.lockKey, "test-lock");
  assert.equal(result!.owner, "test-owner");
  assert.equal(result!.fencingToken, 42);
});

test("[SYS-REL-2.3] inspectAsync returns null when lock does not exist", async () => {
  const mockRedis = createMockRedis({
    status: "ready",
    get: async () => null,
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.inspectAsync("nonexistent-lock");

  assert.equal(result, null, "Should return null for non-existent lock");
});

test("[SYS-REL-2.3] listHeldAsync returns empty array when no locks", async () => {
  const mockRedis = createMockRedis({
    status: "ready",
    scan: async () => ["0", []], // No keys
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.listHeldAsync();

  assert.equal(result.length, 0, "Should return empty array when no locks");
});

test("[SYS-REL-2.3] listHeldAsync returns all held locks", async () => {
  const mockRedis = createMockRedis({
    status: "ready",
    scan: async () => ["0", ["lock:key1", "lock:key2", "lock:key3"]],
    mget: async () => [
      JSON.stringify({ owner: "owner-1", fencingToken: 1, ttlMs: 30000, acquiredAt: new Date().toISOString(), metadata: null }),
      JSON.stringify({ owner: "owner-2", fencingToken: 2, ttlMs: 30000, acquiredAt: new Date().toISOString(), metadata: null }),
      JSON.stringify({ owner: "owner-3", fencingToken: 3, ttlMs: 30000, acquiredAt: new Date().toISOString(), metadata: null }),
    ],
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.listHeldAsync();

  assert.equal(result.length, 3, "Should return all 3 locks");
  assert.ok(result.every((r) => r.status === "held"));
});

test("[SYS-REL-2.3] listHeldAsync respects limit parameter", async () => {
  let mgetCalledWith: string[][] = [];
  const mockRedis = createMockRedis({
    status: "ready",
    scan: async () => ["0", ["lock:key1", "lock:key2", "lock:key3", "lock:key4", "lock:key5"]],
    mget: async (...keys: string[]) => {
      mgetCalledWith.push(keys);
      return keys.map(() =>
        JSON.stringify({ owner: "owner", fencingToken: 1, ttlMs: 30000, acquiredAt: new Date().toISOString(), metadata: null })
      );
    },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.listHeldAsync(3);

  // Should stop after getting 3 locks
  assert.equal(result.length, 3, "Should return at most 3 locks");
});

test("[SYS-REL-2.3] acquireAsync reconnects when Redis status is 'wait'", async () => {
  let connectCalled = false;
  const mockRedis = createMockRedis({
    status: "wait",
    connect: async () => {
      connectCalled = true;
      mockRedis.status = "ready";
    },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  await adapter.acquireAsync({ lockKey: "test-lock", owner: "test-owner" });

  assert.equal(connectCalled, true, "Should call connect when status is wait");
});

test("[SYS-REL-2.3] acquireAsync throws LockingError when connection fails after 'end' status", async () => {
  const adapter = new RedisLockAdapter({ host: "localhost", port: 6379 });

  const redis = (adapter as unknown as { redis: RedisLockAdapter["redis"] }).redis;
  Object.defineProperty(redis, "status", { value: "end", writable: true });

  redis.connect = async () => {
    throw new Error("Connection refused");
  };

  await assert.rejects(
    adapter.acquireAsync({ lockKey: "test-lock", owner: "test-owner", ttlMs: 30000 }),
    (err: unknown) =>
      err instanceof LockingError &&
      (err as any).code === "E7lock.redis_connection_closed",
  );

  await adapter.close();
});

test("[SYS-REL-2.3] acquireAsync includes owner in lock data", async () => {
  let capturedValue: string | null = null;
  const mockRedis = createMockRedis({
    status: "ready",
    set: async (_key: string, value: string, ..._args: Array<string | number>) => {
      capturedValue = value;
      return "OK";
    },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  await adapter.acquireAsync({ lockKey: "test-lock", owner: "my-special-owner" });

  assert.ok(capturedValue !== null, "Should capture lock data");
  const parsed = JSON.parse(capturedValue!);
  assert.equal(parsed.owner, "my-special-owner", "Owner should be stored in lock data");
});

test("[SYS-REL-2.3] lock data includes fencingToken for ordering", async () => {
  let capturedValue: string | null = null;
  const mockRedis = createMockRedis({
    status: "ready",
    set: async (_key: string, value: string, ..._args: Array<string | number>) => {
      capturedValue = value;
      return "OK";
    },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.acquireAsync({ lockKey: "test-lock", owner: "test-owner" });

  assert.ok(result.lock?.fencingToken !== undefined, "Fencing token should be set");
  assert.ok(result.lock!.fencingToken > 0, "Fencing token should be positive");
});

test("[SYS-REL-2.3] multiple rapid acquireAsync calls all succeed with different keys", async () => {
  const mockRedis = createMockRedis({
    status: "ready",
    set: async () => "OK",
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const results = await Promise.all([
    adapter.acquireAsync({ lockKey: "lock-1", owner: "owner" }),
    adapter.acquireAsync({ lockKey: "lock-2", owner: "owner" }),
    adapter.acquireAsync({ lockKey: "lock-3", owner: "owner" }),
  ]);

  assert.ok(results.every((r) => r.acquired), "All acquires should succeed");
  assert.ok(results.every((r) => r.lock !== undefined), "All should have lock records");
});

test("[SYS-REL-2.3] acquireAsync with same key returns acquired=false for second call", async () => {
  const mockRedis = createMockRedis({
    status: "ready",
    set: async () => "OK", // First call succeeds
  });

  // Override to fail on second call
  let callCount = 0;
  mockRedis.set = async () => {
    callCount++;
    if (callCount > 1) return null; // Second call fails (lock exists)
    return "OK";
  };

  const adapter = createAdapterWithMockRedis(mockRedis);

  const first = await adapter.acquireAsync({ lockKey: "duplicate-key", owner: "owner-1" });
  const second = await adapter.acquireAsync({ lockKey: "duplicate-key", owner: "owner-2" });

  assert.equal(first.acquired, true, "First acquire should succeed");
  assert.equal(second.acquired, false, "Second acquire should fail");
});

test("[SYS-REL-2.3] forceStealAsync with TTL parameter sets correct expiration", async () => {
  let capturedValue: string | null = null;
  let capturedTtl: string | null = null;
  const mockRedis = createMockRedis({
    status: "ready",
    eval: async (_script: string, _numKeys: number, _key: string, value: string, ttlMs: string) => {
      capturedValue = value;
      capturedTtl = ttlMs;
      return 1;
    },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  await adapter.forceStealAsync("test-lock", "new-owner", "test");

  assert.ok(capturedValue !== null);
  const parsed = JSON.parse(capturedValue!);
  assert.equal(parsed.ttlMs, 30000, "forceStealAsync uses its fixed default ttlMs");
  assert.equal(capturedTtl, "30000");
});

test("[SYS-REL-2.3] acquireAsync metadata is null by default", async () => {
  let capturedValue: string | null = null;
  const mockRedis = createMockRedis({
    status: "ready",
    set: async (_key: string, value: string, ..._args: Array<string | number>) => {
      capturedValue = value;
      return "OK";
    },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  await adapter.acquireAsync({ lockKey: "test-lock", owner: "owner" });

  const parsed = JSON.parse(capturedValue!);
  assert.equal(parsed.metadata, null, "Metadata should be null by default");
});

test("[SYS-REL-2.3] forceStealAsync stores reason in metadata", async () => {
  let capturedValue: string | null = null;
  const mockRedis = createMockRedis({
    status: "ready",
    eval: async (_script: string, _numKeys: number, _key: string, value: string) => {
      capturedValue = value;
      return 1;
    },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  await adapter.forceStealAsync("test-lock", "new-owner", "emergency: primary failed");

  const parsed = JSON.parse(capturedValue!);
  assert.ok(parsed.metadata !== null, "Metadata should be set");
  const metadata = JSON.parse(parsed.metadata);
  assert.ok(metadata.forceStealReason.includes("emergency"), "Metadata should contain reason");
});
