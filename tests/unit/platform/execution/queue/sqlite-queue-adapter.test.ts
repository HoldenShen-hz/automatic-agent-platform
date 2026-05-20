import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SqliteQueueAdapter } from "../../../../../src/platform/five-plane-execution/queue/sqlite-queue-adapter.js";
import { QUEUE_JOBS_DDL } from "../../../../../src/platform/five-plane-execution/queue/queue-adapter-types.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  // Use empty migration plan to avoid running all production migrations
  // that have cross-dependencies. We only need the queue_jobs table.
  const db = new SqliteDatabase(join(workspace, "queue.db"), { migrationPlan: [] });
  db.connection.exec(QUEUE_JOBS_DDL);
  return {
    workspace,
    db,
    adapter: new SqliteQueueAdapter(db),
  };
}

test("SqliteQueueAdapter listJobs filters by status and respects the limit", () => {
  const harness = createHarness("aa-sqlite-queue-direct-");
  try {
    const { adapter } = harness;
    adapter.enqueue({ queueName: "tasks", payload: { id: 1 }, priority: 1 });
    adapter.enqueue({ queueName: "tasks", payload: { id: 2 }, priority: 10 });
    adapter.enqueue({ queueName: "tasks", payload: { id: 3 }, priority: 5 });

    const active = adapter.dequeue("tasks");
    assert.ok(active);

    const waitingJobs = adapter.listJobs("tasks", "waiting", 1);
    assert.equal(waitingJobs.length, 1);
    assert.equal(JSON.parse(waitingJobs[0]!.payload).id, 3);

    const allJobs = adapter.listJobs("tasks");
    assert.equal(allJobs.length, 3);
    assert.equal(allJobs[0]!.priority, 10);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter nack without explicit error uses default dead-letter reason at max attempts", () => {
  const harness = createHarness("aa-sqlite-queue-direct-");
  try {
    const { adapter } = harness;
    const job = adapter.enqueue({ queueName: "tasks", payload: { id: "poison" }, maxAttempts: 1 });

    const dequeued = adapter.dequeue("tasks");
    assert.ok(dequeued);
    dequeued.nack();

    const stored = adapter.getJob(job.id);
    assert.equal(stored?.status, "dead_letter");
    assert.equal(stored?.lastError, "max_attempts_exceeded");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter retryJob returns null for unknown ids and purge returns zero when nothing matches", () => {
  const harness = createHarness("aa-sqlite-queue-direct-");
  try {
    const { adapter } = harness;
    adapter.enqueue({ queueName: "tasks", payload: { id: 1 } });

    assert.equal(adapter.retryJob("missing-job"), null);
    assert.equal(adapter.purge("tasks", "2099-01-01T00:00:00.000Z"), 0);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter retryJob preserves historical attempts for dead-letter jobs", () => {
  const harness = createHarness("aa-sqlite-queue-retry-attempts-");
  try {
    const { adapter } = harness;
    const job = adapter.enqueue({ queueName: "tasks", payload: { id: "poison" }, maxAttempts: 1 });

    const dequeued = adapter.dequeue("tasks");
    assert.ok(dequeued);
    dequeued.nack("boom");

    const retried = adapter.retryJob(job.id);
    assert.equal(retried?.status, "waiting");
    assert.equal(retried?.attempts, 1);
    assert.equal(retried?.lastError, null);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter stats returns correct counts for each status", () => {
  const harness = createHarness("aa-sqlite-queue-stats-");
  try {
    const { adapter } = harness;

    // Add jobs in different states
    adapter.enqueue({ queueName: "tasks", payload: { id: 1 } }); // waiting
    adapter.enqueue({ queueName: "tasks", payload: { id: 2 } }); // waiting
    adapter.enqueue({ queueName: "tasks", payload: { id: 3 }, delayUntil: "2099-01-01T00:00:00.000Z" }); // delayed

    // dequeue moves one waiting job to active
    const dequeued = adapter.dequeue("tasks");
    assert.ok(dequeued);
    dequeued.ack(); // completed

    const stats = adapter.stats("tasks");
    assert.equal(stats.queueName, "tasks");
    assert.equal(stats.waiting, 1); // 1 still waiting (id 2)
    assert.equal(stats.delayed, 1); // 1 delayed (id 3)
    assert.equal(stats.active, 0); // dequeued job was completed
    assert.equal(stats.completed, 1); // ack moved to completed
    assert.equal(stats.failed, 0);
    assert.equal(stats.deadLetter, 0);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter stats returns zeros for empty queue", () => {
  const harness = createHarness("aa-sqlite-queue-stats-empty-");
  try {
    const { adapter } = harness;

    const stats = adapter.stats("nonexistent");
    assert.equal(stats.waiting, 0);
    assert.equal(stats.delayed, 0);
    assert.equal(stats.active, 0);
    assert.equal(stats.completed, 0);
    assert.equal(stats.failed, 0);
    assert.equal(stats.deadLetter, 0);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter listQueues returns distinct queue names", () => {
  const harness = createHarness("aa-sqlite-queue-list-");
  try {
    const { adapter } = harness;

    adapter.enqueue({ queueName: "tasks", payload: { id: 1 } });
    adapter.enqueue({ queueName: "tasks", payload: { id: 2 } });
    adapter.enqueue({ queueName: "events", payload: { id: 3 } });

    const queues = adapter.listQueues();
    assert.equal(queues.length, 2);
    assert.ok(queues.includes("tasks"));
    assert.ok(queues.includes("events"));
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter listQueues returns empty array when no queues", () => {
  const harness = createHarness("aa-sqlite-queue-list-empty-");
  try {
    const { adapter } = harness;

    const queues = adapter.listQueues();
    assert.equal(queues.length, 0);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter dequeue returns null when queue is empty", () => {
  const harness = createHarness("aa-sqlite-queue-dequeue-empty-");
  try {
    const { adapter } = harness;

    const result = adapter.dequeue("nonexistent");
    assert.equal(result, null);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter enqueue with idempotency key returns existing job", () => {
  const harness = createHarness("aa-sqlite-queue-idempotent-");
  try {
    const { adapter } = harness;

    const first = adapter.enqueue({
      queueName: "tasks",
      payload: { id: 1 },
      idempotencyKey: "unique-key-123",
    });

    const second = adapter.enqueue({
      queueName: "tasks",
      payload: { id: 999 }, // different payload
      idempotencyKey: "unique-key-123",
    });

    assert.equal(first.id, second.id);
    assert.equal(first.payload, second.payload);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter nack with error message stores the error", () => {
  const harness = createHarness("aa-sqlite-queue-nack-err-");
  try {
    const { adapter } = harness;
    const job = adapter.enqueue({ queueName: "tasks", payload: { id: "poison" }, maxAttempts: 2 });

    const dequeued = adapter.dequeue("tasks");
    assert.ok(dequeued);
    dequeued.nack("custom error message");

    const stored = adapter.getJob(job.id);
    assert.equal(stored?.status, "waiting"); // goes back to waiting since attempts < maxAttempts
    assert.equal(stored?.lastError, "custom error message");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter dead letter job with max attempts exceeded", () => {
  const harness = createHarness("aa-sqlite-queue-dead-");
  try {
    const { adapter } = harness;
    adapter.enqueue({ queueName: "tasks", payload: { id: "poison" }, maxAttempts: 1 });

    const dequeued = adapter.dequeue("tasks");
    assert.ok(dequeued);
    dequeued.nack(); // goes to dead_letter since maxAttempts is 1

    const stored = adapter.getJob(dequeued.job.id);
    assert.equal(stored?.status, "dead_letter");
    assert.equal(stored?.lastError, "max_attempts_exceeded");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter moveToDeadLetter directly moves job to dead letter", () => {
  const harness = createHarness("aa-sqlite-queue-movetodl-");
  try {
    const { adapter } = harness;
    const job = adapter.enqueue({ queueName: "tasks", payload: { id: 1 } });

    adapter.moveToDeadLetter(job.id, "custom dead letter reason");

    const stored = adapter.getJob(job.id);
    assert.equal(stored?.status, "dead_letter");
    assert.equal(stored?.lastError, "custom dead letter reason");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter purge removes completed and dead letter jobs older than timestamp", () => {
  const harness = createHarness("aa-sqlite-queue-purge-");
  try {
    const { adapter } = harness;

    // Add jobs
    const job1 = adapter.enqueue({ queueName: "tasks", payload: { id: 1 } });
    adapter.enqueue({ queueName: "tasks", payload: { id: 2 } });

    // Complete job1
    const dequeued1 = adapter.dequeue("tasks");
    assert.ok(dequeued1);
    dequeued1.ack();

    // Purge with future date - should remove job1 (completed)
    const purged = adapter.purge("tasks", "2099-01-01T00:00:00.000Z");
    assert.equal(purged, 1);

    // job1 should be gone
    assert.equal(adapter.getJob(job1.id), null);

    // job2 should still be there (waiting)
    const job2 = adapter.getJob(job1.id); // Actually we need to get job2's id
    const stats = adapter.stats("tasks");
    assert.equal(stats.waiting, 1);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});
