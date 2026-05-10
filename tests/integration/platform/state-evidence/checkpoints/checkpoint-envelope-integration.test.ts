import assert from "node:assert/strict";
import test from "node:test";

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
  CheckpointEnvelope,
} from "../../../../../src/platform/state-evidence/checkpoints/checkpoint-envelope.js";
import { createWorkflowStepCheckpoint } from "../../../../../src/platform/state-evidence/checkpoints/workflow-step-checkpoint.js";

test("createCheckpointEnvelope creates valid envelope with gzip compression", async () => {
  const data = { message: "test checkpoint data", values: [1, 2, 3] };

  const envelope = await createCheckpointEnvelope(data, "test.v1");

  assert.equal(envelope.version, CHECKPOINT_ENVELOPE_SCHEMA_VERSION);
  assert.equal(envelope.schema, "test.v1");
  assert.ok(typeof envelope.payload === "string");
  assert.equal(envelope.metadata.algorithm, "gzip");
  assert.ok(envelope.metadata.originalSizeBytes > 0);
  assert.ok(envelope.metadata.compressedSizeBytes > 0);
  assert.ok(envelope.metadata.checksum.length > 0);
});

test("unpackCheckpointEnvelope restores original data", async () => {
  const originalData = { message: "test checkpoint data", nested: { key: "value" } };

  const envelope = await createCheckpointEnvelope(originalData, "test.v1");
  const unpacked = await unpackCheckpointEnvelope(envelope);

  assert.deepEqual(unpacked.data, originalData);
  assert.equal(unpacked.metadata.algorithm, "gzip");
  assert.ok(unpacked.wasCompressed);
});

test("unpackCheckpointEnvelope verifies checksum integrity", async () => {
  const data = { test: "data" };

  const envelope = await createCheckpointEnvelope(data, "test.v1");
  // Corrupt the payload
  envelope.payload = Buffer.from("corrupted data").toString("base64");

  await assert.rejects(
    () => unpackCheckpointEnvelope(envelope),
    CheckpointEnvelopeInvalidError,
  );
});

test("wrapWorkflowStepCheckpoint creates envelope from workflow checkpoint", async () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness_1",
    nodeRunId: "node_1",
    planGraphId: "pg_1",
    taskId: "task_integration_1",
    executionId: "exec_integration_1",
    workflowId: "wf_integration_1",
    divisionId: "div_integration_1",
    stepId: "step_integration_1",
    roleId: "role_integration_1",
    outputKey: "output_key_1",
    status: "succeeded",
    producedAt: "2026-04-27T00:00:00.000Z",
    output: { result: "success" },
    decisionContext: {
      source: "model_response",
      request: "process task",
      routeReason: "completed",
      priorStepSummaries: ["step 1"],
      dependsOnStepIds: [],
    },
    resumeContext: {
      completedStepIds: ["step_integration_1"],
      nextStepId: null,
      outputKeys: ["output_key_1"],
    },
  });

  const envelope = await wrapWorkflowStepCheckpoint(checkpoint);

  assert.equal(envelope.version, CHECKPOINT_ENVELOPE_SCHEMA_VERSION);
  assert.equal(envelope.schema, checkpoint.schemaVersion);

  const unpacked = await unwrapWorkflowStepCheckpoint(envelope);
  assert.equal(unpacked.data.taskId, "task_integration_1");
  assert.equal(unpacked.data.status, "succeeded");
});

test("unwrapWorkflowStepCheckpoint restores checkpoint data", async () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness_2",
    nodeRunId: "node_2",
    planGraphId: "pg_2",
    taskId: "task_integration_2",
    executionId: "exec_integration_2",
    workflowId: "wf_integration_2",
    divisionId: "div_integration_2",
    stepId: "step_integration_2",
    roleId: "role_integration_2",
    outputKey: "output_key_2",
    status: "succeeded",
    producedAt: "2026-04-27T00:00:00.000Z",
    output: { summary: "Completed workflow" },
    decisionContext: {
      source: "test",
      request: "test request",
      routeReason: "testing",
      priorStepSummaries: [],
      dependsOnStepIds: [],
    },
    resumeContext: {
      completedStepIds: [],
      nextStepId: null,
      outputKeys: [],
    },
  });

  const envelope = await wrapWorkflowStepCheckpoint(checkpoint);
  const restored = await unwrapWorkflowStepCheckpoint(envelope);

  assert.equal(restored.data.taskId, "task_integration_2");
  assert.equal(restored.data.workflowId, "wf_integration_2");
  assert.equal(restored.data.output.summary, "Completed workflow");
});

test("createCheckpointEnvelope rejects data exceeding size limit", async () => {
  // Create data larger than default 10MB limit
  const largeData = { content: "x".repeat(DEFAULT_MAX_CHECKPOINT_SIZE_BYTES + 1) };

  await assert.rejects(
    () => createCheckpointEnvelope(largeData, "test.v1"),
    CheckpointSizeExceededError,
  );
});

test("createCheckpointEnvelope accepts data within size limit", async () => {
  const data = { content: "small data" };

  const envelope = await createCheckpointEnvelope(data, "test.v1");

  assert.ok(envelope.metadata.originalSizeBytes <= DEFAULT_MAX_CHECKPOINT_SIZE_BYTES);
});

test("getEnvelopeOriginalSize returns correct size", async () => {
  const data = { test: "data", numbers: [1, 2, 3] };

  const envelope = await createCheckpointEnvelope(data, "test.v1");

  assert.equal(getEnvelopeOriginalSize(envelope), envelope.metadata.originalSizeBytes);
});

test("getEnvelopeCompressedSize returns correct size", async () => {
  const data = { test: "data" };

  const envelope = await createCheckpointEnvelope(data, "test.v1");

  assert.equal(getEnvelopeCompressedSize(envelope), envelope.metadata.compressedSizeBytes);
});

test("getEnvelopeCompressionRatio calculates ratio correctly", async () => {
  // Use larger data that compresses well
  const data = { content: "x".repeat(1000) };

  const envelope = await createCheckpointEnvelope(data, "test.v1");

  const ratio = getEnvelopeCompressionRatio(envelope);
  // Compression ratio should be positive
  assert.ok(ratio > 0);
  // For repetitive data, ratio should be less than 1 (compressed smaller than original)
  assert.ok(ratio <= 1);
});

test("getEnvelopeCompressionRatio handles zero original size", async () => {
  const envelope = {
    version: CHECKPOINT_ENVELOPE_SCHEMA_VERSION,
    schema: "test.v1",
    payload: "",
    metadata: {
      originalSizeBytes: 0,
      compressedSizeBytes: 0,
      checksum: "abc123",
      createdAt: "2026-04-27T00:00:00.000Z",
      algorithm: "gzip" as const,
      payloadSchemaVersion: "test.v1",
    },
  };

  const ratio = getEnvelopeCompressionRatio(envelope);
  assert.equal(ratio, 1);
});

test("unpackCheckpointEnvelope rejects invalid envelope structure", async () => {
  const invalidEnvelope: CheckpointEnvelope = {
    version: "invalid_version" as CheckpointEnvelope["version"],
    schema: "test.v1",
    payload: "abc123",
    metadata: {
      originalSizeBytes: 100,
      compressedSizeBytes: 100,
      checksum: "abc123",
      createdAt: "2026-04-27T00:00:00.000Z",
      algorithm: "gzip" as const,
      payloadSchemaVersion: "test.v1",
    },
  };

  await assert.rejects(
    () => unpackCheckpointEnvelope(invalidEnvelope),
    CheckpointEnvelopeInvalidError,
  );
});

test("createCheckpointEnvelope with custom maxSizeBytes", async () => {
  const smallData = { content: "test" };
  const customMaxSize = 5;

  await assert.rejects(
    () => createCheckpointEnvelope(smallData, "test.v1", { maxSizeBytes: customMaxSize }),
    CheckpointSizeExceededError,
  );
});

test("unpackCheckpointEnvelope with custom maxSizeBytes", async () => {
  const data = { content: "test content" };
  const envelope = await createCheckpointEnvelope(data, "test.v1");

  // Should succeed with larger limit
  const unpacked = await unpackCheckpointEnvelope(envelope, { maxSizeBytes: 100000 });
  assert.deepEqual(unpacked.data, data);
});

test("envelope preserves complex nested data structures", async () => {
  const complexData = {
    level1: {
      level2: {
        level3: {
          array: [1, 2, 3],
          object: { key: "value" },
        },
      },
    },
    dates: ["2026-04-27T00:00:00.000Z"],
    nullValue: null,
    boolean: true,
  };

  const envelope = await createCheckpointEnvelope(complexData, "complex.v1");
  const unpacked = await unpackCheckpointEnvelope(envelope);

  assert.deepEqual(unpacked.data, complexData);
});

test("envelope handles empty objects", async () => {
  const emptyData = {};

  const envelope = await createCheckpointEnvelope(emptyData, "empty.v1");
  const unpacked = await unpackCheckpointEnvelope(envelope);

  assert.deepEqual(unpacked.data, {});
});

test("envelope handles unicode content", async () => {
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

test("multiple wrap/unwrap cycles produce same result", async () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness_cycle",
    nodeRunId: "node_cycle",
    planGraphId: "pg_cycle",
    taskId: "task_cycle_test",
    executionId: "exec_cycle_test",
    workflowId: "wf_cycle_test",
    divisionId: "div_cycle_test",
    stepId: "step_cycle_test",
    roleId: "role_cycle_test",
    outputKey: "output_cycle",
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

  const envelope1 = await wrapWorkflowStepCheckpoint(checkpoint);
  const unpacked1 = await unwrapWorkflowStepCheckpoint(envelope1);

  const envelope2 = await wrapWorkflowStepCheckpoint(unpacked1.data);
  const unpacked2 = await unwrapWorkflowStepCheckpoint(envelope2);

  assert.equal(unpacked1.data.taskId, unpacked2.data.taskId);
  assert.equal(unpacked1.data.status, unpacked2.data.status);
});
