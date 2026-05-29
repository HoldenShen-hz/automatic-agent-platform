import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { createStableEvidenceBundle } from "../../../../src/platform/shared/stability/stable-evidence-bundle.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

test("stable evidence bundle writes local artifacts and passes a short smoke profile", async () => {
  const workspace = createTempWorkspace("aa-evidence-");
  const outputDir = join(workspace, "stable-evidence");

  try {
    const report = await createStableEvidenceBundle({
      outputDir,
      profileName: "smoke",
      profileOverrides: {
        validationIterations: 1,
        soakDurationMs: 600,
        soakIntervalMs: 100,
        soakIterationsPerCycle: 1,
      },
    });

    assert.equal(report.summary.passed, true);
    assert.equal(report.summary.chaosPassed, true);
    assert.equal(report.summary.promptInjectionPassed, true);
    assert.equal(report.summary.concurrencyPassed, true);
    assert.equal(report.summary.leasePassed, true);
    assert.equal(report.summary.rollbackPassed, true);
    assert.equal(report.summary.backupRestorePassed, true);
    assert.equal(report.summary.rollingUpgradePassed, true);
    assert.equal(report.summary.maintenancePassed, true);
    assert.equal(report.summary.grayReleasePassed, true);
    assert.equal(report.summary.eventReplayPassed, true);
    assert.equal(report.summary.dbQueueDisconnectPassed, true);
    assert.equal(report.summary.dbWritabilityPassed, true);
    assert.equal(report.summary.queueDeliveryPassed, true);
    assert.equal(report.summary.migrationCompatibilityPassed, true);
    assert.equal(report.summary.validationPassed, true);
    assert.equal(report.summary.soakPassed, true);
    assert.equal(report.summary.doctorStatus, "ok");
    assert.equal(report.summary.repairAfterStatus, "pass");
    assert.equal(report.summary.pendingAckBacklogAfterDrain, 0);
    assert.equal(report.summary.takeoverSampleClosedLoop, true);
    assert.equal(report.summary.acceptanceLineStatus, "partial");
    assert.equal(report.acceptanceLine.status, "partial");
    assert.ok(report.summary.totalValidationRuns >= 2);
    assert.ok(report.summary.totalSoakRuns >= 2);
    assert.equal(report.summary.totalChaosScenarios, 5);
    assert.equal(report.summary.totalPromptInjectionScenarios, 5);
    assert.equal(report.summary.totalRollingUpgradeScenarios, 2);
    assert.equal(report.summary.totalMaintenanceScenarios, 2);
    assert.equal(report.summary.totalGrayReleaseScenarios, 2);
    assert.equal(report.summary.totalDbQueueDisconnectScenarios, 3);
    assert.equal(report.summary.totalDbWritabilityScenarios, 3);
    assert.equal(report.summary.totalQueueDeliveryScenarios, 2);
    assert.equal(report.summary.totalMigrationCompatibilityScenarios, 2);
    assert.equal(report.summary.totalRollbackScenarios, 2);
    assert.equal(report.summary.failedChaosScenarios, 0);
    assert.equal(report.summary.failedPromptInjectionScenarios, 0);
    assert.equal(report.summary.failedRollingUpgradeScenarios, 0);
    assert.equal(report.summary.failedMaintenanceScenarios, 0);
    assert.equal(report.summary.failedGrayReleaseScenarios, 0);
    assert.equal(report.summary.failedDbQueueDisconnectScenarios, 0);
    assert.equal(report.summary.failedDbWritabilityScenarios, 0);
    assert.equal(report.summary.failedQueueDeliveryScenarios, 0);
    assert.equal(report.summary.failedMigrationCompatibilityScenarios, 0);
    assert.equal(report.summary.failedRollbackScenarios, 0);

    assert.equal(existsSync(report.artifacts.bundleReportPath), true);
    assert.equal(existsSync(report.artifacts.chaosReportPath), true);
    assert.equal(existsSync(report.artifacts.promptInjectionReportPath), true);
    assert.equal(existsSync(report.artifacts.concurrencyReportPath), true);
    assert.equal(existsSync(report.artifacts.leaseReportPath), true);
    assert.equal(existsSync(report.artifacts.rollbackReportPath), true);
    assert.equal(existsSync(report.artifacts.backupRestoreReportPath), true);
    assert.equal(existsSync(report.artifacts.backupRestorePlaybookPath), true);
    assert.equal(existsSync(report.artifacts.rollingUpgradeReportPath), true);
    assert.equal(existsSync(report.artifacts.rollingUpgradePlaybookPath), true);
    assert.equal(existsSync(report.artifacts.maintenanceReportPath), true);
    assert.equal(existsSync(report.artifacts.maintenancePlaybookPath), true);
    assert.equal(existsSync(report.artifacts.grayReleaseReportPath), true);
    assert.equal(existsSync(report.artifacts.grayReleasePlaybookPath), true);
    assert.equal(existsSync(report.artifacts.eventReplayReportPath), true);
    assert.equal(existsSync(report.artifacts.dbQueueDisconnectReportPath), true);
    assert.equal(existsSync(report.artifacts.dbWritabilityReportPath), true);
    assert.equal(existsSync(report.artifacts.queueDeliveryReportPath), true);
    assert.equal(existsSync(report.artifacts.migrationCompatibilityReportPath), true);
    assert.equal(existsSync(report.artifacts.validationReportPath), true);
    assert.equal(existsSync(report.artifacts.soakReportPath), true);
    assert.equal(existsSync(report.artifacts.doctorReportPath), true);
    assert.equal(existsSync(report.artifacts.acceptanceReportPath), true);
    assert.equal(existsSync(report.artifacts.repairReportPath), true);
    assert.equal(existsSync(report.artifacts.diagnosticSnapshotPath), true);
    assert.equal(existsSync(report.artifacts.debugDumpPath), true);
    assert.equal(existsSync(report.artifacts.takeoverSamplePath), true);
    assert.equal(existsSync(report.artifacts.runtimeDbPath), true);

    const saved = JSON.parse(readFileSync(report.artifacts.bundleReportPath, "utf8")) as {
      summary: { passed: boolean };
      artifacts: {
        acceptanceReportPath: string;
        backupRestorePlaybookPath: string;
        rollingUpgradePlaybookPath: string;
        maintenancePlaybookPath: string;
        grayReleasePlaybookPath: string;
        dbQueueDisconnectReportPath: string;
        dbWritabilityReportPath: string;
        migrationCompatibilityReportPath: string;
      };
    };
    const doctorReport = JSON.parse(readFileSync(report.artifacts.doctorReportPath, "utf8")) as {
      versionSnapshot: {
        applicationVersion: string | null;
        configVersion: string;
        schemaVersion: { upToDate: boolean };
      };
    };
    assert.equal(saved.summary.passed, true);
    assert.equal(saved.artifacts.acceptanceReportPath, report.artifacts.acceptanceReportPath);
    assert.equal(saved.artifacts.backupRestorePlaybookPath, report.artifacts.backupRestorePlaybookPath);
    assert.equal(saved.artifacts.rollingUpgradePlaybookPath, report.artifacts.rollingUpgradePlaybookPath);
    assert.equal(saved.artifacts.maintenancePlaybookPath, report.artifacts.maintenancePlaybookPath);
    assert.equal(saved.artifacts.grayReleasePlaybookPath, report.artifacts.grayReleasePlaybookPath);
    assert.equal(saved.artifacts.dbQueueDisconnectReportPath, report.artifacts.dbQueueDisconnectReportPath);
    assert.equal(saved.artifacts.dbWritabilityReportPath, report.artifacts.dbWritabilityReportPath);
    assert.equal(saved.artifacts.migrationCompatibilityReportPath, report.artifacts.migrationCompatibilityReportPath);
    assert.equal(doctorReport.versionSnapshot.applicationVersion, "0.2.0");
    assert.equal(doctorReport.versionSnapshot.configVersion.length > 0, true);
    assert.equal(doctorReport.versionSnapshot.schemaVersion.upToDate, true);
  } finally {
    cleanupPath(workspace);
  }
});
