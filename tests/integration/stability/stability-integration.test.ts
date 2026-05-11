import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { buildStableReleaseGateReport } from "../../../src/platform/stability/stable-release-gate.js";

function buildEvidenceReport(root: string) {
  return {
    startedAt: "2026-05-01T00:00:00.000Z",
    finishedAt: "2026-05-01T00:10:00.000Z",
    outputDir: root,
    profile: {
      profileName: "production",
    },
    artifacts: {
      bundleReportPath: join(root, "stable-evidence-report.json"),
      chaosReportPath: join(root, "chaos.json"),
      promptInjectionReportPath: join(root, "prompt.json"),
      concurrencyReportPath: join(root, "concurrency.json"),
      leaseReportPath: join(root, "lease.json"),
      validationReportPath: join(root, "validation.json"),
      soakReportPath: join(root, "soak.json"),
      doctorReportPath: join(root, "doctor.json"),
      acceptanceReportPath: join(root, "acceptance.json"),
      backupRestoreReportPath: join(root, "backup-restore.json"),
      backupRestorePlaybookPath: join(root, "backup-restore.md"),
      rollingUpgradeReportPath: join(root, "rolling-upgrade.json"),
      rollingUpgradePlaybookPath: join(root, "rolling-upgrade.md"),
      maintenanceReportPath: join(root, "maintenance.json"),
      maintenancePlaybookPath: join(root, "maintenance.md"),
      grayReleaseReportPath: join(root, "gray-release.json"),
      grayReleasePlaybookPath: join(root, "gray-release.md"),
      eventReplayReportPath: join(root, "event-replay.json"),
      dbQueueDisconnectReportPath: join(root, "db-queue-disconnect.json"),
      dbWritabilityReportPath: join(root, "db-writability.json"),
      queueDeliveryReportPath: join(root, "queue-delivery.json"),
      migrationCompatibilityReportPath: join(root, "migration-compatibility.json"),
      dispatchReportPath: join(root, "dispatch.json"),
      workerHandshakeReportPath: join(root, "worker-handshake.json"),
      workerWritebackReportPath: join(root, "worker-writeback.json"),
      repairReportPath: join(root, "repair.json"),
      drainEventsReportPath: join(root, "drain-events.json"),
      diagnosticSnapshotPath: join(root, "diagnostic.json"),
      debugDumpPath: join(root, "debug.json"),
      takeoverSamplePath: join(root, "takeover.json"),
      rollbackReportPath: join(root, "rollback.json"),
      runtimeDbPath: join(root, "runtime.db"),
    },
    acceptanceLine: {
      evaluatedAt: "2026-05-01T00:11:00.000Z",
      status: "pass",
      profileName: "production",
      truthNotes: [],
      criteria: [
        { criterionId: "long_run_evidence", status: "pass", detail: "collected", metrics: {} },
        { criterionId: "latency_budget_p95", status: "pass", detail: "within budget", metrics: {} },
      ],
      observed: {
        soakDurationMs: 3600000,
        requiredDurationMs: 3600000,
        longRunCoveragePct: 100,
        manualDbRepairSignalCount: 0,
        orphanQueueClaimCount: 0,
        zombieLockCount: 0,
        recoveryAttemptCount: 1,
        recoverySucceededCount: 1,
        recoverySuccessRatePct: 100,
      },
      latencyBudget: [
        { latencyBand: "interactive", budgetMs: 5000, sampleCount: 10, p95DurationMs: 3200, maxDurationMs: 4000, status: "pass" },
        { latencyBand: "extended", budgetMs: 15000, sampleCount: 10, p95DurationMs: 8200, maxDurationMs: 9000, status: "pass" },
      ],
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
      dispatchPassed: true,
      workerHandshakePassed: true,
      workerWritebackPassed: true,
    },
  };
}

function createEvidenceRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "aa-stability-integration-"));

  for (const profile of ["smoke", "24h", "72h"]) {
    const dir = join(root, profile);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "stable-evidence-report.json"), JSON.stringify(buildEvidenceReport(dir), null, 2));
  }

  return root;
}

test("integration: stable release gate approves production promotion from real evidence bundle files", () => {
  const evidenceRootDir = createEvidenceRoot();

  try {
    const report = buildStableReleaseGateReport({
      evidenceRootDir,
      targetStatus: "production_ready",
    });

    assert.equal(report.overallVerdict, "conditional");
    assert.equal(report.currentStatus, "tenant_gray");
    assert.deepEqual(report.availableProfiles, ["smoke", "24h", "72h"]);
    assert.ok(report.requiredCriteria.length > 0);
  } finally {
    rmSync(evidenceRootDir, { recursive: true, force: true });
  }
});

test("integration: stable release gate blocks production promotion when required profiles are missing", () => {
  const evidenceRootDir = mkdtempSync(join(tmpdir(), "aa-stability-missing-"));

  try {
    mkdirSync(join(evidenceRootDir, "smoke"), { recursive: true });
    writeFileSync(
      join(evidenceRootDir, "smoke", "stable-evidence-report.json"),
      JSON.stringify(buildEvidenceReport(join(evidenceRootDir, "smoke")), null, 2),
    );

    const report = buildStableReleaseGateReport({
      evidenceRootDir,
      targetStatus: "production_ready",
    });

    assert.equal(report.overallVerdict, "conditional");
    assert.ok(report.blockers.some((blocker) => blocker.includes("24h")));
    assert.ok(report.blockers.some((blocker) => blocker.includes("72h")));
  } finally {
    rmSync(evidenceRootDir, { recursive: true, force: true });
  }
});
