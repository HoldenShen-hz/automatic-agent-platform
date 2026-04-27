import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { ApprovalRepository } from "../../../../../../../src/platform/state-evidence/truth/sqlite/repositories/approval-repository.js";
import { TaskRepository } from "../../../../../../../src/platform/state-evidence/truth/sqlite/repositories/task-repository.js";
import { ExecutionRepository } from "../../../../../../../src/platform/state-evidence/truth/sqlite/repositories/execution-repository.js";
import { SqliteDatabase } from "../../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../../helpers/fs.js";
import type { ApprovalRecord, TakeoverSessionRecord, OperatorActionRecord } from "../../../../../../../src/platform/contracts/types/domain.js";

function createTestTask(
  db: SqliteDatabase,
  taskId: string,
  tenantId: string | null = null,
  now = "2026-04-14T10:00:00.000Z",
): void {
  const taskRepo = new TaskRepository(db.connection);
  taskRepo.insertTask({
    id: taskId,
    parentId: null,
    rootId: taskId,
    divisionId: "general_ops",
    tenantId,
    title: "Test approval task",
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

function createTestExecution(
  db: SqliteDatabase,
  execId: string,
  taskId: string,
  now = "2026-04-14T10:00:00.000Z",
): void {
  const execRepo = new ExecutionRepository(db.connection);
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
  const dbPath = join(workspace, "approval.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ApprovalRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";

    createTestTask(db, "task-approval-1", null, now);
    createTestExecution(db, "exec-approval-1", "task-approval-1", now);

    const approval: ApprovalRecord = {
      id: "approval-1",
      taskId: "task-approval-1",
      executionId: "exec-approval-1",
      status: "requested",
      requestJson: '{"reason":"high cost"}',
      responseJson: null,
      timeoutPolicy: '{"timeout":3600}',
      createdAt: now,
      respondedAt: null,
    };

    repo.insertApproval(approval);

    const result = repo.getApproval("approval-1");
    assert.ok(result);
    assert.equal(result.id, "approval-1");
    assert.equal(result.status, "requested");
    assert.equal(result.requestJson, '{"reason":"high cost"}');
  } finally {
    cleanupPath(workspace);
  }
});

test("ApprovalRepository getApproval returns null for non-existent", () => {
  const workspace = createTempWorkspace("aa-approval-repo-");
  const dbPath = join(workspace, "approval.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ApprovalRepository(db.connection);

    const result = repo.getApproval("nonexistent");
    assert.strictEqual(result, null);
  } finally {
    cleanupPath(workspace);
  }
});

test("ApprovalRepository listApprovalsByTask returns approvals for task", () => {
  const workspace = createTempWorkspace("aa-approval-repo-");
  const dbPath = join(workspace, "approval.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ApprovalRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";

    // Create two different tasks for the executions
    createTestTask(db, "task-list-approval-1", null, now);
    createTestTask(db, "task-list-approval-2", null, now);
    createTestExecution(db, "exec-list-1", "task-list-approval-1", now);
    createTestExecution(db, "exec-list-2", "task-list-approval-2", now);

    repo.insertApproval({
      id: "approval-list-1",
      taskId: "task-list-approval-1",
      executionId: "exec-list-1",
      status: "requested",
      requestJson: "{}",
      responseJson: null,
      timeoutPolicy: "{}",
      createdAt: now,
      respondedAt: null,
    });

    repo.insertApproval({
      id: "approval-list-2",
      taskId: "task-list-approval-1",
      executionId: "exec-list-2",
      status: "approved",
      requestJson: "{}",
      responseJson: '{"approved":true}',
      timeoutPolicy: "{}",
      createdAt: now,
      respondedAt: now,
    });

    const results = repo.listApprovalsByTask("task-list-approval-1");
    assert.equal(results.length, 2);
  } finally {
    cleanupPath(workspace);
  }
});

test("ApprovalRepository updateApprovalDecision updates approval", () => {
  const workspace = createTempWorkspace("aa-approval-repo-");
  const dbPath = join(workspace, "approval.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ApprovalRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";
    const respondedAt = "2026-04-14T10:30:00.000Z";

    createTestTask(db, "task-decision-1", null, now);
    createTestExecution(db, "exec-decision-1", "task-decision-1", now);

    repo.insertApproval({
      id: "approval-decision-1",
      taskId: "task-decision-1",
      executionId: "exec-decision-1",
      status: "requested",
      requestJson: "{}",
      responseJson: null,
      timeoutPolicy: "{}",
      createdAt: now,
      respondedAt: null,
    });

    repo.updateApprovalDecision({
      approvalId: "approval-decision-1",
      status: "approved",
      responseJson: '{"approved":true,"approver":"admin"}',
      respondedAt,
    });

    const result = repo.getApproval("approval-decision-1");
    assert.ok(result);
    assert.equal(result.status, "approved");
    assert.equal(result.respondedAt, respondedAt);
  } finally {
    cleanupPath(workspace);
  }
});

test("ApprovalRepository updateApprovalDecisionCas returns 1 on success", () => {
  const workspace = createTempWorkspace("aa-approval-repo-");
  const dbPath = join(workspace, "approval.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ApprovalRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";
    const respondedAt = "2026-04-14T10:30:00.000Z";

    createTestTask(db, "task-cas-1", null, now);
    createTestExecution(db, "exec-cas-1", "task-cas-1", now);

    repo.insertApproval({
      id: "approval-cas-1",
      taskId: "task-cas-1",
      executionId: "exec-cas-1",
      status: "requested",
      requestJson: "{}",
      responseJson: null,
      timeoutPolicy: "{}",
      createdAt: now,
      respondedAt: null,
    });

    const updated = repo.updateApprovalDecisionCas({
      approvalId: "approval-cas-1",
      expectedStatus: "requested",
      status: "approved",
      responseJson: '{"approved":true}',
      respondedAt,
    });

    assert.equal(updated, 1);
  } finally {
    cleanupPath(workspace);
  }
});

test("ApprovalRepository updateApprovalDecisionCas returns 0 on CAS failure", () => {
  const workspace = createTempWorkspace("aa-approval-repo-");
  const dbPath = join(workspace, "approval.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ApprovalRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";
    const respondedAt = "2026-04-14T10:30:00.000Z";

    createTestTask(db, "task-cas-fail-1", null, now);
    createTestExecution(db, "exec-cas-fail-1", "task-cas-fail-1", now);

    repo.insertApproval({
      id: "approval-cas-fail-1",
      taskId: "task-cas-fail-1",
      executionId: "exec-cas-fail-1",
      status: "requested",
      requestJson: "{}",
      responseJson: null,
      timeoutPolicy: "{}",
      createdAt: now,
      respondedAt: null,
    });

    // Try to update with wrong expected status
    const updated = repo.updateApprovalDecisionCas({
      approvalId: "approval-cas-fail-1",
      expectedStatus: "approved", // wrong status
      status: "approved",
      responseJson: '{"approved":true}',
      respondedAt,
    });

    assert.equal(updated, 0);

    // Status should remain unchanged
    const result = repo.getApproval("approval-cas-fail-1");
    assert.ok(result);
    assert.equal(result.status, "requested");
  } finally {
    cleanupPath(workspace);
  }
});

test("ApprovalRepository listApprovalsByStatus filters correctly", () => {
  const workspace = createTempWorkspace("aa-approval-repo-");
  const dbPath = join(workspace, "approval.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ApprovalRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";

    // Create two different tasks for the executions
    createTestTask(db, "task-status-filter-1", null, now);
    createTestTask(db, "task-status-filter-2", null, now);
    createTestExecution(db, "exec-status-1", "task-status-filter-1", now);
    createTestExecution(db, "exec-status-2", "task-status-filter-2", now);

    repo.insertApproval({
      id: "approval-status-1",
      taskId: "task-status-filter-1",
      executionId: "exec-status-1",
      status: "requested",
      requestJson: "{}",
      responseJson: null,
      timeoutPolicy: "{}",
      createdAt: now,
      respondedAt: null,
    });

    repo.insertApproval({
      id: "approval-status-2",
      taskId: "task-status-filter-2",
      executionId: "exec-status-2",
      status: "approved",
      requestJson: "{}",
      responseJson: "{}",
      timeoutPolicy: "{}",
      createdAt: now,
      respondedAt: now,
    });

    const requested = repo.listApprovalsByStatus("requested");
    assert.equal(requested.length, 1);
    assert.equal(requested[0].id, "approval-status-1");

    const approved = repo.listApprovalsByStatus("approved");
    assert.equal(approved.length, 1);
    assert.equal(approved[0].id, "approval-status-2");
  } finally {
    cleanupPath(workspace);
  }
});

test("ApprovalRepository insertTakeoverSession and getTakeoverSession work", () => {
  const workspace = createTempWorkspace("aa-approval-repo-");
  const dbPath = join(workspace, "approval.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ApprovalRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";

    createTestTask(db, "task-takeover-1", null, now);
    createTestExecution(db, "exec-takeover-1", "task-takeover-1", now);

    const session: TakeoverSessionRecord = {
      id: "takeover-1",
      taskId: "task-takeover-1",
      executionId: "exec-takeover-1",
      operatorId: "operator-1",
      status: "open",
      reasonCode: "escalation",
      startedAt: now,
      closedAt: null,
    };

    repo.insertTakeoverSession(session);

    const result = repo.getTakeoverSession("takeover-1");
    assert.ok(result);
    assert.equal(result.id, "takeover-1");
    assert.equal(result.operatorId, "operator-1");
    assert.equal(result.status, "open");
  } finally {
    cleanupPath(workspace);
  }
});

test("ApprovalRepository closeTakeoverSession updates status", () => {
  const workspace = createTempWorkspace("aa-approval-repo-");
  const dbPath = join(workspace, "approval.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ApprovalRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";
    const closedAt = "2026-04-14T11:00:00.000Z";

    createTestTask(db, "task-close-takeover-1", null, now);
    createTestExecution(db, "exec-close-takeover-1", "task-close-takeover-1", now);

    repo.insertTakeoverSession({
      id: "takeover-close-1",
      taskId: "task-close-takeover-1",
      executionId: "exec-close-takeover-1",
      operatorId: "operator-1",
      status: "open",
      reasonCode: "escalation",
      startedAt: now,
      closedAt: null,
    });

    repo.closeTakeoverSession("takeover-close-1", closedAt);

    const result = repo.getTakeoverSession("takeover-close-1");
    assert.ok(result);
    assert.equal(result.status, "closed");
    assert.equal(result.closedAt, closedAt);
  } finally {
    cleanupPath(workspace);
  }
});

test("ApprovalRepository listOperatorActionsByTask returns actions", () => {
  const workspace = createTempWorkspace("aa-approval-repo-");
  const dbPath = join(workspace, "approval.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ApprovalRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";

    createTestTask(db, "task-operator-action-1", null, now);
    createTestExecution(db, "exec-operator-action-1", "task-operator-action-1", now);

    repo.insertTakeoverSession({
      id: "takeover-action-1",
      taskId: "task-operator-action-1",
      executionId: "exec-operator-action-1",
      operatorId: "operator-1",
      status: "open",
      reasonCode: "escalation",
      startedAt: now,
      closedAt: null,
    });

    repo.insertOperatorAction({
      id: "operator-action-1",
      takeoverSessionId: "takeover-action-1",
      taskId: "task-operator-action-1",
      executionId: "exec-operator-action-1",
      operatorId: "operator-1",
      actionType: "approve",
      reasonCode: "approved",
      actionPayloadJson: '{"approved":true}',
      beforeStateJson: '{"status":"blocked"}',
      afterStateJson: '{"status":"running"}',
      createdAt: now,
    });

    const results = repo.listOperatorActionsByTask("task-operator-action-1");
    assert.equal(results.length, 1);
    assert.equal(results[0].actionType, "approve");
  } finally {
    cleanupPath(workspace);
  }
});
