/**
 * Performance Test: SQLite Query Operations
 * Measures SQLite database query throughput, latency, and transaction performance
 *
 * Design targets:
 * - Simple query: <1ms P99
 * - Complex query: <5ms P99
 * - Transaction throughput: >10000 ops/sec
 * - WAL checkpoint: <50ms
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

function createTempDb(): SqliteDatabase {
  const dbPath = join(".tmp", `sqlite-query-perf-${process.pid}-${Date.now()}.db`);
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

// ============================================================================
// Simple Query Performance Tests
// ============================================================================

test("performance: simple SELECT query <1ms P99", (t) => {
  const db = createTempDb();

  try {
    // Insert test data
    db.connection
      .prepare(`INSERT INTO tasks (id, title, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run("test-1", "Test Task 1", "pending", "normal", new Date().toISOString(), new Date().toISOString());
    db.connection
      .prepare(`INSERT INTO tasks (id, title, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run("test-2", "Test Task 2", "in_progress", "high", new Date().toISOString(), new Date().toISOString());

    const latencies: number[] = [];
    const iterations = 1000;

    // Warmup
    for (let i = 0; i < 10; i++) {
      db.connection.prepare(`SELECT * FROM tasks WHERE id = ?`).get("test-1");
    }

    // Measure
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      db.connection.prepare(`SELECT * FROM tasks WHERE id = ?`).get("test-1");
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 1,
        `Simple SELECT P99 latency ${p99.toFixed(3)}ms exceeds 1ms target. P50: ${p50.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    cleanupDb(db);
  }
});

test("performance: simple INSERT throughput >10000 ops/sec", (t) => {
  const db = createTempDb();

  try {
    const iterations = 5000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      db.connection
        .prepare(`INSERT INTO tasks (id, title, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(`task-${i}`, `Task ${i}`, "pending", "normal", new Date().toISOString(), new Date().toISOString());
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;

    try {
      assert.ok(
        opsPerSec > 10000,
        `Simple INSERT throughput ${opsPerSec.toFixed(2)} ops/sec must be >10000 ops/sec`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    cleanupDb(db);
  }
});

// ============================================================================
// Complex Query Performance Tests
// ============================================================================

test("performance: complex SELECT with JOIN <5ms P99", (t) => {
  const db = createTempDb();

  try {
    // Insert test data across multiple tables
    for (let i = 0; i < 100; i++) {
      db.connection
        .prepare(`INSERT INTO tasks (id, title, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(`task-${i}`, `Task ${i}`, "pending", "normal", new Date().toISOString(), new Date().toISOString());

      db.connection
        .prepare(`INSERT INTO executions (id, task_id, status, created_at) VALUES (?, ?, ?, ?)`)
        .run(`exec-${i}`, `task-${i}`, "running", new Date().toISOString());
    }

    const latencies: number[] = [];
    const iterations = 500;

    // Warmup
    for (let i = 0; i < 10; i++) {
      db.connection
        .prepare(`SELECT t.*, e.id as exec_id FROM tasks t LEFT JOIN executions e ON t.id = e.task_id WHERE t.status = ?`)
        .all("pending");
    }

    // Measure
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      db.connection
        .prepare(`SELECT t.*, e.id as exec_id FROM tasks t LEFT JOIN executions e ON t.id = e.task_id WHERE t.status = ?`)
        .all("pending");
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 5,
        `Complex SELECT P99 latency ${p99.toFixed(3)}ms exceeds 5ms target. P50: ${p50.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    cleanupDb(db);
  }
});

test("performance: aggregate query <3ms P99", (t) => {
  const db = createTempDb();

  try {
    // Insert test data
    for (let i = 0; i < 1000; i++) {
      db.connection
        .prepare(`INSERT INTO tasks (id, title, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(`task-${i}`, `Task ${i}`, i % 2 === 0 ? "pending" : "completed", "normal", new Date().toISOString(), new Date().toISOString());
    }

    const latencies: number[] = [];
    const iterations = 500;

    // Warmup
    for (let i = 0; i < 10; i++) {
      db.connection
        .prepare(`SELECT status, COUNT(*) as count, AVG(rowid) as avg_id FROM tasks GROUP BY status`)
        .all();
    }

    // Measure
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      db.connection
        .prepare(`SELECT status, COUNT(*) as count, AVG(rowid) as avg_id FROM tasks GROUP BY status`)
        .all();
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 3,
        `Aggregate query P99 latency ${p99.toFixed(3)}ms exceeds 3ms target. P50: ${p50.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    cleanupDb(db);
  }
});

// ============================================================================
// Transaction Performance Tests
// ============================================================================

test("performance: transaction throughput >5000 ops/sec", (t) => {
  const db = createTempDb();

  try {
    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      db.transaction(() => {
        db.connection
          .prepare(`INSERT INTO tasks (id, title, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
          .run(`txn-task-${i}`, `Task ${i}`, "pending", "normal", new Date().toISOString(), new Date().toISOString());
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;

    try {
      assert.ok(
        opsPerSec > 5000,
        `Transaction throughput ${opsPerSec.toFixed(2)} ops/sec must be >5000 ops/sec`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    cleanupDb(db);
  }
});

test("performance: transaction P99 latency <2ms", (t) => {
  const db = createTempDb();

  try {
    const latencies: number[] = [];
    const iterations = 500;

    // Warmup
    for (let i = 0; i < 10; i++) {
      db.transaction(() => {
        db.connection
          .prepare(`INSERT INTO tasks (id, title, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
          .run(`warmup-${i}`, `Task ${i}`, "pending", "normal", new Date().toISOString(), new Date().toISOString());
      });
    }

    // Measure
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      db.transaction(() => {
        db.connection
          .prepare(`INSERT INTO tasks (id, title, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
          .run(`txn-${i}`, `Task ${i}`, "pending", "normal", new Date().toISOString(), new Date().toISOString());
      });
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 2,
        `Transaction P99 latency ${p99.toFixed(3)}ms exceeds 2ms target. P50: ${p50.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    cleanupDb(db);
  }
});

// ============================================================================
// Bulk Operations Tests
// ============================================================================

test("performance: bulk INSERT of 1000 rows <100ms", (t) => {
  const db = createTempDb();

  try {
    const rowCount = 1000;
    const start = performance.now();

    db.transaction(() => {
      for (let i = 0; i < rowCount; i++) {
        db.connection
          .prepare(`INSERT INTO tasks (id, title, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
          .run(`bulk-${i}`, `Task ${i}`, "pending", "normal", new Date().toISOString(), new Date().toISOString());
      }
    });

    const elapsed = performance.now() - start;

    try {
      assert.ok(
        elapsed < 100,
        `Bulk INSERT of ${rowCount} rows took ${elapsed.toFixed(2)}ms, expected <100ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    cleanupDb(db);
  }
});

test("performance: batch operations scale linearly", (t) => {
  const db = createTempDb();

  try {
    const batchSizes = [100, 500, 1000];
    const results: { batch: number; opsPerSec: number }[] = [];

    for (const batchSize of batchSizes) {
      const start = performance.now();
      db.transaction(() => {
        for (let i = 0; i < batchSize; i++) {
          db.connection
            .prepare(`INSERT INTO tasks (id, title, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
            .run(`batch-${batchSize}-${i}`, `Task ${i}`, "pending", "normal", new Date().toISOString(), new Date().toISOString());
        }
      });
      const elapsed = performance.now() - start;
      const opsPerSec = (batchSize / elapsed) * 1000;
      results.push({ batch: batchSize, opsPerSec });
    }

    // All batches should maintain >3000 ops/sec
    for (const { batch, opsPerSec } of results) {
      try {
        assert.ok(
          opsPerSec > 3000,
          `Batch insert for size=${batch} achieved ${opsPerSec.toFixed(2)} ops/sec, expected >3000 ops/sec`,
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
    cleanupDb(db);
  }
});

// ============================================================================
// WAL Checkpoint Tests
// ============================================================================

test("performance: WAL checkpoint <50ms", (t) => {
  const db = createTempDb();

  try {
    // Generate some WAL content
    for (let i = 0; i < 1000; i++) {
      db.connection
        .prepare(`INSERT INTO tasks (id, title, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(`wal-${i}`, `Task ${i}`, "pending", "normal", new Date().toISOString(), new Date().toISOString());
    }

    const start = performance.now();
    db.checkpointWal();
    const elapsed = performance.now() - start;

    try {
      assert.ok(
        elapsed < 50,
        `WAL checkpoint took ${elapsed.toFixed(2)}ms, expected <50ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    cleanupDb(db);
  }
});

// ============================================================================
// Read Transaction Performance Tests
// ============================================================================

test("performance: read transaction throughput >10000 ops/sec", (t) => {
  const db = createTempDb();

  try {
    // Insert test data
    for (let i = 0; i < 100; i++) {
      db.connection
        .prepare(`INSERT INTO tasks (id, title, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(`read-txn-${i}`, `Task ${i}`, "pending", "normal", new Date().toISOString(), new Date().toISOString());
    }

    const iterations = 5000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      db.readTransaction(() => {
        db.connection.prepare(`SELECT * FROM tasks WHERE id = ?`).get(`read-txn-${i % 100}`);
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;

    try {
      assert.ok(
        opsPerSec > 10000,
        `Read transaction throughput ${opsPerSec.toFixed(2)} ops/sec must be >10000 ops/sec`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    cleanupDb(db);
  }
});

test("performance: read transaction P99 latency <0.5ms", (t) => {
  const db = createTempDb();

  try {
    // Insert test data
    for (let i = 0; i < 100; i++) {
      db.connection
        .prepare(`INSERT INTO tasks (id, title, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(`read-lat-${i}`, `Task ${i}`, "pending", "normal", new Date().toISOString(), new Date().toISOString());
    }

    const latencies: number[] = [];
    const iterations = 1000;

    // Warmup
    for (let i = 0; i < 10; i++) {
      db.readTransaction(() => {
        db.connection.prepare(`SELECT * FROM tasks WHERE id = ?`).get(`read-lat-${i}`);
      });
    }

    // Measure
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      db.readTransaction(() => {
        db.connection.prepare(`SELECT * FROM tasks WHERE id = ?`).get(`read-lat-${i % 100}`);
      });
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 0.5,
        `Read transaction P99 latency ${p99.toFixed(3)}ms exceeds 0.5ms target. P50: ${p50.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    cleanupDb(db);
  }
});

// ============================================================================
// High-Volume Stress Tests
// ============================================================================

test("performance: handles 10000 queries without degradation", (t) => {
  const db = createTempDb();

  try {
    // Insert test data
    for (let i = 0; i < 100; i++) {
      db.connection
        .prepare(`INSERT INTO tasks (id, title, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(`stress-${i}`, `Task ${i}`, "pending", "normal", new Date().toISOString(), new Date().toISOString());
    }

    const iterations = 10000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      db.connection.prepare(`SELECT * FROM tasks WHERE id = ?`).get(`stress-${i % 100}`);
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;

    try {
      assert.ok(
        opsPerSec > 5000,
        `High-volume query achieved ${opsPerSec.toFixed(2)} ops/sec, expected >5000 ops/sec`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    cleanupDb(db);
  }
});

// ============================================================================
// Migration Performance Tests
// ============================================================================

test("performance: database migration <100ms", (t) => {
  const dbPath = join(".tmp", `sqlite-migration-perf-${process.pid}-${Date.now()}.db`);
  const db = new SqliteDatabase(dbPath);

  try {
    const start = performance.now();
    db.migrate();
    const elapsed = performance.now() - start;

    try {
      assert.ok(
        elapsed < 100,
        `Database migration took ${elapsed.toFixed(2)}ms, expected <100ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    cleanupDb(db);
  }
});
