import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

test("loadExecutionAuthoritativeView returns null for non-existent execution", () => {
  const workspace = createTempWorkspace("aa-store-consistency-");
  const dbPath = join(workspace, "execution-authoritative-view.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const view = store.loadExecutionAuthoritativeView("non-existent-exec");
    assert.equal(view, null);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("loadTaskSnapshot throws for non-existent task", () => {
  const workspace = createTempWorkspace("aa-store-consistency-");
  const dbPath = join(workspace, "execution-authoritative-view.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    assert.throws(
      () => store.loadTaskSnapshot("non-existent-task"),
      /Task not found/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("authoritative task store loads an authoritative execution view for critical write paths", () => {
  const workspace = createTempWorkspace("aa-store-consistency-");
  const dbPath = join(workspace, "execution-authoritative-view.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const now = "2026-04-07T11:00:00.000Z";

    db.transaction(() => {
      store.insertTask({
        id: "task-consistency",
        parentId: null,
        rootId: "task-consistency",
        divisionId: "general-ops",
        title: "consistency task",
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
      store.insertWorkflowState({
        taskId: "task-consistency",
        divisionId: "general-ops",
        workflowId: "single_agent_minimal",
        currentStepIndex: 0,
        status: "running",
        outputsJson: "{}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
      });
      store.insertSession({
        id: "sess-consistency",
        taskId: "task-consistency",
        channel: "cli",
        status: "streaming",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
      store.insertExecution({
        id: "exec-consistency-1",
        taskId: "task-consistency",
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "trace-consistency-1",
        attempt: 1,
        timeoutMs: 1000,
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
      store.insertExecution({
        id: "exec-consistency-2",
        taskId: "task-consistency",
        workflowId: "single_agent_minimal",
        parentExecutionId: "exec-consistency-1",
        agentId: "agent-2",
        roleId: "general_executor",
        runKind: "task_run",
        status: "created",
        inputRef: null,
        traceId: "trace-consistency-2",
        attempt: 2,
        timeoutMs: 1000,
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
        createdAt: "2026-04-07T11:01:00.000Z",
        updatedAt: "2026-04-07T11:01:00.000Z",
      });
    });

    const view = store.loadExecutionAuthoritativeView("exec-consistency-1");
    const snapshot = store.loadTaskSnapshot("task-consistency");
    db.close();

    assert.equal(view?.consistency, "authoritative");
    assert.equal(view?.execution.id, "exec-consistency-1");
    assert.equal(view?.task?.id, "task-consistency");
    assert.equal(view?.workflow?.status, "running");
    assert.equal(view?.session?.id, "sess-consistency");
    assert.ok(typeof view?.observedAt === "string" && view.observedAt.length > 0);
    assert.equal(snapshot.consistency, "authoritative");
    assert.equal(snapshot.execution?.id, "exec-consistency-2");
    assert.ok(typeof snapshot.observedAt === "string" && snapshot.observedAt.length > 0);
  } finally {
    cleanupPath(workspace);
  }
});
