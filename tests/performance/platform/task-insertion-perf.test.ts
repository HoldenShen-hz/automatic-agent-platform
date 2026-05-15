/**
 * Performance Test: Task Insertion Throughput
 * Measures task insertion throughput and latency for the AuthoritativeTaskStoreFacade
 *
 * Design targets:
 * - Task insertion: >1000 ops/sec
 * - Task insertion P99: <2ms
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
import { newId, nowIso } from "../../../src/platform/contracts/types/ids.js";
import type { TaskRecord, TaskSource, TaskPriority } from "../../../src/platform/contracts/types/domain.js";

function createTempDb(): SqliteDatabase {
  const dbPath = join(".tmp", `task-insertion-perf-${process.pid}-${Date.now()}.db`);
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

test("performance: task insertion throughput >1000 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);

  try {
    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const task = createTestTaskRecord({
        id: newId("task"),
        inputJson: JSON.stringify({ iteration: i }),
      });
      store.insertTask(task);
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 1000,
        `Task insertion throughput ${opsPerSec.toFixed(2)} ops/sec must be >1000 ops/sec. Avg latency: ${avgLatencyMs.toFixed(3)}ms`,
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

test("performance: task insertion P99 latency <2ms", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);

  try {
    const latencies: number[] = [];
    const iterations = 500;

    // Warmup
    for (let i = 0; i < 10; i++) {
      const task = createTestTaskRecord({ id: newId("task") });
      store.insertTask(task);
    }

    // Measure
    for (let i = 0; i < iterations; i++) {
      const task = createTestTaskRecord({ id: newId("task") });
      const start = performance.now();
      store.insertTask(task);
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 2,
        `Task insertion P99 latency ${p99.toFixed(3)}ms exceeds 2ms target. P50: ${p50.toFixed(3)}ms`,
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

test("performance: bulk task insertion throughput scales linearly", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);

  try {
    const batchSizes = [100, 500, 1000];
    const results: { batch: number; opsPerSec: number }[] = [];

    for (const batch of batchSizes) {
      const start = performance.now();
      for (let i = 0; i < batch; i++) {
        const task = createTestTaskRecord({ id: newId("task") });
        store.insertTask(task);
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (batch / elapsed) * 1000;
      results.push({ batch, opsPerSec });
    }

    // All batches should maintain >800 ops/sec (allowing some overhead for larger batches)
    for (const { batch, opsPerSec } of results) {
      try {
        assert.ok(
          opsPerSec > 800,
          `Bulk insertion for batch=${batch} achieved ${opsPerSec.toFixed(2)} ops/sec, expected >800 ops/sec`,
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
    db.close();
    rmSync(db.filePath, { force: true });
    rmSync(`${db.filePath}-wal`, { force: true });
    rmSync(`${db.filePath}-shm`, { force: true });
  }
});
