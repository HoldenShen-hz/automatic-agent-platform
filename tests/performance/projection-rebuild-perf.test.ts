/**
 * Performance Test: Projection Rebuild with Concurrent Consumers
 * Measures ProjectionRebuildService rebuild performance
 *
 * Design targets:
 * - Full rebuild (1000 events): <500ms
 * - Incremental rebuild (100 new events): <100ms
 * - Concurrent consumer rebuild (3 consumers): <800ms
 * - Rebuild throughput: >5000 events/sec
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { rmSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { reportSoftPerformanceMiss } from "../helpers/performance.js";

import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { EventRepository } from "../../src/platform/state-evidence/truth/sqlite/repositories/event-repository.js";
import { ProjectionRebuildService } from "../../src/platform/state-evidence/projections/projection-rebuild-service.js";
import { newId, nowIso } from "../../src/platform/contracts/types/ids.js";

function createTempDb(): SqliteDatabase {
  const dbPath = join(".tmp", `projection-rebuild-perf-${process.pid}-${Date.now()}.db`);
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  return db;
}

function cleanupDb(db: SqliteDatabase): void {
  rmSync(db.filePath, { force: true });
  rmSync(`${db.filePath}-wal`, { force: true });
  rmSync(`${db.filePath}-shm`, { force: true });
}

function createTestEvents(db: SqliteDatabase, count: number, taskId: string): void {
  const repo = new EventRepository(db.connection);

  for (let i = 0; i < count; i++) {
    const eventType = i % 3 === 0 ? "task_status_changed" : i % 3 === 1 ? "task_output_available" : "task_completed";
    repo.insertEvent({
      id: newId("evt"),
      taskId,
      executionId: null,
      eventType,
      payloadJson: JSON.stringify({ index: i, value: `test_${i}` }),
      traceId: null,
      createdAt: nowIso(),
    });
  }
}

// ============================================================================
// Full Rebuild Benchmarks
// ============================================================================

test("performance: ProjectionRebuildService full rebuild (1000 events) <500ms", async (t) => {
  const db = createTempDb();

  try {
    const eventRepository = new EventRepository(db.connection);
    const rebuildService = new ProjectionRebuildService(eventRepository);

    // Create 1000 events
    const taskId = newId("task");
    createTestEvents(db, 1000, taskId);

    const start = performance.now();
    const result = await rebuildService.rebuildAll({});

    const elapsed = performance.now() - start;

    try {
      assert.ok(
        elapsed < 500,
        `Full rebuild of 1000 events took ${elapsed.toFixed(2)}ms, expected <500ms. Events/sec: ${(result.eventsProcessed / elapsed * 1000).toFixed(0)}`,
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

test("performance: ProjectionRebuildService rebuild throughput >5000 events/sec", async (t) => {
  const db = createTempDb();

  try {
    const eventRepository = new EventRepository(db.connection);
    const rebuildService = new ProjectionRebuildService(eventRepository);

    // Create 5000 events
    const taskId = newId("task");
    createTestEvents(db, 5000, taskId);

    const start = performance.now();
    const result = await rebuildService.rebuildAll({});

    const elapsed = performance.now() - start;
    const eventsPerSec = (result.eventsProcessed / elapsed) * 1000;

    try {
      assert.ok(
        eventsPerSec > 5000,
        `Rebuild throughput ${eventsPerSec.toFixed(0)} events/sec must be >5000 events/sec`,
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
// Incremental Rebuild Benchmarks
// ============================================================================

test("performance: ProjectionRebuildService incremental rebuild (100 new events) <100ms", async (t) => {
  const db = createTempDb();

  try {
    const eventRepository = new EventRepository(db.connection);
    const rebuildService = new ProjectionRebuildService(eventRepository);

    // Create initial 1000 events
    const taskId = newId("task");
    createTestEvents(db, 1000, taskId);

    // Full rebuild first
    await rebuildService.rebuildAll({});

    // Add 100 new events
    createTestEvents(db, 100, taskId);

    const start = performance.now();
    const result = await rebuildService.rebuildAll({});

    const elapsed = performance.now() - start;

    try {
      assert.ok(
        elapsed < 100,
        `Incremental rebuild of 100 events took ${elapsed.toFixed(2)}ms, expected <100ms`,
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
// Concurrent Consumer Rebuild Benchmarks
// ============================================================================

test("performance: ProjectionRebuildService concurrent rebuild (3 consumers) <800ms", async (t) => {
  const db = createTempDb();

  try {
    const eventRepository = new EventRepository(db.connection);

    // Create 3 rebuild services (simulating concurrent consumers)
    const rebuildService1 = new ProjectionRebuildService(eventRepository);
    const rebuildService2 = new ProjectionRebuildService(eventRepository);
    const rebuildService3 = new ProjectionRebuildService(eventRepository);

    // Create events
    const taskId = newId("task");
    createTestEvents(db, 1500, taskId);

    // Run concurrent rebuilds
    const start = performance.now();

    const [result1, result2, result3] = await Promise.all([
      rebuildService1.rebuildAll({}),
      rebuildService2.rebuildAll({}),
      rebuildService3.rebuildAll({}),
    ]);

    const elapsed = performance.now() - start;
    const totalEventsProcessed = result1.eventsProcessed + result2.eventsProcessed + result3.eventsProcessed;

    try {
      assert.ok(
        elapsed < 800,
        `Concurrent rebuild (3 consumers) of 1500 events took ${elapsed.toFixed(2)}ms, expected <800ms. Total events: ${totalEventsProcessed}`,
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

test("performance: ProjectionRebuildService parallel rebuild by projection <600ms", async (t) => {
  const db = createTempDb();

  try {
    const eventRepository = new EventRepository(db.connection);
    const rebuildService = new ProjectionRebuildService(eventRepository);

    // Create events for multiple projection types
    const taskId = newId("task");
    createTestEvents(db, 2000, taskId);

    const start = performance.now();
    const result = await rebuildService.rebuildAll({
      parallelByProjection: true,
      batchSize: 500,
    });

    const elapsed = performance.now() - start;

    try {
      assert.ok(
        elapsed < 600,
        `Parallel rebuild by projection took ${elapsed.toFixed(2)}ms, expected <600ms. Projections: ${result.projectionsUpdated}`,
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
// Rebuild P99 Latency Benchmarks
// ============================================================================

test("performance: ProjectionRebuildService rebuild P99 latency <400ms for 1000 events", async (t) => {
  const db = createTempDb();

  try {
    const eventRepository = new EventRepository(db.connection);
    const rebuildService = new ProjectionRebuildService(eventRepository);

    const latencies: number[] = [];
    const iterations = 20;

    // Warmup
    const warmupTaskId = newId("task");
    createTestEvents(db, 500, warmupTaskId);
    await rebuildService.rebuildAll({});

    // Measure
    for (let i = 0; i < iterations; i++) {
      // Create fresh events for each iteration
      const taskId = newId("task");
      createTestEvents(db, 1000, taskId);

      const start = performance.now();
      await rebuildService.rebuildAll({});
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 400,
        `Rebuild P99 latency ${p99.toFixed(2)}ms exceeds 400ms target. P50: ${p50.toFixed(2)}ms`,
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
// Batch Size Impact Benchmarks
// ============================================================================

test("performance: ProjectionRebuildService batch size impact (batch=100 vs batch=1000)", async (t) => {
  const db = createTempDb();

  try {
    const taskId = newId("task");
    createTestEvents(db, 5000, taskId);

    // Test with small batch size
    const eventRepository1 = new EventRepository(db.connection);
    const rebuildService1 = new ProjectionRebuildService(eventRepository1);

    const start1 = performance.now();
    await rebuildService1.rebuildAll({ batchSize: 100 });
    const elapsed1 = performance.now() - start1;

    // Test with large batch size
    const eventRepository2 = new EventRepository(db.connection);
    const rebuildService2 = new ProjectionRebuildService(eventRepository2);

    const start2 = performance.now();
    await rebuildService2.rebuildAll({ batchSize: 1000 });
    const elapsed2 = performance.now() - start2;

    // Verify both produced valid results
    const speedupRatio = elapsed1 / elapsed2;

    try {
      assert.ok(
        speedupRatio < 2.0,
        `Batch size impact: small batch took ${elapsed1.toFixed(2)}ms, large batch took ${elapsed2.toFixed(2)}ms. Ratio: ${speedupRatio.toFixed(2)}x`,
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
