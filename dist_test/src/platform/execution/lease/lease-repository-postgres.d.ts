/**
 * PostgreSQL Lease Repository
 *
 * Implements LeaseRepository for multi-node PostgreSQL-backed lease state.
 * Uses AsyncSqlDatabase for async operations with proper connection pooling.
 */
import type { AsyncSqlDatabase } from "../../state-evidence/truth/async-sql-database.js";
import type { LeaseRepository } from "./lease-repository.js";
import type { ExecutionLeaseRecord, LeaseAuditRecord } from "../../contracts/types/domain.js";
export declare class PostgresLeaseRepository implements LeaseRepository {
    private readonly db;
    constructor(db: AsyncSqlDatabase);
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
