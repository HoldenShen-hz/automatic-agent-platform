/**
 * Smoke Test: Workflow Execution
 *
 * Verifies basic workflow execution through the platform.
 * Part of the smoke test suite in tests/integration/platform/execution/smoke/.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";

test("smoke: workflow state can be created alongside task", () => {
  const workspace = createTempWorkspace("smoke-workflow-create-");

  try {
    const dbPath = join(workspace, "workflow.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const workflowId = "wf_single_step";
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Workflow test task",
        status: "queued",
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

    const task = store.getTask(taskId);
    assert.ok(task, "Task should exist");
    assert.strictEqual(task!.status, "queued");

    const workflow = store.getWorkflowState(taskId);
    assert.ok(workflow, "Workflow state should exist");
    assert.strictEqual(workflow!.workflowId, workflowId);
    assert.strictEqual(workflow!.status, "running");
    assert.strictEqual(workflow!.currentStepIndex, 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("smoke: workflow status transitions are recorded", () => {
  const workspace = createTempWorkspace("smoke-workflow-transition-");

  try {
    const dbPath = join(workspace, "workflow_transition.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const workflowId = "wf_multi_step";
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Workflow transition test",
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

    // Transition to paused
    const pausedAt = nowIso();
    db.transaction(() => {
      store.updateWorkflowState(taskId, "paused", 0, "{}", pausedAt);
    });

    let workflow = store.getWorkflowState(taskId);
    assert.strictEqual(workflow!.status, "paused");

    // Transition back to running
    const resumedAt = nowIso();
    db.transaction(() => {
      store.updateWorkflowState(taskId, "running", 0, "{}", resumedAt);
    });

    workflow = store.getWorkflowState(taskId);
    assert.strictEqual(workflow!.status, "running");

    // Transition to completed
    const completedAt = nowIso();
    db.transaction(() => {
      store.updateWorkflowState(taskId, "completed", 2, '{"final":"done"}', completedAt);
    });

    workflow = store.getWorkflowState(taskId);
    assert.strictEqual(workflow!.status, "completed");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("smoke: workflow step index advances correctly", () => {
  const workspace = createTempWorkspace("smoke-workflow-step-");

  try {
    const dbPath = join(workspace, "workflow_step.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const workflowId = "wf_three_step";
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Step index test",
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

    // Advance through steps
    for (let stepIndex = 1; stepIndex <= 3; stepIndex++) {
      const updatedAt = nowIso();
      const outputs = JSON.stringify({ step: stepIndex });
      db.transaction(() => {
        store.updateWorkflowState(taskId, "running", stepIndex, outputs, updatedAt);
      });

      const workflow = store.getWorkflowState(taskId);
      assert.strictEqual(workflow!.currentStepIndex, stepIndex);
    }

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("smoke: workflow outputs are captured", () => {
  const workspace = createTempWorkspace("smoke-workflow-outputs-");

  try {
    const dbPath = join(workspace, "workflow_outputs.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const workflowId = "wf_with_outputs";
    const now = nowIso();

    const outputs = {
      step1_result: "analyzed repository structure",
      step2_result: "identified 3 issues",
      final_summary: "Analysis complete",
    };

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Output capture test",
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

      store.insertWorkflowState({
        taskId,
        divisionId: "general_ops",
        workflowId,
        currentStepIndex: 2,
        status: "running",
        outputsJson: JSON.stringify(outputs),
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
      });
    });

    const workflow = store.getWorkflowState(taskId);
    assert.ok(workflow);

    const parsedOutputs = JSON.parse(workflow!.outputsJson);
    assert.deepStrictEqual(parsedOutputs, outputs);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("smoke: workflow retry count is tracked via recovery state", () => {
  const workspace = createTempWorkspace("smoke-workflow-retry-");

  try {
    const dbPath = join(workspace, "workflow_retry.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const workflowId = "wf_with_retries";
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Retry count test",
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

    // Use updateWorkflowRecoveryState to update retry count
    for (let retryCount = 1; retryCount <= 3; retryCount++) {
      const updatedAt = nowIso();
      db.transaction(() => {
        store.updateWorkflowRecoveryState({
          taskId,
          status: "running",
          currentStepIndex: 0,
          outputsJson: "{}",
          updatedAt,
          resumableFromStep: null,
          retryCount,
          lastErrorCode: null,
        });
      });

      const workflow = store.getWorkflowState(taskId);
      assert.strictEqual(workflow!.retryCount, retryCount);
    }

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
