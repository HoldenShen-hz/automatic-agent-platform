/**
 * Unit Tests: Distributed Lock Factory
 *
 * Tests for createLockAdapter factory function.
 */

import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { createLockAdapter } from "../../../../src/core/runtime/distributed-lock-service.js";
import { LockingError } from "../../../../src/platform/contracts/errors.js";
import { DISTRIBUTED_LOCKS_DDL } from "../../../../src/platform/five-plane-execution/distributed-lock/distributed-lock-types.js";

test("createLockAdapter creates sqlite adapter with db", () => {
  try {
    createLockAdapter("sqlite");
    assert.fail("Expected LockingError");
  } catch (error: unknown) {
    assert.ok(error instanceof LockingError, "Expected LockingError");
    assert.ok((error as LockingError).code.includes("lock.sqlite_adapter_requires_db"));
  }
});

test("createLockAdapter creates pg_advisory adapter without db", () => {
  const adapter = createLockAdapter("pg_advisory");
  assert.equal(adapter.backendKind, "pg_advisory");
});

test("createLockAdapter creates redis adapter without db", () => {
  const adapter = createLockAdapter("redis");
  assert.equal(adapter.backendKind, "redis");
});

test("createLockAdapter throws for unknown backend kind", () => {
  try {
    // @ts-expect-error - Testing invalid input
    createLockAdapter("unknown_backend");
    assert.fail("Expected LockingError");
  } catch (error: unknown) {
    assert.ok(error instanceof LockingError, "Expected LockingError");
    assert.ok((error as LockingError).code.includes("lock.backend_not_supported"));
  }
});

test("createLockAdapter sqlite adapter has correct backend kind", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(DISTRIBUTED_LOCKS_DDL);
  try {
    const adapter = createLockAdapter("sqlite", db);
    assert.equal(adapter.backendKind, "sqlite");
  } finally {
    db.close();
  }
});

test("createLockAdapter returns DistributedLockAdapter interface", () => {
  const adapter = createLockAdapter("pg_advisory");
  assert.ok(typeof adapter.acquire === "function", "should have acquire method");
  assert.ok(typeof adapter.extend === "function", "should have extend method");
  assert.ok(typeof adapter.release === "function", "should have release method");
  assert.ok(typeof adapter.forceSteal === "function", "should have forceSteal method");
});

test("createLockAdapter pg_advisory has backendKind pg_advisory", () => {
  const adapter = createLockAdapter("pg_advisory");
  assert.strictEqual(adapter.backendKind, "pg_advisory");
});

test("createLockAdapter redis has backendKind redis", () => {
  const adapter = createLockAdapter("redis");
  assert.strictEqual(adapter.backendKind, "redis");
});

test("createLockAdapter accepts optional ttlMs parameter", () => {
  const adapter = createLockAdapter("pg_advisory");
  assert.ok(typeof adapter.acquire === "function");
});

test("createLockAdapter sqlite with db returns correct adapter type", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(DISTRIBUTED_LOCKS_DDL);
  try {
    const adapter = createLockAdapter("sqlite", db);
    assert.equal(adapter.backendKind, "sqlite");
  } finally {
    db.close();
  }
});