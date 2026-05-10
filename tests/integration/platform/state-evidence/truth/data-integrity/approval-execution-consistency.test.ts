/**
 * Data Integrity Test: Approval-Execution Consistency
 *
 * Verifies that approval records and execution records remain consistent
 * when approvals are created, approved, and rejected.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SqliteDatabase } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../../src/platform/contracts/types/ids.js";

test("data integrity: approval and execution are linked correctly", () => {
  const workspace = createTempWorkspace("aa-approval-exec-");
  try {
    const db = new SqliteDatabase(join(workspace, "approval-exec.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const executionId = newId("exec");
    const approvalId = newId("appr");
    const now = nowIso();

    // Create task
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Test task for approval",
        status: "awaiting_decision",
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

      store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        harnessRunId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "blocked",
        inputRef: null,
        traceId: "trace-approval",
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        budgetReservationId: null,
        budgetLedgerId: null,
        requiresApproval: 1,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      store.insertApproval({
        id: approvalId,
        taskId,
        executionId,
        status: "requested",
        requestJson: JSON.stringify({ reason: "high priority task" }),
        responseJson: null,
        timeoutPolicy: "auto_approve",
        createdAt: now,
        respondedAt: null,
      });
    });

    // Verify linkage
    const execution = store.getExecution(executionId);
    assert.ok(execution, "Execution should exist");
    assert.equal(execution!.taskId, taskId, "Execution should link to task");
    assert.equal(execution!.status, "blocked", "Execution should be blocked during approval");

    const approvals = store.listApprovalsByTask(taskId);
    assert.equal(approvals.length, 1, "Should have one approval");
    assert.equal(approvals[0]!.executionId, executionId, "Approval should link to execution");
    assert.equal(approvals[0]!.status, "requested", "Approval should be in requested status");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("data integrity: approval status transitions are reflected in execution", () => {
  const workspace = createTempWorkspace("aa-approval-status-");
  try {
    const db = new SqliteDatabase(join(workspace, "approval-status.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const executionId = newId("exec");
    const approvalId = newId("appr");
    const now = nowIso();

    // Setup: create task, execution, and approval
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Approval status test",
        status: "awaiting_decision",
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

      store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "blocked",
        inputRef: null,
        traceId: "trace-status",
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 1,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      store.insertApproval({
        id: approvalId,
        taskId,
        executionId,
        status: "requested",
        requestJson: JSON.stringify({}),
        responseJson: null,
        timeoutPolicy: "auto_approve",
        createdAt: now,
        respondedAt: null,
      });
    });

    // Simulate approval granted by updating approval status
    db.transaction(() => {
      store.updateApprovalDecision({
        approvalId,
        status: "approved",
        responseJson: JSON.stringify({ grantedBy: "operator", reason: "approved" }),
        respondedAt: nowIso(),
      });
    });

    const approval = store.getApproval(approvalId);
    assert.equal(approval!.status, "approved", "Approval should be granted");
    assert.ok(approval!.respondedAt, "Approval should have respondedAt timestamp");
    assert.ok(approval!.responseJson, "Approval should have response JSON");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("data integrity: rejected approval has correct status and response", () => {
  const workspace = createTempWorkspace("aa-approval-reject-");
  try {
    const db = new SqliteDatabase(join(workspace, "approval-reject.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const executionId = newId("exec");
    const approvalId = newId("appr");
    const now = nowIso();

    // Setup
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Approval rejection test",
        status: "awaiting_decision",
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

      store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "blocked",
        inputRef: null,
        traceId: "trace-reject",
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 1,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      store.insertApproval({
        id: approvalId,
        taskId,
        executionId,
        status: "requested",
        requestJson: JSON.stringify({}),
        responseJson: null,
        timeoutPolicy: "auto_approve",
        createdAt: now,
        respondedAt: null,
      });
    });

    // Simulate rejection
    db.transaction(() => {
      store.updateApprovalDecision({
        approvalId,
        status: "rejected",
        responseJson: JSON.stringify({ deniedBy: "operator", reason: "policy violation" }),
        respondedAt: nowIso(),
      });
    });

    const approval = store.getApproval(approvalId);
    assert.equal(approval!.status, "rejected", "Approval should be denied");
    assert.ok(approval!.respondedAt, "Approval should have respondedAt");

    const response = JSON.parse(approval!.responseJson!);
    assert.equal(response.deniedBy, "operator", "Response should include deniedBy");
    assert.equal(response.reason, "policy violation", "Response should include reason");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("data integrity: multiple approvals for same execution are tracked", () => {
  const workspace = createTempWorkspace("aa-multi-approval-");
  try {
    const db = new SqliteDatabase(join(workspace, "multi-approval.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const executionId = newId("exec");
    const now = nowIso();

    // Setup task and execution
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Multi approval test",
        status: "awaiting_decision",
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

      store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "blocked",
        inputRef: null,
        traceId: "trace-multi",
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 1,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Create multiple approvals
    const approval1Id = newId("appr");
    const approval2Id = newId("appr");

    db.transaction(() => {
      store.insertApproval({
        id: approval1Id,
        taskId,
        executionId,
        status: "requested",
        requestJson: JSON.stringify({ type: "tool_use" }),
        responseJson: null,
        timeoutPolicy: "auto_approve",
        createdAt: now,
        respondedAt: null,
      });

      store.insertApproval({
        id: approval2Id,
        taskId,
        executionId,
        status: "requested",
        requestJson: JSON.stringify({ type: "file_write" }),
        responseJson: null,
        timeoutPolicy: "auto_approve",
        createdAt: now,
        respondedAt: null,
      });
    });

    const approvals = store.listApprovalsByTask(taskId);
    assert.equal(approvals.length, 2, "Should have 2 approvals");
    assert.ok(approvals.every((a) => a.executionId === executionId), "All approvals should link to same execution");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
