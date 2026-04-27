import assert from "node:assert/strict";
import test from "node:test";

import {
  createWorkflowStepCheckpoint,
  WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION,
  type WorkflowStepCheckpointDecisionContext,
  type WorkflowStepCheckpointResumeContext,
  type WorkflowStepCheckpointFileDiffSummary,
  type CreateWorkflowStepCheckpointInput,
} from "../../../../../src/platform/state-evidence/checkpoints/workflow-step-checkpoint.js";
import type { ArtifactRef } from "../../../../../src/platform/contracts/types/domain.js";

function createMinimalDecisionContext(): WorkflowStepCheckpointDecisionContext {
  return {
    source: "model_response",
    request: "Process task step",
    routeReason: "Next step available",
    priorStepSummaries: ["Step 1 completed", "Step 2 completed"],
    dependsOnStepIds: ["step-1", "step-2"],
  };
}

function createMinimalResumeContext(): WorkflowStepCheckpointResumeContext {
  return {
    completedStepIds: ["step-1", "step-2"],
    nextStepId: "step-3",
    outputKeys: ["result1", "result2"],
  };
}

function createMinimalFileDiffSummary(): WorkflowStepCheckpointFileDiffSummary {
  return {
    summary: "Created 2 files, updated 1",
    createdPaths: ["/path/to/file1.txt", "/path/to/file2.txt"],
    updatedPaths: ["/path/to/config.yaml"],
    deletedPaths: [],
  };
}

function createMinimalArtifactRef(): ArtifactRef {
  return {
    artifactId: "artifact-123",
    kind: "document",
    uri: "file:///tmp/artifact.txt",
    mimeType: "text/plain",
    sizeBytes: 1024,
    checksum: "abc123def456",
    createdAt: "2024-01-01T00:00:00.000Z",
  };
}

test("createWorkflowStepCheckpoint returns checkpoint with correct schema version", () => {
  const input = createBaseInput();
  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.equal(checkpoint.schemaVersion, WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION);
});

test("createWorkflowStepCheckpoint preserves all input fields", () => {
  const input = createBaseInput();
  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.equal(checkpoint.taskId, input.taskId);
  assert.equal(checkpoint.executionId, input.executionId);
  assert.equal(checkpoint.workflowId, input.workflowId);
  assert.equal(checkpoint.divisionId, input.divisionId);
  assert.equal(checkpoint.stepId, input.stepId);
  assert.equal(checkpoint.roleId, input.roleId);
  assert.equal(checkpoint.outputKey, input.outputKey);
  assert.equal(checkpoint.status, input.status);
  assert.equal(checkpoint.producedAt, input.producedAt);
});

test("createWorkflowStepCheckpoint copies decisionContext values", () => {
  const input = createBaseInput();
  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.equal(checkpoint.decisionContext.source, input.decisionContext.source);
  assert.equal(checkpoint.decisionContext.request, input.decisionContext.request);
  assert.equal(checkpoint.decisionContext.routeReason, input.decisionContext.routeReason);
  assert.deepEqual(checkpoint.decisionContext.priorStepSummaries, input.decisionContext.priorStepSummaries);
  assert.deepEqual(checkpoint.decisionContext.dependsOnStepIds, input.decisionContext.dependsOnStepIds);
});

test("createWorkflowStepCheckpoint copies resumeContext values", () => {
  const input = createBaseInput();
  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.deepEqual(checkpoint.resumeContext.completedStepIds, input.resumeContext.completedStepIds);
  assert.equal(checkpoint.resumeContext.nextStepId, input.resumeContext.nextStepId);
  assert.deepEqual(checkpoint.resumeContext.outputKeys, input.resumeContext.outputKeys);
});

test("createWorkflowStepCheckpoint copies fileDiffSummary values", () => {
  const input = createBaseInput();
  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.equal(checkpoint.fileDiffSummary.summary, input.fileDiffSummary!.summary);
  assert.deepEqual(checkpoint.fileDiffSummary.createdPaths, input.fileDiffSummary!.createdPaths);
  assert.deepEqual(checkpoint.fileDiffSummary.updatedPaths, input.fileDiffSummary!.updatedPaths);
  assert.deepEqual(checkpoint.fileDiffSummary.deletedPaths, input.fileDiffSummary!.deletedPaths);
});

test("createWorkflowStepCheckpoint handles optional upstreamArtifactRefs", () => {
  const input = createBaseInput();
  input.upstreamArtifactRefs = [createMinimalArtifactRef()];

  const checkpoint = createWorkflowStepCheckpoint({ ...input, executionId: null });

  assert.equal(checkpoint.executionId, null);
  assert.deepEqual(checkpoint.upstreamArtifactRefs, input.upstreamArtifactRefs);
});

test("createWorkflowStepCheckpoint defaults optional upstreamArtifactRefs to empty array", () => {
  const input = createBaseInput();
  delete input.upstreamArtifactRefs;

  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.deepEqual(checkpoint.upstreamArtifactRefs, []);
});

test("createWorkflowStepCheckpoint handles optional fileDiffSummary", () => {
  const input = createBaseInput();
  delete input.fileDiffSummary;

  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.equal(checkpoint.fileDiffSummary.summary, null);
  assert.deepEqual(checkpoint.fileDiffSummary.createdPaths, []);
  assert.deepEqual(checkpoint.fileDiffSummary.updatedPaths, []);
  assert.deepEqual(checkpoint.fileDiffSummary.deletedPaths, []);
});

test("createWorkflowStepCheckpoint handles partial fileDiffSummary", () => {
  const input = createBaseInput();
  input.fileDiffSummary = {
    summary: "Partial summary",
  };

  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.equal(checkpoint.fileDiffSummary.summary, "Partial summary");
  assert.deepEqual(checkpoint.fileDiffSummary.createdPaths, []);
  assert.deepEqual(checkpoint.fileDiffSummary.updatedPaths, []);
  assert.deepEqual(checkpoint.fileDiffSummary.deletedPaths, []);
});

test("createWorkflowStepCheckpoint handles compensationModel null", () => {
  const input = createBaseInput();
  input.compensationModel = null;

  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.equal(checkpoint.compensationModel, null);
});

test("createWorkflowStepCheckpoint handles compensationModel undefined", () => {
  const input = createBaseInput();
  delete input.compensationModel;

  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.equal(checkpoint.compensationModel, null);
});

test("createWorkflowStepCheckpoint stores output object correctly", () => {
  const input = createBaseInput();
  input.output = {
    result: "success",
    values: [1, 2, 3],
    nested: { key: "value" },
  };

  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.deepEqual(checkpoint.output, input.output);
});

test("createWorkflowStepCheckpoint copies arrays by reference safety", () => {
  const input = createBaseInput();
  const originalPriorStepSummaries = ["Step 1", "Step 2"];
  input.decisionContext.priorStepSummaries = originalPriorStepSummaries;

  const checkpoint = createWorkflowStepCheckpoint(input);

  // Verify arrays are copied (not same reference)
  assert.ok(checkpoint.decisionContext.priorStepSummaries !== input.decisionContext.priorStepSummaries);
  assert.deepEqual(checkpoint.decisionContext.priorStepSummaries, originalPriorStepSummaries);
});

test("createWorkflowStepCheckpoint handles empty priorStepSummaries", () => {
  const input = createBaseInput();
  input.decisionContext.priorStepSummaries = [];

  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.deepEqual(checkpoint.decisionContext.priorStepSummaries, []);
});

test("createWorkflowStepCheckpoint handles empty completedStepIds", () => {
  const input = createBaseInput();
  input.resumeContext.completedStepIds = [];

  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.deepEqual(checkpoint.resumeContext.completedStepIds, []);
});

test("createWorkflowStepCheckpoint handles empty outputKeys", () => {
  const input = createBaseInput();
  input.resumeContext.outputKeys = [];

  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.deepEqual(checkpoint.resumeContext.outputKeys, []);
});

test("createWorkflowStepCheckpoint handles null routeReason", () => {
  const input = createBaseInput();
  input.decisionContext.routeReason = null;

  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.equal(checkpoint.decisionContext.routeReason, null);
});

test("createWorkflowStepCheckpoint handles null nextStepId", () => {
  const input = createBaseInput();
  input.resumeContext.nextStepId = null;

  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.equal(checkpoint.resumeContext.nextStepId, null);
});

test("createWorkflowStepCheckpoint with all optional fields works", () => {
  const input: CreateWorkflowStepCheckpointInput = {
    taskId: "task-full",
    executionId: "exec-full",
    workflowId: "wf-full",
    divisionId: "div-full",
    stepId: "step-full",
    roleId: "role-full",
    outputKey: "output-full",
    status: "succeeded",
    producedAt: "2024-06-15T12:00:00.000Z",
    output: { final: true },
    decisionContext: {
      source: "final_step",
      request: "Complete workflow",
      routeReason: "All steps done",
      priorStepSummaries: ["Step 1", "Step 2", "Step 3"],
      dependsOnStepIds: ["s1", "s2", "s3"],
    },
    resumeContext: {
      completedStepIds: ["s1", "s2", "s3"],
      nextStepId: null,
      outputKeys: ["final_output"],
    },
    fileDiffSummary: {
      summary: "Workflow complete",
      createdPaths: ["/final/result.txt"],
      updatedPaths: [],
      deletedPaths: [],
    },
    upstreamArtifactRefs: [createMinimalArtifactRef()],
    compensationModel: null,
  };

  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.equal(checkpoint.taskId, "task-full");
  assert.equal(checkpoint.compensationModel, null);
  assert.equal(checkpoint.upstreamArtifactRefs.length, 1);
});

function createBaseInput(): CreateWorkflowStepCheckpointInput {
  return {
    taskId: "task-123",
    executionId: "exec-456",
    workflowId: "wf-789",
    divisionId: "div-abc",
    stepId: "step-1",
    roleId: "agent",
    outputKey: "step1_output",
    status: "succeeded",
    producedAt: "2024-01-01T00:00:00.000Z",
    output: { result: "done" },
    decisionContext: createMinimalDecisionContext(),
    resumeContext: createMinimalResumeContext(),
    fileDiffSummary: createMinimalFileDiffSummary(),
    upstreamArtifactRefs: [],
    compensationModel: null,
  };
}