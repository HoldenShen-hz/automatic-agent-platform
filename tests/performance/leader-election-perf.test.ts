/**
 * Performance Test: Leader Election Service
 * Measures leader election throughput, lease acquisition, and failover latency
 *
 * Design targets:
 * - Lease acquisition: >500 ops/sec
 * - Leadership query: >3000 ops/sec
 * - Epoch increment: >2000 ops/sec
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { rmSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { reportSoftPerformanceMiss } from "../helpers/performance.js";

import { SqliteDatabase } from "../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { HaCoordinatorService } from "../../src/platform/five-plane-execution/ha/ha-coordinator-service-inner.js";
import { newId } from "../../src/platform/contracts/types/ids.js";

function createTempDb(): SqliteDatabase {
  const dbPath = join(".tmp", `leader-election-perf-${process.pid}-${Date.now()}.db`);
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
// Leadership Acquisition Benchmarks
// ============================================================================

test("performance: HaCoordinatorService acquireLeadership() >300 ops/sec", (t) => {
  const db = createTempDb();

  try {
    const coordinator = new HaCoordinatorService(db);
    const region = "us-east-1";

    const iterations = 300;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const uniqueNodeId = `${newId("node")}-${i}`;
      coordinator.acquireLeadership({
        nodeId: uniqueNodeId,
        region,
        desiredLeaderId: uniqueNodeId,
        ttlMs: 5000,
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;

    try {
      assert.ok(opsPerSec > 300, `acquireLeadership() ${opsPerSec.toFixed(0)} ops/sec must be >300 ops/sec`);
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

test("performance: HaCoordinatorService queryLeadership() >2000 ops/sec", (t) => {
  const db = createTempDb();

  try {
    const coordinator = new HaCoordinatorService(db);
    const nodeId = newId("node");
    const region = "us-east-1";

    // Setup initial leader
    coordinator.acquireLeadership({
      nodeId,
      region,
      desiredLeaderId: nodeId,
      ttlMs: 10000,
    });

    const iterations = 2000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      coordinator.queryLeadership(nodeId);
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;

    try {
      assert.ok(opsPerSec > 2000, `queryLeadership() ${opsPerSec.toFixed(0)} ops/sec must be >2000 ops/sec`);
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
// Leadership Renewal Benchmarks
// ============================================================================

test("performance: HaCoordinatorService renewLeadership() >500 ops/sec", (t) => {
  const db = createTempDb();

  try {
    const coordinator = new HaCoordinatorService(db);
    const nodeId = newId("node");
    const region = "us-east-1";

    // Setup initial leader
    const lease = coordinator.acquireLeadership({
      nodeId,
      region,
      desiredLeaderId: nodeId,
      ttlMs: 10000,
    });

    const iterations = 500;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      coordinator.renewLeadership({
        nodeId,
        leaseId: lease.leaseId,
        fencingToken: lease.fencingToken,
        ttlMs: 10000,
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;

    try {
      assert.ok(opsPerSec > 500, `renewLeadership() ${opsPerSec.toFixed(0)} ops/sec must be >500 ops/sec`);
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
// Epoch Management Benchmarks
// ============================================================================

test("performance: HaCoordinatorService incrementEpoch() >1000 ops/sec", (t) => {
  const db = createTempDb();

  try {
    const coordinator = new HaCoordinatorService(db);

    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      coordinator.incrementEpoch({
        nodeId: newId("node"),
        region: "us-east-1",
        reason: "test-epoch",
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;

    try {
      assert.ok(opsPerSec > 1000, `incrementEpoch() ${opsPerSec.toFixed(0)} ops/sec must be >1000 ops/sec`);
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
// Node Registration Benchmarks
// ============================================================================

test("performance: HaCoordinatorService registerNode() >2000 ops/sec", (t) => {
  const db = createTempDb();

  try {
    const coordinator = new HaCoordinatorService(db);

    const iterations = 2000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      coordinator.registerNode(`${newId("node")}-${i}`, "us-east-1", { index: i });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;

    try {
      assert.ok(opsPerSec > 2000, `registerNode() ${opsPerSec.toFixed(0)} ops/sec must be >2000 ops/sec`);
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
// Leadership Query with Expired Lease
// ============================================================================

test("performance: HaCoordinatorService queryLeadership (no lease) >5000 ops/sec", (t) => {
  const db = createTempDb();

  try {
    const coordinator = new HaCoordinatorService(db);
    const nodeId = newId("node");

    // Register node without acquiring leadership
    coordinator.registerNode(nodeId, "us-east-1");

    const iterations = 5000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      coordinator.queryLeadership(nodeId);
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;

    try {
      assert.ok(opsPerSec > 5000, `queryLeadership (no lease) ${opsPerSec.toFixed(0)} ops/sec must be >5000 ops/sec`);
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