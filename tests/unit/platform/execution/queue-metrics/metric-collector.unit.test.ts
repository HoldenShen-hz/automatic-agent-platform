/**
 * Queue Metric Collectors Unit Tests
 *
 * Tests the QueueMetricCollector which tracks individual queue operations
 * and provides aggregated statistics.
 */

import assert from "node:assert/strict";
import test from "node:test";

// Import directly from test fixture which contains the implementation
import { QueueMetricCollector } from "./test-fixture.js";

test("QueueMetricCollector records single enqueue [metric-collector.unit]", () => {
  const collector = new QueueMetricCollector("test-queue");

  collector.recordEnqueue();

  const snapshot = collector.snapshot();
  assert.equal(snapshot.totalEnqueued, 1);
  assert.equal(snapshot.depth, 1);
});

test("QueueMetricCollector records multiple enqueues [metric-collector.unit]", () => {
  const collector = new QueueMetricCollector("test-queue");

  collector.recordEnqueue();
  collector.recordEnqueue();
  collector.recordEnqueue();

  const snapshot = collector.snapshot();
  assert.equal(snapshot.totalEnqueued, 3);
  assert.equal(snapshot.depth, 3);
});

test("QueueMetricCollector records dequeue [metric-collector.unit]", () => {
  const collector = new QueueMetricCollector("test-queue");

  collector.recordEnqueue();
  collector.recordEnqueue();
  collector.recordDequeue();

  const snapshot = collector.snapshot();
  assert.equal(snapshot.totalDequeued, 1);
  assert.equal(snapshot.depth, 1);
});

test("QueueMetricCollector records wait time [metric-collector.unit]", () => {
  const collector = new QueueMetricCollector("test-queue");

  collector.recordWaitTime(150);
  collector.recordWaitTime(250);

  const snapshot = collector.snapshot();
  assert.equal(snapshot.averageWaitTimeMs, 200);
  assert.deepEqual(snapshot.waitTimes, [150, 250]);
});

test("QueueMetricCollector records failed job [metric-collector.unit]", () => {
  const collector = new QueueMetricCollector("test-queue");

  collector.recordEnqueue();
  collector.recordFailed("timeout");

  const snapshot = collector.snapshot();
  assert.equal(snapshot.totalFailed, 1);
  assert.deepEqual(snapshot.failureReasons, ["timeout"]);
});

test("QueueMetricCollector records multiple failure reasons [metric-collector.unit]", () => {
  const collector = new QueueMetricCollector("test-queue");

  collector.recordFailed("error");
  collector.recordFailed("timeout");
  collector.recordFailed("cancelled");

  const snapshot = collector.snapshot();
  assert.equal(snapshot.totalFailed, 3);
  assert.deepEqual(snapshot.failureReasons, ["error", "timeout", "cancelled"]);
});

test("QueueMetricCollector snapshot structure [metric-collector.unit]", () => {
  const collector = new QueueMetricCollector("test-queue");

  collector.recordEnqueue();
  collector.recordDequeue();
  collector.recordWaitTime(100);
  collector.recordFailed("error");

  const snapshot = collector.snapshot();

  assert.equal(snapshot.queueName, "test-queue");
  assert.ok(typeof snapshot.timestamp === "number");
  assert.ok(typeof snapshot.totalEnqueued === "number");
  assert.ok(typeof snapshot.totalDequeued === "number");
  assert.ok(typeof snapshot.totalFailed === "number");
  assert.ok(typeof snapshot.depth === "number");
  assert.ok(typeof snapshot.averageWaitTimeMs === "number");
  assert.ok(Array.isArray(snapshot.waitTimes));
  assert.ok(Array.isArray(snapshot.failureReasons));
});

test("QueueMetricCollector reset clears state [metric-collector.unit]", () => {
  const collector = new QueueMetricCollector("test-queue");

  collector.recordEnqueue();
  collector.recordEnqueue();
  collector.recordDequeue();
  collector.recordWaitTime(100);
  collector.recordFailed("error");

  collector.reset();

  const snapshot = collector.snapshot();
  assert.equal(snapshot.totalEnqueued, 0);
  assert.equal(snapshot.totalDequeued, 0);
  assert.equal(snapshot.totalFailed, 0);
  assert.equal(snapshot.depth, 0);
  assert.equal(snapshot.averageWaitTimeMs, 0);
  assert.deepEqual(snapshot.waitTimes, []);
  assert.deepEqual(snapshot.failureReasons, []);
});

test("QueueMetricCollector handles empty wait times array [metric-collector.unit]", () => {
  const collector = new QueueMetricCollector("test-queue");

  const snapshot = collector.snapshot();
  assert.equal(snapshot.averageWaitTimeMs, 0);
  assert.deepEqual(snapshot.waitTimes, []);
});

test("QueueMetricCollector calculates p95 latency [metric-collector.unit]", () => {
  const collector = new QueueMetricCollector("latency-queue");

  // Record 20 wait times
  for (let i = 1; i <= 20; i++) {
    collector.recordWaitTime(i * 10); // 10, 20, 30, ... 200
  }

  const snapshot = collector.snapshot();
  // p95Index = floor(20 * 0.95) = 19, so sortedWaitTimes[19] = 200 (0-indexed)
  assert.equal(snapshot.p95WaitTimeMs, 200);
});

test("QueueMetricCollector calculates p99 latency [metric-collector.unit]", () => {
  const collector = new QueueMetricCollector("latency-queue");

  // Record 100 wait times
  for (let i = 1; i <= 100; i++) {
    collector.recordWaitTime(i);
  }

  const snapshot = collector.snapshot();
  // p99Index = floor(100 * 0.99) = 99, so sortedWaitTimes[99] = 100
  assert.equal(snapshot.p99WaitTimeMs, 100);
});

test("QueueMetricCollector tracks depth correctly [metric-collector.unit]", () => {
  const collector = new QueueMetricCollector("depth-queue");

  collector.recordEnqueue();
  collector.recordEnqueue();
  assert.equal(collector.snapshot().depth, 2);

  collector.recordDequeue();
  assert.equal(collector.snapshot().depth, 1);

  collector.recordDequeue();
  assert.equal(collector.snapshot().depth, 0);
});

test("QueueMetricCollector handles negative depth gracefully [metric-collector.unit]", () => {
  const collector = new QueueMetricCollector("edge-queue");

  // Dequeue without prior enqueue
  collector.recordDequeue();

  const snapshot = collector.snapshot();
  assert.equal(snapshot.depth, -1);
});

test("QueueMetricCollector failure rate calculation [metric-collector.unit]", () => {
  const collector = new QueueMetricCollector("rate-queue");

  collector.recordEnqueue();
  collector.recordEnqueue();
  collector.recordEnqueue();
  collector.recordDequeue();
  collector.recordDequeue();
  collector.recordFailed("error");

  const snapshot = collector.snapshot();
  // 1 failed out of 3 enqueued
  assert.equal(snapshot.failureRate, 1 / 3);
});

test("QueueMetricCollector success rate calculation [metric-collector.unit]", () => {
  const collector = new QueueMetricCollector("success-queue");

  collector.recordEnqueue();
  collector.recordEnqueue();
  collector.recordEnqueue();
  collector.recordDequeue();
  collector.recordDequeue();
  collector.recordFailed("error");

  const snapshot = collector.snapshot();
  // 2 dequeued (potentially successful) out of 3 enqueued
  assert.equal(snapshot.successRate, 2 / 3);
});

test("QueueMetricCollector throughput calculation [metric-collector.unit]", () => {
  const collector = new QueueMetricCollector("throughput-queue");

  collector.recordEnqueue();
  collector.recordEnqueue();
  collector.recordEnqueue();
  collector.recordDequeue();

  const snapshot = collector.snapshot();
  assert.equal(snapshot.throughputPerMinute, 2); // enqueued - dequeued = 3 - 1
});

test("QueueMetricCollector queueName is exposed [metric-collector.unit]", () => {
  const collector = new QueueMetricCollector("my-special-queue");

  assert.equal(collector.queueName, "my-special-queue");
});
