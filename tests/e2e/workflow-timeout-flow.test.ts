/**
 * E2E Workflow Timeout Flow Tests
 *
 * End-to-end tests covering workflow timeout scenarios using the centralized
 * createE2EHarness() helper.
 *
 * Coverage:
 * 1. Execution timeout mid-workflow marks workflow failed
 * 2. Execution timeout with partial workflow outputs preserved
 * 3. Execution timeout triggers retry preserving workflow position
 * 4. Task fails gracefully when execution times out
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../helpers/e2e-harness.js";
import { TransitionService } from "../../src/platform/five-plane-execution/state-transition/transition-service.js";
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
    reasonCode: "e2e_timeout",
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
    reasonCode: "e2e_timeout",
    traceId,
    actorType: "agent" as const,
    occurredAt: nowIso(),
  };
}

// ---------------------------------------------------------------------------
// Test 1: Execution Timeout Mid-Workflow Marks Workflow Failed
// ---------------------------------------------------------------------------

test("E2E Workflow Timeout: execution timeout mid-workflow marks workflow as failed", async () => {
  const harness = createE2EHarness("aa-e2e-wf-timeout-fail-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const sessionId = newId("sess");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Setup: Workflow running at step 2
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Timeout failure test",
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
        workflowId: "multi_step_wf",
        parentExecutionId: null,
        agentId: "agent-timeout",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId,
        attempt: 1,
        timeoutMs: 5000,
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

      harness.store.insertWorkflowState({
        taskId,
        divisionId: "general_ops",
        workflowId: "multi_step_wf",
        currentStepIndex: 2,
        status: "running",
        outputsJson: JSON.stringify({ step0: "done", step1: "done" }),
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
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

    // Execution times out
    ts.transitionExecutionStatus(makeExecCommand(executionId, "executing", "failed", traceId));

    let exec = harness.store.getExecution(executionId);
    assert.equal(exec?.status, "failed", "Execution should be failed");
    assert.equal(exec?.lastErrorCode, "e2e_timeout", "Should have timeout error");

    // Workflow also marked as failed
    let workflow = harness.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "running", "Workflow still running until terminal state");

    // Task reaches terminal failed state
    ts.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "failed",
      terminalStatus: "failed",
      taskOutputJson: JSON.stringify({ error: "execution.timeout" }),
      outputsJson: JSON.stringify({ step0: "done", step1: "done" }),
      context: {
        reasonCode: "execution.timeout",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    workflow = harness.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "failed", "Workflow should be failed after timeout");

    const task = harness.store.getTask(taskId);
    assert.equal(task?.status, "failed", "Task should be failed");
    assert.equal(task?.errorCode, "execution.timeout", "Task should have timeout error code");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 2: Execution Timeout With Partial Workflow Outputs Preserved
// ---------------------------------------------------------------------------

test("E2E Workflow Timeout: partial outputs preserved when execution times out", async () => {
  const harness = createE2EHarness("aa-e2e-wf-timeout-outputs-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const sessionId = newId("sess");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Setup: Multi-step workflow at step 3 with completed steps 0-2
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Timeout outputs preservation test",
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
        workflowId: "multi_step_wf",
        parentExecutionId: null,
        agentId: "agent-timeout",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId,
        attempt: 1,
        timeoutMs: 3000,
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

      harness.store.insertWorkflowState({
        taskId,
        divisionId: "general_ops",
        workflowId: "multi_step_wf",
        currentStepIndex: 3,
        status: "running",
        outputsJson: JSON.stringify({
          step0_data: "initial",
          step1_data: "processing",
          step2_data: "ready",
        }),
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
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

    // Execution times out
    ts.transitionExecutionStatus(makeExecCommand(executionId, "executing", "failed", traceId));

    // Record partial outputs in workflow before terminal state
    harness.db.transaction(() => {
      harness.store.updateWorkflowRecoveryState({
        taskId,
        status: "failed",
        currentStepIndex: 3,
        outputsJson: JSON.stringify({
          step0_data: "initial",
          step1_data: "processing",
          step2_data: "ready",
        }),
        updatedAt: nowIso(),
        resumableFromStep: "step3",
        retryCount: 0,
        lastErrorCode: "execution.timeout",
      });
    });

    let workflow = harness.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "failed", "Workflow should be failed");
    const outputs = JSON.parse(workflow!.outputsJson);
    assert.equal(outputs.step0_data, "initial", "Step 0 output should be preserved");
    assert.equal(outputs.step1_data, "processing", "Step 1 output should be preserved");
    assert.equal(outputs.step2_data, "ready", "Step 2 output should be preserved");
    assert.equal(workflow?.lastErrorCode, "execution.timeout", "Error code should be recorded");
    assert.equal(workflow?.resumableFromStep, "step3", "Resumable from step 3");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 3: Execution Timeout Triggers Retry Preserving Workflow Position
// ---------------------------------------------------------------------------

test("E2E Workflow Timeout: retry execution preserves workflow position", async () => {
  const harness = createE2EHarness("aa-e2e-wf-timeout-retry-");
  try {
    const taskId = newId("task");
    const executionId1 = newId("exec1");
    const executionId2 = newId("exec2");
    const sessionId = newId("sess");
    const traceId1 = newId("trace1");
    const traceId2 = newId("trace2");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Setup: Task with execution at step 2 that will timeout
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Timeout retry test",
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

      // First execution times out at step 2
      harness.store.insertExecution({
        id: executionId1,
        taskId,
        workflowId: "multi_step_wf",
        parentExecutionId: null,
        agentId: "agent-timeout",
        roleId: "general_executor",
        runKind: "task_run",
        status: "failed",
        inputRef: null,
        traceId: traceId1,
        attempt: 1,
        timeoutMs: 3000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 1,
        retryBackoff: "exponential",
        lastErrorCode: "execution.timeout",
        lastErrorMessage: "Execution timed out",
        startedAt: now,
        finishedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      // Workflow state shows progress at step 2, resumable
      harness.store.insertWorkflowState({
        taskId,
        divisionId: "general_ops",
        workflowId: "multi_step_wf",
        currentStepIndex: 2,
        status: "running",
        outputsJson: JSON.stringify({ step0: "done", step1: "done" }),
        lastErrorCode: "execution.timeout",
        retryCount: 0,
        resumableFromStep: "step2",
        startedAt: now,
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

    // Verify first execution failed with timeout
    let exec1 = harness.store.getExecution(executionId1);
    assert.equal(exec1?.status, "failed", "First execution should be failed");
    assert.equal(exec1?.lastErrorCode, "execution.timeout", "Should have timeout error");

    let workflow = harness.store.getWorkflowState(taskId);
    assert.equal(workflow?.currentStepIndex, 2, "Workflow should be at step 2");
    assert.equal(workflow?.resumableFromStep, "step2", "Should be resumable from step 2");

    // Create retry execution
    harness.db.transaction(() => {
      harness.store.insertExecution({
        id: executionId2,
        taskId,
        workflowId: "multi_step_wf",
        parentExecutionId: executionId1,
        agentId: "agent-timeout",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: traceId2,
        attempt: 2,
        timeoutMs: 10000,
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

    // Verify retry execution references parent
    const exec2 = harness.store.getExecution(executionId2);
    assert.equal(exec2?.status, "executing", "Retry execution should be running");
    assert.equal(exec2?.parentExecutionId, executionId1, "Should reference parent execution");
    assert.equal(exec2?.attempt, 2, "Should be attempt 2");

    // Workflow recovery state updated for retry
    harness.db.transaction(() => {
      harness.store.updateWorkflowRecoveryState({
        taskId,
        status: "running",
        currentStepIndex: 2,
        outputsJson: JSON.stringify({ step0: "done", step1: "done" }),
        updatedAt: nowIso(),
        resumableFromStep: "step2",
        retryCount: 1,
        lastErrorCode: "execution.timeout",
      });
    });

    workflow = harness.store.getWorkflowState(taskId);
    assert.equal(workflow?.resumableFromStep, "step2", "Still resumable from step 2");
    assert.equal(workflow?.retryCount, 1, "Retry count should be incremented");

    // Complete step 2 and workflow
    harness.db.transaction(() => {
      harness.store.updateWorkflowState(
        taskId,
        "completed",
        3,
        JSON.stringify({ step0: "done", step1: "done", step2: "done" }),
        nowIso(),
        null,
      );
    });

    // Complete retry execution and task
    ts.transitionExecutionStatus(makeExecCommand(executionId2, "executing", "succeeded", traceId2));

    ts.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId: executionId2,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "completed",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "succeeded",
      terminalStatus: "done",
      taskOutputJson: JSON.stringify({ result: "completed after retry" }),
      outputsJson: JSON.stringify({ step0: "done", step1: "done", step2: "done" }),
      context: {
        reasonCode: "task.completed",
        traceId: traceId2,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    const task = harness.store.getTask(taskId);
    assert.equal(task?.status, "done", "Task should complete after successful retry");

    workflow = harness.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "completed", "Workflow should be completed");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 4: Task Fails Gracefully When Execution Times Out
// ---------------------------------------------------------------------------

test("E2E Workflow Timeout: task fails gracefully with proper error code on timeout", async () => {
  const harness = createE2EHarness("aa-e2e-wf-timeout-graceful-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const sessionId = newId("sess");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Setup
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Graceful timeout test",
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
        agentId: "agent-timeout",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId,
        attempt: 1,
        timeoutMs: 5000,
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

    // Execution times out
    ts.transitionExecutionStatus(makeExecCommand(executionId, "executing", "failed", traceId));

    // Task reaches failed terminal state with timeout error
    ts.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "failed",
      terminalStatus: "failed",
      taskOutputJson: JSON.stringify({ error: "Execution timed out after 5000ms" }),
      outputsJson: "{}",
      context: {
        reasonCode: "execution.timeout",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    const task = harness.store.getTask(taskId);
    assert.equal(task?.status, "failed", "Task should be failed");
    assert.equal(task?.errorCode, "execution.timeout", "Task should have timeout error code");
    assert.ok(task?.completedAt, "Task should have completedAt timestamp");

    const exec = harness.store.getExecution(executionId);
    assert.equal(exec?.status, "failed", "Execution should be failed");
    assert.equal(exec?.lastErrorCode, "execution.timeout", "Execution error code should match");

    const session = harness.store.getSession(sessionId);
    assert.equal(session?.status, "failed", "Session should be failed");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 5: Execution Timeout With Approval Required
// ---------------------------------------------------------------------------

test("E2E Workflow Timeout: execution timeout with approval required yields to blocked state", async () => {
  const harness = createE2EHarness("aa-e2e-wf-timeout-approval-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const sessionId = newId("sess");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Setup: Execution with approval required
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Timeout with approval test",
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
        agentId: "agent-timeout",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId,
        attempt: 1,
        timeoutMs: 5000,
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

    // Execution becomes blocked (needs approval) while running
    ts.transitionExecutionStatus(makeExecCommand(executionId, "executing", "blocked", traceId));

    let exec = harness.store.getExecution(executionId);
    assert.equal(exec?.status, "blocked", "Execution should be blocked");

    // Task transitions to awaiting_decision
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

    let task = harness.store.getTask(taskId);
    assert.equal(task?.status, "awaiting_decision", "Task should be awaiting_decision");

    // Approval times out - execution is still blocked
    ts.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "awaiting_decision",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "blocked",
      terminalStatus: "failed",
      taskOutputJson: JSON.stringify({ error: "approval.timeout" }),
      outputsJson: "{}",
      context: {
        reasonCode: "approval.timeout",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    task = harness.store.getTask(taskId);
    assert.equal(task?.status, "failed", "Task should fail on approval timeout");
    assert.equal(task?.errorCode, "approval.timeout", "Should have approval timeout error");

  } finally {
    harness.cleanup();
  }
});
