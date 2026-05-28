/**
 * Checkpoint Garbage Collection Service
 *
 * Provides garbage collection for checkpoint storage to:
 * - Remove old checkpoints beyond retention limits
 * - Enforce checkpoint version limits
 * - Clean up orphaned checkpoints
 * - Manage storage quotas
 *
 * R23-10 Fix: CheckpointGC implementation
 */

import { closeSync, constants as fsConstants, existsSync, fstatSync, lstatSync, openSync, readFileSync, readdirSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";

import { nowIso } from "../../contracts/types/ids.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import type { CheckpointManifest } from "./checkpoint-manifest.js";
import type { CheckpointEnvelope } from "./checkpoint-envelope.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

/**
 * Checkpoint retention policy.
 */
export interface CheckpointRetentionPolicy {
  /** Maximum checkpoints per execution to retain */
  maxCheckpointsPerExecution: number;
  /** Maximum age in milliseconds before checkpoint is eligible for GC */
  maxAgeMs: number;
  /** Minimum checkpoint size to consider for GC (bytes) */
  minSizeBytes: number;
  /** Whether to retain checkpoints for failed executions longer */
  retainFailedExecutionsLonger: boolean;
  /** Multiplier for retention on failed executions */
  failedExecutionRetentionMultiplier: number;
}

/**
 * GC candidate checkpoint information.
 */
export interface CheckpointGCCandidate {
  checkpointRef: {
    checkpointId: string;
    storageUri: string;
    checksum?: string;
    createdAt?: string;
  };
  storagePath: string;
  sizeBytes: number;
  createdAt: string;
  executionId: string | null;
  isOrphaned: boolean;
  reason: string;
}

/**
 * Result of a Checkpoint GC run.
 */
export interface CheckpointGCRunResult {
  scannedCount: number;
  deletedCount: number;
  bytesFreed: number;
  errors: string[];
  skippedCandidates: CheckpointGCCandidate[];
  startedAt: string;
  completedAt: string;
}

/**
 * Checkpoint storage statistics.
 */
export interface CheckpointStorageStats {
  totalCheckpoints: number;
  totalSizeBytes: number;
  oldestCheckpoint: string | null;
  newestCheckpoint: string | null;
  orphanedCount: number;
}

/**
 * Default retention policy for checkpoints (7 days, 50 per execution).
 */
export const DEFAULT_CHECKPOINT_RETENTION_POLICY: CheckpointRetentionPolicy = {
  maxCheckpointsPerExecution: 50,
  maxAgeMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  minSizeBytes: 512,
  retainFailedExecutionsLonger: true,
  failedExecutionRetentionMultiplier: 3,
};

/**
 * CheckpointGCService - Garbage collection for checkpoints.
 *
 * Provides:
 * - Discovery of checkpoint GC candidates based on retention policy
 * - Safe deletion with manifest updates
 * - Version limiting per execution
 * - Storage reporting
 */
export class CheckpointGCService {
  private readonly rootDir: string;
  private readonly retentionPolicy: CheckpointRetentionPolicy;
  private readonly gcLockPath: string;
  private gcInProgress = false;
  private readonly executionExists: ((executionId: string) => boolean) | null;

  public constructor(
    rootDir: string,
    retentionPolicy: Partial<CheckpointRetentionPolicy> = {},
    options: {
      readonly executionExists?: ((executionId: string) => boolean) | null;
    } = {},
  ) {
    this.rootDir = rootDir;
    this.retentionPolicy = { ...DEFAULT_CHECKPOINT_RETENTION_POLICY, ...retentionPolicy };
    this.gcLockPath = join(rootDir, ".checkpoint-gc.lock");
    this.executionExists = options.executionExists ?? null;
  }

  /**
   * Scans for checkpoints eligible for garbage collection.
   *
   * @param referenceTimestamp - Reference time for age calculation
   * @returns List of GC candidate checkpoints
   */
  public scanForGCCandidates(referenceTimestamp = Date.now()): CheckpointGCCandidate[] {
    const candidates: CheckpointGCCandidate[] = [];

    if (!existsSync(this.rootDir)) {
      logger.log({ level: "warn", message: "checkpoint_gc.root_dir_missing", data: { rootDir: this.rootDir } });
      return candidates;
    }

    try {
      const executionDirs = readdirSync(this.rootDir);
      for (const executionId of executionDirs) {
        const executionPath = join(this.rootDir, executionId);
        let execStat;
        try {
          execStat = statSync(executionPath);
        } catch {
          continue;
        }
        if (!execStat.isDirectory()) {
          continue;
        }

        const checkpointCandidates = this.scanExecutionCheckpoints(executionId, referenceTimestamp);
        candidates.push(...checkpointCandidates);
      }
    } catch (err) {
      logger.log({
        level: "error",
        message: "checkpoint_gc.scan_error",
        data: { error: String(err) },
      });
    }

    return candidates;
  }

  /**
   * Performs garbage collection on checkpoint candidates.
   *
   * @param candidates - Checkpoints to consider for deletion
   * @returns GC run result
   */
  public runGC(candidates: CheckpointGCCandidate[]): CheckpointGCRunResult {
    if (this.gcInProgress) {
      throw new Error("checkpoint_gc.concurrent_run_not_allowed");
    }
    const lockAcquired = this.acquireRunLock();
    this.gcInProgress = true;
    const startedAt = nowIso();
    const errors: string[] = [];
    let deletedCount = 0;
    let bytesFreed = 0;
    const skippedCandidates: CheckpointGCCandidate[] = [];
    try {
      for (const candidate of candidates) {
        try {
          this.removeCandidateFromManifests(candidate);
          if (this.unlinkCheckpointFileIfUnchanged(candidate.storagePath)) {
            deletedCount++;
            bytesFreed += candidate.sizeBytes;

            logger.log({
              level: "debug",
              message: "checkpoint_gc.deleted",
              data: {
                checkpointId: candidate.checkpointRef.checkpointId,
                path: candidate.storagePath,
                sizeBytes: candidate.sizeBytes,
              },
            });
          }
        } catch (err) {
          errors.push(`Failed to delete checkpoint ${candidate.checkpointRef.checkpointId}: ${String(err)}`);
          skippedCandidates.push(candidate);
        }
      }

      const completedAt = nowIso();

      return {
        scannedCount: candidates.length,
        deletedCount,
        bytesFreed,
        errors,
        skippedCandidates,
        startedAt,
        completedAt,
      };
    } finally {
      this.gcInProgress = false;
      if (lockAcquired) {
        this.releaseRunLock();
      }
    }
  }

  private unlinkCheckpointFileIfUnchanged(filePath: string): boolean {
    if (!existsSync(filePath)) {
      return false;
    }
    let fd: number | null = null;
    try {
      const expectedStat = lstatSync(filePath);
      if (!expectedStat.isFile()) {
        throw new Error(`checkpoint_gc.invalid_candidate_file:${filePath}`);
      }
      fd = openSync(filePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
      const actualStat = fstatSync(fd);
      if (actualStat.dev !== expectedStat.dev || actualStat.ino !== expectedStat.ino) {
        throw new Error(`checkpoint_gc.candidate_changed_during_delete:${filePath}`);
      }
      unlinkSync(filePath);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return false;
      }
      throw error;
    } finally {
      if (fd != null) {
        closeSync(fd);
      }
    }
  }

  /**
   * Enforces checkpoint version limits per execution.
   * Removes oldest checkpoints when maxCheckpointsPerExecution is exceeded.
   *
   * @param executionId - Execution to enforce limits for
   * @returns Number of checkpoints deleted
   */
  public enforceVersionLimits(executionId: string): number {
    const executionPath = join(this.rootDir, executionId);
    if (!existsSync(executionPath)) {
      return 0;
    }

    type CheckpointFileInfo = { file: string; path: string; stat: { mtimeMs: number; birthtime: Date; birthtimeMs?: number; size: number; isDirectory(): boolean } };

    const checkpointFiles: CheckpointFileInfo[] = [];
    try {
      for (const f of readdirSync(executionPath)) {
        if (!f.endsWith(".checkpoint.json")) {
          continue;
        }
        const filePath = join(executionPath, f);
        if (!this.isCheckpointEnvelopeFile(filePath)) {
          continue;
        }
        try {
          const s = statSync(filePath);
          checkpointFiles.push({ file: f, path: filePath, stat: s });
        } catch {
          // Skip files we can't stat
        }
      }
    } catch {
      logger.log({ level: "error", message: "checkpoint_gc.version_limit_error", data: { executionId } });
      return 0;
    }

    checkpointFiles.sort((a, b) => this.resolveCheckpointBirthtimeMs(a.stat) - this.resolveCheckpointBirthtimeMs(b.stat));

    const maxToRetain = this.retentionPolicy.maxCheckpointsPerExecution;
    if (checkpointFiles.length <= maxToRetain) {
      return 0;
    }

    const toDelete = checkpointFiles.slice(0, checkpointFiles.length - maxToRetain);
    let deleted = 0;

    for (const file of toDelete) {
      try {
        const candidate = this.createVersionLimitCandidate(executionId, file);
        this.removeCandidateFromManifests(candidate);
        rmSync(file.path, { force: true });
        deleted++;
      } catch (err) {
        logger.log({ level: "warn", message: "checkpoint_gc.version_limit_delete_failed", data: { path: file.path, error: String(err) } });
      }
    }

    return deleted;
  }

  /**
   * Gets storage statistics for checkpoint directory.
   */
  public getStorageStats(): CheckpointStorageStats {
    let totalCheckpoints = 0;
    let totalSizeBytes = 0;
    let oldestCheckpoint: string | null = null;
    let newestCheckpoint: string | null = null;
    let orphanedCount = 0;

    if (!existsSync(this.rootDir)) {
      return {
        totalCheckpoints: 0,
        totalSizeBytes: 0,
        oldestCheckpoint: null,
        newestCheckpoint: null,
        orphanedCount: 0,
      };
    }

    try {
      const executionDirs = readdirSync(this.rootDir);
      for (const executionId of executionDirs) {
        const executionPath = join(this.rootDir, executionId);
        let execStat;
        try {
          execStat = statSync(executionPath);
        } catch {
          orphanedCount++;
          continue;
        }
        if (!execStat.isDirectory()) {
          orphanedCount++;
          continue;
        }

        try {
          const checkpointFiles = readdirSync(executionPath);
          for (const file of checkpointFiles) {
            if (!file.endsWith(".checkpoint.json")) {
              continue;
            }

            const filePath = join(executionPath, file);
            let fileStat;
            try {
              fileStat = statSync(filePath);
            } catch {
              continue;
            }
            const createdAt = fileStat.birthtime.toISOString();
            const sizeBytes = Number(fileStat.size);

            totalCheckpoints++;
            totalSizeBytes += sizeBytes;

            if (!oldestCheckpoint || createdAt < oldestCheckpoint) {
              oldestCheckpoint = createdAt;
            }
            if (!newestCheckpoint || createdAt > newestCheckpoint) {
              newestCheckpoint = createdAt;
            }
          }
        } catch {
          orphanedCount++;
        }
      }
    } catch (err) {
      logger.log({
        level: "error",
        message: "checkpoint_gc.stats_error",
        data: { error: String(err) },
      });
    }

    return {
      totalCheckpoints,
      totalSizeBytes,
      oldestCheckpoint,
      newestCheckpoint,
      orphanedCount,
    };
  }

  /**
   * Scans checkpoints for a specific execution.
   */
  private scanExecutionCheckpoints(
    executionId: string,
    referenceTimestamp: number,
  ): CheckpointGCCandidate[] {
    const candidates: CheckpointGCCandidate[] = [];
    const executionPath = join(this.rootDir, executionId);

    if (!existsSync(executionPath)) {
      return candidates;
    }

    try {
      const checkpointFiles = readdirSync(executionPath)
        .filter((f) => f.endsWith(".checkpoint.json"));

      for (const file of checkpointFiles) {
        const filePath = join(executionPath, file);
        if (!this.isCheckpointEnvelopeFile(filePath)) {
          continue;
        }
        let stats;
        try {
          stats = statSync(filePath);
        } catch {
          continue;
        }
        const checkpointId = file.replace(".checkpoint.json", "");

        const candidate = this.evaluateCheckpointForGC(
          checkpointId,
          filePath,
          stats,
          executionId,
          referenceTimestamp,
        );

        if (candidate) {
          candidates.push(candidate);
        }
      }
    } catch (err) {
      logger.log({
        level: "warn",
        message: "checkpoint_gc.execution_scan_error",
        data: { executionId, error: String(err) },
      });
    }

    return candidates;
  }

  /**
   * Evaluates a checkpoint for GC eligibility.
   */
  private evaluateCheckpointForGC(
    checkpointId: string,
    filePath: string,
    stats: { mtimeMs: number; birthtime: Date; birthtimeMs?: number; size: number },
    executionId: string,
    referenceTimestamp: number,
  ): CheckpointGCCandidate | null {
    const ageMs = referenceTimestamp - this.resolveCheckpointBirthtimeMs(stats);
    const maxAge = this.retentionPolicy.maxAgeMs;
    const isExpired = ageMs > maxAge;
    const isOrphaned = this.executionExists?.(executionId) === false;

    if (!isExpired && !isOrphaned) {
      // Check version limit separately
      return null;
    }

    return {
      checkpointRef: {
        checkpointId,
        storageUri: `file://${filePath}`,
        createdAt: stats.birthtime.toISOString(),
      },
      storagePath: filePath,
      sizeBytes: Number(stats.size),
      createdAt: stats.birthtime.toISOString(),
      executionId,
      isOrphaned,
      reason: isOrphaned
        ? "orphaned_execution_checkpoint"
        : `expired: age ${ageMs}ms exceeds max ${maxAge}ms`,
    };
  }

  private createVersionLimitCandidate(
    executionId: string,
    file: { file: string; path: string; stat: { mtimeMs: number; birthtime: Date; birthtimeMs?: number; size: number } },
  ): CheckpointGCCandidate {
    const checkpointId = file.file.replace(".checkpoint.json", "");
    return {
      checkpointRef: {
        checkpointId,
        storageUri: `file://${file.path}`,
        createdAt: file.stat.birthtime.toISOString(),
      },
      storagePath: file.path,
      sizeBytes: Number(file.stat.size),
      createdAt: file.stat.birthtime.toISOString(),
      executionId,
      isOrphaned: false,
      reason: "version_limit_exceeded",
    };
  }

  private removeCandidateFromManifests(candidate: CheckpointGCCandidate): void {
    const executionId = candidate.executionId;
    if (executionId == null) {
      return;
    }
    const executionPath = join(this.rootDir, executionId);
    if (!existsSync(executionPath)) {
      return;
    }
    for (const file of readdirSync(executionPath)) {
      if (!file.endsWith(".manifest.json")) {
        continue;
      }
      const manifestPath = join(executionPath, file);
      try {
        const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as CheckpointManifest;
        if (!Array.isArray(parsed.checkpoints)) {
          continue;
        }
        const nextCheckpoints = parsed.checkpoints.filter((checkpoint) =>
          checkpoint.checkpointId !== candidate.checkpointRef.checkpointId
            && checkpoint.storageUri !== candidate.checkpointRef.storageUri
        );
        if (nextCheckpoints.length === parsed.checkpoints.length) {
          continue;
        }
        writeFileSync(
          manifestPath,
          JSON.stringify({ ...parsed, checkpoints: nextCheckpoints }, null, 2),
          "utf8",
        );
      } catch (error) {
        throw new Error(
          `checkpoint_gc.manifest_update_failed:${manifestPath}:${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  private resolveCheckpointBirthtimeMs(
    stats: { mtimeMs: number; birthtime: Date; birthtimeMs?: number },
  ): number {
    if (typeof stats.birthtimeMs === "number" && Number.isFinite(stats.birthtimeMs) && stats.birthtimeMs > 0) {
      return stats.birthtimeMs;
    }
    const birthtime = stats.birthtime.getTime();
    if (Number.isFinite(birthtime) && birthtime > 0) {
      return birthtime;
    }
    return stats.mtimeMs;
  }

  private isCheckpointEnvelopeFile(filePath: string): boolean {
    try {
      const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Partial<CheckpointEnvelope> & {
        checkpointId?: unknown;
      };
      return (typeof parsed.version === "string"
        && typeof parsed.schema === "string"
        && typeof parsed.payload === "string"
        && typeof parsed.metadata === "object"
        && parsed.metadata !== null)
        || typeof parsed.checkpointId === "string";
    } catch {
      return false;
    }
  }

  private acquireRunLock(): boolean {
    try {
      writeFileSync(this.gcLockPath, JSON.stringify({
        acquiredAt: nowIso(),
        pid: process.pid,
        host: hostname(),
      }), {
        encoding: "utf8",
        flag: "wx",
      });
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new Error("checkpoint_gc.concurrent_run_not_allowed");
      }
      throw error;
    }
  }

  private releaseRunLock(): void {
    rmSync(this.gcLockPath, { force: true });
  }
}
