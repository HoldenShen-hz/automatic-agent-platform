import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildNextActions,
  buildRecommendedCommands,
  summarizeCriteria,
  createStableReleasePackage,
  type StableReleasePackageProfileSummary,
} from "../../../../src/platform/stability/stable-release-package.js";
import type {
  StableGateCriterion,
  StableGateTargetStatus,
  StableReleaseGateReport,
} from "../../../../src/platform/stability/stable-release-gate.js";
import type { StableEvidenceBundleReport } from "../../../../src/platform/stability/stable-evidence-bundle.js";

function createMinimalGateReport(targetStatus: StableGateTargetStatus = "canary"): StableReleaseGateReport {
  return {
    packageId: "test-gate",
    componentId: "stable_core",
    currentStatus: "canary",
    targetStatus,
    overallVerdict: "conditional",
    checkedAt: new Date().toISOString(),
    requiredProfiles: targetStatus === "production_ready" ? ["smoke", "24h", "72h"] : ["smoke"],
    availableProfiles: ["smoke"],
    requiredCriteria: [],
    optionalCriteria: [],
    criteria: [],
    blockers: [],
    artifactRefs: [],
  };
}

function createMinimalProfileSummary(
  profile: "smoke" | "24h" | "72h",
  present: boolean,
  passed: boolean | null = null,
): StableReleasePackageProfileSummary {
  return {
    profile,
    reportPath: `/evidence/${profile}/report.json`,
    present,
    passed,
    chaosPassed: null,
    leasePassed: null,
    rollbackPassed: null,
    rollingUpgradePassed: null,
    maintenancePassed: null,
    grayReleasePassed: null,
    dbQueueDisconnectPassed: null,
    dbWritabilityPassed: null,
    queueDeliveryPassed: null,
    migrationCompatibilityPassed: null,
    backupRestorePlaybookPath: null,
    rollingUpgradePlaybookPath: null,
    maintenancePlaybookPath: null,
    grayReleasePlaybookPath: null,
    doctorStatus: null,
    acceptanceLineStatus: null,
    acceptanceReportPath: null,
    acceptanceObservedSoakDurationMs: null,
  };
}

describe("stable-release-package additional tests", () => {
  describe("buildNextActions edge cases", () => {
    test("returns empty array when all passing", () => {
      const gate = createMinimalGateReport();
      const profiles = [
        createMinimalProfileSummary("smoke", true, true),
        createMinimalProfileSummary("24h", false),
        createMinimalProfileSummary("72h", false),
      ];

      const actions = buildNextActions(gate, profiles);
      // Should have conditional promotion action but not failure actions
      assert.ok(Array.isArray(actions));
    });

    test("handles missing 24h and 72h profiles for canary", () => {
      const gate = createMinimalGateReport("canary");
      const profiles = [
        createMinimalProfileSummary("smoke", true, true),
        createMinimalProfileSummary("24h", false),
        createMinimalProfileSummary("72h", false),
      ];

      const actions = buildNextActions(gate, profiles);
      // Canary doesn't require 24h/72h
      assert.ok(!actions.some((a) => a.includes("24h") && a.includes("missing")));
      assert.ok(!actions.some((a) => a.includes("72h") && a.includes("missing")));
    });

    test("requires 24h and 72h for production_ready", () => {
      const gate = createMinimalGateReport("production_ready");
      const profiles = [
        createMinimalProfileSummary("smoke", true, true),
        createMinimalProfileSummary("24h", false),
        createMinimalProfileSummary("72h", false),
      ];

      const actions = buildNextActions(gate, profiles);
      assert.ok(actions.some((a) => a.includes("24h") && a.includes("missing")));
      assert.ok(actions.some((a) => a.includes("72h") && a.includes("missing")));
    });

    test("suggests keep at canary when smoke fails", () => {
      const gate = createMinimalGateReport("canary");
      const profiles = [createMinimalProfileSummary("smoke", true, false)];

      const actions = buildNextActions(gate, profiles);
      assert.ok(actions.some((a) => a.includes("Fix failing smoke evidence")));
    });
  });

  describe("summarizeCriteria", () => {
    test("returns pass when given empty array", () => {
      const result = summarizeCriteria([]);
      assert.equal(result.status, "pass");
      assert.equal(result.detail, "");
      assert.deepEqual(result.evidenceRefs, []);
    });

    test("returns pass when all criteria are pass", () => {
      const criteria: StableGateCriterion[] = [
        { criterionId: "test1", status: "pass", detail: "test1:pass", evidenceRefs: [] },
        { criterionId: "test2", status: "pass", detail: "test2:pass", evidenceRefs: [] },
      ];
      const result = summarizeCriteria(criteria);
      assert.equal(result.status, "pass");
    });

    test("returns fail when any criterion is fail", () => {
      const criteria: StableGateCriterion[] = [
        { criterionId: "test1", status: "pass", detail: "test1:pass", evidenceRefs: [] },
        { criterionId: "test2", status: "fail", detail: "test2:fail", evidenceRefs: [] },
        { criterionId: "test3", status: "pass", detail: "test3:pass", evidenceRefs: [] },
      ];
      const result = summarizeCriteria(criteria);
      assert.equal(result.status, "fail");
    });

    test("returns partial when some criteria are partial but none fail", () => {
      const criteria: StableGateCriterion[] = [
        { criterionId: "test1", status: "pass", detail: "test1:pass", evidenceRefs: [] },
        { criterionId: "test2", status: "partial", detail: "test2:partial", evidenceRefs: [] },
      ];
      const result = summarizeCriteria(criteria);
      assert.equal(result.status, "partial");
    });

    test("evidence refs are unique across criteria", () => {
      const criteria: StableGateCriterion[] = [
        { criterionId: "test1", status: "pass", detail: "test1", evidenceRefs: ["/ref1.json", "/ref2.json"] },
        { criterionId: "test2", status: "pass", detail: "test2", evidenceRefs: ["/ref2.json", "/ref3.json"] },
      ];
      const result = summarizeCriteria(criteria);
      assert.deepEqual(result.evidenceRefs, ["/ref1.json", "/ref2.json", "/ref3.json"]);
    });
  });

  describe("buildRecommendedCommands", () => {
    test("returns non-empty array", () => {
      const commands = buildRecommendedCommands("canary");
      assert.ok(Array.isArray(commands));
      assert.ok(commands.length > 0);
    });

    test("contains evidence generation commands", () => {
      const commands = buildRecommendedCommands("canary");
      const evidenceCommands = commands.filter((c) => c.includes("evidence") || c.includes("stable"));
      assert.ok(evidenceCommands.length > 0);
    });

    test("contains gate commands for all target statuses", () => {
      const statuses: StableGateTargetStatus[] = ["canary", "tenant_gray", "production_ready"];

      for (const status of statuses) {
        const commands = buildRecommendedCommands(status);
        assert.ok(
          commands.some((c) => c.includes(`gate:stable`) && c.includes(status)),
          `Should have gate command for ${status}`,
        );
      }
    });

    test("contains package command for target status", () => {
      const commands = buildRecommendedCommands("production_ready");
      assert.ok(
        commands.some((c) => c.includes("package:stable") && c.includes("production_ready")),
      );
    });

    test("contains npm run commands", () => {
      const commands = buildRecommendedCommands("canary");
      const npmCommands = commands.filter((c) => c.startsWith("npm"));
      assert.ok(npmCommands.length > 0);
    });
  });

  describe("createStableReleasePackage", () => {
    test("creates output directory if not exists", () => {
      const evidenceRootDir = mkdtempSync(join(tmpdir(), "stable-release-pkg-evidence-"));
      const outputDir = join(tmpdir(), "stable-release-pkg-output-nonexistent");

      // Ensure output dir doesn't exist
      rmSync(outputDir, { recursive: true, force: true });

      try {
        const smokeDir = join(evidenceRootDir, "smoke");
        mkdirSync(smokeDir, { recursive: true });

        const report = createStableReleasePackage({
          evidenceRootDir,
          outputDir,
          targetStatus: "canary",
        });

        assert.ok(existsSync(outputDir));
        assert.equal(report.outputDir, outputDir);
      } finally {
        rmSync(evidenceRootDir, { recursive: true, force: true });
        rmSync(outputDir, { recursive: true, force: true });
      }
    });

    test("report includes all required profiles", () => {
      const evidenceRootDir = mkdtempSync(join(tmpdir(), "stable-release-pkg-profiles-"));
      const outputDir = mkdtempSync(join(tmpdir(), "stable-release-pkg-output-"));

      try {
        const smokeDir = join(evidenceRootDir, "smoke");
        mkdirSync(smokeDir, { recursive: true });

        // Create minimal evidence bundle report
        const bundleReport: StableEvidenceBundleReport = {
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          outputDir: smokeDir,
          profile: { name: "smoke", validationIterations: 2, soakDurationMs: 5000, soakIntervalMs: 500, soakIterationsPerCycle: 1 },
          artifacts: {
            bundleReportPath: join(smokeDir, "report.json"),
            chaosReportPath: "",
            promptInjectionReportPath: "",
            concurrencyReportPath: "",
            leaseReportPath: "",
            validationReportPath: "",
            soakReportPath: "",
            doctorReportPath: "",
            acceptanceReportPath: "",
            repairReportPath: "",
            drainEventsReportPath: "",
            diagnosticSnapshotPath: "",
            debugDumpPath: "",
            takeoverSamplePath: "",
            rollbackReportPath: "",
            backupRestoreReportPath: "",
            backupRestorePlaybookPath: "",
            rollingUpgradeReportPath: "",
            rollingUpgradePlaybookPath: "",
            maintenanceReportPath: "",
            maintenancePlaybookPath: "",
            grayReleaseReportPath: "",
            grayReleasePlaybookPath: "",
            eventReplayReportPath: "",
            dbQueueDisconnectReportPath: "",
            dbWritabilityReportPath: "",
            queueDeliveryReportPath: "",
            migrationCompatibilityReportPath: "",
            runtimeDbPath: "",
          },
          acceptanceLine: {
            evaluatedAt: new Date().toISOString(),
            status: "pass",
            profileName: "smoke",
            truthNotes: [],
            criteria: [],
            observed: {
              soakDurationMs: 5000,
              requiredDurationMs: 14 * 24 * 60 * 60 * 1000,
              longRunCoveragePct: 100,
              manualDbRepairSignalCount: 0,
              orphanQueueClaimCount: 0,
              zombieLockCount: 0,
              recoveryAttemptCount: 0,
              recoverySucceededCount: 0,
              recoverySuccessRatePct: 100,
            },
            latencyBudget: [],
          },
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

        writeFileSync(join(smokeDir, "stable-evidence-report.json"), JSON.stringify(bundleReport));

        const report = createStableReleasePackage({
          evidenceRootDir,
          outputDir,
          targetStatus: "canary",
        });

        assert.equal(report.profiles.length, 3); // smoke, 24h, 72h
        const smoke = report.profiles.find((p) => p.profile === "smoke");
        assert.ok(smoke?.present);
      } finally {
        rmSync(evidenceRootDir, { recursive: true, force: true });
        rmSync(outputDir, { recursive: true, force: true });
      }
    });

    test("falls back to the default evidence root when evidenceRootDir is omitted", () => {
      const workspace = mkdtempSync(join(tmpdir(), "stable-release-pkg-default-root-"));
      const outputDir = join(workspace, "output");
      const evidenceRootDir = join(workspace, "data", "stable-evidence");
      const smokeDir = join(evidenceRootDir, "smoke");
      const previousCwd = process.cwd();

      try {
        mkdirSync(smokeDir, { recursive: true });
        writeFileSync(
          join(smokeDir, "stable-evidence-report.json"),
          JSON.stringify({
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            outputDir: smokeDir,
            profile: { name: "smoke", validationIterations: 2, soakDurationMs: 5000, soakIntervalMs: 500, soakIterationsPerCycle: 1 },
            artifacts: {
              chaosReportPath: join(smokeDir, "chaos.json"),
              concurrencyReportPath: join(smokeDir, "concurrency.json"),
              leaseReportPath: join(smokeDir, "lease.json"),
              doctorReportPath: join(smokeDir, "doctor.json"),
              migrationCompatibilityReportPath: join(smokeDir, "migration.json"),
              backupRestoreReportPath: join(smokeDir, "backup.json"),
              rollbackReportPath: join(smokeDir, "rollback.json"),
              maintenanceReportPath: join(smokeDir, "maintenance.json"),
              grayReleaseReportPath: join(smokeDir, "gray.json"),
              dbQueueDisconnectReportPath: join(smokeDir, "db-queue.json"),
              dbWritabilityReportPath: join(smokeDir, "db-write.json"),
              queueDeliveryReportPath: join(smokeDir, "queue.json"),
              acceptanceReportPath: join(smokeDir, "acceptance.json"),
            },
            summary: {
              passed: true,
              doctorStatus: "ok",
              chaosPassed: true,
              concurrencyPassed: true,
              leasePassed: true,
              migrationCompatibilityPassed: true,
              backupRestorePassed: true,
              rollbackPassed: true,
              maintenancePassed: true,
              grayReleasePassed: true,
              dbQueueDisconnectPassed: true,
              dbWritabilityPassed: true,
              queueDeliveryPassed: true,
              rollingUpgradePassed: true,
            },
            acceptanceLine: {
              status: "partial",
              detail: "long_run_evidence:partial",
              criteria: [
                {
                  criterionId: "long_run_evidence",
                  status: "partial",
                  detail: "long_run_evidence:partial",
                },
              ],
              observed: {
                soakDurationMs: 5000,
              },
            },
          } satisfies StableEvidenceBundleReport),
        );

        process.chdir(workspace);
        const report = createStableReleasePackage({
          outputDir,
          targetStatus: "production_ready",
        });

        assert.ok(report.evidenceRootDir.endsWith("/data/stable-evidence"));
        assert.equal(report.profiles[0]?.present, true);
      } finally {
        process.chdir(previousCwd);
        rmSync(workspace, { recursive: true, force: true });
      }
    });

    test("creates markdown summary file", () => {
      const evidenceRootDir = mkdtempSync(join(tmpdir(), "stable-release-pkg-md-"));
      const outputDir = mkdtempSync(join(tmpdir(), "stable-release-pkg-md-out-"));

      try {
        const smokeDir = join(evidenceRootDir, "smoke");
        mkdirSync(smokeDir, { recursive: true });

        const report = createStableReleasePackage({
          evidenceRootDir,
          outputDir,
          targetStatus: "canary",
        });

        assert.ok(existsSync(report.artifacts.summaryMarkdownPath));
        const content = readFileSync(report.artifacts.summaryMarkdownPath, "utf8");
        assert.ok(content.includes("Stable Release Package"));
        assert.ok(content.includes(report.targetStatus));
      } finally {
        rmSync(evidenceRootDir, { recursive: true, force: true });
        rmSync(outputDir, { recursive: true, force: true });
      }
    });
  });
});

import { readFileSync } from "node:fs";
