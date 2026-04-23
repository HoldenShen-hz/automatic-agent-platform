/**
 * HA Repository Interface
 *
 * Abstracts all HA-related database operations behind a repository interface,
 * enabling both SQLite (single-node) and PostgreSQL (multi-node HA) backends.
 */
import { SqliteHaRepository } from "./ha-repository-sqlite.js";
import { PostgresHaRepository } from "./ha-repository-postgres.js";
/**
 * Creates the appropriate HA repository based on the storage backend type.
 *
 * - SQLite backend: uses SqliteHaRepository (sync operations)
 * - PostgreSQL backend: uses PostgresHaRepository (async operations with advisory locks)
 *
 * @param backend - The storage backend handle (SQLite or PostgreSQL)
 * @param coordinatorId - Optional coordinator ID for PostgreSQL advisory locks
 * @returns A HaRepository implementation for the given backend
 */
export function createHaRepository(backend, coordinatorId) {
    if (backend.driver === "postgres") {
        if (!coordinatorId) {
            throw new Error("coordinatorId is required for PostgreSQL HA repository");
        }
        return new PostgresHaRepository(backend.asyncSql, coordinatorId);
    }
    return new SqliteHaRepository(backend.sql);
}
//# sourceMappingURL=ha-repository.js.map