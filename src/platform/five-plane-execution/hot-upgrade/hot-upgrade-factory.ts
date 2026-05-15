/**
 * Hot Upgrade Service Factory
 *
 * Creates the appropriate HotUpgradeService based on the storage backend type.
 * - SQLite backend: uses SqliteHotUpgradeRepository (sync operations)
 * - PostgreSQL backend: uses PostgresHotUpgradeRepository (async operations)
 */

import type { AuthoritativeSqlDatabase } from "../../five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { AsyncSqlDatabase } from "../../five-plane-state-evidence/truth/async-sql-database.js";
import type {
  SqliteAuthoritativeStorageBackendHandle,
  PostgresAuthoritativeStorageBackendHandle,
} from "../../five-plane-state-evidence/truth/storage-backend-factory.js";
import { createHotUpgradeRepository } from "./hot-upgrade-repository.js";
import { HotUpgradeServiceAsync } from "./hot-upgrade-service-async.js";

export type AnyStorageBackendHandle = SqliteAuthoritativeStorageBackendHandle | PostgresAuthoritativeStorageBackendHandle;

/**
 * Creates a `HotUpgradeServiceAsync` backed by the appropriate repository
 * for the given storage backend.
 *
 * - SQLite backend: uses SqliteHotUpgradeRepository (sync via SqliteAsyncAdapter)
 * - PostgreSQL backend: uses PostgresHotUpgradeRepository (native async)
 *
 * @param backend - The storage backend handle (SQLite or PostgreSQL)
 * @returns A configured `HotUpgradeServiceAsync` instance
 */
export function createHotUpgradeService(
  backend: AnyStorageBackendHandle,
): HotUpgradeServiceAsync {
  const repo = createHotUpgradeRepository(backend);
  const db = backend.asyncSql as AsyncSqlDatabase;
  return new HotUpgradeServiceAsync(db, repo);
}
