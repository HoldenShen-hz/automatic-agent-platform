/**
 * @fileoverview Workflow Step Checkpoint - Snapshot and recovery for workflow steps.
 *
 * Provides checkpointing functionality for multi-step workflow execution. Each step
 * can produce a checkpoint that captures:
 * - Step output and status
 * - Decision context (how routing decisions were made)
 * - Resume context (where to resume if interrupted)
 * - File diff summary (what files were changed)
 * - Upstream artifact references
 * - Compensation model for undo
 *
 * Checkpoints enable:
 * - Recovery after crashes: Resume from the last successful step
 * - Audit trail: Track exactly what happened at each step
 * - Compensation: Undo steps using the compensation model
 *
 * @see Workflow Contract: docs_zh/contracts/task_and_workflow_contract.md
 */
import type { ArtifactRecord, ArtifactRef, StepOutputRecord } from "../../contracts/types/domain.js";
import type { CompensationModel } from "../../orchestration/oapeflir/workflow/minimal-workflow.js";
export declare const WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION = "workflow_step_checkpoint.v1";
/**
 * Context about how the step decision was made.
 *
 * Captures the source of the decision (e.g., model response), the original
 * request, why a particular route was chosen, prior step summaries for
 * context, and which step IDs this step depends on.
 */
export interface WorkflowStepCheckpointDecisionContext {
    source: string;
    request: string;
    routeReason: string | null;
    priorStepSummaries: string[];
    dependsOnStepIds: string[];
}
/**
 * Context for resuming workflow execution after interruption.
 *
 * Tracks which steps have completed, what the next step to execute is,
 * and which output keys are available for downstream steps.
 */
export interface WorkflowStepCheckpointResumeContext {
    completedStepIds: string[];
    nextStepId: string | null;
    outputKeys: string[];
}
/**
 * Summary of file system changes made by the step.
 *
 * Tracks which files were created, modified, or deleted so the system
 * can understand the side effects of each step for audit and compensation.
 */
export interface WorkflowStepCheckpointFileDiffSummary {
    summary: string | null;
    createdPaths: string[];
    updatedPaths: string[];
    deletedPaths: string[];
}
/**
 * Complete checkpoint data for a workflow step execution.
 *
 * A checkpoint captures the full state needed to resume execution later,
 * including output, decision reasoning, resume position, file changes,
 * and artifact dependencies.
 */
export interface WorkflowStepCheckpoint {
    schemaVersion: typeof WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION;
    taskId: string;
    executionId: string | null;
    workflowId: string;
    divisionId: string;
    stepId: string;
    roleId: string;
    outputKey: string;
    status: StepOutputRecord["status"];
    producedAt: string;
    output: Record<string, unknown>;
    decisionContext: WorkflowStepCheckpointDecisionContext;
    resumeContext: WorkflowStepCheckpointResumeContext;
    fileDiffSummary: WorkflowStepCheckpointFileDiffSummary;
    upstreamArtifactRefs: ArtifactRef[];
    compensationModel: CompensationModel | null;
}
/**
 * Input for creating a workflow step checkpoint.
 *
 * Used by the workflow executor to capture step state at completion
 * or during critical points in execution.
 */
export interface CreateWorkflowStepCheckpointInput {
    taskId: string;
    executionId: string | null;
    workflowId: string;
    divisionId: string;
    stepId: string;
    roleId: string;
    outputKey: string;
    status: StepOutputRecord["status"];
    producedAt: string;
    output: Record<string, unknown>;
    decisionContext: WorkflowStepCheckpointDecisionContext;
    resumeContext: WorkflowStepCheckpointResumeContext;
    upstreamArtifactRefs?: ArtifactRef[];
    fileDiffSummary?: Partial<WorkflowStepCheckpointFileDiffSummary>;
    compensationModel?: CompensationModel | null;
}
/**
 * Summary view of a checkpoint for listing/display purposes.
 *
 * A condensed view that excludes full output and context to allow
 * listing checkpoints without loading all data.
 */
export interface WorkflowStepCheckpointSummary {
    artifactId: string;
    stepId: string;
    workflowId: string;
    status: StepOutputRecord["status"];
    producedAt: string;
    nextStepId: string | null;
    outputKeys: string[];
    summary: string | null;
    source: string;
}
/**
 * Creates a workflow step checkpoint from input data.
 *
 * Validates and structures the checkpoint data, making defensive copies
 * of arrays to prevent accidental mutation.
 */
export declare function createWorkflowStepCheckpoint(input: CreateWorkflowStepCheckpointInput): WorkflowStepCheckpoint;
/**
 * Reads a workflow step checkpoint from an artifact record.
 *
 * Validates that the artifact is a workflow_step_snapshot type and that
 * the file exists, then parses and validates the JSON content.
 */
export declare function readWorkflowStepCheckpoint(record: ArtifactRecord): WorkflowStepCheckpoint | null;
/**
 * Creates a summary view of a checkpoint.
 *
 * Extracts key fields for display: step ID, status, timestamps,
 * next step, output keys, and summary text.
 */
export declare function summarizeWorkflowStepCheckpoint(artifactId: string, checkpoint: WorkflowStepCheckpoint): WorkflowStepCheckpointSummary;
