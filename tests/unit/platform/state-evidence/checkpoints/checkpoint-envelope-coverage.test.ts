/**
 * Additional unit tests for Checkpoint Envelope
 *
 * Tests edge cases and additional coverage for checkpoint envelope operations.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";

import {
  createCheckpointEnvelope,
  unpackCheckpointEnvelope,
  wrapWorkflowStepCheckpoint,
  unwrapWorkflowStepCheckpoint,
  getEnvelopeOriginalSize,
  getEnvelopeCompressedSize,
  getEnvelopeCompressionRatio,
  CheckpointSizeExceededError,
  CheckpointEnvelopeInvalidError,
  DEFAULT_MAX_CHECKPOINT_SIZE_BYTES,
  CHECKPOINT_ENVELOPE_SCHEMA_VERSION,
  type CheckpointEnvelope,
  type WorkflowStepCheckpoint,
} from "../../../../../src/platform/five-plane-state-evidence/checkpoints/index.js";

function createMinimalCheckpoint(): WorkflowStepCheckpoint {
  return {
    schemaVersion: "workflow_step_checkpoint.v1",
    harnessRunId: "harness-min",
    nodeRunId: null,
    planGraphBundleId: "bundle-min",
    taskId: "task-min",
    executionId: null,
    workflowId: "wf-min",
    divisionId: "div-min",
    stepId: "step-min",
    roleId: "role-min",
    outputKey: "output-min",
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
}

test("createCheckpointEnvelope handles deeply nested objects", async () => {
  const nestedData = {
    level1: {
      level2: {
        level3: {
          level4: {
            value: "deep",
            array: [1, 2, 3, { nested: true }],
          },
        },
      },
    },
    another: {
      deeply: {
        nested: {
          structure: {
            with: {
              many: {
                levels: {
                  of: {
                    nesting: true,
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  const envelope = await createCheckpointEnvelope(nestedData, "test.v1");
  const unpacked = await unpackCheckpointEnvelope(envelope);

  assert.deepStrictEqual(unpacked.data, nestedData);
});

test("createCheckpointEnvelope handles large string content", async () => {
  const largeString = "x".repeat(100_000);
  const checkpoint = { data: largeString };

  const envelope = await createCheckpointEnvelope(checkpoint, "test.v1");
  const unpacked = await unpackCheckpointEnvelope<typeof checkpoint>(envelope);

  assert.strictEqual(unpacked.data.data.length, 100_000);
});

test("createCheckpointEnvelope handles empty object", async () => {
  const emptyObj = {};
  const envelope = await createCheckpointEnvelope(emptyObj, "test.v1");

  assert.ok(envelope);
  assert.ok(envelope.metadata.originalSizeBytes > 0);

  const unpacked = await unpackCheckpointEnvelope(envelope);
  assert.deepStrictEqual(unpacked.data, emptyObj);
});

test("createCheckpointEnvelope handles boolean and number values", async () => {
  const data = {
    isActive: true,
    count: 42,
    percentage: 99.9,
    negative: -100,
    zero: 0,
  };

  const envelope = await createCheckpointEnvelope(data, "test.v1");
  const unpacked = await unpackCheckpointEnvelope<typeof data>(envelope);

  assert.deepStrictEqual(unpacked.data, data);
});

test("createCheckpointEnvelope handles special JSON characters", async () => {
  const data = {
    json: '{"key": "value"}',
    newline: "line1\nline2",
    tab: "col1\tcol2",
    backslash: "path\\to\\file",
    quote: 'said "hello"',
    backtick: "`code`",
  };

  const envelope = await createCheckpointEnvelope(data, "test.v1");
  const unpacked = await unpackCheckpointEnvelope<typeof data>(envelope);

  assert.deepStrictEqual(unpacked.data, data);
});

test("createCheckpointEnvelope handles unicode content", async () => {
  const data = {
    chinese: "中文测试",
    japanese: "日本語",
    korean: "한국어",
    emoji: "🎉🎊🎁",
    arabic: "مرحبا",
    russian: "Привет",
    combined: "Hello 世界 🌍 🎉",
  };

  const envelope = await createCheckpointEnvelope(data, "test.v1");
  const unpacked = await unpackCheckpointEnvelope<typeof data>(envelope);

  assert.deepStrictEqual(unpacked.data, data);
});

test("unpackCheckpointEnvelope rejects tampered payload", async () => {
  const checkpoint = createMinimalCheckpoint();
  const envelope = await createCheckpointEnvelope(checkpoint, "test.v1");

  // Tamper with the payload
  const tamperedPayload = Buffer.from("{}").toString("base64");
  const tamperedEnvelope: CheckpointEnvelope = {
    ...envelope,
    payload: tamperedPayload,
    metadata: {
      ...envelope.metadata,
      checksum: createHash("sha256").update("{}").digest("hex"),
    },
  };

  await assert.rejects(
    async () => unpackCheckpointEnvelope(tamperedEnvelope),
    CheckpointEnvelopeInvalidError,
  );
});

test("unpackCheckpointEnvelope rejects wrong envelope version", async () => {
  const checkpoint = createMinimalCheckpoint();
  const envelope = await createCheckpointEnvelope(checkpoint, "test.v1");

  const wrongVersionEnvelope: CheckpointEnvelope = {
    ...envelope,
    version: "checkpoint_envelope.v999",
  };

  await assert.rejects(
    async () => unpackCheckpointEnvelope(wrongVersionEnvelope),
    CheckpointEnvelopeInvalidError,
  );
});

test("unpackCheckpointEnvelope rejects missing metadata fields", async () => {
  const checkpoint = createMinimalCheckpoint();
  const envelope = await createCheckpointEnvelope(checkpoint, "test.v1");

  const invalidEnvelope = {
    version: envelope.version,
    schema: envelope.schema,
    payload: envelope.payload,
    metadata: {
      originalSizeBytes: envelope.metadata.originalSizeBytes,
      // missing compressedSizeBytes, checksum, createdAt, algorithm, payloadSchemaVersion
    },
  } as unknown as CheckpointEnvelope;

  await assert.rejects(
    async () => unpackCheckpointEnvelope(invalidEnvelope),
    CheckpointEnvelopeInvalidError,
  );
});

test("unpackCheckpointEnvelope with custom maxSizeBytes", async () => {
  const checkpoint = createMinimalCheckpoint();
  const envelope = await createCheckpointEnvelope(checkpoint, "test.v1");

  // Should succeed with larger limit
  const unpacked = await unpackCheckpointEnvelope(envelope, { maxSizeBytes: 100 * 1024 * 1024 });
  assert.ok(unpacked.data);
});

test("unpackCheckpointEnvelope fails when compressed size exceeds maxSizeBytes", async () => {
  const checkpoint = createMinimalCheckpoint();
  const envelope = await createCheckpointEnvelope(checkpoint, "test.v1");

  // Set a very small max size
  await assert.rejects(
    async () => unpackCheckpointEnvelope(envelope, { maxSizeBytes: 1 }),
    CheckpointSizeExceededError,
  );
});

test("getEnvelopeCompressionRatio returns value between 0 and 1 for compressible data", async () => {
  const repetitiveData = { data: "AAAAAAAAAA".repeat(1000) };
  const envelope = await createCheckpointEnvelope(repetitiveData, "test.v1");

  const ratio = getEnvelopeCompressionRatio(envelope);
  assert.ok(ratio >= 0 && ratio <= 1);
});

test("getEnvelopeCompressionRatio returns 1 for zero original size", () => {
  const envelope: CheckpointEnvelope = {
    version: CHECKPOINT_ENVELOPE_SCHEMA_VERSION,
    schema: "test.v1",
    payload: "",
    metadata: {
      originalSizeBytes: 0,
      compressedSizeBytes: 0,
      checksum: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      createdAt: new Date().toISOString(),
      algorithm: "gzip",
      payloadSchemaVersion: "test.v1",
    },
  };

  assert.strictEqual(getEnvelopeCompressionRatio(envelope), 1);
});

test("wrapWorkflowStepCheckpoint uses correct schema version", async () => {
  const checkpoint = createMinimalCheckpoint();

  const envelope = await wrapWorkflowStepCheckpoint(checkpoint);

  assert.strictEqual(envelope.schema, "workflow_step_checkpoint.v1");
  assert.strictEqual(envelope.metadata.payloadSchemaVersion, "workflow_step_checkpoint.v1");
});

test("unwrapWorkflowStepCheckpoint returns correct checkpoint type", async () => {
  const original = createMinimalCheckpoint();
  original.output = { result: "success", value: 42 };

  const envelope = await wrapWorkflowStepCheckpoint(original);
  const unpacked = await unwrapWorkflowStepCheckpoint(envelope);

  assert.strictEqual(unpacked.data.output.result, "success");
  assert.strictEqual(unpacked.data.output.value, 42);
});

test("unwrapWorkflowStepCheckpoint preserves all checkpoint fields", async () => {
  const original = createMinimalCheckpoint();
  original.decisionContext.priorStepSummaries.push("Step 1 completed");
  original.decisionContext.dependsOnStepIds.push("step-1");
  original.resumeContext.completedStepIds.push("step-1");
  original.resumeContext.nextStepId = "step-2";
  original.resumeContext.outputKeys.push("output-1");
  original.fileDiffSummary.createdPaths.push("/path/to/file.txt");

  const envelope = await wrapWorkflowStepCheckpoint(original);
  const unpacked = await unwrapWorkflowStepCheckpoint(envelope);

  assert.deepStrictEqual(unpacked.data.decisionContext.priorStepSummaries, ["Step 1 completed"]);
  assert.deepStrictEqual(unpacked.data.decisionContext.dependsOnStepIds, ["step-1"]);
  assert.deepStrictEqual(unpacked.data.resumeContext.completedStepIds, ["step-1"]);
  assert.strictEqual(unpacked.data.resumeContext.nextStepId, "step-2");
  assert.deepStrictEqual(unpacked.data.resumeContext.outputKeys, ["output-1"]);
  assert.deepStrictEqual(unpacked.data.fileDiffSummary.createdPaths, ["/path/to/file.txt"]);
});

test("wrapWorkflowStepCheckpoint handles checkpoint with compensation model", async () => {
  const checkpoint = createMinimalCheckpoint();
  checkpoint.compensationModel = {
    kind: "compensate",
    steps: [
      { action: "rollback", target: "/tmp/file.txt" },
    ],
  };

  const envelope = await wrapWorkflowStepCheckpoint(checkpoint);
  const unpacked = await unwrapWorkflowStepCheckpoint(envelope);

  assert.ok(unpacked.data.compensationModel);
  assert.strictEqual((unpacked.data.compensationModel as { kind: string }).kind, "compensate");
});

test("wrapWorkflowStepCheckpoint handles checkpoint with upstream artifact refs", async () => {
  const checkpoint = createMinimalCheckpoint();
  checkpoint.upstreamArtifactRefs.push({
    artifactId: "artifact-ref-1",
    kind: "source_code",
    uri: "artifact://artifact-ref-1",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  const envelope = await wrapWorkflowStepCheckpoint(checkpoint);
  const unpacked = await unwrapWorkflowStepCheckpoint(envelope);

  assert.strictEqual(unpacked.data.upstreamArtifactRefs.length, 1);
  assert.strictEqual(unpacked.data.upstreamArtifactRefs[0].artifactId, "artifact-ref-1");
});

test("createCheckpointEnvelope rejects data that exceeds maxSizeBytes after compression", async () => {
  // Create data that compresses to more than 100 bytes
  const largeData = { data: "x".repeat(1000) };

  await assert.rejects(
    async () => createCheckpointEnvelope(largeData, "test.v1", { maxSizeBytes: 100 }),
    CheckpointSizeExceededError,
  );
});

test("CheckpointSizeExceededError has correct error properties", async () => {
  const largeData = { data: "x".repeat(DEFAULT_MAX_CHECKPOINT_SIZE_BYTES + 1) };

  try {
    await createCheckpointEnvelope(largeData, "test.v1");
    assert.fail("Should have thrown");
  } catch (error) {
    if (error instanceof CheckpointSizeExceededError) {
      assert.strictEqual(error.code, "checkpoint.size_exceeded");
      assert.strictEqual(error.name, "CheckpointSizeExceededError");
      assert.strictEqual(error.statusCode, 413);
      assert.strictEqual(error.category, "storage");
      assert.strictEqual(error.source, "runtime");
      assert.strictEqual(error.retryable, false);
      assert.ok(error.details);
    } else {
      throw error;
    }
  }
});

test("CheckpointEnvelopeInvalidError has correct error properties", async () => {
  const invalidEnvelope = {
    version: "invalid",
    schema: "test.v1",
    payload: "!!!",
    metadata: {},
  } as unknown as CheckpointEnvelope;

  try {
    await unpackCheckpointEnvelope(invalidEnvelope);
    assert.fail("Should have thrown");
  } catch (error) {
    if (error instanceof CheckpointEnvelopeInvalidError) {
      assert.strictEqual(error.code, "checkpoint.envelope_invalid");
      assert.strictEqual(error.name, "CheckpointEnvelopeInvalidError");
      assert.strictEqual(error.statusCode, 422);
      assert.strictEqual(error.category, "storage");
      assert.strictEqual(error.source, "runtime");
      assert.strictEqual(error.retryable, false);
    } else {
      throw error;
    }
  }
});

test("multiple wrap and unwrap cycles produce identical results", async () => {
  const original = createMinimalCheckpoint();
  original.output = { cycle: "test", iterations: 5 };

  const envelope1 = await wrapWorkflowStepCheckpoint(original);
  const unpacked1 = await unwrapWorkflowStepCheckpoint(envelope1);

  const envelope2 = await wrapWorkflowStepCheckpoint(unpacked1.data);
  const unpacked2 = await unwrapWorkflowStepCheckpoint(envelope2);

  assert.deepStrictEqual(unpacked1.data, unpacked2.data);
  assert.deepStrictEqual(original.output, unpacked2.data.output);
});

test("checkpoint envelope with small max size succeeds for small data", async () => {
  const data = { tiny: true };

  // With a reasonable small max size, small data should work
  const envelope = await createCheckpointEnvelope(data, "test.v1", { maxSizeBytes: 100 });
  assert.ok(envelope);
});
