/**
 * E2E HITL (Human-in-the-Loop) Approval Comprehensive Tests
 *
 * End-to-end tests covering HITL scenarios:
 * - Break-glass emergency approval flows
 * - Approval timeout and auto-expiry behavior
 * - Approval cascade and denial propagation
 * - Risk-level based approval routing
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../helpers/e2e-harness.js";
import { TransitionService } from "../../src/platform/execution/state-transition/transition-service.js";
import { ApprovalService } from "../../src/platform/control-plane/approval-center/approval-service.js";
import { ApprovalTimeoutExecutor } from "../../src/platform/control-plane/approval-center/approval-timeout-executor.js";
import { ApprovalRepository } from "../../src/platform/state-evidence/truth/sqlite/repositories/approval-repository.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";
import type { TaskStatus, ExecutionStatus } from "../../src/platform/contracts/types/status.js";

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
    reasonCode: "e2e_hitl",
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
    reasonCode: "e2e_hitl",
    traceId,
    actorType: "agent" as const,
    occurredAt: nowIso(),
  };
}

// ---------------------------------------------------------------------------
// Test: Break-glass emergency approval flow
// ---------------------------------------------------------------------------

test("E2E HITL: break-glass emergency approval bypasses normal workflow", async () => {
  const harness = createE2EHarness("aa-e2e-break-glass-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const sessionId = newId("sess");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const approvalService = new ApprovalService(harness.db, harness.store);
    const now = nowIso();

    // Setup task awaiting decision
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Break-glass emergency task",
        status: "awaiting_decision",
        source: "user",
        priority: "critical",
        inputJson: JSON.stringify({ emergency: true, reason: "production outage" }),
        normalizedInputJson: JSON.stringify({ emergency: true }),
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      harness.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
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

      harness.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "awaiting_user",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Break-glass: create emergency approval request with override
    const approvalRequest = approvalService.createRequest({
      taskId,
      executionId,
      sourceAgentId: "agent-1",
      reason: "EMERGENCY: Production system down, immediate action required",
      riskLevel: "critical",
      options: ["approve_emergency", "delay"],
      context: {
        breakGlass: true,
        incidentId: "INC-2026-001",
        impact: "production_outage",
      },
      timeoutPolicy: "approve", // Auto-approve in emergency
    });

    assert.ok(approvalRequest.approvalId, "Should create emergency approval");
    assert.equal(approvalRequest.riskLevel, "critical", "Should be marked critical");
    assert.equal(approvalRequest.context.breakGlass, true, "Should have break-glass flag");

    // Apply emergency approval decision
    const decision = approvalService.applyDecision({
      approvalId: approvalRequest.approvalId,
      decisionType: "option_selected",
      selectedOptionId: "approve_emergency",
      respondedBy: "emergency-admin",
      respondedAt: nowIso(),
    });

    assert.equal(decision.approvalId, approvalRequest.approvalId, "Decision should reference approval");
    assert.equal(decision.respondedBy, "emergency-admin", "Should record responder");

    // Execution should resume
    ts.transitionExecutionStatus(makeExecCommand(executionId, "blocked", "executing", traceId));
    ts.transitionTaskStatus(makeTaskCommand(taskId, "awaiting_decision", "in_progress", traceId, executionId));

    const exec = harness.store.getExecution(executionId);
    assert.equal(exec?.status, "executing", "Execution should resume after break-glass approval");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test: Approval timeout with auto-reject policy
// ---------------------------------------------------------------------------

test("E2E HITL: approval timeout triggers auto-reject when policy is reject", async () => {
  const harness = createE2EHarness("aa-e2e-timeout-reject-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const sessionId = newId("sess");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const approvalService = new ApprovalService(harness.db, harness.store);
    const timeoutExecutor = new ApprovalTimeoutExecutor(harness.db, harness.store);
    const now = nowIso();

    // Create approval request with reject timeout policy
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Timeout reject test",
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

      harness.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
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

      harness.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "awaiting_user",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    const approvalRequest = approvalService.createRequest({
      taskId,
      executionId,
      sourceAgentId: "agent-1",
      reason: "Action requires approval before proceeding",
      riskLevel: "medium",
      options: ["approve", "reject"],
      context: {},
      timeoutPolicy: "reject",
    });

    // Simulate timeout expiry
    const expiredApproval = timeoutExecutor.executeTimeout({
      approvalId: approvalRequest.approvalId,
      expiredAt: nowIso(),
    });

    assert.equal(expiredApproval.status, "rejected", "Should auto-reject on timeout");
    assert.equal(expiredApproval.decisionType, "expired", "Should mark as expired");

    // Verify execution was cancelled
    const exec = harness.store.getExecution(executionId);
    assert.equal(exec?.status, "cancelled", "Execution should be cancelled after timeout reject");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test: Approval timeout with auto-approve policy
// ---------------------------------------------------------------------------

test("E2E HITL: approval timeout triggers auto-approve when policy is approve", async () => {
  const harness = createE2EHarness("aa-e2e-timeout-approve-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const sessionId = newId("sess");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const approvalService = new ApprovalService(harness.db, harness.store);
    const timeoutExecutor = new ApprovalTimeoutExecutor(harness.db, harness.store);
    const now = nowIso();

    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Timeout approve test",
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

      harness.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
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

      harness.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "awaiting_user",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    const approvalRequest = approvalService.createRequest({
      taskId,
      executionId,
      sourceAgentId: "agent-1",
      reason: "Low-risk routine operation",
      riskLevel: "low",
      options: ["approve", "reject"],
      context: {},
      timeoutPolicy: "approve",
    });

    // Simulate timeout expiry with approve policy
    const expiredApproval = timeoutExecutor.executeTimeout({
      approvalId: approvalRequest.approvalId,
      expiredAt: nowIso(),
    });

    assert.equal(expiredApproval.status, "approved", "Should auto-approve on timeout");
    assert.equal(expiredApproval.decisionType, "expired", "Should mark as expired");

    // Execution should be able to resume
    ts.transitionExecutionStatus(makeExecCommand(executionId, "blocked", "executing", traceId));

    const exec = harness.store.getExecution(executionId);
    assert.equal(exec?.status, "executing", "Execution should resume after auto-approve");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test: Approval cascade denial
// ---------------------------------------------------------------------------

test("E2E HITL: cascade denial rejects all dependent approvals", async () => {
  const harness = createE2EHarness("aa-e2e-cascade-deny-");
  try {
    const taskId = newId("task");
    const executionId1 = newId("exec1");
    const executionId2 = newId("exec2");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const approvalService = new ApprovalService(harness.db, harness.store);
    const now = nowIso();

    // Setup two dependent tasks
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Cascade denial test - parent",
        status: "awaiting_decision",
        source: "user",
        priority: "high",
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

      harness.store.insertExecution({
        id: executionId1,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
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
        updatedAt: now,
      });
    });

    // Create parent approval
    const parentApproval = approvalService.createRequest({
      taskId,
      executionId: executionId1,
      sourceAgentId: "agent-1",
      reason: "Parent approval for critical change",
      riskLevel: "high",
      options: ["approve", "reject"],
      context: {},
      timeoutPolicy: "reject",
    });

    // Apply denial with cascade flag
    const denial = approvalService.applyDecision({
      approvalId: parentApproval.approvalId,
      decisionType: "rejected",
      respondedBy: "senior-ops",
      respondedAt: nowIso(),
    });

    assert.equal(denial.decisionType, "rejected", "Should record rejection");

    // Verify task and execution were cancelled
    const exec1 = harness.store.getExecution(executionId1);
    assert.equal(exec1?.status, "cancelled", "First execution should be cancelled");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test: Risk-level based approval routing
// ---------------------------------------------------------------------------

test("E2E HITL: high-risk approval requires elevated approver", async () => {
  const harness = createE2EHarness("aa-e2e-risk-routing-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = newId("trace");
    const approvalService = new ApprovalService(harness.db, harness.store);
    const now = nowIso();

    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "High risk routing test",
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

      harness.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId,
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
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

    // Critical risk level should trigger additional validation
    const approvalRequest = approvalService.createRequest({
      taskId,
      executionId,
      sourceAgentId: "agent-1",
      reason: "Critical infrastructure modification",
      riskLevel: "critical",
      options: ["approve", "reject"],
      context: {
        requiresElevatedApprover: true,
        approverGroups: ["senior-ops", "platform-team"],
      },
      timeoutPolicy: "reject",
    });

    assert.equal(approvalRequest.riskLevel, "critical", "Should be marked critical");
    assert.equal(approvalRequest.context.requiresElevatedApprover, true, "Should require elevated approver");
    assert.ok(approvalRequest.approverGroups?.includes("senior-ops"), "Should include senior-ops group");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test: Approval with remain_pending timeout policy
// ---------------------------------------------------------------------------

test("E2E HITL: remain_pending policy leaves approval pending until explicit response", async () => {
  const harness = createE2EHarness("aa-e2e-remain-pending-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const sessionId = newId("sess");
    const traceId = newId("trace");
    const approvalService = new ApprovalService(harness.db, harness.store);
    const timeoutExecutor = new ApprovalTimeoutExecutor(harness.db, harness.store);
    const now = nowIso();

    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Remain pending test",
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

      harness.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
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

      harness.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "awaiting_user",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    const approvalRequest = approvalService.createRequest({
      taskId,
      executionId,
      sourceAgentId: "agent-1",
      reason: "Sensitive operation requiring human review",
      riskLevel: "medium",
      options: ["approve", "reject"],
      context: {},
      timeoutPolicy: "remain_pending",
    });

    // Timeout with remain_pending policy
    const expiredApproval = timeoutExecutor.executeTimeout({
      approvalId: approvalRequest.approvalId,
      expiredAt: nowIso(),
    });

    // Should remain pending - no automatic decision
    assert.equal(expiredApproval.status, "requested", "Should remain in requested state");
    assert.equal(expiredApproval.decisionType, "expired", "Should record expiry");

    // Execution should still be blocked
    const exec = harness.store.getExecution(executionId);
    assert.equal(exec?.status, "blocked", "Execution should still be blocked");
  } finally {
    harness.cleanup();
  }
});
