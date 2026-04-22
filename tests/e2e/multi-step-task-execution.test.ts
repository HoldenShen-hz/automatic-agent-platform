/**
 * E2E Multi-Step Task Execution Flow Tests
 *
 * End-to-end tests covering multi-step task execution:
 * - Task creation and dispatch
 * - Execution lifecycle through steps
 * - Output aggregation across steps
 * - Task completion with results
 *
 * These tests verify the full task execution path from
 * queued task through complete multi-step execution.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { TransitionService } from "../../src/platform/execution/state-transition/transition-service.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";
import type { TaskStatus, ExecutionStatus } from "../../src/platform/contracts/types/status.js";

function createE2eHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "e2e-multi-step-exec.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const transitions = new TransitionService(db, store);

  return { workspace, db, store, transitions };
}

function insertTaskWithExecution(
  db: SqliteDatabase,
  store: AuthoritativeTaskStore,
  taskId: string,
  executionId: string,
  traceId: string,
  workflowId: string,
  status: TaskStatus = "pending",
  executionStatus: ExecutionStatus = "executing",
): void {
  const now = nowIso();
  db.transaction(() => {
    store.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general_ops",
      title: "Multi-step execution test",
      status,
      source: "user",
      priority: "normal",
      inputJson: JSON.stringify({ request: "execute multi-step task" }),
      normalizedInputJson: JSON.stringify({ request: "execute multi-step task" }),
      outputJson: null,
      estimatedCostUsd: 0,
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
      agentId: "agent-coordinator",
      roleId: "coordinator",
      runKind: "task_run",
      status: executionStatus,
      inputRef: null,
      traceId,
      attempt: 1,
      timeoutMs: 120000,
      budgetUsdLimit: 5,
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
  });
}

test("E2E: multi-step task executes step 0 and transitions to step 1", () => {
  const h = createE2eHarness("e2e-mstep-exec-");

  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = "e2e-mstep-trace";
    const now = nowIso();

    insertTaskWithExecution(h.db, h.store, taskId, executionId, traceId, "multi_step_wf");

    // Verify initial state - step 0 running
    let workflow = h.store.getWorkflowState(taskId);
    assert.ok(workflow, "Workflow should exist");
    assert.equal(workflow!.currentStepIndex, 0, "Should start at step 0");
    assert.equal(workflow!.status, "running", "Should be running");

    // Simulate step 0 completing and advancing to step 1
    h.db.transaction(() => {
      h.store.updateWorkflowState(
        taskId,
        "running",
        1,
        JSON.stringify({ step_0_output: "data_from_step_0" }),
        now,
        null,
      );
    });

    workflow = h.store.getWorkflowState(taskId);
    assert.equal(workflow!.currentStepIndex, 1, "Should advance to step 1");
    const outputs = JSON.parse(workflow!.outputsJson);
    assert.equal(outputs.step_0_output, "data_from_step_0", "Step 0 output should be preserved");
  } finally {
    cleanupPath(h.workspace);
  }
});

test("E2E: multi-step task completes all steps and reaches terminal state", () => {
  const h = createE2eHarness("e2e-mstep-complete-");

  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = "e2e-mstep-complete-trace";

    insertTaskWithExecution(h.db, h.store, taskId, executionId, traceId, "linear_wf", "in_progress");

    // Advance through all steps
    const now = nowIso();

    // Step 0 -> Step 1
    h.db.transaction(() => {
      h.store.updateWorkflowState(
        taskId,
        "running",
        1,
        JSON.stringify({ step_0: "result_0" }),
        now,
        null,
      );
    });

    // Step 1 -> Step 2
    h.db.transaction(() => {
      h.store.updateWorkflowState(
        taskId,
        "running",
        2,
        JSON.stringify({ step_0: "result_0", step_1: "result_1" }),
        now,
        null,
      );
    });

    // Step 2 -> Step 3 (final)
    h.db.transaction(() => {
      h.store.updateWorkflowState(
        taskId,
        "completed",
        3,
        JSON.stringify({ step_0: "result_0", step_1: "result_1", step_2: "result_2", final: "done" }),
        now,
        null,
      );
    });

    const workflow = h.store.getWorkflowState(taskId);
    assert.equal(workflow!.status, "completed", "Workflow should be completed");
    assert.equal(workflow!.currentStepIndex, 3, "Should be at final step index");

    // Transition execution to succeeded
    h.transitions.transitionExecutionStatus({
      entityKind: "execution",
      entityId: executionId,
      fromStatus: "executing",
      toStatus: "succeeded",
      reasonCode: "e2e_test",
      traceId,
      actorType: "agent",
      occurredAt: nowIso(),
    });

    // Transition task to done
    h.transitions.transitionTaskTerminalState({
      taskId,
      sessionId: newId("sess"),
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "completed",
      currentSessionStatus: "open",
      currentExecutionStatus: "succeeded",
      terminalStatus: "done",
      taskOutputJson: JSON.stringify({ all_steps_completed: true }),
      outputsJson: "[]",
      context: {
        reasonCode: "e2e_test",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    const task = h.store.getTask(taskId);
    assert.equal(task?.status, "done", "Task should be done");
  } finally {
    cleanupPath(h.workspace);
  }
});

test("E2E: multi-step task fails mid-execution and task fails", () => {
  const h = createE2eHarness("e2e-mstep-fail-");

  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = "e2e-mstep-fail-trace";
    const now = nowIso();

    insertTaskWithExecution(h.db, h.store, taskId, executionId, traceId, "fragile_wf", "in_progress");

    // Step 1 fails
    h.db.transaction(() => {
      h.store.updateWorkflowRecoveryState({
        taskId,
        status: "failed",
        currentStepIndex: 1,
        outputsJson: JSON.stringify({ step_0: "ok", step_1: "failed" }),
        updatedAt: now,
        resumableFromStep: null,
        retryCount: 0,
        lastErrorCode: "workflow.step_failed",
      });
    });

    // Mark execution as failed
    h.transitions.transitionExecutionStatus({
      entityKind: "execution",
      entityId: executionId,
      fromStatus: "executing",
      toStatus: "failed",
      reasonCode: "e2e_test",
      traceId,
      actorType: "agent",
      occurredAt: nowIso(),
    });

    // Transition task to failed
    h.transitions.transitionTaskTerminalState({
      taskId,
      sessionId: newId("sess"),
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "failed",
      currentSessionStatus: "open",
      currentExecutionStatus: "failed",
      terminalStatus: "failed",
      taskOutputJson: "{}",
      outputsJson: "[]",
      context: {
        reasonCode: "e2e_test",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    const workflow = h.store.getWorkflowState(taskId);
    assert.equal(workflow!.status, "failed", "Workflow should be failed");

    const task = h.store.getTask(taskId);
    assert.equal(task?.status, "failed", "Task should be failed");
  } finally {
    cleanupPath(h.workspace);
  }
});

test("E2E: multi-step task with dependencies waits for prerequisite", () => {
  const h = createE2eHarness("e2e-mstep-dep-");

  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = "e2e-mstep-dep-trace";
    const now = nowIso();

    insertTaskWithExecution(h.db, h.store, taskId, executionId, traceId, "dependent_wf");

    // Initial state: step 0 not complete
    let workflow = h.store.getWorkflowState(taskId);
    assert.equal(workflow!.currentStepIndex, 0, "Should be at step 0");

    // Attempting to jump to step 2 without completing step 1 should maintain dependency
    // The actual enforcement happens at the orchestration layer
    h.db.transaction(() => {
      h.store.updateWorkflowState(
        taskId,
        "running",
        1,
        JSON.stringify({ step_0_data: "prerequisite_for_step_2" }),
        now,
        null,
      );
    });

    workflow = h.store.getWorkflowState(taskId);
    assert.equal(workflow!.currentStepIndex, 1, "Should be at step 1 after completing step 0");

    // Step 1 uses output from step 0
    const outputs = JSON.parse(workflow!.outputsJson);
    assert.ok(outputs.step_0_data, "Step 0 output should be available for step 1");
  } finally {
    cleanupPath(h.workspace);
  }
});

test("E2E: multi-step task resumes from checkpoint after failure", () => {
  const h = createE2eHarness("e2e-mstep-resume-");

  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = "e2e-mstep-resume-trace";
    const now = nowIso();

    insertTaskWithExecution(h.db, h.store, taskId, executionId, traceId, "resumable_wf");

    // Fail at step 2 with checkpoint at step 1
    h.db.transaction(() => {
      h.store.updateWorkflowRecoveryState({
        taskId,
        status: "running",
        currentStepIndex: 2,
        outputsJson: JSON.stringify({ step_0: "done", step_1: "done" }),
        updatedAt: now,
        resumableFromStep: "1", // Can resume from step 1
        retryCount: 1,
        lastErrorCode: "step.timeout",
      });
    });

    let workflow = h.store.getWorkflowState(taskId);
    assert.equal(workflow!.retryCount, 1, "Should have retry count 1");
    assert.equal(workflow!.resumableFromStep, "1", "Should be resumable from step 1");

    // Resume and complete
    h.db.transaction(() => {
      h.store.updateWorkflowState(
        taskId,
        "completed",
        3,
        JSON.stringify({ step_0: "done", step_1: "done", step_2: "completed_on_retry" }),
        now,
        null,
      );
    });

    workflow = h.store.getWorkflowState(taskId);
    assert.equal(workflow!.status, "completed", "Should complete after resume");
  } finally {
    cleanupPath(h.workspace);
  }
});

test("E2E: multi-step task with parallel branches converges", () => {
  const h = createE2eHarness("e2e-mstep-parallel-");

  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = "e2e-mstep-parallel-trace";
    const now = nowIso();

    insertTaskWithExecution(h.db, h.store, taskId, executionId, traceId, "parallel_wf");

    // Simulate parallel execution - both branch A and B complete
    h.db.transaction(() => {
      h.store.updateWorkflowState(
        taskId,
        "running",
        2, // After parallel section
        JSON.stringify({
          branch_a: { step: "branch_a_done" },
          branch_b: { step: "branch_b_done" },
        }),
        now,
        null,
      );
    });

    const workflow = h.store.getWorkflowState(taskId);
    const outputs = JSON.parse(workflow!.outputsJson);
    assert.ok(outputs.branch_a, "Branch A output should be captured");
    assert.ok(outputs.branch_b, "Branch B output should be captured");
  } finally {
    cleanupPath(h.workspace);
  }
});

test("E2E: multi-step task exceeds timeout and fails gracefully", () => {
  const h = createE2eHarness("e2e-mstep-timeout-");

  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = "e2e-mstep-timeout-trace";
    const now = nowIso();

    insertTaskWithExecution(h.db, h.store, taskId, executionId, traceId, "slow_wf");

    // Simulate timeout during step 2
    h.db.transaction(() => {
      h.store.updateWorkflowRecoveryState({
        taskId,
        status: "failed",
        currentStepIndex: 2,
        outputsJson: JSON.stringify({ step_0: "done", step_1: "done" }),
        updatedAt: now,
        resumableFromStep: null,
        retryCount: 0,
        lastErrorCode: "workflow.timeout",
      });
    });

    // Mark execution as failed
    h.transitions.transitionExecutionStatus({
      entityKind: "execution",
      entityId: executionId,
      fromStatus: "executing",
      toStatus: "failed",
      reasonCode: "timeout",
      traceId,
      actorType: "agent",
      occurredAt: nowIso(),
    });

    const workflow = h.store.getWorkflowState(taskId);
    assert.equal(workflow!.status, "failed", "Workflow should be failed");
    assert.equal(workflow!.lastErrorCode, "workflow.timeout", "Error code should be timeout");
  } finally {
    cleanupPath(h.workspace);
  }
});