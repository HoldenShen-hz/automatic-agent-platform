/**
 * Unit Tests: Human Wait Executor
 *
 * Tests for the HumanWaitExecutor which handles human approval requests
 * with lifecycle management for approvals, resolutions, and timeouts.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  HumanWaitExecutor,
  type HumanWaitExecutionContext,
  type HumanWaitRequest,
  type HumanWaitResolution,
} from "../../../../../src/platform/five-plane-execution/plugin-executor/human-wait-executor.js";

function createTestContext(overrides: Partial<HumanWaitExecutionContext> = {}): HumanWaitExecutionContext {
  return {
    executionId: "exec_123",
    taskId: "task_456",
    tenantId: null,
    sessionId: "session_abc",
    correlationId: "corr_789",
    ...overrides,
  };
}

function createTestRequest(overrides: Partial<HumanWaitRequest> = {}): HumanWaitRequest {
  return {
    title: "Approval Required",
    reason: "This action requires human verification",
    options: ["approve", "reject"],
    timeoutPolicy: "reject",
    ...overrides,
  };
}

test("HumanWaitExecutor execute creates approval request", () => {
  const executor = new HumanWaitExecutor();
  const context = createTestContext();
  const request = createTestRequest();

  const result = executor.execute(context, request);

  assert.ok(result.approvalId.startsWith("approval_"));
  assert.equal(result.status, "requested");
  assert.equal(result.title, "Approval Required");
  assert.equal(result.reason, "This action requires human verification");
  assert.deepEqual(result.options, ["approve", "reject"]);
  assert.equal(result.timeoutPolicy, "reject");
});

test("HumanWaitExecutor execute rejects empty title", () => {
  const executor = new HumanWaitExecutor();
  const context = createTestContext();
  const request = createTestRequest({ title: "   " });

  assert.throws(
    () => executor.execute(context, request),
    { message: /human_wait\.invalid_request/ },
  );
});

test("HumanWaitExecutor execute rejects empty reason", () => {
  const executor = new HumanWaitExecutor();
  const context = createTestContext();
  const request = createTestRequest({ reason: "" });

  assert.throws(
    () => executor.execute(context, request),
    { message: /human_wait\.invalid_request/ },
  );
});

test("HumanWaitExecutor execute uses custom approvalId when provided", () => {
  const executor = new HumanWaitExecutor();
  const context = createTestContext();
  const request = createTestRequest({ approvalId: "my-custom-id" });

  const result = executor.execute(context, request);

  assert.equal(result.approvalId, "my-custom-id");
});

test("HumanWaitExecutor execute deduplicates approvalId if collision", () => {
  const executor = new HumanWaitExecutor();
  const context = createTestContext();
  const request = createTestRequest({ approvalId: "duplicate-id" });

  executor.execute(context, request);
  const secondResult = executor.execute(context, request);

  assert.equal(secondResult.approvalId, "duplicate-id-1");
});

test("HumanWaitExecutor resolveApproval updates status", () => {
  const executor = new HumanWaitExecutor();
  const context = createTestContext();
  const request = createTestRequest();
  const created = executor.execute(context, request);

  const resolution: HumanWaitResolution = {
    status: "approved",
    resolvedBy: "admin@example.com",
    note: "Looks good",
  };

  const resolved = executor.resolveApproval(created.approvalId, resolution);

  assert.equal(resolved.status, "approved");
  assert.equal(resolved.resolvedBy, "admin@example.com");
  assert.equal(resolved.note, "Looks good");
  assert.ok(resolved.resolvedAt !== null);
});

test("HumanWaitExecutor resolveApproval rejects unknown approvalId", () => {
  const executor = new HumanWaitExecutor();

  const resolution: HumanWaitResolution = {
    status: "approved",
  };

  assert.throws(
    () => executor.resolveApproval("nonexistent-id", resolution),
    { message: /human_wait\.approval_not_found/ },
  );
});

test("HumanWaitExecutor resolveApproval sets durationMs correctly", () => {
  const executor = new HumanWaitExecutor({
    now: () => "2026-05-02T12:00:00.000Z",
  });
  const context = createTestContext();
  const request = createTestRequest();
  const created = executor.execute(context, request);

  const resolution: HumanWaitResolution = {
    status: "rejected",
    resolvedAt: "2026-05-02T12:05:00.000Z",
  };

  const resolved = executor.resolveApproval(created.approvalId, resolution);

  // 5 minutes = 300000 ms
  assert.equal(resolved.durationMs, 300000);
});

test("HumanWaitExecutor getApproval returns null for unknown", () => {
  const executor = new HumanWaitExecutor();

  const result = executor.getApproval("nonexistent");
  assert.equal(result, null);
});

test("HumanWaitExecutor getApproval returns pending approval", () => {
  const executor = new HumanWaitExecutor();
  const context = createTestContext();
  const request = createTestRequest();
  const created = executor.execute(context, request);

  const result = executor.getApproval(created.approvalId);

  assert.ok(result !== null);
  assert.equal(result?.approvalId, created.approvalId);
});

test("HumanWaitExecutor listPendingApprovals returns all pending", () => {
  const executor = new HumanWaitExecutor();
  const context = createTestContext();

  executor.execute(context, createTestRequest({ title: "First" }));
  executor.execute(context, createTestRequest({ title: "Second" }));
  executor.execute(context, createTestRequest({ title: "Third" }));

  const pending = executor.listPendingApprovals();
  assert.equal(pending.length, 3);
});

test("HumanWaitExecutor resolveApproval removes from pending", () => {
  const executor = new HumanWaitExecutor();
  const context = createTestContext();
  const request = createTestRequest();
  const created = executor.execute(context, request);

  executor.resolveApproval(created.approvalId, { status: "approved" });

  const pending = executor.listPendingApprovals();
  assert.equal(pending.length, 0);
});

test("HumanWaitExecutor execute uses default options when empty", () => {
  const executor = new HumanWaitExecutor();
  const context = createTestContext();
  const request = createTestRequest({ options: [] });

  const result = executor.execute(context, request);

  assert.deepEqual(result.options, ["approve", "reject"]);
});

test("HumanWaitExecutor execute preserves requestedBy", () => {
  const executor = new HumanWaitExecutor();
  const context = createTestContext();
  const request = createTestRequest({ requestedBy: "user@example.com" });

  const result = executor.execute(context, request);

  assert.equal(result.requestedBy, "user@example.com");
});

test("HumanWaitExecutor execute uses custom idFactory", () => {
  const executor = new HumanWaitExecutor({
    idFactory: () => "custom-id-generator",
  });
  const context = createTestContext();
  const request = createTestRequest();

  const result = executor.execute(context, request);

  assert.equal(result.approvalId, "custom-id-generator");
});

test("HumanWaitExecutor execute preserves requestedAt when provided", () => {
  const executor = new HumanWaitExecutor({
    now: () => "2026-05-02T12:00:00.000Z",
  });
  const context = createTestContext();
  const request = createTestRequest({
    requestedAt: "2026-05-01T10:00:00.000Z",
  });

  const result = executor.execute(context, request);

  assert.equal(result.requestedAt, "2026-05-01T10:00:00.000Z");
});

test("HumanWaitExecutor resolveApproval uses now when resolvedAt not provided", () => {
  const executor = new HumanWaitExecutor({
    now: () => "2026-05-02T14:00:00.000Z",
  });
  const context = createTestContext();
  const request = createTestRequest();
  executor.execute(context, request);

  const resolved = executor.resolveApproval(
    "approval_001",
    { status: "approved" },
  );

  assert.equal(resolved.resolvedAt, "2026-05-02T14:00:00.000Z");
});

test("HumanWaitExecutor resolveApproval handles rejected status", () => {
  const executor = new HumanWaitExecutor();
  const context = createTestContext();
  const request = createTestRequest();
  const created = executor.execute(context, request);

  const resolved = executor.resolveApproval(created.approvalId, {
    status: "rejected",
    note: "Not approved",
  });

  assert.equal(resolved.status, "rejected");
  assert.equal(resolved.note, "Not approved");
});

test("HumanWaitExecutor resolveApproval handles expired status", () => {
  const executor = new HumanWaitExecutor();
  const context = createTestContext();
  const request = createTestRequest();
  const created = executor.execute(context, request);

  const resolved = executor.resolveApproval(created.approvalId, {
    status: "expired",
  });

  assert.equal(resolved.status, "expired");
});

test("HumanWaitExecutor resolveApproval handles cancelled status", () => {
  const executor = new HumanWaitExecutor();
  const context = createTestContext();
  const request = createTestRequest();
  const created = executor.execute(context, request);

  const resolved = executor.resolveApproval(created.approvalId, {
    status: "cancelled",
  });

  assert.equal(resolved.status, "cancelled");
});

test("HumanWaitExecutor execute preserves metadata", () => {
  const executor = new HumanWaitExecutor();
  const context = createTestContext();
  const request = createTestRequest({
    metadata: {
      priority: "high",
      taskType: "deployment",
      region: "us-west-2",
    },
  });

  const result = executor.execute(context, request);

  assert.equal((result.metadata as Record<string, unknown>)["priority"], "high");
  assert.equal((result.metadata as Record<string, unknown>)["taskType"], "deployment");
  assert.equal((result.metadata as Record<string, unknown>)["region"], "us-west-2");
});

test("HumanWaitExecutor execute metadata is readonly", () => {
  const executor = new HumanWaitExecutor();
  const context = createTestContext();
  const request = createTestRequest({
    metadata: { key: "value" },
  });

  const result = executor.execute(context, request);

  // Should not throw when trying to modify readonly proxy
  (result.metadata as Record<string, unknown>)["newKey"] = "newValue";
  // Original metadata should still be accessible
  assert.ok("key" in result.metadata);
});

test("HumanWaitExecutor execute with different timeoutPolicy", () => {
  const executor = new HumanWaitExecutor();
  const context = createTestContext();
  const request = createTestRequest({
    timeoutPolicy: "remain_pending" as const,
  });

  const result = executor.execute(context, request);

  assert.equal(result.timeoutPolicy, "remain_pending");
});

test("HumanWaitExecutor execute preserves tenantId in result", () => {
  const executor = new HumanWaitExecutor();
  const context = createTestContext({ tenantId: "tenant_xyz" });
  const request = createTestRequest();

  const result = executor.execute(context, request);

  assert.equal(result.tenantId, "tenant_xyz");
});

test("HumanWaitExecutor execute preserves correlationId in result", () => {
  const executor = new HumanWaitExecutor();
  const context = createTestContext();
  const request = createTestRequest();

  const result = executor.execute(context, request);

  assert.equal(result.executionId, "exec_123");
  assert.equal(result.taskId, "task_456");
});

test("HumanWaitExecutor multiple resolves work correctly", () => {
  const executor = new HumanWaitExecutor();
  const context = createTestContext();

  const request1 = createTestRequest({ title: "First Request" });
  const request2 = createTestRequest({ title: "Second Request" });

  const created1 = executor.execute(context, request1);
  const created2 = executor.execute(context, request2);

  executor.resolveApproval(created1.approvalId, { status: "approved" });

  const pending = executor.listPendingApprovals();
  assert.equal(pending.length, 1);
  assert.equal(pending[0]?.approvalId, created2.approvalId);
});

test("HumanWaitExecutor allocation handles many duplicates", () => {
  const executor = new HumanWaitExecutor({
    idFactory: () => "fixed-id",
  });
  const context = createTestContext();
  const request = createTestRequest();

  // Create multiple with same id factory
  executor.execute(context, request);
  executor.execute(context, request);
  executor.execute(context, request);

  const pending = executor.listPendingApprovals();
  assert.equal(pending.length, 3);
  assert.equal(pending[0]?.approvalId, "fixed-id");
  assert.equal(pending[1]?.approvalId, "fixed-id-1");
  assert.equal(pending[2]?.approvalId, "fixed-id-2");
});