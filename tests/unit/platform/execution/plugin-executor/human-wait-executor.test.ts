import assert from "node:assert/strict";
import test from "node:test";

import { HumanWaitExecutor } from "../../../../../src/platform/five-plane-execution/plugin-executor/human-wait-executor.js";

test("HumanWaitExecutor creates pending approvals as a formal execution result", () => {
  const executor = new HumanWaitExecutor({
    now: () => "2026-04-25T00:00:00.000Z",
    idFactory: () => "approval-fixed",
  });

  const result = executor.execute(
    { executionId: "exec-1", taskId: "task-1", tenantId: "tenant-1" },
    { title: "Approval Needed", reason: "high-risk tool", options: ["approve", "reject"], timeoutPolicy: "reject" },
  );

  assert.equal(result.approvalId, "approval-fixed");
  assert.equal(result.status, "requested");
  assert.equal(executor.listPendingApprovals().length, 1);
});

test("HumanWaitExecutor resolves approvals and removes them from pending state", () => {
  let currentTime = "2026-04-25T00:00:00.000Z";
  const executor = new HumanWaitExecutor({
    now: () => currentTime,
    idFactory: () => "approval-fixed",
  });

  executor.requestApproval(
    { executionId: "exec-1", taskId: "task-1", tenantId: null },
    { title: "Approval Needed", reason: "takeover", options: ["approve"], timeoutPolicy: "remain_pending" },
  );
  currentTime = "2026-04-25T00:00:05.000Z";

  const result = executor.resolveApproval("approval-fixed", {
    status: "approved",
    resolvedBy: "operator-1",
    note: "looks safe",
  });

  assert.equal(result.status, "approved");
  assert.equal(result.resolvedBy, "operator-1");
  assert.equal(result.durationMs, 5000);
  assert.equal(executor.getApproval("approval-fixed"), null);
});
