import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync, unlinkSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

import {
  createWorkflowStepCheckpoint,
  readWorkflowStepCheckpoint,
  summarizeWorkflowStepCheckpoint,
} from "../../../../../src/platform/state-evidence/checkpoints/workflow-step-checkpoint.js";
import { createTempWorkspace, cleanupPath } from "../../../../helpers/fs.js";

test("createWorkflowStepCheckpoint creates valid checkpoint for integration", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness_integ_1",
    nodeRunId: "node_integ_1",
    planGraphId: "pg_integ_1",
    taskId: "task_integ_checkpoint_1",
    executionId: "exec_integ_checkpoint_1",
    workflowId: "wf_integ_checkpoint_1",
    divisionId: "div_integ_checkpoint_1",
    stepId: "step_integ_checkpoint_1",
    roleId: "role_integ_checkpoint_1",
    outputKey: "output_key_integ_1",
    status: "succeeded",
    producedAt: "2026-04-27T00:00:00.000Z",
    output: { result: "success", data: { key: "value" } },
    decisionContext: {
      source: "model_response",
      request: "process task integration",
      routeReason: "completed successfully",
      priorStepSummaries: ["step 1 completed", "step 2 completed"],
      dependsOnStepIds: ["step_1", "step_2"],
    },
    resumeContext: {
      completedStepIds: ["step_1", "step_2", "step_integ_checkpoint_1"],
      nextStepId: "step_next",
      outputKeys: ["output_1", "output_2", "output_key_integ_1"],
    },
    fileDiffSummary: {
      summary: "Updated 3 files, created 1",
      createdPaths: ["src/new-integration.ts"],
      updatedPaths: ["src/existing-integration.ts"],
      deletedPaths: [],
    },
    upstreamArtifactRefs: [
      {
        artifactId: "artifact_integ_1",
        kind: "source_code",
        uri: "file://src/artifact-integration.ts",
        createdAt: "2026-04-27T00:00:00.000Z",
      },
    ],
    compensationModel: "idempotent_replay",
  });

  assert.equal(checkpoint.taskId, "task_integ_checkpoint_1");
  assert.equal(checkpoint.status, "succeeded");
  assert.equal(checkpoint.compensationModel, "idempotent_replay");
  assert.equal(checkpoint.resumeContext.nextStepId, "step_next");
});

test("createWorkflowStepCheckpoint handles failed status", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness_failed",
    nodeRunId: "node_failed",
    planGraphId: "pg_failed",
    taskId: "task_integ_failed",
    executionId: "exec_integ_failed",
    workflowId: "wf_integ_failed",
    divisionId: "div_integ_failed",
    stepId: "step_integ_failed",
    roleId: "role_integ_failed",
    outputKey: "output_key_failed",
    status: "failed",
    producedAt: "2026-04-27T00:00:00.000Z",
    output: { error: "something went wrong", code: "ERR_FAILED" },
    decisionContext: {
      source: "error_handler",
      request: "process task",
      routeReason: "step failed",
      priorStepSummaries: [],
      dependsOnStepIds: [],
    },
    resumeContext: {
      completedStepIds: [],
      nextStepId: null,
      outputKeys: [],
    },
  });

  assert.equal(checkpoint.status, "failed");
  assert.equal((checkpoint.output as { error: string }).error, "something went wrong");
});

test("createWorkflowStepCheckpoint handles partial file diff summary", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness_file_diff",
    nodeRunId: "node_file_diff",
    planGraphId: "pg_file_diff",
    taskId: "task_integ_file_diff",
    executionId: null,
    workflowId: "wf_integ_file_diff",
    divisionId: "div_integ_file_diff",
    stepId: "step_integ_file_diff",
    roleId: "role_integ_file_diff",
    outputKey: "output_key_file_diff",
    status: "succeeded",
    producedAt: "2026-04-27T00:00:00.000Z",
    output: {},
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
    fileDiffSummary: {
      summary: "Only created files",
      createdPaths: ["file1.txt", "file2.txt"],
    },
  });

  assert.equal(checkpoint.fileDiffSummary.createdPaths.length, 2);
  assert.equal(checkpoint.fileDiffSummary.updatedPaths.length, 0);
  assert.equal(checkpoint.fileDiffSummary.deletedPaths.length, 0);
});

test("createWorkflowStepCheckpoint creates defensive array copies", () => {
  const priorStepSummaries = ["step 1", "step 2"];
  const dependsOnStepIds = ["s1", "s2"];

  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness_defensive",
    nodeRunId: "node_defensive",
    planGraphId: "pg_defensive",
    taskId: "task_integ_defensive",
    executionId: null,
    workflowId: "wf_integ_defensive",
    divisionId: "div_integ_defensive",
    stepId: "step_integ_defensive",
    roleId: "role_integ_defensive",
    outputKey: "output_key_defensive",
    status: "succeeded",
    producedAt: "2026-04-27T00:00:00.000Z",
    output: {},
    decisionContext: {
      source: "test",
      request: "test",
      routeReason: null,
      priorStepSummaries,
      dependsOnStepIds,
    },
    resumeContext: {
      completedStepIds: ["s1", "s2"],
      nextStepId: null,
      outputKeys: [],
    },
  });

  // Mutate original arrays
  priorStepSummaries.push("step 3");
  dependsOnStepIds.push("s3");

  // Checkpoint should not be affected
  assert.equal(checkpoint.decisionContext.priorStepSummaries.length, 2);
  assert.equal(checkpoint.decisionContext.dependsOnStepIds.length, 2);
});

test("readWorkflowStepCheckpoint returns null for non-existent file", () => {
  const artifactRecord = {
    artifactId: "artifact_nonexistent",
    taskId: "task_nonexistent",
    executionId: null,
    stepId: "step_nonexistent",
    kind: "workflow_step_snapshot",
    storagePath: "/nonexistent/path/checkpoint.json",
    fileName: "checkpoint.json",
    mimeType: "application/json",
    sizeBytes: 100,
    checksum: null,
    lineageJson: null,
    createdAt: "2026-04-27T00:00:00.000Z",
  };

  const result = readWorkflowStepCheckpoint(artifactRecord);
  assert.equal(result, null);
});

test("readWorkflowStepCheckpoint returns null for wrong kind", () => {
  const artifactRecord = {
    artifactId: "artifact_wrong_kind",
    taskId: "task_wrong_kind",
    executionId: null,
    stepId: "step_wrong_kind",
    kind: "source_code", // Wrong kind
    storagePath: "/tmp/test.ts",
    fileName: "test.ts",
    mimeType: "text/typescript",
    sizeBytes: 100,
    checksum: null,
    lineageJson: null,
    createdAt: "2026-04-27T00:00:00.000Z",
  };

  const result = readWorkflowStepCheckpoint(artifactRecord);
  assert.equal(result, null);
});

test("summarizeWorkflowStepCheckpoint extracts summary correctly", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness_summarize",
    nodeRunId: "node_summarize",
    planGraphId: "pg_summarize",
    taskId: "task_summarize",
    executionId: "exec_summarize",
    workflowId: "wf_summarize",
    divisionId: "div_summarize",
    stepId: "step_summarize",
    roleId: "role_summarize",
    outputKey: "output_summarize",
    status: "succeeded",
    producedAt: "2026-04-27T00:00:00.000Z",
    output: { summary: "Workflow completed successfully" },
    decisionContext: {
      source: "model_response",
      request: "complete workflow",
      routeReason: "all done",
      priorStepSummaries: [],
      dependsOnStepIds: [],
    },
    resumeContext: {
      completedStepIds: [],
      nextStepId: null,
      outputKeys: [],
    },
  });

  const summary = summarizeWorkflowStepCheckpoint("artifact_summarize", checkpoint);

  assert.equal(summary.artifactId, "artifact_summarize");
  assert.equal(summary.stepId, "step_summarize");
  assert.equal(summary.workflowId, "wf_summarize");
  assert.equal(summary.status, "succeeded");
  assert.equal(summary.summary, "Workflow completed successfully");
  assert.equal(summary.source, "model_response");
});

test("summarizeWorkflowStepCheckpoint handles missing summary", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness_no_summary",
    nodeRunId: "node_no_summary",
    planGraphId: "pg_no_summary",
    taskId: "task_no_summary",
    executionId: null,
    workflowId: "wf_no_summary",
    divisionId: "div_no_summary",
    stepId: "step_no_summary",
    roleId: "role_no_summary",
    outputKey: "output_no_summary",
    status: "succeeded",
    producedAt: "2026-04-27T00:00:00.000Z",
    output: { result: "no summary field here" },
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

  const summary = summarizeWorkflowStepCheckpoint("artifact_no_summary", checkpoint);

  assert.equal(summary.summary, null);
});

test("readWorkflowStepCheckpoint parses valid checkpoint artifact", () => {
  const workspace = createTempWorkspace("aa-checkpoint-read-test-");
  const storagePath = join(workspace, "checkpoint.json");

  try {
    // Create a valid checkpoint artifact
    const checkpoint = createWorkflowStepCheckpoint({
      harnessRunId: "harness_valid_read",
      nodeRunId: "node_valid_read",
      planGraphId: "pg_valid_read",
      taskId: "task_valid_read",
      executionId: "exec_valid_read",
      workflowId: "wf_valid_read",
      divisionId: "div_valid_read",
      stepId: "step_valid_read",
      roleId: "role_valid_read",
      outputKey: "output_valid_read",
      status: "succeeded",
      producedAt: "2026-04-27T00:00:00.000Z",
      output: { result: "success" },
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

    // Write to file
    mkdirSync(workspace, { recursive: true });
    writeFileSync(storagePath, JSON.stringify(checkpoint), "utf8");

    const artifactRecord = {
      artifactId: "artifact_valid_read",
      taskId: "task_valid_read",
      executionId: "exec_valid_read",
      stepId: "step_valid_read",
      kind: "workflow_step_snapshot",
      storagePath,
      fileName: "checkpoint.json",
      mimeType: "application/json",
      sizeBytes: 100,
      checksum: null,
      lineageJson: null,
      createdAt: "2026-04-27T00:00:00.000Z",
    };

    const result = readWorkflowStepCheckpoint(artifactRecord);

    assert.ok(result !== null);
    assert.equal(result!.taskId, "task_valid_read");
    assert.equal(result!.status, "succeeded");
  } finally {
    cleanupPath(workspace);
  }
});

test("readWorkflowStepCheckpoint returns null for invalid JSON", () => {
  const workspace = createTempWorkspace("aa-checkpoint-invalid-json-");
  const storagePath = join(workspace, "invalid.json");

  try {
    // Write invalid JSON
    mkdirSync(workspace, { recursive: true });
    writeFileSync(storagePath, "not valid json {", "utf8");

    const artifactRecord = {
      artifactId: "artifact_invalid_json",
      taskId: "task_invalid_json",
      executionId: null,
      stepId: "step_invalid_json",
      kind: "workflow_step_snapshot",
      storagePath,
      fileName: "invalid.json",
      mimeType: "application/json",
      sizeBytes: 100,
      checksum: null,
      lineageJson: null,
      createdAt: "2026-04-27T00:00:00.000Z",
    };

    const result = readWorkflowStepCheckpoint(artifactRecord);
    assert.equal(result, null);
  } finally {
    cleanupPath(workspace);
  }
});
