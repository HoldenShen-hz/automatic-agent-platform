/**
 * Integration tests for WorkflowRepository CRUD operations.
 *
 * Tests SQLite-based workflow repository: insert, get, update, list,
 * step index tracking, and compare-and-swap semantics.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createIntegrationContext } from "../../../helpers/integration-context.js";
import { WorkflowRepository } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/workflow-repository.js";

function makeWorkflow(overrides: {
  id?: string;
  taskId?: string;
  divisionId?: string | null;
  workflowId?: string;
  status?: string;
  createdAt?: string;
  startedAt?: string;
  updatedAt?: string;
  outputsJson?: string;
} = {}): {
  id?: string;
  taskId: string;
  divisionId?: string | null;
  workflowId?: string;
  status: string;
  createdAt?: string;
  startedAt?: string;
  updatedAt: string;
  outputsJson?: string;
} {
  const now = new Date().toISOString();
  return {
    id: "wf-test-001",
    taskId: "task-wf-001",
    divisionId: "general_ops",
    workflowId: "wf-test-001",
    status: "running",
    createdAt: now,
    startedAt: now,
    updatedAt: now,
    outputsJson: "{}",
    ...overrides,
  };
}

test("integration: WorkflowRepository.insertWorkflow creates workflow record", () => {
  const ctx = createIntegrationContext("aa-wf-repo-insert-");
  try {
    const repo = new WorkflowRepository(ctx.db.connection);
    const workflow = makeWorkflow({
      id: "wf-insert-001",
      taskId: "task-insert-001",
      status: "running",
    });

    repo.insertWorkflow(workflow);

    // The insertWorkflow method uses taskId as the lookup key via workflowId
    const retrieved = repo.getWorkflow("wf-insert-001");
    assert.notEqual(retrieved, null);
    assert.equal(retrieved!.workflowId, "wf-insert-001");
    assert.equal(retrieved!.taskId, "task-insert-001");
    assert.equal(retrieved!.status, "running");
    assert.equal(retrieved!.currentStepIndex, 0);
    assert.equal(retrieved!.outputsJson, "{}");
  } finally {
    ctx.cleanup();
  }
});

test("integration: WorkflowRepository.getWorkflow retrieves workflow by ID", () => {
  const ctx = createIntegrationContext("aa-wf-repo-get-");
  try {
    const repo = new WorkflowRepository(ctx.db.connection);
    const workflow = makeWorkflow({
      id: "wf-get-001",
      taskId: "task-get-001",
      status: "running",
    });
    repo.insertWorkflow(workflow);

    const retrieved = repo.getWorkflow("wf-get-001");

    assert.notEqual(retrieved, null);
    assert.equal(retrieved!.workflowId, "wf-get-001");
    assert.equal(retrieved!.taskId, "task-get-001");
    assert.equal(retrieved!.status, "running");
  } finally {
    ctx.cleanup();
  }
});

test("integration: WorkflowRepository.getWorkflow returns null for non-existent workflow", () => {
  const ctx = createIntegrationContext("aa-wf-repo-get-none-");
  try {
    const repo = new WorkflowRepository(ctx.db.connection);
    const retrieved = repo.getWorkflow("non-existent-wf");
    assert.equal(retrieved, null);
  } finally {
    ctx.cleanup();
  }
});

test("integration: WorkflowRepository.updateWorkflowState updates state correctly", () => {
  const ctx = createIntegrationContext("aa-wf-repo-update-");
  try {
    const repo = new WorkflowRepository(ctx.db.connection);
    const workflow = makeWorkflow({
      id: "wf-update-001",
      taskId: "task-update-001",
      status: "running",
    });
    repo.insertWorkflow(workflow);

    const updatedAt = new Date().toISOString();
    const newOutputs = JSON.stringify({ result: "step 1 done" });
    repo.updateWorkflowState("task-update-001", "running", 1, newOutputs, updatedAt, null);

    const retrieved = repo.getWorkflow("wf-update-001");
    assert.notEqual(retrieved, null);
    assert.equal(retrieved!.status, "running");
    assert.equal(retrieved!.currentStepIndex, 1);
    assert.equal(retrieved!.outputsJson, newOutputs);
    assert.equal(retrieved!.updatedAt, updatedAt);
  } finally {
    ctx.cleanup();
  }
});

test("integration: WorkflowRepository.updateWorkflowStateCas uses compare-and-swap", () => {
  const ctx = createIntegrationContext("aa-wf-repo-cas-");
  try {
    const repo = new WorkflowRepository(ctx.db.connection);
    const workflow = makeWorkflow({
      id: "wf-cas-001",
      taskId: "task-cas-001",
      status: "running",
    });
    repo.insertWorkflow(workflow);

    const updatedAt = new Date().toISOString();

    // Successful CAS: currentStepIndex and status match expected
    const rowsAffected = repo.updateWorkflowStateCas(
      "task-cas-001",
      0,            // expected currentStepIndex
      "running",    // expected status
      "running",
      1,
      "{}",
      updatedAt,
      null,
    );
    assert.equal(rowsAffected, 1);

    const retrieved = repo.getWorkflow("wf-cas-001");
    assert.equal(retrieved!.currentStepIndex, 1);
    assert.equal(retrieved!.status, "running");

    // Failed CAS: currentStepIndex does not match expected (now 1, not 0)
    const rowsAffected2 = repo.updateWorkflowStateCas(
      "task-cas-001",
      0,            // expected currentStepIndex - will not match
      "running",
      "completed",
      2,
      "{}",
      updatedAt,
      null,
    );
    assert.equal(rowsAffected2, 0);

    // State should remain unchanged
    const retrieved2 = repo.getWorkflow("wf-cas-001");
    assert.equal(retrieved2!.currentStepIndex, 1);
    assert.equal(retrieved2!.status, "running");
  } finally {
    ctx.cleanup();
  }
});

test("integration: WorkflowRepository.listWorkflowStates returns all workflows for tasks", () => {
  const ctx = createIntegrationContext("aa-wf-repo-list-");
  try {
    const repo = new WorkflowRepository(ctx.db.connection);

    // Each workflow must have a unique taskId due to UNIQUE constraint on task_id
    // Insert workflows for different tasks
    repo.insertWorkflow(makeWorkflow({
      id: "wf-list-001",
      taskId: "task-list-001",
      status: "running",
    }));
    repo.insertWorkflow(makeWorkflow({
      id: "wf-list-002",
      taskId: "task-list-002",
      status: "completed",
    }));
    repo.insertWorkflow(makeWorkflow({
      id: "wf-list-003",
      taskId: "task-list-003",
      status: "running",
    }));

    const allWorkflows = repo.listWorkflowStates();

    assert.ok(allWorkflows.length >= 3);
    const runningWorkflows = allWorkflows.filter((w) => w.status === "running");
    assert.ok(runningWorkflows.length >= 2);
    const completedWorkflows = allWorkflows.filter((w) => w.status === "completed");
    assert.ok(completedWorkflows.length >= 1);
  } finally {
    ctx.cleanup();
  }
});

test("integration: WorkflowRepository.step index is tracked correctly", () => {
  const ctx = createIntegrationContext("aa-wf-repo-step-");
  try {
    const repo = new WorkflowRepository(ctx.db.connection);
    const workflow = makeWorkflow({
      id: "wf-step-001",
      taskId: "task-step-001",
      status: "running",
    });
    repo.insertWorkflow(workflow);

    // Initial step index should be 0
    let retrieved = repo.getWorkflow("wf-step-001");
    assert.equal(retrieved!.currentStepIndex, 0);

    const updatedAt = new Date().toISOString();

    // Advance to step 1
    repo.updateWorkflowState("task-step-001", "running", 1, "{}", updatedAt, null);
    retrieved = repo.getWorkflow("wf-step-001");
    assert.equal(retrieved!.currentStepIndex, 1);

    // Advance to step 2
    repo.updateWorkflowState("task-step-001", "running", 2, "{}", updatedAt, null);
    retrieved = repo.getWorkflow("wf-step-001");
    assert.equal(retrieved!.currentStepIndex, 2);

    // Advance to step 3 and complete
    repo.updateWorkflowState("task-step-001", "completed", 3, '{"final": true}', updatedAt, null);
    retrieved = repo.getWorkflow("wf-step-001");
    assert.equal(retrieved!.currentStepIndex, 3);
    assert.equal(retrieved!.status, "completed");
  } finally {
    ctx.cleanup();
  }
});

test("integration: WorkflowRepository.updateWorkflowState sets resumableFromStep", () => {
  const ctx = createIntegrationContext("aa-wf-repo-resumable-");
  try {
    const repo = new WorkflowRepository(ctx.db.connection);
    const workflow = makeWorkflow({
      id: "wf-resumable-001",
      taskId: "task-resumable-001",
      status: "running",
    });
    repo.insertWorkflow(workflow);

    const updatedAt = new Date().toISOString();
    repo.updateWorkflowState("task-resumable-001", "failed", 2, "{}", updatedAt, "1");

    const retrieved = repo.getWorkflow("wf-resumable-001");
    assert.notEqual(retrieved, null);
    assert.equal(retrieved!.status, "failed");
    assert.equal(retrieved!.currentStepIndex, 2);
    assert.equal(retrieved!.resumableFromStep, "1");
  } finally {
    ctx.cleanup();
  }
});

test("integration: WorkflowRepository.updateWorkflowStateCas clears lastErrorCode on running/completed", () => {
  const ctx = createIntegrationContext("aa-wf-repo-error-clear-");
  try {
    const repo = new WorkflowRepository(ctx.db.connection);

    // First insert a workflow state directly with an error code
    const now = new Date().toISOString();
    repo.insertWorkflowState({
      taskId: "task-error-clear-001",
      divisionId: "general_ops",
      workflowId: "wf-error-clear-001",
      currentStepIndex: 0,
      status: "failed",
      outputsJson: "{}",
      lastErrorCode: "ERR_STEP_FAILED",
      retryCount: 1,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    });

    const updatedAt = new Date().toISOString();

    // Update to running - should clear lastErrorCode
    repo.updateWorkflowState("task-error-clear-001", "running", 1, "{}", updatedAt, null);

    const retrieved = repo.getWorkflow("wf-error-clear-001");
    assert.notEqual(retrieved, null);
    assert.equal(retrieved!.status, "running");
    assert.equal(retrieved!.lastErrorCode, null);
  } finally {
    ctx.cleanup();
  }
});
