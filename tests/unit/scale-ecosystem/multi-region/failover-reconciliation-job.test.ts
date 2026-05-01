/**
 * Failover Reconciliation Job Unit Tests
 *
 * Tests for failover-reconciliation-job.ts - §52.3 + §31:
 * Implements reconciliation checks after failover to ensure data consistency.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  FailoverReconciliationJob,
  type ReconciliationJobInput,
} from "../../../../src/scale-ecosystem/multi-region/failover-reconciliation-job.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helper to create minimal valid input
// ─────────────────────────────────────────────────────────────────────────────

function createMinimalInput(): ReconciliationJobInput {
  return {
    sourceRegionId: "region-us-east-1",
    targetRegionId: "region-us-west-2",
    promoteEpoch: 12345,
    lastCheckpointSequence: 1000,
    pendingWriteCount: 0,
    pendingApprovals: [],
    openBudgets: [],
    outboxMessages: [],
    restrictedWrites: [],
  };
}

function createInputWithWrites(count: number): ReconciliationJobInput {
  return {
    sourceRegionId: "region-us-east-1",
    targetRegionId: "region-us-west-2",
    promoteEpoch: 12345,
    lastCheckpointSequence: 1000,
    pendingWriteCount: count,
    pendingApprovals: [],
    openBudgets: [],
    outboxMessages: [],
    restrictedWrites: [],
  };
}

function createInputWithApprovals(approvals: { approvalId: string; taskId: string; createdAt: string }[]): ReconciliationJobInput {
  return {
    sourceRegionId: "region-us-east-1",
    targetRegionId: "region-us-west-2",
    promoteEpoch: 12345,
    lastCheckpointSequence: 1000,
    pendingWriteCount: 0,
    pendingApprovals: approvals,
    openBudgets: [],
    outboxMessages: [],
    restrictedWrites: [],
  };
}

function createInputWithBudgets(budgets: { budgetId: string; resourceType: string; allocatedAmount: number }[]): ReconciliationJobInput {
  return {
    sourceRegionId: "region-us-east-1",
    targetRegionId: "region-us-west-2",
    promoteEpoch: 12345,
    lastCheckpointSequence: 1000,
    pendingWriteCount: 0,
    pendingApprovals: [],
    openBudgets: budgets,
    outboxMessages: [],
    restrictedWrites: [],
  };
}

function createInputWithOutboxMessages(messages: { messageId: string; createdAt: string; retryCount: number }[]): ReconciliationJobInput {
  return {
    sourceRegionId: "region-us-east-1",
    targetRegionId: "region-us-west-2",
    promoteEpoch: 12345,
    lastCheckpointSequence: 1000,
    pendingWriteCount: 0,
    pendingApprovals: [],
    openBudgets: [],
    outboxMessages: messages,
    restrictedWrites: [],
  };
}

function createInputWithRestrictedWrites(writes: { writeId: string; resourceId: string; blockedAt: string }[]): ReconciliationJobInput {
  return {
    sourceRegionId: "region-us-east-1",
    targetRegionId: "region-us-west-2",
    promoteEpoch: 12345,
    lastCheckpointSequence: 1000,
    pendingWriteCount: 0,
    pendingApprovals: [],
    openBudgets: [],
    outboxMessages: [],
    restrictedWrites: writes,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FailoverReconciliationJob Core Functionality Tests
// ─────────────────────────────────────────────────────────────────────────────

test("FailoverReconciliationJob: runReconciliation returns scan result with correct structure", () => {
  const job = new FailoverReconciliationJob();
  const input = createMinimalInput();

  const result = job.runReconciliation(input);

  assert.ok(result.scanId, "scanId should be generated");
  assert.ok(result.scannedAt, "scannedAt should be set");
  assert.equal(result.sourceRegionId, input.sourceRegionId);
  assert.equal(result.targetRegionId, input.targetRegionId);
  assert.equal(result.issues.length, 0, "no issues for empty input");
  assert.equal(result.canProceed, true, "can proceed with no issues");
});

test("FailoverReconciliationJob: detects unreplicated writes", () => {
  const job = new FailoverReconciliationJob();
  const input = createInputWithWrites(5);

  const result = job.runReconciliation(input);

  assert.equal(result.unreplicatedWriteCount, 5);
  assert.ok(result.issues.length >= 5, "should create issues for pending writes");
  assert.ok(result.issues.some(i => i.issueType === "unreplicated_write"));
});

test("FailoverReconciliationJob: unreplicated writes with count > 10 are critical", () => {
  const job = new FailoverReconciliationJob();
  const input = createInputWithWrites(15);

  const result = job.runReconciliation(input);

  const unreplicatedIssues = result.issues.filter(i => i.issueType === "unreplicated_write");
  assert.ok(unreplicatedIssues.every(i => i.severity === "critical"), "count > 10 should be critical");
  assert.ok(result.criticalCount > 0, "should have critical issues");
  assert.equal(result.canProceed, false, "cannot proceed with critical issues");
});

test("FailoverReconciliationJob: unreplicated writes with count <= 10 are high severity", () => {
  const job = new FailoverReconciliationJob();
  const input = createInputWithWrites(8);

  const result = job.runReconciliation(input);

  const unreplicatedIssues = result.issues.filter(i => i.issueType === "unreplicated_write");
  assert.ok(unreplicatedIssues.every(i => i.severity === "high"), "count <= 10 should be high");
});

test("FailoverReconciliationJob: detects pending approvals", () => {
  const job = new FailoverReconciliationJob();
  const input = createInputWithApprovals([
    { approvalId: "approval-1", taskId: "task-1", createdAt: "2026-05-01T10:00:00Z" },
    { approvalId: "approval-2", taskId: "task-2", createdAt: "2026-05-01T11:00:00Z" },
  ]);

  const result = job.runReconciliation(input);

  assert.equal(result.pendingApprovalCount, 2);
  const approvalIssues = result.issues.filter(i => i.issueType === "pending_approval");
  assert.equal(approvalIssues.length, 2);
  assert.ok(approvalIssues.every(i => i.severity === "medium"));
});

test("FailoverReconciliationJob: detects open budgets", () => {
  const job = new FailoverReconciliationJob();
  const input = createInputWithBudgets([
    { budgetId: "budget-1", resourceType: "compute", allocatedAmount: 1000 },
    { budgetId: "budget-2", resourceType: "storage", allocatedAmount: 5000 },
  ]);

  const result = job.runReconciliation(input);

  assert.equal(result.openBudgetCount, 2);
  const budgetIssues = result.issues.filter(i => i.issueType === "open_budget");
  assert.equal(budgetIssues.length, 2);
  assert.ok(budgetIssues.every(i => i.severity === "medium"));
});

test("FailoverReconciliationJob: detects outbox gaps with correct severity", () => {
  const job = new FailoverReconciliationJob();
  const input = createInputWithOutboxMessages([
    { messageId: "msg-1", createdAt: "2026-05-01T10:00:00Z", retryCount: 1 },
    { messageId: "msg-2", createdAt: "2026-05-01T11:00:00Z", retryCount: 5 }, // > 3 is high
  ]);

  const result = job.runReconciliation(input);

  assert.equal(result.outboxGapCount, 2);
  const outboxIssues = result.issues.filter(i => i.issueType === "outbox_gap");
  const lowSeverity = outboxIssues.filter(i => i.severity === "low");
  const highSeverity = outboxIssues.filter(i => i.severity === "high");
  assert.equal(lowSeverity.length, 1);
  assert.equal(highSeverity.length, 1);
});

test("FailoverReconciliationJob: restricted writes are always critical", () => {
  const job = new FailoverReconciliationJob();
  const input = createInputWithRestrictedWrites([
    { writeId: "write-1", resourceId: "res-1", blockedAt: "2026-05-01T10:00:00Z" },
  ]);

  const result = job.runReconciliation(input);

  assert.equal(result.restrictedWriteCount, 1);
  assert.ok(result.criticalCount > 0, "restricted writes are critical");
  assert.equal(result.canProceed, false, "cannot proceed with critical issues");
  const restrictedIssues = result.issues.filter(i => i.issueType === "restricted_write");
  assert.ok(restrictedIssues.every(i => i.severity === "critical"));
  assert.ok(restrictedIssues.every(i => i.requiresAttention === true));
});

test("FailoverReconciliationJob: multiple issue types are correctly counted", () => {
  const job = new FailoverReconciliationJob();
  const input: ReconciliationJobInput = {
    sourceRegionId: "region-us-east-1",
    targetRegionId: "region-us-west-2",
    promoteEpoch: 12345,
    lastCheckpointSequence: 1000,
    pendingWriteCount: 3,
    pendingApprovals: [{ approvalId: "a1", taskId: "t1", createdAt: "2026-05-01T10:00:00Z" }],
    openBudgets: [{ budgetId: "b1", resourceType: "compute", allocatedAmount: 100 }],
    outboxMessages: [{ messageId: "m1", createdAt: "2026-05-01T10:00:00Z", retryCount: 2 }],
    restrictedWrites: [{ writeId: "w1", resourceId: "r1", blockedAt: "2026-05-01T10:00:00Z" }],
  };

  const result = job.runReconciliation(input);

  assert.equal(result.unreplicatedWriteCount, 3);
  assert.equal(result.pendingApprovalCount, 1);
  assert.equal(result.openBudgetCount, 1);
  assert.equal(result.outboxGapCount, 1);
  assert.equal(result.restrictedWriteCount, 1);
  assert.ok(result.criticalCount > 0, "has critical issues from restricted writes");
  assert.ok(result.highCount > 0, "has high issues from unreplicated writes");
  assert.ok(result.mediumCount > 0, "has medium issues from approvals/budgets");
  assert.ok(result.lowCount > 0, "has low issues from outbox");
});

// ─────────────────────────────────────────────────────────────────────────────
// FailoverReconciliationJob History Management Tests
// ─────────────────────────────────────────────────────────────────────────────

test("FailoverReconciliationJob: getLastScanResult returns null initially", () => {
  const job = new FailoverReconciliationJob();

  assert.equal(job.getLastScanResult(), null);
});

test("FailoverReconciliationJob: getLastScanResult returns most recent result", () => {
  const job = new FailoverReconciliationJob();
  const input1: ReconciliationJobInput = {
    sourceRegionId: "region-1",
    targetRegionId: "region-us-west-2",
    promoteEpoch: 12345,
    lastCheckpointSequence: 1000,
    pendingWriteCount: 0,
    pendingApprovals: [],
    openBudgets: [],
    outboxMessages: [],
    restrictedWrites: [],
  };
  const input2: ReconciliationJobInput = {
    sourceRegionId: "region-2",
    targetRegionId: "region-us-west-2",
    promoteEpoch: 12345,
    lastCheckpointSequence: 1000,
    pendingWriteCount: 0,
    pendingApprovals: [],
    openBudgets: [],
    outboxMessages: [],
    restrictedWrites: [],
  };

  job.runReconciliation(input1);
  const result2 = job.runReconciliation(input2);

  const lastResult = job.getLastScanResult();
  assert.ok(lastResult);
  assert.equal(lastResult.sourceRegionId, "region-2");
});

test("FailoverReconciliationJob: getScanHistory returns all results", () => {
  const job = new FailoverReconciliationJob();

  job.runReconciliation(createMinimalInput());
  job.runReconciliation(createMinimalInput());
  job.runReconciliation(createMinimalInput());

  const history = job.getScanHistory();
  assert.equal(history.length, 3);
});

test("FailoverReconciliationJob: getScanHistory returns copy not reference", () => {
  const job = new FailoverReconciliationJob();

  job.runReconciliation(createMinimalInput());
  const history1 = job.getScanHistory();
  const history2 = job.getScanHistory();

  assert.notEqual(history1, history2);
  assert.deepStrictEqual(history1, history2);
});

// ─────────────────────────────────────────────────────────────────────────────
// FailoverReconciliationJob acknowledgeIssue Tests
// ─────────────────────────────────────────────────────────────────────────────

test("FailoverReconciliationJob: acknowledgeIssue returns false for unknown scanId", () => {
  const job = new FailoverReconciliationJob();
  job.runReconciliation(createMinimalInput());

  const result = job.acknowledgeIssue("unknown-scan-id", "some-issue-id");

  assert.equal(result, false);
});

test("FailoverReconciliationJob: acknowledgeIssue returns false for unknown issueId", () => {
  const job = new FailoverReconciliationJob();
  job.runReconciliation(createMinimalInput());

  const scan = job.getLastScanResult();
  const result = job.acknowledgeIssue(scan!.scanId, "unknown-issue-id");

  assert.equal(result, false);
});

test("FailoverReconciliationJob: acknowledgeIssue returns true for valid ids", () => {
  const job = new FailoverReconciliationJob();
  const input = createInputWithWrites(1);
  job.runReconciliation(input);

  const scan = job.getLastScanResult()!;
  const issueId = scan.issues[0].issueId;
  const result = job.acknowledgeIssue(scan.scanId, issueId);

  assert.equal(result, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// FailoverReconciliationJob Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("FailoverReconciliationJob: handles empty issue lists with all zeros", () => {
  const job = new FailoverReconciliationJob();
  const input = createMinimalInput();

  const result = job.runReconciliation(input);

  assert.equal(result.unreplicatedWriteCount, 0);
  assert.equal(result.pendingApprovalCount, 0);
  assert.equal(result.openBudgetCount, 0);
  assert.equal(result.outboxGapCount, 0);
  assert.equal(result.restrictedWriteCount, 0);
  assert.equal(result.criticalCount, 0);
  assert.equal(result.highCount, 0);
  assert.equal(result.mediumCount, 0);
  assert.equal(result.lowCount, 0);
  assert.equal(result.canProceed, true);
});

test("FailoverReconciliationJob: issue descriptions are descriptive", () => {
  const job = new FailoverReconciliationJob();
  const input = createInputWithApprovals([{ approvalId: "approval-123", taskId: "task-456", createdAt: "2026-05-01T10:00:00Z" }]);

  const result = job.runReconciliation(input);

  const issue = result.issues.find(i => i.issueType === "pending_approval");
  assert.ok(issue);
  assert.ok(issue!.description.includes("task-456"));
});

test("FailoverReconciliationJob: issue contains correct region information", () => {
  const job = new FailoverReconciliationJob();
  const input = createMinimalInput();

  const result = job.runReconciliation(input);

  for (const issue of result.issues) {
    assert.equal(issue.sourceRegionId, input.sourceRegionId);
    assert.equal(issue.targetRegionId, input.targetRegionId);
  }
});

test("FailoverReconciliationJob: canProceed is false when critical issues exist", () => {
  const job = new FailoverReconciliationJob();
  const input = createInputWithRestrictedWrites([
    { writeId: "write-1", resourceId: "res-1", blockedAt: "2026-05-01T10:00:00Z" },
    { writeId: "write-2", resourceId: "res-2", blockedAt: "2026-05-01T10:00:00Z" },
  ]);

  const result = job.runReconciliation(input);

  assert.ok(result.criticalCount >= 2);
  assert.equal(result.canProceed, false);
});

test("FailoverReconciliationJob: canProceed is true when only non-critical issues exist", () => {
  const job = new FailoverReconciliationJob();
  const input = createInputWithApprovals([{ approvalId: "a1", taskId: "t1", createdAt: "2026-05-01T10:00:00Z" }]);

  const result = job.runReconciliation(input);

  assert.equal(result.canProceed, true);
});

test("FailoverReconciliationJob: requiresAttention is true for critical and high severity", () => {
  const job = new FailoverReconciliationJob();
  const input: ReconciliationJobInput = {
    sourceRegionId: "region-us-east-1",
    targetRegionId: "region-us-west-2",
    promoteEpoch: 12345,
    lastCheckpointSequence: 1000,
    pendingWriteCount: 15, // critical
    pendingApprovals: [],
    openBudgets: [],
    outboxMessages: [{ messageId: "m1", createdAt: "2026-05-01T10:00:00Z", retryCount: 5 }], // high
    restrictedWrites: [],
  };

  const result = job.runReconciliation(input);

  const criticalIssues = result.issues.filter(i => i.severity === "critical");
  const highIssues = result.issues.filter(i => i.severity === "high");
  assert.ok(criticalIssues.every(i => i.requiresAttention === true));
  assert.ok(highIssues.every(i => i.requiresAttention === true));
});

test("FailoverReconciliationJob: requiresAttention is false for medium and low severity", () => {
  const job = new FailoverReconciliationJob();
  const input: ReconciliationJobInput = {
    sourceRegionId: "region-us-east-1",
    targetRegionId: "region-us-west-2",
    promoteEpoch: 12345,
    lastCheckpointSequence: 1000,
    pendingWriteCount: 0,
    pendingApprovals: [{ approvalId: "a1", taskId: "t1", createdAt: "2026-05-01T10:00:00Z" }], // medium
    openBudgets: [],
    outboxMessages: [{ messageId: "m1", createdAt: "2026-05-01T10:00:00Z", retryCount: 1 }], // low
    restrictedWrites: [],
  };

  const result = job.runReconciliation(input);

  const mediumIssues = result.issues.filter(i => i.severity === "medium");
  const lowIssues = result.issues.filter(i => i.severity === "low");
  assert.ok(mediumIssues.every(i => i.requiresAttention === false));
  assert.ok(lowIssues.every(i => i.requiresAttention === false));
});
