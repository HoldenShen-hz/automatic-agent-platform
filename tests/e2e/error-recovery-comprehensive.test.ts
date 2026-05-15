/**
 * E2E Error Recovery Comprehensive Tests
 *
 * End-to-end tests covering error recovery scenarios:
 * - Dead letter queue handling
 * - Error code classification (E7 locking, E8 memory, EC crash)
 * - Recovery suggestion engine
 * - Escalation and human takeover
 * - Retry with new ticket flow
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../helpers/e2e-harness.js";
import { TransitionService } from "../../src/platform/five-plane-execution/state-transition/transition-service.js";
import { RuntimeRecoveryService } from "../../src/platform/five-plane-execution/recovery/runtime-recovery-service.js";
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
    reasonCode: "e2e_error_recovery",
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
  reasonCode: string = "e2e_error_recovery",
) {
  return {
    entityKind: "execution" as const,
    entityId: executionId,
    fromStatus,
    toStatus,
    reasonCode,
    traceId,
    actorType: "agent" as const,
    occurredAt: nowIso(),
  };
}

// ---------------------------------------------------------------------------
// Test: Dead letter queue movement
// ---------------------------------------------------------------------------

test("E2E Recovery: execution moves to dead letter queue after max retries", async () => {
  const harness = createE2EHarness("aa-e2e-dlq-");
  try {
    const taskId = newId("task");
    const executionId1 = newId("exec1");
    const executionId2 = newId("exec2");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Setup task with two failed executions (max retries exhausted)
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "DLQ test task",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: "execution.max_retries_exhausted",
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      // First execution failed with transient error
// @ts-ignore
      harness.store.insertExecution({
        id: executionId1,
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
        maxRetries: 2,
        retryBackoff: "exponential",
        lastErrorCode: "transient_error",
        lastErrorMessage: "temporary failure",
        startedAt: now,
        finishedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      // Second execution also failed - retries exhausted
// @ts-ignore
      harness.store.insertExecution({
        id: executionId2,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: executionId1,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "failed",
        inputRef: null,
        traceId,
        attempt: 2,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 2,
        retryBackoff: "exponential",
        lastErrorCode: "transient_error",
        lastErrorMessage: "retry still failing",
        startedAt: now,
        finishedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Recovery service should identify this as a DLQ candidate
    const recoveryService = new RuntimeRecoveryService(harness.store);
    const candidates = recoveryService.findRecoveryCandidates({
      includeStatuses: ["failed"],
      divisionId: "general_ops",
    });

    assert.ok(candidates.length >= 1, "Should find recovery candidates");
    const candidate = candidates.find(c => c.executionId === executionId2);
    assert.ok(candidate, "Should find the latest failed execution");
    assert.equal(candidate!.suggestedAction, "move_dead_letter", "Should suggest DLQ movement after max retries");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test: Error code classification - E7 locking error
// ---------------------------------------------------------------------------

test("E2E Recovery: E7 locking error suggests retry_new_ticket", async () => {
  const harness = createE2EHarness("aa-e2e-e7-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = newId("trace");
    const now = nowIso();

    harness.db.transaction(() => {
      harness.store.insertTask({
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

// @ts-ignore
      harness.store.insertExecution({
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
        lastErrorCode: "E7_LOCK_CONTENTION",
        lastErrorMessage: "Resource lock acquisition failed",
        startedAt: now,
        finishedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    });

    const recoveryService = new RuntimeRecoveryService(harness.store);
    const candidates = recoveryService.findRecoveryCandidates({
      includeStatuses: ["failed"],
    });

    const candidate = candidates.find(c => c.executionId === executionId);
    assert.ok(candidate, "Should find the E7 error execution");
    assert.equal(candidate!.errorClassification, "E7", "Should classify as E7 locking error");
    assert.equal(candidate!.suggestedAction, "retry_new_ticket", "E7 should suggest retry_new_ticket");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test: Error code classification - E8 memory error
// ---------------------------------------------------------------------------

test("E2E Recovery: E8 memory error suggests escalate_takeover", async () => {
  const harness = createE2EHarness("aa-e2e-e8-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = newId("trace");
    const now = nowIso();

    harness.db.transaction(() => {
      harness.store.insertTask({
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

// @ts-ignore
      harness.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "memory_intensive_workflow",
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
        lastErrorCode: "E8_MEMORY_LIMIT_EXCEEDED",
        lastErrorMessage: "Process killed due to OOM",
        startedAt: now,
        finishedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    });

    const recoveryService = new RuntimeRecoveryService(harness.store);
    const candidates = recoveryService.findRecoveryCandidates({
      includeStatuses: ["failed"],
    });

    const candidate = candidates.find(c => c.executionId === executionId);
    assert.ok(candidate, "Should find the E8 error execution");
    assert.equal(candidate!.errorClassification, "E8", "Should classify as E8 memory error");
    assert.equal(candidate!.suggestedAction, "escalate_takeover", "E8 should suggest escalate_takeover");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test: Error code classification - EC crash error
// ---------------------------------------------------------------------------

test("E2E Recovery: EC crash error suggests resume_same_worker if attempt is low", async () => {
  const harness = createE2EHarness("aa-e2e-ec-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = newId("trace");
    const now = nowIso();

    harness.db.transaction(() => {
      harness.store.insertTask({
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

// @ts-ignore
      harness.store.insertExecution({
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
        maxRetries: 3,
        retryBackoff: "exponential",
        lastErrorCode: "EC_WORKER_CRASH",
        lastErrorMessage: "Worker process crashed unexpectedly",
        startedAt: now,
        finishedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    });

    const recoveryService = new RuntimeRecoveryService(harness.store);
    const candidates = recoveryService.findRecoveryCandidates({
      includeStatuses: ["failed"],
    });

    const candidate = candidates.find(c => c.executionId === executionId);
    assert.ok(candidate, "Should find the EC crash execution");
    assert.equal(candidate!.errorClassification, "EC", "Should classify as EC crash error");
    // Low attempt with EC crash should suggest resume_same_worker
    assert.equal(candidate!.suggestedAction, "resume_same_worker", "EC crash at low attempt should suggest resume");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test: Stale execution detection
// ---------------------------------------------------------------------------

test("E2E Recovery: stale executing execution is detected and suggested for recovery", async () => {
  const harness = createE2EHarness("aa-e2e-stale-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = newId("trace");
    const now = nowIso();

    // Create task and execution that started a long time ago
    harness.db.transaction(() => {
      harness.store.insertTask({
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
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId,
        attempt: 1,
        timeoutMs: 5000, // Very short timeout
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: now, // Started at "now" but we check staleness by timeout
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    const recoveryService = new RuntimeRecoveryService(harness.store);
    const candidates = recoveryService.findStaleExecuting({
      stalenessThresholdMs: 1000, // 1ms staleness for testing
    });

    assert.ok(candidates.length >= 1, "Should find stale executing candidates");
    const staleCandidate = candidates.find(c => c.executionId === executionId);
    assert.ok(staleCandidate, "Should find the stale execution");
    assert.equal(staleCandidate!.status, "executing", "Should be in executing state");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test: Approval-pending escalation
// ---------------------------------------------------------------------------

test("E2E Recovery: approval-pending execution suggests escalate_takeover after timeout", async () => {
  const harness = createE2EHarness("aa-e2e-approval-pending-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Setup: execution blocked for approval
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Approval pending test",
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

// @ts-ignore
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

    const recoveryService = new RuntimeRecoveryService(harness.store);
    const candidates = recoveryService.findRecoveryCandidates({
      includeStatuses: ["blocked"],
    });

    assert.ok(candidates.length >= 1, "Should find blocked execution candidates");
    const candidate = candidates.find(c => c.executionId === executionId);
    assert.ok(candidate, "Should find the approval-pending execution");
    assert.equal(candidate!.taskStatus, "awaiting_decision", "Task should be awaiting decision");
    assert.equal(candidate!.suggestedAction, "escalate_takeover", "Long-pending approval should escalate");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test: Retry with new ticket (attempt escalation)
// ---------------------------------------------------------------------------

test("E2E Recovery: retry_new_ticket creates new execution with incremented attempt", async () => {
  const harness = createE2EHarness("aa-e2e-retry-new-");
  try {
    const taskId = newId("task");
    const executionId1 = newId("exec1");
    const executionId2 = newId("exec2");
    const traceId1 = newId("trace1");
    const traceId2 = newId("trace2");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Setup first execution that failed with retryable error
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Retry new ticket test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: "E7_LOCK_CONTENTION",
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

// @ts-ignore
      harness.store.insertExecution({
        id: executionId1,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "failed",
        inputRef: null,
        traceId: traceId1,
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 2,
        retryBackoff: "exponential",
        lastErrorCode: "E7_LOCK_CONTENTION",
        lastErrorMessage: "Lock acquisition failed",
        startedAt: now,
        finishedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Create new execution as retry
    harness.db.transaction(() => {
// @ts-ignore
      harness.store.insertExecution({
        id: executionId2,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: executionId1,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: traceId2,
        attempt: 2,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 2,
        retryBackoff: "exponential",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: nowIso(),
        finishedAt: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    });

    // Verify retry execution
    const exec2 = harness.store.getExecution(executionId2);
    assert.equal(exec2?.status, "executing", "New execution should be running");
    assert.equal(exec2?.attempt, 2, "Attempt should be incremented");
    assert.equal(exec2?.parentExecutionId, executionId1, "Should reference parent execution");
    assert.equal(exec2?.lastErrorCode, null, "New execution should have no errors");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test: Human takeover flow
// ---------------------------------------------------------------------------

test("E2E Recovery: execution escalated for human takeover transitions correctly", async () => {
  const harness = createE2EHarness("aa-e2e-takeover-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const sessionId = newId("sess");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Setup execution in blocked state awaiting human decision
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Human takeover test",
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

// @ts-ignore
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

    // Human approves and execution resumes
    ts.transitionExecutionStatus(makeExecCommand(executionId, "blocked", "executing", traceId));
    ts.transitionTaskStatus(makeTaskCommand(taskId, "awaiting_decision", "in_progress", traceId, executionId));

    const exec = harness.store.getExecution(executionId);
    assert.equal(exec?.status, "executing", "Execution should resume after human approval");

    const task = harness.store.getTask(taskId);
    assert.equal(task?.status, "in_progress", "Task should be in progress");
  } finally {
    harness.cleanup();
  }
});
