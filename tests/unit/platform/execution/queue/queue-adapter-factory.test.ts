import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { createQueueAdapter } from "../../../../../src/platform/execution/queue/queue-adapter-factory.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

test("createQueueAdapter throws for redis kind without config", () => {
  try {
    createQueueAdapter({ kind: "redis" });
    assert.fail("Expected ValidationError");
  } catch (error: any) {
    assert.ok(error instanceof ValidationError);
    assert.ok(error.code.includes("queue.missing_redis_config"));
  }
});

test("createQueueAdapter throws for sqlite kind without db", () => {
  try {
    createQueueAdapter({ kind: "sqlite" });
    assert.fail("Expected ValidationError");
  } catch (error: any) {
    assert.ok(error instanceof ValidationError);
    assert.ok(error.code.includes("queue.missing_sqlite_db"));
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
  const workspace = createTempWorkspace("aa-queue-factory-");
  const db = new SqliteDatabase(join(workspace, "queue-factory.db"));
  try {
    const adapter = createQueueAdapter({ kind: "sqlite" }, db);
    assert.equal(adapter.backendKind, "sqlite");
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});
