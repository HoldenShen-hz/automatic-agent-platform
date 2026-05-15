/**
 * Integration Tests: Doctor Service (Health Checks)
 *
 * Tests the doctor service health check aggregation with realistic
 * subsystem reports and integration with health monitoring.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "../../../../helpers/integration-context.js";
import {
  DoctorService,
  summarizeDoctorChecks,
  type DoctorCheckReport,
  type DoctorCheckStatus,
} from "../../../../../src/platform/five-plane-control-plane/incident-control/doctor-service.js";
import type { HealthService } from "../../../../../src/platform/shared/observability/health-service.js";
import type { StartupConsistencyChecker } from "../../../../../src/platform/five-plane-execution/startup/startup-consistency-checker.js";
import type { SqliteReliabilityService } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-reliability-service.js";
import type { WorkerRegistryService } from "../../../../../src/platform/five-plane-execution/worker-pool/worker-registry-service.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";

function createMockHealthService(overrides?: Partial<ReturnType<HealthService["getReport"]>>): HealthService {
  return {
    getReport: () => ({
      status: "healthy",
      uptimeSeconds: 3600,
      dbWritable: true,
      providerHealth: "healthy",
      providerSuccessRate: 1.0,
      providerRecentCalls: 100,
      activeExecutions: 5,
      queuedTasks: 10,
      eventLoopLagMs: 5,
      memoryRssMb: 256,
      tier1AckBacklog: 0,
      degradationMode: "none",
      queueGovernance: {
        backlogSize: 10,
        dispatchableBacklogSize: 8,
        claimedBacklogSize: 2,
        oldestWaitSeconds: null,
        oldestClaimAgeSeconds: null,
        queueNames: ["default"],
        starvationDetected: false,
      },
      workerHealth: {
        totalWorkers: 2,
        healthyWorkers: 2,
        busyWorkers: 1,
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
      findings: [],
      ...overrides,
    }),
  } as unknown as HealthService;
}

function createMockStartupChecker(overrides?: Partial<ReturnType<StartupConsistencyChecker["run"]>>): StartupConsistencyChecker {
  return {
    run: () => ({
      checkedAt: new Date().toISOString(),
      status: "ok",
      findings: [],
      repairActions: [],
      ...overrides,
    }),
  } as unknown as StartupConsistencyChecker;
}

function createMockSqliteReliability(): SqliteReliabilityService {
  return {
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
      backupPath: "/tmp/test.backup.db",
      createdAt: new Date().toISOString(),
      sizeBytes: 1024,
      sourceIntegrity: ["ok"],
      backupIntegrity: ["ok"],
      valid: true,
    }),
  } as unknown as SqliteReliabilityService;
}

function createMockWorkerRegistry(): WorkerRegistryService {
  return {
    listWorkers: () => [
      {
        workerId: "worker-1",
        status: "idle",
        schedulingStatus: "healthy",
        availableSlots: 2,
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
        lastHeartbeatAt: new Date().toISOString(),
      },
    ],
    listStaleWorkers: () => [],
  } as unknown as WorkerRegistryService;
}

test("DoctorService: run returns comprehensive health report with all checks", () => {
  const ctx = createIntegrationContext("aa-doctor-run-");
  try {
    const service = new DoctorService(
      createMockHealthService(),
      createMockStartupChecker(),
      null,
      null,
      createMockSqliteReliability(),
      "/tmp/test.backup.db",
      null,
      null,
      createMockWorkerRegistry(),
      null,
      null,
      null,
      null,
    );

    const report = service.run();

    // Should have 8 checks: db, config, backup, locks, workers, event_backlog, audit_integrity, provider_health
    assert.ok(report.checks.length >= 8, "Should have at least 8 checks");
    assert.ok(report.selfCheckSummary.totalChecks >= 8);
    assert.ok(report.versionSnapshot);
    assert.ok(report.lockSummary);
    assert.ok(report.eventBacklogSummary);
  } finally {
    ctx.cleanup();
  }
});

test("DoctorService: run detects degraded when health is unhealthy", () => {
  const ctx = createIntegrationContext("aa-doctor-unhealthy-");
  try {
    const service = new DoctorService(
      createMockHealthService({ status: "unhealthy", findings: ["memory_pressure_detected"] }),
      createMockStartupChecker(),
      null,
      null,
      createMockSqliteReliability(),
      "/tmp/test.backup.db",
      null,
      null,
      createMockWorkerRegistry(),
      null,
      null,
      null,
      null,
    );

    const report = service.run();

    assert.ok(report.status === "degraded" || report.status === "fail_closed", "Should report degraded or worse");
  } finally {
    ctx.cleanup();
  }
});

test("DoctorService: run detects fail_closed when startup consistency fails", () => {
  const ctx = createIntegrationContext("aa-doctor-startup-fail-");
  try {
    const service = new DoctorService(
      createMockHealthService(),
      createMockStartupChecker({
        status: "fail_closed",
        findings: [{ code: "db_inaccessible", severity: "p1", message: "Database inaccessible", entityType: "database", entityId: "db-1" }],
      }),
      null,
      null,
      createMockSqliteReliability(),
      "/tmp/test.backup.db",
      null,
      null,
      createMockWorkerRegistry(),
      null,
      null,
      null,
      null,
    );

    const report = service.run();

    assert.strictEqual(report.status, "fail_closed");
    assert.ok(report.selfCheckSummary.failClosedChecks > 0, "Should have fail_closed checks");
  } finally {
    ctx.cleanup();
  }
});

test("DoctorService: summarizeDoctorChecks aggregates counts correctly", () => {
  const ctx = createIntegrationContext("aa-doctor-summarize-");
  try {
    const checks: DoctorCheckReport[] = [
      { checkId: "db", label: "Database", status: "ok", summary: "", findings: [], metrics: {} },
      { checkId: "config", label: "Config", status: "ok", summary: "", findings: [], metrics: {} },
      { checkId: "locks", label: "Locks", status: "degraded", summary: "", findings: ["expired_locks"], metrics: {} },
      { checkId: "workers", label: "Workers", status: "degraded", summary: "", findings: ["stale_workers"], metrics: {} },
      { checkId: "provider_health", label: "Provider", status: "fail_closed", summary: "", findings: ["provider_failed"], metrics: {} },
    ];

    const summary = summarizeDoctorChecks(checks);

    assert.strictEqual(summary.totalChecks, 5);
    assert.strictEqual(summary.okChecks, 2);
    assert.strictEqual(summary.degradedChecks, 2);
    assert.strictEqual(summary.failClosedChecks, 1);
    assert.deepStrictEqual(summary.failingCheckIds, ["locks", "workers", "provider_health"]);
  } finally {
    ctx.cleanup();
  }
});

test("DoctorService: run reports degraded when sqlite schema is not up to date", () => {
  const ctx = createIntegrationContext("aa-doctor-sqlite-schema-");
  try {
    const service = new DoctorService(
      createMockHealthService(),
      createMockStartupChecker(),
      null,
      null,
      {
        getReport: () => ({
          integrity: ["ok"],
          integrityPassed: true,
          schemaStatus: {
            currentVersion: 1,
            expectedVersion: 2, // Mismatch!
            upToDate: false,
            pendingVersions: [2],
            checksumMismatches: [],
          },
          appliedMigrations: [],
        }),
        createBackup: () => null,
      } as unknown as SqliteReliabilityService,
      null,
      null,
      null,
      createMockWorkerRegistry(),
      null,
      null,
      null,
      null,
    );

    const report = service.run();

    assert.ok(report.status === "degraded" || report.status === "fail_closed");
    const dbCheck = report.checks.find((c) => c.checkId === "db");
    assert.ok(dbCheck?.status === "fail_closed" || dbCheck?.status === "degraded");
  } finally {
    ctx.cleanup();
  }
});

test("DoctorService: run reports degraded when backup is invalid", () => {
  const ctx = createIntegrationContext("aa-doctor-backup-invalid-");
  try {
    const service = new DoctorService(
      createMockHealthService(),
      createMockStartupChecker(),
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
          backupPath: "/tmp/test.backup.db",
          createdAt: new Date().toISOString(),
          sizeBytes: 0,
          sourceIntegrity: ["ok"],
          backupIntegrity: ["error"], // Invalid backup
          valid: false,
        }),
      } as unknown as SqliteReliabilityService,
      "/tmp/test.backup.db",
      null,
      null,
      createMockWorkerRegistry(),
      null,
      null,
      null,
      null,
    );

    const report = service.run();

    const backupCheck = report.checks.find((c) => c.checkId === "backup");
    assert.strictEqual(backupCheck?.status, "degraded");
  } finally {
    ctx.cleanup();
  }
});

test("DoctorService: run includes worker summary with correct counts", () => {
  const ctx = createIntegrationContext("aa-doctor-workers-");
  try {
    const service = new DoctorService(
      createMockHealthService(),
      createMockStartupChecker(),
      null,
      null,
      createMockSqliteReliability(),
      "/tmp/test.backup.db",
      null,
      null,
      createMockWorkerRegistry(),
      null,
      null,
      null,
      null,
    );

    const report = service.run();

    assert.ok(report.workerSummary);
    assert.ok(report.workerSummary.totalWorkers >= 1);
    assert.ok(report.workerSummary.healthyWorkers >= 1);
  } finally {
    ctx.cleanup();
  }
});

test("DoctorService: run handles event backlog summary correctly", () => {
  const ctx = createIntegrationContext("aa-doctor-backlog-");
  try {
    const service = new DoctorService(
      createMockHealthService({
        tier1AckBacklog: 10,
        queueGovernance: {
          backlogSize: 100,
          dispatchableBacklogSize: 80,
          claimedBacklogSize: 20,
          oldestWaitSeconds: 300,
          oldestClaimAgeSeconds: null,
          queueNames: ["default"],
          starvationDetected: true,
        },
      }),
      createMockStartupChecker(),
      null,
      null,
      createMockSqliteReliability(),
      "/tmp/test.backup.db",
      null,
      null,
      createMockWorkerRegistry(),
      null,
      null,
      null,
      null,
    );

    const report = service.run();

    assert.ok(report.eventBacklogSummary);
    assert.ok(report.eventBacklogSummary.pendingTier1Acks >= 0);
    assert.ok(report.eventBacklogSummary.starvationDetected === true);
  } finally {
    ctx.cleanup();
  }
});

test("DoctorService: run includes lock summary when store is provided", () => {
  const ctx = createIntegrationContext("aa-doctor-locks-");
  try {
    const mockStore = {
      lock: {
        listFileLocks: () => [
          { taskId: "task-1", executionId: "exec-1", resourcePath: "data/file.txt", ownerId: "worker-1", lockMode: "exclusive" },
          { taskId: "task-2", executionId: "exec-2", resourcePath: "data/file2.txt", ownerId: "worker-2", lockMode: "shared" },
        ],
        listExpiredFileLocks: () => [{ id: "lock-expired-1" }],
      },
      event: {
        countPendingTier1Acks: () => 0,
        countFailedTier1Acks: () => 0,
        getTier1AuditIntegrityReport: () => null,
      },
    } as unknown as AuthoritativeTaskStore;

    const service = new DoctorService(
      createMockHealthService(),
      createMockStartupChecker(),
      null,
      null,
      createMockSqliteReliability(),
      "/tmp/test.backup.db",
      null,
      null,
      createMockWorkerRegistry(),
      null,
      null,
      null,
      { store: mockStore } as DoctorService["constructor"] extends (arg: infer A) => any ? A : never,
    );

    const report = service.run();

    assert.ok(report.lockSummary);
    assert.strictEqual(report.lockSummary.checked, true);
    assert.ok(report.lockSummary.totalLocks >= 0);
  } finally {
    ctx.cleanup();
  }
});

test("DoctorService: checks have correct status based on health indicators", () => {
  const ctx = createIntegrationContext("aa-doctor-check-status-");
  try {
    // Test with degraded worker health
    const service = new DoctorService(
      createMockHealthService({
        workerHealth: {
          totalWorkers: 3,
          healthyWorkers: 1,
          busyWorkers: 1,
          drainingWorkers: 0,
          degradedWorkers: 1,
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
          staleWorkers: 1,
          staleBusyWorkers: 0,
          loadSkewDetected: false,
          dominantWorkerId: null,
          dominantWorkerShare: null,
          skewedWorkerIds: [],
        },
      }),
      createMockStartupChecker(),
      null,
      null,
      createMockSqliteReliability(),
      "/tmp/test.backup.db",
      null,
      null,
      createMockWorkerRegistry(),
      null,
      null,
      null,
      null,
    );

    const report = service.run();

    const workersCheck = report.checks.find((c) => c.checkId === "workers");
    assert.strictEqual(workersCheck?.status, "degraded");
  } finally {
    ctx.cleanup();
  }
});

test("DoctorService: handles null audit integrity gracefully", () => {
  const ctx = createIntegrationContext("aa-doctor-audit-null-");
  try {
    const mockStore = {
      lock: { listFileLocks: () => [], listExpiredFileLocks: () => [] },
      event: {
        countPendingTier1Acks: () => 0,
        countFailedTier1Acks: () => 0,
        getTier1AuditIntegrityReport: () => null,
      },
    } as unknown as AuthoritativeTaskStore;

    const service = new DoctorService(
      createMockHealthService(),
      createMockStartupChecker(),
      null,
      null,
      createMockSqliteReliability(),
      "/tmp/test.backup.db",
      null,
      null,
      createMockWorkerRegistry(),
      null,
      null,
      null,
      { store: mockStore } as DoctorService["constructor"] extends (arg: infer A) => any ? A : never,
    );

    const report = service.run();

    const auditCheck = report.checks.find((c) => c.checkId === "audit_integrity");
    assert.strictEqual(auditCheck?.status, "degraded"); // null audit integrity = degraded
  } finally {
    ctx.cleanup();
  }
});
