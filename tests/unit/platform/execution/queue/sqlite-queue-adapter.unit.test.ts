/**
 * SqliteQueueAdapter Unit Tests
 *
 * Tests core functionality and concurrency per §17.1.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { SqliteQueueAdapter } from "../../../../../src/platform/execution/queue/sqlite-queue-adapter.js";
import { QUEUE_JOBS_DDL } from "../../../../../src/platform/execution/queue/queue-adapter-types.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { join } from "node:path";
import { runConcurrentInvariant } from "../../../../helpers/concurrent-runner.js";

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "queue.db");
  const db = new SqliteDatabase(dbPath, { migrationPlan: [] });
  db.connection.exec(QUEUE_JOBS_DDL);
  return { workspace, db, adapter: new SqliteQueueAdapter(db) };
}

test("SqliteQueueAdapter backendKind is sqlite", () => {
  const h = createHarness("aa-backend-");
  try {
    assert.equal(h.adapter.backendKind, "sqlite");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteQueueAdapter enqueue creates job with waiting status", () => {
  const h = createHarness("aa-enqueue-");
  try {
    const job = h.adapter.enqueue({
      queueName: "test-queue",
      payload: { hello: "world" },
    });

    assert.ok(job.id.startsWith("qjob_"));
    assert.equal(job.queueName, "test-queue");
    assert.equal(job.status, "waiting");
    assert.equal(job.attempts, 0);
    assert.equal(job.priority, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteQueueAdapter enqueue with priority sets priority", () => {
  const h = createHarness("aa-priority-");
  try {
    const job = h.adapter.enqueue({
      queueName: "priority-queue",
      payload: { important: true },
      priority: 10,
    });

    assert.equal(job.priority, 10);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteQueueAdapter enqueue with delayUntil sets delayed status", () => {
  const h = createHarness("aa-delayed-");
  try {
    const futureTime = new Date(Date.now() + 60000).toISOString();
    const job = h.adapter.enqueue({
      queueName: "delayed-queue",
      payload: { delayed: true },
      delayUntil: futureTime,
    });

    assert.equal(job.status, "delayed");
    assert.equal(job.delayUntil, futureTime);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteQueueAdapter dequeue returns null for empty queue", () => {
  const h = createHarness("aa-empty-");
  try {
    assert.equal(h.adapter.dequeue("nonexistent"), null);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteQueueAdapter dequeue returns job and increments attempts", () => {
  const h = createHarness("aa-dequeue-");
  try {
    const enqueued = h.adapter.enqueue({ queueName: "tasks", payload: { taskId: "t1" } });
    assert.equal(enqueued.attempts, 0);

    const result = h.adapter.dequeue("tasks");
    assert.ok(result);
    assert.equal(result.job.id, enqueued.id);
    assert.equal(result.job.status, "active");
    assert.equal(result.job.attempts, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteQueueAdapter dequeue respects priority ordering", () => {
  const h = createHarness("aa-priority-order-");
  try {
    h.adapter.enqueue({ queueName: "q", payload: "low", priority: 1 });
    h.adapter.enqueue({ queueName: "q", payload: "high", priority: 10 });
    h.adapter.enqueue({ queueName: "q", payload: "medium", priority: 5 });

    const r1 = h.adapter.dequeue("q");
    assert.ok(r1);
    assert.equal(JSON.parse(r1.job.payload), "high");
    r1.ack();

    const r2 = h.adapter.dequeue("q");
    assert.ok(r2);
    assert.equal(JSON.parse(r2.job.payload), "medium");
    r2.ack();

    const r3 = h.adapter.dequeue("q");
    assert.ok(r3);
    assert.equal(JSON.parse(r3.job.payload), "low");
    r3.ack();
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteQueueAdapter ack marks job completed", () => {
  const h = createHarness("aa-ack-");
  try {
    const job = h.adapter.enqueue({ queueName: "tasks", payload: {} });
    const result = h.adapter.dequeue("tasks");

    assert.ok(result);
    result.ack();

    const completed = h.adapter.getJob(job.id);
    assert.equal(completed?.status, "completed");
    assert.ok(completed?.completedAt);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteQueueAdapter nack requeues job", () => {
  const h = createHarness("aa-nack-");
  try {
    const job = h.adapter.enqueue({ queueName: "tasks", payload: {}, maxAttempts: 3 });
    const r1 = h.adapter.dequeue("tasks");

    assert.ok(r1);
    r1.nack("test error");

    const requeued = h.adapter.getJob(job.id);
    assert.equal(requeued?.status, "waiting");
    assert.equal(requeued?.attempts, 1);
    assert.equal(requeued?.lastError, "test error");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteQueueAdapter nack after max attempts moves to dead letter", () => {
  const h = createHarness("aa-nack-dlq-");
  try {
    const job = h.adapter.enqueue({ queueName: "tasks", payload: {}, maxAttempts: 2 });

    const r1 = h.adapter.dequeue("tasks");
    r1.nack("first fail");

    const r2 = h.adapter.dequeue("tasks");
    r2.nack("second fail");

    const dlqJob = h.adapter.getJob(job.id);
    assert.equal(dlqJob?.status, "dead_letter");
    assert.equal(dlqJob?.lastError, "second fail");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteQueueAdapter moveToDeadLetter manually", () => {
  const h = createHarness("aa-manual-dlq-");
  try {
    const job = h.adapter.enqueue({ queueName: "dlq-test", payload: {} });
    h.adapter.moveToDeadLetter(job.id, "poison_message");

    const moved = h.adapter.getJob(job.id);
    assert.equal(moved?.status, "dead_letter");
    assert.equal(moved?.lastError, "poison_message");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteQueueAdapter retryJob resets dead-letter job to waiting", () => {
  const h = createHarness("aa-retry-");
  try {
    const job = h.adapter.enqueue({ queueName: "retry-test", payload: {}, maxAttempts: 1 });
    const r = h.adapter.dequeue("retry-test");
    r!.nack("fail");

    const retried = h.adapter.retryJob(job.id);
    assert.equal(retried?.status, "waiting");
    assert.equal(retried?.attempts, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteQueueAdapter getJob returns null for non-existent job", () => {
  const h = createHarness("aa-get-none-");
  try {
    assert.equal(h.adapter.getJob("non-existent-id"), null);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteQueueAdapter listJobs returns jobs for queue", () => {
  const h = createHarness("aa-list-");
  try {
    h.adapter.enqueue({ queueName: "list-test", payload: { n: 1 } });
    h.adapter.enqueue({ queueName: "list-test", payload: { n: 2 } });

    const jobs = h.adapter.listJobs("list-test");
    assert.equal(jobs.length, 2);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteQueueAdapter listJobs filters by status", () => {
  const h = createHarness("aa-list-status-");
  try {
    h.adapter.enqueue({ queueName: "q", payload: "a" });
    const r = h.adapter.dequeue("q");
    r!.ack();

    const waiting = h.adapter.listJobs("q", "waiting");
    assert.equal(waiting.length, 0);
    const completed = h.adapter.listJobs("q", "completed");
    assert.equal(completed.length, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteQueueAdapter stats returns correct counts", () => {
  const h = createHarness("aa-stats-");
  try {
    h.adapter.enqueue({ queueName: "q", payload: {} });
    h.adapter.enqueue({ queueName: "q", payload: {} });

    const stats = h.adapter.stats("q");
    assert.equal(stats.waiting, 2);
    assert.equal(stats.active, 0);
    assert.equal(stats.completed, 0);
    assert.equal(stats.queueName, "q");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteQueueAdapter listQueues returns distinct queue names", () => {
  const h = createHarness("aa-listq-");
  try {
    h.adapter.enqueue({ queueName: "queue-alpha", payload: {} });
    h.adapter.enqueue({ queueName: "queue-beta", payload: {} });

    const queues = h.adapter.listQueues();
    assert.ok(queues.includes("queue-alpha"));
    assert.ok(queues.includes("queue-beta"));
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteQueueAdapter idempotency prevents duplicate enqueue", () => {
  const h = createHarness("aa-idempotent-");
  try {
    const j1 = h.adapter.enqueue({ queueName: "q", payload: "first", idempotencyKey: "key-1" });
    const j2 = h.adapter.enqueue({ queueName: "q", payload: "duplicate", idempotencyKey: "key-1" });

    assert.equal(j1.id, j2.id);
    assert.equal(h.adapter.listJobs("q").length, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteQueueAdapter purge removes old completed jobs", () => {
  const h = createHarness("aa-purge-");
  try {
    const job = h.adapter.enqueue({ queueName: "q", payload: {} });
    const r = h.adapter.dequeue("q");
    r!.ack();

    const future = new Date(Date.now() + 3600000).toISOString();
    const purged = h.adapter.purge("q", future);
    assert.equal(purged, 1);
    assert.equal(h.adapter.getJob(job.id), null);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

// §17.1 Concurrency Tests for SqliteQueueAdapter

test("SqliteQueueAdapter concurrent enqueues maintain data integrity", async () => {
  const h = createHarness("aa-conc-enqueue-");
  try {
    const result = await runConcurrentInvariant(async (workerId: number) => {
      return h.adapter.enqueue({
        queueName: "concurrent-queue",
        payload: { workerId },
      });
    }, { concurrency: 10 });

    assert.equal(result.errors.length, 0, "No errors during concurrent enqueue");
    assert.equal(result.values.length, 10, "All 10 enqueues completed");

    const jobs = h.adapter.listJobs("concurrent-queue");
    assert.equal(jobs.length, 10, "All jobs persisted");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteQueueAdapter concurrent enqueue idempotency", async () => {
  const h = createHarness("aa-conc-idempotent-");
  try {
    const result = await runConcurrentInvariant(async (workerId: number) => {
      return h.adapter.enqueue({
        queueName: "idempotent-queue",
        payload: { workerId },
        idempotencyKey: "same-key",
      });
    }, { concurrency: 5 });

    assert.equal(result.errors.length, 0, "No errors during concurrent idempotent enqueue");

    const jobs = h.adapter.listJobs("idempotent-queue");
    assert.equal(jobs.length, 1, "Only one job created despite concurrent duplicate keys");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteQueueAdapter concurrent dequeue race condition", async () => {
  const h = createHarness("aa-conc-dequeue-");
  try {
    for (let i = 0; i < 20; i++) {
      h.adapter.enqueue({ queueName: "race-queue", payload: { index: i } });
    }

    const result = await runConcurrentInvariant(async (_workerId: number) => {
      return h.adapter.dequeue("race-queue");
    }, { concurrency: 10 });

    const dequeuedJobs = result.values.filter((r) => r !== null);
    assert.equal(dequeuedJobs.length, 10, "Exactly 10 jobs dequeued concurrently");

    const uniqueIds = new Set(dequeuedJobs.map((r) => r!.job.id));
    assert.equal(uniqueIds.size, 10, "All dequeued jobs have unique IDs");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteQueueAdapter concurrent ack does not corrupt job state", async () => {
  const h = createHarness("aa-conc-ack-");
  try {
    const jobs = [];
    for (let i = 0; i < 10; i++) {
      jobs.push(h.adapter.enqueue({ queueName: "ack-race", payload: { i } }));
    }

    const results = jobs.map((job) => h.adapter.dequeue("ack-race"));

    const ackResult = await runConcurrentInvariant(async (idx: number) => {
      if (results[idx]) {
        results[idx]!.ack();
      }
      return true;
    }, { concurrency: 10 });

    assert.equal(ackResult.errors.length, 0, "No errors during concurrent acks");

    for (const job of jobs) {
      const state = h.adapter.getJob(job.id);
      assert.equal(state?.status, "completed", "All jobs should be completed");
    }
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});