export function canResumeFromPanic(plan) {
    const approvers = Array.isArray(plan.approvedBy) ? plan.approvedBy : [plan.approvedBy];
    return approvers.filter((item) => item.trim().length > 0).length >= 2
        && plan.checkpointsVerified
        && (plan.forensicSnapshotReviewed ?? false)
        && (plan.rollbackPlanReady ?? false)
        && (plan.validationRunPassed ?? false);
}
//# sourceMappingURL=index.js.map