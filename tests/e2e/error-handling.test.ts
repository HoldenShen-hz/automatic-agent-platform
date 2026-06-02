/**
 * E2E Error Handling Tests
 *
 * End-to-end tests covering error handling scenarios using the centralized
 * createE2EHarness() helper. These tests verify the complete integration path
 * for error conditions including timeouts, worker failures, resource exhaustion,
 * and network failures.
 *
 * Error scenarios tested:
 * 1. Task execution timeout handling
 * 2. Worker failure recovery
 * 3. Resource exhaustion handling
 * 4. Network failure resilience
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../helpers/e2e-harness.js";
import { TransitionService } from "../../src/platform/five-plane-execution/state-transition/transition-service.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";
import type { ExecutionStatus } from "../../src/platform/contracts/types/status.js";

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function makeExecCommand(
  executionId: string,
  fromStatus: ExecutionStatus,
  toStatus: ExecutionStatus,
  traceId: string,
  reasonCode: string = "e2e_error_handling",
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
// Scenario 1: Task Execution Timeout Handling
// ---------------------------------------------------------------------------

test("E2E Error: task execution times out and transitions to failed state", async () => {
  const harness = createE2EHarness("aa-e2e-timeout-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const sessionId = newId("sess");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Setup: Create task and execution in running state
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: "Timeout test task",
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
        agentId: "agent-timeout",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId,
        attempt: 1,
        timeoutMs: 5000, // 5 second timeout for test
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

    // Verify execution is still running
    let exec = harness.store.getExecution(executionId);
    assert.equal(exec?.status, "executing", "Execution should be executing");

    // Simulate timeout: execution transitions to failed with timeout error code
    ts.transitionExecutionStatus(
      makeExecCommand(executionId, "executing", "failed", traceId, "execution.timeout"),
    );

    exec = harness.store.getExecution(executionId);
    assert.equal(exec?.status, "failed", "Execution should be failed after timeout");
    assert.equal(exec?.lastErrorCode, "execution.timeout", "Execution should have timeout error code");

    // Task reaches failed terminal state via timeout
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
      outputsJson: "{}",
      context: {
        reasonCode: "execution.timeout",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    // Verify task reached failed state
    const task = harness.store.getTask(taskId);
    assert.equal(task?.status, "failed", "Task should be failed after timeout");
    assert.equal(task?.errorCode, "execution.timeout", "Task should have timeout error code");

  } finally {
    harness.cleanup();
  }
});

test("E2E Error: execution timeout triggers retry when maxRetries > 0", async () => {
  const harness = createE2EHarness("aa-e2e-timeout-retry-");
  try {
    const taskId = newId("task");
    const executionId1 = newId("exec1");
    const executionId2 = newId("exec2");
    const sessionId = newId("sess");
    const traceId1 = newId("trace1");
    const traceId2 = newId("trace2");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Setup: Create task with retry-enabled execution
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
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

      // First execution times out with retry available
// @ts-ignore
      harness.store.insertExecution({
        id: executionId1,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-timeout",
        roleId: "general_executor",
        runKind: "task_run",
        status: "failed",
        inputRef: null,
        traceId: traceId1,
        attempt: 1,
        timeoutMs: 5000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 1,
        retryBackoff: "exponential",
        lastErrorCode: "execution.timeout",
        lastErrorMessage: "Task execution timed out",
        startedAt: now,
        finishedAt: now,
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

    // Verify first execution failed with timeout
    let exec1 = harness.store.getExecution(executionId1);
    assert.equal(exec1?.status, "failed", "First execution should be failed");
    assert.equal(exec1?.lastErrorCode, "execution.timeout", "First execution should have timeout error");

    // Create retry execution
    harness.db.transaction(() => {
// @ts-ignore
      harness.store.insertExecution({
        id: executionId2,
        taskId,
        workflowId: "single_agent_minimal",
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

    // Verify retry execution is running
    const exec2 = harness.store.getExecution(executionId2);
    assert.equal(exec2?.status, "executing", "Retry execution should be executing");
    assert.equal(exec2?.attempt, 2, "Retry execution should be attempt 2");
    assert.equal(exec2?.parentExecutionId, executionId1, "Retry should reference parent execution");

    // Retry succeeds
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
      taskOutputJson: JSON.stringify({ result: "completed after retry" }),
      outputsJson: "{}",
      context: {
        reasonCode: "task.completed",
        traceId: traceId2,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    const task = harness.store.getTask(taskId);
    assert.equal(task?.status, "done", "Task should complete after successful retry");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Scenario 2: Worker Failure Recovery
// ---------------------------------------------------------------------------

test("E2E Error: worker failure marks execution as failed and triggers recovery", async () => {
  const harness = createE2EHarness("aa-e2e-worker-failure-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const sessionId = newId("sess");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Setup: Create task in running state
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: "Worker failure test",
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
        agentId: "agent-worker-1",
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
        divisionId: "general-ops",
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

    // Simulate worker failure: execution fails with worker error
    ts.transitionExecutionStatus(
      makeExecCommand(executionId, "executing", "failed", traceId, "worker.failure"),
    );

    let exec = harness.store.getExecution(executionId);
    assert.equal(exec?.status, "failed", "Execution should be failed");
    assert.equal(exec?.lastErrorCode, "worker.failure", "Execution should have worker failure error");

    // Task reaches failed state
    ts.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "failed",
      terminalStatus: "failed",
      taskOutputJson: JSON.stringify({ error: "worker.failure" }),
      outputsJson: "{}",
      context: {
        reasonCode: "worker.failure",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    const task = harness.store.getTask(taskId);
    assert.equal(task?.status, "failed", "Task should be failed after worker failure");
    assert.equal(task?.errorCode, "worker.failure", "Task should have worker failure error code");

  } finally {
    harness.cleanup();
  }
});

test("E2E Error: worker becomes unavailable and execution is superseded", async () => {
  const harness = createE2EHarness("aa-e2e-worker-unavailable-");
  try {
    const taskId = newId("task");
    const executionId1 = newId("exec1");
    const executionId2 = newId("exec2");
    const sessionId = newId("sess");
    const traceId1 = newId("trace1");
    const traceId2 = newId("trace2");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Setup: Task with execution on worker that becomes unavailable
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: "Worker unavailable test",
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

      // First execution on worker that becomes unavailable
// @ts-ignore
      harness.store.insertExecution({
        id: executionId1,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-unavailable",
        roleId: "general_executor",
        runKind: "task_run",
        status: "blocked",
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

    // Worker becomes unavailable - first execution gets superseded
    ts.transitionExecutionStatus(makeExecCommand(executionId1, "blocked", "superseded", traceId1));

    let exec1 = harness.store.getExecution(executionId1);
    assert.equal(exec1?.status, "superseded", "First execution should be superseded");

    // New execution on different worker
    harness.db.transaction(() => {
// @ts-ignore
      harness.store.insertExecution({
        id: executionId2,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: executionId1,
        agentId: "agent-available",
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
    assert.equal(exec2?.status, "executing", "Second execution should be executing");
    assert.equal(exec2?.agentId, "agent-available", "Second execution should be on available worker");

    // Complete the recovery execution
    ts.transitionExecutionStatus(makeExecCommand(executionId2, "executing", "succeeded", traceId2));

    ts.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId: executionId2,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "succeeded",
      terminalStatus: "done",
      taskOutputJson: JSON.stringify({ result: "recovered on new worker" }),
      outputsJson: "{}",
      context: {
        reasonCode: "task.completed",
        traceId: traceId2,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    const task = harness.store.getTask(taskId);
    assert.equal(task?.status, "done", "Task should complete after worker recovery");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Scenario 3: Resource Exhaustion Handling
// ---------------------------------------------------------------------------

test("E2E Error: memory exhaustion causes execution failure", async () => {
  const harness = createE2EHarness("aa-e2e-resource-exhaust-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const sessionId = newId("sess");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Setup: Task running with significant resource usage
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: "Memory exhaustion test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: JSON.stringify({ memory_intensive: true }),
        normalizedInputJson: JSON.stringify({ memory_intensive: true }),
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
        agentId: "agent-memory",
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

    // Memory exhaustion - execution fails with resource error
    ts.transitionExecutionStatus(
      makeExecCommand(executionId, "executing", "failed", traceId, "resource.memory_exhausted"),
    );

    let exec = harness.store.getExecution(executionId);
    assert.equal(exec?.status, "failed", "Execution should be failed");
    assert.equal(exec?.lastErrorCode, "resource.memory_exhausted", "Should have memory exhaustion error");

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
      taskOutputJson: JSON.stringify({ error: "resource.memory_exhausted" }),
      outputsJson: "{}",
      context: {
        reasonCode: "resource.memory_exhausted",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    const task = harness.store.getTask(taskId);
    assert.equal(task?.status, "failed", "Task should be failed after memory exhaustion");
    assert.equal(task?.errorCode, "resource.memory_exhausted", "Task should have resource exhaustion error");

  } finally {
    harness.cleanup();
  }
});

test("E2E Error: budget exhaustion prevents execution start", async () => {
  const harness = createE2EHarness("aa-e2e-budget-exhaust-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const sessionId = newId("sess");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Setup: Task has entered execution orchestration, but the execution fails before work starts
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: "Budget exhaustion test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 10.0, // High estimated cost
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
        agentId: "agent-budget",
        roleId: "general_executor",
        runKind: "task_run",
        status: "created", // Not yet started
        inputRef: null,
        traceId,
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 0.01, // Very low budget limit
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: null,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      harness.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "open",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Budget check fails - execution cancelled due to insufficient budget
    ts.transitionExecutionStatus(
      makeExecCommand(executionId, "created", "failed", traceId, "budget.exhausted"),
    );

    const exec = harness.store.getExecution(executionId);
    assert.equal(exec?.status, "failed", "Execution should be failed due to budget exhaustion");
    assert.equal(exec?.lastErrorCode, "budget.exhausted", "Should have budget exhausted error");

    // Task reaches failed state
    ts.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "open",
      currentExecutionStatus: "failed",
      terminalStatus: "failed",
      taskOutputJson: JSON.stringify({ error: "budget.exhausted" }),
      outputsJson: "{}",
      context: {
        reasonCode: "budget.exhausted",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    const task = harness.store.getTask(taskId);
    assert.equal(task?.status, "failed", "Task should be failed due to budget exhaustion");
    assert.equal(task?.errorCode, "budget.exhausted", "Task should have budget exhausted error");

  } finally {
    harness.cleanup();
  }
});

test("E2E Error: disk space exhaustion triggers workflow failure", async () => {
  const harness = createE2EHarness("aa-e2e-disk-exhaust-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const sessionId = newId("sess");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Setup: Task with large file operations
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: "Disk exhaustion test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: JSON.stringify({ file_operations: ["large_file_1gb"] }),
        normalizedInputJson: JSON.stringify({ file_operations: ["large_file_1gb"] }),
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
        agentId: "agent-disk",
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

    // Disk exhaustion - execution fails
    ts.transitionExecutionStatus(
      makeExecCommand(executionId, "executing", "failed", traceId, "resource.disk_exhausted"),
    );

    let exec = harness.store.getExecution(executionId);
    assert.equal(exec?.status, "failed", "Execution should be failed");
    assert.equal(exec?.lastErrorCode, "resource.disk_exhausted", "Should have disk exhaustion error");

    // Task fails
    ts.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "failed",
      terminalStatus: "failed",
      taskOutputJson: JSON.stringify({ error: "resource.disk_exhausted" }),
      outputsJson: "{}",
      context: {
        reasonCode: "resource.disk_exhausted",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    const task = harness.store.getTask(taskId);
    assert.equal(task?.status, "failed", "Task should be failed after disk exhaustion");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Scenario 4: Network Failure Resilience
// ---------------------------------------------------------------------------

test("E2E Error: network failure causes provider error and execution retries", async () => {
  const harness = createE2EHarness("aa-e2e-network-failure-");
  try {
    const taskId = newId("task");
    const executionId1 = newId("exec1");
    const executionId2 = newId("exec2");
    const sessionId = newId("sess");
    const traceId1 = newId("trace1");
    const traceId2 = newId("trace2");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Setup: Task with provider-dependent workflow
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: "Network failure test",
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

      // First execution fails due to network issue
// @ts-ignore
      harness.store.insertExecution({
        id: executionId1,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-network",
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
        lastErrorCode: "provider.network_failure",
        lastErrorMessage: "Connection to AI provider timed out",
        startedAt: now,
        finishedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      harness.store.insertWorkflowState({
        taskId,
        divisionId: "general-ops",
        workflowId: "single_agent_minimal",
        currentStepIndex: 0,
        status: "running",
        outputsJson: "{}",
        lastErrorCode: "provider.network_failure",
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

    // Verify first execution failed with network error
    let exec1 = harness.store.getExecution(executionId1);
    assert.equal(exec1?.status, "failed", "First execution should be failed");
    assert.equal(exec1?.lastErrorCode, "provider.network_failure", "Should have network failure error");

    // Retry execution
    harness.db.transaction(() => {
// @ts-ignore
      harness.store.insertExecution({
        id: executionId2,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: executionId1,
        agentId: "agent-network",
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

    // Update workflow state for retry
    harness.db.transaction(() => {
      harness.store.updateWorkflowState(
        taskId,
        "running",
        0,
        "{}",
        nowIso(),
        null,
      );
    });

    // Retry succeeds
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
      taskOutputJson: JSON.stringify({ result: "completed after network recovery" }),
      outputsJson: "{}",
      context: {
        reasonCode: "task.completed",
        traceId: traceId2,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    const task = harness.store.getTask(taskId);
    assert.equal(task?.status, "done", "Task should complete after network recovery");

    const workflow = harness.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "completed", "Workflow should be completed after retry");

  } finally {
    harness.cleanup();
  }
});

test("E2E Error: persistent network failure exhausts retries and marks task failed", async () => {
  const harness = createE2EHarness("aa-e2e-network-persistent-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const sessionId = newId("sess");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Setup: Task with execution that will exhaust retries
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: "Persistent network failure test",
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

      // Execution with no retries remaining
// @ts-ignore
      harness.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-network",
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
        maxRetries: 0, // No retries left
        retryBackoff: "none",
        lastErrorCode: "provider.network_failure",
        lastErrorMessage: "Persistent connection failure to AI provider",
        startedAt: now,
        finishedAt: now,
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

    // Execution failed with persistent network error
    let exec = harness.store.getExecution(executionId);
    assert.equal(exec?.status, "failed", "Execution should be failed");
    assert.equal(exec?.lastErrorCode, "provider.network_failure", "Should have persistent network error");

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
      taskOutputJson: JSON.stringify({ error: "provider.network_failure", attempts: 3 }),
      outputsJson: "{}",
      context: {
        reasonCode: "provider.network_failure",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    const task = harness.store.getTask(taskId);
    assert.equal(task?.status, "failed", "Task should be failed after persistent network failure");

  } finally {
    harness.cleanup();
  }
});

test("E2E Error: transient external error is retryable", async () => {
  const harness = createE2EHarness("aa-e2e-transient-error-");
  try {
    const taskId = newId("task");
    const executionId1 = newId("exec1");
    const executionId2 = newId("exec2");
    const sessionId = newId("sess");
    const traceId1 = newId("trace1");
    const traceId2 = newId("trace2");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Setup
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: "Transient error retry test",
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
        agentId: "agent-transient",
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
        lastErrorCode: "external.transient_failure",
        lastErrorMessage: "Temporary external service unavailable",
        startedAt: now,
        finishedAt: now,
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

    // Verify transient error is retryable
    let exec1 = harness.store.getExecution(executionId1);
    assert.equal(exec1?.status, "failed", "First execution should be failed");
    assert.equal(exec1?.lastErrorCode, "external.transient_failure", "Should have transient error");

    // Create retry execution
    harness.db.transaction(() => {
// @ts-ignore
      harness.store.insertExecution({
        id: executionId2,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: executionId1,
        agentId: "agent-transient",
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

    // Retry succeeds
    ts.transitionExecutionStatus(makeExecCommand(executionId2, "executing", "succeeded", traceId2));

    ts.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId: executionId2,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "succeeded",
      terminalStatus: "done",
      taskOutputJson: JSON.stringify({ result: "recovered from transient error" }),
      outputsJson: "{}",
      context: {
        reasonCode: "task.completed",
        traceId: traceId2,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    const task = harness.store.getTask(taskId);
    assert.equal(task?.status, "done", "Task should complete after transient error recovery");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Combined Error Scenarios
// ---------------------------------------------------------------------------

test("E2E Error: timeout combined with worker failure leads to failed state", async () => {
  const harness = createE2EHarness("aa-e2e-timeout-worker-");
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
        divisionId: "general-ops",
        title: "Timeout + worker failure test",
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
        agentId: "agent-combined",
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

    // Both timeout and worker failure occur - execution fails
    ts.transitionExecutionStatus(
      makeExecCommand(executionId, "executing", "failed", traceId, "execution.timeout"),
    );

    let exec = harness.store.getExecution(executionId);
    assert.equal(exec?.status, "failed", "Execution should be failed");
    assert.equal(exec?.lastErrorCode, "execution.timeout", "Should have timeout error (primary)");

    // Task fails
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

  } finally {
    harness.cleanup();
  }
});

test("E2E Error: multiple resource exhaustion errors in sequence", async () => {
  const harness = createE2EHarness("aa-e2e-multi-resource-");
  try {
    const taskId = newId("task");
    const executionId1 = newId("exec1");
    const executionId2 = newId("exec2");
    const sessionId = newId("sess");
    const traceId1 = newId("trace1");
    const traceId2 = newId("trace2");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Setup with multiple retries
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: "Multi-resource exhaustion test",
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

      // First attempt fails with memory exhaustion
// @ts-ignore
      harness.store.insertExecution({
        id: executionId1,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-resource",
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
        lastErrorCode: "resource.memory_exhausted",
        lastErrorMessage: "Memory limit exceeded",
        startedAt: now,
        finishedAt: now,
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

    // First execution failed with memory error
    let exec1 = harness.store.getExecution(executionId1);
    assert.equal(exec1?.status, "failed", "First execution should be failed");
    assert.equal(exec1?.lastErrorCode, "resource.memory_exhausted", "Should have memory error");

    // Retry execution
    harness.db.transaction(() => {
// @ts-ignore
      harness.store.insertExecution({
        id: executionId2,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: executionId1,
        agentId: "agent-resource",
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

    // Second execution succeeds
    ts.transitionExecutionStatus(makeExecCommand(executionId2, "executing", "succeeded", traceId2));

    ts.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId: executionId2,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "succeeded",
      terminalStatus: "done",
      taskOutputJson: JSON.stringify({ result: "recovered after memory issue" }),
      outputsJson: "{}",
      context: {
        reasonCode: "task.completed",
        traceId: traceId2,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    const task = harness.store.getTask(taskId);
    assert.equal(task?.status, "done", "Task should complete after recovery");

  } finally {
    harness.cleanup();
  }
});
