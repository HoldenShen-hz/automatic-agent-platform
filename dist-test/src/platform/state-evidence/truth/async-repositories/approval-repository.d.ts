/**
 * AsyncApprovalRepository - Async data access for approvals and takeover sessions.
 *
 * This is the async PostgreSQL-compatible version of ApprovalRepository.
 * All methods are async and use $1, $2 ... placeholders for PostgreSQL.
 */
import type { ApprovalRecord, OperatorActionRecord, TakeoverSessionRecord } from "../../../contracts/types/domain.js";
import type { AsyncSqlConnection } from "../async-sql-database.js";
export declare class AsyncApprovalRepository {
    private readonly conn;
    constructor(conn: AsyncSqlConnection);
    /**
     * List approvals for a task.
     */
    listApprovalsByTask(taskId: string, tenantId?: string | null): Promise<ApprovalRecord[]>;
    /**
     * Get an approval by ID with optional tenant scoping.
     */
    getApproval(approvalId: string, tenantId?: string | null): Promise<ApprovalRecord | null>;
    /**
     * Insert a new approval record.
     */
    insertApproval(approval: ApprovalRecord): Promise<void>;
    /**
     * Update approval decision.
     */
    updateApprovalDecision(input: {
        approvalId: string;
        status: ApprovalRecord["status"];
        responseJson: string;
        respondedAt: string;
    }): Promise<number>;
    /**
     * List approvals by status.
     */
    listApprovalsByStatus(status: ApprovalRecord["status"]): Promise<ApprovalRecord[]>;
    /**
     * List takeover sessions for a task.
     */
    listTakeoverSessionsByTask(taskId: string, tenantId?: string | null): Promise<TakeoverSessionRecord[]>;
    insertTakeoverSession(session: TakeoverSessionRecord): Promise<void>;
    /**
     * Get a takeover session by ID.
     */
    getTakeoverSession(sessionId: string, tenantId?: string | null): Promise<TakeoverSessionRecord | null>;
    /**
     * Close a takeover session.
     */
    closeTakeoverSession(sessionId: string, closedAt: string): Promise<number>;
    /**
     * Insert an operator action record.
     */
    insertOperatorAction(action: OperatorActionRecord): Promise<void>;
    /**
     * List operator actions for a task.
     */
    listOperatorActionsByTask(taskId: string, tenantId?: string | null): Promise<OperatorActionRecord[]>;
}
