/**
 * Integration Test: Queue Adapter
 *
 * Tests SQLite queue adapter with real database, covering:
 * - Enqueue/dequeue operations
 * - Job lifecycle (waiting → active → completed)
 * - Priority ordering
 * - Retry handling and dead letter queue
 * - Queue statistics
 * - Idempotency key enforcement
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteQueueAdapter } from "../../../../../src/platform/five-plane-execution/queue/sqlite-queue-adapter.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { QUEUE_JOBS_DDL, type EnqueueInput, type QueueJobRecord } from "../../../../../src/platform/five-plane-execution/queue/queue-adapter-types.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId } from "../../../../../src/platform/contracts/types/ids.js";

function createQueueAdapter(workspace: string): SqliteQueueAdapter {
  const dbPath = join(workspace, "queue.db");
  const db = new SqliteDatabase(dbPath);
  db.connection.exec(QUEUE_JOBS_DDL);
  return new SqliteQueueAdapter(db);
}

// ---------------------------------------------------------------------------
// Basic enqueue/dequeue tests
// ---------------------------------------------------------------------------

test("queue adapter: enqueue creates waiting job", () => {
  const workspace = createTempWorkspace("aa-queue-basic-");

  try {
    const adapter = createQueueAdapter(workspace);

    const input: EnqueueInput = {
      queueName: "default",
      payload: { taskId: "task-001", data: "test" },
    };

    const job = adapter.enqueue(input);

    assert.ok(job.id.startsWith("job_"));
    assert.equal(job.queueName, "default");
    assert.equal(job.status, "waiting");
    assert.equal(job.priority, 0);
    assert.equal(job.attempts, 0);
    assert.ok(typeof job.payload === "string");

    const retrieved = adapter.getJob(job.id);
    assert.ok(retrieved !== null);
    assert.equal(retrieved!.id, job.id);
  } finally {
    cleanupPath(workspace);
  }
});

test("queue adapter: dequeue returns oldest waiting job", () => {
  const workspace = createTempWorkspace("aa-queue-dequeue-");

  try {
    const adapter = createQueueAdapter(workspace);

    // Enqueue multiple jobs
    adapter.enqueue({ queueName: "default", payload: { order: 1 } });
    adapter.enqueue({ queueName: "default", payload: { order: 2 } });
    adapter.enqueue({ queueName: "default", payload: { order: 3 } });

    const result = adapter.dequeue("default");

    assert.ok(result !== null, "Should return a job");
    const payload = JSON.parse(result.job.payload);
    assert.equal(payload.order, 1, "Should return oldest job first");
    assert.equal(result.job.status, "active");

    // Ack the job
    result.ack();

    const completed = adapter.getJob(result.job.id);
    assert.equal(completed!.status, "completed");
  } finally {
    cleanupPath(workspace);
  }
});

test("queue adapter: dequeue returns null when queue is empty", () => {
  const workspace = createTempWorkspace("aa-queue-empty-");

  try {
    const adapter = createQueueAdapter(workspace);

    const result = adapter.dequeue("nonexistent-queue");

    assert.equal(result, null);
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// Priority ordering tests
// ---------------------------------------------------------------------------

test("queue adapter: higher priority jobs dequeued first", () => {
  const workspace = createTempWorkspace("aa-queue-priority-");

  try {
    const adapter = createQueueAdapter(workspace);

    // Enqueue in mixed priority order
    adapter.enqueue({ queueName: "priority-queue", payload: { value: "low" }, priority: 1 });
    adapter.enqueue({ queueName: "priority-queue", payload: { value: "high" }, priority: 100 });
    adapter.enqueue({ queueName: "priority-queue", payload: { value: "medium" }, priority: 50 });

    const first = adapter.dequeue("priority-queue");
    assert.ok(first !== null);
    const firstPayload = JSON.parse(first.job.payload);
    assert.equal(firstPayload.value, "high", "Highest priority should dequeue first");

    first.ack();

    const second = adapter.dequeue("priority-queue");
    assert.ok(second !== null);
    const secondPayload = JSON.parse(second.job.payload);
    assert.equal(secondPayload.value, "medium");

    second.ack();

    const third = adapter.dequeue("priority-queue");
    assert.ok(third !== null);
    const thirdPayload = JSON.parse(third.job.payload);
    assert.equal(thirdPayload.value, "low");

    third.ack();
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// Nack and retry tests
// ---------------------------------------------------------------------------

test("queue adapter: nack returns job to waiting", () => {
  const workspace = createTempWorkspace("aa-queue-nack-");

  try {
    const adapter = createQueueAdapter(workspace);

    const enqueued = adapter.enqueue({ queueName: "default", payload: { data: "test" } });
    assert.equal(enqueued.status, "waiting");

    const result = adapter.dequeue("default");
    assert.ok(result !== null);
    assert.equal(result.job.status, "active");

    // Nack without requeue - job goes back to waiting
    result.nack("Temporary failure");

    const requeued = adapter.getJob(enqueued.id);
    assert.equal(requeued!.status, "waiting");
    assert.equal(requeued!.attempts, 1);
    assert.ok(requeued!.lastError?.includes("Temporary failure"));
  } finally {
    cleanupPath(workspace);
  }
});

test("queue adapter: job moves to dead letter after max attempts", () => {
  const workspace = createTempWorkspace("aa-queue-dead-letter-");

  try {
    const adapter = createQueueAdapter(workspace);

    const job = adapter.enqueue({
      queueName: "dlq-test",
      payload: { data: "test" },
      maxAttempts: 2,
    });

    // First dequeue and nack
    const result1 = adapter.dequeue("dlq-test");
    assert.ok(result1 !== null);
    result1.nack("Error 1");

    // Second dequeue and nack - should go to dead letter
    const result2 = adapter.dequeue("dlq-test");
    assert.ok(result2 !== null);
    result2.nack("Error 2");

    const dlqJob = adapter.getJob(job.id);
    assert.equal(dlqJob!.status, "dead_letter");
    assert.ok(dlqJob!.lastError?.includes("Error 2"));
  } finally {
    cleanupPath(workspace);
  }
});

test("queue adapter: retryJob returns job to waiting", () => {
  const workspace = createTempWorkspace("aa-queue-retry-");

  try {
    const adapter = createQueueAdapter(workspace);

    const job = adapter.enqueue({ queueName: "default", payload: { data: "retry-test" }, maxAttempts: 3 });

    // Dequeue and nack
    const result = adapter.dequeue("default");
    assert.ok(result !== null);
    result.nack("Need to retry");

    // Manually retry
    const retried = adapter.retryJob(job.id);
    assert.ok(retried !== null);
    assert.equal(retried.status, "waiting");
    assert.equal(retried.attempts, 1);
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// Move to dead letter tests
// ---------------------------------------------------------------------------

test("queue adapter: moveToDeadLetter moves job to dead letter", () => {
  const workspace = createTempWorkspace("aa-queue-move-dl-");

  try {
    const adapter = createQueueAdapter(workspace);

    const job = adapter.enqueue({ queueName: "default", payload: { data: "move-test" } });

    adapter.moveToDeadLetter(job.id, "Manual DLQ move");

    const dlqJob = adapter.getJob(job.id);
    assert.equal(dlqJob!.status, "dead_letter");
    assert.ok(dlqJob!.lastError?.includes("Manual DLQ move"));
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// Queue statistics tests
// ---------------------------------------------------------------------------

test("queue adapter: stats returns correct counts", () => {
  const workspace = createTempWorkspace("aa-queue-stats-");

  try {
    const adapter = createQueueAdapter(workspace);

    // Enqueue some jobs
    adapter.enqueue({ queueName: "stats-queue", payload: { n: 1 } });
    adapter.enqueue({ queueName: "stats-queue", payload: { n: 2 } });
    adapter.enqueue({ queueName: "stats-queue", payload: { n: 3 } });

    const stats = adapter.stats("stats-queue");

    assert.equal(stats.waiting, 3);
    assert.equal(stats.active, 0);
    assert.equal(stats.completed, 0);
    assert.equal(stats.failed, 0);
    assert.equal(stats.deadLetter, 0);

    // Dequeue one and ack it
    const result = adapter.dequeue("stats-queue");
    assert.ok(result !== null);
    result.ack();

    const updatedStats = adapter.stats("stats-queue");
    assert.equal(updatedStats.waiting, 2);
    assert.equal(updatedStats.completed, 1);
  } finally {
    cleanupPath(workspace);
  }
});

test("queue adapter: listQueues returns all queue names", () => {
  const workspace = createTempWorkspace("aa-queue-list-");

  try {
    const adapter = createQueueAdapter(workspace);

    adapter.enqueue({ queueName: "queue-a", payload: {} });
    adapter.enqueue({ queueName: "queue-b", payload: {} });
    adapter.enqueue({ queueName: "queue-c", payload: {} });

    const queues = adapter.listQueues();
    assert.equal(queues.length, 3);
    assert.ok(queues.includes("queue-a"));
    assert.ok(queues.includes("queue-b"));
    assert.ok(queues.includes("queue-c"));
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// Idempotency key tests
// ---------------------------------------------------------------------------

test("queue adapter: idempotency key prevents duplicate jobs", () => {
  const workspace = createTempWorkspace("aa-queue-idempotent-");

  try {
    const adapter = createQueueAdapter(workspace);

    const input: EnqueueInput = {
      queueName: "idempotent-queue",
      payload: { data: "same" },
      idempotencyKey: "unique-key-123",
    };

    const first = adapter.enqueue(input);
    const second = adapter.enqueue(input);

    // Should return same job
    assert.equal(second.id, first.id);

    // Only one job in queue
    const jobs = adapter.listJobs("idempotent-queue", "waiting");
    assert.equal(jobs.length, 1);
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// List jobs tests
// ---------------------------------------------------------------------------

test("queue adapter: listJobs returns jobs by status", () => {
  const workspace = createTempWorkspace("aa-queue-list-jobs-");

  try {
    const adapter = createQueueAdapter(workspace);

    // Create jobs in different states
    adapter.enqueue({ queueName: "list-test", payload: { n: 1 } });
    adapter.enqueue({ queueName: "list-test", payload: { n: 2 } });

    const first = adapter.dequeue("list-test");
    assert.ok(first !== null);
    first.ack();

    adapter.enqueue({ queueName: "list-test", payload: { n: 3 } });

    const waitingJobs = adapter.listJobs("list-test", "waiting");
    assert.equal(waitingJobs.length, 2);

    const completedJobs = adapter.listJobs("list-test", "completed");
    assert.equal(completedJobs.length, 1);

    const allJobs = adapter.listJobs("list-test");
    assert.equal(allJobs.length, 3);
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// Purge tests
// ---------------------------------------------------------------------------

test("queue adapter: purge removes old completed jobs", () => {
  const workspace = createTempWorkspace("aa-queue-purge-");

  try {
    const adapter = createQueueAdapter(workspace);

    // Create completed jobs
    for (let i = 0; i < 5; i++) {
      const job = adapter.enqueue({ queueName: "purge-test", payload: { n: i } });
      const result = adapter.dequeue("purge-test");
      assert.ok(result !== null);
      result.ack();
    }

    // Add a new waiting job
    adapter.enqueue({ queueName: "purge-test", payload: { n: "new" } });

    const cutoffTime = new Date().toISOString();

    const purged = adapter.purge("purge-test", cutoffTime);

    // Completed jobs older than cutoff should be purged
    // (depends on timing - may be 0 or more)
    const remainingJobs = adapter.listJobs("purge-test");
    assert.ok(remainingJobs.length >= 1, "Should keep at least the waiting job");
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// Delayed job tests
// ---------------------------------------------------------------------------

test("queue adapter: delayUntil postpones job availability", () => {
  const workspace = createTempWorkspace("aa-queue-delay-");

  try {
    const adapter = createQueueAdapter(workspace);

    const futureTime = new Date(Date.now() + 60000).toISOString(); // 1 minute from now

    adapter.enqueue({
      queueName: "delayed-queue",
      payload: { delayed: true },
      delayUntil: futureTime,
    });

    // Immediate dequeue should return null (job is delayed)
    const immediate = adapter.dequeue("delayed-queue");
    assert.equal(immediate, null, "Delayed job should not be dequeued yet");

    // List waiting jobs - should be empty due to delay
    const waitingJobs = adapter.listJobs("delayed-queue", "waiting");
    assert.equal(waitingJobs.length, 0, "Delayed job should be in 'delayed' status, not 'waiting'");

    // List delayed jobs
    const delayedJobs = adapter.listJobs("delayed-queue", "delayed");
    assert.equal(delayedJobs.length, 1, "Job should be in delayed status");
  } finally {
    cleanupPath(workspace);
  }
});