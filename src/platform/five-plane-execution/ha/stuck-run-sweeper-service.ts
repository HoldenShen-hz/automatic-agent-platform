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

import { newId, nowIso } from "../../contracts/types/ids.js";
import {
  buildRecoveryCadence,
  type RecoveryCadence,
  type RecoveryReport,
  type RecoveryWorker,
} from "../../contracts/types/recovery-cadence.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import type {
  HaLevel,
  HaLevelConfig,
  StuckRun,
  StuckRunSweepStatus,
  StuckRunSweeperConfig,
} from "./types.js";
import { HA_LEVEL_CONFIGS, type CheckpointOptions, type WalEntryType } from "./types.js";

// ── Logger ─────────────────────────────────────────────────────────

const logger = new StructuredLogger({ retentionLimit: 200 });

// ── Default Configuration ─────────────────────────────────────────

const DEFAULT_STUCK_THRESHOLD_MS = 1_800_000; // 30 minutes
const DEFAULT_KILL_AFTER_WARNING_MS = 60_000; // 1 minute
const DEFAULT_CLEANUP_AFTER_KILL_MS = 300_000; // 5 minutes
const DEFAULT_SWEEP_INTERVAL_MS = 60_000; // 1 minute
const DEFAULT_MAX_RUNS_PER_SWEEP = 100;

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
export class StuckRunSweeperService implements RecoveryWorker {
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private disposed: boolean = false;
  private running: boolean = false;

  // In-memory state for tracked runs
  private readonly trackedRuns: Map<string, StuckRun> = new Map();
  // C-11: TTL-based eviction to prevent memory leaks
  private readonly MAX_TRACKED_RUNS = 1000;
  private readonly RUN_TTL_MS = 60 * 60 * 1000; // 1 hour
  private lastEvictionTime = 0;
  private readonly EVICTION_INTERVAL_MS = 60 * 1000; // Once per minute
  private lastSweepClockMs = 0;

  private readonly config: Required<StuckRunSweeperConfig>;
  private readonly onStuckRunDetected: ((run: StuckRun) => void) | undefined;
  private readonly onWarningIssued: ((run: StuckRun) => void) | undefined;
  private readonly onRunKilled: ((run: StuckRun) => void) | undefined;
  private readonly onRunCleanedUp: ((run: StuckRun) => void) | undefined;
  private readonly onKillExecution: ((executionId: string, reason: string) => Promise<boolean>) | undefined;
  private readonly onCleanupExecution: ((executionId: string, reason: string) => Promise<boolean>) | undefined;

  // Metrics
  private metrics = {
    totalDetected: 0,
    totalWarnings: 0,
    totalKilled: 0,
    totalCleanedUp: 0,
    totalResolved: 0,
  };

  constructor(options: StuckRunSweeperServiceOptions) {
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

  /**
   * C-11: Evict expired tracked runs to prevent memory leaks.
   */
  private evictExpiredRuns(): void {
    const now = Date.now();
    if (now - this.lastEvictionTime < this.EVICTION_INTERVAL_MS) {
      return;
    }
    this.lastEvictionTime = now;

    const expiryThreshold = now - this.RUN_TTL_MS;
    const entriesToDelete: string[] = [];

    for (const [executionId, run] of this.trackedRuns) {
      const lastProgress = run.lastProgressAt ? new Date(run.lastProgressAt).getTime() : 0;
      if (lastProgress < expiryThreshold) {
        entriesToDelete.push(executionId);
      }
    }

    for (const executionId of entriesToDelete) {
      this.trackedRuns.delete(executionId);
    }

    // If still over capacity, remove oldest runs
    if (this.trackedRuns.size > this.MAX_TRACKED_RUNS) {
      const sortedEntries = [...this.trackedRuns.entries()].sort((a, b) => {
        const aTime = a[1].lastProgressAt ? new Date(a[1].lastProgressAt).getTime() : 0;
        const bTime = b[1].lastProgressAt ? new Date(b[1].lastProgressAt).getTime() : 0;
        return aTime - bTime;
      });

      const toRemove = this.trackedRuns.size - this.MAX_TRACKED_RUNS;
      for (let i = 0; i < toRemove; i++) {
        this.trackedRuns.delete(sortedEntries[i]![0]);
      }
    }
  }

  // ── Public API ────────────────────────────────────────────────────

  /**
   * Starts the stuck run sweeper background process.
   */
  public start(): void {
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
  public stop(): void {
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
  public dispose(): void {
    this.stop();
    this.disposed = true;
    this.trackedRuns.clear();
  }

  /**
   * Reports progress on a run (call periodically to reset stuck timer).
   */
  public reportProgress(
    executionId: string,
    taskId: string,
    sessionId: string | null,
  ): void {
    const existing = this.trackedRuns.get(executionId);
    if (existing) {
      const progressAt = nowIso();
      existing.taskId = taskId;
      existing.sessionId = sessionId;
      existing.lastProgressAt = progressAt;
      if (existing.status === "warning") {
        existing.status = "pending";
        existing.warningIssuedAt = null;
      }
    }
    // If not tracked, we don't auto-add - only sweep adds runs
  }

  /**
   * Notifies the sweeper that a run has started.
   */
  public trackRun(
    executionId: string,
    taskId: string,
    sessionId: string | null,
  ): void {
    // C-11: Evict expired runs before tracking new one
    this.evictExpiredRuns();

    if (this.trackedRuns.has(executionId)) {
      return; // Already tracked
    }

    const run: StuckRun = {
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
  public markRunComplete(executionId: string): void {
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
  public async sweepOnce(): Promise<StuckRun[]> {
    return this.doSweepCycle();
  }

  public getWorkerId(): string {
    return "stuck-run-sweeper";
  }

  public getRecoveryCadence(): RecoveryCadence {
    return buildRecoveryCadence({
      intervalMs: this.config.sweepIntervalMs,
      maxConcurrent: 1,
      priority: "normal",
    });
  }

  public async runRecoveryCycle(): Promise<RecoveryReport> {
    const startedAt = nowIso();
    const startedMs = Date.now();
    try {
      const sweptRuns = await this.sweepOnce();
      const metrics = this.getMetrics();
      const recoveredCount = sweptRuns.filter((run) => run.status === "resolved" || run.status === "cleaned_up").length;
      return {
        workerId: this.getWorkerId(),
        workerType: "stuck_run_sweeper",
        startedAt,
        completedAt: nowIso(),
        durationMs: Date.now() - startedMs,
        itemsProcessed: sweptRuns.length,
        itemsRecovered: recoveredCount,
        errors: [],
        metadata: {
          warningCount: metrics.totalWarnings,
          killedCount: metrics.totalKilled,
          cleanedUpCount: metrics.totalCleanedUp,
        },
      };
    } catch (error) {
      return {
        workerId: this.getWorkerId(),
        workerType: "stuck_run_sweeper",
        startedAt,
        completedAt: nowIso(),
        durationMs: Date.now() - startedMs,
        itemsProcessed: 0,
        itemsRecovered: 0,
        errors: [{
          code: "stuck_run_sweeper.cycle_failed",
          message: error instanceof Error ? error.message : String(error),
        }],
      };
    }
  }

  /**
   * Returns the current configuration.
   */
  public getConfig(): Readonly<StuckRunSweeperConfig> {
    return { ...this.config };
  }

  /**
   * Returns the metrics.
   */
  public getMetrics(): Readonly<typeof this.metrics> {
    return { ...this.metrics };
  }

  /**
   * Returns the number of currently tracked runs.
   */
  public getTrackedRunCount(): number {
    return this.trackedRuns.size;
  }

  /**
   * Returns all runs currently being tracked.
   */
  public getTrackedRuns(): StuckRun[] {
    return Array.from(this.trackedRuns.values());
  }

  /**
   * Returns whether the service is currently running.
   */
  public isRunning(): boolean {
    return this.running && !this.disposed;
  }

  /**
   * Legacy benchmark compatibility helper.
   */
  public detectStuckRuns(runs: Array<Partial<StuckRun> & { executionId: string; taskId: string }>): StuckRun[] {
    const now = Date.now();
    return runs
      .map((run) => this.normalizeLegacyRun(run))
      .filter((run) => {
        const lastProgress = run.lastProgressAt ? new Date(run.lastProgressAt).getTime() : 0;
        const startedAt = new Date(run.startedAt).getTime();
        return now - Math.max(lastProgress, startedAt) >= this.config.stuckThresholdMs;
      });
  }

  /**
   * Legacy benchmark compatibility helper.
   */
  public runSweepCycle(): StuckRun[] {
    const now = Date.now();
    const affected: StuckRun[] = [];
    for (const run of this.trackedRuns.values()) {
      const lastProgress = run.lastProgressAt ? new Date(run.lastProgressAt).getTime() : 0;
      const startedAt = new Date(run.startedAt).getTime();
      if (now - Math.max(lastProgress, startedAt) >= this.config.stuckThresholdMs) {
        run.status = "warning";
        if (run.warningIssuedAt == null) {
          run.warningIssuedAt = nowIso();
        }
        affected.push(run);
      }
    }
    return affected;
  }

  /**
   * Legacy benchmark compatibility helper.
   */
  public issueWarnings(runs: Array<Partial<StuckRun> & { executionId: string; taskId: string }>): StuckRun[] {
    return runs.map((run) => {
      const normalized = this.normalizeLegacyRun(run);
      normalized.status = "warning";
      normalized.warningIssuedAt = normalized.warningIssuedAt ?? nowIso();
      this.onWarningIssued?.(normalized);
      return normalized;
    });
  }

  /**
   * Legacy benchmark compatibility helper.
   */
  public requestKill(runs: Array<Partial<StuckRun> & { executionId: string; taskId: string }>): StuckRun[] {
    return runs.map((run) => {
      const normalized = this.normalizeLegacyRun(run);
      normalized.status = "killed";
      normalized.killedAt = normalized.killedAt ?? nowIso();
      this.onRunKilled?.(normalized);
      return normalized;
    });
  }

  /**
   * Legacy benchmark compatibility helper.
   */
  public performCleanup(runs: Array<Partial<StuckRun> & { executionId: string; taskId: string }>): StuckRun[] {
    return runs.map((run) => {
      const normalized = this.normalizeLegacyRun(run);
      normalized.status = "cleaned_up";
      this.onRunCleanedUp?.(normalized);
      return normalized;
    });
  }

  // ── Private Methods ───────────────────────────────────────────────

  private normalizeLegacyRun(run: Partial<StuckRun> & { executionId: string; taskId: string }): StuckRun {
    return {
      executionId: run.executionId,
      taskId: run.taskId,
      sessionId: run.sessionId ?? null,
      status: run.status ?? "pending",
      startedAt: run.startedAt ?? (run as { firstStartedAt?: string }).firstStartedAt ?? nowIso(),
      lastProgressAt: run.lastProgressAt ?? (run as { firstStartedAt?: string }).firstStartedAt ?? nowIso(),
      sweepCount: run.sweepCount ?? 0,
      warningIssuedAt: run.warningIssuedAt ?? null,
      killedAt: run.killedAt ?? (run as { killRequestedAt?: string }).killRequestedAt ?? null,
    };
  }

  /**
   * Schedules the next sweep cycle.
   */
  private scheduleNextSweep(): void {
    if (!this.running || this.disposed) {
      return;
    }

    this.intervalHandle = setInterval(() => {
      void this.doSweepCycle();
    }, this.config.sweepIntervalMs);
    this.intervalHandle.unref?.();
  }

  /**
   * Performs a single sweep cycle.
   */
  private async doSweepCycle(): Promise<StuckRun[]> {
    if (!this.running || this.disposed) {
      return [];
    }

    const now = this.nextSweepClockMs();
    const affectedRuns: StuckRun[] = [];

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
        } catch (error) {
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
    } catch (error) {
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
  private async processRun(run: StuckRun, now: number): Promise<StuckRun | null> {
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
  private emitWarning(run: StuckRun): void {
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
  private async killRun(run: StuckRun): Promise<boolean> {
    try {
      const killedAt = nowIso();
      // Call the kill callback if provided
      if (this.onKillExecution) {
        const success = await this.onKillExecution(
          run.executionId,
          "Stuck run sweeper: exceeded warning threshold",
        );
        if (!success) {
          logger.log({
            level: "warn",
            message: "stuck_run_sweeper.kill_callback_failed",
            data: { executionId: run.executionId },
          });
          return false;
        }
      }

      run.status = "killed";
      run.killedAt = killedAt;
      this.metrics.totalKilled++;

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
    } catch (error) {
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
  private async cleanupRun(run: StuckRun): Promise<boolean> {
    try {
      // Call the cleanup callback if provided
      if (this.onCleanupExecution) {
        const success = await this.onCleanupExecution(
          run.executionId,
          "Stuck run sweeper: cleanup after kill",
        );
        if (!success) {
          logger.log({
            level: "warn",
            message: "stuck_run_sweeper.cleanup_callback_failed",
            data: { executionId: run.executionId },
          });
          return false;
        }
      }

      run.status = "cleaned_up";
      this.metrics.totalCleanedUp++;

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
    } catch (error) {
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

  private nextSweepClockMs(): number {
    const observed = Date.now();
    const next = Math.max(observed, this.lastSweepClockMs);
    this.lastSweepClockMs = next;
    return next;
  }
}

// ── Factory ─────────────────────────────────────────────────────────

/**
 * Creates a StuckRunSweeperService with HA-level-appropriate defaults.
 */
export function createStuckRunSweeperService(
  options: StuckRunSweeperServiceOptions,
): StuckRunSweeperService {
  return new StuckRunSweeperService(options);
}
