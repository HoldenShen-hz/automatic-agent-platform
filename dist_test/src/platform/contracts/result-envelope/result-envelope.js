/**
 * Result Envelope
 *
 * Constructs standardized result envelopes from task and step outputs.
 * Envelopes provide a consistent structure for returning results including
 * status, data, artifacts, metrics, and provenance information.
 */
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
const logger = new StructuredLogger({ retentionLimit: 100 });
/**
 * Builds a result envelope from a completed task.
 *
 * Combines task output, workflow state, step outputs, and artifacts
 * into a standardized result envelope.
 */
export function buildTaskResultEnvelope(input) {
    const structuredData = safeParseJson(input.task.outputJson);
    if (structuredData == null && input.stepOutputs.length === 0 && input.artifacts.length === 0) {
        return null;
    }
    const finalStep = input.stepOutputs.at(-1) ?? null;
    return {
        resultId: input.task.id,
        status: mapTaskStatus(input.task.status),
        structuredData,
        humanSummary: extractHumanSummary(structuredData) ?? finalStep?.summary ?? input.task.title,
        warnings: collectTaskWarnings(input.task, input.stepOutputs),
        artifacts: collectTaskArtifactRefs(input.stepOutputs, input.artifacts),
        metrics: input.stepOutputs.length > 0 ? buildTaskMetrics(input.stepOutputs) : null,
        error: mapTaskStatus(input.task.status) === "error"
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
export function buildStepResultEnvelope(stepOutput, artifacts) {
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
        error: mapStepStatus(stepOutput.status) === "error"
            ? {
                code: `step_output.${stepOutput.status}`,
                message: extractErrorMessage(structuredData),
            }
            : null,
        provenance: {
            entity: "step_output",
            taskId: stepOutput.taskId,
            stepId: stepOutput.stepId,
            roleId: stepOutput.roleId,
            producedAt: stepOutput.producedAt,
        },
    };
}
/**
 * Collects warnings from a task and its step outputs.
 */
function collectTaskWarnings(task, stepOutputs) {
    const warnings = [];
    if (task.status !== "done" && task.status !== "failed" && task.status !== "cancelled") {
        warnings.push(`task_non_terminal:${task.status}`);
    }
    for (const stepOutput of stepOutputs) {
        warnings.push(...collectStepWarnings(stepOutput).map((warning) => `${stepOutput.stepId}:${warning}`));
    }
    return warnings;
}
/**
 * Collects warnings from a step output including validation warnings.
 */
function collectStepWarnings(stepOutput) {
    const warnings = [];
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
function buildTaskMetrics(stepOutputs) {
    return stepOutputs.reduce((metrics, stepOutput) => {
        metrics.tokenCost += stepOutput.tokenCost;
        metrics.durationMs += stepOutput.durationMs;
        return metrics;
    }, { tokenCost: 0, durationMs: 0 });
}
/**
 * Collects artifact references from step outputs or falls back to task artifacts.
 */
function collectTaskArtifactRefs(stepOutputs, artifacts) {
    const refs = stepOutputs.flatMap((stepOutput) => resolveArtifactRefs(stepOutput, artifacts));
    if (refs.length > 0) {
        return dedupeArtifactRefs(refs);
    }
    return dedupeArtifactRefs(artifacts.map(toArtifactRef));
}
/**
 * Resolves artifact references from a step output, matching with artifact records.
 */
function resolveArtifactRefs(stepOutput, artifacts) {
    const artifactIndex = new Map(artifacts.map((artifact) => [artifact.artifactId, artifact]));
    const parsedRefs = safeParseArtifactRefs(stepOutput.artifactsJson).map((ref) => {
        const matching = artifactIndex.get(ref.artifactId);
        return matching ? enrichArtifactRef(ref, matching) : ref;
    });
    if (parsedRefs.length > 0) {
        return dedupeArtifactRefs(parsedRefs);
    }
    return dedupeArtifactRefs(artifacts.filter((artifact) => artifact.stepId === stepOutput.stepId).map(toArtifactRef));
}
/**
 * Deduplicates artifact references by artifact ID or URI+createdAt.
 */
function dedupeArtifactRefs(refs) {
    const seen = new Set();
    const unique = [];
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
function enrichArtifactRef(ref, artifact) {
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
function toArtifactRef(artifact) {
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
function mapTaskStatus(status) {
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
function mapStepStatus(status) {
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
function extractHumanSummary(value) {
    if (value == null) {
        return null;
    }
    if (typeof value === "string") {
        return value;
    }
    if (typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    const record = value;
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
function extractErrorMessage(value) {
    if (value == null || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    const record = value;
    if (typeof record.error === "string") {
        return record.error;
    }
    const error = record.error;
    if (error != null && typeof error === "object" && !Array.isArray(error)) {
        const nested = error;
        if (typeof nested.message === "string") {
            return nested.message;
        }
    }
    return null;
}
/**
 * Safely parses JSON, returning null on failure.
 */
function safeParseJson(raw) {
    if (!raw) {
        return null;
    }
    try {
        return JSON.parse(raw);
    }
    catch (err) {
        logger.debug("safeParseJson failed", { error: err });
        return null;
    }
}
/**
 * Safely parses JSON as a record object.
 */
function safeParseRecord(raw) {
    const parsed = safeParseJson(raw);
    return parsed != null && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed
        : null;
}
/**
 * Safely parses JSON as an array of artifact references.
 */
function safeParseArtifactRefs(raw) {
    const parsed = safeParseJson(raw);
    if (!Array.isArray(parsed)) {
        return [];
    }
    const refs = [];
    for (const value of parsed) {
        if (value == null || typeof value !== "object" || Array.isArray(value)) {
            continue;
        }
        const record = value;
        if (typeof record.artifactId !== "string" ||
            typeof record.kind !== "string" ||
            typeof record.uri !== "string" ||
            typeof record.createdAt !== "string") {
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
//# sourceMappingURL=result-envelope.js.map