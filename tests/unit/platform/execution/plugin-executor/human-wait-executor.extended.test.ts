/**
 * HumanWaitExecutor Extended Unit Tests
 *
 * Additional tests for human approval workflow:
 * - Validation edge cases
 * - Status transitions
 * - Metadata handling
 * - Timeout policy behaviors
 * - Multiple approval scenarios
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError } from "../../../../../src/platform/contracts/errors.js";
import { HumanWaitExecutor, type HumanWaitExecutionContext, type HumanWaitResolution } from "../../../../../src/platform/five-plane-execution/plugin-executor/human-wait-executor.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const createTestContext = (overrides: Partial<HumanWaitExecutionContext> = {}): HumanWaitExecutionContext => ({
  executionId: "exec-123",
  taskId: "task-456",
  tenantId: "tenant-789",
  sessionId: null,
  correlationId: null,
  ...overrides,
});

// ─────────────────────────────────────────────────────────────────────────────
// Validation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("HumanWaitExecutor throws for empty title [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor();
  const context = createTestContext();

  assert.throws(
    () =>
      executor.requestApproval(context, {
        title: "   ",
        reason: "Valid reason",
        options: ["approve", "reject"],
        timeoutPolicy: "reject",
      }),
    (err: Error) => {
      return err.message.includes("title and reason");
    },
  );
});

test("HumanWaitExecutor throws for empty reason [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor();
  const context = createTestContext();

  assert.throws(
    () =>
      executor.requestApproval(context, {
        title: "Valid title",
        reason: "",
        options: ["approve", "reject"],
        timeoutPolicy: "reject",
      }),
    (err: Error) => {
      return err.message.includes("title and reason");
    },
  );
});

test("HumanWaitExecutor throws for whitespace-only title and reason [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor();
  const context = createTestContext();

  assert.throws(
    () =>
      executor.requestApproval(context, {
        title: "   \n\t  ",
        reason: "   \n\t  ",
        options: ["approve", "reject"],
        timeoutPolicy: "reject",
      }),
    (err: Error) => {
      return err.message.includes("title and reason");
    },
  );
});

test("HumanWaitExecutor trims title and reason [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor({
    idFactory: () => "approval-trimmed",
  });
  const context = createTestContext();

  const result = executor.requestApproval(context, {
    title: "  Approval Title  ",
    reason: "  Approval Reason  ",
    options: ["approve", "reject"],
    timeoutPolicy: "reject",
  });

  assert.equal(result.title, "Approval Title");
  assert.equal(result.reason, "Approval Reason");
});

// ─────────────────────────────────────────────────────────────────────────────
// Approval ID Generation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("HumanWaitExecutor uses provided approvalId if valid [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor();
  const context = createTestContext();

  const result = executor.requestApproval(context, {
    approvalId: "my-custom-approval-123",
    title: "Title",
    reason: "Reason",
    options: ["approve", "reject"],
    timeoutPolicy: "reject",
  });

  assert.equal(result.approvalId, "my-custom-approval-123");
});

test("HumanWaitExecutor trims provided approvalId [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor();
  const context = createTestContext();

  const result = executor.requestApproval(context, {
    approvalId: "  my-custom-approval-123  ",
    title: "Title",
    reason: "Reason",
    options: ["approve", "reject"],
    timeoutPolicy: "reject",
  });

  assert.equal(result.approvalId, "my-custom-approval-123");
});

test("HumanWaitExecutor uses idFactory when approvalId is empty string [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor({
    idFactory: () => "generated-id",
  });
  const context = createTestContext();

  const result = executor.requestApproval(context, {
    approvalId: "",
    title: "Title",
    reason: "Reason",
    options: ["approve", "reject"],
    timeoutPolicy: "reject",
  });

  assert.equal(result.approvalId, "generated-id");
});

test("HumanWaitExecutor uses idFactory when approvalId is only whitespace [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor({
    idFactory: () => "generated-id-2",
  });
  const context = createTestContext();

  const result = executor.requestApproval(context, {
    approvalId: "   ",
    title: "Title",
    reason: "Reason",
    options: ["approve", "reject"],
    timeoutPolicy: "reject",
  });

  assert.equal(result.approvalId, "generated-id-2");
});

// ─────────────────────────────────────────────────────────────────────────────
// Status Transition Tests
// ─────────────────────────────────────────────────────────────────────────────

test("HumanWaitExecutor resolves to approved status [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor({
    now: () => "2026-04-25T00:00:00.000Z",
    idFactory: () => "approval-approved",
  });
  const context = createTestContext();

  executor.requestApproval(context, {
    title: "Title",
    reason: "Reason",
    options: ["approve", "reject"],
    timeoutPolicy: "reject",
  });

  const result = executor.resolveApproval("approval-approved", {
    status: "approved",
    resolvedBy: "user-1",
  });

  assert.equal(result.status, "approved");
});

test("HumanWaitExecutor resolves to rejected status [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor({
    now: () => "2026-04-25T00:00:00.000Z",
    idFactory: () => "approval-rejected",
  });
  const context = createTestContext();

  executor.requestApproval(context, {
    title: "Title",
    reason: "Reason",
    options: ["approve", "reject"],
    timeoutPolicy: "reject",
  });

  const result = executor.resolveApproval("approval-rejected", {
    status: "rejected",
    resolvedBy: "user-1",
    note: "Not approved",
  });

  assert.equal(result.status, "rejected");
  assert.equal(result.note, "Not approved");
});

test("HumanWaitExecutor resolves to expired status [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor({
    now: () => "2026-04-25T00:00:00.000Z",
    idFactory: () => "approval-expired",
  });
  const context = createTestContext();

  executor.requestApproval(context, {
    title: "Title",
    reason: "Reason",
    options: ["approve", "reject"],
    timeoutPolicy: "reject",
  });

  const result = executor.resolveApproval("approval-expired", {
    status: "expired",
  });

  assert.equal(result.status, "expired");
});

test("HumanWaitExecutor resolves to cancelled status [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor({
    now: () => "2026-04-25T00:00:00.000Z",
    idFactory: () => "approval-cancelled",
  });
  const context = createTestContext();

  executor.requestApproval(context, {
    title: "Title",
    reason: "Reason",
    options: ["approve", "reject"],
    timeoutPolicy: "reject",
  });

  const result = executor.resolveApproval("approval-cancelled", {
    status: "cancelled",
    resolvedBy: "system",
    note: "Cancelled by system",
  });

  assert.equal(result.status, "cancelled");
  assert.equal(result.resolvedBy, "system");
});

test("HumanWaitExecutor resolves to cancelled (expired) status [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor({
    now: () => "2026-04-25T00:00:00.000Z",
    idFactory: () => "approval-cancelled-exp",
  });
  const context = createTestContext();

  executor.requestApproval(context, {
    title: "Title",
    reason: "Reason",
    options: ["approve", "reject"],
    timeoutPolicy: "reject",
  });

  const result = executor.resolveApproval("approval-cancelled-exp", {
    status: "cancelled",
  });

  assert.equal(result.status, "cancelled");
});

// ─────────────────────────────────────────────────────────────────────────────
// Resolution Timestamp Tests
// ─────────────────────────────────────────────────────────────────────────────

test("HumanWaitExecutor uses provided resolvedAt timestamp [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor({
    now: () => "2026-04-25T00:00:00.000Z",
    idFactory: () => "approval-ts",
  });
  const context = createTestContext();

  executor.requestApproval(context, {
    title: "Title",
    reason: "Reason",
    options: ["approve", "reject"],
    timeoutPolicy: "reject",
  });

  const result = executor.resolveApproval("approval-ts", {
    status: "approved",
    resolvedAt: "2026-04-25T12:30:00.000Z",
  });

  assert.equal(result.resolvedAt, "2026-04-25T12:30:00.000Z");
});

test("HumanWaitExecutor uses now() when resolvedAt not provided [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor({
    now: () => "2026-04-25T00:00:00.000Z",
    idFactory: () => "approval-now",
  });
  const context = createTestContext();

  executor.requestApproval(context, {
    title: "Title",
    reason: "Reason",
    options: ["approve", "reject"],
    timeoutPolicy: "reject",
  });

  const result = executor.resolveApproval("approval-now", {
    status: "approved",
  });

  assert.equal(result.resolvedAt, "2026-04-25T00:00:00.000Z");
});

test("HumanWaitExecutor uses provided resolvedBy [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor({
    now: () => "2026-04-25T00:00:00.000Z",
    idFactory: () => "approval-by",
  });
  const context = createTestContext();

  executor.requestApproval(context, {
    title: "Title",
    reason: "Reason",
    options: ["approve", "reject"],
    timeoutPolicy: "reject",
  });

  const result = executor.resolveApproval("approval-by", {
    status: "approved",
    resolvedBy: "admin-123",
  });

  assert.equal(result.resolvedBy, "admin-123");
});

test("HumanWaitExecutor defaults resolvedBy to null when not provided [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor({
    now: () => "2026-04-25T00:00:00.000Z",
    idFactory: () => "approval-by-null",
  });
  const context = createTestContext();

  executor.requestApproval(context, {
    title: "Title",
    reason: "Reason",
    options: ["approve", "reject"],
    timeoutPolicy: "reject",
  });

  const result = executor.resolveApproval("approval-by-null", {
    status: "approved",
  });

  assert.equal(result.resolvedBy, null);
});

test("HumanWaitExecutor uses provided note [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor({
    now: () => "2026-04-25T00:00:00.000Z",
    idFactory: () => "approval-note",
  });
  const context = createTestContext();

  executor.requestApproval(context, {
    title: "Title",
    reason: "Reason",
    options: ["approve", "reject"],
    timeoutPolicy: "reject",
  });

  const result = executor.resolveApproval("approval-note", {
    status: "rejected",
    note: "Does not meet security requirements",
  });

  assert.equal(result.note, "Does not meet security requirements");
});

test("HumanWaitExecutor defaults note to null when not provided [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor({
    now: () => "2026-04-25T00:00:00.000Z",
    idFactory: () => "approval-note-null",
  });
  const context = createTestContext();

  executor.requestApproval(context, {
    title: "Title",
    reason: "Reason",
    options: ["approve", "reject"],
    timeoutPolicy: "reject",
  });

  const result = executor.resolveApproval("approval-note-null", {
    status: "rejected",
  });

  assert.equal(result.note, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Duration Calculation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("HumanWaitExecutor calculates duration from requestedAt to resolvedAt [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor({
    now: () => "2026-04-25T00:00:00.000Z",
    idFactory: () => "approval-duration",
  });
  const context = createTestContext();

  executor.requestApproval(context, {
    title: "Title",
    reason: "Reason",
    options: ["approve", "reject"],
    timeoutPolicy: "reject",
    requestedAt: "2026-04-25T00:00:00.000Z",
  });

  const result = executor.resolveApproval("approval-duration", {
    status: "approved",
    resolvedAt: "2026-04-25T00:01:30.000Z", // 90 seconds later
  });

  assert.equal(result.durationMs, 90000);
});

test("HumanWaitExecutor handles future resolvedAt with zero duration [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor({
    now: () => "2026-04-25T00:00:00.000Z",
    idFactory: () => "approval-future",
  });
  const context = createTestContext();

  executor.requestApproval(context, {
    title: "Title",
    reason: "Reason",
    options: ["approve", "reject"],
    timeoutPolicy: "reject",
  });

  const result = executor.resolveApproval("approval-future", {
    status: "approved",
    resolvedAt: "2025-01-01T00:00:00.000Z", // Before requestedAt
  });

  assert.equal(result.durationMs, 0);
});

test("HumanWaitExecutor uses requestedAt from request when provided [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor({
    now: () => "2026-04-25T12:00:00.000Z",
    idFactory: () => "approval-custom-requested",
  });
  const context = createTestContext();

  const result = executor.requestApproval(context, {
    title: "Title",
    reason: "Reason",
    options: ["approve", "reject"],
    timeoutPolicy: "reject",
    requestedAt: "2026-04-20T10:00:00.000Z",
  });

  assert.equal(result.requestedAt, "2026-04-20T10:00:00.000Z");
});

// ─────────────────────────────────────────────────────────────────────────────
// Options and Metadata Tests
// ─────────────────────────────────────────────────────────────────────────────

test("HumanWaitExecutor uses default options when empty array provided [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor({
    idFactory: () => "approval-default-options",
  });
  const context = createTestContext();

  const result = executor.requestApproval(context, {
    title: "Title",
    reason: "Reason",
    options: [],
    timeoutPolicy: "reject",
  });

  assert.deepStrictEqual(result.options, ["approve", "reject"]);
});

test("HumanWaitExecutor preserves provided options [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor({
    idFactory: () => "approval-custom-options",
  });
  const context = createTestContext();

  const result = executor.requestApproval(context, {
    title: "Title",
    reason: "Reason",
    options: ["option-a", "option-b", "option-c"],
    timeoutPolicy: "reject",
  });

  assert.deepStrictEqual(result.options, ["option-a", "option-b", "option-c"]);
});

test("HumanWaitExecutor defaults requestedBy to null when not provided [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor({
    idFactory: () => "approval-no-requester",
  });
  const context = createTestContext();

  const result = executor.requestApproval(context, {
    title: "Title",
    reason: "Reason",
    options: ["approve", "reject"],
    timeoutPolicy: "reject",
  });

  assert.equal(result.requestedBy, null);
});

test("HumanWaitExecutor uses provided requestedBy [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor({
    idFactory: () => "approval-with-requester",
  });
  const context = createTestContext();

  const result = executor.requestApproval(context, {
    title: "Title",
    reason: "Reason",
    options: ["approve", "reject"],
    timeoutPolicy: "reject",
    requestedBy: "user-operator-1",
  });

  assert.equal(result.requestedBy, "user-operator-1");
});

test("HumanWaitExecutor defaults requestedBy to null when explicitly null [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor({
    idFactory: () => "approval-explicit-null-requester",
  });
  const context = createTestContext();

  const result = executor.requestApproval(context, {
    title: "Title",
    reason: "Reason",
    options: ["approve", "reject"],
    timeoutPolicy: "reject",
    requestedBy: null,
  });

  assert.equal(result.requestedBy, null);
});

test("HumanWaitExecutor defaults metadata to empty object when not provided [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor({
    idFactory: () => "approval-no-metadata",
  });
  const context = createTestContext();

  const result = executor.requestApproval(context, {
    title: "Title",
    reason: "Reason",
    options: ["approve", "reject"],
    timeoutPolicy: "reject",
  });

  assert.deepStrictEqual(result.metadata, {});
});

test("HumanWaitExecutor preserves provided metadata [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor({
    idFactory: () => "approval-with-metadata",
  });
  const context = createTestContext();

  const result = executor.requestApproval(context, {
    title: "Title",
    reason: "Reason",
    options: ["approve", "reject"],
    timeoutPolicy: "reject",
    metadata: {
      priority: "high",
      resourceId: "res-123",
      tags: ["security", "critical"],
    },
  });

  assert.equal(result.metadata.priority, "high");
  assert.equal(result.metadata.resourceId, "res-123");
  assert.deepStrictEqual(result.metadata.tags, ["security", "critical"]);
});

test("HumanWaitExecutor metadata is readonly [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor({
    idFactory: () => "approval-readonly-metadata",
  });
  const context = createTestContext();

  const result = executor.requestApproval(context, {
    title: "Title",
    reason: "Reason",
    options: ["approve", "reject"],
    timeoutPolicy: "reject",
    metadata: { key: "value" },
  });

  // Attempting to modify should not affect internal state
  (result.metadata as Record<string, unknown>).key = "modified";
  assert.equal(result.metadata.key, "value");
});

// ─────────────────────────────────────────────────────────────────────────────
// Timeout Policy Tests
// ─────────────────────────────────────────────────────────────────────────────

test("HumanWaitExecutor preserves timeoutPolicy: reject [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor({
    idFactory: () => "approval-timeout-reject",
  });
  const context = createTestContext();

  const result = executor.requestApproval(context, {
    title: "Title",
    reason: "Reason",
    options: ["approve", "reject"],
    timeoutPolicy: "reject",
  });

  assert.equal(result.timeoutPolicy, "reject");
});

test("HumanWaitExecutor preserves timeoutPolicy: approve [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor({
    idFactory: () => "approval-timeout-approve",
  });
  const context = createTestContext();

  const result = executor.requestApproval(context, {
    title: "Title",
    reason: "Reason",
    options: ["approve", "reject"],
    timeoutPolicy: "approve",
  });

  assert.equal(result.timeoutPolicy, "approve");
});

test("HumanWaitExecutor preserves timeoutPolicy: remain_pending [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor({
    idFactory: () => "approval-timeout-pending",
  });
  const context = createTestContext();

  const result = executor.requestApproval(context, {
    title: "Title",
    reason: "Reason",
    options: ["approve", "reject"],
    timeoutPolicy: "remain_pending",
  });

  assert.equal(result.timeoutPolicy, "remain_pending");
});

// ─────────────────────────────────────────────────────────────────────────────
// Multiple Approval Tests
// ─────────────────────────────────────────────────────────────────────────────

test("HumanWaitExecutor handles multiple simultaneous approvals [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor({
    idFactory: () => "auto-id",
  });
  const context = createTestContext();

  const result1 = executor.requestApproval(context, {
    title: "First Approval",
    reason: "Reason 1",
    options: ["approve", "reject"],
    timeoutPolicy: "reject",
  });

  const result2 = executor.requestApproval(context, {
    title: "Second Approval",
    reason: "Reason 2",
    options: ["yes", "no"],
    timeoutPolicy: "approve",
  });

  assert.notEqual(result1.approvalId, result2.approvalId);
  assert.equal(executor.listPendingApprovals().length, 2);
});

test("HumanWaitExecutor resolves one approval without affecting others [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor({
    now: () => "2026-04-25T00:00:00.000Z",
    idFactory: () => "auto-id",
  });
  const context = createTestContext();

  const result1 = executor.requestApproval(context, {
    title: "First Approval",
    reason: "Reason 1",
    options: ["approve", "reject"],
    timeoutPolicy: "reject",
  });

  executor.requestApproval(context, {
    title: "Second Approval",
    reason: "Reason 2",
    options: ["yes", "no"],
    timeoutPolicy: "approve",
  });

  const resolved = executor.resolveApproval(result1.approvalId, {
    status: "approved",
    resolvedBy: "user-1",
  });

  assert.equal(resolved.status, "approved");
  assert.equal(executor.listPendingApprovals().length, 1);
  assert.equal(executor.getApproval(result1.approvalId), null);
  assert.ok(executor.getApproval("auto-id-1")); // Second approval is still pending
});

test("HumanWaitExecutor.getApproval returns null for resolved approval [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor({
    now: () => "2026-04-25T00:00:00.000Z",
    idFactory: () => "approval-get-null",
  });
  const context = createTestContext();

  executor.requestApproval(context, {
    title: "Title",
    reason: "Reason",
    options: ["approve", "reject"],
    timeoutPolicy: "reject",
  });

  executor.resolveApproval("approval-get-null", {
    status: "approved",
  });

  assert.equal(executor.getApproval("approval-get-null"), null);
});

test("HumanWaitExecutor.getApproval returns null for non-existent approval [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor();

  assert.equal(executor.getApproval("non-existent"), null);
});

test("HumanWaitExecutor.listPendingApprovals returns empty when no approvals [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor();

  const pending = executor.listPendingApprovals();
  assert.deepStrictEqual(pending, []);
});

test("HumanWaitExecutor.listPendingApprovals returns copy not reference [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor({
    idFactory: () => "approval-copy",
  });
  const context = createTestContext();

  executor.requestApproval(context, {
    title: "Title",
    reason: "Reason",
    options: ["approve", "reject"],
    timeoutPolicy: "reject",
  });

  const pending = executor.listPendingApprovals();
  (pending as unknown as { length: number }).length = 0;

  assert.equal(executor.listPendingApprovals().length, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// execute() Method Tests
// ─────────────────────────────────────────────────────────────────────────────

test("HumanWaitExecutor.execute() is an alias for requestApproval() [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor({
    idFactory: () => "approval-execute-alias",
  });
  const context = createTestContext();

  const result = executor.execute(context, {
    title: "Execute Test",
    reason: "Testing execute method",
    options: ["approve", "reject"],
    timeoutPolicy: "reject",
  });

  assert.equal(result.title, "Execute Test");
  assert.equal(result.status, "requested");
});

// ─────────────────────────────────────────────────────────────────────────────
// Resolve Approval Error Handling
// ─────────────────────────────────────────────────────────────────────────────

test("HumanWaitExecutor.resolveApproval() throws for unknown approvalId [human-wait-executor.extended]", () => {
  const executor = new HumanWaitExecutor();

  assert.throws(
    () =>
      executor.resolveApproval("nonexistent-approval", {
        status: "approved",
      }),
    (err: Error) => {
      return err instanceof ValidationError
        && err.code === "human_wait.approval_not_found"
        && err.message.includes("Human wait approval was not found.");
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Custom Now and ID Factory Tests
// ─────────────────────────────────────────────────────────────────────────────

test("HumanWaitExecutor uses custom now function [human-wait-executor.extended]", () => {
  let callCount = 0;
  const executor = new HumanWaitExecutor({
    now: () => {
      callCount++;
      return "2026-04-26T12:00:00.000Z";
    },
    idFactory: () => "approval-custom-now",
  });
  const context = createTestContext();

  executor.requestApproval(context, {
    title: "Title",
    reason: "Reason",
    options: ["approve", "reject"],
    timeoutPolicy: "reject",
  });

  executor.resolveApproval("approval-custom-now", {
    status: "approved",
  });

  assert.ok(callCount > 0);
});

test("HumanWaitExecutor uses custom idFactory function [human-wait-executor.extended]", () => {
  let idCounter = 0;
  const executor = new HumanWaitExecutor({
    idFactory: () => `custom-id-${++idCounter}`,
  });
  const context = createTestContext();

  const result1 = executor.requestApproval(context, {
    title: "Title 1",
    reason: "Reason 1",
    options: ["approve", "reject"],
    timeoutPolicy: "reject",
  });

  const result2 = executor.requestApproval(context, {
    title: "Title 2",
    reason: "Reason 2",
    options: ["approve", "reject"],
    timeoutPolicy: "reject",
  });

  assert.equal(result1.approvalId, "custom-id-1");
  assert.equal(result2.approvalId, "custom-id-2");
});
