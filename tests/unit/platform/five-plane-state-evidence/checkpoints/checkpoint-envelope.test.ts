/**
 * Unit tests for checkpoint-envelope module
 *
 * Tests checkpoint envelope creation, unpacking, compression, and error handling.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CHECKPOINT_ENVELOPE_SCHEMA_VERSION,
  DEFAULT_MAX_CHECKPOINT_SIZE_BYTES,
  createCheckpointEnvelope,
  unpackCheckpointEnvelope,
  getEnvelopeOriginalSize,
  getEnvelopeCompressedSize,
  getEnvelopeCompressionRatio,
  CheckpointSizeExceededError,
  CheckpointEnvelopeInvalidError,
  type CheckpointEnvelope,
} from "../../../../../src/platform/five-plane-state-evidence/checkpoints/checkpoint-envelope.js";

test("CHECKPOINT_ENVELOPE_SCHEMA_VERSION is correct", () => {
  assert.equal(CHECKPOINT_ENVELOPE_SCHEMA_VERSION, "checkpoint_envelope.v1");
});

test("DEFAULT_MAX_CHECKPOINT_SIZE_BYTES is 10MB", () => {
  assert.equal(DEFAULT_MAX_CHECKPOINT_SIZE_BYTES, 10 * 1024 * 1024);
});

test("createCheckpointEnvelope creates valid envelope with compression", async () => {
  // Use larger data that will actually compress well
  const checkpointData = {
    stepId: "step-1",
    output: { result: "success", largeText: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(50) },
    status: "completed",
  };

  const envelope = await createCheckpointEnvelope(checkpointData, "workflow_step_checkpoint.v1");

  assert.equal(envelope.version, "checkpoint_envelope.v1");
  assert.equal(envelope.schema, "workflow_step_checkpoint.v1");
  assert.ok(typeof envelope.payload === "string");
  assert.ok(envelope.payload.length > 0);
  assert.equal(envelope.metadata.algorithm, "gzip");
  assert.ok(envelope.metadata.originalSizeBytes > 0);
  assert.ok(envelope.metadata.compressedSizeBytes > 0);
  // Large text data should compress
  assert.ok(envelope.metadata.compressedSizeBytes <= envelope.metadata.originalSizeBytes);
  assert.ok(envelope.metadata.checksum.length === 64); // SHA-256 hex
});

test("createCheckpointEnvelope preserves data through compress/decompress cycle", async () => {
  const originalData = {
    stepId: "step-123",
    output: { result: "test output", nested: { value: 42 } },
    status: "completed",
    timestamp: "2024-01-01T00:00:00Z",
  };

  const envelope = await createCheckpointEnvelope(originalData, "workflow_step_checkpoint.v1");
  const unpacked = await unpackCheckpointEnvelope<typeof originalData>(envelope);

  assert.deepEqual(unpacked.data, originalData);
  assert.equal(unpacked.wasCompressed, true);
});

test("createCheckpointEnvelope throws CheckpointSizeExceededError for oversized data", async () => {
  const largeData = {
    hugeField: "x".repeat(DEFAULT_MAX_CHECKPOINT_SIZE_BYTES + 1),
  };

  await assert.rejects(
    async () => createCheckpointEnvelope(largeData, "test.v1"),
    (err: unknown) => {
      if (err instanceof CheckpointSizeExceededError) {
        assert.ok(err.originalSizeBytes > DEFAULT_MAX_CHECKPOINT_SIZE_BYTES);
        assert.ok(err.maxSizeBytes === DEFAULT_MAX_CHECKPOINT_SIZE_BYTES);
        return true;
      }
      return false;
    },
  );
});

test("createCheckpointEnvelope respects custom maxSizeBytes", async () => {
  // Use data that exceeds the custom maxSize
  const data = { field: "x".repeat(200) };
  const maxSize = 100;

  await assert.rejects(
    async () => createCheckpointEnvelope(data, "test.v1", { maxSizeBytes: maxSize }),
    CheckpointSizeExceededError,
  );
});

test("createCheckpointEnvelope accepts custom payloadSchemaVersion", async () => {
  const envelope = await createCheckpointEnvelope(
    { test: true },
    "custom.schema.v2",
  );

  assert.equal(envelope.schema, "custom.schema.v2");
  assert.equal(envelope.metadata.payloadSchemaVersion, "custom.schema.v2");
});

test("unpackCheckpointEnvelope throws CheckpointEnvelopeInvalidError for invalid structure", async () => {
  const invalidEnvelope = {
    version: "checkpoint_envelope.v1",
    schema: "test.v1",
    payload: "not-valid-base64!!!",
    metadata: {
      originalSizeBytes: 100,
      compressedSizeBytes: 50,
      checksum: "invalid",
      createdAt: "2024-01-01T00:00:00Z",
      algorithm: "gzip",
      payloadSchemaVersion: "test.v1",
    },
  };

  await assert.rejects(
    async () => unpackCheckpointEnvelope(invalidEnvelope),
    CheckpointEnvelopeInvalidError,
  );
});

test("unpackCheckpointEnvelope throws CheckpointEnvelopeInvalidError for wrong version", async () => {
  const envelope = await createCheckpointEnvelope({ data: "test" }, "test.v1");
  const wrongVersionEnvelope: CheckpointEnvelope = {
    ...envelope,
    version: "wrong_version.v1",
  };

  await assert.rejects(
    async () => unpackCheckpointEnvelope(wrongVersionEnvelope),
    CheckpointEnvelopeInvalidError,
  );
});

test("unpackCheckpointEnvelope throws CheckpointEnvelopeInvalidError for missing fields", async () => {
  const envelope = await createCheckpointEnvelope({ data: "test" }, "test.v1");

  // @ts-expect-error - Testing invalid structure
  await assert.rejects(
    async () => unpackCheckpointEnvelope({ ...envelope, schema: undefined }),
    CheckpointEnvelopeInvalidError,
  );
});

test("unpackCheckpointEnvelope throws CheckpointEnvelopeInvalidError for corrupted checksum", async () => {
  const envelope = await createCheckpointEnvelope({ data: "test" }, "test.v1");
  const tamperedEnvelope: CheckpointEnvelope = {
    ...envelope,
    metadata: {
      ...envelope.metadata,
      checksum: "a".repeat(64), // Wrong checksum
    },
  };

  await assert.rejects(
    async () => unpackCheckpointEnvelope(tamperedEnvelope),
    CheckpointEnvelopeInvalidError,
  );
});

test("unpackCheckpointEnvelope throws CheckpointSizeExceededError when compressed size exceeds limit", async () => {
  const envelope = await createCheckpointEnvelope({ data: "test" }, "test.v1");

  await assert.rejects(
    async () => unpackCheckpointEnvelope(envelope, { maxSizeBytes: 1 }),
    CheckpointSizeExceededError,
  );
});

test("getEnvelopeOriginalSize returns correct size", async () => {
  const originalData = { field: "test data" };
  const envelope = await createCheckpointEnvelope(originalData, "test.v1");

  const size = getEnvelopeOriginalSize(envelope);
  assert.equal(size, envelope.metadata.originalSizeBytes);
  assert.ok(size > 0);
});

test("getEnvelopeCompressedSize returns correct size", async () => {
  const envelope = await createCheckpointEnvelope({ field: "test" }, "test.v1");

  const size = getEnvelopeCompressedSize(envelope);
  assert.equal(size, envelope.metadata.compressedSizeBytes);
});

test("getEnvelopeCompressionRatio returns ratio between 0 and 1", async () => {
  const largeData = { field: "x".repeat(10000) };
  const envelope = await createCheckpointEnvelope(largeData, "test.v1");

  const ratio = getEnvelopeCompressionRatio(envelope);

  assert.ok(ratio >= 0);
  assert.ok(ratio <= 1);
  // Large repetitive data should compress well
  assert.ok(ratio < 0.5);
});

test("getEnvelopeCompressionRatio handles zero original size", async () => {
  const emptyEnvelope: CheckpointEnvelope = {
    version: "checkpoint_envelope.v1",
    schema: "test.v1",
    payload: "", // Would not be valid in reality
    metadata: {
      originalSizeBytes: 0,
      compressedSizeBytes: 0,
      checksum: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", // SHA-256 of empty
      createdAt: "2024-01-01T00:00:00Z",
      algorithm: "gzip",
      payloadSchemaVersion: "test.v1",
    },
  };

  const ratio = getEnvelopeCompressionRatio(emptyEnvelope);
  assert.equal(ratio, 1);
});

test("envelope with text data compresses well", async () => {
  const textData = {
    content: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(100),
  };

  const envelope = await createCheckpointEnvelope(textData, "test.v1");
  const ratio = getEnvelopeCompressionRatio(envelope);

  // Text should compress to less than 50% of original
  assert.ok(ratio < 0.5);
});

test("envelope with random-like data has moderate compression ratio", async () => {
  // Create data that looks like base64 random content (hard to compress)
  const randomBytes = Array.from({ length: 2000 }, () => Math.floor(Math.random() * 256));
  const binaryData = {
    content: Buffer.from(randomBytes).toString("base64"),
  };

  const envelope = await createCheckpointEnvelope(binaryData, "test.v1");
  const ratio = getEnvelopeCompressionRatio(envelope);

  // Base64 encoded random data is harder to compress but still has some patterns
  // The ratio should be reasonable (not extremely high compression)
  assert.ok(ratio > 0.3);
});

test("multiple create/unpack cycles produce consistent results", async () => {
  const originalData = {
    stepId: "step-multi",
    output: { results: [1, 2, 3, 4, 5] },
    metadata: { key: "value" },
  };

  const envelope1 = await createCheckpointEnvelope(originalData, "test.v1");
  const unpacked1 = await unpackCheckpointEnvelope(envelope1);

  const envelope2 = await createCheckpointEnvelope(originalData, "test.v1");
  const unpacked2 = await unpackCheckpointEnvelope(envelope2);

  // Same data should produce same checksum
  assert.equal(envelope1.metadata.checksum, envelope2.metadata.checksum);
  assert.deepEqual(unpacked1.data, unpacked2.data);
  assert.deepEqual(unpacked1.data, originalData);
});

test("CheckpointSizeExceededError has correct properties", async () => {
  const error = new CheckpointSizeExceededError(100, 50);

  assert.equal(error.name, "CheckpointSizeExceededError");
  assert.equal(error.code, "checkpoint.size_exceeded");
  assert.equal(error.originalSizeBytes, 100);
  assert.equal(error.maxSizeBytes, 50);
  assert.equal(error.statusCode, 413);
  assert.equal(error.category, "storage");
  assert.equal(error.retryable, false);
});

test("CheckpointEnvelopeInvalidError has correct properties", () => {
  const error = new CheckpointEnvelopeInvalidError("Test error message");

  assert.equal(error.name, "CheckpointEnvelopeInvalidError");
  assert.equal(error.code, "checkpoint.envelope_invalid");
  assert.equal(error.message, "Test error message");
  assert.equal(error.statusCode, 422);
  assert.equal(error.category, "storage");
  assert.equal(error.retryable, false);
});

test("CheckpointSizeExceededError details contain limit exceeded by value", async () => {
  const originalSize = 1000;
  const maxSize = 500;
  const error = new CheckpointSizeExceededError(originalSize, maxSize);

  assert.ok(error.details);
  // @ts-expect-error - details may not be typed
  assert.equal(error.details.limitExceededBy, originalSize - maxSize);
});
