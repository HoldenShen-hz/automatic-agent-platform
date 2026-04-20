import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import {
  SqliteQueueAdapter,
  RedisQueueAdapter,
  createQueueAdapter,
  QUEUE_JOBS_DDL,
} from "../../../../src/platform/execution/queue/queue-adapter.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "queue-boundary.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  db.connection.exec(QUEUE_JOBS_DDL);
  return { workspace, db };
}

test("queue adapter rejects payload containing SQL injection patterns without crashing", () => {
  const h = createHarness("aa-queue-sqli-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    // SQL injection attempt in payload — should be safely stored as JSON string
    const job = adapter.enqueue({
      queueName: "q",
      payload: "'; DROP TABLE queue_jobs; --",
    });
    assert.equal(job.status, "waiting");
    const retrieved = adapter.getJob(job.id);
    assert.ok(retrieved);
    assert.equal(JSON.parse(retrieved.payload), "'; DROP TABLE queue_jobs; --");
    // Table still intact
    const stats = adapter.stats("q");
    assert.equal(stats.waiting, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("queue adapter handles extremely large payloads without overflow", () => {
  const h = createHarness("aa-queue-large-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const largePayload = { data: "x".repeat(100_000) };
    const job = adapter.enqueue({ queueName: "q", payload: largePayload });
    assert.equal(job.status, "waiting");
    const retrieved = adapter.getJob(job.id);
    assert.ok(retrieved);
    const parsed = JSON.parse(retrieved.payload);
    assert.equal(parsed.data.length, 100_000);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("queue adapter idempotency key prevents cross-queue collision", () => {
  const h = createHarness("aa-queue-crossq-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    // Same idempotency key in different queues should produce different jobs
    const j1 = adapter.enqueue({ queueName: "alpha", payload: "a", idempotencyKey: "key-1" });
    const j2 = adapter.enqueue({ queueName: "beta", payload: "b", idempotencyKey: "key-1" });
    assert.notEqual(j1.id, j2.id);
    assert.equal(j1.queueName, "alpha");
    assert.equal(j2.queueName, "beta");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("queue adapter nack does not lose job even with null error", () => {
  const h = createHarness("aa-queue-nack-null-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    adapter.enqueue({ queueName: "q", payload: "x", maxAttempts: 3 });
    const r = adapter.dequeue("q");
    assert.ok(r);
    r.nack(); // no error string
    const job = adapter.getJob(r.job.id);
    assert.equal(job?.status, "waiting");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("queue adapter concurrent dequeue from same queue does not double-deliver", () => {
  const h = createHarness("aa-queue-concur-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    adapter.enqueue({ queueName: "q", payload: "only-one" });

    const r1 = adapter.dequeue("q");
    assert.ok(r1);
    // Second dequeue should return null since job is active
    const r2 = adapter.dequeue("q");
    assert.equal(r2, null);

    r1.ack();
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("queue adapter purge with past cutoff does not remove recent jobs", () => {
  const h = createHarness("aa-queue-purge-safe-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const job = adapter.enqueue({ queueName: "q", payload: "recent" });
    const r = adapter.dequeue("q");
    r!.ack();

    // Purge with a past cutoff — should not remove recently completed job
    const pastCutoff = new Date(Date.now() - 3_600_000).toISOString();
    const purged = adapter.purge("q", pastCutoff);
    assert.equal(purged, 0);
    assert.ok(adapter.getJob(job.id));
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

// Redis Queue Adapter Security Boundary Tests

test("redis queue adapter enqueue works with JSON payload", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  // enqueue is fire-and-forget, should return a job record
  const job = adapter.enqueue({
    queueName: "test-security",
    payload: { cmd: "'; DROP TABLE--", nested: { arr: [1, 2, 3] } },
  });
  assert.equal(job.queueName, "test-security");
  assert.equal(job.status, "waiting");
  assert.equal(job.priority, 0);
  assert.ok(job.id.startsWith("qjob_"));
});

test("redis queue adapter enqueue handles large priority values", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const job = adapter.enqueue({
    queueName: "q",
    payload: "test",
    priority: Number.MAX_SAFE_INTEGER,
  });
  assert.equal(job.priority, Number.MAX_SAFE_INTEGER);
});

test("redis queue adapter sync methods throw descriptive security errors", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });

  // All sync methods should throw with proper error codes
  assert.throws(() => adapter.dequeue("q"), /sync_dequeue_not_supported/);
  assert.throws(() => adapter.getJob("x"), /sync_getJob_not_supported/);
  assert.throws(() => adapter.listJobs("q"), /sync_listJobs_not_supported/);
  assert.throws(() => adapter.moveToDeadLetter("x", "r"), /sync_moveToDeadLetter_not_supported/);
  assert.throws(() => adapter.retryJob("x"), /sync_retryJob_not_supported/);
  assert.throws(() => adapter.purge("q", "2026-01-01"), /sync_purge_not_supported/);
  assert.throws(() => adapter.stats("q"), /sync_stats_not_supported/);
  assert.throws(() => adapter.listQueues(), /sync_listQueues_not_supported/);
});

test("redis queue adapter backend kind is correctly reported", () => {
  const redisAdapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  assert.equal(redisAdapter.backendKind, "redis");

  const h = createHarness("aa-queue-factory-");
  try {
    const sqliteAdapter = createQueueAdapter({ kind: "sqlite" }, h.db);
    assert.equal(sqliteAdapter.backendKind, "sqlite");

    const redisViaFactory = createQueueAdapter({ kind: "redis", redis: { host: "localhost", port: 6379 } });
    assert.equal(redisViaFactory.backendKind, "redis");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("redis queue adapter createQueueAdapter fails with missing config", () => {
  const h = createHarness("aa-queue-factory-");
  try {
    assert.throws(() => createQueueAdapter({ kind: "sqlite" }), /missing_sqlite_db/);
    assert.throws(() => createQueueAdapter({ kind: "redis" }), /missing_redis_config/);
    // Note: Factory only checks for missing redis config object, not invalid host/port values
    // Invalid connection params will fail at runtime when connecting
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
