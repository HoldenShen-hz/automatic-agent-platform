/**
 * Tests for CheckpointRefValidator
 *
 * Tests validation of checkpoint references including:
 * - CheckpointRef structural validation
 * - Storage URI validation
 * - Checksum validation
 * - Checkpoint storage accessibility
 */

import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import assert from "node:assert";

import {
  type CheckpointRef,
  type CheckpointRefValidationResult,
  validateCheckpointRef,
  validateCheckpointStorage,
  requireValidCheckpointRef,
} from "../../../src/platform/five-plane-state-evidence/checkpoints/checkpoint-ref-validator.js";
import { ValidationError } from "../../../src/platform/contracts/errors.js";

describe("CheckpointRefValidator", () => {
  describe("validateCheckpointRef", () => {
    it("should validate a valid checkpoint reference", () => {
      const validRef: CheckpointRef = {
        checkpointId: "checkpoint-123",
        storageUri: "file:///var/checkpoints/checkpoint-123.json",
        checksum: "a".repeat(64),
        metadata: { sizeBytes: 1024 },
        createdAt: "2026-01-15T10:30:00.000Z",
      };

      const result = validateCheckpointRef(validRef, {
        requireChecksum: true,
        requireStorageUri: true,
      });

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it("should reject null checkpoint reference", () => {
      const result = validateCheckpointRef(null);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("ref_required")));
    });

    it("should reject undefined checkpoint reference", () => {
      const result = validateCheckpointRef(undefined);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("ref_required")));
    });

    it("should reject non-object checkpoint reference", () => {
      const result = validateCheckpointRef("not an object");

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("ref_required")));
    });

    it("should reject empty checkpointId", () => {
      const result = validateCheckpointRef({
        checkpointId: "",
        storageUri: "file:///path/to/checkpoint.json",
      });

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("checkpoint_id_required")));
    });

    it("should reject whitespace-only checkpointId", () => {
      const result = validateCheckpointRef({
        checkpointId: "   ",
        storageUri: "file:///path/to/checkpoint.json",
      });

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("checkpoint_id_required")));
    });

    it("should reject missing storageUri when required", () => {
      const result = validateCheckpointRef({
        checkpointId: "checkpoint-123",
      });

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("storage_uri_required")));
    });

    it("should reject empty storageUri", () => {
      const result = validateCheckpointRef({
        checkpointId: "checkpoint-123",
        storageUri: "",
      });

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("storage_uri_required")));
    });

    it("should reject invalid storageUri format", () => {
      const result = validateCheckpointRef({
        checkpointId: "checkpoint-123",
        storageUri: "not-a-valid-uri",
      });

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("storage_uri_invalid")));
    });

    it("should accept valid file:// URI", () => {
      const result = validateCheckpointRef({
        checkpointId: "checkpoint-123",
        storageUri: "file:///path/to/checkpoint.json",
      });

      assert.strictEqual(result.valid, true);
    });

    it("should accept valid s3:// URI", () => {
      const result = validateCheckpointRef({
        checkpointId: "checkpoint-123",
        storageUri: "s3://bucket/path/checkpoint.json",
      });

      assert.strictEqual(result.valid, true);
    });

    it("should accept valid gs:// URI", () => {
      const result = validateCheckpointRef({
        checkpointId: "checkpoint-123",
        storageUri: "gs://bucket/path/checkpoint.json",
      });

      assert.strictEqual(result.valid, true);
    });

    it("should accept valid https:// URI", () => {
      const result = validateCheckpointRef({
        checkpointId: "checkpoint-123",
        storageUri: "https://example.com/checkpoints/checkpoint.json",
      });

      assert.strictEqual(result.valid, true);
    });

    it("should reject invalid checksum format", () => {
      const result = validateCheckpointRef({
        checkpointId: "checkpoint-123",
        storageUri: "file:///path/to/checkpoint.json",
        checksum: "not-a-valid-sha256",
      });

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("checksum_format_invalid")));
    });

    it("should reject checksum with wrong length", () => {
      const result = validateCheckpointRef({
        checkpointId: "checkpoint-123",
        storageUri: "file:///path/to/checkpoint.json",
        checksum: "abc123",
      });

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("checksum_format_invalid")));
    });

    it("should warn on missing checksum when required", () => {
      const result = validateCheckpointRef(
        {
          checkpointId: "checkpoint-123",
          storageUri: "file:///path/to/checkpoint.json",
        },
        { requireChecksum: true }
      );

      assert.strictEqual(result.valid, true);
      assert.ok(result.warnings.some((w) => w.includes("checksum_missing")));
    });

    it("should accept valid SHA-256 checksum", () => {
      const sha256 = createHash("sha256").update("test content").digest("hex");
      const result = validateCheckpointRef({
        checkpointId: "checkpoint-123",
        storageUri: "file:///path/to/checkpoint.json",
        checksum: sha256,
      });

      assert.strictEqual(result.valid, true);
    });

    it("should reject non-object metadata", () => {
      const result = validateCheckpointRef({
        checkpointId: "checkpoint-123",
        storageUri: "file:///path/to/checkpoint.json",
        metadata: "not an object",
      });

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("metadata_must_be_object")));
    });

    it("should reject array as metadata", () => {
      const result = validateCheckpointRef({
        checkpointId: "checkpoint-123",
        storageUri: "file:///path/to/checkpoint.json",
        metadata: ["array", "not", "object"],
      });

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("metadata_must_be_object")));
    });

    it("should accept valid metadata object", () => {
      const result = validateCheckpointRef({
        checkpointId: "checkpoint-123",
        storageUri: "file:///path/to/checkpoint.json",
        metadata: { sizeBytes: 1024, format: "json" },
      });

      assert.strictEqual(result.valid, true);
    });

    it("should reject non-string createdAt", () => {
      const result = validateCheckpointRef({
        checkpointId: "checkpoint-123",
        storageUri: "file:///path/to/checkpoint.json",
        createdAt: 1234567890,
      });

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("created_at_must_be_string")));
    });

    it("should reject invalid ISO 8601 createdAt", () => {
      const result = validateCheckpointRef({
        checkpointId: "checkpoint-123",
        storageUri: "file:///path/to/checkpoint.json",
        createdAt: "not-a-valid-date",
      });

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("created_at_invalid")));
    });

    it("should accept valid ISO 8601 createdAt", () => {
      const result = validateCheckpointRef({
        checkpointId: "checkpoint-123",
        storageUri: "file:///path/to/checkpoint.json",
        createdAt: "2026-01-15T10:30:00.000Z",
      });

      assert.strictEqual(result.valid, true);
    });

    it("should skip storageUri validation when requireStorageUri is false", () => {
      const result = validateCheckpointRef(
        {
          checkpointId: "checkpoint-123",
        },
        { requireStorageUri: false }
      );

      assert.strictEqual(result.valid, true);
    });
  });

  describe("requireValidCheckpointRef", () => {
    it("should not throw for valid checkpoint reference", () => {
      const validRef: CheckpointRef = {
        checkpointId: "checkpoint-123",
        storageUri: "file:///path/to/checkpoint.json",
        checksum: "a".repeat(64),
      };

      assert.doesNotThrow(() => {
        requireValidCheckpointRef(validRef);
      });
    });

    it("should throw ValidationError for invalid checkpoint reference", () => {
      assert.throws(
        () => {
          requireValidCheckpointRef(null);
        },
        ValidationError
      );
    });

    it("should include error details in ValidationError", () => {
      try {
        requireValidCheckpointRef({
          checkpointId: "",
          storageUri: "",
        });
        assert.fail("Should have thrown ValidationError");
      } catch (error) {
        assert.ok(error instanceof ValidationError);
        const validationError = error as ValidationError;
        assert.ok(validationError.message.includes("checkpoint.ref_invalid"));
      }
    });
  });
});