/* c8 ignore start */
import {
  AuthoritativeTaskStoreLegacyCompat,
} from "./authoritative-task-store-legacy-compat.js";
import type {
  AuthoritativeTaskStoreRepositories,
} from "./authoritative-task-store-repositories.js";
import {
  AuthoritativeTaskStoreDelegatingGovernance,
} from "./authoritative-task-store-delegating-governance.js";

export class AuthoritativeTaskStoreDelegatingRuntime extends AuthoritativeTaskStoreDelegatingGovernance {
  public override insertAnalyticsFactRecord(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertAnalyticsFactRecord"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertAnalyticsFactRecord"]> {
    return this.delegateLegacy("insertAnalyticsFactRecord", "operations", "insertAnalyticsFactRecord", ...args);
  }

  public override listAnalyticsFactRecords(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listAnalyticsFactRecords"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listAnalyticsFactRecords"]> {
    return this.delegateLegacy("listAnalyticsFactRecords", "operations", "listAnalyticsFactRecords", ...args);
  }

  public override insertArchiveBundleRecord(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertArchiveBundleRecord"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertArchiveBundleRecord"]> {
    return this.delegateLegacy("insertArchiveBundleRecord", "operations", "insertArchiveBundleRecord", ...args);
  }

  public override listArchiveBundleRecords(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listArchiveBundleRecords"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listArchiveBundleRecords"]> {
    return this.delegateLegacy("listArchiveBundleRecords", "operations", "listArchiveBundleRecords", ...args);
  }

  public override insertReplayDatasetRecord(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertReplayDatasetRecord"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertReplayDatasetRecord"]> {
    return this.delegateLegacy("insertReplayDatasetRecord", "operations", "insertReplayDatasetRecord", ...args);
  }

  public override listReplayDatasetRecords(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listReplayDatasetRecords"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listReplayDatasetRecords"]> {
    return this.delegateLegacy("listReplayDatasetRecords", "operations", "listReplayDatasetRecords", ...args);
  }

  public override upsertDataMovementJobRecord(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["upsertDataMovementJobRecord"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["upsertDataMovementJobRecord"]> {
    return this.delegateLegacy("upsertDataMovementJobRecord", "operations", "upsertDataMovementJobRecord", ...args);
  }

  public override getDataMovementJobRecord(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getDataMovementJobRecord"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getDataMovementJobRecord"]> {
    return this.delegateLegacy("getDataMovementJobRecord", "operations", "getDataMovementJobRecord", ...args);
  }

  public override listDataMovementJobRecords(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listDataMovementJobRecords"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listDataMovementJobRecords"]> {
    return this.delegateLegacy("listDataMovementJobRecords", "operations", "listDataMovementJobRecords", ...args);
  }

  public override insertPmfValidationReport(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertPmfValidationReport"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertPmfValidationReport"]> {
    return this.delegateLegacy("insertPmfValidationReport", "operations", "insertPmfValidationReport", ...args);
  }

  public override listPmfValidationReports(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listPmfValidationReports"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listPmfValidationReports"]> {
    return this.delegateLegacy("listPmfValidationReports", "operations", "listPmfValidationReports", ...args);
  }

  public override getLatestPmfValidationReport(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getLatestPmfValidationReport"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getLatestPmfValidationReport"]> {
    return this.delegateLegacy("getLatestPmfValidationReport", "operations", "getLatestPmfValidationReport", ...args);
  }

  public override listTaskBoardItems(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listTaskBoardItems"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listTaskBoardItems"]> {
    return this.delegateLegacy("listTaskBoardItems", "operations", "listTaskBoardItems", ...args);
  }

  public override listActiveTasksWithoutWorkflow(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listActiveTasksWithoutWorkflow"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listActiveTasksWithoutWorkflow"]> {
    return this.delegateLegacy("listActiveTasksWithoutWorkflow", "operations", "listActiveTasksWithoutWorkflow", ...args);
  }

  public override listStaleExecutions(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listStaleExecutions"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listStaleExecutions"]> {
    return this.delegateLegacy("listStaleExecutions", "operations", "listStaleExecutions", ...args);
  }

  public override listRecoverableExecutingRuns(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listRecoverableExecutingRuns"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listRecoverableExecutingRuns"]> {
    return this.delegateLegacy("listRecoverableExecutingRuns", "operations", "listRecoverableExecutingRuns", ...args);
  }

  public override listBlockedRunsAwaitingApproval(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listBlockedRunsAwaitingApproval"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listBlockedRunsAwaitingApproval"]> {
    return this.delegateLegacy("listBlockedRunsAwaitingApproval", "operations", "listBlockedRunsAwaitingApproval", ...args);
  }

  public override listStaleRuns(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listStaleRuns"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listStaleRuns"]> {
    return this.delegateLegacy("listStaleRuns", "operations", "listStaleRuns", ...args);
  }

  public override buildRuntimeRecoveryView(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["buildRuntimeRecoveryView"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["buildRuntimeRecoveryView"]> {
    return this.delegateLegacy("buildRuntimeRecoveryView", "operations", "buildRuntimeRecoveryView", ...args);
  }

  public override listOrphanSessions(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listOrphanSessions"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listOrphanSessions"]> {
    return this.delegateLegacy("listOrphanSessions", "operations", "listOrphanSessions", ...args);
  }

  public override listWorkflowTerminalMismatches(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listWorkflowTerminalMismatches"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listWorkflowTerminalMismatches"]> {
    return this.delegateLegacy("listWorkflowTerminalMismatches", "operations", "listWorkflowTerminalMismatches", ...args);
  }

  public override listActiveTasksWithTerminalSessions(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listActiveTasksWithTerminalSessions"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listActiveTasksWithTerminalSessions"]> {
    return this.delegateLegacy("listActiveTasksWithTerminalSessions", "operations", "listActiveTasksWithTerminalSessions", ...args);
  }

  public override listActiveExecutionActivity(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listActiveExecutionActivity"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listActiveExecutionActivity"]> {
    return this.delegateLegacy("listActiveExecutionActivity", "operations", "listActiveExecutionActivity", ...args);
  }

  public override listActiveExecutionConflicts(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listActiveExecutionConflicts"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listActiveExecutionConflicts"]> {
    return this.delegateLegacy("listActiveExecutionConflicts", "operations", "listActiveExecutionConflicts", ...args);
  }

  public override loadTaskSnapshot(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["loadTaskSnapshot"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["loadTaskSnapshot"]> {
    return this.delegateLegacy("loadTaskSnapshot", "operations", "loadTaskSnapshot", ...args);
  }

  public override loadExecutionAuthoritativeView(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["loadExecutionAuthoritativeView"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["loadExecutionAuthoritativeView"]> {
    return this.delegateLegacy("loadExecutionAuthoritativeView", "operations", "loadExecutionAuthoritativeView", ...args);
  }

  public override listRuntimeRecoveryRecords(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listRuntimeRecoveryRecords"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listRuntimeRecoveryRecords"]> {
    return this.delegateLegacy("listRuntimeRecoveryRecords", "operations", "listRuntimeRecoveryRecords", ...args);
  }

  public override getExecution(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getExecution"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getExecution"]> {
    return this.delegateLegacy("getExecution", "dispatch", "getExecution", ...args);
  }

  public override getExecutionPrecheck(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getExecutionPrecheck"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getExecutionPrecheck"]> {
    return this.delegateLegacy("getExecutionPrecheck", "dispatch", "getExecutionPrecheck", ...args);
  }

  public override getDeadLetterByExecutionId(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getDeadLetterByExecutionId"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getDeadLetterByExecutionId"]> {
    return this.delegateLegacy("getDeadLetterByExecutionId", "dispatch", "getDeadLetterByExecutionId", ...args);
  }

  public override listDeadLettersByTask(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listDeadLettersByTask"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listDeadLettersByTask"]> {
    return this.delegateLegacy("listDeadLettersByTask", "dispatch", "listDeadLettersByTask", ...args);
  }

  public override getSession(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getSession"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getSession"]> {
    return this.delegateLegacy("getSession", "dispatch", "getSession", ...args);
  }

  public override selectLatestSessionByTask(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["selectLatestSessionByTask"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["selectLatestSessionByTask"]> {
    return this.delegateLegacyUndefinedable("selectLatestSessionByTask", "dispatch", "selectLatestSessionByTask", ...args);
  }

  public override getGatewayTarget(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getGatewayTarget"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getGatewayTarget"]> {
    return this.delegateLegacy("getGatewayTarget", "dispatch", "getGatewayTarget", ...args);
  }

  public override listGatewayTargets(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listGatewayTargets"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listGatewayTargets"]> {
    return this.delegateLegacy("listGatewayTargets", "dispatch", "listGatewayTargets", ...args);
  }

  public override listMessagesBySession(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listMessagesBySession"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listMessagesBySession"]> {
    return this.delegateLegacy("listMessagesBySession", "dispatch", "listMessagesBySession", ...args);
  }

  public override listExecutionsByStatuses(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listExecutionsByStatuses"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listExecutionsByStatuses"]> {
    return this.delegateLegacy("listExecutionsByStatuses", "dispatch", "listExecutionsByStatuses", ...args);
  }

  public override listLeaseAudits(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listLeaseAudits"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listLeaseAudits"]> {
    return this.delegateLegacy("listLeaseAudits", "lease", "listLeaseAudits", ...args);
  }

  public override listActiveFileLocksForResource(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listActiveFileLocksForResource"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listActiveFileLocksForResource"]> {
    return this.delegateLegacy("listActiveFileLocksForResource", "lock", "listActiveFileLocksForResource", ...args);
  }

  public override insertFileLock(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertFileLock"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertFileLock"]> {
    return this.delegateLegacy("insertFileLock", "lock", "insertFileLock", ...args);
  }

  public override listExpiredFileLocks(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listExpiredFileLocks"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listExpiredFileLocks"]> {
    return this.delegateLegacy("listExpiredFileLocks", "lock", "listExpiredFileLocks", ...args);
  }

  public override listFileLocks(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listFileLocks"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listFileLocks"]> {
    return this.delegateLegacy("listFileLocks", "lock", "listFileLocks", ...args);
  }

  public override listFileLocksByTask(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listFileLocksByTask"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listFileLocksByTask"]> {
    return this.delegateLegacy("listFileLocksByTask", "lock", "listFileLocksByTask", ...args);
  }

  public override deleteFileLock(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["deleteFileLock"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["deleteFileLock"]> {
    return this.delegateLegacy("deleteFileLock", "lock", "deleteFileLock", ...args);
  }

  public countActiveExecutionsByTenant(...args: Parameters<AuthoritativeTaskStoreRepositories["billing"]["countActiveExecutionsByTenant"]>): ReturnType<AuthoritativeTaskStoreRepositories["billing"]["countActiveExecutionsByTenant"]> {
    return this.delegateRepo("billing", "countActiveExecutionsByTenant", ...args);
  }

  public listRecentExecutionsByTenant(...args: Parameters<AuthoritativeTaskStoreRepositories["billing"]["listRecentExecutionsByTenant"]>): ReturnType<AuthoritativeTaskStoreRepositories["billing"]["listRecentExecutionsByTenant"]> {
    return this.delegateRepo("billing", "listRecentExecutionsByTenant", ...args);
  }

  public countQueuedTasksByTenant(...args: Parameters<AuthoritativeTaskStoreRepositories["billing"]["countQueuedTasksByTenant"]>): ReturnType<AuthoritativeTaskStoreRepositories["billing"]["countQueuedTasksByTenant"]> {
    return this.delegateRepo("billing", "countQueuedTasksByTenant", ...args);
  }

  public listQueuedTasksByTenant(...args: Parameters<AuthoritativeTaskStoreRepositories["billing"]["listQueuedTasksByTenant"]>): ReturnType<AuthoritativeTaskStoreRepositories["billing"]["listQueuedTasksByTenant"]> {
    return this.delegateRepo("billing", "listQueuedTasksByTenant", ...args);
  }

  public listSessionsByTask(...args: Parameters<AuthoritativeTaskStoreRepositories["session"]["listSessionsByTask"]>): ReturnType<AuthoritativeTaskStoreRepositories["session"]["listSessionsByTask"]> {
    return this.delegateRepo("session", "listSessionsByTask", ...args);
  }

  public listGatewayTargetsByChannel(...args: Parameters<AuthoritativeTaskStoreRepositories["session"]["listGatewayTargetsByChannel"]>): ReturnType<AuthoritativeTaskStoreRepositories["session"]["listGatewayTargetsByChannel"]> {
    return this.delegateRepo("session", "listGatewayTargetsByChannel", ...args);
  }
}
/* c8 ignore stop */
