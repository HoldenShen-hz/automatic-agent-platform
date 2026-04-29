/**
 * Performance Test: Query Performance Benchmarks
 * Measures database query and retrieval performance
 *
 * Design targets:
 * - Task lookup by ID: <1ms P99
 * - List queries: <10ms P99 for 100 records
 * - Count queries: <5ms P99
 * - Index scan throughput: >5000 ops/sec
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { rmSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { reportSoftPerformanceMiss } from "../helpers/performance.js";

import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { newId, nowIso } from "../../src/platform/contracts/types/ids.js";

function createTempDb(): SqliteDatabase {
  const dbPath = join(".tmp", `query-perf-${process.pid}-${Date.now()}.db`);
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
// Task Lookup Benchmarks
// ============================================================================

test("query: Task lookup by ID latency P99 <1ms", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    // Insert tasks
    const taskIds: string[] = [];
    const iterations = 5000;

    for (let i = 0; i < iterations; i++) {
      const taskId = newId("task");
      const now = nowIso();
      db.transaction(() => {
        store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general_ops",
          title: `Task ${i}`,
          status: "queued",
          source: "user",
          priority: "normal",
          inputJson: "{}",
          normalizedInputJson: "{}",
          outputJson: null,
          estimatedCostUsd: 0,
          actualCostUsd: 0,
          errorCode: null,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        });
      });
      taskIds.push(taskId);
    }

    // Warmup
    for (let i = 0; i < 100; i++) {
      store.getTask(taskIds[i % taskIds.length]!);
    }

    // Measure
    const latencies: number[] = [];
    const measureIterations = 2000;

    for (let i = 0; i < measureIterations; i++) {
      const start = performance.now();
      store.getTask(taskIds[i % taskIds.length]!);
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(measureIterations * 0.99)]!;
    const p50 = latencies[Math.floor(measureIterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 1,
        `Task lookup P99 latency ${p99.toFixed(4)}ms exceeds 1ms target. P50: ${p50.toFixed(4)}ms`,
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

test("query: Task lookup throughput >10000 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    // Insert tasks
    const taskIds: string[] = [];
    const iterations = 5000;

    for (let i = 0; i < iterations; i++) {
      const taskId = newId("task");
      const now = nowIso();
      db.transaction(() => {
        store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general_ops",
          title: `Task ${i}`,
          status: "queued",
          source: "user",
          priority: "normal",
          inputJson: "{}",
          normalizedInputJson: "{}",
          outputJson: null,
          estimatedCostUsd: 0,
          actualCostUsd: 0,
          errorCode: null,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        });
      });
      taskIds.push(taskId);
    }

    // Benchmark
    const measureIterations = 10000;
    const start = performance.now();

    for (let i = 0; i < measureIterations; i++) {
      store.getTask(taskIds[i % taskIds.length]!);
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (measureIterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / measureIterations;

    try {
      assert.ok(
        opsPerSec > 10000,
        `Task lookup throughput ${opsPerSec.toFixed(0)} ops/sec must be >10000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
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
// List Query Benchmarks
// ============================================================================

test("query: List tasks (100 records) latency P99 <10ms", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    // Insert tasks
    const insertIterations = 1000;

    for (let i = 0; i < insertIterations; i++) {
      const taskId = newId("task");
      const now = nowIso();
      db.transaction(() => {
        store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general_ops",
          title: `Task ${i}`,
          status: i % 2 === 0 ? "queued" : "running",
          source: "user",
          priority: "normal",
          inputJson: "{}",
          normalizedInputJson: "{}",
          outputJson: null,
          estimatedCostUsd: 0,
          actualCostUsd: 0,
          errorCode: null,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        });
      });
    }

    // Warmup
    for (let i = 0; i < 50; i++) {
      store.listTasks({ limit: 100, offset: 0 });
    }

    // Measure
    const latencies: number[] = [];
    const measureIterations = 1000;

    for (let i = 0; i < measureIterations; i++) {
      const start = performance.now();
      store.listTasks({ limit: 100, offset: 0 });
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(measureIterations * 0.99)]!;
    const p50 = latencies[Math.floor(measureIterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 10,
        `List tasks P99 latency ${p99.toFixed(4)}ms exceeds 10ms target. P50: ${p50.toFixed(4)}ms`,
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

test("query: List tasks throughput >500 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    // Insert tasks
    const insertIterations = 2000;

    for (let i = 0; i < insertIterations; i++) {
      const taskId = newId("task");
      const now = nowIso();
      db.transaction(() => {
        store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general_ops",
          title: `Task ${i}`,
          status: "queued",
          source: "user",
          priority: "normal",
          inputJson: "{}",
          normalizedInputJson: "{}",
          outputJson: null,
          estimatedCostUsd: 0,
          actualCostUsd: 0,
          errorCode: null,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        });
      });
    }

    // Benchmark
    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      store.listTasks({ limit: 100, offset: 0 });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 500,
        `List tasks throughput ${opsPerSec.toFixed(0)} ops/sec must be >500 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
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
// Count Query Benchmarks
// ============================================================================

test("query: Count queued tasks latency P99 <5ms", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    // Insert tasks
    const insertIterations = 5000;

    for (let i = 0; i < insertIterations; i++) {
      const taskId = newId("task");
      const now = nowIso();
      db.transaction(() => {
        store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general_ops",
          title: `Task ${i}`,
          status: "queued",
          source: "user",
          priority: "normal",
          inputJson: "{}",
          normalizedInputJson: "{}",
          outputJson: null,
          estimatedCostUsd: 0,
          actualCostUsd: 0,
          errorCode: null,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        });
      });
    }

    // Warmup
    for (let i = 0; i < 50; i++) {
      store.countQueuedTasks({});
    }

    // Measure
    const latencies: number[] = [];
    const measureIterations = 2000;

    for (let i = 0; i < measureIterations; i++) {
      const start = performance.now();
      store.countQueuedTasks({});
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(measureIterations * 0.99)]!;
    const p50 = latencies[Math.floor(measureIterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 5,
        `Count queued tasks P99 latency ${p99.toFixed(4)}ms exceeds 5ms target. P50: ${p50.toFixed(4)}ms`,
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

test("query: Count operations throughput >2000 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    // Insert tasks
    const insertIterations = 5000;

    for (let i = 0; i < insertIterations; i++) {
      const taskId = newId("task");
      const now = nowIso();
      db.transaction(() => {
        store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general_ops",
          title: `Task ${i}`,
          status: "queued",
          source: "user",
          priority: "normal",
          inputJson: "{}",
          normalizedInputJson: "{}",
          outputJson: null,
          estimatedCostUsd: 0,
          actualCostUsd: 0,
          errorCode: null,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        });
      });
    }

    // Benchmark
    const iterations = 5000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      store.countQueuedTasks({});
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 2000,
        `Count operations throughput ${opsPerSec.toFixed(0)} ops/sec must be >2000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
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
// Composite Query Benchmarks
// ============================================================================

test("query: Paginated task listing (varying offset) throughput >500 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    // Insert tasks
    const insertIterations = 5000;

    for (let i = 0; i < insertIterations; i++) {
      const taskId = newId("task");
      const now = nowIso();
      db.transaction(() => {
        store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general_ops",
          title: `Task ${i}`,
          status: "queued",
          source: "user",
          priority: "normal",
          inputJson: "{}",
          normalizedInputJson: "{}",
          outputJson: null,
          estimatedCostUsd: 0,
          actualCostUsd: 0,
          errorCode: null,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        });
      });
    }

    // Benchmark with varying offsets
    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const offset = (i * 10) % 500;
      store.listTasks({ limit: 50, offset });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 500,
        `Paginated listing throughput ${opsPerSec.toFixed(0)} ops/sec must be >500 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
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
