/**
 * Platform Operator Service
 *
 * Monitors and reports on the execution plane health for platform operators.
 * Provides a unified view of workers, execution tickets, leases, readiness,
 * and topology across the entire multi-tenant platform.
 *
 * This service is responsible for:
 * - Worker fleet monitoring: Tracking worker health, staleness, and trust status
 * - Execution plane metrics: Ticket and lease counts by status
 * - Readiness verification: Ensuring all infrastructure components are ready
 * - Promotion eligibility: Determining if an environment can be promoted
 * - Risk identification: Detecting deployment risks before they cause incidents
 *
 * The report aggregates data from multiple sources:
 * - Worker snapshots: Registration and heartbeat status
 * - Execution tickets: Pending/claimed/consumed work items
 * - Execution leases: Active/expired lease state
 * - Environment readiness: Infrastructure component status
 * - Stable release package: Evidence-based promotion criteria
 *
 * @see stable-release-package.ts for the release package that feeds promotion criteria
 * @see docs_zh/contracts/platform_operator_contract.md
 */
import { type ArtifactStoreOptions } from "../../platform/state-evidence/artifacts/artifact-store.js";
import { AuthoritativeTaskStore } from "../../platform/state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../platform/state-evidence/truth/authoritative-sql-database.js";
import { type StableReleasePackageReport } from "../../platform/shared/stability/stable-release-package.js";
import type { StableGateTargetStatus } from "../../platform/shared/stability/stable-release-gate.js";
import type { ArtifactRef, EnvironmentName, EnvironmentReadinessComponentType, ExecutionLeaseRecord, ExecutionTicketRecord, WorkerSchedulingStatus } from "../../platform/contracts/types/domain.js";
/** Input for building a platform operator report */
export interface PlatformOperatorBuildInput {
    environment: EnvironmentName;
    evidenceRootDir: string;
    packageOutputDir: string;
    targetStatus?: StableGateTargetStatus;
    generatedAt?: string;
}
/** Summary of worker fleet status */
export interface PlatformOperatorExecutionPlaneSummary {
    workerCounts: Record<WorkerSchedulingStatus | "untrusted" | "stale", number> & {
        total: number;
        totalAvailableSlots: number;
    };
    ticketCounts: Record<ExecutionTicketRecord["status"], number>;
    leaseCounts: Record<ExecutionLeaseRecord["status"], number>;
    readinessSummary: Array<{
        componentType: EnvironmentReadinessComponentType;
        total: number;
        ready: number;
        notReady: number;
        stale: number;
        allReady: boolean;
    }>;
    topology: {
        organizations: number;
        workspaces: number;
        tenants: number;
        deploymentBindings: number;
        dataNamespaces: number;
    };
    staleWorkerIds: string[];
    untrustedWorkerIds: string[];
    promotionRisks: string[];
}
/** Complete platform operator report */
export interface PlatformOperatorReport {
    reportId: string;
    componentId: "execution_plane";
    generatedAt: string;
    environment: EnvironmentName;
    targetStatus: StableGateTargetStatus;
    currentStatus: StableReleasePackageReport["gate"]["currentStatus"];
    overallVerdict: StableReleasePackageReport["overallVerdict"];
    promoteEligible: boolean;
    executionPlane: PlatformOperatorExecutionPlaneSummary;
    releasePackage: StableReleasePackageReport;
}
/** Export result with artifact references */
export interface PlatformOperatorExportResult {
    report: PlatformOperatorReport;
    jsonArtifact: ArtifactRef;
    markdownArtifact: ArtifactRef;
}
/** Configuration options */
export interface PlatformOperatorServiceOptions {
    artifactStoreOptions?: ArtifactStoreOptions;
    /** Threshold in ms before a worker is considered stale (default: 10 minutes) */
    staleWorkerThresholdMs?: number;
    /** Threshold in ms before readiness is considered stale (default: 24 hours) */
    readinessStaleThresholdMs?: number;
}
/**
 * Platform Operator Service
 *
 * Provides platform-wide visibility into execution plane health.
 * Used by platform operators to monitor fleet status, identify risks,
 * and determine promotion readiness.
 */
export declare class PlatformOperatorService {
    private readonly db;
    private readonly store;
    private readonly artifactStore;
    private readonly staleWorkerThresholdMs;
    private readonly readinessStaleThresholdMs;
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore, options?: PlatformOperatorServiceOptions);
    /**
     * Builds a comprehensive platform operator report.
     *
     * Aggregates:
     * - Worker fleet status and counts
     * - Execution ticket and lease state
     * - Infrastructure readiness per component
     * - Tenant topology counts
     * - Stable release package for promotion criteria
     *
     * Determines promotion eligibility based on release package verdict
     * and absence of execution plane risks.
     */
    buildReport(input: PlatformOperatorBuildInput): PlatformOperatorReport;
    /**
     * Exports the platform operator report as JSON and Markdown artifacts.
     */
    exportReport(input: PlatformOperatorBuildInput): PlatformOperatorExportResult;
    /** Builds readiness summary for a specific component type */
    private buildReadinessSummary;
    /**
     * Collects all promotion risks from multiple sources.
     *
     * Checks:
     * - Release package blockers
     * - Stale worker count
     * - Untrusted worker count
     * - Missing or non-ready readiness records
     * - Lease count anomalies
     * - Topology consistency
     */
    private collectPromotionRisks;
    /** Checks if a worker is trusted (remote workers must have verified registration) */
    private isWorkerTrusted;
    /** Checks if a worker is stale based on last heartbeat */
    private isWorkerStale;
    /** Checks if a readiness record shows the component as ready */
    private isReadinessReady;
    /** Checks if a readiness record is stale (not verified recently) */
    private isReadinessStale;
    /** Calculates age in milliseconds between two timestamps */
    private ageMs;
}
