/**
 * @fileoverview Stalled Execution Escalation Service - Packages stalled execution findings for operators.
 *
 * When a stalled execution is detected, this service builds an escalation package that
 * provides operators with all the context needed to decide on remediation actions.
 *
 * The escalation package includes:
 * - Execution and task identifiers
 * - Stall detection details (kind, recommended action)
 * - Suggested operator action (reclaim and requeue vs restart/takeover)
 * - Runtime state (step, instance, progress timestamps)
 * - Health status and diagnostic warnings
 * - Incident timeline with root cause analysis
 *
 * @see Stalled Execution Detector: stalled-execution-detector.ts
 * @see Diagnostics Service: observability/diagnostics-service.ts
 */
import { nowIso } from "../../contracts/types/ids.js";
/**
 * Service that builds escalation packages from stalled execution findings.
 *
 * Combines stall detection results with diagnostics to create comprehensive
 * reports that help operators understand and remediate stalled executions.
 */
export class StalledExecutionEscalationService {
    stalledDetector;
    diagnosticsService;
    constructor(stalledDetector, diagnosticsService) {
        this.stalledDetector = stalledDetector;
        this.diagnosticsService = diagnosticsService;
    }
    /**
     * Builds escalation packages for all detected stalled executions.
     *
     * Detects stalled executions and transforms each finding into a full
     * escalation package with diagnostics context.
     */
    buildPackages(options = {}) {
        return this.stalledDetector.detect(options).map((finding) => this.buildPackage(finding, options.now ?? nowIso()));
    }
    /**
     * Builds an escalation package for a single stalled execution finding.
     *
     * Collects task snapshot, debug dump, incident timeline, and combines
     * them with the stall detection finding into a comprehensive package.
     */
    buildPackage(finding, generatedAt = nowIso()) {
        const snapshot = this.diagnosticsService.buildTaskSnapshot(finding.taskId);
        const debugDump = this.diagnosticsService.buildDebugDump(finding.taskId);
        const incident = this.diagnosticsService.buildIncidentTimelineReport(finding.taskId);
        const activeAgentExecution = snapshot.inspect.agentExecutions.find((record) => record.executionId === finding.executionId);
        return {
            executionId: finding.executionId,
            taskId: finding.taskId,
            agentId: finding.agentId,
            status: finding.status,
            staleKind: finding.staleKind,
            recommendedAction: finding.recommendedAction,
            suggestedOperatorAction: finding.recommendedAction === "lease_reclaim"
                ? "reclaim_lease_and_requeue"
                : "restart_execution_or_takeover",
            generatedAt,
            traceId: snapshot.traceSummary.traceId,
            correlationId: snapshot.traceSummary.correlationId,
            currentStepId: activeAgentExecution?.currentStepId ?? null,
            runtimeInstanceId: activeAgentExecution?.runtimeInstanceId ?? null,
            lastProgressAt: finding.lastProgressAt,
            lastHeartbeatAt: finding.lastHeartbeatAt,
            dispatchOutcome: snapshot.inspect.dispatchDecisions.at(-1)?.outcome ?? null,
            healthStatus: snapshot.health.status,
            warnings: debugDump.warningSummary,
            incident: {
                totalEntries: incident.summary.totalEntries,
                highestSeverity: incident.summary.highestSeverity,
                candidateRootCauses: [...incident.candidateRootCauses],
                startedAt: incident.window.startedAt,
                endedAt: incident.window.endedAt,
            },
        };
    }
}
//# sourceMappingURL=stalled-execution-escalation-service.js.map