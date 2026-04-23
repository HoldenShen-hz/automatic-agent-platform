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
/**
 * Snapshot of file state at a point in time.
 * Used for comparison to detect external modifications.
 */
export interface FileSnapshot {
    /** Path to the file */
    path: string;
    /** Modification time in milliseconds (from stat.mtimeMs) */
    mtimeMs: number;
    /** File size in bytes */
    sizeBytes: number;
    /** Optional content digest (SHA-256 or MD5) for precise change detection */
    digest?: string;
}
/**
 * Configuration for freshness checking behavior.
 */
export interface FreshnessConfig {
    /** Allow stale files (skip freshness check) */
    allowStale?: boolean;
    /** Milliseconds to tolerate mtime drift (accounts for filesystem imprecision) */
    staleThresholdMs?: number;
    /** Require digest comparison for freshness (more precise but slower) */
    requireDigest?: boolean;
    /** Algorithm for digest computation */
    digestAlgorithm?: "sha256" | "md5";
}
/**
 * Result of a freshness check operation.
 */
export interface FreshnessResult {
    /** Whether the file is still fresh (unchanged) */
    fresh: boolean;
    /** Human-readable reason if file is stale */
    reason?: string;
    /** Current file snapshot at check time */
    currentSnapshot?: FileSnapshot;
    /** Snapshot from when we originally captured the file */
    previousSnapshot?: FileSnapshot;
}
/**
 * Takes a snapshot of the current file state for future comparison.
 * Optionally includes a content digest for precise change detection.
 *
 * @param filePath - Path to the file to snapshot
 * @param options.includeDigest - Whether to compute and store content digest
 * @param options.digestAlgorithm - Algorithm for digest (default sha256)
 * @returns FileSnapshot capturing current state
 */
export declare function takeFileSnapshot(filePath: string, options?: {
    includeDigest?: boolean;
    digestAlgorithm?: "sha256" | "md5";
}): FileSnapshot;
/**
 * Computes a cryptographic digest of file content.
 * Used for precise change detection beyond mtime comparison.
 *
 * @param filePath - Path to the file
 * @param algorithm - Hash algorithm to use
 * @returns Hex-encoded digest string
 */
export declare function computeFileDigest(filePath: string, algorithm?: "sha256" | "md5"): string;
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
export declare function checkFreshness(currentPath: string, previousSnapshot: FileSnapshot, options?: FreshnessConfig): FreshnessResult;
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
export declare class FileFreshnessGuard {
    private snapshots;
    private config;
    constructor(config?: FreshnessConfig);
    /**
     * Updates the freshness configuration.
     * Merges with existing config, allowing partial updates.
     *
     * @param config - New configuration values
     */
    setConfig(config: FreshnessConfig): void;
    /**
     * Takes a snapshot of a file, replacing any previous snapshot.
     * Call this before reading a file you may later modify.
     *
     * @param filePath - Path to the file
     * @param options - Snapshot options (digest calculation)
     * @returns The captured snapshot
     */
    snapshot(filePath: string, options?: {
        includeDigest?: boolean;
        digestAlgorithm?: "sha256" | "md5";
    }): FileSnapshot;
    /**
     * Retrieves the stored snapshot for a file.
     *
     * @param filePath - Path to the file
     * @returns The snapshot if one exists
     */
    getSnapshot(filePath: string): FileSnapshot | undefined;
    /**
     * Checks if a file is still fresh compared to the stored snapshot.
     * Uses merged config from constructor and options parameter.
     *
     * @param filePath - Path to check
     * @param options - Optional per-check config overrides
     * @returns FreshnessResult with status and any mismatch details
     */
    check(filePath: string, options?: FreshnessConfig): FreshnessResult;
    /**
     * Clears all stored snapshots.
     * Use when starting a new operation or when snapshots are no longer relevant.
     */
    clear(): void;
}
