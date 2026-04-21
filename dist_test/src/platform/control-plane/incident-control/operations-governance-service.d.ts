/**
 * Operations Governance Service
 *
 * Provides comprehensive governance reporting for operations including SLO
 * evaluation, runbook recommendations, oncall policy information, and
 * incident packaging for automated alerting and human review.
 *
 * This service is the core of the operations governance subsystem, aggregating
 * metrics, health, and diagnostics data into actionable governance reports.
 */
import { type ArtifactStoreOptions } from "../../state-evidence/artifacts/artifact-store.js";
import { type IncidentTimelineReport, DiagnosticsService } from "../../shared/observability/diagnostics-service.js";
import { MetricsService, type RuntimeMetricsSummary } from "../../shared/observability/metrics-service.js";
import { DoctorService, type DoctorReport } from "./doctor-service.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import type { ArtifactRef, EnvironmentName } from "../../contracts/types/domain.js";
export type OperationsSloKey = "task_success_rate" | "task_start_latency" | "approval_delivery_availability" | "recovery_success_rate" | "tier1_event_delivery_latency" | "cost_accounting_accuracy";
export type OperationsSloStatus = "pass" | "warning" | "fail" | "insufficient_data";
export interface OperationsSloReport {
    key: OperationsSloKey;
    displayName: string;
    objective: string;
    unit: "percent" | "milliseconds";
    source: string;
    actualValue: number | null;
    thresholdValue: number;
    comparator: ">=" | "<=";
    status: OperationsSloStatus;
    errorBudgetRemainingPct: number | null;
    notes: string[];
}
export type RunbookSeverity = "P0" | "P1" | "P2" | "P3";
export interface RunbookDefinition {
    runbookId: "worker_mass_disconnect" | "provider_429_or_5xx_spike" | "queue_backlog_breach" | "approval_channel_unavailable" | "cost_spike_containment" | "database_lock_contention" | "stale_lease_repair" | "secret_rotation_failure";
    title: string;
    severity: RunbookSeverity;
    summary: string;
    ownerRole: string;
    documentRefs: string[];
    commands: string[];
}
export interface OncallContact {
    role: string;
    escalationAfterMinutes: number;
    responsibilities: string[];
}
export interface OperationsOncallPolicy {
    policyId: string;
    primaryRole: string;
    secondaryRole: string;
    contacts: OncallContact[];
    communicationChannels: string[];
    handoverRequirements: string[];
}
export interface OperationsIncidentPackage {
    incidentId: string;
    taskId: string;
    severity: RunbookSeverity;
    candidateRootCauses: string[];
    recommendedRunbookIds: RunbookDefinition["runbookId"][];
    recommendedCommands: string[];
    timeline: IncidentTimelineReport;
    markdown: string;
}
export interface OperationsGovernanceReport {
    reportId: string;
    generatedAt: string;
    environment: EnvironmentName;
    summary: {
        overallStatus: "pass" | "warning" | "fail";
        failingSloCount: number;
        warningSloCount: number;
        runbookCount: number;
        oncallReady: boolean;
        incidentConsoleReady: boolean;
    };
    slos: OperationsSloReport[];
    runbooks: RunbookDefinition[];
    oncallPolicy: OperationsOncallPolicy;
    metrics: RuntimeMetricsSummary;
    doctor: Pick<DoctorReport, "status" | "selfCheckSummary" | "eventBacklogSummary" | "workerSummary">;
    incident: OperationsIncidentPackage | null;
}
export interface OperationsGovernanceBuildInput {
    environment: EnvironmentName;
    generatedAt?: string;
    taskId?: string;
}
export interface OperationsGovernanceExportResult {
    report: OperationsGovernanceReport;
    jsonArtifact: ArtifactRef;
    markdownArtifact: ArtifactRef;
}
export interface OperationsGovernanceServiceOptions {
    artifactStoreOptions?: ArtifactStoreOptions;
}
/**
 * OperationsGovernanceService aggregates metrics, health, and diagnostics data
 * into comprehensive governance reports for operations teams. It evaluates SLOs,
 * recommends runbooks, and packages incident information for efficient
 * incident response and shift handoffs.
 */
export declare class OperationsGovernanceService {
    private readonly db;
    private readonly metricsService;
    private readonly doctorService;
    private readonly diagnosticsService;
    private readonly artifactStore;
    constructor(db: AuthoritativeSqlDatabase, metricsService: MetricsService, doctorService: DoctorService, diagnosticsService: DiagnosticsService, options?: OperationsGovernanceServiceOptions);
    /**
     * Builds a comprehensive operations governance report including SLO status,
     * runbook recommendations, oncall policy, and optionally an incident package.
     */
    buildReport(input: OperationsGovernanceBuildInput): OperationsGovernanceReport;
    /**
     * Exports the governance report to JSON and markdown artifacts.
     */
    exportReport(input: OperationsGovernanceBuildInput): OperationsGovernanceExportResult;
    /**
     * Builds SLO reports by evaluating metrics against defined thresholds.
     * Each SLO is evaluated with pass/warning/fail/insufficient_data status.
     */
    private buildSlos;
    /**
     * Collects task start latencies in milliseconds from the database.
     * Start latency is the time between task creation and execution start.
     */
    private collectTaskStartLatenciesMs;
    /**
     * Computes the average cost accounting accuracy as a percentage drift
     * between estimated and actual costs.
     */
    private computeCostAccountingAccuracyPct;
    /**
     * Builds an incident package for a specific task, including the incident
     * timeline, candidate root causes, and recommended runbooks and commands.
     */
    private buildIncidentPackage;
    /**
     * Recommends runbooks based on the incident timeline's root causes
     * and diagnostic entries. Uses keyword matching against known patterns.
     */
    private recommendRunbooks;
}
