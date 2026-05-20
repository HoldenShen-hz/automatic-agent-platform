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

import { AuthoritativeTaskStore } from "../../five-plane-state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../five-plane-state-evidence/truth/authoritative-sql-database.js";
import { summarizeWorkerLoadSkew } from "../../five-plane-execution/worker-pool/worker-load-balancing.js";
import {
  mapHealthDegradationModeToUnifiedRuntimeMode,
  type UnifiedRuntimeMode,
} from "../../contracts/types/unified-runtime-mode.js";
import { ProviderHealthTracker } from "./provider-health-tracker.js";
import { StructuredLogger } from "./structured-logger.js";

let healthLogger: StructuredLogger | null = null;

function getHealthLogger(): StructuredLogger {
  healthLogger ??= new StructuredLogger({ retentionLimit: 50 });
  return healthLogger;
}

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
  /** Minimum weighted degraded score required for an immediate degraded transition */
  degradedScoreThreshold?: number;
  /** Consecutive reports with only weak signals before escalating from ok to degraded */
  weakSignalEscalationWindow?: number;
  /** Consecutive clean reports required before clearing a degraded status */
  recoveryWindowReports?: number;
  /** Max age for reusing cached sync health reports before attempting live collection */
  syncSnapshotMaxAgeMs?: number;
  /** Allow synchronous runtime sampling in getReport(); when false, getReport falls back to cached/degraded data */
  allowSynchronousSampling?: boolean;
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

export interface BackpressureHealthSummary {
  status: HealthStatusReport["status"];
  degradationMode: HealthStatusReport["degradationMode"];
  tier1AckBacklog: number;
  queueGovernance: QueueGovernanceHealthSummary;
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
  backpressure: BackpressureHealthSummary;
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
export class HealthService {
  private readonly startedAt = Date.now();
  private readonly options: Required<HealthServiceOptions>;
  private previousWeakSignalDetected = false;
  private previousStatus: HealthStatusReport["status"] = "ok";
  private cleanRecoveryStreak = 0;
  private cachedReport: HealthStatusReport | null = null;
  private cachedReportAtMs: number | null = null;

  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    private readonly store: AuthoritativeTaskStore,
    options: HealthServiceOptions = {},
  ) {
    this.options = {
      providerTracker: options.providerTracker ?? null,
      providerWindowMs: options.providerWindowMs ?? 5 * 60_000,
      memoryHighWatermarkMb: options.memoryHighWatermarkMb ?? 512,
      eventLoopLagThresholdMs: options.eventLoopLagThresholdMs ?? 200,
      eventLoopLagSampler: options.eventLoopLagSampler ?? (() => 0),
      queuedTaskDegradedThreshold: options.queuedTaskDegradedThreshold ?? 5,
      queuedTaskOverloadedThreshold: options.queuedTaskOverloadedThreshold ?? 10,
      tier1AckDegradedThreshold: options.tier1AckDegradedThreshold ?? 10,
      tier1AckOverloadedThreshold: options.tier1AckOverloadedThreshold ?? 25,
      activeExecutionOverloadedThreshold: options.activeExecutionOverloadedThreshold ?? 10,
      queueStarvationThresholdSeconds: options.queueStarvationThresholdSeconds ?? 5 * 60,
      staleWorkerThresholdMs: options.staleWorkerThresholdMs ?? 5 * 60_000,
      nowMsSupplier: options.nowMsSupplier ?? Date.now,
      degradedScoreThreshold: options.degradedScoreThreshold ?? 2,
      weakSignalEscalationWindow: options.weakSignalEscalationWindow ?? 2,
      recoveryWindowReports: options.recoveryWindowReports ?? 2,
      syncSnapshotMaxAgeMs: options.syncSnapshotMaxAgeMs ?? 5_000,
      allowSynchronousSampling: options.allowSynchronousSampling ?? true,
    };
  }

  /**
   * Generates a comprehensive health status report by querying database state,
   * memory usage, event loop lag, and provider health metrics.
   * Status transitions: ok -> degraded -> overloaded -> unhealthy
   * @returns Complete health status report with metrics and degradation mode
   */
  public getReport(): HealthStatusReport {
    const nowMs = this.options.nowMsSupplier();
    if (!this.options.allowSynchronousSampling || this.db.backendType === "postgres") {
      if (this.isCachedReportFresh(nowMs)) {
        return this.cachedReport!;
      }
      return this.buildCachedFallbackReport(nowMs, this.checkDbWritableSync());
    }
    const report = this.buildReport(nowMs, this.checkDbWritableSync());
    this.cacheReport(nowMs, report);
    return report;
  }

  /**
   * Backward-compatible alias retained for older tests and call sites.
   */
  public checkHealth(): HealthStatusReport {
    return this.getReport();
  }

  public async getReportAsync(): Promise<HealthStatusReport> {
    const nowMs = this.options.nowMsSupplier();
    const report = this.buildReport(nowMs, await this.checkDbWritableAsync());
    this.cacheReport(nowMs, report);
    return report;
  }

  private isCachedReportFresh(nowMs: number): boolean {
    return this.cachedReport != null
      && this.cachedReportAtMs != null
      && (nowMs - this.cachedReportAtMs) <= this.options.syncSnapshotMaxAgeMs;
  }

  private cacheReport(nowMs: number, report: HealthStatusReport): void {
    this.cachedReport = report;
    this.cachedReportAtMs = nowMs;
  }

  private buildCachedFallbackReport(nowMs: number, dbWritable: boolean): HealthStatusReport {
    if (this.cachedReport != null) {
      const findings = new Set(this.cachedReport.findings);
      findings.add("health_signal_collection_degraded");
      const status =
        !dbWritable
          ? "unhealthy"
          : this.cachedReport.status === "ok"
            ? "degraded"
            : this.cachedReport.status;
      const degradationMode =
        !dbWritable
          ? "read_only_operations_only"
          : this.cachedReport.degradationMode === "none"
            ? "queue_only"
            : this.cachedReport.degradationMode;
      return {
        ...this.cachedReport,
        status,
        dbWritable,
        findings: [...findings],
        degradationMode,
        backpressure: {
          ...this.cachedReport.backpressure,
          status,
          degradationMode,
        },
        uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      };
    }

    const providerSummary =
      this.options.providerTracker?.getSummary(this.options.providerWindowMs) ?? {
        status: "healthy" as const,
        successRate: 1,
        totalCalls: 0,
      };
    const memoryRssMb = Math.round((process.memoryUsage().rss / 1024 / 1024) * 100) / 100;
    const eventLoopLagMs = Math.round(this.options.eventLoopLagSampler() * 100) / 100;
    const status: HealthStatusReport["status"] = dbWritable ? "degraded" : "unhealthy";
    const degradationMode: HealthStatusReport["degradationMode"] = dbWritable
      ? "queue_only"
      : "read_only_operations_only";
    return {
      status,
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      dbWritable,
      providerHealth: providerSummary.status,
      providerSuccessRate: providerSummary.successRate,
      providerRecentCalls: providerSummary.totalCalls,
      activeExecutions: 0,
      queuedTasks: 0,
      eventLoopLagMs,
      memoryRssMb,
      tier1AckBacklog: 0,
      degradationMode,
      queueGovernance: {
        backlogSize: 0,
        dispatchableBacklogSize: 0,
        claimedBacklogSize: 0,
        oldestWaitSeconds: null,
        oldestClaimAgeSeconds: null,
        queueNames: [],
        starvationDetected: false,
      },
      workerHealth: {
        totalWorkers: 0,
        healthyWorkers: 0,
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
      backpressure: {
        status,
        degradationMode,
        tier1AckBacklog: 0,
        queueGovernance: {
          backlogSize: 0,
          dispatchableBacklogSize: 0,
          claimedBacklogSize: 0,
          oldestWaitSeconds: null,
          oldestClaimAgeSeconds: null,
          queueNames: [],
          starvationDetected: false,
        },
      },
      findings: ["health_signal_collection_degraded"],
    };
  }

  private buildQueueGovernanceSummary(nowMs: number): QueueGovernanceHealthSummary {
    const tickets = this.store.worker?.listExecutionTicketsByStatuses?.(["pending", "claimed"]) ?? [];
    const queueNames = Array.from(
      new Set(
        tickets
          .map((ticket) => ticket.queueName ?? "default")
          .filter((queueName) => queueName.length > 0),
      ),
    ).sort();
    const pendingTickets = tickets.filter((ticket) => ticket.status === "pending");
    const claimedTickets = tickets.filter((ticket) => ticket.status === "claimed");
    const nowIso = new Date(nowMs).toISOString();
    const dispatchableBacklogSize = pendingTickets.filter((ticket) => ticket.dispatchAfter == null || ticket.dispatchAfter <= nowIso)
      .length;
    const oldestWaitSeconds = oldestAgeSeconds(
      pendingTickets.map((ticket) => ticket.createdAt),
      nowMs,
    );
    const oldestClaimAgeSeconds = oldestAgeSeconds(
      claimedTickets
        .map((ticket) => ticket.claimedAt)
        .filter((claimedAt): claimedAt is string => claimedAt != null),
      nowMs,
    );
    return {
      backlogSize: tickets.length,
      dispatchableBacklogSize,
      claimedBacklogSize: claimedTickets.length,
      oldestWaitSeconds,
      oldestClaimAgeSeconds,
      queueNames,
      starvationDetected:
        (oldestWaitSeconds ?? 0) >= this.options.queueStarvationThresholdSeconds ||
        (oldestClaimAgeSeconds ?? 0) >= this.options.queueStarvationThresholdSeconds,
    };
  }

  private buildWorkerHealthSummary(nowMs: number): WorkerHealthSummary {
    const staleBefore = new Date(nowMs - this.options.staleWorkerThresholdMs).toISOString();
    const workers = this.store.worker?.listWorkerSnapshots?.() ?? [];
    const staleWorkers = this.store.worker?.listStaleWorkerSnapshots?.(staleBefore) ?? [];
    const loadSkew = summarizeWorkerLoadSkew(
      workers.map((worker) => {
        const runningExecutionCount = parseRunningExecutionCount(worker.runningExecutionsJson);
        return {
          workerId: worker.workerId,
          queueAffinity: worker.queueAffinity,
          maxConcurrency: worker.maxConcurrency,
          availableSlots: Math.max(worker.maxConcurrency - runningExecutionCount, 0),
          activeLeaseCount: worker.activeLeaseCount ?? 0,
          runningExecutionCount,
          saturation: worker.saturation ?? null,
          toolBacklogCount: worker.toolBacklogCount ?? 0,
          cpuPct: worker.cpuPct ?? null,
        };
      }),
    );
    return {
      totalWorkers: workers.length,
      healthyWorkers: workers.filter((worker) => worker.status === "idle" || worker.status === "busy").length,
      busyWorkers: workers.filter((worker) => worker.status === "busy").length,
      drainingWorkers: workers.filter((worker) => worker.status === "draining").length,
      degradedWorkers: workers.filter((worker) => worker.status === "degraded").length,
      quarantinedWorkers: workers.filter((worker) => worker.status === "quarantined").length,
      offlineWorkers: workers.filter((worker) => worker.status === "offline").length,
      remoteWorkers: workers.filter((worker) => worker.placement === "remote").length,
      remoteConnectedWorkers: workers.filter(
        (worker) => worker.placement === "remote" && worker.remoteSessionStatus === "connected",
      ).length,
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
        (worker) => worker.placement === "remote" && worker.sessionConsistencyCheckStatus === "mismatch",
      ).length,
      remoteWorkspaceSyncConflictWorkers: workers.filter(
        (worker) => worker.placement === "remote" && worker.workspaceSyncStatus === "conflict",
      ).length,
      remoteOffsetMissingWorkers: workers.filter(
        (worker) =>
          worker.placement === "remote"
          && worker.remoteSessionStatus != null
          && worker.remoteSessionStatus !== "connecting"
          && worker.remoteSessionStatus !== "failed"
          && (worker.lastAcknowledgedStreamOffset == null || worker.lastAcknowledgedStreamOffset.length === 0),
      ).length,
      staleWorkers: staleWorkers.length,
      staleBusyWorkers: staleWorkers.filter(
        (worker) => worker.status === "busy" || worker.status === "draining" || parseRunningExecutionCount(worker.runningExecutionsJson) > 0,
      ).length,
      loadSkewDetected: loadSkew.detected,
      dominantWorkerId: loadSkew.dominantWorkerId,
      dominantWorkerShare: loadSkew.dominantWorkerShare,
      skewedWorkerIds: loadSkew.skewedWorkerIds,
    };
  }

  /**
   * Checks if the database is writable using the appropriate method for the backend.
   * For SQLite: uses inline sync probe (CREATE/INSERT/DELETE).
   * For PostgreSQL: delegates to this.db.healthCheck() (async pg driver).
   * @returns true if database is writable, false otherwise
   */
  private checkDbWritableSync(): boolean {
    // SQLite: use the inline sync probe (same as before)
    try {
      this.db.connection.exec("CREATE TABLE IF NOT EXISTS __health_probe (id INTEGER PRIMARY KEY, created_at TEXT)");
      this.db.connection.exec("INSERT INTO __health_probe(created_at) VALUES (CURRENT_TIMESTAMP)");
      this.db.connection.exec("DELETE FROM __health_probe");
      return true;
    } catch (err) {
      getHealthLogger().log({ level: "warn", message: "Database writability check failed", data: { error: err } });
      return false;
    }
  }

  private async checkDbWritableAsync(): Promise<boolean> {
    if (this.db.backendType === "postgres") {
      try {
        return await this.db.healthCheck();
      } catch (err) {
        getHealthLogger().log({ level: "warn", message: "Async database health check failed", data: { error: err } });
        return false;
      }
    }
    return this.checkDbWritableSync();
  }

  private buildReport(nowMs: number, dbWritable: boolean): HealthStatusReport {
    const activeExecutions = this.selectCount(
      "SELECT COUNT(*) AS count FROM executions WHERE status IN ('created','prechecking','executing','blocked')",
    );
    const queuedTasks = this.selectCount("SELECT COUNT(*) AS count FROM tasks WHERE status IN ('queued','pending')");
    const tier1AckBacklog = this.selectCount(
      "SELECT COUNT(*) AS count FROM event_consumer_acks WHERE status = 'pending'",
    );
    const memoryRssMb = Math.round((process.memoryUsage().rss / 1024 / 1024) * 100) / 100;
    const providerSummary =
      this.options.providerTracker?.getSummary(this.options.providerWindowMs) ?? {
        status: "healthy" as const,
        successRate: 1,
        totalCalls: 0,
      };
    const eventLoopLagMs = Math.round(this.options.eventLoopLagSampler() * 100) / 100;
    const queueGovernance = this.buildQueueGovernanceSummary(nowMs);
    const workerHealth = this.buildWorkerHealthSummary(nowMs);
    const findings: string[] = [];

    if (!dbWritable) {
      findings.push("db_not_writable");
    }
    if (providerSummary.status === "failed") {
      findings.push("provider_failed");
    } else if (providerSummary.status === "degraded") {
      findings.push("provider_degraded");
    }
    if (queuedTasks > this.options.queuedTaskOverloadedThreshold) {
      findings.push("queued_tasks_overloaded");
    } else if (queuedTasks > this.options.queuedTaskDegradedThreshold) {
      findings.push("queued_tasks_degraded");
    }
    if (tier1AckBacklog > this.options.tier1AckOverloadedThreshold) {
      findings.push("tier1_ack_backlog_overloaded");
    } else if (tier1AckBacklog > this.options.tier1AckDegradedThreshold) {
      findings.push("tier1_ack_backlog_degraded");
    }
    if (activeExecutions > this.options.activeExecutionOverloadedThreshold) {
      findings.push("active_executions_overloaded");
    }
    if (memoryRssMb > this.options.memoryHighWatermarkMb * 1.1) {
      findings.push("memory_pressure_overloaded");
    } else if (memoryRssMb > this.options.memoryHighWatermarkMb) {
      findings.push("memory_pressure_degraded");
    }
    if (eventLoopLagMs > this.options.eventLoopLagThresholdMs * 1.5) {
      findings.push("event_loop_lag_overloaded");
    } else if (eventLoopLagMs > this.options.eventLoopLagThresholdMs) {
      findings.push("event_loop_lag_degraded");
    }
    if (queueGovernance.backlogSize > this.options.queuedTaskOverloadedThreshold) {
      findings.push("queue_backlog_overloaded");
    } else if (queueGovernance.backlogSize > this.options.queuedTaskDegradedThreshold) {
      findings.push("queue_backlog_degraded");
    }
    if (queueGovernance.starvationDetected) {
      findings.push("queue_starvation_detected");
    }
    if (workerHealth.staleBusyWorkers > 0) {
      findings.push("stale_workers_detected");
    }
    if (workerHealth.remoteReconnectingWorkers > 0) {
      findings.push("remote_session_reconnecting");
    }
    if (workerHealth.remoteDegradedSessions > 0) {
      findings.push("remote_session_degraded");
    }
    if (workerHealth.remoteFailedSessions > 0) {
      findings.push("remote_session_failed");
    }
    if (workerHealth.remoteViewerOnlyWorkers > 0) {
      findings.push("remote_session_viewer_only");
    }
    if (workerHealth.remoteConsistencyMismatchWorkers > 0) {
      findings.push("remote_session_consistency_mismatch");
    }
    if (workerHealth.remoteWorkspaceSyncConflictWorkers > 0) {
      findings.push("remote_workspace_sync_conflict");
    }
    if (workerHealth.remoteOffsetMissingWorkers > 0) {
      findings.push("remote_stream_offset_missing");
    }
    if (workerHealth.loadSkewDetected) {
      findings.push("worker_load_skew_detected");
    }

    let status: HealthStatusReport["status"] = "ok";
    const degradedScore = calculateDegradedScore({
      providerStatus: providerSummary.status,
      queuedTasks,
      queuedTaskDegradedThreshold: this.options.queuedTaskDegradedThreshold,
      tier1AckBacklog,
      tier1AckDegradedThreshold: this.options.tier1AckDegradedThreshold,
      queueBacklogSize: queueGovernance.backlogSize,
      staleBusyWorkers: workerHealth.staleBusyWorkers,
      remoteReconnectingWorkers: workerHealth.remoteReconnectingWorkers,
      remoteDegradedSessions: workerHealth.remoteDegradedSessions,
      remoteViewerOnlyWorkers: workerHealth.remoteViewerOnlyWorkers,
      remoteConsistencyMismatchWorkers: workerHealth.remoteConsistencyMismatchWorkers,
      remoteWorkspaceSyncConflictWorkers: workerHealth.remoteWorkspaceSyncConflictWorkers,
      remoteOffsetMissingWorkers: workerHealth.remoteOffsetMissingWorkers,
      loadSkewDetected: workerHealth.loadSkewDetected,
      memoryRssMb,
      memoryHighWatermarkMb: this.options.memoryHighWatermarkMb,
      eventLoopLagMs,
      eventLoopLagThresholdMs: this.options.eventLoopLagThresholdMs,
    });
    const weakSignalDetected = degradedScore > 0 && degradedScore < this.options.degradedScoreThreshold;
    if (!dbWritable) {
      status = "unhealthy";
    } else if (
      tier1AckBacklog > this.options.tier1AckOverloadedThreshold ||
      activeExecutions > this.options.activeExecutionOverloadedThreshold ||
      queuedTasks > this.options.queuedTaskOverloadedThreshold ||
      queueGovernance.backlogSize > this.options.queuedTaskOverloadedThreshold ||
      queueGovernance.starvationDetected ||
      providerSummary.status === "failed" ||
      workerHealth.remoteFailedSessions > 0 ||
      memoryRssMb > this.options.memoryHighWatermarkMb * 1.1 ||
      eventLoopLagMs > this.options.eventLoopLagThresholdMs * 1.5
    ) {
      status = "overloaded";
    } else if (
      degradedScore >= this.options.degradedScoreThreshold
      || (
        weakSignalDetected
        && this.options.weakSignalEscalationWindow <= 2
        && this.previousWeakSignalDetected
      )
    ) {
      status = "degraded";
    }

    if (status === "ok") {
      if (this.previousStatus === "degraded" && degradedScore === 0 && this.cleanRecoveryStreak + 1 < this.options.recoveryWindowReports) {
        status = "degraded";
        this.cleanRecoveryStreak += 1;
      } else if (degradedScore === 0) {
        this.cleanRecoveryStreak = 0;
      }
    } else {
      this.cleanRecoveryStreak = 0;
    }
    this.previousWeakSignalDetected = weakSignalDetected;
    this.previousStatus = status;

    const queuePressureDetected =
      queueGovernance.starvationDetected ||
      queueGovernance.backlogSize > this.options.queuedTaskDegradedThreshold ||
      activeExecutions > this.options.activeExecutionOverloadedThreshold ||
      queuedTasks > this.options.queuedTaskDegradedThreshold ||
      workerHealth.staleBusyWorkers > 0;
    const performancePressureDetected =
      memoryRssMb > this.options.memoryHighWatermarkMb || eventLoopLagMs > this.options.eventLoopLagThresholdMs;
    const severePerformancePressureDetected =
      memoryRssMb > this.options.memoryHighWatermarkMb * 1.1 ||
      eventLoopLagMs > this.options.eventLoopLagThresholdMs * 1.5;

    const degradationMode: HealthStatusReport["degradationMode"] =
      status === "ok"
        ? "none"
        : !dbWritable
          ? "read_only_operations_only"
          : tier1AckBacklog > this.options.tier1AckOverloadedThreshold
            ? "pause_non_critical"
            : queuePressureDetected || severePerformancePressureDetected
              ? "queue_only"
              : providerSummary.status !== "healthy" || performancePressureDetected
                ? "fast_only"
                : "queue_only";

    return {
      status,
      uptimeSeconds: Math.max(0, Math.floor((nowMs - this.startedAt) / 1000)),
      dbWritable,
      providerHealth: providerSummary.status,
      providerSuccessRate: providerSummary.successRate,
      providerRecentCalls: providerSummary.totalCalls,
      activeExecutions,
      queuedTasks,
      eventLoopLagMs,
      memoryRssMb,
      tier1AckBacklog,
      degradationMode,
      backpressure: {
        status,
        degradationMode,
        tier1AckBacklog,
        queueGovernance,
      },
      queueGovernance,
      workerHealth,
      findings,
    };
  }

  /**
   * Executes a count query and returns the result as a number.
   * Used for counting active executions, queued tasks, and backpressure metrics.
   * @param sql - SQL count query to execute
   * @returns Count result as a number
   */
  private selectCount(sql: string): number {
    const row = this.db.connection.prepare(sql).get() as { count?: number } | undefined;
    return Number(row?.count ?? 0);
  }
}

function calculateDegradedScore(input: {
  providerStatus: "healthy" | "degraded" | "failed";
  queuedTasks: number;
  queuedTaskDegradedThreshold: number;
  tier1AckBacklog: number;
  tier1AckDegradedThreshold: number;
  queueBacklogSize: number;
  staleBusyWorkers: number;
  remoteReconnectingWorkers: number;
  remoteDegradedSessions: number;
  remoteViewerOnlyWorkers: number;
  remoteConsistencyMismatchWorkers: number;
  remoteWorkspaceSyncConflictWorkers: number;
  remoteOffsetMissingWorkers: number;
  loadSkewDetected: boolean;
  memoryRssMb: number;
  memoryHighWatermarkMb: number;
  eventLoopLagMs: number;
  eventLoopLagThresholdMs: number;
}): number {
  let score = 0;
  if (input.providerStatus === "degraded") {
    score += 2;
  }
  if (input.queuedTasks > input.queuedTaskDegradedThreshold) {
    score += 2;
  }
  if (input.tier1AckBacklog > input.tier1AckDegradedThreshold) {
    score += 2;
  }
  if (input.queueBacklogSize > input.queuedTaskDegradedThreshold) {
    score += 2;
  }
  if (input.staleBusyWorkers > 0) {
    score += 3;
  }
  if (input.remoteReconnectingWorkers > 0) {
    score += 1;
  }
  if (input.remoteDegradedSessions > 0) {
    score += 1;
  }
  if (input.remoteViewerOnlyWorkers > 0) {
    score += 1;
  }
  if (input.remoteConsistencyMismatchWorkers > 0) {
    score += 2;
  }
  if (input.remoteWorkspaceSyncConflictWorkers > 0) {
    score += 2;
  }
  if (input.remoteOffsetMissingWorkers > 0) {
    score += 1;
  }
  if (input.loadSkewDetected) {
    score += 1;
  }
  if (input.memoryRssMb > input.memoryHighWatermarkMb) {
    score += 2;
  }
  if (input.eventLoopLagMs > input.eventLoopLagThresholdMs) {
    score += 2;
  }
  return score;
}

export function toUnifiedRuntimeMode(mode: HealthStatusReport["degradationMode"]): UnifiedRuntimeMode {
  return mapHealthDegradationModeToUnifiedRuntimeMode(mode);
}

function oldestAgeSeconds(timestamps: string[], nowMs: number): number | null {
  let oldest: number | null = null;
  for (const timestamp of timestamps) {
    const parsed = Date.parse(timestamp);
    if (!Number.isFinite(parsed)) {
      continue;
    }
    oldest = oldest == null ? parsed : Math.min(oldest, parsed);
  }

  if (oldest == null) {
    return null;
  }

  return Math.max(0, Math.round((nowMs - oldest) / 1000));
}

function parseRunningExecutionCount(runningExecutionsJson: string): number {
  try {
    const parsed = JSON.parse(runningExecutionsJson) as unknown;
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch (err) {
    getHealthLogger().log({ level: "debug", message: "Failed to parse running execution count", data: { error: err instanceof Error ? err.message : String(err) } });
    return 0;
  }
}
