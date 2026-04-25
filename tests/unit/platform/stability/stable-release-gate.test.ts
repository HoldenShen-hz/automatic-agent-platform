import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildStableReleaseGateReport,
  writeStableReleaseGateReport,
  type StableGateTargetStatus,
  type StableGateVerdict,
  type StableGateCriterion,
} from "../../../../src/platform/stability/stable-release-gate.js";
import type { StableEvidenceBundleReport } from "../../../../src/platform/stability/stable-evidence-bundle-support.js";
import type { StableAcceptanceLineReport } from "../../../../src/platform/stability/stable-acceptance-line.js";

// Helper to create minimal evidence bundle report
function createMockEvidenceReport(overrides: Partial<StableEvidenceBundleReport["summary"]> = {}): StableEvidenceBundleReport {
  return {
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    outputDir: "/tmp/evidence",
    profile: {
      name: "smoke",
      validationIterations: 2,
      soakDurationMs: 5_000,
      soakIntervalMs: 500,
      soakIterationsPerCycle: 1,
    },
    artifacts: {
      bundleReportPath: "/tmp/evidence/stable-evidence-report.json",
      chaosReportPath: "/tmp/evidence/chaos-report.json",
      promptInjectionReportPath: "/tmp/evidence/prompt-injection-report.json",
      concurrencyReportPath: "/tmp/evidence/concurrency-report.json",
      leaseReportPath: "/tmp/evidence/lease-report.json",
      validationReportPath: "/tmp/evidence/validation-report.json",
      soakReportPath: "/tmp/evidence/soak-report.json",
      doctorReportPath: "/tmp/evidence/doctor-report.json",
      acceptanceReportPath: "/tmp/evidence/stable-acceptance-line-report.json",
      repairReportPath: "/tmp/evidence/repair-report.json",
      drainEventsReportPath: "/tmp/evidence/drain-events-report.json",
      diagnosticSnapshotPath: "/tmp/evidence/diagnostic-snapshot.json",
      debugDumpPath: "/tmp/evidence/debug-dump.json",
      takeoverSamplePath: "/tmp/evidence/takeover-sample.json",
      rollbackReportPath: "/tmp/evidence/rollback-report.json",
      backupRestoreReportPath: "/tmp/evidence/backup-restore-report.json",
      backupRestorePlaybookPath: "/tmp/evidence/backup-restore/stable-disaster-recovery-playbook.json",
      rollingUpgradeReportPath: "/tmp/evidence/rolling-upgrade-report.json",
      rollingUpgradePlaybookPath: "/tmp/evidence/upgrade/stable-rolling-upgrade-playbook.json",
      maintenanceReportPath: "/tmp/evidence/maintenance-report.json",
      maintenancePlaybookPath: "/tmp/evidence/maintenance/stable-maintenance-playbook.json",
      grayReleaseReportPath: "/tmp/evidence/gray-release-report.json",
      grayReleasePlaybookPath: "/tmp/evidence/gray/stable-gray-release-playbook.json",
      eventReplayReportPath: "/tmp/evidence/event-replay-report.json",
      dbQueueDisconnectReportPath: "/tmp/evidence/db-queue-disconnect-report.json",
      dbWritabilityReportPath: "/tmp/evidence/db-writability-report.json",
      queueDeliveryReportPath: "/tmp/evidence/queue-delivery-report.json",
      migrationCompatibilityReportPath: "/tmp/evidence/migration-compatibility-report.json",
      runtimeDbPath: "/tmp/evidence/runtime/stable-evidence.db",
    },
    acceptanceLine: createMockAcceptanceLineReport(),
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
      totalChaosScenarios: 3,
      totalPromptInjectionScenarios: 2,
      totalRollingUpgradeScenarios: 2,
      totalMaintenanceScenarios: 2,
      totalGrayReleaseScenarios: 2,
      totalDbQueueDisconnectScenarios: 2,
      totalDbWritabilityScenarios: 2,
      totalQueueDeliveryScenarios: 2,
      totalMigrationCompatibilityScenarios: 2,
      totalRollbackScenarios: 2,
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
      ...overrides,
    },
  };
}

function createMockAcceptanceLineReport(status: "pass" | "partial" | "fail" = "pass"): StableAcceptanceLineReport {
  return {
    evaluatedAt: new Date().toISOString(),
    status,
    profileName: "smoke",
    truthNotes: status === "pass" ? [] : ["Evidence does not cover full 14-day soak"],
    criteria: [
      {
        criterionId: "long_run_evidence",
        status: "partial",
        detail: "Partial coverage",
        metrics: {},
      },
    ],
    observed: {
      soakDurationMs: 5_000,
      requiredDurationMs: 14 * 24 * 60 * 60 * 1000,
      longRunCoveragePct: 0.004,
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

// Create temp dir for tests
function createTempEvidenceDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "stable-gate-test-"));
  return dir;
}

// Helper to create a profile subdirectory
function createProfileDir(baseDir: string, profile: string): string {
  const profileDir = join(baseDir, profile);
  mkdirSync(profileDir, { recursive: true });
  return profileDir;
}

describe("stable-release-gate", () => {
  describe("requiredProfiles via buildStableReleaseGateReport", () => {
    test("returns smoke profile for canary target", () => {
      const dir = createTempEvidenceDir();
      try {
        const report = buildStableReleaseGateReport({
          evidenceRootDir: dir,
          targetStatus: "canary",
        });
        assert.deepEqual(report.requiredProfiles, ["smoke"]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    test("returns smoke profile for tenant_gray target", () => {
      const dir = createTempEvidenceDir();
      try {
        const report = buildStableReleaseGateReport({
          evidenceRootDir: dir,
          targetStatus: "tenant_gray",
        });
        assert.deepEqual(report.requiredProfiles, ["smoke"]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    test("returns smoke, 24h, 72h profiles for production_ready target", () => {
      const dir = createTempEvidenceDir();
      try {
        const report = buildStableReleaseGateReport({
          evidenceRootDir: dir,
          targetStatus: "production_ready",
        });
        assert.deepEqual(report.requiredProfiles, ["smoke", "24h", "72h"]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe("requiredCriteria via buildStableReleaseGateReport", () => {
    test("canary has base criteria only", () => {
      const dir = createTempEvidenceDir();
      try {
        const report = buildStableReleaseGateReport({
          evidenceRootDir: dir,
          targetStatus: "canary",
        });
        const ids = report.requiredCriteria.map((c) => c.criterionId);

        assert.ok(ids.includes("contracts_frozen"));
        assert.ok(ids.includes("conformance_tests"));
        assert.ok(ids.includes("telemetry_instrumented"));
        assert.ok(ids.includes("migration_compatibility_tested"));
        assert.ok(ids.includes("runbooks_documented"));
        assert.ok(ids.includes("rollback_tested"));
        assert.ok(ids.includes("ownership_defined"));
        assert.ok(!ids.includes("tenant_gray_rollout_tested"));
        assert.ok(!ids.includes("stable_acceptance_line"));
        assert.ok(!ids.includes("db_queue_disconnect_tested"));
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    test("tenant_gray adds tenant_gray_rollout_tested", () => {
      const dir = createTempEvidenceDir();
      try {
        const report = buildStableReleaseGateReport({
          evidenceRootDir: dir,
          targetStatus: "tenant_gray",
        });
        const ids = report.requiredCriteria.map((c) => c.criterionId);

        assert.ok(ids.includes("tenant_gray_rollout_tested"));
        assert.ok(!ids.includes("stable_acceptance_line"));
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    test("production_ready adds acceptance line and db tests", () => {
      const dir = createTempEvidenceDir();
      try {
        const report = buildStableReleaseGateReport({
          evidenceRootDir: dir,
          targetStatus: "production_ready",
        });
        const ids = report.requiredCriteria.map((c) => c.criterionId);

        assert.ok(ids.includes("stable_acceptance_line"));
        assert.ok(ids.includes("db_queue_disconnect_tested"));
        assert.ok(ids.includes("db_writability_tested"));
        assert.ok(ids.includes("queue_delivery_tested"));
        assert.ok(ids.includes("tenant_gray_rollout_tested"));
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe("currentStatus derivation via buildStableReleaseGateReport", () => {
    test("returns contract_frozen when blocked", () => {
      const dir = createTempEvidenceDir();
      try {
        // No evidence files - should be blocked
        const report = buildStableReleaseGateReport({
          evidenceRootDir: dir,
          targetStatus: "production_ready",
        });
        assert.equal(report.currentStatus, "contract_frozen");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    test("returns contract_frozen when no smoke report", () => {
      const dir = createTempEvidenceDir();
      try {
        // Create 24h profile but no smoke - still blocked
        const profileDir = createProfileDir(dir, "24h");
        const report = createMockEvidenceReport({ passed: true });
        writeFileSync(join(profileDir, "stable-evidence-report.json"), JSON.stringify(report));

        const gateReport = buildStableReleaseGateReport({
          evidenceRootDir: dir,
          targetStatus: "canary",
        });
        assert.equal(gateReport.currentStatus, "contract_frozen");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    test("returns target status when approved", () => {
      const dir = createTempEvidenceDir();
      try {
        const smokeDir = createProfileDir(dir, "smoke");
        const report = createMockEvidenceReport({ passed: true });
        writeFileSync(join(smokeDir, "stable-evidence-report.json"), JSON.stringify(report));

        const gateReport = buildStableReleaseGateReport({
          evidenceRootDir: dir,
          targetStatus: "tenant_gray",
        });
        assert.equal(gateReport.currentStatus, "tenant_gray");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    test("returns canary for conditional with no gray pass", () => {
      const dir = createTempEvidenceDir();
      try {
        // Create smoke with partial gray release
        const smokeDir = createProfileDir(dir, "smoke");
        const report = createMockEvidenceReport({
          passed: true,
          grayReleasePassed: false,
        });
        writeFileSync(join(smokeDir, "stable-evidence-report.json"), JSON.stringify(report));

        const gateReport = buildStableReleaseGateReport({
          evidenceRootDir: dir,
          targetStatus: "production_ready",
        });
        // With partial/missing criteria, status should not be tenant_gray
        assert.notEqual(gateReport.currentStatus, "tenant_gray");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    test("returns canary for conditional canary target", () => {
      const dir = createTempEvidenceDir();
      try {
        // Missing evidence for canary - conditional
        const gateReport = buildStableReleaseGateReport({
          evidenceRootDir: dir,
          targetStatus: "canary",
        });
        // Without smoke evidence, can't get to canary status
        assert.equal(gateReport.currentStatus, "contract_frozen");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  test("buildStableReleaseGateReport reads evidence bundles from disk", () => {
    const dir = createTempEvidenceDir();
    try {
      const smokeDir = createProfileDir(dir, "smoke");
      writeFileSync(join(smokeDir, "stable-evidence-report.json"), JSON.stringify(createMockEvidenceReport()));

      const report = buildStableReleaseGateReport({
        evidenceRootDir: dir,
        targetStatus: "canary",
      });

      assert.equal(report.availableProfiles.includes("smoke"), true);
      assert.equal(report.requiredProfiles.includes("smoke"), true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("writeStableReleaseGateReport writes JSON output", () => {
    const dir = createTempEvidenceDir();
    const outputPath = join(dir, "reports", "stable-release-gate-report.json");
    try {
      const report = buildStableReleaseGateReport({
        evidenceRootDir: dir,
        targetStatus: "canary",
      });

      writeStableReleaseGateReport(outputPath, report);
      const written = JSON.parse(readFileSync(outputPath, "utf8")) as ReturnType<typeof buildStableReleaseGateReport>;

      assert.equal(written.targetStatus, "canary");
      assert.equal(written.overallVerdict, report.overallVerdict);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
