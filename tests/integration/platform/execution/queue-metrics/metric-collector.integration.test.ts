/**
 * Queue Metric Collectors Integration Tests
 *
 * Integration tests that exercise the QueueMetricCollector with real
 * queue adapters and database operations.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { QueueMetricCollector } from "../../../../unit/platform/execution/queue-metrics/test-fixture.js";
import { SqliteQueueAdapter } from "../../../../../src/platform/execution/queue/queue-adapter.js";
import { QUEUE_JOBS_DDL } from "../../../../../src/platform/execution/queue/queue-adapter-types.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

function createTestDb(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "collector-integration.db");
  const db = new SqliteDatabase(dbPath, { migrationPlan: [] });
  db.connection.exec(QUEUE_JOBS_DDL);
  return { workspace, db, dbPath };
}

test("QueueMetricCollector tracks job lifecycle through adapter", () => {
  const h = createTestDb("aa-collector-lifecycle-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const collector = new QueueMetricCollector("tasks");

    // Enqueue
    const job = adapter.enqueue({ queueName: "tasks", payload: { taskId: "t1" } });
    collector.recordEnqueue();

    // Dequeue
    const result = adapter.dequeue("tasks");
    assert.ok(result);
    collector.recordDequeue();

    // Complete
    result.ack();
    const completed = adapter.getJob(job.id);
    assert.equal(completed?.status, "completed");

    const snapshot = collector.snapshot();
    assert.equal(snapshot.totalEnqueued, 1);
    assert.equal(snapshot.totalDequeued, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("QueueMetricCollector tracks failed job lifecycle", () => {
  const h = createTestDb("aa-collector-failed-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const collector = new QueueMetricCollector("tasks");

    // Enqueue with limited attempts
    adapter.enqueue({ queueName: "tasks", payload: { taskId: "t1" }, maxAttempts: 1 });

    // Dequeue
    const result = adapter.dequeue("tasks");
    assert.ok(result);

    // Move to dead letter
    adapter.moveToDeadLetter(result.job.id, "max_attempts_exceeded");
    collector.recordFailed("max_attempts_exceeded");

    const snapshot = collector.snapshot();
    assert.equal(snapshot.totalFailed, 1);
    assert.deepEqual(snapshot.failureReasons, ["max_attempts_exceeded"]);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("QueueMetricCollector tracks multiple queue collectors", () => {
  const h = createTestDb("aa-collector-multi-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);

    const highPriorityCollector = new QueueMetricCollector("high-priority");
    const lowPriorityCollector = new QueueMetricCollector("low-priority");

    // High priority: 3 enqueued, 2 dequeued
    adapter.enqueue({ queueName: "high-priority", payload: { taskId: "h1" } });
    highPriorityCollector.recordEnqueue();
    adapter.enqueue({ queueName: "high-priority", payload: { taskId: "h2" } });
    highPriorityCollector.recordEnqueue();
    adapter.enqueue({ queueName: "high-priority", payload: { taskId: "h3" } });
    highPriorityCollector.recordEnqueue();

    adapter.dequeue("high-priority");
    highPriorityCollector.recordDequeue();
    adapter.dequeue("high-priority");
    highPriorityCollector.recordDequeue();

    // Low priority: 1 enqueued
    adapter.enqueue({ queueName: "low-priority", payload: { taskId: "l1" } });
    lowPriorityCollector.recordEnqueue();

    const highSnapshot = highPriorityCollector.snapshot();
    const lowSnapshot = lowPriorityCollector.snapshot();

    assert.equal(highSnapshot.totalEnqueued, 3);
    assert.equal(highSnapshot.totalDequeued, 2);
    assert.equal(highSnapshot.depth, 1);
    assert.equal(lowSnapshot.totalEnqueued, 1);
    assert.equal(lowSnapshot.depth, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("QueueMetricCollector wait time correlation with adapter", async () => {
  const h = createTestDb("aa-collector-wait-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const collector = new QueueMetricCollector("tasks");

    // Enqueue job
    adapter.enqueue({ queueName: "tasks", payload: { taskId: "t1" } });
    collector.recordEnqueue();

    // Small delay before dequeue
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Dequeue and record wait time
    const beforeDequeue = Date.now();
    const result = adapter.dequeue("tasks");
    assert.ok(result);
    const waitTime = Date.now() - beforeDequeue;

    collector.recordWaitTime(waitTime);

    const snapshot = collector.snapshot();
    assert.ok(snapshot.averageWaitTimeMs >= waitTime - 50); // Allow some tolerance
    assert.ok(snapshot.waitTimes.length === 1);

    result.ack();
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("QueueMetricCollector derives state from adapter stats", () => {
  const h = createTestDb("aa-collector-stats-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const collector = new QueueMetricCollector("tasks");

    // Build up queue state
    adapter.enqueue({ queueName: "tasks", payload: { taskId: "t1" } });
    adapter.enqueue({ queueName: "tasks", payload: { taskId: "t2" } });
    adapter.enqueue({ queueName: "tasks", payload: { taskId: "t3" } });

    // Dequeue and complete
    const result = adapter.dequeue("tasks");
    assert.ok(result);
    result.ack();

    // Update collector based on stats
    collector.recordEnqueue(); // t1
    collector.recordEnqueue(); // t2
    collector.recordEnqueue(); // t3
    collector.recordDequeue(); // t1 dequeued

    const snapshot = collector.snapshot();
    assert.equal(snapshot.totalEnqueued, 3);
    assert.equal(snapshot.totalDequeued, 1);
    assert.equal(snapshot.depth, 2);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("QueueMetricCollector handles priority queue ordering", () => {
  const h = createTestDb("aa-collector-priority-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const collector = new QueueMetricCollector("priority-queue");

    // Enqueue with different priorities
    adapter.enqueue({ queueName: "pq", payload: "low", priority: 1 });
    collector.recordEnqueue();
    adapter.enqueue({ queueName: "pq", payload: "high", priority: 10 });
    collector.recordEnqueue();
    adapter.enqueue({ queueName: "pq", payload: "medium", priority: 5 });
    collector.recordEnqueue();

    // Dequeue in priority order
    const r1 = adapter.dequeue("pq");
    assert.ok(r1);
    collector.recordDequeue();
    assert.equal(JSON.parse(r1.job.payload), "high");

    const r2 = adapter.dequeue("pq");
    assert.ok(r2);
    collector.recordDequeue();
    assert.equal(JSON.parse(r2.job.payload), "medium");

    const r3 = adapter.dequeue("pq");
    assert.ok(r3);
    collector.recordDequeue();
    assert.equal(JSON.parse(r3.job.payload), "low");

    const snapshot = collector.snapshot();
    assert.equal(snapshot.totalEnqueued, 3);
    assert.equal(snapshot.totalDequeued, 3);
    assert.equal(snapshot.depth, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("QueueMetricCollector p95/p99 latency calculation with real data", () => {
  const h = createTestDb("aa-collector-latency-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const collector = new QueueMetricCollector("latency-test");

    // Simulate 20 jobs with varying wait times
    for (let i = 1; i <= 20; i++) {
      adapter.enqueue({ queueName: "latency-test", payload: { taskId: `t${i}` } });

      const beforeDequeue = Date.now();
      const result = adapter.dequeue("latency-test");
      if (result) {
        const waitTime = Date.now() - beforeDequeue;
        collector.recordEnqueue();
        collector.recordDequeue();
        collector.recordWaitTime(waitTime);
        result.ack();
      }
    }

    const snapshot = collector.snapshot();
    assert.ok(snapshot.p95WaitTimeMs !== null);
    assert.ok(snapshot.p99WaitTimeMs !== null);
    assert.ok(snapshot.p95WaitTimeMs! <= snapshot.p99WaitTimeMs!);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("QueueMetricCollector reset between operations", () => {
  const h = createTestDb("aa-collector-reset-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const collector = new QueueMetricCollector("tasks");

    // First batch
    adapter.enqueue({ queueName: "tasks", payload: { taskId: "t1" } });
    collector.recordEnqueue();
    adapter.enqueue({ queueName: "tasks", payload: { taskId: "t2" } });
    collector.recordEnqueue();

    let snapshot = collector.snapshot();
    assert.equal(snapshot.totalEnqueued, 2);

    // Reset
    collector.reset();

    // Second batch
    adapter.enqueue({ queueName: "tasks", payload: { taskId: "t3" } });
    collector.recordEnqueue();

    snapshot = collector.snapshot();
    assert.equal(snapshot.totalEnqueued, 1);
    assert.equal(snapshot.totalDequeued, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("QueueMetricCollector failure rate with real job outcomes", () => {
  const h = createTestDb("aa-collector-failure-rate-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const collector = new QueueMetricCollector("tasks");

    // 5 jobs enqueued
    for (let i = 1; i <= 5; i++) {
      adapter.enqueue({ queueName: "tasks", payload: { taskId: `t${i}` } });
      collector.recordEnqueue();
    }

    // 3 complete successfully, 2 fail
    for (let i = 1; i <= 3; i++) {
      const result = adapter.dequeue("tasks");
      if (result) {
        collector.recordDequeue();
        result.ack();
      }
    }

    for (let i = 1; i <= 2; i++) {
      const result = adapter.dequeue("tasks");
      if (result) {
        adapter.moveToDeadLetter(result.job.id, "processing_error");
        collector.recordFailed("processing_error");
      }
    }

    const snapshot = collector.snapshot();
    assert.equal(snapshot.totalEnqueued, 5);
    assert.equal(snapshot.totalDequeued, 3);
    assert.equal(snapshot.totalFailed, 2);
    assert.equal(snapshot.failureRate, 2 / 5);
    assert.equal(snapshot.successRate, 3 / 5);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
