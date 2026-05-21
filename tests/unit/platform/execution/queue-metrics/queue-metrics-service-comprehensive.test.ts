/**
 * Queue Metrics Service Comprehensive Tests
 *
 * Tests for the QueueMetricsService that aggregates metrics across multiple queues.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { QueueMetricsService, type QueueMetrics, type QueueMetricsSnapshot } from "../../../../../../src/platform/five-plane-execution/queue-metrics/index.js";

test("QueueMetricsService can be instantiated", () => {
  const service = new QueueMetricsService();
  assert.ok(service instanceof QueueMetricsService);
});

test("QueueMetricsService.recordDepth stores depth for queue", () => {
  const service = new QueueMetricsService();
  service.recordDepth("test-queue", 10);
  const metrics = service.getQueueMetrics("test-queue");
  assert.equal(metrics?.depth, 10);
});

test("QueueMetricsService.recordEnqueue increments counter", () => {
  const service = new QueueMetricsService();
  service.recordEnqueue("test-queue");
  service.recordEnqueue("test-queue");
  const snapshot = service.getSnapshot();
  assert.equal(snapshot.enqueuedPerMinute.get("test-queue"), 2);
});

test("QueueMetricsService.recordDequeue increments counter", () => {
  const service = new QueueMetricsService();
  service.recordDequeue("test-queue");
  const snapshot = service.getSnapshot();
  assert.equal(snapshot.dequeuedPerMinute.get("test-queue"), 1);
});

test("QueueMetricsService.recordWaitTime stores wait time", () => {
  const service = new QueueMetricsService();
  service.recordWaitTime("test-queue", 100);
  service.recordWaitTime("test-queue", 200);
  const snapshot = service.getSnapshot();
  assert.equal(snapshot.averageWaitTimeMs.get("test-queue"), 150);
});

test("QueueMetricsService.recordWaitTime handles multiple queues", () => {
  const service = new QueueMetricsService();
  service.recordWaitTime("queue1", 100);
  service.recordWaitTime("queue2", 200);
  const snapshot = service.getSnapshot();
  assert.equal(snapshot.averageWaitTimeMs.get("queue1"), 100);
  assert.equal(snapshot.averageWaitTimeMs.get("queue2"), 200);
});

test("QueueMetricsService.recordFailed increments failed counter", () => {
  const service = new QueueMetricsService();
  service.recordFailed("test-queue", "timeout");
  service.recordFailed("test-queue", "error");
  const snapshot = service.getSnapshot();
  assert.equal(snapshot.failedJobs.get("test-queue"), 2);
});

test("QueueMetricsService.deriveFromStats calculates depth from stats", () => {
  const service = new QueueMetricsService();
  service.deriveFromStats({
    queueName: "test-queue",
    waiting: 5,
    delayed: 3,
    active: 2,
    failed: 1,
    deadLetter: 0,
  });
  const metrics = service.getQueueMetrics("test-queue");
  assert.equal(metrics?.depth, 10); // 5 + 3 + 2
});

test("QueueMetricsService.deriveFromStats updates failed count", () => {
  const service = new QueueMetricsService();
  service.deriveFromStats({
    queueName: "test-queue",
    waiting: 0,
    delayed: 0,
    active: 0,
    failed: 5,
    deadLetter: 2,
  });
  const snapshot = service.getSnapshot();
  assert.equal(snapshot.failedJobs.get("test-queue"), 7); // 5 + 2
});

test("QueueMetricsService.getSnapshot returns correct structure", () => {
  const service = new QueueMetricsService();
  service.recordDepth("q1", 10);
  service.recordEnqueue("q1");
  const snapshot = service.getSnapshot();

  assert.ok(typeof snapshot.timestamp === "string");
  assert.ok(snapshot.queues instanceof Map);
  assert.ok(snapshot.enqueuedPerMinute instanceof Map);
  assert.ok(snapshot.dequeuedPerMinute instanceof Map);
  assert.ok(snapshot.averageWaitTimeMs instanceof Map);
  assert.ok(snapshot.p95WaitTimeMs instanceof Map);
  assert.ok(snapshot.failedJobs instanceof Map);
  assert.ok(snapshot.successRate instanceof Map);
});

test("QueueMetricsService.getSnapshot includes timestamp", () => {
  const service = new QueueMetricsService();
  const snapshot = service.getSnapshot();
  assert.ok(snapshot.timestamp.length > 0);
  assert.ok(snapshot.timestamp.includes("T"));
});

test("QueueMetricsService.getQueueMetrics returns undefined for unknown queue", () => {
  const service = new QueueMetricsService();
  const result = service.getQueueMetrics("nonexistent");
  assert.equal(result, undefined);
});

test("QueueMetricsService.getQueueMetrics returns correct structure", () => {
  const service = new QueueMetricsService();
  service.recordDepth("test-queue", 10);
  service.recordEnqueue("test-queue");
  service.recordDequeue("test-queue");
  service.recordWaitTime("test-queue", 150);

  const metrics = service.getQueueMetrics("test-queue");
  assert.ok(metrics !== undefined);
  assert.equal(metrics!.queueName, "test-queue");
  assert.equal(metrics!.depth, 10);
  assert.equal(metrics!.enqueuedPerMinute, 1);
  assert.equal(metrics!.dequeuedPerMinute, 1);
  assert.equal(metrics!.averageWaitTimeMs, 150);
});

test("QueueMetricsService.getAllQueues returns list of tracked queues", () => {
  const service = new QueueMetricsService();
  service.recordDepth("q1", 1);
  service.recordDepth("q2", 2);
  service.recordDepth("q3", 3);

  const queues = service.getAllQueues();
  assert.equal(queues.length, 3);
  assert.ok(queues.includes("q1"));
  assert.ok(queues.includes("q2"));
  assert.ok(queues.includes("q3"));
});

test("QueueMetricsService.getAllQueues returns empty for no queues", () => {
  const service = new QueueMetricsService();
  const queues = service.getAllQueues();
  assert.deepEqual(queues, []);
});

test("QueueMetricsService.getCollector creates new collector", () => {
  const service = new QueueMetricsService();
  const collector = service.getCollector("new-queue");
  assert.ok(collector !== undefined);
  assert.equal(collector.queueName, "new-queue");
});

test("QueueMetricsService.getCollector returns existing collector", () => {
  const service = new QueueMetricsService();
  const c1 = service.getCollector("shared-queue");
  const c2 = service.getCollector("shared-queue");
  assert.strictEqual(c1, c2);
});

test("QueueMetricsService.reset clears all state", () => {
  const service = new QueueMetricsService();
  service.recordDepth("q1", 10);
  service.recordEnqueue("q1");
  service.recordDequeue("q1");
  service.recordWaitTime("q1", 100);
  service.recordFailed("q1", "error");

  service.reset();

  const snapshot = service.getSnapshot();
  assert.equal(snapshot.queues.size, 0);
  assert.equal(snapshot.enqueuedPerMinute.size, 0);
  assert.equal(snapshot.failedJobs.size, 0);
});

test("QueueMetricsService reset clears all collectors", () => {
  const service = new QueueMetricsService();
  service.getCollector("q1");

  service.reset();

  const queues = service.getAllQueues();
  assert.deepEqual(queues, []);
});

test("QueueMetricsService p95 wait time calculation", () => {
  const service = new QueueMetricsService();

  // Record 20 wait times: 10, 20, 30, ... 200
  for (let i = 1; i <= 20; i++) {
    service.recordWaitTime("test-queue", i * 10);
  }

  const snapshot = service.getSnapshot();
  // p95Index = ceil(20 * 0.95) - 1 = 19 - 1 = 18 -> 190
  // But the implementation uses max(0, Math.ceil(sorted.length * 0.95) - 1)
  // So p95Index = max(0, ceil(20 * 0.95) - 1) = max(0, 19 - 1) = 18 -> sorted[18] = 190
  const p95 = snapshot.p95WaitTimeMs.get("test-queue");
  assert.ok(p95 !== undefined);
  assert.ok(p95 >= 150); // Should be high percentile
});

test("QueueMetricsService success rate calculation", () => {
  const service = new QueueMetricsService();
  service.recordEnqueue("test-queue");
  service.recordEnqueue("test-queue");
  service.recordEnqueue("test-queue");
  service.recordFailed("test-queue", "error");

  const snapshot = service.getSnapshot();
  // Success rate = (enqueued - failed) / enqueued = (3 - 1) / 3 = 0.666...
  const rate = snapshot.successRate.get("test-queue");
  assert.ok(rate !== undefined);
  assert.ok(Math.abs(rate! - 2/3) < 0.01);
});

test("QueueMetricsService success rate is 1 when no failures", () => {
  const service = new QueueMetricsService();
  service.recordEnqueue("test-queue");
  service.recordEnqueue("test-queue");

  const snapshot = service.getSnapshot();
  assert.equal(snapshot.successRate.get("test-queue"), 1);
});

test("QueueMetricsService success rate is 0 when all failed", () => {
  const service = new QueueMetricsService();
  service.recordEnqueue("test-queue");
  service.recordFailed("test-queue", "error");

  const snapshot = service.getSnapshot();
  assert.equal(snapshot.successRate.get("test-queue"), 0);
});

test("QueueMetricsService multiple queues have independent metrics", () => {
  const service = new QueueMetricsService();

  service.recordDepth("q1", 10);
  service.recordDepth("q2", 20);
  service.recordEnqueue("q1");
  service.recordEnqueue("q2");
  service.recordEnqueue("q2");

  const m1 = service.getQueueMetrics("q1");
  const m2 = service.getQueueMetrics("q2");

  assert.equal(m1?.depth, 10);
  assert.equal(m2?.depth, 20);
  assert.equal(m1?.enqueuedPerMinute, 1);
  assert.equal(m2?.enqueuedPerMinute, 2);
});

test("QueueMetricsService average wait time of zero for no wait times", () => {
  const service = new QueueMetricsService();
  service.recordDepth("test-queue", 5);

  const snapshot = service.getSnapshot();
  assert.equal(snapshot.averageWaitTimeMs.get("test-queue"), 0);
});

test("QueueMetricsService p95 is zero when no wait times", () => {
  const service = new QueueMetricsService();
  service.recordDepth("test-queue", 5);

  const snapshot = service.getSnapshot();
  assert.equal(snapshot.p95WaitTimeMs.get("test-queue"), 0);
});

test("QueueMetrics interface structure", () => {
  const metrics: QueueMetrics = {
    queueName: "test",
    depth: 10,
    enqueuedPerMinute: 100,
    dequeuedPerMinute: 90,
    averageWaitTimeMs: 150,
  };

  assert.equal(metrics.queueName, "test");
  assert.equal(metrics.depth, 10);
});

test("QueueMetricsSnapshot interface structure", () => {
  const snapshot: QueueMetricsSnapshot = {
    timestamp: new Date().toISOString(),
    queues: new Map([["q1", 10]]),
    enqueuedPerMinute: new Map([["q1", 100]]),
    dequeuedPerMinute: new Map([["q1", 90]]),
    averageWaitTimeMs: new Map([["q1", 150]]),
    p95WaitTimeMs: new Map([["q1", 200]]),
    failedJobs: new Map([["q1", 5]]),
    successRate: new Map([["q1", 0.95]]),
  };

  assert.ok(snapshot.timestamp.length > 0);
  assert.equal(snapshot.queues.get("q1"), 10);
});