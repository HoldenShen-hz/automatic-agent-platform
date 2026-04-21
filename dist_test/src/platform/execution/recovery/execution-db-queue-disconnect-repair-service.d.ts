/**
 * @fileoverview DB Queue Disconnect Repair Service - Repairs executions missing dispatch tickets.
 *
 * When an execution is created but its dispatch ticket is lost or disconnected from the
 * execution record, this service detects the issue and repairs it by creating a new
 * dispatch ticket with the appropriate dispatch requirements.
 *
 * This can happen when:
 * - A database transaction partially commits
 * - A crash occurs between execution creation and ticket creation
 * - Database records are manually modified or corrupted
 *
 * The repair template is recovered from the agent execution plan if available,
 * preserving the original dispatch requirements (priority, queue, isolation, etc.).
 */
import type { DispatchTarget, TaskPriority, WorkerIsolationLevel } from "../../contracts/types/domain.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
/**
 * Internal template for rebuilding a dispatch ticket.
 *
 * Captures all the dispatch requirements that were originally specified
 * when the execution was first created.
 */
interface DispatchRepairTemplate {
    priority?: TaskPriority;
    queueName?: string | null;
    dispatchTarget?: DispatchTarget | null;
    requiredIsolationLevel?: WorkerIsolationLevel | null;
    requiredRepoVersion?: string | null;
    requiredCapabilities?: string[];
    dispatchAfter?: string | null;
}
/**
 * An issue where an execution exists but has no associated dispatch ticket.
 *
 * The execution is in a valid state (created, prechecking, or blocked) but
 * cannot be dispatched because the ticket linking it to the queue is missing.
 * The repairTemplate provides all information needed to recreate the ticket.
 */
export interface DbQueueDisconnectRepairIssue {
    issueType: "missing_dispatch_ticket";
    executionId: string;
    taskId: string;
    executionStatus: "created" | "prechecking" | "blocked";
    reasonCode: "missing_active_dispatch_ticket";
    recoveredFromPlan: boolean;
    repairTemplate: {
        priority: TaskPriority;
        queueName: string | null;
        dispatchTarget: DispatchTarget;
        requiredIsolationLevel: WorkerIsolationLevel;
        requiredRepoVersion: string | null;
        requiredCapabilities: string[];
        dispatchAfter: string | null;
    };
}
/** Result of repairing a queue disconnect issue. */
export interface DbQueueDisconnectRepairResult {
    issueType: DbQueueDisconnectRepairIssue["issueType"];
    executionId: string;
    taskId: string;
    applied: boolean;
    replacementTicketId: string | null;
    recoveredFromPlan: boolean;
}
/**
 * Parses the agent execution plan JSON to extract dispatch requirements.
 *
 * The plan JSON stores dispatch requirements when an execution is created.
 * If the plan is unavailable or invalid, returns an empty template and
 * indicates recovery was not possible from the plan.
 */
export declare function parseDbQueueDisconnectRepairTemplate(planJson: string | null | undefined): {
    template: DispatchRepairTemplate;
    recoveredFromPlan: boolean;
};
/**
 * Service for repairing executions that have lost their dispatch tickets.
 *
 * Scans for executions in created/prechecking/blocked state that have no
 * associated dispatch ticket, then repairs them by creating new tickets
 * with recovered dispatch requirements.
 */
export declare class ExecutionDbQueueDisconnectRepairService {
    private readonly db;
    private readonly store;
    private readonly dispatch;
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore);
    /**
     * Scans for executions with missing dispatch tickets.
     *
     * Checks all executions in created, prechecking, or blocked status to see
     * if they have an active ticket. An execution is considered to have a
     * disconnect if it has no ticket and no active lease.
     */
    scan(): DbQueueDisconnectRepairIssue[];
    /**
     * Repairs all executions with queue disconnect issues.
     *
     * Scans for issues and applies repairs to each, returning both the
     * issues found and the repair results.
     */
    repair(now?: string): {
        issues: DbQueueDisconnectRepairIssue[];
        applied: DbQueueDisconnectRepairResult[];
    };
    /**
     * Repairs a single execution by ID if it has a queue disconnect issue.
     *
     * Returns null if the execution doesn't exist or doesn't have an issue.
     */
    repairExecution(executionId: string, now?: string): DbQueueDisconnectRepairResult | null;
    /**
     * Applies the repair for a single queue disconnect issue.
     *
     * Creates a new dispatch ticket using the repair template recovered from
     * the agent execution plan. Emits an event recording the repair.
     */
    private applyIssue;
}
export {};
