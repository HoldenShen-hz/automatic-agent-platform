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

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import {
  buildStableReleaseGateReport,
  writeStableReleaseGateReport,
  type StableGateCriterion,
  type StableGateTargetStatus,
  type StableReleaseGateReport,
} from "./stable-release-gate.js";
import type { StableEvidenceBundleReport, StableEvidenceProfileName } from "./stable-evidence-bundle.js";

/** Supported evidence profile names */
const SUPPORTED_PROFILES: StableEvidenceProfileName[] = ["smoke", "24h", "72h"];

/** Runbook references for stable release procedures */
const RUNBOOK_REFS = [
  "docs_zh/operations/release_readiness_checklist.md",
  "docs_zh/operations/stable_launch_execution_plan.md",
  "docs_zh/operations/stable_runtime_validation_plan.md",
  "docs_zh/contracts/architecture_governance_and_versioning_contract.md",
  "docs_zh/contracts/release_rollout_and_rollback_contract.md",
  "docs_zh/contracts/remote_coordination_and_disaster_recovery_contract.md",
];

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
  itemId:
    | "release_gate_verdict"
    | "required_criteria_complete"
    | "smoke_evidence_available"
    | "long_run_soak_complete"
    | "stable_acceptance_line_ready"
    | "tenant_gray_ready"
    | "recovery_regression_ready"
    | "disaster_recovery_ready"
    | "rolling_upgrade_ready"
    | "maintenance_handover_ready"
    | "db_queue_disconnect_ready"
    | "db_writability_ready"
    | "queue_delivery_ready"
    | "rollback_path_ready"
    | "runbooks_ready"
    | "ownership_ready";
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

/** Writes JSON to a file, creating parent directories */
function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

/** Safely reads JSON file, returning null if not found */
function safeReadJson<T>(path: string): T | null {
  if (!existsSync(path)) {
    return null;
  }
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

/** Collects profile summaries from evidence directories */
function collectProfiles(evidenceRootDir: string): StableReleasePackageProfileSummary[] {
  return SUPPORTED_PROFILES.map((profile) => {
    const reportPath = join(evidenceRootDir, profile, "stable-evidence-report.json");
    const report = safeReadJson<StableEvidenceBundleReport>(reportPath);

    return {
      profile,
      reportPath,
      present: report !== null,
      passed: report?.summary.passed ?? null,
      chaosPassed: report?.summary.chaosPassed ?? null,
      leasePassed: report?.summary.leasePassed ?? null,
      rollbackPassed: report?.summary.rollbackPassed ?? null,
      rollingUpgradePassed: report?.summary.rollingUpgradePassed ?? null,
      maintenancePassed: report?.summary.maintenancePassed ?? null,
      grayReleasePassed: report?.summary.grayReleasePassed ?? null,
      dbQueueDisconnectPassed: report?.summary.dbQueueDisconnectPassed ?? null,
      dbWritabilityPassed: report?.summary.dbWritabilityPassed ?? null,
      queueDeliveryPassed: report?.summary.queueDeliveryPassed ?? null,
      migrationCompatibilityPassed: report?.summary.migrationCompatibilityPassed ?? null,
      backupRestorePlaybookPath: report?.artifacts.backupRestorePlaybookPath ?? null,
      rollingUpgradePlaybookPath: report?.artifacts.rollingUpgradePlaybookPath ?? null,
      maintenancePlaybookPath: report?.artifacts.maintenancePlaybookPath ?? null,
      grayReleasePlaybookPath: report?.artifacts.grayReleasePlaybookPath ?? null,
      doctorStatus: report?.summary.doctorStatus ?? null,
      acceptanceLineStatus: report?.acceptanceLine?.status ?? null,
      acceptanceReportPath: report?.artifacts.acceptanceReportPath ?? null,
      acceptanceObservedSoakDurationMs: report?.acceptanceLine?.observed.soakDurationMs ?? null,
    };
  });
}

/** Builds next action items based on gate and profile status */
export function buildNextActions(
  gate: StableReleaseGateReport,
  profiles: StableReleasePackageProfileSummary[],
): string[] {
  const actions: string[] = [];
  const smoke = profiles.find((profile) => profile.profile === "smoke");

  // Check smoke profile availability
  if (!smoke?.present) {
    actions.push("Generate smoke evidence before any promotion decision.");
  }

  if (smoke?.present && smoke.passed === false) {
    actions.push("Repair or rerun the smoke evidence bundle before retrying the release gate.");
  }

  // Check required profiles
  gate.requiredProfiles.forEach((profile) => {
    const match = profiles.find((item) => item.profile === profile);
    if (!match?.present) {
      actions.push(`Collect the missing ${profile} evidence bundle and rerun the release package.`);
    } else if (match.passed === false) {
      actions.push(`Fix failing ${profile} evidence results, then regenerate the release package.`);
    }
  });

  // Check rehearsal criteria
  const backupRestoreCriterion = gate.criteria.find((criterion) => criterion.criterionId === "backup_restore_tested");
  if (backupRestoreCriterion?.status !== "pass") {
    actions.push("Rerun the stable restore rehearsal and regenerate the disaster recovery playbook evidence.");
  }
  const rollingUpgradeCriterion = gate.criteria.find((criterion) => criterion.criterionId === "rolling_upgrade_tested");
  const maintenanceCriterion = gate.criteria.find((criterion) => criterion.criterionId === "maintenance_drain_tested");
  const grayCriterion = gate.criteria.find((criterion) => criterion.criterionId === "tenant_gray_rollout_tested");
  const dbQueueDisconnectCriterion = gate.criteria.find((criterion) => criterion.criterionId === "db_queue_disconnect_tested");
  const dbWritabilityCriterion = gate.criteria.find((criterion) => criterion.criterionId === "db_writability_tested");
  const queueDeliveryCriterion = gate.criteria.find((criterion) => criterion.criterionId === "queue_delivery_tested");
  const migrationCompatibilityCriterion = gate.criteria.find(
    (criterion) => criterion.criterionId === "migration_compatibility_tested",
  );

  if (rollingUpgradeCriterion?.status !== "pass") {
    actions.push("Rerun the stable rolling upgrade rehearsal and regenerate the upgrade playbook evidence.");
  }
  if (maintenanceCriterion?.status !== "pass") {
    actions.push("Rerun the stable maintenance rehearsal and regenerate the maintenance drain playbook evidence.");
  }
  if (grayCriterion?.status !== "pass") {
    actions.push("Rerun the stable tenant-gray rehearsal and regenerate the gray rollout playbook evidence.");
  }
  if (dbQueueDisconnectCriterion?.status !== "pass") {
    actions.push("Rerun the stable DB queue disconnect rehearsal and regenerate the fail-closed repair evidence.");
  }
  if (dbWritabilityCriterion?.status !== "pass") {
    actions.push("Rerun the stable DB writability rehearsal and regenerate the read-only admission fail-close evidence.");
  }
  if (queueDeliveryCriterion?.status !== "pass") {
    actions.push("Rerun the stable queue delivery rehearsal and regenerate the queue replay / duplicate delivery evidence.");
  }
  if (migrationCompatibilityCriterion?.status !== "pass") {
    actions.push("Rerun the stable migration compatibility rehearsal and regenerate the PG portability evidence.");
  }

  // Check acceptance line for production_ready
  const acceptanceCriterion = gate.criteria.find((criterion) => criterion.criterionId === "stable_acceptance_line");
  if (gate.targetStatus === "production_ready" && acceptanceCriterion?.status !== "pass") {
    actions.push(
      "Continue the long-run campaign until the QA-64 stable acceptance line truthfully reaches a full 14-day soak window.",
    );
  }

  // Add overall verdict action
  if (gate.overallVerdict === "promote_approved") {
    actions.push(`Proceed with the ${gate.targetStatus} rollout using the referenced local runbooks.`);
  } else if (gate.overallVerdict === "conditional") {
    actions.push(
      gate.targetStatus === "production_ready"
        ? "Keep the component at tenant_gray until long-run evidence is complete."
        : "Keep the component at canary until required gray or long-run evidence is complete.",
    );
  } else {
    actions.push("Do not promote while the gate verdict is blocked.");
  }

  return Array.from(new Set(actions));
}

/** Builds recommended commands for evidence generation */
export function buildRecommendedCommands(targetStatus: StableGateTargetStatus): string[] {
  const commands = [
    "AA_STABLE_EVIDENCE_PROFILE=smoke npm run evidence:stable",
    "AA_STABLE_SEQUENCE_EVIDENCE_ROOT=data/stable-evidence AA_STABLE_SEQUENCE_RUN_UNTIL_COMPLETE=1 npm run sequence:stable",
    "AA_STABLE_CAMPAIGN_PROFILE=24h AA_STABLE_CAMPAIGN_OUTPUT_DIR=data/stable-evidence/24h npm run campaign:stable",
    "AA_STABLE_CAMPAIGN_PROFILE=72h AA_STABLE_CAMPAIGN_OUTPUT_DIR=data/stable-evidence/72h npm run campaign:stable",
    "npm run restore:stable",
    "npm run upgrade:stable",
    "npm run maintenance:stable",
    "npm run db-queue-disconnect:stable",
    "npm run db-writability:stable",
    "npm run migration:stable",
    "npm run queue:stable",
    "npm run gray:stable",
    "AA_STABLE_LEASE_OUTPUT_DIR=data/stable-lease npm run lease:stable",
    "AA_STABLE_GATE_TARGET_STATUS=canary npm run gate:stable",
    "AA_STABLE_GATE_TARGET_STATUS=tenant_gray npm run gate:stable",
    "AA_STABLE_GATE_TARGET_STATUS=production_ready npm run gate:stable",
    `AA_STABLE_PACKAGE_TARGET_STATUS=${targetStatus} npm run package:stable`,
  ];

  return commands;
}

/** Summarizes criteria status for checklist items */
export function summarizeCriteria(criteria: StableGateCriterion[]): {
  status: "pass" | "partial" | "fail";
  detail: string;
  evidenceRefs: string[];
} {
  const hasFail = criteria.some((criterion) => criterion.status === "fail");
  const hasPartial = criteria.some((criterion) => criterion.status === "partial");
  return {
    status: hasFail ? "fail" : hasPartial ? "partial" : "pass",
    detail: criteria.map((criterion) => `${criterion.criterionId}:${criterion.status}`).join(", "),
    evidenceRefs: Array.from(new Set(criteria.flatMap((criterion) => criterion.evidenceRefs))),
  };
}

/** Builds the complete release checklist */
function buildReleaseChecklist(
  gate: StableReleaseGateReport,
  profiles: StableReleasePackageProfileSummary[],
): StableReleaseChecklist {
  const smokeProfile = profiles.find((profile) => profile.profile === "smoke");
  const longRunProfiles = profiles.filter((profile) => profile.profile === "24h" || profile.profile === "72h");
  const requiredCriteriaSummary = summarizeCriteria(gate.requiredCriteria);
  const recoveryCriteriaSummary = summarizeCriteria(
    gate.optionalCriteria.filter((criterion) =>
      criterion.criterionId === "chaos_drill_results"
      || criterion.criterionId === "backup_restore_tested"
      || criterion.criterionId === "maintenance_drain_tested"
      || criterion.criterionId === "event_replay_tested"
      || criterion.criterionId === "db_queue_disconnect_tested"
      || criterion.criterionId === "db_writability_tested"
      || criterion.criterionId === "queue_delivery_tested"
      || criterion.criterionId === "concurrency_locking_tested"
      || criterion.criterionId === "lease_fencing_tested",
    ),
  );

  // Get criteria references
  const backupRestoreCriterion = gate.criteria.find((criterion) => criterion.criterionId === "backup_restore_tested");
  const rollingUpgradeCriterion = gate.criteria.find((criterion) => criterion.criterionId === "rolling_upgrade_tested");
  const maintenanceCriterion = gate.criteria.find((criterion) => criterion.criterionId === "maintenance_drain_tested");
  const grayCriterion = gate.criteria.find((criterion) => criterion.criterionId === "tenant_gray_rollout_tested");
  const dbQueueDisconnectCriterion = gate.criteria.find((criterion) => criterion.criterionId === "db_queue_disconnect_tested");
  const dbWritabilityCriterion = gate.criteria.find((criterion) => criterion.criterionId === "db_writability_tested");
  const queueDeliveryCriterion = gate.criteria.find((criterion) => criterion.criterionId === "queue_delivery_tested");
  const acceptanceCriterion = gate.criteria.find((criterion) => criterion.criterionId === "stable_acceptance_line");
  const rollbackCriterion = gate.criteria.find((criterion) => criterion.criterionId === "rollback_tested");
  const runbookCriterion = gate.criteria.find((criterion) => criterion.criterionId === "runbooks_documented");
  const ownershipCriterion = gate.criteria.find((criterion) => criterion.criterionId === "ownership_defined");

  const longRunRequired = gate.targetStatus === "production_ready";
  const longRunPassed = longRunProfiles.length === 2 && longRunProfiles.every((profile) => profile.present && profile.passed === true);
  const longRunPresentCount = longRunProfiles.filter((profile) => profile.present).length;

  const items: StableReleaseChecklistItem[] = [
    {
      itemId: "release_gate_verdict",
      status:
        gate.overallVerdict === "promote_approved"
          ? "pass"
          : gate.overallVerdict === "conditional"
            ? "partial"
            : "fail",
      detail: `stable release gate returned ${gate.overallVerdict} for target ${gate.targetStatus}`,
      evidenceRefs: gate.artifactRefs,
    },
    {
      itemId: "required_criteria_complete",
      status: requiredCriteriaSummary.status,
      detail: requiredCriteriaSummary.detail,
      evidenceRefs: requiredCriteriaSummary.evidenceRefs,
    },
    {
      itemId: "smoke_evidence_available",
      status: smokeProfile?.present && smokeProfile.passed === true ? "pass" : "fail",
      detail:
        smokeProfile?.present && smokeProfile.passed === true
          ? "smoke evidence bundle is present and passing"
          : "smoke evidence bundle is missing or failing",
      evidenceRefs: smokeProfile ? [smokeProfile.reportPath] : [],
    },
    {
      itemId: "long_run_soak_complete",
      status:
        !longRunRequired
          ? "pass"
          : longRunPassed
            ? "pass"
            : smokeProfile?.present && smokeProfile.passed === true
              ? "partial"
              : "fail",
      detail:
        !longRunRequired
          ? "24h / 72h long-run soak evidence is not required for canary promotion"
          : longRunPassed
            ? "24h and 72h long-run evidence bundles are present and passing"
            : `long-run soak evidence is incomplete for production_ready: present=${longRunPresentCount}/2`,
      evidenceRefs: longRunProfiles.map((profile) => profile.reportPath),
    },
    {
      itemId: "stable_acceptance_line_ready",
      status:
        gate.targetStatus === "production_ready"
          ? (acceptanceCriterion?.status ?? "fail")
          : "pass",
      detail:
        gate.targetStatus === "production_ready"
          ? (acceptanceCriterion?.detail ?? "QA-64 stable acceptance line evidence is unavailable")
          : "QA-64 stable acceptance line is tracked separately and does not block canary or tenant-gray packaging",
      evidenceRefs: acceptanceCriterion?.evidenceRefs ?? [],
    },
    {
      itemId: "tenant_gray_ready",
      status:
        gate.targetStatus === "canary"
          ? "pass"
          : grayCriterion?.status ?? "fail",
      detail:
        gate.targetStatus === "canary"
          ? "tenant-gray rollout evidence is not required for canary promotion"
          : grayCriterion?.detail ?? "tenant-gray rollout evidence is unavailable",
      evidenceRefs: grayCriterion?.evidenceRefs ?? [],
    },
    {
      itemId: "recovery_regression_ready",
      status: recoveryCriteriaSummary.status,
      detail: recoveryCriteriaSummary.detail,
      evidenceRefs: recoveryCriteriaSummary.evidenceRefs,
    },
    {
      itemId: "disaster_recovery_ready",
      status: backupRestoreCriterion?.status ?? "fail",
      detail: backupRestoreCriterion?.detail ?? "disaster recovery evidence is unavailable",
      evidenceRefs: backupRestoreCriterion?.evidenceRefs ?? [],
    },
    {
      itemId: "rolling_upgrade_ready",
      status: rollingUpgradeCriterion?.status ?? "fail",
      detail: rollingUpgradeCriterion?.detail ?? "rolling upgrade evidence is unavailable",
      evidenceRefs: rollingUpgradeCriterion?.evidenceRefs ?? [],
    },
    {
      itemId: "maintenance_handover_ready",
      status: maintenanceCriterion?.status ?? "fail",
      detail: maintenanceCriterion?.detail ?? "maintenance drain evidence is unavailable",
      evidenceRefs: maintenanceCriterion?.evidenceRefs ?? [],
    },
    {
      itemId: "db_queue_disconnect_ready",
      status:
        gate.targetStatus === "production_ready"
          ? (dbQueueDisconnectCriterion?.status ?? "fail")
          : "pass",
      detail:
        gate.targetStatus === "production_ready"
          ? (dbQueueDisconnectCriterion?.detail ?? "DB and queue disconnect evidence is unavailable")
          : "DB and queue disconnect evidence is tracked separately and does not block canary or tenant-gray packaging",
      evidenceRefs: dbQueueDisconnectCriterion?.evidenceRefs ?? [],
    },
    {
      itemId: "db_writability_ready",
      status:
        gate.targetStatus === "production_ready"
          ? (dbWritabilityCriterion?.status ?? "fail")
          : "pass",
      detail:
        gate.targetStatus === "production_ready"
          ? (dbWritabilityCriterion?.detail ?? "DB writability evidence is unavailable")
          : "DB writability evidence is tracked separately and does not block canary or tenant-gray packaging",
      evidenceRefs: dbWritabilityCriterion?.evidenceRefs ?? [],
    },
    {
      itemId: "queue_delivery_ready",
      status:
        gate.targetStatus === "production_ready"
          ? (queueDeliveryCriterion?.status ?? "fail")
          : "pass",
      detail:
        gate.targetStatus === "production_ready"
          ? (queueDeliveryCriterion?.detail ?? "queue replay / duplicate delivery evidence is unavailable")
          : "queue replay / duplicate delivery evidence is tracked separately and does not block canary or tenant-gray packaging",
      evidenceRefs: queueDeliveryCriterion?.evidenceRefs ?? [],
    },
    {
      itemId: "rollback_path_ready",
      status: rollbackCriterion?.status ?? "fail",
      detail: rollbackCriterion?.detail ?? "rollback rehearsal evidence is unavailable",
      evidenceRefs: rollbackCriterion?.evidenceRefs ?? [],
    },
    {
      itemId: "runbooks_ready",
      status: runbookCriterion?.status ?? "fail",
      detail: runbookCriterion?.detail ?? "release runbook references are unavailable",
      evidenceRefs: runbookCriterion?.evidenceRefs ?? [],
    },
    {
      itemId: "ownership_ready",
      status: ownershipCriterion?.status ?? "fail",
      detail: ownershipCriterion?.detail ?? "ownership references are unavailable",
      evidenceRefs: ownershipCriterion?.evidenceRefs ?? [],
    },
  ];

  const passedCount = items.filter((item) => item.status === "pass").length;
  const partialCount = items.filter((item) => item.status === "partial").length;
  const failedCount = items.filter((item) => item.status === "fail").length;

  return {
    overallStatus: failedCount > 0 ? "fail" : partialCount > 0 ? "partial" : "pass",
    passedCount,
    partialCount,
    failedCount,
    items,
  };
}

/** Builds Markdown summary of the release package */
function buildSummaryMarkdown(report: StableReleasePackageReport): string {
  const lines = [
    "# Stable Release Package",
    "",
    "## Verdict",
    `- Target status: \`${report.targetStatus}\``,
    `- Overall verdict: \`${report.overallVerdict}\``,
    `- Missing required profiles: ${report.missingRequiredProfiles.length > 0 ? report.missingRequiredProfiles.join(", ") : "none"}`,
    `- Failing profiles: ${report.failingProfiles.length > 0 ? report.failingProfiles.join(", ") : "none"}`,
    `- Release checklist status: \`${report.releaseChecklist.overallStatus}\``,
    `- Stable acceptance line: \`${report.gate.criteria.find((criterion) => criterion.criterionId === "stable_acceptance_line")?.status ?? "n/a"}\``,
    "",
    "## Evidence Profiles",
    "| Profile | Present | Passed | Chaos | Lease | Rollback | Upgrade | Maintenance | DB/Queue | DB Writable | Queue | Gray | DR Playbook | Doctor | Report |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...report.profiles.map((profile) => {
      const reportPath = relative(report.outputDir, profile.reportPath) || profile.reportPath;
      return `| ${profile.profile} | ${profile.present ? "yes" : "no"} | ${profile.passed ?? "n/a"} | ${profile.chaosPassed ?? "n/a"} | ${profile.leasePassed ?? "n/a"} | ${profile.rollbackPassed ?? "n/a"} | ${profile.rollingUpgradePlaybookPath ? "yes" : "no"} | ${profile.maintenancePlaybookPath ? "yes" : "no"} | ${profile.dbQueueDisconnectPassed ?? "n/a"} | ${profile.dbWritabilityPassed ?? "n/a"} | ${profile.queueDeliveryPassed ?? "n/a"} | ${profile.grayReleasePlaybookPath ? "yes" : "no"} | ${profile.backupRestorePlaybookPath ? "yes" : "no"} | ${profile.doctorStatus ?? "n/a"} | \`${reportPath}\` |`;
    }),
    "",
    "## Release Checklist",
    "| Item | Status | Detail |",
    "| --- | --- | --- |",
    ...report.releaseChecklist.items.map((item) => `| ${item.itemId} | ${item.status} | ${item.detail} |`),
    "",
    "## Next Actions",
    ...report.nextActions.map((action) => `- ${action}`),
    "",
    "## Runbooks",
    ...report.runbookRefs.map((ref) => `- \`${ref}\``),
    "",
    "## Commands",
    ...report.recommendedCommands.map((command) => `- \`${command}\``),
    "",
  ];

  return lines.join("\n");
}

/**
 * Creates a stable release package by aggregating evidence and gate evaluation.
 *
 * This is the main entry point for assembling a release package.
 * It collects all evidence profiles, runs the gate evaluation, builds
 * the checklist, and writes all artifacts.
 */
export function createStableReleasePackage(
  options: StableReleasePackageOptions,
): StableReleasePackageReport {
  mkdirSync(options.outputDir, { recursive: true });

  const artifacts = {
    packageReportPath: join(options.outputDir, "stable-release-package-report.json"),
    gateReportPath: join(options.outputDir, "stable-release-gate-report.json"),
    releaseChecklistPath: join(options.outputDir, "stable-release-checklist.json"),
    summaryMarkdownPath: join(options.outputDir, "stable-release-package-summary.md"),
  };

  // Build gate report
  const gate = buildStableReleaseGateReport({
    evidenceRootDir: options.evidenceRootDir,
    ...(options.targetStatus ? { targetStatus: options.targetStatus } : {}),
  });
  writeStableReleaseGateReport(artifacts.gateReportPath, gate);

  // Collect profile summaries
  const profiles = collectProfiles(options.evidenceRootDir);
  const missingRequiredProfiles = gate.requiredProfiles.filter(
    (profile) => !profiles.some((item) => item.profile === profile && item.present),
  );
  const failingProfiles = profiles
    .filter((profile) => profile.present && profile.passed === false)
    .map((profile) => profile.profile);

  // Build checklist
  const releaseChecklist = buildReleaseChecklist(gate, profiles);

  // Assemble report
  const report: StableReleasePackageReport = {
    packageId: `stable_release_package_${gate.checkedAt}`,
    componentId: "stable_core",
    createdAt: gate.checkedAt,
    evidenceRootDir: options.evidenceRootDir,
    outputDir: options.outputDir,
    targetStatus: gate.targetStatus,
    overallVerdict: gate.overallVerdict,
    missingRequiredProfiles,
    failingProfiles,
    profiles,
    releaseChecklist,
    nextActions: buildNextActions(gate, profiles),
    runbookRefs: RUNBOOK_REFS,
    recommendedCommands: buildRecommendedCommands(gate.targetStatus),
    artifacts,
    gate,
  };

  // Write all artifacts
  writeJson(artifacts.packageReportPath, report);
  writeJson(artifacts.releaseChecklistPath, releaseChecklist);
  writeFileSync(artifacts.summaryMarkdownPath, buildSummaryMarkdown(report));

  return report;
}
