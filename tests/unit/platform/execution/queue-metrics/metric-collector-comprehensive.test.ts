/**
 * Queue Metric Collector Comprehensive Tests
 *
 * Tests for the QueueMetricCollector class that tracks individual queue metrics.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { QueueMetricCollector } from "../../../../../src/platform/five-plane-execution/queue-metrics/index.js";

test("QueueMetricCollector can be instantiated with name", () => {
  const collector = new QueueMetricCollector("test-queue");
  assert.ok(collector instanceof QueueMetricCollector);
  assert.equal(collector.queueName, "test-queue");
});

test("QueueMetricCollector recordEnqueue increments enqueued counter", () => {
  const collector = new QueueMetricCollector("test");

  collector.recordEnqueue();
  collector.recordEnqueue();
  collector.recordEnqueue();

  const snapshot = collector.snapshot();
  assert.equal(snapshot.totalEnqueued, 3);
});

test("QueueMetricCollector recordDequeue increments dequeued counter", () => {
  const collector = new QueueMetricCollector("test");

  collector.recordEnqueue();
  collector.recordDequeue();

  const snapshot = collector.snapshot();
  assert.equal(snapshot.totalDequeued, 1);
});

test("QueueMetricCollector recordFailed increments failed counter", () => {
  const collector = new QueueMetricCollector("test");

  collector.recordFailed("error");
  collector.recordFailed("timeout");

  const snapshot = collector.snapshot();
  assert.equal(snapshot.totalFailed, 2);
  assert.deepEqual(snapshot.failureReasons, ["error", "timeout"]);
});

test("QueueMetricCollector recordWaitTime adds to wait times", () => {
  const collector = new QueueMetricCollector("test");

  collector.recordWaitTime(100);
  collector.recordWaitTime(200);

  const snapshot = collector.snapshot();
  assert.deepEqual(snapshot.waitTimes, [100, 200]);
});

test("QueueMetricCollector snapshot calculates average wait time", () => {
  const collector = new QueueMetricCollector("test");

  collector.recordWaitTime(100);
  collector.recordWaitTime(200);
  collector.recordWaitTime(300);

  const snapshot = collector.snapshot();
  assert.equal(snapshot.averageWaitTimeMs, 200);
});

test("QueueMetricCollector snapshot calculates depth", () => {
  const collector = new QueueMetricCollector("test");

  collector.recordEnqueue();
  collector.recordEnqueue();
  collector.recordDequeue();

  const snapshot = collector.snapshot();
  assert.equal(snapshot.depth, 1);
});

test("QueueMetricCollector reset clears all counters", () => {
  const collector = new QueueMetricCollector("test");

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
  assert.deepEqual(snapshot.waitTimes, []);
  assert.deepEqual(snapshot.failureReasons, []);
});

test("QueueMetricCollector snapshot returns correct structure", () => {
  const collector = new QueueMetricCollector("test");

  collector.recordEnqueue();
  collector.recordWaitTime(150);

  const snapshot = collector.snapshot();

  assert.equal(snapshot.queueName, "test");
  assert.ok(typeof snapshot.timestamp === "number");
  assert.ok(typeof snapshot.totalEnqueued === "number");
  assert.ok(typeof snapshot.totalDequeued === "number");
  assert.ok(typeof snapshot.totalFailed === "number");
  assert.ok(typeof snapshot.depth === "number");
  assert.ok(typeof snapshot.averageWaitTimeMs === "number");
  assert.ok(typeof snapshot.p95WaitTimeMs === "number");
  assert.ok(typeof snapshot.p99WaitTimeMs === "number");
  assert.ok(Array.isArray(snapshot.waitTimes));
  assert.ok(Array.isArray(snapshot.failureReasons));
  assert.ok(typeof snapshot.enqueuedPerMinute === "number");
  assert.ok(typeof snapshot.dequeuedPerMinute === "number");
  assert.ok(typeof snapshot.throughputPerMinute === "number");
  assert.ok(typeof snapshot.failureRate === "number");
  assert.ok(typeof snapshot.successRate === "number");
});

test("QueueMetricCollector empty snapshot has zero values", () => {
  const collector = new QueueMetricCollector("test");

  const snapshot = collector.snapshot();

  assert.equal(snapshot.totalEnqueued, 0);
  assert.equal(snapshot.totalDequeued, 0);
  assert.equal(snapshot.totalFailed, 0);
  assert.equal(snapshot.depth, 0);
  assert.equal(snapshot.averageWaitTimeMs, 0);
  assert.deepEqual(snapshot.waitTimes, []);
  assert.deepEqual(snapshot.failureReasons, []);
});

test("QueueMetricCollector p95 calculation with 20 values", () => {
  const collector = new QueueMetricCollector("test");

  // 20 wait times: 10, 20, ..., 200
  for (let i = 1; i <= 20; i++) {
    collector.recordWaitTime(i * 10);
  }

  const snapshot = collector.snapshot();
  // p95Index = floor(20 * 0.95) = 19
  // sortedWaitTimes[19] = 200
  assert.equal(snapshot.p95WaitTimeMs, 200);
});

test("QueueMetricCollector p99 calculation with 100 values", () => {
  const collector = new QueueMetricCollector("test");

  // 100 wait times: 1, 2, ..., 100
  for (let i = 1; i <= 100; i++) {
    collector.recordWaitTime(i);
  }

  const snapshot = collector.snapshot();
  // p99Index = floor(100 * 0.99) = 99
  // sortedWaitTimes[99] = 100
  assert.equal(snapshot.p99WaitTimeMs, 100);
});

test("QueueMetricCollector p95 handles small dataset", () => {
  const collector = new QueueMetricCollector("test");

  collector.recordWaitTime(50);
  collector.recordWaitTime(100);

  const snapshot = collector.snapshot();
  // With only 2 values, p95 should be the highest value
  assert.ok(snapshot.p95WaitTimeMs >= 50);
});

test("QueueMetricCollector failureRate calculation", () => {
  const collector = new QueueMetricCollector("test");

  collector.recordEnqueue();
  collector.recordEnqueue();
  collector.recordEnqueue();
  collector.recordEnqueue();
  collector.recordFailed("error");

  const snapshot = collector.snapshot();
  assert.equal(snapshot.failureRate, 0.25); // 1/4
});

test("QueueMetricCollector successRate calculation", () => {
  const collector = new QueueMetricCollector("test");

  collector.recordEnqueue();
  collector.recordEnqueue();
  collector.recordEnqueue();
  collector.recordEnqueue();
  collector.recordFailed("error");

  const snapshot = collector.snapshot();
  assert.equal(snapshot.successRate, 0.75); // 3/4
});

test("QueueMetricCollector failureRate is 0 with no enqueues", () => {
  const collector = new QueueMetricCollector("test");

  collector.recordFailed("error");

  const snapshot = collector.snapshot();
  assert.equal(snapshot.failureRate, 0);
});

test("QueueMetricCollector successRate is 1 with no enqueues", () => {
  const collector = new QueueMetricCollector("test");

  const snapshot = collector.snapshot();
  assert.equal(snapshot.successRate, 1);
});

test("QueueMetricCollector throughputPerMinute is enqueued minus dequeued", () => {
  const collector = new QueueMetricCollector("test");

  collector.recordEnqueue();
  collector.recordEnqueue();
  collector.recordEnqueue();
  collector.recordDequeue();

  const snapshot = collector.snapshot();
  assert.equal(snapshot.throughputPerMinute, 2);
});

test("QueueMetricCollector depth can go negative", () => {
  const collector = new QueueMetricCollector("test");

  // Dequeue without any enqueue
  collector.recordDequeue();

  const snapshot = collector.snapshot();
  assert.equal(snapshot.depth, -1);
});

test("QueueMetricCollector multiple failures record all reasons", () => {
  const collector = new QueueMetricCollector("test");

  collector.recordFailed("timeout");
  collector.recordFailed("connection_refused");
  collector.recordFailed("invalid_payload");

  const snapshot = collector.snapshot();
  assert.deepEqual(snapshot.failureReasons, ["timeout", "connection_refused", "invalid_payload"]);
});

test("QueueMetricCollector waitTimes are sorted for percentile calculation", () => {
  const collector = new QueueMetricCollector("test");

  collector.recordWaitTime(300);
  collector.recordWaitTime(100);
  collector.recordWaitTime(200);

  const snapshot = collector.snapshot();
  // p95 of [100, 200, 300] should be 300
  assert.equal(snapshot.p95WaitTimeMs, 300);
});

test("QueueMetricCollector can be used for concurrent queue simulation", () => {
  const collector = new QueueMetricCollector("concurrent-queue");

  // Simulate 100 items enqueued over time
  for (let i = 0; i < 100; i++) {
    collector.recordEnqueue();
  }

  // Simulate 95 items dequeued
  for (let i = 0; i < 95; i++) {
    collector.recordDequeue();
  }

  // 5 failures
  for (let i = 0; i < 5; i++) {
    collector.recordFailed("simulated_failure");
  }

  const snapshot = collector.snapshot();
  assert.equal(snapshot.totalEnqueued, 100);
  assert.equal(snapshot.totalDequeued, 95);
  assert.equal(snapshot.totalFailed, 5);
  assert.equal(snapshot.depth, 5);
  assert.equal(snapshot.failureRate, 0.05);
});