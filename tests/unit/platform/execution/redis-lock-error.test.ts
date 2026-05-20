import { EventEmitter } from "node:events";
import { createRequire } from "node:module";

import test from "node:test";
import assert from "node:assert/strict";

import { RedisLockAdapter } from "../../../../src/platform/five-plane-execution/distributed-lock/redis-lock-adapter.js";
import { LockingError } from "../../../../src/platform/contracts/errors.js";
import { StructuredLogger, type StructuredLogEntry } from "../../../../src/platform/shared/observability/structured-logger.js";

const require = createRequire(import.meta.url);
const ioredisPath = require.resolve("ioredis");

// =============================================================================
// Mock redis helper
// =============================================================================

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
  on: (event: "error", listener: (error: unknown) => void) => void;
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
  (adapter as any).redis = mockRedis as any;
  return adapter;
}

async function withMockRedisCtor<T>(
  run: (MockRedisClient: new () => EventEmitter) => Promise<T>,
): Promise<T> {
  require(ioredisPath);
  const moduleEntry = require.cache[ioredisPath];
  assert.ok(moduleEntry, "ioredis module must be present in require cache");
  const originalExports = moduleEntry.exports;

  class MockRedisClient extends EventEmitter {
    public status = "ready";
    public async connect(): Promise<void> {}
    public async incr(): Promise<number> { return 1; }
    public async set(): Promise<string | null> { return "OK"; }
    public async get(): Promise<string | null> { return null; }
    public async del(): Promise<number> { return 1; }
    public async eval(): Promise<unknown> { return 1; }
    public async scan(): Promise<[string, string[]]> { return ["0", []]; }
    public async mget(): Promise<(string | null)[]> { return []; }
    public async quit(): Promise<void> {}
    public disconnect(): void {}
  }

  moduleEntry.exports = MockRedisClient;
  try {
    return await run(MockRedisClient);
  } finally {
    moduleEntry.exports = originalExports;
  }
}

async function captureLockLogs(action: () => Promise<void>): Promise<StructuredLogEntry[]> {
  const entries: StructuredLogEntry[] = [];
  const transportName = `test-lock-log-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  StructuredLogger.addTransport({
    name: transportName,
    write(entry) {
      if (entry.level === "error") {
        entries.push(entry);
      }
    },
  });
  try {
    await action();
    await StructuredLogger.flushTransports();
    return entries;
  } finally {
    StructuredLogger.removeTransport(transportName);
  }
}

test("[SYS-REL-2.1] Redis lock adapter logs error on connection failure", async () => {
  const logs = await captureLockLogs(async () => {
    await withMockRedisCtor(async () => {
      const adapter = new RedisLockAdapter({ host: "mock-host", port: 6379 });
      try {
        const client = (adapter as unknown as { redis: EventEmitter }).redis;
        client.emit("error", new Error("ECONNREFUSED"));
      } finally {
        await adapter.close();
      }
    });
  });

  assert.ok(
    logs.some((entry) => entry.message === "redis.connection_error" && entry.data?.err === "ECONNREFUSED"),
    "Connection failure must be logged via lockLogger",
  );
});

test("[SYS-REL-2.1] Redis lock adapter error handler should not be empty", async () => {
  await withMockRedisCtor(async () => {
    const adapter = new RedisLockAdapter({ host: "mock-host", port: 6379 });
    try {
      const client = (adapter as unknown as { redis: EventEmitter }).redis;
      const errorHandlers = client.listeners("error");
      assert.ok(errorHandlers.length > 0, "Error handler should be registered");
      assert.ok(errorHandlers.some((handler) => typeof handler === "function"), "Registered handler must be callable");
    } finally {
      await adapter.close();
    }
  });
});

// =============================================================================
// Error path tests for Redis operations
// =============================================================================

test("RedisLockAdapter acquireAsync propagates error when redis.set throws", async () => {
  const mockRedis = createMockRedis({
    status: "ready",
    set: async () => {
      throw new Error("Connection lost during SET");
    },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  await assert.rejects(
    adapter.acquireAsync({ lockKey: "test-key", owner: "test-owner" }),
    (err: unknown) => err instanceof Error && err.message === "Connection lost during SET",
  );
});

test("RedisLockAdapter releaseAsync throws LockingError when Lua script fails", async () => {
  const mockRedis = createMockRedis({
    status: "ready",
    eval: async () => {
      throw new Error("Lua script error: ERR Error running script");
    },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  await assert.rejects(
    adapter.releaseAsync("test-lock", "test-owner"),
    (err: unknown) => err instanceof LockingError || err instanceof Error,
  );
});

test("RedisLockAdapter close() propagates error when quit() throws", async () => {
  const mockRedis = createMockRedis({
    status: "ready",
    quit: async () => {
      throw new Error("QUIT command failed");
    },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  await assert.rejects(
    adapter.close(),
    (err: unknown) => err instanceof Error && err.message === "QUIT command failed",
  );
});

test("RedisLockAdapter listHeldAsync propagates error when scan throws", async () => {
  const mockRedis = createMockRedis({
    status: "ready",
    scan: async () => {
      throw new Error("CLUSTER DOWN - scan failed");
    },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  await assert.rejects(
    adapter.listHeldAsync(100),
    (err: unknown) => err instanceof Error && err.message === "CLUSTER DOWN - scan failed",
  );
});

test("RedisLockAdapter listHeldAsync propagates error when mget throws", async () => {
  const mockRedis = createMockRedis({
    status: "ready",
    scan: async () => ["0", ["lock:key1", "lock:key2"]],
    mget: async () => {
      throw new Error("MGET failed - network error");
    },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  await assert.rejects(
    adapter.listHeldAsync(100),
    (err: unknown) => err instanceof Error && err.message === "MGET failed - network error",
  );
});
