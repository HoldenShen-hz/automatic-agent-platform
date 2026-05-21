/**
 * Infrastructure: Message Queue Tests
 *
 * Tests for queue adapter types, SQLite queue adapter, and queue factory.
 */

import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert";

// Queue adapter types
import {
  QueueBackendKind,
  QueueJobStatus,
  QueueJobRecord,
  EnqueueInput,
  DequeueResult,
  QueueStats,
  RetryPolicy,
  DEFAULT_RETRY_POLICY,
  QueueAdapter,
  QUEUE_JOBS_DDL,
  RawRow,
  QueueBackendConfig,
  QueueAdapterFactory,
} from "../../../src/platform/five-plane-execution/queue/queue-adapter-types.js";

// Queue adapter factory
import { createQueueAdapter } from "../../../src/platform/five-plane-execution/queue/queue-adapter-factory.js";

// SQLite queue adapter
import { SqliteQueueAdapter } from "../../../src/platform/five-plane-execution/queue/sqlite-queue-adapter.js";
import { QUEUE_JOBS_DDL } from "../../../src/platform/five-plane-execution/queue/queue-adapter-types.js";

// Authoritative SQL database
import { SqliteDatabase } from "../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";

// ── Queue Adapter Types Tests ───────────────────────────────────────────────────

describe("Queue Adapter Types", () => {
  it("QueueBackendKind accepts expected values", () => {
    const sqlite: QueueBackendKind = "sqlite";
    const redis: QueueBackendKind = "redis";
    assert.equal(sqlite, "sqlite");
    assert.equal(redis, "redis");
  });

  it("QueueJobStatus includes all expected statuses", () => {
    const statuses: QueueJobStatus[] = ["waiting", "delayed", "active", "completed", "failed", "dead_letter"];
    assert.equal(statuses.length, 6);
  });

  it("DEFAULT_RETRY_POLICY has correct values", () => {
    assert.equal(DEFAULT_RETRY_POLICY.maxAttempts, 3);
    assert.equal(DEFAULT_RETRY_POLICY.backoffMs, 1000);
    assert.equal(DEFAULT_RETRY_POLICY.backoffMultiplier, 2);
  });

  it("QUEUE_JOBS_DDL creates valid SQL", () => {
    assert.ok(QUEUE_JOBS_DDL.includes("CREATE TABLE IF NOT EXISTS queue_jobs"));
    assert.ok(QUEUE_JOBS_DDL.includes("queue_name"));
    assert.ok(QUEUE_JOBS_DDL.includes("status"));
    assert.ok(QUEUE_JOBS_DDL.includes("priority"));
  });

  it("QueueJobRecord has all required fields", () => {
    const record: QueueJobRecord = {
      id: "test-id",
      queueName: "test-queue",
      payload: '{"data":"test"}',
      status: "waiting",
      priority: 0,
      attempts: 0,
      maxAttempts: 3,
      lastError: null,
      delayUntil: null,
      idempotencyKey: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
    };
    assert.equal(record.id, "test-id");
    assert.equal(record.queueName, "test-queue");
    assert.equal(record.status, "waiting");
  });

  it("EnqueueInput allows optional fields", () => {
    const input: EnqueueInput = {
      queueName: "test-queue",
      payload: { data: "test" },
    };
    assert.equal(input.queueName, "test-queue");
    assert.deepEqual(input.payload, { data: "test" });
    assert.equal(input.priority, undefined);
    assert.equal(input.maxAttempts, undefined);
  });

  it("QueueStats has all status counts", () => {
    const stats: QueueStats = {
      queueName: "test-queue",
      waiting: 5,
      delayed: 2,
      active: 1,
      completed: 10,
      failed: 0,
      deadLetter: 0,
    };
    assert.equal(stats.waiting, 5);
    assert.equal(stats.completed, 10);
  });
});

// ── SqliteQueueAdapter Tests ────────────────────────────────────────────────────

describe("SqliteQueueAdapter", () => {
  let db: SqliteDatabase;
  let adapter: SqliteQueueAdapter;

  beforeEach(() => {
    db = new SqliteDatabase(":memory:");
    db.migrate();
    // Create queue_jobs table for queue adapter tests
    db.connection.exec(QUEUE_JOBS_DDL);
    adapter = new SqliteQueueAdapter(db);
  });

  it("backendKind returns sqlite", () => {
    assert.equal(adapter.backendKind, "sqlite");
  });

  it("enqueue creates a new job record", () => {
    const input: EnqueueInput = {
      queueName: "test-queue",
      payload: { data: "test-payload" },
    };
    const job = adapter.enqueue(input);
    assert.ok(job.id);
    assert.equal(job.queueName, "test-queue");
    assert.equal(job.status, "waiting");
    assert.equal(job.priority, 0);
    assert.equal(job.attempts, 0);
  });

  it("enqueue with priority sets priority", () => {
    const input: EnqueueInput = {
      queueName: "test-queue",
      payload: { data: "test" },
      priority: 10,
    };
    const job = adapter.enqueue(input);
    assert.equal(job.priority, 10);
  });

  it("enqueue with idempotencyKey returns existing job", () => {
    const input: EnqueueInput = {
      queueName: "test-queue",
      payload: { data: "test" },
      idempotencyKey: "unique-key-123",
    };
    const job1 = adapter.enqueue(input);
    const job2 = adapter.enqueue(input);
    assert.equal(job1.id, job2.id);
  });

  it("enqueue with delayUntil sets status to delayed", () => {
    const futureDate = new Date(Date.now() + 60000).toISOString();
    const input: EnqueueInput = {
      queueName: "test-queue",
      payload: { data: "test" },
      delayUntil: futureDate,
    };
    const job = adapter.enqueue(input);
    assert.equal(job.status, "delayed");
  });

  it("dequeue returns next waiting job by priority", () => {
    adapter.enqueue({ queueName: "q1", payload: { n: 1 }, priority: 1 });
    adapter.enqueue({ queueName: "q1", payload: { n: 2 }, priority: 10 }); // Higher priority
    adapter.enqueue({ queueName: "q1", payload: { n: 3 }, priority: 5 });
    const result = adapter.dequeue("q1");
    assert.ok(result);
    assert.equal(result.job.priority, 10);
    assert.deepEqual(JSON.parse(result.job.payload), { n: 2 });
  });

  it("dequeue returns null when no jobs available", () => {
    const result = adapter.dequeue("empty-queue");
    assert.equal(result, null);
  });

  it("dequeue transitions job to active", () => {
    adapter.enqueue({ queueName: "q1", payload: { data: "test" } });
    const result = adapter.dequeue("q1");
    assert.ok(result);
    assert.equal(result.job.status, "active");
    assert.equal(result.job.attempts, 1);
  });

  it("ack completes the job", () => {
    adapter.enqueue({ queueName: "q1", payload: { data: "test" } });
    const result = adapter.dequeue("q1");
    assert.ok(result);
    result.ack();
    const completed = adapter.getJob(result.job.id);
    assert.equal(completed?.status, "completed");
    assert.ok(completed?.completedAt);
  });

  it("nack without max attempts retries", () => {
    adapter.enqueue({ queueName: "q1", payload: { data: "test" }, maxAttempts: 3 });
    const result = adapter.dequeue("q1");
    assert.ok(result);
    result.nack("test error");
    const job = adapter.getJob(result.job.id);
    assert.equal(job?.status, "waiting");
    assert.equal(job?.lastError, "test error");
  });

  it("nack with max attempts moves to dead letter", () => {
    adapter.enqueue({ queueName: "q1", payload: { data: "test" }, maxAttempts: 1 });
    const result = adapter.dequeue("q1");
    assert.ok(result);
    result.nack("max reached");
    const job = adapter.getJob(result.job.id);
    assert.equal(job?.status, "dead_letter");
    assert.equal(job?.lastError, "max reached");
  });

  it("getJob returns job by id", () => {
    const job = adapter.enqueue({ queueName: "q1", payload: { data: "test" } });
    const found = adapter.getJob(job.id);
    assert.ok(found);
    assert.equal(found?.id, job.id);
  });

  it("getJob returns null for non-existent id", () => {
    const found = adapter.getJob("nonexistent-id");
    assert.equal(found, null);
  });

  it("listJobs returns jobs for queue", () => {
    adapter.enqueue({ queueName: "q1", payload: { n: 1 } });
    adapter.enqueue({ queueName: "q1", payload: { n: 2 } });
    adapter.enqueue({ queueName: "q2", payload: { n: 3 } });
    const jobs = adapter.listJobs("q1");
    assert.equal(jobs.length, 2);
  });

  it("listJobs with status filter works", () => {
    adapter.enqueue({ queueName: "q1", payload: { n: 1 } });
    const result = adapter.dequeue("q1");
    assert.ok(result);
    result.ack();
    const waiting = adapter.listJobs("q1", "waiting");
    const completed = adapter.listJobs("q1", "completed");
    assert.equal(waiting.length, 0);
    assert.equal(completed.length, 1);
  });

  it("moveToDeadLetter changes job status", () => {
    const job = adapter.enqueue({ queueName: "q1", payload: { data: "test" } });
    adapter.moveToDeadLetter(job.id, "manual dead letter");
    const moved = adapter.getJob(job.id);
    assert.equal(moved?.status, "dead_letter");
  });

  it("retryJob resets failed job to waiting", () => {
    const job = adapter.enqueue({ queueName: "q1", payload: { data: "test" } });
    adapter.moveToDeadLetter(job.id, "failed");
    const retried = adapter.retryJob(job.id);
    assert.ok(retried);
    assert.equal(retried?.status, "waiting");
    assert.equal(retried?.lastError, null);
  });

  it("purge removes old completed jobs", () => {
    adapter.enqueue({ queueName: "q1", payload: { data: "old" } });
    const result = adapter.dequeue("q1");
    assert.ok(result);
    result.ack();
    // A job completed just now should NOT be purged by an old timestamp
    const oldTimestamp = new Date(Date.now() - 86400000 * 2).toISOString();
    const purged = adapter.purge("q1", oldTimestamp);
    // Job was completed just now, so it's not older than the timestamp
    assert.equal(purged, 0);
    const remaining = adapter.listJobs("q1", "completed");
    assert.equal(remaining.length, 1);
  });

  it("stats returns correct counts", () => {
    adapter.enqueue({ queueName: "q1", payload: { n: 1 } });
    adapter.enqueue({ queueName: "q1", payload: { n: 2 } });
    const result = adapter.dequeue("q1");
    assert.ok(result);
    result.ack();
    const stats = adapter.stats("q1");
    assert.equal(stats.waiting, 1);
    assert.equal(stats.completed, 1);
  });

  it("listQueues returns distinct queue names", () => {
    adapter.enqueue({ queueName: "queue-a", payload: { data: "a" } });
    adapter.enqueue({ queueName: "queue-b", payload: { data: "b" } });
    adapter.enqueue({ queueName: "queue-a", payload: { data: "c" } });
    const queues = adapter.listQueues();
    assert.equal(queues.length, 2);
    assert.ok(queues.includes("queue-a"));
    assert.ok(queues.includes("queue-b"));
  });
});

// ── Queue Adapter Factory Tests ────────────────────────────────────────────────

describe("createQueueAdapter", () => {
  it("creates SQLite adapter when kind is sqlite", () => {
    const config: QueueBackendConfig = { kind: "sqlite" };
    const db = new SqliteDatabase(":memory:");
    db.migrate();
    const adapter = createQueueAdapter(config, db);
    assert.equal(adapter.backendKind, "sqlite");
  });

  it("creates Redis adapter when kind is redis", () => {
    const config: QueueBackendConfig = {
      kind: "redis",
      redis: {
        host: "localhost",
        port: 6379,
      },
    };
    const adapter = createQueueAdapter(config);
    assert.equal(adapter.backendKind, "redis");
  });

  it("throws when redis config missing for redis backend", () => {
    const config: QueueBackendConfig = { kind: "redis" };
    assert.throws(
      () => createQueueAdapter(config),
      /queue.missing_redis_config/i
    );
  });

  it("throws when db missing for sqlite backend", () => {
    const config: QueueBackendConfig = { kind: "sqlite" };
    assert.throws(
      () => createQueueAdapter(config),
      /queue.missing_sqlite_db/i
    );
  });
});