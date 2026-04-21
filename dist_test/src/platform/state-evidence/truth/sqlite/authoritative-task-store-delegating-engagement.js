import { AuthoritativeTaskStoreDelegatingLifecycle, } from "./authoritative-task-store-delegating-lifecycle.js";
export class AuthoritativeTaskStoreDelegatingEngagement extends AuthoritativeTaskStoreDelegatingLifecycle {
    insertEvent(...args) {
        return this.delegateLegacy("insertEvent", "event", "insertEvent", ...args);
    }
    insertEventDeadLetter(...args) {
        return this.delegateLegacy("insertEventDeadLetter", "event", "insertEventDeadLetter", ...args);
    }
    listEventDeadLetters(...args) {
        return this.delegateLegacy("listEventDeadLetters", "event", "listEventDeadLetters", ...args);
    }
    markEventAck(...args) {
        return this.delegateLegacy("markEventAck", "event", "markEventAck", ...args);
    }
    markEventDeadLettered(...args) {
        return this.delegateLegacy("markEventDeadLettered", "event", "markEventDeadLettered", ...args);
    }
    getRequiredConsumerIds(...args) {
        return this.delegateLegacy("getRequiredConsumerIds", "event", "getRequiredConsumerIds", ...args);
    }
    ackAllConsumersForEvent(...args) {
        return this.delegateLegacy("ackAllConsumersForEvent", "event", "ackAllConsumersForEvent", ...args);
    }
    ensureEventConsumerAckPending(...args) {
        return this.delegateLegacy("ensureEventConsumerAckPending", "event", "ensureEventConsumerAckPending", ...args);
    }
    listPendingEventsForConsumer(...args) {
        return this.delegateLegacy("listPendingEventsForConsumer", "event", "listPendingEventsForConsumer", ...args);
    }
    listFailedEventsForConsumer(...args) {
        return this.delegateLegacy("listFailedEventsForConsumer", "event", "listFailedEventsForConsumer", ...args);
    }
    listEventsForTask(...args) {
        return this.delegateLegacy("listEventsForTask", "event", "listEventsForTask", ...args);
    }
    getEvent(...args) {
        return this.delegateLegacyNullable("getEvent", "event", "getEvent", ...args);
    }
    listDispatchDecisionTracesByTask(...args) {
        return this.delegateLegacy("listDispatchDecisionTracesByTask", "event", "listDispatchDecisionTracesByTask", ...args);
    }
    listDispatchDecisionTracesByExecution(...args) {
        return this.delegateLegacy("listDispatchDecisionTracesByExecution", "event", "listDispatchDecisionTracesByExecution", ...args);
    }
    listTier1EventRegistryCoverage(...args) {
        return this.delegateLegacy("listTier1EventRegistryCoverage", "event", "listTier1EventRegistryCoverage", ...args);
    }
    getTier1AuditIntegrityReport(...args) {
        return this.delegateLegacy("getTier1AuditIntegrityReport", "event", "getTier1AuditIntegrityReport", ...args);
    }
    bootstrapTier1AuditIntegrityRecords(...args) {
        return this.delegateLegacy("bootstrapTier1AuditIntegrityRecords", "event", "bootstrapTier1AuditIntegrityRecords", ...args);
    }
    listPendingTier1Acks(...args) {
        return this.delegateLegacy("listPendingTier1Acks", "event", "listPendingTier1Acks", ...args);
    }
    countPendingTier1Acks(...args) {
        return this.delegateLegacy("countPendingTier1Acks", "event", "countPendingTier1Acks", ...args);
    }
    countFailedTier1Acks(...args) {
        return this.delegateLegacy("countFailedTier1Acks", "event", "countFailedTier1Acks", ...args);
    }
    createTier1StatusEvent(...args) {
        return this.delegateLegacy("createTier1StatusEvent", "event", "createTier1StatusEvent", ...args);
    }
    insertHeartbeatSnapshot(...args) {
        return this.delegateLegacy("insertHeartbeatSnapshot", "worker", "insertHeartbeatSnapshot", ...args);
    }
    insertRemoteLog(...args) {
        return this.delegateLegacy("insertRemoteLog", "worker", "insertRemoteLog", ...args);
    }
    upsertAgentExecutionRecord(...args) {
        return this.delegateLegacy("upsertAgentExecutionRecord", "worker", "upsertAgentExecutionRecord", ...args);
    }
    upsertWorkerSnapshot(...args) {
        return this.delegateLegacy("upsertWorkerSnapshot", "worker", "upsertWorkerSnapshot", ...args);
    }
    upsertCoordinatorInstanceSnapshot(...args) {
        return this.delegateLegacy("upsertCoordinatorInstanceSnapshot", "worker", "upsertCoordinatorInstanceSnapshot", ...args);
    }
    insertWorkerRegistrationChallenge(...args) {
        return this.delegateLegacy("insertWorkerRegistrationChallenge", "worker", "insertWorkerRegistrationChallenge", ...args);
    }
    getWorkerRegistrationChallenge(...args) {
        return this.delegateLegacyNullable("getWorkerRegistrationChallenge", "worker", "getWorkerRegistrationChallenge", ...args);
    }
    consumeWorkerRegistrationChallenge(...args) {
        return this.delegateLegacy("consumeWorkerRegistrationChallenge", "worker", "consumeWorkerRegistrationChallenge", ...args);
    }
    insertExecutionTicket(...args) {
        return this.delegateLegacy("insertExecutionTicket", "worker", "insertExecutionTicket", ...args);
    }
    claimExecutionTicket(...args) {
        return this.delegateLegacy("claimExecutionTicket", "worker", "claimExecutionTicket", ...args);
    }
    consumeExecutionTicket(...args) {
        return this.delegateLegacy("consumeExecutionTicket", "worker", "consumeExecutionTicket", ...args);
    }
    invalidateExecutionTicket(...args) {
        return this.delegateLegacy("invalidateExecutionTicket", "worker", "invalidateExecutionTicket", ...args);
    }
    insertExecutionLease(...args) {
        return this.delegateLegacy("insertExecutionLease", "worker", "insertExecutionLease", ...args);
    }
    renewExecutionLease(...args) {
        return this.delegateLegacy("renewExecutionLease", "worker", "renewExecutionLease", ...args);
    }
    closeExecutionLease(...args) {
        return this.delegateLegacy("closeExecutionLease", "worker", "closeExecutionLease", ...args);
    }
    insertLeaseAudit(...args) {
        return this.delegateLegacy("insertLeaseAudit", "worker", "insertLeaseAudit", ...args);
    }
    listRemoteLogsByTask(...args) {
        return this.delegateLegacy("listRemoteLogsByTask", "worker", "listRemoteLogsByTask", ...args);
    }
    listRemoteLogsByExecution(...args) {
        return this.delegateLegacy("listRemoteLogsByExecution", "worker", "listRemoteLogsByExecution", ...args);
    }
    getWorkerSnapshot(...args) {
        return this.delegateLegacyNullable("getWorkerSnapshot", "worker", "getWorkerSnapshot", ...args);
    }
    getAgentExecutionRecord(...args) {
        return this.delegateLegacyNullable("getAgentExecutionRecord", "worker", "getAgentExecutionRecord", ...args);
    }
    listAgentExecutionRecordsByTask(...args) {
        return this.delegateLegacy("listAgentExecutionRecordsByTask", "worker", "listAgentExecutionRecordsByTask", ...args);
    }
    listWorkerSnapshots(...args) {
        return this.delegateLegacy("listWorkerSnapshots", "worker", "listWorkerSnapshots", ...args);
    }
    listStaleWorkerSnapshots(...args) {
        return this.delegateLegacy("listStaleWorkerSnapshots", "worker", "listStaleWorkerSnapshots", ...args);
    }
    getCoordinatorInstanceSnapshot(...args) {
        return this.delegateLegacyNullable("getCoordinatorInstanceSnapshot", "worker", "getCoordinatorInstanceSnapshot", ...args);
    }
    listCoordinatorInstanceSnapshots(...args) {
        return this.delegateLegacy("listCoordinatorInstanceSnapshots", "worker", "listCoordinatorInstanceSnapshots", ...args);
    }
    listHeartbeatSnapshotsByExecution(...args) {
        return this.delegateLegacy("listHeartbeatSnapshotsByExecution", "worker", "listHeartbeatSnapshotsByExecution", ...args);
    }
    getExecutionTicket(...args) {
        return this.delegateLegacyNullable("getExecutionTicket", "worker", "getExecutionTicket", ...args);
    }
    getActiveExecutionTicket(...args) {
        return this.delegateLegacyNullable("getActiveExecutionTicket", "worker", "getActiveExecutionTicket", ...args);
    }
    listExecutionTicketsByExecution(...args) {
        return this.delegateLegacy("listExecutionTicketsByExecution", "worker", "listExecutionTicketsByExecution", ...args);
    }
    listExecutionTicketsByStatuses(...args) {
        return this.delegateLegacy("listExecutionTicketsByStatuses", "worker", "listExecutionTicketsByStatuses", ...args);
    }
    listDispatchableExecutionTickets(...args) {
        return this.delegateLegacy("listDispatchableExecutionTickets", "worker", "listDispatchableExecutionTickets", ...args);
    }
    getExecutionLease(...args) {
        return this.delegateLegacyNullable("getExecutionLease", "worker", "getExecutionLease", ...args);
    }
    getActiveExecutionLease(...args) {
        return this.delegateLegacyNullable("getActiveExecutionLease", "worker", "getActiveExecutionLease", ...args);
    }
    getLatestExecutionLease(...args) {
        return this.delegateLegacyNullable("getLatestExecutionLease", "worker", "getLatestExecutionLease", ...args);
    }
    listExecutionLeases(...args) {
        return this.delegateLegacy("listExecutionLeases", "worker", "listExecutionLeases", ...args);
    }
    listExecutionLeasesByStatuses(...args) {
        return this.delegateLegacy("listExecutionLeasesByStatuses", "worker", "listExecutionLeasesByStatuses", ...args);
    }
    listExpiredExecutionLeases(...args) {
        return this.delegateLegacy("listExpiredExecutionLeases", "worker", "listExpiredExecutionLeases", ...args);
    }
    getLatestFencingToken(...args) {
        return this.delegateLegacy("getLatestFencingToken", "worker", "getLatestFencingToken", ...args);
    }
    listApprovalsByTask(...args) {
        return this.delegateLegacy("listApprovalsByTask", "approval", "listApprovalsByTask", ...args);
    }
    getApproval(...args) {
        return this.delegateLegacy("getApproval", "approval", "getApproval", ...args);
    }
    insertApproval(...args) {
        return this.delegateLegacy("insertApproval", "approval", "insertApproval", ...args);
    }
    updateApprovalDecision(...args) {
        return this.delegateLegacy("updateApprovalDecision", "approval", "updateApprovalDecision", ...args);
    }
    updateApprovalRequest(...args) {
        return this.delegateLegacy("updateApprovalRequest", "approval", "updateApprovalRequest", ...args);
    }
    listTakeoverSessionsByTask(...args) {
        return this.delegateLegacy("listTakeoverSessionsByTask", "approval", "listTakeoverSessionsByTask", ...args);
    }
    insertTakeoverSession(...args) {
        return this.delegateLegacy("insertTakeoverSession", "approval", "insertTakeoverSession", ...args);
    }
    getTakeoverSession(...args) {
        return this.delegateLegacy("getTakeoverSession", "approval", "getTakeoverSession", ...args);
    }
    closeTakeoverSession(...args) {
        return this.delegateLegacy("closeTakeoverSession", "approval", "closeTakeoverSession", ...args);
    }
    insertOperatorAction(...args) {
        return this.delegateLegacy("insertOperatorAction", "approval", "insertOperatorAction", ...args);
    }
    listOperatorActionsByTask(...args) {
        return this.delegateLegacy("listOperatorActionsByTask", "approval", "listOperatorActionsByTask", ...args);
    }
    listMemories(...args) {
        return this.delegateLegacy("listMemories", "memory", "listMemories", ...args);
    }
    insertMemory(...args) {
        return this.delegateLegacy("insertMemory", "memory", "insertMemory", ...args);
    }
    getMemory(...args) {
        return this.delegateLegacy("getMemory", "memory", "getMemory", ...args);
    }
    recordMemoryAccess(...args) {
        return this.delegateLegacy("recordMemoryAccess", "memory", "recordMemoryAccess", ...args);
    }
    revokeMemory(...args) {
        return this.delegateLegacy("revokeMemory", "memory", "revokeMemory", ...args);
    }
    findMemoryByContentHash(...args) {
        return this.delegateLegacy("findMemoryByContentHash", "memory", "findMemoryByContentHash", ...args);
    }
    getMemoryQualityReport(...args) {
        return this.delegateLegacy("getMemoryQualityReport", "memory", "getMemoryQualityReport", ...args);
    }
    getArtifact(...args) {
        return this.delegateLegacy("getArtifact", "artifact", "getArtifact", ...args);
    }
    insertArtifact(...args) {
        return this.delegateLegacy("insertArtifact", "artifact", "insertArtifact", ...args);
    }
    listArtifactsByTask(...args) {
        return this.delegateLegacy("listArtifactsByTask", "artifact", "listArtifactsByTask", ...args);
    }
    listEventsByType(...args) {
        return this.delegateRepo("event", "listEventsByType", ...args);
    }
    insertEventConsumerAck(...args) {
        return this.delegateRepo("event", "insertEventConsumerAck", ...args);
    }
    getEventConsumerAck(...args) {
        return this.delegateRepo("event", "getEventConsumerAck", ...args);
    }
    listPendingExecutionTickets(...args) {
        return this.delegateRepo("worker", "listPendingExecutionTickets", ...args);
    }
}
/* c8 ignore stop */
//# sourceMappingURL=authoritative-task-store-delegating-engagement.js.map