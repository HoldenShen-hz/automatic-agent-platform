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
 * @see {@link docs_zh/automatic_agent_patform_arthitecture_design.md} for storage architecture
 * @see {@link docs_zh/contracts/storage_schema_contract.md} for schema definitions
 */

import { mkdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import {
  openAsyncAuthoritativeStorageBackend,
  openAsyncAuthoritativeStorageContext,
  openAuthoritativeStorageBackend,
  openAuthoritativeStorageContext,
  planAuthoritativeStorageBackend,
  type AuthoritativeStorageBackendHandle,
  type AuthoritativeStorageContext,
  type AsyncAuthoritativeStorageContext,
  requireSqliteAuthoritativeStorageBackend,
} from "../../platform/state-evidence/truth/storage-backend-factory.js";
import { StorageError } from "../../platform/contracts/errors.js";
import { readTrimmedEnv } from "../../platform/control-plane/config-center/runtime-env.js";
import { getGlobalGracefulShutdown } from "../../platform/execution/startup/graceful-shutdown.js";

export { requireSqliteAuthoritativeStorageBackend };

/**
 * Derives the workspace root directory from a database path.
 *
 * Standard layout:
 *   {workspace}/data/sqlite/*.db -> {workspace}
 * Fallback:
 *   returns the directory containing the database file
 */
export function deriveCliWorkspaceRoot(dbPath: string): string {
  const dbDir = dirname(dbPath);
  if (basename(dbDir) === "sqlite" && basename(dirname(dbDir)) === "data") {
    return dirname(dirname(dbDir));
  }
  return dbDir;
}

/**
 * Target for CLI synchronous storage operations.
 * Contains the resolved database path and environment variables.
 */
interface CliSyncStorageTarget {
  dbPath: string;
  env: NodeJS.ProcessEnv;
}

/**
 * Registers a one-time shutdown handler for a storage instance.
 *
 * Wraps the storage's close method to ensure it can only be called once,
 * and registers the handler with the global graceful shutdown coordinator.
 *
 * @param storage - The storage instance to wrap
 * @param label - A descriptive label for logging purposes
 * @returns The wrapped storage instance with single-use close
 */
function registerCliShutdownHandler<T extends { close(): void | Promise<void>; driver: string }>(
  storage: T,
  label: string,
): T {
  const shutdown = getGlobalGracefulShutdown();
  const originalClose = storage.close.bind(storage);
  let closed = false;

  // Create a close function that can only be called once
  const closeOnce = (() => {
    return () => {
      if (closed) {
        return undefined;
      }
      closed = true;
      return originalClose();
    };
  })() as unknown as T["close"];

  shutdown.addHandler({
    name: `cli_storage:${label}:${storage.driver}`,
    handler: async () => {
      await Promise.resolve(closeOnce());
    },
  });

  return {
    ...storage,
    close: closeOnce,
  };
}

/**
 * Resolves the database path from environment or constructs a default.
 *
 * Checks AA_DB_PATH first, then falls back to data/sqlite/authoritative-demo.db
 * in the current working directory (creating directories as needed).
 *
 * @returns The resolved database path
 */
export function resolveCliDbPath(): string {
  const fromEnv = readTrimmedEnv(process.env, "AA_DB_PATH");
  if (fromEnv != null) {
    return fromEnv;
  }

  const sqliteDir = join(process.cwd(), "data", "sqlite");
  mkdirSync(sqliteDir, { recursive: true });
  return join(sqliteDir, "authoritative-demo.db");
}

/**
 * Resolves the target for synchronous CLI storage operations.
 *
 * For PostgreSQL backends, requires a shadow SQLite path for CLI operations
 * since CLI tools cannot directly use the PostgreSQL connection.
 *
 * @param dbPath - Optional explicit database path
 * @param env - Environment variables to use
 * @returns The resolved storage target with path and environment
 */
function resolveCliSyncStorageTarget(
  dbPath: string = resolveCliDbPath(),
  env: NodeJS.ProcessEnv = process.env,
): CliSyncStorageTarget {
  const plan = planAuthoritativeStorageBackend({
    dbPath,
    env,
  });

  if (!plan.executable) {
    throw new StorageError(plan.openErrorCode ?? "storage.backend_open_failed", plan.openErrorCode ?? "storage.backend_open_failed");
  }

  // Non-PostgreSQL backends can be used directly
  if (plan.runtimeProfile.driver !== "postgres") {
    return { dbPath, env };
  }

  // PostgreSQL requires shadow SQLite for CLI operations
  const shadowSqlitePath = plan.runtimeProfile.postgres?.shadowSqlitePath ?? null;
  if (shadowSqlitePath == null || shadowSqlitePath.length === 0) {
    throw new StorageError(
      "storage.cli_sync_shadow_sqlite_required",
      "storage.cli_sync_shadow_sqlite_required",
      {
        retryable: false,
        details: {
          requestedDbPath: dbPath,
          driver: plan.runtimeProfile.driver,
          dualRun: plan.runtimeProfile.postgres?.dualRun ?? false,
        },
      },
    );
  }

  return {
    dbPath: shadowSqlitePath,
    env: {
      ...env,
      AA_STORAGE_DRIVER: "sqlite",
    },
  };
}

/**
 * Opens a synchronous authoritative storage backend for CLI use.
 *
 * @param dbPath - Optional explicit database path
 * @returns A storage backend handle with close method
 */
export function openCliAuthoritativeStorageBackend(
  dbPath: string = resolveCliDbPath(),
): AuthoritativeStorageBackendHandle {
  const target = resolveCliSyncStorageTarget(dbPath);
  return registerCliShutdownHandler(
    openAuthoritativeStorageBackend({
      dbPath: target.dbPath,
      env: target.env,
    }),
    target.dbPath,
  );
}

/**
 * Opens a synchronous authoritative storage context for CLI use.
 *
 * @param dbPath - Optional explicit database path
 * @returns A storage context with database and store access
 */
export function openCliAuthoritativeStorageContext(
  dbPath: string = resolveCliDbPath(),
): AuthoritativeStorageContext {
  const target = resolveCliSyncStorageTarget(dbPath);
  return registerCliShutdownHandler(
    openAuthoritativeStorageContext({
      dbPath: target.dbPath,
      env: target.env,
    }),
    target.dbPath,
  );
}

/**
 * Opens CLI storage, optionally runs migrations, and guarantees cleanup.
 */
export function withCliStorage<T>(
  runner: (storage: AuthoritativeStorageContext) => T,
  options: {
    dbPath?: string;
    migrate?: boolean;
  } = {},
): T {
  const storage = openCliAuthoritativeStorageContext(options.dbPath);
  if (options.migrate !== false) {
    storage.migrate();
  }

  try {
    const result = runner(storage);
    if (result instanceof Promise) {
      return result.finally(() => {
        storage.close();
      }) as T;
    }
    storage.close();
    return result;
  } finally {
    // Promise-returning runners close storage in the .finally above.
  }
}

/**
 * Opens CLI storage for a long-lived synchronous service process.
 *
 * Keeps the storage open after the runner resolves so lifecycle can be delegated
 * to process-level shutdown handlers.
 */
export function withPersistentCliStorage<T>(
  runner: (storage: AuthoritativeStorageContext) => T,
  options: {
    dbPath?: string;
    migrate?: boolean;
  } = {},
): T {
  const storage = openCliAuthoritativeStorageContext(options.dbPath);
  if (options.migrate !== false) {
    storage.migrate();
  }

  try {
    return runner(storage);
  } catch (error) {
    storage.close();
    throw error;
  }
}

/**
 * Opens an asynchronous authoritative storage backend for CLI use.
 *
 * @param dbPath - Optional explicit database path
 * @returns A promise resolving to a storage backend handle
 */
export async function openCliAuthoritativeStorageBackendAsync(
  dbPath: string = resolveCliDbPath(),
): Promise<AuthoritativeStorageBackendHandle> {
  return registerCliShutdownHandler(
    await openAsyncAuthoritativeStorageBackend({
      dbPath,
    }),
    dbPath,
  );
}

/**
 * Async variant of withCliStorage for backend handles.
 */
export async function withCliStorageBackendAsync<T>(
  runner: (storage: AuthoritativeStorageBackendHandle) => Promise<T>,
  options: {
    dbPath?: string;
    migrate?: boolean;
  } = {},
): Promise<T> {
  const storage = await openCliAuthoritativeStorageBackendAsync(options.dbPath);
  if (options.migrate !== false) {
    await storage.migrate();
  }

  try {
    return await runner(storage);
  } finally {
    await storage.close();
  }
}

/**
 * Opens an asynchronous authoritative storage context for CLI use.
 *
 * @param dbPath - Optional explicit database path
 * @returns A promise resolving to a storage context
 */
export async function openCliAuthoritativeStorageContextAsync(
  dbPath: string = resolveCliDbPath(),
): Promise<AsyncAuthoritativeStorageContext> {
  return registerCliShutdownHandler(
    await openAsyncAuthoritativeStorageContext({
      dbPath,
    }),
    dbPath,
  );
}

/**
 * Async variant of withCliStorage for async CLI entrypoints.
 */
export async function withCliStorageAsync<T>(
  runner: (storage: AsyncAuthoritativeStorageContext) => Promise<T>,
  options: {
    dbPath?: string;
    migrate?: boolean;
  } = {},
): Promise<T> {
  const storage = await openCliAuthoritativeStorageContextAsync(options.dbPath);
  if (options.migrate !== false) {
    await storage.migrate();
  }

  try {
    return await runner(storage);
  } finally {
    await storage.close();
  }
}

/**
 * Opens CLI storage for a long-lived service process.
 *
 * Unlike withCliStorageAsync(), this helper intentionally keeps the storage open
 * after the runner resolves so the caller can hand lifecycle management to
 * GracefulShutdown or another process-level coordinator.
 */
export async function withPersistentCliStorageAsync<T>(
  runner: (storage: AsyncAuthoritativeStorageContext) => Promise<T>,
  options: {
    dbPath?: string;
    migrate?: boolean;
  } = {},
): Promise<T> {
  const storage = await openCliAuthoritativeStorageContextAsync(options.dbPath);
  if (options.migrate !== false) {
    await storage.migrate();
  }

  try {
    return await runner(storage);
  } catch (error) {
    await storage.close();
    throw error;
  }
}

/**
 * Describes the storage backend plan without opening storage.
 *
 * @param dbPath - Optional explicit database path
 * @returns The planned storage backend configuration
 */
export function describeCliAuthoritativeStoragePlan(dbPath: string = resolveCliDbPath()) {
  return planAuthoritativeStorageBackend({
    dbPath,
  });
}

/**
 * Asserts that the storage backend is executable from CLI.
 *
 * Validates that the storage can be opened and throws if not.
 *
 * @param dbPath - Optional explicit database path
 */
export function assertCliAuthoritativeStorageExecutable(
  dbPath: string = resolveCliDbPath(),
): void {
  resolveCliSyncStorageTarget(dbPath);
}

/**
 * Requires the storage backend to be SQLite-backed.
 *
 * @param storage - The storage backend to validate
 * @returns The SQLite database handle
 */
export function requireCliSqliteDatabase(storage: AuthoritativeStorageBackendHandle) {
  return requireSqliteAuthoritativeStorageBackend(storage);
}
