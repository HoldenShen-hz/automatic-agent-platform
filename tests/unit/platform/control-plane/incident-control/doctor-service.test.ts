import assert from "node:assert/strict";
import test from "node:test";

import {
  DoctorService,
  summarizeDoctorChecks,
  type DoctorCheckReport,
} from "../../../../../src/platform/control-plane/incident-control/doctor-service.js";
import { type HealthService } from "../../../../../src/platform/shared/observability/health-service.js";
import { type StartupConsistencyChecker } from "../../../../../src/platform/execution/startup/startup-consistency-checker.js";
import { type SqliteReliabilityService } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-reliability-service.js";
import { type WorkerRegistryService } from "../../../../../src/platform/execution/worker-pool/worker-registry-service.js";
import { type AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";

test("summarizeDoctorChecks counts ok, degraded, and fail-closed checks", () => {
  const checks: DoctorCheckReport[] = [
    {
      checkId: "db",
      label: "Database",
      status: "ok",
      summary: "db ok",
      findings: [],
      metrics: {},
    },
    {
      checkId: "locks",
      label: "Locks",
      status: "degraded",
      summary: "stale lock",
      findings: ["expired lock"],
      metrics: {},
    },
    {
      checkId: "provider_health",
      label: "Provider Health",
      status: "fail_closed",
      summary: "provider missing",
      findings: ["provider missing"],
      metrics: {},
    },
  ];

  assert.deepEqual(summarizeDoctorChecks(checks), {
    totalChecks: 3,
    okChecks: 1,
    degradedChecks: 1,
    failClosedChecks: 1,
    failingCheckIds: ["locks", "provider_health"],
  });
});

test("doctor service builds unified self-check summaries for locks and backlog", () => {
  const report = new DoctorService(
    {
      getReport: () => ({
        status: "degraded",
        uptimeSeconds: 12,
        dbWritable: true,
        providerHealth: "healthy",
        providerSuccessRate: 1,
        providerRecentCalls: 0,
        activeExecutions: 0,
        queuedTasks: 0,
        eventLoopLagMs: 0,
        memoryRssMb: 64,
        tier1AckBacklog: 1,
        degradationMode: "none",
        queueGovernance: {
          backlogSize: 1,
          dispatchableBacklogSize: 1,
          claimedBacklogSize: 0,
          oldestWaitSeconds: 301,
          oldestClaimAgeSeconds: null,
          queueNames: ["default"],
          starvationDetected: true,
        },
        workerHealth: {
          totalWorkers: 1,
          healthyWorkers: 1,
          busyWorkers: 0,
          drainingWorkers: 0,
          degradedWorkers: 0,
          quarantinedWorkers: 0,
          offlineWorkers: 0,
          remoteWorkers: 0,
          remoteConnectedWorkers: 0,
          remoteReconnectingWorkers: 0,
          remoteDegradedSessions: 0,
          remoteFailedSessions: 0,
          remoteViewerOnlyWorkers: 0,
          remoteConsistencyMismatchWorkers: 0,
          remoteWorkspaceSyncConflictWorkers: 0,
          remoteOffsetMissingWorkers: 0,
          staleWorkers: 0,
          staleBusyWorkers: 0,
          loadSkewDetected: false,
          dominantWorkerId: null,
          dominantWorkerShare: null,
          skewedWorkerIds: [],
        },
        findings: ["queue_starvation_detected", "tier1_ack_backlog_degraded"],
      }),
    } as unknown as HealthService,
    {
      run: () => ({
        checkedAt: "2026-04-07T00:00:00.000Z",
        status: "repairable",
        findings: [
          {
            code: "expired_file_lock",
            severity: "p1",
            message: "File lock expired for data/output.md",
            entityType: "file_lock",
            entityId: "lock-expired",
          },
          {
            code: "tier1_ack_backlog",
            severity: "p1",
            message: "Tier 1 ack backlog detected",
            entityType: "event",
            entityId: "event-1",
          },
        ],
        repairActions: [],
      }),
    } as unknown as StartupConsistencyChecker,
    null,
    null,
    {
      getReport: () => ({
        integrity: ["ok"],
        integrityPassed: true,
        schemaStatus: {
          currentVersion: 1,
          expectedVersion: 1,
          upToDate: true,
          pendingVersions: [],
          checksumMismatches: [],
        },
        appliedMigrations: [],
      }),
      createBackup: () => ({
        backupPath: "/tmp/runtime.backup.db",
        createdAt: "2026-04-07T00:00:00.000Z",
        sizeBytes: 128,
        sourceIntegrity: ["ok"],
        backupIntegrity: ["ok"],
        valid: true,
      }),
    } as unknown as SqliteReliabilityService,
    "/tmp/runtime.backup.db",
    null,
    null,
    {
      listWorkers: () => [
        {
          workerId: "worker-1",
          status: "idle",
          schedulingStatus: "healthy",
          availableSlots: 1,
          runningExecutionIds: [],
          placement: "local",
          isolationLevel: "standard",
          repoVersion: null,
          remoteSessionStatus: null,
          lastAcknowledgedStreamOffset: null,
          streamResumeSuccessRate: null,
          credentialRefreshSuccessRate: null,
          sessionConsistencyCheckStatus: null,
          sessionConsistencyCheckedAt: null,
          saturation: null,
          activeLeaseCount: 0,
          meanStartupLatencyMs: null,
          sandboxSuccessRate: null,
          repoCacheHitRate: null,
          runtimeInstanceId: "runtime-1",
          restartedFromRuntimeInstanceId: null,
          restartGeneration: 0,
          cpuPct: null,
          memoryMb: null,
          toolBacklogCount: 0,
          currentStepId: null,
          lastProgressAt: null,
          lastHeartbeatAt: "2026-04-07T00:00:00.000Z",
        },
      ],
      listStaleWorkers: () => [],
    } as unknown as WorkerRegistryService,
    null,
    null,
    null,
    {
      store: {
        lock: {
          listFileLocks: () => [
            {
              id: "lock-live",
              taskId: "task-1",
              executionId: "exec-1",
              lockScope: "workspace",
              resourcePath: "data/output.md",
              lockMode: "exclusive",
              ownerId: "owner-1",
              expiresAt: "2026-04-07T00:10:00.000Z",
              createdAt: "2026-04-07T00:00:00.000Z",
              updatedAt: "2026-04-07T00:00:00.000Z",
            },
          ],
          listExpiredFileLocks: () => [
            {
              id: "lock-expired",
              taskId: "task-2",
              executionId: "exec-2",
              lockScope: "workspace",
              resourcePath: "data/output.md",
              lockMode: "exclusive",
              ownerId: "owner-2",
              expiresAt: "2026-04-06T23:00:00.000Z",
              createdAt: "2026-04-06T22:00:00.000Z",
              updatedAt: "2026-04-06T22:30:00.000Z",
            },
          ],
        },
        event: {
          countPendingTier1Acks: () => 1,
          countFailedTier1Acks: () => 0,
          getTier1AuditIntegrityReport: () => ({
            checked: true,
            totalTrackedEvents: 2,
            verifiedEvents: 2,
            compromisedEvents: 0,
            missingEvents: 0,
            chainBreaks: 0,
            latestChainHash: "chain-ok",
            compromisedEventIds: [],
            missingEventIds: [],
            findings: [],
          }),
        },
      } as unknown as AuthoritativeTaskStore,
    },
  ).run();

  assert.equal(report.selfCheckSummary.totalChecks, 8);
  assert.equal(report.selfCheckSummary.degradedChecks, 2);
  assert.deepEqual(report.selfCheckSummary.failingCheckIds, ["locks", "event_backlog"]);
  assert.equal(report.lockSummary.totalLocks, 1);
  assert.equal(report.lockSummary.expiredLockCount, 1);
  assert.equal(report.eventBacklogSummary.pendingTier1Acks, 1);
  assert.equal(report.auditIntegrity?.compromisedEvents, 0);
  assert.equal(report.checks.find((check) => check.checkId === "locks")?.status, "degraded");
  assert.equal(report.checks.find((check) => check.checkId === "event_backlog")?.status, "degraded");
  assert.equal(report.checks.find((check) => check.checkId === "audit_integrity")?.status, "ok");
});
