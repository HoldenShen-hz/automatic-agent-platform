import type { MetricsService } from "../../../platform/shared/observability/metrics-service.js";
import type { ArtifactRef, PmfValidationReportRecord, PmfValidationVerdict } from "../../../platform/contracts/types/domain.js";
/** Status of a single PMF metric check */
export type PmfCheckStatus = "pass" | "warn" | "fail";
/**
 * Threshold values for PMF metric validation.
 * All thresholds are configurable per-run via options.
 */
export interface PmfValidationThresholds {
    /** Minimum total task count for sample size adequacy */
    minTaskCount: number;
    /** Minimum total session count for sample size adequacy */
    minSessionCount: number;
    /** Minimum percentage of terminal tasks that succeeded (0-100) */
    minTaskSuccessRatePct: number;
    /** Minimum percentage of sessions with successful task outcome (0-100) */
    minActivationRatePct: number;
    /** Minimum percentage of root workloads with 2+ tasks (0-100) */
    minRepeatUsageRatePct: number;
    /** Minimum percentage of approvals that are resolved (0-100) */
    minApprovalResolutionRatePct: number;
    /** Maximum average cost in USD for successful tasks */
    maxAverageSuccessfulTaskCostUsd: number;
    /** Maximum P95 step duration in milliseconds */
    maxP95StepDurationMs: number;
}
/** Time window for PMF validation queries */
export interface PmfValidationWindow {
    start: string;
    end: string;
    days: number;
}
/** A single metric check result within a PMF validation report */
export interface PmfMetricCheck {
    checkId: "sample_size" | "task_success_rate" | "activation_rate" | "repeat_usage_rate" | "approval_resolution_rate" | "average_success_cost" | "p95_step_duration";
    status: PmfCheckStatus;
    /** Human-readable explanation of the check result */
    detail: string;
    /** Observed value (null if insufficient data) */
    observed: number | null;
    /** Threshold value used for comparison */
    threshold: number | null;
    unit: "count" | "pct" | "usd" | "ms";
}
/** Complete PMF validation report */
export interface PmfValidationReport {
    reportId: string;
    profileName: string;
    generatedAt: string;
    window: PmfValidationWindow;
    divisionId: string | null;
    verdict: PmfValidationVerdict;
    summary: string;
    metrics: {
        taskCount: number;
        terminalTaskCount: number;
        successfulTaskCount: number;
        activationSessionCount: number;
        sessionCount: number;
        repeatedRootCount: number;
        rootCount: number;
        approvalCount: number;
        resolvedApprovalCount: number;
        averageSuccessfulTaskCostUsd: number | null;
        p95StepDurationMs: number | null;
        divisionCount: number;
        crossDivisionTaskCount: number;
        taskSuccessRatePct: number | null;
        activationRatePct: number | null;
        repeatUsageRatePct: number | null;
        approvalResolutionRatePct: number | null;
        crossDivisionUsageRatePct: number | null;
    };
    checks: PmfMetricCheck[];
    runtimeSummary: ReturnType<MetricsService["buildSummary"]>;
}
/** Options for running a PMF validation */
export interface PmfValidationRunOptions {
    /** Profile name for this validation run (default: phase3_default) */
    profileName?: string;
    /** Optional division ID to scope validation to a specific division */
    divisionId?: string | null;
    /** Number of days to look back for metrics (default: 14) */
    windowDays?: number;
    /** Evaluation timestamp (default: now) */
    evaluatedAt?: string;
    /** Override threshold values */
    thresholds?: Partial<PmfValidationThresholds>;
}
/** Result of running PMF validation */
export interface PmfValidationRunResult {
    report: PmfValidationReport;
    record: PmfValidationReportRecord;
}
/** Extended result including exported artifact references */
export interface PmfValidationExportResult extends PmfValidationRunResult {
    jsonArtifact: ArtifactRef;
    markdownArtifact: ArtifactRef;
}
/** SQL filter clause with parameters for safe query building */
export interface SqlFilterClause {
    whereClause: string;
    parameters: Array<string | number | null>;
}
