import assert from "node:assert/strict";
import test from "node:test";

import { SqliteQueueAdapter } from "../../../../../src/platform/five-plane-execution/queue/queue-adapter.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { QUEUE_JOBS_DDL } from "../../../../../src/platform/five-plane-execution/queue/queue-adapter-types.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { join } from "node:path";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { QueueJobRecord, EnqueueInput } from "../../../../../src/platform/five-plane-execution/queue/queue-adapter-types.js";

function createTestHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "queue.db");
  const db = new SqliteDatabase(dbPath, { migrationPlan: [] });
  db.connection.exec(QUEUE_JOBS_DDL);
  return { workspace, db };
}

test("enqueue creates a job with waiting status", () => {
  const h = createTestHarness("aa-op-enqueue-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const job = adapter.enqueue({ queueName: "tasks", payload: { taskId: "t1" } });

    assert.equal(job.queueName, "tasks");
    assert.equal(job.status, "waiting");
    assert.equal(job.attempts, 0);
    assert.equal(job.priority, 0);
    assert.equal(job.maxAttempts, 3);
    assert.ok(job.id.startsWith("qjob_"));
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("enqueue respects maxAttempts parameter", () => {
  const h = createTestHarness("aa-op-maxattempts-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const job = adapter.enqueue({ queueName: "tasks", payload: {}, maxAttempts: 5 });

    assert.equal(job.maxAttempts, 5);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("enqueue handles delayed jobs with future delayUntil", () => {
  const h = createTestHarness("aa-op-delayed-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const futureDate = new Date(Date.now() + 10_000).toISOString();
    const job = adapter.enqueue({ queueName: "tasks", payload: {}, delayUntil: futureDate });

    assert.equal(job.status, "delayed");
    assert.equal(job.delayUntil, futureDate);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("enqueue handles immediate jobs with past delayUntil", () => {
  const h = createTestHarness("aa-op-immediate-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const pastDate = new Date(Date.now() - 1_000).toISOString();
    const job = adapter.enqueue({ queueName: "tasks", payload: {}, delayUntil: pastDate });

    assert.equal(job.status, "waiting");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("dequeue returns null when queue is empty", () => {
  const h = createTestHarness("aa-op-empty-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const result = adapter.dequeue("nonexistent");
    assert.equal(result, null);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("dequeue returns job and increments attempts", () => {
  const h = createTestHarness("aa-op-dequeue-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const enqueued = adapter.enqueue({ queueName: "tasks", payload: { taskId: "t1" } });
    assert.equal(enqueued.attempts, 0);

    const result = adapter.dequeue("tasks");
    assert.ok(result);
    assert.equal(result.job.id, enqueued.id);
    assert.equal(result.job.status, "active");
    assert.equal(result.job.attempts, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("ack marks job as completed", () => {
  const h = createTestHarness("aa-op-ack-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const enqueued = adapter.enqueue({ queueName: "tasks", payload: {} });
    const result = adapter.dequeue("tasks");
    assert.ok(result);

    result.ack();
    const completed = adapter.getJob(enqueued.id);
    assert.equal(completed?.status, "completed");
    assert.ok(completed?.completedAt);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("nack without error requeues job when under maxAttempts", () => {
  const h = createTestHarness("aa-op-nack-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    adapter.enqueue({ queueName: "tasks", payload: {}, maxAttempts: 3 });

    const r1 = adapter.dequeue("tasks");
    assert.ok(r1);
    r1.nack();

    const r2 = adapter.dequeue("tasks");
    assert.ok(r2);
    assert.equal(r2.job.attempts, 2);
    r2.ack();
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("nack with error records lastError", () => {
  const h = createTestHarness("aa-op-nack-error-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    adapter.enqueue({ queueName: "tasks", payload: {}, maxAttempts: 3 });

    const r1 = adapter.dequeue("tasks");
    assert.ok(r1);
    r1.nack("test error message");

    const job = adapter.getJob(r1.job.id);
    assert.equal(job?.lastError, "test error message");
    r1.ack();
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("nack moves job to dead_letter when maxAttempts exceeded", () => {
  const h = createTestHarness("aa-op-deadletter-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    adapter.enqueue({ queueName: "tasks", payload: {}, maxAttempts: 1 });

    const r1 = adapter.dequeue("tasks");
    assert.ok(r1);
    r1.nack("max_attempts_exceeded");

    const job = adapter.getJob(r1.job.id);
    assert.equal(job?.status, "dead_letter");
    assert.equal(job?.lastError, "max_attempts_exceeded");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("getJob returns null for nonexistent job", () => {
  const h = createTestHarness("aa-op-getjob-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const job = adapter.getJob("nonexistent_id");
    assert.equal(job, null);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("getJob returns correct job data", () => {
  const h = createTestHarness("aa-op-getjob-data-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const enqueued = adapter.enqueue({ queueName: "tasks", payload: { data: 123 } });

    const job = adapter.getJob(enqueued.id);
    assert.ok(job);
    assert.equal(job.id, enqueued.id);
    assert.equal(job.queueName, "tasks");
    assert.equal(job.status, "waiting");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("listJobs returns all jobs for queue", () => {
  const h = createTestHarness("aa-op-listjobs-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    adapter.enqueue({ queueName: "tasks", payload: "a" });
    adapter.enqueue({ queueName: "tasks", payload: "b" });
    adapter.enqueue({ queueName: "tasks", payload: "c" });

    const jobs = adapter.listJobs("tasks");
    assert.equal(jobs.length, 3);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("listJobs filters by status", () => {
  const h = createTestHarness("aa-op-listjobs-status-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    adapter.enqueue({ queueName: "tasks", payload: "a" });
    adapter.enqueue({ queueName: "tasks", payload: "b" });
    const r = adapter.dequeue("tasks");
    r!.ack();

    const waiting = adapter.listJobs("tasks", "waiting");
    assert.equal(waiting.length, 1);

    const completed = adapter.listJobs("tasks", "completed");
    assert.equal(completed.length, 1);

    const all = adapter.listJobs("tasks");
    assert.equal(all.length, 2);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("listJobs respects limit parameter", () => {
  const h = createTestHarness("aa-op-listjobs-limit-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    for (let i = 0; i < 10; i++) {
      adapter.enqueue({ queueName: "tasks", payload: String(i) });
    }

    const jobs = adapter.listJobs("tasks", undefined, 5);
    assert.equal(jobs.length, 5);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("moveToDeadLetter manually moves job to dead letter", () => {
  const h = createTestHarness("aa-op-movetodl-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const job = adapter.enqueue({ queueName: "tasks", payload: "poison" });
    adapter.moveToDeadLetter(job.id, "manual_dead_letter");

    const dl = adapter.getJob(job.id);
    assert.equal(dl?.status, "dead_letter");
    assert.equal(dl?.lastError, "manual_dead_letter");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("retryJob resets dead letter job to waiting", () => {
  const h = createTestHarness("aa-op-retry-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const job = adapter.enqueue({ queueName: "tasks", payload: "retry-me", maxAttempts: 1 });

    const r1 = adapter.dequeue("tasks");
    r1!.nack("fail");
    assert.equal(adapter.getJob(job.id)?.status, "dead_letter");

    const retried = adapter.retryJob(job.id);
    assert.ok(retried);
    assert.equal(retried.status, "waiting");
    assert.equal(retried.attempts, 0);
    assert.equal(retried.lastError, null);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("retryJob returns null for non-dead-letter job", () => {
  const h = createTestHarness("aa-op-retry-invalid-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const job = adapter.enqueue({ queueName: "tasks", payload: {} });

    const retried = adapter.retryJob(job.id);
    assert.ok(retried);
    assert.equal(retried.id, job.id);
    assert.equal(retried.status, "waiting");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("retryJob returns null for nonexistent job", () => {
  const h = createTestHarness("aa-op-retry-nonexistent-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const retried = adapter.retryJob("nonexistent_id");
    assert.equal(retried, null);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("purge removes old completed jobs", () => {
  const h = createTestHarness("aa-op-purge-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const job = adapter.enqueue({ queueName: "tasks", payload: "old" });
    const r = adapter.dequeue("tasks");
    r!.ack();

    const future = new Date(Date.now() + 3_600_000).toISOString();
    const purged = adapter.purge("tasks", future);
    assert.equal(purged, 1);

    const deleted = adapter.getJob(job.id);
    assert.equal(deleted, null);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("purge removes old dead letter jobs", () => {
  const h = createTestHarness("aa-op-purge-dl-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const job = adapter.enqueue({ queueName: "tasks", payload: "old-dl", maxAttempts: 1 });
    const r = adapter.dequeue("tasks");
    r!.nack("fail");

    const future = new Date(Date.now() + 3_600_000).toISOString();
    const purged = adapter.purge("tasks", future);
    assert.equal(purged, 1);

    const deleted = adapter.getJob(job.id);
    assert.equal(deleted, null);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("purge does not remove waiting jobs", () => {
  const h = createTestHarness("aa-op-purge-waiting-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    adapter.enqueue({ queueName: "tasks", payload: "waiting" });

    const future = new Date(Date.now() + 3_600_000).toISOString();
    const purged = adapter.purge("tasks", future);
    assert.equal(purged, 0);

    const jobs = adapter.listJobs("tasks");
    assert.equal(jobs.length, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("purge does not remove active jobs", () => {
  const h = createTestHarness("aa-op-purge-active-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    adapter.enqueue({ queueName: "tasks", payload: "active" });
    adapter.dequeue("tasks");

    const future = new Date(Date.now() + 3_600_000).toISOString();
    const purged = adapter.purge("tasks", future);
    assert.equal(purged, 0);

    const jobs = adapter.listJobs("tasks", "active");
    assert.equal(jobs.length, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("purge returns 0 when nothing to purge", () => {
  const h = createTestHarness("aa-op-purge-empty-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const future = new Date(Date.now() + 3_600_000).toISOString();
    const purged = adapter.purge("tasks", future);
    assert.equal(purged, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("stats returns correct counts", () => {
  const h = createTestHarness("aa-op-stats-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    adapter.enqueue({ queueName: "tasks", payload: "a" });
    adapter.enqueue({ queueName: "tasks", payload: "b" });

    const r = adapter.dequeue("tasks");
    r!.ack();

    const stats = adapter.stats("tasks");
    assert.equal(stats.queueName, "tasks");
    assert.equal(stats.waiting, 1);
    assert.equal(stats.completed, 1);
    assert.equal(stats.active, 0);
    assert.equal(stats.delayed, 0);
    assert.equal(stats.deadLetter, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("stats returns zeros for empty queue", () => {
  const h = createTestHarness("aa-op-stats-empty-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const stats = adapter.stats("nonexistent");
    assert.equal(stats.queueName, "nonexistent");
    assert.equal(stats.waiting, 0);
    assert.equal(stats.completed, 0);
    assert.equal(stats.active, 0);
    assert.equal(stats.delayed, 0);
    assert.equal(stats.deadLetter, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("stats counts delayed jobs correctly", () => {
  const h = createTestHarness("aa-op-stats-delayed-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    adapter.enqueue({ queueName: "tasks", payload: "ready" });
    const futureDate = new Date(Date.now() + 3_600_000).toISOString();
    adapter.enqueue({ queueName: "tasks", payload: "delayed", delayUntil: futureDate });

    const stats = adapter.stats("tasks");
    assert.equal(stats.waiting, 1);
    assert.equal(stats.delayed, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("stats counts dead letter jobs correctly", () => {
  const h = createTestHarness("aa-op-stats-dl-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    adapter.enqueue({ queueName: "tasks", payload: "dl-job", maxAttempts: 1 });
    const r = adapter.dequeue("tasks");
    r!.nack("failed");

    const stats = adapter.stats("tasks");
    assert.equal(stats.deadLetter, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("listQueues returns distinct queue names", () => {
  const h = createTestHarness("aa-op-listqueues-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    adapter.enqueue({ queueName: "alpha", payload: 1 });
    adapter.enqueue({ queueName: "beta", payload: 2 });
    adapter.enqueue({ queueName: "alpha", payload: 3 });

    const queues = adapter.listQueues();
    assert.equal(queues.length, 2);
    assert.ok(queues.includes("alpha"));
    assert.ok(queues.includes("beta"));
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("listQueues returns empty array when no queues exist", () => {
  const h = createTestHarness("aa-op-listqueues-empty-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const queues = adapter.listQueues();
    assert.deepEqual(queues, []);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("idempotencyKey prevents duplicate enqueue", () => {
  const h = createTestHarness("aa-op-idempotent-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const j1 = adapter.enqueue({ queueName: "tasks", payload: "first", idempotencyKey: "key-1" });
    const j2 = adapter.enqueue({ queueName: "tasks", payload: "duplicate", idempotencyKey: "key-1" });

    assert.equal(j1.id, j2.id);
    assert.equal(adapter.listJobs("tasks").length, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("idempotencyKey is queue-specific", () => {
  const h = createTestHarness("aa-op-idempotent-queue-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const j1 = adapter.enqueue({ queueName: "queue1", payload: "first", idempotencyKey: "key-1" });
    const j2 = adapter.enqueue({ queueName: "queue2", payload: "second", idempotencyKey: "key-1" });

    assert.notEqual(j1.id, j2.id);
    assert.equal(adapter.listJobs("queue1").length, 1);
    assert.equal(adapter.listJobs("queue2").length, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("job payload is preserved as JSON", () => {
  const h = createTestHarness("aa-op-payload-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const complexPayload = { nested: { data: [1, 2, 3] }, text: "hello" };
    const job = adapter.enqueue({ queueName: "tasks", payload: complexPayload });

    const retrieved = adapter.getJob(job.id);
    assert.deepEqual(JSON.parse(retrieved!.payload), complexPayload);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("dequeue processes delayed jobs after delayUntil passes", () => {
  const h = createTestHarness("aa-op-delay-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const pastDate = new Date(Date.now() - 1_000).toISOString();
    adapter.enqueue({ queueName: "tasks", payload: "ready", delayUntil: pastDate });

    const r = adapter.dequeue("tasks");
    assert.ok(r);
    assert.equal(JSON.parse(r.job.payload), "ready");
    r.ack();
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("dequeue does not return future delayed jobs", () => {
  const h = createTestHarness("aa-op-delay-future-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const futureDate = new Date(Date.now() + 3_600_000).toISOString();
    adapter.enqueue({ queueName: "tasks", payload: "future", delayUntil: futureDate });

    const r = adapter.dequeue("tasks");
    assert.equal(r, null);

    const stats = adapter.stats("tasks");
    assert.equal(stats.delayed, 1);
    assert.equal(stats.waiting, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
