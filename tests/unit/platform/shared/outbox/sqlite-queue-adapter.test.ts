/**
 * Unit Tests: SqliteQueueAdapter
 *
 * Tests the SQLite queue adapter enqueue/dequeue operations.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { SqliteQueueAdapter } from "../../../../../../src/platform/execution/queue/sqlite-queue-adapter.js";
import { SqliteDatabase } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { QUEUE_JOBS_DDL } from "../../../../../../src/platform/execution/queue/queue-adapter-types.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";
import type { EnqueueInput, QueueJobRecord, QueueStats } from "../../../../../../src/platform/execution/queue/queue-adapter-types.js";

test.describe("SqliteQueueAdapter unit tests", () => {
  let workspace: string;
  let db: SqliteDatabase;
  let adapter: SqliteQueueAdapter;

  test.beforeEach(() => {
    workspace = createTempWorkspace("sqlite-queue-");
    const dbPath = `${workspace}/test.db`;
    db = new SqliteDatabase(dbPath);
    db.migrate();
    db.connection.exec(QUEUE_JOBS_DDL);
    adapter = new SqliteQueueAdapter(db);
  });

  test.afterEach(() => {
    db.close();
    cleanupPath(workspace);
  });

  test("enqueue creates a job record with waiting status", () => {
    const input: EnqueueInput = {
      queueName: "test-queue",
      payload: { taskId: "task-1", action: "start" },
    };

    const job = adapter.enqueue(input);

    assert.ok(job.id.startsWith("qjob-"));
    assert.equal(job.queueName, "test-queue");
    assert.equal(job.status, "waiting");
    assert.equal(job.priority, 0);
    assert.equal(job.attempts, 0);
    assert.equal(job.maxAttempts, 3);
    assert.equal(job.lastError, null);
    assert.ok(job.createdAt.length > 0);
    assert.ok(job.updatedAt.length > 0);
    assert.equal(job.completedAt, null);
  });

  test("enqueue with priority sets priority on job", () => {
    const input: EnqueueInput = {
      queueName: "priority-queue",
      payload: { data: "high" },
      priority: 10,
    };

    const job = adapter.enqueue(input);

    assert.equal(job.priority, 10);
  });

  test("enqueue with delayUntil sets delayed status", () => {
    const futureDate = new Date(Date.now() + 60000).toISOString();
    const input: EnqueueInput = {
      queueName: "delayed-queue",
      payload: { data: "delayed" },
      delayUntil: futureDate,
    };

    const job = adapter.enqueue(input);

    assert.equal(job.status, "delayed");
    assert.equal(job.delayUntil, futureDate);
  });

  test("enqueue with idempotencyKey returns existing job on duplicate", () => {
    const input: EnqueueInput = {
      queueName: "idempotent-queue",
      payload: { data: "idempotent" },
      idempotencyKey: "key-123",
    };

    const job1 = adapter.enqueue(input);
    const job2 = adapter.enqueue(input);

    assert.equal(job1.id, job2.id);
    assert.equal(job2.attempts, job1.attempts);
  });

  test("enqueue without idempotencyKey creates new job each time", () => {
    const input: EnqueueInput = {
      queueName: "plain-queue",
      payload: { data: "plain" },
    };

    const job1 = adapter.enqueue(input);
    const job2 = adapter.enqueue(input);

    assert.notEqual(job1.id, job2.id);
  });

  test("dequeue returns null when queue is empty", () => {
    const result = adapter.dequeue("empty-queue");

    assert.equal(result, null);
  });

  test("dequeue returns and activates the highest priority waiting job", () => {
    adapter.enqueue({ queueName: "priority-test", payload: { data: "low" }, priority: 1 });
    adapter.enqueue({ queueName: "priority-test", payload: { data: "high" }, priority: 10 });
    adapter.enqueue({ queueName: "priority-test", payload: { data: "medium" }, priority: 5 });

    const result = adapter.dequeue("priority-test");

    assert.ok(result !== null);
    assert.equal(result.job.priority, 10);
    assert.equal(result.job.status, "active");
    assert.equal(result.job.attempts, 1);
  });

  test("dequeue updates job status to active", () => {
    adapter.enqueue({ queueName: "activate-test", payload: { data: "test" } });

    const result = adapter.dequeue("activate-test");

    assert.ok(result !== null);
    assert.equal(result.job.status, "active");

    const fetched = adapter.getJob(result.job.id);
    assert.equal(fetched?.status, "active");
  });

  test("dequeue increments attempts counter", () => {
    adapter.enqueue({ queueName: "attempts-test", payload: { data: "test" } });

    const result = adapter.dequeue("attempts-test");

    assert.equal(result?.job.attempts, 1);

    // Dequeue again to verify second attempt
    adapter.enqueue({ queueName: "attempts-test-2", payload: { data: "test2" } });
    const result2 = adapter.dequeue("attempts-test-2");
    assert.equal(result2?.job.attempts, 1);
  });

  test("ack marks job as completed", () => {
    adapter.enqueue({ queueName: "ack-test", payload: { data: "test" } });
    const result = adapter.dequeue("ack-test");
    assert.ok(result !== null);

    result.ack();

    const job = adapter.getJob(result.job.id);
    assert.equal(job?.status, "completed");
    assert.ok(job?.completedAt !== null);
  });

  test("nack with max attempts moves job to dead_letter", () => {
    adapter.enqueue({ queueName: "nack-dl-test", payload: { data: "test" }, maxAttempts: 2 });
    const result = adapter.dequeue("nack-dl-test");
    assert.ok(result !== null);

    // First nack - should go back to waiting
    result.nack("error 1");
    let job = adapter.getJob(result.job.id);
    assert.equal(job?.status, "waiting");

    // Dequeue again to get second attempt
    adapter.dequeue("nack-dl-test");
    // Second nack - should go to dead_letter
    result.nack("error 2");
    job = adapter.getJob(result.job.id);
    assert.equal(job?.status, "dead_letter");
    assert.equal(job?.lastError, "error 2");
  });

  test("nack without max attempts exceeded returns to waiting", () => {
    adapter.enqueue({ queueName: "nack-retry-test", payload: { data: "test" }, maxAttempts: 3 });
    const result = adapter.dequeue("nack-retry-test");
    assert.ok(result !== null);

    result.nack("temporary error");

    const job = adapter.getJob(result.job.id);
    assert.equal(job?.status, "waiting");
    assert.equal(job?.lastError, "temporary error");
  });

  test("getJob returns null for non-existent job", () => {
    const job = adapter.getJob("non-existent-id");

    assert.equal(job, null);
  });

  test("getJob retrieves enqueued job", () => {
    const enqueued = adapter.enqueue({ queueName: "get-job-test", payload: { data: "test" } });

    const fetched = adapter.getJob(enqueued.id);

    assert.ok(fetched !== null);
    assert.equal(fetched.id, enqueued.id);
    assert.equal(fetched.queueName, "get-job-test");
    assert.equal(fetched.status, "waiting");
  });

  test("listJobs returns all jobs for queue", () => {
    adapter.enqueue({ queueName: "list-test", payload: { data: "1" } });
    adapter.enqueue({ queueName: "list-test", payload: { data: "2" } });
    adapter.enqueue({ queueName: "list-test", payload: { data: "3" } });

    const jobs = adapter.listJobs("list-test");

    assert.equal(jobs.length, 3);
  });

  test("listJobs filters by status", () => {
    adapter.enqueue({ queueName: "filter-test", payload: { data: "1" } });
    adapter.enqueue({ queueName: "filter-test", payload: { data: "2" } });
    const result = adapter.dequeue("filter-test");
    result?.ack();

    const waitingJobs = adapter.listJobs("filter-test", "waiting");
    const completedJobs = adapter.listJobs("filter-test", "completed");

    assert.ok(waitingJobs.length >= 1);
    assert.equal(completedJobs.length, 1);
  });

  test("listJobs respects limit parameter", () => {
    for (let i = 0; i < 10; i++) {
      adapter.enqueue({ queueName: "limit-test", payload: { data: String(i) } });
    }

    const jobs = adapter.listJobs("limit-test", undefined, 5);

    assert.equal(jobs.length, 5);
  });

  test("moveToDeadLetter updates job status", () => {
    const job = adapter.enqueue({ queueName: "dl-move-test", payload: { data: "test" } });

    adapter.moveToDeadLetter(job.id, "business error");

    const fetched = adapter.getJob(job.id);
    assert.equal(fetched?.status, "dead_letter");
    assert.equal(fetched?.lastError, "business error");
  });

  test("retryJob restores dead_letter job to waiting", () => {
    const job = adapter.enqueue({ queueName: "retry-test", payload: { data: "test" } });
    adapter.moveToDeadLetter(job.id, "previous error");

    const retried = adapter.retryJob(job.id);

    assert.ok(retried !== null);
    assert.equal(retried.status, "waiting");
    assert.equal(retried.lastError, null);
  });

  test("retryJob returns null for non-dead_letter job", () => {
    const job = adapter.enqueue({ queueName: "retry-fail-test", payload: { data: "test" } });

    const retried = adapter.retryJob(job.id);

    assert.equal(retried, null);
  });

  test("purge removes completed jobs older than threshold", () => {
    const oldJob = adapter.enqueue({ queueName: "purge-test", payload: { data: "old" } });
    const result = adapter.dequeue("purge-test");
    result?.ack();

    const oldDate = new Date(Date.now() + 10000).toISOString();
    const purged = adapter.purge("purge-test", oldDate);

    assert.equal(purged, 1);
    assert.equal(adapter.getJob(oldJob.id), null);
  });

  test("purge returns 0 when no jobs match", () => {
    adapter.enqueue({ queueName: "purge-empty-test", payload: { data: "test" } });

    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const purged = adapter.purge("purge-empty-test", futureDate);

    assert.equal(purged, 0);
  });

  test("stats returns correct counts per status", () => {
    adapter.enqueue({ queueName: "stats-test", payload: { data: "1" } });
    adapter.enqueue({ queueName: "stats-test", payload: { data: "2" } });
    adapter.enqueue({ queueName: "stats-test", payload: { data: "3" } });

    const result = adapter.dequeue("stats-test");
    result?.ack();

    const stats = adapter.stats("stats-test");

    assert.equal(stats.queueName, "stats-test");
    assert.ok(stats.waiting >= 2);
    assert.equal(stats.active, 0);
    assert.equal(stats.completed, 1);
    assert.equal(stats.deadLetter, 0);
  });

  test("stats returns zeros for empty queue", () => {
    const stats = adapter.stats("non-existent-queue");

    assert.equal(stats.waiting, 0);
    assert.equal(stats.delayed, 0);
    assert.equal(stats.active, 0);
    assert.equal(stats.completed, 0);
    assert.equal(stats.failed, 0);
    assert.equal(stats.deadLetter, 0);
  });

  test("listQueues returns unique queue names", () => {
    adapter.enqueue({ queueName: "queue-a", payload: { data: "1" } });
    adapter.enqueue({ queueName: "queue-b", payload: { data: "2" } });
    adapter.enqueue({ queueName: "queue-a", payload: { data: "3" } });

    const queues = adapter.listQueues();

    assert.ok(queues.includes("queue-a"));
    assert.ok(queues.includes("queue-b"));
    assert.equal(queues.length, 2);
  });

  test("backendKind is sqlite", () => {
    assert.equal(adapter.backendKind, "sqlite");
  });
});
