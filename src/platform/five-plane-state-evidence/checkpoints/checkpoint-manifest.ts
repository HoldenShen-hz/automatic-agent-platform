/**
 * Checkpoint Manifest Validator
 *
 * Provides validation for checkpoint manifests to ensure:
 * - Required fields are present
 * - Checkpoint references are valid
 * - Version information is correct
 * - Integrity checks are in place
 *
 * R23-14 Fix: CheckpointManifest validation
 */

import { createHash } from "node:crypto";

import { ValidationError } from "../../contracts/errors.js";
import type { CheckpointRef } from "./checkpoint-ref-validator.js";
import { validateCheckpointRef } from "./checkpoint-ref-validator.js";

/**
 * Checkpoint Manifest - metadata about a collection of checkpoints.
 *
 * Provides a manifest for a set of checkpoints that enables:
 * - Verification of checkpoint completeness
 * - Detection of corrupted or missing checkpoints
 * - Tracking of checkpoint lineage
 */
export interface CheckpointManifest {
  /** Unique identifier for this manifest */
  manifestId: string;
  /** Version of the manifest schema */
  schemaVersion: string;
  /** Checkpoints included in this manifest */
  checkpoints: CheckpointRef[];
  /** When the manifest was created */
  createdAt: string;
  /** ID of the execution this manifest covers */
  executionId?: string;
  /** ID of the workflow this manifest covers */
  workflowId?: string;
  /** Total size of all checkpoints in bytes */
  totalSizeBytes?: number;
  /** Total compressed size of all checkpoints in bytes */
  totalCompressedSizeBytes?: number;
  /** Combined checksum of all checkpoint contents */
  combinedChecksum?: string;
  /** Metadata about the checkpoint set */
  metadata?: Record<string, unknown>;
}

/**
 * Validation result for CheckpointManifest validation.
 */
export interface CheckpointManifestValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates a CheckpointManifest for structural validity.
 *
 * @param manifest - The manifest to validate
 * @param options - Validation options
 * @returns Validation result with any errors or warnings
 */
export function validateCheckpointManifest(
  manifest: unknown,
  options: {
    requireExecutionId?: boolean;
    requireCombinedChecksum?: boolean;
    requireAtLeastOneCheckpoint?: boolean;
  } = {},
): CheckpointManifestValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (manifest == null || typeof manifest !== "object") {
    return { valid: false, errors: ["manifest_required: CheckpointManifest must be an object"], warnings };
  }

  const candidate = manifest as Record<string, unknown>;

  // manifestId validation
  if (typeof candidate.manifestId !== "string" || candidate.manifestId.trim().length === 0) {
    errors.push("manifest_id_required: manifestId must be a non-empty string");
  }

  // schemaVersion validation
  if (typeof candidate.schemaVersion !== "string" || candidate.schemaVersion.trim().length === 0) {
    errors.push("schema_version_required: schemaVersion must be a non-empty string");
  }

  // checkpoints validation
  if (!Array.isArray(candidate.checkpoints)) {
    errors.push("checkpoints_required: checkpoints must be an array");
  } else {
    if (candidate.checkpoints.length === 0 && options.requireAtLeastOneCheckpoint) {
      warnings.push("no_checkpoints: manifest has no checkpoints");
    }
    for (let i = 0; i < candidate.checkpoints.length; i++) {
      const checkpointResult = validateCheckpointRef(candidate.checkpoints[i], {
        requireChecksum: false,
        requireStorageUri: true,
      });
      if (!checkpointResult.valid) {
        errors.push(...checkpointResult.errors.map((e) => `checkpoint[${i}]: ${e}`));
      }
    }
  }

  // createdAt validation
  if (typeof candidate.createdAt !== "string" || candidate.createdAt.trim().length === 0) {
    errors.push("created_at_required: createdAt must be a non-empty ISO 8601 string");
  } else if (!isValidIsoDate(candidate.createdAt)) {
    errors.push(`created_at_invalid: createdAt must be valid ISO 8601: ${candidate.createdAt}`);
  }

  // executionId validation (optional but recommended)
  if (options.requireExecutionId) {
    if (typeof candidate.executionId !== "string" || candidate.executionId.trim().length === 0) {
      errors.push("execution_id_required: executionId is recommended for audit trail");
    }
  }

  // workflowId validation (optional)
  if (candidate.workflowId !== undefined && candidate.workflowId !== null) {
    if (typeof candidate.workflowId !== "string") {
      errors.push("workflow_id_must_be_string: workflowId must be a string");
    }
  }

  // totalSizeBytes validation
  if (candidate.totalSizeBytes !== undefined && candidate.totalSizeBytes !== null) {
    if (typeof candidate.totalSizeBytes !== "number" || candidate.totalSizeBytes < 0) {
      errors.push("total_size_bytes_must_be_nonnegative_number: totalSizeBytes must be >= 0");
    }
  }
  if (candidate.totalCompressedSizeBytes !== undefined && candidate.totalCompressedSizeBytes !== null) {
    if (typeof candidate.totalCompressedSizeBytes !== "number" || candidate.totalCompressedSizeBytes < 0) {
      errors.push("total_compressed_size_bytes_must_be_nonnegative_number: totalCompressedSizeBytes must be >= 0");
    }
  }

  // combinedChecksum validation (SHA-256 hex = 64 chars)
  if (candidate.combinedChecksum !== undefined && candidate.combinedChecksum !== null) {
    if (typeof candidate.combinedChecksum !== "string") {
      errors.push("combined_checksum_must_be_string: combinedChecksum must be a string");
    } else if (!/^[a-fA-F0-9]{64}$/.test(candidate.combinedChecksum)) {
      errors.push("combined_checksum_format_invalid: combinedChecksum must be SHA-256 hex (64 chars)");
    }
  } else if (options.requireCombinedChecksum) {
    warnings.push("combined_checksum_missing: combinedChecksum is recommended for integrity verification");
  }

  // metadata validation
  if (candidate.metadata !== undefined && candidate.metadata !== null) {
    if (typeof candidate.metadata !== "object" || Array.isArray(candidate.metadata)) {
      errors.push("metadata_must_be_object: metadata must be a plain object");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Computes a combined checksum for a manifest from individual checkpoint checksums.
 */
export function computeCombinedChecksum(checkpointRefs: CheckpointRef[]): string {
  if (checkpointRefs.length === 0) {
    throw new ValidationError(
      "checkpoint.manifest_checksums_required",
      "checkpoint.manifest_checksums_required: at least one checkpoint checksum is required.",
    );
  }

  const serializedChecksums = JSON.stringify(
    [...checkpointRefs]
      .sort((a, b) => (a.checkpointId ?? "").localeCompare(b.checkpointId ?? ""))
      .map((ref) => {
        const checksum = ref.checksum?.trim();
        if (checksum == null || checksum.length === 0) {
          throw new ValidationError(
            "checkpoint.manifest_checksums_required",
            `checkpoint.manifest_checksums_required:${ref.checkpointId ?? "unknown_checkpoint"}`,
          );
        }
        return [ref.checkpointId ?? "", checksum];
      }),
  );

  return createHash("sha256").update(serializedChecksums).digest("hex");
}

/**
 * Verifies a manifest's combined checksum against its checkpoints.
 */
export function verifyManifestChecksum(manifest: CheckpointManifest): boolean {
  if (!manifest.combinedChecksum || manifest.checkpoints.length === 0) {
    return false;
  }

  try {
    const computed = computeCombinedChecksum(manifest.checkpoints);
    return computed.toLowerCase() === manifest.combinedChecksum.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Creates a CheckpointManifest from a collection of checkpoint references.
 */
export function createCheckpointManifest(input: {
  manifestId: string;
  checkpoints: CheckpointRef[];
  executionId?: string;
  workflowId?: string;
  metadata?: Record<string, unknown>;
}): CheckpointManifest {
  const totalSizeBytes = input.checkpoints.reduce(
    (sum, ref) => sum + ((ref.metadata?.sizeBytes as number) ?? 0),
    0
  );
  const totalCompressedSizeBytes = input.checkpoints.reduce(
    (sum, ref) => sum + ((ref.metadata?.compressedSizeBytes as number) ?? 0),
    0,
  );

  const combinedChecksum = computeCombinedChecksum(input.checkpoints);

  return {
    manifestId: input.manifestId,
    schemaVersion: "checkpoint_manifest.v1",
    checkpoints: input.checkpoints,
    createdAt: new Date().toISOString(),
    ...(input.executionId !== undefined && { executionId: input.executionId }),
    ...(input.workflowId !== undefined && { workflowId: input.workflowId }),
    totalSizeBytes,
    totalCompressedSizeBytes,
    combinedChecksum,
    ...(input.metadata !== undefined && { metadata: input.metadata }),
  };
}

/**
 * Throws ValidationError if CheckpointManifest is invalid.
 */
export function requireValidCheckpointManifest(
  manifest: unknown,
  options?: Parameters<typeof validateCheckpointManifest>[1],
): void {
  const result = validateCheckpointManifest(manifest, options);
  if (!result.valid) {
    throw new ValidationError(
      "checkpoint.manifest_invalid",
      `Invalid CheckpointManifest: ${result.errors.join("; ")}`,
      {
        category: "validation",
        source: "storage",
        details: { errors: result.errors },
      },
    );
  }
}

/**
 * Validates ISO 8601 date format.
 */
function isValidIsoDate(dateStr: string): boolean {
  const date = new Date(dateStr);
  return !isNaN(date.getTime()) && dateStr.includes("T");
}
