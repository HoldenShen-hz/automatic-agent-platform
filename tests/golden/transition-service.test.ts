/**
 * Golden Test: Transition Service Output Structure
 *
 * Verifies transition service produces consistent status transition validation
 * and audit records for legacy entity types (Task, Workflow, Execution, Approval).
 *
 * Note: TransitionService handles LEGACY entities only. Canonical five-plane entities
 * (HarnessRun, NodeRun, SideEffectRecord, BudgetLedger) must use RuntimeStateMachine.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { TransitionService } from "../../src/platform/execution/state-transition/transition-service.js";
import { createRuntimeLifecycleRepository } from "../../src/platform/state-evidence/truth/repositories/runtime-lifecycle-repository.js";
import { seedTaskAndExecution } from "../helpers/seed.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { assertGolden } from "../helpers/golden.js";
import { newId, nowIso } from "../../src/platform/contracts/types/ids.js";

test("golden: transition service task status transition validation", () => {
  const workspace = createTempWorkspace("aa-golden-transition-task-");

  const dbPath = `${workspace}/transition-task.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const lifecycleRepo = createRuntimeLifecycleRepository(store);
  const service = new TransitionService(db, store, lifecycleRepo);

  const taskId = "trans_task_001";
  const executionId = "trans_exec_001";
  seedTaskAndExecution(db, store, { taskId, executionId, traceId: "trans-trace" });

  // Get current task status - seed creates tasks in "in_progress" status
  const task = store.getTask(taskId);
  assert.ok(task, "Task should exist");
  assert.equal(task.status, "in_progress", "Task should be in in_progress status from seed");

  // Verify task can transition from in_progress -> done (terminal)
  const now = nowIso();
  service.transitionTaskStatus({
    entityKind: "task",
    entityId: taskId,
    fromStatus: "in_progress",
    toStatus: "done",
    executionId,
    occurredAt: now,
    traceId: "trans-trace",
    actorType: "system",
  });

  const updatedTask = store.getTask(taskId);
  assert.ok(updatedTask, "Task should exist after transition");
  assert.equal(updatedTask.status, "done", "Task should be in done status");

  assertGolden("transition-task-allowed-transitions", {
    taskId: updatedTask.id,
    currentStatus: updatedTask.status,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: transition service execution status transitions", () => {
  const workspace = createTempWorkspace("aa-golden-transition-exec-");

  const dbPath = `${workspace}/transition-exec.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const lifecycleRepo = createRuntimeLifecycleRepository(store);
  const service = new TransitionService(db, store, lifecycleRepo);

  const taskId = "trans_exec_task_001";
  const executionId = "trans_exec_exec_001";
  seedTaskAndExecution(db, store, { taskId, executionId, traceId: "trans-exec-trace" });

  // Get current execution status - seed creates executions in "executing" status
  const execution = store.getExecution(executionId);
  assert.ok(execution, "Execution should exist");
  assert.equal(execution.status, "executing", "Execution should be in executing status from seed");

  // Verify execution can transition from executing -> succeeded (terminal)
  const now = nowIso();
  service.transitionExecutionStatus({
    entityKind: "execution",
    entityId: executionId,
    fromStatus: "executing",
    toStatus: "succeeded",
    occurredAt: now,
    traceId: "trans-exec-trace",
    actorType: "system",
  });

  const updatedExecution = store.getExecution(executionId);
  assert.ok(updatedExecution, "Execution should exist after transition");
  assert.equal(updatedExecution.status, "succeeded", "Execution should be in succeeded status");

  assertGolden("transition-execution-allowed-transitions", {
    executionId: updatedExecution.id,
    currentStatus: updatedExecution.status,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: transition service approval status transitions", () => {
  const workspace = createTempWorkspace("aa-golden-transition-approval-");

  const dbPath = `${workspace}/transition-approval.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const lifecycleRepo = createRuntimeLifecycleRepository(store);
  const service = new TransitionService(db, store, lifecycleRepo);

  const taskId = "trans_approval_task_001";
  const executionId = "trans_approval_exec_001";
  const approvalId = "trans_approval_001";
  const now = nowIso();

  seedTaskAndExecution(db, store, { taskId, executionId, traceId: "trans-approval-trace" });

  // Insert approval in requested state
  db.transaction(() => {
    store.insertApproval({
      id: approvalId,
      taskId,
      executionId,
      status: "requested",
      requestJson: "{}",
      responseJson: null,
      timeoutPolicy: "10m",
      createdAt: now,
      respondedAt: null,
    });
  });

  const approval = store.getApproval(approvalId);
  assert.ok(approval, "Approval should exist");

  // Verify approval can transition from requested -> approved
  service.transitionApprovalStatus({
    entityKind: "approval",
    entityId: approvalId,
    fromStatus: "requested",
    toStatus: "approved",
    occurredAt: now,
    traceId: "trans-approval-trace",
    actorType: "human",
    responseJson: JSON.stringify({ decision: "approved" }),
  });

  const updatedApproval = store.getApproval(approvalId);
  assert.ok(updatedApproval, "Approval should exist after transition");
  assert.equal(updatedApproval.status, "approved", "Approval should be in approved status");

  assertGolden("transition-approval-allowed-transitions", {
    approvalId: updatedApproval.id,
    currentStatus: updatedApproval.status,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: transition service workflow status transitions", () => {
  const workspace = createTempWorkspace("aa-golden-transition-workflow-");

  const dbPath = `${workspace}/transition-workflow.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const lifecycleRepo = createRuntimeLifecycleRepository(store);
  const service = new TransitionService(db, store, lifecycleRepo);

  const taskId = "trans_wf_task_001";
  const now = nowIso();

  seedTaskAndExecution(db, store, { taskId, executionId: "trans_wf_exec_001", traceId: "trans-wf-trace" });

  // Insert workflow state in running status
  db.transaction(() => {
    store.insertWorkflowState({
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
  });

  const workflowState = store.getWorkflowState(taskId);
  assert.ok(workflowState, "Workflow state should exist");

  // Verify workflow can transition from running -> paused
  service.transitionWorkflowStatus({
    entityKind: "workflow",
    entityId: taskId,
    fromStatus: "running",
    toStatus: "paused",
    currentStepIndex: 0,
    outputsJson: "{}",
    occurredAt: now,
    traceId: "trans-wf-trace",
    actorType: "system",
  });

  const updatedWorkflow = store.getWorkflowState(taskId);
  assert.ok(updatedWorkflow, "Workflow should exist after transition");
  assert.equal(updatedWorkflow.status, "paused", "Workflow should be in paused status");

  assertGolden("transition-workflow-allowed-transitions", {
    taskId: updatedWorkflow.taskId,
    currentStatus: updatedWorkflow.status,
  });

  db.close();
  cleanupPath(workspace);
});