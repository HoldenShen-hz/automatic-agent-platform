import assert from "node:assert/strict";
import test from "node:test";

import { ApprovalTimeoutExecutor } from "../../../../../src/platform/five-plane-control-plane/approval-center/approval-timeout-executor.js";
import { ApprovalService } from "../../../../../src/platform/five-plane-control-plane/approval-center/approval-service.js";
import { ApprovalRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/approval-repository.js";
import { createIntegrationContext } from "../../../../helpers/integration-context.js";
import type { ApprovalRecord } from "../../../../../src/platform/contracts/types/domain.js";

// ---------------------------------------------------------------------------
// Helper to insert a test task (required for FK constraints)
// ---------------------------------------------------------------------------

function insertTestTask(ctx: ReturnType<typeof createIntegrationContext>, taskId: string, now: string): void {
  ctx.store.insertTask({
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
    normalizedInputJson: "{}",
    outputJson: null,
    estimatedCostUsd: 0,
    actualCostUsd: 0,
    errorCode: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  });
}

// ---------------------------------------------------------------------------
// R9-18: sweep() timeout enforcement tests
// ---------------------------------------------------------------------------

test("sweep() returns zero counts when no approvals exist", () => {
  const ctx = createIntegrationContext("aa-int-sweep-empty");
  try {
    const approvalRepo = new ApprovalRepository(ctx.db.connection);
    const approvalService = new ApprovalService(ctx.db, ctx.store);
    const executor = new ApprovalTimeoutExecutor(approvalService, ctx.store, approvalRepo);

    const result = executor.sweep();

    assert.equal(result.processed, 0);
    assert.equal(result.rejected, 0);
    assert.equal(result.approved, 0);
    assert.equal(result.skipped, 0);
    assert.equal(result.errors, 0);
  } finally {
    ctx.cleanup();
  }
});

test("sweep() finds approvals where deadline < now and timeoutPolicy is reject (R9-18)", () => {
  const ctx = createIntegrationContext("aa-int-sweep-deadline-reject");
  try {
    const approvalRepo = new ApprovalRepository(ctx.db.connection);
    const now = new Date().toISOString();
    insertTestTask(ctx, "task-deadline-reject", now);

    // Insert an expired approval with reject policy (created 48 hours ago)
    const expiredTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    approvalRepo.insertApproval({
      id: "approval-deadline-reject",
      taskId: "task-deadline-reject",
      executionId: null,
      status: "requested",
      requestJson: '{"reason":"test deadline check"}',
      responseJson: null,
      timeoutPolicy: "reject",
      createdAt: expiredTime,
      respondedAt: null,
    });

    const approvalService = new ApprovalService(ctx.db, ctx.store);
    const executor = new ApprovalTimeoutExecutor(approvalService, ctx.store, approvalRepo, {
      defaultTimeoutMs: 1000, // 1 second - ensures the 48h-old approval is expired
    });

    const result = executor.sweep();

    assert.equal(result.processed, 1, "sweep should process the expired approval");
    assert.equal(result.rejected, 1, "sweep should reject expired approvals with reject policy");
    assert.equal(result.approved, 0);
    assert.equal(result.skipped, 0);

    // Verify the approval was updated to expired status
    const updated = approvalRepo.getApproval("approval-deadline-reject");
    assert.ok(updated, "Approval should still exist");
    assert.equal(updated.status, "expired", "Status should be expired after sweep");
  } finally {
    ctx.cleanup();
  }
});

test("sweep() applies expired decision to timed-out approvals with timeoutPolicy=reject (R9-18)", () => {
  const ctx = createIntegrationContext("aa-int-sweep-expired-reject");
  try {
    const approvalRepo = new ApprovalRepository(ctx.db.connection);
    const now = new Date().toISOString();
    insertTestTask(ctx, "task-expired-reject", now);

    // Insert an expired approval with reject policy
    const expiredTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    approvalRepo.insertApproval({
      id: "approval-expired-reject",
      taskId: "task-expired-reject",
      executionId: null,
      status: "requested",
      requestJson: '{"reason":"test"}',
      responseJson: null,
      timeoutPolicy: "reject",
      createdAt: expiredTime,
      respondedAt: null,
    });

    const approvalService = new ApprovalService(ctx.db, ctx.store);
    const executor = new ApprovalTimeoutExecutor(approvalService, ctx.store, approvalRepo, {
      defaultTimeoutMs: 1000,
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
    ctx.cleanup();
  }
});

test("sweep() applies confirmed decision to timed-out approvals with timeoutPolicy=approve (R9-18)", () => {
  const ctx = createIntegrationContext("aa-int-sweep-expired-approve");
  try {
    const approvalRepo = new ApprovalRepository(ctx.db.connection);
    const now = new Date().toISOString();
    insertTestTask(ctx, "task-expired-approve", now);

    // Insert an expired approval with approve policy (created 48 hours ago)
    const expiredTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    approvalRepo.insertApproval({
      id: "approval-expired-approve",
      taskId: "task-expired-approve",
      executionId: null,
      status: "requested",
      requestJson: '{"reason":"test"}',
      responseJson: null,
      timeoutPolicy: "approve",
      createdAt: expiredTime,
      respondedAt: null,
    });

    const approvalService = new ApprovalService(ctx.db, ctx.store);
    const executor = new ApprovalTimeoutExecutor(approvalService, ctx.store, approvalRepo, {
      defaultTimeoutMs: 1000,
    });

    const result = executor.sweep();

    assert.equal(result.processed, 1);
    assert.equal(result.approved, 1, "expired approve policy should result in approved count");
    assert.equal(result.rejected, 0);

    // Verify the approval was actually updated to approved status
    const updated = approvalRepo.getApproval("approval-expired-approve");
    assert.ok(updated, "Approval should still exist");
    assert.equal(updated.status, "approved", "Status should be approved");
  } finally {
    ctx.cleanup();
  }
});

test("sweep() skips approvals where deadline not exceeded (R9-18)", () => {
  const ctx = createIntegrationContext("aa-int-sweep-not-expired");
  try {
    const approvalRepo = new ApprovalRepository(ctx.db.connection);
    const recentTime = new Date(Date.now() - 500).toISOString();
    insertTestTask(ctx, "task-not-expired", recentTime);

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

    const approvalService = new ApprovalService(ctx.db, ctx.store);
    const executor = new ApprovalTimeoutExecutor(approvalService, ctx.store, approvalRepo, {
      defaultTimeoutMs: 1000, // 1 second
    });

    const result = executor.sweep();

    assert.equal(result.processed, 1);
    assert.equal(result.rejected, 0);
    assert.equal(result.approved, 0);
    assert.equal(result.skipped, 1, "non-expired approval should be skipped");
    assert.equal(result.errors, 0);

    // Verify the approval was NOT updated
    const updated = approvalRepo.getApproval("approval-not-expired");
    assert.ok(updated, "Approval should still exist");
    assert.equal(updated.status, "requested", "Status should still be requested");
  } finally {
    ctx.cleanup();
  }
});

test("sweep() skips approvals with timeoutPolicy=remain_pending (R9-18)", () => {
  const ctx = createIntegrationContext("aa-int-sweep-remain-pending");
  try {
    const approvalRepo = new ApprovalRepository(ctx.db.connection);
    const now = new Date().toISOString();
    insertTestTask(ctx, "task-remain-pending", now);

    // Insert an expired approval with remain_pending policy (created 48 hours ago)
    const expiredTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    approvalRepo.insertApproval({
      id: "approval-remain-pending",
      taskId: "task-remain-pending",
      executionId: null,
      status: "requested",
      requestJson: '{"reason":"test"}',
      responseJson: null,
      timeoutPolicy: "remain_pending",
      createdAt: expiredTime,
      respondedAt: null,
    });

    const approvalService = new ApprovalService(ctx.db, ctx.store);
    const executor = new ApprovalTimeoutExecutor(approvalService, ctx.store, approvalRepo, {
      defaultTimeoutMs: 1000,
    });

    const result = executor.sweep();

    assert.equal(result.processed, 1);
    assert.equal(result.skipped, 1, "remain_pending policy should be skipped regardless of expiration");
    assert.equal(result.rejected, 0);
    assert.equal(result.approved, 0);

    // Verify the approval was NOT updated
    const updated = approvalRepo.getApproval("approval-remain-pending");
    assert.ok(updated, "Approval should still exist");
    assert.equal(updated.status, "requested", "Status should still be requested");
  } finally {
    ctx.cleanup();
  }
});

test("sweep() returns correct counts of processed/skipped/expired (R9-18)", () => {
  const ctx = createIntegrationContext("aa-int-sweep-counts");
  try {
    const approvalRepo = new ApprovalRepository(ctx.db.connection);
    const now = new Date().toISOString();
    insertTestTask(ctx, "task-counts", now);

    const recentTime = new Date(Date.now() - 500).toISOString(); // Recent - not expired
    const expiredTime = new Date(Date.now() - 5000).toISOString(); // Expired (5 seconds ago)

    // 1. Non-expired with reject policy - should be skipped
    approvalRepo.insertApproval({
      id: "counts-1-not-expired",
      taskId: "task-counts",
      executionId: null,
      status: "requested",
      requestJson: "{}",
      responseJson: null,
      timeoutPolicy: "reject",
      createdAt: recentTime,
      respondedAt: null,
    });

    // 2. Expired with reject policy - should be rejected
    approvalRepo.insertApproval({
      id: "counts-2-reject",
      taskId: "task-counts",
      executionId: null,
      status: "requested",
      requestJson: "{}",
      responseJson: null,
      timeoutPolicy: "reject",
      createdAt: expiredTime,
      respondedAt: null,
    });

    // 3. Expired with approve policy - should be approved
    approvalRepo.insertApproval({
      id: "counts-3-approve",
      taskId: "task-counts",
      executionId: null,
      status: "requested",
      requestJson: "{}",
      responseJson: null,
      timeoutPolicy: "approve",
      createdAt: expiredTime,
      respondedAt: null,
    });

    // 4. Expired with remain_pending policy - should be skipped
    approvalRepo.insertApproval({
      id: "counts-4-remain",
      taskId: "task-counts",
      executionId: null,
      status: "requested",
      requestJson: "{}",
      responseJson: null,
      timeoutPolicy: "remain_pending",
      createdAt: expiredTime,
      respondedAt: null,
    });

    const approvalService = new ApprovalService(ctx.db, ctx.store);
    const executor = new ApprovalTimeoutExecutor(approvalService, ctx.store, approvalRepo, {
      defaultTimeoutMs: 1000, // 1 second
    });

    const result = executor.sweep();

    // counts-1: skipped (not expired)
    // counts-2: rejected (expired + reject)
    // counts-3: approved (expired + approve)
    // counts-4: skipped (expired + remain_pending)
    assert.equal(result.processed, 4);
    assert.equal(result.rejected, 1, "should have 1 rejected");
    assert.equal(result.approved, 1, "should have 1 approved");
    assert.equal(result.skipped, 2, "should have 2 skipped");
    assert.equal(result.errors, 0);
  } finally {
    ctx.cleanup();
  }
});

test("sweep() handles multiple expired approvals with mixed policies", () => {
  const ctx = createIntegrationContext("aa-int-sweep-multiple");
  try {
    const approvalRepo = new ApprovalRepository(ctx.db.connection);
    const now = new Date().toISOString();
    insertTestTask(ctx, "task-multiple", now);

    const expiredTime = new Date(Date.now() - 5000).toISOString();

    // 2 expired with reject
    approvalRepo.insertApproval({
      id: "multi-reject-1",
      taskId: "task-multiple",
      executionId: null,
      status: "requested",
      requestJson: "{}",
      responseJson: null,
      timeoutPolicy: "reject",
      createdAt: expiredTime,
      respondedAt: null,
    });

    approvalRepo.insertApproval({
      id: "multi-reject-2",
      taskId: "task-multiple",
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
      id: "multi-approve-1",
      taskId: "task-multiple",
      executionId: null,
      status: "requested",
      requestJson: "{}",
      responseJson: null,
      timeoutPolicy: "approve",
      createdAt: expiredTime,
      respondedAt: null,
    });

    approvalRepo.insertApproval({
      id: "multi-approve-2",
      taskId: "task-multiple",
      executionId: null,
      status: "requested",
      requestJson: "{}",
      responseJson: null,
      timeoutPolicy: "approve",
      createdAt: expiredTime,
      respondedAt: null,
    });

    approvalRepo.insertApproval({
      id: "multi-approve-3",
      taskId: "task-multiple",
      executionId: null,
      status: "requested",
      requestJson: "{}",
      responseJson: null,
      timeoutPolicy: "approve",
      createdAt: expiredTime,
      respondedAt: null,
    });

    const approvalService = new ApprovalService(ctx.db, ctx.store);
    const executor = new ApprovalTimeoutExecutor(approvalService, ctx.store, approvalRepo, {
      defaultTimeoutMs: 1000,
    });

    const result = executor.sweep();

    assert.equal(result.rejected, 2, "should have 2 rejected");
    assert.equal(result.approved, 3, "should have 3 approved");
    assert.equal(result.processed, 5, "should process all 5");
    assert.equal(result.skipped, 0, "none should be skipped");
  } finally {
    ctx.cleanup();
  }
});

// ---------------------------------------------------------------------------
// R9-18: isExpired() tests
// ---------------------------------------------------------------------------

test("isExpired() correctly identifies expired approvals based on deadline vs now (R9-18)", () => {
  const ctx = createIntegrationContext("aa-int-isexpired-basic");
  try {
    const approvalRepo = new ApprovalRepository(ctx.db.connection);
    const now = new Date().toISOString();
    insertTestTask(ctx, "task-isexpired", now);

    // Expired approval (created 48 hours ago)
    const expiredTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    approvalRepo.insertApproval({
      id: "isexpired-test",
      taskId: "task-isexpired",
      executionId: null,
      status: "requested",
      requestJson: "{}",
      responseJson: null,
      timeoutPolicy: "reject",
      createdAt: expiredTime,
      respondedAt: null,
    });

    const approvalService = new ApprovalService(ctx.db, ctx.store);
    const executor = new ApprovalTimeoutExecutor(approvalService, ctx.store, approvalRepo, {
      defaultTimeoutMs: 1000,
    });

    const approval = approvalRepo.getApproval("isexpired-test");
    assert.ok(approval, "Approval should exist");

    const result = executor.isExpired(approval, new Date().toISOString());
    assert.equal(result, true, "Approval created 48h ago with 1s timeout should be expired");
  } finally {
    ctx.cleanup();
  }
});

test("isExpired() returns false when approval has respondedAt set", () => {
  const ctx = createIntegrationContext("aa-int-isexpired-responded");
  try {
    const approvalRepo = new ApprovalRepository(ctx.db.connection);
    const now = new Date().toISOString();
    insertTestTask(ctx, "task-responded", now);

    approvalRepo.insertApproval({
      id: "isexpired-responded",
      taskId: "task-responded",
      executionId: null,
      status: "approved",
      requestJson: "{}",
      responseJson: '{"decisionType":"confirmed"}',
      timeoutPolicy: "reject",
      createdAt: new Date(Date.now() - 5000).toISOString(),
      respondedAt: new Date().toISOString(),
    });

    const approvalService = new ApprovalService(ctx.db, ctx.store);
    const executor = new ApprovalTimeoutExecutor(approvalService, ctx.store, approvalRepo, {
      defaultTimeoutMs: 1000,
    });

    const approval = approvalRepo.getApproval("isexpired-responded");
    assert.ok(approval);
    const result = executor.isExpired(approval, new Date().toISOString());
    assert.equal(result, false, "responded approval should not be considered expired");
  } finally {
    ctx.cleanup();
  }
});

test("isExpired() uses timeoutAt column when available and not expired", () => {
  const ctx = createIntegrationContext("aa-int-isexpired-timeout-at-future");
  try {
    const approvalRepo = new ApprovalRepository(ctx.db.connection);
    const approvalService = new ApprovalService(ctx.db, ctx.store);
    const executor = new ApprovalTimeoutExecutor(approvalService, ctx.store, approvalRepo);

    const now = new Date().toISOString();
    const futureTimeout = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h in future

    const result = executor.isExpired(
      {
        id: "test-future-timeout",
        taskId: "task",
        executionId: null,
        status: "requested",
        requestJson: "{}",
        responseJson: null,
        timeoutPolicy: "reject",
        createdAt: now,
        respondedAt: null,
        timeoutAt: futureTimeout,
      } as ApprovalRecord & { timeoutAt: string },
      now,
    );

    assert.equal(result, false, "approval with future timeoutAt should not be expired");
  } finally {
    ctx.cleanup();
  }
});

test("isExpired() returns true when timeoutAt is in the past", () => {
  const ctx = createIntegrationContext("aa-int-isexpired-timeout-at-past");
  try {
    const approvalRepo = new ApprovalRepository(ctx.db.connection);
    const approvalService = new ApprovalService(ctx.db, ctx.store);
    const executor = new ApprovalTimeoutExecutor(approvalService, ctx.store, approvalRepo);

    const now = new Date().toISOString();
    const pastTimeout = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1h in past

    const result = executor.isExpired(
      {
        id: "test-past-timeout",
        taskId: "task",
        executionId: null,
        status: "requested",
        requestJson: "{}",
        responseJson: null,
        timeoutPolicy: "reject",
        createdAt: now,
        respondedAt: null,
        timeoutAt: pastTimeout,
      } as ApprovalRecord & { timeoutAt: string },
      now,
    );

    assert.equal(result, true, "approval with past timeoutAt should be expired");
  } finally {
    ctx.cleanup();
  }
});

test("isExpired() respects custom default timeout", () => {
  const ctx = createIntegrationContext("aa-int-isexpired-custom-timeout");
  try {
    const approvalRepo = new ApprovalRepository(ctx.db.connection);
    const now = new Date().toISOString();
    insertTestTask(ctx, "task-custom-timeout", now);

    // Created 45 minutes ago - should be expired with 30m timeout but not with 24h
    const almostExpiredTime = new Date(Date.now() - 45 * 60 * 1000).toISOString();
    approvalRepo.insertApproval({
      id: "isexpired-45m",
      taskId: "task-custom-timeout",
      executionId: null,
      status: "requested",
      requestJson: "{}",
      responseJson: null,
      timeoutPolicy: "reject",
      createdAt: almostExpiredTime,
      respondedAt: null,
    });

    const approvalService = new ApprovalService(ctx.db, ctx.store);
    const executor = new ApprovalTimeoutExecutor(approvalService, ctx.store, approvalRepo, {
      defaultTimeoutMs: 30 * 60 * 1000, // 30 minutes
    });

    const approval = approvalRepo.getApproval("isexpired-45m");
    assert.ok(approval);
    const result = executor.isExpired(approval, new Date().toISOString());
    assert.equal(result, true, "approval created 45m ago should be expired with 30m timeout");
  } finally {
    ctx.cleanup();
  }
});
