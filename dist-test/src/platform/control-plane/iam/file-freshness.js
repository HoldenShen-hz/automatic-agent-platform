/**
 * File Freshness Guard
 *
 * Validates file freshness before write operations to prevent
 * overwriting externally modified files.
 *
 * ## Purpose
 *
 * When multiple agents or processes work on the same files, there's a risk
 * of accidentally overwriting changes made by others. The freshness guard
 * tracks file state (mtime, size, optionally digest) and detects when
 * a file has been modified externally between when we read it and when
 * we intend to write it.
 *
 * ## Usage Pattern
 *
 * 1. Before reading a file you intend to modify:
 *    `guard.snapshot(filePath)`
 *
 * 2. Before writing, check if file is still fresh:
 *    `result = guard.check(filePath)`
 *    If `result.fresh === false`, abort and re-read the file
 *
 * 3. After successful write, take new snapshot:
 *    `guard.snapshot(filePath)`
 *
 * ## Freshness Criteria
 *
 * A file is considered "stale" (not fresh) when:
 * - Its mtime has changed AND the change is newer than staleThresholdMs
 * - Its digest has changed (if digest checking is enabled)
 *
 * @see DB-44: File freshness check in main write chain
 */
import { readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
const freshnessLogger = new StructuredLogger({ retentionLimit: 50 });
/**
 * Takes a snapshot of the current file state for future comparison.
 * Optionally includes a content digest for precise change detection.
 *
 * @param filePath - Path to the file to snapshot
 * @param options.includeDigest - Whether to compute and store content digest
 * @param options.digestAlgorithm - Algorithm for digest (default sha256)
 * @returns FileSnapshot capturing current state
 */
export function takeFileSnapshot(filePath, options = {}) {
    const stat = statSync(filePath);
    const snapshot = {
        path: filePath,
        mtimeMs: stat.mtimeMs,
        sizeBytes: stat.size,
    };
    if (options.includeDigest) {
        snapshot.digest = computeFileDigest(filePath, options.digestAlgorithm ?? "sha256");
    }
    return snapshot;
}
/**
 * Computes a cryptographic digest of file content.
 * Used for precise change detection beyond mtime comparison.
 *
 * @param filePath - Path to the file
 * @param algorithm - Hash algorithm to use
 * @returns Hex-encoded digest string
 */
export function computeFileDigest(filePath, algorithm = "sha256") {
    const content = readFileSync(filePath);
    const hash = createHash(algorithm);
    hash.update(content);
    return hash.digest("hex");
}
/**
 * Checks if a file has been modified externally since the snapshot was taken.
 * This is the core freshness validation function.
 *
 * Freshness is determined by:
 * 1. File existence (returns not-fresh if file was deleted)
 * 2. mtime comparison (accounts for staleThresholdMs tolerance)
 * 3. Digest comparison (if requireDigest is enabled)
 *
 * @param currentPath - Path to check
 * @param previousSnapshot - Snapshot taken earlier
 * @param options - Freshness configuration
 * @returns FreshnessResult indicating if file is still fresh
 */
export function checkFreshness(currentPath, previousSnapshot, options = {}) {
    const { allowStale = false, staleThresholdMs = 1000, requireDigest = false, } = options;
    let currentStat;
    try {
        currentStat = statSync(currentPath);
    }
    catch (err) {
        freshnessLogger.log({ level: "warn", message: "File freshness check failed", data: { path: currentPath, error: err instanceof Error ? err.message : String(err) } });
        return {
            fresh: false,
            reason: "File does not exist",
        };
    }
    const currentSnapshot = {
        path: currentPath,
        mtimeMs: currentStat.mtimeMs,
        sizeBytes: currentStat.size,
    };
    // Check if mtime has changed
    if (currentStat.mtimeMs !== previousSnapshot.mtimeMs) {
        const timeDiff = currentStat.mtimeMs - previousSnapshot.mtimeMs;
        // Positive diff means file is newer (external modification)
        if (timeDiff > 0 && !allowStale) {
            if (timeDiff > staleThresholdMs) {
                return {
                    fresh: false,
                    reason: `File was modified externally ${timeDiff}ms ago (threshold: ${staleThresholdMs}ms)`,
                    currentSnapshot,
                    previousSnapshot,
                };
            }
        }
    }
    // Check digest if required
    if (requireDigest && previousSnapshot.digest) {
        const currentDigest = computeFileDigest(currentPath);
        if (currentDigest !== previousSnapshot.digest) {
            return {
                fresh: false,
                reason: "File digest mismatch - content has changed",
                currentSnapshot,
                previousSnapshot,
            };
        }
    }
    return {
        fresh: true,
        currentSnapshot,
        previousSnapshot,
    };
}
/**
 * File Freshness Guard
 *
 * Manages snapshots for multiple files and provides convenience methods
 * for checking freshness across a set of files.
 *
 * ## Example
 *
 * ```typescript
 * const guard = new FileFreshnessGuard({ staleThresholdMs: 2000 });
 *
 * // Before editing
 * guard.snapshot('/path/to/file.txt', { includeDigest: true });
 *
 * // Later, before writing
 * const result = guard.check('/path/to/file.txt');
 * if (!result.fresh) {
 *   console.error('File was modified!', result.reason);
 *   // Re-read and try again
 * }
 * ```
 */
export class FileFreshnessGuard {
    snapshots = new Map();
    config;
    constructor(config = {}) {
        this.config = config;
    }
    /**
     * Updates the freshness configuration.
     * Merges with existing config, allowing partial updates.
     *
     * @param config - New configuration values
     */
    setConfig(config) {
        this.config = { ...this.config, ...config };
    }
    /**
     * Takes a snapshot of a file, replacing any previous snapshot.
     * Call this before reading a file you may later modify.
     *
     * @param filePath - Path to the file
     * @param options - Snapshot options (digest calculation)
     * @returns The captured snapshot
     */
    snapshot(filePath, options) {
        const snapshot = takeFileSnapshot(filePath, options);
        this.snapshots.set(filePath, snapshot);
        return snapshot;
    }
    /**
     * Retrieves the stored snapshot for a file.
     *
     * @param filePath - Path to the file
     * @returns The snapshot if one exists
     */
    getSnapshot(filePath) {
        return this.snapshots.get(filePath);
    }
    /**
     * Checks if a file is still fresh compared to the stored snapshot.
     * Uses merged config from constructor and options parameter.
     *
     * @param filePath - Path to check
     * @param options - Optional per-check config overrides
     * @returns FreshnessResult with status and any mismatch details
     */
    check(filePath, options) {
        const previousSnapshot = this.snapshots.get(filePath);
        if (!previousSnapshot) {
            return {
                fresh: true,
                reason: "No previous snapshot found",
            };
        }
        const mergedOptions = { ...this.config, ...options };
        return checkFreshness(filePath, previousSnapshot, mergedOptions);
    }
    /**
     * Clears all stored snapshots.
     * Use when starting a new operation or when snapshots are no longer relevant.
     */
    clear() {
        this.snapshots.clear();
    }
}
//# sourceMappingURL=file-freshness.js.map