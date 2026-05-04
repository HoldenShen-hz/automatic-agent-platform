/**
 * Checkpoints Module
 *
 * Provides checkpoint and recovery functionality for workflow execution.
 */

export {
  // Envelope format
  CHECKPOINT_ENVELOPE_SCHEMA_VERSION,
  DEFAULT_MAX_CHECKPOINT_SIZE_BYTES,
  type CompressionAlgorithm,
  type CheckpointEnvelopeMetadata,
  type CheckpointEnvelope,
  type CreateCheckpointEnvelopeOptions,
  type UnpackedCheckpointEnvelope,
  // Envelope operations
  createCheckpointEnvelope,
  unpackCheckpointEnvelope,
  wrapWorkflowStepCheckpoint,
  unwrapWorkflowStepCheckpoint,
  getEnvelopeOriginalSize,
  getEnvelopeCompressedSize,
  getEnvelopeCompressionRatio,
  // Error types
  CheckpointSizeExceededError,
  CheckpointEnvelopeInvalidError,
} from "./checkpoint-envelope.js";

export {
  // Workflow step checkpoint types
  WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION,
  type WorkflowStepCheckpointDecisionContext,
  type WorkflowStepCheckpointResumeContext,
  type WorkflowStepCheckpointFileDiffSummary,
  type WorkflowStepCheckpoint,
  type CreateWorkflowStepCheckpointInput,
  type WorkflowStepCheckpointSummary,
  // Workflow step checkpoint functions
  createWorkflowStepCheckpoint,
  readWorkflowStepCheckpoint,
  summarizeWorkflowStepCheckpoint,
} from "./workflow-step-checkpoint.js";

export {
  // R23-14: CheckpointManifest validation
  type CheckpointManifest,
  type CheckpointManifestValidationResult,
  validateCheckpointManifest,
  verifyManifestChecksum,
  createCheckpointManifest,
  requireValidCheckpointManifest,
} from "./checkpoint-manifest.js";

export {
  // R23-12: CheckpointRef validation
  type CheckpointRef,
  type CheckpointRefValidationResult,
  validateCheckpointRef,
  validateCheckpointStorage,
  requireValidCheckpointRef,
} from "./checkpoint-ref-validator.js";

// R23-10: CheckpointGC implementation
export {
  type CheckpointRetentionPolicy,
  type CheckpointGCCandidate,
  type CheckpointGCRunResult,
  type CheckpointStorageStats,
  DEFAULT_CHECKPOINT_RETENTION_POLICY,
  CheckpointGCService,
} from "./checkpoint-gc-service.js";
