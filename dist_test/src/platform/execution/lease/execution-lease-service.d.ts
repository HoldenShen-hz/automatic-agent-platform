/**
 * Execution Lease Service
 *
 * ## Overview
 *
 * Manages execution leases - time-bound reservations that give a worker
 * exclusive rights to work on a specific execution.
 *
 * ## Key Concepts
 *
 * - **Lease**: Temporary ownership of execution right
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: lease}
 *
 * - **Fencing Token**: Version token that prevents split-brain scenarios
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: fencing token}
 *
 * - **Lease Owner**: Entity holding the current execution right
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: lease owner}
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
import type { ExecutionLeaseRecord } from "../../contracts/types/domain.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import type { AcquireExecutionLeaseInput, ExecutionLeaseDecision, ExecutionLeaseHandoverDecision, ExecutionWriteValidationResult, HandoverExecutionLeaseInput, ReleaseExecutionLeaseInput, RenewExecutionLeaseInput, ValidateExecutionWriteInput } from "./types.js";
export type { AcquireExecutionLeaseInput, ExecutionLeaseDecision, ExecutionLeaseHandoverDecision, ExecutionWriteValidationResult, HandoverExecutionLeaseInput, ReleaseExecutionLeaseInput, RenewExecutionLeaseInput, ValidateExecutionWriteInput, } from "./types.js";
/**
 * Service managing execution leases - time-bound exclusive rights for workers to execute tasks.
 *
 * Leases ensure that only one worker can work on an execution at a time, even across
 * system restarts or network partitions. The fencing token mechanism prevents split-brain
 * scenarios where a second worker might start work before learning about the first worker's
 * lease.
 *
 * This service is used by:
 * - ExecutionDispatchService: to acquire leases during ticket dispatch
 * - ExecutionWorkerHandshakeService: to validate and renew leases during execution
 */
export declare class ExecutionLeaseService {
    private readonly db;
    private readonly store;
    private readonly workers;
    /**
     * Creates a new ExecutionLeaseService instance.
     * @param db - SQLite database instance for transactional operations
     * @param store - AuthoritativeTaskStore for data access operations
     */
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore);
    /**
     * Acquires a new lease for an execution, granting exclusive work rights to a worker.
     *
     * This is called during the dispatch process after a worker has been selected.
     * If an active lease already exists for the execution, the request is blocked.
     * The fencing token is initialized based on the latest lease for this execution.
     *
     * @param input - Lease acquisition parameters
     * @returns Decision indicating if lease was granted or blocked
     * @throws Error if execution not found
     */
    acquireLease(input: AcquireExecutionLeaseInput): ExecutionLeaseDecision;
    /**
     * Renews an existing lease, extending its expiration time.
     *
     * Workers call this periodically via heartbeat to keep their lease alive.
     * Validates that:
     * - Lease exists
     * - Worker ID matches (only the lease owner can renew)
     * - Lease is still active (not expired or released)
     * - Lease hasn't already expired at the time of renewal
     *
     * @param input - Renewal parameters including lease ID and new TTL
     * @returns Decision indicating if renewal succeeded or blocked
     */
    renewLease(input: RenewExecutionLeaseInput): ExecutionLeaseDecision;
    /**
     * Releases a lease voluntarily before it expires.
     *
     * Workers call this when they complete work or need to give up the lease.
     * Validates that:
     * - Lease exists
     * - Worker ID matches (only the lease owner can release)
     * - Lease is still active
     *
     * @param input - Release parameters including lease ID and optional reason
     * @returns Decision indicating if release succeeded or blocked
     */
    releaseLease(input: ReleaseExecutionLeaseInput): ExecutionLeaseDecision;
    handoverLease(input: HandoverExecutionLeaseInput): ExecutionLeaseHandoverDecision;
    /**
     * Reclaims all leases that have expired as of the given time.
     *
     * Called during system maintenance to clean up expired leases
     * and update their status to "reclaimed".
     *
     * @param now - Current timestamp to check against (defaults to now)
     * @returns Array of lease records that were reclaimed
     */
    reclaimExpiredLeases(now?: string): ExecutionLeaseRecord[];
    reclaimActiveLease(executionId: string, occurredAt?: string, reasonCode?: string): ExecutionLeaseRecord | null;
    /**
     * Validates whether a worker has write access to an execution.
     *
     * This is the primary mechanism for preventing stale writes:
     * - Checks that a lease exists and is active
     * - Verifies the fencing token matches (detects if lease was renewed by another worker)
     * - Confirms the worker ID matches (prevents cross-worker writes)
     * - Optionally validates the lease ID (detects lease replacement)
     *
     * Used before any execution state modification to ensure the worker
     * still holds a valid lease.
     *
     * @param input - Validation parameters including execution, worker, and fencing token
     * @returns Validation result indicating if write is allowed
     */
    validateWriteAccess(input: ValidateExecutionWriteInput): ExecutionWriteValidationResult;
    /**
     * Expires an active lease if it has passed its expiration time.
     * Used internally before acquiring a new lease to ensure clean state.
     *
     * @param executionId - The execution whose lease to check
     * @param occurredAt - Current timestamp to compare against
     * @param reasonCode - Reason code to set on the expired lease
     */
    private expireActiveLeaseIfNeeded;
    /**
     * Inserts a lease audit record for tracking lease state changes.
     * Used for debugging and monitoring lease lifecycle events.
     *
     * @param input - Audit record data (without the auto-generated ID)
     */
    private insertLeaseAudit;
    private updateWorkerExecutionOwnership;
    private clearWorkerExecutionOwnership;
    private reclaimActiveLeaseInternal;
    private updateAgentExecutionOwnership;
}
