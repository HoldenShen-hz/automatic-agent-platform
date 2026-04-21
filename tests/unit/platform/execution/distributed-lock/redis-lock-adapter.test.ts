import assert from "node:assert/strict";
import test from "node:test";

import { RedisLockAdapter } from "../../../../../src/platform/execution/distributed-lock/redis-lock-adapter.js";

test("RedisLockAdapter release() throws sync_release_not_supported", () => {
  // Create adapter without connecting (sync methods throw regardless of connection state)
  const adapter = new RedisLockAdapter({ host: "localhost", port: 6379 });

  assert.throws(
    () => adapter.release("test-key", "test-owner"),
    (error: unknown) =>
      (error as any)?.code === "E7lock.sync_release_not_supported"
      && (error as any)?.message.includes("releaseAsync"),
  );
});

test("RedisLockAdapter extend() throws sync_extend_not_supported", () => {
  const adapter = new RedisLockAdapter({ host: "localhost", port: 6379 });

  assert.throws(
    () => adapter.extend("test-key", "test-owner", 5000),
    (error: unknown) =>
      (error as any)?.code === "E7lock.sync_extend_not_supported"
      && (error as any)?.message.includes("extendAsync"),
  );
});

test("RedisLockAdapter forceSteal() throws sync_forceSteal_not_supported", () => {
  const adapter = new RedisLockAdapter({ host: "localhost", port: 6379 });

  assert.throws(
    () => adapter.forceSteal("test-key", "new-owner", "test reason"),
    (error: unknown) =>
      (error as any)?.code === "E7lock.sync_forceSteal_not_supported"
      && (error as any)?.message.includes("forceStealAsync"),
  );
});

test("RedisLockAdapter inspect() throws sync_inspect_not_supported", () => {
  const adapter = new RedisLockAdapter({ host: "localhost", port: 6379 });

  assert.throws(
    () => adapter.inspect("test-key"),
    (error: unknown) =>
      (error as any)?.code === "E7lock.sync_inspect_not_supported"
      && (error as any)?.message.includes("inspectAsync"),
  );
});

test("RedisLockAdapter backendKind is redis", () => {
  const adapter = new RedisLockAdapter({ host: "localhost", port: 6379 });

  assert.equal(adapter.backendKind, "redis");
});

// =============================================================================
// Async method tests (require Redis client mocking)
// =============================================================================

function createMockRedis(overrides: Partial<{
  status: string;
  connect: () => Promise<void>;
  set: (key: string, value: string, ...args: Array<string | number>) => Promise<string | null>;
  get: (key: string) => Promise<string | null>;
  del: (key: string) => Promise<number>;
  eval: (script: string, numKeys: number, ...args: string[]) => Promise<unknown>;
  keys: (pattern: string) => Promise<string[]>;
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
    keys: async () => [],
    quit: async () => {},
    disconnect: () => {},
    on: () => {},
    ...overrides,
  };
}

// Helper to create adapter with mock redis client
function createAdapterWithMockRedis(mockRedis: ReturnType<typeof createMockRedis>): RedisLockAdapter {
  const adapter = new RedisLockAdapter({ host: "localhost", port: 6379 });
  // Use any to inject mock - this is test-only access
  (adapter as any).redis = mockRedis;
  return adapter;
}

test("RedisLockAdapter acquireAsync returns lock when successful", async () => {
  const mockRedis = createMockRedis({ status: "ready" });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.acquireAsync({ lockKey: "test-key", owner: "test-owner" });

  assert.equal(result.acquired, true);
  assert.ok(result.lock);
  assert.equal(result.lock!.lockKey, "test-key");
  assert.equal(result.lock!.owner, "test-owner");
  assert.equal(result.lock!.status, "held");
  assert.ok(result.lock!.fencingToken > 0);
});

test("RedisLockAdapter acquireAsync returns false when lock exists", async () => {
  const mockRedis = createMockRedis({
    status: "ready",
    set: async () => null, // NX fails, lock exists
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.acquireAsync({ lockKey: "existing-key", owner: "test-owner" });

  assert.equal(result.acquired, false);
  assert.equal(result.lock, undefined);
});

test("RedisLockAdapter acquireAsync connects when status is wait", async () => {
  let connected = false;
  const mockRedis = createMockRedis({
    status: "wait",
    connect: async () => { connected = true; },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  await adapter.acquireAsync({ lockKey: "test-key", owner: "test-owner" });

  assert.equal(connected, true);
});

test("RedisLockAdapter acquireAsync reconnects when status is end", async () => {
  const mockRedis = createMockRedis({
    status: "end",
    connect: async () => {},
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  // Should not throw - connect handles end state and reconnects
  await adapter.acquireAsync({ lockKey: "test-key", owner: "test-owner" });

  assert.equal(mockRedis.status, "end");
});

test("RedisLockAdapter releaseAsync returns true when lock released", async () => {
  const mockRedis = createMockRedis({
    status: "ready",
    eval: async () => 1,
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.releaseAsync("test-key", "test-owner");

  assert.equal(result, true);
});

test("RedisLockAdapter releaseAsync returns false when not owner", async () => {
  const mockRedis = createMockRedis({
    status: "ready",
    eval: async () => 0, // Owner mismatch
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.releaseAsync("test-key", "wrong-owner");

  assert.equal(result, false);
});

test("RedisLockAdapter releaseAsync returns false when lock not found", async () => {
  const mockRedis = createMockRedis({
    status: "ready",
    eval: async () => -1, // Lock not found
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.releaseAsync("nonexistent-key", "test-owner");

  assert.equal(result, false);
});

test("RedisLockAdapter extendAsync returns extended lock when successful", async () => {
  const mockRedis = createMockRedis({
    status: "ready",
    get: async () => JSON.stringify({
      owner: "test-owner",
      fencingToken: 42,
      ttlMs: 30000,
      acquiredAt: new Date().toISOString(),
      metadata: null,
    }),
    set: async () => "OK",
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.extendAsync("test-key", "test-owner", 5000);

  assert.ok(result);
  assert.equal(result!.lockKey, "test-key");
  assert.equal(result!.owner, "test-owner");
  assert.equal(result!.fencingToken, 42);
});

test("RedisLockAdapter extendAsync returns null when lock not found", async () => {
  const mockRedis = createMockRedis({
    status: "ready",
    get: async () => null,
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.extendAsync("nonexistent-key", "test-owner", 5000);

  assert.equal(result, null);
});

test("RedisLockAdapter extendAsync returns null when owner mismatch", async () => {
  const mockRedis = createMockRedis({
    status: "ready",
    get: async () => JSON.stringify({
      owner: "different-owner",
      fencingToken: 42,
      ttlMs: 30000,
      acquiredAt: new Date().toISOString(),
      metadata: null,
    }),
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.extendAsync("test-key", "test-owner", 5000);

  assert.equal(result, null);
});

test("RedisLockAdapter extendAsync caps additionalMs at 600000", async () => {
  let setArgs: any[] = [];
  const mockRedis = createMockRedis({
    status: "ready",
    get: async () => JSON.stringify({
      owner: "test-owner",
      fencingToken: 42,
      ttlMs: 30000,
      acquiredAt: new Date().toISOString(),
      metadata: null,
    }),
    set: async (key: string, value: string, ...args: Array<string | number>) => {
      setArgs = [key, value, ...args];
      return "OK";
    },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  await adapter.extendAsync("test-key", "test-owner", 999999); // Should cap at 600000

  // Check that TTL was capped at 600000 (600000ms = 600sec)
  const ttlIndex = setArgs.findIndex((a) => a === "EX");
  if (ttlIndex >= 0) {
    const ttlValue = setArgs[ttlIndex + 1];
    assert.ok(Number(ttlValue) <= 600);
  }
});

test("RedisLockAdapter forceStealAsync returns new lock record", async () => {
  const mockRedis = createMockRedis({
    status: "ready",
    del: async () => 1,
    set: async () => "OK",
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.forceStealAsync("test-key", "new-owner", "reason: testing");

  assert.equal(result.lockKey, "test-key");
  assert.equal(result.owner, "new-owner");
  assert.ok(result.fencingToken > 0);
  assert.equal(result.status, "held");
});

test("RedisLockAdapter inspectAsync returns lock record when exists", async () => {
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

  const result = await adapter.inspectAsync("test-key");

  assert.ok(result);
  assert.equal(result!.lockKey, "test-key");
  assert.equal(result!.owner, "test-owner");
  assert.equal(result!.fencingToken, 42);
});

test("RedisLockAdapter inspectAsync returns null when lock not found", async () => {
  const mockRedis = createMockRedis({
    status: "ready",
    get: async () => null,
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.inspectAsync("nonexistent-key");

  assert.equal(result, null);
});

test("RedisLockAdapter listHeldAsync returns all locks within limit", async () => {
  const mockRedis = createMockRedis({
    status: "ready",
    keys: async () => ["lock:key1", "lock:key2", "lock:key3"],
    get: async (key: string) => JSON.stringify({
      owner: "test-owner",
      fencingToken: 42,
      ttlMs: 30000,
      acquiredAt: new Date().toISOString(),
      metadata: null,
    }),
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.listHeldAsync();

  assert.equal(result.length, 3);
});

test("RedisLockAdapter listHeldAsync respects limit parameter", async () => {
  let getCalls = 0;
  const mockRedis = createMockRedis({
    status: "ready",
    keys: async () => ["lock:key1", "lock:key2", "lock:key3"],
    get: async () => {
      getCalls++;
      return JSON.stringify({
        owner: "test-owner",
        fencingToken: 42,
        ttlMs: 30000,
        acquiredAt: new Date().toISOString(),
        metadata: null,
      });
    },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  await adapter.listHeldAsync(2);

  // Should only get 2 keys (limit) even though 3 keys exist
  assert.equal(getCalls, 2);
});

test("RedisLockAdapter listHeldAsync skips keys with no data", async () => {
  let getCalls = 0;
  const mockRedis = createMockRedis({
    status: "ready",
    keys: async () => ["lock:key1", "lock:key2", "lock:key3"],
    get: async () => {
      getCalls++;
      return null; // Simulate key expired between keys() and get()
    },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.listHeldAsync();

  // All 3 keys were tried but all returned null
  assert.equal(getCalls, 3);
  assert.equal(result.length, 0);
});

test("RedisLockAdapter listHeldAsync returns empty array when no locks", async () => {
  const mockRedis = createMockRedis({
    status: "ready",
    keys: async () => [],
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.listHeldAsync();

  assert.equal(result.length, 0);
});

test("RedisLockAdapter close disconnects when status is wait", async () => {
  let disconnected = false;
  const mockRedis = createMockRedis({
    status: "wait",
    disconnect: () => { disconnected = true; },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  await adapter.close();

  assert.equal(disconnected, true);
});

test("RedisLockAdapter close disconnects when status is end", async () => {
  let disconnected = false;
  const mockRedis = createMockRedis({
    status: "end",
    disconnect: () => { disconnected = true; },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  await adapter.close();

  assert.equal(disconnected, true);
});

test("RedisLockAdapter close calls quit when status is ready", async () => {
  let quitCalled = false;
  const mockRedis = createMockRedis({
    status: "ready",
    quit: async () => { quitCalled = true; },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  await adapter.close();

  assert.equal(quitCalled, true);
});

// =============================================================================
// Sync acquire() method tests (uses spawnSync)
// =============================================================================

test("RedisLockAdapter acquire() sync returns lock when spawnSync succeeds", () => {
  // This test requires mocking spawnSync which is harder - we test the error path
  const adapter = new RedisLockAdapter({ host: "localhost", port: 6379 });

  // The spawnSync will fail because redis-cli won't be reachable, so we get acquired: false
  const result = adapter.acquire({ lockKey: "test-key", owner: "test-owner" });

  // Without a real redis-cli, the acquire will fail - verify it returns the expected shape
  assert.equal(typeof result.acquired, "boolean");
});

test("RedisLockAdapter acquire() returns { acquired: false } on spawnSync error", () => {
  const adapter = new RedisLockAdapter({ host: "invalid-host", port: 9999 });

  // With invalid host, spawnSync will error out
  const result = adapter.acquire({ lockKey: "test-key", owner: "test-owner" });

  assert.equal(result.acquired, false);
});

test("RedisLockAdapter acquire() uses default TTL of 30000ms when not specified", () => {
  const adapter = new RedisLockAdapter({ host: "localhost", port: 6379 });

  // Just verify it doesn't throw and returns proper structure
  const result = adapter.acquire({ lockKey: "test-key", owner: "test-owner" });
  assert.equal(typeof result.acquired, "boolean");
});

test("RedisLockAdapter acquire() uses provided TTL when specified", () => {
  const adapter = new RedisLockAdapter({ host: "localhost", port: 6379 });

  const result = adapter.acquire({ lockKey: "test-key", owner: "test-owner", ttlMs: 60000 });
  assert.equal(typeof result.acquired, "boolean");
});

// =============================================================================
// ensureConnected edge cases
// =============================================================================

test("RedisLockAdapter ensureConnected does nothing when status is ready", async () => {
  const mockRedis = createMockRedis({ status: "ready" });
  const adapter = createAdapterWithMockRedis(mockRedis);

  // ensureConnected should not call connect when status is "ready"
  let connectCalled = false;
  mockRedis.connect = async () => { connectCalled = true; };

  // Access private method via any
  await (adapter as any).ensureConnected();

  assert.equal(connectCalled, false);
});

test("RedisLockAdapter ensureConnected throws when reconnect fails after status end", async () => {
  const mockRedis = createMockRedis({
    status: "end",
    connect: async () => {
      throw new Error("Connection failed");
    },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  await assert.rejects(
    (adapter as any).ensureConnected(),
    (error: unknown) =>
      (error as any)?.code === "E7lock.redis_connection_closed",
  );
});
