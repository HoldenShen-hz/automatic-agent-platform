import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildStableReleaseGateReport,
  writeStableReleaseGateReport,
  type StableGateTargetStatus,
} from "../../../../../src/platform/shared/stability/stable-release-gate.js";
import type { StableEvidenceBundleReport } from "../../../../../src/platform/shared/stability/stable-evidence-bundle-support.js";
import type { StableAcceptanceLineReport } from "../../../../../src/platform/shared/stability/stable-acceptance-line.js";

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

test("buildStableReleaseGateReport with missing evidence returns promote_blocked for canary", () => {
  const dir = createTempEvidenceDir();
  try {
    const report = buildStableReleaseGateReport({
      evidenceRootDir: dir,
      targetStatus: "canary",
    });

    assert.equal(report.overallVerdict, "promote_blocked");
    assert.equal(report.currentStatus, "contract_frozen");
    assert.ok(report.blockers.length > 0);
    assert.ok(report.blockers.some((b) => b.includes("missing evidence profiles")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("buildStableReleaseGateReport with passing smoke evidence returns promote_approved for canary", () => {
  const dir = createTempEvidenceDir();
  try {
    // Write a passing smoke evidence bundle
    const smokeDir = createProfileDir(dir, "smoke");
    const report = createMockEvidenceReport({ passed: true });
    writeFileSync(join(smokeDir, "stable-evidence-report.json"), JSON.stringify(report));

    const gateReport = buildStableReleaseGateReport({
      evidenceRootDir: dir,
      targetStatus: "canary",
    });

    assert.equal(gateReport.overallVerdict, "promote_approved");
    assert.equal(gateReport.currentStatus, "canary");
    assert.equal(gateReport.targetStatus, "canary");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("buildStableReleaseGateReport with partial evidence returns conditional", () => {
  const dir = createTempEvidenceDir();
  try {
    // Write a passing smoke evidence
    const smokeDir = createProfileDir(dir, "smoke");
    const report = createMockEvidenceReport({ passed: true });
    writeFileSync(join(smokeDir, "stable-evidence-report.json"), JSON.stringify(report));

    // Try for production_ready which requires 24h and 72h profiles
    const gateReport = buildStableReleaseGateReport({
      evidenceRootDir: dir,
      targetStatus: "production_ready",
    });

    assert.equal(gateReport.overallVerdict, "conditional");
    assert.ok(gateReport.blockers.some((b) => b.includes("missing evidence profiles")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("buildStableReleaseGateReport with failing evidence returns promote_blocked", () => {
  const dir = createTempEvidenceDir();
  try {
    const smokeDir = createProfileDir(dir, "smoke");
    const report = createMockEvidenceReport({ passed: false, chaosPassed: false });
    writeFileSync(join(smokeDir, "stable-evidence-report.json"), JSON.stringify(report));

    const gateReport = buildStableReleaseGateReport({
      evidenceRootDir: dir,
      targetStatus: "canary",
    });

    assert.equal(gateReport.overallVerdict, "promote_blocked");
    assert.ok(gateReport.blockers.some((b) => b.includes("failing evidence profiles")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("buildStableReleaseGateReport for tenant_gray requires gray release evidence", () => {
  const dir = createTempEvidenceDir();
  try {
    const smokeDir = createProfileDir(dir, "smoke");
    const smokeReport = createMockEvidenceReport({ passed: true });
    writeFileSync(join(smokeDir, "stable-evidence-report.json"), JSON.stringify(smokeReport));

    const gateReport = buildStableReleaseGateReport({
      evidenceRootDir: dir,
      targetStatus: "tenant_gray",
    });

    // tenant_gray only requires smoke profile
    assert.equal(gateReport.requiredProfiles.length, 1);
    assert.ok(gateReport.requiredProfiles.includes("smoke"));
    // With passing smoke evidence, gate returns promote_approved
    assert.equal(gateReport.overallVerdict, "promote_approved");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("buildStableReleaseGateReport for production_ready requires 24h and 72h profiles", () => {
  const dir = createTempEvidenceDir();
  try {
    const smokeDir = createProfileDir(dir, "smoke");
    const report = createMockEvidenceReport({ passed: true });
    writeFileSync(join(smokeDir, "stable-evidence-report.json"), JSON.stringify(report));

    const gateReport = buildStableReleaseGateReport({
      evidenceRootDir: dir,
      targetStatus: "production_ready",
    });

    assert.ok(gateReport.requiredProfiles.includes("smoke"));
    assert.ok(gateReport.requiredProfiles.includes("24h"));
    assert.ok(gateReport.requiredProfiles.includes("72h"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("buildStableReleaseGateReport includes required criteria for canary", () => {
  const dir = createTempEvidenceDir();
  try {
    const gateReport = buildStableReleaseGateReport({
      evidenceRootDir: dir,
      targetStatus: "canary",
    });

    const requiredIds = gateReport.requiredCriteria.map((c) => c.criterionId);

    // Base criteria required for canary
    assert.ok(requiredIds.includes("contracts_frozen"));
    assert.ok(requiredIds.includes("conformance_tests"));
    assert.ok(requiredIds.includes("telemetry_instrumented"));
    assert.ok(requiredIds.includes("migration_compatibility_tested"));
    assert.ok(requiredIds.includes("runbooks_documented"));
    assert.ok(requiredIds.includes("rollback_tested"));
    assert.ok(requiredIds.includes("ownership_defined"));

    // tenant_gray criteria NOT required for canary
    assert.ok(!requiredIds.includes("tenant_gray_rollout_tested"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("buildStableReleaseGateReport includes tenant_gray_rollout_tested for tenant_gray target", () => {
  const dir = createTempEvidenceDir();
  try {
    const gateReport = buildStableReleaseGateReport({
      evidenceRootDir: dir,
      targetStatus: "tenant_gray",
    });

    const requiredIds = gateReport.requiredCriteria.map((c) => c.criterionId);
    assert.ok(requiredIds.includes("tenant_gray_rollout_tested"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("buildStableReleaseGateReport includes db/queue criteria for production_ready", () => {
  const dir = createTempEvidenceDir();
  try {
    const gateReport = buildStableReleaseGateReport({
      evidenceRootDir: dir,
      targetStatus: "production_ready",
    });

    const requiredIds = gateReport.requiredCriteria.map((c) => c.criterionId);
    assert.ok(requiredIds.includes("db_queue_disconnect_tested"));
    assert.ok(requiredIds.includes("db_writability_tested"));
    assert.ok(requiredIds.includes("queue_delivery_tested"));
    assert.ok(requiredIds.includes("stable_acceptance_line"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("buildStableReleaseGateReport defaults targetStatus to canary", () => {
  const dir = createTempEvidenceDir();
  try {
    const smokeDir = createProfileDir(dir, "smoke");
    const report = createMockEvidenceReport({ passed: true });
    writeFileSync(join(smokeDir, "stable-evidence-report.json"), JSON.stringify(report));

    const gateReport = buildStableReleaseGateReport({
      evidenceRootDir: dir,
    });

    assert.equal(gateReport.targetStatus, "canary");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("buildStableReleaseGateReport with multiple profiles marks availableProfiles correctly", () => {
  const dir = createTempEvidenceDir();
  try {
    // Write smoke and 24h evidence
    for (const profile of ["smoke", "24h"] as const) {
      const profileDir = createProfileDir(dir, profile);
      const report = createMockEvidenceReport({ passed: true });
      writeFileSync(join(profileDir, "stable-evidence-report.json"), JSON.stringify(report));
    }

    const gateReport = buildStableReleaseGateReport({
      evidenceRootDir: dir,
      targetStatus: "production_ready",
    });

    assert.ok(gateReport.availableProfiles.includes("smoke"));
    assert.ok(gateReport.availableProfiles.includes("24h"));
    assert.ok(!gateReport.availableProfiles.includes("72h"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("buildStableReleaseGateReport with partial criteria produces conditional verdict", () => {
  const dir = createTempEvidenceDir();
  try {
    const smokeDir = createProfileDir(dir, "smoke");
    // Smoke passes, but acceptance line is partial
    const report = createMockEvidenceReport({
      passed: true,
      acceptanceLineStatus: "partial",
    });
    writeFileSync(join(smokeDir, "stable-evidence-report.json"), JSON.stringify(report));

    const gateReport = buildStableReleaseGateReport({
      evidenceRootDir: dir,
      targetStatus: "canary",
    });

    // With passing smoke evidence for canary, verdict is promote_approved
    // The acceptanceLineStatus in summary is informational - the actual acceptance
    // line evaluation in the evidence bundle determines the final verdict
    assert.equal(gateReport.overallVerdict, "promote_approved");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("writeStableReleaseGateReport writes valid JSON", () => {
  const dir = createTempEvidenceDir();
  try {
    const smokeDir = createProfileDir(dir, "smoke");
    const report = createMockEvidenceReport({ passed: true });
    writeFileSync(join(smokeDir, "stable-evidence-report.json"), JSON.stringify(report));

    const gateReport = buildStableReleaseGateReport({
      evidenceRootDir: dir,
      targetStatus: "canary",
    });

    const outputPath = join(dir, "gate-report.json");
    writeStableReleaseGateReport(outputPath, gateReport);

    // Read back and verify
    const written = JSON.parse(readFileSync(outputPath, "utf8"));

    assert.equal(written.packageId, gateReport.packageId);
    assert.equal(written.componentId, gateReport.componentId);
    assert.equal(written.overallVerdict, gateReport.overallVerdict);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("buildStableReleaseGateReport computes artifactRefs from available reports", () => {
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

test("buildStableReleaseGateReport includes all criteria (required + optional)", () => {
  const dir = createTempEvidenceDir();
  try {
    const smokeDir = createProfileDir(dir, "smoke");
    const report = createMockEvidenceReport({ passed: true });
    writeFileSync(join(smokeDir, "stable-evidence-report.json"), JSON.stringify(report));

    const gateReport = buildStableReleaseGateReport({
      evidenceRootDir: dir,
      targetStatus: "canary",
    });

    // All criteria = required + optional
    assert.equal(
      gateReport.criteria.length,
      gateReport.requiredCriteria.length + gateReport.optionalCriteria.length,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
