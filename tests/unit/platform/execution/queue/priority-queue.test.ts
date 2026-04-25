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

test("priority-queue: higher priority jobs dequeue first", () => {
  const harness = createHarness("aa-priority-higher-first-");
  try {
    const { adapter } = harness;
    // Enqueue in low-to-high order
    adapter.enqueue({ queueName: "tasks", payload: { id: 1 }, priority: 1 });
    adapter.enqueue({ queueName: "tasks", payload: { id: 2 }, priority: 10 });
    adapter.enqueue({ queueName: "tasks", payload: { id: 3 }, priority: 5 });

    const first = adapter.dequeue("tasks");
    const second = adapter.dequeue("tasks");
    const third = adapter.dequeue("tasks");

    assert.ok(first);
    assert.ok(second);
    assert.ok(third);
    assert.equal(JSON.parse(first!.job.payload).id, 2); // priority 10
    assert.equal(JSON.parse(second!.job.payload).id, 3); // priority 5
    assert.equal(JSON.parse(third!.job.payload).id, 1); // priority 1
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("priority-queue: equal priority jobs follow FIFO order by createdAt", () => {
  const harness = createHarness("aa-priority-fifo-");
  try {
    const { adapter } = harness;
    adapter.enqueue({ queueName: "tasks", payload: { id: 1 }, priority: 5 });
    adapter.enqueue({ queueName: "tasks", payload: { id: 2 }, priority: 5 });
    adapter.enqueue({ queueName: "tasks", payload: { id: 3 }, priority: 5 });

    const first = adapter.dequeue("tasks");
    const second = adapter.dequeue("tasks");
    const third = adapter.dequeue("tasks");

    assert.ok(first);
    assert.ok(second);
    assert.ok(third);
    assert.equal(JSON.parse(first!.job.payload).id, 1);
    assert.equal(JSON.parse(second!.job.payload).id, 2);
    assert.equal(JSON.parse(third!.job.payload).id, 3);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("priority-queue: default priority is zero", () => {
  const harness = createHarness("aa-priority-default-");
  try {
    const { adapter } = harness;
    adapter.enqueue({ queueName: "tasks", payload: { id: 1 } }); // default priority
    adapter.enqueue({ queueName: "tasks", payload: { id: 2 }, priority: -5 });
    adapter.enqueue({ queueName: "tasks", payload: { id: 3 }, priority: 5 });

    const first = adapter.dequeue("tasks");
    assert.ok(first);
    assert.equal(JSON.parse(first!.job.payload).id, 3); // priority 5 comes first

    const second = adapter.dequeue("tasks");
    assert.ok(second);
    assert.equal(JSON.parse(second!.job.payload).id, 1); // priority 0 comes second

    const third = adapter.dequeue("tasks");
    assert.ok(third);
    assert.equal(JSON.parse(third!.job.payload).id, 2); // priority -5 comes last
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("priority-queue: negative priority values are handled", () => {
  const harness = createHarness("aa-priority-negative-");
  try {
    const { adapter } = harness;
    adapter.enqueue({ queueName: "tasks", payload: { id: 1 }, priority: -10 });
    adapter.enqueue({ queueName: "tasks", payload: { id: 2 }, priority: 0 });
    adapter.enqueue({ queueName: "tasks", payload: { id: 3 }, priority: 10 });

    const first = adapter.dequeue("tasks");
    const second = adapter.dequeue("tasks");
    const third = adapter.dequeue("tasks");

    assert.ok(first);
    assert.ok(second);
    assert.ok(third);
    assert.equal(JSON.parse(first!.job.payload).id, 3);
    assert.equal(JSON.parse(second!.job.payload).id, 2);
    assert.equal(JSON.parse(third!.job.payload).id, 1);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("priority-queue: listJobs returns jobs ordered by priority desc", () => {
  const harness = createHarness("aa-priority-list-");
  try {
    const { adapter } = harness;
    adapter.enqueue({ queueName: "tasks", payload: { id: 1 }, priority: 1 });
    adapter.enqueue({ queueName: "tasks", payload: { id: 2 }, priority: 100 });
    adapter.enqueue({ queueName: "tasks", payload: { id: 3 }, priority: 50 });

    const jobs = adapter.listJobs("tasks");

    assert.equal(jobs.length, 3);
    assert.equal(JSON.parse(jobs[0]!.payload).id, 2); // priority 100
    assert.equal(JSON.parse(jobs[1]!.payload).id, 3); // priority 50
    assert.equal(JSON.parse(jobs[2]!.payload).id, 1); // priority 1
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("priority-queue: priority with delayUntil maintains priority ordering after delay", () => {
  const harness = createHarness("aa-priority-delay-");
  try {
    const { adapter } = harness;
    const pastDate = "2020-01-01T00:00:00.000Z";

    // Enqueue delayed jobs with different priorities
    adapter.enqueue({ queueName: "tasks", payload: { id: 1 }, priority: 1, delayUntil: pastDate });
    adapter.enqueue({ queueName: "tasks", payload: { id: 2 }, priority: 100, delayUntil: pastDate });

    // Dequeue should return highest priority first
    const first = adapter.dequeue("tasks");
    const second = adapter.dequeue("tasks");

    assert.ok(first);
    assert.ok(second);
    assert.equal(JSON.parse(first!.job.payload).id, 2); // priority 100
    assert.equal(JSON.parse(second!.job.payload).id, 1); // priority 1
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("priority-queue: very high priority values work correctly", () => {
  const harness = createHarness("aa-priority-high-");
  try {
    const { adapter } = harness;
    adapter.enqueue({ queueName: "tasks", payload: { id: 1 }, priority: 1 });
    adapter.enqueue({ queueName: "tasks", payload: { id: 2 }, priority: 1000000 });

    const first = adapter.dequeue("tasks");
    assert.ok(first);
    assert.equal(JSON.parse(first!.job.payload).id, 2);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("priority-queue: mixed priority across different queues", () => {
  const harness = createHarness("aa-priority-mixed-");
  try {
    const { adapter } = harness;
    adapter.enqueue({ queueName: "high-priority", payload: { id: 1 }, priority: 100 });
    adapter.enqueue({ queueName: "low-priority", payload: { id: 2 }, priority: 1 });

    const highResult = adapter.dequeue("high-priority");
    const lowResult = adapter.dequeue("low-priority");

    assert.ok(highResult);
    assert.ok(lowResult);
    assert.equal(JSON.parse(highResult!.job.payload).id, 1);
    assert.equal(JSON.parse(lowResult!.job.payload).id, 2);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("priority-queue: stats reflect priority ordering correctly", () => {
  const harness = createHarness("aa-priority-stats-");
  try {
    const { adapter } = harness;
    adapter.enqueue({ queueName: "tasks", payload: { id: 1 }, priority: 1 });
    adapter.enqueue({ queueName: "tasks", payload: { id: 2 }, priority: 10 });

    const stats = adapter.stats("tasks");

    assert.equal(stats.waiting, 2);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("priority-queue: ack/nack with priority maintains queue integrity", () => {
  const harness = createHarness("aa-priority-ack-");
  try {
    const { adapter } = harness;
    adapter.enqueue({ queueName: "tasks", payload: { id: 1 }, priority: 10 });
    adapter.enqueue({ queueName: "tasks", payload: { id: 2 }, priority: 1 });

    const first = adapter.dequeue("tasks");
    assert.ok(first);
    first.ack(); // Complete the high priority job

    // Now dequeue should get the low priority job
    const second = adapter.dequeue("tasks");
    assert.ok(second);
    assert.equal(JSON.parse(second!.job.payload).id, 2);

    const stats = adapter.stats("tasks");
    assert.equal(stats.waiting, 0);
    assert.equal(stats.completed, 1);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("priority-queue: nack requeues with same priority", () => {
  const harness = createHarness("aa-priority-nack-");
  try {
    const { adapter } = harness;
    adapter.enqueue({ queueName: "tasks", payload: { id: 1 }, priority: 5, maxAttempts: 2 });

    const first = adapter.dequeue("tasks");
    assert.ok(first);
    assert.equal(first.job.priority, 5);
    first.nack("test error");

    // Job should be back in queue with same priority
    const second = adapter.dequeue("tasks");
    assert.ok(second);
    assert.equal(JSON.parse(second!.job.payload).id, 1);
    assert.equal(second.job.priority, 5);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});
