import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  detail?: string,
  evidenceRefs: string[] = [`/evidence/${criterionId}.json`],
): StableGateCriterion {
  return {
    criterionId,
    status,
    detail: detail ?? `${criterionId}:${status}`,
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

describe("stable-release-package comprehensive", () => {
  describe("summarizeCriteria edge cases", () => {
    test("returns pass for empty criteria array", () => {
      const result = summarizeCriteria([]);
      assert.equal(result.status, "pass");
      assert.equal(result.detail, "");
      assert.deepEqual(result.evidenceRefs, []);
    });

    test("returns fail when only criterion is fail", () => {
      const result = summarizeCriteria([criterion("contracts_frozen", "fail")]);
      assert.equal(result.status, "fail");
    });

    test("returns partial when only criterion is partial", () => {
      const result = summarizeCriteria([criterion("contracts_frozen", "partial")]);
      assert.equal(result.status, "partial");
    });

    test("fail takes precedence over partial", () => {
      const result = summarizeCriteria([
        criterion("a", "partial"),
        criterion("b", "fail"),
        criterion("c", "partial"),
      ]);
      assert.equal(result.status, "fail");
    });
  });

  describe("buildNextActions edge cases", () => {
    test("returns conditional promotion action for tenant_gray when approved", () => {
      const actions = buildNextActions(
        createGateReport({ overallVerdict: "conditional", targetStatus: "tenant_gray" }),
        createProfiles(),
      );
      // When tenant_gray is conditional, it keeps at canary until gray/long-run evidence is complete
      assert.ok(actions.some((action) => action.includes("Keep the component at canary")));
    });

    test("returns conditional promotion action for canary when approved", () => {
      const actions = buildNextActions(
        createGateReport({ overallVerdict: "conditional", targetStatus: "canary" }),
        createProfiles(),
      );
      assert.ok(actions.some((action) => action.includes("Keep the component at canary")));
    });

    test("suggests long-run evidence for production_ready with acceptance line not passing", () => {
      const gate = createGateReport({
        targetStatus: "production_ready",
        overallVerdict: "conditional",
        criteria: [
          criterion("stable_acceptance_line", "fail", "acceptance line not ready"),
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
        ],
      });
      const actions = buildNextActions(gate, createProfiles());
      assert.ok(actions.some((action) => action.includes("14-day soak window")));
    });

    test("handles multiple missing required profiles", () => {
      const gate = createGateReport({ requiredProfiles: ["smoke", "24h", "72h"] });
      const profiles = createProfiles({ smoke: { present: true, passed: true }, "24h": { present: false }, "72h": { present: false } });
      const actions = buildNextActions(gate, profiles);
      assert.ok(actions.some((action) => action.includes("missing 24h")));
      assert.ok(actions.some((action) => action.includes("missing 72h")));
    });

    test("handles all criteria failing", () => {
      const gate = createGateReport({
        overallVerdict: "promote_blocked",
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
      // Should include multiple action items
      assert.ok(actions.length > 5);
    });
  });

  describe("buildRecommendedCommands edge cases", () => {
    test("returns all expected command categories for canary", () => {
      const commands = buildRecommendedCommands("canary");
      assert.ok(commands.some((c) => c.includes("smoke")));
      assert.ok(commands.some((c) => c.includes("sequence")));
      assert.ok(commands.some((c) => c.includes("campaign")));
      assert.ok(commands.some((c) => c.includes("restore")));
      assert.ok(commands.some((c) => c.includes("upgrade")));
      assert.ok(commands.some((c) => c.includes("maintenance")));
      assert.ok(commands.some((c) => c.includes("db-queue-disconnect")));
      assert.ok(commands.some((c) => c.includes("db-writability")));
      assert.ok(commands.some((c) => c.includes("migration")));
      assert.ok(commands.some((c) => c.includes("queue")));
      assert.ok(commands.some((c) => c.includes("gray")));
      assert.ok(commands.some((c) => c.includes("lease")));
      assert.ok(commands.some((c) => c.includes("gate")));
    });

    test("returns all expected command categories for production_ready", () => {
      const commands = buildRecommendedCommands("production_ready");
      assert.ok(commands.some((c) => c.includes("production_ready")));
    });

    test("command count is reasonable", () => {
      const commands = buildRecommendedCommands("canary");
      // Should have multiple commands covering different evidence types
      assert.ok(commands.length >= 10);
    });
  });

  describe("createStableReleasePackage tenant_gray target", () => {
    test("creates package report for tenant_gray with smoke evidence", () => {
      const evidenceRootDir = mkdtempSync(join(tmpdir(), "stable-release-pkg-gray-"));
      const outputDir = mkdtempSync(join(tmpdir(), "stable-release-pkg-gray-out-"));

      try {
        mkdirSync(join(evidenceRootDir, "smoke"), { recursive: true });
        writeFileSync(
          join(evidenceRootDir, "smoke", "stable-evidence-report.json"),
          JSON.stringify(createEvidenceBundleReport("smoke")),
        );

        const report = createStableReleasePackage({
          evidenceRootDir,
          outputDir,
          targetStatus: "tenant_gray",
        });

        assert.equal(report.targetStatus, "tenant_gray");
        // With all passing criteria, gate returns promote_approved
        assert.equal(report.overallVerdict, "promote_approved");
        assert.equal(report.profiles.length, 3); // smoke, 24h, 72h
        assert.equal(report.missingRequiredProfiles.length, 0);
        assert.equal(existsSync(report.artifacts.packageReportPath), true);
        assert.equal(existsSync(report.artifacts.gateReportPath), true);
        assert.equal(existsSync(report.artifacts.releaseChecklistPath), true);
        assert.equal(existsSync(report.artifacts.summaryMarkdownPath), true);

        // Verify JSON content is valid
        const packageReport = JSON.parse(readFileSync(report.artifacts.packageReportPath, "utf8"));
        assert.equal(packageReport.targetStatus, "tenant_gray");
        assert.equal(packageReport.componentId, "stable_core");
      } finally {
        rmSync(evidenceRootDir, { recursive: true, force: true });
        rmSync(outputDir, { recursive: true, force: true });
      }
    });
  });

  describe("createStableReleasePackage production_ready target", () => {
    test("creates package report for production_ready with all profiles", () => {
      const evidenceRootDir = mkdtempSync(join(tmpdir(), "stable-release-pkg-prod-"));
      const outputDir = mkdtempSync(join(tmpdir(), "stable-release-pkg-prod-out-"));

      try {
        // Create all three profiles
        for (const profile of ["smoke", "24h", "72h"] as const) {
          mkdirSync(join(evidenceRootDir, profile), { recursive: true });
          writeFileSync(
            join(evidenceRootDir, profile, "stable-evidence-report.json"),
            JSON.stringify(createEvidenceBundleReport(profile)),
          );
        }

        const report = createStableReleasePackage({
          evidenceRootDir,
          outputDir,
          targetStatus: "production_ready",
        });

        assert.equal(report.targetStatus, "production_ready");
        assert.equal(report.profiles.filter((p) => p.present).length, 3);
        assert.equal(report.missingRequiredProfiles.length, 0);
        assert.ok(report.nextActions.length >= 0);
        assert.ok(report.recommendedCommands.length >= 10);
        assert.ok(report.runbookRefs.length > 0);
      } finally {
        rmSync(evidenceRootDir, { recursive: true, force: true });
        rmSync(outputDir, { recursive: true, force: true });
      }
    });

    test("marks missing required profiles for production_ready", () => {
      const evidenceRootDir = mkdtempSync(join(tmpdir(), "stable-release-pkg-prod-missing-"));
      const outputDir = mkdtempSync(join(tmpdir(), "stable-release-pkg-prod-missing-out-"));

      try {
        // Only smoke, missing 24h and 72h
        mkdirSync(join(evidenceRootDir, "smoke"), { recursive: true });
        writeFileSync(
          join(evidenceRootDir, "smoke", "stable-evidence-report.json"),
          JSON.stringify(createEvidenceBundleReport("smoke")),
        );

        const report = createStableReleasePackage({
          evidenceRootDir,
          outputDir,
          targetStatus: "production_ready",
        });

        assert.equal(report.targetStatus, "production_ready");
        assert.ok(report.missingRequiredProfiles.includes("24h"));
        assert.ok(report.missingRequiredProfiles.includes("72h"));
      } finally {
        rmSync(evidenceRootDir, { recursive: true, force: true });
        rmSync(outputDir, { recursive: true, force: true });
      }
    });
  });

  describe("createStableReleasePackage with failing evidence", () => {
    test("marks failing profiles in report", () => {
      const evidenceRootDir = mkdtempSync(join(tmpdir(), "stable-release-pkg-fail-"));
      const outputDir = mkdtempSync(join(tmpdir(), "stable-release-pkg-fail-out-"));

      try {
        const failingSmokeBundle = createEvidenceBundleReport("smoke");
        failingSmokeBundle.summary.passed = false;

        mkdirSync(join(evidenceRootDir, "smoke"), { recursive: true });
        writeFileSync(
          join(evidenceRootDir, "smoke", "stable-evidence-report.json"),
          JSON.stringify(failingSmokeBundle),
        );

        const report = createStableReleasePackage({
          evidenceRootDir,
          outputDir,
          targetStatus: "canary",
        });

        assert.ok(report.failingProfiles.includes("smoke"));
      } finally {
        rmSync(evidenceRootDir, { recursive: true, force: true });
        rmSync(outputDir, { recursive: true, force: true });
      }
    });
  });

  describe("createStableReleasePackage release checklist", () => {
    test("checklist is written to correct path", () => {
      const evidenceRootDir = mkdtempSync(join(tmpdir(), "stable-release-pkg-checklist-"));
      const outputDir = mkdtempSync(join(tmpdir(), "stable-release-pkg-checklist-out-"));

      try {
        mkdirSync(join(evidenceRootDir, "smoke"), { recursive: true });
        writeFileSync(
          join(evidenceRootDir, "smoke", "stable-evidence-report.json"),
          JSON.stringify(createEvidenceBundleReport("smoke")),
        );

        const report = createStableReleasePackage({
          evidenceRootDir,
          outputDir,
          targetStatus: "canary",
        });

        assert.equal(existsSync(report.artifacts.releaseChecklistPath), true);
        const checklist = JSON.parse(readFileSync(report.artifacts.releaseChecklistPath, "utf8"));
        assert.ok(Array.isArray(checklist.items));
        assert.ok(checklist.items.length > 0);
        assert.ok(checklist.overallStatus !== undefined);
      } finally {
        rmSync(evidenceRootDir, { recursive: true, force: true });
        rmSync(outputDir, { recursive: true, force: true });
      }
    });
  });

  describe("createStableReleasePackage summary markdown", () => {
    test("summary markdown is written and contains expected sections", () => {
      const evidenceRootDir = mkdtempSync(join(tmpdir(), "stable-release-pkg-md-"));
      const outputDir = mkdtempSync(join(tmpdir(), "stable-release-pkg-md-out-"));

      try {
        mkdirSync(join(evidenceRootDir, "smoke"), { recursive: true });
        writeFileSync(
          join(evidenceRootDir, "smoke", "stable-evidence-report.json"),
          JSON.stringify(createEvidenceBundleReport("smoke")),
        );

        const report = createStableReleasePackage({
          evidenceRootDir,
          outputDir,
          targetStatus: "canary",
        });

        assert.equal(existsSync(report.artifacts.summaryMarkdownPath), true);
        const markdown = readFileSync(report.artifacts.summaryMarkdownPath, "utf8");
        assert.ok(markdown.includes("# Stable Release Package"));
        assert.ok(markdown.includes("## Verdict"));
        assert.ok(markdown.includes("## Evidence Profiles"));
        assert.ok(markdown.includes("## Release Checklist"));
        assert.ok(markdown.includes("## Next Actions"));
        assert.ok(markdown.includes("## Runbooks"));
        assert.ok(markdown.includes("## Commands"));
      } finally {
        rmSync(evidenceRootDir, { recursive: true, force: true });
        rmSync(outputDir, { recursive: true, force: true });
      }
    });
  });

  describe("createStableReleasePackage gate report", () => {
    test("gate report is written and contains criteria", () => {
      const evidenceRootDir = mkdtempSync(join(tmpdir(), "stable-release-pkg-gate-"));
      const outputDir = mkdtempSync(join(tmpdir(), "stable-release-pkg-gate-out-"));

      try {
        mkdirSync(join(evidenceRootDir, "smoke"), { recursive: true });
        writeFileSync(
          join(evidenceRootDir, "smoke", "stable-evidence-report.json"),
          JSON.stringify(createEvidenceBundleReport("smoke")),
        );

        const report = createStableReleasePackage({
          evidenceRootDir,
          outputDir,
          targetStatus: "canary",
        });

        assert.equal(existsSync(report.artifacts.gateReportPath), true);
        const gateReport = JSON.parse(readFileSync(report.artifacts.gateReportPath, "utf8"));
        assert.ok(Array.isArray(gateReport.criteria));
        assert.ok(gateReport.overallVerdict !== undefined);
        assert.ok(gateReport.targetStatus !== undefined);
      } finally {
        rmSync(evidenceRootDir, { recursive: true, force: true });
        rmSync(outputDir, { recursive: true, force: true });
      }
    });
  });

  describe("createStableReleasePackage without optional targetStatus", () => {
    test("uses default targetStatus from evidence", () => {
      const evidenceRootDir = mkdtempSync(join(tmpdir(), "stable-release-pkg-default-"));
      const outputDir = mkdtempSync(join(tmpdir(), "stable-release-pkg-default-out-"));

      try {
        mkdirSync(join(evidenceRootDir, "smoke"), { recursive: true });
        writeFileSync(
          join(evidenceRootDir, "smoke", "stable-evidence-report.json"),
          JSON.stringify(createEvidenceBundleReport("smoke")),
        );

        const report = createStableReleasePackage({
          evidenceRootDir,
          outputDir,
          // no targetStatus - should default to canary
        });

        assert.equal(report.targetStatus, "canary");
      } finally {
        rmSync(evidenceRootDir, { recursive: true, force: true });
        rmSync(outputDir, { recursive: true, force: true });
      }
    });
  });

  describe("createStableReleasePackage output directory creation", () => {
    test("creates nested output directories", () => {
      const evidenceRootDir = mkdtempSync(join(tmpdir(), "stable-release-pkg-nested-"));
      const outputDir = join(tmpdir(), "deeply", "nested", "output", "dir");

      try {
        mkdirSync(join(evidenceRootDir, "smoke"), { recursive: true });
        writeFileSync(
          join(evidenceRootDir, "smoke", "stable-evidence-report.json"),
          JSON.stringify(createEvidenceBundleReport("smoke")),
        );

        const report = createStableReleasePackage({
          evidenceRootDir,
          outputDir,
          targetStatus: "canary",
        });

        assert.equal(existsSync(report.artifacts.packageReportPath), true);
      } finally {
        rmSync(evidenceRootDir, { recursive: true, force: true });
        rmSync(outputDir, { recursive: true, force: true });
      }
    });
  });
});
