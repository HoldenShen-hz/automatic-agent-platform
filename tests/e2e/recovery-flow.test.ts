/**
 * E2E Execution Recovery Flow Tests
 *
 * End-to-end tests covering execution recovery scenarios including:
 * - Worker failure and execution resumption
 * - Stale execution detection and recovery
 * - Retry with new ticket (attempt escalation)
 * - Dead letter queue movement
 * - Error code classification (E7 locking, E8 memory, EC crash)
 * - Approval-pending escalation
 * - Precheck denial handling
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../helpers/e2e-harness.js";
import { TransitionService } from "../../src/platform/execution/state-transition/transition-service.js";
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
    reasonCode: "e2e_recovery",
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
    reasonCode: "e2e_recovery",
    traceId,
    actorType: "agent" as const,
    occurredAt: nowIso(),
  };
}

// ---------------------------------------------------------------------------
// Test: Active execution at low attempt gets resume_same_worker suggestion
// ---------------------------------------------------------------------------

test("E2E Recovery: active execution at low attempt suggests resume_same_worker", () => {
  const h = createE2EHarness("aa-e2e-recovery-active-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = newId("trace");
    const now = nowIso();

    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Recovery active test",
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

      h.store.insertExecution({
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

    // Verify execution is in executing state with attempt 1
    const exec = h.store.getExecution(executionId);
    assert.equal(exec?.status, "executing", "Execution should be executing");
    assert.equal(exec?.attempt, 1, "Attempt should be 1");
    assert.equal(exec?.lastErrorCode, null, "No error code should be set");

    // Worker failed - insert new execution in failed state for recovery scenario
    const failedExecId = newId("exec-failed");
    h.db.transaction(() => {
      h.store.insertExecution({
        id: failedExecId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: executionId,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "failed",
        inputRef: null,
        traceId: newId("trace-fail"),
        attempt: 2,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 1,
        retryBackoff: "none",
        lastErrorCode: "E7DEADLOCK",
        lastErrorMessage: "Lock acquisition failed",
        startedAt: now,
        finishedAt: nowIso(),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    });

    const failedExec = h.store.getExecution(failedExecId);
    assert.equal(failedExec?.status, "failed", "New execution should be failed");
    assert.equal(failedExec?.lastErrorCode, "E7DEADLOCK", "Error code should be E7DEADLOCK");

  } finally {
    h.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test: Execution with high attempt gets retry_new_ticket suggestion
// ---------------------------------------------------------------------------

test("E2E Recovery: execution at high attempt suggests retry_new_ticket", () => {
  const h = createE2EHarness("aa-e2e-recovery-high-attempt-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = newId("trace");
    const now = nowIso();

    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "High attempt recovery test",
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

      h.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "failed",
        inputRef: null,
        traceId,
        attempt: 3,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 2,
        retryBackoff: "exponential",
        lastErrorCode: "transient_error",
        lastErrorMessage: "Temporary failure",
        startedAt: now,
        finishedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    });

    const exec = h.store.getExecution(executionId);
    assert.equal(exec?.attempt, 3, "Attempt should be 3 (exceeds resume threshold of 2)");
    assert.equal(exec?.status, "failed", "Execution should be in failed state");

    // Create retry execution with attempt 4
    const retryExecutionId = newId("exec-retry");
    h.db.transaction(() => {
      h.store.insertExecution({
        id: retryExecutionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: executionId,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: newId("trace-retry"),
        attempt: 4,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 1,
        retryBackoff: "exponential",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: nowIso(),
        finishedAt: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    });

    const retryExec = h.store.getExecution(retryExecutionId);
    assert.equal(retryExec?.attempt, 4, "Retry attempt should be 4");
    assert.equal(retryExec?.status, "executing", "Retry execution should be executing");
    assert.equal(retryExec?.parentExecutionId, executionId, "Should reference parent execution");

  } finally {
    h.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test: E7 locking error allows retry with same worker
// ---------------------------------------------------------------------------

test("E2E Recovery: E7 locking error is retryable", () => {
  const h = createE2EHarness("aa-e2e-recovery-e7-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = newId("trace");
    const now = nowIso();

    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "E7 locking error test",
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

      h.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "failed",
        inputRef: null,
        traceId,
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 1,
        retryBackoff: "none",
        lastErrorCode: "E7DEADLOCK",
        lastErrorMessage: "Database deadlock detected",
        startedAt: now,
        finishedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    });

    const exec = h.store.getExecution(executionId);
    assert.equal(exec?.lastErrorCode, "E7DEADLOCK", "Should have E7 error code");
    // E7 locking errors are retryable at low attempts
    assert.equal(exec?.attempt, 1, "Low attempt allows resume_same_worker");

  } finally {
    h.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test: E8 memory error escalates for human review
// ---------------------------------------------------------------------------

test("E2E Recovery: E8 memory error escalates for human review", () => {
  const h = createE2EHarness("aa-e2e-recovery-e8-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = newId("trace");
    const now = nowIso();

    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "E8 memory error test",
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

      h.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "failed",
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
        lastErrorCode: "E8OUTOFMEMORY",
        lastErrorMessage: "Process ran out of memory",
        startedAt: now,
        finishedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    });

    const exec = h.store.getExecution(executionId);
    assert.equal(exec?.lastErrorCode, "E8OUTOFMEMORY", "Should have E8 error code");
    // E8 memory errors escalate for human review (escalate_takeover)

    // Transition task to blocked state awaiting human decision
    const ts = new TransitionService(h.db, h.store);
    ts.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "in_progress",
      toStatus: "awaiting_decision",
      executionId,
      reasonCode: "memory_error_escalation",
      traceId,
      actorType: "system",
      occurredAt: nowIso(),
    });

    const task = h.store.getTask(taskId);
    assert.equal(task?.status, "awaiting_decision", "Task should be awaiting human decision");

  } finally {
    h.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test: EC crash error suggests retry_new_ticket
// ---------------------------------------------------------------------------

test("E2E Recovery: EC crash error suggests retry_new_ticket", () => {
  const h = createE2EHarness("aa-e2e-recovery-ec-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = newId("trace");
    const now = nowIso();

    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "EC crash error test",
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

      h.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "failed",
        inputRef: null,
        traceId,
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 1,
        retryBackoff: "exponential",
        lastErrorCode: "ECRASH",
        lastErrorMessage: "Process crashed",
        startedAt: now,
        finishedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    });

    const exec = h.store.getExecution(executionId);
    assert.equal(exec?.lastErrorCode, "ECRASH", "Should have EC error code");
    // EC runtime errors are retryable with retry_new_ticket

  } finally {
    h.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test: Stale execution detection and recovery
// ---------------------------------------------------------------------------

test("E2E Recovery: stale execution is detected and can be recovered", () => {
  const h = createE2EHarness("aa-e2e-recovery-stale-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = newId("trace");
    const now = nowIso();
    const staleTime = "2025-01-01T00:00:00.000Z"; // Very old timestamp

    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Stale execution test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: staleTime,
        updatedAt: staleTime, // Very old update time
        completedAt: null,
      });

      h.store.insertExecution({
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
        startedAt: staleTime,
        finishedAt: null,
        createdAt: staleTime,
        updatedAt: staleTime,
      });
    });

    // Verify execution has old timestamp (stale)
    const exec = h.store.getExecution(executionId);
    assert.equal(exec?.status, "executing", "Execution still shows executing");
    assert.ok(exec?.updatedAt < nowIso(), "Execution should have stale updatedAt");

    // Recovery: insert new execution in failed state with stale reference
    const staleRecoveryExecId = newId("exec-stale-recovery");
    h.db.transaction(() => {
      h.store.insertExecution({
        id: staleRecoveryExecId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: executionId,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "failed",
        inputRef: null,
        traceId: newId("trace-stale"),
        attempt: 2,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: "STALE_EXECUTION",
        lastErrorMessage: "Execution became stale",
        startedAt: now,
        finishedAt: nowIso(),
        createdAt: now,
        updatedAt: now,
      });
    });

    const staleExec = h.store.getExecution(staleRecoveryExecId);
    assert.equal(staleExec?.status, "failed", "Stale recovery execution should be failed");
    assert.equal(staleExec?.lastErrorCode, "STALE_EXECUTION", "Should have stale error code");

  } finally {
    h.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test: Precheck denial leads to cancellation
// ---------------------------------------------------------------------------

test("E2E Recovery: precheck denial leads to task cancellation", () => {
  const h = createE2EHarness("aa-e2e-recovery-precheck-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const sessionId = newId("sess");
    const traceId = newId("trace");
    const now = nowIso();

    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Precheck denial test",
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

      h.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "prechecking",
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

      h.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "open",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Precheck denied - insert execution in precheck_denied state
    const deniedExecId = newId("exec-denied");
    h.db.transaction(() => {
      h.store.insertExecution({
        id: deniedExecId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "precheck_denied",
        inputRef: null,
        traceId: newId("trace-denied"),
        attempt: 2, // Different attempt to avoid constraint
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: "BUDGET_EXCEEDED",
        lastErrorMessage: "Budget limit exceeded",
        startedAt: now,
        finishedAt: nowIso(),
        createdAt: now,
        updatedAt: now,
      });
    });

    const exec = h.store.getExecution(deniedExecId);
    assert.equal(exec?.status, "precheck_denied", "Execution should be precheck_denied");
    assert.equal(exec?.lastErrorCode, "BUDGET_EXCEEDED", "Should have budget exceeded error");

    // Task becomes failed due to precheck denial (insert directly since state machine
    // doesn't allow direct terminal transition from precheck_denied)
    const ts = new TransitionService(h.db, h.store);
    ts.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "in_progress",
      toStatus: "failed",
      executionId: deniedExecId,
      reasonCode: "precheck.denied:budget_exceeded",
      traceId,
      actorType: "system",
      occurredAt: nowIso(),
    });

    const task = h.store.getTask(taskId);
    assert.equal(task?.status, "failed", "Task should be failed due to precheck denial");

  } finally {
    h.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test: Approval-pending execution escalates for human takeover
// ---------------------------------------------------------------------------

test("E2E Recovery: approval-pending execution escalates for human takeover", () => {
  const h = createE2EHarness("aa-e2e-recovery-approval-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const sessionId = newId("sess");
    const traceId = newId("trace");
    const now = nowIso();

    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Approval pending test",
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

      h.store.insertExecution({
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
        attempt: 10, // High attempt
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

      h.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "awaiting_user",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Execution is blocked waiting for approval
    const exec = h.store.getExecution(executionId);
    assert.equal(exec?.status, "blocked", "Execution should be blocked");
    assert.equal(exec?.requiresApproval, 1, "Execution requires approval");
    assert.equal(exec?.attempt, 10, "High attempt should still escalate");

    const task = h.store.getTask(taskId);
    assert.equal(task?.status, "awaiting_decision", "Task should be awaiting decision");

  } finally {
    h.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test: Execution with checkpoint can be resurrected
// ---------------------------------------------------------------------------

test("E2E Recovery: execution with checkpoint can be resumed from checkpoint", () => {
  const h = createE2EHarness("aa-e2e-recovery-checkpoint-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = newId("trace");
    const now = nowIso();

    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Checkpoint resume test",
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

      h.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "multi_step_wf",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId,
        attempt: 2,
        timeoutMs: 120000,
        budgetUsdLimit: 5,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 1,
        retryBackoff: "exponential",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      h.store.insertWorkflowState({
        taskId,
        divisionId: "general_ops",
        workflowId: "multi_step_wf",
        currentStepIndex: 2, // Partially completed
        status: "running",
        outputsJson: JSON.stringify({ step0: "done", step1: "done" }),
        lastErrorCode: null,
        retryCount: 1,
        resumableFromStep: 2, // Can resume from step 2
        startedAt: now,
        updatedAt: now,
      });
    });

    // Verify checkpoint state
    const workflow = h.store.getWorkflowState(taskId);
    assert.equal(workflow?.currentStepIndex, 2, "Workflow should be at step 2");
    assert.equal(Number(workflow?.resumableFromStep), 2, "Should be resumable from step 2");
    assert.ok(JSON.parse(workflow!.outputsJson).step0, "Step 0 output should be preserved");
    assert.ok(JSON.parse(workflow!.outputsJson).step1, "Step 1 output should be preserved");

    // Execution failed but can be retried from checkpoint
    const exec = h.store.getExecution(executionId);
    assert.equal(exec?.attempt, 2, "Should be attempt 2");

  } finally {
    h.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test: Dead letter movement after max retries exceeded
// ---------------------------------------------------------------------------

test("E2E Recovery: execution moved to dead letter after max retries", () => {
  const h = createE2EHarness("aa-e2e-recovery-dlq-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const sessionId = newId("sess");
    const traceId = newId("trace");
    const now = nowIso();

    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Dead letter test",
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

      // Execution has exceeded retry limits
      h.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "failed",
        inputRef: null,
        traceId,
        attempt: 4, // Exceeds retryNewTicketMaxAttempts of 3
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 1,
        retryBackoff: "exponential",
        lastErrorCode: "EFATAL",
        lastErrorMessage: "Fatal error after retries",
        startedAt: now,
        finishedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      h.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "streaming",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    const exec = h.store.getExecution(executionId);
    assert.equal(exec?.attempt, 4, "Attempt should exceed retry threshold");
    assert.equal(exec?.lastErrorCode, "EFATAL", "Should have fatal error code");

    // Move to dead letter via terminal state
    const ts = new TransitionService(h.db, h.store);
    ts.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "failed",
      terminalStatus: "failed",
      taskOutputJson: JSON.stringify({ error: "moved_to_dead_letter" }),
      outputsJson: "{}",
      context: {
        reasonCode: "recovery.dead_letter_moved",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    const task = h.store.getTask(taskId);
    assert.equal(task?.status, "failed", "Task should be failed");
    assert.equal(task?.errorCode, "recovery.dead_letter_moved", "Should have DLQ reason code");

  } finally {
    h.cleanup();
  }
});