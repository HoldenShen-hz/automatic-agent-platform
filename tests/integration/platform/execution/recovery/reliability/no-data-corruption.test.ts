/**
 * Reliability Integration Test: Data Integrity Invariants
 *
 * Verifies system maintains data integrity under various conditions.
 * Part of reliability tests per strategy doc Section 6.0c.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../../src/platform/contracts/types/ids.js";

test("reliability: task status transitions are atomic", () => {
  const workspace = createTempWorkspace("reliability-atomic-");

  try {
    const dbPath = join(workspace, "atomic.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const now = nowIso();

    // Create task
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Atomic test",
        status: "pending",
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

    // Update status
    const beforeUpdate = nowIso();
    db.transaction(() => {
      store.updateTaskStatus(taskId, "in_progress", beforeUpdate, null, null);
    });

    // Verify only one status exists
    const tasks = store.listTasks(100);
    const task = tasks.find((t) => t.id === taskId);
    assert.ok(task, "Task should exist");
    assert.strictEqual(task!.status, "in_progress", "Status should be updated atomically");

    // Verify updatedAt was changed
    assert.ok(task!.updatedAt >= beforeUpdate, "updatedAt should be updated");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("reliability: tasks maintain referential integrity with parent", () => {
  const workspace = createTempWorkspace("reliability-ref-integrity-");

  try {
    const dbPath = join(workspace, "ref-integrity.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const rootId = newId("root");
    const parentId = newId("parent");
    const childId = newId("child");
    const now = nowIso();

    // Create root task
    db.transaction(() => {
      store.insertTask({
        id: rootId,
        parentId: null,
        rootId: rootId,
        divisionId: "general_ops",
        title: "Root task",
        status: "pending",
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

    // Create child task with parent reference
    db.transaction(() => {
      store.insertTask({
        id: parentId,
        parentId: rootId,
        rootId: rootId,
        divisionId: "general_ops",
        title: "Parent task",
        status: "pending",
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

    // Query tasks
    const tasks = store.listTasks(100);
    const roots = tasks.filter((t) => t.parentId === null);
    const children = tasks.filter((t) => t.parentId !== null);

    assert.ok(roots.length >= 1, "Should have at least one root task");
    assert.ok(children.length >= 1, "Should have at least one child task");
    assert.strictEqual(children[0]!.parentId, rootId, "Child should reference correct parent");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("reliability: session cleanup does not affect task data", () => {
  const workspace = createTempWorkspace("reliability-session-");

  try {
    const dbPath = join(workspace, "session.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const sessionId = newId("sess");
    const now = nowIso();

    // Create task and session
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Session test",
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

    // Verify both exist
    const tasks = store.listTasks(10);
    const sessionCount = db.connection
      .prepare("SELECT COUNT(*) as count FROM sessions WHERE id = ?")
      .get(sessionId) as { count: number };
    assert.ok(tasks.length > 0, "Task should exist");
    assert.ok(sessionCount.count > 0, "Session should exist");

    // Update session status
    db.transaction(() => {
      store.updateSessionStatus(sessionId, "closed", nowIso());
    });

    // Task should still exist unaffected
    const updatedTasks = store.listTasks(10);
    const task = updatedTasks.find((t) => t.id === taskId);
    assert.ok(task, "Task should still exist after session update");
    assert.strictEqual(task!.status, "in_progress", "Task status should be unaffected");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("reliability: execution status changes do not corrupt task status", () => {
  const workspace = createTempWorkspace("reliability-exec-task-");

  try {
    const dbPath = join(workspace, "exec-task.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const executionId = newId("exec");
    const now = nowIso();

    // Create task and execution
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Exec task test",
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

      store.insertExecution({
        id: executionId,
        taskId,
        workflowId: null,
        parentExecutionId: null,
        agentId: newId("agent"),
        roleId: null,
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: newId("trace"),
        attempt: 1,
        timeoutMs: 30000,
        budgetUsdLimit: null,
        requiresApproval: 0,
        sandboxMode: null,
        allowedToolsJson: null,
        allowedPathsJson: null,
        maxRetries: 0,
        retryBackoff: "exponential",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Update execution to completed
    db.transaction(() => {
      store.updateExecutionStatus(executionId, "succeeded", nowIso(), now, now, null);
    });

    // Task status should remain unchanged
    const tasks = store.listTasks(10);
    const task = tasks.find((t) => t.id === taskId);
    assert.ok(task, "Task should still exist");
    assert.strictEqual(task!.status, "in_progress", "Task status should be independent of execution status");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
