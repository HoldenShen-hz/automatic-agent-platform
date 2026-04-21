/**
 * Authoritative Storage CLI Utilities
 *
 * This module provides shared utilities for opening and managing the authoritative
 * SQLite/PostgreSQL storage backend from CLI tools. It handles storage backend
 * resolution, graceful shutdown registration, and path management.
 *
 * CLI tools should use these utilities instead of directly opening storage to ensure
 * consistent behavior and proper cleanup on shutdown.
 *
 * @see {@link docs_zh/architecture/00-platform-architecture.md} for storage architecture
 * @see {@link docs_zh/contracts/storage_schema_contract.md} for schema definitions
 */
import { type AuthoritativeStorageBackendHandle, type AuthoritativeStorageContext, type AsyncAuthoritativeStorageContext, requireSqliteAuthoritativeStorageBackend } from "../../platform/state-evidence/truth/storage-backend-factory.js";
export { requireSqliteAuthoritativeStorageBackend };
/**
 * Derives the workspace root directory from a database path.
 *
 * Standard layout:
 *   {workspace}/data/sqlite/*.db -> {workspace}
 * Fallback:
 *   returns the directory containing the database file
 */
export declare function deriveCliWorkspaceRoot(dbPath: string): string;
/**
 * Resolves the database path from environment or constructs a default.
 *
 * Checks AA_DB_PATH first, then falls back to data/sqlite/authoritative-demo.db
 * in the current working directory (creating directories as needed).
 *
 * @returns The resolved database path
 */
export declare function resolveCliDbPath(): string;
/**
 * Opens a synchronous authoritative storage backend for CLI use.
 *
 * @param dbPath - Optional explicit database path
 * @returns A storage backend handle with close method
 */
export declare function openCliAuthoritativeStorageBackend(dbPath?: string): AuthoritativeStorageBackendHandle;
/**
 * Opens a synchronous authoritative storage context for CLI use.
 *
 * @param dbPath - Optional explicit database path
 * @returns A storage context with database and store access
 */
export declare function openCliAuthoritativeStorageContext(dbPath?: string): AuthoritativeStorageContext;
/**
 * Opens CLI storage, optionally runs migrations, and guarantees cleanup.
 */
export declare function withCliStorage<T>(runner: (storage: AuthoritativeStorageContext) => T, options?: {
    dbPath?: string;
    migrate?: boolean;
}): T;
/**
 * Opens CLI storage for a long-lived synchronous service process.
 *
 * Keeps the storage open after the runner resolves so lifecycle can be delegated
 * to process-level shutdown handlers.
 */
export declare function withPersistentCliStorage<T>(runner: (storage: AuthoritativeStorageContext) => T, options?: {
    dbPath?: string;
    migrate?: boolean;
}): T;
/**
 * Opens an asynchronous authoritative storage backend for CLI use.
 *
 * @param dbPath - Optional explicit database path
 * @returns A promise resolving to a storage backend handle
 */
export declare function openCliAuthoritativeStorageBackendAsync(dbPath?: string): Promise<AuthoritativeStorageBackendHandle>;
/**
 * Async variant of withCliStorage for backend handles.
 */
export declare function withCliStorageBackendAsync<T>(runner: (storage: AuthoritativeStorageBackendHandle) => Promise<T>, options?: {
    dbPath?: string;
    migrate?: boolean;
}): Promise<T>;
/**
 * Opens an asynchronous authoritative storage context for CLI use.
 *
 * @param dbPath - Optional explicit database path
 * @returns A promise resolving to a storage context
 */
export declare function openCliAuthoritativeStorageContextAsync(dbPath?: string): Promise<AsyncAuthoritativeStorageContext>;
/**
 * Async variant of withCliStorage for async CLI entrypoints.
 */
export declare function withCliStorageAsync<T>(runner: (storage: AsyncAuthoritativeStorageContext) => Promise<T>, options?: {
    dbPath?: string;
    migrate?: boolean;
}): Promise<T>;
/**
 * Opens CLI storage for a long-lived service process.
 *
 * Unlike withCliStorageAsync(), this helper intentionally keeps the storage open
 * after the runner resolves so the caller can hand lifecycle management to
 * GracefulShutdown or another process-level coordinator.
 */
export declare function withPersistentCliStorageAsync<T>(runner: (storage: AsyncAuthoritativeStorageContext) => Promise<T>, options?: {
    dbPath?: string;
    migrate?: boolean;
}): Promise<T>;
/**
 * Describes the storage backend plan without opening storage.
 *
 * @param dbPath - Optional explicit database path
 * @returns The planned storage backend configuration
 */
export declare function describeCliAuthoritativeStoragePlan(dbPath?: string): import("../../platform/state-evidence/truth/storage-backend-factory.js").AuthoritativeStorageBackendPlan;
/**
 * Asserts that the storage backend is executable from CLI.
 *
 * Validates that the storage can be opened and throws if not.
 *
 * @param dbPath - Optional explicit database path
 */
export declare function assertCliAuthoritativeStorageExecutable(dbPath?: string): void;
/**
 * Requires the storage backend to be SQLite-backed.
 *
 * @param storage - The storage backend to validate
 * @returns The SQLite database handle
 */
export declare function requireCliSqliteDatabase(storage: AuthoritativeStorageBackendHandle): import("../../platform/state-evidence/truth/authoritative-sql-database.js").SqliteDatabase;
