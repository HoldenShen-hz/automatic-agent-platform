import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
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
} from "../../../../../src/platform/state-evidence/checkpoints/index.js";

/**
 * Sample checkpoint data for testing
 */
interface TestCheckpointData {
  taskId: string;
  executionId: string | null;
  workflowId: string;
  stepId: string;
  status: string;
  output: Record<string, unknown>;
  decisionContext: {
    source: string;
    request: string;
    routeReason: string | null;
    priorStepSummaries: string[];
    dependsOnStepIds: string[];
  };
  resumeContext: {
    completedStepIds: string[];
    nextStepId: string | null;
    outputKeys: string[];
  };
}

function createTestCheckpoint(overrides?: Partial<TestCheckpointData>): TestCheckpointData {
  return {
    taskId: "task-123",
    executionId: "exec-456",
    workflowId: "wf-789",
    stepId: "step-001",
    status: "completed",
    output: { result: "success", value: 42 },
    decisionContext: {
      source: "model:gpt-4o",
      request: "Process user request",
      routeReason: "normal",
      priorStepSummaries: ["Step 0 completed"],
      dependsOnStepIds: [],
    },
    resumeContext: {
      completedStepIds: ["step-000", "step-001"],
      nextStepId: "step-002",
      outputKeys: ["result"],
    },
    ...overrides,
  };
}

describe("CheckpointEnvelope", () => {
  describe("createCheckpointEnvelope", () => {
    it("should create a valid checkpoint envelope", async () => {
      const checkpoint = createTestCheckpoint();
      const envelope = await createCheckpointEnvelope(checkpoint, "test.v1");

      assert.strictEqual(envelope.version, CHECKPOINT_ENVELOPE_SCHEMA_VERSION);
      assert.strictEqual(envelope.schema, "test.v1");
      assert.strictEqual(typeof envelope.payload, "string");
      assert.strictEqual(envelope.metadata.algorithm, "gzip");
      assert.strictEqual(envelope.metadata.originalSizeBytes > 0, true);
      assert.strictEqual(envelope.metadata.compressedSizeBytes > 0, true);
      assert.strictEqual(envelope.metadata.checksum.length, 64); // SHA-256 hex
      assert.ok(envelope.metadata.createdAt);
    });

    it("should compress the payload using gzip", async () => {
      const checkpoint = createTestCheckpoint();
      const envelope = await createCheckpointEnvelope(checkpoint, "test.v1");

      // Compression ratio should be reasonable for JSON
      const ratio = envelope.metadata.compressedSizeBytes / envelope.metadata.originalSizeBytes;
      assert.ok(ratio > 0 && ratio < 1, "Payload should be compressed");
    });

    it("should include payload schema version in metadata", async () => {
      const checkpoint = createTestCheckpoint();
      const envelope = await createCheckpointEnvelope(checkpoint, "custom-schema.v2");

      assert.strictEqual(envelope.metadata.payloadSchemaVersion, "custom-schema.v2");
    });

    it("should generate valid SHA-256 checksum", async () => {
      const checkpoint = createTestCheckpoint();
      const envelope = await createCheckpointEnvelope(checkpoint, "test.v1");

      // Checksum should be 64 character hex string (SHA-256)
      assert.match(envelope.metadata.checksum, /^[a-f0-9]{64}$/);
    });

    it("should respect custom payload schema version", async () => {
      const checkpoint = createTestCheckpoint();
      const envelope = await createCheckpointEnvelope(checkpoint, "workflow_step_checkpoint.v1");

      assert.strictEqual(envelope.schema, "workflow_step_checkpoint.v1");
      assert.strictEqual(envelope.metadata.payloadSchemaVersion, "workflow_step_checkpoint.v1");
    });
  });

  describe("unpackCheckpointEnvelope", () => {
    it("should round-trip checkpoint data correctly", async () => {
      const originalCheckpoint = createTestCheckpoint();
      const envelope = await createCheckpointEnvelope(originalCheckpoint, "test.v1");
      const unpacked = await unpackCheckpointEnvelope<TestCheckpointData>(envelope);

      assert.deepStrictEqual(unpacked.data, originalCheckpoint);
      assert.strictEqual(unpacked.wasCompressed, true);
      assert.strictEqual(unpacked.metadata.algorithm, "gzip");
    });

    it("should preserve all checkpoint fields after round-trip", async () => {
      const originalCheckpoint = createTestCheckpoint({
        taskId: "task-special-123",
        output: { nested: { deeply: { value: true } } },
      });
      const envelope = await createCheckpointEnvelope(originalCheckpoint, "test.v1");
      const unpacked = await unpackCheckpointEnvelope<TestCheckpointData>(envelope);

      assert.strictEqual(unpacked.data.taskId, "task-special-123");
      assert.deepStrictEqual((unpacked.data.output as Record<string, unknown>).nested, { deeply: { value: true } });
    });

    it("should include correct metadata after unpacking", async () => {
      const checkpoint = createTestCheckpoint();
      const envelope = await createCheckpointEnvelope(checkpoint, "test.v1");
      const unpacked = await unpackCheckpointEnvelope(envelope);

      assert.strictEqual(unpacked.metadata.originalSizeBytes, envelope.metadata.originalSizeBytes);
      assert.strictEqual(unpacked.metadata.compressedSizeBytes, envelope.metadata.compressedSizeBytes);
      assert.strictEqual(unpacked.metadata.checksum, envelope.metadata.checksum);
    });

    it("should throw CheckpointEnvelopeInvalidError for invalid envelope", async () => {
      const invalidEnvelope = {
        version: "invalid-version",
        schema: "test.v1",
        payload: "not-base64!!!",
        metadata: {},
      } as unknown as CheckpointEnvelope;

      await assert.rejects(
        async () => unpackCheckpointEnvelope(invalidEnvelope),
        CheckpointEnvelopeInvalidError,
      );
    });

    it("should throw CheckpointEnvelopeInvalidError for corrupted checksum", async () => {
      const checkpoint = createTestCheckpoint();
      const envelope = await createCheckpointEnvelope(checkpoint, "test.v1");

      // Corrupt the checksum in the envelope
      envelope.metadata.checksum = "a".repeat(64);

      await assert.rejects(
        async () => unpackCheckpointEnvelope(envelope),
        CheckpointEnvelopeInvalidError,
      );
    });

    it("should throw CheckpointEnvelopeInvalidError for corrupted payload", async () => {
      const checkpoint = createTestCheckpoint();
      const envelope = await createCheckpointEnvelope(checkpoint, "test.v1");

      // Replace payload with invalid base64
      envelope.payload = "not-valid-base64!!!";

      await assert.rejects(
        async () => unpackCheckpointEnvelope(envelope),
        CheckpointEnvelopeInvalidError,
      );
    });

    it("should throw CheckpointEnvelopeInvalidError for wrong version", async () => {
      const checkpoint = createTestCheckpoint();
      const envelope = await createCheckpointEnvelope(checkpoint, "test.v1");

      // Change version to invalid
      envelope.version = "checkpoint_envelope.v999";

      await assert.rejects(
        async () => unpackCheckpointEnvelope(envelope),
        CheckpointEnvelopeInvalidError,
      );
    });
  });

  describe("CheckpointSizeExceededError", () => {
    it("should throw when checkpoint exceeds default size limit", async () => {
      // Create a very large checkpoint
      const largeOutput = { data: "x".repeat(DEFAULT_MAX_CHECKPOINT_SIZE_BYTES + 1) };
      const checkpoint = createTestCheckpoint({ output: largeOutput });

      await assert.rejects(
        async () => createCheckpointEnvelope(checkpoint, "test.v1"),
        CheckpointSizeExceededError,
      );
    });

    it("should throw when checkpoint exceeds custom size limit", async () => {
      const checkpoint = createTestCheckpoint({
        output: { data: "x".repeat(1000) },
      });

      await assert.rejects(
        async () => createCheckpointEnvelope(checkpoint, "test.v1", { maxSizeBytes: 100 }),
        CheckpointSizeExceededError,
      );
    });

    it("should include size information in error details", async () => {
      const largeOutput = { data: "x".repeat(DEFAULT_MAX_CHECKPOINT_SIZE_BYTES + 1000) };
      const checkpoint = createTestCheckpoint({ output: largeOutput });

      try {
        await createCheckpointEnvelope(checkpoint, "test.v1");
        assert.fail("Should have thrown");
      } catch (error) {
        if (error instanceof CheckpointSizeExceededError) {
          assert.strictEqual(error.originalSizeBytes > DEFAULT_MAX_CHECKPOINT_SIZE_BYTES, true);
          assert.strictEqual(error.maxSizeBytes, DEFAULT_MAX_CHECKPOINT_SIZE_BYTES);
          assert.ok(error.details);
          assert.ok(error.details.originalSizeBytes > error.details.maxSizeBytes);
        } else {
          throw error;
        }
      }
    });

    it("should allow checkpoint within size limit", async () => {
      const checkpoint = createTestCheckpoint({
        output: { data: "small content" },
      });

      const envelope = await createCheckpointEnvelope(checkpoint, "test.v1", {
        maxSizeBytes: 1024 * 1024, // 1MB limit
      });

      assert.ok(envelope);
      assert.strictEqual(envelope.metadata.originalSizeBytes < 1024 * 1024, true);
    });
  });

  describe("helper functions", () => {
    it("should return correct original size", async () => {
      const checkpoint = createTestCheckpoint();
      const envelope = await createCheckpointEnvelope(checkpoint, "test.v1");

      assert.strictEqual(getEnvelopeOriginalSize(envelope), envelope.metadata.originalSizeBytes);
    });

    it("should return correct compressed size", async () => {
      const checkpoint = createTestCheckpoint();
      const envelope = await createCheckpointEnvelope(checkpoint, "test.v1");

      assert.strictEqual(getEnvelopeCompressedSize(envelope), envelope.metadata.compressedSizeBytes);
    });

    it("should calculate correct compression ratio", async () => {
      const checkpoint = createTestCheckpoint();
      const envelope = await createCheckpointEnvelope(checkpoint, "test.v1");

      const expectedRatio = envelope.metadata.compressedSizeBytes / envelope.metadata.originalSizeBytes;
      assert.strictEqual(getEnvelopeCompressionRatio(envelope), expectedRatio);
    });

    it("should handle zero-size payload in compression ratio", async () => {
      const envelope: CheckpointEnvelope = {
        version: CHECKPOINT_ENVELOPE_SCHEMA_VERSION,
        schema: "test.v1",
        payload: "",
        metadata: {
          originalSizeBytes: 0,
          compressedSizeBytes: 0,
          checksum: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", // SHA-256 of empty string
          createdAt: new Date().toISOString(),
          algorithm: "gzip",
          payloadSchemaVersion: "test.v1",
        },
      };

      // Should return 1 when original size is 0
      assert.strictEqual(getEnvelopeCompressionRatio(envelope), 1);
    });
  });

  describe("wrapWorkflowStepCheckpoint and unwrapWorkflowStepCheckpoint", () => {
    it("should wrap and unwrap workflow step checkpoint", async () => {
      const checkpoint = {
        schemaVersion: "workflow_step_checkpoint.v1",
        taskId: "task-123",
        executionId: "exec-456",
        workflowId: "wf-789",
        divisionId: "div-001",
        stepId: "step-001",
        roleId: "role-001",
        outputKey: "output-key",
        status: "completed" as const,
        producedAt: new Date().toISOString(),
        output: { result: "success" },
        decisionContext: {
          source: "test",
          request: "test request",
          routeReason: null,
          priorStepSummaries: [],
          dependsOnStepIds: [],
        },
        resumeContext: {
          completedStepIds: ["step-000"],
          nextStepId: "step-002",
          outputKeys: ["result"],
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

      const envelope = await wrapWorkflowStepCheckpoint(checkpoint);
      const unpacked = await unwrapWorkflowStepCheckpoint(envelope);

      assert.deepStrictEqual(unpacked.data, checkpoint);
      assert.strictEqual(unpacked.metadata.payloadSchemaVersion, "workflow_step_checkpoint.v1");
    });
  });

  describe("JSON serialization", () => {
    it("should serialize and deserialize envelope as JSON", async () => {
      const checkpoint = createTestCheckpoint();
      const envelope = await createCheckpointEnvelope(checkpoint, "test.v1");

      // Serialize to JSON
      const json = JSON.stringify(envelope);
      assert.strictEqual(typeof json, "string");

      // Deserialize from JSON
      const parsed = JSON.parse(json) as CheckpointEnvelope;
      assert.strictEqual(parsed.version, envelope.version);
      assert.strictEqual(parsed.schema, envelope.schema);
      assert.strictEqual(parsed.metadata.originalSizeBytes, envelope.metadata.originalSizeBytes);

      // Should still be able to unpack after JSON round-trip
      const unpacked = await unpackCheckpointEnvelope<TestCheckpointData>(parsed);
      assert.deepStrictEqual(unpacked.data, checkpoint);
    });

    it("should handle envelope with special characters in output", async () => {
      const checkpoint = createTestCheckpoint({
        output: {
          text: "Hello, 世界! 🌍 <script>alert('xss')</script>",
          emoji: "🎉",
          unicode: "日本語",
        },
      });

      const envelope = await createCheckpointEnvelope(checkpoint, "test.v1");
      const json = JSON.stringify(envelope);
      const parsed = JSON.parse(json) as CheckpointEnvelope;
      const unpacked = await unpackCheckpointEnvelope<typeof checkpoint>(parsed);

      assert.strictEqual(unpacked.data.output.text, checkpoint.output.text);
      assert.strictEqual(unpacked.data.output.emoji, checkpoint.output.emoji);
      assert.strictEqual(unpacked.data.output.unicode, checkpoint.output.unicode);
    });
  });

  describe("compression effectiveness", () => {
    it("should compress repetitive data effectively", async () => {
      // Create checkpoint with highly repetitive output (good compression)
      const repetitiveData = { data: "AAAAAAAAAA".repeat(1000) };
      const checkpoint = createTestCheckpoint({ output: repetitiveData });

      const envelope = await createCheckpointEnvelope(checkpoint, "test.v1");

      // Repetitive data should compress well (ratio < 0.1)
      const ratio = envelope.metadata.compressedSizeBytes / envelope.metadata.originalSizeBytes;
      assert.ok(ratio < 0.1, `Compression ratio ${ratio} should be < 0.1 for repetitive data`);
    });

    it("should handle already-compressed binary data (poor compression)", async () => {
      // Create checkpoint with random-like data (poor compression)
      const randomData = Array.from({ length: 1000 }, () => Math.random().toString(36).charAt(2)).join("");
      const checkpoint = createTestCheckpoint({ output: { data: randomData } });

      const envelope = await createCheckpointEnvelope(checkpoint, "test.v1");

      // Random data should compress poorly (ratio close to 1)
      const ratio = envelope.metadata.compressedSizeBytes / envelope.metadata.originalSizeBytes;
      assert.ok(ratio > 0.8, `Compression ratio ${ratio} should be > 0.8 for random data`);
    });
  });

  describe("error handling", () => {
    it("should handle empty checkpoint", async () => {
      const emptyCheckpoint = createTestCheckpoint({ output: {} });
      const envelope = await createCheckpointEnvelope(emptyCheckpoint, "test.v1");

      assert.ok(envelope);
      assert.strictEqual(envelope.metadata.originalSizeBytes > 0, true);
    });

    it("should handle checkpoint with null values", async () => {
      const checkpointWithNulls = createTestCheckpoint({
        executionId: null,
        decisionContext: {
          ...createTestCheckpoint().decisionContext,
          routeReason: null,
        },
        resumeContext: {
          ...createTestCheckpoint().resumeContext,
          nextStepId: null,
        },
      });

      const envelope = await createCheckpointEnvelope(checkpointWithNulls, "test.v1");
      const unpacked = await unpackCheckpointEnvelope(envelope);

      assert.strictEqual(unpacked.data.executionId, null);
      assert.strictEqual(unpacked.data.decisionContext.routeReason, null);
      assert.strictEqual(unpacked.data.resumeContext.nextStepId, null);
    });

    it("should handle checkpoint with empty arrays", async () => {
      const checkpointWithArrays = createTestCheckpoint({
        decisionContext: {
          ...createTestCheckpoint().decisionContext,
          priorStepSummaries: [],
          dependsOnStepIds: [],
        },
        resumeContext: {
          ...createTestCheckpoint().resumeContext,
          completedStepIds: [],
          outputKeys: [],
        },
      });

      const envelope = await createCheckpointEnvelope(checkpointWithArrays, "test.v1");
      const unpacked = await unpackCheckpointEnvelope(envelope);

      assert.deepStrictEqual(unpacked.data.decisionContext.priorStepSummaries, []);
      assert.deepStrictEqual(unpacked.data.decisionContext.dependsOnStepIds, []);
      assert.deepStrictEqual(unpacked.data.resumeContext.completedStepIds, []);
      assert.deepStrictEqual(unpacked.data.resumeContext.outputKeys, []);
    });
  });
});
