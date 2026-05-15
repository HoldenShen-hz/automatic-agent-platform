import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { ExecutionRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/execution-repository.js";
import { TaskRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/task-repository.js";
import { SqliteDatabase } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";
import type { ExecutionRecord, ExecutionPrecheckRecord, DeadLetterRecord } from "../../../../../../src/platform/contracts/types/domain.js";

function createTestTask(db: SqliteDatabase, taskId: string, now: string): void {
  const taskRepo = new TaskRepository(db.connection);
  taskRepo.insertTask({
    id: taskId,
    parentId: null,
    rootId: taskId,
    divisionId: "general_ops",
    tenantId: null,
    title: "Test task",
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
}

function createTestExecution(db: SqliteDatabase, execId: string, taskId: string, now: string, attempt = 1): void {
  const execRepo = new ExecutionRepository(db.connection);
  createTestTask(db, taskId, now);
  execRepo.insertExecution({
    id: execId,
    taskId,
    workflowId: "single_agent_minimal",
    parentExecutionId: null,
    agentId: "agent-1",
    roleId: "general_executor",
    runKind: "task_run",
    status: "executing",
    inputRef: null,
    traceId: `trace-${execId}`,
    attempt,
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
}

test("ExecutionRepository inserts an execution and getExecution returns it", () => {
  const workspace = createTempWorkspace("aa-exec-repo-");
  const dbPath = join(workspace, "exec-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ExecutionRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    createTestExecution(db, "exec-001", "task-exec-1", now);

    const result = repo.getExecution("exec-001");

    assert.ok(result, "getExecution should return the inserted execution");
    assert.equal(result.id, "exec-001");
    assert.equal(result.taskId, "task-exec-1");
    assert.equal(result.status, "executing");
    assert.equal(result.attempt, 1);
    assert.equal(result.runKind, "task_run");
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionRepository getExecution returns undefined for non-existent execution", () => {
  const workspace = createTempWorkspace("aa-exec-repo-");
  const dbPath = join(workspace, "exec-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ExecutionRepository(db.connection);

    const result = repo.getExecution("nonexistent-exec");
    assert.strictEqual(result, undefined);
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionRepository listExecutionsByTask returns all executions for a task", () => {
  const workspace = createTempWorkspace("aa-exec-repo-");
  const dbPath = join(workspace, "exec-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ExecutionRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    createTestTask(db, "task-exec-list", now);

    for (let i = 1; i <= 3; i++) {
      repo.insertExecution({
        id: `exec-list-${i}`,
        taskId: "task-exec-list",
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: `trace-list-${i}`,
        attempt: i,
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
    }

    const results = repo.listExecutionsByTask("task-exec-list");
    assert.equal(results.length, 3, "should return all 3 executions");
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionRepository listExecutionsByStatuses returns executions with matching statuses", () => {
  const workspace = createTempWorkspace("aa-exec-repo-");
  const dbPath = join(workspace, "exec-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ExecutionRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    createTestTask(db, "task-exec-status", now);

    repo.insertExecution({
      id: "exec-status-1",
      taskId: "task-exec-status",
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent-1",
      roleId: "general_executor",
      runKind: "task_run",
      status: "executing",
      inputRef: null,
      traceId: "trace-status-1",
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

    repo.insertExecution({
      id: "exec-status-2",
      taskId: "task-exec-status",
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent-1",
      roleId: "general_executor",
      runKind: "task_run",
      status: "prechecking",
      inputRef: null,
      traceId: "trace-status-2",
      attempt: 2,
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

    const executing = repo.listExecutionsByStatuses(["executing"]);
    assert.equal(executing.length, 1, "should return 1 executing");
    assert.equal(executing[0]?.id, "exec-status-1");

    const prechecking = repo.listExecutionsByStatuses(["prechecking"]);
    assert.equal(prechecking.length, 1, "should return 1 prechecking");
    assert.equal(prechecking[0]?.id, "exec-status-2");
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionRepository updateExecutionStatus changes execution status", () => {
  const workspace = createTempWorkspace("aa-exec-repo-");
  const dbPath = join(workspace, "exec-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ExecutionRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    createTestExecution(db, "exec-update", "task-exec-update", now);

    const newUpdatedAt = "2026-04-14T11:00:00.000Z";
    repo.updateExecutionStatus("exec-update", "prechecking", newUpdatedAt);

    const result = repo.getExecution("exec-update");
    assert.ok(result);
    assert.equal(result.status, "prechecking");
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionRepository updateExecutionStatus updates lifecycle timestamps and error code", () => {
  const workspace = createTempWorkspace("aa-exec-repo-");
  const dbPath = join(workspace, "exec-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ExecutionRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    const startedAt = "2026-04-14T10:01:00.000Z";
    const finishedAt = "2026-04-14T10:09:00.000Z";
    createTestExecution(db, "exec-lifecycle", "task-exec-lifecycle", now);

    repo.updateExecutionStatus("exec-lifecycle", "failed", finishedAt, startedAt, finishedAt, "agent.crash");

    const result = repo.getExecution("exec-lifecycle");
    assert.equal(result?.status, "failed");
    assert.equal(result?.startedAt, startedAt);
    assert.equal(result?.finishedAt, finishedAt);
    assert.equal(result?.lastErrorCode, "agent.crash");
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionRepository insertExecutionPrecheck and getExecutionPrecheck work", () => {
  const workspace = createTempWorkspace("aa-exec-repo-");
  const dbPath = join(workspace, "exec-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ExecutionRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    createTestExecution(db, "exec-precheck", "task-precheck", now);

    const precheck: ExecutionPrecheckRecord = {
      id: "precheck-001",
      executionId: "exec-precheck",
      allowed: 1,
      reasonCode: "budget_sufficient",
      resolvedBudgetUsd: 0.5,
      resolvedTimeoutMs: 60000,
      resolvedSandboxMode: "workspace_write",
      resolvedToolsJson: "[]",
      resolvedPathsJson: "[]",
      checkedAt: now,
    };

    repo.insertExecutionPrecheck(precheck);

    const result = repo.getExecutionPrecheck("exec-precheck");
    assert.ok(result);
    assert.equal(result.executionId, "exec-precheck");
    assert.equal(result.allowed, 1);
    assert.equal(result.reasonCode, "budget_sufficient");
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionRepository insertDeadLetter and getDeadLetterByExecutionId work", () => {
  const workspace = createTempWorkspace("aa-exec-repo-");
  const dbPath = join(workspace, "exec-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ExecutionRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    createTestExecution(db, "exec-deadletter", "task-deadletter", now);

    const deadLetter: DeadLetterRecord = {
      id: "dl-001",
      taskId: "task-deadletter",
      executionId: "exec-deadletter",
      finalReasonCode: "timeout",
      retryCount: 3,
      lastErrorMessage: "Execution timed out after 60000ms",
      movedAt: now,
    };

    repo.insertDeadLetter(deadLetter);

    const result = repo.getDeadLetterByExecutionId("exec-deadletter");
    assert.ok(result);
    assert.equal(result.executionId, "exec-deadletter");
    assert.equal(result.finalReasonCode, "timeout");
    assert.equal(result.retryCount, 3);
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionRepository listDeadLettersByTask returns dead letters for a task", () => {
  const workspace = createTempWorkspace("aa-exec-repo-");
  const dbPath = join(workspace, "exec-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ExecutionRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    createTestTask(db, "task-dl-list", now);

    repo.insertExecution({
      id: "exec-dl-1",
      taskId: "task-dl-list",
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent-1",
      roleId: "general_executor",
      runKind: "task_run",
      status: "failed",
      inputRef: null,
      traceId: "trace-dl-1",
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
      finishedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    repo.insertExecution({
      id: "exec-dl-2",
      taskId: "task-dl-list",
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent-1",
      roleId: "general_executor",
      runKind: "task_run",
      status: "failed",
      inputRef: null,
      traceId: "trace-dl-2",
      attempt: 2,
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
      finishedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    repo.insertDeadLetter({
      id: "dl-list-1",
      taskId: "task-dl-list",
      executionId: "exec-dl-1",
      finalReasonCode: "timeout",
      retryCount: 1,
      lastErrorMessage: "Timed out",
      movedAt: now,
    });

    repo.insertDeadLetter({
      id: "dl-list-2",
      taskId: "task-dl-list",
      executionId: "exec-dl-2",
      finalReasonCode: "budget_exceeded",
      retryCount: 2,
      lastErrorMessage: "Budget exceeded",
      movedAt: now,
    });

    const results = repo.listDeadLettersByTask("task-dl-list");
    assert.equal(results.length, 2, "should return 2 dead letters");
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionRepository insertExecution violates UNIQUE constraint throws error", () => {
  const workspace = createTempWorkspace("aa-exec-repo-");
  const dbPath = join(workspace, "exec-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ExecutionRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    createTestTask(db, "task-exec-dup", now);

    repo.insertExecution({
      id: "exec-duplicate",
      taskId: "task-exec-dup",
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent-1",
      roleId: "general_executor",
      runKind: "task_run",
      status: "executing",
      inputRef: null,
      traceId: "trace-dup",
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

    assert.throws(() => {
      repo.insertExecution({
        id: "exec-duplicate-2",
        taskId: "task-exec-dup",
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "trace-dup-2",
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
    }, /UNIQUE constraint failed/i);
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionRepository column mapping snake_case to camelCase is correct", () => {
  const workspace = createTempWorkspace("aa-exec-repo-");
  const dbPath = join(workspace, "exec-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ExecutionRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    createTestExecution(db, "exec-columns", "task-exec-cols", now);

    const result = repo.getExecution("exec-columns");
    assert.ok(result);
    assert.equal(result.taskId, "task-exec-cols");
    assert.equal(result.workflowId, "single_agent_minimal");
    assert.equal(result.parentExecutionId, null);
    assert.equal(result.agentId, "agent-1");
    assert.equal(result.roleId, "general_executor");
    assert.equal(result.runKind, "task_run");
    assert.equal(result.status, "executing");
    assert.equal(result.inputRef, null);
    assert.equal(result.attempt, 1);
    assert.equal(result.timeoutMs, 60000);
    assert.equal(result.budgetUsdLimit, 1.0);
    assert.equal(result.requiresApproval, 0);
    assert.equal(result.sandboxMode, "workspace_write");
    assert.equal(result.maxRetries, 0);
    assert.equal(result.retryBackoff, "none");
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionRepository rejects insertion with non-existent task_id FK", () => {
  const workspace = createTempWorkspace("aa-exec-repo-");
  const dbPath = join(workspace, "exec-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ExecutionRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";

    // Attempt to insert execution with non-existent task_id
    assert.throws(
      () => {
        repo.insertExecution({
          id: "exec-fk-task",
          taskId: "nonexistent-task-id",
          workflowId: "single_agent_minimal",
          parentExecutionId: null,
          agentId: "agent-1",
          roleId: "general_executor",
          runKind: "task_run",
          status: "executing",
          inputRef: null,
          traceId: "trace-fk",
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
      },
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        return message.includes("FOREIGN KEY") || message.includes("constraint");
      },
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionRepository rejects insertion with non-existent parent_execution_id FK", () => {
  const workspace = createTempWorkspace("aa-exec-repo-");
  const dbPath = join(workspace, "exec-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ExecutionRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    createTestTask(db, "task-with-child-exec", now);

    // Attempt to insert execution with non-null but non-existent parent_execution_id
    assert.throws(
      () => {
        repo.insertExecution({
          id: "exec-child-fk",
          taskId: "task-with-child-exec",
          workflowId: "single_agent_minimal",
          parentExecutionId: "nonexistent-parent-exec",
          agentId: "agent-1",
          roleId: "general_executor",
          runKind: "task_run",
          status: "executing",
          inputRef: null,
          traceId: "trace-child-fk",
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
      },
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        return message.includes("FOREIGN KEY") || message.includes("constraint");
      },
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionRepository listExecutionsByStatuses with empty array returns empty array", () => {
  const workspace = createTempWorkspace("aa-exec-repo-");
  const dbPath = join(workspace, "exec-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ExecutionRepository(db.connection);

    // Empty array should return empty array without SQL error
    const results = repo.listExecutionsByStatuses([]);
    assert.equal(results.length, 0, "should return empty array for empty statuses");
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionRepository updateExecutionFailure records terminal error details", () => {
  const workspace = createTempWorkspace("aa-exec-repo-");
  const dbPath = join(workspace, "exec-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ExecutionRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    const later = "2026-04-14T11:00:00.000Z";
    createTestExecution(db, "exec-failure-update", "task-exec-failure-update", now);

    repo.updateExecutionFailure({
      executionId: "exec-failure-update",
      status: "failed",
      updatedAt: later,
      finishedAt: later,
      lastErrorCode: "EXEC_FAILURE",
      lastErrorMessage: "execution failed",
    });

    const result = repo.getExecution("exec-failure-update");
    assert.ok(result);
    assert.equal(result.status, "failed");
    assert.equal(result.finishedAt, later);
    assert.equal(result.lastErrorCode, "EXEC_FAILURE");
    assert.equal(result.lastErrorMessage, "execution failed");
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionRepository updateExecutionAgent reassigns agent", () => {
  const workspace = createTempWorkspace("aa-exec-repo-");
  const dbPath = join(workspace, "exec-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ExecutionRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    const later = "2026-04-14T10:30:00.000Z";
    createTestExecution(db, "exec-agent-update", "task-exec-agent-update", now);

    repo.updateExecutionAgent("exec-agent-update", "agent-2", later);

    const result = repo.getExecution("exec-agent-update");
    assert.ok(result);
    assert.equal(result.agentId, "agent-2");
    assert.equal(result.updatedAt, later);
  } finally {
    cleanupPath(workspace);
  }
});
