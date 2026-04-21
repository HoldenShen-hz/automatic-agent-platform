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
import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { SqliteDatabase } from "./sqlite-database.js";
/**
 * Validates that all integrity check results indicate success.
 * Each result should be the string "ok" (case-insensitive).
 *
 * @param results - Array of integrity check result strings from SQLite
 * @returns True if all results are "ok" and the array is non-empty
 */
function isIntegrityOk(results) {
    return results.length > 0 && results.every((item) => item.toLowerCase() === "ok");
}
/**
 * Service for managing SQLite database reliability operations including
 * integrity checks, backup creation, and backup restoration.
 *
 * This class provides a safe way to create point-in-time backups of SQLite
 * databases with WAL checkpointing and integrity validation. It also supports
 * restoring databases from backup with integrity verification.
 */
export class SqliteReliabilityService {
    db;
    /**
     * Creates a new reliability service for the given database.
     *
     * @param db - The SQLite database instance to manage
     */
    constructor(db) {
        this.db = db;
    }
    /**
     * Generates a comprehensive reliability report for the database.
     * This includes integrity checks, schema status, and a list of applied
     * migrations which is useful for diagnostics and validation.
     *
     * @returns A report containing integrity status, schema info, and migration history
     */
    getReport() {
        const integrity = this.db.integrityCheck();
        return {
            integrity,
            integrityPassed: isIntegrityOk(integrity),
            schemaStatus: this.db.getSchemaStatus(),
            appliedMigrations: this.db.listAppliedMigrations(),
        };
    }
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
    createBackup(backupPath) {
        // Ensure the parent directory exists for the backup file
        mkdirSync(dirname(backupPath), { recursive: true });
        // Validate source database integrity before backup
        const sourceIntegrity = this.db.integrityCheck();
        // Checkpoint WAL to ensure all writes are in the main database file
        const checkpoint = this.db.checkpointWal();
        // Perform the actual file copy
        copyFileSync(this.db.filePath, backupPath);
        // Open the backup and verify its integrity
        const backupDb = new SqliteDatabase(backupPath);
        try {
            const backupIntegrity = backupDb.integrityCheck();
            const sizeBytes = statSync(backupPath).size;
            return {
                backupPath,
                createdAt: new Date().toISOString(),
                sizeBytes,
                sourceIntegrity,
                backupIntegrity,
                checkpoint,
                // Backup is valid only if both source and backup pass integrity checks
                valid: isIntegrityOk(sourceIntegrity) && isIntegrityOk(backupIntegrity),
            };
        }
        finally {
            // Always close the backup database connection to release resources
            backupDb.close();
        }
    }
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
    restoreBackup(backupPath, restorePath) {
        // Ensure the parent directory exists for the restored file
        mkdirSync(dirname(restorePath), { recursive: true });
        // Copy the backup to the restore destination
        copyFileSync(backupPath, restorePath);
        // Open the restored database and verify its integrity
        const restoreDb = new SqliteDatabase(restorePath);
        try {
            const restoreIntegrity = restoreDb.integrityCheck();
            const sizeBytes = statSync(restorePath).size;
            return {
                backupPath,
                restorePath,
                restoredAt: new Date().toISOString(),
                sizeBytes,
                restoreIntegrity,
                valid: isIntegrityOk(restoreIntegrity),
            };
        }
        finally {
            // Always close the restored database connection to release resources
            restoreDb.close();
        }
    }
}
//# sourceMappingURL=sqlite-reliability-service.js.map