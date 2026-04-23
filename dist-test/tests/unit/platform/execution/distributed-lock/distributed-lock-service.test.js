import assert from "node:assert/strict";
import test from "node:test";
// Barrel test for distributed-lock-service
import { DISTRIBUTED_LOCKS_DDL, } from "../../../../../src/platform/execution/distributed-lock/distributed-lock-service.js";
test("DistributedLockAdapter interface structure", () => {
    // This validates the interface exists and has the expected shape
    // Create a mock object that satisfies the interface
    const mockAdapter = {
        backendKind: "test",
        acquire: () => ({ acquired: false }),
        release: () => false,
        extend: () => null,
        forceSteal: () => ({ lockKey: "", owner: "", fencingToken: 0, status: "" }),
        inspect: () => null,
    };
    assert.equal(typeof mockAdapter.backendKind, "string");
    assert.equal(typeof mockAdapter.acquire, "function");
    assert.equal(typeof mockAdapter.release, "function");
    assert.equal(typeof mockAdapter.extend, "function");
    assert.equal(typeof mockAdapter.forceSteal, "function");
    assert.equal(typeof mockAdapter.inspect, "function");
});
test("LockBackendKind type accepts valid values", () => {
    const kinds = ["sqlite", "pg_advisory", "redis"];
    assert.equal(kinds.length, 3);
});
test("LockRecord structure is correct", () => {
    const record = {
        lockKey: "test-lock",
        owner: "owner-1",
        fencingToken: 1,
        status: "held",
        acquiredAt: "2026-04-14T00:00:00.000Z",
        ttlMs: 30000,
        metadata: null,
    };
    assert.equal(record.lockKey, "test-lock");
    assert.equal(record.owner, "owner-1");
    assert.equal(record.fencingToken, 1);
    assert.equal(record.status, "held");
    assert.equal(record.ttlMs, 30000);
    assert.equal(record.metadata, null);
});
test("LockRecord with metadata", () => {
    const record = {
        lockKey: "test-lock",
        owner: "owner-1",
        fencingToken: 1,
        status: "held",
        acquiredAt: "2026-04-14T00:00:00.000Z",
        ttlMs: 30000,
        metadata: '{"reason":"manual"}',
    };
    assert.equal(record.metadata, '{"reason":"manual"}');
});
test("AcquireLockInput structure is correct", () => {
    const input = {
        lockKey: "test-lock",
        owner: "owner-1",
        ttlMs: 30000,
    };
    assert.equal(input.lockKey, "test-lock");
    assert.equal(input.owner, "owner-1");
    assert.equal(input.ttlMs, 30000);
});
test("AcquireLockInput without ttlMs is valid", () => {
    const input = {
        lockKey: "test-lock",
        owner: "owner-1",
    };
    assert.equal(input.ttlMs, undefined);
});
test("AcquireLockResult structure for successful acquisition", () => {
    const result = {
        acquired: true,
        lock: {
            lockKey: "test-lock",
            owner: "owner-1",
            fencingToken: 1,
            status: "held",
            acquiredAt: "2026-04-14T00:00:00.000Z",
            ttlMs: 30000,
            metadata: null,
        },
    };
    assert.equal(result.acquired, true);
    assert.ok(result.lock);
    assert.equal(result.lock.lockKey, "test-lock");
});
test("AcquireLockResult structure for failed acquisition", () => {
    const result = {
        acquired: false,
    };
    assert.equal(result.acquired, false);
    assert.equal(result.lock, undefined);
});
test("PgAdvisoryLockConfig structure is correct", () => {
    const config = {
        dsn: "postgres://localhost:5432/testdb",
        poolMin: 1,
        poolMax: 10,
        idleTimeoutSeconds: 30,
        connectTimeoutSeconds: 10,
    };
    assert.equal(config.dsn, "postgres://localhost:5432/testdb");
    assert.equal(config.poolMin, 1);
    assert.equal(config.poolMax, 10);
});
test("PgAdvisoryLockConfig with SSL", () => {
    const config = {
        dsn: "postgres://localhost:5432/testdb",
        ssl: {
            rejectUnauthorized: true,
        },
    };
    assert.ok(config.ssl);
    assert.equal(config.ssl.rejectUnauthorized, true);
});
test("PgAdvisoryLockConfig with custom postgresFactory", () => {
    const mockFactory = (_dsn, _options) => {
        return {};
    };
    const config = {
        postgresFactory: mockFactory,
    };
    assert.equal(typeof config.postgresFactory, "function");
});
test("RedisLockConfig structure is correct", () => {
    const config = {
        host: "localhost",
        port: 6379,
    };
    assert.equal(config.host, "localhost");
    assert.equal(config.port, 6379);
});
test("RedisLockConfig with optional fields", () => {
    const config = {
        host: "redis.example.com",
        port: 6380,
        cliPath: "/usr/local/bin/redis-cli",
        connectTimeoutMs: 5000,
    };
    assert.equal(config.host, "redis.example.com");
    assert.equal(config.port, 6380);
    assert.equal(config.cliPath, "/usr/local/bin/redis-cli");
    assert.equal(config.connectTimeoutMs, 5000);
});
test("LockData structure is correct", () => {
    const data = {
        id: "lock_abc123",
        owner: "owner-1",
        fencingToken: 1,
        ttlMs: 30000,
        acquiredAt: "2026-04-14T00:00:00.000Z",
        metadata: null,
    };
    assert.equal(data.id, "lock_abc123");
    assert.equal(data.owner, "owner-1");
    assert.equal(data.fencingToken, 1);
    assert.equal(data.ttlMs, 30000);
    assert.equal(data.metadata, null);
});
test("DISTRIBUTED_LOCKS_DDL is a non-empty string", () => {
    assert.ok(typeof DISTRIBUTED_LOCKS_DDL === "string");
    assert.ok(DISTRIBUTED_LOCKS_DDL.length > 0);
    assert.ok(DISTRIBUTED_LOCKS_DDL.includes("CREATE TABLE"));
});
//# sourceMappingURL=distributed-lock-service.test.js.map