/**
 * Health Service
 *
 * ## Overview
 *
 * Monitors system health by tracking:
 * - Database writability
 * - Provider health (AI provider success rates)
 * - Active executions and queued tasks
 * - Memory usage and event loop lag
 * - Backpressure metrics
 *
 * ## Key Concepts
 *
 * - **Healthz**: Minimum health check endpoint
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: healthz}
 *
 * - **Backpressure**: System response to overload (delay, degrade, reject)
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: backpressure}
 *
 * - **SLO/SLA**: Service objectives and agreements
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: SLO/SLA}
 *
 * ## Health Status
 *
 * - ok: All systems operational
 * - degraded: Some degradation, reduced capacity
 * - overloaded: Near capacity, applying backpressure
 * - unhealthy: Critical issues requiring intervention
 *
 * @see Observability Contract: docs_zh/contracts/debug_inspect_health_backpressure_contract.md
 * @see Glossary: docs_zh/governance/glossary_and_terminology.md
 */
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import { ProviderHealthTracker } from "./provider-health-tracker.js";
/**
 * Configuration options for the HealthService including provider tracking,
 * memory thresholds, and event loop lag sampling.
 */
export interface HealthServiceOptions {
    /** Optional custom provider health tracker instance */
    providerTracker?: ProviderHealthTracker | null;
    /** Time window in milliseconds for calculating provider health metrics (default: 5 minutes) */
    providerWindowMs?: number;
    /** Memory high watermark in MB for degraded status (default: 512) */
    memoryHighWatermarkMb?: number;
    /** Event loop lag threshold in ms for degraded status (default: 200) */
    eventLoopLagThresholdMs?: number;
    /** Optional custom function to sample event loop lag */
    eventLoopLagSampler?: () => number;
    /** Pending queued task threshold for degraded status (default: 5) */
    queuedTaskDegradedThreshold?: number;
    /** Pending queued task threshold for overloaded status (default: 10) */
    queuedTaskOverloadedThreshold?: number;
    /** Tier 1 pending ack threshold for degraded status (default: 10) */
    tier1AckDegradedThreshold?: number;
    /** Tier 1 pending ack threshold for overloaded status (default: 25) */
    tier1AckOverloadedThreshold?: number;
    /** Active execution threshold for overloaded status (default: 10) */
    activeExecutionOverloadedThreshold?: number;
    /** Pending/claimed execution ticket oldest age threshold in seconds (default: 300) */
    queueStarvationThresholdSeconds?: number;
    /** Worker heartbeat staleness threshold in ms (default: 5 minutes) */
    staleWorkerThresholdMs?: number;
    /** Optional deterministic clock override used for queue and worker freshness calculations */
    nowMsSupplier?: () => number;
}
export interface QueueGovernanceHealthSummary {
    backlogSize: number;
    dispatchableBacklogSize: number;
    claimedBacklogSize: number;
    oldestWaitSeconds: number | null;
    oldestClaimAgeSeconds: number | null;
    queueNames: string[];
    starvationDetected: boolean;
}
export interface WorkerHealthSummary {
    totalWorkers: number;
    healthyWorkers: number;
    busyWorkers: number;
    drainingWorkers: number;
    degradedWorkers: number;
    quarantinedWorkers: number;
    offlineWorkers: number;
    remoteWorkers: number;
    remoteConnectedWorkers: number;
    remoteReconnectingWorkers: number;
    remoteDegradedSessions: number;
    remoteFailedSessions: number;
    remoteViewerOnlyWorkers: number;
    remoteConsistencyMismatchWorkers: number;
    remoteWorkspaceSyncConflictWorkers: number;
    remoteOffsetMissingWorkers: number;
    staleWorkers: number;
    staleBusyWorkers: number;
    loadSkewDetected: boolean;
    dominantWorkerId: string | null;
    dominantWorkerShare: number | null;
    skewedWorkerIds: string[];
}
/**
 * Complete health status report including system status, provider health,
 * execution metrics, memory usage, and degradation mode.
 */
export interface HealthStatusReport {
    status: "ok" | "degraded" | "overloaded" | "unhealthy";
    uptimeSeconds: number;
    dbWritable: boolean;
    providerHealth: "healthy" | "degraded" | "failed";
    providerSuccessRate: number;
    providerRecentCalls: number;
    activeExecutions: number;
    queuedTasks: number;
    eventLoopLagMs: number | null;
    memoryRssMb: number;
    tier1AckBacklog: number;
    degradationMode: "none" | "queue_only" | "fast_only" | "pause_non_critical" | "read_only_operations_only";
    queueGovernance: QueueGovernanceHealthSummary;
    workerHealth: WorkerHealthSummary;
    findings: string[];
}
/**
 * HealthService monitors system health by tracking database operations, provider
 * health, active executions, memory usage, event loop lag, and backpressure.
 * It generates health status reports used for load balancing, alerting, and
 * determining appropriate degradation modes under load.
 */
export declare class HealthService {
    private readonly db;
    private readonly store;
    private readonly startedAt;
    private readonly options;
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore, options?: HealthServiceOptions);
    /**
     * Generates a comprehensive health status report by querying database state,
     * memory usage, event loop lag, and provider health metrics.
     * Status transitions: ok -> degraded -> overloaded -> unhealthy
     * @returns Complete health status report with metrics and degradation mode
     */
    getReport(): HealthStatusReport;
    getReportAsync(): Promise<HealthStatusReport>;
    private buildQueueGovernanceSummary;
    private buildWorkerHealthSummary;
    /**
     * Checks if the database is writable using the appropriate method for the backend.
     * For SQLite: uses inline sync probe (CREATE/INSERT/DELETE).
     * For PostgreSQL: delegates to this.db.healthCheck() (async pg driver).
     * @returns true if database is writable, false otherwise
     */
    private checkDbWritableSync;
    private checkDbWritableAsync;
    private buildReport;
    /**
     * Executes a count query and returns the result as a number.
     * Used for counting active executions, queued tasks, and backpressure metrics.
     * @param sql - SQL count query to execute
     * @returns Count result as a number
     */
    private selectCount;
}
