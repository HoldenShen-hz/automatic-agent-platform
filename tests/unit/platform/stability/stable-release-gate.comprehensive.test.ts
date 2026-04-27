import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildStableReleaseGateReport,
  writeStableReleaseGateReport,
  type StableGateTargetStatus,
  type StableGateVerdict,
  type StableGateCriterion,
  type StableReleaseGateReport,
} from "../../../../src/platform/stability/stable-release-gate.js";
import type { StableEvidenceBundleReport } from "../../../../src/platform/stability/stable-evidence-bundle-support.js";
import type { StableAcceptanceLineReport } from "../../../../src/platform/stability/stable-acceptance-line.js";

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
    acceptanceLine: createMockAcceptanceLineReport("pass"),
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

function createTempEvidenceDir(): string {
  return mkdtempSync(join(tmpdir(), "stable-gate-comp-test-"));
}

function createProfileDir(baseDir: string, profile: string): string {
  const profileDir = join(baseDir, profile);
  mkdirSync(profileDir, { recursive: true });
  return profileDir;
}

describe("stable-release-gate comprehensive", () => {
  describe("requiredProfiles", () => {
    test("returns smoke for canary target", () => {
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

    test("returns smoke for tenant_gray target", () => {
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

    test("returns smoke, 24h, 72h for production_ready target", () => {
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

  describe("requiredCriteria by target status", () => {
    test("canary has only base criteria", () => {
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
        assert.ok(!ids.includes("db_writability_tested"));
        assert.ok(!ids.includes("queue_delivery_tested"));
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
        assert.ok(!ids.includes("db_queue_disconnect_tested"));
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

  describe("currentStatus derivation", () => {
    test("returns contract_frozen when blocked with no evidence", () => {
      const dir = createTempEvidenceDir();
      try {
        const report = buildStableReleaseGateReport({
          evidenceRootDir: dir,
          targetStatus: "production_ready",
        });
        assert.equal(report.currentStatus, "contract_frozen");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    test("returns contract_frozen when no smoke report available", () => {
      const dir = createTempEvidenceDir();
      try {
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

    test("returns target status when approved with passing smoke", () => {
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

    test("returns canary when smoke passes but missing required profiles for production", () => {
      const dir = createTempEvidenceDir();
      try {
        const smokeDir = createProfileDir(dir, "smoke");
        // Set grayReleasePassed: false so the gray criterion fails
        const report = createMockEvidenceReport({ passed: true, grayReleasePassed: false });
        writeFileSync(join(smokeDir, "stable-evidence-report.json"), JSON.stringify(report));

        const gateReport = buildStableReleaseGateReport({
          evidenceRootDir: dir,
          targetStatus: "production_ready",
        });
        assert.equal(gateReport.currentStatus, "canary");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    test("returns canary when criteria are partial", () => {
      const dir = createTempEvidenceDir();
      try {
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
        assert.notEqual(gateReport.currentStatus, "tenant_gray");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe("overallVerdict", () => {
    test("returns promote_blocked when no smoke evidence", () => {
      const dir = createTempEvidenceDir();
      try {
        const report = buildStableReleaseGateReport({
          evidenceRootDir: dir,
          targetStatus: "canary",
        });
        assert.equal(report.overallVerdict, "promote_blocked");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    test("returns promote_blocked when required criteria fail", () => {
      const dir = createTempEvidenceDir();
      try {
        const smokeDir = createProfileDir(dir, "smoke");
        const report = createMockEvidenceReport({ passed: false });
        writeFileSync(join(smokeDir, "stable-evidence-report.json"), JSON.stringify(report));

        const gateReport = buildStableReleaseGateReport({
          evidenceRootDir: dir,
          targetStatus: "canary",
        });
        assert.equal(gateReport.overallVerdict, "promote_blocked");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    test("returns conditional when evidence is partial", () => {
      const dir = createTempEvidenceDir();
      try {
        const smokeDir = createProfileDir(dir, "smoke");
        const report = createMockEvidenceReport({ passed: true });
        writeFileSync(join(smokeDir, "stable-evidence-report.json"), JSON.stringify(report));

        const gateReport = buildStableReleaseGateReport({
          evidenceRootDir: dir,
          targetStatus: "production_ready",
        });
        assert.equal(gateReport.overallVerdict, "conditional");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    test("returns promote_approved when all required criteria pass", () => {
      const dir = createTempEvidenceDir();
      try {
        const smokeDir = createProfileDir(dir, "smoke");
        const report = createMockEvidenceReport({ passed: true });
        writeFileSync(join(smokeDir, "stable-evidence-report.json"), JSON.stringify(report));

        const gateReport = buildStableReleaseGateReport({
          evidenceRootDir: dir,
          targetStatus: "canary",
        });
        assert.equal(gateReport.overallVerdict, "promote_approved");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe("blockers", () => {
    test("contains missing profiles when profiles are absent", () => {
      const dir = createTempEvidenceDir();
      try {
        const report = buildStableReleaseGateReport({
          evidenceRootDir: dir,
          targetStatus: "production_ready",
        });
        assert.ok(report.blockers.some((b) => b.includes("missing evidence profiles")));
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    test("contains failing profiles when evidence bundles fail", () => {
      const dir = createTempEvidenceDir();
      try {
        const smokeDir = createProfileDir(dir, "smoke");
        const report = createMockEvidenceReport({ passed: false });
        writeFileSync(join(smokeDir, "stable-evidence-report.json"), JSON.stringify(report));

        const gateReport = buildStableReleaseGateReport({
          evidenceRootDir: dir,
          targetStatus: "canary",
        });
        assert.ok(gateReport.blockers.some((b) => b.includes("failing evidence profiles")));
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    test("is empty when all evidence passes", () => {
      const dir = createTempEvidenceDir();
      try {
        const smokeDir = createProfileDir(dir, "smoke");
        const report = createMockEvidenceReport({ passed: true });
        writeFileSync(join(smokeDir, "stable-evidence-report.json"), JSON.stringify(report));

        const gateReport = buildStableReleaseGateReport({
          evidenceRootDir: dir,
          targetStatus: "canary",
        });
        assert.equal(gateReport.blockers.length, 0);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe("criteria structure and content", () => {
    test("has all required criterion IDs defined", () => {
      const dir = createTempEvidenceDir();
      try {
        const report = buildStableReleaseGateReport({
          evidenceRootDir: dir,
          targetStatus: "canary",
        });

        const expectedIds: StableGateCriterion["criterionId"][] = [
          "contracts_frozen",
          "conformance_tests",
          "chaos_drill_results",
          "concurrency_locking_tested",
          "lease_fencing_tested",
          "telemetry_instrumented",
          "backup_restore_tested",
          "rolling_upgrade_tested",
          "maintenance_drain_tested",
          "tenant_gray_rollout_tested",
          "event_replay_tested",
          "db_queue_disconnect_tested",
          "db_writability_tested",
          "queue_delivery_tested",
          "migration_compatibility_tested",
          "stable_acceptance_line",
          "runbooks_documented",
          "rollback_tested",
          "ownership_defined",
        ];

        for (const id of expectedIds) {
          assert.ok(report.criteria.some((c) => c.criterionId === id), `Missing criterion: ${id}`);
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    test("each criterion has status, detail, and evidenceRefs", () => {
      const dir = createTempEvidenceDir();
      try {
        const report = buildStableReleaseGateReport({
          evidenceRootDir: dir,
          targetStatus: "canary",
        });

        for (const criterion of report.criteria) {
          assert.ok(["pass", "partial", "fail"].includes(criterion.status));
          assert.ok(typeof criterion.detail === "string");
          assert.ok(Array.isArray(criterion.evidenceRefs));
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    test("requiredCriteria is subset of all criteria", () => {
      const dir = createTempEvidenceDir();
      try {
        const report = buildStableReleaseGateReport({
          evidenceRootDir: dir,
          targetStatus: "canary",
        });

        for (const required of report.requiredCriteria) {
          assert.ok(report.criteria.some((c) => c.criterionId === required.criterionId));
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    test("optionalCriteria does not overlap with requiredCriteria", () => {
      const dir = createTempEvidenceDir();
      try {
        const report = buildStableReleaseGateReport({
          evidenceRootDir: dir,
          targetStatus: "canary",
        });

        const requiredIds = new Set(report.requiredCriteria.map((c) => c.criterionId));
        for (const optional of report.optionalCriteria) {
          assert.ok(!requiredIds.has(optional.criterionId));
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe("artifactRefs", () => {
    test("includes paths to evidence bundles when present", () => {
      const dir = createTempEvidenceDir();
      try {
        const smokeDir = createProfileDir(dir, "smoke");
        const report = createMockEvidenceReport({ passed: true });
        writeFileSync(join(smokeDir, "stable-evidence-report.json"), JSON.stringify(report));

        const gateReport = buildStableReleaseGateReport({
          evidenceRootDir: dir,
          targetStatus: "canary",
        });

        assert.ok(gateReport.artifactRefs.length > 0);
        assert.ok(gateReport.artifactRefs.some((ref) => ref.includes("stable-evidence-report.json")));
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    test("is empty when no evidence bundles exist", () => {
      const dir = createTempEvidenceDir();
      try {
        const gateReport = buildStableReleaseGateReport({
          evidenceRootDir: dir,
          targetStatus: "canary",
        });

        assert.equal(gateReport.artifactRefs.length, 0);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe("writeStableReleaseGateReport", () => {
    test("writes JSON file with correct content", () => {
      const dir = createTempEvidenceDir();
      const outputPath = join(dir, "reports", "stable-release-gate-report.json");
      try {
        const report = buildStableReleaseGateReport({
          evidenceRootDir: dir,
          targetStatus: "canary",
        });

        writeStableReleaseGateReport(outputPath, report);

        assert.ok(existsSync(outputPath));
        const written = JSON.parse(readFileSync(outputPath, "utf8")) as StableReleaseGateReport;

        assert.equal(written.targetStatus, "canary");
        assert.equal(written.overallVerdict, report.overallVerdict);
        assert.equal(written.packageId, report.packageId);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe("gate report complete structure", () => {
    test("has all required fields", () => {
      const dir = createTempEvidenceDir();
      try {
        const report = buildStableReleaseGateReport({
          evidenceRootDir: dir,
          targetStatus: "canary",
        });

        assert.ok(report.packageId.length > 0);
        assert.equal(report.componentId, "stable_core");
        assert.ok(["contract_frozen", "canary", "tenant_gray", "production_ready"].includes(report.currentStatus));
        assert.ok(["canary", "tenant_gray", "production_ready"].includes(report.targetStatus));
        assert.ok(["promote_approved", "conditional", "promote_blocked"].includes(report.overallVerdict));
        assert.ok(report.checkedAt.length > 0);
        assert.ok(Array.isArray(report.requiredProfiles));
        assert.ok(Array.isArray(report.availableProfiles));
        assert.ok(Array.isArray(report.requiredCriteria));
        assert.ok(Array.isArray(report.optionalCriteria));
        assert.ok(Array.isArray(report.criteria));
        assert.ok(Array.isArray(report.blockers));
        assert.ok(Array.isArray(report.artifactRefs));
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});
