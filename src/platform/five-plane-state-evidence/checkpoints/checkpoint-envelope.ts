/**
 * @fileoverview Checkpoint Envelope - Standardized checkpoint storage format with compression
 *
 * Provides a standardized envelope format for all checkpoint data that includes:
 * - Version tracking for schema evolution
 * - Gzip compression to reduce storage size
 * - Metadata for integrity verification
 * - Size limit enforcement (10MB default)
 *
 * This ensures compatibility across different worker implementations and
 * prevents unbounded checkpoint growth.
 *
 * @see docs_zh/contracts/task_and_workflow_contract.md
 */

import { createHash } from "node:crypto";
import { gzip, gunzip } from "node:zlib";
import { promisify } from "node:util";

import { AppError } from "../../contracts/errors.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const asyncGzip = promisify(gzip);
const asyncGunzip = promisify(gunzip);

const logger = new StructuredLogger({ retentionLimit: 100 });

/**
 * Checkpoint envelope schema versions.
 */
export const CHECKPOINT_ENVELOPE_SCHEMA_VERSION = "checkpoint_envelope.v1";

/**
 * Default maximum checkpoint size in bytes (10MB).
 */
export const DEFAULT_MAX_CHECKPOINT_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Compression algorithm used in the envelope.
 */
export type CompressionAlgorithm = "gzip";

/**
 * Metadata about the checkpoint envelope.
 */
export interface CheckpointEnvelopeMetadata {
  /** Original uncompressed size in bytes */
  originalSizeBytes: number;
  /** Compressed size in bytes */
  compressedSizeBytes: number;
  /** SHA-256 checksum of the original (uncompressed) data */
  checksum: string;
  /** When the envelope was created */
  createdAt: string;
  /** Compression algorithm used */
  algorithm: CompressionAlgorithm;
  /** Original schema version of the payload */
  payloadSchemaVersion: string;
  /** Optional domain ownership for domain-scoped checkpoints */
  domainId?: string;
  /** Optional knowledge namespace for domain-governed checkpoint retention */
  namespaceId?: string;
}

/**
 * CheckpointEnvelope - Standard format for all checkpoint data.
 *
 * Wraps any checkpoint payload with:
 * - Schema version for evolution handling
 * - Gzip compressed payload
 * - Metadata for integrity and size tracking
 *
 * @example
 * ```typescript
 * const envelope = await createCheckpointEnvelope(
 *   checkpointData,
 *   "workflow_step_checkpoint.v1"
 * );
 * const stored = JSON.stringify(envelope);
 * // Later, to restore:
 * const restored = await unpackCheckpointEnvelope(JSON.parse(stored));
 * ```
 */
export interface CheckpointEnvelope {
  /** Envelope format version */
  version: typeof CHECKPOINT_ENVELOPE_SCHEMA_VERSION;
  /** Schema version of the payload */
  schema: string;
  /** Gzip compressed payload (Buffer as base64 string for JSON compatibility) */
  payload: string;
  /** Metadata about the envelope */
  metadata: CheckpointEnvelopeMetadata;
}

/**
 * Options for creating a checkpoint envelope.
 */
export interface CreateCheckpointEnvelopeOptions {
  /** Maximum allowed checkpoint size in bytes */
  maxSizeBytes?: number;
  /** Custom payload schema version (defaults to envelope version) */
  payloadSchemaVersion?: string;
  /** Optional domain ownership for domain-scoped checkpoints */
  domainId?: string;
  /** Optional knowledge namespace for domain-governed checkpoint retention */
  namespaceId?: string;
}

/**
 * Result of unpacking a checkpoint envelope.
 */
export interface UnpackedCheckpointEnvelope<T = unknown> {
  /** The original checkpoint data */
  data: T;
  /** The schema version used to encode the payload */
  schemaVersion: string;
  /** The envelope metadata */
  metadata: CheckpointEnvelopeMetadata;
  /** Whether the data was compressed */
  wasCompressed: boolean;
}

/**
 * Creates a SHA-256 checksum of data.
 */
function createChecksum(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Creates a checkpoint envelope with compression and metadata.
 *
 * @param checkpointData - The checkpoint data to wrap
 * @param payloadSchemaVersion - Schema version of the checkpoint data
 * @param options - Optional configuration
 * @returns The wrapped checkpoint envelope
 * @throws CheckpointSizeExceededError if data exceeds size limit
 */
export async function createCheckpointEnvelope<T = unknown>(
  checkpointData: T,
  payloadSchemaVersion: string,
  options: CreateCheckpointEnvelopeOptions = {},
): Promise<CheckpointEnvelope> {
  const maxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_CHECKPOINT_SIZE_BYTES;
  const jsonPayload = JSON.stringify(checkpointData);
  const uncompressedBuffer = Buffer.from(jsonPayload, "utf8");
  const originalSizeBytes = uncompressedBuffer.length;

  // Compress the payload using gzip
  const compressedBuffer = await asyncGzip(uncompressedBuffer);
  const compressedSizeBytes = compressedBuffer.length;

  // Storage quota is paid on the serialized artifact, so only the compressed size gates writes.
  if (compressedSizeBytes > maxSizeBytes) {
    throw new CheckpointSizeExceededError(originalSizeBytes, maxSizeBytes);
  }

  const checksum = createChecksum(uncompressedBuffer);
  const payloadBase64 = compressedBuffer.toString("base64");

  return {
    version: CHECKPOINT_ENVELOPE_SCHEMA_VERSION,
    schema: payloadSchemaVersion,
    payload: payloadBase64,
    metadata: {
      originalSizeBytes,
      compressedSizeBytes,
      checksum,
      createdAt: new Date().toISOString(),
      algorithm: "gzip",
      payloadSchemaVersion,
      ...(options.domainId != null && options.domainId.trim().length > 0 ? { domainId: options.domainId.trim() } : {}),
      ...(options.namespaceId != null && options.namespaceId.trim().length > 0 ? { namespaceId: options.namespaceId.trim() } : {}),
    },
  };
}

/**
 * Unpacks a checkpoint envelope, decompressing and validating the payload.
 *
 * @param envelope - The checkpoint envelope to unpack
 * @param options - Optional configuration
 * @returns The unpacked checkpoint data with metadata
 * @throws CheckpointEnvelopeInvalidError if envelope is invalid or corrupted
 */
export async function unpackCheckpointEnvelope<T = unknown>(
  envelope: CheckpointEnvelope,
  options: { maxSizeBytes?: number } = {},
): Promise<UnpackedCheckpointEnvelope<T>> {
  const maxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_CHECKPOINT_SIZE_BYTES;

  // Validate envelope structure
  if (!isValidCheckpointEnvelope(envelope)) {
    throw new CheckpointEnvelopeInvalidError("Invalid checkpoint envelope structure");
  }
  if (envelope.schema !== envelope.metadata.payloadSchemaVersion) {
    throw new CheckpointEnvelopeInvalidError("Envelope schema does not match payloadSchemaVersion metadata");
  }

  // Decode base64 payload
  let compressedBuffer: Buffer;
  try {
    compressedBuffer = Buffer.from(envelope.payload, "base64");
  } catch {
    throw new CheckpointEnvelopeInvalidError("Failed to decode base64 payload");
  }

  // Verify compressed size
  if (compressedBuffer.length > maxSizeBytes) {
    throw new CheckpointSizeExceededError(
      envelope.metadata.originalSizeBytes,
      maxSizeBytes,
      `Compressed size ${compressedBuffer.length} exceeds limit ${maxSizeBytes}`,
    );
  }

  // Decompress using gzip
  let decompressedBuffer: Buffer;
  try {
    decompressedBuffer = await asyncGunzip(compressedBuffer);
  } catch (err) {
    throw new CheckpointEnvelopeInvalidError(
      `Failed to decompress payload: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Verify checksum
  const actualChecksum = createChecksum(decompressedBuffer);
  if (actualChecksum !== envelope.metadata.checksum) {
    logger.log({
      level: "warn",
      message: "Checkpoint envelope checksum mismatch",
      data: {
        expected: envelope.metadata.checksum,
        actual: actualChecksum,
        originalSize: envelope.metadata.originalSizeBytes,
      },
    });
    throw new CheckpointEnvelopeInvalidError("Checksum verification failed - data may be corrupted");
  }

  // Parse JSON payload
  let data: T;
  try {
    data = JSON.parse(decompressedBuffer.toString("utf8")) as T;
  } catch (err) {
    throw new CheckpointEnvelopeInvalidError(
      `Failed to parse checkpoint JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const payloadSchemaVersion = extractPayloadSchemaVersion(data);
  if (payloadSchemaVersion != null && payloadSchemaVersion !== envelope.schema) {
    throw new CheckpointEnvelopeInvalidError("Payload schemaVersion does not match envelope schema");
  }

  return {
    data,
    schemaVersion: envelope.schema,
    metadata: envelope.metadata,
    wasCompressed: envelope.metadata.algorithm === "gzip",
  };
}

function extractPayloadSchemaVersion(value: unknown): string | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const schemaVersion = (value as Record<string, unknown>).schemaVersion;
  return typeof schemaVersion === "string" && schemaVersion.trim().length > 0
    ? schemaVersion
    : null;
}

/**
 * Validates the structure of a checkpoint envelope.
 */
function isValidCheckpointEnvelope(value: unknown): value is CheckpointEnvelope {
  if (value == null || typeof value !== "object") {
    return false;
  }

  const envelope = value as Record<string, unknown>;

  // Check version
  if (envelope.version !== CHECKPOINT_ENVELOPE_SCHEMA_VERSION) {
    return false;
  }

  // Check required fields
  if (
    typeof envelope.schema !== "string"
    || typeof envelope.payload !== "string"
    || envelope.metadata == null
    || typeof envelope.metadata !== "object"
  ) {
    return false;
  }

  const metadata = envelope.metadata as Record<string, unknown>;
  return (
    typeof metadata.originalSizeBytes === "number"
    && typeof metadata.compressedSizeBytes === "number"
    && typeof metadata.checksum === "string"
    && typeof metadata.createdAt === "string"
    && metadata.algorithm === "gzip"
    && typeof metadata.payloadSchemaVersion === "string"
  );
}

/**
 * Gets the uncompressed size of an envelope without unpacking it.
 */
export function getEnvelopeOriginalSize(envelope: CheckpointEnvelope): number {
  return envelope.metadata.originalSizeBytes;
}

/**
 * Gets the compressed size of an envelope.
 */
export function getEnvelopeCompressedSize(envelope: CheckpointEnvelope): number {
  return envelope.metadata.compressedSizeBytes;
}

/**
 * Calculates the compression ratio of an envelope.
 */
export function getEnvelopeCompressionRatio(envelope: CheckpointEnvelope): number {
  if (envelope.metadata.originalSizeBytes === 0) {
    return 1;
  }
  return Math.min(1, envelope.metadata.compressedSizeBytes / envelope.metadata.originalSizeBytes);
}

/**
 * Error thrown when checkpoint data exceeds the size limit.
 */
export class CheckpointSizeExceededError extends AppError {
  public readonly originalSizeBytes: number;
  public readonly maxSizeBytes: number;

  public constructor(
    originalSizeBytes: number,
    maxSizeBytes: number,
    message?: string,
  ) {
    const errorMessage = message
      ?? `Checkpoint size ${originalSizeBytes} bytes exceeds maximum allowed ${maxSizeBytes} bytes`;
    super(
      "checkpoint.size_exceeded",
      errorMessage,
      {
        statusCode: 413,
        category: "storage",
        source: "runtime",
        retryable: false,
        details: {
          originalSizeBytes,
          maxSizeBytes,
          limitExceededBy: originalSizeBytes - maxSizeBytes,
        },
      },
    );
    this.name = "CheckpointSizeExceededError";
    this.originalSizeBytes = originalSizeBytes;
    this.maxSizeBytes = maxSizeBytes;
  }
}

/**
 * Error thrown when a checkpoint envelope is invalid or corrupted.
 */
export class CheckpointEnvelopeInvalidError extends AppError {
  public constructor(message: string) {
    super(
      "checkpoint.envelope_invalid",
      message,
      {
        statusCode: 422,
        category: "storage",
        source: "runtime",
        retryable: false,
      },
    );
    this.name = "CheckpointEnvelopeInvalidError";
  }
}

/**
 * Wraps existing workflow step checkpoint data in an envelope.
 *
 * @param checkpoint - The workflow step checkpoint to wrap
 * @param options - Optional configuration
 */
export async function wrapWorkflowStepCheckpoint(
  checkpoint: import("./workflow-step-checkpoint.js").WorkflowStepCheckpoint,
  options: CreateCheckpointEnvelopeOptions = {},
): Promise<CheckpointEnvelope> {
  return createCheckpointEnvelope(
    checkpoint,
    checkpoint.schemaVersion,
    options,
  );
}

/**
 * Unwraps a workflow step checkpoint from an envelope.
 *
 * @param envelope - The envelope to unwrap
 * @param options - Optional configuration
 */
export async function unwrapWorkflowStepCheckpoint(
  envelope: CheckpointEnvelope,
  options: { maxSizeBytes?: number } = {},
): Promise<UnpackedCheckpointEnvelope<import("./workflow-step-checkpoint.js").WorkflowStepCheckpoint>> {
  return unpackCheckpointEnvelope(envelope, options);
}
