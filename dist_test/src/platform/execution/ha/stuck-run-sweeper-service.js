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
import { nowIso } from "../../contracts/types/ids.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { HA_LEVEL_CONFIGS } from "./types.js";
// ── Logger ─────────────────────────────────────────────────────────
const logger = new StructuredLogger({ retentionLimit: 200 });
// ── Default Configuration ─────────────────────────────────────────
const DEFAULT_STUCK_THRESHOLD_MS = 1_800_000; // 30 minutes
const DEFAULT_KILL_AFTER_WARNING_MS = 60_000; // 1 minute
const DEFAULT_CLEANUP_AFTER_KILL_MS = 300_000; // 5 minutes
const DEFAULT_SWEEP_INTERVAL_MS = 60_000; // 1 minute
const DEFAULT_MAX_RUNS_PER_SWEEP = 100;
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
export class StuckRunSweeperService {
    intervalHandle = null;
    disposed = false;
    running = false;
    // In-memory state for tracked runs
    trackedRuns = new Map();
    config;
    onStuckRunDetected;
    onWarningIssued;
    onRunKilled;
    onRunCleanedUp;
    onKillExecution;
    onCleanupExecution;
    // Metrics
    metrics = {
        totalDetected: 0,
        totalWarnings: 0,
        totalKilled: 0,
        totalCleanedUp: 0,
        totalResolved: 0,
    };
    constructor(options) {
        this.onStuckRunDetected = options.onStuckRunDetected ?? undefined;
        this.onWarningIssued = options.onWarningIssued ?? undefined;
        this.onRunKilled = options.onRunKilled ?? undefined;
        this.onRunCleanedUp = options.onRunCleanedUp ?? undefined;
        this.onKillExecution = options.onKillExecution ?? undefined;
        this.onCleanupExecution = options.onCleanupExecution ?? undefined;
        // Build config with defaults
        const haLevel = options.haLevel ?? "HA_2";
        const haDefaults = HA_LEVEL_CONFIGS[haLevel];
        this.config = {
            sweepIntervalMs: options.config?.sweepIntervalMs ?? haDefaults.stuckRunSweeperIntervalMs,
            stuckThresholdMs: options.config?.stuckThresholdMs ?? haDefaults.stuckRunThresholdMs,
            killAfterWarningMs: options.config?.killAfterWarningMs ?? DEFAULT_KILL_AFTER_WARNING_MS,
            cleanupAfterKillMs: options.config?.cleanupAfterKillMs ?? DEFAULT_CLEANUP_AFTER_KILL_MS,
            maxRunsPerSweep: options.config?.maxRunsPerSweep ?? DEFAULT_MAX_RUNS_PER_SWEEP,
        };
        if (this.config.sweepIntervalMs <= 0) {
            logger.log({
                level: "warn",
                message: "stuck_run_sweeper.disabled",
                data: { reason: "sweepIntervalMs is 0", haLevel },
            });
        }
        logger.log({
            level: "info",
            message: "stuck_run_sweeper.service_created",
            data: {
                haLevel,
                config: this.config,
            },
        });
    }
    // ── Public API ────────────────────────────────────────────────────
    /**
     * Starts the stuck run sweeper background process.
     */
    start() {
        if (this.disposed) {
            throw new Error("Cannot start disposed StuckRunSweeperService");
        }
        if (this.running) {
            return;
        }
        if (this.config.sweepIntervalMs <= 0) {
            logger.log({
                level: "info",
                message: "stuck_run_sweeper.not_started",
                data: { reason: "disabled by config" },
            });
            return;
        }
        this.running = true;
        this.scheduleNextSweep();
        logger.log({
            level: "info",
            message: "stuck_run_sweeper.started",
            data: { intervalMs: this.config.sweepIntervalMs },
        });
    }
    /**
     * Stops the stuck run sweeper background process.
     */
    stop() {
        this.running = false;
        if (this.intervalHandle !== null) {
            clearInterval(this.intervalHandle);
            this.intervalHandle = null;
        }
        logger.log({
            level: "info",
            message: "stuck_run_sweeper.stopped",
        });
    }
    /**
     * Disposes of the service.
     */
    dispose() {
        this.stop();
        this.disposed = true;
        this.trackedRuns.clear();
    }
    /**
     * Reports progress on a run (call periodically to reset stuck timer).
     */
    reportProgress(executionId, taskId, sessionId) {
        const existing = this.trackedRuns.get(executionId);
        if (existing) {
            // Update last progress time and potentially reset status
            existing.lastProgressAt = nowIso();
            if (existing.status === "pending") {
                existing.status = "pending"; // Stay pending until confirmed stuck
            }
        }
        // If not tracked, we don't auto-add - only sweep adds runs
    }
    /**
     * Notifies the sweeper that a run has started.
     */
    trackRun(executionId, taskId, sessionId) {
        if (this.trackedRuns.has(executionId)) {
            return; // Already tracked
        }
        const run = {
            executionId,
            taskId,
            sessionId,
            status: "pending",
            startedAt: nowIso(),
            lastProgressAt: nowIso(),
            sweepCount: 0,
            warningIssuedAt: null,
            killedAt: null,
        };
        this.trackedRuns.set(executionId, run);
    }
    /**
     * Notifies the sweeper that a run has completed (terminal state).
     */
    markRunComplete(executionId) {
        const run = this.trackedRuns.get(executionId);
        if (run) {
            run.status = "resolved";
            this.trackedRuns.delete(executionId);
            this.metrics.totalResolved++;
        }
    }
    /**
     * Manually triggers a sweep cycle.
     */
    async sweepOnce() {
        return this.doSweepCycle();
    }
    /**
     * Returns the current configuration.
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Returns the metrics.
     */
    getMetrics() {
        return { ...this.metrics };
    }
    /**
     * Returns the number of currently tracked runs.
     */
    getTrackedRunCount() {
        return this.trackedRuns.size;
    }
    /**
     * Returns all runs currently being tracked.
     */
    getTrackedRuns() {
        return Array.from(this.trackedRuns.values());
    }
    /**
     * Returns whether the service is currently running.
     */
    isRunning() {
        return this.running && !this.disposed;
    }
    // ── Private Methods ───────────────────────────────────────────────
    /**
     * Schedules the next sweep cycle.
     */
    scheduleNextSweep() {
        if (!this.running || this.disposed) {
            return;
        }
        this.intervalHandle = setInterval(() => {
            void this.doSweepCycle();
        }, this.config.sweepIntervalMs);
    }
    /**
     * Performs a single sweep cycle.
     */
    async doSweepCycle() {
        if (!this.running || this.disposed) {
            return [];
        }
        const now = Date.now();
        const affectedRuns = [];
        try {
            // Get runs to process (limit to maxRunsPerSweep)
            const runs = Array.from(this.trackedRuns.values())
                .filter(r => r.status !== "resolved" && r.status !== "cleaned_up")
                .slice(0, this.config.maxRunsPerSweep);
            for (const run of runs) {
                try {
                    const result = await this.processRun(run, now);
                    if (result) {
                        affectedRuns.push(result);
                    }
                }
                catch (error) {
                    logger.log({
                        level: "error",
                        message: "stuck_run_sweeper.process_run_failed",
                        data: {
                            executionId: run.executionId,
                            error: error instanceof Error ? error.message : String(error),
                        },
                    });
                }
            }
        }
        catch (error) {
            logger.log({
                level: "error",
                message: "stuck_run_sweeper.sweep_cycle_failed",
                data: { error: error instanceof Error ? error.message : String(error) },
            });
        }
        return affectedRuns;
    }
    /**
     * Processes a single run and takes appropriate action based on its state.
     */
    async processRun(run, now) {
        run.sweepCount++;
        const lastProgress = run.lastProgressAt ? new Date(run.lastProgressAt).getTime() : 0;
        const timeSinceProgress = now - lastProgress;
        const timeSinceStart = now - new Date(run.startedAt).getTime();
        switch (run.status) {
            case "pending":
                // Check if run is stuck
                if (timeSinceProgress >= this.config.stuckThresholdMs ||
                    timeSinceStart >= this.config.stuckThresholdMs) {
                    // Issue warning
                    run.status = "warning";
                    run.warningIssuedAt = nowIso();
                    this.metrics.totalWarnings++;
                    this.metrics.totalDetected++;
                    this.emitWarning(run);
                    this.onStuckRunDetected?.(run);
                    this.onWarningIssued?.(run);
                    logger.log({
                        level: "warn",
                        message: "stuck_run_sweeper.run_detected",
                        data: {
                            executionId: run.executionId,
                            taskId: run.taskId,
                            timeSinceProgress,
                            timeSinceStart,
                            sweepCount: run.sweepCount,
                        },
                    });
                    return run;
                }
                break;
            case "warning":
                // Check if we should kill
                if (run.warningIssuedAt) {
                    const warningTime = new Date(run.warningIssuedAt).getTime();
                    const timeSinceWarning = now - warningTime;
                    if (timeSinceWarning >= this.config.killAfterWarningMs) {
                        // Kill the execution
                        const killed = await this.killRun(run);
                        if (killed) {
                            return run;
                        }
                    }
                }
                break;
            case "killed":
                // Check if we should cleanup
                if (run.killedAt) {
                    const killTime = new Date(run.killedAt).getTime();
                    const timeSinceKill = now - killTime;
                    if (timeSinceKill >= this.config.cleanupAfterKillMs) {
                        // Cleanup the execution
                        const cleaned = await this.cleanupRun(run);
                        if (cleaned) {
                            return run;
                        }
                    }
                }
                break;
            case "resolved":
            case "cleaned_up":
                // Remove from tracking
                this.trackedRuns.delete(run.executionId);
                break;
        }
        return null;
    }
    /**
     * Issues a warning for a stuck run.
     */
    emitWarning(run) {
        logger.log({
            level: "warn",
            message: "stuck_run_sweeper.warning_issued",
            data: {
                executionId: run.executionId,
                taskId: run.taskId,
                sessionId: run.sessionId,
                startedAt: run.startedAt,
                lastProgressAt: run.lastProgressAt,
                sweepCount: run.sweepCount,
            },
        });
    }
    /**
     * Kills a stuck run.
     */
    async killRun(run) {
        run.status = "killed";
        run.killedAt = nowIso();
        this.metrics.totalKilled++;
        try {
            // Call the kill callback if provided
            if (this.onKillExecution) {
                const success = await this.onKillExecution(run.executionId, "Stuck run sweeper: exceeded warning threshold");
                if (!success) {
                    logger.log({
                        level: "warn",
                        message: "stuck_run_sweeper.kill_callback_failed",
                        data: { executionId: run.executionId },
                    });
                }
            }
            this.onRunKilled?.(run);
            logger.log({
                level: "info",
                message: "stuck_run_sweeper.run_killed",
                data: {
                    executionId: run.executionId,
                    taskId: run.taskId,
                    killAge: run.killedAt,
                },
            });
            return true;
        }
        catch (error) {
            logger.log({
                level: "error",
                message: "stuck_run_sweeper.kill_failed",
                data: {
                    executionId: run.executionId,
                    error: error instanceof Error ? error.message : String(error),
                },
            });
            return false;
        }
    }
    /**
     * Cleans up a killed run.
     */
    async cleanupRun(run) {
        run.status = "cleaned_up";
        this.metrics.totalCleanedUp++;
        try {
            // Call the cleanup callback if provided
            if (this.onCleanupExecution) {
                const success = await this.onCleanupExecution(run.executionId, "Stuck run sweeper: cleanup after kill");
                if (!success) {
                    logger.log({
                        level: "warn",
                        message: "stuck_run_sweeper.cleanup_callback_failed",
                        data: { executionId: run.executionId },
                    });
                }
            }
            this.onRunCleanedUp?.(run);
            // Remove from tracking
            this.trackedRuns.delete(run.executionId);
            logger.log({
                level: "info",
                message: "stuck_run_sweeper.run_cleaned_up",
                data: {
                    executionId: run.executionId,
                    taskId: run.taskId,
                },
            });
            return true;
        }
        catch (error) {
            logger.log({
                level: "error",
                message: "stuck_run_sweeper.cleanup_failed",
                data: {
                    executionId: run.executionId,
                    error: error instanceof Error ? error.message : String(error),
                },
            });
            return false;
        }
    }
}
// ── Factory ─────────────────────────────────────────────────────────
/**
 * Creates a StuckRunSweeperService with HA-level-appropriate defaults.
 */
export function createStuckRunSweeperService(options) {
    return new StuckRunSweeperService(options);
}
//# sourceMappingURL=stuck-run-sweeper-service.js.map