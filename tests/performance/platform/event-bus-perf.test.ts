// @ts-nocheck
/**
 * Performance Test: Event Bus Operations
 * Measures event publishing throughput, delivery latency, and fan-out performance
 *
 * Design targets:
 * - Event publish throughput: >5000 ops/sec
 * - Event publish batch throughput: >10000 ops/sec
 * - Event delivery latency: <5ms P99
 * - Fan-out throughput: scales linearly with subscribers
 *
 * Note: Performance thresholds are set for reference hardware. On slower machines,
 * tests that miss the reference target are recorded as diagnostics rather than skipped.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { reportSoftPerformanceMiss } from "../../helpers/performance.js";
import { join } from "node:path";
import { rmSync } from "node:fs";

import { SqliteDatabase } from "../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStoreFacade } from "../../../src/platform/state-evidence/truth/sqlite/authoritative-task-store-facade.js";
import { DurableEventBus } from "../../../src/platform/state-evidence/events/durable-event-bus.js";
import { newId, nowIso } from "../../../src/platform/contracts/types/ids.js";
import type { TaskRecord, TaskSource, TaskPriority } from "../../../src/platform/contracts/types/domain.js";

function createTempDb(): SqliteDatabase {
  const dbPath = join(".tmp", `event-bus-perf-${process.pid}-${Date.now()}.db`);
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  return db;
}

function createTestTaskRecord(overrides?: Partial<TaskRecord>): TaskRecord {
  const taskId = overrides?.id ?? newId("task");
  return {
    id: taskId,
    parentId: null,
    rootId: taskId,
    divisionId: "div_default",
    tenantId: "tenant_test",
    title: `Test task ${taskId}`,
    status: "queued",
    source: "user" as TaskSource,
    priority: "normal" as TaskPriority,
    inputJson: JSON.stringify({ prompt: "Test task input", iteration: 0 }),
    normalizedInputJson: JSON.stringify({ prompt: "Test task input" }),
    outputJson: null,
    estimatedCostUsd: 0.01,
    actualCostUsd: 0,
    errorCode: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    completedAt: null,
    ...overrides,
  };
}

function createTestEventBus(db: SqliteDatabase, store: AuthoritativeTaskStoreFacade): DurableEventBus {
  return new DurableEventBus(db, store);
}

function createTestPayload(index: number): Record<string, unknown> {
  return {
    testIndex: index,
    timestamp: Date.now(),
    data: "x".repeat(50),
  };
}

// ============================================================================
// Event Publish Throughput Benchmarks
// ============================================================================

test("performance: event publish throughput >5000 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);
  const bus = createTestEventBus(db, store);

  try {
    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      bus.publish({
        eventType: "perf:test_event",
        taskId: null,
        payload: createTestPayload(i),
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 5000,
        `Event publish throughput ${opsPerSec.toFixed(2)} ops/sec must be >5000 ops/sec. Avg latency: ${avgLatencyMs.toFixed(3)}ms`,
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
    rmSync(db.filePath, { force: true });
    rmSync(`${db.filePath}-wal`, { force: true });
    rmSync(`${db.filePath}-shm`, { force: true });
  }
});

test("performance: event publish P99 latency <1ms", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);
  const bus = createTestEventBus(db, store);

  try {
    const latencies: number[] = [];
    const iterations = 500;

    // Warmup
    for (let i = 0; i < 10; i++) {
      bus.publish({
        eventType: "perf:test_event",
        taskId: null,
        payload: createTestPayload(i),
      });
    }

    // Measure
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      bus.publish({
        eventType: "perf:test_event",
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
        p99 < 1,
        `Event publish P99 latency ${p99.toFixed(3)}ms exceeds 1ms target. P50: ${p50.toFixed(3)}ms`,
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
    rmSync(db.filePath, { force: true });
    rmSync(`${db.filePath}-wal`, { force: true });
    rmSync(`${db.filePath}-shm`, { force: true });
  }
});

// ============================================================================
// Event Batch Publish Benchmarks
// ============================================================================

test("performance: event batch publish throughput >10000 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);
  const bus = createTestEventBus(db, store);

  try {
    const batchSize = 100;
    const numBatches = 10;
    const totalEvents = batchSize * numBatches;

    const start = performance.now();

    for (let batch = 0; batch < numBatches; batch++) {
      const events = [];
      for (let i = 0; i < batchSize; i++) {
        events.push({
          eventType: "perf:burst_event",
          taskId: null,
          payload: createTestPayload(batch * batchSize + i),
        });
      }
      bus.publishBatch(events);
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (totalEvents / elapsed) * 1000;
    const avgLatencyMs = elapsed / numBatches;

    try {
      assert.ok(
        opsPerSec > 10000,
        `Event batch publish throughput ${opsPerSec.toFixed(2)} ops/sec must be >10000 ops/sec. Avg batch latency: ${avgLatencyMs.toFixed(3)}ms`,
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
    rmSync(db.filePath, { force: true });
    rmSync(`${db.filePath}-wal`, { force: true });
    rmSync(`${db.filePath}-shm`, { force: true });
  }
});

test("performance: event batch publish scales with batch size", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);
  const bus = createTestEventBus(db, store);

  try {
    const batchSizes = [10, 50, 100, 200];
    const results: { batch: number; opsPerSec: number }[] = [];

    for (const batchSize of batchSizes) {
      const start = performance.now();
      const events = [];
      for (let i = 0; i < batchSize; i++) {
        events.push({
          eventType: "perf:test_event",
          taskId: null,
          payload: createTestPayload(i),
        });
      }
      bus.publishBatch(events);
      const elapsed = performance.now() - start;
      const opsPerSec = (batchSize / elapsed) * 1000;
      results.push({ batch: batchSize, opsPerSec });
    }

    // Verify throughput remains high as batch size increases
    for (const { batch, opsPerSec } of results) {
      try {
        assert.ok(
          opsPerSec > 8000,
          `Batch publish for size=${batch} achieved ${opsPerSec.toFixed(2)} ops/sec, expected >8000 ops/sec`,
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
    db.close();
    rmSync(db.filePath, { force: true });
    rmSync(`${db.filePath}-wal`, { force: true });
    rmSync(`${db.filePath}-shm`, { force: true });
  }
});

// ============================================================================
// Event Delivery Benchmarks
// ============================================================================

test("performance: event delivery latency <5ms P99", async (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);
  const bus = createTestEventBus(db, store);

  const consumerId = "test-consumer";
  let deliveredCount = 0;

  bus.subscribe(consumerId, async () => {
    deliveredCount++;
  });

  try {
    // Publish events
    const publishCount = 100;
    for (let i = 0; i < publishCount; i++) {
      bus.publish({
        eventType: "perf:test_event",
        taskId: null,
        payload: createTestPayload(i),
      });
    }

    const latencies: number[] = [];

    // Measure delivery latency
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
        p99 < 5,
        `Event delivery P99 latency ${p99.toFixed(3)}ms exceeds 5ms target. P50: ${p50.toFixed(3)}ms`,
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
    rmSync(db.filePath, { force: true });
    rmSync(`${db.filePath}-wal`, { force: true });
    rmSync(`${db.filePath}-shm`, { force: true });
  }
});

test("performance: event delivery throughput >2000 events/sec", async (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);
  const bus = createTestEventBus(db, store);

  const consumerId = "test-consumer-throughput";

  bus.subscribe(consumerId, async () => {
    // Simulate minimal processing
  });

  try {
    // Publish events
    const publishCount = 500;
    for (let i = 0; i < publishCount; i++) {
      bus.publish({
        eventType: "perf:test_event",
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
        opsPerSec > 2000,
        `Event delivery throughput ${opsPerSec.toFixed(2)} ops/sec must be >2000 ops/sec`,
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
    rmSync(db.filePath, { force: true });
    rmSync(`${db.filePath}-wal`, { force: true });
    rmSync(`${db.filePath}-shm`, { force: true });
  }
});

// ============================================================================
// Fan-out Benchmarks
// ============================================================================

test("performance: fan-out scales linearly with subscribers", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);
  const bus = createTestEventBus(db, store);

  try {
    const subscriberCounts = [1, 5, 10];
    const results: { count: number; opsPerSec: number }[] = [];

    for (const subscriberCount of subscriberCounts) {
      // Create subscribers
      for (let i = 0; i < subscriberCount; i++) {
        bus.subscribe(`fanout-consumer-${i}`, async () => {});
      }

      const iterations = 100;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        bus.publish({
          eventType: "perf:test_event",
          taskId: null,
          payload: createTestPayload(i),
        });
      }

      const elapsed = performance.now() - start;
      const opsPerSec = (iterations / elapsed) * 1000;
      results.push({ count: subscriberCount, opsPerSec });
    }

    // Verify publish performance doesn't degrade significantly
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
    db.close();
    rmSync(db.filePath, { force: true });
    rmSync(`${db.filePath}-wal`, { force: true });
    rmSync(`${db.filePath}-shm`, { force: true });
  }
});

// ============================================================================
// Concurrent Publish Benchmarks
// ============================================================================

test("performance: concurrent publish from multiple producers", async (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);
  const bus = createTestEventBus(db, store);

  try {
    const producerCount = 5;
    const eventsPerProducer = 200;
    const totalEvents = producerCount * eventsPerProducer;

    const start = performance.now();

    await Promise.all(
      Array.from({ length: producerCount }, (_, producerId) =>
        Promise.resolve().then(() => {
          for (let i = 0; i < eventsPerProducer; i++) {
            bus.publish({
              eventType: "perf:test_event",
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
        opsPerSec > 3000,
        `Concurrent publish throughput ${opsPerSec.toFixed(2)} ops/sec must be >3000 ops/sec`,
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
    rmSync(db.filePath, { force: true });
    rmSync(`${db.filePath}-wal`, { force: true });
    rmSync(`${db.filePath}-shm`, { force: true });
  }
});

// ============================================================================
// High-Volume Stress Tests
// ============================================================================

test("performance: handles 5000 events without backpressure", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);
  const bus = createTestEventBus(db, store);

  try {
    const eventCount = 5000;
    const start = performance.now();

    for (let i = 0; i < eventCount; i++) {
      bus.publish({
        eventType: "test:capacity",
        taskId: null,
        payload: createTestPayload(i),
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (eventCount / elapsed) * 1000;

    try {
      assert.ok(
        opsPerSec > 2000,
        `High-volume publish achieved ${opsPerSec.toFixed(2)} ops/sec, expected >2000 ops/sec`,
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
    rmSync(db.filePath, { force: true });
    rmSync(`${db.filePath}-wal`, { force: true });
    rmSync(`${db.filePath}-shm`, { force: true });
  }
});

test("performance: bulk delivery of 1000 events <500ms", async (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);
  const bus = createTestEventBus(db, store);

  const consumerId = "bulk-consumer";

  bus.subscribe(consumerId, async () => {});

  try {
    // Publish 1000 events
    const eventCount = 1000;
    for (let i = 0; i < eventCount; i++) {
      bus.publish({
        eventType: "test:many_events",
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
    } while (remaining > 0 && delivered < eventCount * 2); // Safety limit

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
    db.close();
    rmSync(db.filePath, { force: true });
    rmSync(`${db.filePath}-wal`, { force: true });
    rmSync(`${db.filePath}-shm`, { force: true });
  }
});

// ============================================================================
// Unsubscribe/Resubscribe Benchmarks
// ============================================================================

test("performance: subscribe/unsubscribe overhead <1ms", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);
  const bus = createTestEventBus(db, store);

  try {
    const iterations = 100;
    const latencies: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const consumerId = `dynamic-consumer-${i}`;
      const start = performance.now();
      bus.subscribe(consumerId, async () => {});
      bus.unsubscribe(consumerId);
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const avg = latencies.reduce((a, b) => a + b, 0) / iterations;

    try {
      assert.ok(
        p99 < 1,
        `Subscribe/unsubscribe P99 latency ${p99.toFixed(3)}ms exceeds 1ms target. Avg: ${avg.toFixed(3)}ms`,
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
    rmSync(db.filePath, { force: true });
    rmSync(`${db.filePath}-wal`, { force: true });
    rmSync(`${db.filePath}-shm`, { force: true });
  }
});
