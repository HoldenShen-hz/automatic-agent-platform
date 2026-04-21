/**
 * Inspect Service
 *
 * Provides read-only views into task, execution, and approval state for debugging,
 * operator interfaces, and observability dashboards. Aggregates data from the
 * AuthoritativeTaskStore and RuntimeRecoveryService.
 *
 * @see {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/contracts/debug_inspect_health_backpressure_contract.md | Debug Inspect Health Backpressure Contract}
 * @see {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/contracts/observability_contract.md | Observability Contract}
 * @see {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary and Terminology}
 * @see {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/architecture/00-platform-architecture.md | Architecture and Technical Design}
 */
import { buildStepResultEnvelope } from "../../contracts/result-envelope/result-envelope.js";
import { StructuredLogger } from "./structured-logger.js";
const inspectLogger = new StructuredLogger({ retentionLimit: 50 });
const TERMINAL_EXECUTION_STATUSES = new Set(["succeeded", "failed", "cancelled", "superseded"]);
export function parseApprovalRequestSummary(requestJson) {
    try {
        const parsed = JSON.parse(requestJson);
        return {
            sourceAgentId: typeof parsed.sourceAgentId === "string" ? parsed.sourceAgentId : null,
            riskLevel: typeof parsed.riskLevel === "string" ? parsed.riskLevel : null,
        };
    }
    catch (err) {
        inspectLogger.log({ level: "debug", message: "Failed to parse approval request summary", data: { error: err instanceof Error ? err.message : String(err) } });
        return {
            sourceAgentId: null,
            riskLevel: null,
        };
    }
}
export function parseApprovalDecisionSummary(responseJson) {
    if (responseJson == null) {
        return {
            decisionType: null,
            respondedBy: null,
            cascadeDeny: false,
        };
    }
    try {
        const parsed = JSON.parse(responseJson);
        return {
            decisionType: typeof parsed.decisionType === "string" ? parsed.decisionType : null,
            respondedBy: typeof parsed.respondedBy === "string" ? parsed.respondedBy : null,
            cascadeDeny: parsed.cascadeDeny === true,
        };
    }
    catch (err) {
        inspectLogger.log({ level: "debug", message: "Failed to parse approval decision summary", data: { error: err instanceof Error ? err.message : String(err) } });
        return {
            decisionType: null,
            respondedBy: null,
            cascadeDeny: false,
        };
    }
}
export function parseDispatchDecisionTraceFromEvent(event) {
    if (event.eventType !== "dispatch:decision_recorded") {
        return null;
    }
    try {
        const parsed = JSON.parse(event.payloadJson);
        if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
            return null;
        }
        const candidate = parsed;
        if (typeof candidate.ticketId !== "string" ||
            typeof candidate.executionId !== "string" ||
            typeof candidate.taskId !== "string" ||
            !Array.isArray(candidate.requiredCapabilities) ||
            !Array.isArray(candidate.evaluations)) {
            return null;
        }
        return parsed;
    }
    catch (err) {
        inspectLogger.log({ level: "debug", message: "Failed to parse dispatch decision trace from event", data: { error: err instanceof Error ? err.message : String(err) } });
        return null;
    }
}
export function normalizeLimit(limit, fallback) {
    if (!Number.isFinite(limit) || limit == null) {
        return fallback;
    }
    return Math.max(1, Math.min(200, Math.trunc(limit)));
}
export function parseJsonArray(value) {
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
    }
    catch (err) {
        inspectLogger.log({ level: "debug", message: "Failed to parse JSON array", data: { error: err instanceof Error ? err.message : String(err) } });
        return [];
    }
}
function isTerminalExecutionStatus(status) {
    return TERMINAL_EXECUTION_STATUSES.has(status);
}
export function findActiveExecutionId(executions) {
    for (let index = executions.length - 1; index >= 0; index -= 1) {
        const execution = executions[index];
        if (execution && !isTerminalExecutionStatus(execution.status)) {
            return execution.id;
        }
    }
    return null;
}
/**
 * InspectService provides read-only views into task, execution, and approval state.
 * It aggregates data from the AuthoritativeTaskStore and RuntimeRecoveryService to provide
 * comprehensive debugging and observability information.
 */
export function buildStepResultEnvelopes(stepOutputs, artifacts) {
    return stepOutputs.map((stepOutput) => buildStepResultEnvelope(stepOutput, artifacts.filter((artifact) => artifact.stepId === stepOutput.stepId)));
}
export function enrichDispatchDecisionTrace(decision) {
    const acceptedWorkerIds = decision.evaluations.filter((evaluation) => evaluation.accepted).map((evaluation) => evaluation.workerId);
    const rejectedWorkerIds = decision.evaluations.filter((evaluation) => !evaluation.accepted).map((evaluation) => evaluation.workerId);
    return {
        ...decision,
        selectedWorkerPlacement: resolveSelectedWorkerPlacement(decision.selectedWorkerId, decision.evaluations),
        acceptedWorkerIds,
        rejectedWorkerIds,
        remoteAcceptedWorkerIds: collectWorkerIds(decision.evaluations, "remote", true),
        remoteRejectedWorkerIds: collectWorkerIds(decision.evaluations, "remote", false),
        localAcceptedWorkerIds: collectWorkerIds(decision.evaluations, "local", true),
        localRejectedWorkerIds: collectWorkerIds(decision.evaluations, "local", false),
    };
}
export function buildRemoteRoutingSummary(decisions) {
    const latestDecision = decisions.at(-1) ?? null;
    const remoteWorkerIds = new Set();
    const localWorkerIds = new Set();
    for (const decision of decisions) {
        for (const evaluation of decision.evaluations) {
            if (evaluation.placement === "remote") {
                remoteWorkerIds.add(evaluation.workerId);
            }
            else if (evaluation.placement === "local") {
                localWorkerIds.add(evaluation.workerId);
            }
        }
    }
    return {
        totalDecisions: decisions.length,
        remoteDecisionCount: decisions.filter(hasRemoteRoutingDimension).length,
        healthyDecisionCount: decisions.filter((decision) => decision.remoteAvailability === "healthy").length,
        partialAvailableDecisionCount: decisions.filter((decision) => decision.remoteAvailability === "partial_available").length,
        degradedDecisionCount: decisions.filter((decision) => decision.remoteAvailability === "degraded").length,
        unavailableDecisionCount: decisions.filter((decision) => decision.remoteAvailability === "unavailable").length,
        remoteDispatchCount: decisions.filter((decision) => decision.selectedWorkerPlacement === "remote").length,
        localDispatchCount: decisions.filter((decision) => decision.selectedWorkerPlacement === "local").length,
        localFallbackCount: decisions.filter((decision) => decision.fallbackApplied === true).length,
        requireRemoteBlockedCount: decisions.filter((decision) => decision.outcome === "blocked" && decision.dispatchTarget === "require_remote").length,
        latestRemoteAvailability: latestDecision?.remoteAvailability ?? null,
        latestSelectedWorkerPlacement: latestDecision?.selectedWorkerPlacement ?? null,
        remoteWorkerIds: [...remoteWorkerIds].sort(),
        localWorkerIds: [...localWorkerIds].sort(),
    };
}
export function buildLeaseHandoverSummary(events) {
    const handovers = events
        .filter((event) => event.eventType === "lease:handover_recorded")
        .map((event) => {
        let payload = null;
        try {
            const parsed = JSON.parse(event.payloadJson);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                payload = parsed;
            }
        }
        catch (err) {
            inspectLogger.log({ level: "debug", message: "Failed to parse lease handover event payload", data: { eventId: event.id, error: err instanceof Error ? err.message : String(err) } });
            payload = null;
        }
        return {
            createdAt: event.createdAt,
            previousWorkerId: typeof payload?.previousWorkerId === "string" ? payload.previousWorkerId : null,
            workerId: typeof payload?.workerId === "string" ? payload.workerId : null,
            reasonCode: typeof payload?.reasonCode === "string" ? payload.reasonCode : null,
        };
    });
    const latestHandover = handovers.at(-1) ?? null;
    const workerIds = new Set();
    for (const handover of handovers) {
        if (handover.previousWorkerId) {
            workerIds.add(handover.previousWorkerId);
        }
        if (handover.workerId) {
            workerIds.add(handover.workerId);
        }
    }
    return {
        totalHandovers: handovers.length,
        latestHandoverAt: latestHandover?.createdAt ?? null,
        latestReasonCode: latestHandover?.reasonCode ?? null,
        latestPreviousWorkerId: latestHandover?.previousWorkerId ?? null,
        latestWorkerId: latestHandover?.workerId ?? null,
        workerIds: [...workerIds].sort(),
    };
}
function hasRemoteRoutingDimension(decision) {
    return (decision.dispatchTarget === "prefer_remote" ||
        decision.dispatchTarget === "require_remote" ||
        decision.remoteAvailability != null ||
        decision.evaluations.some((evaluation) => evaluation.placement === "remote"));
}
function resolveSelectedWorkerPlacement(selectedWorkerId, evaluations) {
    if (!selectedWorkerId) {
        return null;
    }
    return evaluations.find((evaluation) => evaluation.workerId === selectedWorkerId)?.placement ?? null;
}
function collectWorkerIds(evaluations, placement, accepted) {
    return evaluations
        .filter((evaluation) => evaluation.placement === placement && evaluation.accepted === accepted)
        .map((evaluation) => evaluation.workerId);
}
//# sourceMappingURL=inspect-service-support.js.map