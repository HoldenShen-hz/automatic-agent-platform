/**
 * Integration Test: Multi-Party Approval Service
 *
 * Verifies N-of-M multi-party approval workflows where multiple approvers
 * must approve before the request is considered approved.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { MultiPartyApprovalService } from "../../../../../src/platform/five-plane-control-plane/approval-center/multi-party-approval-service.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";

function createTestApprovalRequest(taskId: string, executionId: string | null) {
  return {
    taskId,
    executionId,
    sourceAgentId: "test-agent",
    reason: "Test multi-party approval",
    riskLevel: "high" as const,
    options: ["approve", "reject", "modify"] as const,
    context: { testContext: true },
    timeoutPolicy: "remain_pending" as const,
  };
}

test("multi-party approval: createMultiPartyRequest creates approval with N required", () => {
  const workspace = createTempWorkspace("mpa-create-");

  try {
    const dbPath = join(workspace, "mpa-create.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MultiPartyApprovalService(db, store);

    seedTaskAndExecution(db, store, { taskId: "mpa-task-1", executionId: "mpa-exec-1" });

    const approval = service.createMultiPartyRequest(
      createTestApprovalRequest("mpa-task-1", "mpa-exec-1"),
      { requiredApprovals: 3 },
    );

    assert.ok(approval.approvalId.startsWith("approval_"));
    assert.strictEqual(approval.requiredApprovals, 3);
    assert.strictEqual(approval.approvalsReceived, 0);
    assert.strictEqual(approval.context.multiPartyEnabled, true);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("multi-party approval: first approval increments count", () => {
  const workspace = createTempWorkspace("mpa-first-");

  try {
    const dbPath = join(workspace, "mpa-first.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MultiPartyApprovalService(db, store);

    seedTaskAndExecution(db, store, { taskId: "mpa-task-2", executionId: "mpa-exec-2" });

    const approval = service.createMultiPartyRequest(
      createTestApprovalRequest("mpa-task-2", "mpa-exec-2"),
      { requiredApprovals: 2 },
    );

    service.applyDecision({
      approvalId: approval.approvalId,
      decisionType: "confirmed",
      confirmed: true,
      respondedBy: "approver-1",
      respondedAt: nowIso(),
    });

    const progress = service.getApprovalProgress(approval.approvalId);
    assert.ok(progress);
    assert.strictEqual(progress!.received, 1);
    assert.strictEqual(progress!.required, 2);
    assert.strictEqual(progress!.remaining, 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("multi-party approval: reaching required approvals finalizes as approved", () => {
  const workspace = createTempWorkspace("mpa-approved-");

  try {
    const dbPath = join(workspace, "mpa-approved.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MultiPartyApprovalService(db, store);

    seedTaskAndExecution(db, store, { taskId: "mpa-task-3", executionId: "mpa-exec-3" });

    const approval = service.createMultiPartyRequest(
      createTestApprovalRequest("mpa-task-3", "mpa-exec-3"),
      { requiredApprovals: 2 },
    );

    service.applyDecision({
      approvalId: approval.approvalId,
      decisionType: "confirmed",
      confirmed: true,
      respondedBy: "approver-1",
      respondedAt: nowIso(),
    });

    service.applyDecision({
      approvalId: approval.approvalId,
      decisionType: "confirmed",
      confirmed: true,
      respondedBy: "approver-2",
      respondedAt: nowIso(),
    });

    const pending = service.getPendingApproval(approval.approvalId);
    assert.ok(pending);
    assert.strictEqual(pending!.status, "approved");
    assert.strictEqual(pending!.approvalsReceived, 2);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("multi-party approval: any rejection finalizes as rejected", () => {
  const workspace = createTempWorkspace("mpa-rejected-");

  try {
    const dbPath = join(workspace, "mpa-rejected.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MultiPartyApprovalService(db, store);

    seedTaskAndExecution(db, store, { taskId: "mpa-task-4", executionId: "mpa-exec-4" });

    const approval = service.createMultiPartyRequest(
      createTestApprovalRequest("mpa-task-4", "mpa-exec-4"),
      { requiredApprovals: 2 },
    );

    service.applyDecision({
      approvalId: approval.approvalId,
      decisionType: "confirmed",
      confirmed: true,
      respondedBy: "approver-1",
      respondedAt: nowIso(),
    });

    service.applyDecision({
      approvalId: approval.approvalId,
      decisionType: "rejected",
      respondedBy: "approver-2",
      respondedAt: nowIso(),
    });

    const pending = service.getPendingApproval(approval.approvalId);
    assert.ok(pending);
    assert.strictEqual(pending!.status, "rejected");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("multi-party approval: expired decision finalizes as rejected", () => {
  const workspace = createTempWorkspace("mpa-expired-");

  try {
    const dbPath = join(workspace, "mpa-expired.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MultiPartyApprovalService(db, store);

    seedTaskAndExecution(db, store, { taskId: "mpa-task-5", executionId: "mpa-exec-5" });

    const approval = service.createMultiPartyRequest(
      createTestApprovalRequest("mpa-task-5", "mpa-exec-5"),
      { requiredApprovals: 2 },
    );

    service.applyDecision({
      approvalId: approval.approvalId,
      decisionType: "expired",
      respondedBy: "system",
      respondedAt: nowIso(),
    });

    const pending = service.getPendingApproval(approval.approvalId);
    assert.ok(pending);
    assert.strictEqual(pending!.status, "rejected");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("multi-party approval: isApproverInGroups allows any approver when groups empty", () => {
  const workspace = createTempWorkspace("mpa-groups-");

  try {
    const dbPath = join(workspace, "mpa-groups.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MultiPartyApprovalService(db, store);

    const result = service.isApproverInGroups("any-approver", []);

    assert.strictEqual(result, true);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("multi-party approval: isApproverInGroups restricts to group members", () => {
  const workspace = createTempWorkspace("mpa-groups-");

  try {
    const dbPath = join(workspace, "mpa-groups.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MultiPartyApprovalService(db, store);

    const inGroup = service.isApproverInGroups("engineering", ["engineering", "security"]);
    const outGroup = service.isApproverInGroups("marketing", ["engineering", "security"]);

    assert.strictEqual(inGroup, true);
    assert.strictEqual(outGroup, false);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("multi-party approval: getApprovalProgress returns null for unknown approval", () => {
  const workspace = createTempWorkspace("mpa-unknown-");

  try {
    const dbPath = join(workspace, "mpa-unknown.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MultiPartyApprovalService(db, store);

    const progress = service.getApprovalProgress("unknown-approval");

    assert.strictEqual(progress, null);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("multi-party approval: partial approval emits partial_approval event", () => {
  const workspace = createTempWorkspace("mpa-partial-");

  try {
    const dbPath = join(workspace, "mpa-partial.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MultiPartyApprovalService(db, store);

    seedTaskAndExecution(db, store, { taskId: "mpa-task-6", executionId: "mpa-exec-6" });

    const approval = service.createMultiPartyRequest(
      createTestApprovalRequest("mpa-task-6", "mpa-exec-6"),
      { requiredApprovals: 2 },
    );

    service.applyDecision({
      approvalId: approval.approvalId,
      decisionType: "confirmed",
      confirmed: true,
      respondedBy: "approver-1",
      respondedAt: nowIso(),
    });

    const events = store.listEventsForTask("mpa-task-6");
    const partialEvent = events.find((e) => e.eventType === "decision:partial_approval");
    assert.ok(partialEvent, "Should have partial_approval event");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
