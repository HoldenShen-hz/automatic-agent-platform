/**
 * @fileoverview Multi-Party Approval Service
 *
 * Manages N-of-M approval workflows where multiple approvers must
 * approve before the request is considered approved.
 */
import type { ApprovalDecision, ApprovalRequest } from "./approval-service.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
export interface MultiPartyApprovalOptions {
    /** Number of approvals required. Default: 1 */
    requiredApprovals?: number;
    /** Groups from which approvers can be selected. Empty means any approver. */
    approverGroups?: readonly string[];
}
export interface PendingApprovalRecord {
    approvalId: string;
    requiredApprovals: number;
    approvalsReceived: number;
    decisions: ApprovalDecision[];
    status: "pending" | "approved" | "rejected" | "expired";
}
export declare class MultiPartyApprovalService {
    private readonly db;
    private readonly repository;
    private readonly transitions;
    private readonly pendingApprovals;
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore);
    createMultiPartyRequest(request: Omit<ApprovalRequest, "approvalId" | "createdAt" | "requiredApprovals" | "approverGroups" | "approvalsReceived">, options?: MultiPartyApprovalOptions): ApprovalRequest;
    applyDecision(decision: ApprovalDecision): void;
    private finalizeApproval;
    getPendingApproval(approvalId: string): PendingApprovalRecord | null;
    getApprovalProgress(approvalId: string): {
        received: number;
        required: number;
        remaining: number;
    } | null;
    isApproverInGroups(approverId: string, groups: readonly string[]): boolean;
}
