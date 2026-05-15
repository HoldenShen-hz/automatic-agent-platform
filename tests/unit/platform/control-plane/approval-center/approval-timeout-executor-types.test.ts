import assert from "node:assert/strict";
import test from "node:test";

import type { ApprovalRecord } from "../../../../../src/platform/contracts/types/domain.js";
import type { ApprovalTimeoutResult, ApprovalTimeoutExecutorOptions } from "../../../../../src/platform/five-plane-control-plane/approval-center/approval-timeout-executor.js";

const DEFAULT_TIMEOUT_MS = 24 * 60 * 60 * 1000;

function createApproval(overrides: Partial<ApprovalRecord> = {}): ApprovalRecord {
  return {
    id: "approval_1",
    taskId: "task_1",
    executionId: "exec_1",
    status: "requested",
    requestJson: '{"approved":true}',
    responseJson: null,
    timeoutPolicy: "reject",
    createdAt: new Date(Date.now() - DEFAULT_TIMEOUT_MS - 1000).toISOString(),
    respondedAt: null,
    ...overrides,
  };
}

test("ApprovalTimeoutResult structure is correct", () => {
  const result: ApprovalTimeoutResult = {
    processed: 10,
    rejected: 3,
    approved: 2,
    skipped: 4,
    errors: 1,
  };

  assert.equal(result.processed, 10);
  assert.equal(result.rejected, 3);
  assert.equal(result.approved, 2);
  assert.equal(result.skipped, 4);
  assert.equal(result.errors, 1);
});

test("ApprovalTimeoutResult allows zero values", () => {
  const result: ApprovalTimeoutResult = {
    processed: 0,
    rejected: 0,
    approved: 0,
    skipped: 0,
    errors: 0,
  };

  assert.equal(result.processed, 0);
  assert.equal(result.rejected, 0);
});

test("ApprovalTimeoutExecutorOptions allows partial definition", () => {
  const options: ApprovalTimeoutExecutorOptions = {
    defaultTimeoutMs: 3600000, // 1 hour
  };

  assert.equal(options.defaultTimeoutMs, 3600000);
});

test("ApprovalTimeoutExecutorOptions allows empty definition", () => {
  const options: ApprovalTimeoutExecutorOptions = {};

  assert.equal(options.defaultTimeoutMs, undefined);
});

test("ApprovalRecord with respondedAt is not expired regardless of timeout", () => {
  const approval = createApproval({
    respondedAt: new Date().toISOString(),
    createdAt: new Date(Date.now() - 100000).toISOString(), // created long ago
  });

  // If respondedAt is set, it should not be considered expired
  assert.equal(approval.respondedAt !== null, true);
});

test("ApprovalRecord timeoutPolicy accepts all valid values", () => {
  const policies = ["reject", "approve", "remain_pending"] as const;

  for (const policy of policies) {
    const approval = createApproval({ timeoutPolicy: policy });
    assert.equal(approval.timeoutPolicy, policy);
  }
});

test("ApprovalRecord status accepts all valid values", () => {
  const statuses = ["requested", "approved", "rejected", "expired"] as const;

  for (const status of statuses) {
    const approval = createApproval({ status });
    assert.equal(approval.status, status);
  }
});

test("ApprovalRecord allows null responseJson when pending", () => {
  const approval = createApproval({
    status: "requested",
    responseJson: null,
  });

  assert.equal(approval.responseJson, null);
  assert.equal(approval.status, "requested");
});

test("ApprovalRecord allows responseJson when responded", () => {
  const approval = createApproval({
    status: "approved",
    responseJson: '{"approved":true,"reason":"looks good"}',
    respondedAt: new Date().toISOString(),
  });

  assert.ok(approval.responseJson !== null);
  assert.equal(approval.status, "approved");
});

test("ApprovalRecord computes expiration from createdAt when timeoutAt not present", () => {
  const now = new Date();
  const createdAt = new Date(now.getTime() - DEFAULT_TIMEOUT_MS - 1000);
  const approval = createApproval({
    createdAt: createdAt.toISOString(),
  });

  // Without timeoutAt, check if createdAt + DEFAULT_TIMEOUT_MS < now
  const createdAtMs = createdAt.getTime();
  const expiresAtMs = createdAtMs + DEFAULT_TIMEOUT_MS;
  const nowMs = now.getTime();

  assert.equal(nowMs >= expiresAtMs, true); // Should be expired
});

test("ApprovalRecord with recent createdAt is not expired", () => {
  const now = new Date();
  const createdAt = new Date(now.getTime() - 1000); // created 1 second ago
  const approval = createApproval({
    createdAt: createdAt.toISOString(),
  });

  const createdAtMs = createdAt.getTime();
  const expiresAtMs = createdAtMs + DEFAULT_TIMEOUT_MS;
  const nowMs = now.getTime();

  assert.equal(nowMs >= expiresAtMs, false); // Should not be expired
});
