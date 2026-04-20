import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";
import { runBuiltCliExpectFailure } from "../../../helpers/cli.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

const repoRoot = fileURLToPath(new URL("../../../..", import.meta.url));

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

function runCli<T>(env: NodeJS.ProcessEnv): T {
  const stdout = execFileSync(process.execPath, [join(repoRoot, "dist", "src", "cli", "platform-operator.js")], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...env,
    },
    encoding: "utf8",
  });

  return JSON.parse(stdout) as T;
}

test("platform operator CLI summarizes and exports execution-plane promotion evidence", () => {
  const workspace = createTempWorkspace("aa-platform-operator-cli-");
  const dbPath = join(workspace, "platform-operator-cli.db");
  const evidenceRoot = join(workspace, "stable-evidence");
  const packageOutput = join(workspace, "platform-package");
  const artifactRoot = join(workspace, "operator-artifacts");
  const generatedAt = "2026-04-08T10:00:00.000Z";

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    writeSmokeEvidence(evidenceRoot);

    store.upsertEnvironmentReadinessRecord({
      readinessId: "provider-ready",
      environment: "prod",
      componentType: "provider",
      componentId: "default_provider",
      credentialReady: 1,
      secondaryGatesJson: JSON.stringify({}),
      owner: "ops.team",
      lastVerifiedAt: generatedAt,
      isActive: 1,
      notes: null,
    });
    store.upsertEnvironmentReadinessRecord({
      readinessId: "gateway-ready",
      environment: "prod",
      componentType: "gateway",
      componentId: "ops_gateway",
      credentialReady: 1,
      secondaryGatesJson: JSON.stringify({}),
      owner: "ops.team",
      lastVerifiedAt: generatedAt,
      isActive: 1,
      notes: null,
    });
    store.upsertEnvironmentReadinessRecord({
      readinessId: "sandbox-ready",
      environment: "prod",
      componentType: "sandbox",
      componentId: "strict_sandbox",
      credentialReady: 1,
      secondaryGatesJson: JSON.stringify({}),
      owner: "ops.team",
      lastVerifiedAt: generatedAt,
      isActive: 1,
      notes: null,
    });
    store.upsertEnvironmentReadinessRecord({
      readinessId: "worker-ready",
      environment: "prod",
      componentType: "worker_fleet",
      componentId: "default_worker_fleet",
      credentialReady: 1,
      secondaryGatesJson: JSON.stringify({}),
      owner: "ops.team",
      lastVerifiedAt: generatedAt,
      isActive: 1,
      notes: null,
    });
    store.upsertEnvironmentReadinessRecord({
      readinessId: "artifact-ready",
      environment: "prod",
      componentType: "artifact_store",
      componentId: "release_artifacts",
      credentialReady: 1,
      secondaryGatesJson: JSON.stringify({ artifact_namespace_ready: true }),
      owner: "ops.team",
      lastVerifiedAt: generatedAt,
      isActive: 1,
      notes: null,
    });
    store.upsertWorkerSnapshot({
      workerId: "worker-cli",
      status: "idle",
      placement: "local",
      isolationLevel: "strict",
      repoVersion: "git:def456",
      remoteSessionStatus: null,
      lastAcknowledgedStreamOffset: null,
      streamResumeSuccessRate: null,
      credentialRefreshSuccessRate: null,
      sessionConsistencyCheckStatus: null,
      sessionConsistencyCheckedAt: null,
      workspaceSyncStatus: null,
      workspaceSyncCheckedAt: null,
      saturation: 0.1,
      activeLeaseCount: 0,
      meanStartupLatencyMs: 300,
      sandboxSuccessRate: 1,
      repoCacheHitRate: 0.95,
      registrationVerifiedAt: null,
      registrationChallengeId: null,
      capabilitiesJson: JSON.stringify(["bash"]),
      runningExecutionsJson: JSON.stringify([]),
      maxConcurrency: 2,
      queueAffinity: "primary",
      runtimeInstanceId: "runtime-cli",
      restartedFromRuntimeInstanceId: null,
      restartGeneration: 0,
      cpuPct: 10,
      memoryMb: 64,
      toolBacklogCount: 0,
      currentStepId: null,
      lastProgressAt: generatedAt,
      lastHeartbeatAt: generatedAt,
      updatedAt: generatedAt,
    });
    db.close();

    const summary = runCli<{
      componentId: string;
      overallVerdict: string;
      executionPlane: { workerCounts: { total: number } };
    }>({
      AA_DB_PATH: dbPath,
      AA_ENVIRONMENT: "prod",
      AA_GENERATED_AT: generatedAt,
      AA_PLATFORM_EVIDENCE_ROOT: evidenceRoot,
      AA_PLATFORM_OUTPUT_DIR: packageOutput,
    });
    assert.equal(summary.componentId, "execution_plane");
    assert.equal(summary.overallVerdict, "promote_approved");
    assert.equal(summary.executionPlane.workerCounts.total, 1);

    const exported = runCli<{
      report: { componentId: string };
      jsonArtifact: { uri: string };
      markdownArtifact: { uri: string };
    }>({
      AA_DB_PATH: dbPath,
      AA_ENVIRONMENT: "prod",
      AA_GENERATED_AT: generatedAt,
      AA_PLATFORM_EVIDENCE_ROOT: evidenceRoot,
      AA_PLATFORM_OUTPUT_DIR: packageOutput,
      AA_PLATFORM_ARTIFACT_ROOT: artifactRoot,
      AA_PLATFORM_ACTION: "export",
    });
    assert.equal(exported.report.componentId, "execution_plane");
    assert.ok(exported.jsonArtifact.uri.includes("platform-operator"));
    assert.ok(exported.markdownArtifact.uri.endsWith(".md"));
  } finally {
    cleanupPath(workspace);
  }
});

test("platform operator CLI fail-closes when postgres storage execution is requested", () => {
  const failure = runBuiltCliExpectFailure("platform-operator.js", {
    AA_DB_PATH: "/tmp/platform-operator-postgres.db",
    AA_ENVIRONMENT: "prod",
    AA_PLATFORM_ACTION: "summary",
    AA_STORAGE_DRIVER: "postgres",
    AA_STORAGE_POSTGRES_DSN: "postgresql://prod-db.example.com/agent_os?sslmode=require",
  });

  assert.notEqual(failure.status, 0);
  assert.match(failure.stderr, /storage\.(cli_sync_shadow_sqlite_required|backend_driver_not_implemented:postgres|backend_config_invalid)/);
});
