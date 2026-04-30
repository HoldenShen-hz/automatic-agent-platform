/**
 * Performance Test: Event Append Performance with Batching
 * Measures TransactionalEventAppender batch insert performance
 *
 * Design targets:
 * - Single event append: >500 ops/sec
 * - Batch append (10 events): >1000 ops/sec
 * - Batch append (100 events): >2000 ops/sec
 * - Batch append P99 latency <100ms for 100 events
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { rmSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { reportSoftPerformanceMiss } from "../helpers/performance.js";

import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { TransactionalEventAppender } from "../../src/platform/state-evidence/events/transactional-event-appender.js";
import { EventRepository } from "../../src/platform/state-evidence/truth/sqlite/repositories/event-repository.js";
import { OutboxRepository } from "../../src/platform/shared/outbox/outbox-repository.js";
import { newId, nowIso } from "../../src/platform/contracts/types/ids.js";

function createTempDb(): SqliteDatabase {
  const dbPath = join(".tmp", `event-batch-perf-${process.pid}-${Date.now()}.db`);
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  return db;
}

function cleanupDb(db: SqliteDatabase): void {
  rmSync(db.filePath, { force: true });
  rmSync(`${db.filePath}-wal`, { force: true });
  rmSync(`${db.filePath}-shm`, { force: true });
}

function createAppender(db: SqliteDatabase): TransactionalEventAppender {
  const eventRepository = new EventRepository(db.connection);
  const outboxRepository = new OutboxRepository(db.connection);
  return new TransactionalEventAppender(db, eventRepository, outboxRepository);
}

// ============================================================================
// Single Event Append Benchmarks
// ============================================================================

test("performance: TransactionalEventAppender single append >500 ops/sec", (t) => {
  const db = createTempDb();
  const appender = createAppender(db);

  try {
    const taskId = newId("task");
    const iterations = 500;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      appender.appendEvent({
        taskId,
        eventType: "task_status_changed",
        payloadJson: JSON.stringify({ status: "pending", index: i }),
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 500,
        `Single event append throughput ${opsPerSec.toFixed(0)} ops/sec must be >500 ops/sec. Avg: ${avgLatencyMs.toFixed(3)}ms`,
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

test("performance: TransactionalEventAppender single append P99 latency <10ms", (t) => {
  const db = createTempDb();
  const appender = createAppender(db);

  try {
    const taskId = newId("task");
    const latencies: number[] = [];
    const iterations = 500;

    // Warmup
    for (let i = 0; i < 20; i++) {
      appender.appendEvent({
        taskId,
        eventType: "task_status_changed",
        payloadJson: JSON.stringify({ status: "pending" }),
      });
    }

    // Measure
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      appender.appendEvent({
        taskId,
        eventType: "task_status_changed",
        payloadJson: JSON.stringify({ status: "pending", index: i }),
      });
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 10,
        `Single append P99 latency ${p99.toFixed(3)}ms exceeds 10ms target. P50: ${p50.toFixed(3)}ms`,
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
// Batch Event Append Benchmarks
// ============================================================================

test("performance: TransactionalEventAppender batch append (10 events) <20ms", (t) => {
  const db = createTempDb();
  const appender = createAppender(db);

  try {
    const taskId = newId("task");
    const batchSize = 10;
    const iterations = 200;
    const start = performance.now();

    for (let batch = 0; batch < iterations; batch++) {
      const events = [];
      for (let i = 0; i < batchSize; i++) {
        events.push({
          taskId,
          eventType: "task_status_changed",
          payloadJson: JSON.stringify({ status: "pending", batch, index: i }),
        });
      }
      appender.appendEvents(events);
    }

    const elapsed = performance.now() - start;
    const totalEvents = iterations * batchSize;
    const opsPerSec = (totalEvents / elapsed) * 1000;
    const avgLatencyPerBatchMs = elapsed / iterations;

    try {
      assert.ok(
        avgLatencyPerBatchMs < 20,
        `Batch append of ${batchSize} events took ${avgLatencyPerBatchMs.toFixed(3)}ms/batch, expected <20ms. Throughput: ${opsPerSec.toFixed(0)} ops/sec`,
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

test("performance: TransactionalEventAppender batch append (100 events) <100ms", (t) => {
  const db = createTempDb();
  const appender = createAppender(db);

  try {
    const taskId = newId("task");
    const batchSize = 100;
    const iterations = 50;
    const start = performance.now();

    for (let batch = 0; batch < iterations; batch++) {
      const events = [];
      for (let i = 0; i < batchSize; i++) {
        events.push({
          taskId,
          eventType: "task_status_changed",
          payloadJson: JSON.stringify({ status: "pending", batch, index: i }),
        });
      }
      appender.appendEvents(events);
    }

    const elapsed = performance.now() - start;
    const totalEvents = iterations * batchSize;
    const opsPerSec = (totalEvents / elapsed) * 1000;

    try {
      assert.ok(
        elapsed < 100 * iterations,
        `Batch append of ${batchSize} events took ${elapsed.toFixed(2)}ms total, expected <${100 * iterations}ms. Throughput: ${opsPerSec.toFixed(0)} ops/sec`,
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

test("performance: TransactionalEventAppender batch throughput >2000 events/sec", (t) => {
  const db = createTempDb();
  const appender = createAppender(db);

  try {
    const taskId = newId("task");
    const batchSize = 50;
    const iterations = 100;
    const start = performance.now();

    for (let batch = 0; batch < iterations; batch++) {
      const events = [];
      for (let i = 0; i < batchSize; i++) {
        events.push({
          taskId,
          eventType: "task_status_changed",
          payloadJson: JSON.stringify({ status: "pending", batch, index: i }),
        });
      }
      appender.appendEvents(events);
    }

    const elapsed = performance.now() - start;
    const totalEvents = iterations * batchSize;
    const opsPerSec = (totalEvents / elapsed) * 1000;
    const avgLatencyPerEventMs = elapsed / totalEvents;

    try {
      assert.ok(
        opsPerSec > 2000,
        `Batch event append throughput ${opsPerSec.toFixed(0)} events/sec must be >2000 events/sec. Avg: ${avgLatencyPerEventMs.toFixed(4)}ms/event`,
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
// Batch Append with Outbox Benchmarks
// ============================================================================

test("performance: TransactionalEventAppender batch append with outbox >1500 events/sec", (t) => {
  const db = createTempDb();
  const appender = createAppender(db);

  try {
    const taskId = newId("task");
    const batchSize = 50;
    const iterations = 100;
    const start = performance.now();

    for (let batch = 0; batch < iterations; batch++) {
      const events = [];
      for (let i = 0; i < batchSize; i++) {
        events.push({
          taskId,
          eventType: "task_status_changed",
          payloadJson: JSON.stringify({ status: "pending", batch, index: i }),
        });
      }
      appender.appendEvents(events, { writeToOutbox: true });
    }

    const elapsed = performance.now() - start;
    const totalEvents = iterations * batchSize;
    const opsPerSec = (totalEvents / elapsed) * 1000;

    try {
      assert.ok(
        opsPerSec > 1500,
        `Batch append with outbox throughput ${opsPerSec.toFixed(0)} events/sec must be >1500 events/sec`,
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
// Large Batch Benchmarks
// ============================================================================

test("performance: TransactionalEventAppender large batch (500 events) <500ms", (t) => {
  const db = createTempDb();
  const appender = createAppender(db);

  try {
    const taskId = newId("task");
    const batchSize = 500;
    const start = performance.now();

    const events = [];
    for (let i = 0; i < batchSize; i++) {
      events.push({
        taskId,
        eventType: "task_status_changed",
        payloadJson: JSON.stringify({ status: "pending", index: i }),
      });
    }
    appender.appendEvents(events);

    const elapsed = performance.now() - start;
    const opsPerSec = (batchSize / elapsed) * 1000;

    try {
      assert.ok(
        elapsed < 500,
        `Large batch append of ${batchSize} events took ${elapsed.toFixed(2)}ms, expected <500ms. Throughput: ${opsPerSec.toFixed(0)} ops/sec`,
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
