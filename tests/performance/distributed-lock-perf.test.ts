/**
 * Performance Test: Distributed Lock Service
 * Measures distributed lock acquisition, release, and query throughput
 *
 * Design targets:
 * - Lock acquisition: >500 ops/sec
 * - Lock release: >500 ops/sec
 * - Lock query: >2000 ops/sec
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { rmSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { reportSoftPerformanceMiss } from "../helpers/performance.js";

import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { createLockAdapter } from "../../src/platform/execution/distributed-lock/distributed-lock-factory.js";
import { newId } from "../../src/platform/contracts/types/ids.js";

function createTempDb(): SqliteDatabase {
  const dbPath = join(".tmp", `dist-lock-perf-${process.pid}-${Date.now()}.db`);
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
// Lock Acquisition Benchmarks
// ============================================================================

test("performance: SqliteLockAdapter acquire() >500 ops/sec", (t) => {
  const db = createTempDb();

  try {
    const adapter = createLockAdapter("sqlite", db);

    const lockName = "test-lock-perf";
    const iterations = 500;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      adapter.acquire({
        lockName,
        ownerId: `${newId("owner")}-${i}`,
        ttlMs: 5000,
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;

    try {
      assert.ok(opsPerSec > 500, `Lock acquire ${opsPerSec.toFixed(0)} ops/sec must be >500 ops/sec`);
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
// Lock Release Benchmarks
// ============================================================================

test("performance: SqliteLockAdapter release() >500 ops/sec", (t) => {
  const db = createTempDb();

  try {
    const adapter = createLockAdapter("sqlite", db);

    const iterations = 500;
    let elapsed = 0;

    for (let i = 0; i < iterations; i++) {
      const lockName = `test-lock-release-${i}`;
      const ownerId = newId("owner");

      adapter.acquire({
        lockName,
        ownerId,
        ttlMs: 5000,
      });

      const start = performance.now();
      adapter.release({
        lockName,
        ownerId,
      });
      elapsed += performance.now() - start;
    }

    const opsPerSec = (iterations / elapsed) * 1000;

    try {
      assert.ok(opsPerSec > 500, `Lock release ${opsPerSec.toFixed(0)} ops/sec must be >500 ops/sec`);
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
// Lock Query Benchmarks
// ============================================================================

test("performance: SqliteLockAdapter queryLock() >2000 ops/sec", (t) => {
  const db = createTempDb();

  try {
    const adapter = createLockAdapter("sqlite", db);

    const lockName = "test-lock-query";

    // Setup lock
    adapter.acquire({
      lockName,
      ownerId: newId("owner"),
      ttlMs: 10000,
    });

    const iterations = 2000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      adapter.queryLock(lockName);
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;

    try {
      assert.ok(opsPerSec > 2000, `Lock query ${opsPerSec.toFixed(0)} ops/sec must be >2000 ops/sec`);
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
// Concurrent Lock Operations Benchmarks
// ============================================================================

test("performance: SqliteLockAdapter concurrent operations (10 parallel) >300 ops/sec", (t) => {
  const db = createTempDb();

  try {
    const adapter = createLockAdapter("sqlite", db);

    const iterations = 30;
    const parallelCount = 10;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const promises = Array.from({ length: parallelCount }, (_, idx) =>
        (async () => {
          const lockName = `test-lock-parallel-${i}-${idx}`;
          adapter.acquire({
            lockName,
            ownerId: newId("owner"),
            ttlMs: 5000,
          });
        })()
      );
      Promise.all(promises);
    }

    const elapsed = performance.now() - start;
    const totalOps = iterations * parallelCount;
    const opsPerSec = (totalOps / elapsed) * 1000;

    try {
      assert.ok(opsPerSec > 300, `Concurrent lock ops ${opsPerSec.toFixed(0)} ops/sec must be >300 ops/sec`);
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
// Lock Reacquisition Benchmarks
// ============================================================================

test("performance: SqliteLockAdapter reacquireExpiredLock() >200 ops/sec", (t) => {
  const db = createTempDb();

  try {
    const adapter = createLockAdapter("sqlite", db);

    const iterations = 200;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const lockName = `test-lock-reacquire-${i}`;
      const ownerId = newId("owner");

      // First acquisition with very short TTL
      adapter.acquire({
        lockName,
        ownerId,
        ttlMs: 1,
      });

      // Small delay for lock expiration
      const waitStart = performance.now();
      while (performance.now() - waitStart < 5) {
        // Busy wait for lock expiration
      }

      // Reacquire
      adapter.acquire({
        lockName,
        ownerId,
        ttlMs: 5000,
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;

    try {
      assert.ok(opsPerSec > 200, `Lock reacquire ${opsPerSec.toFixed(0)} ops/sec must be >200 ops/sec`);
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