import assert from "node:assert/strict";
import test from "node:test";

import * as queueIndex from "../../../../../src/platform/execution/queue/index.js";
import * as queueSurface from "../../../../../src/platform/execution/queue/queue-adapter.js";
import { createQueueAdapter } from "../../../../../src/platform/execution/queue/queue-adapter-factory.js";
import { RedisQueueAdapter } from "../../../../../src/platform/execution/queue/redis-queue-adapter.js";
import { SqliteQueueAdapter } from "../../../../../src/platform/execution/queue/sqlite-queue-adapter.js";

test("queue barrel files re-export the runtime adapter surface", () => {
  assert.equal(queueIndex.createQueueAdapter, createQueueAdapter);
  assert.equal(queueIndex.RedisQueueAdapter, RedisQueueAdapter);
  assert.equal(queueIndex.SqliteQueueAdapter, SqliteQueueAdapter);
  assert.equal(queueSurface.createQueueAdapter, createQueueAdapter);
  assert.equal(queueSurface.RedisQueueAdapter, RedisQueueAdapter);
  assert.equal(queueSurface.SqliteQueueAdapter, SqliteQueueAdapter);
});

test("queue index barrel re-exports queue adapter", () => {
  assert.ok(typeof queueIndex.createQueueAdapter === "function");
});

test("createQueueAdapter throws for unknown kind", () => {
  assert.throws(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => createQueueAdapter({ kind: "unknown" } as any),
    /queue\.missing_sqlite_db|Unknown/,
  );
});
