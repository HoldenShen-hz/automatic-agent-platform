import { AuthoritativeTaskStoreDelegatingGovernance, } from "./authoritative-task-store-delegating-governance.js";
export class AuthoritativeTaskStoreDelegatingRuntime extends AuthoritativeTaskStoreDelegatingGovernance {
    insertAnalyticsFactRecord(...args) {
        return this.delegateLegacy("insertAnalyticsFactRecord", "operations", "insertAnalyticsFactRecord", ...args);
    }
    listAnalyticsFactRecords(...args) {
        return this.delegateLegacy("listAnalyticsFactRecords", "operations", "listAnalyticsFactRecords", ...args);
    }
    insertArchiveBundleRecord(...args) {
        return this.delegateLegacy("insertArchiveBundleRecord", "operations", "insertArchiveBundleRecord", ...args);
    }
    listArchiveBundleRecords(...args) {
        return this.delegateLegacy("listArchiveBundleRecords", "operations", "listArchiveBundleRecords", ...args);
    }
    insertReplayDatasetRecord(...args) {
        return this.delegateLegacy("insertReplayDatasetRecord", "operations", "insertReplayDatasetRecord", ...args);
    }
    listReplayDatasetRecords(...args) {
        return this.delegateLegacy("listReplayDatasetRecords", "operations", "listReplayDatasetRecords", ...args);
    }
    upsertDataMovementJobRecord(...args) {
        return this.delegateLegacy("upsertDataMovementJobRecord", "operations", "upsertDataMovementJobRecord", ...args);
    }
    getDataMovementJobRecord(...args) {
        return this.delegateLegacy("getDataMovementJobRecord", "operations", "getDataMovementJobRecord", ...args);
    }
    listDataMovementJobRecords(...args) {
        return this.delegateLegacy("listDataMovementJobRecords", "operations", "listDataMovementJobRecords", ...args);
    }
    insertPmfValidationReport(...args) {
        return this.delegateLegacy("insertPmfValidationReport", "operations", "insertPmfValidationReport", ...args);
    }
    listPmfValidationReports(...args) {
        return this.delegateLegacy("listPmfValidationReports", "operations", "listPmfValidationReports", ...args);
    }
    getLatestPmfValidationReport(...args) {
        return this.delegateLegacy("getLatestPmfValidationReport", "operations", "getLatestPmfValidationReport", ...args);
    }
    listTaskBoardItems(...args) {
        return this.delegateLegacy("listTaskBoardItems", "operations", "listTaskBoardItems", ...args);
    }
    listActiveTasksWithoutWorkflow(...args) {
        return this.delegateLegacy("listActiveTasksWithoutWorkflow", "operations", "listActiveTasksWithoutWorkflow", ...args);
    }
    listStaleExecutions(...args) {
        return this.delegateLegacy("listStaleExecutions", "operations", "listStaleExecutions", ...args);
    }
    listRecoverableExecutingRuns(...args) {
        return this.delegateLegacy("listRecoverableExecutingRuns", "operations", "listRecoverableExecutingRuns", ...args);
    }
    listBlockedRunsAwaitingApproval(...args) {
        return this.delegateLegacy("listBlockedRunsAwaitingApproval", "operations", "listBlockedRunsAwaitingApproval", ...args);
    }
    listStaleRuns(...args) {
        return this.delegateLegacy("listStaleRuns", "operations", "listStaleRuns", ...args);
    }
    buildRuntimeRecoveryView(...args) {
        return this.delegateLegacy("buildRuntimeRecoveryView", "operations", "buildRuntimeRecoveryView", ...args);
    }
    listOrphanSessions(...args) {
        return this.delegateLegacy("listOrphanSessions", "operations", "listOrphanSessions", ...args);
    }
    listWorkflowTerminalMismatches(...args) {
        return this.delegateLegacy("listWorkflowTerminalMismatches", "operations", "listWorkflowTerminalMismatches", ...args);
    }
    listActiveTasksWithTerminalSessions(...args) {
        return this.delegateLegacy("listActiveTasksWithTerminalSessions", "operations", "listActiveTasksWithTerminalSessions", ...args);
    }
    listActiveExecutionActivity(...args) {
        return this.delegateLegacy("listActiveExecutionActivity", "operations", "listActiveExecutionActivity", ...args);
    }
    listActiveExecutionConflicts(...args) {
        return this.delegateLegacy("listActiveExecutionConflicts", "operations", "listActiveExecutionConflicts", ...args);
    }
    loadTaskSnapshot(...args) {
        return this.delegateLegacy("loadTaskSnapshot", "operations", "loadTaskSnapshot", ...args);
    }
    loadExecutionAuthoritativeView(...args) {
        return this.delegateLegacy("loadExecutionAuthoritativeView", "operations", "loadExecutionAuthoritativeView", ...args);
    }
    listRuntimeRecoveryRecords(...args) {
        return this.delegateLegacy("listRuntimeRecoveryRecords", "operations", "listRuntimeRecoveryRecords", ...args);
    }
    getExecution(...args) {
        return this.delegateLegacy("getExecution", "dispatch", "getExecution", ...args);
    }
    getExecutionPrecheck(...args) {
        return this.delegateLegacy("getExecutionPrecheck", "dispatch", "getExecutionPrecheck", ...args);
    }
    getDeadLetterByExecutionId(...args) {
        return this.delegateLegacy("getDeadLetterByExecutionId", "dispatch", "getDeadLetterByExecutionId", ...args);
    }
    listDeadLettersByTask(...args) {
        return this.delegateLegacy("listDeadLettersByTask", "dispatch", "listDeadLettersByTask", ...args);
    }
    getSession(...args) {
        return this.delegateLegacy("getSession", "dispatch", "getSession", ...args);
    }
    selectLatestSessionByTask(...args) {
        return this.delegateLegacyUndefinedable("selectLatestSessionByTask", "dispatch", "selectLatestSessionByTask", ...args);
    }
    getGatewayTarget(...args) {
        return this.delegateLegacy("getGatewayTarget", "dispatch", "getGatewayTarget", ...args);
    }
    listGatewayTargets(...args) {
        return this.delegateLegacy("listGatewayTargets", "dispatch", "listGatewayTargets", ...args);
    }
    listMessagesBySession(...args) {
        return this.delegateLegacy("listMessagesBySession", "dispatch", "listMessagesBySession", ...args);
    }
    listExecutionsByStatuses(...args) {
        return this.delegateLegacy("listExecutionsByStatuses", "dispatch", "listExecutionsByStatuses", ...args);
    }
    listLeaseAudits(...args) {
        return this.delegateLegacy("listLeaseAudits", "lease", "listLeaseAudits", ...args);
    }
    listActiveFileLocksForResource(...args) {
        return this.delegateLegacy("listActiveFileLocksForResource", "lock", "listActiveFileLocksForResource", ...args);
    }
    insertFileLock(...args) {
        return this.delegateLegacy("insertFileLock", "lock", "insertFileLock", ...args);
    }
    listExpiredFileLocks(...args) {
        return this.delegateLegacy("listExpiredFileLocks", "lock", "listExpiredFileLocks", ...args);
    }
    listFileLocks(...args) {
        return this.delegateLegacy("listFileLocks", "lock", "listFileLocks", ...args);
    }
    listFileLocksByTask(...args) {
        return this.delegateLegacy("listFileLocksByTask", "lock", "listFileLocksByTask", ...args);
    }
    deleteFileLock(...args) {
        return this.delegateLegacy("deleteFileLock", "lock", "deleteFileLock", ...args);
    }
    countActiveExecutionsByTenant(...args) {
        return this.delegateRepo("billing", "countActiveExecutionsByTenant", ...args);
    }
    listRecentExecutionsByTenant(...args) {
        return this.delegateRepo("billing", "listRecentExecutionsByTenant", ...args);
    }
    countQueuedTasksByTenant(...args) {
        return this.delegateRepo("billing", "countQueuedTasksByTenant", ...args);
    }
    listQueuedTasksByTenant(...args) {
        return this.delegateRepo("billing", "listQueuedTasksByTenant", ...args);
    }
    listSessionsByTask(...args) {
        return this.delegateRepo("session", "listSessionsByTask", ...args);
    }
    listGatewayTargetsByChannel(...args) {
        return this.delegateRepo("session", "listGatewayTargetsByChannel", ...args);
    }
}
/* c8 ignore stop */
//# sourceMappingURL=authoritative-task-store-delegating-runtime.js.map