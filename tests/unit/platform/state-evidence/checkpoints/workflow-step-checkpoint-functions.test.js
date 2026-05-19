/**
 * Unit tests for Workflow Step Checkpoint Functions
 *
 * Tests createWorkflowStepCheckpoint, readWorkflowStepCheckpoint,
 * and summarizeWorkflowStepCheckpoint functions.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  createWorkflowStepCheckpoint,
  readWorkflowStepCheckpoint,
  summarizeWorkflowStepCheckpoint,
  WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION,
} from "../../../../../src/platform/state-evidence/checkpoints/workflow-step-checkpoint.js";

function createTempDir(prefix) {
  const path = join(tmpdir(), prefix + Date.now());
  mkdirSync(path, { recursive: true });
  return path;
}

function cleanupDir(path) {
  if (existsSync(path)) {
    rmSync(path, { recursive: true, force: true });
  }
}

// createWorkflowStepCheckpoint Tests

test("createWorkflowStepCheckpoint creates checkpoint with correct schema version", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness-123",
    nodeRunId: null,
    planGraphBundleId: "bundle-456",
    taskId: "task-789",
    executionId: null,
    workflowId: "wf-001",
    divisionId: "div-001",
    stepId: "step-001",
    roleId: "role-001",
    outputKey: "output-key",
    status: "succeeded",
    producedAt: "2026-04-29T00:00:00.000Z",
    output: { result: "success" },
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

  assert.equal(checkpoint.schemaVersion, WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION);
  assert.equal(checkpoint.schemaVersion, "workflow_step_checkpoint.v1");
});

test("createWorkflowStepCheckpoint preserves all input fields", () => {
  const input = {
    harnessRunId: "harness-abc",
    nodeRunId: "node-run-def",
    planGraphBundleId: "bundle-ghi",
    taskId: "task-xyz",
    executionId: "exec-123",
    workflowId: "wf-test",
    divisionId: "div-ops",
    stepId: "step-final",
    roleId: "role-executor",
    outputKey: "final-output",
    status: "succeeded",
    producedAt: "2026-04-29T12:00:00.000Z",
    output: { result: "done", data: { key: "value" } },
    decisionContext: {
      source: "planner",
      request: "execute workflow",
      routeReason: "complete",
      priorStepSummaries: ["step 1", "step 2"],
      dependsOnStepIds: ["step-1", "step-2"],
    },
    resumeContext: {
      completedStepIds: ["step-1", "step-2"],
      nextStepId: null,
      outputKeys: ["output-1", "output-2"],
    },
  };

  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.equal(checkpoint.harnessRunId, input.harnessRunId);
  assert.equal(checkpoint.nodeRunId, input.nodeRunId);
  assert.equal(checkpoint.planGraphBundleId, input.planGraphBundleId);
  assert.equal(checkpoint.taskId, input.taskId);
  assert.equal(checkpoint.executionId, input.executionId);
  assert.equal(checkpoint.workflowId, input.workflowId);
  assert.equal(checkpoint.divisionId, input.divisionId);
  assert.equal(checkpoint.stepId, input.stepId);
  assert.equal(checkpoint.roleId, input.roleId);
  assert.equal(checkpoint.outputKey, input.outputKey);
  assert.equal(checkpoint.status, input.status);
  assert.equal(checkpoint.producedAt, input.producedAt);
  assert.deepEqual(checkpoint.output, input.output);
});

test("createWorkflowStepCheckpoint creates defensive array copies", () => {
  const priorStepSummaries = ["step 1", "step 2"];
  const dependsOnStepIds = ["step-1"];
  const completedStepIds = ["step-0"];
  const outputKeys = ["key1"];
  const createdPaths = ["/src/new.ts"];

  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness-defensive",
    nodeRunId: null,
    planGraphBundleId: "bundle-defensive",
    taskId: "task-defensive",
    executionId: null,
    workflowId: "wf-defensive",
    divisionId: "div-defensive",
    stepId: "step-defensive",
    roleId: "role-defensive",
    outputKey: "output-defensive",
    status: "succeeded",
    producedAt: "2026-04-29T00:00:00.000Z",
    output: {},
    decisionContext: {
      source: "test",
      request: "test",
      routeReason: null,
      priorStepSummaries,
      dependsOnStepIds,
    },
    resumeContext: {
      completedStepIds,
      nextStepId: null,
      outputKeys,
    },
    fileDiffSummary: {
      summary: null,
      createdPaths,
      updatedPaths: [],
      deletedPaths: [],
    },
  });

  // Mutate original arrays
  priorStepSummaries.push("step 3");
  dependsOnStepIds.push("step-2");
  completedStepIds.push("step-1");
  outputKeys.push("key2");
  createdPaths.push("/src/new2.ts");

  // Checkpoint should not be affected
  assert.equal(checkpoint.decisionContext.priorStepSummaries.length, 2);
  assert.equal(checkpoint.decisionContext.dependsOnStepIds.length, 1);
  assert.equal(checkpoint.resumeContext.completedStepIds.length, 1);
  assert.equal(checkpoint.resumeContext.outputKeys.length, 1);
  assert.equal(checkpoint.fileDiffSummary.createdPaths.length, 1);
});

test("createWorkflowStepCheckpoint handles optional fields defaults", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness-optional",
    nodeRunId: null,
    planGraphBundleId: "bundle-optional",
    taskId: "task-optional",
    executionId: null,
    workflowId: "wf-optional",
    divisionId: "div-optional",
    stepId: "step-optional",
    roleId: "role-optional",
    outputKey: "output-optional",
    status: "succeeded",
    producedAt: "2026-04-29T00:00:00.000Z",
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
  });

  assert.deepEqual(checkpoint.upstreamArtifactRefs, []);
  assert.deepEqual(checkpoint.fileDiffSummary.createdPaths, []);
  assert.deepEqual(checkpoint.fileDiffSummary.updatedPaths, []);
  assert.deepEqual(checkpoint.fileDiffSummary.deletedPaths, []);
  assert.equal(checkpoint.fileDiffSummary.summary, null);
  assert.equal(checkpoint.compensationModel, null);
});

test("createWorkflowStepCheckpoint handles partial fileDiffSummary", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness-partial",
    nodeRunId: null,
    planGraphBundleId: "bundle-partial",
    taskId: "task-partial",
    executionId: null,
    workflowId: "wf-partial",
    divisionId: "div-partial",
    stepId: "step-partial",
    roleId: "role-partial",
    outputKey: "output-partial",
    status: "succeeded",
    producedAt: "2026-04-29T00:00:00.000Z",
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
      createdPaths: ["/new/file.ts"],
    },
  });

  assert.deepEqual(checkpoint.fileDiffSummary.createdPaths, ["/new/file.ts"]);
  assert.deepEqual(checkpoint.fileDiffSummary.updatedPaths, []);
  assert.deepEqual(checkpoint.fileDiffSummary.deletedPaths, []);
  assert.equal(checkpoint.fileDiffSummary.summary, null);
});

test("createWorkflowStepCheckpoint handles failed status", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness-failed",
    nodeRunId: null,
    planGraphBundleId: "bundle-failed",
    taskId: "task-failed",
    executionId: null,
    workflowId: "wf-failed",
    divisionId: "div-failed",
    stepId: "step-failed",
    roleId: "role-failed",
    outputKey: "output-failed",
    status: "failed",
    producedAt: "2026-04-29T00:00:00.000Z",
    output: { error: "Something went wrong" },
    decisionContext: {
      source: "error-handler",
      request: "process task",
      routeReason: "failed",
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
  assert.deepEqual(checkpoint.output, { error: "Something went wrong" });
});

test("createWorkflowStepCheckpoint handles skipped status", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness-skipped",
    nodeRunId: null,
    planGraphBundleId: "bundle-skipped",
    taskId: "task-skipped",
    executionId: null,
    workflowId: "wf-skipped",
    divisionId: "div-skipped",
    stepId: "step-skipped",
    roleId: "role-skipped",
    outputKey: "output-skipped",
    status: "skipped",
    producedAt: "2026-04-29T00:00:00.000Z",
    output: { reason: "condition not met" },
    decisionContext: {
      source: "router",
      request: "check condition",
      routeReason: "skipped",
      priorStepSummaries: [],
      dependsOnStepIds: [],
    },
    resumeContext: {
      completedStepIds: [],
      nextStepId: null,
      outputKeys: [],
    },
  });

  assert.equal(checkpoint.status, "skipped");
});

// readWorkflowStepCheckpoint Tests

test("readWorkflowStepCheckpoint returns null for non-workflow_step_snapshot kind", () => {
  const artifactRecord = {
    artifactId: "artifact-123",
    taskId: "task-123",
    executionId: "exec-123",
    stepId: "step-123",
    kind: "source_code",
    storagePath: "/path/to/file.ts",
    fileName: "file.ts",
    mimeType: "text/typescript",
    sizeBytes: 100,
    checksum: null,
    lineageJson: null,
    createdAt: "2026-04-29T00:00:00.000Z",
  };

  const result = readWorkflowStepCheckpoint(artifactRecord);
  assert.equal(result, null);
});

test("readWorkflowStepCheckpoint returns null for non-existent file", () => {
  const artifactRecord = {
    artifactId: "artifact-456",
    taskId: "task-456",
    executionId: "exec-456",
    stepId: "step-456",
    kind: "workflow_step_snapshot",
    storagePath: "/non/existent/path/checkpoint.json",
    fileName: "checkpoint.json",
    mimeType: "application/json",
    sizeBytes: 100,
    checksum: null,
    lineageJson: null,
    createdAt: "2026-04-29T00:00:00.000Z",
  };

  const result = readWorkflowStepCheckpoint(artifactRecord);
  assert.equal(result, null);
});

test("readWorkflowStepCheckpoint parses valid checkpoint file", () => {
  const workspace = createTempDir("aa-checkpoint-read-");
  const storagePath = join(workspace, "checkpoint.json");

  try {
    const checkpoint = createWorkflowStepCheckpoint({
      harnessRunId: "harness-read",
      nodeRunId: null,
      planGraphBundleId: "bundle-read",
      taskId: "task-read",
      executionId: "exec-read",
      workflowId: "wf-read",
      divisionId: "div-read",
      stepId: "step-read",
      roleId: "role-read",
      outputKey: "output-read",
      status: "succeeded",
      producedAt: "2026-04-29T00:00:00.000Z",
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

    writeFileSync(storagePath, JSON.stringify(checkpoint), "utf8");

    const artifactRecord = {
      artifactId: "artifact-read",
      taskId: "task-read",
      executionId: "exec-read",
      stepId: "step-read",
      kind: "workflow_step_snapshot",
      storagePath,
      fileName: "checkpoint.json",
      mimeType: "application/json",
      sizeBytes: 100,
      checksum: null,
      lineageJson: null,
      createdAt: "2026-04-29T00:00:00.000Z",
    };

    const result = readWorkflowStepCheckpoint(artifactRecord);

    assert.ok(result !== null);
    assert.equal(result.taskId, "task-read");
    assert.equal(result.workflowId, "wf-read");
    assert.equal(result.status, "succeeded");
    assert.equal(result.schemaVersion, WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION);
  } finally {
    cleanupDir(workspace);
  }
});

test("readWorkflowStepCheckpoint returns null for invalid JSON", () => {
  const workspace = createTempDir("aa-checkpoint-invalid-");
  const storagePath = join(workspace, "invalid.json");

  try {
    writeFileSync(storagePath, "not valid json {", "utf8");

    const artifactRecord = {
      artifactId: "artifact-invalid",
      taskId: "task-invalid",
      executionId: "exec-invalid",
      stepId: "step-invalid",
      kind: "workflow_step_snapshot",
      storagePath,
      fileName: "invalid.json",
      mimeType: "application/json",
      sizeBytes: 100,
      checksum: null,
      lineageJson: null,
      createdAt: "2026-04-29T00:00:00.000Z",
    };

    const result = readWorkflowStepCheckpoint(artifactRecord);
    assert.equal(result, null);
  } finally {
    cleanupDir(workspace);
  }
});

test("readWorkflowStepCheckpoint returns null for wrong schema version", () => {
  const workspace = createTempDir("aa-checkpoint-wrong-schema-");
  const storagePath = join(workspace, "wrong-schema.json");

  try {
    const invalidCheckpoint = {
      schemaVersion: "wrong_version.v1",
      harnessRunId: "harness-wrong",
      nodeRunId: null,
      planGraphBundleId: "bundle-wrong",
      taskId: "task-wrong",
      executionId: null,
      workflowId: "wf-wrong",
      divisionId: "div-wrong",
      stepId: "step-wrong",
      roleId: "role-wrong",
      outputKey: "output-wrong",
      status: "succeeded",
      producedAt: "2026-04-29T00:00:00.000Z",
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
        summary: null,
        createdPaths: [],
        updatedPaths: [],
        deletedPaths: [],
      },
      upstreamArtifactRefs: [],
      compensationModel: null,
    };

    writeFileSync(storagePath, JSON.stringify(invalidCheckpoint), "utf8");

    const artifactRecord = {
      artifactId: "artifact-wrong-schema",
      taskId: "task-wrong",
      executionId: "exec-wrong",
      stepId: "step-wrong",
      kind: "workflow_step_snapshot",
      storagePath,
      fileName: "wrong-schema.json",
      mimeType: "application/json",
      sizeBytes: 100,
      checksum: null,
      lineageJson: null,
      createdAt: "2026-04-29T00:00:00.000Z",
    };

    const result = readWorkflowStepCheckpoint(artifactRecord);
    assert.equal(result, null);
  } finally {
    cleanupDir(workspace);
  }
});

// summarizeWorkflowStepCheckpoint Tests

test("summarizeWorkflowStepCheckpoint extracts summary correctly", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness-summary",
    nodeRunId: null,
    planGraphBundleId: "bundle-summary",
    taskId: "task-summary",
    executionId: null,
    workflowId: "wf-summary",
    divisionId: "div-summary",
    stepId: "step-summary",
    roleId: "role-summary",
    outputKey: "output-summary",
    status: "succeeded",
    producedAt: "2026-04-29T00:00:00.000Z",
    output: { summary: "This is the step summary text" },
    decisionContext: {
      source: "model_response",
      request: "process task",
      routeReason: null,
      priorStepSummaries: [],
      dependsOnStepIds: [],
    },
    resumeContext: {
      completedStepIds: [],
      nextStepId: "step-2",
      outputKeys: ["output-summary"],
    },
  });

  const summary = summarizeWorkflowStepCheckpoint("artifact-summary-123", checkpoint);

  assert.equal(summary.artifactId, "artifact-summary-123");
  assert.equal(summary.stepId, "step-summary");
  assert.equal(summary.workflowId, "wf-summary");
  assert.equal(summary.status, "succeeded");
  assert.equal(summary.producedAt, "2026-04-29T00:00:00.000Z");
  assert.equal(summary.nextStepId, "step-2");
  assert.deepEqual(summary.outputKeys, ["output-summary"]);
  assert.equal(summary.summary, "This is the step summary text");
  assert.equal(summary.source, "model_response");
});

test("summarizeWorkflowStepCheckpoint returns null for missing summary in output", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness-no-summary",
    nodeRunId: null,
    planGraphBundleId: "bundle-no-summary",
    taskId: "task-no-summary",
    executionId: null,
    workflowId: "wf-no-summary",
    divisionId: "div-no-summary",
    stepId: "step-no-summary",
    roleId: "role-no-summary",
    outputKey: "output-no-summary",
    status: "succeeded",
    producedAt: "2026-04-29T00:00:00.000Z",
    output: { result: "success", data: 123 },
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

  const summary = summarizeWorkflowStepCheckpoint("artifact-no-summary", checkpoint);

  assert.equal(summary.summary, null);
});

test("summarizeWorkflowStepCheckpoint handles null nextStepId", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness-final",
    nodeRunId: null,
    planGraphBundleId: "bundle-final",
    taskId: "task-final",
    executionId: null,
    workflowId: "wf-final",
    divisionId: "div-final",
    stepId: "step-final",
    roleId: "role-final",
    outputKey: "output-final",
    status: "succeeded",
    producedAt: "2026-04-29T00:00:00.000Z",
    output: { summary: "Workflow complete" },
    decisionContext: {
      source: "final-step",
      request: "finish",
      routeReason: "complete",
      priorStepSummaries: ["step-1", "step-2"],
      dependsOnStepIds: ["step-2"],
    },
    resumeContext: {
      completedStepIds: ["step-1", "step-2", "step-final"],
      nextStepId: null,
      outputKeys: ["output-final"],
    },
  });

  const summary = summarizeWorkflowStepCheckpoint("artifact-final", checkpoint);

  assert.equal(summary.nextStepId, null);
  assert.deepEqual(summary.outputKeys, ["output-final"]);
});

test("summarizeWorkflowStepCheckpoint copies outputKeys to prevent mutation", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness-copy",
    nodeRunId: null,
    planGraphBundleId: "bundle-copy",
    taskId: "task-copy",
    executionId: null,
    workflowId: "wf-copy",
    divisionId: "div-copy",
    stepId: "step-copy",
    roleId: "role-copy",
    outputKey: "output-copy",
    status: "succeeded",
    producedAt: "2026-04-29T00:00:00.000Z",
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
      outputKeys: ["key1", "key2"],
    },
  });

  const summary = summarizeWorkflowStepCheckpoint("artifact-copy", checkpoint);

  // Mutate the returned array
  summary.outputKeys.push("key3");

  // Original should be unaffected
  assert.equal(checkpoint.resumeContext.outputKeys.length, 2);
});

test("summarizeWorkflowStepCheckpoint handles nested summary in output", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness-nested",
    nodeRunId: null,
    planGraphBundleId: "bundle-nested",
    taskId: "task-nested",
    executionId: null,
    workflowId: "wf-nested",
    divisionId: "div-nested",
    stepId: "step-nested",
    roleId: "role-nested",
    outputKey: "output-nested",
    status: "succeeded",
    producedAt: "2026-04-29T00:00:00.000Z",
    output: { data: { summary: "nested summary text" } },
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

  const summary = summarizeWorkflowStepCheckpoint("artifact-nested", checkpoint);

  // summary should be null since output.summary is not a direct property
  assert.equal(summary.summary, null);
});

test("summarizeWorkflowStepCheckpoint extracts string summary from output", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness-string-summary",
    nodeRunId: null,
    planGraphBundleId: "bundle-string-summary",
    taskId: "task-string-summary",
    executionId: null,
    workflowId: "wf-string-summary",
    divisionId: "div-string-summary",
    stepId: "step-string-summary",
    roleId: "role-string-summary",
    outputKey: "output-string-summary",
    status: "succeeded",
    producedAt: "2026-04-29T00:00:00.000Z",
    output: { summary: "Direct summary string" },
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

  const summary = summarizeWorkflowStepCheckpoint("artifact-string-summary", checkpoint);

  assert.equal(summary.summary, "Direct summary string");
});

test("summarizeWorkflowStepCheckpoint handles non-string summary in output", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness-number-summary",
    nodeRunId: null,
    planGraphBundleId: "bundle-number-summary",
    taskId: "task-number-summary",
    executionId: null,
    workflowId: "wf-number-summary",
    divisionId: "div-number-summary",
    stepId: "step-number-summary",
    roleId: "role-number-summary",
    outputKey: "output-number-summary",
    status: "succeeded",
    producedAt: "2026-04-29T00:00:00.000Z",
    output: { summary: 12345 },
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

  const summary = summarizeWorkflowStepCheckpoint("artifact-number-summary", checkpoint);

  // 12345 is not a string, so summary should be null
  assert.equal(summary.summary, null);
});
