/**
 * Smoke Test: Approval Flow
 *
 * Verifies basic approval flow through the platform.
 * Part of the smoke test suite in tests/integration/platform/five-plane-execution/smoke/.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { ApprovalService } from "../../../../../src/platform/five-plane-control-plane/approval-center/approval-service.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";

test("smoke: approval request can be created", () => {
  const workspace = createTempWorkspace("smoke-approval-create-");

  try {
    const dbPath = join(workspace, "approval.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const approvalService = new ApprovalService(db, store);

    const taskId = newId("task");
    const now = nowIso();

    // Create task
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Approval test task",
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
    });

    // Create approval request
    const approvalRequest = approvalService.createRequest({
      taskId,
      executionId: null,
      sourceAgentId: "operator_gate",
      reason: "Need explicit confirmation before production action.",
      riskLevel: "medium",
      options: ["approve", "reject"],
      context: {
        surface: "api",
        feature: "production_deploy",
      },
      timeoutPolicy: "reject",
    });

    assert.ok(approvalRequest.approvalId, "Approval should have an ID");
    assert.strictEqual(approvalRequest.taskId, taskId);
    assert.strictEqual(approvalRequest.reason, "Need explicit confirmation before production action.");
    assert.strictEqual(approvalRequest.riskLevel, "medium");
    assert.deepStrictEqual(approvalRequest.options, ["approve", "reject"]);
    assert.strictEqual(approvalRequest.timeoutPolicy, "reject");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("smoke: approval request can be approved", () => {
  const workspace = createTempWorkspace("smoke-approval-approve-");

  try {
    const dbPath = join(workspace, "approval_approve.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const approvalService = new ApprovalService(db, store);

    const taskId = newId("task");
    const now = nowIso();

    // Create task
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Approval approve test",
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
    });

    // Create approval request
    const approvalRequest = approvalService.createRequest({
      taskId,
      executionId: null,
      sourceAgentId: "operator_gate",
      reason: "Deploy to production",
      riskLevel: "high",
      options: ["approve", "reject"],
      context: { surface: "cli" },
      timeoutPolicy: "reject",
    });

    // Verify it's in requested status
    let approval = store.getApproval(approvalRequest.approvalId);
    assert.ok(approval, "Approval should exist");
    assert.strictEqual(approval!.status, "requested");

    // Approve the request
    approvalService.applyDecision({
      approvalId: approvalRequest.approvalId,
      decisionType: "option_selected",
      selectedOptionId: "approve",
      respondedBy: "operator-1",
      respondedAt: nowIso(),
    });

    // Verify the status changed
    approval = store.getApproval(approvalRequest.approvalId);
    assert.ok(approval, "Approval should still exist");
    assert.strictEqual(approval!.status, "approved");

    // Verify it's no longer in pending list
    const allApprovals = store.listApprovalsByTask(taskId);
    const pendingApprovals = allApprovals.filter((a) => a.status === "requested");
    assert.strictEqual(pendingApprovals.length, 0, "Approved request should not be pending");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("smoke: approval request can be rejected", () => {
  const workspace = createTempWorkspace("smoke-approval-reject-");

  try {
    const dbPath = join(workspace, "approval_reject.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const approvalService = new ApprovalService(db, store);

    const taskId = newId("task");
    const now = nowIso();

    // Create task
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Approval reject test",
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
    });

    // Create approval request
    const approvalRequest = approvalService.createRequest({
      taskId,
      executionId: null,
      sourceAgentId: "operator_gate",
      reason: "Delete production resource",
      riskLevel: "critical",
      options: ["approve", "reject"],
      context: { surface: "api" },
      timeoutPolicy: "reject",
    });

    // Reject the request
    approvalService.applyDecision({
      approvalId: approvalRequest.approvalId,
      decisionType: "rejected",
      respondedBy: "operator-1",
      respondedAt: nowIso(),
    });

    // Verify the status changed to rejected
    const approval = store.getApproval(approvalRequest.approvalId);
    assert.ok(approval, "Approval should exist");
    assert.strictEqual(approval!.status, "rejected");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("smoke: approval request with different risk levels can be created", () => {
  const workspace = createTempWorkspace("smoke-approval-risk-");

  try {
    const dbPath = join(workspace, "approval_risk.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const approvalService = new ApprovalService(db, store);

    const riskLevels: Array<"low" | "medium" | "high" | "critical"> = ["low", "medium", "high", "critical"];
    const taskIds: string[] = [];
    const now = nowIso();

    for (const riskLevel of riskLevels) {
      const taskId = newId("task");
      taskIds.push(taskId);

      db.transaction(() => {
        store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general_ops",
          title: `Risk ${riskLevel} test`,
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
      });

      approvalService.createRequest({
        taskId,
        executionId: null,
        sourceAgentId: "operator_gate",
        reason: `${riskLevel} risk operation`,
        riskLevel,
        options: ["approve", "reject"],
        context: {},
        timeoutPolicy: "reject",
      });
    }

    // Verify all approvals exist and are in requested status
    for (let i = 0; i < riskLevels.length; i++) {
      const approvals = store.listApprovalsByTask(taskIds[i]!);
      assert.ok(approvals.length > 0, `Approval for risk ${riskLevels[i]} should exist`);

      const pending = approvals.filter((a) => a.status === "requested");
      assert.ok(pending.length > 0, `Pending approval for risk ${riskLevels[i]} should exist`);

      // Parse the request JSON to check risk level
      const request = JSON.parse(pending[0]!.requestJson);
      assert.strictEqual(request.riskLevel, riskLevels[i]);
    }

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("smoke: approval response is recorded", () => {
  const workspace = createTempWorkspace("smoke-approval-response-");

  try {
    const dbPath = join(workspace, "approval_response.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const approvalService = new ApprovalService(db, store);

    const taskId = newId("task");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Approval response test",
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
    });

    const approvalRequest = approvalService.createRequest({
      taskId,
      executionId: null,
      sourceAgentId: "operator_gate",
      reason: "Record response test",
      riskLevel: "medium",
      options: ["approve", "reject"],
      context: {},
      timeoutPolicy: "reject",
    });

    // Apply decision
    approvalService.applyDecision({
      approvalId: approvalRequest.approvalId,
      decisionType: "option_selected",
      selectedOptionId: "approve",
      respondedBy: "operator-1",
      respondedAt: nowIso(),
    });

    // Verify response is recorded
    const approval = store.getApproval(approvalRequest.approvalId);
    assert.ok(approval, "Approval should exist");
    assert.ok(approval!.responseJson, "Response should be recorded");
    assert.ok(approval!.respondedAt, "RespondedAt should be set");

    // Parse response and verify
    const response = JSON.parse(approval!.responseJson);
    assert.strictEqual(response.decisionType, "option_selected");
    assert.strictEqual(response.selectedOptionId, "approve");
    assert.strictEqual(response.respondedBy, "operator-1");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("smoke: multiple approvals for same task can coexist", () => {
  const workspace = createTempWorkspace("smoke-approval-multiple-");

  try {
    const dbPath = join(workspace, "approval_multiple.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const approvalService = new ApprovalService(db, store);

    const taskId = newId("task");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Multiple approvals test",
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
    });

    // Create multiple approval requests
    const approvalIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const approval = approvalService.createRequest({
        taskId,
        executionId: null,
        sourceAgentId: "operator_gate",
        reason: `Multi-approval ${i}`,
        riskLevel: "medium",
        options: ["approve", "reject"],
        context: { index: i },
        timeoutPolicy: "reject",
      });
      approvalIds.push(approval.approvalId);
    }

    // Verify all exist
    const approvals = store.listApprovalsByTask(taskId);
    assert.strictEqual(approvals.length, 3, "Should have 3 approvals");

    // Approve one
    approvalService.applyDecision({
      approvalId: approvalIds[0]!,
      decisionType: "option_selected",
      selectedOptionId: "approve",
      respondedBy: "operator-1",
      respondedAt: nowIso(),
    });

    // Verify status changed for only the first one
    const updatedApprovals = store.listApprovalsByTask(taskId);
    const approvedCount = updatedApprovals.filter((a) => a.status === "approved").length;
    const pendingCount = updatedApprovals.filter((a) => a.status === "requested").length;

    assert.strictEqual(approvedCount, 1, "Should have 1 approved");
    assert.strictEqual(pendingCount, 2, "Should have 2 pending");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
