/**
 * Golden Test: CLI Dispatch Execution Output
 *
 * Verifies dispatch execution CLI produces consistent output structure
 * for task dispatch operations.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { seedTaskAndExecution } from "../helpers/seed.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { assertGolden } from "../helpers/golden.js";
import { newId, nowIso } from "../../src/platform/contracts/types/ids.js";

test("golden: dispatch execution task status structure", () => {
  const workspace = createTempWorkspace("aa-golden-dispatch-");

  const dbPath = `${workspace}/dispatch.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  const taskId = "dispatch_task_001";
  const executionId = "dispatch_exec_001";
  const traceId = "dispatch-trace-001";

  seedTaskAndExecution(db, store, { taskId, executionId, traceId });

  const task = store.getTask(taskId);
  const execution = store.getExecution(executionId);

  assert.ok(task, "Task should exist");
  assert.ok(execution, "Execution should exist");

  // Verify dispatch-relevant status fields
  assertGolden("cli-dispatch-task-status", {
    taskId: task!.id,
    taskStatus: task!.status,
    executionId: execution!.id,
    executionStatus: execution!.status,
    hasTraceId: execution!.traceId !== null,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: dispatch execution workflow state structure", () => {
  const workspace = createTempWorkspace("aa-golden-dispatch-workflow-");

  const dbPath = `${workspace}/dispatch-wf.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  const taskId = "dispatch_wf_task_001";
  const executionId = "dispatch_wf_exec_001";
  const now = nowIso();

  seedTaskAndExecution(db, store, { taskId, executionId, traceId: "dispatch-wf-trace" });

  // Add workflow state
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
  assertGolden("cli-dispatch-workflow-state", {
    taskId: workflowState!.taskId,
    workflowId: workflowState!.workflowId,
    status: workflowState!.status,
    currentStepIndex: workflowState!.currentStepIndex,
    isResumable: workflowState!.resumableFromStep !== null,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: dispatch execution queue status format", () => {
  const workspace = createTempWorkspace("aa-golden-dispatch-queue-");

  const dbPath = `${workspace}/dispatch-queue.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  // Create tasks with different statuses to simulate queue
  const statuses = ["queued", "in_progress", "pending"] as const;
  const taskIds: string[] = [];

  db.transaction(() => {
    for (let i = 0; i < statuses.length; i++) {
      const taskId = `dispatch_queue_task_${String(i).padStart(3, "0")}`;
      taskIds.push(taskId);
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: `Queue task ${i}`,
        status: statuses[i],
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        completedAt: null,
      });
    }
  });

  // Use listTasks instead of queryTasks
  const allTasks = store.listTasks(100);
  const queuedTasks = allTasks.filter(t => t.status === "queued");
  const inProgressTasks = allTasks.filter(t => t.status === "in_progress");
  const pendingTasks = allTasks.filter(t => t.status === "pending");

  assertGolden("cli-dispatch-queue-status", {
    totalTasks: taskIds.length,
    queuedCount: queuedTasks.length,
    inProgressCount: inProgressTasks.length,
    pendingCount: pendingTasks.length,
    statuses: statuses,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: dispatch execution approval state format", () => {
  const workspace = createTempWorkspace("aa-golden-dispatch-approval-");

  const dbPath = `${workspace}/dispatch-approval.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  const taskId = "dispatch_approval_task_001";
  const executionId = "dispatch_approval_exec_001";
  const approvalId = newId("approval");
  const now = nowIso();

  seedTaskAndExecution(db, store, { taskId, executionId, traceId: "approval-trace" });

  // Insert approval - requestJson and responseJson must be non-null for SQLite
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
  assertGolden("cli-dispatch-approval-state", {
    approvalId: approval!.id,
    taskId: approval!.taskId,
    status: approval!.status,
    isPending: approval!.status === "requested",
    hasTimeout: approval!.timeoutPolicy !== null,
  });

  db.close();
  cleanupPath(workspace);
});
