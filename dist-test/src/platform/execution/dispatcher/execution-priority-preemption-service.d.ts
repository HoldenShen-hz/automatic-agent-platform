/**
 * @fileoverview Execution Priority Preemption Service - Preempts lower-priority executions for urgent work.
 *
 * Provides preemption capability for the priority system: when an urgent dispatch request
 * arrives but no workers have available capacity, this service can reclaim a slot by
 * preempting a lower-priority execution.
 *
 * Preemption works by:
 * 1. Finding a compatible worker with a running execution that can be safely paused
 * 2. Reclaiming the active lease from the preempted execution
 * 3. Creating a replacement ticket so the preempted execution can resume later
 * 4. Recording the preemption in agent execution state for recovery
 *
 * Safety constraints enforced:
 * - Cannot preempt urgent executions (would cause priority inversion)
 * - Cannot preempt executions that are not at a recoverable step
 * - Cannot preempt if the worker or execution state doesn't support safe recovery
 * - Respects isolation levels (strict isolation cannot be preempted for lower levels)
 *
 * @see Execution Lease Service: execution-lease-service.ts
 * @see Worker Registry Service: worker-registry-service.ts
 */
import type { DispatchTarget, ExecutionTicketRecord, TaskPriority, WorkerIsolationLevel } from "../../contracts/types/domain.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
/**
 * Request to preempt for an urgent ticket.
 *
 * Captures the urgent ticket requiring preemption, dispatch requirements,
 * and timing information for the preemption operation.
 */
export interface PriorityPreemptionRequest {
    ticket: ExecutionTicketRecord;
    dispatchTarget: DispatchTarget;
    requiredIsolationLevel: WorkerIsolationLevel;
    requiredRepoVersion: string | null;
    requiredCapabilities: string[];
    preferredWorkerId: string | null;
    includeDegraded: boolean;
    occurredAt: string;
}
/**
 * Trace of a preemption attempt, for observability and debugging.
 *
 * Records which execution was preempted (if any), the replacement ticket
 * created for recovery, and the reason code explaining why preemption
 * did or did not occur.
 */
export interface PriorityPreemptionTrace {
    applied: boolean;
    triggerPriority: TaskPriority;
    preemptedExecutionId: string | null;
    preemptedTaskId: string | null;
    preemptedWorkerId: string | null;
    previousTicketId: string | null;
    replacementTicketId: string | null;
    recoveryStepId: string | null;
    reasonCode: string | null;
}
/** Decision result from a preemption attempt. */
export interface PriorityPreemptionDecision {
    outcome: "preempted" | "not_preempted";
    trace: PriorityPreemptionTrace;
}
/**
 * Service that preempts lower-priority executions to make room for urgent work.
 *
 * Used when an urgent dispatch arrives but all workers are at capacity. The service
 * finds the best candidate for preemption based on priority, isolation requirements,
 * and recovery feasibility.
 */
export declare class ExecutionPriorityPreemptionService {
    private readonly db;
    private readonly store;
    private readonly workers;
    private readonly leases;
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore);
    /**
     * Attempts to preempt a lower-priority execution to make room for an urgent ticket.
     *
     * Returns immediately if the ticket is not urgent or no safe preemption candidate
     * exists. If preemption is possible, reclaims the lease, creates a replacement ticket,
     * updates workflow state for recovery, and emits preemption events.
     */
    preemptForUrgentTicket(input: PriorityPreemptionRequest): PriorityPreemptionDecision;
    /**
     * Selects the best preemption candidate from available workers.
     *
     * Filters workers to find those compatible with the urgent ticket's requirements,
     * converts them to preemption candidates, and sorts by priority (lowest first)
     * and progress (oldest first) to minimize disruption.
     */
    private selectCandidate;
    /**
     * Checks if a worker is a compatible candidate for preemption.
     *
     * Validates multiple constraints:
     * - Preferred worker match
     * - Slot availability (must be at capacity)
     * - Dispatch target compatibility (local/remote)
     * - Worker status (not offline, quarantined, etc.)
     * - Remote session readiness (for remote workers)
     * - Queue affinity match
     * - Isolation level meets requirements
     * - Repo version compatibility
     * - Capability requirements
     */
    private isCompatibleFullWorker;
    /**
     * Converts a worker to a preemption candidate if the running execution can be safely preempted.
     *
     * Validates:
     * - Worker has exactly one running execution
     * - Execution is in "executing" status
     * - Workflow is in "running" status
     * - Active lease exists and is held by this worker
     * - Candidate priority is not urgent (cannot preempt urgent)
     * - Workflow has a recovery step
     * - Worker and agent execution are at the recovery step
     */
    private toCandidate;
    /**
     * Creates a replacement ticket for the preempted execution.
     *
     * The replacement ticket allows the preempted execution to resume later
     * from the recovery step. Inherits requirements from the original ticket
     * but preserves the original execution ID so it can be resumed.
     */
    private createReplacementTicket;
    /**
     * Updates agent execution record to reflect preemption.
     *
     * Records that the execution was preempted, stores the recovery step ID
     * so execution can resume from the correct point, and preserves execution
     * metadata for the eventual retry.
     */
    private upsertAgentExecutionRecord;
    private buildTrace;
}
