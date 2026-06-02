/**
 * E2E Execution Flow Tests
 *
 * End-to-end tests covering the complete task execution flow from creation
 * through dispatch, execution, and completion.
 *
 * Tests validate:
 * - Task lifecycle transitions (queued -> pending -> in_progress -> done/failed)
 * - Execution state machine transitions
 * - Workflow state progression through steps
 * - Session status changes during execution
 * - Multi-step orchestration with output aggregation
 * - Error handling and failure recovery paths
 *
 * These tests use in-memory SQLite database and mock external dependencies.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { RuntimeStateMachine } from "../../src/platform/five-plane-execution/runtime-state-machine.js";
import { SqliteDatabase } from "../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { TransitionService } from "../../src/platform/five-plane-execution/state-transition/transition-service.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";
import type { ExecutionStatus, TaskStatus, WorkflowStatus, SessionStatus } from "../../src/platform/contracts/types/status.js";
import type {
  TaskStatusTransitionCommand,
  ExecutionStatusTransitionCommand,
  WorkflowStatusTransitionCommand,
  SessionStatusTransitionCommand,
} from "../../src/platform/contracts/types/domain.js";
import {
  createMinimalHarnessRun,
  createMinimalNodeRun,
  createMinimalPlanGraphBundle,
} from "../helpers/fixtures/base.js";

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
      divisionId: "general-ops",
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

// @ts-ignore
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
      divisionId: "general-ops",
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
// Tests: Complete Task Execution Flow
// ---------------------------------------------------------------------------

test("E2E: execution flow — complete happy path from queued to done", () => {
  const h = createE2eHarness("e2e-exec-flow-");
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

test("E2E: execution flow — task fails mid-execution", () => {
  const h = createE2eHarness("e2e-exec-fail-");
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
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: execution flow — execution blocked for approval and resumes", () => {
  const h = createE2eHarness("e2e-exec-blocked-");
  const taskId = newId("task");
  const executionId = newId("exec");
  const sessionId = newId("sess");
  const traceId = newId("trace");

  try {
    seedTaskWithExecution(h.store, h.db, taskId, executionId, sessionId, traceId);

    // Setup: queued -> pending -> in_progress, execution starts
    h.transitions.transitionTaskStatus(makeTaskCommand(taskId, "queued", "pending", traceId, null));
    h.transitions.transitionTaskStatus(makeTaskCommand(taskId, "pending", "in_progress", traceId, executionId));
    h.transitions.transitionExecutionStatus(makeExecCommand(executionId, "created", "prechecking", traceId));
    h.transitions.transitionExecutionStatus(makeExecCommand(executionId, "prechecking", "executing", traceId));

    // Execution becomes blocked
    h.transitions.transitionExecutionStatus(makeExecCommand(executionId, "executing", "blocked", traceId));
    let exec = h.store.getExecution(executionId);
    assert.equal(exec?.status, "blocked", "Execution should be blocked");

    // Transition task to awaiting_decision
    h.transitions.transitionTaskStatus({
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
    h.transitions.transitionSessionStatus(makeSessionCommand(sessionId, "open", "awaiting_user", traceId));

    let task = h.store.getTask(taskId);
    assert.equal(task?.status, "awaiting_decision", "Task should be awaiting_decision");

    // Approval resolved: execution resumes via blocked -> prechecking -> executing
    h.transitions.transitionExecutionStatus(makeExecCommand(executionId, "blocked", "prechecking", traceId));
    exec = h.store.getExecution(executionId);
    assert.equal(exec?.status, "prechecking", "Execution should return to prechecking after unblock");

    h.transitions.transitionExecutionStatus(makeExecCommand(executionId, "prechecking", "executing", traceId));

    // Task resumes
    h.transitions.transitionTaskStatus({
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
    h.transitions.transitionExecutionStatus(makeExecCommand(executionId, "executing", "succeeded", traceId));
    h.transitions.transitionTaskTerminalState({
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

    task = h.store.getTask(taskId);
    assert.equal(task?.status, "done", "Task should complete after approval");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: execution flow includes canonical HarnessRun, PlanGraphBundle, and NodeRun coverage", () => {
  const machine = new RuntimeStateMachine();
  const harnessRun = createMinimalHarnessRun({
    status: "ready",
    fencingToken: "fence-e2e-execution-flow",
    planGraphBundleId: "bundle-e2e-execution-flow",
  });
  const planGraphBundle = createMinimalPlanGraphBundle(harnessRun.harnessRunId, {
    planGraphBundleId: "bundle-e2e-execution-flow",
  });
  const nodeRun = createMinimalNodeRun(harnessRun.harnessRunId, planGraphBundle.planGraphBundleId, {
    nodeId: planGraphBundle.graph.entryNodeIds[0]!,
    status: "created",
    leaseId: "lease-e2e-execution-flow",
    fencingToken: "fence-e2e-execution-flow",
  });
  const traceId = newId("trace");

  const harnessRunning = machine.transition({
    commandId: newId("cmd"),
    entityType: "HarnessRun",
    entityId: harnessRun.harnessRunId,
    principal: "execution-e2e",
    aggregateType: "HarnessRun",
    aggregate: harnessRun,
    fromStatus: "ready",
    toStatus: "running",
    tenantId: harnessRun.tenantId,
    traceId,
    reasonCode: "e2e.execution.harness_running",
    emittedBy: "tests/e2e/execution-flow.test.ts",
    fencingToken: harnessRun.fencingToken ?? "fence-e2e-execution-flow",
    auditRef: "audit://execution-flow/harness-running",
  });
  assert.equal(planGraphBundle.harnessRunId, harnessRunning.aggregate.harnessRunId);
  assert.equal(harnessRunning.event.eventType, "platform.harness_run.status_changed");

  const nodeReady = machine.transition({
    commandId: newId("cmd"),
    entityType: "NodeRun",
    entityId: nodeRun.nodeRunId,
    principal: "execution-e2e",
    aggregateType: "NodeRun",
    aggregate: nodeRun,
    fromStatus: "created",
    toStatus: "ready",
    tenantId: harnessRun.tenantId,
    traceId,
    reasonCode: "e2e.execution.node_ready",
    emittedBy: "tests/e2e/execution-flow.test.ts",
    leaseId: nodeRun.leaseId ?? "lease-e2e-execution-flow",
    fencingToken: nodeRun.fencingToken ?? "fence-e2e-execution-flow",
    auditRef: "audit://execution-flow/node-ready",
  });
  assert.equal(nodeReady.aggregate.planGraphBundleId, planGraphBundle.planGraphBundleId);
  assert.equal(nodeReady.aggregate.harnessRunId, harnessRun.harnessRunId);
  assert.equal(nodeReady.event.eventType, "platform.node_run.status_changed");
});

test("E2E: execution flow — multi-step workflow progression", () => {
  const h = createE2eHarness("e2e-exec-multi-");
  const taskId = newId("task");
  const executionId = newId("exec");
  const sessionId = newId("sess");
  const traceId = newId("trace");
  const workflowId = "multi_step_wf";

  try {
    seedTaskWithExecution(h.store, h.db, taskId, executionId, sessionId, traceId, workflowId);

    // Start execution
    h.transitions.transitionTaskStatus(makeTaskCommand(taskId, "queued", "pending", traceId, null));
    h.transitions.transitionTaskStatus(makeTaskCommand(taskId, "pending", "in_progress", traceId, executionId));
    h.transitions.transitionExecutionStatus(makeExecCommand(executionId, "created", "prechecking", traceId));
    h.transitions.transitionExecutionStatus(makeExecCommand(executionId, "prechecking", "executing", traceId));

    // Step 0 completes
    const step0Output = { step0: { result: "step 0 done" } };
    h.db.transaction(() => {
      h.store.updateWorkflowState(taskId, "running", 1, JSON.stringify(step0Output), nowIso(), null);
    });

    let workflow = h.store.getWorkflowState(taskId);
    assert.equal(workflow?.currentStepIndex, 1, "Should advance to step 1");
    assert.deepEqual(JSON.parse(workflow!.outputsJson), step0Output, "Step 0 output should be stored");

    // Step 1 completes
    const step1Output = { step0: step0Output.step0, step1: { result: "step 1 done" } };
    h.db.transaction(() => {
      h.store.updateWorkflowState(taskId, "running", 2, JSON.stringify(step1Output), nowIso(), null);
    });

    workflow = h.store.getWorkflowState(taskId);
    assert.equal(workflow?.currentStepIndex, 2, "Should advance to step 2");

    // Final step completes
    h.db.transaction(() => {
      h.store.updateWorkflowState(taskId, "completed", 3, JSON.stringify({
        ...step1Output,
        final: { result: "workflow complete" },
      }), nowIso(), null);
    });

    workflow = h.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "completed", "Workflow should be completed");
    assert.equal(workflow?.currentStepIndex, 3, "Should be at final step index");

    // Complete task
    h.transitions.transitionSessionStatus({
      entityKind: "session",
      entityId: sessionId,
      fromStatus: "open",
      toStatus: "streaming",
      reasonCode: "session.streaming_started",
      traceId,
      actorType: "system",
      occurredAt: nowIso(),
    });
    h.transitions.transitionExecutionStatus(makeExecCommand(executionId, "executing", "succeeded", traceId));
    h.transitions.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "completed",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "succeeded",
      terminalStatus: "done",
      taskOutputJson: JSON.stringify({ result: "all steps completed" }),
      outputsJson: JSON.stringify(step1Output),
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

test("E2E: execution flow — task cancelled cannot transition", () => {
  const h = createE2eHarness("e2e-exec-cancel-");
  const taskId = newId("task");
  const executionId = newId("exec");
  const sessionId = newId("sess");
  const traceId = newId("trace");

  try {
    seedTaskWithExecution(h.store, h.db, taskId, executionId, sessionId, traceId);

    // Transition to pending first
    h.transitions.transitionTaskStatus(makeTaskCommand(taskId, "queued", "pending", traceId, null));

    // Cancel the task
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

test("E2E: execution flow — workflow paused and resumed", () => {
  const h = createE2eHarness("e2e-exec-pause-");
  const taskId = newId("task");
  const executionId = newId("exec");
  const sessionId = newId("sess");
  const traceId = newId("trace");

  try {
    seedTaskWithExecution(h.store, h.db, taskId, executionId, sessionId, traceId);

    // Setup execution
    h.transitions.transitionTaskStatus(makeTaskCommand(taskId, "queued", "pending", traceId, null));
    h.transitions.transitionTaskStatus(makeTaskCommand(taskId, "pending", "in_progress", traceId, executionId));
    h.transitions.transitionExecutionStatus(makeExecCommand(executionId, "created", "prechecking", traceId));
    h.transitions.transitionExecutionStatus(makeExecCommand(executionId, "prechecking", "executing", traceId));

    // Pause the workflow
    h.transitions.transitionWorkflowStatus(makeWorkflowCommand(taskId, "running", "paused", 0, "{}", traceId));

    let workflow = h.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "paused", "Workflow should be paused");

    // Resume the workflow
    h.transitions.transitionWorkflowStatus(makeWorkflowCommand(taskId, "paused", "resuming", 0, "{}", traceId));

    workflow = h.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "resuming", "Workflow should be resuming");

    h.transitions.transitionWorkflowStatus(makeWorkflowCommand(taskId, "resuming", "running", 0, "{}", traceId));

    workflow = h.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "running", "Workflow should be running again");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: execution flow — execution superseded by new attempt", () => {
  const h = createE2eHarness("e2e-exec-supersede-");
  const taskId = newId("task");
  const executionId1 = newId("exec1");
  const executionId2 = newId("exec2");
  const sessionId = newId("sess");
  const traceId1 = newId("trace1");
  const traceId2 = newId("trace2");
  const now = nowIso();

  try {
    // Create task with first execution in blocked state (prerequisite for superseded)
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: "E2E supersede test",
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

      // First execution is in blocked state (waiting for approval) which can transition to superseded
// @ts-ignore
      h.store.insertExecution({
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

    // First execution gets superseded by retry
    h.transitions.transitionExecutionStatus(makeExecCommand(executionId1, "blocked", "superseded", traceId1));

    let exec1 = h.store.getExecution(executionId1);
    assert.equal(exec1?.status, "superseded", "First execution should be superseded");

    // Insert second execution as retry
    h.db.transaction(() => {
// @ts-ignore
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

    const exec2 = h.store.getExecution(executionId2);
    assert.equal(exec2?.status, "executing", "Second execution should be running");
    assert.equal(exec2?.parentExecutionId, executionId1, "Second execution should reference parent");
    assert.equal(exec2?.attempt, 2, "Second execution should be attempt 2");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: execution flow — terminal state transition cascades to all entities", () => {
  const h = createE2eHarness("e2e-exec-cascade-");
  const taskId = newId("task");
  const executionId = newId("exec");
  const sessionId = newId("sess");
  const traceId = newId("trace");
  const now = nowIso();

  try {
    // Seed with all entities in non-terminal states
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: "E2E cascade test",
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
      h.store.insertExecution({
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

      h.store.insertWorkflowState({
        taskId,
        divisionId: "general-ops",
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

    // Transition task to failed via terminal state
    h.transitions.transitionTaskTerminalState({
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
    const task = h.store.getTask(taskId);
    assert.equal(task?.status, "failed", "Task should be failed");
    assert.equal(task?.errorCode, "cascade.test", "Task should have error code");

    const workflow = h.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "failed", "Workflow should be failed");

    const session = h.store.getSession(sessionId);
    assert.equal(session?.status, "failed", "Session should be failed");

    const exec = h.store.getExecution(executionId);
    assert.equal(exec?.status, "failed", "Execution should be failed");
    assert.ok(exec?.finishedAt != null, "Execution should have finishedAt");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: execution flow — task with retry recovers from transient failure", () => {
  const h = createE2eHarness("e2e-exec-retry-");
  const taskId = newId("task");
  const executionId1 = newId("exec1");
  const executionId2 = newId("exec2");
  const sessionId = newId("sess");
  const traceId1 = newId("trace1");
  const traceId2 = newId("trace2");
  const now = nowIso();

  try {
    // Create task with execution
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
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

      // First execution fails
// @ts-ignore
      h.store.insertExecution({
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

      h.store.insertWorkflowState({
        taskId,
        divisionId: "general-ops",
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

    // Verify first execution failed with retry available
    const exec1 = h.store.getExecution(executionId1);
    assert.equal(exec1?.status, "failed", "First execution should be failed");
    assert.equal(exec1?.lastErrorCode, "transient_error", "Should have error code");

    // Create retry execution
    h.db.transaction(() => {
// @ts-ignore
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
        maxRetries: 1,
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

    // Retry execution succeeds
    h.transitions.transitionExecutionStatus(makeExecCommand(executionId2, "executing", "succeeded", traceId2));

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
      taskOutputJson: JSON.stringify({ result: "retry succeeded" }),
      outputsJson: "{}",
      context: {
        reasonCode: "task.completed",
        traceId: traceId2,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    const task = h.store.getTask(taskId);
    assert.equal(task?.status, "done", "Task should complete on retry success");

    const workflow = h.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "completed", "Workflow should be completed");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
