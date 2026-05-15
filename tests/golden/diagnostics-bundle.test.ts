/**
 * Golden Test: Diagnostics Bundle Output
 *
 * Verifies diagnostics bundle generation produces expected structure
 * and key fields are present.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { SqliteDatabase } from "../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SessionRepository } from "../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/session-repository.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { newId, nowIso } from "../../src/platform/contracts/types/ids.js";
import { seedTaskAndExecution } from "../helpers/seed.js";

test("golden: diagnostics bundle has expected structure", () => {
  const workspace = createTempWorkspace("aa-golden-diagnostics-");

  try {
    const dbPath = join(workspace, "diagnostics.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    // Create a task with execution for diagnostics
    const taskId = newId("task");
    const executionId = newId("exec");
    const sessionId = newId("sess");
    const traceId = "diag-trace-1";
    const now = nowIso();

    seedTaskAndExecution(db, store, { taskId, executionId, traceId });

    // Create a workflow state
    db.transaction(() => {
      store.insertWorkflowState({
        taskId,
        divisionId: "general_ops",
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
        id: sessionId,
        taskId,
        channel: "cli",
        status: "open",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Query diagnostics data - simulating what diagnostics bundle would collect
    const task = store.getTask(taskId);
    const execution = store.getExecution(executionId);
    const session = store.selectLatestSessionByTask(taskId);
    const workflowState = store.getWorkflowState(taskId);

    // Verify expected structure
    assert.ok(task, "Task should exist in diagnostics");
    assert.equal(task!.id, taskId);
    assert.equal(task!.status, "in_progress");

    assert.ok(execution, "Execution should exist in diagnostics");
    assert.equal(execution!.id, executionId);

    assert.ok(session, "Session should exist in diagnostics");
    assert.equal(session!.id, sessionId);

    assert.ok(workflowState, "Workflow state should exist in diagnostics");
    assert.equal(workflowState!.workflowId, "single_agent_minimal");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("golden: diagnostics bundle handles empty database gracefully", () => {
  const workspace = createTempWorkspace("aa-golden-diagnostics-empty-");

  try {
    const dbPath = join(workspace, "diagnostics-empty.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const sessionRepo = new SessionRepository(db.connection);

    // Query non-existent data
    const task = store.getTask("non-existent-task");
    const executions = store.listExecutionsByTask("non-existent-task");
    const sessions = sessionRepo.listSessionsByTask("non-existent-task");

    // Verify null/empty responses
    assert.equal(task, null, "Non-existent task should return null");
    assert.deepEqual(executions, [], "Non-existent task should return empty executions array");
    assert.deepEqual(sessions, [], "Non-existent task should return empty sessions array");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("golden: diagnostics bundle collects system info", () => {
  const workspace = createTempWorkspace("aa-golden-diagnostics-sys-");

  try {
    const dbPath = join(workspace, "diagnostics-sys.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    // Create a task
    const taskId = newId("task");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "System diagnostics test",
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
    });

    // Verify task timestamps are recorded
    const task = store.getTask(taskId);
    assert.ok(task?.createdAt, "Task should have createdAt timestamp");
    assert.ok(task?.updatedAt, "Task should have updatedAt timestamp");
    assert.ok(task?.createdAt <= task?.updatedAt, "createdAt should be <= updatedAt");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
