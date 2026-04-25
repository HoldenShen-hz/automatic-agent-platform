import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SqliteQueueAdapter } from "../../../../../src/platform/execution/queue/sqlite-queue-adapter.js";
import { QUEUE_JOBS_DDL } from "../../../../../src/platform/execution/queue/queue-adapter-types.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
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

test("queue-service: enqueue adds job to waiting state", () => {
  const harness = createHarness("aa-queue-service-enqueue-");
  try {
    const { adapter } = harness;
    const job = adapter.enqueue({ queueName: "tasks", payload: { id: 1 } });

    assert.ok(job.id);
    assert.equal(job.queueName, "tasks");
    assert.equal(job.status, "waiting");
    assert.equal(job.priority, 0);
    assert.equal(job.attempts, 0);
    assert.ok(job.createdAt);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("queue-service: dequeue retrieves and marks job as active", () => {
  const harness = createHarness("aa-queue-service-dequeue-");
  try {
    const { adapter } = harness;
    adapter.enqueue({ queueName: "tasks", payload: { id: 1 } });

    const result = adapter.dequeue("tasks");

    assert.ok(result);
    assert.equal(result.job.status, "active");
    assert.equal(result.job.attempts, 1);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("queue-service: dequeue returns null when queue is empty", () => {
  const harness = createHarness("aa-queue-service-dequeue-empty-");
  try {
    const { adapter } = harness;

    const result = adapter.dequeue("nonexistent");

    assert.equal(result, null);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("queue-service: ack completes the job", () => {
  const harness = createHarness("aa-queue-service-ack-");
  try {
    const { adapter } = harness;
    adapter.enqueue({ queueName: "tasks", payload: { id: 1 } });

    const result = adapter.dequeue("tasks");
    assert.ok(result);
    result.ack();

    const job = adapter.getJob(result.job.id);
    assert.equal(job?.status, "completed");
    assert.ok(job?.completedAt);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("queue-service: nack requeues job when attempts remain", () => {
  const harness = createHarness("aa-queue-service-nack-");
  try {
    const { adapter } = harness;
    adapter.enqueue({ queueName: "tasks", payload: { id: 1 }, maxAttempts: 3 });

    const result = adapter.dequeue("tasks");
    assert.ok(result);
    result.nack("test error");

    const job = adapter.getJob(result.job.id);
    assert.equal(job?.status, "waiting");
    assert.equal(job?.lastError, "test error");
    assert.equal(job?.attempts, 1); // attempt was already incremented on dequeue
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("queue-service: nack moves to dead letter when max attempts exceeded", () => {
  const harness = createHarness("aa-queue-service-nack-dl-");
  try {
    const { adapter } = harness;
    adapter.enqueue({ queueName: "tasks", payload: { id: 1 }, maxAttempts: 1 });

    const result = adapter.dequeue("tasks");
    assert.ok(result);
    result.nack(); // no explicit error - uses default "max_attempts_exceeded"

    const job = adapter.getJob(result.job.id);
    assert.equal(job?.status, "dead_letter");
    assert.equal(job?.lastError, "max_attempts_exceeded");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("queue-service: enqueue with delayUntil creates delayed job", () => {
  const harness = createHarness("aa-queue-service-delay-");
  try {
    const { adapter } = harness;
    const futureDate = "2099-01-01T00:00:00.000Z";

    const job = adapter.enqueue({
      queueName: "tasks",
      payload: { id: 1 },
      delayUntil: futureDate,
    });

    assert.equal(job.status, "delayed");
    assert.equal(job.delayUntil, futureDate);

    // dequeue should not retrieve delayed job
    const result = adapter.dequeue("tasks");
    assert.equal(result, null);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("queue-service: delayed job becomes available after delay expires", () => {
  const harness = createHarness("aa-queue-service-delay-expire-");
  try {
    const { adapter } = harness;
    // delay until the past (simulating expiry)
    const pastDate = "2020-01-01T00:00:00.000Z";

    adapter.enqueue({
      queueName: "tasks",
      payload: { id: 1 },
      delayUntil: pastDate,
    });

    // dequeue should now retrieve the job since delay has passed
    const result = adapter.dequeue("tasks");
    assert.ok(result);
    assert.equal(result.job.status, "active");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("queue-service: multiple dequeues return jobs in order", () => {
  const harness = createHarness("aa-queue-service-multi-dequeue-");
  try {
    const { adapter } = harness;
    adapter.enqueue({ queueName: "tasks", payload: { id: 1 } });
    adapter.enqueue({ queueName: "tasks", payload: { id: 2 } });
    adapter.enqueue({ queueName: "tasks", payload: { id: 3 } });

    const result1 = adapter.dequeue("tasks");
    const result2 = adapter.dequeue("tasks");
    const result3 = adapter.dequeue("tasks");

    assert.ok(result1);
    assert.ok(result2);
    assert.ok(result3);
    assert.equal(JSON.parse(result1.job.payload).id, 1);
    assert.equal(JSON.parse(result2.job.payload).id, 2);
    assert.equal(JSON.parse(result3.job.payload).id, 3);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("queue-service: listJobs returns all jobs for a queue", () => {
  const harness = createHarness("aa-queue-service-list-");
  try {
    const { adapter } = harness;
    adapter.enqueue({ queueName: "tasks", payload: { id: 1 } });
    adapter.enqueue({ queueName: "tasks", payload: { id: 2 } });
    adapter.enqueue({ queueName: "other", payload: { id: 3 } });

    const jobs = adapter.listJobs("tasks");

    assert.equal(jobs.length, 2);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("queue-service: listJobs filters by status", () => {
  const harness = createHarness("aa-queue-service-list-status-");
  try {
    const { adapter } = harness;
    adapter.enqueue({ queueName: "tasks", payload: { id: 1 } });

    const dequeued = adapter.dequeue("tasks");
    assert.ok(dequeued);

    const waitingJobs = adapter.listJobs("tasks", "waiting");
    const activeJobs = adapter.listJobs("tasks", "active");

    assert.equal(waitingJobs.length, 0);
    assert.equal(activeJobs.length, 1);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("queue-service: stats returns correct counts", () => {
  const harness = createHarness("aa-queue-service-stats-");
  try {
    const { adapter } = harness;
    adapter.enqueue({ queueName: "tasks", payload: { id: 1 } });
    adapter.enqueue({ queueName: "tasks", payload: { id: 2 } });

    const dequeued = adapter.dequeue("tasks");
    assert.ok(dequeued);
    dequeued.ack();

    const stats = adapter.stats("tasks");

    assert.equal(stats.waiting, 1);
    assert.equal(stats.active, 0);
    assert.equal(stats.completed, 1);
    assert.equal(stats.delayed, 0);
    assert.equal(stats.deadLetter, 0);
    assert.equal(stats.failed, 0);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("queue-service: moveToDeadLetter moves job directly", () => {
  const harness = createHarness("aa-queue-service-move-dl-");
  try {
    const { adapter } = harness;
    const job = adapter.enqueue({ queueName: "tasks", payload: { id: 1 } });

    adapter.moveToDeadLetter(job.id, "manual dead letter");

    const stored = adapter.getJob(job.id);
    assert.equal(stored?.status, "dead_letter");
    assert.equal(stored?.lastError, "manual dead letter");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("queue-service: retryJob resets failed job to waiting", () => {
  const harness = createHarness("aa-queue-service-retry-");
  try {
    const { adapter } = harness;
    const job = adapter.enqueue({ queueName: "tasks", payload: { id: 1 }, maxAttempts: 1 });

    // Move to dead letter
    adapter.moveToDeadLetter(job.id, "failed");

    // Retry
    const retried = adapter.retryJob(job.id);

    assert.ok(retried);
    assert.equal(retried.status, "waiting");
    assert.equal(retried.attempts, 0);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("queue-service: purge removes old completed and dead letter jobs", () => {
  const harness = createHarness("aa-queue-service-purge-");
  try {
    const { adapter } = harness;
    const job1 = adapter.enqueue({ queueName: "tasks", payload: { id: 1 } });
    const job2 = adapter.enqueue({ queueName: "tasks", payload: { id: 2 } });

    // Complete job1
    const dequeued = adapter.dequeue("tasks");
    assert.ok(dequeued);
    dequeued.ack();

    // Purge with future date
    const purged = adapter.purge("tasks", "2099-01-01T00:00:00.000Z");

    assert.equal(purged, 1);
    assert.equal(adapter.getJob(job1.id), null);
    assert.ok(adapter.getJob(job2.id)); // job2 is still waiting
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("queue-service: enqueue with idempotency key returns same job", () => {
  const harness = createHarness("aa-queue-service-idempotent-");
  try {
    const { adapter } = harness;

    const first = adapter.enqueue({
      queueName: "tasks",
      payload: { id: 1 },
      idempotencyKey: "key-abc",
    });

    const second = adapter.enqueue({
      queueName: "tasks",
      payload: { id: 999 }, // different payload
      idempotencyKey: "key-abc",
    });

    assert.equal(first.id, second.id);
    assert.equal(first.payload, second.payload); // returns original
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("queue-service: listQueues returns distinct queue names", () => {
  const harness = createHarness("aa-queue-service-list-queues-");
  try {
    const { adapter } = harness;
    adapter.enqueue({ queueName: "tasks", payload: { id: 1 } });
    adapter.enqueue({ queueName: "events", payload: { id: 2 } });
    adapter.enqueue({ queueName: "tasks", payload: { id: 3 } });

    const queues = adapter.listQueues();

    assert.equal(queues.length, 2);
    assert.ok(queues.includes("tasks"));
    assert.ok(queues.includes("events"));
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});
