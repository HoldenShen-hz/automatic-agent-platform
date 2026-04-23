/**
 * Execution Dispatch Reconciliation Service
 *
 * Reconciles execution dispatch tickets with actual execution state to detect
 * and repair orphaned or inconsistent dispatch records. This service identifies
 * tickets that reference terminal executions, lack valid leases, or have lease
 * mismatches.
 *
 * The service scans for issues and can apply repairs including requeuing tickets
 * and invalidating orphaned claims. All reconciliation actions emit audit events.
 *
 * @see {@link docs_zh/contracts/runtime_execution_contract.md}
 * @see {@link docs_zh/contracts/task_lease_and_fencing_contract.md}
 * @see {@link docs_zh/architecture/00-platform-architecture.md}
 * @see {@link docs_zh/governance/glossary_and_terminology.md}
 */
import type { ExecutionStatus } from "../../contracts/types/status.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
export interface DispatchReconciliationIssue {
    issueType: "orphan_queue_claim" | "terminal_execution_ticket";
    resolutionAction: "requeue_ticket" | "invalidate_ticket";
    executionId: string;
    taskId: string;
    ticketId: string;
    reasonCode: "missing_active_lease" | "lease_ticket_mismatch" | "lease_expired_unreclaimed" | "execution_terminal";
    executionStatus: ExecutionStatus;
}
export interface DispatchReconciliationRepairResult {
    issueType: DispatchReconciliationIssue["issueType"];
    executionId: string;
    taskId: string;
    ticketId: string;
    applied: boolean;
    resolutionAction: DispatchReconciliationIssue["resolutionAction"];
    replacementTicketId: string | null;
}
export declare class ExecutionDispatchReconciliationService {
    private readonly db;
    private readonly store;
    private readonly dispatch;
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore);
    scan(now?: string): DispatchReconciliationIssue[];
    findIssueByTicketId(ticketId: string, now?: string): DispatchReconciliationIssue | null;
    repair(now?: string): {
        issues: DispatchReconciliationIssue[];
        applied: DispatchReconciliationRepairResult[];
    };
    repairTicket(ticketId: string, now?: string): DispatchReconciliationRepairResult | null;
    private findIssueForTicket;
    private applyIssue;
    private recordReconciledEvent;
}
