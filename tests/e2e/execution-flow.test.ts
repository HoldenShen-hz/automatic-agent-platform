/**
 * E2E Execution Flow Tests
 *
 * End-to-end tests covering complete execution scenarios including:
 * - Full execution lifecycle: created → prechecking → executing → succeeded/failed
 * - Execution with lease acquisition and release
 * - Execution with multiple retry attempts
 * - Execution cancellation flow
 * - Concurrent executions on same worker
 *
 * Uses in-memory SQLite database and mock external dependencies.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { TransitionService } from "../../src/platform/execution/state-transition/transition-service.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";
import type {
  ExecutionStatus,
  TaskStatus,
  WorkflowStatus,
  SessionStatus,
} from "../../src/platform/contracts/types/status.js";
import type {
  TaskStatusTransitionCommand,
  ExecutionStatusTransitionCommand,
  WorkflowStatusTransitionCommand,
  SessionStatusTransitionCommand,
} from "../../src/platform/contracts/types/domain.js";

function createE2eHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "e2e-execution-flow.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const transitions = new TransitionService(db, store);

  return { workspace, dbPath, db, store, transitions };
}

function makeTaskCommand(
  taskId: string,
  fromStatus: TaskStatus,
  toStatus: TaskStatus,
  traceId: string,
  executionId: string | null = null,
): TaskStatusTransitionCommand {
  return {
    entityKind: "task",
    entityId: taskId,
    fromStatus,
    toStatus,
    executionId,
    reasonCode: "e2e_test",
    traceId,
    actorType: "system",
    occurredAt: nowIso(),
  };
}

function makeExecCommand(
  executionId: string,
  fromStatus: ExecutionStatus,
  toStatus: ExecutionStatus,
  traceId: string,
): ExecutionStatusTransitionCommand {
  return {
    entityKind: "execution",
    entityId: executionId,
    fromStatus,
    toStatus,
    reasonCode: "e2e_test",
    traceId,
    actorType: "agent",
    occurredAt: nowIso(),
  };
}

function makeWorkflowCommand(
  taskId: string,
  fromStatus: WorkflowStatus,
  toStatus: WorkflowStatus,
  currentStepIndex: number,
  outputsJson: string,
  traceId: string,
): WorkflowStatusTransitionCommand {
  return {
    entityKind: "workflow",
    entityId: taskId,
    fromStatus,
    toStatus,
    currentStepIndex,
    outputsJson,
    reasonCode: "e2e_test",
    traceId,
    actorType: "system",
    occurredAt: nowIso(),
  };
}

function makeSessionCommand(
  sessionId: string,
  fromStatus: SessionStatus,
  toStatus: SessionStatus,
  traceId: string,
): SessionStatusTransitionCommand {
  return {
    entityKind: "session",
    entityId: sessionId,
    fromStatus,
    toStatus,
    reasonCode: "e2e_test",
    traceId,
    actorType: "system",
    occurredAt: nowIso(),
  };
}

function seedTaskWithExecution(
  store: AuthoritativeTaskStore,
  db: SqliteDatabase,
  taskId: string,
  executionId: string,
  sessionId: string,
  traceId: string,
  workflowId: string = "single_agent_minimal",
  taskStatus: TaskStatus = "queued",
  executionStatus: ExecutionStatus = "created",
  sessionStatus: SessionStatus = "open",
): void {
  const now = nowIso();
  db.transaction(() => {
    store.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general_ops",
      title: "E2E execution flow test",
      status: taskStatus,
      source: "user",
      priority: "normal",
      inputJson: JSON.stringify({ request: "test execution flow" }),
      normalizedInputJson: JSON.stringify({ request: "test execution flow" }),
      outputJson: null,
      estimatedCostUsd: 0.01,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    });

    store.insertExecution({
      id: executionId,
      taskId,
      workflowId,
      parentExecutionId: null,
      agentId: "agent_general_executor",
      roleId: "general_executor",
      runKind: "task_run",
      status: executionStatus,
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
      startedAt: executionStatus === "executing" ? now : null,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    store.insertWorkflowState({
      taskId,
      divisionId: "general_ops",
      workflowId,
      currentStepIndex: 0,
      status: "running",
      outputsJson: "{}",
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    });

    store.insertSession({
      id: sessionId,
      taskId,
      channel: "cli",
      status: sessionStatus,
      externalSessionId: null,
      createdAt: now,
      updatedAt: now,
    });
  });
}

// ---------------------------------------------------------------------------
// Test 1: Full execution lifecycle - created → prechecking → executing → succeeded
// ---------------------------------------------------------------------------

test("E2E: execution lifecycle - complete happy path from queued to done", () => {
  const h = createE2eHarness("e2e-exec-lifecycle-");
  const taskId = newId("task");
  const executionId = newId("exec");
  const sessionId = newId("sess");
  const traceId = newId("trace");

  try {
    // Seed initial state
    seedTaskWithExecution(h.store, h.db, taskId, executionId, sessionId, traceId);

    // Verify initial state
    let task = h.store.getTask(taskId);
    assert.equal(task?.status, "queued", "Task should start in queued state");

    let exec = h.store.getExecution(executionId);
    assert.equal(exec?.status, "created", "Execution should start in created state");

    let workflow = h.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "running", "Workflow should start in running state");
    assert.equal(workflow?.currentStepIndex, 0, "Workflow should start at step 0");

    // Transition: queued -> pending
    h.transitions.transitionTaskStatus(makeTaskCommand(taskId, "queued", "pending", traceId, null));
    task = h.store.getTask(taskId);
    assert.equal(task?.status, "pending", "Task should transition to pending");

    // Transition: pending -> in_progress
    h.transitions.transitionTaskStatus(makeTaskCommand(taskId, "pending", "in_progress", traceId, executionId));
    task = h.store.getTask(taskId);
    assert.equal(task?.status, "in_progress", "Task should transition to in_progress");

    // Transition session: open -> streaming
    h.transitions.transitionSessionStatus(makeSessionCommand(sessionId, "open", "streaming", traceId));
    let session = h.store.getSession(sessionId);
    assert.equal(session?.status, "streaming", "Session should transition to streaming");

    // Transition execution: created -> prechecking
    h.transitions.transitionExecutionStatus(makeExecCommand(executionId, "created", "prechecking", traceId));
    exec = h.store.getExecution(executionId);
    assert.equal(exec?.status, "prechecking", "Execution should transition to prechecking");

    // Transition execution: prechecking -> executing
    h.transitions.transitionExecutionStatus(makeExecCommand(executionId, "prechecking", "executing", traceId));
    exec = h.store.getExecution(executionId);
    assert.equal(exec?.status, "executing", "Execution should transition to executing");
    assert.ok(exec?.startedAt != null, "Execution should have startedAt timestamp");

    // Advance workflow step
    h.db.transaction(() => {
      h.store.updateWorkflowState(taskId, "running", 1, JSON.stringify({ intake_triage: { summary: "completed" } }), nowIso(), null);
    });

    // Transition execution: executing -> succeeded
    h.transitions.transitionExecutionStatus(makeExecCommand(executionId, "executing", "succeeded", traceId));
    exec = h.store.getExecution(executionId);
    assert.equal(exec?.status, "succeeded", "Execution should transition to succeeded");
    assert.ok(exec?.finishedAt != null, "Execution should have finishedAt timestamp");

    // Transition task to done via terminal state
    h.transitions.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "succeeded",
      terminalStatus: "done",
      taskOutputJson: JSON.stringify({ result: "success" }),
      outputsJson: JSON.stringify({ intake_triage: { summary: "completed" } }),
      context: {
        reasonCode: "task.completed",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    task = h.store.getTask(taskId);
    assert.equal(task?.status, "done", "Task should transition to done");
    assert.ok(task?.completedAt != null, "Task should have completedAt timestamp");

    workflow = h.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "completed", "Workflow should transition to completed");

    session = h.store.getSession(sessionId);
    assert.equal(session?.status, "completed", "Session should transition to completed");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

// ---------------------------------------------------------------------------
// Test 2: Full execution lifecycle ending in failure
// ---------------------------------------------------------------------------

test("E2E: execution lifecycle - task fails mid-execution", () => {
  const h = createE2eHarness("e2e-exec-lifecycle-fail-");
  const taskId = newId("task");
  const executionId = newId("exec");
  const sessionId = newId("sess");
  const traceId = newId("trace");

  try {
    seedTaskWithExecution(h.store, h.db, taskId, executionId, sessionId, traceId);

    // queued -> pending -> in_progress
    h.transitions.transitionTaskStatus(makeTaskCommand(taskId, "queued", "pending", traceId, null));
    h.transitions.transitionTaskStatus(makeTaskCommand(taskId, "pending", "in_progress", traceId, executionId));

    // execution: created -> prechecking -> executing
    h.transitions.transitionExecutionStatus(makeExecCommand(executionId, "created", "prechecking", traceId));
    h.transitions.transitionExecutionStatus(makeExecCommand(executionId, "prechecking", "executing", traceId));

    // execution fails
    h.transitions.transitionExecutionStatus(makeExecCommand(executionId, "executing", "failed", traceId));

    const exec = h.store.getExecution(executionId);
    assert.equal(exec?.status, "failed", "Execution should be failed");
    assert.ok(exec?.finishedAt != null, "Execution should have finishedAt timestamp");

    // Task fails via terminal state
    h.transitions.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "open",
      currentExecutionStatus: "failed",
      terminalStatus: "failed",
      taskOutputJson: JSON.stringify({ error: "execution failed" }),
      outputsJson: "{}",
      context: {
        reasonCode: "execution.failed",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    const task = h.store.getTask(taskId);
    assert.equal(task?.status, "failed", "Task should be failed");
    assert.equal(task?.errorCode, "execution.failed", "Task should have error code");
    assert.ok(task?.completedAt != null, "Task should have completedAt timestamp");

    const workflow = h.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "failed", "Workflow should be failed");

    const session = h.store.getSession(sessionId);
    assert.equal(session?.status, "failed", "Session should be failed");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

// ---------------------------------------------------------------------------
// Test 3: Execution with lease acquisition and release
// ---------------------------------------------------------------------------

test("E2E: execution with lease acquisition and release", () => {
  const h = createE2eHarness("e2e-exec-lease-");
  const taskId = newId("task");
  const executionId = newId("exec");
  const sessionId = newId("sess");
  const traceId = newId("trace");

  try {
    // Seed initial state
    seedTaskWithExecution(h.store, h.db, taskId, executionId, sessionId, traceId);

    // Transition to executing
    h.transitions.transitionTaskStatus(makeTaskCommand(taskId, "queued", "pending", traceId, null));
    h.transitions.transitionTaskStatus(makeTaskCommand(taskId, "pending", "in_progress", traceId, executionId));
    h.transitions.transitionExecutionStatus(makeExecCommand(executionId, "created", "prechecking", traceId));
    h.transitions.transitionExecutionStatus(makeExecCommand(executionId, "prechecking", "executing", traceId));

    // Create a lease for the execution
    const workerId = "worker-001";
    const leaseId = newId("lease");
    const now = nowIso();
    const leaseExpiry = new Date(Date.now() + 30000).toISOString(); // 30 seconds from now

    h.db.transaction(() => {
      h.store.insertLease({
        id: leaseId,
        executionId,
        workerId,
        status: "active",
        createdAt: now,
        updatedAt: now,
        expiresAt: leaseExpiry,
        taskId,
      });
    });

    // Verify lease is active
    let lease = h.store.getLease(leaseId);
    assert.equal(lease?.status, "active", "Lease should be active");
    assert.equal(lease?.workerId, workerId, "Lease should belong to worker");
    assert.equal(lease?.executionId, executionId, "Lease should reference execution");
    assert.ok(lease?.expiresAt != null, "Lease should have expiresAt timestamp");

    // Release the lease
    h.db.transaction(() => {
      h.store.updateLeaseStatus(leaseId, "released", nowIso());
    });

    // Verify lease is released
    lease = h.store.getLease(leaseId);
    assert.equal(lease?.status, "released", "Lease should be released");
    assert.ok(lease?.updatedAt != null, "Lease should have updatedAt timestamp");

    // Complete execution normally
    h.transitions.transitionExecutionStatus(makeExecCommand(executionId, "executing", "succeeded", traceId));

    h.transitions.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "succeeded",
      terminalStatus: "done",
      taskOutputJson: JSON.stringify({ result: "success" }),
      outputsJson: JSON.stringify({}),
      context: {
        reasonCode: "task.completed",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    const task = h.store.getTask(taskId);
    assert.equal(task?.status, "done", "Task should be done");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

// ---------------------------------------------------------------------------
// Test 4: Execution with multiple retry attempts
// ---------------------------------------------------------------------------

test("E2E: execution with multiple retry attempts", () => {
  const h = createE2eHarness("e2e-exec-retry-");
  const taskId = newId("task");
  const executionId1 = newId("exec1");
  const executionId2 = newId("exec2");
  const sessionId = newId("sess");
  const traceId1 = newId("trace1");
  const traceId2 = newId("trace2");
  const now = nowIso();

  try {
    // Create task with first execution in executing state
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "E2E retry test",
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

      // First execution is in executing state with maxRetries=2
      h.store.insertExecution({
        id: executionId1,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent_1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
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

    // First execution attempt fails
    h.transitions.transitionExecutionStatus({
      entityKind: "execution",
      entityId: executionId1,
      fromStatus: "executing",
      toStatus: "failed",
      reasonCode: "llm_error",
      traceId: traceId1,
      actorType: "agent",
      occurredAt: nowIso(),
    });

    let exec1 = h.store.getExecution(executionId1);
    assert.equal(exec1?.status, "failed", "First execution should be failed");
    assert.equal(exec1?.attempt, 1, "First execution should be attempt 1");
    assert.equal(exec1?.lastErrorCode, "llm_error", "First execution should have error code");
    assert.ok(exec1?.finishedAt != null, "First execution should have finishedAt timestamp");

    // Create second execution attempt
    h.db.transaction(() => {
      h.store.insertExecution({
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
        maxRetries: 2,
        retryBackoff: "exponential",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: nowIso(),
        finishedAt: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });

      // Update workflow to track retry
      h.store.updateWorkflowState(taskId, "running", 0, "{}", nowIso(), null);
    });

    let exec2 = h.store.getExecution(executionId2);
    assert.equal(exec2?.status, "executing", "Second execution should be executing");
    assert.equal(exec2?.attempt, 2, "Second execution should be attempt 2");
    assert.equal(exec2?.parentExecutionId, executionId1, "Second execution should reference parent");

    // Second execution attempt succeeds
    h.transitions.transitionExecutionStatus({
      entityKind: "execution",
      entityId: executionId2,
      fromStatus: "executing",
      toStatus: "succeeded",
      reasonCode: "task.completed",
      traceId: traceId2,
      actorType: "agent",
      occurredAt: nowIso(),
    });

    exec2 = h.store.getExecution(executionId2);
    assert.equal(exec2?.status, "succeeded", "Second execution should be succeeded");
    assert.ok(exec2?.finishedAt != null, "Second execution should have finishedAt timestamp");

    // Complete task
    h.transitions.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId: executionId2,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "succeeded",
      terminalStatus: "done",
      taskOutputJson: JSON.stringify({ result: "success" }),
      outputsJson: "{}",
      context: {
        reasonCode: "task.completed",
        traceId: traceId2,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    const task = h.store.getTask(taskId);
    assert.equal(task?.status, "done", "Task should be done");

    const workflow = h.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "completed", "Workflow should be completed");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

// ---------------------------------------------------------------------------
// Test 5: Execution cancellation flow
// ---------------------------------------------------------------------------

test("E2E: execution cancellation flow", () => {
  const h = createE2eHarness("e2e-exec-cancel-");
  const taskId = newId("task");
  const executionId = newId("exec");
  const sessionId = newId("sess");
  const traceId = newId("trace");

  try {
    seedTaskWithExecution(h.store, h.db, taskId, executionId, sessionId, traceId);

    // Transition task to pending
    h.transitions.transitionTaskStatus(makeTaskCommand(taskId, "queued", "pending", traceId, null));

    // Transition execution to prechecking
    h.transitions.transitionExecutionStatus(makeExecCommand(executionId, "created", "prechecking", traceId));

    // Cancel the execution
    h.transitions.transitionExecutionStatus({
      entityKind: "execution",
      entityId: executionId,
      fromStatus: "prechecking",
      toStatus: "cancelled",
      reasonCode: "user_cancelled",
      traceId,
      actorType: "user",
      occurredAt: nowIso(),
    });

    const exec = h.store.getExecution(executionId);
    assert.equal(exec?.status, "cancelled", "Execution should be cancelled");
    assert.ok(exec?.finishedAt != null, "Execution should have finishedAt timestamp");

    // Transition task to cancelled
    h.transitions.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "pending",
      toStatus: "cancelled",
      executionId: null,
      reasonCode: "user_cancelled",
      traceId,
      actorType: "user",
      occurredAt: nowIso(),
    });

    const task = h.store.getTask(taskId);
    assert.equal(task?.status, "cancelled", "Task should be cancelled");
    assert.ok(task?.completedAt != null, "Task should have completedAt timestamp");

    // Attempt to transition from cancelled -> in_progress should throw
    assert.throws(
      () => {
        h.transitions.transitionTaskStatus(makeTaskCommand(taskId, "cancelled", "in_progress", traceId, executionId));
      },
      /invalid transition/i,
      "Should not allow transition from cancelled",
    );
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

// ---------------------------------------------------------------------------
// Test 6: Concurrent executions on same worker
// ---------------------------------------------------------------------------

test("E2E: concurrent executions on same worker", () => {
  const h = createE2eHarness("e2e-exec-concurrent-");
  const taskId1 = newId("task1");
  const taskId2 = newId("task2");
  const executionId1 = newId("exec1");
  const executionId2 = newId("exec2");
  const sessionId1 = newId("sess1");
  const sessionId2 = newId("sess2");
  const traceId1 = newId("trace1");
  const traceId2 = newId("trace2");
  const workerId = "worker-001";
  const now = nowIso();

  try {
    h.db.transaction(() => {
      // Task 1
      h.store.insertTask({
        id: taskId1,
        parentId: null,
        rootId: taskId1,
        divisionId: "general_ops",
        title: "Concurrent task 1",
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
        id: executionId1,
        taskId: taskId1,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: workerId,
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: traceId1,
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

      h.store.insertWorkflowState({
        taskId: taskId1,
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

      h.store.insertSession({
        id: sessionId1,
        taskId: taskId1,
        channel: "cli",
        status: "streaming",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });

      // Task 2
      h.store.insertTask({
        id: taskId2,
        parentId: null,
        rootId: taskId2,
        divisionId: "general_ops",
        title: "Concurrent task 2",
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
        id: executionId2,
        taskId: taskId2,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: workerId,
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: traceId2,
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

      h.store.insertWorkflowState({
        taskId: taskId2,
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

      h.store.insertSession({
        id: sessionId2,
        taskId: taskId2,
        channel: "cli",
        status: "streaming",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Create leases for both executions on same worker
    const leaseId1 = newId("lease1");
    const leaseId2 = newId("lease2");
    const leaseExpiry = new Date(Date.now() + 60000).toISOString();

    h.db.transaction(() => {
      h.store.insertLease({
        id: leaseId1,
        executionId: executionId1,
        workerId,
        status: "active",
        createdAt: now,
        updatedAt: now,
        expiresAt: leaseExpiry,
        taskId: taskId1,
      });

      h.store.insertLease({
        id: leaseId2,
        executionId: executionId2,
        workerId,
        status: "active",
        createdAt: now,
        updatedAt: now,
        expiresAt: leaseExpiry,
        taskId: taskId2,
      });
    });

    // Verify both executions are running on the same worker
    const exec1 = h.store.getExecution(executionId1);
    const exec2 = h.store.getExecution(executionId2);
    assert.equal(exec1?.agentId, workerId, "Execution 1 should be assigned to worker");
    assert.equal(exec2?.agentId, workerId, "Execution 2 should be assigned to same worker");
    assert.equal(exec1?.status, "executing", "Execution 1 should be executing");
    assert.equal(exec2?.status, "executing", "Execution 2 should be executing");

    // Complete first execution
    h.transitions.transitionExecutionStatus({
      entityKind: "execution",
      entityId: executionId1,
      fromStatus: "executing",
      toStatus: "succeeded",
      reasonCode: "task.completed",
      traceId: traceId1,
      actorType: "system",
      occurredAt: nowIso(),
    });

    h.transitions.transitionTaskTerminalState({
      taskId: taskId1,
      sessionId: sessionId1,
      executionId: executionId1,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "succeeded",
      terminalStatus: "done",
      taskOutputJson: JSON.stringify({ result: "success" }),
      outputsJson: "{}",
      context: {
        reasonCode: "task.completed",
        traceId: traceId1,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    // Release lease for first execution
    h.db.transaction(() => {
      h.store.updateLeaseStatus(leaseId1, "released", nowIso());
    });

    const lease1 = h.store.getLease(leaseId1);
    assert.equal(lease1?.status, "released", "First lease should be released");

    // Second execution continues unaffected
    const exec2After = h.store.getExecution(executionId2);
    assert.equal(exec2After?.status, "executing", "Second execution should still be executing");

    const task2 = h.store.getTask(taskId2);
    assert.equal(task2?.status, "in_progress", "Task 2 should still be in progress");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
