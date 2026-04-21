import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createLockAdapter } from "../../../../../src/platform/execution/distributed-lock/distributed-lock-factory.js";
import { DISTRIBUTED_LOCKS_DDL } from "../../../../../src/platform/execution/distributed-lock/distributed-lock-types.js";
test("createLockAdapter creates PostgreSQL advisory lock adapter", () => {
    const adapter = createLockAdapter("pg_advisory");
    assert.ok(adapter !== undefined);
    assert.equal(adapter.constructor.name, "PgAdvisoryLockAdapter");
});
test("createLockAdapter creates Redis lock adapter", () => {
    const adapter = createLockAdapter("redis");
    assert.ok(adapter !== undefined);
    assert.equal(adapter.constructor.name, "RedisLockAdapter");
});
test("createLockAdapter throws for unsupported backend", () => {
    assert.throws(() => createLockAdapter("unknown"), (error) => {
        // Error code is prefixed with E# format
        return error.code?.includes("lock.backend_not_supported");
    });
});
test("createLockAdapter error message includes the unsupported backend", () => {
    assert.throws(() => createLockAdapter("mysql"), (error) => {
        return error.message.includes("mysql");
    });
});
test("createLockAdapter throws for sqlite when db is not provided", () => {
    assert.throws(() => createLockAdapter("sqlite"), (error) => {
        return error.code?.includes("lock.sqlite_adapter_requires_db");
    });
});
test("createLockAdapter creates SQLite lock adapter with db", () => {
    const db = new DatabaseSync(":memory:");
    db.exec(DISTRIBUTED_LOCKS_DDL);
    const adapter = createLockAdapter("sqlite", db);
    assert.ok(adapter !== undefined);
    assert.equal(adapter.constructor.name, "SqliteLockAdapter");
    assert.equal(adapter.backendKind, "sqlite");
});
//# sourceMappingURL=distributed-lock-factory.test.js.map