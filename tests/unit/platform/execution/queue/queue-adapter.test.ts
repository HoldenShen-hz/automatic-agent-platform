import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import {
  SqliteQueueAdapter,
  RedisQueueAdapter,
  createQueueAdapter,
  QUEUE_JOBS_DDL,
} from "../../../../../src/platform/five-plane-execution/queue/queue-adapter.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "queue.db");
  // Use empty migration plan to avoid running all production migrations
  // that have cross-dependencies. We only need the queue_jobs table.
  const db = new SqliteDatabase(dbPath, { migrationPlan: [] });
  db.connection.exec(QUEUE_JOBS_DDL);
  return { workspace, db };
}

test("sqlite queue adapter enqueues and dequeues a job [queue-adapter]", () => {
  const h = createHarness("aa-queue-basic-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const job = adapter.enqueue({ queueName: "tasks", payload: { taskId: "t1" } });
    assert.equal(job.queueName, "tasks");
    assert.equal(job.status, "waiting");
    assert.equal(job.attempts, 0);

    const result = adapter.dequeue("tasks");
    assert.ok(result);
    assert.equal(result.job.id, job.id);
    assert.equal(result.job.status, "active");
    assert.equal(result.job.attempts, 1);

    result.ack();
    const completed = adapter.getJob(job.id);
    assert.equal(completed?.status, "completed");
    assert.ok(completed?.completedAt);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("sqlite queue adapter respects priority ordering [queue-adapter]", () => {
  const h = createHarness("aa-queue-priority-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    adapter.enqueue({ queueName: "q", payload: "low", priority: 1 });
    adapter.enqueue({ queueName: "q", payload: "high", priority: 10 });
    adapter.enqueue({ queueName: "q", payload: "medium", priority: 5 });

    const r1 = adapter.dequeue("q");
    assert.equal(JSON.parse(r1!.job.payload), "high");
    r1!.ack();

    const r2 = adapter.dequeue("q");
    assert.equal(JSON.parse(r2!.job.payload), "medium");
    r2!.ack();

    const r3 = adapter.dequeue("q");
    assert.equal(JSON.parse(r3!.job.payload), "low");
    r3!.ack();

    assert.equal(adapter.dequeue("q"), null);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("sqlite queue adapter handles delayed jobs [queue-adapter]", () => {
  const h = createHarness("aa-queue-delayed-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const futureDate = new Date(Date.now() + 3_600_000).toISOString();
    const pastDate = new Date(Date.now() - 1_000).toISOString();

    adapter.enqueue({ queueName: "q", payload: "future", delayUntil: futureDate });
    adapter.enqueue({ queueName: "q", payload: "ready", delayUntil: pastDate });

    // Only the past-delayed job should be dequeued
    const r1 = adapter.dequeue("q");
    assert.ok(r1);
    assert.equal(JSON.parse(r1.job.payload), "ready");
    r1.ack();

    // Future job is still delayed
    assert.equal(adapter.dequeue("q"), null);
    const stats = adapter.stats("q");
    assert.equal(stats.delayed, 1);
    assert.equal(stats.completed, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("sqlite queue adapter idempotency prevents duplicate enqueue [queue-adapter]", () => {
  const h = createHarness("aa-queue-idempotent-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const j1 = adapter.enqueue({ queueName: "q", payload: "first", idempotencyKey: "key-1" });
    const j2 = adapter.enqueue({ queueName: "q", payload: "duplicate", idempotencyKey: "key-1" });

    assert.equal(j1.id, j2.id);
    assert.equal(adapter.listJobs("q").length, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("sqlite queue adapter nack with max attempts routes to dead letter [queue-adapter]", () => {
  const h = createHarness("aa-queue-deadletter-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    adapter.enqueue({ queueName: "q", payload: "fail-me", maxAttempts: 2 });

    // First attempt — nack
    const r1 = adapter.dequeue("q");
    assert.ok(r1);
    r1.nack("transient_error");

    // Second attempt — nack again → dead letter
    const r2 = adapter.dequeue("q");
    assert.ok(r2);
    r2.nack("still_failing");

    const job = adapter.getJob(r2.job.id);
    assert.equal(job?.status, "dead_letter");
    assert.equal(job?.lastError, "still_failing");

    const stats = adapter.stats("q");
    assert.equal(stats.deadLetter, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("sqlite queue adapter retryJob resets dead-letter job to waiting [queue-adapter]", () => {
  const h = createHarness("aa-queue-retry-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const job = adapter.enqueue({ queueName: "q", payload: "retry-me", maxAttempts: 1 });

    const r1 = adapter.dequeue("q");
    r1!.nack("fail");
    assert.equal(adapter.getJob(job.id)?.status, "dead_letter");

    const retried = adapter.retryJob(job.id);
    assert.equal(retried?.status, "waiting");
    assert.equal(retried?.attempts, 1);

    const r2 = adapter.dequeue("q");
    assert.ok(r2);
    r2.ack();
    assert.equal(adapter.getJob(job.id)?.status, "completed");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("sqlite queue adapter moveToDeadLetter manually [queue-adapter]", () => {
  const h = createHarness("aa-queue-manual-dl-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const job = adapter.enqueue({ queueName: "q", payload: "poison" });
    adapter.moveToDeadLetter(job.id, "poison_message");

    const dl = adapter.getJob(job.id);
    assert.equal(dl?.status, "dead_letter");
    assert.equal(dl?.lastError, "poison_message");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("sqlite queue adapter purge removes old completed and dead-letter jobs [queue-adapter]", () => {
  const h = createHarness("aa-queue-purge-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const job = adapter.enqueue({ queueName: "q", payload: "old" });
    const r = adapter.dequeue("q");
    r!.ack();

    // Purge with a future cutoff
    const future = new Date(Date.now() + 3_600_000).toISOString();
    const purged = adapter.purge("q", future);
    assert.equal(purged, 1);
    assert.equal(adapter.getJob(job.id), null);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("sqlite queue adapter stats returns correct counts [queue-adapter]", () => {
  const h = createHarness("aa-queue-stats-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    adapter.enqueue({ queueName: "q", payload: "a" });
    adapter.enqueue({ queueName: "q", payload: "b" });
    const r = adapter.dequeue("q");
    r!.ack();

    const stats = adapter.stats("q");
    assert.equal(stats.waiting, 1);
    assert.equal(stats.completed, 1);
    assert.equal(stats.queueName, "q");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("sqlite queue adapter listQueues returns distinct queue names [queue-adapter]", () => {
  const h = createHarness("aa-queue-listq-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    adapter.enqueue({ queueName: "alpha", payload: 1 });
    adapter.enqueue({ queueName: "beta", payload: 2 });
    adapter.enqueue({ queueName: "alpha", payload: 3 });

    const queues = adapter.listQueues();
    assert.deepEqual(queues, ["alpha", "beta"]);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("sqlite queue adapter dequeue returns null for empty queue [queue-adapter]", () => {
  const h = createHarness("aa-queue-empty-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    assert.equal(adapter.dequeue("nonexistent"), null);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("redis queue adapter sync methods throw not-supported errors [queue-adapter]", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  assert.equal(adapter.backendKind, "redis");

  // enqueue works (fire-and-forget) - it doesn't throw
  const job = adapter.enqueue({ queueName: "q", payload: { test: true } });
  assert.ok(job);
  assert.equal(job.queueName, "q");

  // Sync methods throw not-supported errors
  assert.throws(() => adapter.dequeue("q"), /sync_dequeue_not_supported/);
  assert.throws(() => adapter.getJob("x"), /sync_getJob_not_supported/);
  assert.throws(() => adapter.listJobs("q"), /sync_listJobs_not_supported/);
  assert.throws(() => adapter.moveToDeadLetter("x", "r"), /sync_moveToDeadLetter_not_supported/);
  assert.throws(() => adapter.retryJob("x"), /sync_retryJob_not_supported/);
  assert.throws(() => adapter.purge("q", "2026-01-01"), /sync_purge_not_supported/);
  assert.throws(() => adapter.stats("q"), /sync_stats_not_supported/);
  assert.throws(() => adapter.listQueues(), /sync_listQueues_not_supported/);
});

test("createQueueAdapter factory returns correct backend [queue-adapter]", () => {
  const h = createHarness("aa-queue-factory-");
  try {
    const sqliteAdapter = createQueueAdapter({ kind: "sqlite" }, h.db);
    assert.equal(sqliteAdapter.backendKind, "sqlite");

    const redisAdapter = createQueueAdapter({ kind: "redis", redis: { host: "localhost", port: 6379 } });
    assert.equal(redisAdapter.backendKind, "redis");

    assert.throws(() => createQueueAdapter({ kind: "redis" }), /missing_redis_config/);
    assert.throws(() => createQueueAdapter({ kind: "sqlite" }), /missing_sqlite_db/);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("sqlite queue adapter listJobs filters by status [queue-adapter]", () => {
  const h = createHarness("aa-queue-listjobs-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    adapter.enqueue({ queueName: "q", payload: "a" });
    adapter.enqueue({ queueName: "q", payload: "b" });
    const r = adapter.dequeue("q");
    r!.ack();

    const waiting = adapter.listJobs("q", "waiting");
    assert.equal(waiting.length, 1);
    const completed = adapter.listJobs("q", "completed");
    assert.equal(completed.length, 1);
    const all = adapter.listJobs("q");
    assert.equal(all.length, 2);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
