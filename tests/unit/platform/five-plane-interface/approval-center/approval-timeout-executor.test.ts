import assert from "node:assert/strict";
import test from "node:test";

import { ApprovalTimeoutExecutor } from "../../../../../src/platform/five-plane-control-plane/approval-center/approval-timeout-executor.js";
import { ApprovalService } from "../../../../../src/platform/five-plane-control-plane/approval-center/approval-service.js";
import { ApprovalRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/approval-repository.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import type { ApprovalRecord } from "../../../../../src/platform/contracts/types/domain.js";
import { join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";

// ---------------------------------------------------------------------------
// Test harness helpers
// ---------------------------------------------------------------------------

function createTestHarness(prefix: string) {
  const tmpDir = join("/tmp", `${prefix}-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  const dbPath = join(tmpDir, "test.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return { tmpDir, db, store };
}

function cleanupHarness(harness: { tmpDir: string; db: SqliteDatabase }) {
  harness.db.close();
  rmSync(harness.tmpDir, { recursive: true, force: true });
}

function createTestTask(store: AuthoritativeTaskStore, taskId: string, now: string): void {
  store.insertTask({
    id: taskId,
    parentId: null,
    rootId: taskId,
    divisionId: "general-ops",
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

// ---------------------------------------------------------------------------
// Tests: R9-18 timeout enforcement - sweep()
// ---------------------------------------------------------------------------

test("sweep returns zero counts when no approvals exist", () => {
  const harness = createTestHarness("aa-sweep-empty");
  try {
    const approvalRepo = new ApprovalRepository(harness.db.connection);
    const approvalService = new ApprovalService(harness.db, harness.store);
    const executor = new ApprovalTimeoutExecutor(approvalService, harness.store, approvalRepo);

    const result = executor.sweep();

    assert.equal(result.processed, 0);
    assert.equal(result.rejected, 0);
    assert.equal(result.approved, 0);
    assert.equal(result.skipped, 0);
    assert.equal(result.errors, 0);
  } finally {
    cleanupHarness(harness);
  }
});

test("sweep skips approvals where deadline not exceeded", () => {
  const harness = createTestHarness("aa-sweep-not-expired");
  try {
    const approvalRepo = new ApprovalRepository(harness.db.connection);
    const recentTime = new Date(Date.now() - 500).toISOString();
    createTestTask(harness.store, "task-not-expired", recentTime);

    // Insert a non-expired approval (created 500ms ago, with 1s timeout)
    approvalRepo.insertApproval({
      id: "approval-not-expired",
      taskId: "task-not-expired",
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
      defaultTimeoutMs: 1000, // 1 second
    });

    const result = executor.sweep();

    assert.equal(result.processed, 1);
    assert.equal(result.rejected, 0);
    assert.equal(result.approved, 0);
    assert.equal(result.skipped, 1);
    assert.equal(result.errors, 0);
  } finally {
    cleanupHarness(harness);
  }
});

test("sweep applies expired decision to timed-out approvals with timeoutPolicy=reject", () => {
  const harness = createTestHarness("aa-sweep-reject");
  try {
    const approvalRepo = new ApprovalRepository(harness.db.connection);
    const now = new Date().toISOString();
    createTestTask(harness.store, "task-reject", now);

    // Insert an expired approval with reject policy (created 48 hours ago)
    const expiredTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    approvalRepo.insertApproval({
      id: "approval-expired-reject",
      taskId: "task-reject",
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

    assert.equal(result.processed, 1);
    assert.equal(result.rejected, 1, "expired reject policy should result in rejected count");
    assert.equal(result.skipped, 0);

    // Verify the approval was actually updated
    const updated = approvalRepo.getApproval("approval-expired-reject");
    assert.ok(updated, "Approval should still exist");
    assert.equal(updated.status, "expired", "Status should be expired");
  } finally {
    cleanupHarness(harness);
  }
});

test("sweep applies confirmed decision to timed-out approvals with timeoutPolicy=approve", () => {
  const harness = createTestHarness("aa-sweep-approve");
  try {
    const approvalRepo = new ApprovalRepository(harness.db.connection);
    const now = new Date().toISOString();
    createTestTask(harness.store, "task-approve", now);

    // Insert an expired approval with approve policy (created 48 hours ago)
    const expiredTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    approvalRepo.insertApproval({
      id: "approval-expired-approve",
      taskId: "task-approve",
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

    assert.equal(result.processed, 1);
    assert.equal(result.approved, 1, "expired approve policy should result in approved count");
    assert.equal(result.rejected, 0);

    // Verify the approval was actually updated
    const updated = approvalRepo.getApproval("approval-expired-approve");
    assert.ok(updated, "Approval should still exist");
    assert.equal(updated.status, "approved", "Status should be approved");
  } finally {
    cleanupHarness(harness);
  }
});

test("sweep skips approvals with timeoutPolicy=remain_pending regardless of expiration", () => {
  const harness = createTestHarness("aa-sweep-remain");
  try {
    const approvalRepo = new ApprovalRepository(harness.db.connection);
    const now = new Date().toISOString();
    createTestTask(harness.store, "task-remain", now);

    // Insert an expired approval with remain_pending policy (created 48 hours ago)
    const expiredTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    approvalRepo.insertApproval({
      id: "approval-expired-remain",
      taskId: "task-remain",
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

    assert.equal(result.processed, 1);
    assert.equal(result.skipped, 1, "remain_pending policy should be skipped");
    assert.equal(result.rejected, 0);
    assert.equal(result.approved, 0);

    // Verify the approval was NOT updated
    const updated = approvalRepo.getApproval("approval-expired-remain");
    assert.ok(updated, "Approval should still exist");
    assert.equal(updated.status, "requested", "Status should still be requested");
  } finally {
    cleanupHarness(harness);
  }
});

test("sweep returns correct counts with mixed approvals", () => {
  const harness = createTestHarness("aa-sweep-mixed");
  try {
    const approvalRepo = new ApprovalRepository(harness.db.connection);
    const now = new Date().toISOString();
    createTestTask(harness.store, "task-mixed", now);

    const recentTime = new Date(Date.now() - 500).toISOString(); // Recent - not expired
    const expiredTime = new Date(Date.now() - 5000).toISOString(); // Expired

    // 1. Non-expired with reject policy
    approvalRepo.insertApproval({
      id: "mixed-1",
      taskId: "task-mixed",
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
      id: "mixed-2",
      taskId: "task-mixed",
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
      id: "mixed-3",
      taskId: "task-mixed",
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
      id: "mixed-4",
      taskId: "task-mixed",
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
    assert.equal(result.processed, 4);
    assert.equal(result.rejected, 1);
    assert.equal(result.approved, 1);
    assert.equal(result.skipped, 2);
    assert.equal(result.errors, 0);
  } finally {
    cleanupHarness(harness);
  }
});

test("sweep returns accurate rejected and approved counts", () => {
  const harness = createTestHarness("aa-sweep-counts");
  try {
    const approvalRepo = new ApprovalRepository(harness.db.connection);
    const now = new Date().toISOString();
    createTestTask(harness.store, "task-counts", now);

    const expiredTime = new Date(Date.now() - 5000).toISOString();

    // 2 expired with reject
    approvalRepo.insertApproval({
      id: "counts-reject-1",
      taskId: "task-counts",
      executionId: null,
      status: "requested",
      requestJson: "{}",
      responseJson: null,
      timeoutPolicy: "reject",
      createdAt: expiredTime,
      respondedAt: null,
    });

    approvalRepo.insertApproval({
      id: "counts-reject-2",
      taskId: "task-counts",
      executionId: null,
      status: "requested",
      requestJson: "{}",
      responseJson: null,
      timeoutPolicy: "reject",
      createdAt: expiredTime,
      respondedAt: null,
    });

    // 3 expired with approve
    approvalRepo.insertApproval({
      id: "counts-approve-1",
      taskId: "task-counts",
      executionId: null,
      status: "requested",
      requestJson: "{}",
      responseJson: null,
      timeoutPolicy: "approve",
      createdAt: expiredTime,
      respondedAt: null,
    });

    approvalRepo.insertApproval({
      id: "counts-approve-2",
      taskId: "task-counts",
      executionId: null,
      status: "requested",
      requestJson: "{}",
      responseJson: null,
      timeoutPolicy: "approve",
      createdAt: expiredTime,
      respondedAt: null,
    });

    approvalRepo.insertApproval({
      id: "counts-approve-3",
      taskId: "task-counts",
      executionId: null,
      status: "requested",
      requestJson: "{}",
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

    assert.equal(result.rejected, 2);
    assert.equal(result.approved, 3);
    assert.equal(result.processed, 5);
  } finally {
    cleanupHarness(harness);
  }
});

// ---------------------------------------------------------------------------
// Tests: isExpired()
// ---------------------------------------------------------------------------

test("isExpired returns false when approval has responded", () => {
  const harness = createTestHarness("aa-isexpired-responded");
  try {
    const approvalRepo = new ApprovalRepository(harness.db.connection);
    const now = new Date().toISOString();
    createTestTask(harness.store, "task-responded", now);

    approvalRepo.insertApproval({
      id: "approval-responded",
      taskId: "task-responded",
      executionId: null,
      status: "approved",
      requestJson: "{}",
      responseJson: '{"decisionType":"confirmed"}',
      timeoutPolicy: "reject",
      createdAt: new Date(Date.now() - 5000).toISOString(),
      respondedAt: new Date().toISOString(),
    });

    const approvalService = new ApprovalService(harness.db, harness.store);
    const executor = new ApprovalTimeoutExecutor(approvalService, harness.store, approvalRepo, {
      defaultTimeoutMs: 1000,
    });

    const approval = approvalRepo.getApproval("approval-responded");
    assert.ok(approval);
    const result = executor.isExpired(approval, new Date().toISOString());
    assert.equal(result, false, "responded approval should not be considered expired");
  } finally {
    cleanupHarness(harness);
  }
});

test("isExpired uses timeoutAt column when available and not expired", () => {
  const harness = createTestHarness("aa-isexpired-timeout-at-future");
  try {
    const approvalRepo = new ApprovalRepository(harness.db.connection);
    const now = new Date().toISOString();
    createTestTask(harness.store, "task-timeout-at", now);

    const futureTimeout = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h in future
    approvalRepo.insertApproval({
      id: "approval-timeout-at-future",
      taskId: "task-timeout-at",
      executionId: null,
      status: "requested",
      requestJson: '{"timeoutAt":"' + futureTimeout + '"}',
      responseJson: null,
      timeoutPolicy: "reject",
      createdAt: now,
      respondedAt: null,
    });

    const approvalService = new ApprovalService(harness.db, harness.store);
    const executor = new ApprovalTimeoutExecutor(approvalService, harness.store, approvalRepo);

    // Use getApproval which includes timeoutAt
    const approval = approvalRepo.getApproval("approval-timeout-at-future");
    assert.ok(approval);

    // The approval has timeoutAt in requestJson, but the repo doesn't parse it into timeoutAt field
    // This test verifies the isExpired logic with direct call
    const result = executor.isExpired(
      { ...approval, timeoutAt: futureTimeout } as ApprovalRecord & { timeoutAt: string },
      now,
    );
    assert.equal(result, false, "approval with future timeoutAt should not be expired");
  } finally {
    cleanupHarness(harness);
  }
});

test("isExpired returns true when timeoutAt is in the past", () => {
  const harness = createTestHarness("aa-isexpired-timeout-at-past");
  try {
    const approvalRepo = new ApprovalRepository(harness.db.connection);
    const now = new Date().toISOString();
    createTestTask(harness.store, "task-timeout-at-past", now);

    const pastTimeout = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1h in past

    const approvalService = new ApprovalService(harness.db, harness.store);
    const executor = new ApprovalTimeoutExecutor(approvalService, harness.store, approvalRepo);

    const result = executor.isExpired(
      { id: "test", taskId: "task", executionId: null, status: "requested", requestJson: "{}", responseJson: null, timeoutPolicy: "reject", createdAt: now, respondedAt: null, timeoutAt: pastTimeout } as ApprovalRecord & { timeoutAt: string },
      now,
    );
    assert.equal(result, true, "approval with past timeoutAt should be expired");
  } finally {
    cleanupHarness(harness);
  }
});

test("isExpired respects custom default timeout", () => {
  const harness = createTestHarness("aa-isexpired-custom-timeout");
  try {
    const approvalRepo = new ApprovalRepository(harness.db.connection);
    const now = new Date().toISOString();
    createTestTask(harness.store, "task-custom-timeout", now);

    // Created 45 minutes ago - should be expired with 30m timeout but not 24h
    const almostExpiredTime = new Date(Date.now() - 45 * 60 * 1000).toISOString();
    approvalRepo.insertApproval({
      id: "approval-45m-ago",
      taskId: "task-custom-timeout",
      executionId: null,
      status: "requested",
      requestJson: "{}",
      responseJson: null,
      timeoutPolicy: "reject",
      createdAt: almostExpiredTime,
      respondedAt: null,
    });

    const approvalService = new ApprovalService(harness.db, harness.store);
    const executor = new ApprovalTimeoutExecutor(approvalService, harness.store, approvalRepo, {
      defaultTimeoutMs: 30 * 60 * 1000, // 30 minutes
    });

    const approval = approvalRepo.getApproval("approval-45m-ago");
    assert.ok(approval);
    const result = executor.isExpired(approval, new Date().toISOString());
    assert.equal(result, true, "approval created 45m ago should be expired with 30m timeout");
  } finally {
    cleanupHarness(harness);
  }
});

// ---------------------------------------------------------------------------
// Tests: executeTimeout()
// ---------------------------------------------------------------------------

test("executeTimeout applies expired decision for timeoutPolicy=reject", () => {
  const harness = createTestHarness("aa-execute-reject");
  try {
    const approvalRepo = new ApprovalRepository(harness.db.connection);
    const now = new Date().toISOString();
    createTestTask(harness.store, "task-exec-reject", now);

    const expiredTime = new Date(Date.now() - 5000).toISOString();
    approvalRepo.insertApproval({
      id: "exec-reject",
      taskId: "task-exec-reject",
      executionId: null,
      status: "requested",
      requestJson: "{}",
      responseJson: null,
      timeoutPolicy: "reject",
      createdAt: expiredTime,
      respondedAt: null,
    });

    const approvalService = new ApprovalService(harness.db, harness.store);
    const executor = new ApprovalTimeoutExecutor(approvalService, harness.store, approvalRepo, {
      defaultTimeoutMs: 1000,
    });

    const result = executor.executeTimeout({ approvalId: "exec-reject" });

    assert.equal(result.status, "rejected");
    assert.equal(result.decisionType, "expired");
  } finally {
    cleanupHarness(harness);
  }
});

test("executeTimeout applies confirmed decision for timeoutPolicy=approve", () => {
  const harness = createTestHarness("aa-execute-approve");
  try {
    const approvalRepo = new ApprovalRepository(harness.db.connection);
    const now = new Date().toISOString();
    createTestTask(harness.store, "task-exec-approve", now);

    const expiredTime = new Date(Date.now() - 5000).toISOString();
    approvalRepo.insertApproval({
      id: "exec-approve",
      taskId: "task-exec-approve",
      executionId: null,
      status: "requested",
      requestJson: "{}",
      responseJson: null,
      timeoutPolicy: "approve",
      createdAt: expiredTime,
      respondedAt: null,
    });

    const approvalService = new ApprovalService(harness.db, harness.store);
    const executor = new ApprovalTimeoutExecutor(approvalService, harness.store, approvalRepo, {
      defaultTimeoutMs: 1000,
    });

    const result = executor.executeTimeout({ approvalId: "exec-approve" });

    assert.equal(result.status, "approved");
    assert.equal(result.decisionType, "expired");
  } finally {
    cleanupHarness(harness);
  }
});

test("executeTimeout throws for non-existent approval", () => {
  const harness = createTestHarness("aa-execute-not-found");
  try {
    const approvalRepo = new ApprovalRepository(harness.db.connection);
    const approvalService = new ApprovalService(harness.db, harness.store);
    const executor = new ApprovalTimeoutExecutor(approvalService, harness.store, approvalRepo);

    assert.throws(
      () => executor.executeTimeout({ approvalId: "nonexistent" }),
      /approval.not_found/,
    );
  } finally {
    cleanupHarness(harness);
  }
});

test("executeTimeout throws for unsupported timeoutPolicy", () => {
  const harness = createTestHarness("aa-execute-unsupported");
  try {
    const approvalRepo = new ApprovalRepository(harness.db.connection);
    const now = new Date().toISOString();
    createTestTask(harness.store, "task-unsupported", now);

    approvalRepo.insertApproval({
      id: "bad-policy",
      taskId: "task-unsupported",
      executionId: null,
      status: "requested",
      requestJson: "{}",
      responseJson: null,
      timeoutPolicy: "invalid_policy",
      createdAt: now,
      respondedAt: null,
    });

    const approvalService = new ApprovalService(harness.db, harness.store);
    const executor = new ApprovalTimeoutExecutor(approvalService, harness.store, approvalRepo);

    assert.throws(
      () => executor.executeTimeout({ approvalId: "bad-policy" }),
      /approval_timeout_executor.unsupported_policy/,
    );
  } finally {
    cleanupHarness(harness);
  }
});

test("executeTimeout result contains correct approvalId and respondedAt", () => {
  const harness = createTestHarness("aa-execute-result");
  try {
    const approvalRepo = new ApprovalRepository(harness.db.connection);
    const now = new Date().toISOString();
    createTestTask(harness.store, "task-result", now);

    approvalRepo.insertApproval({
      id: "test-approval-123",
      taskId: "task-result",
      executionId: null,
      status: "requested",
      requestJson: "{}",
      responseJson: null,
      timeoutPolicy: "reject",
      createdAt: new Date(Date.now() - 5000).toISOString(),
      respondedAt: null,
    });

    const approvalService = new ApprovalService(harness.db, harness.store);
    const executor = new ApprovalTimeoutExecutor(approvalService, harness.store, approvalRepo, {
      defaultTimeoutMs: 1000,
    });

    const result = executor.executeTimeout({ approvalId: "test-approval-123" });

    assert.equal(result.approvalId, "test-approval-123");
    assert.ok(result.respondedAt !== null, "respondedAt should be set");
    assert.ok(result.respondedAt.length > 0, "respondedAt should not be empty");
  } finally {
    cleanupHarness(harness);
  }
});