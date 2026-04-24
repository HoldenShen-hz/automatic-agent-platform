import assert from "node:assert/strict";
import test from "node:test";

import { SqliteQueueAdapter } from "../../../../../src/platform/execution/queue/queue-adapter.js";
import { QUEUE_JOBS_DDL } from "../../../../../src/platform/execution/queue/queue-adapter-types.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { join } from "node:path";

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const db = new SqliteDatabase(join(workspace, "queue.db"), { migrationPlan: [] });
  db.connection.exec(QUEUE_JOBS_DDL);
  return { workspace, db, adapter: new SqliteQueueAdapter(db) };
}

test("queue enqueue creates job with correct initial state", () => {
  const h = createHarness("aa-queue-enqueue-");
  try {
    const job = h.adapter.enqueue({ queueName: "tasks", payload: { taskId: "t1" } });
    assert.equal(job.queueName, "tasks");
    assert.equal(job.status, "waiting");
    assert.equal(job.attempts, 0);
    assert.equal(job.priority, 0);
    assert.ok(job.id);
    assert.ok(job.createdAt);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("queue dequeue moves job from waiting to active", () => {
  const h = createHarness("aa-queue-dequeue-");
  try {
    const job = h.adapter.enqueue({ queueName: "tasks", payload: { id: 1 } });
    assert.equal(job.status, "waiting");

    const result = h.adapter.dequeue("tasks");
    assert.ok(result);
    assert.equal(result.job.id, job.id);
    assert.equal(result.job.status, "active");
    assert.equal(result.job.attempts, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("queue dequeue returns null for empty queue", () => {
  const h = createHarness("aa-queue-empty-");
  try {
    const result = h.adapter.dequeue("nonexistent");
    assert.equal(result, null);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("queue ack moves job to completed", () => {
  const h = createHarness("aa-queue-ack-");
  try {
    const job = h.adapter.enqueue({ queueName: "tasks", payload: { id: 1 } });
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

test("queue nack increments attempts and returns to waiting", () => {
  const h = createHarness("aa-queue-nack-");
  try {
    const job = h.adapter.enqueue({ queueName: "tasks", payload: { id: 1 }, maxAttempts: 3 });
    const result = h.adapter.dequeue("tasks");
    assert.ok(result);
    result.nack("test error");

    const retried = h.adapter.getJob(job.id);
    assert.equal(retried?.status, "waiting");
    assert.equal(retried?.attempts, 1);
    assert.equal(retried?.lastError, "test error");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("queue nack moves to dead letter when max attempts exceeded", () => {
  const h = createHarness("aa-queue-nack-dl-");
  try {
    h.adapter.enqueue({ queueName: "tasks", payload: { id: 1 }, maxAttempts: 1 });

    const r1 = h.adapter.dequeue("tasks");
    assert.ok(r1);
    r1.nack("fatal");

    const dl = h.adapter.getJob(r1.job.id);
    assert.equal(dl?.status, "dead_letter");
    assert.equal(dl?.lastError, "fatal");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("queue getJob returns job by id", () => {
  const h = createHarness("aa-queue-getjob-");
  try {
    const job = h.adapter.enqueue({ queueName: "tasks", payload: { id: 1 } });
    const retrieved = h.adapter.getJob(job.id);
    assert.ok(retrieved);
    assert.equal(retrieved.id, job.id);
    assert.equal(JSON.parse(retrieved.payload).id, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("queue getJob returns null for unknown id", () => {
  const h = createHarness("aa-queue-getjob-missing-");
  try {
    const result = h.adapter.getJob("unknown-id");
    assert.equal(result, null);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("queue listJobs returns all jobs for queue", () => {
  const h = createHarness("aa-queue-listjobs-");
  try {
    h.adapter.enqueue({ queueName: "tasks", payload: { id: 1 } });
    h.adapter.enqueue({ queueName: "tasks", payload: { id: 2 } });
    h.adapter.enqueue({ queueName: "tasks", payload: { id: 3 } });

    const jobs = h.adapter.listJobs("tasks");
    assert.equal(jobs.length, 3);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("queue listJobs filters by status", () => {
  const h = createHarness("aa-queue-listjobs-status-");
  try {
    h.adapter.enqueue({ queueName: "tasks", payload: { id: 1 } });
    const r = h.adapter.dequeue("tasks");
    r!.ack();
    h.adapter.enqueue({ queueName: "tasks", payload: { id: 2 } });

    const waiting = h.adapter.listJobs("tasks", "waiting");
    assert.equal(waiting.length, 1);

    const completed = h.adapter.listJobs("tasks", "completed");
    assert.equal(completed.length, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("queue listJobs respects limit parameter", () => {
  const h = createHarness("aa-queue-listjobs-limit-");
  try {
    h.adapter.enqueue({ queueName: "tasks", payload: { id: 1 } });
    h.adapter.enqueue({ queueName: "tasks", payload: { id: 2 } });
    h.adapter.enqueue({ queueName: "tasks", payload: { id: 3 } });

    const jobs = h.adapter.listJobs("tasks", undefined, 2);
    assert.equal(jobs.length, 2);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("queue moveToDeadLetter manually moves job to dead letter", () => {
  const h = createHarness("aa-queue-movetodl-");
  try {
    const job = h.adapter.enqueue({ queueName: "tasks", payload: { id: 1 } });
    h.adapter.moveToDeadLetter(job.id, "manual dl reason");

    const dl = h.adapter.getJob(job.id);
    assert.equal(dl?.status, "dead_letter");
    assert.equal(dl?.lastError, "manual dl reason");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("queue retryJob resets dead letter job to waiting", () => {
  const h = createHarness("aa-queue-retryjob-");
  try {
    const job = h.adapter.enqueue({ queueName: "tasks", payload: { id: 1 }, maxAttempts: 1 });
    const r = h.adapter.dequeue("tasks");
    r!.nack("fail");

    assert.equal(h.adapter.getJob(job.id)?.status, "dead_letter");

    const retried = h.adapter.retryJob(job.id);
    assert.ok(retried);
    assert.equal(retried.status, "waiting");
    assert.equal(retried.attempts, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("queue retryJob returns null for unknown job", () => {
  const h = createHarness("aa-queue-retryjob-missing-");
  try {
    const result = h.adapter.retryJob("unknown-id");
    assert.equal(result, null);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("queue purge removes completed jobs older than cutoff", () => {
  const h = createHarness("aa-queue-purge-");
  try {
    const job = h.adapter.enqueue({ queueName: "tasks", payload: { id: 1 } });
    const r = h.adapter.dequeue("tasks");
    r!.ack();

    const future = new Date(Date.now() + 3_600_000).toISOString();
    const purged = h.adapter.purge("tasks", future);
    assert.equal(purged, 1);

    const removed = h.adapter.getJob(job.id);
    assert.equal(removed, null);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("queue purge returns zero when nothing to purge", () => {
  const h = createHarness("aa-queue-purge-empty-");
  try {
    h.adapter.enqueue({ queueName: "tasks", payload: { id: 1 } });
    const purged = h.adapter.purge("tasks", "2099-01-01T00:00:00.000Z");
    assert.equal(purged, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("queue stats returns correct counts for each status", () => {
  const h = createHarness("aa-queue-stats-");
  try {
    h.adapter.enqueue({ queueName: "tasks", payload: { id: 1 } });
    h.adapter.enqueue({ queueName: "tasks", payload: { id: 2 } });
    h.adapter.enqueue({ queueName: "tasks", payload: { id: 3 }, delayUntil: "2099-01-01T00:00:00.000Z" });

    const r = h.adapter.dequeue("tasks");
    r!.ack();

    const stats = h.adapter.stats("tasks");
    assert.equal(stats.queueName, "tasks");
    assert.equal(stats.waiting, 1);
    assert.equal(stats.delayed, 1);
    assert.equal(stats.active, 0);
    assert.equal(stats.completed, 1);
    assert.equal(stats.failed, 0);
    assert.equal(stats.deadLetter, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("queue stats returns zeros for empty queue", () => {
  const h = createHarness("aa-queue-stats-empty-");
  try {
    const stats = h.adapter.stats("nonexistent");
    assert.equal(stats.waiting, 0);
    assert.equal(stats.delayed, 0);
    assert.equal(stats.active, 0);
    assert.equal(stats.completed, 0);
    assert.equal(stats.failed, 0);
    assert.equal(stats.deadLetter, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("queue listQueues returns distinct queue names", () => {
  const h = createHarness("aa-queue-listqueues-");
  try {
    h.adapter.enqueue({ queueName: "tasks", payload: { id: 1 } });
    h.adapter.enqueue({ queueName: "events", payload: { id: 2 } });
    h.adapter.enqueue({ queueName: "tasks", payload: { id: 3 } });

    const queues = h.adapter.listQueues();
    assert.equal(queues.length, 2);
    assert.ok(queues.includes("tasks"));
    assert.ok(queues.includes("events"));
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("queue listQueues returns empty for no queues", () => {
  const h = createHarness("aa-queue-listqueues-empty-");
  try {
    const queues = h.adapter.listQueues();
    assert.deepEqual(queues, []);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("queue enqueue with idempotency key prevents duplicates", () => {
  const h = createHarness("aa-queue-idempotent-");
  try {
    const first = h.adapter.enqueue({
      queueName: "tasks",
      payload: { id: 1 },
      idempotencyKey: "unique-key",
    });
    const second = h.adapter.enqueue({
      queueName: "tasks",
      payload: { id: 999 },
      idempotencyKey: "unique-key",
    });

    assert.equal(first.id, second.id);
    assert.equal(h.adapter.listJobs("tasks").length, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("queue enqueue with delay moves job to delayed status", () => {
  const h = createHarness("aa-queue-delay-");
  try {
    const futureDate = new Date(Date.now() + 60_000).toISOString();
    h.adapter.enqueue({ queueName: "tasks", payload: { id: 1 }, delayUntil: futureDate });

    const stats = h.adapter.stats("tasks");
    assert.equal(stats.delayed, 1);
    assert.equal(stats.waiting, 0);

    // Dequeue should return null since job is delayed
    const result = h.adapter.dequeue("tasks");
    assert.equal(result, null);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("queue dequeue respects maxAttempts from enqueue input", () => {
  const h = createHarness("aa-queue-maxattempts-");
  try {
    h.adapter.enqueue({ queueName: "tasks", payload: { id: 1 }, maxAttempts: 2 });

    const r1 = h.adapter.dequeue("tasks");
    assert.ok(r1);
    r1.nack("error 1");

    const r2 = h.adapter.dequeue("tasks");
    assert.ok(r2);
    r2.nack("error 2");

    const dl = h.adapter.getJob(r2.job.id);
    assert.equal(dl?.status, "dead_letter");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});