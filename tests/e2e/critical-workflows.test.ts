/**
 * E2E Critical Workflows Tests
 *
 * End-to-end tests covering critical business workflows using the centralized
 * createE2EHarness() helper. These tests verify the complete integration path
 * across task lifecycle, workflow execution, error handling, and approval flows.
 *
 * Critical paths tested:
 * 1. Task lifecycle (create -> execute -> complete)
 * 2. Workflow execution (multi-step)
 * 3. Error handling and recovery
 * 4. Approval flows
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
    reasonCode: "e2e_critical",
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
    reasonCode: "e2e_critical",
    traceId,
    actorType: "agent" as const,
    occurredAt: nowIso(),
  };
}

// ---------------------------------------------------------------------------
// Critical Path 1: Task Lifecycle
// ---------------------------------------------------------------------------

test("E2E Critical: task completes successfully through full lifecycle pipeline", async () => {
  const harness = createE2EHarness("aa-e2e-task-lifecycle-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const sessionId = newId("sess");
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
        title: "Critical workflow test task",
        status: "queued",
        source: "user",
        priority: "normal",
        inputJson: JSON.stringify({ request: "complete this task" }),
        normalizedInputJson: JSON.stringify({ request: "complete this task" }),
        outputJson: null,
        estimatedCostUsd: 0.01,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    // Verify task starts in queued
    let task = harness.store.getTask(taskId);
    assert.equal(task?.status, "queued", "Task should start in queued");

    // Transition: queued -> pending
    ts.transitionTaskStatus(makeTaskCommand(taskId, "queued", "pending", traceId, null));
    task = harness.store.getTask(taskId);
    assert.equal(task?.status, "pending", "Task should transition to pending");

    // Insert execution
    harness.db.transaction(() => {
// @ts-ignore
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
    });

    // Transition: pending -> in_progress
    ts.transitionTaskStatus(makeTaskCommand(taskId, "pending", "in_progress", traceId, executionId));
    task = harness.store.getTask(taskId);
    assert.equal(task?.status, "in_progress", "Task should be in_progress");

    // Transition execution: executing -> succeeded
    ts.transitionExecutionStatus(makeExecCommand(executionId, "executing", "succeeded", traceId));

    // Insert session
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
      taskOutputJson: JSON.stringify({ result: "success" }),
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

    const exec = harness.store.getExecution(executionId);
    assert.equal(exec?.status, "succeeded", "Execution should be succeeded");
    assert.ok(exec?.finishedAt, "Execution should have finishedAt");

  } finally {
    harness.cleanup();
  }
});

test("E2E Critical: task fails mid-execution and reaches failed terminal state", async () => {
  const harness = createE2EHarness("aa-e2e-task-fail-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const sessionId = newId("sess");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Setup: Create task, execution, session in running state
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Failing task test",
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

    // Execution fails
    ts.transitionExecutionStatus(makeExecCommand(executionId, "executing", "failed", traceId));

    // Task reaches failed terminal state
    ts.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "failed",
      terminalStatus: "failed",
      taskOutputJson: "{}",
      outputsJson: "[]",
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

    } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Critical Path 2: Workflow Execution (Multi-Step)
// ---------------------------------------------------------------------------

test("E2E Critical: multi-step workflow executes all steps in dependency order", async () => {
  const harness = createE2EHarness("aa-e2e-workflow-multi-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Setup: Create task with multi-step workflow
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Multi-step workflow test",
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
        workflowId: "multi_step_wf",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId,
        attempt: 1,
        timeoutMs: 120000,
        budgetUsdLimit: 5,
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
        currentStepIndex: 0,
        status: "running",
        outputsJson: "{}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
      });
    });

    // Step 0 -> Step 1
    harness.db.transaction(() => {
      harness.store.updateWorkflowState(
        taskId,
        "running",
        1,
        JSON.stringify({ step0_output: "result_from_step_0" }),
        nowIso(),
        null,
      );
    });

    let workflow = harness.store.getWorkflowState(taskId);
    assert.equal(workflow?.currentStepIndex, 1, "Should advance to step 1");
    assert.equal(
      JSON.parse(workflow!.outputsJson).step0_output,
      "result_from_step_0",
      "Step 0 output should be preserved",
    );

    // Step 1 -> Step 2
    harness.db.transaction(() => {
      harness.store.updateWorkflowState(
        taskId,
        "running",
        2,
        JSON.stringify({ step0_output: "result_from_step_0", step1_output: "result_from_step_1" }),
        nowIso(),
        null,
      );
    });

    workflow = harness.store.getWorkflowState(taskId);
    assert.equal(workflow?.currentStepIndex, 2, "Should advance to step 2");

    // Step 2 -> completed (final step)
    harness.db.transaction(() => {
      harness.store.updateWorkflowState(
        taskId,
        "completed",
        3,
        JSON.stringify({
          step0_output: "result_from_step_0",
          step1_output: "result_from_step_1",
          step2_output: "final_result",
        }),
        nowIso(),
        null,
      );
    });

    workflow = harness.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "completed", "Workflow should be completed");
    assert.equal(workflow?.currentStepIndex, 3, "Should be at final step index");

    // Complete execution and task
    ts.transitionExecutionStatus(makeExecCommand(executionId, "executing", "succeeded", traceId));
    ts.transitionTaskTerminalState({
      taskId,
      sessionId: newId("sess"),
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "completed",
      currentSessionStatus: "open",
      currentExecutionStatus: "succeeded",
      terminalStatus: "done",
      taskOutputJson: JSON.stringify({ result: "all steps completed" }),
      outputsJson: JSON.stringify({ step0_output: "result_from_step_0", step1_output: "result_from_step_1", step2_output: "final_result" }),
      context: {
        reasonCode: "task.completed",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    const task = harness.store.getTask(taskId);
    assert.equal(task?.status, "done", "Task should complete after all steps");

    } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Critical Path 3: Error Handling and Recovery
// ---------------------------------------------------------------------------

test("E2E Critical: task with retry recovers from transient failure", async () => {
  const harness = createE2EHarness("aa-e2e-retry-");
  try {
    const taskId = newId("task");
    const executionId1 = newId("exec1");
    const executionId2 = newId("exec2");
    const sessionId = newId("sess");
    const traceId1 = newId("trace1");
    const traceId2 = newId("trace2");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Setup initial execution that fails
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
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
// @ts-ignore
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
        lastErrorCode: "transient_error",
        lastErrorMessage: "temporary failure",
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
        lastErrorCode: "transient_error",
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

    // Verify first execution failed with retry available
    const exec1 = harness.store.getExecution(executionId1);
    assert.equal(exec1?.status, "failed", "First execution should be failed");
    assert.equal(exec1?.lastErrorCode, "transient_error", "Should have error code");

    // Create retry execution
    harness.db.transaction(() => {
// @ts-ignore
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

    // Retry execution succeeds
    ts.transitionExecutionStatus(makeExecCommand(executionId2, "executing", "succeeded", traceId2));

    // Complete task
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

    const task = harness.store.getTask(taskId);
    assert.equal(task?.status, "done", "Task should complete on retry success");

    const workflow = harness.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "completed", "Workflow should be completed");

    } finally {
    harness.cleanup();
  }
});

test("E2E Critical: execution superseded by new attempt", async () => {
  const harness = createE2EHarness("aa-e2e-supersede-");
  try {
    const taskId = newId("task");
    const executionId1 = newId("exec1");
    const executionId2 = newId("exec2");
    const sessionId = newId("sess");
    const traceId1 = newId("trace1");
    const traceId2 = newId("trace2");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Setup task with first execution in blocked state
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
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

      // First execution is blocked (waiting for approval)
// @ts-ignore
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

    // First execution gets superseded by retry
    ts.transitionExecutionStatus(makeExecCommand(executionId1, "blocked", "superseded", traceId1));

    let exec1 = harness.store.getExecution(executionId1);
    assert.equal(exec1?.status, "superseded", "First execution should be superseded");

    // Insert second execution as retry
    harness.db.transaction(() => {
// @ts-ignore
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
    assert.equal(exec2?.parentExecutionId, executionId1, "Second execution should reference parent");
    assert.equal(exec2?.attempt, 2, "Second execution should be attempt 2");

    } finally {
    harness.cleanup();
  }
});

test("E2E Critical: cancelled task cannot transition to any other state", async () => {
  const harness = createE2EHarness("aa-e2e-cancel-");
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
        title: "Cancel immutability test",
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

    // Attempt to transition from cancelled -> in_progress should throw
    assert.throws(
      () => {
        ts.transitionTaskStatus(makeTaskCommand(taskId, "cancelled", "in_progress", traceId, null));
      },
      /invalid transition/i,
      "Should not allow transition from cancelled",
    );

    // Attempt to transition from cancelled -> done should throw
    assert.throws(
      () => {
        ts.transitionTaskStatus(makeTaskCommand(taskId, "cancelled", "done", traceId, null));
      },
      /invalid transition/i,
      "Should not allow cancelled to done",
    );

    } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Critical Path 4: Approval Flows
// ---------------------------------------------------------------------------

test("E2E Critical: execution blocked for approval and resumes after approval", async () => {
  const harness = createE2EHarness("aa-e2e-approval-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const sessionId = newId("sess");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Setup task in running state
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Approval flow test",
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
        agentId: "agent_1",
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

      harness.store.insertWorkflowState({
        taskId,
        divisionId: "general_ops",
        workflowId: "single_agent_minimal",
        currentStepIndex: 0,
        status: "running",
        outputsJson: "{}",
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

    // Session transitions to awaiting_user
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

    let task = harness.store.getTask(taskId);
    assert.equal(task?.status, "awaiting_decision", "Task should be awaiting_decision");

    let session = harness.store.getSession(sessionId);
    assert.equal(session?.status, "awaiting_user", "Session should be awaiting_user");

    // Approval resolved: execution resumes
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

    // Complete execution
    ts.transitionExecutionStatus(makeExecCommand(executionId, "executing", "succeeded", traceId));

    // Complete task
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
    assert.equal(task?.status, "done", "Task should complete after approval");

    } finally {
    harness.cleanup();
  }
});

test("E2E Critical: terminal state transition cascades to all entities", async () => {
  const harness = createE2EHarness("aa-e2e-cascade-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const sessionId = newId("sess");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Setup all entities in non-terminal states
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Cascade test",
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
        agentId: "agent_1",
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

      harness.store.insertWorkflowState({
        taskId,
        divisionId: "general_ops",
        workflowId: "single_agent_minimal",
        currentStepIndex: 1,
        status: "running",
        outputsJson: "{}",
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

    // Transition task to failed via terminal state
    ts.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "executing",
      terminalStatus: "failed",
      taskOutputJson: JSON.stringify({ error: "cascade_test_failure" }),
      outputsJson: "{}",
      context: {
        reasonCode: "cascade.test",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    // Verify all entities transitioned to terminal state
    const task = harness.store.getTask(taskId);
    assert.equal(task?.status, "failed", "Task should be failed");
    assert.equal(task?.errorCode, "cascade.test", "Task should have error code");

    const workflow = harness.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "failed", "Workflow should be failed");

    const session = harness.store.getSession(sessionId);
    assert.equal(session?.status, "failed", "Session should be failed");

    const exec = harness.store.getExecution(executionId);
    assert.equal(exec?.status, "failed", "Execution should be failed");
    assert.ok(exec?.finishedAt != null, "Execution should have finishedAt");

    } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Combined Critical Paths
// ---------------------------------------------------------------------------

test("E2E Critical: complete workflow with pause and resume", async () => {
  const harness = createE2EHarness("aa-e2e-pause-resume-");
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
        title: "Pause-resume test",
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
        agentId: "agent_1",
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

      harness.store.insertWorkflowState({
        taskId,
        divisionId: "general_ops",
        workflowId: "single_agent_minimal",
        currentStepIndex: 0,
        status: "running",
        outputsJson: "{}",
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

    // Pause the workflow
    ts.transitionWorkflowStatus({
      entityKind: "workflow",
      entityId: taskId,
      fromStatus: "running",
      toStatus: "paused",
      currentStepIndex: 0,
      outputsJson: "{}",
      reasonCode: "user_pause",
      traceId,
      actorType: "system",
      occurredAt: nowIso(),
    });

    let workflow = harness.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "paused", "Workflow should be paused");

    // Resume the workflow
    ts.transitionWorkflowStatus({
      entityKind: "workflow",
      entityId: taskId,
      fromStatus: "paused",
      toStatus: "resuming",
      currentStepIndex: 0,
      outputsJson: "{}",
      reasonCode: "user_resume",
      traceId,
      actorType: "system",
      occurredAt: nowIso(),
    });

    workflow = harness.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "resuming", "Workflow should be resuming");

    ts.transitionWorkflowStatus({
      entityKind: "workflow",
      entityId: taskId,
      fromStatus: "resuming",
      toStatus: "running",
      currentStepIndex: 0,
      outputsJson: "{}",
      reasonCode: "system_resume",
      traceId,
      actorType: "system",
      occurredAt: nowIso(),
    });

    workflow = harness.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "running", "Workflow should be running again");

    // Complete the task
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
      taskOutputJson: JSON.stringify({ result: "completed after pause/resume" }),
      outputsJson: "{}",
      context: {
        reasonCode: "task.completed",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    const task = harness.store.getTask(taskId);
    assert.equal(task?.status, "done", "Task should complete after resume");

    } finally {
    harness.cleanup();
  }
});
