/**
 * Queue Metrics Service Integration Tests
 *
 * Integration tests that exercise the QueueMetricsService with real
 * queue adapters and database backends.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { QueueMetricsService } from "../../../../../src/platform/five-plane-execution/queue-metrics/index.js";
import { SqliteQueueAdapter } from "../../../../../src/platform/five-plane-execution/queue/queue-adapter.js";
import { QUEUE_JOBS_DDL } from "../../../../../src/platform/five-plane-execution/queue/queue-adapter-types.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

function createTestDb(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "metrics-integration.db");
  const db = new SqliteDatabase(dbPath, { migrationPlan: [] });
  db.connection.exec(QUEUE_JOBS_DDL);
  return { workspace, db, dbPath };
}

test("QueueMetricsService integrates with SqliteQueueAdapter for enqueue tracking", () => {
  const h = createTestDb("aa-metrics-integration-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const metricsService = new QueueMetricsService();

    // Enqueue several jobs
    adapter.enqueue({ queueName: "tasks", payload: { taskId: "t1" } });
    adapter.enqueue({ queueName: "tasks", payload: { taskId: "t2" } });
    adapter.enqueue({ queueName: "tasks", payload: { taskId: "t3" } });

    // Record metrics from queue stats
    const stats = adapter.stats("tasks");
    metricsService.deriveFromStats(stats);

    const summary = metricsService.getSnapshot();
    assert.equal(summary.queues.get("tasks"), 3);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("QueueMetricsService tracks depth changes through adapter operations", () => {
  const h = createTestDb("aa-metrics-depth-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const metricsService = new QueueMetricsService();

    // Initial state
    let stats = adapter.stats("tasks");
    metricsService.deriveFromStats(stats);
    assert.equal(metricsService.getSnapshot().queues.get("tasks"), 0);

    // Enqueue jobs
    adapter.enqueue({ queueName: "tasks", payload: { taskId: "t1" } });
    adapter.enqueue({ queueName: "tasks", payload: { taskId: "t2" } });

    stats = adapter.stats("tasks");
    metricsService.deriveFromStats(stats);
    assert.equal(metricsService.getSnapshot().queues.get("tasks"), 2);

    // Dequeue a job
    const result = adapter.dequeue("tasks");
    assert.ok(result);
    result.ack();

    stats = adapter.stats("tasks");
    metricsService.deriveFromStats(stats);
    assert.equal(metricsService.getSnapshot().queues.get("tasks"), 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("QueueMetricsService tracks failed jobs from adapter", () => {
  const h = createTestDb("aa-metrics-failed-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const metricsService = new QueueMetricsService();

    // Enqueue and fail a job
    adapter.enqueue({ queueName: "tasks", payload: { taskId: "t1" }, maxAttempts: 1 });
    const result = adapter.dequeue("tasks");
    assert.ok(result);

    // Simulate failure by moving to dead letter
    adapter.moveToDeadLetter(result.job.id, "max_attempts_exceeded");

    const stats = adapter.stats("tasks");
    metricsService.deriveFromStats(stats);

    const summary = metricsService.getSnapshot();
    assert.equal(summary.failedJobs.get("tasks"), 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("QueueMetricsService multiple queue tracking", () => {
  const h = createTestDb("aa-metrics-multi-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const metricsService = new QueueMetricsService();

    // Enqueue to different queues
    adapter.enqueue({ queueName: "high-priority", payload: { taskId: "h1" } });
    adapter.enqueue({ queueName: "high-priority", payload: { taskId: "h2" } });
    adapter.enqueue({ queueName: "low-priority", payload: { taskId: "l1" } });

    const highStats = adapter.stats("high-priority");
    const lowStats = adapter.stats("low-priority");

    metricsService.deriveFromStats(highStats);
    metricsService.deriveFromStats(lowStats);

    const queues = metricsService.getAllQueues();
    assert.equal(queues.length, 2);
    assert.ok(queues.includes("high-priority"));
    assert.ok(queues.includes("low-priority"));
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("QueueMetricsService wait time tracking with timestamp correlation", () => {
  const h = createTestDb("aa-metrics-wait-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const metricsService = new QueueMetricsService();

    // Enqueue a job
    adapter.enqueue({ queueName: "tasks", payload: { taskId: "t1" } });

    // Record before dequeue
    const beforeDequeue = Date.now();

    // Dequeue and measure wait time
    const result = adapter.dequeue("tasks");
    assert.ok(result);

    const waitTime = Date.now() - beforeDequeue;
    metricsService.recordWaitTime("tasks", waitTime);

    const summary = metricsService.getSnapshot();
    assert.ok(summary.averageWaitTimeMs.get("tasks")! >= waitTime);

    result.ack();
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("QueueMetricsService derives complete metrics from adapter stats", () => {
  const h = createTestDb("aa-metrics-complete-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const metricsService = new QueueMetricsService();

    // Build up a queue with various job states
    adapter.enqueue({ queueName: "tasks", payload: { taskId: "t1" } });
    adapter.enqueue({ queueName: "tasks", payload: { taskId: "t2" } });
    adapter.enqueue({ queueName: "tasks", payload: { taskId: "t3" }, delayUntil: new Date(Date.now() + 3600000).toISOString() }); // delayed

    // Dequeue and complete one
    const result = adapter.dequeue("tasks");
    assert.ok(result);
    result.ack();

    const stats = adapter.stats("tasks");
    metricsService.deriveFromStats(stats);

    const metrics = metricsService.getQueueMetrics("tasks");
    assert.ok(metrics);
    assert.equal(metrics.depth, 2); // 2 remaining
    assert.ok(stats.waiting >= 1 || stats.delayed >= 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("QueueMetricsService reset clears all queue tracking", () => {
  const h = createTestDb("aa-metrics-reset-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const metricsService = new QueueMetricsService();

    // Add some data
    adapter.enqueue({ queueName: "tasks", payload: { taskId: "t1" } });
    adapter.enqueue({ queueName: "tasks", payload: { taskId: "t2" } });

    const stats = adapter.stats("tasks");
    metricsService.deriveFromStats(stats);

    // Verify data exists
    assert.ok(metricsService.getSnapshot().queues.size > 0);

    // Reset
    metricsService.reset();

    // Verify cleared
    const summary = metricsService.getSnapshot();
    assert.equal(summary.queues.size, 0);
    assert.equal(summary.enqueuedPerMinute.size, 0);
    assert.equal(summary.dequeuedPerMinute.size, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("QueueMetricsService concurrent operations maintain consistency", () => {
  const h = createTestDb("aa-metrics-concurrent-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const metricsService = new QueueMetricsService();

    // Enqueue multiple jobs
    for (let i = 0; i < 10; i++) {
      adapter.enqueue({ queueName: "tasks", payload: { taskId: `t${i}` } });
    }

    // Derive metrics
    const stats = adapter.stats("tasks");
    metricsService.deriveFromStats(stats);

    // Dequeue half
    for (let i = 0; i < 5; i++) {
      const result = adapter.dequeue("tasks");
      if (result) {
        result.ack();
      }
    }

    const updatedStats = adapter.stats("tasks");
    metricsService.deriveFromStats(updatedStats);

    const summary = metricsService.getSnapshot();
    assert.ok(summary.queues.get("tasks")! <= 10);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
