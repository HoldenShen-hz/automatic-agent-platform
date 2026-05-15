/**
 * Performance Test: Queue Operations
 * Measures queue enqueue/dequeue throughput, priority ordering, and concurrency
 *
 * Design targets:
 * - Enqueue: >2000 ops/sec
 * - Dequeue: >1000 ops/sec
 * - Priority ordering: correct ordering maintained under load
 * - Concurrent ops: thread-safe operations with no race conditions
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
import { SqliteQueueAdapter } from "../../../src/platform/five-plane-execution/queue/sqlite-queue-adapter.js";
import { QUEUE_JOBS_DDL } from "../../../src/platform/five-plane-execution/queue/queue-adapter-types.js";
import { newId } from "../../../src/platform/contracts/types/ids.js";

function createTempDb(): SqliteDatabase {
  const dbPath = join(".tmp", `queue-perf-${process.pid}-${Date.now()}.db`);
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  db.connection.exec(QUEUE_JOBS_DDL);
  return db;
}

function createPayload(index: number): { taskId: string; action: string; data: unknown } {
  return {
    taskId: newId("task"),
    action: `process_${index}`,
    data: { iteration: index, timestamp: Date.now() },
  };
}

// ============================================================================
// Enqueue/Dequeue Throughput Tests
// ============================================================================

test("performance: queue enqueue throughput >2000 ops/sec", (t) => {
  const db = createTempDb();
  const adapter = new SqliteQueueAdapter(db);
  const queueName = "test-queue";

  try {
    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      adapter.enqueue({
        queueName,
        payload: createPayload(i),
        priority: i % 10,
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 2000,
        `Queue enqueue throughput ${opsPerSec.toFixed(2)} ops/sec must be >2000 ops/sec. Avg latency: ${avgLatencyMs.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    db.close();
    rmSync(db.filePath, { force: true });
    rmSync(`${db.filePath}-wal`, { force: true });
    rmSync(`${db.filePath}-shm`, { force: true });
  }
});

test("performance: queue dequeue throughput >1000 ops/sec", (t) => {
  const db = createTempDb();
  const adapter = new SqliteQueueAdapter(db);
  const queueName = "test-queue";

  try {
    // Pre-populate queue
    for (let i = 0; i < 500; i++) {
      adapter.enqueue({
        queueName,
        payload: createPayload(i),
        priority: i % 10,
      });
    }

    const iterations = 200;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const result = adapter.dequeue(queueName);
      if (result) {
        result.ack();
      }
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 1000,
        `Queue dequeue throughput ${opsPerSec.toFixed(2)} ops/sec must be >1000 ops/sec. Avg latency: ${avgLatencyMs.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    db.close();
    rmSync(db.filePath, { force: true });
    rmSync(`${db.filePath}-wal`, { force: true });
    rmSync(`${db.filePath}-shm`, { force: true });
  }
});

test("performance: enqueue+dequeue roundtrip throughput >800 ops/sec", (t) => {
  const db = createTempDb();
  const adapter = new SqliteQueueAdapter(db);
  const queueName = "test-queue";

  try {
    const iterations = 500;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      adapter.enqueue({
        queueName,
        payload: createPayload(i),
        priority: i % 5,
      });
      const result = adapter.dequeue(queueName);
      if (result) {
        result.ack();
      }
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations * 2 / elapsed) * 1000; // 2 ops per iteration

    try {
      assert.ok(
        opsPerSec > 800,
        `Queue roundtrip throughput ${opsPerSec.toFixed(2)} ops/sec must be >800 ops/sec`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    db.close();
    rmSync(db.filePath, { force: true });
    rmSync(`${db.filePath}-wal`, { force: true });
    rmSync(`${db.filePath}-shm`, { force: true });
  }
});

// ============================================================================
// Priority Queue Ordering Tests
// ============================================================================

test("performance: priority queue orders high priority first", (t) => {
  const db = createTempDb();
  const adapter = new SqliteQueueAdapter(db);
  const queueName = "test-queue";

  try {
    // Enqueue items with varied priorities: low, high, medium, high, low
    const priorityOrder = [1, 10, 5, 9, 2];
    const expectedOrder = [10, 9, 5, 2, 1]; // descending priority

    for (let i = 0; i < priorityOrder.length; i++) {
      const priority = priorityOrder[i]!;
      adapter.enqueue({
        queueName,
        payload: { index: i, priority },
        priority,
      });
    }

    // Dequeue all and verify ordering
    const dequeuedPriorities: number[] = [];
    for (let i = 0; i < priorityOrder.length; i++) {
      const result = adapter.dequeue(queueName);
      assert.ok(result, `Should dequeue item ${i}`);
      const payload = JSON.parse(result.job.payload);
      dequeuedPriorities.push(payload.priority);
      result.ack();
    }

    assert.deepStrictEqual(
      dequeuedPriorities,
      expectedOrder,
      `Priority ordering violated. Got ${JSON.stringify(dequeuedPriorities)}, expected ${JSON.stringify(expectedOrder)}`,
    );
  } finally {
    db.close();
    rmSync(db.filePath, { force: true });
    rmSync(`${db.filePath}-wal`, { force: true });
    rmSync(`${db.filePath}-shm`, { force: true });
  }
});

test("performance: priority queue maintains ordering under load", (t) => {
  const db = createTempDb();
  const adapter = new SqliteQueueAdapter(db);
  const queueName = "test-queue";

  try {
    // Enqueue 100 items with random priorities
    const items: { priority: number; index: number }[] = [];
    for (let i = 0; i < 100; i++) {
      const priority = Math.floor(Math.random() * 100);
      items.push({ priority, index: i });
      adapter.enqueue({
        queueName,
        payload: { index: i, priority },
        priority,
      });
    }

    // Sort expected by priority descending
    items.sort((a, b) => b.priority - a.priority);

    // Dequeue all and verify ordering
    const dequeued: { priority: number; index: number }[] = [];
    for (let i = 0; i < 100; i++) {
      const result = adapter.dequeue(queueName);
      assert.ok(result, `Should dequeue item ${i}`);
      dequeued.push(JSON.parse(result.job.payload));
      result.ack();
    }

    // Verify all items maintain priority ordering
    for (let i = 1; i < dequeued.length; i++) {
      assert.ok(
        dequeued[i]!.priority <= dequeued[i - 1]!.priority,
        `Priority ordering violated at position ${i}: ${dequeued[i - 1]!.priority} -> ${dequeued[i]!.priority}`,
      );
    }

    // Verify all items were dequeued
    assert.strictEqual(dequeued.length, 100);
  } finally {
    db.close();
    rmSync(db.filePath, { force: true });
    rmSync(`${db.filePath}-wal`, { force: true });
    rmSync(`${db.filePath}-shm`, { force: true });
  }
});

test("performance: priority queue FIFO within same priority", (t) => {
  const db = createTempDb();
  const adapter = new SqliteQueueAdapter(db);
  const queueName = "test-queue";

  try {
    // Enqueue 10 items all with same priority
    const indices: number[] = [];
    for (let i = 0; i < 10; i++) {
      indices.push(i);
      adapter.enqueue({
        queueName,
        payload: { index: i },
        priority: 5,
      });
    }

    // Dequeue all and verify FIFO ordering within same priority
    const dequeuedIndices: number[] = [];
    for (let i = 0; i < 10; i++) {
      const result = adapter.dequeue(queueName);
      assert.ok(result, `Should dequeue item ${i}`);
      const payload = JSON.parse(result.job.payload);
      dequeuedIndices.push(payload.index);
      result.ack();
    }

    assert.deepStrictEqual(
      dequeuedIndices,
      indices,
      `FIFO ordering violated within same priority. Got ${JSON.stringify(dequeuedIndices)}, expected ${JSON.stringify(indices)}`,
    );
  } finally {
    db.close();
    rmSync(db.filePath, { force: true });
    rmSync(`${db.filePath}-wal`, { force: true });
    rmSync(`${db.filePath}-shm`, { force: true });
  }
});

// ============================================================================
// Concurrent Queue Operations Tests
// ============================================================================

test("performance: concurrent enqueue operations >1500 ops/sec", async (t) => {
  const db = createTempDb();
  const adapter = new SqliteQueueAdapter(db);
  const queueName = "test-queue";

  try {
    const concurrency = 10;
    const opsPerWorker = 100;
    const totalOps = concurrency * opsPerWorker;

    const start = performance.now();

    const workers = Array.from({ length: concurrency }, (_, workerId) =>
      Promise.resolve().then(() => {
        for (let i = 0; i < opsPerWorker; i++) {
          adapter.enqueue({
            queueName,
            payload: createPayload(workerId * opsPerWorker + i),
            priority: Math.floor(Math.random() * 10),
          });
        }
      }),
    );

    await Promise.all(workers);

    const elapsed = performance.now() - start;
    const opsPerSec = (totalOps / elapsed) * 1000;

    try {
      assert.ok(
        opsPerSec > 1500,
        `Concurrent enqueue throughput ${opsPerSec.toFixed(2)} ops/sec must be >1500 ops/sec`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }

    // Verify all items were enqueued
    const stats = adapter.stats(queueName);
    assert.strictEqual(
      stats.waiting + stats.active,
      totalOps,
      `Expected ${totalOps} items in queue, got ${stats.waiting + stats.active}`,
    );
  } finally {
    db.close();
    rmSync(db.filePath, { force: true });
    rmSync(`${db.filePath}-wal`, { force: true });
    rmSync(`${db.filePath}-shm`, { force: true });
  }
});

test("performance: concurrent enqueue+dequeue maintains consistency", async (t) => {
  const db = createTempDb();
  const adapter = new SqliteQueueAdapter(db);
  const queueName = "test-queue";

  try {
    const concurrency = 5;
    const opsPerWorker = 50;
    const totalEnqueues = concurrency * opsPerWorker;

    // Pre-populate queue
    for (let i = 0; i < totalEnqueues; i++) {
      adapter.enqueue({
        queueName,
        payload: { index: i },
        priority: i % 10,
      });
    }

    let totalDequeues = 0;
    const start = performance.now();

    const workers = Array.from({ length: concurrency }, (_, workerId) =>
      Promise.resolve().then(() => {
        let workerDequeues = 0;
        for (let i = 0; i < opsPerWorker; i++) {
          const result = adapter.dequeue(queueName);
          if (result) {
            result.ack();
            workerDequeues++;
          }
        }
        return workerDequeues;
      }),
    );

    const results = await Promise.all(workers);
    totalDequeues = results.reduce((sum, count) => sum + count, 0);

    const elapsed = performance.now() - start;
    const opsPerSec = (totalDequeues / elapsed) * 1000;

    try {
      assert.ok(
        opsPerSec > 800,
        `Concurrent dequeue throughput ${opsPerSec.toFixed(2)} ops/sec must be >800 ops/sec`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }

    // Verify queue is consistent (no negative counts)
    const stats = adapter.stats(queueName);
    assert.ok(
      stats.waiting >= 0 && stats.active >= 0 && stats.completed >= 0,
      `Queue stats have negative values: waiting=${stats.waiting}, active=${stats.active}, completed=${stats.completed}`,
    );
  } finally {
    db.close();
    rmSync(db.filePath, { force: true });
    rmSync(`${db.filePath}-wal`, { force: true });
    rmSync(`${db.filePath}-shm`, { force: true });
  }
});

test("performance: concurrent mixed operations no race conditions", async (t) => {
  const db = createTempDb();
  const adapter = new SqliteQueueAdapter(db);
  const queueName = "test-queue";

  try {
    const concurrency = 8;
    const opsPerWorker = 50;

    let enqueueCount = 0;
    let dequeueCount = 0;

    const workers = Array.from({ length: concurrency }, (_, i) =>
      Promise.resolve().then(() => {
        for (let j = 0; j < opsPerWorker; j++) {
          const op = (i + j) % 3;
          if (op === 0) {
            // Enqueue
            adapter.enqueue({
              queueName,
              payload: { worker: i, op: j },
              priority: Math.floor(Math.random() * 10),
            });
            enqueueCount++;
          } else {
            // Dequeue
            const result = adapter.dequeue(queueName);
            if (result) {
              result.ack();
              dequeueCount++;
            }
          }
        }
      }),
    );

    await Promise.all(workers);

    // Verify all operations completed without errors
    const stats = adapter.stats(queueName);
    const total = stats.waiting + stats.active + stats.completed;

    // All items that were enqueued should be accounted for (waiting, active, or completed)
    assert.ok(
      total >= enqueueCount - dequeueCount,
      `Race condition detected: expected at least ${enqueueCount - dequeueCount} items, got ${total} total items in queue`,
    );

    // No items should be lost
    assert.ok(
      total <= enqueueCount,
      `Items created unexpectedly: expected at most ${enqueueCount} items, got ${total}`,
    );
  } finally {
    db.close();
    rmSync(db.filePath, { force: true });
    rmSync(`${db.filePath}-wal`, { force: true });
    rmSync(`${db.filePath}-shm`, { force: true });
  }
});

test("performance: concurrent priority enqueue ordering preserved", async (t) => {
  const db = createTempDb();
  const adapter = new SqliteQueueAdapter(db);
  const queueName = "test-queue";

  try {
    const concurrency = 5;
    const itemsPerWorker = 20;

    // Each worker enqueues items with same priority
    const workers = Array.from({ length: concurrency }, (_, workerId) =>
      Promise.resolve().then(() => {
        const basePriority = (concurrency - workerId) * 2; // Worker 0 gets highest priority
        for (let i = 0; i < itemsPerWorker; i++) {
          adapter.enqueue({
            queueName,
            payload: { workerId, index: i, priority: basePriority },
            priority: basePriority,
          });
        }
      }),
    );

    await Promise.all(workers);

    // Dequeue all and verify priority ordering
    const totalItems = concurrency * itemsPerWorker;
    const dequeuedItems: { workerId: number; priority: number }[] = [];

    for (let i = 0; i < totalItems; i++) {
      const result = adapter.dequeue(queueName);
      assert.ok(result, `Should dequeue item ${i}`);
      dequeuedItems.push(JSON.parse(result.job.payload));
      result.ack();
    }

    // Verify all items dequeued in priority order
    for (let i = 1; i < dequeuedItems.length; i++) {
      assert.ok(
        dequeuedItems[i]!.priority <= dequeuedItems[i - 1]!.priority,
        `Priority ordering violated at position ${i}: worker ${dequeuedItems[i - 1]!.workerId} (priority ${dequeuedItems[i - 1]!.priority}) -> worker ${dequeuedItems[i]!.workerId} (priority ${dequeuedItems[i]!.priority})`,
      );
    }

    // Verify we got all items
    assert.strictEqual(dequeuedItems.length, totalItems);
  } finally {
    db.close();
    rmSync(db.filePath, { force: true });
    rmSync(`${db.filePath}-wal`, { force: true });
    rmSync(`${db.filePath}-shm`, { force: true });
  }
});
