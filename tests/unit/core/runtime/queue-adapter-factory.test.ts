/**
 * Unit Tests: Queue Adapter Factory
 *
 * Tests for createQueueAdapter factory function.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { createQueueAdapter } from "../../../../src/core/runtime/queue-adapter.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";

test("createQueueAdapter throws for redis kind without config", () => {
  try {
    createQueueAdapter({ kind: "redis" });
    assert.fail("Expected ValidationError");
  } catch (error: unknown) {
    assert.ok(error instanceof ValidationError, "Expected ValidationError");
    assert.ok((error as ValidationError).code.includes("queue.missing_redis_config"));
  }
});

test("createQueueAdapter throws for sqlite kind without db", () => {
  try {
    createQueueAdapter({ kind: "sqlite" });
    assert.fail("Expected ValidationError");
  } catch (error: unknown) {
    assert.ok(error instanceof ValidationError, "Expected ValidationError");
    assert.ok((error as ValidationError).code.includes("queue.missing_sqlite_db"));
  }
});

test("createQueueAdapter creates adapter with valid redis config", () => {
  const adapter = createQueueAdapter({
    kind: "redis",
    redis: {
      host: "localhost",
      port: 6379,
    },
  });
  assert.equal(adapter.backendKind, "redis");
});

test("createQueueAdapter accepts redis config with all options", () => {
  const adapter = createQueueAdapter({
    kind: "redis",
    redis: {
      host: "redis.example.com",
      port: 6380,
      password: "secret_password",
      db: 1,
      prefix: "queue:",
      tls: true,
    },
  });
  assert.equal(adapter.backendKind, "redis");
});

test("createQueueAdapter accepts redis config with minimal options", () => {
  const adapter = createQueueAdapter({
    kind: "redis",
    redis: {
      host: "localhost",
      port: 6379,
    },
  });
  assert.equal(adapter.backendKind, "redis");
});

test("createQueueAdapter creates sqlite adapter when database is provided", () => {
  const db = new SqliteDatabase(":memory:");
  try {
    const adapter = createQueueAdapter({ kind: "sqlite" }, db);
    assert.equal(adapter.backendKind, "sqlite");
  } finally {
    db.close();
  }
});

test("createQueueAdapter redis config with connection timeout", () => {
  const adapter = createQueueAdapter({
    kind: "redis",
    redis: {
      host: "localhost",
      port: 6379,
      connectTimeout: 5000,
    },
  });
  assert.equal(adapter.backendKind, "redis");
});

test("createQueueAdapter redis config with retry strategy", () => {
  const adapter = createQueueAdapter({
    kind: "redis",
    redis: {
      host: "localhost",
      port: 6379,
      maxRetries: 3,
      retryDelayMs: 100,
    },
  });
  assert.equal(adapter.backendKind, "redis");
});

test("createQueueAdapter returns QueueAdapter interface", () => {
  const db = new SqliteDatabase(":memory:");
  try {
    const adapter = createQueueAdapter({ kind: "sqlite" }, db);
    assert.ok(typeof adapter.enqueue === "function", "should have enqueue method");
    assert.ok(typeof adapter.dequeue === "function", "should have dequeue method");
    assert.ok(typeof adapter.getJob === "function", "should have getJob method");
    assert.ok(typeof adapter.listJobs === "function", "should have listJobs method");
    assert.ok(typeof adapter.moveToDeadLetter === "function", "should have moveToDeadLetter method");
    assert.ok(typeof adapter.retryJob === "function", "should have retryJob method");
    assert.ok(typeof adapter.purge === "function", "should have purge method");
    assert.ok(typeof adapter.stats === "function", "should have stats method");
    assert.ok(typeof adapter.listQueues === "function", "should have listQueues method");
  } finally {
    db.close();
  }
});