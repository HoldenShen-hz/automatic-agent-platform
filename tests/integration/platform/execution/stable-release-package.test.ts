import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { createStableReleasePackage } from "../../../../src/platform/shared/stability/stable-release-package.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

function writeEvidenceReport(root: string, profile: string, summary: Record<string, unknown>): void {
  const dir = join(root, profile);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "stable-evidence-report.json"),
    JSON.stringify(
      {
        profile: { name: profile },
        artifacts: {
          chaosReportPath: join(dir, "chaos-report.json"),
          leaseReportPath: join(dir, "lease-report.json"),
          doctorReportPath: join(dir, "doctor-report.json"),
          acceptanceReportPath: join(dir, "stable-acceptance-line-report.json"),
          backupRestoreReportPath: join(dir, "backup-restore-report.json"),
          backupRestorePlaybookPath: join(dir, "stable-disaster-recovery-playbook.json"),
          rollingUpgradeReportPath: join(dir, "rolling-upgrade-report.json"),
          rollingUpgradePlaybookPath: join(dir, "stable-rolling-upgrade-playbook.json"),
          maintenanceReportPath: join(dir, "maintenance-report.json"),
          maintenancePlaybookPath: join(dir, "stable-maintenance-playbook.json"),
          grayReleaseReportPath: join(dir, "gray-release-report.json"),
          grayReleasePlaybookPath: join(dir, "stable-gray-release-playbook.json"),
          eventReplayReportPath: join(dir, "event-replay-report.json"),
          dbQueueDisconnectReportPath: join(dir, "db-queue-disconnect-report.json"),
          dbWritabilityReportPath: join(dir, "db-writability-report.json"),
          queueDeliveryReportPath: join(dir, "queue-delivery-report.json"),
          migrationCompatibilityReportPath: join(dir, "migration-compatibility-report.json"),
          repairReportPath: join(dir, "repair-report.json"),
          rollbackReportPath: join(dir, "rollback-report.json"),
          takeoverSamplePath: join(dir, "takeover-sample.json"),
        },
        acceptanceLine: {
          evaluatedAt: "2026-04-07T00:00:00.000Z",
          status: "partial",
          profileName: profile,
          truthNotes: ["long-run evidence is below 14 days"],
          criteria: [
            {
              criterionId: "long_run_evidence",
              status: "partial",
              detail: "long-run evidence below 14 days",
              metrics: {},
            },
          ],
          observed: {
            soakDurationMs: profile === "72h" ? 72 * 60 * 60 * 1000 : profile === "24h" ? 24 * 60 * 60 * 1000 : 5_000,
            requiredDurationMs: 14 * 24 * 60 * 60 * 1000,
            longRunCoveragePct: profile === "72h" ? 21.43 : profile === "24h" ? 7.14 : 0,
            manualDbRepairSignalCount: 0,
            orphanQueueClaimCount: 0,
            zombieLockCount: 0,
            recoveryAttemptCount: 0,
            recoverySucceededCount: 0,
            recoverySuccessRatePct: 100,
          },
          latencyBudget: [],
        },
        summary,
      },
      null,
      2,
    ),
  );
}

test("stable release package writes package, gate, and summary artifacts for canary approval", () => {
  const workspace = createTempWorkspace("aa-stable-package-");
  const evidenceRoot = join(workspace, "stable-evidence");
  const outputDir = join(workspace, "stable-package");

  try {
    writeEvidenceReport(evidenceRoot, "smoke", {
      passed: true,
      chaosPassed: true,
      leasePassed: true,
      concurrencyPassed: true,
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
      doctorStatus: "ok",
      repairAfterStatus: "pass",
      takeoverSampleClosedLoop: true,
    });

    const report = createStableReleasePackage({
      evidenceRootDir: evidenceRoot,
      outputDir,
      targetStatus: "canary",
    });
    const summaryMarkdown = readFileSync(report.artifacts.summaryMarkdownPath, "utf8");

    assert.equal(report.overallVerdict, "promote_approved");
    assert.equal(report.targetStatus, "canary");
    assert.equal(report.missingRequiredProfiles.length, 0);
    assert.equal(report.failingProfiles.length, 0);
    assert.equal(report.releaseChecklist.overallStatus, "pass");
    assert.equal(report.releaseChecklist.failedCount, 0);
    assert.equal(report.releaseChecklist.items.some((item) => item.itemId === "long_run_soak_complete" && item.status === "pass"), true);
    assert.equal(report.releaseChecklist.items.some((item) => item.itemId === "stable_acceptance_line_ready" && item.status === "pass"), true);
    assert.equal(report.releaseChecklist.items.some((item) => item.itemId === "tenant_gray_ready" && item.status === "pass"), true);
    assert.equal(report.releaseChecklist.items.some((item) => item.itemId === "disaster_recovery_ready" && item.status === "pass"), true);
    assert.equal(report.releaseChecklist.items.some((item) => item.itemId === "rolling_upgrade_ready" && item.status === "pass"), true);
    assert.equal(report.releaseChecklist.items.some((item) => item.itemId === "maintenance_handover_ready" && item.status === "pass"), true);
    assert.equal(report.releaseChecklist.items.some((item) => item.itemId === "db_writability_ready" && item.status === "pass"), true);
    assert.ok(report.nextActions.some((action) => action.includes("Proceed with the canary rollout")));
    assert.ok(report.recommendedCommands.some((command) => command === "npm run restore:stable"));
    assert.ok(report.recommendedCommands.some((command) => command === "npm run upgrade:stable"));
    assert.ok(report.recommendedCommands.some((command) => command === "npm run maintenance:stable"));
    assert.ok(report.recommendedCommands.some((command) => command === "npm run db-queue-disconnect:stable"));
    assert.ok(report.recommendedCommands.some((command) => command === "npm run db-writability:stable"));
    assert.ok(report.recommendedCommands.some((command) => command === "npm run migration:stable"));
    assert.ok(report.recommendedCommands.some((command) => command === "npm run gray:stable"));
    assert.equal(existsSync(report.artifacts.packageReportPath), true);
    assert.equal(existsSync(report.artifacts.gateReportPath), true);
    assert.equal(existsSync(report.artifacts.releaseChecklistPath), true);
    assert.equal(existsSync(report.artifacts.summaryMarkdownPath), true);
    assert.match(summaryMarkdown, /Overall verdict: `promote_approved`/);
    assert.match(summaryMarkdown, /Release Checklist/);
    assert.match(summaryMarkdown, /smoke/);
  } finally {
    cleanupPath(workspace);
  }
});

test("stable release package records missing long-run evidence for production readiness", () => {
  const workspace = createTempWorkspace("aa-stable-package-");
  const evidenceRoot = join(workspace, "stable-evidence");
  const outputDir = join(workspace, "stable-package");

  try {
    writeEvidenceReport(evidenceRoot, "smoke", {
      passed: true,
      chaosPassed: true,
      leasePassed: true,
      concurrencyPassed: true,
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
      doctorStatus: "ok",
      repairAfterStatus: "pass",
      takeoverSampleClosedLoop: true,
    });

    const report = createStableReleasePackage({
      evidenceRootDir: evidenceRoot,
      outputDir,
      targetStatus: "production_ready",
    });

    assert.equal(report.overallVerdict, "conditional");
    assert.deepEqual(report.missingRequiredProfiles, ["24h", "72h"]);
    assert.equal(report.releaseChecklist.overallStatus, "partial");
    assert.equal(report.releaseChecklist.items.some((item) => item.itemId === "long_run_soak_complete" && item.status === "partial"), true);
    assert.equal(report.releaseChecklist.items.some((item) => item.itemId === "stable_acceptance_line_ready" && item.status === "partial"), true);
    assert.equal(report.releaseChecklist.items.some((item) => item.itemId === "tenant_gray_ready" && item.status === "pass"), true);
    assert.ok(report.nextActions.some((action) => action.includes("24h")));
    assert.ok(report.nextActions.some((action) => action.includes("72h")));
    assert.ok(report.nextActions.some((action) => action.includes("14-day soak window")));
    assert.ok(report.recommendedCommands.some((command) => command.includes("AA_STABLE_CAMPAIGN_PROFILE=24h")));
    assert.ok(report.recommendedCommands.some((command) => command.includes("AA_STABLE_CAMPAIGN_PROFILE=72h")));
  } finally {
    cleanupPath(workspace);
  }
});

test("stable release package keeps disaster recovery checklist partial when the playbook reference is missing", () => {
  const workspace = createTempWorkspace("aa-stable-package-");
  const evidenceRoot = join(workspace, "stable-evidence");
  const outputDir = join(workspace, "stable-package");
  const dir = join(evidenceRoot, "smoke");
  mkdirSync(dir, { recursive: true });

  try {
    writeFileSync(
      join(dir, "stable-evidence-report.json"),
      JSON.stringify(
        {
          profile: { name: "smoke" },
          artifacts: {
            chaosReportPath: join(dir, "chaos-report.json"),
            leaseReportPath: join(dir, "lease-report.json"),
            doctorReportPath: join(dir, "doctor-report.json"),
            acceptanceReportPath: join(dir, "stable-acceptance-line-report.json"),
            backupRestoreReportPath: join(dir, "backup-restore-report.json"),
            rollingUpgradeReportPath: join(dir, "rolling-upgrade-report.json"),
            rollingUpgradePlaybookPath: join(dir, "stable-rolling-upgrade-playbook.json"),
            maintenanceReportPath: join(dir, "maintenance-report.json"),
            maintenancePlaybookPath: join(dir, "stable-maintenance-playbook.json"),
            grayReleaseReportPath: join(dir, "gray-release-report.json"),
            grayReleasePlaybookPath: join(dir, "stable-gray-release-playbook.json"),
            eventReplayReportPath: join(dir, "event-replay-report.json"),
            dbQueueDisconnectReportPath: join(dir, "db-queue-disconnect-report.json"),
            dbWritabilityReportPath: join(dir, "db-writability-report.json"),
            queueDeliveryReportPath: join(dir, "queue-delivery-report.json"),
            migrationCompatibilityReportPath: join(dir, "migration-compatibility-report.json"),
            repairReportPath: join(dir, "repair-report.json"),
            rollbackReportPath: join(dir, "rollback-report.json"),
            takeoverSamplePath: join(dir, "takeover-sample.json"),
          },
          acceptanceLine: {
            evaluatedAt: "2026-04-07T00:00:00.000Z",
            status: "partial",
            profileName: "smoke",
            truthNotes: ["long-run evidence is below 14 days"],
            criteria: [
              {
                criterionId: "long_run_evidence",
                status: "partial",
                detail: "long-run evidence below 14 days",
                metrics: {},
              },
            ],
            observed: {
              soakDurationMs: 5_000,
              requiredDurationMs: 14 * 24 * 60 * 60 * 1000,
              longRunCoveragePct: 0,
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
            leasePassed: true,
            concurrencyPassed: true,
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
            doctorStatus: "ok",
            repairAfterStatus: "pass",
            takeoverSampleClosedLoop: true,
          },
        },
        null,
        2,
      ),
    );

    const report = createStableReleasePackage({
      evidenceRootDir: evidenceRoot,
      outputDir,
      targetStatus: "canary",
    });

    assert.equal(report.overallVerdict, "promote_approved");
    assert.equal(report.releaseChecklist.overallStatus, "partial");
    assert.equal(
      report.releaseChecklist.items.some((item) => item.itemId === "disaster_recovery_ready" && item.status === "partial"),
      true,
    );
    assert.ok(report.nextActions.some((action) => action.includes("stable restore rehearsal")));
  } finally {
    cleanupPath(workspace);
  }
});

test("stable release package writes tenant-gray package artifacts when gray rollout evidence is available", () => {
  const workspace = createTempWorkspace("aa-stable-package-");
  const evidenceRoot = join(workspace, "stable-evidence");
  const outputDir = join(workspace, "stable-package");

  try {
    writeEvidenceReport(evidenceRoot, "smoke", {
      passed: true,
      chaosPassed: true,
      leasePassed: true,
      concurrencyPassed: true,
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
      doctorStatus: "ok",
      repairAfterStatus: "pass",
      takeoverSampleClosedLoop: true,
    });

    const report = createStableReleasePackage({
      evidenceRootDir: evidenceRoot,
      outputDir,
      targetStatus: "tenant_gray",
    });

    assert.equal(report.overallVerdict, "promote_approved");
    assert.equal(report.targetStatus, "tenant_gray");
    assert.equal(report.releaseChecklist.items.some((item) => item.itemId === "tenant_gray_ready" && item.status === "pass"), true);
    assert.ok(report.nextActions.some((action) => action.includes("tenant_gray rollout")));
    assert.ok(report.recommendedCommands.some((command) => command === "AA_STABLE_GATE_TARGET_STATUS=tenant_gray npm run gate:stable"));
  } finally {
    cleanupPath(workspace);
  }
});
