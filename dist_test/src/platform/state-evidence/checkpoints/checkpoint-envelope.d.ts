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
import { AppError } from "../../contracts/errors.js";
/**
 * Checkpoint envelope schema versions.
 */
export declare const CHECKPOINT_ENVELOPE_SCHEMA_VERSION = "checkpoint_envelope.v1";
/**
 * Default maximum checkpoint size in bytes (10MB).
 */
export declare const DEFAULT_MAX_CHECKPOINT_SIZE_BYTES: number;
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
}
/**
 * Result of unpacking a checkpoint envelope.
 */
export interface UnpackedCheckpointEnvelope<T = unknown> {
    /** The original checkpoint data */
    data: T;
    /** The envelope metadata */
    metadata: CheckpointEnvelopeMetadata;
    /** Whether the data was compressed */
    wasCompressed: boolean;
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
export declare function createCheckpointEnvelope<T = unknown>(checkpointData: T, payloadSchemaVersion: string, options?: CreateCheckpointEnvelopeOptions): Promise<CheckpointEnvelope>;
/**
 * Unpacks a checkpoint envelope, decompressing and validating the payload.
 *
 * @param envelope - The checkpoint envelope to unpack
 * @param options - Optional configuration
 * @returns The unpacked checkpoint data with metadata
 * @throws CheckpointEnvelopeInvalidError if envelope is invalid or corrupted
 */
export declare function unpackCheckpointEnvelope<T = unknown>(envelope: CheckpointEnvelope, options?: {
    maxSizeBytes?: number;
}): Promise<UnpackedCheckpointEnvelope<T>>;
/**
 * Gets the uncompressed size of an envelope without unpacking it.
 */
export declare function getEnvelopeOriginalSize(envelope: CheckpointEnvelope): number;
/**
 * Gets the compressed size of an envelope.
 */
export declare function getEnvelopeCompressedSize(envelope: CheckpointEnvelope): number;
/**
 * Calculates the compression ratio of an envelope.
 */
export declare function getEnvelopeCompressionRatio(envelope: CheckpointEnvelope): number;
/**
 * Error thrown when checkpoint data exceeds the size limit.
 */
export declare class CheckpointSizeExceededError extends AppError {
    readonly originalSizeBytes: number;
    readonly maxSizeBytes: number;
    constructor(originalSizeBytes: number, maxSizeBytes: number, message?: string);
}
/**
 * Error thrown when a checkpoint envelope is invalid or corrupted.
 */
export declare class CheckpointEnvelopeInvalidError extends AppError {
    constructor(message: string);
}
/**
 * Wraps existing workflow step checkpoint data in an envelope.
 *
 * @param checkpoint - The workflow step checkpoint to wrap
 * @param options - Optional configuration
 */
export declare function wrapWorkflowStepCheckpoint(checkpoint: import("./workflow-step-checkpoint.js").WorkflowStepCheckpoint, options?: CreateCheckpointEnvelopeOptions): Promise<CheckpointEnvelope>;
/**
 * Unwraps a workflow step checkpoint from an envelope.
 *
 * @param envelope - The envelope to unwrap
 * @param options - Optional configuration
 */
export declare function unwrapWorkflowStepCheckpoint(envelope: CheckpointEnvelope, options?: {
    maxSizeBytes?: number;
}): Promise<UnpackedCheckpointEnvelope<import("./workflow-step-checkpoint.js").WorkflowStepCheckpoint>>;
