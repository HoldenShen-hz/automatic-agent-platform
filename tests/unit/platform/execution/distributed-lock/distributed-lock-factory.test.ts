import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import { createLockAdapter } from "../../../../../src/platform/five-plane-execution/distributed-lock/distributed-lock-factory.js";
import { DISTRIBUTED_LOCKS_DDL } from "../../../../../src/platform/five-plane-execution/distributed-lock/distributed-lock-types.js";

test("createLockAdapter creates PostgreSQL advisory lock adapter [distributed-lock-factory]", () => {
  const adapter = createLockAdapter("pg_advisory");

  assert.ok(adapter !== undefined);
  assert.equal((adapter as any).constructor.name, "PgAdvisoryLockAdapter");
});

test("createLockAdapter creates Redis lock adapter [distributed-lock-factory]", () => {
  const adapter = createLockAdapter("redis");

  assert.ok(adapter !== undefined);
  assert.equal((adapter as any).constructor.name, "RedisLockAdapter");
});

test("createLockAdapter throws for unsupported backend [distributed-lock-factory]", () => {
  assert.throws(
    () => createLockAdapter("unknown" as any),
    (error: any) => {
      // Error code is prefixed with E# format
      return error.code?.includes("lock.backend_not_supported");
    },
  );
});

test("createLockAdapter error message includes the unsupported backend [distributed-lock-factory]", () => {
  assert.throws(
    () => createLockAdapter("mysql" as any),
    (error: any) => {
      return error.message.includes("mysql");
    },
  );
});

test("createLockAdapter throws for sqlite when db is not provided [distributed-lock-factory]", () => {
  assert.throws(
    () => createLockAdapter("sqlite"),
    (error: any) => {
      return error.code?.includes("lock.sqlite_adapter_requires_db");
    },
  );
});

test("createLockAdapter creates SQLite lock adapter with db [distributed-lock-factory]", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(DISTRIBUTED_LOCKS_DDL);

  const adapter = createLockAdapter("sqlite", db);

  assert.ok(adapter !== undefined);
  assert.equal((adapter as any).constructor.name, "SqliteLockAdapter");
  assert.equal(adapter.backendKind, "sqlite");
});
