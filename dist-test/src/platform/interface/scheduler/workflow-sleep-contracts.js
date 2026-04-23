export function toWorkflowSleepLease(record) {
    return {
        suspensionId: record.suspensionId,
        taskId: record.taskId,
        workflowId: record.workflowId,
        executionId: record.executionId,
        divisionId: record.divisionId,
        waitKind: record.waitKind,
        status: record.status,
        suspendedAt: record.suspendedAt,
        resumeAfter: record.resumeAfter,
        expiresAt: record.expiresAt,
        resumableFromStep: record.resumableFromStep,
        checkpointArtifactId: record.checkpointArtifactId,
        timeoutPolicy: record.timeoutPolicy,
        metadata: record.metadata,
    };
}
export function toWorkflowResumeWindow(record, now) {
    const expired = record.expiresAt != null && record.expiresAt <= now;
    const due = !expired && record.resumeAfter != null && record.resumeAfter <= now;
    return {
        suspensionId: record.suspensionId,
        taskId: record.taskId,
        workflowId: record.workflowId,
        dueAt: record.resumeAfter,
        expiresAt: record.expiresAt,
        due,
        expired,
        nextAction: expired ? "expire" : due ? "resume" : "wait",
        timeoutPolicy: record.timeoutPolicy,
        resumableFromStep: record.resumableFromStep,
    };
}
//# sourceMappingURL=workflow-sleep-contracts.js.map