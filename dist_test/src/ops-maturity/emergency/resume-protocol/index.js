export function canResumeFromPanic(plan) {
    return plan.approvedBy.length > 0 && plan.checkpointsVerified;
}
//# sourceMappingURL=index.js.map