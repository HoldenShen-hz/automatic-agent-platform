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
 * Creates a SHA-256 checksum of data.
 */
function createChecksum(data) {
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
export async function createCheckpointEnvelope(checkpointData, payloadSchemaVersion, options = {}) {
    const maxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_CHECKPOINT_SIZE_BYTES;
    const jsonPayload = JSON.stringify(checkpointData);
    const uncompressedBuffer = Buffer.from(jsonPayload, "utf8");
    const originalSizeBytes = uncompressedBuffer.length;
    // Check size limit before compression
    if (originalSizeBytes > maxSizeBytes) {
        throw new CheckpointSizeExceededError(originalSizeBytes, maxSizeBytes);
    }
    // Compress the payload using gzip
    const compressedBuffer = await asyncGzip(uncompressedBuffer);
    const compressedSizeBytes = compressedBuffer.length;
    // Verify compressed size doesn't exceed limit (compression could still be too large)
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
export async function unpackCheckpointEnvelope(envelope, options = {}) {
    const maxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_CHECKPOINT_SIZE_BYTES;
    // Validate envelope structure
    if (!isValidCheckpointEnvelope(envelope)) {
        throw new CheckpointEnvelopeInvalidError("Invalid checkpoint envelope structure");
    }
    // Decode base64 payload
    let compressedBuffer;
    try {
        compressedBuffer = Buffer.from(envelope.payload, "base64");
    }
    catch {
        throw new CheckpointEnvelopeInvalidError("Failed to decode base64 payload");
    }
    // Verify compressed size
    if (compressedBuffer.length > maxSizeBytes) {
        throw new CheckpointSizeExceededError(envelope.metadata.originalSizeBytes, maxSizeBytes, `Compressed size ${compressedBuffer.length} exceeds limit ${maxSizeBytes}`);
    }
    // Decompress using gzip
    let decompressedBuffer;
    try {
        decompressedBuffer = await asyncGunzip(compressedBuffer);
    }
    catch (err) {
        throw new CheckpointEnvelopeInvalidError(`Failed to decompress payload: ${err instanceof Error ? err.message : String(err)}`);
    }
    // Verify checksum
    const actualChecksum = createChecksum(decompressedBuffer);
    if (actualChecksum !== envelope.metadata.checksum) {
        logger.log({
            level: "error",
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
    let data;
    try {
        data = JSON.parse(decompressedBuffer.toString("utf8"));
    }
    catch (err) {
        throw new CheckpointEnvelopeInvalidError(`Failed to parse checkpoint JSON: ${err instanceof Error ? err.message : String(err)}`);
    }
    return {
        data,
        metadata: envelope.metadata,
        wasCompressed: envelope.metadata.algorithm === "gzip",
    };
}
/**
 * Validates the structure of a checkpoint envelope.
 */
function isValidCheckpointEnvelope(value) {
    if (value == null || typeof value !== "object") {
        return false;
    }
    const envelope = value;
    // Check version
    if (envelope.version !== CHECKPOINT_ENVELOPE_SCHEMA_VERSION) {
        return false;
    }
    // Check required fields
    if (typeof envelope.schema !== "string"
        || typeof envelope.payload !== "string"
        || envelope.metadata == null
        || typeof envelope.metadata !== "object") {
        return false;
    }
    const metadata = envelope.metadata;
    return (typeof metadata.originalSizeBytes === "number"
        && typeof metadata.compressedSizeBytes === "number"
        && typeof metadata.checksum === "string"
        && typeof metadata.createdAt === "string"
        && metadata.algorithm === "gzip"
        && typeof metadata.payloadSchemaVersion === "string");
}
/**
 * Gets the uncompressed size of an envelope without unpacking it.
 */
export function getEnvelopeOriginalSize(envelope) {
    return envelope.metadata.originalSizeBytes;
}
/**
 * Gets the compressed size of an envelope.
 */
export function getEnvelopeCompressedSize(envelope) {
    return envelope.metadata.compressedSizeBytes;
}
/**
 * Calculates the compression ratio of an envelope.
 */
export function getEnvelopeCompressionRatio(envelope) {
    if (envelope.metadata.originalSizeBytes === 0) {
        return 1;
    }
    return envelope.metadata.compressedSizeBytes / envelope.metadata.originalSizeBytes;
}
/**
 * Error thrown when checkpoint data exceeds the size limit.
 */
export class CheckpointSizeExceededError extends AppError {
    originalSizeBytes;
    maxSizeBytes;
    constructor(originalSizeBytes, maxSizeBytes, message) {
        const errorMessage = message
            ?? `Checkpoint size ${originalSizeBytes} bytes exceeds maximum allowed ${maxSizeBytes} bytes`;
        super("checkpoint.size_exceeded", errorMessage, {
            statusCode: 413,
            category: "storage",
            source: "runtime",
            retryable: false,
            details: {
                originalSizeBytes,
                maxSizeBytes,
                limitExceededBy: originalSizeBytes - maxSizeBytes,
            },
        });
        this.name = "CheckpointSizeExceededError";
        this.originalSizeBytes = originalSizeBytes;
        this.maxSizeBytes = maxSizeBytes;
    }
}
/**
 * Error thrown when a checkpoint envelope is invalid or corrupted.
 */
export class CheckpointEnvelopeInvalidError extends AppError {
    constructor(message) {
        super("checkpoint.envelope_invalid", message, {
            statusCode: 422,
            category: "storage",
            source: "runtime",
            retryable: false,
        });
        this.name = "CheckpointEnvelopeInvalidError";
    }
}
/**
 * Wraps existing workflow step checkpoint data in an envelope.
 *
 * @param checkpoint - The workflow step checkpoint to wrap
 * @param options - Optional configuration
 */
export async function wrapWorkflowStepCheckpoint(checkpoint, options = {}) {
    return createCheckpointEnvelope(checkpoint, checkpoint.schemaVersion, options);
}
/**
 * Unwraps a workflow step checkpoint from an envelope.
 *
 * @param envelope - The envelope to unwrap
 * @param options - Optional configuration
 */
export async function unwrapWorkflowStepCheckpoint(envelope, options = {}) {
    return unpackCheckpointEnvelope(envelope, options);
}
//# sourceMappingURL=checkpoint-envelope.js.map