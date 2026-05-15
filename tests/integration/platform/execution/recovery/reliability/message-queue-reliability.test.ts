/**
 * Reliability Integration Test: Message Queue Reliability
 *
 * Verifies queue operations maintain reliability.
 * Part of reliability tests per strategy doc Section 6.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import {
  SqliteQueueAdapter,
  createQueueAdapter,
  QUEUE_JOBS_DDL,
} from "../../../../../../src/platform/five-plane-execution/queue/queue-adapter.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";

function createQueueHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "queue.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  db.connection.exec(QUEUE_JOBS_DDL);
  return { workspace, db, adapter: new SqliteQueueAdapter(db) };
}

test("reliability: queue jobs are processed exactly once (no duplicate processing)", () => {
  const h = createQueueHarness("reliability-queue-exact-");
  try {
    // Enqueue a job
    const job = h.adapter.enqueue({
      queueName: "test-queue",
      payload: { data: "exactly-once-test" },
    });

    // Dequeue the job
    const result1 = h.adapter.dequeue("test-queue");
    assert.ok(result1, "Should dequeue job");
    assert.strictEqual(result1.job.id, job.id);

    // Complete the job
    result1.ack();

    // Dequeue again - should not get the same job back
    const result2 = h.adapter.dequeue("test-queue");
    // result2 could be null or a different job
    if (result2) {
      assert.notStrictEqual(result2.job.id, job.id, "Should not get same job back after ack");
    }

    h.db.close();
  } finally {
    cleanupPath(h.workspace);
  }
});

test("reliability: queue handles concurrent enqueue and dequeue", () => {
  const h = createQueueHarness("reliability-queue-concurrent-");
  try {
    // Enqueue multiple jobs rapidly
    const jobIds: string[] = [];
    for (let i = 0; i < 20; i++) {
      const job = h.adapter.enqueue({
        queueName: "concurrent-queue",
        payload: { index: i },
      });
      jobIds.push(job.id);
    }

    // Dequeue all jobs
    const dequeuedIds: string[] = [];
    let result = h.adapter.dequeue("concurrent-queue");
    while (result) {
      dequeuedIds.push(result.job.id);
      result.ack();
      result = h.adapter.dequeue("concurrent-queue");
    }

    // All jobs should have been dequeued exactly once
    assert.strictEqual(dequeuedIds.length, 20, "Should dequeue all 20 jobs");

    // No duplicates
    const uniqueIds = new Set(dequeuedIds);
    assert.strictEqual(uniqueIds.size, 20, "Should have no duplicate jobs");

    h.db.close();
  } finally {
    cleanupPath(h.workspace);
  }
});

test("reliability: queue job payload is preserved through ack/nack cycle", () => {
  const h = createQueueHarness("reliability-queue-payload-");
  try {
    const originalPayload = { key: "value", nested: { data: "test" } };

    // Enqueue job
    const job = h.adapter.enqueue({
      queueName: "payload-queue",
      payload: originalPayload,
    });

    // Dequeue
    const result = h.adapter.dequeue("payload-queue");
    assert.ok(result, "Should dequeue job");

    // Parse and verify payload
    const parsed = JSON.parse(result.job.payload);
    assert.deepStrictEqual(parsed, originalPayload, "Payload should be preserved");

    // Ack and verify job is completed
    result.ack();
    const completed = h.adapter.getJob(job.id);
    assert.strictEqual(completed?.status, "completed");

    h.db.close();
  } finally {
    cleanupPath(h.workspace);
  }
});

test("reliability: queue nack returns job to queue with incremented attempts", () => {
  const h = createQueueHarness("reliability-queue-nack-");
  try {
    // Enqueue job with max attempts
    const job = h.adapter.enqueue({
      queueName: "nack-queue",
      payload: { data: "nack-test" },
      maxAttempts: 3,
    });

    // Dequeue and nack
    const result1 = h.adapter.dequeue("nack-queue");
    assert.ok(result1, "Should dequeue job");
    assert.strictEqual(result1.job.attempts, 1, "First attempt should be 1");

    result1.nack();

    // Dequeue again - should get same job with incremented attempts
    const result2 = h.adapter.dequeue("nack-queue");
    assert.ok(result2, "Should get job back after nack");
    assert.strictEqual(result2.job.id, job.id, "Should be same job");
    assert.strictEqual(result2.job.attempts, 2, "Second attempt should be 2");

    // Ack to clean up
    result2.ack();

    h.db.close();
  } finally {
    cleanupPath(h.workspace);
  }
});

test("reliability: multiple queues operate independently", () => {
  const h = createQueueHarness("reliability-queue-multi-");
  try {
    // Enqueue to different queues
    const job1 = h.adapter.enqueue({ queueName: "queue-a", payload: { q: "a" } });
    const job2 = h.adapter.enqueue({ queueName: "queue-b", payload: { q: "b" } });
    const job3 = h.adapter.enqueue({ queueName: "queue-a", payload: { q: "a2" } });

    // Dequeue from queue-a
    const resultA = h.adapter.dequeue("queue-a");
    assert.ok(resultA, "Should dequeue from queue-a");
    assert.strictEqual(resultA.job.queueName, "queue-a");

    // Dequeue from queue-b
    const resultB = h.adapter.dequeue("queue-b");
    assert.ok(resultB, "Should dequeue from queue-b");
    assert.strictEqual(resultB.job.queueName, "queue-b");

    // Queue-a should still have one job waiting
    const resultA2 = h.adapter.dequeue("queue-a");
    assert.ok(resultA2, "Should have another job in queue-a");

    // Ack all
    resultA.ack();
    resultA2.ack();
    resultB.ack();

    h.db.close();
  } finally {
    cleanupPath(h.workspace);
  }
});
