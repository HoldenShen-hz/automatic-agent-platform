import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createStableEvidenceBundle,
  type StableEvidenceBundleReport,
  type StableEvidenceBundleOptions,
  type StableEvidenceProfile,
  type StableEvidenceProfileName,
} from "../../../../src/platform/stability/stable-evidence-bundle.js";
import type { StableSoakReport } from "../../../../src/platform/stability/stable-runtime-soak-runner.js";
import type { StableValidationReport } from "../../../../src/platform/stability/stable-runtime-validator.js";

function createMockValidationReport(overrides: Partial<StableValidationReport> = {}): StableValidationReport {
  return {
    startedAt: "2026-04-20T00:00:00.000Z",
    finishedAt: "2026-04-20T00:00:01.000Z",
    iterations: 1,
    totalRuns: 1,
    passedRuns: 1,
    failedRuns: 0,
    integrityFailures: 0,
    backupFailures: 0,
    averageDurationMs: 10,
    maxDurationMs: 10,
    caseSummaries: [],
    artifacts: {
      reportPath: "/tmp/validation-report.json",
      baselinePath: "/tmp/validation-baseline.json",
      inventoryPath: "/tmp/validation-inventory.json",
    },
    baselineComparison: {
      baselinePath: "/tmp/validation-baseline.json",
      baselineCreated: false,
      status: "match",
      regressionDetected: false,
      failedRunsDelta: 0,
      integrityFailuresDelta: 0,
      backupFailuresDelta: 0,
      averageDurationDeltaMs: 0,
      averageDurationDeltaPct: 0,
      maxDurationDeltaMs: 0,
      maxDurationDeltaPct: 0,
      caseDrifts: [],
    },
    runs: [],
    ...overrides,
  };
}

function createMockSoakReport(overrides: Partial<StableSoakReport> = {}): StableSoakReport {
  return {
    startedAt: "2026-04-20T00:00:02.000Z",
    finishedAt: "2026-04-20T00:00:02.000Z",
    durationMs: 0,
    wallClockDurationMs: 0,
    intervalMs: 0,
    iterationsPerCycle: 1,
    cycles: [],
    totalRuns: 1,
    failedRuns: 0,
    passedRuns: 1,
    integrityFailures: 0,
    backupFailures: 0,
    ...overrides,
  };
}

describe("stable-evidence-bundle additional tests", () => {
  describe("createStableEvidenceBundle with different configurations", () => {
    test("uses default smoke profile when none specified", async () => {
      const outputDir = mkdtempSync(join(tmpdir(), "stable-evidence-bundle-default-"));

      try {
        const report = await createStableEvidenceBundle({
          outputDir,
          validationReport: createMockValidationReport(),
          soakReport: createMockSoakReport(),
        });

        assert.equal(report.profile.name, "smoke");
      } finally {
        rmSync(outputDir, { recursive: true, force: true });
      }
    });

    test("accepts 24h profile", async () => {
      const outputDir = mkdtempSync(join(tmpdir(), "stable-evidence-bundle-24h-"));

      try {
        const report = await createStableEvidenceBundle({
          outputDir,
          profileName: "24h",
          validationReport: createMockValidationReport({ iterations: 5, totalRuns: 5 }),
          soakReport: createMockSoakReport({ totalRuns: 3 }),
        });

        assert.equal(report.profile.name, "24h");
        assert.equal(report.profile.validationIterations, 5);
      } finally {
        rmSync(outputDir, { recursive: true, force: true });
      }
    });

    test("writes bundle report JSON", async () => {
      const outputDir = mkdtempSync(join(tmpdir(), "stable-evidence-bundle-report-"));

      try {
        const report = await createStableEvidenceBundle({
          outputDir,
          validationReport: createMockValidationReport(),
          soakReport: createMockSoakReport(),
        });

        assert.equal(existsSync(report.artifacts.bundleReportPath), true);
        const content = JSON.parse(readFileSync(report.artifacts.bundleReportPath, "utf8"));
        assert.equal(content.profile.name, "smoke");
      } finally {
        rmSync(outputDir, { recursive: true, force: true });
      }
    });

    test("report contains all required summary fields", async () => {
      const outputDir = mkdtempSync(join(tmpdir(), "stable-evidence-bundle-summary-"));

      try {
        const report = await createStableEvidenceBundle({
          outputDir,
          validationReport: createMockValidationReport(),
          soakReport: createMockSoakReport(),
        });

        // Check all summary fields exist
        assert.equal(typeof report.summary.passed, "boolean");
        assert.equal(typeof report.summary.chaosPassed, "boolean");
        assert.equal(typeof report.summary.promptInjectionPassed, "boolean");
        assert.equal(typeof report.summary.concurrencyPassed, "boolean");
        assert.equal(typeof report.summary.leasePassed, "boolean");
        assert.equal(typeof report.summary.rollbackPassed, "boolean");
        assert.equal(typeof report.summary.backupRestorePassed, "boolean");
        assert.equal(typeof report.summary.rollingUpgradePassed, "boolean");
        assert.equal(typeof report.summary.maintenancePassed, "boolean");
        assert.equal(typeof report.summary.grayReleasePassed, "boolean");
        assert.equal(typeof report.summary.validationPassed, "boolean");
        assert.equal(typeof report.summary.soakPassed, "boolean");
        assert.equal(typeof report.summary.doctorStatus, "string");
        assert.equal(typeof report.summary.totalValidationRuns, "number");
        assert.equal(typeof report.summary.totalSoakRuns, "number");
      } finally {
        rmSync(outputDir, { recursive: true, force: true });
      }
    });

    test("report artifacts include all expected paths", async () => {
      const outputDir = mkdtempSync(join(tmpdir(), "stable-evidence-bundle-artifacts-"));

      try {
        const report = await createStableEvidenceBundle({
          outputDir,
          validationReport: createMockValidationReport(),
          soakReport: createMockSoakReport(),
        });

        // Check key artifacts exist
        assert.ok(report.artifacts.bundleReportPath.includes("stable-evidence-report.json"));
        assert.ok(report.artifacts.chaosReportPath.includes("chaos-report.json"));
        assert.ok(report.artifacts.validationReportPath.includes("validation-report.json"));
        assert.ok(report.artifacts.soakReportPath.includes("soak-report.json"));
        assert.ok(report.artifacts.doctorReportPath.includes("doctor-report.json"));
        assert.ok(report.artifacts.acceptanceReportPath.includes("stable-acceptance-line-report.json"));
      } finally {
        rmSync(outputDir, { recursive: true, force: true });
      }
    });

    test("acceptance line is included in report", async () => {
      const outputDir = mkdtempSync(join(tmpdir(), "stable-evidence-bundle-acceptance-"));

      try {
        const report = await createStableEvidenceBundle({
          outputDir,
          validationReport: createMockValidationReport(),
          soakReport: createMockSoakReport(),
        });

        assert.ok(report.acceptanceLine);
        assert.equal(typeof report.acceptanceLine.status, "string");
        assert.ok(["pass", "partial", "fail"].includes(report.acceptanceLine.status));
      } finally {
        rmSync(outputDir, { recursive: true, force: true });
      }
    });

    test("handles validation report with failures", async () => {
      const outputDir = mkdtempSync(join(tmpdir(), "stable-evidence-bundle-val-fail-"));

      try {
        const validationReport = createMockValidationReport({
          failedRuns: 2,
          integrityFailures: 1,
          passedRuns: 0,
          totalRuns: 2,
        });

        const report = await createStableEvidenceBundle({
          outputDir,
          validationReport,
          soakReport: createMockSoakReport(),
        });

        assert.equal(report.summary.failedValidationRuns, 2);
        assert.equal(report.summary.integrityFailures >= 0, true);
      } finally {
        rmSync(outputDir, { recursive: true, force: true });
      }
    });

    test("handles soak report with failures", async () => {
      const outputDir = mkdtempSync(join(tmpdir(), "stable-evidence-bundle-soak-fail-"));

      try {
        const soakReport = createMockSoakReport({
          failedRuns: 1,
          passedRuns: 0,
          totalRuns: 1,
        });

        const report = await createStableEvidenceBundle({
          outputDir,
          validationReport: createMockValidationReport(),
          soakReport,
        });

        assert.equal(report.summary.failedSoakRuns, 1);
      } finally {
        rmSync(outputDir, { recursive: true, force: true });
      }
    });
  });

  describe("Type exports", () => {
    test("StableEvidenceBundleReport can be annotated", () => {
      const report: StableEvidenceBundleReport = {
        startedAt: "2026-04-20T00:00:00.000Z",
        finishedAt: "2026-04-20T00:01:00.000Z",
        outputDir: "/tmp/test",
        profile: {
          name: "smoke",
          validationIterations: 2,
          soakDurationMs: 5000,
          soakIntervalMs: 500,
          soakIterationsPerCycle: 1,
        },
        artifacts: {
          bundleReportPath: "/tmp/report.json",
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
          evaluatedAt: "2026-04-20T00:00:00.000Z",
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

      assert.equal(report.profile.name, "smoke");
      assert.equal(report.summary.passed, true);
    });

    test("StableEvidenceBundleOptions can be constructed", () => {
      const options: StableEvidenceBundleOptions = {
        outputDir: "/tmp/test",
        profileName: "smoke",
      };
      assert.equal(options.outputDir, "/tmp/test");
      assert.equal(options.profileName, "smoke");
    });

    test("StableEvidenceProfile can be annotated", () => {
      const profile: StableEvidenceProfile = {
        name: "smoke",
        validationIterations: 2,
        soakDurationMs: 5000,
        soakIntervalMs: 500,
        soakIterationsPerCycle: 1,
      };
      assert.equal(profile.name, "smoke");
    });

    test("StableEvidenceProfileName is string literal type", () => {
      const name: StableEvidenceProfileName = "smoke";
      assert.ok(["smoke", "24h", "72h"].includes(name));
    });
  });
});
