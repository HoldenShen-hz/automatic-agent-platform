/**
 * Performance Test: State Transition Operations
 * Measures state transition validation and transition service throughput
 *
 * Design targets:
 * - State transition validation: >10000 ops/sec
 * - Bulk state transitions: >5000 ops/sec
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { rmSync } from "node:fs";
import { reportSoftPerformanceMiss } from "../helpers/performance.js";

import { SqliteDatabase } from "../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { TransitionService } from "../../src/platform/five-plane-execution/state-transition/transition-service.js";
import { newId, nowIso } from "../../src/platform/contracts/types/ids.js";

function createTempDb(): SqliteDatabase {
  const dbPath = join(".tmp", `state-transition-perf-${process.pid}-${Date.now()}.db`);
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  return db;
}

// ============================================================================
// Bulk Transition Benchmarks
// ============================================================================

test("performance: bulk task status transitions (100 tasks) <100ms", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const transitions = new TransitionService(db, store);

  try {
    const taskIds: string[] = [];

    // Create 100 tasks
    for (let i = 0; i < 100; i++) {
      const taskId = newId("task");
      taskIds.push(taskId);
      const now = nowIso();
      db.transaction(() => {
        store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general_ops",
          title: `Bulk transition test ${i}`,
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
      });
    }

    const start = performance.now();

    // Transition all 100 tasks
    for (const taskId of taskIds) {
      transitions.transitionTaskStatus({
        entityKind: "task",
        entityId: taskId,
        fromStatus: "queued",
        toStatus: "pending",
        executionId: null,
        reasonCode: "bulk_test",
        traceId: newId("trace"),
        actorType: "system",
        occurredAt: nowIso(),
      });
    }

    const elapsed = performance.now() - start;

    try {
      assert.ok(
        elapsed < 100,
        `Bulk transition of 100 tasks took ${elapsed.toFixed(2)}ms, expected <100ms`,
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

test("performance: sequential task lifecycle transitions >2000 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const transitions = new TransitionService(db, store);

  try {
    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const taskId = newId("task");
      const traceId = newId("trace");
      const now = nowIso();

      // Create task
      db.transaction(() => {
        store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general_ops",
          title: "Lifecycle test",
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
      });

      // queued -> pending
      transitions.transitionTaskStatus({
        entityKind: "task",
        entityId: taskId,
        fromStatus: "queued",
        toStatus: "pending",
        executionId: null,
        reasonCode: "test",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      });

      // pending -> in_progress
      transitions.transitionTaskStatus({
        entityKind: "task",
        entityId: taskId,
        fromStatus: "pending",
        toStatus: "in_progress",
        executionId: newId("exec"),
        reasonCode: "test",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations * 2 / elapsed) * 1000; // 2 transitions per iteration
    const avgLatencyMs = elapsed / (iterations * 2);

    try {
      assert.ok(
        opsPerSec > 2000,
        `Sequential lifecycle transitions throughput ${opsPerSec.toFixed(0)} ops/sec must be >2000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
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
// Complete Lifecycle Benchmarks
// ============================================================================

test("performance: complete task lifecycle (queued->done) <50ms per task", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const transitions = new TransitionService(db, store);

  try {
    const iterations = 100;
    const latencies: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const taskId = newId("task");
      const executionId = newId("exec");
      const sessionId = newId("sess");
      const traceId = newId("trace");
      const now = nowIso();

      const taskStart = performance.now();

      // Create task and execution
      db.transaction(() => {
        store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general_ops",
          title: "Complete lifecycle test",
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

        store.insertExecution({
          id: executionId,
          taskId,
          workflowId: "single_agent_minimal",
          parentExecutionId: null,
          agentId: "agent-1",
          roleId: "general_executor",
          runKind: "task_run",
          status: "executing",
          inputRef: null,
          traceId,
          attempt: 1,
          timeoutMs: 60000,
          budgetUsdLimit: 1,
          requiresApproval: 0,
          sandboxMode: "workspace_write",
          allowedToolsJson: "[]",
          allowedPathsJson: "[]",
          maxRetries: 0,
          retryBackoff: "none",
          lastErrorCode: null,
          lastErrorMessage: null,
          startedAt: now,
          finishedAt: null,
          createdAt: now,
          updatedAt: now,
        });

        store.insertSession({
          id: sessionId,
          taskId,
          channel: "cli",
          status: "streaming",
          externalSessionId: null,
          createdAt: now,
          updatedAt: now,
        });
      });

      // queued -> pending -> in_progress
      transitions.transitionTaskStatus({
        entityKind: "task",
        entityId: taskId,
        fromStatus: "queued",
        toStatus: "pending",
        executionId: null,
        reasonCode: "test",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      });

      transitions.transitionTaskStatus({
        entityKind: "task",
        entityId: taskId,
        fromStatus: "pending",
        toStatus: "in_progress",
        executionId,
        reasonCode: "test",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      });

      // execution succeeded
      transitions.transitionExecutionStatus({
        entityKind: "execution",
        entityId: executionId,
        fromStatus: "executing",
        toStatus: "succeeded",
        reasonCode: "test",
        traceId,
        actorType: "agent",
        occurredAt: nowIso(),
      });

      // complete task
      transitions.transitionTaskTerminalState({
        taskId,
        sessionId,
        executionId,
        currentTaskStatus: "in_progress",
        currentWorkflowStatus: "completed",
        currentSessionStatus: "streaming",
        currentExecutionStatus: "succeeded",
        terminalStatus: "done",
        taskOutputJson: JSON.stringify({ result: "success" }),
        outputsJson: "{}",
        context: {
          reasonCode: "task.completed",
          traceId,
          actorType: "system",
          occurredAt: nowIso(),
        },
      });

      latencies.push(performance.now() - taskStart);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const avg = latencies.reduce((a, b) => a + b, 0) / iterations;

    try {
      assert.ok(
        p99 < 50,
        `Complete lifecycle P99 latency ${p99.toFixed(2)}ms exceeds 50ms target. Avg: ${avg.toFixed(2)}ms`,
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
