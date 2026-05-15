/**
 * Golden Test: Inspect Service Query Output
 *
 * Verifies inspect service query methods produce consistent
 * result structures for tasks, workflows, workers, and sessions.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { SqliteDatabase } from "../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { InspectService } from "../../src/platform/shared/observability/inspect-service.js";
import { seedTaskAndExecution } from "../helpers/seed.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { assertGolden } from "../helpers/golden.js";

test("golden: inspect service task summaries have valid structure", () => {
  const workspace = createTempWorkspace("aa-golden-inspect-query-");

  const dbPath = `${workspace}/inspect-query.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const inspect = new InspectService(store);

  // Create multiple tasks
  for (let i = 1; i <= 3; i++) {
    const taskId = `inspect_query_task_${String(i).padStart(3, "0")}`;
    const executionId = `inspect_query_exec_${String(i).padStart(3, "0")}`;
    seedTaskAndExecution(db, store, { taskId, executionId, traceId: `query-trace-${i}` });
  }

  const summaries = inspect.queryTaskInspectSummaries({ limit: 10 });

  assert.ok(Array.isArray(summaries), "Should return array");
  assert.ok(summaries.length >= 3, "Should have at least 3 items");

  for (const summary of summaries) {
    assert.ok(summary.taskId, "Should have taskId");
    assert.ok(summary.taskStatus, "Should have taskStatus");
  }

  assertGolden("inspect-query-task-summaries", {
    count: summaries.length,
    firstTaskId: summaries[0].taskId,
    firstStatus: summaries[0].taskStatus,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: inspect service workflow summaries have valid structure", () => {
  const workspace = createTempWorkspace("aa-golden-inspect-wf-query-");

  const dbPath = `${workspace}/inspect-wf-query.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const inspect = new InspectService(store);

  // Create task with workflow
  const taskId = "wf_query_task_001";
  const executionId = "wf_query_exec_001";
  seedTaskAndExecution(db, store, { taskId, executionId, traceId: "wf-query-trace" });

  const summaries = inspect.queryWorkflowInspectSummaries({ limit: 10 });

  assert.ok(Array.isArray(summaries), "Should return array");

  assertGolden("inspect-query-workflow-summaries", {
    count: summaries.length,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: inspect service worker summaries have valid structure", () => {
  const workspace = createTempWorkspace("aa-golden-inspect-worker-query-");

  const dbPath = `${workspace}/inspect-worker-query.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const inspect = new InspectService(store);

  const summaries = inspect.queryWorkerInspectSummaries({ limit: 10 });

  assert.ok(Array.isArray(summaries), "Should return array");

  assertGolden("inspect-query-worker-summaries", {
    count: summaries.length,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: inspect service getTaskInspectView has correct structure", () => {
  const workspace = createTempWorkspace("aa-golden-inspect-task-view-");

  const dbPath = `${workspace}/inspect-task-view.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const inspect = new InspectService(store);

  const taskId = "inspect_view_task_001";
  const executionId = "inspect_view_exec_001";
  seedTaskAndExecution(db, store, { taskId, executionId, traceId: "view-trace" });

  const view = inspect.getTaskInspectView(taskId);

  assert.ok(view, "View should exist");
  assert.ok(view.task, "Should have task");
  assert.ok(view.task.id === taskId, "Task ID should match");
  assert.ok(view.execution === null || view.execution !== undefined, "Execution should be present or null");
  assert.ok(view.workflowState === null || view.workflowState !== undefined, "Workflow state should be present or null");
  assert.ok(view.session === null || view.session !== undefined, "Session should be present or null");
  assert.ok(view.recoverySummary !== undefined, "Recovery summary should exist");
  assert.ok(view.dispatchDecisions !== undefined, "Dispatch decisions should exist");
  assert.ok(view.recentEvents !== undefined, "Recent events should exist");

  assertGolden("inspect-task-inspect-view", {
    taskId: view.task.id,
    taskStatus: view.task.status,
    hasExecution: view.execution !== null,
    hasWorkflowState: view.workflowState !== null,
    hasSession: view.session !== null,
    hasRecoverySummary: view.recoverySummary !== null,
    dispatchDecisionCount: view.dispatchDecisions.length,
    recentEventCount: view.recentEvents.length,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: inspect service getExecutionInspectView has correct structure", () => {
  const workspace = createTempWorkspace("aa-golden-inspect-exec-view-");

  const dbPath = `${workspace}/inspect-exec-view.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const inspect = new InspectService(store);

  const taskId = "exec_view_task_001";
  const executionId = "exec_view_exec_001";
  seedTaskAndExecution(db, store, { taskId, executionId, traceId: "exec-view-trace" });

  const view = inspect.getExecutionInspectView(executionId);

  assert.ok(view, "View should exist");
  assert.ok(view.execution, "Should have execution");
  assert.ok(view.execution.id === executionId, "Execution ID should match");
  assert.ok(view.task, "Should have task");
  assert.ok(view.task.id === taskId, "Task ID should match");

  assertGolden("inspect-execution-inspect-view", {
    executionId: view.execution.id,
    executionStatus: view.execution.status,
    taskId: view.task.id,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: inspect service session messages have correct structure", () => {
  const workspace = createTempWorkspace("aa-golden-inspect-messages-");

  const dbPath = `${workspace}/inspect-messages.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const inspect = new InspectService(store);

  const taskId = "messages_task_001";
  const executionId = "messages_exec_001";
  seedTaskAndExecution(db, store, { taskId, executionId, traceId: "messages-trace" });

  const messages = inspect.listSessionMessages(taskId);

  assert.ok(Array.isArray(messages), "Should return array");

  assertGolden("inspect-session-messages", {
    count: messages.length,
  });

  db.close();
  cleanupPath(workspace);
});
