/**
 * Execution Lease Service Factory
 *
 * Creates the appropriate ExecutionLeaseService based on the storage backend type.
 */
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import { requireSyncCompatibleAuthoritativeSqlDatabase } from "../../state-evidence/truth/storage-backend-factory.js";
import { createLeaseRepository } from "./lease-repository.js";
import { ExecutionLeaseServiceAsync } from "./execution-lease-service-async.js";
/**
 * Creates an ExecutionLeaseServiceAsync backed by the appropriate repository
 * for the given storage backend.
 *
 * @param backend - The storage backend handle (SQLite or PostgreSQL)
 * @returns A configured `ExecutionLeaseServiceAsync` instance
 */
export function createExecutionLeaseService(backend) {
    const repo = createLeaseRepository(backend);
    const db = requireSyncCompatibleAuthoritativeSqlDatabase(backend, "storage.postgres_shadow_sqlite_required_for_execution_lease_service");
    const store = new AuthoritativeTaskStore(db);
    return new ExecutionLeaseServiceAsync(db, store, repo);
}
//# sourceMappingURL=execution-lease-factory.js.map