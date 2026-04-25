/**
 * Smoke Test: Approval Flow
 *
 * Verifies basic approval flow through the platform.
 * Part of the smoke test suite in tests/integration/platform/execution/smoke/.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { ApprovalService } from "../../../../../src/platform/control-plane/approval-center/approval-service.js";
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

    // Approve the request
    const decision: ApprovalService["ApprovalDecision"] = {
      approvalId: approvalRequest.approvalId,
      decisionType: "option_selected",
      selectedOptionId: "approve",
      respondedBy: "operator-1",
      respondedAt: nowIso(),
    };

    approvalService.respond(approvalRequest.approvalId, decision);

    // Verify the approval was recorded
    const pending = approvalService.listPendingApprovals(taskId);
    assert.strictEqual(pending.length, 0, "Approved request should not be pending");

    const history = approvalService.listApprovalHistory(taskId, 10);
    const latestDecision = history.find((h) => h.approvalId === approvalRequest.approvalId);
    assert.ok(latestDecision, "Decision should be in history");

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
    const decision = {
      approvalId: approvalRequest.approvalId,
      decisionType: "option_selected" as const,
      selectedOptionId: "reject",
      respondedBy: "operator-1",
      respondedAt: nowIso(),
    };

    approvalService.respond(approvalRequest.approvalId, decision);

    // Verify the rejection was recorded
    const history = approvalService.listApprovalHistory(taskId, 10);
    const latestDecision = history.find((h) => h.approvalId === approvalRequest.approvalId);
    assert.ok(latestDecision, "Decision should be in history");

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

    // Verify all approvals exist
    for (let i = 0; i < riskLevels.length; i++) {
      const pending = approvalService.listPendingApprovals(taskIds[i]);
      assert.ok(pending.length > 0, `Pending approval for risk ${riskLevels[i]} should exist`);
      assert.strictEqual(pending[0]!.riskLevel, riskLevels[i]);
    }

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("smoke: approval with auto-reject timeout policy expires", () => {
  const workspace = createTempWorkspace("smoke-approval-timeout-");

  try {
    const dbPath = join(workspace, "approval_timeout.db");
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
        title: "Approval timeout test",
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

    // Create approval with reject timeout policy
    const approvalRequest = approvalService.createRequest({
      taskId,
      executionId: null,
      sourceAgentId: "operator_gate",
      reason: "Timed operation",
      riskLevel: "medium",
      options: ["approve", "reject"],
      context: {},
      timeoutPolicy: "reject",
    });

    assert.strictEqual(approvalRequest.timeoutPolicy, "reject");

    // Process expired approvals
    approvalService.processExpiredApprovals();

    // Verify it's been processed (expired with reject)
    const history = approvalService.listApprovalHistory(taskId, 10);
    const expiredDecision = history.find(
      (h) => h.approvalId === approvalRequest.approvalId && h.decisionType === "expired",
    );
    assert.ok(expiredDecision, "Expired approval should be in history with expired decision type");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
