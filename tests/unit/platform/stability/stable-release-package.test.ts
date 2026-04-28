import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildNextActions,
  buildRecommendedCommands,
  createStableReleasePackage,
  summarizeCriteria,
  type StableReleasePackageProfileSummary,
} from "../../../../src/platform/stability/stable-release-package.js";
import type {
  StableGateCriterion,
  StableGateTargetStatus,
  StableReleaseGateReport,
} from "../../../../src/platform/stability/stable-release-gate.js";
import type { StableAcceptanceLineReport } from "../../../../src/platform/stability/stable-acceptance-line.js";
import type { StableEvidenceBundleReport } from "../../../../src/platform/stability/stable-evidence-bundle.js";

function criterion(
  criterionId: StableGateCriterion["criterionId"],
  status: StableGateCriterion["status"],
  evidenceRefs: string[] = [`/evidence/${criterionId}.json`],
): StableGateCriterion {
  return {
    criterionId,
    status,
    detail: `${criterionId}:${status}`,
    evidenceRefs,
  };
}

function createGateReport(overrides: Partial<StableReleaseGateReport> = {}): StableReleaseGateReport {
  const criteria: StableGateCriterion[] = [
    criterion("contracts_frozen", "pass"),
    criterion("conformance_tests", "pass"),
    criterion("telemetry_instrumented", "pass"),
    criterion("migration_compatibility_tested", "pass"),
    criterion("runbooks_documented", "pass"),
    criterion("rollback_tested", "pass"),
    criterion("ownership_defined", "pass"),
    criterion("backup_restore_tested", "pass"),
    criterion("rolling_upgrade_tested", "pass"),
    criterion("maintenance_drain_tested", "pass"),
    criterion("tenant_gray_rollout_tested", "pass"),
    criterion("db_queue_disconnect_tested", "pass"),
    criterion("db_writability_tested", "pass"),
    criterion("queue_delivery_tested", "pass"),
    criterion("stable_acceptance_line", "pass"),
    criterion("chaos_drill_results", "pass"),
    criterion("concurrency_locking_tested", "pass"),
    criterion("lease_fencing_tested", "pass"),
    criterion("event_replay_tested", "pass"),
  ];
  const targetStatus = overrides.targetStatus ?? "canary";
  const requiredProfiles = overrides.requiredProfiles ?? (targetStatus === "production_ready" ? ["smoke", "24h", "72h"] : ["smoke"]);

  return {
    packageId: "gate-1",
    componentId: "stable_core",
    currentStatus: "canary",
    targetStatus,
    overallVerdict: "conditional",
    checkedAt: "2026-04-20T00:00:00.000Z",
    requiredProfiles,
    availableProfiles: ["smoke"],
    requiredCriteria: criteria.filter((item) => [
      "contracts_frozen",
      "conformance_tests",
      "telemetry_instrumented",
      "migration_compatibility_tested",
      "runbooks_documented",
      "rollback_tested",
      "ownership_defined",
      ...(targetStatus === "tenant_gray" || targetStatus === "production_ready" ? ["tenant_gray_rollout_tested"] : []),
      ...(targetStatus === "production_ready"
        ? ["stable_acceptance_line", "db_queue_disconnect_tested", "db_writability_tested", "queue_delivery_tested"]
        : []),
    ].includes(item.criterionId)),
    optionalCriteria: criteria.filter((item) => ![
      "contracts_frozen",
      "conformance_tests",
      "telemetry_instrumented",
      "migration_compatibility_tested",
      "runbooks_documented",
      "rollback_tested",
      "ownership_defined",
      ...(targetStatus === "tenant_gray" || targetStatus === "production_ready" ? ["tenant_gray_rollout_tested"] : []),
      ...(targetStatus === "production_ready"
        ? ["stable_acceptance_line", "db_queue_disconnect_tested", "db_writability_tested", "queue_delivery_tested"]
        : []),
    ].includes(item.criterionId)),
    criteria,
    blockers: [],
    artifactRefs: ["/evidence/gate-report.json"],
    ...overrides,
  };
}

function createProfiles(
  overrides: Partial<Record<"smoke" | "24h" | "72h", Partial<StableReleasePackageProfileSummary>>> = {},
): StableReleasePackageProfileSummary[] {
  const base = (profile: "smoke" | "24h" | "72h"): StableReleasePackageProfileSummary => ({
    profile,
    reportPath: `/evidence/${profile}/stable-evidence-report.json`,
    present: profile === "smoke",
    passed: profile === "smoke" ? true : null,
    chaosPassed: true,
    leasePassed: true,
    rollbackPassed: true,
    rollingUpgradePassed: true,
    maintenancePassed: true,
    grayReleasePassed: true,
    dbQueueDisconnectPassed: true,
    dbWritabilityPassed: true,
    queueDeliveryPassed: true,
    migrationCompatibilityPassed: true,
    backupRestorePlaybookPath: `/evidence/${profile}/backup-restore-playbook.json`,
    rollingUpgradePlaybookPath: `/evidence/${profile}/rolling-upgrade-playbook.json`,
    maintenancePlaybookPath: `/evidence/${profile}/maintenance-playbook.json`,
    grayReleasePlaybookPath: `/evidence/${profile}/gray-release-playbook.json`,
    doctorStatus: "ok",
    acceptanceLineStatus: profile === "smoke" ? "pass" : null,
    acceptanceReportPath: `/evidence/${profile}/stable-acceptance-line-report.json`,
    acceptanceObservedSoakDurationMs: profile === "smoke" ? 5_000 : null,
    ...overrides[profile],
  });

  return [base("smoke"), base("24h"), base("72h")];
}

function createAcceptanceLineReport(status: "pass" | "partial" | "fail" = "pass"): StableAcceptanceLineReport {
  return {
    evaluatedAt: "2026-04-20T00:00:00.000Z",
    status,
    profileName: "smoke",
    truthNotes: status === "pass" ? [] : ["insufficient long-run coverage"],
    criteria: [
      {
        criterionId: "long_run_evidence",
        status,
        detail: `long_run_evidence:${status}`,
        metrics: {},
      },
    ],
    observed: {
      soakDurationMs: 5_000,
      requiredDurationMs: 14 * 24 * 60 * 60 * 1000,
      longRunCoveragePct: status === "pass" ? 100 : 10,
      manualDbRepairSignalCount: 0,
      orphanQueueClaimCount: 0,
      zombieLockCount: 0,
      recoveryAttemptCount: 0,
      recoverySucceededCount: 0,
      recoverySuccessRatePct: 100,
    },
    latencyBudget: [],
  };
}

function createEvidenceBundleReport(profile: "smoke" | "24h" | "72h"): StableEvidenceBundleReport {
  return {
    startedAt: "2026-04-20T00:00:00.000Z",
    finishedAt: "2026-04-20T00:00:01.000Z",
    outputDir: `/tmp/${profile}`,
    profile: {
      name: profile,
      validationIterations: profile === "smoke" ? 2 : 5,
      soakDurationMs: profile === "smoke" ? 5_000 : 24 * 60 * 60 * 1000,
      soakIntervalMs: 500,
      soakIterationsPerCycle: 1,
    },
    artifacts: {
      bundleReportPath: `/tmp/${profile}/stable-evidence-report.json`,
      chaosReportPath: `/tmp/${profile}/chaos-report.json`,
      promptInjectionReportPath: `/tmp/${profile}/prompt-injection-report.json`,
      concurrencyReportPath: `/tmp/${profile}/concurrency-report.json`,
      leaseReportPath: `/tmp/${profile}/lease-report.json`,
      validationReportPath: `/tmp/${profile}/validation-report.json`,
      soakReportPath: `/tmp/${profile}/soak-report.json`,
      doctorReportPath: `/tmp/${profile}/doctor-report.json`,
      acceptanceReportPath: `/tmp/${profile}/stable-acceptance-line-report.json`,
      repairReportPath: `/tmp/${profile}/repair-report.json`,
      drainEventsReportPath: `/tmp/${profile}/drain-events-report.json`,
      diagnosticSnapshotPath: `/tmp/${profile}/diagnostic-snapshot.json`,
      debugDumpPath: `/tmp/${profile}/debug-dump.json`,
      takeoverSamplePath: `/tmp/${profile}/takeover-sample.json`,
      rollbackReportPath: `/tmp/${profile}/rollback-report.json`,
      backupRestoreReportPath: `/tmp/${profile}/backup-restore-report.json`,
      backupRestorePlaybookPath: `/tmp/${profile}/backup-restore-playbook.json`,
      rollingUpgradeReportPath: `/tmp/${profile}/rolling-upgrade-report.json`,
      rollingUpgradePlaybookPath: `/tmp/${profile}/rolling-upgrade-playbook.json`,
      maintenanceReportPath: `/tmp/${profile}/maintenance-report.json`,
      maintenancePlaybookPath: `/tmp/${profile}/maintenance-playbook.json`,
      grayReleaseReportPath: `/tmp/${profile}/gray-release-report.json`,
      grayReleasePlaybookPath: `/tmp/${profile}/gray-release-playbook.json`,
      eventReplayReportPath: `/tmp/${profile}/event-replay-report.json`,
      dbQueueDisconnectReportPath: `/tmp/${profile}/db-queue-disconnect-report.json`,
      dbWritabilityReportPath: `/tmp/${profile}/db-writability-report.json`,
      queueDeliveryReportPath: `/tmp/${profile}/queue-delivery-report.json`,
      migrationCompatibilityReportPath: `/tmp/${profile}/migration-compatibility-report.json`,
      runtimeDbPath: `/tmp/${profile}/runtime/stable-evidence.db`,
    },
    acceptanceLine: createAcceptanceLineReport("pass"),
    summary: {
      passed: true,
      chaosPassed: true,
      promptInjectionPassed: true,
      concurrencyPassed: true,
      leasePassed: true,
      rollbackPassed: true,
      backupRestorePassed: true,
      rollingUpgradePassed: true,
      maintenancePassed: true,
      grayReleasePassed: true,
      eventReplayPassed: true,
      dbQueueDisconnectPassed: true,
      dbWritabilityPassed: true,
      queueDeliveryPassed: true,
      migrationCompatibilityPassed: true,
      validationPassed: true,
      soakPassed: true,
      doctorStatus: "ok",
      startupConsistencyStatus: "pass",
      repairAfterStatus: "pass",
      totalValidationRuns: 2,
      totalSoakRuns: 1,
      totalChaosScenarios: 1,
      totalPromptInjectionScenarios: 1,
      totalRollingUpgradeScenarios: 1,
      totalMaintenanceScenarios: 1,
      totalGrayReleaseScenarios: 1,
      totalDbQueueDisconnectScenarios: 1,
      totalDbWritabilityScenarios: 1,
      totalQueueDeliveryScenarios: 1,
      totalMigrationCompatibilityScenarios: 1,
      totalRollbackScenarios: 1,
      failedValidationRuns: 0,
      failedSoakRuns: 0,
      failedChaosScenarios: 0,
      failedPromptInjectionScenarios: 0,
      failedRollingUpgradeScenarios: 0,
      failedMaintenanceScenarios: 0,
      failedGrayReleaseScenarios: 0,
      failedDbQueueDisconnectScenarios: 0,
      failedDbWritabilityScenarios: 0,
      failedQueueDeliveryScenarios: 0,
      failedMigrationCompatibilityScenarios: 0,
      failedRollbackScenarios: 0,
      integrityFailures: 0,
      backupFailures: 0,
      pendingAckBacklogAfterDrain: 0,
      takeoverSampleClosedLoop: true,
      acceptanceLineStatus: "pass",
    },
  };
}

describe("stable-release-package", () => {
  describe("summarizeCriteria", () => {
    test("returns pass when all criteria pass", () => {
      const result = summarizeCriteria([
        criterion("contracts_frozen", "pass"),
        criterion("conformance_tests", "pass"),
      ]);
      assert.equal(result.status, "pass");
    });

    test("returns partial when some criteria are partial", () => {
      const result = summarizeCriteria([
        criterion("contracts_frozen", "pass"),
        criterion("conformance_tests", "partial"),
      ]);
      assert.equal(result.status, "partial");
    });

    test("returns fail when any criterion fails", () => {
      const result = summarizeCriteria([
        criterion("contracts_frozen", "pass"),
        criterion("conformance_tests", "fail"),
      ]);
      assert.equal(result.status, "fail");
    });

    test("deduplicates evidence refs", () => {
      const result = summarizeCriteria([
        criterion("contracts_frozen", "pass", ["/same.json"]),
        criterion("conformance_tests", "pass", ["/same.json", "/other.json"]),
      ]);
      assert.deepEqual(result.evidenceRefs, ["/same.json", "/other.json"]);
    });

    test("formats detail with criterion statuses", () => {
      const result = summarizeCriteria([
        criterion("contracts_frozen", "pass"),
        criterion("conformance_tests", "partial"),
      ]);
      assert.match(result.detail, /contracts_frozen:pass/);
      assert.match(result.detail, /conformance_tests:partial/);
    });
  });

  describe("buildNextActions", () => {
    test("suggests smoke generation when smoke not present", () => {
      const actions = buildNextActions(createGateReport(), createProfiles({ smoke: { present: false, passed: null } }));
      assert.ok(actions.includes("Generate smoke evidence before any promotion decision."));
    });

    test("suggests repair when smoke present but failing", () => {
      const actions = buildNextActions(createGateReport(), createProfiles({ smoke: { present: true, passed: false } }));
      assert.ok(actions.includes("Fix failing smoke evidence bundle results before retrying the release gate."));
    });

    test("returns no smoke-specific action when smoke passes", () => {
      const actions = buildNextActions(createGateReport(), createProfiles());
      assert.equal(actions.includes("Generate smoke evidence before any promotion decision."), false);
      assert.equal(actions.includes("Fix failing smoke evidence bundle results before retrying the release gate."), false);
    });

    test("suggests promotion when gate is approved", () => {
      const actions = buildNextActions(createGateReport({ overallVerdict: "promote_approved" }), createProfiles());
      assert.ok(actions.some((action) => action.includes("Proceed with the canary rollout")));
    });

    test("suggests not promoting when blocked", () => {
      const actions = buildNextActions(createGateReport({ overallVerdict: "promote_blocked" }), createProfiles());
      assert.ok(actions.includes("Do not promote while the gate verdict is blocked."));
    });

    test("includes criteria-specific actions for failing criteria", () => {
      const gate = createGateReport({
        criteria: [
          criterion("backup_restore_tested", "fail"),
          criterion("rolling_upgrade_tested", "fail"),
          criterion("maintenance_drain_tested", "fail"),
          criterion("tenant_gray_rollout_tested", "fail"),
          criterion("db_queue_disconnect_tested", "fail"),
          criterion("db_writability_tested", "fail"),
          criterion("queue_delivery_tested", "fail"),
          criterion("migration_compatibility_tested", "fail"),
        ],
      });
      const actions = buildNextActions(gate, createProfiles());
      assert.ok(actions.includes("Rerun the stable restore rehearsal and regenerate the disaster recovery playbook evidence."));
      assert.ok(actions.includes("Rerun the stable rolling upgrade rehearsal and regenerate the upgrade playbook evidence."));
      assert.ok(actions.includes("Rerun the stable maintenance rehearsal and regenerate the maintenance drain playbook evidence."));
      assert.ok(actions.includes("Rerun the stable tenant-gray rehearsal and regenerate the gray rollout playbook evidence."));
      assert.ok(actions.includes("Rerun the stable DB queue disconnect rehearsal and regenerate the fail-closed repair evidence."));
      assert.ok(actions.includes("Rerun the stable DB writability rehearsal and regenerate the read-only admission fail-close evidence."));
      assert.ok(actions.includes("Rerun the stable queue delivery rehearsal and regenerate the queue replay / duplicate delivery evidence."));
      assert.ok(actions.includes("Rerun the stable migration compatibility rehearsal and regenerate the PG portability evidence."));
    });

    test("deduplicates actions", () => {
      const actions = buildNextActions(
        createGateReport({ requiredProfiles: ["24h", "24h"], overallVerdict: "promote_blocked" }),
        createProfiles({ "24h": { present: false, passed: null } }),
      );
      const duplicates = actions.filter((action) => action === "Collect the missing 24h evidence bundle and rerun the release package.");
      assert.equal(duplicates.length, 1);
    });
  });

  describe("buildRecommendedCommands", () => {
    test("returns array of command strings for canary", () => {
      const commands = buildRecommendedCommands("canary");
      assert.ok(commands.includes("AA_STABLE_PACKAGE_TARGET_STATUS=canary npm run package:stable"));
    });

    test("returns array of command strings for tenant_gray", () => {
      const commands = buildRecommendedCommands("tenant_gray");
      assert.ok(commands.includes("AA_STABLE_PACKAGE_TARGET_STATUS=tenant_gray npm run package:stable"));
    });

    test("returns array of command strings for production_ready", () => {
      const commands = buildRecommendedCommands("production_ready");
      assert.ok(commands.includes("AA_STABLE_PACKAGE_TARGET_STATUS=production_ready npm run package:stable"));
    });

    test("includes npm run commands", () => {
      const commands = buildRecommendedCommands("canary");
      assert.ok(commands.some((command) => command.startsWith("npm run")));
    });

    test("includes gate command with correct target status", () => {
      const commands = buildRecommendedCommands("production_ready");
      assert.ok(commands.includes("AA_STABLE_GATE_TARGET_STATUS=production_ready npm run gate:stable"));
    });
  });

  test("createStableReleasePackage writes artifacts using evidence bundles on disk", () => {
    const evidenceRootDir = mkdtempSync(join(tmpdir(), "stable-release-package-evidence-"));
    const outputDir = mkdtempSync(join(tmpdir(), "stable-release-package-output-"));
    const smokeDir = join(evidenceRootDir, "smoke");

    try {
      mkdirSync(smokeDir, { recursive: true });
      writeFileSync(
        join(smokeDir, "stable-evidence-report.json"),
        JSON.stringify(createEvidenceBundleReport("smoke")),
      );

      const report = createStableReleasePackage({
        evidenceRootDir,
        outputDir,
        targetStatus: "canary",
      });

      assert.equal(report.targetStatus, "canary");
      assert.equal(report.profiles.find((profile) => profile.profile === "smoke")?.present, true);
      assert.equal(existsSync(report.artifacts.packageReportPath), true);
      assert.equal(existsSync(report.artifacts.gateReportPath), true);
      assert.equal(existsSync(report.artifacts.releaseChecklistPath), true);
      assert.equal(existsSync(report.artifacts.summaryMarkdownPath), true);
    } finally {
      rmSync(evidenceRootDir, { recursive: true, force: true });
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
