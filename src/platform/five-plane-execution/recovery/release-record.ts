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

export function createReleaseRecord(input: {
  recordId: string;
  taskId: string;
  bundleId: string;
  decision: ReleaseDecision;
  environment?: ReleaseEnvironment;
  approvals?: readonly ApprovalRecord[];
  releaseNotes?: string;
}): ReleaseRecord {
  const { recordId, taskId, bundleId, decision, environment, approvals = [], releaseNotes } = input;

  return {
    recordId,
    taskId,
    bundleId,
    decision,
    ...(environment !== undefined && { environment }),
    approvals,
    deployedAt: decision === 'approved' ? new Date().toISOString() : undefined,
    releaseNotes,
    createdAt: new Date().toISOString(),
  };
}

export function createRollbackRecord(
  record: ReleaseRecord,
  reason: string,
  initiatedBy: string,
  automatic = false
): ReleaseRecord {
  return {
    ...record,
    decision: 'rolled_back',
    rollbackInfo: {
      reason,
      initiatedBy,
      rolledBackAt: new Date().toISOString(),
      automatic,
    },
  };
}

export function isReleaseApproved(record: ReleaseRecord): boolean {
  return record.decision === 'approved';
}

export function requiresHumanApproval(record: ReleaseRecord): boolean {
  return record.approvals.some((a) => a.approverType === 'human');
}
