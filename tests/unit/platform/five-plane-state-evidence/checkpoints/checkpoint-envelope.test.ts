import assert from "node:assert/strict";
import test from "node:test";

import {
  CHECKPOINT_ENVELOPE_SCHEMA_VERSION,
  DEFAULT_MAX_CHECKPOINT_SIZE_BYTES,
  CheckpointEnvelopeInvalidError,
  CheckpointSizeExceededError,
  createCheckpointEnvelope,
  getEnvelopeCompressedSize,
  getEnvelopeCompressionRatio,
  getEnvelopeOriginalSize,
  unpackCheckpointEnvelope,
  type CheckpointEnvelope,
} from "../../../../../src/platform/five-plane-state-evidence/checkpoints/checkpoint-envelope.js";

test("checkpoint envelope constants stay stable", () => {
  assert.equal(CHECKPOINT_ENVELOPE_SCHEMA_VERSION, "checkpoint_envelope.v1");
  assert.equal(DEFAULT_MAX_CHECKPOINT_SIZE_BYTES, 10 * 1024 * 1024);
});

test("createCheckpointEnvelope and unpackCheckpointEnvelope preserve payload data", async () => {
  const payload = {
    stepId: "step-123",
    output: {
      summary: "ok",
      repeated: "agent-platform ".repeat(40),
    },
  };

  const envelope = await createCheckpointEnvelope(payload, "workflow_step_checkpoint.v1");
  const unpacked = await unpackCheckpointEnvelope<typeof payload>(envelope);

  assert.equal(envelope.version, CHECKPOINT_ENVELOPE_SCHEMA_VERSION);
  assert.equal(envelope.schema, "workflow_step_checkpoint.v1");
  assert.equal(envelope.metadata.payloadSchemaVersion, "workflow_step_checkpoint.v1");
  assert.deepEqual(unpacked.data, payload);
  assert.equal(unpacked.wasCompressed, true);
  assert.equal(getEnvelopeOriginalSize(envelope), envelope.metadata.originalSizeBytes);
  assert.equal(getEnvelopeCompressedSize(envelope), envelope.metadata.compressedSizeBytes);
  assert.ok(getEnvelopeCompressionRatio(envelope) >= 0);
  assert.ok(getEnvelopeCompressionRatio(envelope) <= 1);
});

test("createCheckpointEnvelope rejects oversized payloads before persistence", async () => {
  await assert.rejects(
    createCheckpointEnvelope({ hugeField: "x".repeat(DEFAULT_MAX_CHECKPOINT_SIZE_BYTES + 1) }, "test.v1"),
    CheckpointSizeExceededError,
  );
});

test("unpackCheckpointEnvelope rejects schema mismatch metadata", async () => {
  const envelope = await createCheckpointEnvelope({ data: "ok" }, "test.v1");
  const invalidEnvelope = {
    ...envelope,
    metadata: {
      ...envelope.metadata,
      payloadSchemaVersion: "different.v1",
    },
  } as CheckpointEnvelope;

  await assert.rejects(
    unpackCheckpointEnvelope(invalidEnvelope),
    CheckpointEnvelopeInvalidError,
  );
});

test("unpackCheckpointEnvelope rejects wrong envelope version at runtime", async () => {
  const envelope = await createCheckpointEnvelope({ data: "ok" }, "test.v1");
  const invalidEnvelope = {
    ...envelope,
    version: "wrong_version.v1",
  } as unknown as CheckpointEnvelope;

  await assert.rejects(
    unpackCheckpointEnvelope(invalidEnvelope),
    CheckpointEnvelopeInvalidError,
  );
});

test("unpackCheckpointEnvelope rejects checksum tampering", async () => {
  const envelope = await createCheckpointEnvelope({ data: "ok" }, "test.v1");
  const tampered = {
    ...envelope,
    metadata: {
      ...envelope.metadata,
      checksum: "a".repeat(64),
    },
  } as CheckpointEnvelope;

  await assert.rejects(
    unpackCheckpointEnvelope(tampered),
    CheckpointEnvelopeInvalidError,
  );
});

test("compression ratio returns 1 when original size is zero", () => {
  const envelope = {
    version: CHECKPOINT_ENVELOPE_SCHEMA_VERSION,
    schema: "test.v1",
    payload: "",
    metadata: {
      originalSizeBytes: 0,
      compressedSizeBytes: 0,
      checksum: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      createdAt: "2024-01-01T00:00:00.000Z",
      algorithm: "gzip",
      payloadSchemaVersion: "test.v1",
    },
  } satisfies CheckpointEnvelope;

  assert.equal(getEnvelopeCompressionRatio(envelope), 1);
});
