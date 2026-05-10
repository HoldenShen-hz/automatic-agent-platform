/**
 * Contract Test: Store Facade Repository Contract
 *
 * Verifies that AuthoritativeTaskStore facade methods return types
 * that are consistent with the underlying repository implementations.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { TaskRepository } from "../../../../src/platform/state-evidence/truth/sqlite/repositories/task-repository.js";
import { ExecutionRepository } from "../../../../src/platform/state-evidence/truth/sqlite/repositories/execution-repository.js";
import { SessionRepository } from "../../../../src/platform/state-evidence/truth/sqlite/repositories/session-repository.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { newId, nowIso } from "../../../../src/platform/contracts/types/ids.js";

test("contract: store.getTask returns same data as direct repository query", () => {
  const workspace = createTempWorkspace("aa-contract-store-");

  try {
    const dbPath = join(workspace, "contract-store.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const taskRepo = new TaskRepository(db.connection);

    const taskId = newId("task");
    const now = nowIso();

    // Insert via repository directly
    db.transaction(() => {
      taskRepo.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Contract test task",
        status: "queued",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: null,
        outputJson: null,
        estimatedCostUsd: null,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    // Query via store facade
    const storeResult = store.getTask(taskId);

    // Query via direct repository
    const repoResult = taskRepo.getTask(taskId);

    // Both should return same data
    assert.ok(storeResult, "Store should return task");
    assert.ok(repoResult, "Repository should return task");
    assert.equal(storeResult!.id, repoResult!.id);
    assert.equal(storeResult!.status, repoResult!.status);
    assert.equal(storeResult!.title, repoResult!.title);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("contract: store.listExecutionsByTask returns same data as direct repository", () => {
  const workspace = createTempWorkspace("aa-contract-exec-");

  try {
    const dbPath = join(workspace, "contract-exec.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const taskRepo = new TaskRepository(db.connection);
    const execRepo = new ExecutionRepository(db.connection);

    const taskId = newId("task");
    const execId = newId("exec");
    const now = nowIso();

    // Setup: insert task and execution via repository
    db.transaction(() => {
      taskRepo.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Contract test task",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: null,
        outputJson: null,
        estimatedCostUsd: null,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      execRepo.insertExecution({
        id: execId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        harnessRunId: null,
        budgetReservationId: null,
        budgetLedgerId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "contract-trace",
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1.0,
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
    });

    // Query via store
    const storeResult = store.listExecutionsByTask(taskId);

    // Query via direct repository
    const repoResult = execRepo.listExecutionsByTask(taskId);

    // Both should return same executions
    assert.equal(storeResult.length, repoResult.length);
    assert.equal(storeResult.length, 1);
    assert.equal(storeResult![0]!.id, execId);
    assert.equal(repoResult[0]!.id, execId);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("contract: store.selectLatestSessionByTask returns same data as direct repository", () => {
  const workspace = createTempWorkspace("aa-contract-session-");

  try {
    const dbPath = join(workspace, "contract-session.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const taskRepo = new TaskRepository(db.connection);
    const sessionRepo = new SessionRepository(db.connection);

    const taskId = newId("task");
    const sessionId = newId("sess");
    const now = nowIso();

    // Setup
    db.transaction(() => {
      taskRepo.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Contract test task",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: null,
        outputJson: null,
        estimatedCostUsd: null,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      sessionRepo.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "open",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Query via store
    const storeResult = store.selectLatestSessionByTask(taskId);

    // Query via direct repository
    const repoResult = sessionRepo.listSessionsByTask(taskId);

    // Both should return same session
    assert.ok(storeResult != null, "Store should return session");
    assert.ok(repoResult.length > 0, "Repository should return session");
    assert.equal(storeResult!.id, repoResult[0]!.id);
    assert.equal(storeResult!.id, sessionId);
    assert.equal(repoResult[0]!.id, sessionId);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("contract: store returns null for non-existent entities", () => {
  const workspace = createTempWorkspace("aa-contract-null-");

  try {
    const dbPath = join(workspace, "contract-null.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    // Query non-existent entities
    const task = store.getTask("non-existent-task");
    const executions = store.listExecutionsByTask("non-existent-task");
    const session = store.selectLatestSessionByTask("non-existent-task");

    // All should return null or empty array (store returns null for non-existent, repository returns undefined)
    assert.equal(task, null);
    assert.deepEqual(executions, []);
    assert.equal(session, undefined);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
