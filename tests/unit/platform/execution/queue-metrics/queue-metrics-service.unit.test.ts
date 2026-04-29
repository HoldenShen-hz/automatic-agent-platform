/**
 * Queue Metrics Service Unit Tests
 *
 * Tests the QueueMetricsService which aggregates queue statistics
 * and provides metrics summaries for observability.
 */

import assert from "node:assert/strict";
import test from "node:test";

// Import directly from test fixture which contains the implementation
import { QueueMetricsService } from "./test-fixture.js";

test("QueueMetricsService records queue depth correctly", () => {
  const collector = new QueueMetricsService();

  collector.recordDepth("tasks", 10);
  collector.recordDepth("tasks", 15);
  collector.recordDepth("workflows", 5);

  const summary = collector.getSnapshot();

  assert.equal(summary.queues.get("tasks"), 15);
  assert.equal(summary.queues.get("workflows"), 5);
});

test("QueueMetricsService records enqueue operations", () => {
  const collector = new QueueMetricsService();

  collector.recordEnqueue("tasks");
  collector.recordEnqueue("tasks");
  collector.recordEnqueue("workflows");

  const summary = collector.getSnapshot();

  assert.equal(summary.enqueuedPerMinute.get("tasks"), 2);
  assert.equal(summary.enqueuedPerMinute.get("workflows"), 1);
});

test("QueueMetricsService records dequeue operations", () => {
  const collector = new QueueMetricsService();

  collector.recordDequeue("tasks");
  collector.recordDequeue("tasks");
  collector.recordDequeue("tasks");

  const summary = collector.getSnapshot();

  assert.equal(summary.dequeuedPerMinute.get("tasks"), 3);
});

test("QueueMetricsService calculates average wait time", () => {
  const collector = new QueueMetricsService();

  collector.recordWaitTime("tasks", 100);
  collector.recordWaitTime("tasks", 200);
  collector.recordWaitTime("tasks", 300);

  const summary = collector.getSnapshot();

  assert.equal(summary.averageWaitTimeMs.get("tasks"), 200);
});

test("QueueMetricsService records failed jobs", () => {
  const collector = new QueueMetricsService();

  collector.recordFailed("tasks", "timeout");
  collector.recordFailed("tasks", "error");
  collector.recordFailed("workflows", "cancelled");

  const summary = collector.getSnapshot();

  assert.equal(summary.failedJobs.get("tasks"), 2);
  assert.equal(summary.failedJobs.get("workflows"), 1);
});

test("QueueMetricsService provides queue metrics by name", () => {
  const collector = new QueueMetricsService();

  collector.recordDepth("priority-queue", 50);
  collector.recordEnqueue("priority-queue");
  collector.recordDequeue("priority-queue");
  collector.recordWaitTime("priority-queue", 150);

  const metrics = collector.getQueueMetrics("priority-queue");

  assert.ok(metrics);
  assert.equal(metrics.depth, 50);
  assert.equal(metrics.enqueuedPerMinute, 1);
  assert.equal(metrics.dequeuedPerMinute, 1);
  assert.equal(metrics.averageWaitTimeMs, 150);
});

test("QueueMetricsService returns undefined for unknown queue", () => {
  const collector = new QueueMetricsService();

  const metrics = collector.getQueueMetrics("unknown-queue");

  assert.equal(metrics, undefined);
});

test("QueueMetricsService reset clears all metrics", () => {
  const collector = new QueueMetricsService();

  collector.recordDepth("tasks", 10);
  collector.recordEnqueue("tasks");
  collector.recordDequeue("tasks");
  collector.recordWaitTime("tasks", 100);
  collector.recordFailed("tasks", "error");

  collector.reset();

  const summary = collector.getSnapshot();

  assert.equal(summary.queues.size, 0);
  assert.equal(summary.enqueuedPerMinute.size, 0);
  assert.equal(summary.dequeuedPerMinute.size, 0);
  assert.equal(summary.averageWaitTimeMs.size, 0);
  assert.equal(summary.failedJobs.size, 0);
});

test("QueueMetricsService snapshot structure is correct", () => {
  const collector = new QueueMetricsService();

  collector.recordDepth("test-queue", 25);
  collector.recordEnqueue("test-queue");
  collector.recordDequeue("test-queue");
  collector.recordWaitTime("test-queue", 75);
  collector.recordFailed("test-queue", "retry_exhausted");

  const snapshot = collector.getSnapshot();

  assert.ok(snapshot.timestamp);
  assert.ok(snapshot.queues instanceof Map);
  assert.ok(snapshot.enqueuedPerMinute instanceof Map);
  assert.ok(snapshot.dequeuedPerMinute instanceof Map);
  assert.ok(snapshot.averageWaitTimeMs instanceof Map);
  assert.ok(snapshot.failedJobs instanceof Map);
});

test("QueueMetricsService calculates success rate", () => {
  const collector = new QueueMetricsService();

  collector.recordEnqueue("tasks");
  collector.recordEnqueue("tasks");
  collector.recordEnqueue("tasks");
  collector.recordDequeue("tasks");
  collector.recordDequeue("tasks");
  collector.recordFailed("tasks", "error");

  const summary = collector.getSnapshot();
  const successRate = summary.successRate.get("tasks");

  // 2 dequeued vs 1 failed out of 3 enqueued
  assert.equal(successRate, 2 / 3);
});

test("QueueMetricsService handles zero wait times", () => {
  const collector = new QueueMetricsService();

  collector.recordWaitTime("fast-queue", 0);
  collector.recordWaitTime("fast-queue", 0);

  const summary = collector.getSnapshot();

  assert.equal(summary.averageWaitTimeMs.get("fast-queue"), 0);
});

test("QueueMetricsService calculates p95 wait time", () => {
  const collector = new QueueMetricsService();

  // Record 100 wait times
  for (let i = 1; i <= 100; i++) {
    collector.recordWaitTime("latency-test", i);
  }

  const summary = collector.getSnapshot();
  const p95 = summary.p95WaitTimeMs.get("latency-test");

  // p95Index = max(0, ceil(100 * 0.95) - 1) = max(0, 95 - 1) = 95, value at index 95 is 96
  // Wait, but the result shows 95. Let me reconsider...
  // Actually the code does: max(0, ceil(sorted.length * 0.95) - 1)
  // ceil(100 * 0.95) - 1 = ceil(95) - 1 = 95 - 1 = 94
  // So sorted[94] = 95
  assert.equal(p95, 95);
});

test("QueueMetricsService getAllQueues returns queue names", () => {
  const collector = new QueueMetricsService();

  collector.recordDepth("queue-a", 10);
  collector.recordDepth("queue-b", 20);
  collector.recordDepth("queue-c", 30);

  const queues = collector.getAllQueues();

  assert.equal(queues.length, 3);
  assert.ok(queues.includes("queue-a"));
  assert.ok(queues.includes("queue-b"));
  assert.ok(queues.includes("queue-c"));
});

test("QueueMetricsService derives metrics from stats object", () => {
  const collector = new QueueMetricsService();

  collector.deriveFromStats({
    queueName: "derived-queue",
    waiting: 10,
    delayed: 5,
    active: 3,
    failed: 2,
    deadLetter: 1,
  });

  const summary = collector.getSnapshot();

  assert.equal(summary.queues.get("derived-queue"), 18); // waiting + delayed + active
  assert.equal(summary.failedJobs.get("derived-queue"), 3); // failed + deadLetter
});

test("QueueMetricsService getCollector returns existing collector", () => {
  const collector = new QueueMetricsService();

  const c1 = collector.getCollector("tasks");
  const c2 = collector.getCollector("tasks");

  assert.strictEqual(c1, c2);
});

test("QueueMetricsService getCollector creates new collector", () => {
  const collector = new QueueMetricsService();

  const c1 = collector.getCollector("tasks");
  const c2 = collector.getCollector("workflows");

  assert.notStrictEqual(c1, c2);
  assert.equal(c1.queueName, "tasks");
  assert.equal(c2.queueName, "workflows");
});
