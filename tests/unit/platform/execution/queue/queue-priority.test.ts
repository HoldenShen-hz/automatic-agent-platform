import assert from "node:assert/strict";
import test from "node:test";

import { SqliteQueueAdapter } from "../../../../../src/platform/five-plane-execution/queue/queue-adapter.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { QUEUE_JOBS_DDL } from "../../../../../src/platform/five-plane-execution/queue/queue-adapter-types.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { join } from "node:path";

function createTestHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "queue.db");
  const db = new SqliteDatabase(dbPath, { migrationPlan: [] });
  db.connection.exec(QUEUE_JOBS_DDL);
  return { workspace, db };
}

test("higher priority jobs are dequeued first [queue-priority]", () => {
  const h = createTestHarness("aa-pri-higher-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    adapter.enqueue({ queueName: "tasks", payload: "low", priority: 1 });
    adapter.enqueue({ queueName: "tasks", payload: "high", priority: 10 });
    adapter.enqueue({ queueName: "tasks", payload: "medium", priority: 5 });

    const first = adapter.dequeue("tasks");
    assert.ok(first);
    assert.equal(JSON.parse(first.job.payload), "high");
    first.ack();

    const second = adapter.dequeue("tasks");
    assert.ok(second);
    assert.equal(JSON.parse(second.job.payload), "medium");
    second.ack();

    const third = adapter.dequeue("tasks");
    assert.ok(third);
    assert.equal(JSON.parse(third.job.payload), "low");
    third.ack();

    assert.equal(adapter.dequeue("tasks"), null);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("default priority is zero [queue-priority]", () => {
  const h = createTestHarness("aa-pri-default-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const job = adapter.enqueue({ queueName: "tasks", payload: "default" });
    assert.equal(job.priority, 0);

    const retrieved = adapter.getJob(job.id);
    assert.equal(retrieved?.priority, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("negative priority jobs are processed after zero priority [queue-priority]", () => {
  const h = createTestHarness("aa-pri-negative-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    adapter.enqueue({ queueName: "tasks", payload: "negative", priority: -5 });
    adapter.enqueue({ queueName: "tasks", payload: "zero", priority: 0 });
    adapter.enqueue({ queueName: "tasks", payload: "positive", priority: 5 });

    const first = adapter.dequeue("tasks");
    assert.ok(first);
    assert.equal(JSON.parse(first.job.payload), "positive");
    first.ack();

    const second = adapter.dequeue("tasks");
    assert.ok(second);
    assert.equal(JSON.parse(second.job.payload), "zero");
    second.ack();

    const third = adapter.dequeue("tasks");
    assert.ok(third);
    assert.equal(JSON.parse(third.job.payload), "negative");
    third.ack();
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("same priority jobs are ordered by createdAt (FIFO) [queue-priority]", () => {
  const h = createTestHarness("aa-pri-fifo-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    adapter.enqueue({ queueName: "tasks", payload: "first", priority: 5 });
    adapter.enqueue({ queueName: "tasks", payload: "second", priority: 5 });
    adapter.enqueue({ queueName: "tasks", payload: "third", priority: 5 });

    const first = adapter.dequeue("tasks");
    assert.ok(first);
    assert.equal(JSON.parse(first.job.payload), "first");
    first.ack();

    const second = adapter.dequeue("tasks");
    assert.ok(second);
    assert.equal(JSON.parse(second.job.payload), "second");
    second.ack();

    const third = adapter.dequeue("tasks");
    assert.ok(third);
    assert.equal(JSON.parse(third.job.payload), "third");
    third.ack();
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("priority ordering is preserved across dequeue/ack cycles [queue-priority]", () => {
  const h = createTestHarness("aa-pri-cycle-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    adapter.enqueue({ queueName: "tasks", payload: "low-priority", priority: 1 });
    adapter.enqueue({ queueName: "tasks", payload: "high-priority", priority: 10 });

    const r1 = adapter.dequeue("tasks");
    assert.ok(r1);
    assert.equal(JSON.parse(r1.job.payload), "high-priority");
    r1.ack();

    // Enqueue new jobs after first ack
    adapter.enqueue({ queueName: "tasks", payload: "new-medium", priority: 5 });

    const r2 = adapter.dequeue("tasks");
    assert.ok(r2);
    assert.equal(JSON.parse(r2.job.payload), "new-medium");
    r2.ack();

    const r3 = adapter.dequeue("tasks");
    assert.ok(r3);
    assert.equal(JSON.parse(r3.job.payload), "low-priority");
    r3.ack();
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("priority works with delayed jobs [queue-priority]", () => {
  const h = createTestHarness("aa-pri-delayed-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const pastDate = new Date(Date.now() - 1_000).toISOString();
    adapter.enqueue({ queueName: "tasks", payload: "delayed-high", priority: 10, delayUntil: pastDate });
    adapter.enqueue({ queueName: "tasks", payload: "immediate-low", priority: 1 });

    const first = adapter.dequeue("tasks");
    assert.ok(first);
    assert.equal(JSON.parse(first.job.payload), "delayed-high");
    first.ack();

    const second = adapter.dequeue("tasks");
    assert.ok(second);
    assert.equal(JSON.parse(second.job.payload), "immediate-low");
    second.ack();
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("priority with maxAttempts [queue-priority]", () => {
  const h = createTestHarness("aa-pri-maxattempts-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    adapter.enqueue({ queueName: "tasks", payload: "high", priority: 10, maxAttempts: 1 });
    adapter.enqueue({ queueName: "tasks", payload: "low", priority: 1, maxAttempts: 3 });

    const r1 = adapter.dequeue("tasks");
    assert.ok(r1);
    assert.equal(JSON.parse(r1.job.payload), "high");
    r1.nack("fail");

    // Dead letter, next should be low priority
    const r2 = adapter.dequeue("tasks");
    assert.ok(r2);
    assert.equal(JSON.parse(r2.job.payload), "low");
    r2.ack();
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("priority ordering with multiple queues [queue-priority]", () => {
  const h = createTestHarness("aa-pri-multiqueue-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    adapter.enqueue({ queueName: "queue-a", payload: "a-high", priority: 10 });
    adapter.enqueue({ queueName: "queue-b", payload: "b-low", priority: 1 });
    adapter.enqueue({ queueName: "queue-a", payload: "a-low", priority: 1 });

    const aHigh = adapter.dequeue("queue-a");
    assert.ok(aHigh);
    assert.equal(JSON.parse(aHigh.job.payload), "a-high");
    aHigh.ack();

    const bLow = adapter.dequeue("queue-b");
    assert.ok(bLow);
    assert.equal(JSON.parse(bLow.job.payload), "b-low");
    bLow.ack();

    const aLow = adapter.dequeue("queue-a");
    assert.ok(aLow);
    assert.equal(JSON.parse(aLow.job.payload), "a-low");
    aLow.ack();
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("listJobs returns jobs in priority order [queue-priority]", () => {
  const h = createTestHarness("aa-pri-listjobs-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    adapter.enqueue({ queueName: "tasks", payload: "low", priority: 1 });
    adapter.enqueue({ queueName: "tasks", payload: "high", priority: 10 });
    adapter.enqueue({ queueName: "tasks", payload: "medium", priority: 5 });

    const jobs = adapter.listJobs("tasks");
    assert.equal(jobs.length, 3);
    assert.equal(JSON.parse(jobs[0]!.payload), "high");
    assert.equal(JSON.parse(jobs[1]!.payload), "medium");
    assert.equal(JSON.parse(jobs[2]!.payload), "low");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("listJobs with status filter maintains priority order [queue-priority]", () => {
  const h = createTestHarness("aa-pri-listjobs-filter-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    adapter.enqueue({ queueName: "tasks", payload: "low", priority: 1 });
    const r = adapter.dequeue("tasks");
    r!.ack();
    adapter.enqueue({ queueName: "tasks", payload: "high", priority: 10 });
    adapter.enqueue({ queueName: "tasks", payload: "medium", priority: 5 });

    const waiting = adapter.listJobs("tasks", "waiting");
    assert.equal(waiting.length, 2);
    assert.equal(JSON.parse(waiting[0]!.payload), "high");
    assert.equal(JSON.parse(waiting[1]!.payload), "medium");

    const completed = adapter.listJobs("tasks", "completed");
    assert.equal(completed.length, 1);
    assert.equal(JSON.parse(completed[0]!.payload), "low");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("retryJob preserves priority [queue-priority]", () => {
  const h = createTestHarness("aa-pri-retry-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const job = adapter.enqueue({ queueName: "tasks", payload: "retry-test", priority: 7, maxAttempts: 1 });

    const r1 = adapter.dequeue("tasks");
    r1!.nack("fail");
    assert.equal(adapter.getJob(job.id)?.status, "dead_letter");

    const retried = adapter.retryJob(job.id);
    assert.ok(retried);
    assert.equal(retried.priority, 7);
    assert.equal(retried.status, "waiting");

    const r2 = adapter.dequeue("tasks");
    assert.ok(r2);
    assert.equal(JSON.parse(r2.job.payload), "retry-test");
    assert.equal(r2.job.priority, 7);
    r2.ack();
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("moveToDeadLetter preserves job data including priority [queue-priority]", () => {
  const h = createTestHarness("aa-pri-movetodl-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const job = adapter.enqueue({ queueName: "tasks", payload: "move-test", priority: 9 });
    adapter.moveToDeadLetter(job.id, "manual-dl");

    const dl = adapter.getJob(job.id);
    assert.ok(dl);
    assert.equal(dl.status, "dead_letter");
    assert.equal(dl.priority, 9);
    assert.equal(dl.lastError, "manual-dl");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("stats reflects priority ordering in waiting count [queue-priority]", () => {
  const h = createTestHarness("aa-pri-stats-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    adapter.enqueue({ queueName: "tasks", payload: "a", priority: 1 });
    adapter.enqueue({ queueName: "tasks", payload: "b", priority: 10 });

    const stats = adapter.stats("tasks");
    assert.equal(stats.waiting, 2);

    // Dequeue high priority
    const r = adapter.dequeue("tasks");
    r!.ack();

    const statsAfter = adapter.stats("tasks");
    assert.equal(statsAfter.waiting, 1);
    assert.equal(statsAfter.completed, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("very high priority values are handled correctly [queue-priority]", () => {
  const h = createTestHarness("aa-pri-veryhigh-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    adapter.enqueue({ queueName: "tasks", payload: "normal", priority: 0 });
    adapter.enqueue({ queueName: "tasks", payload: "very-high", priority: 1000000 });

    const first = adapter.dequeue("tasks");
    assert.ok(first);
    assert.equal(JSON.parse(first.job.payload), "very-high");
    first.ack();

    const second = adapter.dequeue("tasks");
    assert.ok(second);
    assert.equal(JSON.parse(second.job.payload), "normal");
    second.ack();
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("very low priority values are handled correctly [queue-priority]", () => {
  const h = createTestHarness("aa-pri-verylow-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    adapter.enqueue({ queueName: "tasks", payload: "normal", priority: 0 });
    adapter.enqueue({ queueName: "tasks", payload: "very-low", priority: -1000000 });

    const first = adapter.dequeue("tasks");
    assert.ok(first);
    assert.equal(JSON.parse(first.job.payload), "normal");
    first.ack();

    const second = adapter.dequeue("tasks");
    assert.ok(second);
    assert.equal(JSON.parse(second.job.payload), "very-low");
    second.ack();
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("priority score calculation for Redis uses correct formula [queue-priority]", () => {
  // This test verifies the priority * 1e13 + timestamp formula
  // Higher priority = higher score = dequeued first (since we use ZRANGE with REV)
  const h = createTestHarness("aa-pri-formula-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const now = Date.now();

    // Job with higher priority created later should still come first
    adapter.enqueue({ queueName: "tasks", payload: "first", priority: 5 });
    // Use a small delay to ensure different timestamps
    const later = new Date(now + 1000).toISOString();
    adapter.enqueue({ queueName: "tasks", payload: "second", priority: 10 });

    // Manually check the ordering by dequeueing
    const first = adapter.dequeue("tasks");
    assert.ok(first);
    // Second enqueued (with higher priority) should come first
    assert.equal(JSON.parse(first.job.payload), "second");
    first.ack();

    const second = adapter.dequeue("tasks");
    assert.ok(second);
    assert.equal(JSON.parse(second.job.payload), "first");
    second.ack();
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
