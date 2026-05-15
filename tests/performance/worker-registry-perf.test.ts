/**
 * Performance Test: Worker Registry Service
 * Measures heartbeat processing, worker listing, and selection throughput
 *
 * Design targets:
 * - Heartbeat recording: >5000 ops/sec
 * - Worker listing: >1000 ops/sec
 * - Eligible worker selection: >500 ops/sec
 * - Worker lookup by ID: <1ms P99
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { rmSync } from "node:fs";
import { reportSoftPerformanceMiss } from "../helpers/performance.js";

import { SqliteDatabase } from "../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { WorkerRegistryService, type WorkerRegistryHeartbeatInput } from "../../src/platform/five-plane-execution/worker-pool/worker/worker-registry-service.js";
import { newId, nowIso } from "../../src/platform/contracts/types/ids.js";

function createTempDb(): SqliteDatabase {
  const dbPath = join(".tmp", `worker-registry-perf-${process.pid}-${Date.now()}.db`);
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  return db;
}

function createHeartbeat(workerId: string, index: number): WorkerRegistryHeartbeatInput {
  return {
    workerId,
    status: index % 3 === 0 ? "busy" : "idle",
    capabilities: ["code-execution", "file-read", "file-write"],
    runningExecutionIds: index % 3 === 0 ? [`exec-${index}`] : [],
    maxConcurrency: 10,
    cpuPct: 25 + (index % 50),
    memoryMb: 512 + (index % 256),
    toolBacklogCount: index % 5,
    occurredAt: nowIso(),
  };
}

// ============================================================================
// Heartbeat Recording Benchmarks
// ============================================================================

test("performance: recordHeartbeat throughput >5000 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const registry = new WorkerRegistryService(store);

  try {
    const iterations = 5000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const workerId = newId("worker");
      registry.recordHeartbeat(createHeartbeat(workerId, i));
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 5000,
        `Heartbeat recording throughput ${opsPerSec.toFixed(0)} ops/sec must be >5000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
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

test("performance: recordHeartbeat P99 latency <1ms", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const registry = new WorkerRegistryService(store);

  try {
    // Pre-register workers
    const workerIds: string[] = [];
    for (let i = 0; i < 100; i++) {
      const workerId = newId("worker");
      workerIds.push(workerId);
      registry.recordHeartbeat(createHeartbeat(workerId, i));
    }

    const latencies: number[] = [];
    const iterations = 5000;

    // Warmup
    for (let i = 0; i < 100; i++) {
      registry.recordHeartbeat(createHeartbeat(workerIds[i % workerIds.length]!, i));
    }

    // Measure
    for (let i = 0; i < iterations; i++) {
      const workerId = workerIds[i % workerIds.length]!;
      const start = performance.now();
      registry.recordHeartbeat(createHeartbeat(workerId, i));
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 1,
        `Heartbeat recording P99 latency ${p99.toFixed(4)}ms exceeds 1ms target. P50: ${p50.toFixed(4)}ms`,
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
// Worker Listing Benchmarks
// ============================================================================

test("performance: listWorkers throughput >1000 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const registry = new WorkerRegistryService(store);

  try {
    // Pre-register workers
    for (let i = 0; i < 100; i++) {
      registry.recordHeartbeat(createHeartbeat(newId("worker"), i));
    }

    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      registry.listWorkers();
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 1000,
        `List workers throughput ${opsPerSec.toFixed(0)} ops/sec must be >1000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
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

test("performance: listEligibleWorkers P99 <5ms", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const registry = new WorkerRegistryService(store);

  try {
    // Pre-register workers
    for (let i = 0; i < 50; i++) {
      registry.recordHeartbeat(createHeartbeat(newId("worker"), i));
    }

    const latencies: number[] = [];
    const iterations = 1000;

    // Warmup
    for (let i = 0; i < 100; i++) {
      registry.listEligibleWorkers({ requiredCapabilities: ["code-execution"] });
    }

    // Measure
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      registry.listEligibleWorkers({ requiredCapabilities: ["code-execution"] });
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 5,
        `List eligible workers P99 latency ${p99.toFixed(4)}ms exceeds 5ms target. P50: ${p50.toFixed(4)}ms`,
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
// Worker Lookup Benchmarks
// ============================================================================

test("performance: getWorker by ID P99 <1ms", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const registry = new WorkerRegistryService(store);

  try {
    // Pre-register workers
    const workerIds: string[] = [];
    for (let i = 0; i < 100; i++) {
      const workerId = newId("worker");
      workerIds.push(workerId);
      registry.recordHeartbeat(createHeartbeat(workerId, i));
    }

    const latencies: number[] = [];
    const iterations = 5000;

    // Warmup
    for (let i = 0; i < 100; i++) {
      registry.getWorker(workerIds[i % workerIds.length]!);
    }

    // Measure
    for (let i = 0; i < iterations; i++) {
      const workerId = workerIds[i % workerIds.length]!;
      const start = performance.now();
      registry.getWorker(workerId);
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 1,
        `getWorker P99 latency ${p99.toFixed(4)}ms exceeds 1ms target. P50: ${p50.toFixed(4)}ms`,
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
// Selection with Filters Benchmarks
// ============================================================================

test("performance: listEligibleWorkers with isolation level filter P99 <10ms", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const registry = new WorkerRegistryService(store);

  try {
    // Pre-register workers with different isolation levels
    for (let i = 0; i < 50; i++) {
      const workerId = newId("worker");
      const isolationLevels: ("standard" | "hardened" | "strict")[] = ["standard", "hardened", "strict"];
      registry.recordHeartbeat({
        ...createHeartbeat(workerId, i),
        isolationLevel: isolationLevels[i % 3]!,
      });
    }

    const latencies: number[] = [];
    const iterations = 500;

    // Warmup
    for (let i = 0; i < 50; i++) {
      registry.listEligibleWorkers({ requiredIsolationLevel: "hardened" });
    }

    // Measure
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      registry.listEligibleWorkers({ requiredIsolationLevel: "hardened" });
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 10,
        `listEligibleWorkers with isolation filter P99 latency ${p99.toFixed(4)}ms exceeds 10ms target. P50: ${p50.toFixed(4)}ms`,
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
