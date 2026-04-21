import assert from "node:assert/strict";
import test from "node:test";
import { PgAdvisoryLockAdapter } from "../../../../../src/platform/execution/distributed-lock/pg-advisory-lock-adapter.js";
test("PgAdvisoryLockAdapter acquire() throws pg_async_required", () => {
    const adapter = new PgAdvisoryLockAdapter();
    assert.throws(() => adapter.acquire({ lockKey: "test-key", owner: "test-owner" }), (error) => error?.code === "E7lock.pg_async_required"
        && error?.message.includes("acquire() requires async"));
});
test("PgAdvisoryLockAdapter release() throws pg_async_required", () => {
    const adapter = new PgAdvisoryLockAdapter();
    assert.throws(() => adapter.release("test-key", "test-owner"), (error) => error?.code === "E7lock.pg_async_required"
        && error?.message.includes("release() requires async"));
});
test("PgAdvisoryLockAdapter forceSteal() throws advisory_cannot_force_steal", () => {
    const adapter = new PgAdvisoryLockAdapter();
    assert.throws(() => adapter.forceSteal("test-key", "new-owner", "test reason"), (error) => error?.code === "E7lock.advisory_cannot_force_steal"
        && error?.message.includes("forceSteal is not supported"));
});
test("PgAdvisoryLockAdapter inspect() returns null", () => {
    const adapter = new PgAdvisoryLockAdapter();
    const result = adapter.inspect("test-key");
    assert.equal(result, null);
});
test("PgAdvisoryLockAdapter extend() delegates to inspect", () => {
    const adapter = new PgAdvisoryLockAdapter();
    const result = adapter.extend("test-key", "test-owner", 5000);
    // extend returns the result of inspect, which is null
    assert.equal(result, null);
});
test("PgAdvisoryLockAdapter backendKind is pg_advisory", () => {
    const adapter = new PgAdvisoryLockAdapter();
    assert.equal(adapter.backendKind, "pg_advisory");
});
function createMockDriver(options = {}) {
    const { queryFn = async () => [{ acquired: true }], endFn = async () => { } } = options;
    // Create a callable mock function that can be used as a tagged template function
    const mockFn = (async (strings, ...values) => queryFn(strings, ...values));
    mockFn.end = endFn;
    return mockFn;
}
// Helper to create adapter with mock driver
function createAdapterWithMockDriver(mockDriver) {
    const adapter = new PgAdvisoryLockAdapter({ dsn: "postgresql://test:test@localhost/test" });
    // sql is used as a tagged template function (driver`...`), so assign the callable directly
    adapter.sql = mockDriver;
    adapter.connected = true;
    return adapter;
}
test("PgAdvisoryLockAdapter acquireAsync returns lock when successful", async () => {
    const mockDriver = createMockDriver({
        queryFn: async () => [{ acquired: true }],
    });
    const adapter = createAdapterWithMockDriver(mockDriver);
    const result = await adapter.acquireAsync({ lockKey: "test-key", owner: "test-owner" });
    assert.equal(result.acquired, true);
    assert.ok(result.lock);
    assert.equal(result.lock.lockKey, "test-key");
    assert.equal(result.lock.owner, "test-owner");
    assert.equal(result.lock.status, "held");
});
test("PgAdvisoryLockAdapter acquireAsync returns false when lock not acquired", async () => {
    const mockDriver = createMockDriver({
        queryFn: async () => [{ acquired: false }],
    });
    const adapter = createAdapterWithMockDriver(mockDriver);
    const result = await adapter.acquireAsync({ lockKey: "test-key", owner: "test-owner" });
    assert.equal(result.acquired, false);
    assert.equal(result.lock, undefined);
});
test("PgAdvisoryLockAdapter acquireAsync throws when pg module not found", async () => {
    // Pass a custom postgresFactory that throws module not found error
    const adapter = new PgAdvisoryLockAdapter({
        dsn: "postgresql://test:test@localhost/test",
        postgresFactory: () => {
            throw new ReferenceError("Cannot find module 'postgres'");
        },
    });
    await assert.rejects(adapter.acquireAsync({ lockKey: "test-key", owner: "test-owner" }), (error) => error?.code === "E7lock.pg_advisory_not_implemented"
        && error?.message.includes("pg driver"));
});
test("PgAdvisoryLockAdapter acquireAsync returns false on connection error", async () => {
    // Throw a non-module, non-ECONNREFUSED error so code returns { acquired: false }
    const mockDriver = createMockDriver({
        queryFn: async () => {
            throw new Error("Connection reset by peer");
        },
    });
    const adapter = createAdapterWithMockDriver(mockDriver);
    const result = await adapter.acquireAsync({ lockKey: "test-key", owner: "test-owner" });
    assert.equal(result.acquired, false);
});
test("PgAdvisoryLockAdapter releaseAsync returns true when successful", async () => {
    const mockDriver = createMockDriver({
        queryFn: async () => [{}],
    });
    const adapter = createAdapterWithMockDriver(mockDriver);
    const result = await adapter.releaseAsync("test-key", "test-owner");
    assert.equal(result, true);
});
test("PgAdvisoryLockAdapter releaseAsync throws when pg module not found", async () => {
    // Pass a custom postgresFactory that throws module not found error
    const adapter = new PgAdvisoryLockAdapter({
        dsn: "postgresql://test:test@localhost/test",
        postgresFactory: () => {
            throw new ReferenceError("Cannot find module 'postgres'");
        },
    });
    await assert.rejects(adapter.releaseAsync("test-key", "test-owner"), (error) => error?.code === "E7lock.pg_advisory_not_implemented"
        && error?.message.includes("pg driver"));
});
test("PgAdvisoryLockAdapter releaseAsync returns false on error", async () => {
    const mockDriver = createMockDriver({
        queryFn: async () => {
            throw new Error("some database error");
        },
    });
    const adapter = createAdapterWithMockDriver(mockDriver);
    const result = await adapter.releaseAsync("test-key", "test-owner");
    assert.equal(result, false);
});
test("PgAdvisoryLockAdapter close calls sql.end() when connected", async () => {
    let endCalled = false;
    const mockDriver = createMockDriver({
        endFn: async () => { endCalled = true; },
    });
    const adapter = createAdapterWithMockDriver(mockDriver);
    await adapter.close();
    assert.equal(endCalled, true);
});
test("PgAdvisoryLockAdapter close does nothing when not connected", async () => {
    const adapter = new PgAdvisoryLockAdapter({ dsn: "postgresql://test:test@localhost/test" });
    // sql is null, connected is false
    // Should not throw
    await adapter.close();
});
test("PgAdvisoryLockAdapter lockKeyToAdvisoryKey produces consistent bigint", () => {
    const adapter = new PgAdvisoryLockAdapter({ dsn: "postgresql://test:test@localhost/test" });
    // Access private method via casting to any
    const key1 = adapter.lockKeyToAdvisoryKey("test-key");
    const key2 = adapter.lockKeyToAdvisoryKey("test-key");
    assert.equal(key1, key2);
    assert.equal(typeof key1, "bigint");
});
test("PgAdvisoryLockAdapter lockKeyToAdvisoryKey produces different keys for different inputs", () => {
    const adapter = new PgAdvisoryLockAdapter({ dsn: "postgresql://test:test@localhost/test" });
    const key1 = adapter.lockKeyToAdvisoryKey("key-a");
    const key2 = adapter.lockKeyToAdvisoryKey("key-b");
    assert.notEqual(key1, key2);
});
//# sourceMappingURL=pg-advisory-lock-adapter.test.js.map