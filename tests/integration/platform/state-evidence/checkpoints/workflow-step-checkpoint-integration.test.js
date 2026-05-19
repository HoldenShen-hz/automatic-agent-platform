/**
 * Integration tests for Workflow Step Checkpoint Functions
 *
 * Tests integration of createWorkflowStepCheckpoint, readWorkflowStepCheckpoint,
 * and summarizeWorkflowStepCheckpoint with file system and envelope operations.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  createCheckpointEnvelope,
  unpackCheckpointEnvelope,
} from "../../../../../src/platform/state-evidence/checkpoints/checkpoint-envelope.js";

import {
  createWorkflowStepCheckpoint,
  readWorkflowStepCheckpoint,
  summarizeWorkflowStepCheckpoint,
  WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION,
} from "../../../../../src/platform/state-evidence/checkpoints/workflow-step-checkpoint.js";

function createTempDir(prefix) {
  const path = mkdtempSync(join(tmpdir(), prefix));
  return path;
}

function cleanupDir(path) {
  try {
    rmSync(path, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

test("integration: createWorkflowStepCheckpoint with envelope roundtrip through file system", async () => {
  const workspace = createTempDir("aa-ws-integration-");
  try {
    const checkpoint = createWorkflowStepCheckpoint({
      harnessRunId: "harness-file-roundtrip",
      nodeRunId: "node-file-roundtrip",
      planGraphBundleId: "bundle-file-roundtrip",
      taskId: "task-file-roundtrip",
      executionId: "exec-file-roundtrip",
      workflowId: "wf-file-roundtrip",
      divisionId: "div-file-roundtrip",
      stepId: "step-file-roundtrip",
      roleId: "role-file-roundtrip",
      outputKey: "output-file-roundtrip",
      status: "succeeded",
      producedAt: "2026-04-29T00:00:00.000Z",
      output: { result: "success", data: { key: "value" } },
      decisionContext: {
        source: "integration_roundtrip",
        request: "test roundtrip",
        routeReason: "complete",
        priorStepSummaries: ["prior step"],
        dependsOnStepIds: ["step-prior"],
      },
      resumeContext: {
        completedStepIds: ["step-1", "step-2"],
        nextStepId: null,
        outputKeys: ["output-file-roundtrip"],
      },
      fileDiffSummary: {
        summary: "Integration roundtrip test",
        createdPaths: ["/integration/file.ts"],
        updatedPaths: [],
        deletedPaths: [],
      },
      upstreamArtifactRefs: [
        {
          artifactId: "upstream-artifact-roundtrip",
          kind: "source_code",
          uri: "file://src/artifact.ts",
          createdAt: "2026-04-29T00:00:00.000Z",
        },
      ],
      compensationModel: "idempotent_replay",
    });

    // Wrap in envelope
    const envelope = await createCheckpointEnvelope(checkpoint, WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION);

    // Write to file
    const storagePath = join(workspace, "checkpoint.json");
    mkdirSync(workspace, { recursive: true });
    writeFileSync(storagePath, JSON.stringify(envelope), "utf8");

    // Read from file
    const fileContent = JSON.parse(readFileSync(storagePath, "utf8"));
    const unpacked = await unpackCheckpointEnvelope(fileContent);

    // Verify
    assert.equal(unpacked.data.taskId, "task-file-roundtrip");
    assert.equal(unpacked.data.output.result, "success");
    assert.equal(unpacked.data.status, "succeeded");
  } finally {
    cleanupDir(workspace);
  }
});

test("integration: readWorkflowStepCheckpoint reads checkpoint with all fields", () => {
  const workspace = createTempDir("aa-read-integration-");
  try {
    const checkpoint = createWorkflowStepCheckpoint({
      harnessRunId: "harness-read-all",
      nodeRunId: "node-read-all",
      planGraphBundleId: "bundle-read-all",
      taskId: "task-read-all",
      executionId: "exec-read-all",
      workflowId: "wf-read-all",
      divisionId: "div-read-all",
      stepId: "step-read-all",
      roleId: "role-read-all",
      outputKey: "output-read-all",
      status: "succeeded",
      producedAt: "2026-04-29T00:00:00.000Z",
      output: { result: "read all success" },
      decisionContext: {
        source: "read_all_test",
        request: "read all fields",
        routeReason: "complete",
        priorStepSummaries: ["step-1", "step-2"],
        dependsOnStepIds: ["step-1"],
      },
      resumeContext: {
        completedStepIds: ["step-1", "step-2"],
        nextStepId: "step-3",
        outputKeys: ["out1", "out2"],
      },
      fileDiffSummary: {
        summary: "Read all test files",
        createdPaths: ["/new/read.ts"],
        updatedPaths: ["/existing/read.ts"],
        deletedPaths: [],
      },
      upstreamArtifactRefs: [
        {
          artifactId: "upstream-read-all",
          kind: "source_code",
          uri: "file://src/upstream.ts",
          createdAt: "2026-04-29T00:00:00.000Z",
        },
      ],
      compensationModel: "idempotent_replay",
    });

    const storagePath = join(workspace, "checkpoint.json");
    mkdirSync(workspace, { recursive: true });
    writeFileSync(storagePath, JSON.stringify(checkpoint), "utf8");

    const artifactRecord = {
      artifactId: "artifact-read-all",
      taskId: "task-read-all",
      executionId: "exec-read-all",
      stepId: "step-read-all",
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
    assert.equal(result.harnessRunId, "harness-read-all");
    assert.equal(result.nodeRunId, "node-read-all");
    assert.equal(result.planGraphBundleId, "bundle-read-all");
    assert.equal(result.taskId, "task-read-all");
    assert.equal(result.executionId, "exec-read-all");
    assert.equal(result.workflowId, "wf-read-all");
    assert.equal(result.status, "succeeded");
    assert.deepEqual(result.decisionContext.priorStepSummaries, ["step-1", "step-2"]);
    assert.deepEqual(result.resumeContext.completedStepIds, ["step-1", "step-2"]);
    assert.equal(result.resumeContext.nextStepId, "step-3");
    assert.deepEqual(result.fileDiffSummary.createdPaths, ["/new/read.ts"]);
    assert.equal(result.upstreamArtifactRefs.length, 1);
    assert.equal(result.compensationModel, "idempotent_replay");
  } finally {
    cleanupDir(workspace);
  }
});

test("integration: readWorkflowStepCheckpoint returns null for non-workflow_step_snapshot kind", () => {
  const artifactRecord = {
    artifactId: "artifact-wrong-kind",
    taskId: "task-wrong-kind",
    executionId: "exec-wrong-kind",
    stepId: "step-wrong-kind",
    kind: "source_code",
    storagePath: "/tmp/test.ts",
    fileName: "test.ts",
    mimeType: "text/typescript",
    sizeBytes: 100,
    checksum: null,
    lineageJson: null,
    createdAt: "2026-04-29T00:00:00.000Z",
  };

  const result = readWorkflowStepCheckpoint(artifactRecord);
  assert.equal(result, null);
});

test("integration: readWorkflowStepCheckpoint returns null for non-existent file", () => {
  const artifactRecord = {
    artifactId: "artifact-no-file",
    taskId: "task-no-file",
    executionId: "exec-no-file",
    stepId: "step-no-file",
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

test("integration: readWorkflowStepCheckpoint returns null for invalid JSON", () => {
  const workspace = createTempDir("aa-invalid-json-");
  const storagePath = join(workspace, "invalid.json");

  try {
    mkdirSync(workspace, { recursive: true });
    writeFileSync(storagePath, "not valid json {", "utf8");

    const artifactRecord = {
      artifactId: "artifact-invalid-json",
      taskId: "task-invalid-json",
      executionId: "exec-invalid-json",
      stepId: "step-invalid-json",
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

test("integration: summarizeWorkflowStepCheckpoint extracts summary correctly", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness-summarize-integration",
    nodeRunId: null,
    planGraphBundleId: "bundle-summarize-integration",
    taskId: "task-summarize-integration",
    executionId: "exec-summarize-integration",
    workflowId: "wf-summarize-integration",
    divisionId: "div-summarize-integration",
    stepId: "step-summarize-integration",
    roleId: "role-summarize-integration",
    outputKey: "output-summarize-integration",
    status: "succeeded",
    producedAt: "2026-04-29T00:00:00.000Z",
    output: { summary: "Integration test summary" },
    decisionContext: {
      source: "integration_summarize",
      request: "summarize integration",
      routeReason: null,
      priorStepSummaries: [],
      dependsOnStepIds: [],
    },
    resumeContext: {
      completedStepIds: ["step-1"],
      nextStepId: "step-2",
      outputKeys: ["output-summarize-integration"],
    },
  });

  const summary = summarizeWorkflowStepCheckpoint("artifact-summarize-integration", checkpoint);

  assert.equal(summary.artifactId, "artifact-summarize-integration");
  assert.equal(summary.stepId, "step-summarize-integration");
  assert.equal(summary.workflowId, "wf-summarize-integration");
  assert.equal(summary.status, "succeeded");
  assert.equal(summary.summary, "Integration test summary");
  assert.equal(summary.source, "integration_summarize");
});

test("integration: summarizeWorkflowStepCheckpoint returns null for missing summary", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness-no-summary-integration",
    nodeRunId: null,
    planGraphBundleId: "bundle-no-summary-integration",
    taskId: "task-no-summary-integration",
    executionId: "exec-no-summary-integration",
    workflowId: "wf-no-summary-integration",
    divisionId: "div-no-summary-integration",
    stepId: "step-no-summary-integration",
    roleId: "role-no-summary-integration",
    outputKey: "output-no-summary-integration",
    status: "succeeded",
    producedAt: "2026-04-29T00:00:00.000Z",
    output: { result: "no summary here" },
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

  const summary = summarizeWorkflowStepCheckpoint("artifact-no-summary-integration", checkpoint);

  assert.equal(summary.summary, null);
});

test("integration: createWorkflowStepCheckpoint handles failed status", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness-failed-integration",
    nodeRunId: null,
    planGraphBundleId: "bundle-failed-integration",
    taskId: "task-failed-integration",
    executionId: "exec-failed-integration",
    workflowId: "wf-failed-integration",
    divisionId: "div-failed-integration",
    stepId: "step-failed-integration",
    roleId: "role-failed-integration",
    outputKey: "output-failed-integration",
    status: "failed",
    producedAt: "2026-04-29T00:00:00.000Z",
    output: { error: "Integration test failure" },
    decisionContext: {
      source: "error_handler",
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
});

test("integration: createWorkflowStepCheckpoint handles skipped status", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness-skipped-integration",
    nodeRunId: null,
    planGraphBundleId: "bundle-skipped-integration",
    taskId: "task-skipped-integration",
    executionId: "exec-skipped-integration",
    workflowId: "wf-skipped-integration",
    divisionId: "div-skipped-integration",
    stepId: "step-skipped-integration",
    roleId: "role-skipped-integration",
    outputKey: "output-skipped-integration",
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

test("integration: createWorkflowStepCheckpoint with null nodeRunId for early stage", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness-null-node-integration",
    nodeRunId: null,
    planGraphBundleId: "bundle-null-node-integration",
    taskId: "task-null-node-integration",
    executionId: "exec-null-node-integration",
    workflowId: "wf-null-node-integration",
    divisionId: "div-null-node-integration",
    stepId: "step-null-node-integration",
    roleId: "role-null-node-integration",
    outputKey: "output-null-node-integration",
    status: "succeeded",
    producedAt: "2026-04-29T00:00:00.000Z",
    output: {},
    decisionContext: {
      source: "early_stage",
      request: "initial planning",
      routeReason: "first step",
      priorStepSummaries: [],
      dependsOnStepIds: [],
    },
    resumeContext: {
      completedStepIds: [],
      nextStepId: "step-1",
      outputKeys: [],
    },
  });

  assert.equal(checkpoint.nodeRunId, null);
});

test("integration: createWorkflowStepCheckpoint with null executionId for planning phase", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness-null-exec-integration",
    nodeRunId: "node-null-exec",
    planGraphBundleId: "bundle-null-exec-integration",
    taskId: "task-null-exec-integration",
    executionId: null,
    workflowId: "wf-null-exec-integration",
    divisionId: "div-null-exec-integration",
    stepId: "step-null-exec-integration",
    roleId: "role-null-exec-integration",
    outputKey: "output-null-exec-integration",
    status: "succeeded",
    producedAt: "2026-04-29T00:00:00.000Z",
    output: {},
    decisionContext: {
      source: "planner",
      request: "planning phase",
      routeReason: "no execution yet",
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
});

test("integration: checkpoint with file diff summary for integration test", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness-file-diff-integration",
    nodeRunId: null,
    planGraphBundleId: "bundle-file-diff-integration",
    taskId: "task-file-diff-integration",
    executionId: null,
    workflowId: "wf-file-diff-integration",
    divisionId: "div-file-diff-integration",
    stepId: "step-file-diff-integration",
    roleId: "role-file-diff-integration",
    outputKey: "output-file-diff-integration",
    status: "succeeded",
    producedAt: "2026-04-29T00:00:00.000Z",
    output: { files: "changed" },
    decisionContext: {
      source: "file_diff_test",
      request: "file diff test",
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
      summary: "Integration file diff summary",
      createdPaths: ["/integration/new-a.ts", "/integration/new-b.ts"],
      updatedPaths: ["/integration/existing.ts"],
      deletedPaths: ["/integration/deleted.ts"],
    },
  });

  assert.equal(checkpoint.fileDiffSummary.summary, "Integration file diff summary");
  assert.deepEqual(checkpoint.fileDiffSummary.createdPaths, ["/integration/new-a.ts", "/integration/new-b.ts"]);
  assert.deepEqual(checkpoint.fileDiffSummary.updatedPaths, ["/integration/existing.ts"]);
  assert.deepEqual(checkpoint.fileDiffSummary.deletedPaths, ["/integration/deleted.ts"]);
});

test("integration: checkpoint with partial fileDiffSummary for integration test", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness-partial-file-diff-integration",
    nodeRunId: null,
    planGraphBundleId: "bundle-partial-file-diff-integration",
    taskId: "task-partial-file-diff-integration",
    executionId: null,
    workflowId: "wf-partial-file-diff-integration",
    divisionId: "div-partial-file-diff-integration",
    stepId: "step-partial-file-diff-integration",
    roleId: "role-partial-file-diff-integration",
    outputKey: "output-partial-file-diff-integration",
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
      createdPaths: ["/new/only/created.ts"],
    },
  });

  assert.deepEqual(checkpoint.fileDiffSummary.createdPaths, ["/new/only/created.ts"]);
  assert.deepEqual(checkpoint.fileDiffSummary.updatedPaths, []);
  assert.deepEqual(checkpoint.fileDiffSummary.deletedPaths, []);
  assert.equal(checkpoint.fileDiffSummary.summary, null);
});

test("integration: readWorkflowStepCheckpoint through envelope-wrapped checkpoint", async () => {
  const workspace = createTempDir("aa-envelope-read-");
  try {
    const checkpoint = createWorkflowStepCheckpoint({
      harnessRunId: "harness-envelope-read",
      nodeRunId: null,
      planGraphBundleId: "bundle-envelope-read",
      taskId: "task-envelope-read",
      executionId: null,
      workflowId: "wf-envelope-read",
      divisionId: "div-envelope-read",
      stepId: "step-envelope-read",
      roleId: "role-envelope-read",
      outputKey: "output-envelope-read",
      status: "succeeded",
      producedAt: "2026-04-29T00:00:00.000Z",
      output: { envelope: "read success" },
      decisionContext: {
        source: "envelope_read_test",
        request: "envelope read test",
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

    // Wrap in envelope
    const envelope = await createCheckpointEnvelope(checkpoint, WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION);

    // Write to file
    const storagePath = join(workspace, "checkpoint.json");
    mkdirSync(workspace, { recursive: true });
    writeFileSync(storagePath, JSON.stringify(envelope), "utf8");

    // Create artifact record pointing to the file
    const artifactRecord = {
      artifactId: "artifact-envelope-read",
      taskId: "task-envelope-read",
      executionId: null,
      stepId: "step-envelope-read",
      kind: "workflow_step_snapshot",
      storagePath,
      fileName: "checkpoint.json",
      mimeType: "application/json",
      sizeBytes: envelope.metadata.compressedSizeBytes,
      checksum: envelope.metadata.checksum,
      lineageJson: null,
      createdAt: checkpoint.producedAt,
    };

    // Note: readWorkflowStepCheckpoint reads raw checkpoint, not envelope-wrapped
    // So we need to unpack first
    const fileContent = JSON.parse(readFileSync(storagePath, "utf8"));
    const unpacked = await unpackCheckpointEnvelope(fileContent);

    assert.equal(unpacked.data.taskId, "task-envelope-read");
    assert.equal(unpacked.data.output.envelope, "read success");
  } finally {
    cleanupDir(workspace);
  }
});

test("integration: multiple checkpoints for same workflow", async () => {
  const workspace = createTempDir("aa-multi-checkpoint-");
  try {
    const checkpoints = [];

    for (let i = 1; i <= 3; i++) {
      const checkpoint = createWorkflowStepCheckpoint({
        harnessRunId: `harness-multi-${i}`,
        nodeRunId: null,
        planGraphBundleId: "bundle-multi",
        taskId: "task-multi",
        executionId: null,
        workflowId: "wf-multi",
        divisionId: "div-multi",
        stepId: `step-multi-${i}`,
        roleId: "role-multi",
        outputKey: `output-multi-${i}`,
        status: "succeeded",
        producedAt: new Date(Date.now() + i * 1000).toISOString(),
        output: { step: i },
        decisionContext: {
          source: "multi_test",
          request: `step ${i}`,
          routeReason: null,
          priorStepSummaries: i > 1 ? [`step-multi-${i - 1} completed`] : [],
          dependsOnStepIds: i > 1 ? [`step-multi-${i - 1}`] : [],
        },
        resumeContext: {
          completedStepIds: [`step-multi-${i}`],
          nextStepId: i < 3 ? `step-multi-${i + 1}` : null,
          outputKeys: [`output-multi-${i}`],
        },
      });
      checkpoints.push(checkpoint);
    }

    // Save all checkpoints
    const storagePath = join(workspace, "checkpoints.json");
    mkdirSync(workspace, { recursive: true });
    writeFileSync(storagePath, JSON.stringify(checkpoints), "utf8");

    // Read back
    const fileContent = JSON.parse(readFileSync(storagePath, "utf8"));

    assert.equal(fileContent.length, 3);
    assert.equal(fileContent[0].stepId, "step-multi-1");
    assert.equal(fileContent[1].stepId, "step-multi-2");
    assert.equal(fileContent[2].stepId, "step-multi-3");
  } finally {
    cleanupDir(workspace);
  }
});
