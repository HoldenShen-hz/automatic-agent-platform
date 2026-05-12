/* c8 ignore start */
import {
  AuthoritativeTaskStoreLegacyCompat,
} from "./authoritative-task-store-legacy-compat.js";
import {
  AuthoritativeTaskStoreDelegatingBase,
} from "./authoritative-task-store-delegating-base.js";

export abstract class AuthoritativeTaskStoreDelegatingLifecycle extends AuthoritativeTaskStoreDelegatingBase {
  public override insertTask(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertTask"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertTask"]> {
    return this.delegateLegacy("insertTask", "task", "insertTask", ...args);
  }

  public override getTask(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getTask"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getTask"]> {
    return this.delegateLegacyNullable("getTask", "task", "getTask", ...args);
  }

  public override listTasks(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listTasks"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listTasks"]> {
    return this.delegateLegacy("listTasks", "task", "listTasks", ...args);
  }

  public override updateTaskStatus(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["updateTaskStatus"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["updateTaskStatus"]> {
    return this.delegateLegacy("updateTaskStatus", "task", "updateTaskStatus", ...args);
  }

  public override updateTaskOutput(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["updateTaskOutput"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["updateTaskOutput"]> {
    return this.delegateLegacy("updateTaskOutput", "task", "updateTaskOutput", ...args);
  }

  public override updateTaskStatusCas(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["updateTaskStatusCas"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["updateTaskStatusCas"]> {
    return this.delegateLegacy("updateTaskStatusCas", "task", "updateTaskStatusCas", ...args);
  }

  public override setTaskState(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["setTaskState"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["setTaskState"]> {
    return this.delegateLegacy("setTaskState", "task", "setTaskState", ...args);
  }

  public override updateTaskInput(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["updateTaskInput"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["updateTaskInput"]> {
    return this.delegateLegacy("updateTaskInput", "task", "updateTaskInput", ...args);
  }

  public override countQueuedTasks(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["countQueuedTasks"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["countQueuedTasks"]> {
    return this.delegateLegacy("countQueuedTasks", "task", "countQueuedTasks", ...args);
  }

  public override getWorkflowState(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getWorkflowState"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getWorkflowState"]> {
    return this.delegateLegacy("getWorkflowState", "workflow", "getWorkflowState", ...args);
  }

  public override listWorkflowStates(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listWorkflowStates"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listWorkflowStates"]> {
    return this.delegateLegacy("listWorkflowStates", "workflow", "listWorkflowStates", ...args);
  }

  public override insertWorkflowState(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertWorkflowState"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertWorkflowState"]> {
    return this.delegateLegacy("insertWorkflowState", "workflow", "insertWorkflowState", ...args);
  }

  public override insertStepOutput(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertStepOutput"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertStepOutput"]> {
    return this.delegateLegacy("insertStepOutput", "workflow", "insertStepOutput", ...args);
  }

  public override updateWorkflowState(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["updateWorkflowState"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["updateWorkflowState"]> {
    return this.delegateLegacy("updateWorkflowState", "workflow", "updateWorkflowState", ...args);
  }

  public override updateWorkflowRecoveryState(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["updateWorkflowRecoveryState"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["updateWorkflowRecoveryState"]> {
    return this.delegateLegacy("updateWorkflowRecoveryState", "workflow", "updateWorkflowRecoveryState", ...args);
  }

  public override insertExecution(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertExecution"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertExecution"]> {
    return this.delegateLegacy("insertExecution", "execution", "insertExecution", ...args);
  }

  public override insertExecutionPrecheck(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertExecutionPrecheck"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertExecutionPrecheck"]> {
    return this.delegateLegacy("insertExecutionPrecheck", "execution", "insertExecutionPrecheck", ...args);
  }

  public override insertDeadLetter(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertDeadLetter"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertDeadLetter"]> {
    return this.delegateLegacy("insertDeadLetter", "execution", "insertDeadLetter", ...args);
  }

  public override updateExecutionFailure(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["updateExecutionFailure"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["updateExecutionFailure"]> {
    return this.delegateLegacy("updateExecutionFailure", "execution", "updateExecutionFailure", ...args);
  }

  public override updateExecutionAgent(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["updateExecutionAgent"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["updateExecutionAgent"]> {
    return this.delegateLegacy("updateExecutionAgent", "execution", "updateExecutionAgent", ...args);
  }

  public override updateExecutionStatus(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["updateExecutionStatus"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["updateExecutionStatus"]> {
    return this.delegateLegacy("updateExecutionStatus", "execution", "updateExecutionStatus", ...args);
  }

  public override updateExecutionStatusCas(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["updateExecutionStatusCas"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["updateExecutionStatusCas"]> {
    return this.delegateLegacy("updateExecutionStatusCas", "execution", "updateExecutionStatusCas", ...args);
  }

  public override listExecutionsByTask(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listExecutionsByTask"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listExecutionsByTask"]> {
    return this.delegateLegacy("listExecutionsByTask", "execution", "listExecutionsByTask", ...args);
  }

  public override countActiveExecutions(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["countActiveExecutions"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["countActiveExecutions"]> {
    return this.delegateLegacy("countActiveExecutions", "execution", "countActiveExecutions", ...args);
  }

  public override insertSession(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertSession"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertSession"]> {
    return this.delegateLegacy("insertSession", "session", "insertSession", ...args);
  }

  public override insertCompactionRecord(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertCompactionRecord"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertCompactionRecord"]> {
    return this.delegateLegacy("insertCompactionRecord", "session", "insertCompactionRecord", ...args);
  }

  public override insertMessage(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertMessage"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertMessage"]> {
    return this.delegateLegacy("insertMessage", "session", "insertMessage", ...args);
  }

  public override insertSessionSummary(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertSessionSummary"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertSessionSummary"]> {
    return this.delegateLegacy("insertSessionSummary", "session", "insertSessionSummary", ...args);
  }

  public override getLatestSessionSummary(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getLatestSessionSummary"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getLatestSessionSummary"]> {
    return this.delegateLegacy("getLatestSessionSummary", "session", "getLatestSessionSummary", ...args);
  }

  public override insertSessionEvent(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertSessionEvent"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertSessionEvent"]> {
    return this.delegateLegacy("insertSessionEvent", "session", "insertSessionEvent", ...args);
  }

  public override listSessionEvents(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listSessionEvents"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listSessionEvents"]> {
    return this.delegateLegacy("listSessionEvents", "session", "listSessionEvents", ...args);
  }

  public override listCompactionRecordsBySession(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listCompactionRecordsBySession"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listCompactionRecordsBySession"]> {
    return this.delegateLegacy("listCompactionRecordsBySession", "session", "listCompactionRecordsBySession", ...args);
  }

  public override updateSessionStatus(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["updateSessionStatus"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["updateSessionStatus"]> {
    return this.delegateLegacy("updateSessionStatus", "session", "updateSessionStatus", ...args);
  }

  public override updateSessionStatusCas(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["updateSessionStatusCas"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["updateSessionStatusCas"]> {
    return this.delegateLegacy("updateSessionStatusCas", "session", "updateSessionStatusCas", ...args);
  }

  public override upsertGatewayTarget(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["upsertGatewayTarget"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["upsertGatewayTarget"]> {
    return this.delegateLegacy("upsertGatewayTarget", "session", "upsertGatewayTarget", ...args);
  }

  public override listGatewaySessionTargetCandidates(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listGatewaySessionTargetCandidates"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listGatewaySessionTargetCandidates"]> {
    return this.delegateLegacy("listGatewaySessionTargetCandidates", "session", "listGatewaySessionTargetCandidates", ...args);
  }

  public override insertCostEvent(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertCostEvent"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertCostEvent"]> {
    return this.delegateLegacy("insertCostEvent", "billing", "insertCostEvent", ...args);
  }

  // R4-28 (INV-COST-001): WAL methods for atomic cost tracking
  public insertCostEventWAL(...args: Parameters<import("./authoritative-task-store-repositories.js").AuthoritativeTaskStoreRepositories["billing"]["insertCostEventWAL"]>): ReturnType<import("./authoritative-task-store-repositories.js").AuthoritativeTaskStoreRepositories["billing"]["insertCostEventWAL"]> {
    return this.delegateRepo("billing", "insertCostEventWAL", ...args);
  }

  public commitCostEventWAL(...args: Parameters<import("./authoritative-task-store-repositories.js").AuthoritativeTaskStoreRepositories["billing"]["commitCostEventWAL"]>): ReturnType<import("./authoritative-task-store-repositories.js").AuthoritativeTaskStoreRepositories["billing"]["commitCostEventWAL"]> {
    return this.delegateRepo("billing", "commitCostEventWAL", ...args);
  }

  public cleanupPendingCostEventWAL(...args: Parameters<import("./authoritative-task-store-repositories.js").AuthoritativeTaskStoreRepositories["billing"]["cleanupPendingCostEventWAL"]>): ReturnType<import("./authoritative-task-store-repositories.js").AuthoritativeTaskStoreRepositories["billing"]["cleanupPendingCostEventWAL"]> {
    return this.delegateRepo("billing", "cleanupPendingCostEventWAL", ...args);
  }

  public override listCostEventsByTask(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listCostEventsByTask"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listCostEventsByTask"]> {
    return this.delegateLegacy("listCostEventsByTask", "billing", "listCostEventsByTask", ...args);
  }

  public override sumCostByTask(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["sumCostByTask"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["sumCostByTask"]> {
    return this.delegateLegacy("sumCostByTask", "billing", "sumCostByTask", ...args);
  }

  public override upsertBillingAccount(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["upsertBillingAccount"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["upsertBillingAccount"]> {
    return this.delegateLegacy("upsertBillingAccount", "billing", "upsertBillingAccount", ...args);
  }

  public override insertBillingInvoice(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertBillingInvoice"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertBillingInvoice"]> {
    return this.delegateLegacy("insertBillingInvoice", "billing", "insertBillingInvoice", ...args);
  }

  public override updateBillingInvoiceStatus(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["updateBillingInvoiceStatus"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["updateBillingInvoiceStatus"]> {
    return this.delegateLegacy("updateBillingInvoiceStatus", "billing", "updateBillingInvoiceStatus", ...args);
  }

  public override insertBillingPaymentSession(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertBillingPaymentSession"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertBillingPaymentSession"]> {
    return this.delegateLegacy("insertBillingPaymentSession", "billing", "insertBillingPaymentSession", ...args);
  }

  public override updateBillingPaymentSessionStatus(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["updateBillingPaymentSessionStatus"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["updateBillingPaymentSessionStatus"]> {
    return this.delegateLegacy("updateBillingPaymentSessionStatus", "billing", "updateBillingPaymentSessionStatus", ...args);
  }

  public override insertUsageEvent(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertUsageEvent"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertUsageEvent"]> {
    return this.delegateLegacy("insertUsageEvent", "billing", "insertUsageEvent", ...args);
  }

  public override upsertQuotaCounter(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["upsertQuotaCounter"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["upsertQuotaCounter"]> {
    return this.delegateLegacy("upsertQuotaCounter", "billing", "upsertQuotaCounter", ...args);
  }

  public override insertLedgerEntry(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertLedgerEntry"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertLedgerEntry"]> {
    return this.delegateLegacy("insertLedgerEntry", "billing", "insertLedgerEntry", ...args);
  }

  public override insertEntitlementDecision(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertEntitlementDecision"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertEntitlementDecision"]> {
    return this.delegateLegacy("insertEntitlementDecision", "billing", "insertEntitlementDecision", ...args);
  }

  public override getBillingAccount(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getBillingAccount"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getBillingAccount"]> {
    return this.delegateLegacy("getBillingAccount", "billing", "getBillingAccount", ...args);
  }

  public override listBillingAccounts(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listBillingAccounts"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listBillingAccounts"]> {
    return this.delegateLegacy("listBillingAccounts", "billing", "listBillingAccounts", ...args);
  }

  public override getBillingInvoice(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getBillingInvoice"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getBillingInvoice"]> {
    return this.delegateLegacy("getBillingInvoice", "billing", "getBillingInvoice", ...args);
  }

  public override listBillingInvoicesForAccount(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listBillingInvoicesForAccount"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listBillingInvoicesForAccount"]> {
    return this.delegateLegacy("listBillingInvoicesForAccount", "billing", "listBillingInvoicesForAccount", ...args);
  }

  public override getBillingPaymentSession(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getBillingPaymentSession"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getBillingPaymentSession"]> {
    return this.delegateLegacy("getBillingPaymentSession", "billing", "getBillingPaymentSession", ...args);
  }

  public override getBillingPaymentSessionByGatewayRef(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getBillingPaymentSessionByGatewayRef"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getBillingPaymentSessionByGatewayRef"]> {
    return this.delegateLegacy("getBillingPaymentSessionByGatewayRef", "billing", "getBillingPaymentSessionByGatewayRef", ...args);
  }

  public override listBillingPaymentSessionsForInvoice(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listBillingPaymentSessionsForInvoice"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listBillingPaymentSessionsForInvoice"]> {
    return this.delegateLegacy("listBillingPaymentSessionsForInvoice", "billing", "listBillingPaymentSessionsForInvoice", ...args);
  }

  public override listBillingPaymentSessions(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listBillingPaymentSessions"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listBillingPaymentSessions"]> {
    return this.delegateLegacy("listBillingPaymentSessions", "billing", "listBillingPaymentSessions", ...args);
  }

  public override getQuotaCounter(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getQuotaCounter"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getQuotaCounter"]> {
    return this.delegateLegacy("getQuotaCounter", "billing", "getQuotaCounter", ...args);
  }

  public override listQuotaCounters(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listQuotaCounters"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listQuotaCounters"]> {
    return this.delegateLegacy("listQuotaCounters", "billing", "listQuotaCounters", ...args);
  }

  public override listUsageEventsForAccount(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listUsageEventsForAccount"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listUsageEventsForAccount"]> {
    return this.delegateLegacy("listUsageEventsForAccount", "billing", "listUsageEventsForAccount", ...args);
  }

  public override listLedgerEntriesForAccount(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listLedgerEntriesForAccount"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listLedgerEntriesForAccount"]> {
    return this.delegateLegacy("listLedgerEntriesForAccount", "billing", "listLedgerEntriesForAccount", ...args);
  }

  public override listEntitlementDecisionsForAccount(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listEntitlementDecisionsForAccount"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listEntitlementDecisionsForAccount"]> {
    return this.delegateLegacy("listEntitlementDecisionsForAccount", "billing", "listEntitlementDecisionsForAccount", ...args);
  }
}
/* c8 ignore stop */
