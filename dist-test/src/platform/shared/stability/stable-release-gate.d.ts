/**
 * Stable Release Gate
 *
 * Evaluates evidence bundles against promotion criteria to determine whether
 * a release can be promoted to a target status (canary, tenant_gray, or
 * production_ready). The gate aggregates results from smoke, 24h, and 72h
 * evidence profiles and checks both required and optional criteria.
 *
 * Promotion lifecycle:
 * - contract_frozen: Initial state before any promotion
 * - canary: First promotion level, requires smoke evidence
 * - tenant_gray: Requires smoke + gray release evidence
 * - production_ready: Requires smoke + 24h + 72h evidence + acceptance line
 *
 * @see stable-evidence-bundle.ts for the evidence bundle structure
 * @see stable-release-package.ts for the package that consumes gate output
 * @see docs_zh/contracts/platform_promote_criteria_contract.md for promotion criteria
 */
import type { StableEvidenceProfileName } from "./stable-evidence-bundle.js";
/** Target promotion status for gate evaluation */
export type StableGateTargetStatus = "canary" | "tenant_gray" | "production_ready";
/** Overall gate verdict */
export type StableGateVerdict = "promote_approved" | "conditional" | "promote_blocked";
/** Options for building a gate report */
export interface StableReleaseGateOptions {
    /** Root directory containing evidence bundle profiles */
    evidenceRootDir: string;
    /** Target status to evaluate promotion toward */
    targetStatus?: StableGateTargetStatus;
}
/** A single gate criterion with pass/fail/partial status */
export interface StableGateCriterion {
    /** Unique identifier for this criterion */
    criterionId: "contracts_frozen" | "conformance_tests" | "chaos_drill_results" | "concurrency_locking_tested" | "lease_fencing_tested" | "telemetry_instrumented" | "backup_restore_tested" | "rolling_upgrade_tested" | "maintenance_drain_tested" | "tenant_gray_rollout_tested" | "event_replay_tested" | "db_queue_disconnect_tested" | "db_writability_tested" | "queue_delivery_tested" | "migration_compatibility_tested" | "stable_acceptance_line" | "runbooks_documented" | "rollback_tested" | "ownership_defined";
    /** Pass/fail/partial status */
    status: "pass" | "partial" | "fail";
    /** Human-readable detail about the criterion result */
    detail: string;
    /** File paths to evidence supporting this criterion */
    evidenceRefs: string[];
}
/** Type helper for criterion IDs */
export type StableGateCriterionId = StableGateCriterion["criterionId"];
/** Complete gate evaluation report */
export interface StableReleaseGateReport {
    /** Unique identifier for this gate evaluation */
    packageId: string;
    /** Component this gate covers */
    componentId: "stable_core";
    /** Current status derived from evidence and verdict */
    currentStatus: "contract_frozen" | "canary" | "tenant_gray" | "production_ready";
    /** Target status being evaluated */
    targetStatus: StableGateTargetStatus;
    /** Overall promotion verdict */
    overallVerdict: StableGateVerdict;
    /** When this gate was evaluated */
    checkedAt: string;
    /** Required evidence profiles for the target status */
    requiredProfiles: StableEvidenceProfileName[];
    /** Evidence profiles found in the evidence root */
    availableProfiles: StableEvidenceProfileName[];
    /** Criteria required for the target status */
    requiredCriteria: StableGateCriterion[];
    /** Optional criteria for the target status */
    optionalCriteria: StableGateCriterion[];
    /** All criteria evaluated */
    criteria: StableGateCriterion[];
    /** Blocking issues preventing promotion */
    blockers: string[];
    /** Paths to all evidence artifacts */
    artifactRefs: string[];
}
/**
 * Builds a complete gate evaluation report.
 *
 * Collects evidence from all required profiles, evaluates each criterion
 * (required and optional), and produces an overall verdict with blockers.
 *
 * @param options - Gate evaluation options
 * @returns Complete gate report with criteria and verdict
 */
export declare function buildStableReleaseGateReport(options: StableReleaseGateOptions): StableReleaseGateReport;
/** Writes a gate report to a JSON file */
export declare function writeStableReleaseGateReport(outputFile: string, report: StableReleaseGateReport): void;
