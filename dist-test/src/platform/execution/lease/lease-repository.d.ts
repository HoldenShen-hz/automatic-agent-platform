/**
 * Lease Repository Interface
 *
 * Abstracts all lease-related database operations behind a repository interface,
 * enabling both SQLite (single-node) and PostgreSQL (multi-node) backends.
 */
import type { SqliteAuthoritativeStorageBackendHandle, PostgresAuthoritativeStorageBackendHandle } from "../../state-evidence/truth/storage-backend-factory.js";
import type { ExecutionLeaseRecord, LeaseAuditRecord } from "../../contracts/types/domain.js";
export interface LeaseRepository {
    insertLease(lease: ExecutionLeaseRecord): Promise<void>;
    getLease(leaseId: string): Promise<ExecutionLeaseRecord | undefined>;
    getActiveLeaseForExecution(executionId: string): Promise<ExecutionLeaseRecord | undefined>;
    getLatestFencingToken(executionId: string): Promise<number>;
    listExecutionLeases(executionId: string): Promise<ExecutionLeaseRecord[]>;
    updateLeaseStatus(leaseId: string, status: ExecutionLeaseRecord["status"]): Promise<void>;
    updateLeaseHeartbeat(leaseId: string, lastHeartbeatAt: string): Promise<void>;
    updateLeaseRelease(leaseId: string, releasedAt: string, reasonCode: string | null): Promise<void>;
    insertLeaseAudit(audit: LeaseAuditRecord): Promise<void>;
    listLeaseAudits(executionId: string): Promise<LeaseAuditRecord[]>;
}
export type AnyStorageBackendHandle = SqliteAuthoritativeStorageBackendHandle | PostgresAuthoritativeStorageBackendHandle;
/**
 * Creates the appropriate Lease repository based on the storage backend type.
 *
 * - SQLite backend: uses SqliteLeaseRepository (sync operations)
 * - PostgreSQL backend: uses PostgresLeaseRepository (async operations)
 *
 * @param backend - The storage backend handle (SQLite or PostgreSQL)
 * @returns A LeaseRepository implementation for the given backend
 */
export declare function createLeaseRepository(backend: AnyStorageBackendHandle): LeaseRepository;
