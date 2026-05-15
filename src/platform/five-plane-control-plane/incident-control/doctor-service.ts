/**
 * Doctor Service
 *
 * Provides comprehensive system health diagnostics by aggregating reports from
 * multiple subsystems including worker status, startup consistency, stalled executions,
 * runtime recovery, and SQLite reliability.
 *
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/contracts/diagnostics_snapshot_and_repro_bundle_contract.md | Diagnostics Snapshot Contract}
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/contracts/startup_consistency_and_recovery_drill_contract.md | Startup Consistency Contract}
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/contracts/debug_inspect_health_backpressure_contract.md | Health and Backpressure Contract}
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary and Terminology}
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/architecture/00-platform-architecture.md | Architecture and Technical Design}
 */

import { dirname } from "node:path";

import { HealthService } from "../../shared/observability/health-service.js";
import {
  ProtectedGovernanceIntegrityService,
  type ProtectedGovernanceDriftReport,
} from "../config-center/protected-governance-integrity-service.js";
import { createWorkspaceWritePolicy } from "../iam/sandbox-policy.js";
import {
  StorageQuotaService,
  type StorageQuotaEnforcementReport,
} from "../../five-plane-state-evidence/truth/storage-quota-service.js";
import {
  inspectStorageBackendConfig,
  type StorageBackendRuntimeProfile,
} from "../../five-plane-state-evidence/truth/storage-backend-config.js";
import { ExecutionResourceMonitor } from "../../five-plane-execution/dispatcher/execution-resource-monitor.js";
import { RuntimeRecoveryService } from "../../five-plane-execution/recovery/runtime-recovery-service-root.js";
import { StalledExecutionDetector } from "../../five-plane-execution/recovery/stalled-execution-detector.js";
import { StalledExecutionEscalationService } from "../../five-plane-execution/recovery/stalled-execution-escalation-service.js";
import { StartupConsistencyChecker } from "../../five-plane-execution/startup/startup-consistency-checker.js";
import { WorkerRegistryService } from "../../five-plane-execution/worker-pool/worker-registry-service.js";
import {
  resolveConfigEnvironment,
  resolveConfigRoot,
  resolveExpectedProtectedGovernanceVersion,
} from "../config-center/runtime-env.js";
import { SqliteReliabilityService, type SqliteBackupReport } from "../../five-plane-state-evidence/truth/sqlite/sqlite-reliability-service.js";
import type { AuthoritativeTaskStore } from "../../five-plane-state-evidence/truth/authoritative-task-store.js";
import { nowIso } from "../../contracts/types/ids.js";
import type { ObservabilityRetentionReport } from "../../shared/observability/observability-retention-service.js";
import { ObservabilityRetentionService } from "../../shared/observability/observability-retention-service.js";
import type { Tier1AuditIntegrityReport } from "../iam/audit-event-integrity.js";
import { buildRuntimeVersionSnapshot, type RuntimeVersionSnapshot } from "./runtime-version-snapshot.js";

export type DoctorCheckId =
  | "db"
  | "config"
  | "backup"
  | "locks"
  | "workers"
  | "event_backlog"
  | "audit_integrity"
  | "provider_health";
export type DoctorCheckStatus = "ok" | "degraded" | "fail_closed";

export interface DoctorCheckReport {
  checkId: DoctorCheckId;
  label: string;
  status: DoctorCheckStatus;
  summary: string;
  findings: string[];
  metrics: Record<string, string | number | boolean | null>;
}

export interface DoctorSelfCheckSummary {
  totalChecks: number;
  okChecks: number;
  degradedChecks: number;
  failClosedChecks: number;
  failingCheckIds: DoctorCheckId[];
}

export interface DoctorLockSummary {
  checked: boolean;
  totalLocks: number;
  exclusiveLocks: number;
  sharedLocks: number;
  expiredLockCount: number;
  taskIds: string[];
  executionIds: string[];
  ownerIds: string[];
  resourcePaths: string[];
}

export interface DoctorEventBacklogSummary {
  pendingTier1Acks: number;
  failedTier1Acks: number;
  queueBacklogSize: number;
  dispatchableBacklogSize: number;
  claimedBacklogSize: number;
  oldestWaitSeconds: number | null;
  oldestClaimAgeSeconds: number | null;
  starvationDetected: boolean;
}

export interface DoctorServiceOptions {
  store?: AuthoritativeTaskStore | null;
}

export interface DoctorReport {
  status: "ok" | "degraded" | "fail_closed";
  selfCheckSummary: DoctorSelfCheckSummary;
  checks: DoctorCheckReport[];
  versionSnapshot: RuntimeVersionSnapshot;
  lockSummary: DoctorLockSummary;
  eventBacklogSummary: DoctorEventBacklogSummary;
  storageBackend: StorageBackendRuntimeProfile;
  workerSummary: {
    totalWorkers: number;
    healthyWorkers: number;
    busyWorkers: number;
    drainingWorkers: number;
    degradedWorkers: number;
    quarantinedWorkers: number;
    offlineWorkers: number;
    remoteWorkers: number;
    remoteReconnectingWorkers: number;
    remoteDegradedSessions: number;
    remoteFailedSessions: number;
    remoteViewerOnlyWorkers: number;
    remoteConsistencyMismatchWorkers: number;
    remoteWorkspaceSyncConflictWorkers: number;
    remoteOffsetMissingWorkers: number;
    loadSkewDetected: boolean;
    dominantWorkerId: string | null;
    dominantWorkerShare: number | null;
    skewedWorkerIds: string[];
    staleWorkerIds: string[];
    workers: Array<{
      workerId: string;
      status: string;
      schedulingStatus: string;
      availableSlots: number;
      runningExecutionCount: number;
      placement: string;
      isolationLevel: string;
      repoVersion: string | null;
      remoteSessionStatus: string | null;
      lastAcknowledgedStreamOffset: string | null;
      streamResumeSuccessRate: number | null;
      credentialRefreshSuccessRate: number | null;
      sessionConsistencyCheckStatus: string | null;
      sessionConsistencyCheckedAt: string | null;
      saturation: number | null;
      activeLeaseCount: number;
      meanStartupLatencyMs: number | null;
      sandboxSuccessRate: number | null;
      repoCacheHitRate: number | null;
      runtimeInstanceId: string | null;
      restartedFromRuntimeInstanceId: string | null;
      restartGeneration: number;
      cpuPct: number | null;
      memoryMb: number | null;
      toolBacklogCount: number;
      currentStepId: string | null;
      lastProgressAt: string | null;
      lastHeartbeatAt: string;
    }>;
  };
  health: ReturnType<HealthService["getReport"]>;
  auditIntegrity: Tier1AuditIntegrityReport | null;
  startupConsistency: ReturnType<StartupConsistencyChecker["run"]>;
  stalledExecutions: ReturnType<StalledExecutionDetector["detect"]>;
  stalledEscalations: ReturnType<StalledExecutionEscalationService["buildPackages"]>;
  resourceCeilings: ReturnType<ExecutionResourceMonitor["detect"]>;
  runtimeRecovery: {
    recoverableRuns: ReturnType<RuntimeRecoveryService["listRecoverableExecutingRuns"]>;
    blockedRunsAwaitingApproval: ReturnType<RuntimeRecoveryService["listBlockedRunsAwaitingApproval"]>;
    divisionOverview: ReturnType<RuntimeRecoveryService["listDivisionRecoveryOverview"]>;
  };
  sqliteReliability: ReturnType<SqliteReliabilityService["getReport"]> & { backup: SqliteBackupReport | null };
  protectedGovernance: ProtectedGovernanceDriftReport;
  storageQuota: StorageQuotaEnforcementReport | null;
  observabilityRetention: ObservabilityRetentionReport | null;
}

/**
 * DoctorService runs a comprehensive health diagnostic across multiple subsystems.
 * It aggregates check results from database, config, backup, locks, workers,
 * event backlog, audit integrity, and provider health into a unified report.
 */
export class DoctorService {
  public constructor(
    private readonly healthService: HealthService,
    private readonly startupChecker: StartupConsistencyChecker,
    private readonly runtimeRecovery: RuntimeRecoveryService | null = null,
    private readonly stalledDetector: StalledExecutionDetector | null = null,
    private readonly sqliteReliability: SqliteReliabilityService | null = null,
    private readonly backupPath: string | null = null,
    private readonly protectedGovernance: ProtectedGovernanceIntegrityService | null = null,
    private readonly storageQuota: StorageQuotaService | null = null,
    private readonly workerRegistry: WorkerRegistryService | null = null,
    private readonly observabilityRetention: ObservabilityRetentionService | null = null,
    private readonly stalledEscalationService: StalledExecutionEscalationService | null = null,
    private readonly resourceMonitor: ExecutionResourceMonitor | null = null,
    private readonly options: DoctorServiceOptions = {},
  ) {}

  /**
   * Runs all diagnostic checks and produces a comprehensive doctor report.
   * This is the main entry point for system health diagnostics.
   *
   * @returns Complete doctor report with all check results and subsystem status
   */
  public run(): DoctorReport {
    const checkedAt = nowIso();
    const health = this.healthService.getReport();
    const startupConsistency = this.startupChecker.run();
    const stalledExecutions = this.stalledDetector?.detect() ?? [];
    const stalledEscalations = this.stalledEscalationService?.buildPackages() ?? [];
    const resourceCeilings = this.resourceMonitor?.detect() ?? [];
    const staleBefore = new Date(Date.parse(checkedAt) - 5 * 60 * 1000).toISOString();

    // Gather runtime recovery information
    const runtimeRecovery = {
      recoverableRuns: this.runtimeRecovery?.listRecoverableExecutingRuns() ?? [],
      blockedRunsAwaitingApproval: this.runtimeRecovery?.listBlockedRunsAwaitingApproval() ?? [],
      divisionOverview: this.runtimeRecovery?.listDivisionRecoveryOverview(staleBefore) ?? [],
    };

    // Gather SQLite reliability information
    const sqliteReliabilityBase = this.sqliteReliability?.getReport() ?? {
      integrity: ["not_checked"],
      integrityPassed: true,
      schemaStatus: {
        currentVersion: 0,
        expectedVersion: 0,
        upToDate: true,
        pendingVersions: [],
        checksumMismatches: [],
      },
      appliedMigrations: [],
    };
    const backup = this.sqliteReliability && this.backupPath ? this.sqliteReliability.createBackup(this.backupPath) : null;
    const sqliteReliability = {
      ...sqliteReliabilityBase,
      backup,
    };

    // Gather protected governance information
    const runtimeEnv = process.env;
    const environment = resolveConfigEnvironment({ env: runtimeEnv });
    const protectedGovernance = this.protectedGovernance
      ? this.protectedGovernance.detectTampering(resolveExpectedProtectedGovernanceVersion(runtimeEnv))
      : {
          checked: false,
          expectedVersion: null,
          currentVersion: null,
          tampered: false,
          issues: [],
          surfaces: [],
        };

    // Gather storage quota and observability retention information
    const storageQuota = this.storageQuota?.enforce() ?? null;
    const observabilityRetention = this.observabilityRetention?.preview() ?? null;
    const versionSnapshot = buildRuntimeVersionSnapshot(sqliteReliability.schemaStatus);
    const storageBackend = inspectStorageBackendConfig({
      environment,
      env: runtimeEnv,
      sandboxPolicy: createWorkspaceWritePolicy(resolveDoctorWorkspaceRoot()),
    });

    // Gather file lock information
    const store = this.options?.store ?? null;
    const fileLocks = store?.lock?.listFileLocks() ?? [];
    const expiredFileLocks = store?.lock?.listExpiredFileLocks(checkedAt) ?? [];
    const auditIntegrity = store?.event?.getTier1AuditIntegrityReport() ?? null;
    const lockSummary = buildLockSummary(fileLocks, expiredFileLocks, store != null);

    // Build event backlog summary from health report
    const eventBacklogSummary = {
      pendingTier1Acks: store?.event?.countPendingTier1Acks() ?? health.tier1AckBacklog,
      failedTier1Acks: store?.event?.countFailedTier1Acks() ?? 0,
      queueBacklogSize: health.queueGovernance.backlogSize,
      dispatchableBacklogSize: health.queueGovernance.dispatchableBacklogSize,
      claimedBacklogSize: health.queueGovernance.claimedBacklogSize,
      oldestWaitSeconds: health.queueGovernance.oldestWaitSeconds,
      oldestClaimAgeSeconds: health.queueGovernance.oldestClaimAgeSeconds,
      starvationDetected: health.queueGovernance.starvationDetected,
    } satisfies DoctorEventBacklogSummary;

    // Gather worker information
    const workers = this.workerRegistry?.listWorkers() ?? [];
    const staleWorkerIds = this.workerRegistry
      ?.listStaleWorkers(checkedAt, 5 * 60 * 1000)
      .map((worker) => worker.workerId) ?? [];

    // Build individual check reports
    const checks = buildDoctorChecks({
      health,
      startupConsistency,
      sqliteReliability,
      protectedGovernance,
      storageQuota,
      workerCount: workers.length,
      staleWorkerIds,
      workerLoadSkew: {
        detected: health.workerHealth.loadSkewDetected,
        dominantWorkerId: health.workerHealth.dominantWorkerId,
        dominantWorkerShare: health.workerHealth.dominantWorkerShare,
        skewedWorkerIds: health.workerHealth.skewedWorkerIds,
      },
      auditIntegrity,
      lockSummary,
      eventBacklogSummary,
      storageBackend,
    });

    // Determine overall status based on check results
    const status: DoctorReport["status"] =
      startupConsistency.status === "fail_closed"
      || !sqliteReliability.schemaStatus.upToDate
      || checks.some((check) => check.status === "fail_closed")
        ? "fail_closed"
        : health.status === "unhealthy" ||
            health.status === "overloaded" ||
            stalledExecutions.length > 0 ||
            resourceCeilings.length > 0 ||
            protectedGovernance.tampered ||
            (storageQuota?.categories.some((category) => category.overQuota) ?? false) ||
            !sqliteReliability.integrityPassed ||
            (sqliteReliability.backup !== null && !sqliteReliability.backup.valid)
          ? "degraded"
        : startupConsistency.status === "repairable" || health.status === "degraded"
            ? "degraded"
            : "ok";
    const selfCheckSummary = summarizeDoctorChecks(checks);

    return {
      status,
      selfCheckSummary,
      checks,
      versionSnapshot,
      lockSummary,
      eventBacklogSummary,
      storageBackend,
      workerSummary: {
        totalWorkers: workers.length,
        healthyWorkers: workers.filter((worker) => worker.schedulingStatus === "healthy").length,
        busyWorkers: workers.filter((worker) => worker.status === "busy").length,
        drainingWorkers: workers.filter((worker) => worker.status === "draining").length,
        degradedWorkers: workers.filter((worker) => worker.status === "degraded").length,
        quarantinedWorkers: workers.filter((worker) => worker.status === "quarantined").length,
        offlineWorkers: workers.filter((worker) => worker.status === "offline").length,
        remoteWorkers: workers.filter((worker) => worker.placement === "remote").length,
        remoteReconnectingWorkers: workers.filter(
          (worker) => worker.placement === "remote" && worker.remoteSessionStatus === "reconnecting",
        ).length,
        remoteDegradedSessions: workers.filter(
          (worker) => worker.placement === "remote" && worker.remoteSessionStatus === "degraded",
        ).length,
        remoteFailedSessions: workers.filter(
          (worker) => worker.placement === "remote" && worker.remoteSessionStatus === "failed",
        ).length,
        remoteViewerOnlyWorkers: workers.filter(
          (worker) => worker.placement === "remote" && worker.remoteSessionStatus === "viewer_only",
        ).length,
        remoteConsistencyMismatchWorkers: workers.filter(
          (worker) => worker.sessionConsistencyCheckStatus === "mismatch",
        ).length,
        remoteWorkspaceSyncConflictWorkers: workers.filter(
          (worker) => worker.workspaceSyncStatus === "conflict",
        ).length,
        remoteOffsetMissingWorkers: workers.filter(
          (worker) =>
            worker.placement === "remote"
            && worker.remoteSessionStatus != null
            && worker.remoteSessionStatus !== "connecting"
            && worker.remoteSessionStatus !== "failed"
            && (worker.lastAcknowledgedStreamOffset == null || worker.lastAcknowledgedStreamOffset.length === 0),
        ).length,
        loadSkewDetected: health.workerHealth.loadSkewDetected,
        dominantWorkerId: health.workerHealth.dominantWorkerId,
        dominantWorkerShare: health.workerHealth.dominantWorkerShare,
        skewedWorkerIds: health.workerHealth.skewedWorkerIds,
        staleWorkerIds,
        workers: workers.map((worker) => ({
          workerId: worker.workerId,
          status: worker.status,
          schedulingStatus: worker.schedulingStatus,
          availableSlots: worker.availableSlots,
          runningExecutionCount: worker.runningExecutionIds.length,
          placement: worker.placement,
          isolationLevel: worker.isolationLevel,
          repoVersion: worker.repoVersion,
          remoteSessionStatus: worker.remoteSessionStatus,
          lastAcknowledgedStreamOffset: worker.lastAcknowledgedStreamOffset,
          streamResumeSuccessRate: worker.streamResumeSuccessRate,
          credentialRefreshSuccessRate: worker.credentialRefreshSuccessRate,
          sessionConsistencyCheckStatus: worker.sessionConsistencyCheckStatus,
          sessionConsistencyCheckedAt: worker.sessionConsistencyCheckedAt,
          saturation: worker.saturation,
          activeLeaseCount: worker.activeLeaseCount,
          meanStartupLatencyMs: worker.meanStartupLatencyMs,
          sandboxSuccessRate: worker.sandboxSuccessRate,
          repoCacheHitRate: worker.repoCacheHitRate,
          runtimeInstanceId: worker.runtimeInstanceId,
          restartedFromRuntimeInstanceId: worker.restartedFromRuntimeInstanceId,
          restartGeneration: worker.restartGeneration,
          cpuPct: worker.cpuPct,
          memoryMb: worker.memoryMb,
          toolBacklogCount: worker.toolBacklogCount,
          currentStepId: worker.currentStepId,
          lastProgressAt: worker.lastProgressAt,
          lastHeartbeatAt: worker.lastHeartbeatAt,
        })),
      },
      health,
      auditIntegrity,
      startupConsistency,
      stalledExecutions,
      stalledEscalations,
      resourceCeilings,
      runtimeRecovery,
      sqliteReliability,
      protectedGovernance,
      storageQuota,
      observabilityRetention,
    };
  }
}

/**
 * Builds a lock summary from file lock records.
 */
function buildLockSummary(
  fileLocks: ReadonlyArray<{
    taskId: string | null;
    executionId: string | null;
    resourcePath: string;
    ownerId: string;
    lockMode: string;
  }>,
  expiredFileLocks: ReadonlyArray<{ id: string }>,
  checked: boolean,
): DoctorLockSummary {
  return {
    checked,
    totalLocks: fileLocks.length,
    exclusiveLocks: fileLocks.filter((lock) => lock.lockMode === "exclusive").length,
    sharedLocks: fileLocks.filter((lock) => lock.lockMode === "shared").length,
    expiredLockCount: expiredFileLocks.length,
    taskIds: uniqueSortedValues(fileLocks.map((lock) => lock.taskId)),
    executionIds: uniqueSortedValues(fileLocks.map((lock) => lock.executionId)),
    ownerIds: uniqueSortedValues(fileLocks.map((lock) => lock.ownerId)),
    resourcePaths: uniqueSortedValues(fileLocks.map((lock) => lock.resourcePath)),
  };
}

/**
 * Builds individual check reports for each diagnostic category.
 */
function buildDoctorChecks(input: {
  health: ReturnType<HealthService["getReport"]>;
  startupConsistency: ReturnType<StartupConsistencyChecker["run"]>;
  sqliteReliability: ReturnType<SqliteReliabilityService["getReport"]> & { backup: SqliteBackupReport | null };
  protectedGovernance: ProtectedGovernanceDriftReport;
  storageQuota: StorageQuotaEnforcementReport | null;
  workerCount: number;
  staleWorkerIds: string[];
  workerLoadSkew: {
    detected: boolean;
    dominantWorkerId: string | null;
    dominantWorkerShare: number | null;
    skewedWorkerIds: string[];
  };
  auditIntegrity: Tier1AuditIntegrityReport | null;
  lockSummary: DoctorLockSummary;
  eventBacklogSummary: DoctorEventBacklogSummary;
  storageBackend: StorageBackendRuntimeProfile;
}): DoctorCheckReport[] {
  // Categorize findings from startup consistency check
  const databaseFindings = input.startupConsistency.findings.filter((finding) => finding.entityType === "database");
  const configFindings = input.startupConsistency.findings.filter((finding) => finding.entityType === "config");
  const providerFindings = input.startupConsistency.findings.filter((finding) => finding.entityType === "provider");
  const eventFindings = input.startupConsistency.findings.filter((finding) => finding.entityType === "event");
  const fileLockFindings = input.startupConsistency.findings.filter((finding) => finding.entityType === "file_lock");
  const backupQuota = input.storageQuota?.categories.find((category) => category.categoryId === "backup") ?? null;
  const backlogHealthFindings = input.health.findings.filter(
    (finding) => finding.startsWith("queue_") || finding.startsWith("tier1_ack_backlog"),
  );
  const workerHealthFindings = input.health.findings.filter(
    (finding) =>
      finding === "stale_workers_detected" ||
      finding === "worker_load_skew_detected" ||
      finding.startsWith("remote_session_") ||
      finding === "remote_workspace_sync_conflict" ||
      finding === "remote_stream_offset_missing",
  );
  const checks: DoctorCheckReport[] = [];

  // Database check
  checks.push({
    checkId: "db",
    label: "Database",
    status:
      (input.startupConsistency.status === "fail_closed" && databaseFindings.length > 0) ||
      !input.health.dbWritable ||
      !input.sqliteReliability.schemaStatus.upToDate
        ? "fail_closed"
        : !input.sqliteReliability.integrityPassed || input.sqliteReliability.schemaStatus.checksumMismatches.length > 0
            ? "degraded"
            : "ok",
    summary: `dbWritable=${input.health.dbWritable}; integrity=${input.sqliteReliability.integrityPassed}; schemaUpToDate=${input.sqliteReliability.schemaStatus.upToDate}`,
    findings: dedupeStrings([
      ...databaseFindings.map((finding) => finding.message),
      ...input.sqliteReliability.integrity.filter((result) => result !== "ok").map((result) => `integrity_check: ${result}`),
      ...input.sqliteReliability.schemaStatus.pendingVersions.map((version) => `pending_migration:${version}`),
      ...input.sqliteReliability.schemaStatus.checksumMismatches.map((item) => `checksum_mismatch:${item}`),
      ...(!input.health.dbWritable ? ["db_write_probe_failed"] : []),
    ]),
    metrics: {
      dbWritable: input.health.dbWritable,
      integrityPassed: input.sqliteReliability.integrityPassed,
      schemaUpToDate: input.sqliteReliability.schemaStatus.upToDate,
      pendingMigrationCount: input.sqliteReliability.schemaStatus.pendingVersions.length,
      checksumMismatchCount: input.sqliteReliability.schemaStatus.checksumMismatches.length,
    },
  });

  // Config check
  checks.push({
    checkId: "config",
    label: "Config",
    status: configFindings.length > 0 ? "fail_closed" : input.protectedGovernance.tampered ? "degraded" : "ok",
    summary:
      `startupConfigFindings=${configFindings.length}; governanceTampered=${input.protectedGovernance.tampered}; ` +
      `storageDriver=${input.storageBackend.driver}; storageIssues=${input.storageBackend.issues.length}`,
    findings: dedupeStrings([
      ...configFindings.map((finding) => finding.message),
      ...input.protectedGovernance.issues,
    ]),
    metrics: {
      startupFindingCount: configFindings.length,
      governanceChecked: input.protectedGovernance.checked,
      governanceTampered: input.protectedGovernance.tampered,
      governanceIssueCount: input.protectedGovernance.issues.length,
      expectedGovernanceVersion: input.protectedGovernance.expectedVersion,
      storageDriver: input.storageBackend.driver,
      storageEnvironment: input.storageBackend.environment,
      storageIssueCount: input.storageBackend.issues.length,
      storageDualRun: input.storageBackend.postgres?.dualRun ?? null,
      storageShadowSqliteConfigured: input.storageBackend.postgres?.shadowSqlitePath != null,
    },
  });

  // Backup check
  checks.push({
    checkId: "backup",
    label: "Backup",
    status:
      input.sqliteReliability.backup == null
        ? "degraded"
        : !input.sqliteReliability.backup.valid || backupQuota?.overQuota === true
            ? "degraded"
            : "ok",
    summary:
      input.sqliteReliability.backup == null
        ? "backup_not_checked"
        : `backupValid=${input.sqliteReliability.backup.valid}; backupQuotaOver=${backupQuota?.overQuota ?? false}`,
    findings: dedupeStrings([
      ...(input.sqliteReliability.backup == null
        ? ["backup_report_unavailable"]
        : input.sqliteReliability.backup.valid
            ? []
            : [
                ...input.sqliteReliability.backup.sourceIntegrity
                  .filter((result) => result !== "ok")
                  .map((result) => `backup_source_integrity:${result}`),
                ...input.sqliteReliability.backup.backupIntegrity
                  .filter((result) => result !== "ok")
                  .map((result) => `backup_copy_integrity:${result}`),
              ]),
      ...(backupQuota?.overQuota ? [`backup_quota_over:${backupQuota.totalBytes}`] : []),
    ]),
    metrics: {
      backupValid: input.sqliteReliability.backup?.valid ?? null,
      backupSizeBytes: input.sqliteReliability.backup?.sizeBytes ?? null,
      backupQuotaOver: backupQuota?.overQuota ?? null,
      backupQuotaBytes: backupQuota?.totalBytes ?? null,
    },
  });

  // Locks check
  checks.push({
    checkId: "locks",
    label: "Locks",
    status:
      !input.lockSummary.checked
        ? "degraded"
        : input.lockSummary.expiredLockCount > 0
            ? "degraded"
            : "ok",
    summary:
      !input.lockSummary.checked
        ? "lock_inventory_unavailable"
        : `totalLocks=${input.lockSummary.totalLocks}; expiredLocks=${input.lockSummary.expiredLockCount}`,
    findings: dedupeStrings([
      ...(input.lockSummary.checked ? [] : ["lock_inventory_unavailable"]),
      ...fileLockFindings.map((finding) => finding.message),
    ]),
    metrics: {
      checked: input.lockSummary.checked,
      totalLocks: input.lockSummary.totalLocks,
      expiredLockCount: input.lockSummary.expiredLockCount,
      exclusiveLocks: input.lockSummary.exclusiveLocks,
      sharedLocks: input.lockSummary.sharedLocks,
    },
  });

  // Workers check
  checks.push({
    checkId: "workers",
    label: "Workers",
    status:
      input.health.workerHealth.staleBusyWorkers > 0
      || input.health.workerHealth.degradedWorkers > 0
      || input.health.workerHealth.quarantinedWorkers > 0
      || input.health.workerHealth.offlineWorkers > 0
      || input.health.workerHealth.remoteFailedSessions > 0
      || input.health.workerHealth.remoteViewerOnlyWorkers > 0
      || input.health.workerHealth.remoteConsistencyMismatchWorkers > 0
      || input.health.workerHealth.remoteWorkspaceSyncConflictWorkers > 0
      || input.health.workerHealth.remoteOffsetMissingWorkers > 0
      || input.workerLoadSkew.detected
        ? "degraded"
        : "ok",
    summary:
      `healthyWorkers=${input.health.workerHealth.healthyWorkers}/${input.workerCount}; staleWorkers=${input.staleWorkerIds.length}; ` +
      `loadSkewDetected=${input.workerLoadSkew.detected}`,
    findings: dedupeStrings([
      ...workerHealthFindings,
      ...(input.health.workerHealth.staleBusyWorkers > 0 && input.staleWorkerIds.length > 0
        ? [`stale_worker_ids:${input.staleWorkerIds.join(",")}`]
        : []),
      ...input.workerLoadSkew.skewedWorkerIds.map((workerId) => `worker_load_skew:${workerId}`),
    ]),
    metrics: {
      totalWorkers: input.workerCount,
      healthyWorkers: input.health.workerHealth.healthyWorkers,
      staleWorkers: input.staleWorkerIds.length,
      staleBusyWorkers: input.health.workerHealth.staleBusyWorkers,
      degradedWorkers: input.health.workerHealth.degradedWorkers,
      offlineWorkers: input.health.workerHealth.offlineWorkers,
      remoteFailedSessions: input.health.workerHealth.remoteFailedSessions,
      loadSkewDetected: input.workerLoadSkew.detected,
      dominantWorkerId: input.workerLoadSkew.dominantWorkerId,
      dominantWorkerShare:
        input.workerLoadSkew.dominantWorkerShare == null
          ? null
          : Math.round(input.workerLoadSkew.dominantWorkerShare * 1000) / 1000,
    },
  });

  // Event backlog check
  checks.push({
    checkId: "event_backlog",
    label: "Event Backlog",
    status:
      eventFindings.length > 0
      || input.eventBacklogSummary.failedTier1Acks > 0
      || input.eventBacklogSummary.starvationDetected
      || backlogHealthFindings.length > 0
        ? "degraded"
        : "ok",
    summary:
      `pendingTier1Acks=${input.eventBacklogSummary.pendingTier1Acks}; `
      + `failedTier1Acks=${input.eventBacklogSummary.failedTier1Acks}; `
      + `queueBacklog=${input.eventBacklogSummary.queueBacklogSize}`,
    findings: dedupeStrings([
      ...backlogHealthFindings,
      ...eventFindings.map((finding) => finding.message),
    ]),
    metrics: {
      pendingTier1Acks: input.eventBacklogSummary.pendingTier1Acks,
      failedTier1Acks: input.eventBacklogSummary.failedTier1Acks,
      queueBacklogSize: input.eventBacklogSummary.queueBacklogSize,
      dispatchableBacklogSize: input.eventBacklogSummary.dispatchableBacklogSize,
      claimedBacklogSize: input.eventBacklogSummary.claimedBacklogSize,
      starvationDetected: input.eventBacklogSummary.starvationDetected,
      oldestWaitSeconds: input.eventBacklogSummary.oldestWaitSeconds,
    },
  });

  // Audit integrity check
  checks.push({
    checkId: "audit_integrity",
    label: "Audit Integrity",
    status:
      input.auditIntegrity == null
        ? "degraded"
        : !input.auditIntegrity.checked
          ? "degraded"
        : input.auditIntegrity.compromisedEvents > 0
            || input.auditIntegrity.missingEvents > 0
            || input.auditIntegrity.chainBreaks > 0
          ? "fail_closed"
          : "ok",
    summary:
      input.auditIntegrity == null
        ? "audit_integrity_unavailable"
        : !input.auditIntegrity.checked
          ? "audit_integrity_not_checked"
        : `trackedEvents=${input.auditIntegrity.totalTrackedEvents}; compromisedEvents=${input.auditIntegrity.compromisedEvents}; chainBreaks=${input.auditIntegrity.chainBreaks}`,
    findings: input.auditIntegrity?.findings ?? ["audit_integrity_unavailable"],
    metrics: {
      trackedEvents: input.auditIntegrity?.totalTrackedEvents ?? null,
      verifiedEvents: input.auditIntegrity?.verifiedEvents ?? null,
      compromisedEvents: input.auditIntegrity?.compromisedEvents ?? null,
      missingEvents: input.auditIntegrity?.missingEvents ?? null,
      chainBreaks: input.auditIntegrity?.chainBreaks ?? null,
      latestChainHash: input.auditIntegrity?.latestChainHash ?? null,
    },
  });

  // Provider health check
  checks.push({
    checkId: "provider_health",
    label: "Provider Health",
    status:
      providerFindings.length > 0
        ? "fail_closed"
        : input.health.providerHealth === "healthy"
            ? "ok"
            : "degraded",
    summary:
      `providerHealth=${input.health.providerHealth}; `
      + `successRate=${input.health.providerSuccessRate}; recentCalls=${input.health.providerRecentCalls}`,
    findings: dedupeStrings([
      ...providerFindings.map((finding) => finding.message),
      ...(input.health.providerHealth === "healthy" ? [] : [`provider_health_${input.health.providerHealth}`]),
    ]),
    metrics: {
      providerHealth: input.health.providerHealth,
      providerSuccessRate: input.health.providerSuccessRate,
      providerRecentCalls: input.health.providerRecentCalls,
    },
  });

  return checks;
}

/**
 * Summarizes a collection of doctor check reports into aggregate statistics.
 */
export function summarizeDoctorChecks(checks: ReadonlyArray<DoctorCheckReport>): DoctorSelfCheckSummary {
  const okChecks = checks.filter((check) => check.status === "ok").length;
  const degradedChecks = checks.filter((check) => check.status === "degraded").length;
  const failClosedChecks = checks.filter((check) => check.status === "fail_closed").length;

  return {
    totalChecks: checks.length,
    okChecks,
    degradedChecks,
    failClosedChecks,
    failingCheckIds: checks.filter((check) => check.status !== "ok").map((check) => check.checkId),
  };
}

/**
 * Resolves the workspace root directory for doctor service operations.
 */
function resolveDoctorWorkspaceRoot(): string {
  return dirname(resolveConfigRoot());
}

/**
 * Deduplicates a string array while preserving order.
 */
function dedupeStrings(values: ReadonlyArray<string>): string[] {
  return Array.from(new Set(values));
}

/**
 * Collects unique sorted non-null values from an array.
 */
function uniqueSortedValues(values: ReadonlyArray<string | null>): string[] {
  return Array.from(new Set(values.filter((value): value is string => value != null && value.length > 0))).sort();
}
