import assert from "node:assert/strict";
import test from "node:test";

import { QueueMetricCollector } from "../../../../../src/platform/five-plane-execution/queue-metrics/index.js";

const WAIT_TIME_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_WAIT_TIMES = 10000;

test("QueueMetricCollector.evictExpiredWaitTimes removes entries older than WAIT_TIME_TTL_MS", () => {
  const collector = new QueueMetricCollector("test-queue");

  // Record a wait time from 2 hours ago
  const oldTime = Date.now() - (2 * WAIT_TIME_TTL_MS);
  collector.recordWaitTime(oldTime);

  // Record a recent wait time
  collector.recordWaitTime(Date.now());

  // Verify we have 2 entries before eviction
  let snapshot = collector.snapshot();
  assert.equal(snapshot.waitTimes.length, 2);

  // Evict expired entries
  collector.evictExpiredWaitTimes();

  // Verify only recent entry remains
  snapshot = collector.snapshot();
  assert.equal(snapshot.waitTimes.length, 1);
  assert.ok(snapshot.waitTimes[0]! >= Date.now() - 1000);
});

test("QueueMetricCollector enforces MAX_WAIT_TIMES limit", () => {
  const collector = new QueueMetricCollector("test-queue");

  // Record more wait times than the limit
  for (let i = 0; i < MAX_WAIT_TIMES + 1000; i++) {
    collector.recordWaitTime(Date.now());
  }

  const snapshot = collector.snapshot();
  assert.ok(snapshot.waitTimes.length <= MAX_WAIT_TIMES,
    `Wait times array should be bounded by MAX_WAIT_TIMES (${MAX_WAIT_TIMES}), got ${snapshot.waitTimes.length}`);
});

test("QueueMetricCollector waitTimes array does not grow unbounded", () => {
  const collector = new QueueMetricCollector("test-queue");

  // Record a large number of wait times over time with old timestamps
  const now = Date.now();
  for (let i = 0; i < 50000; i++) {
    // Mix of old and recent times
    const timestamp = i % 2 === 0 ? now - (2 * WAIT_TIME_TTL_MS) : now;
    collector.recordWaitTime(timestamp);
  }

  // Evict expired entries to prevent unbounded growth
  collector.evictExpiredWaitTimes();

  const snapshot = collector.snapshot();
  // After eviction, only recent entries should remain, bounded by MAX_WAIT_TIMES
  assert.ok(snapshot.waitTimes.length <= MAX_WAIT_TIMES,
    `Wait times array should be bounded after eviction, got ${snapshot.waitTimes.length}`);
});

test("QueueMetricCollector snapshot returns correct metrics without pruning internal arrays", () => {
  const collector = new QueueMetricCollector("test-queue");

  collector.recordEnqueue();
  collector.recordEnqueue();
  collector.recordDequeue();
  collector.recordFailed("error1");
  collector.recordWaitTime(100);
  collector.recordWaitTime(200);

  const snapshot = collector.snapshot();

  assert.equal(snapshot.queueName, "test-queue");
  assert.equal(snapshot.totalEnqueued, 2);
  assert.equal(snapshot.totalDequeued, 1);
  assert.equal(snapshot.totalFailed, 1);
  assert.equal(snapshot.depth, 1);
  assert.equal(snapshot.waitTimes.length, 2);
  assert.deepEqual(snapshot.waitTimes, [100, 200]);
  assert.deepEqual(snapshot.failureReasons, ["error1"]);
  assert.equal(snapshot.averageWaitTimeMs, 150);
});

test("QueueMetricCollector reset clears all data", () => {
  const collector = new QueueMetricCollector("test-queue");

  collector.recordEnqueue();
  collector.recordDequeue();
  collector.recordFailed("error");
  collector.recordWaitTime(100);

  collector.reset();

  const snapshot = collector.snapshot();
  assert.equal(snapshot.totalEnqueued, 0);
  assert.equal(snapshot.totalDequeued, 0);
  assert.equal(snapshot.totalFailed, 0);
  assert.equal(snapshot.depth, 0);
  assert.equal(snapshot.waitTimes.length, 0);
  assert.equal(snapshot.failureReasons.length, 0);
});

test("QueueMetricCollector handles empty state correctly", () => {
  const collector = new QueueMetricCollector("empty-queue");

  const snapshot = collector.snapshot();

  assert.equal(snapshot.queueName, "empty-queue");
  assert.equal(snapshot.totalEnqueued, 0);
  assert.equal(snapshot.totalDequeued, 0);
  assert.equal(snapshot.totalFailed, 0);
  assert.equal(snapshot.depth, 0);
  assert.equal(snapshot.waitTimes.length, 0);
  assert.equal(snapshot.failureReasons.length, 0);
  assert.equal(snapshot.averageWaitTimeMs, 0);
  assert.equal(snapshot.p95WaitTimeMs, 0);
  assert.equal(snapshot.p99WaitTimeMs, 0);
});

test("QueueMetricCollector snapshot returns copy of waitTimes array", () => {
  const collector = new QueueMetricCollector("test-queue");

  collector.recordWaitTime(100);
  collector.recordWaitTime(200);

  const snapshot1 = collector.snapshot();
  const snapshot2 = collector.snapshot();

  // Modifying returned array should not affect internal state
  snapshot1.waitTimes.push(999);

  const snapshot3 = collector.snapshot();
  assert.equal(snapshot3.waitTimes.length, 2);
  assert.deepEqual(snapshot3.waitTimes, [100, 200]);
});

test("QueueMetricCollector p95 and p99 calculations are correct", () => {
  const collector = new QueueMetricCollector("test-queue");

  // Record wait times 1 through 100
  for (let i = 1; i <= 100; i++) {
    collector.recordWaitTime(i);
  }

  const snapshot = collector.snapshot();

  // P95 of 1-100: index = floor(100 * 0.95) = 95, which is value 96 (0-indexed)
  assert.equal(snapshot.p95WaitTimeMs, 96);
  // P99 of 1-100: index = floor(100 * 0.99) = 99, which is value 100 (0-indexed)
  assert.equal(snapshot.p99WaitTimeMs, 100);
});

test("QueueMetricCollector evictExpiredWaitTimes handles all expired entries", () => {
  const collector = new QueueMetricCollector("test-queue");

  const now = Date.now();
  // All entries are expired (2 hours old)
  for (let i = 0; i < 100; i++) {
    collector.recordWaitTime(now - (2 * WAIT_TIME_TTL_MS));
  }

  collector.evictExpiredWaitTimes();

  const snapshot = collector.snapshot();
  assert.equal(snapshot.waitTimes.length, 0);
});

test("QueueMetricCollector evictExpiredWaitTimes handles no expired entries", () => {
  const collector = new QueueMetricCollector("test-queue");

  const now = Date.now();
  // All entries are recent
  for (let i = 0; i < 10; i++) {
    collector.recordWaitTime(now - 1000); // 1 second ago
  }

  collector.evictExpiredWaitTimes();

  const snapshot = collector.snapshot();
  assert.equal(snapshot.waitTimes.length, 10);
});

test("QueueMetricCollector MAX_WAIT_TIMES enforcement at boundary", () => {
  const collector = new QueueMetricCollector("test-queue");

  // Record exactly MAX_WAIT_TIMES
  for (let i = 0; i < MAX_WAIT_TIMES; i++) {
    collector.recordWaitTime(Date.now());
  }

  let snapshot = collector.snapshot();
  assert.equal(snapshot.waitTimes.length, MAX_WAIT_TIMES);

  // Record one more - should trigger limit
  collector.recordWaitTime(Date.now());

  snapshot = collector.snapshot();
  assert.ok(snapshot.waitTimes.length <= MAX_WAIT_TIMES);
});

test("QueueMetricCollector successRate and failureRate calculations", () => {
  const collector = new QueueMetricCollector("test-queue");

  collector.recordEnqueue();
  collector.recordEnqueue();
  collector.recordEnqueue();
  collector.recordEnqueue();
  collector.recordFailed("error");

  const snapshot = collector.snapshot();

  assert.equal(snapshot.failureRate, 0.25); // 1/4
  assert.equal(snapshot.successRate, 0.75); // 3/4
});

test("QueueMetricCollector throughputPerMinute calculation", () => {
  const collector = new QueueMetricCollector("test-queue");

  collector.recordEnqueue();
  collector.recordEnqueue();
  collector.recordEnqueue();
  collector.recordDequeue();

  const snapshot = collector.snapshot();

  assert.equal(snapshot.throughputPerMinute, 2); // enqueued - dequeued
});
