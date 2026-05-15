/**
 * Execution Lease Service Factory
 *
 * Creates the appropriate ExecutionLeaseService based on the storage backend type.
 */

import type { AuthoritativeSqlDatabase } from "../../five-plane-state-evidence/truth/authoritative-sql-database.js";
import { AuthoritativeTaskStore } from "../../five-plane-state-evidence/truth/authoritative-task-store.js";
import type { SqliteAuthoritativeStorageBackendHandle, PostgresAuthoritativeStorageBackendHandle } from "../../five-plane-state-evidence/truth/storage-backend-factory.js";
import { requireSyncCompatibleAuthoritativeSqlDatabase } from "../../five-plane-state-evidence/truth/storage-backend-factory.js";
import type { LeaseRepository } from "./lease-repository.js";
import { createLeaseRepository } from "./lease-repository.js";
import { ExecutionLeaseServiceAsync } from "./execution-lease-service-async.js";

export type AnyStorageBackendHandle = SqliteAuthoritativeStorageBackendHandle | PostgresAuthoritativeStorageBackendHandle;

/**
 * Creates an ExecutionLeaseServiceAsync backed by the appropriate repository
 * for the given storage backend.
 *
 * @param backend - The storage backend handle (SQLite or PostgreSQL)
 * @returns A configured `ExecutionLeaseServiceAsync` instance
 */
export function createExecutionLeaseService(
  backend: AnyStorageBackendHandle,
): ExecutionLeaseServiceAsync {
  const repo = createLeaseRepository(backend);
  const db = requireSyncCompatibleAuthoritativeSqlDatabase(
    backend,
    "storage.postgres_shadow_sqlite_required_for_execution_lease_service",
  ) as AuthoritativeSqlDatabase;
  const store = new AuthoritativeTaskStore(db);
  return new ExecutionLeaseServiceAsync(db, store, repo);
}
