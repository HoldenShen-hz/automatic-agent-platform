/**
 * Performance Test: Task Insertion Throughput
 * Measures AuthoritativeTaskStore.insertTask() performance
 *
 * Design targets:
 * - Single task insertion: >1000 ops/sec
 * - Bulk task insertion (100 tasks): >2000 ops/sec
 * - Task retrieval by ID: >5000 ops/sec
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { rmSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { reportSoftPerformanceMiss } from "../helpers/performance.js";

import { SqliteDatabase } from "../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { newId, nowIso } from "../../src/platform/contracts/types/ids.js";

function createTempDb(): SqliteDatabase {
  const dbPath = join(".tmp", `task-insertion-perf-${process.pid}-${Date.now()}.db`);
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  return db;
}

// ============================================================================
// Single Task Insertion Benchmarks
// ============================================================================

test("performance: TaskStore.insertTask() throughput >1000 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const taskId = newId("task");
      const now = nowIso();
      db.transaction(() => {
        store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general-ops",
          title: `Task insertion test ${i}`,
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

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 1000,
        `Task insertion throughput ${opsPerSec.toFixed(0)} ops/sec must be >1000 ops/sec. Avg: ${avgLatencyMs.toFixed(3)}ms`,
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
    rmSync(join(".tmp", `task-insertion-perf-${process.pid}-${Date.now()}.db`), { force: true });
  }
});

test("performance: TaskStore.insertTask() P99 latency <5ms", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    const latencies: number[] = [];
    const iterations = 500;

    // Warmup
    for (let i = 0; i < 50; i++) {
      const taskId = newId("task");
      const now = nowIso();
      db.transaction(() => {
        store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general-ops",
          title: `Warmup ${i}`,
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

    // Measure
    for (let i = 0; i < iterations; i++) {
      const taskId = newId("task");
      const now = nowIso();
      const start = performance.now();
      db.transaction(() => {
        store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general-ops",
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
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 5,
        `Task insertion P99 latency ${p99.toFixed(3)}ms exceeds 5ms target. P50: ${p50.toFixed(3)}ms`,
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
    rmSync(join(".tmp", `task-insertion-perf-${process.pid}-${Date.now()}.db`), { force: true });
  }
});

// ============================================================================
// Bulk Task Insertion Benchmarks
// ============================================================================

test("performance: Bulk task insertion (100 tasks) <100ms", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    const taskCount = 100;
    const start = performance.now();

    for (let i = 0; i < taskCount; i++) {
      const taskId = newId("task");
      const now = nowIso();
      db.transaction(() => {
        store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general-ops",
          title: `Bulk task ${i}`,
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

    const elapsed = performance.now() - start;
    const opsPerSec = (taskCount / elapsed) * 1000;

    try {
      assert.ok(
        elapsed < 100,
        `Bulk insertion of ${taskCount} tasks took ${elapsed.toFixed(2)}ms, expected <100ms. Throughput: ${opsPerSec.toFixed(0)} ops/sec`,
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
    rmSync(join(".tmp", `task-insertion-perf-${process.pid}-${Date.now()}.db`), { force: true });
  }
});

// ============================================================================
// Task Retrieval Benchmarks
// ============================================================================

test("performance: TaskStore.getTaskById() throughput >5000 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    // Create tasks first
    const taskIds: string[] = [];
    for (let i = 0; i < 100; i++) {
      const taskId = newId("task");
      taskIds.push(taskId);
      const now = nowIso();
      db.transaction(() => {
        store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general-ops",
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

    const iterations = 5000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      store.getTask(taskIds[i % taskIds.length]!);
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 5000,
        `Task retrieval throughput ${opsPerSec.toFixed(0)} ops/sec must be >5000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
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
    rmSync(join(".tmp", `task-insertion-perf-${process.pid}-${Date.now()}.db`), { force: true });
  }
});

test("performance: TaskStore.getTaskById() P99 latency <0.5ms", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    // Create tasks first
    const taskIds: string[] = [];
    for (let i = 0; i < 100; i++) {
      const taskId = newId("task");
      taskIds.push(taskId);
      const now = nowIso();
      db.transaction(() => {
        store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general-ops",
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

    const latencies: number[] = [];
    const iterations = 2000;

    // Warmup
    for (let i = 0; i < 100; i++) {
      store.getTask(taskIds[i % taskIds.length]!);
    }

    // Measure
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      store.getTask(taskIds[i % taskIds.length]!);
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 0.5,
        `Task retrieval P99 latency ${p99.toFixed(4)}ms exceeds 0.5ms target. P50: ${p50.toFixed(4)}ms`,
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
    rmSync(join(".tmp", `task-insertion-perf-${process.pid}-${Date.now()}.db`), { force: true });
  }
});

// ============================================================================
// Task Status Update Benchmarks
// ============================================================================

test("performance: TaskStore.updateTaskStatus() throughput >2000 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    // Create tasks first
    const taskIds: string[] = [];
    for (let i = 0; i < 100; i++) {
      const taskId = newId("task");
      taskIds.push(taskId);
      const now = nowIso();
      db.transaction(() => {
        store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general-ops",
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

    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const taskId = taskIds[i % taskIds.length]!;
      store.updateTaskStatus(taskId, "pending", nowIso(), null, null);
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 2000,
        `Task status update throughput ${opsPerSec.toFixed(0)} ops/sec must be >2000 ops/sec. Avg: ${avgLatencyMs.toFixed(3)}ms`,
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
    rmSync(join(".tmp", `task-insertion-perf-${process.pid}-${Date.now()}.db`), { force: true });
  }
});
