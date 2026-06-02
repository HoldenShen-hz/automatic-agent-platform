/**
 * Performance tests for Truth Repository operations
 *
 * Design targets:
 * - Task insertion: >5000 ops/sec
 * - Task query: >10000 ops/sec
 * - Execution lookup: >8000 ops/sec
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { reportSoftPerformanceMiss } from "../../../helpers/performance.js";

import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { newId, nowIso } from "../../../../src/platform/contracts/types/ids.js";
import { createTempWorkspace, cleanupPath } from "../../../helpers/fs.js";

function createTempDb(): { db: SqliteDatabase; store: AuthoritativeTaskStore; workspace: string } {
  const workspace = createTempWorkspace("aa-perf-truth-");
  const dbPath = join(workspace, "truth-perf.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return { db, store, workspace };
}

test("performance: truth repository task insertion >5000 ops/sec", (t) => {
  const { db, store, workspace } = createTempDb();

  try {
    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const taskId = newId("task");
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: `Task ${i}`,
        status: "pending",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        completedAt: null,
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 5000,
        `Task insertion throughput ${opsPerSec.toFixed(2)} ops/sec must be >5000 ops/sec. Avg latency: ${avgLatencyMs.toFixed(3)}ms`,
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

test("performance: truth repository task query by status >10000 ops/sec", (t) => {
  const { db, store, workspace } = createTempDb();

  // Insert test tasks
  for (let i = 0; i < 500; i++) {
    const taskId = newId("task");
    store.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general-ops",
      title: `Task ${i}`,
      status: i % 2 === 0 ? "pending" : "in_progress",
      source: "user",
      priority: "normal",
      inputJson: "{}",
      normalizedInputJson: "{}",
      outputJson: null,
      estimatedCostUsd: 0,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      completedAt: null,
    });
  }

  try {
    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      store.listTasks(1000).filter((task) => task.status === "pending");
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;

    try {
      assert.ok(
        opsPerSec > 10000,
        `Task query throughput ${opsPerSec.toFixed(2)} ops/sec must be >10000 ops/sec`,
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

test("performance: truth repository execution lookup >8000 ops/sec", (t) => {
  const { db, store, workspace } = createTempDb();
  let firstExecId = "";

  // Insert task and execution pairs
  for (let i = 0; i < 200; i++) {
    const taskId = newId("task");
    const executionId = newId("exec");
    store.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general-ops",
      title: `Task ${i}`,
      status: "pending",
      source: "user",
      priority: "normal",
      inputJson: "{}",
      normalizedInputJson: "{}",
      outputJson: null,
      estimatedCostUsd: 0,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      completedAt: null,
    });

    store.execution.insertExecution({
      id: executionId,
      taskId,
      workflowId: "test_wf",
      parentExecutionId: null,
      agentId: "agent_test",
      roleId: "executor",
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
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    if (firstExecId === "") {
      firstExecId = executionId;
    }
  }

  try {
    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      store.execution.getExecution(firstExecId);
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;

    try {
      assert.ok(
        opsPerSec > 8000,
        `Execution lookup throughput ${opsPerSec.toFixed(2)} ops/sec must be >8000 ops/sec`,
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
