import { describe, it } from "node:test";
import assert from "node:assert";

import type {
  ArtifactRecord,
  StepOutputRecord,
  TaskRecord,
  WorkflowStateRecord,
} from "../../../../src/platform/contracts/types/domain.js";
import {
  buildStepResultEnvelope,
  buildTaskResultEnvelope,
  type ResultEnvelopeStatus,
} from "../../../../src/platform/contracts/result-envelope/result-envelope.js";

function createTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: "task-1",
    parentId: null,
    rootId: "task-1",
    harnessRunId: null,
    divisionId: "general",
    tenantId: "tenant-1",
    title: "Test Task",
    status: "done",
    source: "user",
    priority: "normal",
    inputJson: "{}",
    normalizedInputJson: null,
    outputJson: JSON.stringify({ result: "success" }),
    estimatedCostUsd: null,
    actualCostUsd: 0,
    errorCode: null,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    completedAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function createWorkflowState(overrides: Partial<WorkflowStateRecord> = {}): WorkflowStateRecord {
  return {
    taskId: "task-1",
    divisionId: "general",
    workflowId: "wf-1",
    currentStepIndex: 0,
    status: "completed",
    outputsJson: "{}",
    lastErrorCode: null,
    retryCount: 0,
    resumableFromStep: null,
    startedAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:05:00Z",
    ...overrides,
  };
}

function createStepOutput(overrides: Partial<StepOutputRecord> = {}): StepOutputRecord {
  return {
    id: "step-1",
    taskId: "task-1",
    nodeRunId: "node-1",
    stepId: "step-1",
    roleId: "role-1",
    status: "succeeded",
    dataJson: "{}",
    summary: "Step completed",
    artifactsJson: null,
    tokenCost: 50,
    durationMs: 200,
    validationJson: null,
    producedAt: "2024-01-01T00:01:00Z",
    ...overrides,
  };
}

function createArtifact(overrides: Partial<ArtifactRecord> = {}): ArtifactRecord {
  return {
    artifactId: "artifact-1",
    taskId: "task-1",
    executionId: null,
    nodeRunId: "node-1",
    stepId: "step-1",
    kind: "report",
    storagePath: "/tmp/artifact-1.json",
    fileName: "artifact-1.json",
    mimeType: "application/json",
    sizeBytes: 10,
    checksum: null,
    lineageJson: null,
    createdAt: "2024-01-01T00:01:00Z",
    ...overrides,
  };
}

describe("contracts/result-envelope", () => {
  it("exposes the expected result statuses", () => {
    const statuses: ResultEnvelopeStatus[] = ["success", "partial", "error"];
    assert.deepStrictEqual(statuses, ["success", "partial", "error"]);
  });

  it("returns null when a task has no output, steps, or artifacts", () => {
    const result = buildTaskResultEnvelope({
      task: createTask({ status: "pending", outputJson: null, completedAt: null }),
      workflowState: null,
      stepOutputs: [],
      artifacts: [],
    });
    assert.strictEqual(result, null);
  });

  it("builds success, error, and partial task envelopes", () => {
    const success = buildTaskResultEnvelope({
      task: createTask(),
      workflowState: null,
      stepOutputs: [],
      artifacts: [],
    });
    const error = buildTaskResultEnvelope({
      task: createTask({
        status: "failed",
        outputJson: JSON.stringify({ error: "something went wrong" }),
        errorCode: "task.failed",
      }),
      workflowState: null,
      stepOutputs: [],
      artifacts: [],
    });
    const partial = buildTaskResultEnvelope({
      task: createTask({
        status: "in_progress",
        outputJson: JSON.stringify({ progress: 50 }),
        completedAt: null,
      }),
      workflowState: null,
      stepOutputs: [],
      artifacts: [],
    });

    assert.equal(success?.status, "success");
    assert.equal(error?.status, "error");
    assert.equal(error?.error?.code, "task.failed");
    assert.equal(partial?.status, "partial");
  });

  it("aggregates step output metrics and provenance", () => {
    const result = buildTaskResultEnvelope({
      task: createTask({
        updatedAt: "2024-01-01T00:05:00Z",
        completedAt: "2024-01-01T00:05:00Z",
        outputJson: JSON.stringify({ summary: "task completed" }),
      }),
      workflowState: createWorkflowState({ currentStepIndex: 1 }),
      stepOutputs: [
        createStepOutput({ id: "step-1", nodeRunId: "node-1", tokenCost: 100, durationMs: 500 }),
        createStepOutput({ id: "step-2", nodeRunId: "node-2", stepId: "step-2", tokenCost: 200, durationMs: 1000 }),
      ],
      artifacts: [],
    });

    assert.deepStrictEqual(result?.metrics, { tokenCost: 300, durationMs: 1500 });
    assert.deepStrictEqual(result?.provenance, {
      entity: "task",
      taskId: "task-1",
      workflowId: "wf-1",
      workflowStatus: "completed",
      updatedAt: "2024-01-01T00:05:00Z",
      completedAt: "2024-01-01T00:05:00Z",
      stepCount: 2,
    });
  });

  it("builds step envelopes with metrics, warnings, summaries, and provenance", () => {
    const success = buildStepResultEnvelope(createStepOutput(), [createArtifact()]);
    const error = buildStepResultEnvelope(
      createStepOutput({
        status: "failed",
        dataJson: JSON.stringify({ error: "step failed" }),
        summary: "Step failed",
      }),
      [],
    );
    const partial = buildStepResultEnvelope(
      createStepOutput({
        status: "partial_success",
        dataJson: JSON.stringify({ warning: "partial" }),
        summary: "Step partially succeeded",
      }),
      [],
    );
    const customSummary = buildStepResultEnvelope(
      createStepOutput({
        dataJson: JSON.stringify({ humanSummary: "Custom summary from data" }),
        summary: null,
      }),
      [],
    );

    assert.equal(success.status, "success");
    assert.deepStrictEqual(success.metrics, { tokenCost: 50, durationMs: 200 });
    assert.equal(error.status, "error");
    assert.equal(error.error?.code, "step_output.failed");
    assert.equal(partial.status, "partial");
    assert.ok(partial.warnings.includes("partial_success"));
    assert.equal(customSummary.humanSummary, "Custom summary from data");
    assert.deepStrictEqual(success.provenance, {
      entity: "step_output",
      taskId: "task-1",
      nodeRunId: "node-1",
      roleId: "role-1",
      producedAt: "2024-01-01T00:01:00Z",
    });
  });
});
