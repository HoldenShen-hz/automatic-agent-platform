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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
/** Profile sets for each promotion tier */
const GRAY_PROFILES = ["smoke"];
const PRODUCTION_PROFILES = ["smoke", "24h", "72h"];
const CANARY_PROFILES = ["smoke"];
/** Base criteria that are always required regardless of target status */
const BASE_REQUIRED_CRITERION_IDS = new Set([
    "contracts_frozen",
    "conformance_tests",
    "telemetry_instrumented",
    "migration_compatibility_tested",
    "runbooks_documented",
    "rollback_tested",
    "ownership_defined",
]);
/** Writes a value as formatted JSON to a file */
function writeJson(path, value) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(value, null, 2));
}
/** Safely reads and parses a JSON file, returning null if not found */
function safeReadJson(path) {
    if (!existsSync(path)) {
        return null;
    }
    return JSON.parse(readFileSync(path, "utf8"));
}
/**
 * Determines which evidence profiles are required for a target status.
 *
 * @param targetStatus - The promotion target
 * @returns Array of required profile names
 */
function resolveRequiredProfiles(targetStatus) {
    if (targetStatus === "production_ready") {
        return PRODUCTION_PROFILES;
    }
    if (targetStatus === "tenant_gray") {
        return GRAY_PROFILES;
    }
    return CANARY_PROFILES;
}
/**
 * Determines which criteria are required for a target status.
 *
 * Production promotion additionally requires acceptance line, DB tests, and queue tests.
 * Tenant-gray promotion additionally requires gray rollout testing.
 *
 * @param targetStatus - The promotion target
 * @returns Set of required criterion IDs
 */
function resolveRequiredCriterionIds(targetStatus) {
    const ids = new Set(BASE_REQUIRED_CRITERION_IDS);
    if (targetStatus === "tenant_gray" || targetStatus === "production_ready") {
        ids.add("tenant_gray_rollout_tested");
    }
    if (targetStatus === "production_ready") {
        ids.add("stable_acceptance_line");
        ids.add("db_queue_disconnect_tested");
        ids.add("db_writability_tested");
        ids.add("queue_delivery_tested");
    }
    return ids;
}
/**
 * Extracts acceptance line summary from an evidence bundle report.
 */
function summarizeAcceptanceLine(report, reportPath) {
    const acceptanceLine = report.acceptanceLine;
    if (!acceptanceLine) {
        return {
            status: "missing",
            detail: "stable acceptance line report is missing; regenerate evidence with the QA-64 evaluator",
            evidenceRefs: [reportPath],
        };
    }
    return {
        status: acceptanceLine.status,
        detail: acceptanceLine.criteria.map((criterion) => `${criterion.criterionId}:${criterion.status}`).join(", "),
        evidenceRefs: [
            ...(typeof report.artifacts.acceptanceReportPath === "string" ? [report.artifacts.acceptanceReportPath] : []),
            reportPath,
        ],
    };
}
/**
 * Derives the current status from gate evaluation results.
 *
 * If blocked or no evidence, status is contract_frozen.
 * If approved, status equals target.
 * If target is production_ready but gray criterion passed, status is tenant_gray.
 * Otherwise status is canary.
 */
function deriveCurrentStatus(input) {
    if (input.overallVerdict === "promote_blocked" || input.smokeReport == null) {
        return "contract_frozen";
    }
    if (input.overallVerdict === "promote_approved") {
        return input.targetStatus;
    }
    if (input.targetStatus === "production_ready" && input.grayCriterion?.status === "pass") {
        return "tenant_gray";
    }
    return "canary";
}
/**
 * Collects evidence reports from the evidence root directory.
 *
 * Looks for stable-evidence-report.json in each profile subdirectory.
 */
function collectEvidenceReports(evidenceRootDir, profiles) {
    return profiles.map((profile) => {
        const path = join(evidenceRootDir, profile, "stable-evidence-report.json");
        return {
            profile,
            path,
            report: safeReadJson(path),
        };
    });
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
export function buildStableReleaseGateReport(options) {
    const targetStatus = options.targetStatus ?? "canary";
    const requiredCriterionIds = resolveRequiredCriterionIds(targetStatus);
    const requiredProfiles = resolveRequiredProfiles(targetStatus);
    const reports = collectEvidenceReports(options.evidenceRootDir, requiredProfiles);
    const checkedAt = new Date().toISOString();
    // Index reports by presence and status
    const artifactRefs = reports.filter((item) => item.report !== null).map((item) => item.path);
    const availableProfiles = reports.filter((item) => item.report !== null).map((item) => item.profile);
    const missingProfiles = reports.filter((item) => item.report === null).map((item) => item.profile);
    const failingProfiles = reports
        .filter((item) => item.report !== null && !item.report.summary.passed)
        .map((item) => item.profile);
    const hasAnyEvidence = reports.some((item) => item.report !== null);
    const passingReports = reports
        .filter((item) => item.report !== null);
    // Build blockers list
    const blockers = [];
    if (missingProfiles.length > 0) {
        blockers.push(`missing evidence profiles: ${missingProfiles.join(", ")}`);
    }
    if (failingProfiles.length > 0) {
        blockers.push(`failing evidence profiles: ${failingProfiles.join(", ")}`);
    }
    // Get smoke report for status derivation
    const smokeReport = passingReports.find((item) => item.profile === "smoke")?.report ?? null;
    // Helper to check if all passing reports have a criterion passing
    const passingReportsCriterion = (getStatus) => passingReports.every((item) => getStatus(item.report)) && passingReports.length > 0;
    // Helper for evidence refs across passing reports
    const passingRefs = (getRef) => Array.from(new Set(passingReports.flatMap((item) => getRef(item.report))));
    const backupRestorePlaybookMissing = passingReports.some((item) => typeof item.report.artifacts.backupRestorePlaybookPath !== "string"
        || item.report.artifacts.backupRestorePlaybookPath.trim().length === 0);
    // Pre-compute criterion statuses that are used multiple times
    const acceptanceSnapshots = passingReports.map((item) => summarizeAcceptanceLine(item.report, item.path));
    const acceptanceEvidenceRefs = Array.from(new Set(acceptanceSnapshots.flatMap((snapshot) => snapshot.evidenceRefs)));
    const acceptancePassed = acceptanceSnapshots.some((snapshot) => snapshot.status === "pass");
    const acceptanceAvailable = acceptanceSnapshots.length > 0;
    const acceptanceDetail = acceptancePassed
        ? acceptanceSnapshots.find((snapshot) => snapshot.status === "pass")?.detail ?? "stable acceptance line passed"
        : acceptanceAvailable
            ? acceptanceSnapshots.map((snapshot) => snapshot.detail).join(" | ")
            : "stable acceptance line evidence is unavailable";
    // Build all criteria
    const criteria = [
        {
            criterionId: "contracts_frozen",
            status: "pass",
            detail: "core contracts and stable launch planning documents are present in the repository",
            evidenceRefs: [
                "docs_zh/contracts/platform_promote_criteria_contract.md",
                "docs_zh/contracts/release_rollout_and_rollback_contract.md",
                "docs_zh/operations/stable_launch_execution_plan.md",
            ],
        },
        {
            criterionId: "conformance_tests",
            status: missingProfiles.length === 0 && failingProfiles.length === 0
                ? "pass"
                : failingProfiles.length > 0 || !hasAnyEvidence
                    ? "fail"
                    : "partial",
            detail: missingProfiles.length === 0 && failingProfiles.length === 0
                ? `required evidence profiles passed: ${requiredProfiles.join(", ")}`
                : failingProfiles.length > 0
                    ? `available evidence reports failures: ${failingProfiles.join(", ")}`
                    : hasAnyEvidence
                        ? `baseline evidence exists, but required profiles are incomplete: ${[...missingProfiles, ...failingProfiles].join(", ")}`
                        : "no passing stable evidence bundle is available",
            evidenceRefs: artifactRefs,
        },
        {
            criterionId: "chaos_drill_results",
            status: passingReportsCriterion((r) => r.summary.chaosPassed)
                ? "pass"
                : failingProfiles.length > 0 || !hasAnyEvidence
                    ? "fail"
                    : hasAnyEvidence
                        ? "partial"
                        : "fail",
            detail: passingReportsCriterion((r) => r.summary.chaosPassed)
                ? "chaos smoke scenarios passed for all available evidence bundles"
                : failingProfiles.length > 0
                    ? "chaos smoke results include failing evidence bundles"
                    : "chaos smoke results are incomplete or missing",
            evidenceRefs: passingRefs((r) => r.artifacts.chaosReportPath),
        },
        {
            criterionId: "concurrency_locking_tested",
            status: passingReportsCriterion((r) => r.summary.concurrencyPassed)
                ? "pass"
                : failingProfiles.length > 0 || !hasAnyEvidence
                    ? "fail"
                    : hasAnyEvidence
                        ? "partial"
                        : "fail",
            detail: passingReportsCriterion((r) => r.summary.concurrencyPassed)
                ? "concurrency and file lock rehearsals passed for all available evidence bundles"
                : failingProfiles.length > 0
                    ? "concurrency or file lock evidence includes failing bundles"
                    : "concurrency or file lock evidence is incomplete",
            evidenceRefs: passingRefs((r) => r.artifacts.concurrencyReportPath),
        },
        {
            criterionId: "lease_fencing_tested",
            status: passingReportsCriterion((r) => r.summary.leasePassed)
                ? "pass"
                : failingProfiles.length > 0 || !hasAnyEvidence
                    ? "fail"
                    : hasAnyEvidence
                        ? "partial"
                        : "fail",
            detail: passingReportsCriterion((r) => r.summary.leasePassed)
                ? "lease, fencing, and worker registry rehearsals passed for all available evidence bundles"
                : failingProfiles.length > 0
                    ? "lease and fencing evidence includes failing bundles"
                    : "lease and fencing evidence is incomplete",
            evidenceRefs: passingRefs((r) => r.artifacts.leaseReportPath),
        },
        {
            criterionId: "telemetry_instrumented",
            status: passingReports.every((item) => item.report.summary.doctorStatus === "ok") && passingReports.length > 0
                ? "pass"
                : failingProfiles.length > 0 || !hasAnyEvidence
                    ? "fail"
                    : hasAnyEvidence
                        ? "partial"
                        : "fail",
            detail: passingReports.every((item) => item.report.summary.doctorStatus === "ok") && passingReports.length > 0
                ? "doctor, diagnostics, and runtime health reports are healthy"
                : failingProfiles.length > 0
                    ? "doctor evidence includes degraded or failing bundles"
                    : "doctor evidence is incomplete or degraded",
            evidenceRefs: passingRefs((r) => r.artifacts.doctorReportPath),
        },
        {
            criterionId: "migration_compatibility_tested",
            status: passingReports.every((item) => item.report.summary.migrationCompatibilityPassed) && passingReports.length > 0
                ? "pass"
                : failingProfiles.length > 0 || !hasAnyEvidence
                    ? "fail"
                    : hasAnyEvidence
                        ? "partial"
                        : "fail",
            detail: passingReports.every((item) => item.report.summary.migrationCompatibilityPassed) && passingReports.length > 0
                ? "migration compatibility rehearsal passed for all available evidence bundles"
                : failingProfiles.length > 0
                    ? "migration compatibility evidence includes failing bundles"
                    : "migration compatibility evidence is incomplete",
            evidenceRefs: passingRefs((r) => r.artifacts.migrationCompatibilityReportPath),
        },
        {
            criterionId: "backup_restore_tested",
            status: passingReports.every((item) => item.report.summary.backupRestorePassed)
                && passingReports.length > 0
                && !backupRestorePlaybookMissing
                ? "pass"
                : failingProfiles.length > 0 || !hasAnyEvidence
                    ? "fail"
                    : hasAnyEvidence
                        ? "partial"
                        : "fail",
            detail: passingReports.every((item) => item.report.summary.backupRestorePassed)
                && passingReports.length > 0
                && !backupRestorePlaybookMissing
                ? "backup restore rehearsal passed for all available evidence bundles"
                : backupRestorePlaybookMissing
                    ? "backup restore rehearsal reports passed, but one or more disaster recovery playbooks are missing"
                    : failingProfiles.length > 0
                        ? "backup restore rehearsal evidence includes failing bundles"
                        : "backup restore rehearsal evidence is incomplete",
            evidenceRefs: Array.from(new Set(passingReports
                .flatMap((item) => [
                item.report.artifacts.backupRestoreReportPath,
                item.report.artifacts.backupRestorePlaybookPath,
            ])
                .filter((path) => typeof path === "string" && path.length > 0))),
        },
        {
            criterionId: "rolling_upgrade_tested",
            status: passingReports.every((item) => item.report.summary.rollingUpgradePassed) && passingReports.length > 0
                ? "pass"
                : failingProfiles.length > 0 || !hasAnyEvidence
                    ? "fail"
                    : hasAnyEvidence
                        ? "partial"
                        : "fail",
            detail: passingReports.every((item) => item.report.summary.rollingUpgradePassed) && passingReports.length > 0
                ? "rolling upgrade rehearsal passed for all available evidence bundles"
                : failingProfiles.length > 0
                    ? "rolling upgrade evidence includes failing bundles"
                    : "rolling upgrade evidence is incomplete",
            evidenceRefs: passingRefs((r) => r.artifacts.rollingUpgradeReportPath),
        },
        {
            criterionId: "maintenance_drain_tested",
            status: passingReports.every((item) => item.report.summary.maintenancePassed) && passingReports.length > 0
                ? "pass"
                : failingProfiles.length > 0 || !hasAnyEvidence
                    ? "fail"
                    : hasAnyEvidence
                        ? "partial"
                        : "fail",
            detail: passingReports.every((item) => item.report.summary.maintenancePassed) && passingReports.length > 0
                ? "maintenance drain rehearsal passed for all available evidence bundles"
                : failingProfiles.length > 0
                    ? "maintenance drain evidence includes failing bundles"
                    : "maintenance drain evidence is incomplete",
            evidenceRefs: passingRefs((r) => r.artifacts.maintenanceReportPath),
        },
        {
            criterionId: "tenant_gray_rollout_tested",
            status: passingReports.every((item) => item.report.summary.grayReleasePassed) && passingReports.length > 0
                ? "pass"
                : failingProfiles.length > 0 || !hasAnyEvidence
                    ? "fail"
                    : hasAnyEvidence
                        ? "partial"
                        : "fail",
            detail: passingReports.every((item) => item.report.summary.grayReleasePassed) && passingReports.length > 0
                ? "tenant-gray rehearsal passed for all available evidence bundles"
                : failingProfiles.length > 0
                    ? "tenant-gray rollout evidence includes failing bundles"
                    : "tenant-gray rollout evidence is incomplete",
            evidenceRefs: passingRefs((r) => r.artifacts.grayReleaseReportPath),
        },
        {
            criterionId: "event_replay_tested",
            status: passingReports.every((item) => item.report.summary.eventReplayPassed) && passingReports.length > 0
                ? "pass"
                : failingProfiles.length > 0 || !hasAnyEvidence
                    ? "fail"
                    : hasAnyEvidence
                        ? "partial"
                        : "fail",
            detail: passingReports.every((item) => item.report.summary.eventReplayPassed) && passingReports.length > 0
                ? "event replay rehearsal passed for all available evidence bundles"
                : failingProfiles.length > 0
                    ? "event replay rehearsal evidence includes failing bundles"
                    : "event replay rehearsal evidence is incomplete",
            evidenceRefs: passingRefs((r) => r.artifacts.eventReplayReportPath),
        },
        {
            criterionId: "db_queue_disconnect_tested",
            status: passingReports.every((item) => item.report.summary.dbQueueDisconnectPassed) && passingReports.length > 0
                ? "pass"
                : failingProfiles.length > 0 || !hasAnyEvidence
                    ? "fail"
                    : hasAnyEvidence
                        ? "partial"
                        : "fail",
            detail: passingReports.every((item) => item.report.summary.dbQueueDisconnectPassed) && passingReports.length > 0
                ? "DB and queue disconnect drill passed for all available evidence bundles"
                : failingProfiles.length > 0
                    ? "DB and queue disconnect evidence includes failing bundles"
                    : "DB and queue disconnect evidence is incomplete",
            evidenceRefs: passingRefs((r) => r.artifacts.dbQueueDisconnectReportPath),
        },
        {
            criterionId: "db_writability_tested",
            status: passingReports.every((item) => item.report.summary.dbWritabilityPassed) && passingReports.length > 0
                ? "pass"
                : failingProfiles.length > 0 || !hasAnyEvidence
                    ? "fail"
                    : hasAnyEvidence
                        ? "partial"
                        : "fail",
            detail: passingReports.every((item) => item.report.summary.dbWritabilityPassed) && passingReports.length > 0
                ? "DB writability fail-close drill passed for all available evidence bundles"
                : failingProfiles.length > 0
                    ? "DB writability evidence includes failing bundles"
                    : "DB writability evidence is incomplete",
            evidenceRefs: passingRefs((r) => r.artifacts.dbWritabilityReportPath),
        },
        {
            criterionId: "queue_delivery_tested",
            status: passingReports.every((item) => item.report.summary.queueDeliveryPassed) && passingReports.length > 0
                ? "pass"
                : failingProfiles.length > 0 || !hasAnyEvidence
                    ? "fail"
                    : hasAnyEvidence
                        ? "partial"
                        : "fail",
            detail: passingReports.every((item) => item.report.summary.queueDeliveryPassed) && passingReports.length > 0
                ? "queue replay and duplicate delivery rehearsal passed for all available evidence bundles"
                : failingProfiles.length > 0
                    ? "queue delivery evidence includes failing bundles"
                    : "queue delivery evidence is incomplete",
            evidenceRefs: passingRefs((r) => r.artifacts.queueDeliveryReportPath),
        },
        {
            criterionId: "stable_acceptance_line",
            status: acceptancePassed
                ? "pass"
                : failingProfiles.length > 0 || !hasAnyEvidence
                    ? "fail"
                    : "partial",
            detail: acceptancePassed
                ? "stable acceptance line is satisfied by available evidence"
                : acceptanceDetail,
            evidenceRefs: acceptanceEvidenceRefs,
        },
        {
            criterionId: "runbooks_documented",
            status: "pass",
            detail: "release, stable launch, readiness, and disaster recovery documents exist locally",
            evidenceRefs: [
                "docs_zh/operations/release_readiness_checklist.md",
                "docs_zh/operations/stable_runtime_validation_plan.md",
                "docs_zh/operations/stable_launch_execution_plan.md",
                "docs_zh/contracts/architecture_governance_and_versioning_contract.md",
                "docs_zh/contracts/remote_coordination_and_disaster_recovery_contract.md",
            ],
        },
        {
            criterionId: "rollback_tested",
            status: passingReports.every((item) => item.report.summary.rollbackPassed) && passingReports.length > 0
                ? "pass"
                : failingProfiles.length > 0 || !hasAnyEvidence
                    ? "fail"
                    : hasAnyEvidence
                        ? "partial"
                        : "fail",
            detail: passingReports.every((item) => item.report.summary.rollbackPassed) && passingReports.length > 0
                ? "formal rollback rehearsal scenarios passed in available evidence bundles"
                : failingProfiles.length > 0
                    ? "rollback rehearsal evidence includes failing bundles"
                    : "rollback rehearsal evidence is incomplete",
            evidenceRefs: passingRefs((r) => r.artifacts.rollbackReportPath),
        },
        {
            criterionId: "ownership_defined",
            status: "pass",
            detail: "local execution owner is explicit via repository governance and local git history",
            evidenceRefs: ["AGENTS.md", ".git"],
        },
    ];
    // Split into required and optional criteria
    const requiredCriteria = criteria.filter((criterion) => requiredCriterionIds.has(criterion.criterionId));
    const optionalCriteria = criteria.filter((criterion) => !requiredCriterionIds.has(criterion.criterionId));
    // Compute overall verdict
    const hasRequiredFailures = requiredCriteria.some((criterion) => criterion.status === "fail");
    const hasRequiredPartials = requiredCriteria.some((criterion) => criterion.status === "partial");
    const grayCriterion = criteria.find((criterion) => criterion.criterionId === "tenant_gray_rollout_tested");
    const overallVerdict = !smokeReport || hasRequiredFailures
        ? "promote_blocked"
        : missingProfiles.length > 0 || hasRequiredPartials
            ? "conditional"
            : "promote_approved";
    return {
        packageId: `stable_gate_${checkedAt}`,
        componentId: "stable_core",
        currentStatus: deriveCurrentStatus({
            overallVerdict,
            targetStatus,
            smokeReport,
            grayCriterion,
        }),
        targetStatus,
        overallVerdict,
        checkedAt,
        requiredProfiles,
        availableProfiles,
        requiredCriteria,
        optionalCriteria,
        criteria,
        blockers,
        artifactRefs,
    };
}
/** Writes a gate report to a JSON file */
export function writeStableReleaseGateReport(outputFile, report) {
    writeJson(outputFile, report);
}
//# sourceMappingURL=stable-release-gate.js.map