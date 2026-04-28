/**
 * E2E Task Lifecycle Tests
 *
 * End-to-end tests covering the complete task lifecycle:
 * 1. Task creation and queuing
 * 2. Task execution and completion
 * 3. Task cancellation
 * 4. Task retry and error recovery
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../helpers/e2e-harness.js";
import { TransitionService } from "../../src/platform/execution/state-transition/transition-service.js";
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
    reasonCode: "e2e_lifecycle",
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
    reasonCode: "e2e_lifecycle",
    traceId,
    actorType: "agent" as const,
    occurredAt: nowIso(),
  };
}

// ---------------------------------------------------------------------------
// Test 1: Task Creation and Queuing
// ---------------------------------------------------------------------------

test("E2E Task Lifecycle: task can be created and queued", async () => {
  const harness = createE2EHarness("aa-e2e-queue-");
  try {
    const taskId = newId("task");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Create task in queued state
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Queued task test",
        status: "queued",
        source: "user",
        priority: "normal",
        inputJson: JSON.stringify({ request: "test request" }),
        normalizedInputJson: JSON.stringify({ request: "test request" }),
        outputJson: null,
        estimatedCostUsd: 0.01,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    // Verify task is in queued state
    let task = harness.store.getTask(taskId);
    assert.equal(task?.status, "queued", "Task should be in queued state");
    assert.equal(task?.title, "Queued task test", "Task should have correct title");
    assert.ok(task?.createdAt, "Task should have createdAt timestamp");

    // Transition: queued -> pending
    ts.transitionTaskStatus(makeTaskCommand(taskId, "queued", "pending", traceId, null));
    task = harness.store.getTask(taskId);
    assert.equal(task?.status, "pending", "Task should transition to pending");

    // Transition: pending -> in_progress (execution starts)
    ts.transitionTaskStatus(makeTaskCommand(taskId, "pending", "in_progress", traceId, null));
    task = harness.store.getTask(taskId);
    assert.equal(task?.status, "in_progress", "Task should transition to in_progress");

  } finally {
    harness.cleanup();
  }
});

test("E2E Task Lifecycle: multiple tasks can be queued independently", async () => {
  const harness = createE2EHarness("aa-e2e-multi-queue-");
  try {
    const taskId1 = newId("task");
    const taskId2 = newId("task");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Create two tasks in queued state
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId1,
        parentId: null,
        rootId: taskId1,
        divisionId: "general_ops",
        tenantId: null,
        title: "First queued task",
        status: "queued",
        source: "user",
        priority: "high",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0.01,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      harness.store.insertTask({
        id: taskId2,
        parentId: null,
        rootId: taskId2,
        divisionId: "general_ops",
        tenantId: null,
        title: "Second queued task",
        status: "queued",
        source: "user",
        priority: "low",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0.02,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    // Verify both tasks are queued
    const task1 = harness.store.getTask(taskId1);
    const task2 = harness.store.getTask(taskId2);
    assert.equal(task1?.status, "queued", "First task should be queued");
    assert.equal(task2?.status, "queued", "Second task should be queued");
    assert.equal(task1?.priority, "high", "First task should have high priority");
    assert.equal(task2?.priority, "low", "Second task should have low priority");

    // Transition first task to pending
    ts.transitionTaskStatus(makeTaskCommand(taskId1, "queued", "pending", traceId, null));
    const updatedTask1 = harness.store.getTask(taskId1);
    const updatedTask2 = harness.store.getTask(taskId2);
    assert.equal(updatedTask1?.status, "pending", "First task should be pending");
    assert.equal(updatedTask2?.status, "queued", "Second task should still be queued");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 2: Task Execution and Completion
// ---------------------------------------------------------------------------

test("E2E Task Lifecycle: task executes and completes successfully", async () => {
  const harness = createE2EHarness("aa-e2e-execute-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const sessionId = newId("sess");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Setup: Create task in pending state with execution
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Execution test task",
        status: "pending",
        source: "user",
        priority: "normal",
        inputJson: JSON.stringify({ request: "do work" }),
        normalizedInputJson: JSON.stringify({ request: "do work" }),
        outputJson: null,
        estimatedCostUsd: 0.05,
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
        agentId: "agent-general",
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

    // Transition task to in_progress
    ts.transitionTaskStatus(makeTaskCommand(taskId, "pending", "in_progress", traceId, executionId));

    let task = harness.store.getTask(taskId);
    assert.equal(task?.status, "in_progress", "Task should be in_progress");

    // Execution completes successfully
    ts.transitionExecutionStatus(makeExecCommand(executionId, "executing", "succeeded", traceId));

    let exec = harness.store.getExecution(executionId);
    assert.equal(exec?.status, "succeeded", "Execution should be succeeded");

    // Transition task to done via terminal state
    ts.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "succeeded",
      terminalStatus: "done",
      taskOutputJson: JSON.stringify({ result: "success", output: "done" }),
      outputsJson: "[]",
      context: {
        reasonCode: "task.completed",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    // Verify final state
    task = harness.store.getTask(taskId);
    assert.equal(task?.status, "done", "Task should be done");
    assert.ok(task?.completedAt, "Task should have completedAt");
    assert.ok(task?.outputJson, "Task should have output");

    exec = harness.store.getExecution(executionId);
    assert.equal(exec?.status, "succeeded", "Execution should still be succeeded");
    assert.ok(exec?.finishedAt, "Execution should have finishedAt");

  } finally {
    harness.cleanup();
  }
});

test("E2E Task Lifecycle: task execution produces output", async () => {
  const harness = createE2EHarness("aa-e2e-output-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const sessionId = newId("sess");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();
    const expectedOutput = { result: "task completed", data: { count: 42, status: "ok" } };

    // Setup task with execution
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Output test task",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: JSON.stringify({ request: "process data" }),
        normalizedInputJson: JSON.stringify({ request: "process data" }),
        outputJson: null,
        estimatedCostUsd: 0.1,
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
        agentId: "agent-general",
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

      harness.store.insertSession({
        id: sessionId,
        taskId,
        channel: "api",
        status: "streaming",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Execution succeeds
    ts.transitionExecutionStatus(makeExecCommand(executionId, "executing", "succeeded", traceId));

    // Complete task with output
    ts.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "succeeded",
      terminalStatus: "done",
      taskOutputJson: JSON.stringify(expectedOutput),
      outputsJson: "[]",
      context: {
        reasonCode: "task.completed",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    const task = harness.store.getTask(taskId);
    assert.equal(task?.status, "done", "Task should be done");
    const output = JSON.parse(task?.outputJson ?? "{}");
    assert.equal(output.result, "task completed", "Output should contain result");
    assert.equal(output.data.count, 42, "Output should contain data.count");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 3: Task Cancellation
// ---------------------------------------------------------------------------

test("E2E Task Lifecycle: task can be cancelled from pending state", async () => {
  const harness = createE2EHarness("aa-e2e-cancel-pending-");
  try {
    const taskId = newId("task");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Setup task in pending state
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Cancel pending test",
        status: "pending",
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

    // Cancel the task
    ts.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "pending",
      toStatus: "cancelled",
      executionId: null,
      reasonCode: "user_cancelled",
      traceId,
      actorType: "user",
      occurredAt: now,
    });

    const task = harness.store.getTask(taskId);
    assert.equal(task?.status, "cancelled", "Task should be cancelled");

  } finally {
    harness.cleanup();
  }
});

test("E2E Task Lifecycle: cancelled task cannot transition to any other state", async () => {
  const harness = createE2EHarness("aa-e2e-cancel-immutable-");
  try {
    const taskId = newId("task");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Setup task in queued state
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Cancel immutability test",
        status: "queued",
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

    // Cancel the task
    ts.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "queued",
      toStatus: "cancelled",
      executionId: null,
      reasonCode: "user_cancelled",
      traceId,
      actorType: "user",
      occurredAt: now,
    });

    let task = harness.store.getTask(taskId);
    assert.equal(task?.status, "cancelled", "Task should be cancelled");

    // Attempt to transition from cancelled -> pending should throw
    assert.throws(
      () => {
        ts.transitionTaskStatus(makeTaskCommand(taskId, "cancelled", "pending", traceId, null));
      },
      /invalid transition/i,
      "Should not allow transition from cancelled to pending",
    );

    // Attempt to transition from cancelled -> in_progress should throw
    assert.throws(
      () => {
        ts.transitionTaskStatus(makeTaskCommand(taskId, "cancelled", "in_progress", traceId, null));
      },
      /invalid transition/i,
      "Should not allow transition from cancelled to in_progress",
    );

    // Attempt to transition from cancelled -> done should throw
    assert.throws(
      () => {
        ts.transitionTaskStatus(makeTaskCommand(taskId, "cancelled", "done", traceId, null));
      },
      /invalid transition/i,
      "Should not allow transition from cancelled to done",
    );

    // Verify task is still cancelled
    task = harness.store.getTask(taskId);
    assert.equal(task?.status, "cancelled", "Task should remain cancelled");

  } finally {
    harness.cleanup();
  }
});

test("E2E Task Lifecycle: cancelled task preserves error code if set", async () => {
  const harness = createE2EHarness("aa-e2e-cancel-error-");
  try {
    const taskId = newId("task");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Setup task in in_progress state
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Cancel with error test",
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

    // Cancel with reason
    ts.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "in_progress",
      toStatus: "cancelled",
      executionId: null,
      reasonCode: "user_requested",
      traceId,
      actorType: "user",
      occurredAt: now,
    });

    const task = harness.store.getTask(taskId);
    assert.equal(task?.status, "cancelled", "Task should be cancelled");
    assert.equal(task?.errorCode, null, "Cancelled task should not persist an error code");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 4: Task Retry and Error Recovery
// ---------------------------------------------------------------------------

test("E2E Task Lifecycle: task retry recovers from transient failure", async () => {
  const harness = createE2EHarness("aa-e2e-retry-recover-");
  try {
    const taskId = newId("task");
    const executionId1 = newId("exec1");
    const executionId2 = newId("exec2");
    const sessionId = newId("sess");
    const traceId1 = newId("trace1");
    const traceId2 = newId("trace2");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Setup initial task with execution that will fail
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Retry recovery test",
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

      // First execution fails with transient error
      harness.store.insertExecution({
        id: executionId1,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent_1",
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
        maxRetries: 1,
        retryBackoff: "exponential",
        lastErrorCode: "transient_network_error",
        lastErrorMessage: "Connection reset by peer",
        startedAt: now,
        finishedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      harness.store.insertWorkflowState({
        taskId,
        divisionId: "general_ops",
        workflowId: "single_agent_minimal",
        currentStepIndex: 0,
        status: "running",
        outputsJson: "{}",
        lastErrorCode: "transient_network_error",
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

    // Verify first execution failed
    let exec1 = harness.store.getExecution(executionId1);
    assert.equal(exec1?.status, "failed", "First execution should be failed");
    assert.equal(exec1?.lastErrorCode, "transient_network_error", "Should have error code");
    assert.equal(exec1?.attempt, 1, "First execution should be attempt 1");

    // Create retry execution
    harness.db.transaction(() => {
      harness.store.insertExecution({
        id: executionId2,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: executionId1,
        agentId: "agent_1",
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

    // Verify retry execution
    let exec2 = harness.store.getExecution(executionId2);
    assert.equal(exec2?.status, "executing", "Retry execution should be running");
    assert.equal(exec2?.parentExecutionId, executionId1, "Should reference parent execution");
    assert.equal(exec2?.attempt, 2, "Should be attempt 2");

    // Retry execution succeeds
    ts.transitionExecutionStatus(makeExecCommand(executionId2, "executing", "succeeded", traceId2));

    // Complete task via retry execution
    ts.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId: executionId2,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "succeeded",
      terminalStatus: "done",
      taskOutputJson: JSON.stringify({ result: "retry succeeded" }),
      outputsJson: "{}",
      context: {
        reasonCode: "task.completed",
        traceId: traceId2,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    // Verify final state
    const task = harness.store.getTask(taskId);
    assert.equal(task?.status, "done", "Task should complete on retry success");

    const workflow = harness.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "completed", "Workflow should be completed");

  } finally {
    harness.cleanup();
  }
});

test("E2E Task Lifecycle: task fails permanently after max retries exhausted", async () => {
  const harness = createE2EHarness("aa-e2e-retry-exhausted-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const sessionId = newId("sess");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Setup task with execution that has no retries left
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Max retries test",
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
        agentId: "agent_1",
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
        lastErrorCode: "permanent_failure",
        lastErrorMessage: "Unrecoverable error",
        startedAt: now,
        finishedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      harness.store.insertWorkflowState({
        taskId,
        divisionId: "general_ops",
        workflowId: "single_agent_minimal",
        currentStepIndex: 0,
        status: "failed",
        outputsJson: "{}",
        lastErrorCode: "permanent_failure",
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

    // Transition task to failed terminal state
    ts.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "failed",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "failed",
      terminalStatus: "failed",
      taskOutputJson: "{}",
      outputsJson: "{}",
      context: {
        reasonCode: "execution.failed",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    // Verify failure state
    const task = harness.store.getTask(taskId);
    assert.equal(task?.status, "failed", "Task should be failed");
    assert.equal(task?.errorCode, "execution.failed", "Task should have error code");

    const exec = harness.store.getExecution(executionId);
    assert.equal(exec?.status, "failed", "Execution should be failed");

    const workflow = harness.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "failed", "Workflow should be failed");

  } finally {
    harness.cleanup();
  }
});

test("E2E Task Lifecycle: task retry preserves partial workflow progress", async () => {
  const harness = createE2EHarness("aa-e2e-retry-progress-");
  try {
    const taskId = newId("task");
    const executionId1 = newId("exec1");
    const executionId2 = newId("exec2");
    const sessionId = newId("sess");
    const traceId1 = newId("trace1");
    const traceId2 = newId("trace2");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Setup task with multi-step workflow that failed mid-execution
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Retry progress test",
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

      // First execution failed at step 1
      harness.store.insertExecution({
        id: executionId1,
        taskId,
        workflowId: "multi_step_wf",
        parentExecutionId: null,
        agentId: "agent_1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "failed",
        inputRef: null,
        traceId: traceId1,
        attempt: 1,
        timeoutMs: 120000,
        budgetUsdLimit: 5,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 1,
        retryBackoff: "exponential",
        lastErrorCode: "step_timeout",
        lastErrorMessage: "Step 1 timed out",
        startedAt: now,
        finishedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      // Workflow state shows progress at step 1
      harness.store.insertWorkflowState({
        taskId,
        divisionId: "general_ops",
        workflowId: "multi_step_wf",
        currentStepIndex: 1,
        status: "running",
        outputsJson: JSON.stringify({ step0_output: "completed" }),
        lastErrorCode: "step_timeout",
        retryCount: 0,
        resumableFromStep: "1",
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

    // Verify first execution and workflow state
    let exec1 = harness.store.getExecution(executionId1);
    assert.equal(exec1?.status, "failed", "First execution should be failed");
    assert.equal(exec1?.lastErrorCode, "step_timeout", "Should have step timeout error");

    let workflow = harness.store.getWorkflowState(taskId);
    assert.equal(workflow?.currentStepIndex, 1, "Workflow should be at step 1");
    assert.ok(JSON.parse(workflow!.outputsJson).step0_output, "Step 0 output should be preserved");

    // Create retry execution
    harness.db.transaction(() => {
      harness.store.insertExecution({
        id: executionId2,
        taskId,
        workflowId: "multi_step_wf",
        parentExecutionId: executionId1,
        agentId: "agent_1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: traceId2,
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
        startedAt: nowIso(),
        finishedAt: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    });

    // Update workflow state to show step 1 completed in retry
    harness.db.transaction(() => {
      harness.store.updateWorkflowState(
        taskId,
        "running",
        2,
        JSON.stringify({ step0_output: "completed", step1_output: "also completed" }),
        nowIso(),
        null,
      );
    });

    workflow = harness.store.getWorkflowState(taskId);
    assert.equal(workflow?.currentStepIndex, 2, "Workflow should advance to step 2");
    assert.ok(JSON.parse(workflow!.outputsJson).step0_output, "Step 0 output preserved");
    assert.ok(JSON.parse(workflow!.outputsJson).step1_output, "Step 1 output preserved");

    // Complete step 2 and execution
    harness.db.transaction(() => {
      harness.store.updateWorkflowState(
        taskId,
        "completed",
        3,
        JSON.stringify({ step0_output: "completed", step1_output: "also completed", step2_output: "final" }),
        nowIso(),
        null,
      );
    });

    ts.transitionExecutionStatus(makeExecCommand(executionId2, "executing", "succeeded", traceId2));

    // Complete task
    ts.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId: executionId2,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "completed",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "succeeded",
      terminalStatus: "done",
      taskOutputJson: JSON.stringify({ result: "all steps completed on retry" }),
      outputsJson: JSON.stringify({ step0_output: "completed", step1_output: "also completed", step2_output: "final" }),
      context: {
        reasonCode: "task.completed",
        traceId: traceId2,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    // Verify final state
    const task = harness.store.getTask(taskId);
    assert.equal(task?.status, "done", "Task should complete after retry");

    workflow = harness.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "completed", "Workflow should be completed");
    assert.equal(workflow?.currentStepIndex, 3, "Terminal transition should preserve the completed workflow step index");

  } finally {
    harness.cleanup();
  }
});

test("E2E Task Lifecycle: superseded execution cannot be retried", async () => {
  const harness = createE2EHarness("aa-e2e-superseded-");
  try {
    const taskId = newId("task");
    const executionId1 = newId("exec1");
    const executionId2 = newId("exec2");
    const traceId1 = newId("trace1");
    const traceId2 = newId("trace2");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Setup task with blocked execution
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Supersede test",
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

      // First execution is blocked
      harness.store.insertExecution({
        id: executionId1,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent_1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "blocked",
        inputRef: null,
        traceId: traceId1,
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

    // First execution gets superseded by new attempt
    ts.transitionExecutionStatus(makeExecCommand(executionId1, "blocked", "superseded", traceId1));

    let exec1 = harness.store.getExecution(executionId1);
    assert.equal(exec1?.status, "superseded", "First execution should be superseded");

    // Create second execution as retry
    harness.db.transaction(() => {
      harness.store.insertExecution({
        id: executionId2,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: executionId1,
        agentId: "agent_1",
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

    const exec2 = harness.store.getExecution(executionId2);
    assert.equal(exec2?.status, "executing", "Second execution should be running");
    assert.equal(exec2?.parentExecutionId, executionId1, "Should reference parent");
    assert.equal(exec2?.attempt, 2, "Should be attempt 2");

  } finally {
    harness.cleanup();
  }
});
