/**
 * Hot Upgrade Service Factory
 *
 * Creates the appropriate HotUpgradeService based on the storage backend type.
 * - SQLite backend: uses SqliteHotUpgradeRepository (sync operations)
 * - PostgreSQL backend: uses PostgresHotUpgradeRepository (async operations)
 */
import type { SqliteAuthoritativeStorageBackendHandle, PostgresAuthoritativeStorageBackendHandle } from "../../state-evidence/truth/storage-backend-factory.js";
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
export declare function createHotUpgradeService(backend: AnyStorageBackendHandle): HotUpgradeServiceAsync;
