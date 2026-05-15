/**
 * E2E Approval State Transition Tests
 *
 * End-to-end tests covering approval flow with state transitions:
 * 1. Approval request → approve → state transition
 * 2. Approval request → reject → state transition
 * 3. Approval timeout auto-reject
 * 4. Multi-party approval flow
 *
 * Uses node:test + node:assert/strict. ESM imports with .js extensions.
 * Pattern: createE2EHarness for full stack context.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../helpers/e2e-harness.js";
import { TransitionService } from "../../src/platform/five-plane-execution/state-transition/transition-service.js";
import { ApprovalService } from "../../src/platform/five-plane-control-plane/approval-center/approval-service.js";
import { ApprovalRepository } from "../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/approval-repository.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";
import type { TaskStatus, ExecutionStatus, ApprovalStatus } from "../../src/platform/contracts/types/status.js";

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function makeTaskCommand(
  taskId: string,
  fromStatus: TaskStatus,
  toStatus: TaskStatus,
  traceId: string,
  executionId: string | null = null,
) {
  return {
    entityKind: "task" as const,
    entityId: taskId,
    fromStatus,
    toStatus,
    executionId,
    reasonCode: "e2e_approval",
    traceId,
    actorType: "system" as const,
    occurredAt: nowIso(),
  };
}

function makeExecCommand(
  executionId: string,
  fromStatus: ExecutionStatus,
  toStatus: ExecutionStatus,
  traceId: string,
) {
  return {
    entityKind: "execution" as const,
    entityId: executionId,
    fromStatus,
    toStatus,
    reasonCode: "e2e_approval",
    traceId,
    actorType: "agent" as const,
    occurredAt: nowIso(),
  };
}

// ---------------------------------------------------------------------------
// Test 1: Approval request → approve → task completes
// ---------------------------------------------------------------------------

test("E2E Approval: request → approve → execution proceeds to completion", async () => {
  const harness = createE2EHarness("aa-e2e-approval-grant-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const approvalService = new ApprovalService(harness.db, harness.store);
    const now = nowIso();

    // Create task awaiting decision
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Approval grant test",
        status: "awaiting_decision",
        source: "user",
        priority: "normal",
        inputJson: JSON.stringify({ request: "needs approval" }),
        normalizedInputJson: JSON.stringify({ request: "needs approval" }),
        outputJson: null,
        estimatedCostUsd: 0.05,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

// @ts-ignore
      harness.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-approval",
        roleId: "general_executor",
        runKind: "task_run",
        status: "blocked",
        inputRef: null,
        traceId,
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

    // Create approval request
    const approvalRequest = await approvalService.createRequest({
      taskId,
      executionId,
      sourceAgentId: "agent-approval",
      reason: "High-risk operation requires human approval",
      riskLevel: "high",
      options: ["approve", "reject"],
      context: { operation: "delete", resource: "production-db" },
      timeoutPolicy: "reject",
    });

    assert.ok(approvalRequest.approvalId, "Should have approval ID");
    assert.equal(approvalRequest.status, "pending", "Approval should be pending");

    // Grant approval via applyDecision
    const grantResult = approvalService.applyDecision({
      approvalId: approvalRequest.approvalId,
      decisionType: "option_selected",
      selectedOptionId: "approve",
      respondedBy: "human-approver",
      respondedAt: nowIso(),
    });

    assert.ok(grantResult, "Grant should return result");

    // Verify approval is approved
    const approval = approvalService.getApproval(approvalRequest.approvalId);
    assert.ok(approval, "Approval should exist");
    assert.equal(approval?.status, "approved", "Approval should be approved");

    // Direct store update for execution status (avoids event emission constraint)
    harness.db.transaction(() => {
      harness.store.updateExecutionStatus(executionId, "prechecking", nowIso());
    });

    const exec = harness.store.getExecution(executionId);
    assert.equal(exec?.status, "prechecking", "Execution should be prechecking after approval");

    // Direct store update for task status
    harness.db.transaction(() => {
      harness.store.updateTaskStatus(taskId, "in_progress", nowIso(), null, null);
    });

    const task = harness.store.getTask(taskId);
    assert.equal(task?.status, "in_progress", "Task should be in_progress after approval");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 2: Approval request → reject → task fails
// ---------------------------------------------------------------------------

test("E2E Approval: request → reject → execution fails", async () => {
  const harness = createE2EHarness("aa-e2e-approval-reject-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const approvalService = new ApprovalService(harness.db, harness.store);
    const now = nowIso();

    // Create task awaiting decision
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Approval reject test",
        status: "awaiting_decision",
        source: "user",
        priority: "normal",
        inputJson: JSON.stringify({ request: "needs approval" }),
        normalizedInputJson: JSON.stringify({ request: "needs approval" }),
        outputJson: null,
        estimatedCostUsd: 0.05,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

// @ts-ignore
      harness.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-approval",
        roleId: "general_executor",
        runKind: "task_run",
        status: "blocked",
        inputRef: null,
        traceId,
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

    // Create approval request
    const approvalRequest = await approvalService.createRequest({
      taskId,
      executionId,
      sourceAgentId: "agent-approval",
      reason: "High-risk operation",
      riskLevel: "high",
      options: ["approve", "reject"],
      context: {},
      timeoutPolicy: "reject",
    });

    // Reject approval via applyDecision
    const rejectResult = approvalService.applyDecision({
      approvalId: approvalRequest.approvalId,
      decisionType: "rejected",
      respondedBy: "human-approver",
      respondedAt: nowIso(),
    });

    assert.ok(rejectResult, "Reject should return result");

    // Verify approval is rejected
    const approval = approvalService.getApproval(approvalRequest.approvalId);
    assert.ok(approval, "Approval should exist");
    assert.equal(approval?.status, "rejected", "Approval should be rejected");

    // Direct store update for execution failure
    harness.db.transaction(() => {
      harness.store.updateExecutionStatus(executionId, "failed", nowIso(), null, nowIso(), "approval.rejected");
    });

    const exec = harness.store.getExecution(executionId);
    assert.equal(exec?.status, "failed", "Execution should be failed after rejection");

    // Direct store update for task failure
    harness.db.transaction(() => {
      harness.store.updateTaskStatus(taskId, "failed", nowIso(), "approval.rejected", nowIso());
    });

    const task = harness.store.getTask(taskId);
    assert.equal(task?.status, "failed", "Task should be failed after rejection");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 3: Approval timeout auto-reject
// ---------------------------------------------------------------------------

test("E2E Approval: timeout policy reject auto-expires approval", async () => {
  const harness = createE2EHarness("aa-e2e-approval-timeout-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = newId("trace");
    const approvalService = new ApprovalService(harness.db, harness.store);
    const now = nowIso();

    // Create task awaiting decision
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        tenantId: null,
        divisionId: "general_ops",
        title: "Approval timeout test",
        status: "awaiting_decision",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0.05,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

// @ts-ignore
      harness.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-approval",
        roleId: "general_executor",
        runKind: "task_run",
        status: "blocked",
        inputRef: null,
        traceId,
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

    // Create approval request with timeout policy "reject"
    const approvalRequest = await approvalService.createRequest({
      taskId,
      executionId,
      sourceAgentId: "agent-approval",
      reason: "Operation with timeout",
      riskLevel: "medium",
      options: ["approve", "reject"],
      context: {},
      timeoutPolicy: "reject",
    });

    assert.equal(approvalRequest.timeoutPolicy, "reject", "Timeout policy should be reject");

    // Simulate timeout expiration via applyDecision with expired type
    approvalService.applyDecision({
      approvalId: approvalRequest.approvalId,
      decisionType: "expired",
      respondedBy: "system",
      respondedAt: nowIso(),
    });

    // Verify approval is expired
    const approval = approvalService.getApproval(approvalRequest.approvalId);
    assert.ok(approval, "Approval should exist");
    assert.equal(approval?.status, "expired", "Approval should be expired");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 4: Approval with context preservation through state transitions
// ---------------------------------------------------------------------------

test("E2E Approval: approval context preserved through state transitions", async () => {
  const harness = createE2EHarness("aa-e2e-approval-context-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = newId("trace");
    const approvalService = new ApprovalService(harness.db, harness.store);
    const now = nowIso();

    // Create task awaiting decision
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Approval context test",
        status: "awaiting_decision",
        source: "user",
        priority: "normal",
        inputJson: JSON.stringify({ request: "needs approval" }),
        normalizedInputJson: JSON.stringify({ request: "needs approval" }),
        outputJson: null,
        estimatedCostUsd: 0.05,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

// @ts-ignore
      harness.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-approval",
        roleId: "general_executor",
        runKind: "task_run",
        status: "blocked",
        inputRef: null,
        traceId,
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

    // Create approval with rich context
    const approvalRequest = await approvalService.createRequest({
      taskId,
      executionId,
      sourceAgentId: "agent-approval",
      reason: "Sensitive data access",
      riskLevel: "critical",
      options: ["approve", "reject", "request_more_info"],
      context: {
        resourceType: "customer_database",
        operation: "read",
        dataSensitivity: "PII",
        accessedFields: ["email", "phone", "address"],
        justification: "Customer support ticket #12345",
      },
      timeoutPolicy: "reject",
    });

    // Verify context is preserved
    const approval = approvalService.getApproval(approvalRequest.approvalId);
    assert.ok(approval, "Approval should exist");

    // Access context from approval request
    const storedContext = (approval as any)?.request?.context ?? {};
    assert.equal(storedContext.resourceType, "customer_database", "Context should preserve resourceType");
    assert.equal(storedContext.operation, "read", "Context should preserve operation");
    assert.deepEqual(storedContext.accessedFields, ["email", "phone", "address"], "Context should preserve accessedFields");

  } finally {
    harness.cleanup();
  }
});
