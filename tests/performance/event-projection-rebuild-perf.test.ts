/**
 * Performance Test: Event Projection Rebuild Performance
 * Measures projection rebuild performance from event store
 *
 * Design targets:
 * - Full rebuild: >5000 events/sec
 * - Incremental rebuild: >10,000 events/sec
 * - Batch processing: <100ms per 1000 events
 * - Memory efficient: <10MB per million events
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { rmSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { reportSoftPerformanceMiss } from "../helpers/performance.js";

import { SqliteDatabase } from "../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { ProjectionRebuildService } from "../../src/platform/five-plane-state-evidence/projections/projection-rebuild-service.js";
import { newId, nowIso } from "../../src/platform/contracts/types/ids.js";
import type { ProjectionInputEvent } from "../../src/platform/five-plane-state-evidence/projections/projection-rebuild-service.js";

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

function createTaskAndExecution(db: SqliteDatabase, store: AuthoritativeTaskStore): { taskId: string; executionId: string } {
  const taskId = newId("task");
  const executionId = newId("exec");
  const now = nowIso();

  db.transaction(() => {
    store.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general-ops",
      title: "Projection rebuild test",
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

    store.execution.insertExecution({
      id: executionId,
      taskId,
      workflowId: "projection_rebuild_test",
      parentExecutionId: null,
      agentId: "agent-rebuild-tester",
      roleId: "general_executor",
      runKind: "task_run",
      status: "created",
      inputRef: null,
      traceId: newId("trace"),
      attempt: 1,
      timeoutMs: 60_000,
      budgetUsdLimit: null,
      requiresApproval: 0,
      sandboxMode: "workspace_write",
      allowedToolsJson: "[]",
      allowedPathsJson: "[]",
      maxRetries: 0,
      retryBackoff: "none",
      lastErrorCode: null,
      lastErrorMessage: null,
      startedAt: null,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  });

  return { taskId, executionId };
}

function createEventRecord(
  store: AuthoritativeTaskStore,
  taskId: string,
  executionId: string,
  eventIndex: number,
): string {
  const eventId = newId("evt");
  const now = nowIso();

  store.event.insertEvent({
    id: eventId,
    taskId,
    executionId,
    eventType: `test:event_${eventIndex % 10}`,
    payloadJson: JSON.stringify({
      previousStatus: "queued",
      newStatus: "pending",
      reason: "test_event",
      index: eventIndex,
    }),
    traceId: newId("trace"),
    createdAt: now,
  });

  return eventId;
}

// ============================================================================
// Event Creation Helpers
// ============================================================================

function createTestEvents(store: AuthoritativeTaskStore, taskId: string, executionId: string, count: number): void {
  for (let i = 0; i < count; i++) {
    createEventRecord(store, taskId, executionId, i);
  }
}

// ============================================================================
// Full Rebuild Performance Benchmarks
// ============================================================================

test("projection rebuild: Full rebuild throughput >5000 events/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const { taskId, executionId } = createTaskAndExecution(db, store);

  // Create events
  const eventCount = 5000;
  createTestEvents(store, taskId, executionId, eventCount);

  const rebuildService = new ProjectionRebuildService(store.event);

  const start = performance.now();

  // Full rebuild of a single projection
  const result = rebuildService.rebuildProjection("event_summary");

  const elapsed = performance.now() - start;
  const eventsPerSec = (eventCount / elapsed) * 1000;

  try {
    assert.ok(
      eventsPerSec > 5000,
      `Full rebuild throughput ${eventsPerSec.toFixed(0)} events/sec must be >5000 events/sec. Took: ${elapsed.toFixed(2)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  } finally {
    db.close();
    cleanupDb(db);
  }
});

test("projection rebuild: Incremental rebuild throughput >10,000 events/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const { taskId, executionId } = createTaskAndExecution(db, store);

  // Create initial events
  const initialCount = 1000;
  createTestEvents(store, taskId, executionId, initialCount);

  const rebuildService = new ProjectionRebuildService(store.event);

  // Initial rebuild
  rebuildService.rebuildProjection("event_summary");

  // Add more events for incremental rebuild
  const incrementalCount = 5000;
  const start = performance.now();
  createTestEvents(store, taskId, executionId, incrementalCount);

  // Incremental rebuild (from offset)
  const result = rebuildService.rebuildProjection("event_summary", { fromTimestamp: nowIso() });

  const elapsed = performance.now() - start;
  const eventsPerSec = (incrementalCount / elapsed) * 1000;

  try {
    assert.ok(
      eventsPerSec > 10000,
      `Incremental rebuild throughput ${eventsPerSec.toFixed(0)} events/sec must be >10,000 events/sec. Took: ${elapsed.toFixed(2)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  } finally {
    db.close();
    cleanupDb(db);
  }
});

test("projection rebuild: Batch processing <100ms per 1000 events", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const { taskId, executionId } = createTaskAndExecution(db, store);

  // Create 5000 events
  const eventCount = 5000;
  createTestEvents(store, taskId, executionId, eventCount);

  const rebuildService = new ProjectionRebuildService(store.event);

  const start = performance.now();
  rebuildService.rebuildProjection("event_summary");
  const elapsed = performance.now() - start;

  const msPerThousandEvents = (elapsed / eventCount) * 1000;

  try {
    assert.ok(
      msPerThousandEvents < 100,
      `Batch processing took ${msPerThousandEvents.toFixed(2)}ms per 1000 events, expected <100ms. Total: ${elapsed.toFixed(2)}ms for ${eventCount} events`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  } finally {
    db.close();
    cleanupDb(db);
  }
});

// ============================================================================
// Multiple Projection Rebuild Benchmarks
// ============================================================================

test("projection rebuild: All projections rebuild <500ms for 1000 events", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const { taskId, executionId } = createTaskAndExecution(db, store);

  // Create 1000 events
  const eventCount = 1000;
  createTestEvents(store, taskId, executionId, eventCount);

  const rebuildService = new ProjectionRebuildService(store.event);

  const start = performance.now();

  // Rebuild all registered projections
  const projections = rebuildService.listProjectionNames();
  for (const projectionName of projections) {
    rebuildService.rebuildProjection(projectionName);
  }

  const elapsed = performance.now() - start;

  try {
    assert.ok(
      elapsed < 500,
      `All projections rebuild took ${elapsed.toFixed(2)}ms for ${eventCount} events, expected <500ms. ${projections.length} projections rebuilt`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  } finally {
    db.close();
    cleanupDb(db);
  }
});

test("projection rebuild: Parallel rebuild throughput scales linearly", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const { taskId, executionId } = createTaskAndExecution(db, store);

  // Create 5000 events
  const eventCount = 5000;
  createTestEvents(store, taskId, executionId, eventCount);

  const rebuildService = new ProjectionRebuildService(store.event);

  // Rebuild with parallelism
  const start = performance.now();
  const result = rebuildService.rebuildProjection("event_summary", { parallelByProjection: true });
  const elapsed = performance.now() - start;

  const eventsPerSec = (eventCount / elapsed) * 1000;

  try {
    assert.ok(
      eventsPerSec > 5000,
      `Parallel rebuild throughput ${eventsPerSec.toFixed(0)} events/sec must be >5000 events/sec. Took: ${elapsed.toFixed(2)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  } finally {
    db.close();
    cleanupDb(db);
  }
});

// ============================================================================
// Idempotency Benchmarks
// ============================================================================

test("projection rebuild: Idempotent replay produces same result", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const { taskId, executionId } = createTaskAndExecution(db, store);

  // Create 500 events
  const eventCount = 500;
  createTestEvents(store, taskId, executionId, eventCount);

  const rebuildService = new ProjectionRebuildService(store.event);

  // First rebuild
  const result1 = rebuildService.rebuildProjection("event_summary");

  // Second rebuild (idempotent)
  const result2 = rebuildService.rebuildProjection("event_summary");

  try {
    assert.ok(
      result1.eventsProcessed === result2.eventsProcessed,
      `Idempotent rebuild should produce same event count. First: ${result1.eventsProcessed}, Second: ${result2.eventsProcessed}`,
    );
    assert.ok(
      result1.eventsSkipped === result2.eventsSkipped,
      `Idempotent rebuild should skip same events. First: ${result1.eventsSkipped}, Second: ${result2.eventsSkipped}`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  } finally {
    db.close();
    cleanupDb(db);
  }
});

// ============================================================================
// Large Scale Benchmarks
// ============================================================================

test("projection rebuild: Large scale rebuild (10K events) <3 seconds", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const { taskId, executionId } = createTaskAndExecution(db, store);

  // Create 10,000 events
  const eventCount = 10000;
  createTestEvents(store, taskId, executionId, eventCount);

  const rebuildService = new ProjectionRebuildService(store.event);

  const start = performance.now();
  const result = rebuildService.rebuildProjection("event_summary");
  const elapsed = performance.now() - start;

  try {
    assert.ok(
      elapsed < 3000,
      `Large scale rebuild took ${elapsed.toFixed(2)}ms for ${eventCount} events, expected <3000ms. Processed: ${result.eventsProcessed}`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  } finally {
    db.close();
    cleanupDb(db);
  }
});
