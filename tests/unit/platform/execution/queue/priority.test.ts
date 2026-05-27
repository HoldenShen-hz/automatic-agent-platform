import assert from "node:assert/strict";
import test from "node:test";

import { SqliteQueueAdapter } from "../../../../../src/platform/five-plane-execution/queue/queue-adapter.js";
import { QUEUE_JOBS_DDL } from "../../../../../src/platform/five-plane-execution/queue/queue-adapter-types.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { join } from "node:path";

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const db = new SqliteDatabase(join(workspace, "queue.db"), { migrationPlan: [] });
  db.connection.exec(QUEUE_JOBS_DDL);
  return { workspace, db, adapter: new SqliteQueueAdapter(db) };
}

test("priority queue dequeues highest priority first [priority]", () => {
  const h = createHarness("aa-pri-highest-");
  try {
    h.adapter.enqueue({ queueName: "tasks", payload: "low", priority: 1 });
    h.adapter.enqueue({ queueName: "tasks", payload: "high", priority: 100 });
    h.adapter.enqueue({ queueName: "tasks", payload: "medium", priority: 50 });

    const first = h.adapter.dequeue("tasks");
    assert.ok(first);
    assert.equal(JSON.parse(first.job.payload), "high");
    first.ack();

    const second = h.adapter.dequeue("tasks");
    assert.ok(second);
    assert.equal(JSON.parse(second.job.payload), "medium");
    second.ack();

    const third = h.adapter.dequeue("tasks");
    assert.ok(third);
    assert.equal(JSON.parse(third.job.payload), "low");
    third.ack();

    assert.equal(h.adapter.dequeue("tasks"), null);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("priority queue default priority is zero [priority]", () => {
  const h = createHarness("aa-pri-default-");
  try {
    const job = h.adapter.enqueue({ queueName: "tasks", payload: "test" });
    assert.equal(job.priority, 0);

    const retrieved = h.adapter.getJob(job.id);
    assert.equal(retrieved?.priority, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("priority queue negative priorities come after zero [priority]", () => {
  const h = createHarness("aa-pri-negative-");
  try {
    h.adapter.enqueue({ queueName: "tasks", payload: "negative", priority: -10 });
    h.adapter.enqueue({ queueName: "tasks", payload: "zero", priority: 0 });
    h.adapter.enqueue({ queueName: "tasks", payload: "positive", priority: 10 });

    const first = h.adapter.dequeue("tasks");
    assert.ok(first);
    assert.equal(JSON.parse(first.job.payload), "positive");
    first.ack();

    const second = h.adapter.dequeue("tasks");
    assert.ok(second);
    assert.equal(JSON.parse(second.job.payload), "zero");
    second.ack();

    const third = h.adapter.dequeue("tasks");
    assert.ok(third);
    assert.equal(JSON.parse(third.job.payload), "negative");
    third.ack();
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("priority queue equal priority respects FIFO ordering [priority]", () => {
  const h = createHarness("aa-pri-fifo-");
  try {
    h.adapter.enqueue({ queueName: "tasks", payload: "first", priority: 5 });
    h.adapter.enqueue({ queueName: "tasks", payload: "second", priority: 5 });
    h.adapter.enqueue({ queueName: "tasks", payload: "third", priority: 5 });

    const first = h.adapter.dequeue("tasks");
    assert.ok(first);
    assert.equal(JSON.parse(first.job.payload), "first");
    first.ack();

    const second = h.adapter.dequeue("tasks");
    assert.ok(second);
    assert.equal(JSON.parse(second.job.payload), "second");
    second.ack();

    const third = h.adapter.dequeue("tasks");
    assert.ok(third);
    assert.equal(JSON.parse(third.job.payload), "third");
    third.ack();
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("priority queue preserves ordering across ack cycles [priority]", () => {
  const h = createHarness("aa-pri-cycle-");
  try {
    h.adapter.enqueue({ queueName: "tasks", payload: "low", priority: 1 });
    h.adapter.enqueue({ queueName: "tasks", payload: "high", priority: 10 });

    const r1 = h.adapter.dequeue("tasks");
    assert.ok(r1);
    assert.equal(JSON.parse(r1.job.payload), "high");
    r1.ack();

    h.adapter.enqueue({ queueName: "tasks", payload: "new-medium", priority: 5 });

    const r2 = h.adapter.dequeue("tasks");
    assert.ok(r2);
    assert.equal(JSON.parse(r2.job.payload), "new-medium");
    r2.ack();

    const r3 = h.adapter.dequeue("tasks");
    assert.ok(r3);
    assert.equal(JSON.parse(r3.job.payload), "low");
    r3.ack();
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("priority queue works with delayed jobs [priority]", () => {
  const h = createHarness("aa-pri-delayed-");
  try {
    const pastDate = new Date(Date.now() - 1_000).toISOString();
    h.adapter.enqueue({ queueName: "tasks", payload: "delayed-high", priority: 10, delayUntil: pastDate });
    h.adapter.enqueue({ queueName: "tasks", payload: "immediate-low", priority: 1 });

    const first = h.adapter.dequeue("tasks");
    assert.ok(first);
    assert.equal(JSON.parse(first.job.payload), "delayed-high");
    first.ack();

    const second = h.adapter.dequeue("tasks");
    assert.ok(second);
    assert.equal(JSON.parse(second.job.payload), "immediate-low");
    second.ack();
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("priority queue nack respects max attempts then dead letters [priority]", () => {
  const h = createHarness("aa-pri-nack-");
  try {
    h.adapter.enqueue({ queueName: "tasks", payload: "fail", priority: 10, maxAttempts: 1 });

    const r1 = h.adapter.dequeue("tasks");
    assert.ok(r1);
    r1.nack("fail");

    const dlJob = h.adapter.getJob(r1.job.id);
    assert.equal(dlJob?.status, "dead_letter");
    assert.equal(dlJob?.lastError, "fail");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("priority queue retryJob preserves priority [priority]", () => {
  const h = createHarness("aa-pri-retry-");
  try {
    const job = h.adapter.enqueue({ queueName: "tasks", payload: "retry-test", priority: 7, maxAttempts: 1 });

    const r1 = h.adapter.dequeue("tasks");
    assert.ok(r1);
    r1.nack("fail");

    assert.equal(h.adapter.getJob(job.id)?.status, "dead_letter");

    const retried = h.adapter.retryJob(job.id);
    assert.ok(retried);
    assert.equal(retried.priority, 7);
    assert.equal(retried.status, "waiting");

    const r2 = h.adapter.dequeue("tasks");
    assert.ok(r2);
    assert.equal(JSON.parse(r2.job.payload), "retry-test");
    assert.equal(r2.job.priority, 7);
    r2.ack();
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("priority queue moveToDeadLetter preserves job data [priority]", () => {
  const h = createHarness("aa-pri-movetodl-");
  try {
    const job = h.adapter.enqueue({ queueName: "tasks", payload: "move-test", priority: 9 });
    h.adapter.moveToDeadLetter(job.id, "manual-dl");

    const dl = h.adapter.getJob(job.id);
    assert.ok(dl);
    assert.equal(dl.status, "dead_letter");
    assert.equal(dl.priority, 9);
    assert.equal(dl.lastError, "manual-dl");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("priority queue listJobs returns jobs in priority order [priority]", () => {
  const h = createHarness("aa-pri-listjobs-");
  try {
    h.adapter.enqueue({ queueName: "tasks", payload: "low", priority: 1 });
    h.adapter.enqueue({ queueName: "tasks", payload: "high", priority: 10 });
    h.adapter.enqueue({ queueName: "tasks", payload: "medium", priority: 5 });

    const jobs = h.adapter.listJobs("tasks");
    assert.equal(jobs.length, 3);
    assert.equal(JSON.parse(jobs[0]!.payload), "high");
    assert.equal(JSON.parse(jobs[1]!.payload), "medium");
    assert.equal(JSON.parse(jobs[2]!.payload), "low");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("priority queue listJobs with status filter maintains priority order [priority]", () => {
  const h = createHarness("aa-pri-listjobs-filter-");
  try {
    h.adapter.enqueue({ queueName: "tasks", payload: "low", priority: 1 });
    const r = h.adapter.dequeue("tasks");
    r!.ack();
    h.adapter.enqueue({ queueName: "tasks", payload: "high", priority: 10 });
    h.adapter.enqueue({ queueName: "tasks", payload: "medium", priority: 5 });

    const waiting = h.adapter.listJobs("tasks", "waiting");
    assert.equal(waiting.length, 2);
    assert.equal(JSON.parse(waiting[0]!.payload), "high");
    assert.equal(JSON.parse(waiting[1]!.payload), "medium");

    const completed = h.adapter.listJobs("tasks", "completed");
    assert.equal(completed.length, 1);
    assert.equal(JSON.parse(completed[0]!.payload), "low");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("priority queue stats reflect correct waiting count after dequeue [priority]", () => {
  const h = createHarness("aa-pri-stats-");
  try {
    h.adapter.enqueue({ queueName: "tasks", payload: "a", priority: 1 });
    h.adapter.enqueue({ queueName: "tasks", payload: "b", priority: 10 });

    const stats = h.adapter.stats("tasks");
    assert.equal(stats.waiting, 2);

    const r = h.adapter.dequeue("tasks");
    r!.ack();

    const statsAfter = h.adapter.stats("tasks");
    assert.equal(statsAfter.waiting, 1);
    assert.equal(statsAfter.completed, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("priority queue handles very high priority values [priority]", () => {
  const h = createHarness("aa-pri-veryhigh-");
  try {
    h.adapter.enqueue({ queueName: "tasks", payload: "normal", priority: 0 });
    h.adapter.enqueue({ queueName: "tasks", payload: "very-high", priority: 1_000_000 });

    const first = h.adapter.dequeue("tasks");
    assert.ok(first);
    assert.equal(JSON.parse(first.job.payload), "very-high");
    first.ack();

    const second = h.adapter.dequeue("tasks");
    assert.ok(second);
    assert.equal(JSON.parse(second.job.payload), "normal");
    second.ack();
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("priority queue handles very low priority values [priority]", () => {
  const h = createHarness("aa-pri-verylow-");
  try {
    h.adapter.enqueue({ queueName: "tasks", payload: "normal", priority: 0 });
    h.adapter.enqueue({ queueName: "tasks", payload: "very-low", priority: -1_000_000 });

    const first = h.adapter.dequeue("tasks");
    assert.ok(first);
    assert.equal(JSON.parse(first.job.payload), "normal");
    first.ack();

    const second = h.adapter.dequeue("tasks");
    assert.ok(second);
    assert.equal(JSON.parse(second.job.payload), "very-low");
    second.ack();
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});