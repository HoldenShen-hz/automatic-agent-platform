/**
 * Checkpoints Module
 *
 * Provides checkpoint and recovery functionality for workflow execution.
 */

export {
  // Envelope format
  CHECKPOINT_ENVELOPE_SCHEMA_VERSION,
  DEFAULT_MAX_CHECKPOINT_SIZE_BYTES,
  DEFAULT_CRITICAL_DOMAIN_MAX_CHECKPOINT_SIZE_BYTES,
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
  type WorkflowStepCheckpointRestoreState,
  type WorkflowStepCheckpointDiff,
  // Workflow step checkpoint functions
  createWorkflowStepCheckpoint,
  readWorkflowStepCheckpoint,
  summarizeWorkflowStepCheckpoint,
  restoreWorkflowStepCheckpoint,
  compareWorkflowStepCheckpointVersions,
} from "./workflow-step-checkpoint.js";
