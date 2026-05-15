import assert from "node:assert/strict";
import test from "node:test";

import { SqliteLockAdapter } from "../../../../src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.js";
import { PgAdvisoryLockAdapter } from "../../../../src/platform/five-plane-execution/distributed-lock/pg-advisory-lock-adapter.js";
import { RedisLockAdapter } from "../../../../src/platform/five-plane-execution/distributed-lock/redis-lock-adapter.js";
import { createLockAdapter } from "../../../../src/platform/five-plane-execution/distributed-lock/distributed-lock-factory.js";
import type { DistributedLockAdapter } from "../../../../src/platform/five-plane-execution/distributed-lock/distributed-lock-types.js";

// Re-export the types to verify they are exported correctly
import type {
  DistributedLockAdapter as ExportedLockAdapter,
  LockBackendKind,
  LockRecord,
  AcquireLockInput,
  AcquireLockResult,
  PgAdvisoryLockConfig,
  RedisLockConfig,
} from "../../../../src/platform/five-plane-execution/distributed-lock/distributed-lock-types.js";

import { lockLogger, defaultPostgresFactory, inferPgSslFromDsn } from "../../../../src/platform/five-plane-execution/distributed-lock/locking-support.js";

// Verify all expected exports are available
test("distributed-lock index exports SqliteLockAdapter", () => {
  assert.ok(typeof SqliteLockAdapter === "function");
});

test("distributed-lock index exports PgAdvisoryLockAdapter", () => {
  assert.ok(typeof PgAdvisoryLockAdapter === "function");
});

test("distributed-lock index exports RedisLockAdapter", () => {
  assert.ok(typeof RedisLockAdapter === "function");
});

test("distributed-lock index exports createLockAdapter factory", () => {
  assert.ok(typeof createLockAdapter === "function");
});

test("distributed-lock index exports lockLogger", () => {
  assert.ok(lockLogger !== undefined);
  assert.equal(typeof lockLogger.log, "function");
});

test("distributed-lock index exports defaultPostgresFactory", () => {
  assert.ok(typeof defaultPostgresFactory === "function");
});

test("distributed-lock index exports inferPgSslFromDsn", () => {
  assert.ok(typeof inferPgSslFromDsn === "function");
});

// Type exports verification
test("DistributedLockAdapter type is exported and usable", () => {
  const mockAdapter: ExportedLockAdapter = {
    backendKind: "test",
    acquire: () => ({ acquired: false }),
    release: () => false,
    extend: () => null,
    forceSteal: () => ({ lockKey: "", owner: "", fencingToken: 0, status: "" }),
    inspect: () => null,
  };
  assert.equal(mockAdapter.backendKind, "test");
});

test("LockBackendKind type is exported correctly", () => {
  const kinds: LockBackendKind[] = ["sqlite", "pg_advisory", "redis"];
  assert.equal(kinds.length, 3);
});

test("LockRecord type is exported correctly", () => {
  const record: LockRecord = {
    lockKey: "test",
    owner: "owner",
    fencingToken: 1,
    status: "held",
    acquiredAt: new Date().toISOString(),
    ttlMs: 30000,
    metadata: null,
  };
  assert.ok(record.lockKey === "test");
});

test("AcquireLockInput type is exported correctly", () => {
  const input: AcquireLockInput = {
    lockKey: "test",
    owner: "owner",
    ttlMs: 30000,
  };
  assert.equal(input.lockKey, "test");
  assert.equal(input.ttlMs, 30000);
});

test("AcquireLockResult type is exported correctly", () => {
  const result: AcquireLockResult = {
    acquired: true,
    lock: {
      lockKey: "test",
      owner: "owner",
      fencingToken: 1,
      status: "held",
      acquiredAt: new Date().toISOString(),
      ttlMs: 30000,
      metadata: null,
    },
  };
  assert.equal(result.acquired, true);
  assert.ok(result.lock !== undefined);
});

test("PgAdvisoryLockConfig type is exported and usable", () => {
  const config: PgAdvisoryLockConfig = {
    dsn: "postgresql://localhost/db",
    poolMin: 1,
    poolMax: 5,
    ssl: false,
  };
  assert.equal(config.dsn, "postgresql://localhost/db");
});

test("RedisLockConfig type is exported and usable", () => {
  const config: RedisLockConfig = {
    host: "localhost",
    port: 6379,
    connectTimeoutMs: 5000,
  };
  assert.equal(config.host, "localhost");
});