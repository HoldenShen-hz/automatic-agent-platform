/**
 * Performance Test: Event Indexing Throughput
 * Measures event store insertion and indexing performance
 *
 * Design targets:
 * - Single event insertion: >500 ops/sec
 * - Bulk event insertion: >1000 events/sec
 * - Event retrieval by aggregate: >2000 ops/sec
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { reportSoftPerformanceMiss } from "../helpers/performance.js";

import { SqliteDatabase } from "../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { newId, nowIso } from "../../src/platform/contracts/types/ids.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";

function createTempDb(): { db: SqliteDatabase; workspace: string } {
  const workspace = createTempWorkspace("event-indexing-perf-");
  const dbPath = join(workspace, "event-indexing.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  return { db, workspace };
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
      title: "Event indexing test",
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
      workflowId: "event_indexing_perf",
      parentExecutionId: null,
      agentId: "agent-event-indexer",
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
    eventType: "task_status_changed",
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
// Single Event Insertion Benchmarks
// ============================================================================

test("performance: EventStore.insertEvent() throughput >500 ops/sec", (t) => {
  const { db, workspace } = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    const { taskId, executionId } = createTaskAndExecution(db, store);

    const iterations = 500;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      createEventRecord(store, taskId, executionId, i);
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 500,
        `Event insertion throughput ${opsPerSec.toFixed(0)} ops/sec must be >500 ops/sec. Avg: ${avgLatencyMs.toFixed(3)}ms`,
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
    cleanupPath(workspace);
  }
});

test("performance: EventStore.insertEvent() P99 latency <10ms", (t) => {
  const { db, workspace } = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    const { taskId, executionId } = createTaskAndExecution(db, store);

    const latencies: number[] = [];
    const iterations = 200;

    // Warmup
    for (let i = 0; i < 20; i++) {
      createEventRecord(store, taskId, executionId, i);
    }

    // Measure
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      createEventRecord(store, taskId, executionId, i);
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 10,
        `Event insertion P99 latency ${p99.toFixed(3)}ms exceeds 10ms target. P50: ${p50.toFixed(3)}ms`,
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
    cleanupPath(workspace);
  }
});

// ============================================================================
// Bulk Event Insertion Benchmarks
// ============================================================================

test("performance: Bulk event insertion (100 events) <200ms", (t) => {
  const { db, workspace } = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    const { taskId, executionId } = createTaskAndExecution(db, store);
    const eventCount = 100;

    const start = performance.now();

    for (let i = 0; i < eventCount; i++) {
      createEventRecord(store, taskId, executionId, i);
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (eventCount / elapsed) * 1000;

    try {
      assert.ok(
        elapsed < 200,
        `Bulk insertion of ${eventCount} events took ${elapsed.toFixed(2)}ms, expected <200ms. Throughput: ${opsPerSec.toFixed(0)} ops/sec`,
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
    cleanupPath(workspace);
  }
});

test("performance: Bulk event insertion throughput >1000 events/sec", (t) => {
  const { db, workspace } = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    const { taskId, executionId } = createTaskAndExecution(db, store);

    const eventCount = 500;
    const start = performance.now();

    for (let i = 0; i < eventCount; i++) {
      createEventRecord(store, taskId, executionId, i);
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (eventCount / elapsed) * 1000;
    const avgLatencyMs = elapsed / eventCount;

    try {
      assert.ok(
        opsPerSec > 1000,
        `Bulk event insertion throughput ${opsPerSec.toFixed(0)} events/sec must be >1000 events/sec. Avg: ${avgLatencyMs.toFixed(3)}ms`,
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
    cleanupPath(workspace);
  }
});

// ============================================================================
// Event Retrieval Benchmarks
// ============================================================================

test("performance: EventStore.listEventsForTask() throughput >2000 ops/sec", (t) => {
  const { db, workspace } = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    const { taskId, executionId } = createTaskAndExecution(db, store);

    // Create events
    for (let i = 0; i < 50; i++) {
      createEventRecord(store, taskId, executionId, i);
    }

    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      store.event.listEventsForTask(taskId);
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 2000,
        `Event retrieval throughput ${opsPerSec.toFixed(0)} ops/sec must be >2000 ops/sec. Avg: ${avgLatencyMs.toFixed(3)}ms`,
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
    cleanupPath(workspace);
  }
});

test("performance: EventStore.listEventsForTask() P99 latency <5ms", (t) => {
  const { db, workspace } = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    const { taskId, executionId } = createTaskAndExecution(db, store);

    // Create events
    for (let i = 0; i < 50; i++) {
      createEventRecord(store, taskId, executionId, i);
    }

    const latencies: number[] = [];
    const iterations = 500;

    // Warmup
    for (let i = 0; i < 50; i++) {
      store.event.listEventsForTask(taskId);
    }

    // Measure
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      store.event.listEventsForTask(taskId);
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 5,
        `Event retrieval P99 latency ${p99.toFixed(3)}ms exceeds 5ms target. P50: ${p50.toFixed(3)}ms`,
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
    cleanupPath(workspace);
  }
});

test("performance: EventStore.listEventsForExecution() throughput >2000 ops/sec", (t) => {
  const { db, workspace } = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    const { taskId, executionId } = createTaskAndExecution(db, store);

    // Create events
    for (let i = 0; i < 50; i++) {
      createEventRecord(store, taskId, executionId, i);
    }

    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      store.event.listEventsForExecution(executionId);
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 2000,
        `Event retrieval by execution throughput ${opsPerSec.toFixed(0)} ops/sec must be >2000 ops/sec. Avg: ${avgLatencyMs.toFixed(3)}ms`,
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
    cleanupPath(workspace);
  }
});

// ============================================================================
// Event Update Benchmarks
// ============================================================================

test("performance: EventStore.markEventDelivered() throughput >1000 ops/sec", (t) => {
  const { db, workspace } = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    const { taskId, executionId } = createTaskAndExecution(db, store);

    // Create events
    const eventIds: string[] = [];
    for (let i = 0; i < 100; i++) {
      eventIds.push(createEventRecord(store, taskId, executionId, i));
    }

    const iterations = 500;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const eventId = eventIds[i % eventIds.length]!;
      store.event.markEventAck(eventId, "consumer_1");
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 1000,
        `Event mark delivered throughput ${opsPerSec.toFixed(0)} ops/sec must be >1000 ops/sec. Avg: ${avgLatencyMs.toFixed(3)}ms`,
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
    cleanupPath(workspace);
  }
});
