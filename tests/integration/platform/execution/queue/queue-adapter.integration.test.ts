/**
 * Queue Adapter Integration Tests
 *
 * Tests SqliteQueueAdapter and RedisQueueAdapter with real stores.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SqliteQueueAdapter } from "../../../../../src/platform/execution/queue/sqlite-queue-adapter.js";
import { QUEUE_JOBS_DDL } from "../../../../../src/platform/execution/queue/queue-adapter-types.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

test("SqliteQueueAdapter enqueue creates job record", () => {
  const workspace = createTempWorkspace("aa-queue-adapter-");
  const dbPath = join(workspace, "queue.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.connection.exec(QUEUE_JOBS_DDL);
    const adapter = new SqliteQueueAdapter(db);

    const job = adapter.enqueue({
      queueName: "test-queue",
      payload: { message: "hello" },
    });

    assert.ok(job.id);
    assert.equal(job.queueName, "test-queue");
    assert.equal(job.status, "waiting");
    assert.equal(job.attempts, 0);
    assert.equal(job.priority, 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("SqliteQueueAdapter dequeue returns waiting job", () => {
  const workspace = createTempWorkspace("aa-queue-dequeue-");
  const dbPath = join(workspace, "queue-dequeue.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.connection.exec(QUEUE_JOBS_DDL);
    const adapter = new SqliteQueueAdapter(db);

    adapter.enqueue({ queueName: "dequeue-test", payload: { order: 1 } });
    adapter.enqueue({ queueName: "dequeue-test", payload: { order: 2 } });

    const result = adapter.dequeue("dequeue-test");

    assert.ok(result);
    assert.equal(result.job.status, "active");
    assert.equal(result.job.attempts, 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("SqliteQueueAdapter dequeue ack marks job completed", () => {
  const workspace = createTempWorkspace("aa-queue-ack-");
  const dbPath = join(workspace, "queue-ack.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.connection.exec(QUEUE_JOBS_DDL);
    const adapter = new SqliteQueueAdapter(db);

    adapter.enqueue({ queueName: "ack-test", payload: { done: true } });
    const result = adapter.dequeue("ack-test");

    assert.ok(result);
    result.ack();

    const completed = adapter.getJob(result.job.id);
    assert.equal(completed?.status, "completed");
    assert.ok(completed?.completedAt);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("SqliteQueueAdapter dequeue nack requeues on retry", () => {
  const workspace = createTempWorkspace("aa-queue-nack-");
  const dbPath = join(workspace, "queue-nack.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.connection.exec(QUEUE_JOBS_DDL);
    const adapter = new SqliteQueueAdapter(db);

    const job = adapter.enqueue({
      queueName: "nack-test",
      payload: { fail: true },
      maxAttempts: 3,
    });
    const result = adapter.dequeue("nack-test");

    assert.ok(result);
    result.nack("test error");

    const requeued = adapter.getJob(job.id);
    assert.equal(requeued?.status, "waiting");
    assert.equal(requeued?.attempts, 1);
    assert.equal(requeued?.lastError, "test error");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("SqliteQueueAdapter moveToDeadLetter marks job dead_letter", () => {
  const workspace = createTempWorkspace("aa-queue-dlq-");
  const dbPath = join(workspace, "queue-dlq.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.connection.exec(QUEUE_JOBS_DDL);
    const adapter = new SqliteQueueAdapter(db);

    const job = adapter.enqueue({ queueName: "dlq-test", payload: { dead: true } });
    adapter.moveToDeadLetter(job.id, "max_retries_exceeded");

    const moved = adapter.getJob(job.id);
    assert.equal(moved?.status, "dead_letter");
    assert.equal(moved?.lastError, "max_retries_exceeded");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("SqliteQueueAdapter stats returns correct counts", () => {
  const workspace = createTempWorkspace("aa-queue-stats-");
  const dbPath = join(workspace, "queue-stats.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.connection.exec(QUEUE_JOBS_DDL);
    const adapter = new SqliteQueueAdapter(db);

    adapter.enqueue({ queueName: "stats-test", payload: { a: 1 } });
    adapter.enqueue({ queueName: "stats-test", payload: { b: 2 } });
    adapter.enqueue({ queueName: "stats-test", payload: { c: 3 } });

    const stats = adapter.stats("stats-test");

    assert.equal(stats.waiting, 3);
    assert.equal(stats.active, 0);
    assert.equal(stats.completed, 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("SqliteQueueAdapter listQueues returns all queue names", () => {
  const workspace = createTempWorkspace("aa-queue-list-");
  const dbPath = join(workspace, "queue-list.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.connection.exec(QUEUE_JOBS_DDL);
    const adapter = new SqliteQueueAdapter(db);

    adapter.enqueue({ queueName: "queue-a", payload: {} });
    adapter.enqueue({ queueName: "queue-b", payload: {} });
    adapter.enqueue({ queueName: "queue-c", payload: {} });

    const queues = adapter.listQueues();

    assert.ok(queues.includes("queue-a"));
    assert.ok(queues.includes("queue-b"));
    assert.ok(queues.includes("queue-c"));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("SqliteQueueAdapter retryJob resets failed job", () => {
  const workspace = createTempWorkspace("aa-queue-retry-");
  const dbPath = join(workspace, "queue-retry.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.connection.exec(QUEUE_JOBS_DDL);
    const adapter = new SqliteQueueAdapter(db);

    const job = adapter.enqueue({ queueName: "retry-test", payload: {} });
    const result = adapter.dequeue("retry-test");
    result.nack("failed");

    const retried = adapter.retryJob(job.id);

    assert.ok(retried);
    assert.equal(retried?.status, "waiting");
    assert.equal(retried?.attempts, 0);
    assert.equal(retried?.lastError, null);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("SqliteQueueAdapter with idempotency key returns existing job", () => {
  const workspace = createTempWorkspace("aa-queue-idempotent-");
  const dbPath = join(workspace, "queue-idempotent.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.connection.exec(QUEUE_JOBS_DDL);
    const adapter = new SqliteQueueAdapter(db);

    const first = adapter.enqueue({
      queueName: "idempotent-test",
      payload: { unique: true },
      idempotencyKey: "key-123",
    });

    const second = adapter.enqueue({
      queueName: "idempotent-test",
      payload: { different: true },
      idempotencyKey: "key-123",
    });

    assert.equal(first.id, second.id);
    assert.equal(second.attempts, first.attempts);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("SqliteQueueAdapter with priority orders correctly", () => {
  const workspace = createTempWorkspace("aa-queue-priority-");
  const dbPath = join(workspace, "queue-priority.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.connection.exec(QUEUE_JOBS_DDL);
    const adapter = new SqliteQueueAdapter(db);

    adapter.enqueue({ queueName: "priority-test", payload: { n: 1 }, priority: 1 });
    adapter.enqueue({ queueName: "priority-test", payload: { n: 2 }, priority: 10 });
    adapter.enqueue({ queueName: "priority-test", payload: { n: 3 }, priority: 5 });

    const result = adapter.dequeue("priority-test");

    assert.ok(result);
    const payload = JSON.parse(result.job.payload);
    assert.equal(payload.n, 2);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});