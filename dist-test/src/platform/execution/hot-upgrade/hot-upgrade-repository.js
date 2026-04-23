/**
 * Hot Upgrade Repository Interface
 *
 * Abstracts all hot upgrade-related database operations behind a repository interface,
 * enabling both SQLite (single-node) and PostgreSQL (multi-node HA) backends.
 */
import { SqliteHotUpgradeRepository } from "./hot-upgrade-repository-sqlite.js";
import { PostgresHotUpgradeRepository } from "./hot-upgrade-repository-postgres.js";
/**
 * Creates the appropriate HotUpgrade repository based on the storage backend type.
 *
 * - SQLite backend: uses SqliteHotUpgradeRepository (sync operations)
 * - PostgreSQL backend: uses PostgresHotUpgradeRepository (async operations)
 *
 * @param backend - The storage backend handle (SQLite or PostgreSQL)
 * @returns A HotUpgradeRepository implementation for the given backend
 */
export function createHotUpgradeRepository(backend) {
    if (backend.driver === "postgres") {
        return new PostgresHotUpgradeRepository(backend.asyncSql);
    }
    return new SqliteHotUpgradeRepository(backend.sql);
}
//# sourceMappingURL=hot-upgrade-repository.js.map