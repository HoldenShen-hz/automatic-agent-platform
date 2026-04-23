/**
 * Stable Release Package Assembly and Reporting
 *
 * Assembles evidence from multiple sources (profiles, rehearsals, checklists) into a
 * coherent release package for promotion decisions. This is the top-level report
 * that platform operators use to decide whether to promote a component.
 *
 * The release package includes:
 * - Evidence profiles (smoke, 24h, 72h) with pass/fail status
 * - Release gate evaluation from stable-release-gate.ts
 * - Release checklist with all readiness criteria
 * - Next actions to address any failures
 * - Recommended commands to regenerate evidence
 *
 * @see stable-release-gate.ts for the underlying gate evaluation
 * @see stable-evidence-bundle.ts for evidence profiles consumed here
 * @see docs_zh/contracts/platform_promote_criteria_contract.md for promotion criteria
 */
import { type StableGateTargetStatus, type StableReleaseGateReport } from "./stable-release-gate.js";
import type { StableEvidenceProfileName } from "./stable-evidence-bundle.js";
/** Options for creating a release package */
export interface StableReleasePackageOptions {
    evidenceRootDir: string;
    outputDir: string;
    targetStatus?: StableGateTargetStatus;
}
/** Summary of a single evidence profile within the package */
export interface StableReleasePackageProfileSummary {
    profile: StableEvidenceProfileName;
    reportPath: string;
    present: boolean;
    passed: boolean | null;
    chaosPassed: boolean | null;
    leasePassed: boolean | null;
    rollbackPassed: boolean | null;
    rollingUpgradePassed: boolean | null;
    maintenancePassed: boolean | null;
    grayReleasePassed: boolean | null;
    dbQueueDisconnectPassed: boolean | null;
    dbWritabilityPassed: boolean | null;
    queueDeliveryPassed: boolean | null;
    migrationCompatibilityPassed: boolean | null;
    backupRestorePlaybookPath: string | null;
    rollingUpgradePlaybookPath: string | null;
    maintenancePlaybookPath: string | null;
    grayReleasePlaybookPath: string | null;
    doctorStatus: string | null;
    acceptanceLineStatus: "pass" | "partial" | "fail" | null;
    acceptanceReportPath: string | null;
    acceptanceObservedSoakDurationMs: number | null;
}
/** A single item in the release readiness checklist */
export interface StableReleaseChecklistItem {
    itemId: "release_gate_verdict" | "required_criteria_complete" | "smoke_evidence_available" | "long_run_soak_complete" | "stable_acceptance_line_ready" | "tenant_gray_ready" | "recovery_regression_ready" | "disaster_recovery_ready" | "rolling_upgrade_ready" | "maintenance_handover_ready" | "db_queue_disconnect_ready" | "db_writability_ready" | "queue_delivery_ready" | "rollback_path_ready" | "runbooks_ready" | "ownership_ready";
    status: "pass" | "partial" | "fail";
    detail: string;
    evidenceRefs: string[];
}
/** Complete release readiness checklist */
export interface StableReleaseChecklist {
    overallStatus: "pass" | "partial" | "fail";
    passedCount: number;
    partialCount: number;
    failedCount: number;
    items: StableReleaseChecklistItem[];
}
/** Complete release package report */
export interface StableReleasePackageReport {
    packageId: string;
    componentId: "stable_core";
    createdAt: string;
    evidenceRootDir: string;
    outputDir: string;
    targetStatus: StableGateTargetStatus;
    overallVerdict: StableReleaseGateReport["overallVerdict"];
    missingRequiredProfiles: StableEvidenceProfileName[];
    failingProfiles: StableEvidenceProfileName[];
    profiles: StableReleasePackageProfileSummary[];
    releaseChecklist: StableReleaseChecklist;
    nextActions: string[];
    runbookRefs: string[];
    recommendedCommands: string[];
    artifacts: {
        packageReportPath: string;
        gateReportPath: string;
        releaseChecklistPath: string;
        summaryMarkdownPath: string;
    };
    gate: StableReleaseGateReport;
}
/**
 * Creates a stable release package by aggregating evidence and gate evaluation.
 *
 * This is the main entry point for assembling a release package.
 * It collects all evidence profiles, runs the gate evaluation, builds
 * the checklist, and writes all artifacts.
 */
export declare function createStableReleasePackage(options: StableReleasePackageOptions): StableReleasePackageReport;
