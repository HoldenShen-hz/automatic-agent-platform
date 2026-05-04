/**
 * Checkpoint Reference Validator
 *
 * Provides validation for checkpoint references to ensure:
 * - Required fields are present
 * - Checkpoint references point to valid locations
 * - Metadata is properly structured
 *
 * R23-12 Fix: CheckpointRef validation
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { ValidationError } from "../../contracts/errors.js";
import type { CheckpointEnvelope } from "../checkpoints/checkpoint-envelope.js";

/**
 * Validation result for checkpoint reference validation.
 */
export interface CheckpointRefValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates a checkpoint reference structure.
 *
 * A checkpoint reference consists of:
 * - checkpointId: unique identifier
 * - storageUri: where the checkpoint is stored
 * - checksum: integrity hash
 * - metadata: optional metadata about the checkpoint
 */
export interface CheckpointRef {
  readonly checkpointId: string;
  readonly storageUri: string;
  readonly checksum?: string;
  readonly metadata?: Record<string, unknown>;
  readonly createdAt?: string;
}

/**
 * Validates a CheckpointRef for structural validity.
 *
 * @param ref - The CheckpointRef to validate
 * @param options - Validation options
 * @returns Validation result with any errors or warnings
 */
export function validateCheckpointRef(
  ref: unknown,
  options: {
    requireChecksum?: boolean;
    requireStorageUri?: boolean;
    validateStorageAccess?: boolean;
  } = {},
): CheckpointRefValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (ref == null || typeof ref !== "object") {
    return { valid: false, errors: ["ref_required: CheckpointRef must be an object"], warnings };
  }

  const candidate = ref as Record<string, unknown>;

  // checkpointId validation
  if (typeof candidate.checkpointId !== "string" || candidate.checkpointId.trim().length === 0) {
    errors.push("checkpoint_id_required: checkpointId must be a non-empty string");
  }

  // storageUri validation
  if (options.requireStorageUri !== false) {
    if (typeof candidate.storageUri !== "string" || candidate.storageUri.trim().length === 0) {
      errors.push("storage_uri_required: storageUri must be a non-empty string");
    } else if (!isValidStorageUri(candidate.storageUri)) {
      errors.push(`storage_uri_invalid: storageUri format is invalid: ${candidate.storageUri}`);
    }
  }

  // checksum validation
  if (candidate.checksum !== undefined && candidate.checksum !== null) {
    if (typeof candidate.checksum !== "string") {
      errors.push("checksum_must_be_string: checksum must be a string");
    } else if (!/^[a-fA-F0-9]{64}$/.test(candidate.checksum)) {
      errors.push(`checksum_format_invalid: Checksum must be SHA-256 hex (64 chars), got length: ${candidate.checksum.length}`);
    }
  } else if (options.requireChecksum) {
    warnings.push("checksum_missing: checkpoint checksum is recommended for integrity verification");
  }

  // metadata validation
  if (candidate.metadata !== undefined && candidate.metadata !== null) {
    if (typeof candidate.metadata !== "object" || Array.isArray(candidate.metadata)) {
      errors.push("metadata_must_be_object: metadata must be a plain object");
    }
  }

  // createdAt validation (ISO 8601 format)
  if (candidate.createdAt !== undefined && candidate.createdAt !== null) {
    if (typeof candidate.createdAt !== "string") {
      errors.push("created_at_must_be_string: createdAt must be an ISO 8601 string");
    } else if (!isValidIsoDate(candidate.createdAt)) {
      errors.push(`created_at_invalid: createdAt must be valid ISO 8601: ${candidate.createdAt}`);
    }
  }

  // storage accessibility check
  if (options.validateStorageAccess && candidate.storageUri) {
    const uri = candidate.storageUri as string;
    if (uri.startsWith("file://")) {
      const filePath = uri.slice("file://".length);
      if (!existsSync(filePath)) {
        warnings.push(`storage_not_accessible: Checkpoint file does not exist: ${filePath}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates that a checkpoint can be read from storage.
 */
export function validateCheckpointStorage(
  checkpointRef: CheckpointRef,
): CheckpointRefValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!checkpointRef.storageUri) {
    return { valid: false, errors: ["storage_uri_required"], warnings };
  }

  if (checkpointRef.storageUri.startsWith("file://")) {
    const filePath = checkpointRef.storageUri.slice("file://".length);
    if (!existsSync(filePath)) {
      errors.push(`checkpoint_file_missing: Checkpoint file does not exist: ${filePath}`);
    } else if (checkpointRef.checksum) {
      // Verify checksum
      try {
        const content = readFileSync(filePath, "utf8");
        const actualChecksum = createHash("sha256").update(content).digest("hex");
        if (actualChecksum.toLowerCase() !== checkpointRef.checksum.toLowerCase()) {
          errors.push("checksum_mismatch: Checkpoint content does not match stored checksum");
        }
      } catch (err) {
        errors.push(`checkpoint_read_error: Failed to read checkpoint: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates URI format for storage.
 */
function isValidStorageUri(uri: string): boolean {
  if (uri.startsWith("file://")) {
    const path = uri.slice("file://".length);
    return path.startsWith("/") || /^[a-zA-Z]:[/\\]/.test(path);
  }
  if (uri.startsWith("s3://") || uri.startsWith("gs://")) {
    // Cloud storage URIs - validate basic format
    return uri.length > uri.indexOf("://") + 3;
  }
  // Allow other URI schemes
  try {
    const url = new URL(uri);
    return url.protocol !== "" && url.host !== "";
  } catch {
    return false;
  }
}

/**
 * Validates ISO 8601 date format.
 */
function isValidIsoDate(dateStr: string): boolean {
  const date = new Date(dateStr);
  return !isNaN(date.getTime()) && dateStr.includes("T");
}

/**
 * Throws ValidationError if CheckpointRef is invalid.
 */
export function requireValidCheckpointRef(
  ref: unknown,
  options?: Parameters<typeof validateCheckpointRef>[1],
): void {
  const result = validateCheckpointRef(ref, options);
  if (!result.valid) {
    throw new ValidationError(
      "checkpoint.ref_invalid",
      `Invalid CheckpointRef: ${result.errors.join("; ")}`,
      {
        category: "validation",
        source: "storage",
        details: { errors: result.errors },
      },
    );
  }
}
