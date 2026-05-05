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

  // Get current task status
  const task = store.getTask(taskId);
  assert.ok(task, "Task should exist");

  // Verify current status allows expected transitions
  const allowedTransitions = service.getAllowedTaskTransitions(taskId);
  assert.ok(Array.isArray(allowedTransitions), "Allowed transitions should be array");

  assertGolden("transition-task-allowed-transitions", {
    taskId: task.id,
    currentStatus: task.status,
    allowedTransitionCount: allowedTransitions.length,
    allowedTransitions,
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

  // Get current execution status
  const execution = store.getExecution(executionId);
  assert.ok(execution, "Execution should exist");

  const allowedTransitions = service.getAllowedExecutionTransitions(executionId);
  assert.ok(Array.isArray(allowedTransitions), "Allowed transitions should be array");

  assertGolden("transition-execution-allowed-transitions", {
    executionId: execution.id,
    currentStatus: execution.status,
    allowedTransitionCount: allowedTransitions.length,
    allowedTransitions,
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
  const approvalId = newId("approval");
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

  const allowedTransitions = service.getAllowedApprovalTransitions(approvalId);
  assert.ok(Array.isArray(allowedTransitions), "Allowed transitions should be array");

  assertGolden("transition-approval-allowed-transitions", {
    approvalId: approval.id,
    currentStatus: approval.status,
    allowedTransitionCount: allowedTransitions.length,
    allowedTransitions,
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

  const allowedTransitions = service.getAllowedWorkflowTransitions(taskId);
  assert.ok(Array.isArray(allowedTransitions), "Allowed transitions should be array");

  assertGolden("transition-workflow-allowed-transitions", {
    taskId: workflowState.taskId,
    currentStatus: workflowState.status,
    allowedTransitionCount: allowedTransitions.length,
    allowedTransitions,
  });

  db.close();
  cleanupPath(workspace);
});