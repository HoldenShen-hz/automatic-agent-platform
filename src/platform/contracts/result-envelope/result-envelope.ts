/**
 * Result Envelope
 *
 * Constructs standardized result envelopes from task and step outputs.
 * Envelopes provide a consistent structure for returning results including
 * status, data, artifacts, metrics, and provenance information.
 */

import type {
  ArtifactRecord,
  ArtifactRef,
  StepOutputRecord,
  TaskRecord,
  WorkflowStateRecord,
} from "../types/domain.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

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
export function buildTaskResultEnvelope(input: {
  task: TaskRecord;
  workflowState: WorkflowStateRecord | null;
  stepOutputs: StepOutputRecord[];
  artifacts: ArtifactRecord[];
}): ResultEnvelope | null {
  const structuredData = safeParseJson(input.task.outputJson);
  if (structuredData == null && input.stepOutputs.length === 0 && input.artifacts.length === 0) {
    return null;
  }

  const finalStep = input.stepOutputs.at(-1) ?? null;
  return {
    resultId: input.task.id,
    status: mapTaskStatus(input.task.status),
    structuredData,
    humanSummary:
      extractHumanSummary(structuredData) ?? finalStep?.summary ?? input.task.title,
    warnings: collectTaskWarnings(input.task, input.stepOutputs),
    artifacts: collectTaskArtifactRefs(input.stepOutputs, input.artifacts),
    metrics: input.stepOutputs.length > 0 ? buildTaskMetrics(input.stepOutputs) : null,
    error:
      mapTaskStatus(input.task.status) === "error"
        ? {
            code: input.task.errorCode ?? `task.${input.task.status}`,
            message: extractErrorMessage(structuredData),
          }
        : null,
    provenance: {
      entity: "task",
      taskId: input.task.id,
      workflowId: input.workflowState?.workflowId ?? null,
      workflowStatus: input.workflowState?.status ?? null,
      updatedAt: input.task.updatedAt,
      completedAt: input.task.completedAt,
      stepCount: input.stepOutputs.length,
    },
  };
}

/**
 * Builds a result envelope from a single step output.
 */
export function buildStepResultEnvelope(
  stepOutput: StepOutputRecord,
  artifacts: ArtifactRecord[],
): ResultEnvelope {
  const structuredData = safeParseJson(stepOutput.dataJson);
  return {
    resultId: stepOutput.id,
    status: mapStepStatus(stepOutput.status),
    structuredData,
    humanSummary: stepOutput.summary ?? extractHumanSummary(structuredData),
    warnings: collectStepWarnings(stepOutput),
    artifacts: resolveArtifactRefs(stepOutput, artifacts),
    metrics: {
      tokenCost: stepOutput.tokenCost,
      durationMs: stepOutput.durationMs,
    },
    error:
      mapStepStatus(stepOutput.status) === "error"
        ? {
            code: `step_output.${stepOutput.status}`,
            message: extractErrorMessage(structuredData),
          }
        : null,
    provenance: {
      entity: "step_output",
      taskId: stepOutput.taskId,
      // R6-19 fix: nodeRunId is canonical per §5.5, stepId is deprecated legacy projection
      nodeRunId: stepOutput.nodeRunId,
      roleId: stepOutput.roleId,
      producedAt: stepOutput.producedAt,
    },
  };
}

/**
 * Collects warnings from a task and its step outputs.
 */
function collectTaskWarnings(task: TaskRecord, stepOutputs: StepOutputRecord[]): string[] {
  const warnings: string[] = [];
  if (task.status !== "done" && task.status !== "failed" && task.status !== "cancelled") {
    warnings.push(`task_non_terminal:${task.status}`);
  }
  for (const stepOutput of stepOutputs) {
    // R6-19 fix: nodeRunId is canonical per §5.5, stepId is deprecated legacy projection
    warnings.push(...collectStepWarnings(stepOutput).map((warning) => `${stepOutput.nodeRunId}:${warning}`));
  }
  return warnings;
}

/**
 * Collects warnings from a step output including validation warnings.
 */
function collectStepWarnings(stepOutput: StepOutputRecord): string[] {
  const warnings: string[] = [];
  if (stepOutput.status === "partial_success") {
    warnings.push("partial_success");
  }

  const validation = safeParseRecord(stepOutput.validationJson);
  if (validation?.valid === false) {
    warnings.push("validation_failed");
  }
  const validationWarnings = validation?.warnings;
  if (Array.isArray(validationWarnings)) {
    for (const warning of validationWarnings) {
      if (typeof warning === "string" && warning.length > 0) {
        warnings.push(`validation:${warning}`);
      }
    }
  }
  return warnings;
}

/**
 * Builds aggregated metrics from step outputs.
 */
function buildTaskMetrics(stepOutputs: StepOutputRecord[]): Record<string, number> {
  return stepOutputs.reduce(
    (metrics, stepOutput) => {
      metrics.tokenCost += stepOutput.tokenCost;
      metrics.durationMs += stepOutput.durationMs;
      return metrics;
    },
    { tokenCost: 0, durationMs: 0 },
  );
}

/**
 * Collects artifact references from step outputs or falls back to task artifacts.
 */
function collectTaskArtifactRefs(stepOutputs: StepOutputRecord[], artifacts: ArtifactRecord[]): ArtifactRef[] {
  const refs = stepOutputs.flatMap((stepOutput) => resolveArtifactRefs(stepOutput, artifacts));
  if (refs.length > 0) {
    return dedupeArtifactRefs(refs);
  }
  return dedupeArtifactRefs(artifacts.map(toArtifactRef));
}

/**
 * Resolves artifact references from a step output, matching with artifact records.
 */
function resolveArtifactRefs(stepOutput: StepOutputRecord, artifacts: ArtifactRecord[]): ArtifactRef[] {
  const artifactIndex = new Map(artifacts.map((artifact) => [artifact.artifactId, artifact]));
  const parsedRefs = safeParseArtifactRefs(stepOutput.artifactsJson).map((ref) => {
    const matching = artifactIndex.get(ref.artifactId);
    return matching ? enrichArtifactRef(ref, matching) : ref;
  });
  if (parsedRefs.length > 0) {
    return dedupeArtifactRefs(parsedRefs);
  }

  const canonicalMatches = artifacts.filter((artifact) => artifact.nodeRunId === stepOutput.nodeRunId);
  if (canonicalMatches.length > 0) {
    return dedupeArtifactRefs(canonicalMatches.map(toArtifactRef));
  }

  return dedupeArtifactRefs(
    artifacts.filter((artifact) => artifact.stepId === stepOutput.stepId).map(toArtifactRef),
  );
}

/**
 * Deduplicates artifact references by artifact ID or URI+createdAt.
 */
function dedupeArtifactRefs(refs: ArtifactRef[]): ArtifactRef[] {
  const seen = new Set<string>();
  const unique: ArtifactRef[] = [];
  for (const ref of refs) {
    const key = ref.artifactId || `${ref.uri}:${ref.createdAt}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(ref);
  }
  return unique;
}

/**
 * Enriches an artifact reference with data from the full artifact record.
 */
function enrichArtifactRef(ref: ArtifactRef, artifact: ArtifactRecord): ArtifactRef {
  return {
    ...ref,
    uri: ref.uri || artifact.storagePath,
    mimeType: ref.mimeType ?? artifact.mimeType,
    sizeBytes: ref.sizeBytes ?? artifact.sizeBytes,
    createdAt: ref.createdAt || artifact.createdAt,
    ...(ref.checksum != null
      ? { checksum: ref.checksum }
      : artifact.checksum != null
        ? { checksum: artifact.checksum }
        : {}),
  };
}

/**
 * Converts an artifact record to an artifact reference.
 */
function toArtifactRef(artifact: ArtifactRecord): ArtifactRef {
  return {
    artifactId: artifact.artifactId,
    kind: artifact.kind,
    uri: artifact.storagePath,
    mimeType: artifact.mimeType,
    sizeBytes: artifact.sizeBytes,
    createdAt: artifact.createdAt,
    ...(artifact.checksum != null ? { checksum: artifact.checksum } : {}),
  };
}

/**
 * Maps task status to result envelope status.
 */
function mapTaskStatus(status: TaskRecord["status"]): ResultEnvelopeStatus {
  if (status === "done") {
    return "success";
  }
  if (status === "failed" || status === "cancelled") {
    return "error";
  }
  return "partial";
}

/**
 * Maps step output status to result envelope status.
 */
function mapStepStatus(status: StepOutputRecord["status"]): ResultEnvelopeStatus {
  if (status === "succeeded") {
    return "success";
  }
  if (status === "failed") {
    return "error";
  }
  return "partial";
}

/**
 * Extracts a human-readable summary from structured data.
 */
function extractHumanSummary(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.summary === "string") {
    return record.summary;
  }
  if (typeof record.humanSummary === "string") {
    return record.humanSummary;
  }
  if (typeof record.result === "string") {
    return record.result;
  }
  return null;
}

/**
 * Extracts an error message from structured data.
 */
function extractErrorMessage(value: unknown): string | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.error === "string") {
    return record.error;
  }
  const error = record.error;
  if (error != null && typeof error === "object" && !Array.isArray(error)) {
    const nested = error as Record<string, unknown>;
    if (typeof nested.message === "string") {
      return nested.message;
    }
  }
  return null;
}

/**
 * Safely parses JSON, returning null on failure.
 */
function safeParseJson(raw: string | null): unknown | null {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch (err) {
    logger.debug("safeParseJson failed", { error: err });
    return null;
  }
}

/**
 * Safely parses JSON as a record object.
 */
function safeParseRecord(raw: string | null): Record<string, unknown> | null {
  const parsed = safeParseJson(raw);
  return parsed != null && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : null;
}

/**
 * Safely parses JSON as an array of artifact references.
 */
function safeParseArtifactRefs(raw: string | null): ArtifactRef[] {
  const parsed = safeParseJson(raw);
  if (!Array.isArray(parsed)) {
    return [];
  }

  const refs: ArtifactRef[] = [];
  for (const value of parsed) {
    if (value == null || typeof value !== "object" || Array.isArray(value)) {
      continue;
    }
    const record = value as Record<string, unknown>;
    if (
      typeof record.artifactId !== "string" ||
      typeof record.kind !== "string" ||
      typeof record.uri !== "string" ||
      typeof record.createdAt !== "string"
    ) {
      continue;
    }
    refs.push({
      artifactId: record.artifactId,
      kind: record.kind,
      uri: record.uri,
      ...(typeof record.mimeType === "string" ? { mimeType: record.mimeType } : {}),
      ...(typeof record.sizeBytes === "number" ? { sizeBytes: record.sizeBytes } : {}),
      ...(typeof record.checksum === "string" ? { checksum: record.checksum } : {}),
      createdAt: record.createdAt,
    });
  }
  return refs;
}
