import { type SandboxPolicy } from "../../control-plane/iam/sandbox-policy.js";
import { type StorageBackendRuntimeProfile } from "./storage-backend-config.js";
import { type AuthoritativeSqlDatabase, SqliteDatabase, type SqliteDatabaseOptions } from "./sqlite/sqlite-database.js";
import type { PgDatabase } from "./postgres/pg-database.js";
import { AuthoritativeTaskStore } from "./authoritative-task-store.js";
import type { AsyncSqlDatabase } from "./async-sql-database.js";
import { type AsyncRepositoryRegistry } from "./async-repository-registry.js";
/**
 * Options for opening an authoritative storage backend.
 */
export interface AuthoritativeStorageBackendOptions {
    /** Path to the database file */
    dbPath: string;
    /** Runtime environment (e.g., 'development', 'staging', 'prod') */
    environment?: string;
    /** Process environment variables */
    env?: NodeJS.ProcessEnv;
    /** Sandbox policy for path validation */
    sandboxPolicy?: SandboxPolicy;
    /** SQLite-specific options */
    sqliteOptions?: SqliteDatabaseOptions;
}
/**
 * Plan for opening a storage backend, including configuration validation.
 */
export interface AuthoritativeStorageBackendPlan {
    environment: string;
    runtimeProfile: StorageBackendRuntimeProfile;
    /** Whether the backend can be opened successfully */
    executable: boolean;
    /** Error code if opening failed, null otherwise */
    openErrorCode: string | null;
}
/**
 * Handle for an open SQLite-based authoritative storage backend.
 */
export interface SqliteAuthoritativeStorageBackendHandle {
    driver: "sqlite";
    runtimeProfile: StorageBackendRuntimeProfile;
    /** The authoritative SQL database interface (synchronous) */
    sql: AuthoritativeSqlDatabase;
    /** The async SQL database interface (SQLite wrapped as async) */
    asyncSql: AsyncSqlDatabase;
    /** Async repository registry for gradual sync -> async migration */
    asyncRepos: AsyncRepositoryRegistry;
    /** The SQLite database instance */
    sqlite: SqliteDatabase;
    /** Runs pending migrations */
    migrate(): void | Promise<void>;
    /** Closes the database connection */
    close(): void | Promise<void>;
}
/**
 * Handle for an open PostgreSQL-based authoritative storage backend.
 */
export interface PostgresAuthoritativeStorageBackendHandle {
    driver: "postgres";
    runtimeProfile: StorageBackendRuntimeProfile;
    /** Sync compatibility database. Uses shadow SQLite when configured, otherwise a fail-close facade. */
    sql: AuthoritativeSqlDatabase;
    /** The async SQL database interface (native async for PostgreSQL) */
    asyncSql: AsyncSqlDatabase;
    /** Async repository registry for PostgreSQL-backed runtime services */
    asyncRepos: AsyncRepositoryRegistry;
    /** The PostgreSQL database instance */
    postgres: PgDatabase;
    /** Shadow SQLite used for compatibility during PostgreSQL dual-run, when configured */
    shadowSqlite?: SqliteDatabase;
    /** Runs pending migrations */
    migrate(): void | Promise<void>;
    /** Closes the database connection */
    close(): void | Promise<void>;
}
/**
 * Union type for any open authoritative storage backend.
 */
export type AuthoritativeStorageBackendHandle = SqliteAuthoritativeStorageBackendHandle | PostgresAuthoritativeStorageBackendHandle;
/**
 * SQLite storage context including the authoritative task store.
 */
export interface SqliteAuthoritativeStorageContext extends SqliteAuthoritativeStorageBackendHandle {
    /** The authoritative task store data access layer */
    store: AuthoritativeTaskStore;
}
/**
 * PostgreSQL storage context including the authoritative task store.
 */
export interface PostgresAuthoritativeStorageContext extends PostgresAuthoritativeStorageBackendHandle {
    /** The authoritative task store data access layer */
    store: AuthoritativeTaskStore;
    /** Shadow SQLite used for compatibility during PostgreSQL dual-run */
    shadowSqlite?: SqliteDatabase;
}
/**
 * Union type for any storage context.
 */
export type AuthoritativeStorageContext = SqliteAuthoritativeStorageContext | PostgresAuthoritativeStorageContext;
/**
 * Async storage context (currently only SQLite is fully supported for sync access).
 */
export type AsyncAuthoritativeStorageContext = SqliteAuthoritativeStorageContext | PostgresAuthoritativeStorageContext;
/**
 * Type guard to extract SQLite handle from a storage backend.
 * @param storage - The storage backend handle
 * @returns The SQLite database instance
 * @throws ValidationError if the backend is not SQLite
 */
export declare function requireSqliteAuthoritativeStorageBackend(storage: AuthoritativeStorageBackendHandle): SqliteDatabase;
/**
 * Type guard to extract PostgreSQL handle from a storage backend.
 * @param storage - The storage backend handle
 * @returns The PostgreSQL storage handle
 * @throws ValidationError if the backend is not PostgreSQL
 */
export declare function requirePostgresAuthoritativeStorageBackend(storage: AuthoritativeStorageBackendHandle): PostgresAuthoritativeStorageBackendHandle;
export declare function requireSyncCompatibleAuthoritativeSqlDatabase(storage: AuthoritativeStorageBackendHandle, reasonCode?: string): AuthoritativeSqlDatabase;
/**
 * Creates a plan for opening a storage backend, validating configuration.
 * This does not actually open the database, just validates and plans.
 *
 * @param options - Configuration options for the storage backend
 * @returns A plan indicating whether the backend can be opened and any issues
 */
export declare function planAuthoritativeStorageBackend(options: AuthoritativeStorageBackendOptions): AuthoritativeStorageBackendPlan;
/**
 * Opens a synchronous authoritative storage backend.
 *
 * For PostgreSQL dual-run configurations this returns the configured shadow
 * SQLite compatibility database so existing synchronous callers remain usable
 * while the native PostgreSQL path is handled via the async openers.
 *
 * @param options - Configuration options for the storage backend
 * @returns The open storage backend handle
 * @throws StorageError if opening fails
 */
export declare function openAuthoritativeStorageBackend(options: AuthoritativeStorageBackendOptions): AuthoritativeStorageBackendHandle;
/**
 * Opens a PostgreSQL authoritative storage backend.
 *
 * This function is async because PostgreSQL connection establishment
 * involves network I/O and pool initialization.
 *
 * **Note:** This function requires the `postgres` npm package as a runtime
 * dependency. When a dual-run shadow SQLite path is configured, the returned
 * handle also exposes that shadow database through `sql` for synchronous
 * compatibility callers.
 *
 * @param options - The storage backend options including dsn, pool config, etc.
 * @returns A promise that resolves to the PostgreSQL storage handle
 * @throws Error if the postgres driver is unavailable or connection fails
 */
export declare function openPostgresAuthoritativeStorageBackend(options: AuthoritativeStorageBackendOptions): Promise<PostgresAuthoritativeStorageBackendHandle>;
/**
 * Opens a storage backend and returns a context including the authoritative task store.
 * This is the main entry point for getting a fully configured storage stack.
 *
 * @param options - Configuration options for the storage backend
 * @returns The storage context with the authoritative task store included
 */
export declare function openAuthoritativeStorageContext(options: AuthoritativeStorageBackendOptions): AuthoritativeStorageContext;
/**
 * Opens a storage backend asynchronously.
 * Works with both SQLite and PostgreSQL backends.
 *
 * @param options - Configuration options for the storage backend
 * @returns The open storage backend handle
 */
export declare function openAsyncAuthoritativeStorageBackend(options: AuthoritativeStorageBackendOptions): Promise<AuthoritativeStorageBackendHandle>;
/**
 * Opens a storage context asynchronously.
 *
 * PostgreSQL-backed contexts require a dual-run shadow SQLite path so the
 * existing synchronous AuthoritativeTaskStore remains available while the
 * PostgreSQL backend owns connection lifecycle and migrations.
 *
 * @param options - Configuration options for the storage backend
 * @returns The async storage context with the authoritative task store included
 */
export declare function openAsyncAuthoritativeStorageContext(options: AuthoritativeStorageBackendOptions): Promise<AsyncAuthoritativeStorageContext>;
