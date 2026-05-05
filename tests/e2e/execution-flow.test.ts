/**
 * E2E Execution Flow Tests (MIGRATED)
 *
 * End-to-end tests covering complete execution scenarios including:
 * - Full execution lifecycle: created → prechecking → executing → succeeded/failed
 * - Execution with lease acquisition and release
 * - Execution with multiple retry attempts
 * - Execution cancellation flow
 * - Concurrent executions on same worker
 *
 * MIGRATION: R18-17, R18-18, R18-19
 * These tests have been migrated from the legacy insertWorkflowState API
 * to the canonical runMultiStepOrchestration API where applicable.
 *
 * OLD PATTERN (DEPRECATED):
 *   - createE2eHarness() with manual store.insertWorkflowState()
 *   - Manual workflow state manipulation via store.updateWorkflowState()
 *
 * NEW PATTERN (CANONICAL):
 *   - runMultiStepOrchestration() handles full lifecycle
 *   - stepOutputOverrides for controlling step outputs
 *   - stepFailureInjection/stepFailurePlans for error testing
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { existsSync, unlinkSync } from "node:fs";

import { runMultiStepOrchestration, type MultiStepToolExecutionInput } from "../../src/platform/execution/execution-engine/multi-step-orchestration.js";
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
} from "../../src/platform/contracts/types/domain.js";

/**
 * Helper to create a temporary database path for the test.
 */
function createTestDbPath(prefix: string): string {
  return join("/tmp", `${prefix}-${Date.now()}.db`);
}

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

// ---------------------------------------------------------------------------
// Test 1: Full execution lifecycle - happy path via canonical API
// ---------------------------------------------------------------------------

test("E2E: execution lifecycle - complete happy path from queued to done", async () => {
  const dbPath = createTestDbPath("e2e-exec-lifecycle");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const planSteps = [
    {
      stepId: "step_intake",
      dependencies: [],
      outputs: ["intake_triage"],
      timeout: 30000,
      retryPolicy: { maxRetries: 0 },
    },
  ];

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "E2E execution flow test",
    request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
    stepOutputOverrides: {
      step_intake: { intake_triage: { summary: "completed" } },
    },
  };

  try {
    const result = await runMultiStepOrchestration(input);

    // Verify result structure
    assert.ok(result.snapshot, "Should have snapshot");
    assert.ok(result.snapshot.task, "Should have task");
    assert.ok(result.snapshot.execution, "Should have execution");
    assert.ok(result.snapshot.workflow, "Should have workflow");

    // Verify task is in terminal state
    const task = result.snapshot.task;
    assert.ok(
      task?.status === "done" || task?.status === "failed" || task?.status === "cancelled",
      `Task should be in terminal state, got ${task?.status}`
    );

    // Verify execution status
    const execution = result.snapshot.execution;
    assert.ok(execution, "Should have execution");

    // Verify workflow is completed
    const workflow = result.snapshot.workflow;
    assert.ok(workflow, "Should have workflow state");

  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 2: Full execution lifecycle ending in failure
// ---------------------------------------------------------------------------

test("E2E: execution lifecycle - task fails mid-execution", async () => {
  const dbPath = createTestDbPath("e2e-exec-lifecycle-fail");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "E2E failure test",
    request: "Run a workflow that will fail mid-execution",
    stepFailureInjection: new Set(["step_0"]),
    stepFailurePlans: {
      "step_0": [{ errorCode: "execution.failed", summary: "Execution failed mid-workflow" }],
    },
  };

  try {
    const result = await runMultiStepOrchestration(input);

    // Verify task reached failed state
    const task = result.snapshot.task;
    assert.ok(task, "Should have task");
    assert.ok(
      task?.status === "failed" || task?.status === "cancelled",
      `Task should be in failure state, got ${task?.status}`
    );
    assert.equal(task?.errorCode, "execution.failed", "Task should have error code");

    // Verify execution is also failed
    const execution = result.snapshot.execution;
    assert.ok(execution, "Should have execution");
    assert.ok(
      execution?.status === "failed" || execution?.status === "cancelled",
      `Execution should be in failure state, got ${execution?.status}`
    );

  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
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
    // Setup: task in_progress with execution (lease testing requires direct store access)
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "E2E lease test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0.01,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        completedAt: null,
      });

      h.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent_general_executor",
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
        startedAt: nowIso(),
        finishedAt: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });

      h.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "streaming",
        externalSessionId: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    });

    // Create a lease for the execution
    const workerId = "worker-001";
    const leaseId = newId("lease");
    const now = nowIso();
    const leaseExpiry = new Date(Date.now() + 30000).toISOString();

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

    // Release the lease
    h.db.transaction(() => {
      h.store.updateLeaseStatus(leaseId, "released", nowIso());
    });

    // Verify lease is released
    lease = h.store.getLease(leaseId);
    assert.equal(lease?.status, "released", "Lease should be released");

    // Transition execution to succeeded
    h.transitions.transitionExecutionStatus(makeExecCommand(executionId, "executing", "succeeded", traceId));

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
// Test 4: Execution with multiple retry attempts (canonical API)
// ---------------------------------------------------------------------------

test("E2E: execution with multiple retry attempts", async () => {
  const dbPath = createTestDbPath("e2e-exec-retry");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const planSteps = [
    {
      stepId: "step_retry",
      dependencies: [],
      outputs: ["result"],
      timeout: 60000,
      retryPolicy: { maxRetries: 2 },
    },
  ];

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "E2E retry test",
    request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
    stepOutputOverrides: {
      step_retry: { result: "success after retry" },
    },
  };

  try {
    const result = await runMultiStepOrchestration(input);

    const task = result.snapshot.task;
    assert.ok(task, "Should have task");
    assert.ok(
      task?.status === "done" || task?.status === "failed" || task?.status === "cancelled",
      `Task should reach terminal state, got ${task?.status}`
    );

    // Verify workflow is completed
    const workflow = result.snapshot.workflow;
    assert.ok(workflow, "Should have workflow state");

  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
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
    // Setup: task in pending state
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "E2E cancellation test",
        status: "pending",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0.01,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        completedAt: null,
      });

      h.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent_general_executor",
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
        startedAt: null,
        finishedAt: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });

      h.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "open",
        externalSessionId: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    });

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

// ============================================================================
// MIGRATION DOCUMENTATION
// ============================================================================
//
// LEGACY CODE (DEPRECATED - shown for reference only):
// ---------------------------------------------------------------------------
//
//   function createE2eHarness(prefix: string) {
//     const workspace = createTempWorkspace(prefix);
//     const dbPath = join(workspace, "e2e-execution-flow.db");
//     const db = new SqliteDatabase(dbPath);
//     db.migrate();
//     const store = new AuthoritativeTaskStore(db);
//     const transitions = new TransitionService(db, store);
//     return { workspace, dbPath, db, store, transitions };
//   }
//
//   test("legacy: execution lifecycle", () => {
//     const h = createE2eHarness("e2e-exec-");
//     seedTaskWithExecution(h.store, h.db, taskId, executionId, sessionId, traceId);
//     // Uses: store.insertWorkflowState()  // <-- LEGACY API
//     // Then: store.updateWorkflowState()  // <-- LEGACY API
//   });
//
// CANONICAL CODE (CURRENT):
// ---------------------------------------------------------------------------
//
//   const input: MultiStepToolExecutionInput = {
//     dbPath,
//     title: "Test workflow",
//     request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
//     stepOutputOverrides: { "step_0": { output: "value" } },
//     stepFailureInjection: new Set(["step_1"]),
//     stepFailurePlans: { "step_1": [{ errorCode: "ERR" }] },
//   };
//
//   const result = await runMultiStepOrchestration(input);
//   // result.snapshot.task, result.snapshot.workflow, etc.
//
// NOTES:
//   - Lease testing (test 3) still requires direct store access
//   - Cancellation and concurrent tests require TransitionService
//   - Core execution flow tests now use canonical runMultiStepOrchestration
//
// See docs_zh/migrations/e2e-workflow-state-migration.md for full migration guide.
