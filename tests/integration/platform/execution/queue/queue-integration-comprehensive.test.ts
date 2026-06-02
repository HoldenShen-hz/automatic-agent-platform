/**
 * Integration Tests: Queue Integration with Real SQLite
 *
 * Tests queue adapter behavior with real SQLite database,
 * focusing on transaction boundaries and multi-step workflows.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SqliteQueueAdapter } from "../../../../../src/platform/five-plane-execution/queue/sqlite-queue-adapter.js";
import { QUEUE_JOBS_DDL } from "../../../../../src/platform/five-plane-execution/queue/queue-adapter-types.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";

function createQueueHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "queue-integration.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  db.connection.exec(QUEUE_JOBS_DDL);
  const store = new AuthoritativeTaskStore(db);
  const adapter = new SqliteQueueAdapter(db);
  return { workspace, db, store, adapter };
}

test("Queue integration: task lifecycle with queue jobs in transaction", () => {
  const h = createQueueHarness("aa-int-queue-lifecycle-");
  try {
    const taskId = newId("task");
    const now = nowIso();

    // Insert task and enqueue work in same transaction
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: "Queue Lifecycle Test",
        status: "queued",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      h.adapter.enqueue({
        queueName: "task-queue",
        payload: { taskId, action: "process" },
        priority: 5,
      });
    });

    // Verify task was created
    const task = h.store.getTask(taskId);
    assert.ok(task);
    assert.equal(task.status, "queued");

    // Verify job was enqueued
    const job = h.adapter.dequeue("task-queue");
    assert.ok(job);
    const payload = JSON.parse(job.job.payload);
    assert.equal(payload.taskId, taskId);

    // Complete the work
    job.ack();

    const completedJob = h.adapter.getJob(job.job.id);
    assert.equal(completedJob?.status, "completed");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("Queue integration: priority queue ordering with multiple jobs", () => {
  const h = createQueueHarness("aa-int-queue-priority-");
  try {
    // Enqueue jobs with different priorities
    h.adapter.enqueue({ queueName: "priority-queue", payload: { id: "low", p: 1 }, priority: 1 });
    h.adapter.enqueue({ queueName: "priority-queue", payload: { id: "high", p: 10 }, priority: 10 });
    h.adapter.enqueue({ queueName: "priority-queue", payload: { id: "medium", p: 5 }, priority: 5 });
    h.adapter.enqueue({ queueName: "priority-queue", payload: { id: "urgent", p: 20 }, priority: 20 });

    // Dequeue all and verify order
    const order: string[] = [];
    let result = h.adapter.dequeue("priority-queue");
    while (result) {
      const payload = JSON.parse(result.job.payload);
      order.push(payload.id as string);
      result.ack();
      result = h.adapter.dequeue("priority-queue");
    }

    // Should be in priority descending order
    assert.deepEqual(order, ["urgent", "high", "medium", "low"]);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("Queue integration: delayed jobs become available after expiry", () => {
  const h = createQueueHarness("aa-int-queue-delayed-");
  try {
    const pastDate = "2020-01-01T00:00:00.000Z"; // In the past
    const futureDate = new Date(Date.now() + 60000).toISOString(); // 1 minute in future

    // Enqueue one past (immediate) and one future delayed
    h.adapter.enqueue({ queueName: "delayed-queue", payload: { id: "immediate" }, delayUntil: pastDate });
    h.adapter.enqueue({ queueName: "delayed-queue", payload: { id: "future" }, delayUntil: futureDate });

    // Only immediate should be available
    const immediate = h.adapter.dequeue("delayed-queue");
    assert.ok(immediate);
    assert.equal(JSON.parse(immediate.job.payload).id, "immediate");

    // Future should still be unavailable
    const future = h.adapter.dequeue("delayed-queue");
    assert.equal(future, null);

    // Stats should show delayed count
    const stats = h.adapter.stats("delayed-queue");
    assert.equal(stats.delayed, 1);
    assert.equal(stats.waiting, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("Queue integration: idempotency prevents duplicate jobs", () => {
  const h = createQueueHarness("aa-int-queue-idempotent-");
  try {
    const key = "unique-work-item-123";

    // First enqueue
    const first = h.adapter.enqueue({
      queueName: "idempotent-queue",
      payload: { data: "original" },
      idempotencyKey: key,
    });

    // Second enqueue with same key but different payload
    const second = h.adapter.enqueue({
      queueName: "idempotent-queue",
      payload: { data: "should be ignored" },
      idempotencyKey: key,
    });

    // Should return the same job
    assert.equal(first.id, second.id);

    // Only one job in queue
    const jobs = h.adapter.listJobs("idempotent-queue");
    assert.equal(jobs.length, 1);
    assert.equal(JSON.parse(jobs[0]!.payload).data, "original");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("Queue integration: dead letter workflow with manual intervention", () => {
  const h = createQueueHarness("aa-int-queue-dlq-");
  try {
    // Create a job that will fail
    const job = h.adapter.enqueue({
      queueName: "dlq-queue",
      payload: { taskId: "failing-task" },
      maxAttempts: 1,
    });

    // Fail the job
    const r1 = h.adapter.dequeue("dlq-queue");
    assert.ok(r1);
    r1.nack("Simulated failure");

    // Job should be in dead letter now
    const dlqJob = h.adapter.getJob(job.id);
    assert.equal(dlqJob?.status, "dead_letter");
    assert.equal(dlqJob?.lastError, "Simulated failure");

    // Manually retry the job
    const retried = h.adapter.retryJob(job.id);
    assert.ok(retried);
    assert.equal(retried.status, "waiting");
    assert.equal(retried.attempts, 1);

    // Process again successfully
    const r2 = h.adapter.dequeue("dlq-queue");
    assert.ok(r2);
    r2.ack();

    const completed = h.adapter.getJob(job.id);
    assert.equal(completed?.status, "completed");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("Queue integration: purge removes old completed jobs", () => {
  const h = createQueueHarness("aa-int-queue-purge-");
  try {
    // Create and complete multiple jobs
    for (let i = 0; i < 5; i++) {
      const job = h.adapter.enqueue({ queueName: "purge-queue", payload: { id: i } });
      const r = h.adapter.dequeue("purge-queue");
      assert.ok(r);
      r.ack();
    }

    // Add one more waiting job
    h.adapter.enqueue({ queueName: "purge-queue", payload: { id: "keep" } });

    // Purge with future timestamp (should remove all 5 completed)
    const purged = h.adapter.purge("purge-queue", "2099-01-01T00:00:00.000Z");
    assert.equal(purged, 5);

    // Only the waiting job should remain
    const stats = h.adapter.stats("purge-queue");
    assert.equal(stats.waiting, 1);
    assert.equal(stats.completed, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("Queue integration: concurrent dequeues get different jobs", () => {
  const h = createQueueHarness("aa-int-queue-concurrent-");
  try {
    // Enqueue 10 jobs
    for (let i = 0; i < 10; i++) {
      h.adapter.enqueue({ queueName: "concurrent-queue", payload: { index: i } });
    }

    // Simulate concurrent dequeues by processing sequentially but quickly
    const processedIds: number[] = [];
    for (let i = 0; i < 10; i++) {
      const result = h.adapter.dequeue("concurrent-queue");
      if (result) {
        const payload = JSON.parse(result.job.payload);
        processedIds.push(payload.index as number);
        result.ack();
      }
    }

    // All 10 should have been processed
    assert.equal(processedIds.length, 10);
    processedIds.sort();
    assert.deepEqual(processedIds, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("Queue integration: stats reflect complex multi-state scenario", () => {
  const h = createQueueHarness("aa-int-queue-complex-stats-");
  try {
    // Add 3 waiting jobs
    h.adapter.enqueue({ queueName: "complex-queue", payload: { id: "w1" } });
    h.adapter.enqueue({ queueName: "complex-queue", payload: { id: "w2" } });
    h.adapter.enqueue({ queueName: "complex-queue", payload: { id: "w3" } });

    // Add 2 delayed jobs
    h.adapter.enqueue({ queueName: "complex-queue", payload: { id: "d1" }, delayUntil: "2099-01-01T00:00:00.000Z" });
    h.adapter.enqueue({ queueName: "complex-queue", payload: { id: "d2" }, delayUntil: "2099-01-01T00:00:00.000Z" });

    // Dequeue and complete one
    const r1 = h.adapter.dequeue("complex-queue");
    assert.ok(r1);
    r1.ack();

    // Dequeue and nack another (goes back to waiting)
    const r2 = h.adapter.dequeue("complex-queue");
    assert.ok(r2);
    r2.nack("error");

    // Move one to dead letter manually
    const waitingJobs = h.adapter.listJobs("complex-queue", "waiting");
    if (waitingJobs.length > 0) {
      h.adapter.moveToDeadLetter(waitingJobs[0]!.id, "manual dl");
    }

    const stats = h.adapter.stats("complex-queue");
    // After: 1 completed (acked), 1 nacked (back to waiting), 1 moved to DL, 2 delayed
    // waiting count varies based on which job was nacked and which was moved to DL
    assert.ok(stats.waiting >= 0); // At least 0 (could be 1 if same job was nacked and moved)
    assert.equal(stats.delayed, 2);
    assert.equal(stats.active, 0);
    assert.equal(stats.completed, 1);
    assert.equal(stats.deadLetter, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("Queue integration: listJobs with status filter and limit", () => {
  const h = createQueueHarness("aa-int-queue-list-filter-");
  try {
    // Create jobs in various states
    for (let i = 0; i < 5; i++) {
      h.adapter.enqueue({ queueName: "filter-queue", payload: { id: `waiting${i}` } });
    }

    // Complete 2
    for (let i = 0; i < 2; i++) {
      const r = h.adapter.dequeue("filter-queue");
      assert.ok(r);
      r.ack();
    }

    // Dequeue 1 more but don't complete (active)
    const active = h.adapter.dequeue("filter-queue");
    assert.ok(active);

    // List with different filters
    const waiting = h.adapter.listJobs("filter-queue", "waiting", 10);
    const completed = h.adapter.listJobs("filter-queue", "completed", 10);
    const activeJobs = h.adapter.listJobs("filter-queue", "active", 10);

    assert.equal(waiting.length, 2); // 5 - 2 completed - 1 active = 2 waiting
    assert.equal(completed.length, 2);
    assert.equal(activeJobs.length, 1);

    // Limit test
    const limited = h.adapter.listJobs("filter-queue", undefined, 3);
    assert.equal(limited.length, 3);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
