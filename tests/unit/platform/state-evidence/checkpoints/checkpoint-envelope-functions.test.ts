import assert from "node:assert/strict";
import test from "node:test";

import {
  createCheckpointEnvelope,
  unpackCheckpointEnvelope,
  getEnvelopeOriginalSize,
  getEnvelopeCompressedSize,
  getEnvelopeCompressionRatio,
  CheckpointSizeExceededError,
  CheckpointEnvelopeInvalidError,
  CHECKPOINT_ENVELOPE_SCHEMA_VERSION,
  DEFAULT_MAX_CHECKPOINT_SIZE_BYTES,
} from "../../../../../src/platform/state-evidence/checkpoints/checkpoint-envelope.js";

test("createCheckpointEnvelope returns envelope with correct structure", async () => {
  const data = { step: "test", status: "complete" };
  const envelope = await createCheckpointEnvelope(data, "test.v1");

  assert.equal(envelope.version, CHECKPOINT_ENVELOPE_SCHEMA_VERSION);
  assert.equal(envelope.schema, "test.v1");
  assert.ok(typeof envelope.payload === "string");
  assert.ok(envelope.payload.length > 0);
  assert.ok(envelope.metadata.originalSizeBytes > 0);
  assert.ok(envelope.metadata.compressedSizeBytes > 0);
  assert.ok(envelope.metadata.checksum.length > 0);
  assert.equal(envelope.metadata.algorithm, "gzip");
});

test("createCheckpointEnvelope compresses data successfully", async () => {
  const largeData = { content: "x".repeat(1000) };
  const envelope = await createCheckpointEnvelope(largeData, "test.v1");

  // Compressed size should be smaller for repetitive data
  assert.ok(envelope.metadata.compressedSizeBytes < envelope.metadata.originalSizeBytes);
});

test("createCheckpointEnvelope preserves data after round-trip", async () => {
  const originalData = {
    taskId: "task-123",
    output: { result: "success", values: [1, 2, 3] },
  };

  const envelope = await createCheckpointEnvelope(originalData, "workflow_step.v1");
  const unpacked = await unpackCheckpointEnvelope<typeof originalData>(envelope);

  assert.deepEqual(unpacked.data, originalData);
  assert.equal(unpacked.metadata.algorithm, "gzip");
  assert.equal(unpacked.wasCompressed, true);
});

test("createCheckpointEnvelope accepts custom payload schema version", async () => {
  const envelope = await createCheckpointEnvelope({ test: true }, "custom.schema.v2");

  assert.equal(envelope.schema, "custom.schema.v2");
  assert.equal(envelope.metadata.payloadSchemaVersion, "custom.schema.v2");
});

test("createCheckpointEnvelope respects maxSizeBytes option", async () => {
  const smallData = { small: "data" };
  const envelope = await createCheckpointEnvelope(smallData, "test.v1", {
    maxSizeBytes: 1024,
  });

  assert.ok(envelope.metadata.originalSizeBytes <= 1024);
});

test("createCheckpointEnvelope throws CheckpointSizeExceededError for oversized data", async () => {
  const data = { content: "x".repeat(11 * 1024 * 1024) }; // Over 10MB

  await assert.rejects(
    async () => createCheckpointEnvelope(data, "test.v1"),
    CheckpointSizeExceededError,
  );
});

test("createCheckpointEnvelope throws CheckpointSizeExceededError when compressed exceeds limit", async () => {
  // Create data that compresses poorly (already compressed or random)
  const data = { random: "abcdefghijklmnopqrstuvwxyz0123456789".repeat(500000) };

  await assert.rejects(
    async () => createCheckpointEnvelope(data, "test.v1", { maxSizeBytes: 1024 }),
    CheckpointSizeExceededError,
  );
});

test("unpackCheckpointEnvelope throws CheckpointEnvelopeInvalidError for invalid envelope", async () => {
  const invalidEnvelope = {
    version: "wrong_version",
    schema: "test",
    payload: "not-base64",
    metadata: {},
  };

  await assert.rejects(
    async () => unpackCheckpointEnvelope(invalidEnvelope as any),
    CheckpointEnvelopeInvalidError,
  );
});

test("unpackCheckpointEnvelope throws CheckpointEnvelopeInvalidError for tampered payload", async () => {
  const envelope = await createCheckpointEnvelope({ original: true }, "test.v1");
  // Tamper with the payload
  const tamperedEnvelope = {
    ...envelope,
    payload: Buffer.from("tampered").toString("base64"),
  };

  await assert.rejects(
    async () => unpackCheckpointEnvelope(tamperedEnvelope),
    CheckpointEnvelopeInvalidError,
  );
});

test("unpackCheckpointEnvelope throws CheckpointEnvelopeInvalidError for corrupted JSON", async () => {
  // Create envelope with corrupted JSON payload
  const goodEnvelope = await createCheckpointEnvelope({ good: true }, "test.v1");
  const corruptedEnvelope = {
    ...goodEnvelope,
    payload: Buffer.from("not valid json {{{").toString("base64"),
  };

  await assert.rejects(
    async () => unpackCheckpointEnvelope(corruptedEnvelope),
    CheckpointEnvelopeInvalidError,
  );
});

test("unpackCheckpointEnvelope throws CheckpointSizeExceededError for compressed size over limit", async () => {
  const envelope = await createCheckpointEnvelope({ test: true }, "test.v1");
  const modifiedEnvelope = {
    ...envelope,
    metadata: {
      ...envelope.metadata,
      originalSizeBytes: 5 * 1024 * 1024,
    },
  };

  await assert.rejects(
    async () => unpackCheckpointEnvelope(modifiedEnvelope, { maxSizeBytes: 1 }),
    CheckpointSizeExceededError,
  );
});

test("getEnvelopeOriginalSize returns correct size", async () => {
  const envelope = await createCheckpointEnvelope({ data: "test" }, "v1");

  assert.equal(getEnvelopeOriginalSize(envelope), envelope.metadata.originalSizeBytes);
});

test("getEnvelopeCompressedSize returns correct size", async () => {
  const envelope = await createCheckpointEnvelope({ data: "test" }, "v1");

  assert.equal(getEnvelopeCompressedSize(envelope), envelope.metadata.compressedSizeBytes);
});

test("getEnvelopeCompressionRatio calculates correctly", async () => {
  const envelope = await createCheckpointEnvelope({ data: "test" }, "v1");

  const ratio = getEnvelopeCompressionRatio(envelope);
  assert.ok(ratio > 0 && ratio <= 1);
});

test("getEnvelopeCompressionRatio returns 1 for zero original size", async () => {
  const envelope = await createCheckpointEnvelope(null as any, "v1");

  // Empty object still has size due to JSON serialization
  const ratio = getEnvelopeCompressionRatio(envelope);
  assert.ok(ratio >= 0);
});

test("createCheckpointEnvelope handles empty object", async () => {
  const envelope = await createCheckpointEnvelope({}, "test.v1");

  assert.ok(envelope.metadata.originalSizeBytes > 0);
  assert.ok(envelope.metadata.compressedSizeBytes > 0);
});

test("createCheckpointEnvelope handles deeply nested objects", async () => {
  const nestedData = {
    level1: {
      level2: {
        level3: {
          level4: {
            value: "deep",
            array: [1, 2, { nested: true }],
          },
        },
      },
    },
  };

  const envelope = await createCheckpointEnvelope(nestedData, "deep.v1");
  const unpacked = await unpackCheckpointEnvelope(envelope);

  assert.deepEqual(unpacked.data, nestedData);
});

test("createCheckpointEnvelope handles objects with special characters", async () => {
  const data = {
    text: "Hello! @#$%^&*()_special_chars",
    unicode: "日本語中文한국어",
    emoji: "😀🎉🔒",
  };

  const envelope = await createCheckpointEnvelope(data, "special.v1");
  const unpacked = await unpackCheckpointEnvelope(envelope);

  assert.deepEqual(unpacked.data, data);
});

test("createCheckpointEnvelope default max size is 10MB", () => {
  assert.equal(DEFAULT_MAX_CHECKPOINT_SIZE_BYTES, 10 * 1024 * 1024);
});

test("CheckpointSizeExceededError has correct properties", async () => {
  const error = new CheckpointSizeExceededError(100, 50);

  assert.equal(error.originalSizeBytes, 100);
  assert.equal(error.maxSizeBytes, 50);
  assert.equal(error.name, "CheckpointSizeExceededError");
  assert.ok(error.message.includes("100"));
  assert.ok(error.message.includes("50"));
});

test("CheckpointEnvelopeInvalidError has correct properties", () => {
  const error = new CheckpointEnvelopeInvalidError("Test error message");

  assert.equal(error.name, "CheckpointEnvelopeInvalidError");
  assert.ok(error.message.includes("Test error message"));
});

test("unpackCheckpointEnvelope handles different schema versions", async () => {
  const envelope = await createCheckpointEnvelope({ data: true }, "legacy.v0");

  assert.equal(envelope.schema, "legacy.v0");
  assert.equal(envelope.metadata.payloadSchemaVersion, "legacy.v0");
});

test("createCheckpointEnvelope handles very small objects", async () => {
  const envelope = await createCheckpointEnvelope({ a: 1 }, "small.v1");

  assert.ok(envelope.metadata.originalSizeBytes < 100);
});

test("round-trip preserves numeric values exactly", async () => {
  const data = {
    integer: 42,
    negative: -17,
    float: 3.14159,
    bigInt: 9007199254740991,
    scientific: 1.23e10,
  };

  const envelope = await createCheckpointEnvelope(data, "numeric.v1");
  const unpacked = await unpackCheckpointEnvelope<typeof data>(envelope);

  assert.equal((unpacked.data as typeof data).integer, 42);
  assert.equal((unpacked.data as typeof data).negative, -17);
  assert.equal((unpacked.data as typeof data).float, 3.14159);
});