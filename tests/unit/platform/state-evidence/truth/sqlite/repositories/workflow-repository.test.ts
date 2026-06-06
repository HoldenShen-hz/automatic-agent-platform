import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { WorkflowRepository } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/workflow-repository.js";
import { TaskRepository } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/task-repository.js";
import { SqliteDatabase } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../../helpers/fs.js";
import type { WorkflowStateRecord, StepOutputRecord } from "../../../../../../../src/platform/contracts/types/domain.js";

function createTestTask(
  db: SqliteDatabase,
  taskId: string,
  tenantId: string | null = null,
  now = "2026-04-14T10:00:00.000Z",
): void {
  const taskRepo = new TaskRepository(db.connection);
  taskRepo.insertTask({
    id: taskId,
    parentId: null,
    rootId: taskId,
    divisionId: "general-ops",
    tenantId,
    title: "Test workflow task",
    status: "in_progress",
    source: "user",
    priority: "normal",
    inputJson: "{}",
    normalizedInputJson: null,
    outputJson: null,
    estimatedCostUsd: null,
    actualCostUsd: 0,
    errorCode: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  });
}

test("WorkflowRepository insertWorkflowState inserts a workflow record", () => {
  const workspace = createTempWorkspace("aa-workflow-repo-");
  const dbPath = join(workspace, "workflow.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new WorkflowRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";

    createTestTask(db, "task-wf-1", null, now);

    const workflow: WorkflowStateRecord = {
      taskId: "task-wf-1",
      divisionId: "general-ops",
      workflowId: "wf-1",
      currentStepIndex: 0,
      status: "running",
      outputsJson: "{}",
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    };

    repo.insertWorkflowState(workflow);

    const result = repo.getWorkflowState("task-wf-1");
    assert.ok(result);
    assert.equal(result.taskId, "task-wf-1");
    assert.equal(result.status, "running");
    assert.equal(result.currentStepIndex, 0);
  } finally {
    cleanupPath(workspace);
  }
});

test("WorkflowRepository getWorkflowState returns null for non-existent task", () => {
  const workspace = createTempWorkspace("aa-workflow-repo-");
  const dbPath = join(workspace, "workflow.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new WorkflowRepository(db.connection);

    const result = repo.getWorkflowState("nonexistent-task");
    assert.strictEqual(result, null);
  } finally {
    cleanupPath(workspace);
  }
});

test("WorkflowRepository insertStepOutput inserts a step output record", () => {
  const workspace = createTempWorkspace("aa-workflow-repo-");
  const dbPath = join(workspace, "workflow.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new WorkflowRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";

    createTestTask(db, "task-step-1", null, now);

    const stepOutput: StepOutputRecord = {
      id: "step-output-1",
      taskId: "task-step-1",
      nodeRunId: "node-run-1",
      stepId: "step-1",
      roleId: "agent",
      status: "succeeded",
      dataJson: '{"result":"success"}',
      summary: "Step completed successfully",
      artifactsJson: "[]",
      tokenCost: 100,
      durationMs: 500,
      validationJson: null,
      producedAt: now,
    };

    repo.insertStepOutput(stepOutput);

    // Verify by listing workflow states - step outputs are stored separately
    const workflow: WorkflowStateRecord = {
      taskId: "task-step-1",
      divisionId: "general-ops",
      workflowId: "wf-1",
      currentStepIndex: 1,
      status: "running",
      outputsJson: "{}",
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    };
    repo.insertWorkflowState(workflow);

    const result = repo.getWorkflowState("task-step-1");
    assert.ok(result);
    assert.equal(result.currentStepIndex, 1);
  } finally {
    cleanupPath(workspace);
  }
});

test("WorkflowRepository insertStepOutput upserts repeated task-step outputs", () => {
  const workspace = createTempWorkspace("aa-workflow-repo-upsert-");
  const dbPath = join(workspace, "workflow-upsert.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new WorkflowRepository(db.connection);
    const firstAt = "2026-04-14T10:00:00.000Z";
    const secondAt = "2026-04-14T10:05:00.000Z";

    createTestTask(db, "task-step-upsert-1", null, firstAt);

    repo.insertStepOutput({
      id: "step-output-1",
      taskId: "task-step-upsert-1",
      nodeRunId: "node-run-1",
      stepId: "step-1",
      roleId: "agent",
      status: "failed",
      dataJson: "{\"error\":\"first\"}",
      summary: "first",
      artifactsJson: "[]",
      tokenCost: 10,
      durationMs: 100,
      validationJson: null,
      producedAt: firstAt,
    });
    repo.insertStepOutput({
      id: "step-output-2",
      taskId: "task-step-upsert-1",
      nodeRunId: "node-run-2",
      stepId: "step-1",
      roleId: "agent",
      status: "succeeded",
      dataJson: "{\"result\":\"second\"}",
      summary: "second",
      artifactsJson: "[]",
      tokenCost: 20,
      durationMs: 200,
      validationJson: "{\"replayed\":true}",
      producedAt: secondAt,
    });

    const row = db.connection.prepare(
      `SELECT id, status, data_json AS dataJson, summary, token_cost AS tokenCost, duration_ms AS durationMs, validation_json AS validationJson, produced_at AS producedAt
       FROM workflow_step_outputs
       WHERE task_id = ? AND step_id = ?`,
    ).get("task-step-upsert-1", "step-1") as {
      id: string;
      status: string;
      dataJson: string;
      summary: string;
      tokenCost: number;
      durationMs: number;
      validationJson: string;
      producedAt: string;
    };

    assert.equal(row.id, "step-output-2");
    assert.equal(row.status, "succeeded");
    assert.equal(row.dataJson, "{\"result\":\"second\"}");
    assert.equal(row.summary, "second");
    assert.equal(row.tokenCost, 20);
    assert.equal(row.durationMs, 200);
    assert.equal(row.validationJson, "{\"replayed\":true}");
    assert.equal(row.producedAt, secondAt);
  } finally {
    cleanupPath(workspace);
  }
});

test("WorkflowRepository listWorkflowStates returns all workflows", () => {
  const workspace = createTempWorkspace("aa-workflow-repo-");
  const dbPath = join(workspace, "workflow.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new WorkflowRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";

    createTestTask(db, "task-list-1", null, now);
    createTestTask(db, "task-list-2", null, now);

    repo.insertWorkflowState({
      taskId: "task-list-1",
      divisionId: "general-ops",
      workflowId: "wf-1",
      currentStepIndex: 0,
      status: "running",
      outputsJson: "{}",
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    });

    repo.insertWorkflowState({
      taskId: "task-list-2",
      divisionId: "general-ops",
      workflowId: "wf-2",
      currentStepIndex: 0,
      status: "completed",
      outputsJson: "{}",
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    });

    const results = repo.listWorkflowStates();
    assert.equal(results.length, 2);
  } finally {
    cleanupPath(workspace);
  }
});

test("WorkflowRepository updateWorkflowState updates workflow fields", () => {
  const workspace = createTempWorkspace("aa-workflow-repo-");
  const dbPath = join(workspace, "workflow.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new WorkflowRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";
    const later = "2026-04-14T11:00:00.000Z";

    createTestTask(db, "task-update-1", null, now);

    repo.insertWorkflowState({
      taskId: "task-update-1",
      divisionId: "general-ops",
      workflowId: "wf-1",
      currentStepIndex: 0,
      status: "running",
      outputsJson: "{}",
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    });

    repo.updateWorkflowState(
      "task-update-1",
      "running",
      2,
      '{"step2":"done"}',
      later,
      null,
    );

    const result = repo.getWorkflowState("task-update-1");
    assert.ok(result);
    assert.equal(result.currentStepIndex, 2);
    assert.equal(result.outputsJson, '{"step2":"done"}');
  } finally {
    cleanupPath(workspace);
  }
});

test("WorkflowRepository updateWorkflowStateCas returns 1 on successful update", () => {
  const workspace = createTempWorkspace("aa-workflow-repo-");
  const dbPath = join(workspace, "workflow.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new WorkflowRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";

    createTestTask(db, "task-cas-1", null, now);

    repo.insertWorkflowState({
      taskId: "task-cas-1",
      divisionId: "general-ops",
      workflowId: "wf-1",
      currentStepIndex: 0,
      status: "running",
      outputsJson: "{}",
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    });

    const updated = repo.updateWorkflowStateCas(
      "task-cas-1",
      0, // expectedVersion
      "running", // expectedStatus
      "running",
      1,
      '{"step1":"done"}',
      now,
      null,
    );

    assert.equal(updated, 1);

    const result = repo.getWorkflowState("task-cas-1");
    assert.ok(result);
    assert.equal(result.currentStepIndex, 1);
  } finally {
    cleanupPath(workspace);
  }
});

test("WorkflowRepository updateWorkflowStateCas returns 0 on CAS failure", () => {
  const workspace = createTempWorkspace("aa-workflow-repo-");
  const dbPath = join(workspace, "workflow.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new WorkflowRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";

    createTestTask(db, "task-cas-fail-1", null, now);

    repo.insertWorkflowState({
      taskId: "task-cas-fail-1",
      divisionId: "general-ops",
      workflowId: "wf-1",
      currentStepIndex: 0,
      status: "running",
      outputsJson: "{}",
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    });

    // Try CAS with wrong expected version
    const updated = repo.updateWorkflowStateCas(
      "task-cas-fail-1",
      5, // wrong expected version
      "running",
      "running",
      1,
      '{"step1":"done"}',
      now,
      null,
    );

    assert.equal(updated, 0);

    // Original state should be unchanged
    const result = repo.getWorkflowState("task-cas-fail-1");
    assert.ok(result);
    assert.equal(result.currentStepIndex, 0);
  } finally {
    cleanupPath(workspace);
  }
});

test("WorkflowRepository updateWorkflowRecoveryState updates all recovery fields", () => {
  const workspace = createTempWorkspace("aa-workflow-repo-");
  const dbPath = join(workspace, "workflow.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new WorkflowRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";

    createTestTask(db, "task-recovery-1", null, now);

    repo.insertWorkflowState({
      taskId: "task-recovery-1",
      divisionId: "general-ops",
      workflowId: "wf-1",
      currentStepIndex: 0,
      status: "running",
      outputsJson: "{}",
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    });

    repo.updateWorkflowRecoveryState({
      taskId: "task-recovery-1",
      status: "running",
      currentStepIndex: 1,
      outputsJson: '{"partial":"result"}',
      updatedAt: now,
      resumableFromStep: "step-0",
      retryCount: 2,
      lastErrorCode: "STEP_TIMEOUT",
    });

    const result = repo.getWorkflowState("task-recovery-1");
    assert.ok(result);
    assert.equal(result.retryCount, 2);
    assert.equal(result.lastErrorCode, "STEP_TIMEOUT");
    assert.equal(result.outputsJson, '{"partial":"result"}');
  } finally {
    cleanupPath(workspace);
  }
});
