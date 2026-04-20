import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { PlatformOperatorService } from "../../../../src/scale-ecosystem/marketplace/platform-operator-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "platform-operator.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const service = new PlatformOperatorService(db, store, {
    artifactStoreOptions: {
      rootDir: join(workspace, "artifacts"),
    },
  });
  return { workspace, db, store, service };
}

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
            recoveryAttemptCount: 4,
            recoverySucceededCount: 4,
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

test("platform operator service builds an execution-plane summary with readiness and evidence verdicts", () => {
  const harness = createHarness("aa-platform-operator-unit-");
  const generatedAt = "2026-04-08T10:00:00.000Z";
  try {
    writeSmokeEvidence(join(harness.workspace, "stable-evidence"));
    const createdAt = nowIso();

    harness.store.upsertOrganizationRecord({
      organizationId: "org-platform",
      displayName: "Platform Org",
      billingAccountId: null,
      defaultTenantId: null,
      createdAt,
      updatedAt: createdAt,
    });
    harness.store.upsertWorkspaceRecord({
      workspaceId: "ws-platform",
      ownerId: "user-platform",
      displayName: "Platform Workspace",
      planId: "enterprise",
      defaultPolicySet: "workspace_default",
      organizationId: "org-platform",
      createdAt,
      updatedAt: createdAt,
    });
    harness.store.upsertTenantRecord({
      tenantId: "tenant-platform",
      organizationId: "org-platform",
      storageScope: "tenant.storage",
      identityScope: "tenant.identity",
      policyScope: "tenant.policy",
      artifactScope: "tenant.artifact",
      isolationMode: "shared_hard_scoped",
      deploymentMode: "private_cloud",
      createdAt,
      updatedAt: createdAt,
    });
    harness.store.upsertDeploymentBindingRecord({
      bindingId: "binding-platform",
      tenantId: "tenant-platform",
      environmentId: "prod",
      deploymentMode: "private_cloud",
      region: "cn-shanghai-1",
      networkBoundary: "private-vpc",
      createdAt,
      updatedAt: createdAt,
    });
    harness.store.upsertDataNamespaceRecord({
      namespaceId: "ns-platform",
      plane: "analytics",
      tenantId: "tenant-platform",
      organizationId: "org-platform",
      workspaceId: "ws-platform",
      retentionPolicy: "archive_365d",
      encryptionPolicy: "kms:tenant-platform",
      residencyPolicy: "cn-mainland",
      createdAt,
      updatedAt: createdAt,
    });

    for (const [componentType, componentId] of [
      ["provider", "default_provider"],
      ["gateway", "ops_gateway"],
      ["sandbox", "strict_sandbox"],
      ["worker_fleet", "default_worker_fleet"],
      ["artifact_store", "release_artifacts"],
    ] as const) {
      harness.store.upsertEnvironmentReadinessRecord({
        readinessId: `${componentType}-ready`,
        environment: "prod",
        componentType,
        componentId,
        credentialReady: 1,
        secondaryGatesJson: JSON.stringify({}),
        owner: "ops.team",
        lastVerifiedAt: generatedAt,
        isActive: 1,
        notes: null,
      });
    }

    harness.store.upsertWorkerSnapshot({
      workerId: "worker-1",
      status: "idle",
      placement: "local",
      isolationLevel: "strict",
      repoVersion: "git:abc123",
      remoteSessionStatus: null,
      lastAcknowledgedStreamOffset: null,
      streamResumeSuccessRate: null,
      credentialRefreshSuccessRate: null,
      sessionConsistencyCheckStatus: null,
      sessionConsistencyCheckedAt: null,
      workspaceSyncStatus: null,
      workspaceSyncCheckedAt: null,
      saturation: 0.2,
      activeLeaseCount: 1,
      meanStartupLatencyMs: 400,
      sandboxSuccessRate: 1,
      repoCacheHitRate: 0.9,
      registrationVerifiedAt: null,
      registrationChallengeId: null,
      capabilitiesJson: JSON.stringify(["bash", "write"]),
      runningExecutionsJson: JSON.stringify(["exec-1"]),
      maxConcurrency: 3,
      queueAffinity: "primary",
      runtimeInstanceId: "runtime-1",
      restartedFromRuntimeInstanceId: null,
      restartGeneration: 0,
      cpuPct: 25,
      memoryMb: 128,
      toolBacklogCount: 0,
      currentStepId: "step-1",
      lastProgressAt: generatedAt,
      lastHeartbeatAt: generatedAt,
      updatedAt: generatedAt,
    });

    harness.store.insertTask({
      id: "task-1",
      parentId: null,
      rootId: "task-1",
      divisionId: "platform_ops",
      title: "Platform operator sample task",
      status: "in_progress",
      source: "system",
      priority: "normal",
      inputJson: JSON.stringify({ request: "platform operator sample" }),
      normalizedInputJson: null,
      outputJson: null,
      estimatedCostUsd: null,
      actualCostUsd: 0,
      errorCode: null,
      createdAt,
      updatedAt: createdAt,
      completedAt: null,
    });
    harness.store.insertExecution({
      id: "exec-1",
      taskId: "task-1",
      workflowId: null,
      parentExecutionId: null,
      agentId: "agent-1",
      roleId: null,
      runKind: "task_run",
      status: "executing",
      inputRef: null,
      traceId: "trace-platform-1",
      attempt: 1,
      timeoutMs: 60_000,
      budgetUsdLimit: null,
      requiresApproval: 0,
      sandboxMode: "workspace_write",
      allowedToolsJson: JSON.stringify(["bash"]),
      allowedPathsJson: JSON.stringify([]),
      maxRetries: 1,
      retryBackoff: "fixed:1000",
      lastErrorCode: null,
      lastErrorMessage: null,
      startedAt: createdAt,
      finishedAt: null,
      createdAt,
      updatedAt: createdAt,
    });

    harness.store.insertExecutionTicket({
      id: "ticket-1",
      executionId: "exec-1",
      taskId: "task-1",
      priority: "normal",
      queueName: "primary",
      dispatchTarget: "any",
      requiredIsolationLevel: "strict",
      requiredRepoVersion: null,
      requiredCapabilitiesJson: JSON.stringify(["bash"]),
      dispatchAfter: null,
      attempt: 1,
      status: "pending",
      assignedWorkerId: null,
      leaseId: null,
      claimedAt: null,
      consumedAt: null,
      invalidatedAt: null,
      createdAt,
      updatedAt: createdAt,
    });
    harness.store.insertExecutionLease({
      id: "lease-1",
      executionId: "exec-1",
      workerId: "worker-1",
      attempt: 1,
      fencingToken: 1,
      queueName: "primary",
      status: "active",
      leasedAt: createdAt,
      expiresAt: "2026-04-08T10:05:00.000Z",
      lastHeartbeatAt: generatedAt,
      releasedAt: null,
      reasonCode: null,
    });

    const report = harness.service.buildReport({
      environment: "prod",
      evidenceRootDir: join(harness.workspace, "stable-evidence"),
      packageOutputDir: join(harness.workspace, "platform-package"),
      targetStatus: "canary",
      generatedAt,
    });

    assert.equal(report.componentId, "execution_plane");
    assert.equal(report.overallVerdict, "promote_approved");
    assert.equal(report.promoteEligible, true);
    assert.equal(report.executionPlane.workerCounts.total, 1);
    assert.equal(report.executionPlane.workerCounts.healthy, 1);
    assert.equal(report.executionPlane.ticketCounts.pending, 1);
    assert.equal(report.executionPlane.leaseCounts.active, 1);
    assert.equal(report.executionPlane.topology.tenants, 1);
    assert.equal(report.executionPlane.topology.deploymentBindings, 1);
    assert.equal(report.executionPlane.readinessSummary.every((entry) => entry.allReady), true);
    assert.deepEqual(report.executionPlane.promotionRisks, []);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("platform operator service handles empty store gracefully", () => {
  const harness = createHarness("aa-platform-operator-empty-");
  const generatedAt = "2026-04-08T10:00:00.000Z";
  try {
    const report = harness.service.buildReport({
      environment: "prod",
      evidenceRootDir: join(harness.workspace, "stable-evidence"),
      packageOutputDir: join(harness.workspace, "platform-package"),
      targetStatus: "canary",
      generatedAt,
    });

    // Should still build a report even with empty data
    assert.equal(report.componentId, "execution_plane");
    assert.equal(report.executionPlane.workerCounts.total, 0);
    assert.equal(report.executionPlane.ticketCounts.pending, 0);
    assert.equal(report.executionPlane.leaseCounts.active, 0);
    assert.equal(report.executionPlane.topology.tenants, 0);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});
