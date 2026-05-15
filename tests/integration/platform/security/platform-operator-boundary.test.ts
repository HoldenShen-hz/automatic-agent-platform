import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { PlatformOperatorService } from "../../../../src/scale-ecosystem/marketplace/platform-operator-service.js";
import { createWorkspaceWritePolicy } from "../../../../src/platform/five-plane-control-plane/iam/sandbox-policy.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

function writeSmokeEvidence(root: string): void {
  const dir = join(root, "smoke");
  mkdirSync(dir, { recursive: true });
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
          evaluatedAt: "2026-04-08T00:00:00.000Z",
          status: "pass",
          profileName: "smoke",
          truthNotes: [],
          criteria: [],
          observed: {
            soakDurationMs: 5_000,
            requiredDurationMs: 5_000,
            longRunCoveragePct: 100,
            manualDbRepairSignalCount: 0,
            orphanQueueClaimCount: 0,
            zombieLockCount: 0,
            recoveryAttemptCount: 1,
            recoverySucceededCount: 1,
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
}

test("platform operator export fail-closes when artifact root is outside the allowed sandbox workspace", () => {
  const workspace = createTempWorkspace("aa-platform-operator-security-");
  const dbPath = join(workspace, "platform-operator-security.db");
  const evidenceRoot = join(workspace, "stable-evidence");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const outsideRoot = createTempWorkspace("aa-platform-operator-outside-");
  const service = new PlatformOperatorService(db, store, {
    artifactStoreOptions: {
      rootDir: join(outsideRoot, "artifacts"),
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
    },
  });

  try {
    writeSmokeEvidence(evidenceRoot);
    assert.throws(
      () =>
        service.exportReport({
          environment: "prod",
          evidenceRootDir: evidenceRoot,
          packageOutputDir: join(workspace, "platform-package"),
          targetStatus: "canary",
          generatedAt: "2026-04-08T10:00:00.000Z",
        }),
      /sandbox\.path_outside_allowed_roots/,
    );
  } finally {
    db.close();
    cleanupPath(workspace);
    cleanupPath(outsideRoot);
  }
});
