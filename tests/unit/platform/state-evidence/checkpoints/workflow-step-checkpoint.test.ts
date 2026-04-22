import assert from "node:assert/strict";
import test from "node:test";

import {
  createWorkflowStepCheckpoint,
  readWorkflowStepCheckpoint,
  summarizeWorkflowStepCheckpoint,
  WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION,
} from "../../../../../src/platform/state-evidence/checkpoints/workflow-step-checkpoint.js";
import type { ArtifactRecord } from "../../../../../src/platform/contracts/types/domain.js";

test("createWorkflowStepCheckpoint builds correct structure", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    taskId: "task_123",
    executionId: "exec_456",
    workflowId: "wf_789",
    divisionId: "div_abc",
    stepId: "step_def",
    roleId: "role_ghi",
    outputKey: "output_jkl",
    status: "succeeded",
    producedAt: "2024-01-15T10:30:00.000Z",
    output: { result: "success", data: { key: "value" } },
    decisionContext: {
      source: "model_response",
      request: "analyze this",
      routeReason: "completed analysis",
      priorStepSummaries: ["step 1 completed", "step 2 completed"],
      dependsOnStepIds: ["step_1", "step_2"],
    },
    resumeContext: {
      completedStepIds: ["step_1", "step_2", "step_def"],
      nextStepId: "step_ghi",
      outputKeys: ["output_1", "output_2", "output_jkl"],
    },
    fileDiffSummary: {
      summary: "Updated 3 files",
      createdPaths: ["src/new.ts"],
      updatedPaths: ["src/existing.ts"],
      deletedPaths: [],
    },
    upstreamArtifactRefs: [
      {
        artifactId: "artifact_1",
        kind: "source_code",
        uri: "file://src/artifact.ts",
        createdAt: "2024-01-15T10:00:00.000Z",
      },
    ],
    compensationModel: "idempotent_replay",
  });

  assert.equal(checkpoint.schemaVersion, WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION);
  assert.equal(checkpoint.taskId, "task_123");
  assert.equal(checkpoint.executionId, "exec_456");
  assert.equal(checkpoint.workflowId, "wf_789");
  assert.equal(checkpoint.divisionId, "div_abc");
  assert.equal(checkpoint.stepId, "step_def");
  assert.equal(checkpoint.roleId, "role_ghi");
  assert.equal(checkpoint.outputKey, "output_jkl");
  assert.equal(checkpoint.status, "succeeded");
  assert.equal(checkpoint.compensationModel, "idempotent_replay");
});

test("createWorkflowStepCheckpoint creates defensive copies of arrays", () => {
  const priorStepSummaries = ["step 1", "step 2"];
  const dependsOnStepIds = ["step_1", "step_2"];

  const checkpoint = createWorkflowStepCheckpoint({
    taskId: "task_123",
    executionId: null,
    workflowId: "wf_789",
    divisionId: "div_abc",
    stepId: "step_def",
    roleId: "role_ghi",
    outputKey: "output_jkl",
    status: "succeeded",
    producedAt: "2024-01-15T10:30:00.000Z",
    output: {},
    decisionContext: {
      source: "test",
      request: "test request",
      routeReason: null,
      priorStepSummaries,
      dependsOnStepIds,
    },
    resumeContext: {
      completedStepIds: ["step_1"],
      nextStepId: "step_2",
      outputKeys: ["key1"],
    },
  });

  // Mutate original arrays
  priorStepSummaries.push("step 3");
  dependsOnStepIds.push("step_3");

  // Checkpoint should not be affected
  assert.equal(checkpoint.decisionContext.priorStepSummaries.length, 2);
  assert.equal(checkpoint.decisionContext.dependsOnStepIds.length, 2);
});

test("createWorkflowStepCheckpoint handles optional fields", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    taskId: "task_123",
    executionId: null,
    workflowId: "wf_789",
    divisionId: "div_abc",
    stepId: "step_def",
    roleId: "role_ghi",
    outputKey: "output_jkl",
    status: "failed",
    producedAt: "2024-01-15T10:30:00.000Z",
    output: { error: "something went wrong" },
    decisionContext: {
      source: "test",
      request: "test request",
      routeReason: null,
      priorStepSummaries: [],
      dependsOnStepIds: [],
    },
    resumeContext: {
      completedStepIds: [],
      nextStepId: null,
      outputKeys: [],
    },
  });

  assert.equal(checkpoint.executionId, null);
  assert.equal(checkpoint.compensationModel, null);
  assert.equal(checkpoint.upstreamArtifactRefs.length, 0);
  assert.equal(checkpoint.fileDiffSummary.summary, null);
  assert.equal(checkpoint.fileDiffSummary.createdPaths.length, 0);
});

test("readWorkflowStepCheckpoint returns null for non-snapshot artifacts", () => {
  const record: ArtifactRecord = {
    artifactId: "artifact_1",
    taskId: "task_1",
    executionId: null,
    stepId: "step_1",
    kind: "source_code",
    storagePath: "/tmp/test.ts",
    fileName: "test.ts",
    mimeType: "text/typescript",
    sizeBytes: 100,
    checksum: null,
    lineageJson: null,
    createdAt: "2024-01-01T00:00:00.000Z",
  };

  const result = readWorkflowStepCheckpoint(record);
  assert.equal(result, null);
});

test("summarizeWorkflowStepCheckpoint extracts correct fields", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    taskId: "task_123",
    executionId: "exec_456",
    workflowId: "wf_789",
    divisionId: "div_abc",
    stepId: "step_def",
    roleId: "role_ghi",
    outputKey: "output_jkl",
    status: "succeeded",
    producedAt: "2024-01-15T10:30:00.000Z",
    output: { summary: "Completed analysis successfully" },
    decisionContext: {
      source: "model_response",
      request: "analyze this",
      routeReason: "completed analysis",
      priorStepSummaries: ["step 1 completed"],
      dependsOnStepIds: ["step_1"],
    },
    resumeContext: {
      completedStepIds: ["step_1", "step_def"],
      nextStepId: "step_ghi",
      outputKeys: ["output_1", "output_jkl"],
    },
    fileDiffSummary: {
      summary: "Updated 2 files",
      createdPaths: [],
      updatedPaths: ["file1.ts", "file2.ts"],
      deletedPaths: [],
    },
  });

  const summary = summarizeWorkflowStepCheckpoint("artifact_123", checkpoint);

  assert.equal(summary.artifactId, "artifact_123");
  assert.equal(summary.stepId, "step_def");
  assert.equal(summary.workflowId, "wf_789");
  assert.equal(summary.status, "succeeded");
  assert.equal(summary.producedAt, "2024-01-15T10:30:00.000Z");
  assert.equal(summary.nextStepId, "step_ghi");
  assert.deepEqual(summary.outputKeys, ["output_1", "output_jkl"]);
  assert.equal(summary.summary, "Completed analysis successfully");
  assert.equal(summary.source, "model_response");
});

test("summarizeWorkflowStepCheckpoint handles missing summary in output", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    taskId: "task_123",
    executionId: null,
    workflowId: "wf_789",
    divisionId: "div_abc",
    stepId: "step_def",
    roleId: "role_ghi",
    outputKey: "output_jkl",
    status: "succeeded",
    producedAt: "2024-01-15T10:30:00.000Z",
    output: { result: "no summary field" },
    decisionContext: {
      source: "test",
      request: "test",
      routeReason: null,
      priorStepSummaries: [],
      dependsOnStepIds: [],
    },
    resumeContext: {
      completedStepIds: [],
      nextStepId: null,
      outputKeys: [],
    },
  });

  const summary = summarizeWorkflowStepCheckpoint("artifact_1", checkpoint);
  assert.equal(summary.summary, null);
});

test("summarizeWorkflowStepCheckpoint handles non-string summary in output", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    taskId: "task_123",
    executionId: null,
    workflowId: "wf_789",
    divisionId: "div_abc",
    stepId: "step_def",
    roleId: "role_ghi",
    outputKey: "output_jkl",
    status: "succeeded",
    producedAt: "2024-01-15T10:30:00.000Z",
    output: { summary: { nested: "object" } },
    decisionContext: {
      source: "test",
      request: "test",
      routeReason: null,
      priorStepSummaries: [],
      dependsOnStepIds: [],
    },
    resumeContext: {
      completedStepIds: [],
      nextStepId: null,
      outputKeys: [],
    },
  });

  const summary = summarizeWorkflowStepCheckpoint("artifact_1", checkpoint);
  assert.equal(summary.summary, null);
});
