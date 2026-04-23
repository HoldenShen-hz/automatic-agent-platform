/**
 * @fileoverview Orphan Cleanup Service - Detects and repairs orphaned database records.
 *
 * An "orphan" in this context is a database record that references other records
 * that no longer exist or are in an inconsistent state. Examples:
 * - A session whose task no longer exists
 * - A dispatch ticket claimed by a worker but with no valid active lease
 * - A worker snapshot referencing executions that have terminated or belong to another worker
 *
 * The service operates in two modes:
 * - preview(): Scans for orphans without making changes
 * - enforce(): Scans and applies repair actions
 *
 * Repair actions include closing orphan sessions, requeuing orphan tickets,
 * and cleaning invalid execution references from worker snapshots.
 */
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
/** Types of orphan issues that can be detected. */
export type OrphanCleanupIssueType = "orphan_session" | "orphan_queue_claim" | "worker_execution_reference_orphan";
/**
 * Represents a worker execution reference that points to an invalid execution.
 *
 * Tracks which execution is referenced, why it's invalid, and the current
 * state of that execution and its lease if any.
 */
export interface WorkerExecutionReferenceOrphan {
    executionId: string;
    taskId: string | null;
    reasonCode: "execution_missing" | "execution_terminal" | "missing_active_lease" | "owned_by_another_worker";
    executionStatus: string | null;
    activeLeaseWorkerId: string | null;
}
/**
 * An issue detected by the orphan cleanup scanner.
 *
 * Describes the type of orphan, which entity is affected, and provides
 * detail about the inconsistency. For worker execution reference orphans,
 * includes the specific orphan references found.
 */
export interface OrphanCleanupIssue {
    issueType: OrphanCleanupIssueType;
    entityType: "session" | "ticket" | "worker";
    entityId: string;
    taskId: string | null;
    executionId: string | null;
    workerId: string | null;
    detail: string;
    orphanExecutionRefs?: WorkerExecutionReferenceOrphan[];
}
/** Result of applying a repair action for an orphan issue. */
export interface OrphanCleanupResult {
    action: "close_orphan_session" | "requeue_ticket" | "clean_worker_execution_refs";
    entityId: string;
    applied: boolean;
    detail: string;
}
/** Report from an orphan cleanup scan and optional enforcement. */
export interface OrphanCleanupReport {
    checkedAt: string;
    issues: OrphanCleanupIssue[];
    applied?: OrphanCleanupResult[];
}
/**
 * Service for detecting and repairing orphaned database records.
 *
 * Scans for inconsistencies between related records (sessions, tasks, tickets,
 * workers, executions) and can apply repair actions to resolve the orphans.
 */
export declare class OrphanCleanupService {
    private readonly db;
    private readonly store;
    private readonly dispatchReconciliation;
    private readonly workers;
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore);
    /**
     * Scans for orphan issues without applying repairs.
     *
     * Returns a report listing all detected issues but making no changes.
     * Useful for monitoring and alerting on data consistency problems.
     */
    preview(checkedAt?: string): OrphanCleanupReport;
    /**
     * Scans for orphan issues and applies repair actions.
     *
     * Returns a report with all detected issues and the results of applying
     * repair actions. Each issue is handled based on its type:
     * - orphan_session: Close the orphan session
     * - orphan_queue_claim: Requeue the orphan ticket
     * - worker_execution_reference_orphan: Clean invalid references from worker
     */
    enforce(checkedAt?: string): OrphanCleanupReport;
    /**
     * Collects all orphan issues by scanning different entity types.
     *
     * Scans for orphan sessions, orphan queue claims, and worker execution
     * reference orphans, then returns a combined list.
     */
    private collectIssues;
    /**
     * Scans worker snapshots for execution references that point to invalid executions.
     *
     * For each worker, checks if the running execution IDs in the snapshot actually
     * correspond to valid, non-terminal executions with active leases owned by this worker.
     * Any invalid references are collected into a single issue.
     */
    private scanWorkerExecutionReferenceOrphans;
    /**
     * Closes an orphan session by marking it as completed.
     *
     * Only applies if the session is not already in a terminal state.
     * Emits an event to record the cleanup action.
     */
    private closeOrphanSession;
    /**
     * Requeues an orphan dispatch ticket using the reconciliation service.
     *
     * The reconciliation service either creates a replacement ticket or
     * invalidates the orphan ticket depending on the issue type.
     */
    private requeueOrphanTicket;
    /**
     * Cleans invalid execution references from a worker snapshot.
     *
     * Updates the worker's running execution IDs to remove orphan references,
     * recalculates the worker's status, and emits an event recording the cleanup.
     */
    private cleanWorkerExecutionRefs;
}
