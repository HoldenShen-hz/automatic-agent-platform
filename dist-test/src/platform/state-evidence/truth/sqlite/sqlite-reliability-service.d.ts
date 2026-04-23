/**
 * SQLite Reliability Service
 *
 * ## Overview
 *
 * Provides backup, restore, and integrity checking operations for SQLite databases.
 * Ensures data durability via checkpointed backups and validates integrity.
 *
 * ## Key Concepts
 *
 * - **WAL (Write-Ahead Logging)**: SQLite pre-write logging mode for concurrent reads
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: WAL}
 *
 * - **Checkpoint**: Flush WAL to main database file
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: checkpoint}
 *
 * - **Migration**: Formal schema version migration (not ad-hoc SQL patch)
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: migration}
 *
 * ## Operations
 *
 * - WAL checkpoint before backup
 * - Full database backup with integrity validation
 * - Restore from backup with integrity check
 * - Schema migration status reporting
 *
 * @see Storage Contract: docs_zh/contracts/storage_schema_contract.md
 * @see Recovery Contract: docs_zh/contracts/startup_consistency_and_recovery_drill_contract.md
 * @see Glossary: docs_zh/governance/glossary_and_terminology.md
 */
import { SqliteDatabase } from "./sqlite-database.js";
/**
 * Report containing details about a completed WAL checkpoint operation.
 * The WAL (Write-Ahead Logging) checkpoint ensures all pending writes are
 * flushed to the main database file before backup.
 */
export interface SqliteWalCheckpointReport {
    /** Checkpoint mode, always "TRUNCATE" indicating a truncating checkpoint */
    mode: "TRUNCATE";
    /** Number of busy callbacks that were invoked during checkpoint */
    busy: number;
    /** Number of log frames that were written to the WAL during checkpoint */
    logFrames: number;
    /** Number of frames that were checkpointed (moved from WAL to main db) */
    checkpointedFrames: number;
}
/**
 * Report containing details about a completed database backup operation.
 * Includes integrity checks from both source and backup databases to
 * validate the backup succeeded correctly.
 */
export interface SqliteBackupReport {
    /** Absolute path where the backup was written */
    backupPath: string;
    /** ISO 8601 timestamp when the backup was created */
    createdAt: string;
    /** Size of the backup file in bytes */
    sizeBytes: number;
    /** Integrity check results from the source database before backup */
    sourceIntegrity: string[];
    /** Integrity check results from the backup database after copy */
    backupIntegrity: string[];
    /** Details about the WAL checkpoint that occurred before the copy */
    checkpoint: SqliteWalCheckpointReport;
    /** Whether both source and backup passed integrity validation */
    valid: boolean;
}
/**
 * Comprehensive reliability report for a SQLite database including
 * integrity status, schema state, and applied migrations.
 */
export interface SqliteReliabilityReport {
    /** Integrity check results from PRAGMA integrity_check */
    integrity: string[];
    /** True if all integrity check results are "ok" */
    integrityPassed: boolean;
    /** Current schema status including version and applied migrations */
    schemaStatus: ReturnType<SqliteDatabase["getSchemaStatus"]>;
    /** List of all migrations that have been applied to this database */
    appliedMigrations: ReturnType<SqliteDatabase["listAppliedMigrations"]>;
}
/**
 * Report containing details about a database restore operation from backup.
 */
export interface SqliteRestoreReport {
    /** Absolute path to the backup file that was restored from */
    backupPath: string;
    /** Absolute path where the restored database was written */
    restorePath: string;
    /** ISO 8601 timestamp when the restore completed */
    restoredAt: string;
    /** Size of the restored database file in bytes */
    sizeBytes: number;
    /** Integrity check results from the restored database */
    restoreIntegrity: string[];
    /** Whether the restored database passed integrity validation */
    valid: boolean;
}
/**
 * Service for managing SQLite database reliability operations including
 * integrity checks, backup creation, and backup restoration.
 *
 * This class provides a safe way to create point-in-time backups of SQLite
 * databases with WAL checkpointing and integrity validation. It also supports
 * restoring databases from backup with integrity verification.
 */
export declare class SqliteReliabilityService {
    private readonly db;
    /**
     * Creates a new reliability service for the given database.
     *
     * @param db - The SQLite database instance to manage
     */
    constructor(db: SqliteDatabase);
    /**
     * Generates a comprehensive reliability report for the database.
     * This includes integrity checks, schema status, and a list of applied
     * migrations which is useful for diagnostics and validation.
     *
     * @returns A report containing integrity status, schema info, and migration history
     */
    getReport(): SqliteReliabilityReport;
    /**
     * Creates a point-in-time backup of the database with full integrity validation.
     *
     * The backup process:
     * 1. Creates the backup directory if needed
     * 2. Runs integrity check on source database
     * 3. Checkpoints the WAL to flush all pending writes
     * 4. Copies the database file to the backup location
     * 5. Opens the backup and runs integrity check on it
     * 6. Returns a comprehensive report of the backup operation
     *
     * @param backupPath - Absolute path where the backup should be written
     * @returns A detailed report of the backup including integrity validation results
     */
    createBackup(backupPath: string): SqliteBackupReport;
    /**
     * Restores a database from a backup file with integrity validation.
     *
     * The restore process:
     * 1. Creates the restore directory if needed
     * 2. Copies the backup file to the restore destination
     * 3. Opens the restored database and validates its integrity
     *
     * @param backupPath - Absolute path to the existing backup file
     * @param restorePath - Absolute path where the restored database should be written
     * @returns A detailed report of the restore operation including validation results
     */
    restoreBackup(backupPath: string, restorePath: string): SqliteRestoreReport;
}
