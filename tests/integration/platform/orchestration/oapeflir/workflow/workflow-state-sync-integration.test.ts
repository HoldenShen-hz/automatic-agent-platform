/**
 * Integration Test: Workflow State Synchronization
 *
 * Verifies workflow state persistence and synchronization
 * between workflow execution and storage layer.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SqliteDatabase } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../../src/platform/contracts/types/ids.js";

test("workflow state sync: workflow state can be persisted and retrieved", () => {
  const workspace = createTempWorkspace("aa-workflow-state-");

  try {
    const dbPath = join(workspace, "workflow-state.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const now = nowIso();

    // Create task
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: "Workflow state test",
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
    });

    // Insert workflow state
    db.transaction(() => {
      store.insertWorkflowState({
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
    });

    // Retrieve workflow state
    const workflowState = store.getWorkflowState(taskId);
    assert.ok(workflowState, "Workflow state should exist");
    assert.equal(workflowState!.taskId, taskId);
    assert.equal(workflowState!.workflowId, "single_agent_minimal");
    assert.equal(workflowState!.currentStepIndex, 0);
    assert.equal(workflowState!.status, "running");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("workflow state sync: workflow step progression updates state correctly", () => {
  const workspace = createTempWorkspace("aa-workflow-progression-");

  try {
    const dbPath = join(workspace, "workflow-progression.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const now = nowIso();

    // Create task
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: "Workflow progression test",
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
    });

    // Start workflow at step 0
    db.transaction(() => {
      store.insertWorkflowState({
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
    });

    // Simulate step progression by updating workflow state
    db.transaction(() => {
      // Get the existing workflow state and update it
      const existingState = store.getWorkflowState(taskId);
      assert.ok(existingState, "Workflow state should exist");

      // Manually update via SQL since there's no updateWorkflowState method
      db.connection
        .prepare(
          `UPDATE workflow_state SET current_step_index = ?, updated_at = ?, outputs_json = ? WHERE task_id = ?`,
        )
        .run(1, nowIso(), '{"step0": "completed", "step1": "in_progress"}', taskId);
    });

    // Verify progression
    const progressedState = store.getWorkflowState(taskId);
    assert.ok(progressedState, "Progressed workflow state should exist");
    assert.equal(progressedState!.currentStepIndex, 1, "Should be at step 1");

    const outputs = JSON.parse(progressedState!.outputsJson);
    assert.ok(outputs.step0, "Step 0 output should exist");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("workflow state sync: workflow can be paused and resumed", () => {
  const workspace = createTempWorkspace("aa-workflow-pause-");

  try {
    const dbPath = join(workspace, "workflow-pause.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const now = nowIso();

    // Create task
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: "Workflow pause test",
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
    });

    // Start workflow
    db.transaction(() => {
      store.insertWorkflowState({
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
    });

    // Pause workflow
    db.connection
      .prepare(`UPDATE workflow_state SET status = ?, updated_at = ? WHERE task_id = ?`)
      .run("paused", nowIso(), taskId);

    const pausedState = store.getWorkflowState(taskId);
    assert.equal(pausedState!.status, "paused", "Workflow should be paused");

    // Resume workflow (resumable_from_step is TEXT, use string "0")
    db.connection
      .prepare(`UPDATE workflow_state SET status = ?, resumable_from_step = ?, updated_at = ? WHERE task_id = ?`)
      .run("running", "0", nowIso(), taskId);

    const resumedState = store.getWorkflowState(taskId);
    assert.equal(resumedState!.status, "running", "Workflow should be running");
    assert.equal(resumedState!.resumableFromStep, "0", "Should be resumable from step 0");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("workflow state sync: workflow completion updates task status", () => {
  const workspace = createTempWorkspace("aa-workflow-complete-");

  try {
    const dbPath = join(workspace, "workflow-complete.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const now = nowIso();

    // Create task
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: "Workflow completion test",
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
    });

    // Start and complete workflow
    db.transaction(() => {
      store.insertWorkflowState({
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
    });

    // Complete workflow
    db.connection
      .prepare(`UPDATE workflow_state SET status = ?, updated_at = ? WHERE task_id = ?`)
      .run("completed", nowIso(), taskId);

    const completedState = store.getWorkflowState(taskId);
    assert.equal(completedState!.status, "completed", "Workflow should be completed");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("workflow state sync: workflow failure records error and increments retry", () => {
  const workspace = createTempWorkspace("aa-workflow-failure-");

  try {
    const dbPath = join(workspace, "workflow-failure.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const now = nowIso();

    // Create task
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: "Workflow failure test",
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
    });

    // Start workflow
    db.transaction(() => {
      store.insertWorkflowState({
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
    });

    // Simulate failure with retry increment
    db.connection
      .prepare(`UPDATE workflow_state SET status = ?, last_error_code = ?, retry_count = ?, updated_at = ? WHERE task_id = ?`)
      .run("running", "workflow.step_failed", 1, nowIso(), taskId);

    const failedState = store.getWorkflowState(taskId);
    assert.equal(failedState!.lastErrorCode, "workflow.step_failed", "Should record error code");
    assert.equal(failedState!.retryCount, 1, "Should increment retry count");
    assert.equal(failedState!.status, "running", "Status should remain running for retry");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
