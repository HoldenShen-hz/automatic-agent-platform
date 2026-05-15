/**
 * Unit tests for checkpoints module index
 *
 * Tests re-exports and module interface for checkpoints package.
 */

import assert from "node:assert/strict";
import test from "node:test";

// Test re-exports from index.ts
import {
  CHECKPOINT_ENVELOPE_SCHEMA_VERSION,
  DEFAULT_MAX_CHECKPOINT_SIZE_BYTES,
  type CompressionAlgorithm,
  type CheckpointEnvelopeMetadata,
  type CheckpointEnvelope,
  type CreateCheckpointEnvelopeOptions,
  type UnpackedCheckpointEnvelope,
  createCheckpointEnvelope,
  unpackCheckpointEnvelope,
  wrapWorkflowStepCheckpoint,
  unwrapWorkflowStepCheckpoint,
  getEnvelopeOriginalSize,
  getEnvelopeCompressedSize,
  getEnvelopeCompressionRatio,
  CheckpointSizeExceededError,
  CheckpointEnvelopeInvalidError,
  WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION,
  type WorkflowStepCheckpointDecisionContext,
  type WorkflowStepCheckpointResumeContext,
  type WorkflowStepCheckpointFileDiffSummary,
  type WorkflowStepCheckpoint,
  type CreateWorkflowStepCheckpointInput,
  type WorkflowStepCheckpointSummary,
  createWorkflowStepCheckpoint,
  readWorkflowStepCheckpoint,
  summarizeWorkflowStepCheckpoint,
} from "../../../../../src/platform/five-plane-state-evidence/checkpoints/index.js";

test("CHECKPOINT_ENVELOPE_SCHEMA_VERSION is correct", () => {
  assert.equal(CHECKPOINT_ENVELOPE_SCHEMA_VERSION, "checkpoint_envelope.v1");
});

test("DEFAULT_MAX_CHECKPOINT_SIZE_BYTES is 10MB", () => {
  assert.equal(DEFAULT_MAX_CHECKPOINT_SIZE_BYTES, 10 * 1024 * 1024);
});

test("CompressionAlgorithm type exists", () => {
  const algo: CompressionAlgorithm = "gzip";
  assert.equal(algo, "gzip");
});

test("CheckpointEnvelopeMetadata type structure", () => {
  const metadata: CheckpointEnvelopeMetadata = {
    originalSizeBytes: 1024,
    compressedSizeBytes: 512,
    checksum: "abc123",
    createdAt: "2026-04-26T10:00:00.000Z",
    algorithm: "gzip",
    payloadSchemaVersion: "v1",
  };

  assert.equal(metadata.originalSizeBytes, 1024);
  assert.equal(metadata.compressedSizeBytes, 512);
  assert.equal(metadata.algorithm, "gzip");
});

test("CheckpointEnvelope type structure", () => {
  const envelope: CheckpointEnvelope = {
    version: CHECKPOINT_ENVELOPE_SCHEMA_VERSION,
    schema: "test.v1",
    payload: "SGVsbG8=", // base64 encoded "Hello"
    metadata: {
      originalSizeBytes: 5,
      compressedSizeBytes: 5,
      checksum: "abc123",
      createdAt: "2026-04-26T10:00:00.000Z",
      algorithm: "gzip",
      payloadSchemaVersion: "test.v1",
    },
  };

  assert.equal(envelope.version, "checkpoint_envelope.v1");
  assert.equal(envelope.schema, "test.v1");
  assert.equal(envelope.payload, "SGVsbG8=");
});

test("CreateCheckpointEnvelopeOptions type", () => {
  const options: CreateCheckpointEnvelopeOptions = {
    maxSizeBytes: 1024 * 1024,
    payloadSchemaVersion: "custom.v1",
  };

  assert.equal(options.maxSizeBytes, 1024 * 1024);
  assert.equal(options.payloadSchemaVersion, "custom.v1");
});

test("UnpackedCheckpointEnvelope type structure", () => {
  const unpacked: UnpackedCheckpointEnvelope<string> = {
    data: "test data",
    metadata: {
      originalSizeBytes: 9,
      compressedSizeBytes: 9,
      checksum: "def456",
      createdAt: "2026-04-26T10:00:00.000Z",
      algorithm: "gzip",
      payloadSchemaVersion: "v1",
    },
    wasCompressed: true,
  };

  assert.equal(unpacked.data, "test data");
  assert.equal(unpacked.wasCompressed, true);
});

test("WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION is correct", () => {
  assert.equal(WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION, "workflow_step_checkpoint.v1");
});

test("WorkflowStepCheckpointDecisionContext type structure", () => {
  const ctx: WorkflowStepCheckpointDecisionContext = {
    source: "model_response",
    request: "Process task",
    routeReason: "Step completed",
    priorStepSummaries: ["Step 1 done", "Step 2 done"],
    dependsOnStepIds: ["step-1", "step-2"],
  };

  assert.equal(ctx.source, "model_response");
  assert.deepEqual(ctx.priorStepSummaries, ["Step 1 done", "Step 2 done"]);
});

test("WorkflowStepCheckpointResumeContext type structure", () => {
  const ctx: WorkflowStepCheckpointResumeContext = {
    completedStepIds: ["step-1", "step-2"],
    nextStepId: "step-3",
    outputKeys: ["output-1", "output-2"],
  };

  assert.deepEqual(ctx.completedStepIds, ["step-1", "step-2"]);
  assert.equal(ctx.nextStepId, "step-3");
});

test("WorkflowStepCheckpointFileDiffSummary type structure", () => {
  const summary: WorkflowStepCheckpointFileDiffSummary = {
    summary: "Updated 3 files",
    createdPaths: ["/src/new.ts"],
    updatedPaths: ["/src/existing.ts"],
    deletedPaths: ["/src/old.ts"],
  };

  assert.equal(summary.summary, "Updated 3 files");
  assert.deepEqual(summary.createdPaths, ["/src/new.ts"]);
});

test("WorkflowStepCheckpoint type structure", () => {
  const checkpoint: WorkflowStepCheckpoint = {
    schemaVersion: WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION,
    taskId: "task-123",
    executionId: "exec-456",
    workflowId: "wf-789",
    divisionId: "div-abc",
    stepId: "step-1",
    roleId: "agent",
    outputKey: "step1_output",
    status: "succeeded",
    producedAt: "2026-04-26T10:00:00.000Z",
    output: { result: "success" },
    decisionContext: {
      source: "model",
      request: "test",
      routeReason: null,
      priorStepSummaries: [],
      dependsOnStepIds: [],
    },
    resumeContext: {
      completedStepIds: ["step-0"],
      nextStepId: "step-2",
      outputKeys: ["output1"],
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

  assert.equal(checkpoint.taskId, "task-123");
  assert.equal(checkpoint.status, "succeeded");
  assert.ok(checkpoint.compensationModel === null);
});

test("CreateWorkflowStepCheckpointInput type structure", () => {
  const input: CreateWorkflowStepCheckpointInput = {
    taskId: "task-abc",
    executionId: null,
    workflowId: "wf-xyz",
    divisionId: "div-123",
    stepId: "step-1",
    roleId: "executor",
    outputKey: "result",
    status: "completed",
    producedAt: "2026-04-26T10:00:00.000Z",
    output: { success: true },
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
    upstreamArtifactRefs: [],
    fileDiffSummary: { summary: null, createdPaths: [], updatedPaths: [], deletedPaths: [] },
    compensationModel: null,
  };

  assert.equal(input.taskId, "task-abc");
  assert.equal(input.executionId, null);
});

test("WorkflowStepCheckpointSummary type structure", () => {
  const summary: WorkflowStepCheckpointSummary = {
    artifactId: "artifact-123",
    stepId: "step-1",
    workflowId: "wf-456",
    status: "succeeded",
    producedAt: "2026-04-26T10:00:00.000Z",
    nextStepId: "step-2",
    outputKeys: ["output1", "output2"],
    summary: "Step completed successfully",
    source: "agent",
  };

  assert.equal(summary.artifactId, "artifact-123");
  assert.equal(summary.nextStepId, "step-2");
  assert.deepEqual(summary.outputKeys, ["output1", "output2"]);
});

test("createCheckpointEnvelope creates valid envelope", async () => {
  const envelope = await createCheckpointEnvelope({ test: "data" }, "test.v1");

  assert.equal(envelope.version, "checkpoint_envelope.v1");
  assert.equal(envelope.schema, "test.v1");
  assert.ok(typeof envelope.payload === "string");
  assert.ok(envelope.metadata.originalSizeBytes > 0);
});

test("unpackCheckpointEnvelope roundtrip works", async () => {
  const originalData = { key: "value", nested: { num: 123 } };
  const envelope = await createCheckpointEnvelope(originalData, "roundtrip.v1");
  const unpacked = await unpackCheckpointEnvelope<typeof originalData>(envelope);

  assert.deepEqual(unpacked.data, originalData);
  assert.equal(unpacked.wasCompressed, true);
});

test("getEnvelopeOriginalSize returns metadata size", async () => {
  const envelope = await createCheckpointEnvelope({ size: "test" }, "v1");
  assert.equal(getEnvelopeOriginalSize(envelope), envelope.metadata.originalSizeBytes);
});

test("getEnvelopeCompressedSize returns compressed size", async () => {
  const envelope = await createCheckpointEnvelope({ size: "test" }, "v1");
  assert.equal(getEnvelopeCompressedSize(envelope), envelope.metadata.compressedSizeBytes);
});

test("getEnvelopeCompressionRatio calculates correct ratio", async () => {
  const envelope = await createCheckpointEnvelope({ ratio: "test" }, "v1");
  const ratio = getEnvelopeCompressionRatio(envelope);
  assert.ok(ratio > 0 && ratio <= 1);
});

test("CheckpointSizeExceededError can be constructed", () => {
  const error = new CheckpointSizeExceededError(100, 50);

  assert.equal(error.name, "CheckpointSizeExceededError");
  assert.equal(error.originalSizeBytes, 100);
  assert.equal(error.maxSizeBytes, 50);
  assert.equal(error.code, "checkpoint.size_exceeded");
});

test("CheckpointEnvelopeInvalidError can be constructed", () => {
  const error = new CheckpointEnvelopeInvalidError("Invalid checksum");

  assert.equal(error.name, "CheckpointEnvelopeInvalidError");
  assert.ok(error.message.includes("Invalid checksum"));
  assert.equal(error.code, "checkpoint.envelope_invalid");
});

test("readWorkflowStepCheckpoint returns null for non-checkpoint artifact", () => {
  const artifact: ArtifactRecord = {
    id: "artifact-123",
    kind: "other_kind",
    uri: "file:///test",
    storagePath: "/nonexistent/path.json",
    sizeBytes: 100,
    checksum: "abc",
    createdAt: "2026-04-26T10:00:00.000Z",
    metadata: {},
  };

  // readWorkflowStepCheckpoint returns null for non-workflow_step_snapshot kind
  const result = readWorkflowStepCheckpoint(artifact);
  assert.equal(result, null);
});

test("summarizeWorkflowStepCheckpoint extracts summary correctly", () => {
  const checkpoint: WorkflowStepCheckpoint = {
    schemaVersion: WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION,
    taskId: "task-123",
    executionId: "exec-456",
    workflowId: "wf-789",
    divisionId: "div-abc",
    stepId: "step-1",
    roleId: "agent",
    outputKey: "output_key",
    status: "succeeded",
    producedAt: "2026-04-26T10:00:00.000Z",
    output: { summary: "This is the step summary text" },
    decisionContext: {
      source: "model",
      request: "test",
      routeReason: null,
      priorStepSummaries: [],
      dependsOnStepIds: [],
    },
    resumeContext: {
      completedStepIds: ["step-0"],
      nextStepId: "step-2",
      outputKeys: ["output_key"],
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

  const summary = summarizeWorkflowStepCheckpoint("artifact-xyz", checkpoint);

  assert.equal(summary.artifactId, "artifact-xyz");
  assert.equal(summary.stepId, "step-1");
  assert.equal(summary.workflowId, "wf-789");
  assert.equal(summary.status, "succeeded");
  assert.equal(summary.nextStepId, "step-2");
  assert.deepEqual(summary.outputKeys, ["output_key"]);
  assert.equal(summary.summary, "This is the step summary text");
  assert.equal(summary.source, "model");
});

test("summarizeWorkflowStepCheckpoint handles missing summary in output", () => {
  const checkpoint: WorkflowStepCheckpoint = {
    schemaVersion: WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION,
    taskId: "task-123",
    executionId: null,
    workflowId: "wf-abc",
    divisionId: "div-xyz",
    stepId: "step-2",
    roleId: "executor",
    outputKey: "result_key",
    status: "failed",
    producedAt: "2026-04-26T11:00:00.000Z",
    output: { data: "some result" }, // No summary field
    decisionContext: {
      source: "test",
      request: "test request",
      routeReason: null,
      priorStepSummaries: [],
      dependsOnStepIds: [],
    },
    resumeContext: {
      completedStepIds: ["step-1"],
      nextStepId: null,
      outputKeys: ["result_key"],
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

  const summary = summarizeWorkflowStepCheckpoint("artifact-999", checkpoint);

  // Summary should be null when output doesn't have summary field
  assert.equal(summary.summary, null);
  assert.equal(summary.nextStepId, null);
});

test("wrapWorkflowStepCheckpoint and unwrapWorkflowStepCheckpoint roundtrip", async () => {
  const checkpoint: WorkflowStepCheckpoint = {
    schemaVersion: WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION,
    taskId: "task-wrap",
    executionId: "exec-wrap",
    workflowId: "wf-wrap",
    divisionId: "div-wrap",
    stepId: "step-wrap",
    roleId: "agent",
    outputKey: "wrap_output",
    status: "succeeded",
    producedAt: "2026-04-26T10:00:00.000Z",
    output: { wrapped: true, data: [1, 2, 3] },
    decisionContext: {
      source: "wrap_test",
      request: "testing wrap/unwrap",
      routeReason: "complete",
      priorStepSummaries: ["prior step"],
      dependsOnStepIds: ["step-prior"],
    },
    resumeContext: {
      completedStepIds: ["step-1", "step-2"],
      nextStepId: null,
      outputKeys: ["wrap_output"],
    },
    fileDiffSummary: {
      summary: "Wrapped checkpoint",
      createdPaths: ["/wrapped/file.ts"],
      updatedPaths: [],
      deletedPaths: [],
    },
    upstreamArtifactRefs: [],
    compensationModel: null,
  };

  const envelope = await wrapWorkflowStepCheckpoint(checkpoint);
  assert.equal(envelope.schema, WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION);

  const unpacked = await unwrapWorkflowStepCheckpoint(envelope);
  assert.deepEqual(unpacked.data.taskId, "task-wrap");
  assert.deepEqual(unpacked.data.output.wrapped, true);
});