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
import type { DiagnosticWarningSummary, DiagnosticsService, IncidentTimelineReport } from "../../shared/observability/diagnostics-service.js";
import type { StalledExecutionDetectionOptions, StalledExecutionFinding } from "./stalled-execution-detector.js";
import { StalledExecutionDetector } from "./stalled-execution-detector.js";
/**
 * Complete escalation package for a stalled execution.
 *
 * Bundles everything an operator needs to understand the stall and decide
 * on remediation: execution state, diagnostics, health status, and incident analysis.
 */
export interface StalledExecutionEscalationPackage {
    executionId: string;
    taskId: string;
    agentId: string;
    status: string;
    staleKind: StalledExecutionFinding["staleKind"];
    recommendedAction: StalledExecutionFinding["recommendedAction"];
    suggestedOperatorAction: "reclaim_lease_and_requeue" | "restart_execution_or_takeover";
    generatedAt: string;
    traceId: string | null;
    correlationId: string | null;
    currentStepId: string | null;
    runtimeInstanceId: string | null;
    lastProgressAt: string;
    lastHeartbeatAt: string | null;
    dispatchOutcome: string | null;
    healthStatus: string;
    warnings: DiagnosticWarningSummary;
    incident: {
        totalEntries: number;
        highestSeverity: IncidentTimelineReport["summary"]["highestSeverity"];
        candidateRootCauses: string[];
        startedAt: string | null;
        endedAt: string | null;
    };
}
/**
 * Service that builds escalation packages from stalled execution findings.
 *
 * Combines stall detection results with diagnostics to create comprehensive
 * reports that help operators understand and remediate stalled executions.
 */
export declare class StalledExecutionEscalationService {
    private readonly stalledDetector;
    private readonly diagnosticsService;
    constructor(stalledDetector: StalledExecutionDetector, diagnosticsService: DiagnosticsService);
    /**
     * Builds escalation packages for all detected stalled executions.
     *
     * Detects stalled executions and transforms each finding into a full
     * escalation package with diagnostics context.
     */
    buildPackages(options?: StalledExecutionDetectionOptions): StalledExecutionEscalationPackage[];
    /**
     * Builds an escalation package for a single stalled execution finding.
     *
     * Collects task snapshot, debug dump, incident timeline, and combines
     * them with the stall detection finding into a comprehensive package.
     */
    buildPackage(finding: StalledExecutionFinding, generatedAt?: string): StalledExecutionEscalationPackage;
}
