/**
 * Lease Repository Interface
 *
 * Abstracts all lease-related database operations behind a repository interface,
 * enabling both SQLite (single-node) and PostgreSQL (multi-node) backends.
 */
import { SqliteLeaseRepository } from "./lease-repository-sqlite.js";
import { PostgresLeaseRepository } from "./lease-repository-postgres.js";
/**
 * Creates the appropriate Lease repository based on the storage backend type.
 *
 * - SQLite backend: uses SqliteLeaseRepository (sync operations)
 * - PostgreSQL backend: uses PostgresLeaseRepository (async operations)
 *
 * @param backend - The storage backend handle (SQLite or PostgreSQL)
 * @returns A LeaseRepository implementation for the given backend
 */
export function createLeaseRepository(backend) {
    if (backend.driver === "postgres") {
        return new PostgresLeaseRepository(backend.asyncSql);
    }
    return new SqliteLeaseRepository(backend.sql);
}
//# sourceMappingURL=lease-repository.js.map