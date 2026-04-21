/**
 * @fileoverview PgDatabase - PostgreSQL implementation of AuthoritativeSqlDatabase
 *
 * Provides a PostgreSQL implementation for production deployments requiring
 * PostgreSQL as the authoritative storage backend. Maintains API compatibility
 * with the SQLite implementation while providing PostgreSQL-specific optimizations.
 *
 * Requires the `postgres` npm package, which is now declared in the main runtime dependencies.
 */
import type { DatabaseSync } from "node:sqlite";
import { StorageError } from "../../../contracts/errors.js";
import type { AsyncSqlConnection, AsyncSqlDatabase } from "../async-sql-database.js";
/**
 * Configuration options for PgDatabase connection.
 */
export interface PgDatabaseOptions {
    /** Data Source Name - PostgreSQL connection string */
    dsn: string;
    /** PostgreSQL schema name (defaults to "public") */
    schema?: string;
    /** Minimum pool size (defaults to 0) */
    poolMin?: number;
    /** Maximum pool size (defaults to 20) */
    poolMax?: number;
    /** Whether to use SSL connection */
    ssl?: boolean;
    /** Connection timeout in milliseconds */
    connectionTimeoutMs?: number;
}
/**
 * Schema status for PostgreSQL including version info.
 */
export interface PgSchemaStatus {
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
 * PgWriteError is thrown when a PostgreSQL write operation fails.
 */
export declare class PgWriteError extends StorageError {
    readonly operation: string;
    readonly dsn: string;
    constructor(operation: string, dsn: string, cause?: unknown);
}
/**
 * Type guard to check if an error is a PgWriteError.
 */
export declare function isPgWriteError(error: unknown): error is PgWriteError;
/**
 * Interface for raw SQL execution on the postgres driver.
 * Covers both tagged template syntax and .unsafe() prepared statements.
 */
interface PostgresRawSqlExecutor {
    <T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]>;
    unsafe<T = unknown>(sql: string, params?: readonly unknown[]): Promise<T[]>;
    end(): Promise<void>;
    begin<T>(work: (sql: PostgresRawSqlExecutor) => Promise<T>): Promise<T>;
}
/**
 * Adapter interface that bridges async PgDatabase methods to the sync
 * AuthoritativeSqlDatabase interface expected by AuthoritativeTaskStore.
 *
 * This interface captures the minimal set of methods that AuthoritativeTaskStore
 * requires from a PostgreSQL backend: connection access and sync transaction.
 */
export interface PostgresDatabaseSyncAdapter {
    readonly filePath: string;
    readonly connection: Pick<DatabaseSync, "exec" | "prepare">;
    migrate(): void;
    getSchemaStatus(): {
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
    };
    assertSchemaCurrent(): void;
    integrityCheck(): string[];
    transaction<T>(work: () => T): T;
    readTransaction<T>(work: () => T): T;
}
/**
 * PgDatabase provides PostgreSQL storage for the automatic agent system.
 *
 * This class uses the `postgres` npm package for all database operations.
 * Transaction methods are async and callers must await them.
 *
 * This class implements both:
 * - AuthoritativeSqlDatabase (sync interface, via createUnsupportedPostgresSyncFacade)
 * - AsyncSqlDatabase (async interface, via asyncConnection getter and async methods)
 */
export declare class PgDatabase implements AsyncSqlDatabase {
    readonly dsn: string;
    readonly schema: string;
    readonly poolMin: number;
    readonly poolMax: number;
    private sql;
    private readonly transactionScope;
    private _connected;
    private _connecting;
    private _connectionError;
    private _connection;
    private constructor();
    /**
     * Creates a connected PgDatabase instance.
     * @param options - Configuration options
     * @returns A connected PgDatabase instance
     */
    static open(options: PgDatabaseOptions): Promise<PgDatabase>;
    /**
     * Creates a disconnected PgDatabase instance for testing purposes.
     * @param options - Configuration options
     * @returns A disconnected PgDatabase instance
     */
    static createDisconnectedForTest(options: PgDatabaseOptions): PgDatabase;
    /**
     * Establishes connection to the PostgreSQL database.
     * Loads the postgres driver and initializes the connection pool.
     */
    private connect;
    /**
     * Ensures the database is connected. Throws if not.
     * @throws StorageError if not connected
     */
    private ensureConnected;
    /**
     * The connection object providing exec/prepare interface.
     * Throws helpful errors before connect() is called.
     */
    get connection(): Pick<DatabaseSync, "exec" | "prepare">;
    /**
     * Async connection interface for query and execute operations.
     * This provides the async-first API that works naturally with PostgreSQL.
     */
    get asyncConnection(): AsyncSqlConnection;
    /**
     * AsyncSqlDatabase.filePath — returns the DSN for PostgreSQL.
     */
    get filePath(): string;
    /**
     * AsyncSqlDatabase.close() — closes the database connection.
     */
    close(): Promise<void>;
    /**
     * AsyncSqlDatabase.assertSchemaCurrent() — async version.
     */
    assertSchemaCurrent(): Promise<void>;
    /**
     * Execute work within a database transaction using the async connection pattern.
     *
     * This implements the AsyncSqlDatabase.transaction() interface.
     * The work function receives an AsyncSqlConnection scoped to the transaction.
     *
     * @param work - Async function to execute within the transaction
     */
    transaction<T>(work: (conn: AsyncSqlConnection) => Promise<T>): Promise<T>;
    /**
     * Execute work within a read-only transaction using the async connection pattern.
     *
     * @param work - Async function to execute within the read transaction
     */
    readTransaction<T>(work: (conn: AsyncSqlConnection) => Promise<T>): Promise<T>;
    /**
     * Runs all pending migrations to bring the schema up to date.
     * **Async** - use await.
     */
    migrate(): Promise<void>;
    /**
     * Gets the current schema status.
     * **Async** - use await.
     * @returns The schema status including version and pending migrations
     */
    getSchemaStatus(): Promise<PgSchemaStatus>;
    healthCheck(): Promise<boolean>;
    /**
     * Runs an integrity check on the database.
     * **Async** - use await.
     * @returns Array of integrity check results
     */
    integrityCheck(): Promise<string[]>;
    /**
     * Get the underlying postgres SQL object for advanced operations.
     * @returns The raw postgres SQL executor
     */
    getSql(): PostgresRawSqlExecutor;
    /**
     * Check if the database is connected.
     * @returns True if connected
     */
    isConnected(): boolean;
}
export {};
