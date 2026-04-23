/**
 * SQLite Lease Repository
 *
 * Implements LeaseRepository for single-node SQLite-backed lease state.
 */
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import type { LeaseRepository } from "./lease-repository.js";
import type { ExecutionLeaseRecord, LeaseAuditRecord } from "../../contracts/types/domain.js";
export declare class SqliteLeaseRepository implements LeaseRepository {
    private readonly db;
    constructor(db: AuthoritativeSqlDatabase);
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
