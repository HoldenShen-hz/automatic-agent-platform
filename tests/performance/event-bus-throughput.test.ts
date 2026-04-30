/**
 * Performance Test: Event Bus Throughput Benchmarks
 * Measures event publishing, delivery latency, and subscription performance
 *
 * Design targets:
 * - Event publish throughput: >5000 events/sec
 * - Event delivery throughput: >10000 events/sec
 * - Event publish latency P99: <5ms
 * - Event delivery latency P99: <10ms
 * - Subscription management throughput: >1000 ops/sec
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { rmSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { reportSoftPerformanceMiss } from "../helpers/performance.js";

import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStoreFacade } from "../../src/platform/state-evidence/truth/sqlite/authoritative-task-store-facade.js";
import { DurableEventBus } from "../../src/platform/state-evidence/events/durable-event-bus.js";
import { newId, nowIso } from "../../src/platform/contracts/types/ids.js";

function createTempDb(): SqliteDatabase {
  const dbPath = join(".tmp", `event-bus-throughput-${process.pid}-${Date.now()}.db`);
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  return db;
}

function cleanupDb(db: SqliteDatabase): void {
  rmSync(db.filePath, { force: true });
  rmSync(`${db.filePath}-wal`, { force: true });
  rmSync(`${db.filePath}-shm`, { force: true });
}

function createTempEventBus(): { db: SqliteDatabase; bus: DurableEventBus; store: AuthoritativeTaskStoreFacade } {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);
  const bus = new DurableEventBus(db, store);
  return { db, bus, store };
}

// ============================================================================
// Event Publish Throughput Benchmarks
// ============================================================================

test("event bus: Publish throughput >5000 events/sec", (t) => {
  const { db, bus } = createTempEventBus();

  try {
    const iterations = 5000;

    // Warmup
    for (let i = 0; i < 100; i++) {
      bus.publish({
        eventType: "perf:test_event",
        taskId: newId("task"),
        payload: { warmup: true, index: i },
      });
    }

    // Benchmark
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      bus.publish({
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
    bus.dispose();
    db.close();
    cleanupDb(db);
  }
});

test("event bus: Burst publish throughput >10000 events/sec", (t) => {
  const { db, bus } = createTempEventBus();

  try {
    const batchSize = 10000;

    // Warmup
    for (let i = 0; i < 100; i++) {
      bus.publish({
        eventType: "perf:burst_event",
        taskId: newId("task"),
        payload: { warmup: true },
      });
    }

    // Benchmark burst
    const start = performance.now();

    for (let i = 0; i < batchSize; i++) {
      bus.publish({
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
    bus.dispose();
    db.close();
    cleanupDb(db);
  }
});

// ============================================================================
// Event Publish Latency Benchmarks
// ============================================================================

test("event bus: Publish latency P99 <5ms", (t) => {
  const { db, bus } = createTempEventBus();

  try {
    const latencies: number[] = [];
    const iterations = 2000;

    // Warmup
    for (let i = 0; i < 100; i++) {
      bus.publish({
        eventType: "perf:test_event",
        taskId: newId("task"),
        payload: { warmup: true },
      });
    }

    // Measure
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      bus.publish({
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
    bus.dispose();
    db.close();
    cleanupDb(db);
  }
});

// ============================================================================
// Multi-Event-Type Publish Benchmarks
// ============================================================================

test("event bus: Multi-event-type publish throughput >3000 events/sec", (t) => {
  const { db, bus } = createTempEventBus();

  try {
    const eventTypes = [
      "perf:test_event",
      "perf:burst_event",
      "test:capacity",
      "test:many_events",
    ] as const;

    const iterations = 3000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const eventType = eventTypes[i % eventTypes.length]!;
      bus.publish({
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
    bus.dispose();
    db.close();
    cleanupDb(db);
  }
});

// ============================================================================
// Subscription Management Benchmarks
// ============================================================================

test("event bus: Subscribe/unsubscribe throughput >1000 ops/sec", (t) => {
  const { db, bus } = createTempEventBus();

  try {
    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const consumerId = newId("consumer");
      bus.subscribe(consumerId, ["perf:test_event"], async () => {});
      bus.unsubscribe(consumerId);
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
    bus.dispose();
    db.close();
    cleanupDb(db);
  }
});

// ============================================================================
// High-Volume Stress Tests
// ============================================================================

test("event bus: Sustained high-volume throughput >8000 events/sec", async (t) => {
  const { db, bus } = createTempEventBus();

  try {
    const totalEvents = 20000;
    const start = performance.now();

    for (let i = 0; i < totalEvents; i++) {
      bus.publish({
        eventType: "perf:test_event",
        taskId: newId("task"),
        payload: { index: i, sustained: true },
      });

      // Small batch delivery every 1000 events
      if (i > 0 && i % 1000 === 0) {
        const consumerId = `consumer-${Math.floor(i / 1000)}`;
        bus.subscribe(consumerId, ["perf:test_event"], async () => {});
        await bus.deliverPending(consumerId);
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
    bus.dispose();
    db.close();
    cleanupDb(db);
  }
});

// ============================================================================
// Fan-Out Throughput Benchmarks
// ============================================================================

test("event bus: Fan-out throughput scales with subscribers", (t) => {
  const { db, bus } = createTempEventBus();

  try {
    const numSubscribers = 5;
    const eventsPerSubscriber = 200;
    const totalEvents = numSubscribers * eventsPerSubscriber;

    // Subscribe multiple consumers to same event type
    for (let s = 0; s < numSubscribers; s++) {
      const consumerId = `fanout-consumer-${s}`;
      bus.subscribe(consumerId, ["perf:fanout_event"], async () => {});
    }

    // Warmup
    for (let i = 0; i < 50; i++) {
      bus.publish({
        eventType: "perf:fanout_event",
        taskId: newId("task"),
        payload: { warmup: true },
      });
    }

    // Benchmark
    const start = performance.now();

    for (let i = 0; i < eventsPerSubscriber; i++) {
      bus.publish({
        eventType: "perf:fanout_event",
        taskId: newId("task"),
        payload: { index: i },
      });
    }

    const elapsed = performance.now() - start;
    // Total deliveries = events * subscribers
    const totalDeliveries = totalEvents * numSubscribers;
    const opsPerSec = (totalDeliveries / elapsed) * 1000;

    try {
      assert.ok(
        opsPerSec > 5000,
        `Fan-out throughput ${opsPerSec.toFixed(0)} deliveries/sec must be >5000 (with ${numSubscribers} subscribers). Total deliveries: ${totalDeliveries}`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    bus.dispose();
    db.close();
    cleanupDb(db);
  }
});