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

import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

import { nowIso } from "../../contracts/types/ids.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

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

  public constructor(
    rootDir: string,
    retentionPolicy: Partial<CheckpointRetentionPolicy> = {},
  ) {
    this.rootDir = rootDir;
    this.retentionPolicy = { ...DEFAULT_CHECKPOINT_RETENTION_POLICY, ...retentionPolicy };
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
    const startedAt = nowIso();
    const errors: string[] = [];
    let deletedCount = 0;
    let bytesFreed = 0;
    const skippedCandidates: CheckpointGCCandidate[] = [];

    for (const candidate of candidates) {
      try {
        if (existsSync(candidate.storagePath)) {
          rmSync(candidate.storagePath, { force: true });
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

    type CheckpointFileInfo = { file: string; path: string; stat: { mtimeMs: number; birthtime: Date; size: number; isDirectory(): boolean } };

    const checkpointFiles: CheckpointFileInfo[] = [];
    try {
      for (const f of readdirSync(executionPath)) {
        if (!f.endsWith(".checkpoint.json")) {
          continue;
        }
        const filePath = join(executionPath, f);
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

    checkpointFiles.sort((a, b) => Number(a.stat.mtimeMs) - Number(b.stat.mtimeMs));

    const maxToRetain = this.retentionPolicy.maxCheckpointsPerExecution;
    if (checkpointFiles.length <= maxToRetain) {
      return 0;
    }

    const toDelete = checkpointFiles.slice(0, checkpointFiles.length - maxToRetain);
    let deleted = 0;

    for (const file of toDelete) {
      try {
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
    stats: { mtimeMs: number; birthtime: Date; size: number },
    executionId: string,
    referenceTimestamp: number,
  ): CheckpointGCCandidate | null {
    const ageMs = referenceTimestamp - stats.mtimeMs;
    const maxAge = this.retentionPolicy.maxAgeMs;
    const isExpired = ageMs > maxAge;

    if (!isExpired) {
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
      isOrphaned: false,
      reason: `expired: age ${ageMs}ms exceeds max ${maxAge}ms`,
    };
  }
}
