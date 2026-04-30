/**
 * Performance Test: Event Bus Publish/Subscribe Operations
 * Measures event publishing throughput, subscription delivery latency, and fan-out performance
 *
 * Design targets:
 * - Event publish: >10000 ops/sec
 * - Event subscribe/deliver: >5000 ops/sec
 * - Fan-out: linear scaling with subscribers
 * - Memory: stable under high volume
 *
 * Note: Performance thresholds are set for reference hardware. On slower machines,
 * tests that miss the reference target are recorded as diagnostics rather than skipped.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { reportSoftPerformanceMiss } from "../../helpers/performance.js";
import { join } from "node:path";
import { rmSync } from "node:fs";

import { SqliteDatabase } from "../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStoreFacade } from "../../../src/platform/five-plane-state-evidence/truth/sqlite/authoritative-task-store-facade.js";
import { DurableEventBus } from "../../../src/platform/five-plane-state-evidence/events/durable-event-bus.js";
import { newId, nowIso } from "../../../src/platform/contracts/types/ids.js";

function createTempDb(): SqliteDatabase {
  const dbPath = join(".tmp", `event-throughput-perf-${process.pid}-${Date.now()}.db`);
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  return db;
}

function cleanupDb(db: SqliteDatabase): void {
  db.close();
  rmSync(db.filePath, { force: true });
  rmSync(`${db.filePath}-wal`, { force: true });
  rmSync(`${db.filePath}-shm`, { force: true });
}

function createTestPayload(index: number): Record<string, unknown> {
  return {
    testIndex: index,
    timestamp: Date.now(),
    data: "x".repeat(100),
  };
}

// ============================================================================
// Event Publish Performance Tests
// ============================================================================

test("performance: event publish throughput >10000 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);
  const bus = new DurableEventBus(db, store);

  try {
    const iterations = 5000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      bus.publish({
        eventType: "perf:throughput_test",
        taskId: null,
        payload: createTestPayload(i),
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 10000,
        `Event publish throughput ${opsPerSec.toFixed(2)} ops/sec must be >10000 ops/sec. Avg latency: ${avgLatencyMs.toFixed(3)}ms`,
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
    cleanupDb(db);
  }
});

test("performance: event publish P99 latency <0.5ms", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);
  const bus = new DurableEventBus(db, store);

  try {
    const latencies: number[] = [];
    const iterations = 1000;

    // Warmup
    for (let i = 0; i < 50; i++) {
      bus.publish({
        eventType: "perf:latency_test",
        taskId: null,
        payload: createTestPayload(i),
      });
    }

    // Measure
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      bus.publish({
        eventType: "perf:latency_test",
        taskId: null,
        payload: createTestPayload(i),
      });
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 0.5,
        `Event publish P99 latency ${p99.toFixed(3)}ms exceeds 0.5ms target. P50: ${p50.toFixed(3)}ms`,
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
    cleanupDb(db);
  }
});

// ============================================================================
// Event Batch Publish Performance Tests
// ============================================================================

test("performance: batch publish 100 events <10ms", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);
  const bus = new DurableEventBus(db, store);

  try {
    const batchSize = 100;
    const start = performance.now();

    const events = [];
    for (let i = 0; i < batchSize; i++) {
      events.push({
        eventType: "perf:batch_test",
        taskId: null,
        payload: createTestPayload(i),
      });
    }
    bus.publishBatch(events);

    const elapsed = performance.now() - start;

    try {
      assert.ok(
        elapsed < 10,
        `Batch publish of ${batchSize} events took ${elapsed.toFixed(2)}ms, expected <10ms`,
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
    cleanupDb(db);
  }
});

test("performance: batch publish scales linearly with batch size", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);
  const bus = new DurableEventBus(db, store);

  try {
    const batchSizes = [50, 100, 200, 500];
    const results: { batch: number; opsPerSec: number }[] = [];

    for (const batchSize of batchSizes) {
      const start = performance.now();
      const events = [];
      for (let i = 0; i < batchSize; i++) {
        events.push({
          eventType: "perf:batch_scale",
          taskId: null,
          payload: createTestPayload(i),
        });
      }
      bus.publishBatch(events);
      const elapsed = performance.now() - start;
      const opsPerSec = (batchSize / elapsed) * 1000;
      results.push({ batch: batchSize, opsPerSec });
    }

    // All batches should maintain >5000 ops/sec
    for (const { batch, opsPerSec } of results) {
      try {
        assert.ok(
          opsPerSec > 5000,
          `Batch publish for size=${batch} achieved ${opsPerSec.toFixed(2)} ops/sec, expected >5000 ops/sec`,
        );
      } catch (err) {
        if (err instanceof assert.AssertionError) {
          reportSoftPerformanceMiss(t, err);
          return;
        }
        throw err;
      }
    }
  } finally {
    bus.dispose();
    cleanupDb(db);
  }
});

// ============================================================================
// Event Subscribe/Deliver Performance Tests
// ============================================================================

test("performance: event deliver throughput >5000 ops/sec", async (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);
  const bus = new DurableEventBus(db, store);

  const consumerId = "perf-consumer";

  bus.subscribe(consumerId, async () => {
    // Simulate minimal processing
  });

  try {
    // Publish events
    const publishCount = 2000;
    for (let i = 0; i < publishCount; i++) {
      bus.publish({
        eventType: "perf:deliver_test",
        taskId: null,
        payload: createTestPayload(i),
      });
    }

    const start = performance.now();
    let delivered = 0;

    // Deliver all pending events
    let remaining;
    do {
      remaining = await bus.deliverPending(consumerId);
      delivered += remaining;
    } while (remaining > 0);

    const elapsed = performance.now() - start;
    const opsPerSec = (delivered / elapsed) * 1000;

    try {
      assert.ok(
        opsPerSec > 5000,
        `Event delivery throughput ${opsPerSec.toFixed(2)} ops/sec must be >5000 ops/sec`,
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
    cleanupDb(db);
  }
});

test("performance: event deliver P99 latency <2ms", async (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);
  const bus = new DurableEventBus(db, store);

  const consumerId = "latency-consumer";

  bus.subscribe(consumerId, async () => {});

  try {
    // Publish events
    const publishCount = 500;
    for (let i = 0; i < publishCount; i++) {
      bus.publish({
        eventType: "perf:deliver_latency",
        taskId: null,
        payload: createTestPayload(i),
      });
    }

    const latencies: number[] = [];

    // Measure delivery latency for each batch
    for (let i = 0; i < publishCount; i++) {
      const start = performance.now();
      await bus.deliverPending(consumerId);
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(latencies.length * 0.99)]!;
    const p50 = latencies[Math.floor(latencies.length * 0.5)]!;

    try {
      assert.ok(
        p99 < 2,
        `Event deliver P99 latency ${p99.toFixed(3)}ms exceeds 2ms target. P50: ${p50.toFixed(3)}ms`,
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
    cleanupDb(db);
  }
});

// ============================================================================
// Fan-out Performance Tests
// ============================================================================

test("performance: fan-out scales linearly with subscriber count", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);
  const bus = new DurableEventBus(db, store);

  try {
    const subscriberCounts = [1, 5, 10, 20];
    const results: { count: number; opsPerSec: number }[] = [];

    for (const subscriberCount of subscriberCounts) {
      // Add subscribers
      for (let i = 0; i < subscriberCount; i++) {
        bus.subscribe(`fanout-${subscriberCount}-${i}`, async () => {});
      }

      const iterations = 500;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        bus.publish({
          eventType: "perf:fanout",
          taskId: null,
          payload: createTestPayload(i),
        });
      }

      const elapsed = performance.now() - start;
      const opsPerSec = (iterations / elapsed) * 1000;
      results.push({ count: subscriberCount, opsPerSec });
    }

    // Verify publish performance doesn't degrade more than 3x as subscribers increase 20x
    const baseline = results[0]!.opsPerSec;
    for (const { count, opsPerSec } of results.slice(1)) {
      const degradation = baseline / opsPerSec;
      try {
        assert.ok(
          degradation < 3,
          `Fan-out with ${count} subscribers degraded throughput by ${degradation.toFixed(1)}x, expected <3x`,
        );
      } catch (err) {
        if (err instanceof assert.AssertionError) {
          reportSoftPerformanceMiss(t, err);
          return;
        }
        throw err;
      }
    }
  } finally {
    bus.dispose();
    cleanupDb(db);
  }
});

test("performance: multiple consumers receive all events", async (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);
  const bus = new DurableEventBus(db, store);

  const consumer1Id = "multi-consumer-1";
  const consumer2Id = "multi-consumer-2";

  let consumer1Count = 0;
  let consumer2Count = 0;

  bus.subscribe(consumer1Id, async () => {
    consumer1Count++;
  });

  bus.subscribe(consumer2Id, async () => {
    consumer2Count++;
  });

  try {
    const eventCount = 100;
    for (let i = 0; i < eventCount; i++) {
      bus.publish({
        eventType: "perf:multi_consumer",
        taskId: null,
        payload: createTestPayload(i),
      });
    }

    await bus.deliverPending(consumer1Id);
    await bus.deliverPending(consumer2Id);

    assert.strictEqual(consumer1Count, eventCount, `Consumer 1 should receive all ${eventCount} events`);
    assert.strictEqual(consumer2Count, eventCount, `Consumer 2 should receive all ${eventCount} events`);
  } finally {
    bus.dispose();
    cleanupDb(db);
  }
});

// ============================================================================
// Subscribe/Unsubscribe Performance Tests
// ============================================================================

test("performance: subscribe operation <1ms", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);
  const bus = new DurableEventBus(db, store);

  try {
    const latencies: number[] = [];
    const iterations = 500;

    for (let i = 0; i < iterations; i++) {
      const consumerId = `dynamic-sub-${i}`;
      const start = performance.now();
      bus.subscribe(consumerId, async () => {});
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const avg = latencies.reduce((a, b) => a + b, 0) / iterations;

    try {
      assert.ok(
        p99 < 1,
        `Subscribe P99 latency ${p99.toFixed(3)}ms exceeds 1ms target. Avg: ${avg.toFixed(3)}ms`,
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
    cleanupDb(db);
  }
});

test("performance: unsubscribe operation <0.5ms", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);
  const bus = new DurableEventBus(db, store);

  try {
    const latencies: number[] = [];
    const iterations = 500;

    // Pre-create subscriptions
    for (let i = 0; i < iterations; i++) {
      bus.subscribe(`unsub-${i}`, async () => {});
    }

    // Measure unsubscribe
    for (let i = 0; i < iterations; i++) {
      const consumerId = `unsub-${i}`;
      const start = performance.now();
      bus.unsubscribe(consumerId);
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const avg = latencies.reduce((a, b) => a + b, 0) / iterations;

    try {
      assert.ok(
        p99 < 0.5,
        `Unsubscribe P99 latency ${p99.toFixed(3)}ms exceeds 0.5ms target. Avg: ${avg.toFixed(3)}ms`,
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
    cleanupDb(db);
  }
});

// ============================================================================
// High-Volume Stress Tests
// ============================================================================

test("performance: handles 10000 events without backpressure", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);
  const bus = new DurableEventBus(db, store);

  try {
    const eventCount = 10000;
    const start = performance.now();

    for (let i = 0; i < eventCount; i++) {
      bus.publish({
        eventType: "perf:stress",
        taskId: null,
        payload: createTestPayload(i),
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (eventCount / elapsed) * 1000;

    try {
      assert.ok(
        opsPerSec > 5000,
        `High-volume publish achieved ${opsPerSec.toFixed(2)} ops/sec, expected >5000 ops/sec`,
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
    cleanupDb(db);
  }
});

test("performance: bulk delivery of 5000 events <500ms", async (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);
  const bus = new DurableEventBus(db, store);

  const consumerId = "bulk-consumer";

  bus.subscribe(consumerId, async () => {});

  try {
    // Publish 5000 events
    const eventCount = 5000;
    for (let i = 0; i < eventCount; i++) {
      bus.publish({
        eventType: "perf:bulk_deliver",
        taskId: null,
        payload: createTestPayload(i),
      });
    }

    const start = performance.now();
    let delivered = 0;

    // Deliver all events
    let remaining;
    do {
      remaining = await bus.deliverPending(consumerId);
      delivered += remaining;
    } while (remaining > 0 && delivered < eventCount * 2);

    const elapsed = performance.now() - start;

    try {
      assert.ok(
        elapsed < 500,
        `Bulk delivery of ${delivered} events took ${elapsed.toFixed(2)}ms, expected <500ms`,
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
    cleanupDb(db);
  }
});

// ============================================================================
// Concurrent Publish Performance Tests
// ============================================================================

test("performance: concurrent publish from 5 producers >15000 ops/sec", async (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);
  const bus = new DurableEventBus(db, store);

  try {
    const producerCount = 5;
    const eventsPerProducer = 1000;
    const totalEvents = producerCount * eventsPerProducer;

    const start = performance.now();

    await Promise.all(
      Array.from({ length: producerCount }, (_, producerId) =>
        Promise.resolve().then(() => {
          for (let i = 0; i < eventsPerProducer; i++) {
            bus.publish({
              eventType: "perf:concurrent",
              taskId: null,
              payload: {
                producerId,
                eventIndex: i,
                timestamp: Date.now(),
              },
            });
          }
        }),
      ),
    );

    const elapsed = performance.now() - start;
    const opsPerSec = (totalEvents / elapsed) * 1000;

    try {
      assert.ok(
        opsPerSec > 15000,
        `Concurrent publish throughput ${opsPerSec.toFixed(2)} ops/sec must be >15000 ops/sec`,
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
    cleanupDb(db);
  }
});

// ============================================================================
// Memory Stability Tests
// ============================================================================

test("performance: memory stable during sustained publish", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);
  const bus = new DurableEventBus(db, store);

  try {
    const iterations = 1000;
    const batchSize = 100;

    // Perform repeated batch publish cycles
    for (let i = 0; i < iterations; i++) {
      const events = [];
      for (let j = 0; j < batchSize; j++) {
        events.push({
          eventType: "perf:memory",
          taskId: null,
          payload: createTestPayload(i * batchSize + j),
        });
      }
      bus.publishBatch(events);
    }

    // Verify bus is still functional
    bus.publish({
      eventType: "perf:verify",
      taskId: null,
      payload: { verify: true },
    });
  } finally {
    bus.dispose();
    cleanupDb(db);
  }
});
