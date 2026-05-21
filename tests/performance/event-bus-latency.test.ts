/**
 * Performance Test: Event Bus Latency Benchmarks
 * Measures event publishing, delivery, and subscription performance
 *
 * Design targets:
 * - Event publish throughput: >5000 events/sec
 * - Event delivery latency: <5ms P99
 * - Subscription throughput: >1000 events/sec per consumer
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { rmSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { reportSoftPerformanceMiss } from "../helpers/performance.js";

import { SqliteDatabase } from "../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { TypedEventBus } from "../../src/platform/five-plane-state-evidence/events/typed-event-bus.js";
import { newId, nowIso } from "../../src/platform/contracts/types/ids.js";

function createTempDb(): SqliteDatabase {
  const dbPath = join(".tmp", `event-bus-latency-${process.pid}-${Date.now()}.db`);
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  return db;
}

function cleanupDb(db: SqliteDatabase): void {
  rmSync(db.filePath, { force: true });
  rmSync(`${db.filePath}-wal`, { force: true });
  rmSync(`${db.filePath}-shm`, { force: true });
}

// ============================================================================
// Event Publish Throughput Benchmarks
// ============================================================================

test("event bus: Publish throughput >5000 events/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const eventBus = new TypedEventBus(db, store);

  try {
    const iterations = 1000;

    // Warmup
    for (let i = 0; i < 100; i++) {
      eventBus.publish({
        eventType: "perf:test_event",
        taskId: newId("task"),
        payload: { warmup: true, index: i },
      });
    }

    // Benchmark
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      eventBus.publish({
        eventType: "perf:test_event",
        taskId: newId("task"),
        payload: { index: i, timestamp: Date.now() },
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 5000,
        `Event publish throughput ${opsPerSec.toFixed(0)} events/sec must be >5000 events/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    eventBus.dispose();
    db.close();
    cleanupDb(db);
  }
});

test("event bus: Burst publish throughput >10000 events/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const eventBus = new TypedEventBus(db, store);

  try {
    const batchSize = 2000;

    // Warmup
    for (let i = 0; i < 100; i++) {
      eventBus.publish({
        eventType: "perf:burst_event",
        taskId: newId("task"),
        payload: { warmup: true },
      });
    }

    // Benchmark burst
    const start = performance.now();

    for (let i = 0; i < batchSize; i++) {
      eventBus.publish({
        eventType: "perf:burst_event",
        taskId: newId("task"),
        payload: { index: i, batch: "burst" },
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (batchSize / elapsed) * 1000;
    const avgLatencyMs = elapsed / batchSize;

    try {
      assert.ok(
        opsPerSec > 10000,
        `Burst publish throughput ${opsPerSec.toFixed(0)} events/sec must be >10000 events/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    eventBus.dispose();
    db.close();
    cleanupDb(db);
  }
});

// ============================================================================
// Event Publish Latency Benchmarks
// ============================================================================

test("event bus: Publish latency P99 <5ms", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const eventBus = new TypedEventBus(db, store);

  try {
    const latencies: number[] = [];
    const iterations = 500;

    // Warmup
    for (let i = 0; i < 100; i++) {
      eventBus.publish({
        eventType: "perf:test_event",
        taskId: newId("task"),
        payload: { warmup: true },
      });
    }

    // Measure
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      eventBus.publish({
        eventType: "perf:test_event",
        taskId: newId("task"),
        payload: { index: i },
      });
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 5,
        `Event publish P99 latency ${p99.toFixed(4)}ms exceeds 5ms target. P50: ${p50.toFixed(4)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    eventBus.dispose();
    db.close();
    cleanupDb(db);
  }
});

// ============================================================================
// Event Delivery Benchmarks
// ============================================================================

test("event bus: Delivery latency P99 <10ms", async (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const eventBus = new TypedEventBus(db, store);
  const consumerId = newId("consumer");

  try {
    const latencies: number[] = [];
    const iterations = 200;

    // Subscribe consumer
    let deliveredCount = 0;
    eventBus.subscribe(consumerId, ["perf:test_event"], async () => {
      deliveredCount++;
    });

    // Publish initial events
    for (let i = 0; i < 100; i++) {
      eventBus.publish({
        eventType: "perf:test_event",
        taskId: newId("task"),
        payload: { warmup: true },
      });
    }

    // Deliver warmup
    await eventBus.deliverPending(consumerId);

    // Measure delivery latency
    for (let i = 0; i < iterations; i++) {
      const publishStart = performance.now();
      eventBus.publish({
        eventType: "perf:test_event",
        taskId: newId("task"),
        payload: { index: i },
      });
      const publishTime = performance.now() - publishStart;

      const deliveryStart = performance.now();
      await eventBus.deliverPending(consumerId);
      const deliveryTime = performance.now() - deliveryStart;

      latencies.push(publishTime + deliveryTime);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 10,
        `Event delivery P99 latency ${p99.toFixed(4)}ms exceeds 10ms target. P50: ${p50.toFixed(4)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    eventBus.unsubscribe(consumerId);
    eventBus.dispose();
    db.close();
    cleanupDb(db);
  }
});

test("event bus: Batch delivery throughput >5000 events/sec", async (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const eventBus = new TypedEventBus(db, store);

  try {
    const consumerId = newId("consumer");
    const batchSize = 1000;

    // Subscribe consumer
    eventBus.subscribe(consumerId, ["perf:test_event"], async () => {});

    // Publish batch
    for (let i = 0; i < batchSize; i++) {
      eventBus.publish({
        eventType: "perf:test_event",
        taskId: newId("task"),
        payload: { index: i },
      });
    }

    // Benchmark delivery
    const start = performance.now();
    const delivered = await eventBus.deliverPending(consumerId);
    const elapsed = performance.now() - start;

    const opsPerSec = (delivered / elapsed) * 1000;

    try {
      assert.ok(
        opsPerSec > 5000,
        `Batch delivery throughput ${opsPerSec.toFixed(0)} events/sec must be >5000 events/sec`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    eventBus.dispose();
    db.close();
    cleanupDb(db);
  }
});

// ============================================================================
// Event Type Diversity Benchmarks
// ============================================================================

test("event bus: Multi-event-type publish throughput >3000 events/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const eventBus = new TypedEventBus(db, store);

  try {
    // Use perf event types which accept flexible payloads
    const eventTypes = [
      "perf:test_event",
      "perf:burst_event",
      "test:capacity",
      "test:many_events",
    ] as const;

    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const eventType = eventTypes[i % eventTypes.length]!;
      eventBus.publish({
        eventType,
        taskId: newId("task"),
        payload: { index: i, eventType, timestamp: Date.now() },
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 3000,
        `Multi-event-type throughput ${opsPerSec.toFixed(0)} events/sec must be >3000 events/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    eventBus.dispose();
    db.close();
    cleanupDb(db);
  }
});

// ============================================================================
// Subscription Management Benchmarks
// ============================================================================

test("event bus: Subscribe/unsubscribe throughput >1000 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const eventBus = new TypedEventBus(db, store);

  try {
    const iterations = 300;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const consumerId = newId("consumer");
      eventBus.subscribe(consumerId, ["perf:test_event"], async () => {});
      eventBus.unsubscribe(consumerId);
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 1000,
        `Subscribe/unsubscribe throughput ${opsPerSec.toFixed(0)} ops/sec must be >1000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    eventBus.dispose();
    db.close();
    cleanupDb(db);
  }
});

// ============================================================================
// High-Volume Stress Tests
// ============================================================================

test("event bus: Sustained high-volume throughput >8000 events/sec", async (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const eventBus = new TypedEventBus(db, store);

  try {
    const totalEvents = 5000;
    const start = performance.now();

    for (let i = 0; i < totalEvents; i++) {
      eventBus.publish({
        eventType: "perf:test_event",
        taskId: newId("task"),
        payload: { index: i, sustained: true },
      });

      // Small batch delivery every 1000 events
      if (i > 0 && i % 1000 === 0) {
        const consumerId = `consumer-${Math.floor(i / 1000)}`;
        eventBus.subscribe(consumerId, ["perf:test_event"], async () => {});
        await eventBus.deliverPending(consumerId);
      }
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (totalEvents / elapsed) * 1000;

    try {
      assert.ok(
        opsPerSec > 8000,
        `Sustained high-volume throughput ${opsPerSec.toFixed(0)} events/sec must be >8000 events/sec`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    eventBus.dispose();
    db.close();
    cleanupDb(db);
  }
});
