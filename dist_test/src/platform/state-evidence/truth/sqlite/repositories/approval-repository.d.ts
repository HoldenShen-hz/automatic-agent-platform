/**
 * ApprovalRepository - Data access for approvals and takeover sessions.
 *
 * This repository handles all data access for:
 * - ApprovalRecord (approvals table)
 * - TakeoverSessionRecord (takeover_sessions table)
 * - OperatorActionRecord (operator_actions table)
 *
 * All SQL queries use proper column aliasing to match the camelCase domain types.
 * The query helper functions centralize `as unknown as T` type casts.
 */
import type { ApprovalRecord, TakeoverSessionRecord, OperatorActionRecord } from "../../../../contracts/types/domain.js";
import type { SqliteConnection } from "../query-helper.js";
export declare class ApprovalRepository {
    private readonly conn;
    constructor(conn: SqliteConnection);
    /**
     * List approvals for a task.
     */
    listApprovalsByTask(taskId: string, tenantId?: string | null): ApprovalRecord[];
    /**
     * Get an approval by ID with optional tenant scoping.
     */
    getApproval(approvalId: string, tenantId?: string | null): ApprovalRecord | null;
    /**
     * Insert a new approval record.
     */
    insertApproval(approval: ApprovalRecord): void;
    /**
       * Update approval decision.
       */
    updateApprovalDecision(input: {
        approvalId: string;
        status: ApprovalRecord["status"];
        responseJson: string;
        respondedAt: string;
    }): void;
    /**
     * Update approval request JSON.
     */
    updateApprovalRequest(input: {
        id: string;
        requestJson: string;
    }): void;
    /**
     * List approvals by status.
     */
    listApprovalsByStatus(status: ApprovalRecord["status"]): ApprovalRecord[];
    /**
     * List takeover sessions for a task.
     */
    listTakeoverSessionsByTask(taskId: string, tenantId?: string | null): TakeoverSessionRecord[];
    insertTakeoverSession(session: TakeoverSessionRecord): void;
    /**
     * Get a takeover session by ID.
     */
    getTakeoverSession(sessionId: string, tenantId?: string | null): TakeoverSessionRecord | null;
    /**
     * Close a takeover session.
     */
    closeTakeoverSession(sessionId: string, closedAt: string): void;
    /**
     * Insert an operator action record.
     */
    insertOperatorAction(action: OperatorActionRecord): void;
    /**
     * List operator actions for a task.
     */
    listOperatorActionsByTask(taskId: string, tenantId?: string | null): OperatorActionRecord[];
}
