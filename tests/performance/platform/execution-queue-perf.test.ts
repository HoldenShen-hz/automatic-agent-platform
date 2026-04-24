/**
 * Performance Test: Execution Queue Operations
 * Measures queue enqueue/dequeue throughput and latency
 *
 * Design targets:
 * - Enqueue: >2000 ops/sec
 * - Dequeue: >1000 ops/sec
 * - P99 latency <5ms
 *
 * Note: Performance thresholds are set for reference hardware. On slower machines,
 * tests that miss the reference target are recorded as diagnostics rather than skipped.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { reportSoftPerformanceMiss } from "../../helpers/performance.js";
import { join } from "node:path";
import { rmSync } from "node:fs";

import { SqliteDatabase } from "../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { SqliteQueueAdapter } from "../../../src/platform/execution/queue/sqlite-queue-adapter.js";
import { QUEUE_JOBS_DDL } from "../../../src/platform/execution/queue/queue-adapter-types.js";
import { newId } from "../../../src/platform/contracts/types/ids.js";

function createTempDb(): SqliteDatabase {
  const dbPath = join(".tmp", `queue-perf-${process.pid}-${Date.now()}.db`);
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  // Create queue_jobs table if not exists via migrations
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

test("performance: queue enqueue P99 latency <1ms", (t) => {
  const db = createTempDb();
  const adapter = new SqliteQueueAdapter(db);
  const queueName = "test-queue";

  try {
    const latencies: number[] = [];
    const iterations = 1000;

    // Warmup
    for (let i = 0; i < 10; i++) {
      adapter.enqueue({ queueName, payload: createPayload(i) });
    }

    // Measure
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      adapter.enqueue({
        queueName,
        payload: createPayload(i),
        priority: i % 10,
      });
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 1,
        `Queue enqueue P99 latency ${p99.toFixed(3)}ms exceeds 1ms target. P50: ${p50.toFixed(3)}ms`,
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

test("performance: queue dequeue P99 latency <5ms", (t) => {
  const db = createTempDb();
  const adapter = new SqliteQueueAdapter(db);
  const queueName = "test-queue";

  try {
    // Pre-populate queue with 200 jobs
    for (let i = 0; i < 200; i++) {
      adapter.enqueue({
        queueName,
        payload: createPayload(i),
        priority: i % 10,
      });
    }

    const latencies: number[] = [];
    const iterations = 100;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const result = adapter.dequeue(queueName);
      if (result) {
        result.ack();
      }
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 5,
        `Queue dequeue P99 latency ${p99.toFixed(3)}ms exceeds 5ms target. P50: ${p50.toFixed(3)}ms`,
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

test("performance: queue stats operation <3ms P99", (t) => {
  const db = createTempDb();
  const adapter = new SqliteQueueAdapter(db);
  const queueName = "test-queue";

  try {
    // Pre-populate queue with mixed states
    for (let i = 0; i < 100; i++) {
      adapter.enqueue({
        queueName,
        payload: createPayload(i),
        priority: i % 5,
      });
    }

    // Dequeue and ack some to create completed jobs
    for (let i = 0; i < 30; i++) {
      const result = adapter.dequeue(queueName);
      if (result) result.ack();
    }

    const latencies: number[] = [];
    const iterations = 200;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      adapter.stats(queueName);
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 3,
        `Queue stats P99 latency ${p99.toFixed(3)}ms exceeds 3ms target. P50: ${p50.toFixed(3)}ms`,
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

test("performance: queue listJobs <5ms P99", (t) => {
  const db = createTempDb();
  const adapter = new SqliteQueueAdapter(db);
  const queueName = "test-queue";

  try {
    // Pre-populate queue with 100 jobs
    for (let i = 0; i < 100; i++) {
      adapter.enqueue({
        queueName,
        payload: createPayload(i),
        priority: i % 10,
      });
    }

    const latencies: number[] = [];
    const iterations = 200;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      adapter.listJobs(queueName, "waiting", 50);
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 5,
        `Queue listJobs P99 latency ${p99.toFixed(3)}ms exceeds 5ms target. P50: ${p50.toFixed(3)}ms`,
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

test("performance: enqueue with idempotency key throughput >1500 ops/sec", (t) => {
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
        idempotencyKey: `idem-${i % 100}`, // Reuse keys to test deduplication
        priority: i % 10,
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;

    try {
      assert.ok(
        opsPerSec > 1500,
        `Enqueue with idempotency throughput ${opsPerSec.toFixed(2)} ops/sec must be >1500 ops/sec`,
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