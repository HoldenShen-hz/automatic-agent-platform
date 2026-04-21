/**
 * Result Envelope
 *
 * Constructs standardized result envelopes from task and step outputs.
 * Envelopes provide a consistent structure for returning results including
 * status, data, artifacts, metrics, and provenance information.
 */
import type { ArtifactRecord, ArtifactRef, StepOutputRecord, TaskRecord, WorkflowStateRecord } from "../types/domain.js";
/** Overall status of a result envelope */
export type ResultEnvelopeStatus = "success" | "partial" | "error";
/** Error information in a result envelope */
export interface ResultEnvelopeError {
    code: string;
    message: string | null;
}
/**
 * A standardized result envelope containing task or step execution results.
 */
export interface ResultEnvelope {
    resultId: string;
    status: ResultEnvelopeStatus;
    structuredData: unknown | null;
    humanSummary: string | null;
    warnings: string[];
    artifacts: ArtifactRef[];
    metrics: Record<string, number> | null;
    error: ResultEnvelopeError | null;
    provenance: Record<string, unknown> | null;
}
/**
 * Builds a result envelope from a completed task.
 *
 * Combines task output, workflow state, step outputs, and artifacts
 * into a standardized result envelope.
 */
export declare function buildTaskResultEnvelope(input: {
    task: TaskRecord;
    workflowState: WorkflowStateRecord | null;
    stepOutputs: StepOutputRecord[];
    artifacts: ArtifactRecord[];
}): ResultEnvelope | null;
/**
 * Builds a result envelope from a single step output.
 */
export declare function buildStepResultEnvelope(stepOutput: StepOutputRecord, artifacts: ArtifactRecord[]): ResultEnvelope;
