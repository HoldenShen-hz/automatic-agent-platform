/**
 * Integration tests for CheckpointManager
 *
 * Tests integration between CheckpointManager and real checkpoint
 * operations with the envelope and storage systems.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  createCheckpointEnvelope,
  unpackCheckpointEnvelope,
  wrapWorkflowStepCheckpoint,
  unwrapWorkflowStepCheckpoint,
  getEnvelopeOriginalSize,
  getEnvelopeCompressedSize,
  getEnvelopeCompressionRatio,
  CHECKPOINT_ENVELOPE_SCHEMA_VERSION,
  DEFAULT_MAX_CHECKPOINT_SIZE_BYTES,
  CheckpointSizeExceededError,
  CheckpointEnvelopeInvalidError,
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

// Integration tests for checkpoint envelope with real workflow step checkpoints

test("integration: wrapWorkflowStepCheckpoint and unwrapWorkflowStepCheckpoint roundtrip", async () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness-integration-roundtrip",
    nodeRunId: "node-run-integration",
    planGraphBundleId: "bundle-integration",
    taskId: "task-integration-roundtrip",
    executionId: "exec-integration-roundtrip",
    workflowId: "wf-integration-roundtrip",
    divisionId: "div-integration",
    stepId: "step-integration",
    roleId: "role-integration",
    outputKey: "output-integration",
    status: "succeeded",
    producedAt: "2026-04-29T00:00:00.000Z",
    output: { result: "success", data: [1, 2, 3] },
    decisionContext: {
      source: "integration_test",
      request: "testing wrap/unwrap cycle",
      routeReason: "complete",
      priorStepSummaries: ["prior step"],
      dependsOnStepIds: ["step-prior"],
    },
    resumeContext: {
      completedStepIds: ["step-1", "step-2"],
      nextStepId: null,
      outputKeys: ["output-integration"],
    },
    fileDiffSummary: {
      summary: "Integration test checkpoint",
      createdPaths: ["/integration/file.ts"],
      updatedPaths: [],
      deletedPaths: [],
    },
    upstreamArtifactRefs: [
      {
        artifactId: "upstream-artifact-integration",
        kind: "source_code",
        uri: "file://src/artifact.ts",
        createdAt: "2026-04-29T00:00:00.000Z",
      },
    ],
    compensationModel: "idempotent_replay",
  });

  const envelope = await wrapWorkflowStepCheckpoint(checkpoint);
  assert.equal(envelope.schema, WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION);
  assert.equal(envelope.version, CHECKPOINT_ENVELOPE_SCHEMA_VERSION);

  const unpacked = await unwrapWorkflowStepCheckpoint(envelope);
  assert.equal(unpacked.data.taskId, "task-integration-roundtrip");
  assert.equal(unpacked.data.output.result, "success");
  assert.deepEqual(unpacked.data.output.data, [1, 2, 3]);
  assert.equal(unpacked.data.status, "succeeded");
});

test("integration: createCheckpointEnvelope and unpackCheckpointEnvelope with workflow checkpoint", async () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness-envelope-test",
    nodeRunId: null,
    planGraphBundleId: "bundle-envelope-test",
    taskId: "task-envelope-test",
    executionId: "exec-envelope-test",
    workflowId: "wf-envelope-test",
    divisionId: "div-envelope-test",
    stepId: "step-envelope-test",
    roleId: "role-envelope-test",
    outputKey: "output-envelope-test",
    status: "succeeded",
    producedAt: "2026-04-29T00:00:00.000Z",
    output: { envelope: "test" },
    decisionContext: {
      source: "envelope_test",
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

  const envelope = await createCheckpointEnvelope(checkpoint, WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION);
  assert.ok(envelope.metadata.originalSizeBytes > 0);
  assert.ok(envelope.metadata.compressedSizeBytes > 0);
  assert.ok(envelope.metadata.checksum.length > 0);
  assert.equal(envelope.metadata.algorithm, "gzip");

  const unpacked = await unpackCheckpointEnvelope(envelope);
  assert.equal(unpacked.data.taskId, "task-envelope-test");
  assert.equal(unpacked.wasCompressed, true);
});

test("integration: checkpoint envelope size limits enforced", async () => {
  const smallData = { content: "small checkpoint" };
  const envelope = await createCheckpointEnvelope(smallData, "test.v1");
  assert.ok(envelope.metadata.originalSizeBytes <= DEFAULT_MAX_CHECKPOINT_SIZE_BYTES);
});

test("integration: checkpoint envelope rejects oversized data", async () => {
  const largeData = { content: "x".repeat(DEFAULT_MAX_CHECKPOINT_SIZE_BYTES + 1) };

  await assert.rejects(
    () => createCheckpointEnvelope(largeData, "test.v1"),
    CheckpointSizeExceededError,
  );
});

test("integration: checkpoint envelope with custom maxSizeBytes", async () => {
  const data = { content: "test content" };
  const customMax = 5;

  await assert.rejects(
    () => createCheckpointEnvelope(data, "test.v1", { maxSizeBytes: customMax }),
    CheckpointSizeExceededError,
  );
});

test("integration: checkpoint envelope validates structure on unpack", async () => {
  const invalidEnvelope = {
    version: "invalid_version",
    schema: "test.v1",
    payload: "abc123",
    metadata: {
      originalSizeBytes: 100,
      compressedSizeBytes: 100,
      checksum: "abc123",
      createdAt: "2026-04-29T00:00:00.000Z",
      algorithm: "gzip",
      payloadSchemaVersion: "test.v1",
    },
  };

  await assert.rejects(
    () => unpackCheckpointEnvelope(invalidEnvelope),
    CheckpointEnvelopeInvalidError,
  );
});

test("integration: checkpoint envelope preserves complex nested data", async () => {
  const complexData = {
    level1: {
      level2: {
        level3: {
          array: [1, 2, 3],
          object: { key: "value" },
        },
      },
    },
    dates: ["2026-04-29T00:00:00.000Z"],
    nullValue: null,
    boolean: true,
  };

  const envelope = await createCheckpointEnvelope(complexData, "complex.v1");
  const unpacked = await unpackCheckpointEnvelope(envelope);

  assert.deepEqual(unpacked.data, complexData);
});

test("integration: checkpoint envelope handles empty objects", async () => {
  const emptyData = {};

  const envelope = await createCheckpointEnvelope(emptyData, "empty.v1");
  const unpacked = await unpackCheckpointEnvelope(envelope);

  assert.deepEqual(unpacked.data, {});
});

test("integration: checkpoint envelope handles unicode content", async () => {
  const unicodeData = {
    chinese: "中文测试",
    japanese: "日本語",
    emoji: "😀🎉",
    arabic: "مرحبا",
  };

  const envelope = await createCheckpointEnvelope(unicodeData, "unicode.v1");
  const unpacked = await unpackCheckpointEnvelope(envelope);

  assert.deepEqual(unpacked.data, unicodeData);
});

test("integration: getEnvelopeOriginalSize returns correct size", async () => {
  const data = { test: "data", numbers: [1, 2, 3] };

  const envelope = await createCheckpointEnvelope(data, "test.v1");
  const size = getEnvelopeOriginalSize(envelope);

  assert.equal(size, envelope.metadata.originalSizeBytes);
});

test("integration: getEnvelopeCompressedSize returns correct size", async () => {
  const data = { test: "data" };

  const envelope = await createCheckpointEnvelope(data, "test.v1");
  const size = getEnvelopeCompressedSize(envelope);

  assert.equal(size, envelope.metadata.compressedSizeBytes);
});

test("integration: getEnvelopeCompressionRatio calculates correct ratio", async () => {
  const data = { content: "x".repeat(1000) };

  const envelope = await createCheckpointEnvelope(data, "test.v1");
  const ratio = getEnvelopeCompressionRatio(envelope);

  assert.ok(ratio > 0);
  assert.ok(ratio <= 1);
});

test("integration: getEnvelopeCompressionRatio handles zero original size", async () => {
  const envelope = {
    version: CHECKPOINT_ENVELOPE_SCHEMA_VERSION,
    schema: "test.v1",
    payload: "",
    metadata: {
      originalSizeBytes: 0,
      compressedSizeBytes: 0,
      checksum: "abc123",
      createdAt: "2026-04-29T00:00:00.000Z",
      algorithm: "gzip",
      payloadSchemaVersion: "test.v1",
    },
  };

  const ratio = getEnvelopeCompressionRatio(envelope);
  assert.equal(ratio, 1);
});

test("integration: multiple wrap/unwrap cycles produce same result", async () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness-cycle-test",
    nodeRunId: null,
    planGraphBundleId: "bundle-cycle",
    taskId: "task-cycle",
    executionId: "exec-cycle",
    workflowId: "wf-cycle",
    divisionId: "div-cycle",
    stepId: "step-cycle",
    roleId: "role-cycle",
    outputKey: "output-cycle",
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

  const envelope1 = await wrapWorkflowStepCheckpoint(checkpoint);
  const unpacked1 = await unwrapWorkflowStepCheckpoint(envelope1);

  const envelope2 = await wrapWorkflowStepCheckpoint(unpacked1.data);
  const unpacked2 = await unwrapWorkflowStepCheckpoint(envelope2);

  assert.equal(unpacked1.data.taskId, unpacked2.data.taskId);
  assert.equal(unpacked1.data.status, unpacked2.data.status);
});

test("integration: readWorkflowStepCheckpoint with real file system", () => {
  const workspace = createTempDir("aa-integration-checkpoint-read-");
  const storagePath = join(workspace, "checkpoint.json");

  try {
    const checkpoint = createWorkflowStepCheckpoint({
      harnessRunId: "harness-file-read",
      nodeRunId: "node-file-read",
      planGraphBundleId: "bundle-file-read",
      taskId: "task-file-read",
      executionId: "exec-file-read",
      workflowId: "wf-file-read",
      divisionId: "div-file-read",
      stepId: "step-file-read",
      roleId: "role-file-read",
      outputKey: "output-file-read",
      status: "succeeded",
      producedAt: "2026-04-29T00:00:00.000Z",
      output: { result: "file read success" },
      decisionContext: {
        source: "file_read_test",
        request: "read from file",
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

    mkdirSync(workspace, { recursive: true });
    writeFileSync(storagePath, JSON.stringify(checkpoint), "utf8");

    const artifactRecord = {
      artifactId: "artifact-file-read",
      taskId: "task-file-read",
      executionId: "exec-file-read",
      stepId: "step-file-read",
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
    assert.equal(result.taskId, "task-file-read");
    assert.equal(result.status, "succeeded");
  } finally {
    cleanupDir(workspace);
  }
});

test("integration: summarizeWorkflowStepCheckpoint with real checkpoint", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness-summary-integration",
    nodeRunId: null,
    planGraphBundleId: "bundle-summary-integration",
    taskId: "task-summary-integration",
    executionId: "exec-summary-integration",
    workflowId: "wf-summary-integration",
    divisionId: "div-summary-integration",
    stepId: "step-summary-integration",
    roleId: "role-summary-integration",
    outputKey: "output-summary-integration",
    status: "succeeded",
    producedAt: "2026-04-29T00:00:00.000Z",
    output: { summary: "Integration test summary" },
    decisionContext: {
      source: "integration_summary_test",
      request: "summarize checkpoint",
      routeReason: "testing",
      priorStepSummaries: [],
      dependsOnStepIds: [],
    },
    resumeContext: {
      completedStepIds: [],
      nextStepId: "step-2",
      outputKeys: ["output-summary-integration"],
    },
  });

  const summary = summarizeWorkflowStepCheckpoint("artifact-summary-integration", checkpoint);

  assert.equal(summary.artifactId, "artifact-summary-integration");
  assert.equal(summary.stepId, "step-summary-integration");
  assert.equal(summary.workflowId, "wf-summary-integration");
  assert.equal(summary.status, "succeeded");
  assert.equal(summary.summary, "Integration test summary");
  assert.equal(summary.source, "integration_summary_test");
});

test("integration: checkpoint creation with all R4-18 required fields", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness-r4-18",
    nodeRunId: "node-r4-18",
    planGraphBundleId: "bundle-r4-18",
    taskId: "task-r4-18",
    executionId: "exec-r4-18",
    workflowId: "wf-r4-18",
    divisionId: "div-r4-18",
    stepId: "step-r4-18",
    roleId: "role-r4-18",
    outputKey: "output-r4-18",
    status: "succeeded",
    producedAt: "2026-04-29T00:00:00.000Z",
    output: { r4_18: "test" },
    decisionContext: {
      source: "r4_18_test",
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

  // Verify all R4-18 canonical ID fields are present
  assert.equal(checkpoint.taskId, "task-r4-18");
  assert.equal(checkpoint.executionId, "exec-r4-18");
  assert.equal(checkpoint.nodeRunId, "node-r4-18");
  assert.equal(checkpoint.planGraphBundleId, "bundle-r4-18");
  assert.equal(checkpoint.harnessRunId, "harness-r4-18");
});

test("integration: envelope checksum verification detects corruption", async () => {
  const data = { test: "data" };
  const envelope = await createCheckpointEnvelope(data, "test.v1");

  // Corrupt the payload
  envelope.payload = Buffer.from("corrupted data").toString("base64");

  await assert.rejects(
    () => unpackCheckpointEnvelope(envelope),
    CheckpointEnvelopeInvalidError,
  );
});
