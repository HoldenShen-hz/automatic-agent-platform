/**
 * E2E Approval Flows Tests
 *
 * End-to-end tests covering approval workflows using the centralized
 * createE2EHarness() helper. These tests verify the complete integration
 * path across approval-required task lifecycle, approval request creation,
 * grant/reject flows, and auto-approval timeout behavior.
 *
 * Coverage:
 * 1. Approval-required task lifecycle (create -> blocked -> approved -> complete)
 * 2. Approval request creation and listing
 * 3. Approval grant/reject flows
 * 4. Auto-approval timeout behavior
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../helpers/e2e-harness.js";
import { TransitionService } from "../../src/platform/execution/state-transition/transition-service.js";
import { ApprovalService } from "../../src/platform/control-plane/approval-center/approval-service.js";
import { ApprovalTimeoutExecutor } from "../../src/platform/control-plane/approval-center/approval-timeout-executor.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";
import type { TaskStatus, ExecutionStatus } from "../../src/platform/contracts/types/status.js";

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
// Test 1: Approval-Required Task Lifecycle
// ---------------------------------------------------------------------------

test("E2E Approval: task requires approval before execution and completes after grant", async () => {
  const harness = createE2EHarness("aa-e2e-approval-lifecycle-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const sessionId = newId("sess");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const approvals = new ApprovalService(harness.db, harness.store);
    const now = nowIso();

    // Create task in queued state
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Approval-required task",
        status: "queued",
        source: "user",
        priority: "normal",
        inputJson: JSON.stringify({ request: "run with approval" }),
        normalizedInputJson: JSON.stringify({ request: "run with approval" }),
        outputJson: null,
        estimatedCostUsd: 0.01,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    // Transition task to pending
    ts.transitionTaskStatus(makeTaskCommand(taskId, "queued", "pending", traceId, null));
    let task = harness.store.getTask(taskId);
    assert.equal(task?.status, "pending", "Task should be pending");

    // Insert execution with requiresApproval=1
    harness.db.transaction(() => {
      harness.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-general",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
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

    // Transition task to in_progress
    ts.transitionTaskStatus(makeTaskCommand(taskId, "pending", "in_progress", traceId, executionId));
    task = harness.store.getTask(taskId);
    assert.equal(task?.status, "in_progress", "Task should be in_progress");

    // Execution becomes blocked (needs approval)
    ts.transitionExecutionStatus(makeExecCommand(executionId, "executing", "blocked", traceId));

    let exec = harness.store.getExecution(executionId);
    assert.equal(exec?.status, "blocked", "Execution should be blocked");

    // Transition task to awaiting_decision
    ts.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "in_progress",
      toStatus: "awaiting_decision",
      executionId,
      reasonCode: "approval.required",
      traceId,
      actorType: "system",
      occurredAt: nowIso(),
    });

    // Insert session and transition to awaiting_user
    harness.db.transaction(() => {
      harness.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "streaming",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    ts.transitionSessionStatus({
      entityKind: "session",
      entityId: sessionId,
      fromStatus: "streaming",
      toStatus: "awaiting_user",
      reasonCode: "approval.required",
      traceId,
      actorType: "system",
      occurredAt: nowIso(),
    });

    task = harness.store.getTask(taskId);
    assert.equal(task?.status, "awaiting_decision", "Task should be awaiting_decision");

    // Create approval request
    const approvalRequest = approvals.createRequest({
      taskId,
      executionId,
      sourceAgentId: "agent-general",
      reason: "High-risk operation requires human approval",
      riskLevel: "high",
      options: ["approve", "reject"] as readonly string[],
      context: { operation: "delete_resources" },
      timeoutPolicy: "reject",
    });

    const approval = harness.store.getApproval(approvalRequest.approvalId);
    assert.ok(approval, "Approval request should be persisted");
    assert.equal(approval?.status, "requested", "Approval should be in requested status");
    assert.equal(approval?.taskId, taskId, "Approval should reference the task");

    // Approver grants approval via option_selected
    approvals.applyDecision({
      approvalId: approvalRequest.approvalId,
      decisionType: "option_selected",
      selectedOptionId: "approve",
      respondedBy: "operator-1",
      respondedAt: nowIso(),
    });

    // Verify approval is now approved
    const approvedRecord = harness.store.getApproval(approvalRequest.approvalId);
    assert.equal(approvedRecord?.status, "approved", "Approval should be approved");

    // Execution resumes
    ts.transitionExecutionStatus(makeExecCommand(executionId, "blocked", "executing", traceId));

    // Task resumes
    ts.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "awaiting_decision",
      toStatus: "in_progress",
      executionId,
      reasonCode: "approval.approved",
      traceId,
      actorType: "system",
      occurredAt: nowIso(),
    });

    // Complete execution and task
    ts.transitionExecutionStatus(makeExecCommand(executionId, "executing", "succeeded", traceId));
    ts.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "awaiting_user",
      currentExecutionStatus: "succeeded",
      terminalStatus: "done",
      taskOutputJson: JSON.stringify({ result: "approved and completed" }),
      outputsJson: "{}",
      context: {
        reasonCode: "task.completed",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    task = harness.store.getTask(taskId);
    assert.equal(task?.status, "done", "Task should complete after approval granted");
    assert.ok(task?.completedAt, "Task should have completedAt");

    exec = harness.store.getExecution(executionId);
    assert.equal(exec?.status, "succeeded", "Execution should be succeeded");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 2: Approval Request Creation and Listing
// ---------------------------------------------------------------------------

test("E2E Approval: approval requests can be created and listed by task", async () => {
  const harness = createE2EHarness("aa-e2e-approval-list-");
  try {
    const taskId = newId("task");
    const executionId1 = newId("exec1");
    const executionId2 = newId("exec2");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const approvals = new ApprovalService(harness.db, harness.store);
    const now = nowIso();

    // Setup task with two executions requiring approval
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Multi-approval task",
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

      // First execution blocked for approval
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
      });

      // Second execution (will be created after first approval)
      harness.store.insertExecution({
        id: executionId2,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: newId("trace"),
        attempt: 2,
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
        startedAt: nowIso(),
        finishedAt: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    });

    // Create two approval requests
    const approval1 = approvals.createRequest({
      taskId,
      executionId: executionId1,
      sourceAgentId: "agent-1",
      reason: "First approval required",
      riskLevel: "medium",
      options: ["approve", "reject"] as readonly string[],
      context: { step: 1 },
      timeoutPolicy: "reject",
    });

    const approval2 = approvals.createRequest({
      taskId,
      executionId: executionId2,
      sourceAgentId: "agent-1",
      reason: "Second approval required",
      riskLevel: "medium",
      options: ["approve", "reject"] as readonly string[],
      context: { step: 2 },
      timeoutPolicy: "reject",
    });

    // List approvals by task
    const taskApprovals = harness.store.listApprovalsByTask(taskId);
    assert.equal(taskApprovals.length, 2, "Should have 2 approval requests for the task");

    // Verify approval records
    const found1 = taskApprovals.find((a) => a.id === approval1.approvalId);
    const found2 = taskApprovals.find((a) => a.id === approval2.approvalId);
    assert.ok(found1, "First approval should be in list");
    assert.ok(found2, "Second approval should be in list");
    assert.equal(found1?.status, "requested", "First approval should be requested");
    assert.equal(found2?.status, "requested", "Second approval should be requested");

    // Approve first and check it becomes approved
    approvals.applyDecision({
      approvalId: approval1.approvalId,
      decisionType: "confirmed",
      confirmed: true,
      respondedBy: "operator-1",
      respondedAt: nowIso(),
    });

    const updatedApprovals = harness.store.listApprovalsByTask(taskId);
    const updated1 = updatedApprovals.find((a) => a.id === approval1.approvalId);
    const updated2 = updatedApprovals.find((a) => a.id === approval2.approvalId);
    assert.equal(updated1?.status, "approved", "First approval should be approved after decision");
    assert.equal(updated2?.status, "requested", "Second approval should still be pending");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 3: Approval Grant/Reject Flows
// ---------------------------------------------------------------------------

test("E2E Approval: approval rejected prevents execution and fails task", async () => {
  const harness = createE2EHarness("aa-e2e-approval-reject-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const sessionId = newId("sess");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const approvals = new ApprovalService(harness.db, harness.store);
    const now = nowIso();

    // Setup task in awaiting_decision state
    harness.db.transaction(() => {
      harness.store.insertTask({
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

    // Create approval request
    const approvalRequest = approvals.createRequest({
      taskId,
      executionId,
      sourceAgentId: "agent-1",
      reason: "Destructive action requested",
      riskLevel: "critical",
      options: ["approve", "reject"] as readonly string[],
      context: { action: "delete_all" },
      timeoutPolicy: "reject",
    });

    // Reject the approval
    approvals.applyDecision({
      approvalId: approvalRequest.approvalId,
      decisionType: "rejected",
      respondedBy: "operator-1",
      respondedAt: nowIso(),
    });

    // Verify approval is rejected
    const approval = harness.store.getApproval(approvalRequest.approvalId);
    assert.equal(approval?.status, "rejected", "Approval should be rejected");

    // Task should be transitioned to failed state via terminal state
    ts.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "awaiting_decision",
      currentWorkflowStatus: "running",
      currentSessionStatus: "awaiting_user",
      currentExecutionStatus: "blocked",
      terminalStatus: "failed",
      taskOutputJson: JSON.stringify({ error: "approval.rejected" }),
      outputsJson: "{}",
      context: {
        reasonCode: "approval.rejected",
        traceId,
        actorType: "user",
        occurredAt: nowIso(),
      },
    });

    const task = harness.store.getTask(taskId);
    assert.equal(task?.status, "failed", "Task should fail after rejection");
    assert.equal(task?.errorCode, "approval.rejected", "Task should have rejection error code");

    const exec = harness.store.getExecution(executionId);
    assert.equal(exec?.status, "failed", "Execution should be failed");

  } finally {
    harness.cleanup();
  }
});

test("E2E Approval: confirmed approval grants execution permission", async () => {
  const harness = createE2EHarness("aa-e2e-approval-confirm-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const sessionId = newId("sess");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const approvals = new ApprovalService(harness.db, harness.store);
    const now = nowIso();

    // Setup task in blocked state
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Confirm approval test",
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
        status: "streaming",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Create approval request
    const approvalRequest = approvals.createRequest({
      taskId,
      executionId,
      sourceAgentId: "agent-1",
      reason: "Standard operation",
      riskLevel: "low",
      options: [] as readonly string[],
      context: {},
      timeoutPolicy: "approve",
    });

    // Apply confirmed decision
    approvals.applyDecision({
      approvalId: approvalRequest.approvalId,
      decisionType: "confirmed",
      confirmed: true,
      respondedBy: "operator-1",
      respondedAt: nowIso(),
    });

    // Verify approval is approved
    const approval = harness.store.getApproval(approvalRequest.approvalId);
    assert.equal(approval?.status, "approved", "Approval should be approved");

    // Execution resumes
    ts.transitionExecutionStatus(makeExecCommand(executionId, "blocked", "executing", traceId));

    // Complete execution and task
    ts.transitionExecutionStatus(makeExecCommand(executionId, "executing", "succeeded", traceId));
    ts.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "succeeded",
      terminalStatus: "done",
      taskOutputJson: JSON.stringify({ result: "confirmed and completed" }),
      outputsJson: "{}",
      context: {
        reasonCode: "task.completed",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    const task = harness.store.getTask(taskId);
    assert.equal(task?.status, "done", "Task should complete after confirmation");

  } finally {
    harness.cleanup();
  }
});

test("E2E Approval: text_input decision is recorded and approved", async () => {
  const harness = createE2EHarness("aa-e2e-approval-text-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = newId("trace");
    const approvals = new ApprovalService(harness.db, harness.store);
    const now = nowIso();

    // Setup task
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Text approval test",
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
    const approvalRequest = approvals.createRequest({
      taskId,
      executionId,
      sourceAgentId: "agent-1",
      reason: "Custom response required",
      riskLevel: "medium",
      options: [] as readonly string[],
      context: {},
      timeoutPolicy: "approve",
    });

    // Apply text_input decision
    approvals.applyDecision({
      approvalId: approvalRequest.approvalId,
      decisionType: "text_input",
      inputText: "User approved with custom guidance",
      respondedBy: "operator-1",
      respondedAt: nowIso(),
    });

    // Verify approval is approved
    const approval = harness.store.getApproval(approvalRequest.approvalId);
    assert.equal(approval?.status, "approved", "Text approval should be approved");

    // Parse response to verify text was recorded
    const response = JSON.parse(approval?.responseJson ?? "{}");
    assert.equal(response.decisionType, "text_input", "Response should have correct decision type");
    assert.equal(response.inputText, "User approved with custom guidance", "Response should contain input text");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 4: Auto-Approval Timeout Behavior
// ---------------------------------------------------------------------------

test("E2E Approval: timeout executor auto-rejects expired approvals with reject policy", async () => {
  const harness = createE2EHarness("aa-e2e-approval-timeout-reject-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = newId("trace");
    const approvals = new ApprovalService(harness.db, harness.store);
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Setup task with execution
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Timeout reject test",
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

    // Create approval with very old createdAt (simulating expiration)
    const approvalRequest = approvals.createRequest({
      taskId,
      executionId,
      sourceAgentId: "agent-1",
      reason: "Approval with short timeout",
      riskLevel: "high",
      options: ["approve", "reject"] as readonly string[],
      context: {},
      timeoutPolicy: "reject",
    });

    // Manually backdate the approval to simulate expiration
    const oldCreatedAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25 hours ago
    harness.db.transaction(() => {
      const repo = new (await import("../../src/platform/state-evidence/truth/repositories/runtime-lifecycle-repository.js"))
        .RuntimeLifecycleRepository(harness.store);
      // Update the approval record's createdAt to simulate expiration
      const approval = harness.store.getApproval(approvalRequest.approvalId);
      if (approval) {
        harness.db.transaction(() => {
          harness.store.getDb().execute(
            `UPDATE approvals SET created_at = ? WHERE id = ?`,
            oldCreatedAt,
            approvalRequest.approvalId,
          );
        });
      }
    });

    // Create timeout executor with short default timeout
    const executor = new ApprovalTimeoutExecutor(approvals, harness.store, {
      conn: harness.store.getDb(),
    } as any, { defaultTimeoutMs: 60 * 60 * 1000 }); // 1 hour

    // Run sweep
    const result = executor.sweep();

    // Verify the approval was auto-rejected
    const updatedApproval = harness.store.getApproval(approvalRequest.approvalId);
    assert.equal(updatedApproval?.status, "expired", "Expired approval should be marked as expired");

    // Verify result counts
    assert.equal(result.rejected, 1, "Should have rejected 1 approval");
    assert.equal(result.skipped, 0, "Should not have skipped any");
    assert.equal(result.errors, 0, "Should have no errors");

  } finally {
    harness.cleanup();
  }
});

test("E2E Approval: timeout executor auto-approves expired approvals with approve policy", async () => {
  const harness = createE2EHarness("aa-e2e-approval-timeout-approve-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = newId("trace");
    const approvals = new ApprovalService(harness.db, harness.store);
    const now = nowIso();

    // Setup task with execution
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Timeout approve test",
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

    // Create approval with approve policy and backdate it
    const approvalRequest = approvals.createRequest({
      taskId,
      executionId,
      sourceAgentId: "agent-1",
      reason: "Auto-approve on timeout",
      riskLevel: "low",
      options: [] as readonly string[],
      context: {},
      timeoutPolicy: "approve",
    });

    // Backdate the approval
    const oldCreatedAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    harness.db.transaction(() => {
      harness.store.getDb().execute(
        `UPDATE approvals SET created_at = ? WHERE id = ?`,
        oldCreatedAt,
        approvalRequest.approvalId,
      );
    });

    // Create timeout executor
    const executor = new ApprovalTimeoutExecutor(approvals, harness.store, {
      conn: harness.store.getDb(),
    } as any, { defaultTimeoutMs: 60 * 60 * 1000 });

    // Run sweep
    const result = executor.sweep();

    // Verify the approval was auto-approved
    const updatedApproval = harness.store.getApproval(approvalRequest.approvalId);
    assert.equal(updatedApproval?.status, "approved", "Approval should be auto-approved");
    assert.equal(result.approved, 1, "Should have approved 1 approval");

  } finally {
    harness.cleanup();
  }
});

test("E2E Approval: timeout executor skips remain_pending approvals", async () => {
  const harness = createE2EHarness("aa-e2e-approval-timeout-pending-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = newId("trace");
    const approvals = new ApprovalService(harness.db, harness.store);
    const now = nowIso();

    // Setup task with execution
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Timeout pending test",
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

    // Create approval with remain_pending policy
    const approvalRequest = approvals.createRequest({
      taskId,
      executionId,
      sourceAgentId: "agent-1",
      reason: "Wait for explicit response",
      riskLevel: "medium",
      options: ["approve", "reject"] as readonly string[],
      context: {},
      timeoutPolicy: "remain_pending",
    });

    // Backdate the approval
    const oldCreatedAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    harness.db.transaction(() => {
      harness.store.getDb().execute(
        `UPDATE approvals SET created_at = ? WHERE id = ?`,
        oldCreatedAt,
        approvalRequest.approvalId,
      );
    });

    // Create timeout executor
    const executor = new ApprovalTimeoutExecutor(approvals, harness.store, {
      conn: harness.store.getDb(),
    } as any, { defaultTimeoutMs: 60 * 60 * 1000 });

    // Run sweep
    const result = executor.sweep();

    // Verify the approval was skipped (not rejected or approved)
    const updatedApproval = harness.store.getApproval(approvalRequest.approvalId);
    assert.equal(updatedApproval?.status, "requested", "remain_pending approval should stay requested");
    assert.equal(result.skipped, 1, "Should have skipped 1 approval");
    assert.equal(result.rejected, 0, "Should not have rejected");
    assert.equal(result.approved, 0, "Should not have approved");

  } finally {
    harness.cleanup();
  }
});

test("E2E Approval: non-expired approvals are not affected by timeout sweep", async () => {
  const harness = createE2EHarness("aa-e2e-approval-timeout-nonexpired-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = newId("trace");
    const approvals = new ApprovalService(harness.db, harness.store);
    const now = nowIso();

    // Setup task with execution
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Non-expired approval test",
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

    // Create approval with recent createdAt (not expired)
    const approvalRequest = approvals.createRequest({
      taskId,
      executionId,
      sourceAgentId: "agent-1",
      reason: "Fresh approval",
      riskLevel: "high",
      options: ["approve", "reject"] as readonly string[],
      context: {},
      timeoutPolicy: "reject",
    });

    // Create timeout executor
    const executor = new ApprovalTimeoutExecutor(approvals, harness.store, {
      conn: harness.store.getDb(),
    } as any, { defaultTimeoutMs: 60 * 60 * 1000 });

    // Run sweep
    const result = executor.sweep();

    // Verify the approval was skipped (not expired yet)
    const updatedApproval = harness.store.getApproval(approvalRequest.approvalId);
    assert.equal(updatedApproval?.status, "requested", "Non-expired approval should still be requested");
    assert.equal(result.skipped, 1, "Should have skipped 1 non-expired approval");
    assert.equal(result.rejected, 0, "Should not have rejected any");

  } finally {
    harness.cleanup();
  }
});
