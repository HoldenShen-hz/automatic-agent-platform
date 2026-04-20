import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { ApprovalRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/approval-repository.js";
import { TaskRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/task-repository.js";
import { ExecutionRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/execution-repository.js";
import { SqliteDatabase } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";
import type { ApprovalRecord, TakeoverSessionRecord, OperatorActionRecord } from "../../../../../../src/platform/contracts/types/domain.js";
import type { TakeoverSessionStatus, OperatorActionType } from "../../../../../../src/platform/contracts/types/domain.js";

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

function createTestExecution(db: SqliteDatabase, execId: string, taskId: string, now: string): void {
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
}

test("ApprovalRepository insertApproval and getApproval work", () => {
  const workspace = createTempWorkspace("aa-approval-repo-");
  const dbPath = join(workspace, "approval-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ApprovalRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    createTestTask(db, "task-approval-1", now);

    const approval: ApprovalRecord = {
      id: "approval-001",
      taskId: "task-approval-1",
      executionId: null,
      status: "requested",
      requestJson: '{"reason":"user_request"}',
      responseJson: null,
      timeoutPolicy: "5m",
      createdAt: now,
      respondedAt: null,
    };

    repo.insertApproval(approval);

    const result = repo.getApproval("approval-001");
    assert.ok(result);
    assert.equal(result.id, "approval-001");
    assert.equal(result.taskId, "task-approval-1");
    assert.equal(result.status, "requested");
    assert.equal(result.requestJson, '{"reason":"user_request"}');
  } finally {
    cleanupPath(workspace);
  }
});

test("ApprovalRepository getApproval returns null for non-existent approval", () => {
  const workspace = createTempWorkspace("aa-approval-repo-");
  const dbPath = join(workspace, "approval-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ApprovalRepository(db.connection);

    const result = repo.getApproval("nonexistent-approval");
    assert.strictEqual(result, null);
  } finally {
    cleanupPath(workspace);
  }
});

test("ApprovalRepository listApprovalsByTask returns approvals for a task", () => {
  const workspace = createTempWorkspace("aa-approval-repo-");
  const dbPath = join(workspace, "approval-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ApprovalRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    createTestTask(db, "task-approval-list", now);

    for (let i = 1; i <= 3; i++) {
      repo.insertApproval({
        id: `approval-list-${i}`,
        taskId: "task-approval-list",
        executionId: null,
        status: "requested",
        requestJson: "{}",
        responseJson: null,
        timeoutPolicy: "5m",
        createdAt: now,
        respondedAt: null,
      });
    }

    const results = repo.listApprovalsByTask("task-approval-list");
    assert.equal(results.length, 3, "should return all 3 approvals");
  } finally {
    cleanupPath(workspace);
  }
});

test("ApprovalRepository updateApprovalDecision updates approval status", () => {
  const workspace = createTempWorkspace("aa-approval-repo-");
  const dbPath = join(workspace, "approval-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ApprovalRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    createTestTask(db, "task-approval-update", now);

    repo.insertApproval({
      id: "approval-update-001",
      taskId: "task-approval-update",
      executionId: null,
      status: "requested",
      requestJson: "{}",
      responseJson: null,
      timeoutPolicy: "5m",
      createdAt: now,
      respondedAt: null,
    });

    const beforeResult = repo.getApproval("approval-update-001");
    assert.equal(beforeResult?.status, "requested");

    const respondedAt = "2026-04-14T11:00:00.000Z";
    repo.updateApprovalDecision({
      approvalId: "approval-update-001",
      status: "approved",
      responseJson: '{"approved":true}',
      respondedAt,
    });

    const afterResult = repo.getApproval("approval-update-001");
    assert.ok(afterResult);
    assert.equal(afterResult.status, "approved");
    assert.equal(afterResult.responseJson, '{"approved":true}');
    assert.equal(afterResult.respondedAt, respondedAt);
  } finally {
    cleanupPath(workspace);
  }
});

test("ApprovalRepository listApprovalsByStatus returns approvals with matching status", () => {
  const workspace = createTempWorkspace("aa-approval-repo-");
  const dbPath = join(workspace, "approval-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ApprovalRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    createTestTask(db, "task-approval-status", now);

    repo.insertApproval({
      id: "approval-status-1",
      taskId: "task-approval-status",
      executionId: null,
      status: "requested",
      requestJson: "{}",
      responseJson: null,
      timeoutPolicy: "5m",
      createdAt: now,
      respondedAt: null,
    });

    repo.insertApproval({
      id: "approval-status-2",
      taskId: "task-approval-status",
      executionId: null,
      status: "approved",
      requestJson: "{}",
      responseJson: '{"approved":true}',
      timeoutPolicy: "5m",
      createdAt: now,
      respondedAt: now,
    });

    const requested = repo.listApprovalsByStatus("requested");
    assert.equal(requested.length, 1, "should return 1 requested approval");
    assert.equal(requested[0]?.id, "approval-status-1");

    const approved = repo.listApprovalsByStatus("approved");
    assert.equal(approved.length, 1, "should return 1 approved approval");
    assert.equal(approved[0]?.id, "approval-status-2");
  } finally {
    cleanupPath(workspace);
  }
});

test("ApprovalRepository listTakeoverSessionsByTask returns sessions for a task", () => {
  const workspace = createTempWorkspace("aa-approval-repo-");
  const dbPath = join(workspace, "approval-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ApprovalRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    createTestTask(db, "task-takeover-list", now);

    const session: TakeoverSessionRecord = {
      id: "takeover-session-001",
      taskId: "task-takeover-list",
      executionId: null,
      operatorId: "operator-1",
      status: "open",
      reasonCode: "user_request",
      startedAt: now,
      closedAt: null,
    };

    repo.insertTakeoverSession(session);

    const results = repo.listTakeoverSessionsByTask("task-takeover-list");
    assert.equal(results.length, 1, "should return 1 takeover session");
    assert.equal(results[0]?.id, "takeover-session-001");
    assert.equal(results[0]?.operatorId, "operator-1");
    assert.equal(results[0]?.status, "open");
  } finally {
    cleanupPath(workspace);
  }
});

test("ApprovalRepository getTakeoverSession returns session by ID", () => {
  const workspace = createTempWorkspace("aa-approval-repo-");
  const dbPath = join(workspace, "approval-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ApprovalRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    createTestTask(db, "task-takeover-get", now);

    repo.insertTakeoverSession({
      id: "takeover-session-get",
      taskId: "task-takeover-get",
      executionId: null,
      operatorId: "operator-get",
      status: "open",
      reasonCode: "test",
      startedAt: now,
      closedAt: null,
    });

    const result = repo.getTakeoverSession("takeover-session-get");
    assert.ok(result);
    assert.equal(result?.id, "takeover-session-get");
    assert.equal(result?.operatorId, "operator-get");
  } finally {
    cleanupPath(workspace);
  }
});

test("ApprovalRepository closeTakeoverSession updates session status", () => {
  const workspace = createTempWorkspace("aa-approval-repo-");
  const dbPath = join(workspace, "approval-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ApprovalRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    const closedAt = "2026-04-14T11:00:00.000Z";
    createTestTask(db, "task-takeover-close", now);

    repo.insertTakeoverSession({
      id: "takeover-close",
      taskId: "task-takeover-close",
      executionId: null,
      operatorId: "operator-close",
      status: "open",
      reasonCode: "test",
      startedAt: now,
      closedAt: null,
    });

    repo.closeTakeoverSession("takeover-close", closedAt);

    const result = repo.getTakeoverSession("takeover-close");
    assert.ok(result);
    assert.equal(result?.status, "closed");
    assert.equal(result?.closedAt, closedAt);
  } finally {
    cleanupPath(workspace);
  }
});

test("ApprovalRepository insertOperatorAction and listOperatorActionsByTask work", () => {
  const workspace = createTempWorkspace("aa-approval-repo-");
  const dbPath = join(workspace, "approval-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ApprovalRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    createTestTask(db, "task-operator-action", now);

    repo.insertTakeoverSession({
      id: "takeover-op-001",
      taskId: "task-operator-action",
      executionId: null,
      operatorId: "operator-op",
      status: "open",
      reasonCode: "test",
      startedAt: now,
      closedAt: null,
    });

    const action: OperatorActionRecord = {
      id: "operator-action-001",
      takeoverSessionId: "takeover-op-001",
      taskId: "task-operator-action",
      executionId: null,
      operatorId: "operator-op",
      actionType: "retry_execution",
      reasonCode: "user_request",
      actionPayloadJson: '{"retry":true}',
      beforeStateJson: '{"status":"failed"}',
      afterStateJson: '{"status":"pending"}',
      createdAt: now,
    };

    repo.insertOperatorAction(action);

    const results = repo.listOperatorActionsByTask("task-operator-action");
    assert.equal(results.length, 1, "should return 1 operator action");
    assert.equal(results[0]?.id, "operator-action-001");
    assert.equal(results[0]?.actionType, "retry_execution");
    assert.equal(results[0]?.operatorId, "operator-op");
  } finally {
    cleanupPath(workspace);
  }
});

test("ApprovalRepository column mapping snake_case to camelCase is correct", () => {
  const workspace = createTempWorkspace("aa-approval-repo-");
  const dbPath = join(workspace, "approval-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ApprovalRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    createTestExecution(db, "exec-approval-cols", "task-approval-cols", now);

    repo.insertApproval({
      id: "approval-cols-001",
      taskId: "task-approval-cols",
      executionId: "exec-approval-cols",
      status: "requested",
      requestJson: '{"key":"value"}',
      responseJson: '{"result":"ok"}',
      timeoutPolicy: "10m",
      createdAt: now,
      respondedAt: now,
    });

    const result = repo.getApproval("approval-cols-001");
    assert.ok(result);
    assert.equal(result.taskId, "task-approval-cols");
    assert.equal(result.executionId, "exec-approval-cols");
    assert.equal(result.requestJson, '{"key":"value"}');
    assert.equal(result.responseJson, '{"result":"ok"}');
    assert.equal(result.timeoutPolicy, "10m");
    assert.equal(result.respondedAt, now);
  } finally {
    cleanupPath(workspace);
  }
});

test("ApprovalRepository insertApproval violates primary key constraint throws error", () => {
  const workspace = createTempWorkspace("aa-approval-repo-");
  const dbPath = join(workspace, "approval-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ApprovalRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    createTestTask(db, "task-approval-dup", now);

    repo.insertApproval({
      id: "approval-duplicate",
      taskId: "task-approval-dup",
      executionId: null,
      status: "requested",
      requestJson: "{}",
      responseJson: null,
      timeoutPolicy: "5m",
      createdAt: now,
      respondedAt: null,
    });

    assert.throws(() => {
      repo.insertApproval({
        id: "approval-duplicate",
        taskId: "task-approval-dup",
        executionId: null,
        status: "approved",
        requestJson: "{}",
        responseJson: '{"approved":true}',
        timeoutPolicy: "5m",
        createdAt: now,
        respondedAt: now,
      });
    }, /UNIQUE.*approval-duplicate|UNIQUE constraint failed/i);
  } finally {
    cleanupPath(workspace);
  }
});

test("ApprovalRepository rejects insertion with non-existent task_id FK", () => {
  const workspace = createTempWorkspace("aa-approval-repo-");
  const dbPath = join(workspace, "approval-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ApprovalRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";

    // Attempt to insert approval with non-existent task_id
    assert.throws(
      () => {
        repo.insertApproval({
          id: "approval-fk-task-001",
          taskId: "nonexistent-task-id",
          executionId: null,
          status: "requested",
          requestJson: "{}",
          responseJson: null,
          timeoutPolicy: "5m",
          createdAt: now,
          respondedAt: null,
        });
      },
      (error: unknown) => {
        // SQLite FK constraint violation throws with FOREIGN KEY constraint error
        const message = error instanceof Error ? error.message : String(error);
        return message.includes("FOREIGN KEY") || message.includes("constraint");
      },
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("ApprovalRepository rejects insertion with non-null non-existent execution_id FK", () => {
  const workspace = createTempWorkspace("aa-approval-repo-");
  const dbPath = join(workspace, "approval-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ApprovalRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    createTestTask(db, "task-with-approval", now);

    // Attempt to insert approval with non-null but non-existent execution_id
    assert.throws(
      () => {
        repo.insertApproval({
          id: "approval-fk-exec-001",
          taskId: "task-with-approval",
          executionId: "nonexistent-execution-id",
          status: "requested",
          requestJson: "{}",
          responseJson: null,
          timeoutPolicy: "5m",
          createdAt: now,
          respondedAt: null,
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
