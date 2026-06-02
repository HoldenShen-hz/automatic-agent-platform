/**
 * Integration Tests: Workflow Repository Operations
 *
 * Tests for workflow state CRUD operations using AuthoritativeTaskStore
 * with SQLite in-memory database.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { createIntegrationContext } from "../../../../helpers/integration-context.js";

test("workflow repository persists and retrieves workflow state", () => {
  const ctx = createIntegrationContext("aa-wf-repo-");
  try {
    const taskId = "task-wf-001";
    const now = new Date().toISOString();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        tenantId: "tenant-wf",
        title: "Workflow Test Task",
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

      ctx.store.insertWorkflowState({
        taskId,
        divisionId: "general-ops",
        workflowId: "multi_step_plan",
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

    const workflow = ctx.store.getWorkflowState(taskId);

    assert.ok(workflow, "Workflow should be retrieved");
    assert.equal(workflow!.taskId, taskId);
    assert.equal(workflow!.workflowId, "multi_step_plan");
    assert.equal(workflow!.status, "running");
    assert.equal(workflow!.currentStepIndex, 0);
  } finally {
    ctx.cleanup();
  }
});

test("workflow repository returns null for non-existent workflow", () => {
  const ctx = createIntegrationContext("aa-wf-notfound-");
  try {
    const result = ctx.store.getWorkflowState("non-existent-task");
    assert.equal(result, null);
  } finally {
    ctx.cleanup();
  }
});

test("workflow repository updates workflow step index", () => {
  const ctx = createIntegrationContext("aa-wf-step-");
  try {
    const taskId = "task-wf-step";
    const now = new Date().toISOString();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        tenantId: "tenant-wf-step",
        title: "Step Update Test",
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

      ctx.store.insertWorkflowState({
        taskId,
        divisionId: "general-ops",
        workflowId: "multi_step_plan",
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

    const updateTime = new Date().toISOString();
    const outputs = JSON.stringify({
      step0: { done: true, result: "ok" },
      step1: { done: true, result: "ok" },
      step2: { done: false },
    });

    ctx.db.transaction(() => {
      ctx.store.updateWorkflowState(
        taskId,
        "running",
        2,
        outputs,
        updateTime,
        null
      );
    });

    const updated = ctx.store.getWorkflowState(taskId);
    assert.equal(updated!.currentStepIndex, 2);
    assert.ok(updated!.outputsJson.includes("step2"));
  } finally {
    ctx.cleanup();
  }
});

test("workflow repository records workflow completion", () => {
  const ctx = createIntegrationContext("aa-wf-complete-");
  try {
    const taskId = "task-wf-complete";
    const now = new Date().toISOString();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        tenantId: "tenant-wf-complete",
        title: "Completion Test",
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

      ctx.store.insertWorkflowState({
        taskId,
        divisionId: "general-ops",
        workflowId: "multi_step_plan",
        currentStepIndex: 3,
        status: "running",
        outputsJson: '{"step0":{"done":true},"step1":{"done":true},"step2":{"done":true}}',
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
      });
    });

    const completeTime = new Date().toISOString();
    const finalOutputs = JSON.stringify({
      step0: { done: true },
      step1: { done: true },
      step2: { done: true },
      final: { result: "success" },
    });

    ctx.db.transaction(() => {
      ctx.store.updateWorkflowState(
        taskId,
        "completed",
        3,
        finalOutputs,
        completeTime,
        null
      );
    });

    const completed = ctx.store.getWorkflowState(taskId);
    assert.equal(completed!.status, "completed");
    assert.ok(completed!.outputsJson.includes("final"));
  } finally {
    ctx.cleanup();
  }
});

test("workflow repository tracks workflow recovery state", () => {
  const ctx = createIntegrationContext("aa-wf-recovery-");
  try {
    const taskId = "task-wf-recovery";
    const now = new Date().toISOString();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        tenantId: "tenant-wf-recovery",
        title: "Recovery Test",
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

      ctx.store.insertWorkflowState({
        taskId,
        divisionId: "general-ops",
        workflowId: "multi_step_plan",
        currentStepIndex: 1,
        status: "failed",
        outputsJson: '{"step0":{"done":true}}',
        lastErrorCode: "ERR_STEP_FAILED",
        retryCount: 2,
        resumableFromStep: "0",
        startedAt: now,
        updatedAt: now,
      });
    });

    const resumeTime = new Date().toISOString();
    ctx.db.transaction(() => {
      ctx.store.updateWorkflowRecoveryState({
        taskId,
        status: "running",
        currentStepIndex: 1,
        outputsJson: '{"step0":{"done":true},"step1":{"done":false}}',
        updatedAt: resumeTime,
        resumableFromStep: "1",
        retryCount: 3,
        lastErrorCode: null,
      });
    });

    const recovered = ctx.store.getWorkflowState(taskId);
    assert.equal(recovered!.status, "running");
    assert.equal(recovered!.retryCount, 3);
    assert.equal(recovered!.lastErrorCode, null);
  } finally {
    ctx.cleanup();
  }
});
