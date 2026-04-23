import { AuthoritativeTaskStoreDelegatingBase, } from "./authoritative-task-store-delegating-base.js";
export class AuthoritativeTaskStoreDelegatingLifecycle extends AuthoritativeTaskStoreDelegatingBase {
    insertTask(...args) {
        return this.delegateLegacy("insertTask", "task", "insertTask", ...args);
    }
    getTask(...args) {
        return this.delegateLegacyNullable("getTask", "task", "getTask", ...args);
    }
    listTasks(...args) {
        return this.delegateLegacy("listTasks", "task", "listTasks", ...args);
    }
    updateTaskStatus(...args) {
        return this.delegateLegacy("updateTaskStatus", "task", "updateTaskStatus", ...args);
    }
    updateTaskOutput(...args) {
        return this.delegateLegacy("updateTaskOutput", "task", "updateTaskOutput", ...args);
    }
    updateTaskStatusCas(...args) {
        return this.delegateLegacy("updateTaskStatusCas", "task", "updateTaskStatusCas", ...args);
    }
    setTaskState(...args) {
        return this.delegateLegacy("setTaskState", "task", "setTaskState", ...args);
    }
    updateTaskInput(...args) {
        return this.delegateLegacy("updateTaskInput", "task", "updateTaskInput", ...args);
    }
    countQueuedTasks(...args) {
        return this.delegateLegacy("countQueuedTasks", "task", "countQueuedTasks", ...args);
    }
    getWorkflowState(...args) {
        return this.delegateLegacy("getWorkflowState", "workflow", "getWorkflowState", ...args);
    }
    listWorkflowStates(...args) {
        return this.delegateLegacy("listWorkflowStates", "workflow", "listWorkflowStates", ...args);
    }
    insertWorkflowState(...args) {
        return this.delegateLegacy("insertWorkflowState", "workflow", "insertWorkflowState", ...args);
    }
    insertStepOutput(...args) {
        return this.delegateLegacy("insertStepOutput", "workflow", "insertStepOutput", ...args);
    }
    updateWorkflowState(...args) {
        return this.delegateLegacy("updateWorkflowState", "workflow", "updateWorkflowState", ...args);
    }
    updateWorkflowRecoveryState(...args) {
        return this.delegateLegacy("updateWorkflowRecoveryState", "workflow", "updateWorkflowRecoveryState", ...args);
    }
    insertExecution(...args) {
        return this.delegateLegacy("insertExecution", "execution", "insertExecution", ...args);
    }
    insertExecutionPrecheck(...args) {
        return this.delegateLegacy("insertExecutionPrecheck", "execution", "insertExecutionPrecheck", ...args);
    }
    insertDeadLetter(...args) {
        return this.delegateLegacy("insertDeadLetter", "execution", "insertDeadLetter", ...args);
    }
    updateExecutionFailure(...args) {
        return this.delegateLegacy("updateExecutionFailure", "execution", "updateExecutionFailure", ...args);
    }
    updateExecutionAgent(...args) {
        return this.delegateLegacy("updateExecutionAgent", "execution", "updateExecutionAgent", ...args);
    }
    updateExecutionStatus(...args) {
        return this.delegateLegacy("updateExecutionStatus", "execution", "updateExecutionStatus", ...args);
    }
    updateExecutionStatusCas(...args) {
        return this.delegateLegacy("updateExecutionStatusCas", "execution", "updateExecutionStatusCas", ...args);
    }
    listExecutionsByTask(...args) {
        return this.delegateLegacy("listExecutionsByTask", "execution", "listExecutionsByTask", ...args);
    }
    countActiveExecutions(...args) {
        return this.delegateLegacy("countActiveExecutions", "execution", "countActiveExecutions", ...args);
    }
    insertSession(...args) {
        return this.delegateLegacy("insertSession", "session", "insertSession", ...args);
    }
    insertCompactionRecord(...args) {
        return this.delegateLegacy("insertCompactionRecord", "session", "insertCompactionRecord", ...args);
    }
    insertMessage(...args) {
        return this.delegateLegacy("insertMessage", "session", "insertMessage", ...args);
    }
    insertSessionSummary(...args) {
        return this.delegateLegacy("insertSessionSummary", "session", "insertSessionSummary", ...args);
    }
    getLatestSessionSummary(...args) {
        return this.delegateLegacy("getLatestSessionSummary", "session", "getLatestSessionSummary", ...args);
    }
    insertSessionEvent(...args) {
        return this.delegateLegacy("insertSessionEvent", "session", "insertSessionEvent", ...args);
    }
    listSessionEvents(...args) {
        return this.delegateLegacy("listSessionEvents", "session", "listSessionEvents", ...args);
    }
    listCompactionRecordsBySession(...args) {
        return this.delegateLegacy("listCompactionRecordsBySession", "session", "listCompactionRecordsBySession", ...args);
    }
    updateSessionStatus(...args) {
        return this.delegateLegacy("updateSessionStatus", "session", "updateSessionStatus", ...args);
    }
    updateSessionStatusCas(...args) {
        return this.delegateLegacy("updateSessionStatusCas", "session", "updateSessionStatusCas", ...args);
    }
    upsertGatewayTarget(...args) {
        return this.delegateLegacy("upsertGatewayTarget", "session", "upsertGatewayTarget", ...args);
    }
    listGatewaySessionTargetCandidates(...args) {
        return this.delegateLegacy("listGatewaySessionTargetCandidates", "session", "listGatewaySessionTargetCandidates", ...args);
    }
    insertCostEvent(...args) {
        return this.delegateLegacy("insertCostEvent", "billing", "insertCostEvent", ...args);
    }
    listCostEventsByTask(...args) {
        return this.delegateLegacy("listCostEventsByTask", "billing", "listCostEventsByTask", ...args);
    }
    sumCostByTask(...args) {
        return this.delegateLegacy("sumCostByTask", "billing", "sumCostByTask", ...args);
    }
    upsertBillingAccount(...args) {
        return this.delegateLegacy("upsertBillingAccount", "billing", "upsertBillingAccount", ...args);
    }
    insertBillingInvoice(...args) {
        return this.delegateLegacy("insertBillingInvoice", "billing", "insertBillingInvoice", ...args);
    }
    updateBillingInvoiceStatus(...args) {
        return this.delegateLegacy("updateBillingInvoiceStatus", "billing", "updateBillingInvoiceStatus", ...args);
    }
    insertBillingPaymentSession(...args) {
        return this.delegateLegacy("insertBillingPaymentSession", "billing", "insertBillingPaymentSession", ...args);
    }
    updateBillingPaymentSessionStatus(...args) {
        return this.delegateLegacy("updateBillingPaymentSessionStatus", "billing", "updateBillingPaymentSessionStatus", ...args);
    }
    insertUsageEvent(...args) {
        return this.delegateLegacy("insertUsageEvent", "billing", "insertUsageEvent", ...args);
    }
    upsertQuotaCounter(...args) {
        return this.delegateLegacy("upsertQuotaCounter", "billing", "upsertQuotaCounter", ...args);
    }
    insertLedgerEntry(...args) {
        return this.delegateLegacy("insertLedgerEntry", "billing", "insertLedgerEntry", ...args);
    }
    insertEntitlementDecision(...args) {
        return this.delegateLegacy("insertEntitlementDecision", "billing", "insertEntitlementDecision", ...args);
    }
    getBillingAccount(...args) {
        return this.delegateLegacy("getBillingAccount", "billing", "getBillingAccount", ...args);
    }
    listBillingAccounts(...args) {
        return this.delegateLegacy("listBillingAccounts", "billing", "listBillingAccounts", ...args);
    }
    getBillingInvoice(...args) {
        return this.delegateLegacy("getBillingInvoice", "billing", "getBillingInvoice", ...args);
    }
    listBillingInvoicesForAccount(...args) {
        return this.delegateLegacy("listBillingInvoicesForAccount", "billing", "listBillingInvoicesForAccount", ...args);
    }
    getBillingPaymentSession(...args) {
        return this.delegateLegacy("getBillingPaymentSession", "billing", "getBillingPaymentSession", ...args);
    }
    getBillingPaymentSessionByGatewayRef(...args) {
        return this.delegateLegacy("getBillingPaymentSessionByGatewayRef", "billing", "getBillingPaymentSessionByGatewayRef", ...args);
    }
    listBillingPaymentSessionsForInvoice(...args) {
        return this.delegateLegacy("listBillingPaymentSessionsForInvoice", "billing", "listBillingPaymentSessionsForInvoice", ...args);
    }
    listBillingPaymentSessions(...args) {
        return this.delegateLegacy("listBillingPaymentSessions", "billing", "listBillingPaymentSessions", ...args);
    }
    getQuotaCounter(...args) {
        return this.delegateLegacy("getQuotaCounter", "billing", "getQuotaCounter", ...args);
    }
    listQuotaCounters(...args) {
        return this.delegateLegacy("listQuotaCounters", "billing", "listQuotaCounters", ...args);
    }
    listUsageEventsForAccount(...args) {
        return this.delegateLegacy("listUsageEventsForAccount", "billing", "listUsageEventsForAccount", ...args);
    }
    listLedgerEntriesForAccount(...args) {
        return this.delegateLegacy("listLedgerEntriesForAccount", "billing", "listLedgerEntriesForAccount", ...args);
    }
    listEntitlementDecisionsForAccount(...args) {
        return this.delegateLegacy("listEntitlementDecisionsForAccount", "billing", "listEntitlementDecisionsForAccount", ...args);
    }
}
/* c8 ignore stop */
//# sourceMappingURL=authoritative-task-store-delegating-lifecycle.js.map