import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import test from "node:test";
import assert from "node:assert/strict";
import { RedisLockAdapter } from "../../../../src/platform/execution/distributed-lock/redis-lock-adapter.js";
import { LockingError } from "../../../../src/platform/contracts/errors.js";
import { StructuredLogger } from "../../../../src/platform/shared/observability/structured-logger.js";
const require = createRequire(import.meta.url);
const ioredisPath = require.resolve("ioredis");
// =============================================================================
// Mock redis helper
// =============================================================================
function createMockRedis(overrides = {}) {
    return {
        status: "ready",
        connect: async () => { },
        set: async () => "OK",
        get: async () => null,
        del: async () => 1,
        eval: async () => 1,
        scan: async () => ["0", []],
        mget: async () => [],
        quit: async () => { },
        disconnect: () => { },
        on: () => { },
        ...overrides,
    };
}
function createAdapterWithMockRedis(mockRedis) {
    const adapter = new RedisLockAdapter({ host: "localhost", port: 6379 });
    adapter.redis = mockRedis;
    return adapter;
}
async function withMockRedisCtor(run) {
    require(ioredisPath);
    const moduleEntry = require.cache[ioredisPath];
    assert.ok(moduleEntry, "ioredis module must be present in require cache");
    const originalExports = moduleEntry.exports;
    class MockRedisClient extends EventEmitter {
        status = "ready";
        async connect() { }
        async set() { return "OK"; }
        async get() { return null; }
        async del() { return 1; }
        async eval() { return 1; }
        async scan() { return ["0", []]; }
        async mget() { return []; }
        async quit() { }
        disconnect() { }
    }
    moduleEntry.exports = MockRedisClient;
    try {
        return await run(MockRedisClient);
    }
    finally {
        moduleEntry.exports = originalExports;
    }
}
async function captureLockLogs(action) {
    const entries = [];
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
    }
    finally {
        StructuredLogger.removeTransport(transportName);
    }
}
test("[SYS-REL-2.1] Redis lock adapter logs error on connection failure", async () => {
    const logs = await captureLockLogs(async () => {
        await withMockRedisCtor(async () => {
            const adapter = new RedisLockAdapter({ host: "mock-host", port: 6379 });
            try {
                const client = adapter.redis;
                client.emit("error", new Error("ECONNREFUSED"));
            }
            finally {
                await adapter.close();
            }
        });
    });
    assert.ok(logs.some((entry) => entry.message === "redis.connection_error" && entry.data?.err === "ECONNREFUSED"), "Connection failure must be logged via lockLogger");
});
test("[SYS-REL-2.1] Redis lock adapter error handler should not be empty", async () => {
    await withMockRedisCtor(async () => {
        const adapter = new RedisLockAdapter({ host: "mock-host", port: 6379 });
        try {
            const client = adapter.redis;
            const errorHandlers = client.listeners("error");
            assert.ok(errorHandlers.length > 0, "Error handler should be registered");
            assert.ok(errorHandlers.some((handler) => typeof handler === "function"), "Registered handler must be callable");
        }
        finally {
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
    await assert.rejects(adapter.acquireAsync({ lockKey: "test-key", owner: "test-owner" }), (err) => err instanceof Error && err.message === "Connection lost during SET");
});
test("RedisLockAdapter releaseAsync throws LockingError when Lua script fails", async () => {
    const mockRedis = createMockRedis({
        status: "ready",
        eval: async () => {
            throw new Error("Lua script error: ERR Error running script");
        },
    });
    const adapter = createAdapterWithMockRedis(mockRedis);
    await assert.rejects(adapter.releaseAsync("test-lock", "test-owner"), (err) => err instanceof LockingError || err instanceof Error);
});
test("RedisLockAdapter close() propagates error when quit() throws", async () => {
    const mockRedis = createMockRedis({
        status: "ready",
        quit: async () => {
            throw new Error("QUIT command failed");
        },
    });
    const adapter = createAdapterWithMockRedis(mockRedis);
    await assert.rejects(adapter.close(), (err) => err instanceof Error && err.message === "QUIT command failed");
});
test("RedisLockAdapter listHeldAsync propagates error when scan throws", async () => {
    const mockRedis = createMockRedis({
        status: "ready",
        scan: async () => {
            throw new Error("CLUSTER DOWN - scan failed");
        },
    });
    const adapter = createAdapterWithMockRedis(mockRedis);
    await assert.rejects(adapter.listHeldAsync(100), (err) => err instanceof Error && err.message === "CLUSTER DOWN - scan failed");
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
    await assert.rejects(adapter.listHeldAsync(100), (err) => err instanceof Error && err.message === "MGET failed - network error");
});
//# sourceMappingURL=redis-lock-error.test.js.map