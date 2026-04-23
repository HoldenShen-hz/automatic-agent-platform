/**
 * ReleaseRecord - Release Decision and Tracking
 *
 * Records the final release decision including approval chain,
 * deployment metadata, and rollback information.
 */
export type ReleaseDecision = 'approved' | 'rejected' | 'rolled_back';
export type ReleaseEnvironment = 'development' | 'staging' | 'production';
export interface ReleaseRecord {
    /** Unique record identifier */
    recordId: string;
    /** Associated task card ID */
    taskId: string;
    /** Associated patch bundle ID */
    bundleId: string;
    /** Release decision */
    decision: ReleaseDecision;
    /** Approved environment */
    environment?: ReleaseEnvironment | undefined;
    /** Approval chain */
    approvals: readonly ApprovalRecord[];
    /** Deployment timestamp */
    deployedAt?: string | undefined;
    /** Rollback information (if rolled back) */
    rollbackInfo?: RollbackInfo | undefined;
    /** Release notes */
    releaseNotes?: string | undefined;
    /** Timestamp */
    createdAt: string;
}
export interface ApprovalRecord {
    /** Approver identifier (agent or human) */
    approverId: string;
    /** Approver type */
    approverType: 'agent' | 'human';
    /** Approval decision */
    decision: 'approved' | 'rejected';
    /** Reason/comment */
    reason?: string;
    /** Approval timestamp */
    approvedAt: string;
}
export interface RollbackInfo {
    /** Reason for rollback */
    reason: string;
    /** Who initiated rollback */
    initiatedBy: string;
    /** Timestamp */
    rolledBackAt: string;
    /** Whether rollback was automatic */
    automatic: boolean;
}
export declare function createReleaseRecord(input: {
    recordId: string;
    taskId: string;
    bundleId: string;
    decision: ReleaseDecision;
    environment?: ReleaseEnvironment;
    approvals?: readonly ApprovalRecord[];
    releaseNotes?: string;
}): ReleaseRecord;
export declare function createRollbackRecord(record: ReleaseRecord, reason: string, initiatedBy: string, automatic?: boolean): ReleaseRecord;
export declare function isReleaseApproved(record: ReleaseRecord): boolean;
export declare function requiresHumanApproval(record: ReleaseRecord): boolean;
