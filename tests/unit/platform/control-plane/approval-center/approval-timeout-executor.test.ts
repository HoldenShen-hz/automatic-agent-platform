import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { ApprovalTimeoutExecutor, type ApprovalTimeoutExecutorOptions } from "../../../../../src/platform/five-plane-control-plane/approval-center/approval-timeout-executor.js";
import { ApprovalService } from "../../../../../src/platform/five-plane-control-plane/approval-center/approval-service.js";
import { ApprovalRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/approval-repository.js";
import { TaskRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/task-repository.js";
import { ExecutionRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/execution-repository.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

function createTestHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "approval-timeout-test.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return { workspace, db, store };
}

function createTestTask(store: AuthoritativeTaskStore, taskId: string, now: string): void {
  store.insertTask({
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

function createTestExecution(store: AuthoritativeTaskStore, execId: string, taskId: string, now: string): void {
  createTestTask(store, taskId, now);
  store.insertExecution({
    id: execId,
    taskId,
    workflowId: "single_agent_minimal",
    parentExecutionId: null,
    harnessRunId: null,
    agentId: "agent-1",
    roleId: "general_executor",
    runKind: "task_run",
    status: "executing",
    inputRef: null,
    traceId: `trace-${execId}`,
    attempt: 1,
    timeoutMs: 60000,
    budgetUsdLimit: 1.0,
    budgetReservationId: null,
    budgetLedgerId: null,
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

test("ApprovalTimeoutExecutor processes empty pending approvals", () => {
  const harness = createTestHarness("aa-timeout-empty-");
  try {
    const approvalRepo = new ApprovalRepository(harness.db.connection);
    const approvalService = new ApprovalService(harness.db, harness.store);
    const executor = new ApprovalTimeoutExecutor(approvalService, harness.store, approvalRepo);

    const result = executor.sweep();

    assert.equal(result.processed, 0, "Should process 0 approvals");
    assert.equal(result.rejected, 0, "Should reject 0");
    assert.equal(result.approved, 0, "Should approve 0");
    assert.equal(result.skipped, 0, "Should skip 0");
    assert.equal(result.errors, 0, "Should have 0 errors");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("ApprovalTimeoutExecutor skips non-expired approvals", () => {
  const harness = createTestHarness("aa-timeout-not-expired-");
  try {
    const approvalRepo = new ApprovalRepository(harness.db.connection);

    // Use a recent timestamp (500ms ago) so it won't be expired with 1s timeout
    const recentTime = new Date(Date.now() - 500).toISOString();
    createTestExecution(harness.store, "exec-timeout-test", "task-timeout-test", recentTime);

    // Insert a non-expired approval (created 500ms ago, with reject policy)
    approvalRepo.insertApproval({
      id: "approval-not-expired",
      taskId: "task-timeout-test",
      executionId: null,
      status: "requested",
      requestJson: '{"reason":"test"}',
      responseJson: null,
      timeoutPolicy: "reject",
      createdAt: recentTime,
      respondedAt: null,
    });

    const approvalService = new ApprovalService(harness.db, harness.store);
    const executor = new ApprovalTimeoutExecutor(approvalService, harness.store, approvalRepo, {
      defaultTimeoutMs: 1000, // 1 second - approval created 500ms ago should not be expired
    });

    const result = executor.sweep();

    // The approval should be skipped since it's not expired
    assert.equal(result.processed, 1, "Should process 1 approval");
    assert.equal(result.rejected, 0, "Should reject 0");
    assert.equal(result.skipped, 1, "Should skip 1 non-expired approval");
    assert.equal(result.errors, 0, "Should have 0 errors");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("ApprovalTimeoutExecutor rejects expired approval with reject policy", () => {
  const harness = createTestHarness("aa-timeout-reject-");
  try {
    const approvalRepo = new ApprovalRepository(harness.db.connection);
    const now = "2026-04-14T10:00:00.000Z";

    createTestExecution(harness.store, "exec-reject-test", "task-reject-test", now);

    // Insert an expired approval with reject policy (created 48 hours ago)
    const expiredTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    approvalRepo.insertApproval({
      id: "approval-expired-reject",
      taskId: "task-reject-test",
      executionId: null,
      status: "requested",
      requestJson: '{"reason":"test"}',
      responseJson: null,
      timeoutPolicy: "reject",
      createdAt: expiredTime,
      respondedAt: null,
    });

    const approvalService = new ApprovalService(harness.db, harness.store);
    const executor = new ApprovalTimeoutExecutor(approvalService, harness.store, approvalRepo, {
      defaultTimeoutMs: 1000, // 1 second
    });

    const result = executor.sweep();

    assert.equal(result.processed, 1, "Should process 1 approval");
    assert.equal(result.rejected, 1, "Should reject 1 expired approval");
    assert.equal(result.skipped, 0, "Should skip 0");
    assert.equal(result.errors, 0, "Should have 0 errors");

    // Verify the approval was actually updated
    const updated = approvalRepo.getApproval("approval-expired-reject");
    assert.ok(updated, "Approval should still exist");
    assert.equal(updated.status, "expired", "Status should be expired");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("ApprovalTimeoutExecutor approves expired approval with approve policy", () => {
  const harness = createTestHarness("aa-timeout-approve-");
  try {
    const approvalRepo = new ApprovalRepository(harness.db.connection);
    const now = "2026-04-14T10:00:00.000Z";

    createTestExecution(harness.store, "exec-approve-test", "task-approve-test", now);

    // Insert an expired approval with approve policy (created 48 hours ago)
    const expiredTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    approvalRepo.insertApproval({
      id: "approval-expired-approve",
      taskId: "task-approve-test",
      executionId: null,
      status: "requested",
      requestJson: '{"reason":"test"}',
      responseJson: null,
      timeoutPolicy: "approve",
      createdAt: expiredTime,
      respondedAt: null,
    });

    const approvalService = new ApprovalService(harness.db, harness.store);
    const executor = new ApprovalTimeoutExecutor(approvalService, harness.store, approvalRepo, {
      defaultTimeoutMs: 1000, // 1 second
    });

    const result = executor.sweep();

    assert.equal(result.processed, 1, "Should process 1 approval");
    assert.equal(result.approved, 1, "Should approve 1 expired approval");
    assert.equal(result.skipped, 0, "Should skip 0");
    assert.equal(result.errors, 0, "Should have 0 errors");

    // Verify the approval was actually updated
    const updated = approvalRepo.getApproval("approval-expired-approve");
    assert.ok(updated, "Approval should still exist");
    assert.equal(updated.status, "approved", "Status should be approved");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("ApprovalTimeoutExecutor skips expired approval with remain_pending policy", () => {
  const harness = createTestHarness("aa-timeout-remain-");
  try {
    const approvalRepo = new ApprovalRepository(harness.db.connection);
    const now = "2026-04-14T10:00:00.000Z";

    createTestExecution(harness.store, "exec-remain-test", "task-remain-test", now);

    // Insert an expired approval with remain_pending policy (created 48 hours ago)
    const expiredTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    approvalRepo.insertApproval({
      id: "approval-expired-remain",
      taskId: "task-remain-test",
      executionId: null,
      status: "requested",
      requestJson: '{"reason":"test"}',
      responseJson: null,
      timeoutPolicy: "remain_pending",
      createdAt: expiredTime,
      respondedAt: null,
    });

    const approvalService = new ApprovalService(harness.db, harness.store);
    const executor = new ApprovalTimeoutExecutor(approvalService, harness.store, approvalRepo, {
      defaultTimeoutMs: 1000, // 1 second
    });

    const result = executor.sweep();

    // remain_pending should be skipped even when expired
    assert.equal(result.processed, 1, "Should process 1 approval");
    assert.equal(result.skipped, 1, "Should skip 1 remain_pending approval");
    assert.equal(result.errors, 0, "Should have 0 errors");

    // Verify the approval was NOT updated
    const updated = approvalRepo.getApproval("approval-expired-remain");
    assert.ok(updated, "Approval should still exist");
    assert.equal(updated.status, "requested", "Status should still be requested");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("ApprovalTimeoutExecutor isExpired returns correct values", () => {
  const harness = createTestHarness("aa-timeout-isexpired-");
  try {
    const approvalRepo = new ApprovalRepository(harness.db.connection);
    const now = "2026-04-14T10:00:00.000Z";

    createTestExecution(harness.store, "exec-expired-test", "task-expired-test", now);

    const approvalService = new ApprovalService(harness.db, harness.store);
    const executor = new ApprovalTimeoutExecutor(approvalService, harness.store, approvalRepo, {
      defaultTimeoutMs: 1000, // 1 second
    });

    // Recent approval - should not be expired
    const recentTime = new Date(Date.now() - 500).toISOString(); // 500ms ago
    approvalRepo.insertApproval({
      id: "approval-recent",
      taskId: "task-expired-test",
      executionId: null,
      status: "requested",
      requestJson: "{}",
      responseJson: null,
      timeoutPolicy: "reject",
      createdAt: recentTime,
      respondedAt: null,
    });

    const recentApproval = approvalRepo.getApproval("approval-recent");
    assert.ok(recentApproval, "Recent approval should exist");
    const currentTime = new Date().toISOString();
    assert.equal(executor.isExpired(recentApproval, currentTime), false, "Recent approval should not be expired");

    // Old approval - should be expired
    const oldTime = new Date(Date.now() - 5000).toISOString(); // 5 seconds ago
    approvalRepo.insertApproval({
      id: "approval-old",
      taskId: "task-expired-test",
      executionId: null,
      status: "requested",
      requestJson: "{}",
      responseJson: null,
      timeoutPolicy: "reject",
      createdAt: oldTime,
      respondedAt: null,
    });

    const oldApproval = approvalRepo.getApproval("approval-old");
    assert.ok(oldApproval, "Old approval should exist");
    assert.equal(executor.isExpired(oldApproval, currentTime), true, "Old approval should be expired");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("ApprovalTimeoutExecutor handles mixed approvals correctly", () => {
  const harness = createTestHarness("aa-timeout-mixed-");
  try {
    const approvalRepo = new ApprovalRepository(harness.db.connection);
    const now = "2026-04-14T10:00:00.000Z";

    createTestExecution(harness.store, "exec-mixed-test", "task-mixed-test", now);

    // Add multiple approvals with different statuses and policies
    const recentTime = new Date(Date.now() - 500).toISOString(); // Recent - not expired
    const expiredTime = new Date(Date.now() - 5000).toISOString(); // Expired

    // 1. Non-expired with reject policy
    approvalRepo.insertApproval({
      id: "approval-mixed-1",
      taskId: "task-mixed-test",
      executionId: null,
      status: "requested",
      requestJson: "{}",
      responseJson: null,
      timeoutPolicy: "reject",
      createdAt: recentTime,
      respondedAt: null,
    });

    // 2. Expired with reject policy
    approvalRepo.insertApproval({
      id: "approval-mixed-2",
      taskId: "task-mixed-test",
      executionId: null,
      status: "requested",
      requestJson: "{}",
      responseJson: null,
      timeoutPolicy: "reject",
      createdAt: expiredTime,
      respondedAt: null,
    });

    // 3. Expired with approve policy
    approvalRepo.insertApproval({
      id: "approval-mixed-3",
      taskId: "task-mixed-test",
      executionId: null,
      status: "requested",
      requestJson: "{}",
      responseJson: null,
      timeoutPolicy: "approve",
      createdAt: expiredTime,
      respondedAt: null,
    });

    // 4. Expired with remain_pending policy
    approvalRepo.insertApproval({
      id: "approval-mixed-4",
      taskId: "task-mixed-test",
      executionId: null,
      status: "requested",
      requestJson: "{}",
      responseJson: null,
      timeoutPolicy: "remain_pending",
      createdAt: expiredTime,
      respondedAt: null,
    });

    const approvalService = new ApprovalService(harness.db, harness.store);
    const executor = new ApprovalTimeoutExecutor(approvalService, harness.store, approvalRepo, {
      defaultTimeoutMs: 1000, // 1 second
    });

    const result = executor.sweep();

    // mixed-1: skipped (not expired)
    // mixed-2: rejected (expired + reject)
    // mixed-3: approved (expired + approve)
    // mixed-4: skipped (expired + remain_pending)
    assert.equal(result.processed, 4, "Should process 4 approvals");
    assert.equal(result.rejected, 1, "Should reject 1");
    assert.equal(result.approved, 1, "Should approve 1");
    assert.equal(result.skipped, 2, "Should skip 2");
    assert.equal(result.errors, 0, "Should have 0 errors");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});
