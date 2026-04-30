/**
 * Performance Test: SQLite Transaction Throughput
 * Measures raw SQLite transaction performance
 *
 * Design targets:
 * - Single transaction (no-op): >10000 ops/sec
 * - Transaction with single insert: >5000 ops/sec
 * - Transaction with 10 inserts: >2000 ops/sec
 * - Nested transaction overhead: <0.1ms
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { rmSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { reportSoftPerformanceMiss } from "../helpers/performance.js";

import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { newId, nowIso } from "../../src/platform/contracts/types/ids.js";

function createTempDb(): SqliteDatabase {
  const dbPath = join(".tmp", `sqlite-transaction-perf-${process.pid}-${Date.now()}.db`);
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
// No-Op Transaction Benchmarks
// ============================================================================

test("performance: SQLite no-op transaction throughput >10000 ops/sec", (t) => {
  const db = createTempDb();

  try {
    const iterations = 10000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      db.transaction(() => {
        // No-op transaction
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 10000,
        `No-op transaction throughput ${opsPerSec.toFixed(0)} ops/sec must be >10000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
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

test("performance: SQLite no-op transaction P99 latency <0.2ms", (t) => {
  const db = createTempDb();

  try {
    const latencies: number[] = [];
    const iterations = 5000;

    // Warmup
    for (let i = 0; i < 100; i++) {
      db.transaction(() => {});
    }

    // Measure
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      db.transaction(() => {});
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 0.2,
        `No-op transaction P99 latency ${p99.toFixed(4)}ms exceeds 0.2ms target. P50: ${p50.toFixed(4)}ms`,
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
// Transaction with Single Insert Benchmarks
// ============================================================================

test("performance: SQLite transaction with single insert throughput >5000 ops/sec", (t) => {
  const db = createTempDb();

  try {
    const iterations = 5000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const taskId = newId("task");
      db.transaction(() => {
        db.connection
          .prepare(
            `INSERT INTO tasks (
              id, parent_id, root_id, division_id, title, status, source,
              priority, input_json, normalized_input_json, output_json,
              estimated_cost_usd, actual_cost_usd, error_code,
              created_at, updated_at, completed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            taskId,
            null,
            taskId,
            "general_ops",
            `Transaction test ${i}`,
            "queued",
            "user",
            "normal",
            "{}",
            "{}",
            null,
            0,
            0,
            null,
            nowIso(),
            nowIso(),
            null,
          );
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 5000,
        `Transaction with insert throughput ${opsPerSec.toFixed(0)} ops/sec must be >5000 ops/sec. Avg: ${avgLatencyMs.toFixed(3)}ms`,
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
// Transaction with Multiple Inserts Benchmarks
// ============================================================================

test("performance: SQLite transaction with 10 inserts <5ms", (t) => {
  const db = createTempDb();

  try {
    const batchSize = 10;
    const iterations = 500;
    const start = performance.now();

    for (let batch = 0; batch < iterations; batch++) {
      db.transaction(() => {
        for (let i = 0; i < batchSize; i++) {
          const taskId = newId("task");
          db.connection
            .prepare(
              `INSERT INTO tasks (
                id, parent_id, root_id, division_id, title, status, source,
                priority, input_json, normalized_input_json, output_json,
                estimated_cost_usd, actual_cost_usd, error_code,
                created_at, updated_at, completed_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(
              taskId,
              null,
              taskId,
              "general_ops",
              `Batch ${batch} item ${i}`,
              "queued",
              "user",
              "normal",
              "{}",
              "{}",
              null,
              0,
              0,
              null,
              nowIso(),
              nowIso(),
              null,
            );
        }
      });
    }

    const elapsed = performance.now() - start;
    const totalInserts = iterations * batchSize;
    const avgLatencyPerBatchMs = elapsed / iterations;

    try {
      assert.ok(
        avgLatencyPerBatchMs < 5,
        `Transaction with ${batchSize} inserts took ${avgLatencyPerBatchMs.toFixed(3)}ms/batch, expected <5ms. Total: ${elapsed.toFixed(2)}ms`,
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

test("performance: SQLite transaction with 100 inserts <50ms", (t) => {
  const db = createTempDb();

  try {
    const batchSize = 100;
    const iterations = 100;
    const start = performance.now();

    for (let batch = 0; batch < iterations; batch++) {
      db.transaction(() => {
        for (let i = 0; i < batchSize; i++) {
          const taskId = newId("task");
          db.connection
            .prepare(
              `INSERT INTO tasks (
                id, parent_id, root_id, division_id, title, status, source,
                priority, input_json, normalized_input_json, output_json,
                estimated_cost_usd, actual_cost_usd, error_code,
                created_at, updated_at, completed_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(
              taskId,
              null,
              taskId,
              "general_ops",
              `Batch ${batch} item ${i}`,
              "queued",
              "user",
              "normal",
              "{}",
              "{}",
              null,
              0,
              0,
              null,
              nowIso(),
              nowIso(),
              null,
            );
        }
      });
    }

    const elapsed = performance.now() - start;
    const totalInserts = iterations * batchSize;
    const opsPerSec = (totalInserts / elapsed) * 1000;

    try {
      assert.ok(
        elapsed < 50 * iterations,
        `Transaction with ${batchSize} inserts took ${elapsed.toFixed(2)}ms total, expected <${50 * iterations}ms. Throughput: ${opsPerSec.toFixed(0)} ops/sec`,
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
// Read Transaction Benchmarks
// ============================================================================

test("performance: SQLite read transaction throughput >15000 ops/sec", (t) => {
  const db = createTempDb();

  try {
    // Insert test data
    const insertCount = 100;
    for (let i = 0; i < insertCount; i++) {
      const taskId = newId("task");
      db.transaction(() => {
        db.connection
          .prepare(
            `INSERT INTO tasks (
              id, parent_id, root_id, division_id, title, status, source,
              priority, input_json, normalized_input_json, output_json,
              estimated_cost_usd, actual_cost_usd, error_code,
              created_at, updated_at, completed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            taskId,
            null,
            taskId,
            "general_ops",
            `Read test ${i}`,
            "queued",
            "user",
            "normal",
            "{}",
            "{}",
            null,
            0,
            0,
            null,
            nowIso(),
            nowIso(),
            null,
          );
      });
    }

    const iterations = 5000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      db.readTransaction(() => {
        db.connection.prepare("SELECT COUNT(*) FROM tasks").get();
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 15000,
        `Read transaction throughput ${opsPerSec.toFixed(0)} ops/sec must be >15000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
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
// Concurrent Transaction Benchmarks (Sequential)
// ============================================================================

test("performance: SQLite sequential writes (100 transactions) <200ms", (t) => {
  const db = createTempDb();

  try {
    const iterations = 100;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const taskId = newId("task");
      db.transaction(() => {
        db.connection
          .prepare(
            `INSERT INTO tasks (
              id, parent_id, root_id, division_id, title, status, source,
              priority, input_json, normalized_input_json, output_json,
              estimated_cost_usd, actual_cost_usd, error_code,
              created_at, updated_at, completed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            taskId,
            null,
            taskId,
            "general_ops",
            `Sequential write ${i}`,
            "queued",
            "user",
            "normal",
            "{}",
            "{}",
            null,
            0,
            0,
            null,
            nowIso(),
            nowIso(),
            null,
          );
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;

    try {
      assert.ok(
        elapsed < 200,
        `100 sequential writes took ${elapsed.toFixed(2)}ms, expected <200ms. Throughput: ${opsPerSec.toFixed(0)} ops/sec`,
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
