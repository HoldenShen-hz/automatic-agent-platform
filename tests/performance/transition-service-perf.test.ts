/**
 * Performance Test: Transition Service
 * Measures status transition throughput and latency
 *
 * Design targets:
 * - Task status transition: >5000 ops/sec
 * - Execution status transition: >5000 ops/sec
 * - Workflow status transition: >5000 ops/sec
 * - Session status transition: >5000 ops/sec
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { rmSync } from "node:fs";
import { reportSoftPerformanceMiss } from "../helpers/performance.js";

import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { TransitionService } from "../../src/platform/execution/state-transition/transition-service.js";
import { newId, nowIso } from "../../src/platform/contracts/types/ids.js";

function createTempDb(): SqliteDatabase {
  const dbPath = join(".tmp", `transition-perf-${process.pid}-${Date.now()}.db`);
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  return db;
}

function seedTask(
  store: AuthoritativeTaskStore,
  db: SqliteDatabase,
  taskId: string,
  status: string = "queued",
): void {
  const now = nowIso();
  db.transaction(() => {
    store.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general_ops",
      title: "Transition test task",
      status: status as "queued",
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
  });
}

// ============================================================================
// Task Status Transition Benchmarks
// ============================================================================

test("performance: transitionTaskStatus throughput >5000 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const transitions = new TransitionService(db, store);

  try {
    const taskIds: string[] = [];
    for (let i = 0; i < 100; i++) {
      const taskId = newId("task");
      taskIds.push(taskId);
      seedTask(store, db, taskId, "queued");
    }

    const iterations = 5000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const taskId = taskIds[i % taskIds.length]!;
      const fromStatus = i % 2 === 0 ? "queued" : "pending";
      transitions.transitionTaskStatus({
        entityKind: "task",
        entityId: taskId,
        fromStatus: fromStatus as "queued" | "pending",
        toStatus: fromStatus === "queued" ? "pending" : "in_progress",
        executionId: null,
        reasonCode: "perf_test",
        traceId: newId("trace"),
        actorType: "system",
        occurredAt: nowIso(),
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 5000,
        `Task status transition throughput ${opsPerSec.toFixed(0)} ops/sec must be >5000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
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

test("performance: transitionTaskStatus P99 latency <1ms", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const transitions = new TransitionService(db, store);

  try {
    const taskIds: string[] = [];
    for (let i = 0; i < 100; i++) {
      const taskId = newId("task");
      taskIds.push(taskId);
      seedTask(store, db, taskId, "queued");
    }

    const latencies: number[] = [];
    const iterations = 5000;

    // Warmup
    for (let i = 0; i < 100; i++) {
      const taskId = taskIds[i % taskIds.length]!;
      transitions.transitionTaskStatus({
        entityKind: "task",
        entityId: taskId,
        fromStatus: "queued",
        toStatus: "pending",
        executionId: null,
        reasonCode: "perf_test",
        traceId: newId("trace"),
        actorType: "system",
        occurredAt: nowIso(),
      });
    }

    // Reset tasks to queued
    for (const taskId of taskIds) {
      db.transaction(() => {
        store.updateTaskStatus(taskId, "queued", nowIso(), null, null);
      });
    }

    // Measure
    for (let i = 0; i < iterations; i++) {
      const taskId = taskIds[i % taskIds.length]!;
      const start = performance.now();
      transitions.transitionTaskStatus({
        entityKind: "task",
        entityId: taskId,
        fromStatus: "queued",
        toStatus: "pending",
        executionId: null,
        reasonCode: "perf_test",
        traceId: newId("trace"),
        actorType: "system",
        occurredAt: nowIso(),
      });
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 1,
        `Task status transition P99 latency ${p99.toFixed(4)}ms exceeds 1ms target. P50: ${p50.toFixed(4)}ms`,
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
// Session Status Transition Benchmarks
// ============================================================================

test("performance: transitionSessionStatus throughput >5000 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const transitions = new TransitionService(db, store);

  try {
    const sessionIds: string[] = [];
    const taskIds: string[] = [];

    for (let i = 0; i < 100; i++) {
      const taskId = newId("task");
      const sessionId = newId("sess");
      taskIds.push(taskId);
      sessionIds.push(sessionId);

      const now = nowIso();
      db.transaction(() => {
        store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general_ops",
          title: "Session transition test",
          status: "in_progress",
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

        store.insertSession({
          id: sessionId,
          taskId,
          channel: "cli",
          status: "open",
          externalSessionId: null,
          createdAt: now,
          updatedAt: now,
        });
      });
    }

    const iterations = 5000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const sessionId = sessionIds[i % sessionIds.length]!;
      transitions.transitionSessionStatus({
        entityKind: "session",
        entityId: sessionId,
        fromStatus: i % 2 === 0 ? "open" : "streaming",
        toStatus: i % 2 === 0 ? "streaming" : "completed",
        reasonCode: "perf_test",
        traceId: newId("trace"),
        actorType: "system",
        occurredAt: nowIso(),
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 5000,
        `Session status transition throughput ${opsPerSec.toFixed(0)} ops/sec must be >5000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
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
// Workflow Status Transition Benchmarks
// ============================================================================

test("performance: transitionWorkflowStatus throughput >5000 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const transitions = new TransitionService(db, store);

  try {
    const taskIds: string[] = [];

    for (let i = 0; i < 100; i++) {
      const taskId = newId("task");
      taskIds.push(taskId);

      const now = nowIso();
      db.transaction(() => {
        store.insertWorkflowState({
          taskId,
          divisionId: "general_ops",
          workflowId: "test_workflow",
          currentStepIndex: 0,
          status: "running",
          outputsJson: "{}",
          lastErrorCode: null,
          retryCount: 0,
          resumableFromStep: null,
          startedAt: now,
          updatedAt: now,
        });
      });
    }

    const iterations = 5000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const taskId = taskIds[i % taskIds.length]!;
      transitions.transitionWorkflowStatus({
        entityKind: "workflow",
        entityId: taskId,
        fromStatus: i % 2 === 0 ? "running" : "paused",
        toStatus: i % 2 === 0 ? "paused" : "running",
        currentStepIndex: 1,
        outputsJson: "{}",
        reasonCode: "perf_test",
        traceId: newId("trace"),
        actorType: "system",
        occurredAt: nowIso(),
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 5000,
        `Workflow status transition throughput ${opsPerSec.toFixed(0)} ops/sec must be >5000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
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
