/**
 * Recovery Integration Test: Dispatch Reconciliation Recovery
 *
 * Verifies that the dispatch reconciliation service properly handles
 * orphaned executions and reconciles dispatch state.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";

test("recovery: dispatch reconciliation detects orphaned executions", () => {
  const workspace = createTempWorkspace("recovery-dispatch-");

  try {
    const dbPath = join(workspace, "dispatch-reconcile.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const executionId = newId("exec");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: "Dispatch reconcile test",
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

    const orphanedExecutions = db.connection
      .prepare(
        `SELECT e.* FROM executions e
         LEFT JOIN execution_leases l ON e.id = l.execution_id AND l.status = 'active'
         WHERE e.status = 'executing' AND l.id IS NULL`,
      )
      .all() as Array<{ id: string; status: string }>;

    assert.equal(orphanedExecutions.length, 1, "Should find 1 orphaned execution");
    assert.strictEqual(orphanedExecutions[0]!.id, executionId, "Orphaned execution should match");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("recovery: dispatch reconciliation handles task in terminal state with active execution", () => {
  const workspace = createTempWorkspace("recovery-dispatch-terminal-");

  try {
    const dbPath = join(workspace, "dispatch-terminal.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const executionId = newId("exec");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: "Terminal task test",
        status: "done",
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
        completedAt: now,
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

    const task = db.connection
      .prepare("SELECT status FROM tasks WHERE id = ?")
      .get(taskId) as { status: string } | undefined;

    const execution = db.connection
      .prepare("SELECT status FROM executions WHERE id = ?")
      .get(executionId) as { status: string } | undefined;

    assert.ok(task, "Task should exist");
    assert.ok(execution, "Execution should exist");
    assert.strictEqual(task!.status, "done", "Task should be in terminal state");
    assert.strictEqual(execution!.status, "executing", "Execution should still be 'executing'");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("recovery: dispatch reconciliation can reset stuck dispatch", () => {
  const workspace = createTempWorkspace("recovery-dispatch-stuck-");

  try {
    const dbPath = join(workspace, "dispatch-stuck.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const executionId = newId("exec");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: "Stuck dispatch test",
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
        status: "created",
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
        startedAt: null,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    const stuckExecution = db.connection
      .prepare("SELECT * FROM executions WHERE id = ?")
      .get(executionId) as { status: string } | undefined;

    assert.ok(stuckExecution, "Execution should exist");
    assert.strictEqual(stuckExecution!.status, "created", "Execution should be in created status");

    db.connection
      .prepare("UPDATE executions SET status = ?, updated_at = ? WHERE id = ?")
      .run("failed", nowIso(), executionId);

    const updatedExecution = db.connection
      .prepare("SELECT status FROM executions WHERE id = ?")
      .get(executionId) as { status: string };

    assert.strictEqual(updatedExecution!.status, "failed", "Execution should be marked as failed");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
