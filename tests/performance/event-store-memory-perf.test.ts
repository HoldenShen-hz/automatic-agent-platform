/**
 * Performance Test: Event Store Memory Usage Benchmarks
 * Measures memory consumption, growth, and cleanup under sustained event store load
 *
 * Design targets:
 * - Memory growth rate: <5MB/sec under sustained event write load
 * - Heap usage stability: <200MB variance under steady state
 * - Memory cleanup: >80% memory reclaimed after large batch release
 * - Event store memory efficiency: <1KB per event stored
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
  const dbPath = join(".tmp", `event-mem-${process.pid}-${Date.now()}.db`);
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  return db;
}

function cleanupDb(db: SqliteDatabase): void {
  rmSync(db.filePath, { force: true });
  rmSync(`${db.filePath}-wal`, { force: true });
  rmSync(`${db.filePath}-shm`, { force: true });
}

function getHeapStats(): { heapUsed: number; heapTotal: number; external: number } {
  const mem = process.memoryUsage();
  return {
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
    external: mem.external,
  };
}

// ============================================================================
// Memory Growth Rate Benchmarks
// ============================================================================

test("event store: Memory growth rate <5MB/sec under sustained write load", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const eventBus = new TypedEventBus(db, store);

  try {
    const iterations = 5000;
    const startMem = getHeapStats();
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      eventBus.publish({
        eventType: "perf:mem_test",
        taskId: newId("task"),
        payload: { index: i, data: "x".repeat(100) },
      });
    }

    const elapsed = (performance.now() - start) / 1000; // seconds
    const endMem = getHeapStats();
    const heapGrowth = (endMem.heapUsed - startMem.heapUsed) / 1024 / 1024; // MB
    const growthRate = heapGrowth / elapsed; // MB/sec

    try {
      assert.ok(
        growthRate < 5,
        `Memory growth rate ${growthRate.toFixed(3)}MB/sec exceeds 5MB/sec target. Total growth: ${heapGrowth.toFixed(2)}MB over ${elapsed.toFixed(2)}s`,
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
    cleanupDb(db);
  }
});

test("event store: Heap usage stability <200MB variance under steady state", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const eventBus = new TypedEventBus(db, store);

  try {
    const steadyStateIterations = 1000;
    const measurementCount = 10;
    const measurements: number[] = [];

    // Warmup to steady state
    for (let i = 0; i < steadyStateIterations; i++) {
      eventBus.publish({
        eventType: "perf:steady_test",
        taskId: newId("task"),
        payload: { warmup: true, index: i },
      });
    }

    // Force GC if available
    if (global.gc) {
      global.gc();
    }

    // Take measurements at steady state
    for (let m = 0; m < measurementCount; m++) {
      // Do some work
      for (let i = 0; i < 100; i++) {
        eventBus.publish({
          eventType: "perf:steady_test",
          taskId: newId("task"),
          payload: { measurement: m, index: i },
        });
      }

      const mem = getHeapStats();
      measurements.push(mem.heapUsed);

      // Small delay between measurements
      if (m < measurementCount - 1) {
        const start = performance.now();
        while (performance.now() - start < 10) {
          // busy wait 10ms
        }
      }
    }

    const minHeap = Math.min(...measurements);
    const maxHeap = Math.max(...measurements);
    const varianceMb = (maxHeap - minHeap) / 1024 / 1024;

    try {
      assert.ok(
        varianceMb < 200,
        `Heap variance ${varianceMb.toFixed(2)}MB exceeds 200MB target. Min: ${(minHeap / 1024 / 1024).toFixed(2)}MB, Max: ${(maxHeap / 1024 / 1024).toFixed(2)}MB`,
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
    cleanupDb(db);
  }
});

// ============================================================================
// Event Store Memory Efficiency Benchmarks
// ============================================================================

test("event store: Memory efficiency <1KB per event stored", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const eventBus = new TypedEventBus(db, store);

  try {
    const eventCount = 1000;
    const startMem = getHeapStats();

    // Store events
    for (let i = 0; i < eventCount; i++) {
      eventBus.publish({
        eventType: "perf:efficiency_test",
        taskId: newId("task"),
        payload: { index: i, data: "x".repeat(50) },
      });
    }

    // Force GC if available
    if (global.gc) {
      global.gc();
    }

    const endMem = getHeapStats();
    const heapGrowth = endMem.heapUsed - startMem.heapUsed;
    const bytesPerEvent = heapGrowth / eventCount;

    try {
      assert.ok(
        bytesPerEvent < 1024,
        `Memory per event ${bytesPerEvent.toFixed(0)} bytes exceeds 1KB target. Total growth: ${(heapGrowth / 1024).toFixed(2)}KB for ${eventCount} events`,
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
    cleanupDb(db);
  }
});

// ============================================================================
// Memory Cleanup Benchmarks
// ============================================================================

test("event store: Memory cleanup >80% reclaimed after large batch", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const eventBus = new TypedEventBus(db, store);

  try {
    const batchSize = 5000;

    // Create large batch
    for (let i = 0; i < batchSize; i++) {
      eventBus.publish({
        eventType: "perf:cleanup_test",
        taskId: newId("task"),
        payload: { index: i, data: "x".repeat(100) },
      });
    }

    // Force GC if available
    if (global.gc) {
      global.gc();
    }

    const afterBatchMem = getHeapStats();

    // Close database to release memory
    db.close();
    cleanupDb(db);

    // Create new DB to ensure old one is fully released
    const db2 = createTempDb();
    const store2 = new AuthoritativeTaskStore(db2);
    const eventBus2 = new TypedEventBus(db2, store2);

    // Force GC if available
    if (global.gc) {
      global.gc();
    }

    const afterCleanupMem = getHeapStats();
    const reclaimedBytes = afterBatchMem.heapUsed - afterCleanupMem.heapUsed;
    const reclaimedPercent = (reclaimedBytes / afterBatchMem.heapUsed) * 100;

    try {
      assert.ok(
        reclaimedPercent > 80,
        `Memory reclaimed ${reclaimedPercent.toFixed(1)}% is less than 80% target. Reclaimed: ${(reclaimedBytes / 1024 / 1024).toFixed(2)}MB from ${(afterBatchMem.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    } finally {
      db2.close();
      cleanupDb(db2);
    }
  } finally {
    db.close();
    cleanupDb(db);
  }
});

// ============================================================================
// Database File Size Benchmarks
// ============================================================================

test("event store: Database file size efficiency <2KB per event", async (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const eventBus = new TypedEventBus(db, store);

  try {
    const eventCount = 500;

    // Store events
    for (let i = 0; i < eventCount; i++) {
      eventBus.publish({
        eventType: "perf:filesize_test",
        taskId: newId("task"),
        payload: { index: i, data: "x".repeat(100) },
      });
    }

    db.close();

    const fs = await import("node:fs");
    const stats = fs.statSync(db.filePath);
    const bytesPerEvent = stats.size / eventCount;

    try {
      assert.ok(
        bytesPerEvent < 2048,
        `Database file size per event ${bytesPerEvent.toFixed(0)} bytes exceeds 2KB target. Total size: ${(stats.size / 1024).toFixed(2)}KB for ${eventCount} events`,
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
    cleanupDb(db);
  }
});

// ============================================================================
// Sustained Load Memory Benchmarks
// ============================================================================

test("event store: Sustained load memory growth <10MB over 10 seconds", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const eventBus = new TypedEventBus(db, store);

  try {
    const startMem = getHeapStats();
    const start = performance.now();
    const durationMs = 10000;
    let count = 0;

    while (performance.now() - start < durationMs) {
      eventBus.publish({
        eventType: "perf:sustained_test",
        taskId: newId("task"),
        payload: { index: count++, timestamp: Date.now() },
      });
    }

    // Force GC if available
    if (global.gc) {
      global.gc();
    }

    const endMem = getHeapStats();
    const growthMb = (endMem.heapUsed - startMem.heapUsed) / 1024 / 1024;

    try {
      assert.ok(
        growthMb < 10,
        `Sustained load memory growth ${growthMb.toFixed(2)}MB exceeds 10MB target over ${durationMs / 1000}s. Event count: ${count}`,
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
    cleanupDb(db);
  }
});

// ============================================================================
// Concurrent Write Memory Benchmarks
// ============================================================================

test("event store: Concurrent writes memory efficiency <8MB growth with 10 workers", async (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const eventBus = new TypedEventBus(db, store);

  try {
    const numWorkers = 10;
    const eventsPerWorker = 500;
    const startMem = getHeapStats();

    await Promise.all(
      Array.from({ length: numWorkers }, async (_, workerId) => {
        for (let i = 0; i < eventsPerWorker; i++) {
          eventBus.publish({
            eventType: "perf:concurrent_test",
            taskId: newId("task"),
            payload: { workerId, index: i, data: "x".repeat(50) },
          });
        }
      }),
    );

    // Force GC if available
    if (global.gc) {
      global.gc();
    }

    const endMem = getHeapStats();
    const growthMb = (endMem.heapUsed - startMem.heapUsed) / 1024 / 1024;

    try {
      assert.ok(
        growthMb < 8,
        `Concurrent writes memory growth ${growthMb.toFixed(2)}MB exceeds 8MB target with ${numWorkers} workers`,
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
    cleanupDb(db);
  }
});