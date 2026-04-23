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
import { HealthService } from "../../shared/observability/health-service.js";
import { ProtectedGovernanceIntegrityService, type ProtectedGovernanceDriftReport } from "../config-center/protected-governance-integrity-service.js";
import { StorageQuotaService, type StorageQuotaEnforcementReport } from "../../state-evidence/truth/storage-quota-service.js";
import { type StorageBackendRuntimeProfile } from "../../state-evidence/truth/storage-backend-config.js";
import { ExecutionResourceMonitor } from "../../execution/dispatcher/execution-resource-monitor.js";
import { RuntimeRecoveryService } from "../../execution/recovery/runtime-recovery-service-root.js";
import { StalledExecutionDetector } from "../../execution/recovery/stalled-execution-detector.js";
import { StalledExecutionEscalationService } from "../../execution/recovery/stalled-execution-escalation-service.js";
import { StartupConsistencyChecker } from "../../execution/startup/startup-consistency-checker.js";
import { WorkerRegistryService } from "../../execution/worker-pool/worker-registry-service.js";
import { SqliteReliabilityService, type SqliteBackupReport } from "../../state-evidence/truth/sqlite/sqlite-reliability-service.js";
import type { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { ObservabilityRetentionReport } from "../../shared/observability/observability-retention-service.js";
import { ObservabilityRetentionService } from "../../shared/observability/observability-retention-service.js";
import type { Tier1AuditIntegrityReport } from "../iam/audit-event-integrity.js";
import { type RuntimeVersionSnapshot } from "./runtime-version-snapshot.js";
export type DoctorCheckId = "db" | "config" | "backup" | "locks" | "workers" | "event_backlog" | "audit_integrity" | "provider_health";
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
    sqliteReliability: ReturnType<SqliteReliabilityService["getReport"]> & {
        backup: SqliteBackupReport | null;
    };
    protectedGovernance: ProtectedGovernanceDriftReport;
    storageQuota: StorageQuotaEnforcementReport | null;
    observabilityRetention: ObservabilityRetentionReport | null;
}
/**
 * DoctorService runs a comprehensive health diagnostic across multiple subsystems.
 * It aggregates check results from database, config, backup, locks, workers,
 * event backlog, audit integrity, and provider health into a unified report.
 */
export declare class DoctorService {
    private readonly healthService;
    private readonly startupChecker;
    private readonly runtimeRecovery;
    private readonly stalledDetector;
    private readonly sqliteReliability;
    private readonly backupPath;
    private readonly protectedGovernance;
    private readonly storageQuota;
    private readonly workerRegistry;
    private readonly observabilityRetention;
    private readonly stalledEscalationService;
    private readonly resourceMonitor;
    private readonly options;
    constructor(healthService: HealthService, startupChecker: StartupConsistencyChecker, runtimeRecovery?: RuntimeRecoveryService | null, stalledDetector?: StalledExecutionDetector | null, sqliteReliability?: SqliteReliabilityService | null, backupPath?: string | null, protectedGovernance?: ProtectedGovernanceIntegrityService | null, storageQuota?: StorageQuotaService | null, workerRegistry?: WorkerRegistryService | null, observabilityRetention?: ObservabilityRetentionService | null, stalledEscalationService?: StalledExecutionEscalationService | null, resourceMonitor?: ExecutionResourceMonitor | null, options?: DoctorServiceOptions);
    /**
     * Runs all diagnostic checks and produces a comprehensive doctor report.
     * This is the main entry point for system health diagnostics.
     *
     * @returns Complete doctor report with all check results and subsystem status
     */
    run(): DoctorReport;
}
/**
 * Summarizes a collection of doctor check reports into aggregate statistics.
 */
export declare function summarizeDoctorChecks(checks: ReadonlyArray<DoctorCheckReport>): DoctorSelfCheckSummary;
