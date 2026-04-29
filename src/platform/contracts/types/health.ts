/**
 * Health and Backpressure Contract Types
 *
 * Defines the inter-plane contract for health reporting and backpressure.
 * This allows P4 (Execution) to consume health data without direct coupling
 * to P5 (Evidence) internals.
 *
 * @see docs_zh/architecture/00-platform-architecture.md §14.9
 */

/**
 * Health status levels.
 */
export type HealthStatusLevel = "ok" | "degraded" | "overloaded" | "unhealthy";

/**
 * Degradation mode for backpressure.
 */
export type DegradationMode =
  | "none"
  | "queue_only"
  | "fast_only"
  | "pause_non_critical"
  | "read_only_operations_only";

/**
 * Queue governance health summary.
 */
export interface QueueGovernanceHealthSummary {
  readonly backlogSize: number;
  readonly dispatchableBacklogSize: number;
  readonly claimedBacklogSize: number;
  readonly oldestWaitSeconds: number | null;
  readonly oldestClaimAgeSeconds: number | null;
  readonly queueNames: readonly string[];
  readonly starvationDetected: boolean;
}

/**
 * Backpressure health summary embedded in health report.
 */
export interface BackpressureHealthSummary {
  readonly status: HealthStatusLevel;
  readonly degradationMode: DegradationMode;
  readonly tier1AckBacklog: number;
  readonly queueGovernance: QueueGovernanceHealthSummary;
}

/**
 * Worker health summary.
 */
export interface WorkerHealthSummary {
  readonly totalWorkers: number;
  readonly healthyWorkers: number;
  readonly busyWorkers: number;
  readonly drainingWorkers: number;
  readonly degradedWorkers: number;
  readonly quarantinedWorkers: number;
  readonly offlineWorkers: number;
  readonly remoteWorkers: number;
  readonly remoteConnectedWorkers: number;
  readonly remoteReconnectingWorkers: number;
  readonly remoteDegradedSessions: number;
  readonly remoteFailedSessions: number;
  readonly remoteViewerOnlyWorkers: number;
  readonly remoteConsistencyMismatchWorkers: number;
  readonly remoteWorkspaceSyncConflictWorkers: number;
  readonly remoteOffsetMissingWorkers: number;
  readonly staleWorkers: number;
  readonly staleBusyWorkers: number;
  readonly loadSkewDetected: boolean;
  readonly dominantWorkerId: string | null;
  readonly dominantWorkerShare: number | null;
  readonly skewedWorkerIds: readonly string[];
}

/**
 * Complete health status report.
 */
export interface HealthStatusReport {
  readonly status: HealthStatusLevel;
  readonly uptimeSeconds: number;
  readonly dbWritable: boolean;
  readonly providerHealth: "healthy" | "degraded" | "failed";
  readonly providerSuccessRate: number;
  readonly providerRecentCalls: number;
  readonly activeExecutions: number;
  readonly queuedTasks: number;
  readonly eventLoopLagMs: number | null;
  readonly memoryRssMb: number;
  readonly tier1AckBacklog: number;
  readonly degradationMode: DegradationMode;
  readonly backpressure: BackpressureHealthSummary;
  readonly queueGovernance: QueueGovernanceHealthSummary;
  readonly workerHealth: WorkerHealthSummary;
  readonly findings: readonly string[];
}

/**
 * Port interface for health reporting.
 *
 * Implementations provide health status reports without exposing
 * P5 (Evidence) internal details to consumers.
 */
export interface HealthReportProvider {
  /**
   * Returns the current health status report.
   */
  getReport(): HealthStatusReport;
}

/**
 * Creates a no-op health report provider that returns a healthy status.
 */
export function createNoOpHealthReportProvider(): HealthReportProvider {
  return {
    getReport(): HealthStatusReport {
      return {
        status: "ok",
        uptimeSeconds: 0,
        dbWritable: true,
        providerHealth: "healthy",
        providerSuccessRate: 1,
        providerRecentCalls: 0,
        activeExecutions: 0,
        queuedTasks: 0,
        eventLoopLagMs: null,
        memoryRssMb: 0,
        tier1AckBacklog: 0,
        degradationMode: "none",
        backpressure: {
          status: "ok",
          degradationMode: "none",
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
        findings: [],
      };
    },
  };
}
