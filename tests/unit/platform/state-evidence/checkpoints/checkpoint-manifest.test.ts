/**
 * Tests for CheckpointManifest
 *
 * Tests checkpoint manifest functionality including:
 * - Manifest validation
 * - Manifest creation
 * - Combined checksum computation
 * - Manifest verification
 */

import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import assert from "node:assert";

import {
  type CheckpointManifest,
  type CheckpointRef,
  validateCheckpointManifest,
  computeCombinedChecksum,
  verifyManifestChecksum,
  createCheckpointManifest,
  requireValidCheckpointManifest,
} from "../../../src/platform/five-plane-state-evidence/checkpoints/checkpoint-manifest.js";
import { ValidationError } from "../../../src/platform/contracts/errors.js";

describe("CheckpointManifest", () => {
  const createValidCheckpointRef = (id: string): CheckpointRef => ({
    checkpointId: id,
    storageUri: `file:///checkpoints/${id}.json`,
    checksum: createHash("sha256").update(id).digest("hex"),
    metadata: { sizeBytes: 1024 },
    createdAt: new Date().toISOString(),
  });

  describe("validateCheckpointManifest", () => {
    it("should validate a valid manifest", () => {
      const manifest: CheckpointManifest = {
        manifestId: "manifest-001",
        schemaVersion: "checkpoint_manifest.v1",
        checkpoints: [createValidCheckpointRef("cp-001")],
        createdAt: new Date().toISOString(),
        executionId: "exec-001",
        workflowId: "workflow-001",
      };

      const result = validateCheckpointManifest(manifest);

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it("should reject null manifest", () => {
      const result = validateCheckpointManifest(null);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("manifest_required")));
    });

    it("should reject undefined manifest", () => {
      const result = validateCheckpointManifest(undefined);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("manifest_required")));
    });

    it("should reject non-object manifest", () => {
      const result = validateCheckpointManifest("not an object");

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("manifest_required")));
    });

    it("should reject missing manifestId", () => {
      const manifest = {
        schemaVersion: "checkpoint_manifest.v1",
        checkpoints: [],
        createdAt: new Date().toISOString(),
      };

      const result = validateCheckpointManifest(manifest);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("manifest_id_required")));
    });

    it("should reject empty manifestId", () => {
      const manifest = {
        manifestId: "",
        schemaVersion: "checkpoint_manifest.v1",
        checkpoints: [],
        createdAt: new Date().toISOString(),
      };

      const result = validateCheckpointManifest(manifest);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("manifest_id_required")));
    });

    it("should reject missing schemaVersion", () => {
      const manifest = {
        manifestId: "manifest-001",
        checkpoints: [],
        createdAt: new Date().toISOString(),
      };

      const result = validateCheckpointManifest(manifest);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("schema_version_required")));
    });

    it("should reject non-array checkpoints", () => {
      const manifest = {
        manifestId: "manifest-001",
        schemaVersion: "checkpoint_manifest.v1",
        checkpoints: "not an array",
        createdAt: new Date().toISOString(),
      };

      const result = validateCheckpointManifest(manifest);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("checkpoints_required")));
    });

    it("should warn on empty checkpoints when requireAtLeastOneCheckpoint is true", () => {
      const manifest = {
        manifestId: "manifest-001",
        schemaVersion: "checkpoint_manifest.v1",
        checkpoints: [],
        createdAt: new Date().toISOString(),
      };

      const result = validateCheckpointManifest(manifest, {
        requireAtLeastOneCheckpoint: true,
      });

      assert.strictEqual(result.valid, true);
      assert.ok(result.warnings.some((w) => w.includes("no_checkpoints")));
    });

    it("should include checkpoint validation errors", () => {
      const manifest = {
        manifestId: "manifest-001",
        schemaVersion: "checkpoint_manifest.v1",
        checkpoints: [
          {
            checkpointId: "cp-001",
            storageUri: "file:///path/checkpoint.json",
          },
        ],
        createdAt: new Date().toISOString(),
      };

      const result = validateCheckpointManifest(manifest);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("checkpoint[0]")));
    });

    it("should reject missing createdAt", () => {
      const manifest = {
        manifestId: "manifest-001",
        schemaVersion: "checkpoint_manifest.v1",
        checkpoints: [],
      };

      const result = validateCheckpointManifest(manifest);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("created_at_required")));
    });

    it("should reject invalid ISO 8601 createdAt", () => {
      const manifest = {
        manifestId: "manifest-001",
        schemaVersion: "checkpoint_manifest.v1",
        checkpoints: [],
        createdAt: "not-a-valid-date",
      };

      const result = validateCheckpointManifest(manifest);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("created_at_invalid")));
    });

    it("should require executionId when option is set", () => {
      const manifest = {
        manifestId: "manifest-001",
        schemaVersion: "checkpoint_manifest.v1",
        checkpoints: [],
        createdAt: new Date().toISOString(),
      };

      const result = validateCheckpointManifest(manifest, {
        requireExecutionId: true,
      });

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("execution_id_required")));
    });

    it("should accept valid executionId", () => {
      const manifest = {
        manifestId: "manifest-001",
        schemaVersion: "checkpoint_manifest.v1",
        checkpoints: [],
        createdAt: new Date().toISOString(),
        executionId: "exec-001",
      };

      const result = validateCheckpointManifest(manifest, {
        requireExecutionId: true,
      });

      assert.strictEqual(result.valid, true);
    });

    it("should reject non-string workflowId", () => {
      const manifest = {
        manifestId: "manifest-001",
        schemaVersion: "checkpoint_manifest.v1",
        checkpoints: [],
        createdAt: new Date().toISOString(),
        workflowId: 123,
      };

      const result = validateCheckpointManifest(manifest);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("workflow_id_must_be_string")));
    });

    it("should accept null workflowId", () => {
      const manifest = {
        manifestId: "manifest-001",
        schemaVersion: "checkpoint_manifest.v1",
        checkpoints: [],
        createdAt: new Date().toISOString(),
        workflowId: null,
      };

      const result = validateCheckpointManifest(manifest);

      assert.strictEqual(result.valid, true);
    });

    it("should reject negative totalSizeBytes", () => {
      const manifest = {
        manifestId: "manifest-001",
        schemaVersion: "checkpoint_manifest.v1",
        checkpoints: [],
        createdAt: new Date().toISOString(),
        totalSizeBytes: -100,
      };

      const result = validateCheckpointManifest(manifest);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("total_size_bytes_must_be_nonnegative_number")));
    });

    it("should accept zero totalSizeBytes", () => {
      const manifest = {
        manifestId: "manifest-001",
        schemaVersion: "checkpoint_manifest.v1",
        checkpoints: [],
        createdAt: new Date().toISOString(),
        totalSizeBytes: 0,
      };

      const result = validateCheckpointManifest(manifest);

      assert.strictEqual(result.valid, true);
    });

    it("should reject invalid combinedChecksum format", () => {
      const manifest = {
        manifestId: "manifest-001",
        schemaVersion: "checkpoint_manifest.v1",
        checkpoints: [],
        createdAt: new Date().toISOString(),
        combinedChecksum: "not-a-valid-sha256",
      };

      const result = validateCheckpointManifest(manifest);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("combined_checksum_format_invalid")));
    });

    it("should accept valid combinedChecksum", () => {
      const manifest = {
        manifestId: "manifest-001",
        schemaVersion: "checkpoint_manifest.v1",
        checkpoints: [],
        createdAt: new Date().toISOString(),
        combinedChecksum: "a".repeat(64),
      };

      const result = validateCheckpointManifest(manifest);

      assert.strictEqual(result.valid, true);
    });

    it("should warn on missing combinedChecksum when recommended", () => {
      const manifest = {
        manifestId: "manifest-001",
        schemaVersion: "checkpoint_manifest.v1",
        checkpoints: [],
        createdAt: new Date().toISOString(),
      };

      const result = validateCheckpointManifest(manifest, {
        requireCombinedChecksum: true,
      });

      assert.strictEqual(result.valid, true);
      assert.ok(result.warnings.some((w) => w.includes("combined_checksum_missing")));
    });

    it("should reject non-object metadata", () => {
      const manifest = {
        manifestId: "manifest-001",
        schemaVersion: "checkpoint_manifest.v1",
        checkpoints: [],
        createdAt: new Date().toISOString(),
        metadata: "not an object",
      };

      const result = validateCheckpointManifest(manifest);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("metadata_must_be_object")));
    });

    it("should reject array as metadata", () => {
      const manifest = {
        manifestId: "manifest-001",
        schemaVersion: "checkpoint_manifest.v1",
        checkpoints: [],
        createdAt: new Date().toISOString(),
        metadata: ["array", "not", "object"],
      };

      const result = validateCheckpointManifest(manifest);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("metadata_must_be_object")));
    });

    it("should accept valid metadata object", () => {
      const manifest = {
        manifestId: "manifest-001",
        schemaVersion: "checkpoint_manifest.v1",
        checkpoints: [],
        createdAt: new Date().toISOString(),
        metadata: { createdBy: "test", version: "1.0" },
      };

      const result = validateCheckpointManifest(manifest);

      assert.strictEqual(result.valid, true);
    });
  });

  describe("computeCombinedChecksum", () => {
    it("should compute SHA-256 checksum from checkpoint refs", () => {
      const checkpointRefs: CheckpointRef[] = [
        {
          checkpointId: "cp-001",
          storageUri: "file:///cp-001.json",
          checksum: createHash("sha256").update("content1").digest("hex"),
        },
        {
          checkpointId: "cp-002",
          storageUri: "file:///cp-002.json",
          checksum: createHash("sha256").update("content2").digest("hex"),
        },
      ];

      const combined = computeCombinedChecksum(checkpointRefs);

      assert.strictEqual(combined.length, 64);
      assert.ok(/^[a-f0-9]{64}$/.test(combined));
    });

    it("should sort checkpoints by checkpointId for deterministic output", () => {
      const checkpointRefs: CheckpointRef[] = [
        {
          checkpointId: "cp-002",
          storageUri: "file:///cp-002.json",
          checksum: createHash("sha256").update("content2").digest("hex"),
        },
        {
          checkpointId: "cp-001",
          storageUri: "file:///cp-001.json",
          checksum: createHash("sha256").update("content1").digest("hex"),
        },
      ];

      const combined = computeCombinedChecksum(checkpointRefs);

      // Should produce same result regardless of input order
      const expected = computeCombinedChecksum([
        checkpointRefs[1],
        checkpointRefs[0],
      ]);

      assert.strictEqual(combined, expected);
    });

    it("should handle empty checkpoint array", () => {
      const combined = computeCombinedChecksum([]);

      assert.strictEqual(combined.length, 64);
    });

    it("should filter out checkpoints without checksums", () => {
      const checkpointRefs: CheckpointRef[] = [
        {
          checkpointId: "cp-001",
          storageUri: "file:///cp-001.json",
          checksum: createHash("sha256").update("content1").digest("hex"),
        },
        {
          checkpointId: "cp-002",
          storageUri: "file:///cp-002.json",
          // No checksum
        },
      ];

      const combined = computeCombinedChecksum(checkpointRefs);

      // Should only include cp-001's checksum in the hash
      assert.strictEqual(combined.length, 64);
    });
  });

  describe("verifyManifestChecksum", () => {
    it("should return true for valid manifest checksum", () => {
      const checkpointRefs: CheckpointRef[] = [
        {
          checkpointId: "cp-001",
          storageUri: "file:///cp-001.json",
          checksum: createHash("sha256").update("content1").digest("hex"),
        },
      ];
      const combinedChecksum = computeCombinedChecksum(checkpointRefs);

      const manifest: CheckpointManifest = {
        manifestId: "manifest-001",
        schemaVersion: "checkpoint_manifest.v1",
        checkpoints: checkpointRefs,
        createdAt: new Date().toISOString(),
        combinedChecksum,
      };

      assert.strictEqual(verifyManifestChecksum(manifest), true);
    });

    it("should return false for mismatched checksum", () => {
      const checkpointRefs: CheckpointRef[] = [
        {
          checkpointId: "cp-001",
          storageUri: "file:///cp-001.json",
          checksum: createHash("sha256").update("content1").digest("hex"),
        },
      ];

      const manifest: CheckpointManifest = {
        manifestId: "manifest-001",
        schemaVersion: "checkpoint_manifest.v1",
        checkpoints: checkpointRefs,
        createdAt: new Date().toISOString(),
        combinedChecksum: "a".repeat(64),
      };

      assert.strictEqual(verifyManifestChecksum(manifest), false);
    });

    it("should return false for empty checkpoints", () => {
      const manifest: CheckpointManifest = {
        manifestId: "manifest-001",
        schemaVersion: "checkpoint_manifest.v1",
        checkpoints: [],
        createdAt: new Date().toISOString(),
        combinedChecksum: "a".repeat(64),
      };

      assert.strictEqual(verifyManifestChecksum(manifest), false);
    });

    it("should return false for missing combinedChecksum", () => {
      const manifest: CheckpointManifest = {
        manifestId: "manifest-001",
        schemaVersion: "checkpoint_manifest.v1",
        checkpoints: [],
        createdAt: new Date().toISOString(),
      };

      assert.strictEqual(verifyManifestChecksum(manifest), false);
    });

    it("should be case-insensitive when comparing checksums", () => {
      const checkpointRefs: CheckpointRef[] = [
        {
          checkpointId: "cp-001",
          storageUri: "file:///cp-001.json",
          checksum: createHash("sha256").update("content1").digest("hex"),
        },
      ];
      const combinedChecksum = computeCombinedChecksum(checkpointRefs);

      const manifest: CheckpointManifest = {
        manifestId: "manifest-001",
        schemaVersion: "checkpoint_manifest.v1",
        checkpoints: checkpointRefs,
        createdAt: new Date().toISOString(),
        combinedChecksum: combinedChecksum.toUpperCase(),
      };

      assert.strictEqual(verifyManifestChecksum(manifest), true);
    });
  });

  describe("createCheckpointManifest", () => {
    it("should create manifest with all fields", () => {
      const checkpointRefs: CheckpointRef[] = [
        {
          checkpointId: "cp-001",
          storageUri: "file:///cp-001.json",
          checksum: createHash("sha256").update("content1").digest("hex"),
          metadata: { sizeBytes: 100 },
        },
        {
          checkpointId: "cp-002",
          storageUri: "file:///cp-002.json",
          checksum: createHash("sha256").update("content2").digest("hex"),
          metadata: { sizeBytes: 200 },
        },
      ];

      const manifest = createCheckpointManifest({
        manifestId: "manifest-001",
        checkpoints: checkpointRefs,
        executionId: "exec-001",
        workflowId: "workflow-001",
        metadata: { createdBy: "test" },
      });

      assert.strictEqual(manifest.manifestId, "manifest-001");
      assert.strictEqual(manifest.schemaVersion, "checkpoint_manifest.v1");
      assert.strictEqual(manifest.checkpoints.length, 2);
      assert.strictEqual(manifest.executionId, "exec-001");
      assert.strictEqual(manifest.workflowId, "workflow-001");
      assert.strictEqual(manifest.totalSizeBytes, 300);
      assert.ok(manifest.combinedChecksum);
      assert.ok(manifest.createdAt);
      assert.deepStrictEqual(manifest.metadata, { createdBy: "test" });
    });

    it("should create manifest without optional fields", () => {
      const checkpointRefs: CheckpointRef[] = [
        {
          checkpointId: "cp-001",
          storageUri: "file:///cp-001.json",
          checksum: createHash("sha256").update("content1").digest("hex"),
        },
      ];

      const manifest = createCheckpointManifest({
        manifestId: "manifest-001",
        checkpoints: checkpointRefs,
      });

      assert.strictEqual(manifest.manifestId, "manifest-001");
      assert.strictEqual(manifest.executionId, undefined);
      assert.strictEqual(manifest.workflowId, undefined);
      assert.strictEqual(manifest.metadata, undefined);
    });

    it("should compute totalSizeBytes from checkpoint metadata", () => {
      const checkpointRefs: CheckpointRef[] = [
        {
          checkpointId: "cp-001",
          storageUri: "file:///cp-001.json",
          checksum: createHash("sha256").update("content1").digest("hex"),
          metadata: { sizeBytes: 500 },
        },
      ];

      const manifest = createCheckpointManifest({
        manifestId: "manifest-001",
        checkpoints: checkpointRefs,
      });

      assert.strictEqual(manifest.totalSizeBytes, 500);
    });

    it("should handle checkpoints without size metadata", () => {
      const checkpointRefs: CheckpointRef[] = [
        {
          checkpointId: "cp-001",
          storageUri: "file:///cp-001.json",
          checksum: createHash("sha256").update("content1").digest("hex"),
        },
      ];

      const manifest = createCheckpointManifest({
        manifestId: "manifest-001",
        checkpoints: checkpointRefs,
      });

      assert.strictEqual(manifest.totalSizeBytes, 0);
    });
  });

  describe("requireValidCheckpointManifest", () => {
    it("should not throw for valid manifest", () => {
      const manifest: CheckpointManifest = {
        manifestId: "manifest-001",
        schemaVersion: "checkpoint_manifest.v1",
        checkpoints: [
          {
            checkpointId: "cp-001",
            storageUri: "file:///cp-001.json",
            checksum: createHash("sha256").update("content1").digest("hex"),
          },
        ],
        createdAt: new Date().toISOString(),
      };

      assert.doesNotThrow(() => {
        requireValidCheckpointManifest(manifest);
      });
    });

    it("should throw ValidationError for invalid manifest", () => {
      assert.throws(
        () => {
          requireValidCheckpointManifest(null);
        },
        ValidationError
      );
    });

    it("should include error details in ValidationError", () => {
      try {
        requireValidCheckpointManifest({
          manifestId: "",
          schemaVersion: "",
          checkpoints: "not an array",
          createdAt: "invalid",
        });
        assert.fail("Should have thrown ValidationError");
      } catch (error) {
        assert.ok(error instanceof ValidationError);
        const validationError = error as ValidationError;
        assert.ok(validationError.message.includes("checkpoint.manifest_invalid"));
      }
    });
  });
});