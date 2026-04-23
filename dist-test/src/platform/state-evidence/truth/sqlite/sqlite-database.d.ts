import { DatabaseSync } from "node:sqlite";
import { StorageError } from "../../../contracts/errors.js";
import { type SqliteMigrationDefinition } from "./sqlite-migration-plan.js";
/**
 * Configuration options for SqliteDatabase.
 */
export interface SqliteDatabaseOptions {
    /** Custom migration plan (defaults to SQLITE_MIGRATIONS) */
    migrationPlan?: readonly SqliteMigrationDefinition[];
    /** Busy timeout in milliseconds (defaults to 5000) */
    busyTimeoutMs?: number;
}
/**
 * AuthoritativeSqlDatabase interface that defines the contract for
 * SQL database access used by AuthoritativeTaskStore and other components.
 */
export interface AuthoritativeSqlDatabase {
    readonly filePath: string;
    readonly backendType: "sqlite" | "postgres";
    readonly connection: Pick<DatabaseSync, "exec" | "prepare">;
    /** Runs pending migrations */
    migrate(): void;
    /** Gets current schema status */
    getSchemaStatus(): SqliteSchemaStatus;
    /** Asserts schema is current, throws if not */
    assertSchemaCurrent(): void;
    /** Runs integrity check */
    integrityCheck(): string[];
    /** Checks database writability */
    healthCheck(): Promise<boolean>;
    /** Executes work within a write transaction */
    transaction<T>(work: () => T): T;
    /** Executes work within a read transaction */
    readTransaction<T>(work: () => T): T;
}
/**
 * Error thrown when SQLite write operations encounter contention.
 * This happens when the database is locked by another writer.
 */
export declare class SqliteWriteContentionError extends StorageError {
    readonly filePath: string;
    readonly sqliteCode: string | null;
    constructor(filePath: string, cause?: unknown);
}
/**
 * Type guard to check if an error is a SqliteWriteContentionError.
 */
export declare function isSqliteWriteContentionError(error: unknown): error is SqliteWriteContentionError;
/**
 * Record of an applied migration in the schema_migrations table.
 */
export interface AppliedSqliteMigrationRecord {
    version: number;
    name: string;
    checksum: string;
    appliedAt: string;
}
/**
 * Status of the SQLite schema including version info and any pending or mismatched migrations.
 */
export interface SqliteSchemaStatus {
    currentVersion: number;
    expectedVersion: number;
    upToDate: boolean;
    pendingVersions: number[];
    checksumMismatches: Array<{
        version: number;
        name: string;
        expectedChecksum: string;
        actualChecksum: string;
    }>;
}
/**
 * SQLite database wrapper that provides migration management and transaction support.
 *
 * This class:
 * - Manages SQLite database connections with WAL mode
 * - Handles schema migrations with checksum validation
 * - Provides transaction support with savepoints
 * - Detects and reports write contention errors
 */
export declare class SqliteDatabase implements AuthoritativeSqlDatabase {
    readonly filePath: string;
    readonly connection: DatabaseSync;
    private readonly migrationPlan;
    private readonly busyTimeoutMs;
    private transactionDepth;
    constructor(filePath: string, options?: SqliteDatabaseOptions);
    /**
     * Runs all pending migrations to bring the schema up to date.
     * Checksums are validated to ensure migration integrity.
     * @throws Error if a checksum mismatch is detected
     */
    migrate(): void;
    /**
     * Lists all applied migrations in version order.
     * @returns Array of applied migration records
     */
    listAppliedMigrations(): AppliedSqliteMigrationRecord[];
    /**
     * Gets the current schema status including pending migrations and checksum mismatches.
     * @returns The schema status object
     */
    getSchemaStatus(): SqliteSchemaStatus;
    /**
     * Asserts that the schema is at the current version.
     * @throws Error if schema is outdated or has checksum mismatches
     */
    assertSchemaCurrent(): void;
    /**
     * Runs an integrity check on the SQLite database.
     * @returns Array of integrity check results
     */
    integrityCheck(): string[];
    /**
     * Checkpoints the WAL (Write-Ahead Log) file, truncating it to zero.
     * This ensures all pending writes are flushed to the main database file.
     * @returns Object containing checkpoint results
     */
    checkpointWal(): {
        mode: "TRUNCATE";
        busy: number;
        logFrames: number;
        checkpointedFrames: number;
    };
    /**
     * Executes a function within a database transaction.
     * Automatically commits on success or rolls back on error.
     * @param work - The function to execute within the transaction
     * @returns The result of the work function
     */
    transaction<T>(work: () => T): T;
    /**
     * Executes a function within a consistent read transaction.
     * When already inside a write transaction, the current authoritative view is reused.
     * @param work - The function to execute within the read transaction
     * @returns The result of the work function
     */
    readTransaction<T>(work: () => T): T;
    /**
       * Storage backend type identifier.
       * Used by HealthService to select the appropriate health probe.
       */
    readonly backendType: "sqlite";
    /**
     * Checks database writability by creating/deleting a probe table.
     * @returns true if the database is writable
     */
    healthCheck(): Promise<boolean>;
    /**
     * Closes the database connection.
     */
    close(): void;
    /**
     * Ensures the migration ledger table exists.
     */
    private ensureMigrationLedgerTable;
    /**
     * Executes work within a transaction or savepoint.
     * @param mode - "read" or "write" transaction
     * @param work - Work to execute
     * @returns Result of work
     */
    private runInTransaction;
    /**
     * Rolls back a transaction or savepoint.
     * @param isRootTransaction - Whether this is a root transaction
     * @param savepointName - Name of the savepoint to rollback
     */
    private rollbackTransaction;
    /**
     * Normalizes a transaction error, converting SQLite BUSY errors to SqliteWriteContentionError.
     */
    private normalizeTransactionError;
    /**
     * Checks if an error indicates SQLite is busy/locked.
     */
    private isBusySqliteError;
    /**
     * Applies a single migration and records it in the ledger.
     * @param migration - The migration definition to apply
     */
    private applyMigration;
    /**
     * Applies known compatible column additions without running full migration SQL.
     * This optimizes common ALTER TABLE ADD COLUMN operations.
     */
    private applyCompatibleColumnMigrationIfKnown;
    /**
     * Adds a column to a table if it doesn't already exist.
     * @param tableName - Name of the table
     * @param columnName - Name of the column to add
     * @param addColumnSql - SQL to add the column
     */
    private ensureColumn;
    /**
     * Checks if a table has a specific column.
     * @param tableName - Name of the table
     * @param columnName - Name of the column
     * @returns True if the column exists
     */
    private tableHasColumn;
    /**
     * Records an applied migration in the schema_migrations table.
     */
    private recordAppliedMigration;
    /**
     * Checks if an existing migration checksum is compatible with the expected one.
     */
    private isMigrationChecksumCompatible;
}
