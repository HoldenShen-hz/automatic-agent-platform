import assert from "node:assert/strict";
import test from "node:test";
test("LockBackendKind type accepts valid values", () => {
    const kinds = ["sqlite", "pg_advisory", "redis"];
    assert.equal(kinds.length, 3);
});
test("LockRecord structure is correct", () => {
    const record = {
        lockKey: "resource_lock",
        owner: "worker_123",
        fencingToken: 42,
        status: "held",
        acquiredAt: "2026-04-14T00:00:00.000Z",
        ttlMs: 30000,
        metadata: null,
    };
    assert.equal(record.lockKey, "resource_lock");
    assert.equal(record.owner, "worker_123");
    assert.equal(record.fencingToken, 42);
    assert.equal(record.status, "held");
    assert.equal(record.ttlMs, 30000);
    assert.equal(record.metadata, null);
});
test("LockRecord allows metadata", () => {
    const record = {
        lockKey: "resource_lock",
        owner: "worker_123",
        fencingToken: 42,
        status: "held",
        acquiredAt: "2026-04-14T00:00:00.000Z",
        ttlMs: 30000,
        metadata: '{"priority": "high"}',
    };
    assert.equal(record.metadata, '{"priority": "high"}');
});
test("AcquireLockInput structure is correct", () => {
    const input = {
        lockKey: "task_lock",
        owner: "worker_456",
        ttlMs: 60000,
    };
    assert.equal(input.lockKey, "task_lock");
    assert.equal(input.owner, "worker_456");
    assert.equal(input.ttlMs, 60000);
});
test("AcquireLockInput ttlMs is optional", () => {
    const input = {
        lockKey: "task_lock",
        owner: "worker_456",
    };
    assert.equal(input.ttlMs, undefined);
});
test("AcquireLockResult structure when acquired", () => {
    const result = {
        acquired: true,
        lock: {
            lockKey: "task_lock",
            owner: "worker_456",
            fencingToken: 1,
            status: "held",
            acquiredAt: "2026-04-14T00:00:00.000Z",
            ttlMs: 60000,
            metadata: null,
        },
    };
    assert.equal(result.acquired, true);
    assert.ok(result.lock);
    assert.equal(result.lock.lockKey, "task_lock");
});
test("AcquireLockResult structure when not acquired", () => {
    const result = {
        acquired: false,
    };
    assert.equal(result.acquired, false);
    assert.equal(result.lock, undefined);
});
test("PgAdvisoryLockConfig structure is correct", () => {
    const config = {
        dsn: "postgres://localhost:5432/mydb",
        poolMin: 2,
        poolMax: 10,
        idleTimeoutSeconds: 30,
        connectTimeoutSeconds: 10,
        ssl: { rejectUnauthorized: true },
    };
    assert.equal(config.dsn, "postgres://localhost:5432/mydb");
    assert.equal(config.poolMin, 2);
    assert.equal(config.poolMax, 10);
    assert.deepEqual(config.ssl, { rejectUnauthorized: true });
});
test("PgAdvisoryLockConfig allows ssl false", () => {
    const config = {
        dsn: "postgres://localhost:5432/mydb",
        ssl: false,
    };
    assert.equal(config.ssl, false);
});
test("PgAdvisoryLockConfig env is optional", () => {
    const config = {
        dsn: "postgres://localhost:5432/mydb",
    };
    assert.equal(config.env, undefined);
});
test("RedisLockConfig structure is correct", () => {
    const config = {
        host: "localhost",
        port: 6379,
    };
    assert.equal(config.host, "localhost");
    assert.equal(config.port, 6379);
});
test("RedisLockConfig allows optional fields", () => {
    const config = {
        host: "redis.example.com",
        port: 6380,
        cliPath: "/usr/local/bin/redis-cli",
        connectTimeoutMs: 5000,
    };
    assert.equal(config.cliPath, "/usr/local/bin/redis-cli");
    assert.equal(config.connectTimeoutMs, 5000);
});
test("LockData structure is correct", () => {
    const data = {
        id: "lock_123",
        owner: "worker_789",
        fencingToken: 5,
        ttlMs: 45000,
        acquiredAt: "2026-04-14T00:00:00.000Z",
        metadata: null,
    };
    assert.equal(data.id, "lock_123");
    assert.equal(data.owner, "worker_789");
    assert.equal(data.fencingToken, 5);
    assert.equal(data.ttlMs, 45000);
});
test("LockData allows metadata", () => {
    const data = {
        id: "lock_456",
        owner: "worker_abc",
        fencingToken: 10,
        ttlMs: 60000,
        acquiredAt: "2026-04-14T00:00:00.000Z",
        metadata: '{"mode": "exclusive"}',
    };
    assert.equal(data.metadata, '{"mode": "exclusive"}');
});
//# sourceMappingURL=distributed-lock-types.test.js.map