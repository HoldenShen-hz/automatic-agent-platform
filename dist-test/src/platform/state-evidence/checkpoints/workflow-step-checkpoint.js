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
import { existsSync, readFileSync } from "node:fs";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
const logger = new StructuredLogger({ retentionLimit: 100 });
export const WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION = "workflow_step_checkpoint.v1";
/**
 * Creates a workflow step checkpoint from input data.
 *
 * Validates and structures the checkpoint data, making defensive copies
 * of arrays to prevent accidental mutation.
 */
export function createWorkflowStepCheckpoint(input) {
    return {
        schemaVersion: WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION,
        taskId: input.taskId,
        executionId: input.executionId,
        workflowId: input.workflowId,
        divisionId: input.divisionId,
        stepId: input.stepId,
        roleId: input.roleId,
        outputKey: input.outputKey,
        status: input.status,
        producedAt: input.producedAt,
        output: input.output,
        decisionContext: {
            source: input.decisionContext.source,
            request: input.decisionContext.request,
            routeReason: input.decisionContext.routeReason,
            priorStepSummaries: [...input.decisionContext.priorStepSummaries],
            dependsOnStepIds: [...input.decisionContext.dependsOnStepIds],
        },
        resumeContext: {
            completedStepIds: [...input.resumeContext.completedStepIds],
            nextStepId: input.resumeContext.nextStepId,
            outputKeys: [...input.resumeContext.outputKeys],
        },
        fileDiffSummary: {
            summary: input.fileDiffSummary?.summary ?? null,
            createdPaths: [...(input.fileDiffSummary?.createdPaths ?? [])],
            updatedPaths: [...(input.fileDiffSummary?.updatedPaths ?? [])],
            deletedPaths: [...(input.fileDiffSummary?.deletedPaths ?? [])],
        },
        upstreamArtifactRefs: [...(input.upstreamArtifactRefs ?? [])],
        compensationModel: input.compensationModel ?? null,
    };
}
/**
 * Reads a workflow step checkpoint from an artifact record.
 *
 * Validates that the artifact is a workflow_step_snapshot type and that
 * the file exists, then parses and validates the JSON content.
 */
export function readWorkflowStepCheckpoint(record) {
    if (record.kind !== "workflow_step_snapshot" || !existsSync(record.storagePath)) {
        return null;
    }
    try {
        const parsed = JSON.parse(readFileSync(record.storagePath, "utf8"));
        return isWorkflowStepCheckpoint(parsed) ? parsed : null;
    }
    catch (err) {
        logger.log({
            level: "warn",
            message: "Failed to read workflow step checkpoint",
            data: { error: err instanceof Error ? err.message : String(err), storagePath: record.storagePath },
        });
        return null;
    }
}
/**
 * Creates a summary view of a checkpoint.
 *
 * Extracts key fields for display: step ID, status, timestamps,
 * next step, output keys, and summary text.
 */
export function summarizeWorkflowStepCheckpoint(artifactId, checkpoint) {
    const output = checkpoint.output;
    return {
        artifactId,
        stepId: checkpoint.stepId,
        workflowId: checkpoint.workflowId,
        status: checkpoint.status,
        producedAt: checkpoint.producedAt,
        nextStepId: checkpoint.resumeContext.nextStepId,
        outputKeys: [...checkpoint.resumeContext.outputKeys],
        summary: typeof output?.summary === "string" ? output.summary : null,
        source: checkpoint.decisionContext.source,
    };
}
function isWorkflowStepCheckpoint(value) {
    if (value == null || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }
    const candidate = value;
    if (candidate.schemaVersion !== WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION
        || typeof candidate.taskId !== "string"
        || (candidate.executionId !== null && typeof candidate.executionId !== "string")
        || typeof candidate.workflowId !== "string"
        || typeof candidate.divisionId !== "string"
        || typeof candidate.stepId !== "string"
        || typeof candidate.roleId !== "string"
        || typeof candidate.outputKey !== "string"
        || typeof candidate.status !== "string"
        || typeof candidate.producedAt !== "string"
        || candidate.output == null
        || typeof candidate.output !== "object"
        || Array.isArray(candidate.output)) {
        return false;
    }
    if (candidate.compensationModel !== null
        && candidate.compensationModel !== undefined
        && typeof candidate.compensationModel !== "string") {
        return false;
    }
    return isDecisionContext(candidate.decisionContext)
        && isResumeContext(candidate.resumeContext)
        && isFileDiffSummary(candidate.fileDiffSummary)
        && isArtifactRefArray(candidate.upstreamArtifactRefs);
}
function isDecisionContext(value) {
    if (value == null || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }
    const candidate = value;
    return typeof candidate.source === "string"
        && typeof candidate.request === "string"
        && (candidate.routeReason === null || typeof candidate.routeReason === "string")
        && isStringArray(candidate.priorStepSummaries)
        && isStringArray(candidate.dependsOnStepIds);
}
function isResumeContext(value) {
    if (value == null || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }
    const candidate = value;
    return isStringArray(candidate.completedStepIds)
        && (candidate.nextStepId === null || typeof candidate.nextStepId === "string")
        && isStringArray(candidate.outputKeys);
}
function isFileDiffSummary(value) {
    if (value == null || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }
    const candidate = value;
    return (candidate.summary === null || typeof candidate.summary === "string")
        && isStringArray(candidate.createdPaths)
        && isStringArray(candidate.updatedPaths)
        && isStringArray(candidate.deletedPaths);
}
function isArtifactRefArray(value) {
    return Array.isArray(value) && value.every((entry) => isArtifactRef(entry));
}
function isArtifactRef(value) {
    if (value == null || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }
    const candidate = value;
    return typeof candidate.artifactId === "string"
        && typeof candidate.kind === "string"
        && typeof candidate.uri === "string"
        && typeof candidate.createdAt === "string"
        && (candidate.mimeType === undefined || typeof candidate.mimeType === "string")
        && (candidate.sizeBytes === undefined || typeof candidate.sizeBytes === "number")
        && (candidate.checksum === undefined || typeof candidate.checksum === "string");
}
function isStringArray(value) {
    return Array.isArray(value) && value.every((item) => typeof item === "string");
}
//# sourceMappingURL=workflow-step-checkpoint.js.map