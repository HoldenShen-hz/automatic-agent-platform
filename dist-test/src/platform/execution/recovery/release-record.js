/**
 * ReleaseRecord - Release Decision and Tracking
 *
 * Records the final release decision including approval chain,
 * deployment metadata, and rollback information.
 */
export function createReleaseRecord(input) {
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
export function createRollbackRecord(record, reason, initiatedBy, automatic = false) {
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
export function isReleaseApproved(record) {
    return record.decision === 'approved';
}
export function requiresHumanApproval(record) {
    return record.approvals.some((a) => a.approverType === 'human');
}
//# sourceMappingURL=release-record.js.map