/**
 * @fileoverview Stuck Run Sweeper Service
 *
 * Background worker that:
 * - Detects executions/runs that have been in non-terminal state too long
 * - Escalates stuck runs (warn → kill → cleanup)
 * - Integrates with recovery pipeline
 * - Configurable thresholds per HA level
 *
 * @see docs_zh/contracts/ha_coordinator_and_leader_election_contract.md
 */
import type { HaLevel, StuckRun, StuckRunSweeperConfig } from "./types.js";
/**
 * Options for creating a StuckRunSweeperService.
 */
export interface StuckRunSweeperServiceOptions {
    /** HA level (determines default thresholds) */
    haLevel?: HaLevel;
    /** Override configuration */
    config?: Partial<StuckRunSweeperConfig>;
    /** Callback when a stuck run is detected */
    onStuckRunDetected?: (run: StuckRun) => void;
    /** Callback when a warning is issued for a stuck run */
    onWarningIssued?: (run: StuckRun) => void;
    /** Callback when a run is killed */
    onRunKilled?: (run: StuckRun) => void;
    /** Callback when a run is cleaned up */
    onRunCleanedUp?: (run: StuckRun) => void;
    /** Callback to request execution kill */
    onKillExecution?: (executionId: string, reason: string) => Promise<boolean>;
    /** Callback to request execution cleanup */
    onCleanupExecution?: (executionId: string, reason: string) => Promise<boolean>;
}
/**
 * Stuck Run Sweeper Service
 *
 * Monitors for runs that have been inactive for too long and takes
 * escalating recovery actions:
 * 1. First detection: mark as stuck, emit warning
 * 2. After warning timeout: kill the execution
 * 3. After cleanup timeout: remove associated resources
 *
 * The service tracks runs in memory and persists state for recovery.
 */
export declare class StuckRunSweeperService {
    private intervalHandle;
    private disposed;
    private running;
    private readonly trackedRuns;
    private readonly MAX_TRACKED_RUNS;
    private readonly RUN_TTL_MS;
    private lastEvictionTime;
    private readonly EVICTION_INTERVAL_MS;
    private readonly config;
    private readonly onStuckRunDetected;
    private readonly onWarningIssued;
    private readonly onRunKilled;
    private readonly onRunCleanedUp;
    private readonly onKillExecution;
    private readonly onCleanupExecution;
    private metrics;
    constructor(options: StuckRunSweeperServiceOptions);
    /**
     * C-11: Evict expired tracked runs to prevent memory leaks.
     */
    private evictExpiredRuns;
    /**
     * Starts the stuck run sweeper background process.
     */
    start(): void;
    /**
     * Stops the stuck run sweeper background process.
     */
    stop(): void;
    /**
     * Disposes of the service.
     */
    dispose(): void;
    /**
     * Reports progress on a run (call periodically to reset stuck timer).
     */
    reportProgress(executionId: string, taskId: string, sessionId: string | null): void;
    /**
     * Notifies the sweeper that a run has started.
     */
    trackRun(executionId: string, taskId: string, sessionId: string | null): void;
    /**
     * Notifies the sweeper that a run has completed (terminal state).
     */
    markRunComplete(executionId: string): void;
    /**
     * Manually triggers a sweep cycle.
     */
    sweepOnce(): Promise<StuckRun[]>;
    /**
     * Returns the current configuration.
     */
    getConfig(): Readonly<StuckRunSweeperConfig>;
    /**
     * Returns the metrics.
     */
    getMetrics(): Readonly<typeof this.metrics>;
    /**
     * Returns the number of currently tracked runs.
     */
    getTrackedRunCount(): number;
    /**
     * Returns all runs currently being tracked.
     */
    getTrackedRuns(): StuckRun[];
    /**
     * Returns whether the service is currently running.
     */
    isRunning(): boolean;
    /**
     * Schedules the next sweep cycle.
     */
    private scheduleNextSweep;
    /**
     * Performs a single sweep cycle.
     */
    private doSweepCycle;
    /**
     * Processes a single run and takes appropriate action based on its state.
     */
    private processRun;
    /**
     * Issues a warning for a stuck run.
     */
    private emitWarning;
    /**
     * Kills a stuck run.
     */
    private killRun;
    /**
     * Cleans up a killed run.
     */
    private cleanupRun;
}
/**
 * Creates a StuckRunSweeperService with HA-level-appropriate defaults.
 */
export declare function createStuckRunSweeperService(options: StuckRunSweeperServiceOptions): StuckRunSweeperService;
