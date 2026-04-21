/**
 * Async Execution Lease Service
 *
 * Async version of ExecutionLeaseService that uses LeaseRepository for data access,
 * enabling both SQLite and PostgreSQL backends.
 *
 * ## Overview
 *
 * Manages execution leases - time-bound reservations that give a worker
 * exclusive rights to work on a specific execution.
 *
 * ## Key Concepts
 *
 * - **Lease**: Temporary ownership of execution right
 * - **Fencing Token**: Version token that prevents split-brain scenarios
 * - **Lease Owner**: Entity holding the current execution right
 *
 * ## Operations
 *
 * - acquireLease: Grant a new lease for an execution to a worker
 * - renewLease: Extend the TTL of an existing active lease
 * - releaseLease: Voluntarily release a lease before it expires
 * - reclaimExpiredLeases: Systematically close leases that have exceeded their TTL
 * - validateWriteAccess: Check if a worker has valid lease to write to an execution
 *
 * All operations are transactional and create audit records (lease_audits table).
 *
 * @see Runtime Execution Contract: docs_zh/contracts/runtime_execution_contract.md
 * @see Glossary: docs_zh/governance/glossary_and_terminology.md
 */
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import type { LeaseRepository } from "./lease-repository.js";
import type { AcquireExecutionLeaseInput, ExecutionLeaseDecision, ExecutionLeaseHandoverDecision, ExecutionWriteValidationResult, HandoverExecutionLeaseInput, ReleaseExecutionLeaseInput, RenewExecutionLeaseInput, ValidateExecutionWriteInput } from "./types.js";
export type { AcquireExecutionLeaseInput, ExecutionLeaseDecision, ExecutionLeaseHandoverDecision, ExecutionWriteValidationResult, HandoverExecutionLeaseInput, ReleaseExecutionLeaseInput, RenewExecutionLeaseInput, ValidateExecutionWriteInput, } from "./types.js";
/**
 * Options for creating an async ExecutionLeaseService
 */
export interface ExecutionLeaseServiceAsyncOptions {
    /** Use synchronous transactions (SQLite) instead of async transactions */
    useSyncTransactions?: boolean;
}
/**
 * Async service managing execution leases using a repository pattern.
 *
 * This service uses LeaseRepository for all lease-related database operations,
 * enabling the same code to work with both SQLite (sync) and PostgreSQL (async).
 */
export declare class ExecutionLeaseServiceAsync {
    private readonly db;
    private readonly store;
    private readonly repo;
    private readonly workers;
    /**
     * Creates a new ExecutionLeaseServiceAsync instance.
     * @param db - SQLite database instance for transactional operations (sync mode)
     * @param store - AuthoritativeTaskStore for data access operations
     * @param repo - LeaseRepository for async lease operations
     */
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore, repo: LeaseRepository);
    /**
     * Acquires a new lease for an execution, granting exclusive work rights to a worker.
     */
    acquireLease(input: AcquireExecutionLeaseInput): Promise<ExecutionLeaseDecision>;
    private acquireLeaseSync;
    /**
     * Renews an existing lease, extending its expiration time.
     */
    renewLease(input: RenewExecutionLeaseInput): Promise<ExecutionLeaseDecision>;
    private renewLeaseSync;
    /**
     * Releases a lease voluntarily.
     */
    releaseLease(input: ReleaseExecutionLeaseInput): Promise<ExecutionLeaseDecision>;
    private releaseLeaseSync;
    /**
     * Validates write access for an execution.
     */
    validateWriteAccess(input: ValidateExecutionWriteInput): ExecutionWriteValidationResult;
    private validateWriteAccessSync;
    /**
     * Reclaims expired leases.
     */
    reclaimExpiredLeases(occurredAt: string): string[];
    /**
     * Hands over a lease from one worker to another.
     */
    handoverLease(input: HandoverExecutionLeaseInput): Promise<ExecutionLeaseHandoverDecision>;
    private handoverLeaseSync;
    private expireActiveLeaseIfNeeded;
    private insertLeaseAudit;
}
