/**
 * Hot Upgrade Service Factory
 *
 * Creates the appropriate HotUpgradeService based on the storage backend type.
 * - SQLite backend: uses SqliteHotUpgradeRepository (sync operations)
 * - PostgreSQL backend: uses PostgresHotUpgradeRepository (async operations)
 */
import { createHotUpgradeRepository } from "./hot-upgrade-repository.js";
import { HotUpgradeServiceAsync } from "./hot-upgrade-service-async.js";
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
export function createHotUpgradeService(backend) {
    const repo = createHotUpgradeRepository(backend);
    const db = backend.asyncSql;
    return new HotUpgradeServiceAsync(db, repo);
}
//# sourceMappingURL=hot-upgrade-factory.js.map