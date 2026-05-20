import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SqliteQueueAdapter } from "../../../../../src/platform/five-plane-execution/queue/sqlite-queue-adapter.js";
import { QUEUE_JOBS_DDL } from "../../../../../src/platform/five-plane-execution/queue/queue-adapter-types.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const db = new SqliteDatabase(join(workspace, "queue.db"), { migrationPlan: [] });
  db.connection.exec(QUEUE_JOBS_DDL);
  return {
    workspace,
    db,
    adapter: new SqliteQueueAdapter(db),
  };
}

test("SqliteQueueAdapter enqueue respects priority ordering", () => {
  const harness = createHarness("priority-order-");
  try {
    const { adapter } = harness;

    adapter.enqueue({ queueName: "tasks", payload: { id: "low" }, priority: 1 });
    adapter.enqueue({ queueName: "tasks", payload: { id: "high" }, priority: 100 });
    adapter.enqueue({ queueName: "tasks", payload: { id: "medium" }, priority: 50 });

    const dequeued = adapter.dequeue("tasks");
    assert.ok(dequeued);
    assert.equal(JSON.parse(dequeued.job.payload).id, "high");

    const dequeued2 = adapter.dequeue("tasks");
    assert.ok(dequeued2);
    assert.equal(JSON.parse(dequeued2.job.payload).id, "medium");

    const dequeued3 = adapter.dequeue("tasks");
    assert.ok(dequeued3);
    assert.equal(JSON.parse(dequeued3.job.payload).id, "low");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter enqueue respects FIFO for same priority", () => {
  const harness = createHarness("fifo-same-priority-");
  try {
    const { adapter } = harness;

    adapter.enqueue({ queueName: "tasks", payload: { id: "first" }, priority: 5 });
    adapter.enqueue({ queueName: "tasks", payload: { id: "second" }, priority: 5 });

    const dequeued = adapter.dequeue("tasks");
    assert.ok(dequeued);
    assert.equal(JSON.parse(dequeued.job.payload).id, "first");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter dequeue moves job to active status", () => {
  const harness = createHarness("dequeue-active-");
  try {
    const { adapter } = harness;

    adapter.enqueue({ queueName: "tasks", payload: { id: "test" } });

    const dequeued = adapter.dequeue("tasks");
    assert.ok(dequeued);
    assert.equal(dequeued.job.status, "active");

    // Verify job is still in the database with active status
    const stored = adapter.getJob(dequeued.job.id);
    assert.ok(stored);
    assert.equal(stored.status, "active");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter ack moves job to completed", () => {
  const harness = createHarness("ack-completed-");
  try {
    const { adapter } = harness;

    adapter.enqueue({ queueName: "tasks", payload: { id: "test" } });

    const dequeued = adapter.dequeue("tasks");
    assert.ok(dequeued);
    dequeued.ack();

    const stored = adapter.getJob(dequeued.job.id);
    assert.ok(stored);
    assert.equal(stored.status, "completed");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter nack without max attempts returns to waiting", () => {
  const harness = createHarness("nack-waiting-");
  try {
    const { adapter } = harness;

    adapter.enqueue({ queueName: "tasks", payload: { id: "test" }, maxAttempts: 3 });

    const dequeued = adapter.dequeue("tasks");
    assert.ok(dequeued);
    dequeued.nack("temporary failure");

    const stored = adapter.getJob(dequeued.job.id);
    assert.ok(stored);
    assert.equal(stored.status, "waiting");
    assert.equal(stored.lastError, "temporary failure");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter nack at max attempts moves to dead letter", () => {
  const harness = createHarness("nack-deadletter-");
  try {
    const { adapter } = harness;

    adapter.enqueue({ queueName: "tasks", payload: { id: "poison-pill" }, maxAttempts: 2 });

    // First attempt
    const dequeued1 = adapter.dequeue("tasks");
    assert.ok(dequeued1);
    dequeued1.nack();

    // Second attempt
    const dequeued2 = adapter.dequeue("tasks");
    assert.ok(dequeued2);
    dequeued2.nack();

    const stored = adapter.getJob(dequeued2.job.id);
    assert.ok(stored);
    assert.equal(stored.status, "dead_letter");
    assert.equal(stored.lastError, "max_attempts_exceeded");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter enqueue with idempotency key returns existing job", () => {
  const harness = createHarness("idempotency-");
  try {
    const { adapter } = harness;

    const job1 = adapter.enqueue({
      queueName: "tasks",
      payload: { id: "test" },
      idempotencyKey: "unique-key-123",
    });

    const job2 = adapter.enqueue({
      queueName: "tasks",
      payload: { id: "different" },
      idempotencyKey: "unique-key-123",
    });

    assert.equal(job1.id, job2.id);
    assert.equal(job1.payload, job2.payload);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter enqueue with delayUntil sets status to delayed", () => {
  const harness = createHarness("delayed-");
  try {
    const { adapter } = harness;

    const futureTime = new Date(Date.now() + 60000).toISOString();
    const job = adapter.enqueue({
      queueName: "tasks",
      payload: { id: "delayed" },
      delayUntil: futureTime,
    });

    assert.equal(job.status, "delayed");
    assert.equal(job.delayUntil, futureTime);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter dequeue activates delayed jobs when time is reached", () => {
  const harness = createHarness("delayed-activate-");
  try {
    const { adapter } = harness;

    const pastTime = new Date(Date.now() - 1000).toISOString();
    adapter.enqueue({
      queueName: "tasks",
      payload: { id: "should-be-active" },
      delayUntil: pastTime,
    });

    const dequeued = adapter.dequeue("tasks");
    assert.ok(dequeued);
    assert.equal(JSON.parse(dequeued.job.payload).id, "should-be-active");
    assert.equal(dequeued.job.status, "active");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter moveToDeadLetter updates job status", () => {
  const harness = createHarness("move-dlq-");
  try {
    const { adapter } = harness;

    const job = adapter.enqueue({ queueName: "tasks", payload: { id: "test" } });
    adapter.moveToDeadLetter(job.id, "manual dlq");

    const stored = adapter.getJob(job.id);
    assert.ok(stored);
    assert.equal(stored.status, "dead_letter");
    assert.equal(stored.lastError, "manual dlq");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter retryJob resets failed job to waiting", () => {
  const harness = createHarness("retry-");
  try {
    const { adapter } = harness;

    const job = adapter.enqueue({ queueName: "tasks", payload: { id: "test" }, maxAttempts: 3 });

    // Move to failed state directly
    harness.db.connection
      .prepare(`UPDATE queue_jobs SET status = 'failed', attempts = 3 WHERE id = ?`)
      .run(job.id);

    const retried = adapter.retryJob(job.id);
    assert.ok(retried);
    assert.equal(retried.status, "waiting");
    assert.equal(retried.attempts, 3);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter retryJob resets dead letter job to waiting", () => {
  const harness = createHarness("retry-dlq-");
  try {
    const { adapter } = harness;

    const job = adapter.enqueue({ queueName: "tasks", payload: { id: "test" } });
    adapter.moveToDeadLetter(job.id, "exceeded max attempts");

    const retried = adapter.retryJob(job.id);
    assert.ok(retried);
    assert.equal(retried.status, "waiting");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter listJobs returns jobs in correct order", () => {
  const harness = createHarness("list-order-");
  try {
    const { adapter } = harness;

    for (let i = 0; i < 5; i++) {
      adapter.enqueue({ queueName: "tasks", payload: { id: i }, priority: i });
    }

    const jobs = adapter.listJobs("tasks");
    assert.equal(jobs.length, 5);
    // Should be ordered by priority DESC
    assert.ok(jobs[0]!.priority >= jobs[1]!.priority);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter listJobs respects limit", () => {
  const harness = createHarness("list-limit-");
  try {
    const { adapter } = harness;

    for (let i = 0; i < 10; i++) {
      adapter.enqueue({ queueName: "tasks", payload: { id: i } });
    }

    const jobs = adapter.listJobs("tasks", undefined, 3);
    assert.equal(jobs.length, 3);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter listJobs filters by status", () => {
  const harness = createHarness("list-status-");
  try {
    const { adapter } = harness;

    adapter.enqueue({ queueName: "tasks", payload: { id: "waiting" } });

    const job = adapter.enqueue({ queueName: "tasks", payload: { id: "to-dequeue" } });
    const dequeued = adapter.dequeue("tasks");
    assert.ok(dequeued);

    const waitingJobs = adapter.listJobs("tasks", "waiting");
    const activeJobs = adapter.listJobs("tasks", "active");

    assert.ok(waitingJobs.some(j => j.id === job.id) || waitingJobs.length === 1);
    assert.ok(activeJobs.some(j => j.id === dequeued.job.id));
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter purge removes old completed jobs", () => {
  const harness = createHarness("purge-");
  try {
    const { adapter } = harness;

    adapter.enqueue({ queueName: "tasks", payload: { id: "old-completed" } });
    const job = adapter.dequeue("tasks");
    assert.ok(job);
    job.ack();

    // Old timestamp
    const oldTime = new Date(Date.now() - 100000).toISOString();
    harness.db.connection
      .prepare("UPDATE queue_jobs SET completed_at = ?, updated_at = ? WHERE id = ?")
      .run(oldTime, oldTime, job.job.id);
    const cutoff = new Date(Date.now() - 50000).toISOString();

    const purged = adapter.purge("tasks", cutoff);
    assert.equal(purged, 1);

    const stored = adapter.getJob(job.job.id);
    assert.equal(stored, null);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter purge does not remove recent jobs", () => {
  const harness = createHarness("purge-recent-");
  try {
    const { adapter } = harness;

    const job = adapter.enqueue({ queueName: "tasks", payload: { id: "recent" } });
    const dequeued = adapter.dequeue("tasks");
    assert.ok(dequeued);
    dequeued.ack();

    // Recent timestamp
    const recentTime = new Date().toISOString();
    harness.db.connection
      .prepare("UPDATE queue_jobs SET completed_at = ?, updated_at = ? WHERE id = ?")
      .run(recentTime, recentTime, job.id);
    const cutoff = new Date(Date.now() - 100000).toISOString();

    const purged = adapter.purge("tasks", cutoff);
    assert.equal(purged, 0);

    const stored = adapter.getJob(job.id);
    assert.ok(stored);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter stats returns accurate counts", () => {
  const harness = createHarness("stats-");
  try {
    const { adapter } = harness;

    // Add various jobs
    adapter.enqueue({ queueName: "tasks", payload: { id: "w1" } });
    adapter.enqueue({ queueName: "tasks", payload: { id: "w2" } });
    adapter.enqueue({ queueName: "tasks", payload: { id: "w3" } });

    const d1 = adapter.dequeue("tasks");
    assert.ok(d1);
    d1.ack();

    const d2 = adapter.dequeue("tasks");
    assert.ok(d2);

    const stats = adapter.stats("tasks");

    assert.equal(stats.waiting, 1);
    assert.equal(stats.active, 1);
    assert.equal(stats.completed, 1);
    assert.equal(stats.deadLetter, 0);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter listQueues returns all queue names", () => {
  const harness = createHarness("list-queues-");
  try {
    const { adapter } = harness;

    adapter.enqueue({ queueName: "queue-a", payload: { id: 1 } });
    adapter.enqueue({ queueName: "queue-b", payload: { id: 2 } });
    adapter.enqueue({ queueName: "queue-a", payload: { id: 3 } });

    const queues = adapter.listQueues();
    assert.equal(queues.length, 2);
    assert.ok(queues.includes("queue-a"));
    assert.ok(queues.includes("queue-b"));
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter getJob returns null for unknown job", () => {
  const harness = createHarness("get-job-");
  try {
    const { adapter } = harness;

    const result = adapter.getJob("unknown-id");
    assert.equal(result, null);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter dequeue returns null when queue is empty", () => {
  const harness = createHarness("dequeue-empty-");
  try {
    const { adapter } = harness;

    const result = adapter.dequeue("non-existent-queue");
    assert.equal(result, null);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter nack with error message stores error", () => {
  const harness = createHarness("nack-error-");
  try {
    const { adapter } = harness;

    const job = adapter.enqueue({ queueName: "tasks", payload: { id: "test" }, maxAttempts: 2 });
    const dequeued = adapter.dequeue("tasks");
    assert.ok(dequeued);
    dequeued.nack("custom error message");

    const stored = adapter.getJob(job.id);
    assert.ok(stored);
    assert.equal(stored.lastError, "custom error message");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});
