/* c8 ignore start */
import {
  AuthoritativeTaskStoreLegacyCompat,
} from "./authoritative-task-store-legacy-compat.js";
import type {
  AuthoritativeTaskStoreRepositories,
} from "./authoritative-task-store-repositories.js";
import {
  AuthoritativeTaskStoreDelegatingLifecycle,
} from "./authoritative-task-store-delegating-lifecycle.js";

export abstract class AuthoritativeTaskStoreDelegatingEngagement extends AuthoritativeTaskStoreDelegatingLifecycle {
  public override insertEvent(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertEvent"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertEvent"]> {
    return this.delegateLegacy("insertEvent", "event", "insertEvent", ...args);
  }

  public override insertEventDeadLetter(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertEventDeadLetter"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertEventDeadLetter"]> {
    return this.delegateLegacy("insertEventDeadLetter", "event", "insertEventDeadLetter", ...args);
  }

  public override listEventDeadLetters(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listEventDeadLetters"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listEventDeadLetters"]> {
    return this.delegateLegacy("listEventDeadLetters", "event", "listEventDeadLetters", ...args);
  }

  public override markEventAck(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["markEventAck"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["markEventAck"]> {
    return this.delegateLegacy("markEventAck", "event", "markEventAck", ...args);
  }

  public override markEventDeadLettered(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["markEventDeadLettered"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["markEventDeadLettered"]> {
    return this.delegateLegacy("markEventDeadLettered", "event", "markEventDeadLettered", ...args);
  }

  public override getRequiredConsumerIds(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getRequiredConsumerIds"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getRequiredConsumerIds"]> {
    return this.delegateLegacy("getRequiredConsumerIds", "event", "getRequiredConsumerIds", ...args);
  }

  public override ackAllConsumersForEvent(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["ackAllConsumersForEvent"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["ackAllConsumersForEvent"]> {
    return this.delegateLegacy("ackAllConsumersForEvent", "event", "ackAllConsumersForEvent", ...args);
  }

  public override ensureEventConsumerAckPending(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["ensureEventConsumerAckPending"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["ensureEventConsumerAckPending"]> {
    return this.delegateLegacy("ensureEventConsumerAckPending", "event", "ensureEventConsumerAckPending", ...args);
  }

  public override listPendingEventsForConsumer(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listPendingEventsForConsumer"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listPendingEventsForConsumer"]> {
    return this.delegateLegacy("listPendingEventsForConsumer", "event", "listPendingEventsForConsumer", ...args);
  }

  public override listFailedEventsForConsumer(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listFailedEventsForConsumer"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listFailedEventsForConsumer"]> {
    return this.delegateLegacy("listFailedEventsForConsumer", "event", "listFailedEventsForConsumer", ...args);
  }

  public override listEventsForTask(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listEventsForTask"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listEventsForTask"]> {
    return this.delegateLegacy("listEventsForTask", "event", "listEventsForTask", ...args);
  }

  public override getEvent(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getEvent"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getEvent"]> {
    return this.delegateLegacyNullable("getEvent", "event", "getEvent", ...args);
  }

  public override listDispatchDecisionTracesByTask(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listDispatchDecisionTracesByTask"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listDispatchDecisionTracesByTask"]> {
    return this.delegateLegacy("listDispatchDecisionTracesByTask", "event", "listDispatchDecisionTracesByTask", ...args);
  }

  public override listDispatchDecisionTracesByExecution(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listDispatchDecisionTracesByExecution"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listDispatchDecisionTracesByExecution"]> {
    return this.delegateLegacy("listDispatchDecisionTracesByExecution", "event", "listDispatchDecisionTracesByExecution", ...args);
  }

  public override listTier1EventRegistryCoverage(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listTier1EventRegistryCoverage"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listTier1EventRegistryCoverage"]> {
    return this.delegateLegacy("listTier1EventRegistryCoverage", "event", "listTier1EventRegistryCoverage", ...args);
  }

  public override getTier1AuditIntegrityReport(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getTier1AuditIntegrityReport"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getTier1AuditIntegrityReport"]> {
    return this.delegateLegacy("getTier1AuditIntegrityReport", "event", "getTier1AuditIntegrityReport", ...args);
  }

  public override bootstrapTier1AuditIntegrityRecords(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["bootstrapTier1AuditIntegrityRecords"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["bootstrapTier1AuditIntegrityRecords"]> {
    return this.delegateLegacy("bootstrapTier1AuditIntegrityRecords", "event", "bootstrapTier1AuditIntegrityRecords", ...args);
  }

  public override listPendingTier1Acks(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listPendingTier1Acks"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listPendingTier1Acks"]> {
    return this.delegateLegacy("listPendingTier1Acks", "event", "listPendingTier1Acks", ...args);
  }

  public override countPendingTier1Acks(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["countPendingTier1Acks"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["countPendingTier1Acks"]> {
    return this.delegateLegacy("countPendingTier1Acks", "event", "countPendingTier1Acks", ...args);
  }

  public override countFailedTier1Acks(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["countFailedTier1Acks"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["countFailedTier1Acks"]> {
    return this.delegateLegacy("countFailedTier1Acks", "event", "countFailedTier1Acks", ...args);
  }

  public override createTier1StatusEvent(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["createTier1StatusEvent"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["createTier1StatusEvent"]> {
    return this.delegateLegacy("createTier1StatusEvent", "event", "createTier1StatusEvent", ...args);
  }

  public override insertHeartbeatSnapshot(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertHeartbeatSnapshot"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertHeartbeatSnapshot"]> {
    return this.delegateLegacy("insertHeartbeatSnapshot", "worker", "insertHeartbeatSnapshot", ...args);
  }

  public override insertRemoteLog(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertRemoteLog"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertRemoteLog"]> {
    return this.delegateLegacy("insertRemoteLog", "worker", "insertRemoteLog", ...args);
  }

  public override upsertAgentExecutionRecord(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["upsertAgentExecutionRecord"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["upsertAgentExecutionRecord"]> {
    return this.delegateLegacy("upsertAgentExecutionRecord", "worker", "upsertAgentExecutionRecord", ...args);
  }

  public override upsertWorkerSnapshot(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["upsertWorkerSnapshot"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["upsertWorkerSnapshot"]> {
    return this.delegateLegacy("upsertWorkerSnapshot", "worker", "upsertWorkerSnapshot", ...args);
  }

  public override upsertCoordinatorInstanceSnapshot(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["upsertCoordinatorInstanceSnapshot"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["upsertCoordinatorInstanceSnapshot"]> {
    return this.delegateLegacy("upsertCoordinatorInstanceSnapshot", "worker", "upsertCoordinatorInstanceSnapshot", ...args);
  }

  public override insertWorkerRegistrationChallenge(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertWorkerRegistrationChallenge"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertWorkerRegistrationChallenge"]> {
    return this.delegateLegacy("insertWorkerRegistrationChallenge", "worker", "insertWorkerRegistrationChallenge", ...args);
  }

  public override getWorkerRegistrationChallenge(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getWorkerRegistrationChallenge"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getWorkerRegistrationChallenge"]> {
    return this.delegateLegacyNullable("getWorkerRegistrationChallenge", "worker", "getWorkerRegistrationChallenge", ...args);
  }

  public override consumeWorkerRegistrationChallenge(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["consumeWorkerRegistrationChallenge"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["consumeWorkerRegistrationChallenge"]> {
    return this.delegateLegacy("consumeWorkerRegistrationChallenge", "worker", "consumeWorkerRegistrationChallenge", ...args);
  }

  public override insertExecutionTicket(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertExecutionTicket"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertExecutionTicket"]> {
    return this.delegateLegacy("insertExecutionTicket", "worker", "insertExecutionTicket", ...args);
  }

  public override claimExecutionTicket(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["claimExecutionTicket"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["claimExecutionTicket"]> {
    return this.delegateLegacy("claimExecutionTicket", "worker", "claimExecutionTicket", ...args);
  }

  public override consumeExecutionTicket(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["consumeExecutionTicket"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["consumeExecutionTicket"]> {
    return this.delegateLegacy("consumeExecutionTicket", "worker", "consumeExecutionTicket", ...args);
  }

  public override invalidateExecutionTicket(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["invalidateExecutionTicket"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["invalidateExecutionTicket"]> {
    return this.delegateLegacy("invalidateExecutionTicket", "worker", "invalidateExecutionTicket", ...args);
  }

  public override insertExecutionLease(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertExecutionLease"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertExecutionLease"]> {
    return this.delegateLegacy("insertExecutionLease", "worker", "insertExecutionLease", ...args);
  }

  public override renewExecutionLease(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["renewExecutionLease"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["renewExecutionLease"]> {
    return this.delegateLegacy("renewExecutionLease", "worker", "renewExecutionLease", ...args);
  }

  public override closeExecutionLease(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["closeExecutionLease"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["closeExecutionLease"]> {
    return this.delegateLegacy("closeExecutionLease", "worker", "closeExecutionLease", ...args);
  }

  public override insertLeaseAudit(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertLeaseAudit"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertLeaseAudit"]> {
    return this.delegateLegacy("insertLeaseAudit", "worker", "insertLeaseAudit", ...args);
  }

  public override listRemoteLogsByTask(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listRemoteLogsByTask"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listRemoteLogsByTask"]> {
    return this.delegateLegacy("listRemoteLogsByTask", "worker", "listRemoteLogsByTask", ...args);
  }

  public override listRemoteLogsByExecution(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listRemoteLogsByExecution"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listRemoteLogsByExecution"]> {
    return this.delegateLegacy("listRemoteLogsByExecution", "worker", "listRemoteLogsByExecution", ...args);
  }

  public override getWorkerSnapshot(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getWorkerSnapshot"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getWorkerSnapshot"]> {
    return this.delegateLegacyNullable("getWorkerSnapshot", "worker", "getWorkerSnapshot", ...args);
  }

  public override getAgentExecutionRecord(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getAgentExecutionRecord"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getAgentExecutionRecord"]> {
    return this.delegateLegacyNullable("getAgentExecutionRecord", "worker", "getAgentExecutionRecord", ...args);
  }

  public override listAgentExecutionRecordsByTask(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listAgentExecutionRecordsByTask"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listAgentExecutionRecordsByTask"]> {
    return this.delegateLegacy("listAgentExecutionRecordsByTask", "worker", "listAgentExecutionRecordsByTask", ...args);
  }

  public override listWorkerSnapshots(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listWorkerSnapshots"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listWorkerSnapshots"]> {
    return this.delegateLegacy("listWorkerSnapshots", "worker", "listWorkerSnapshots", ...args);
  }

  public override listStaleWorkerSnapshots(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listStaleWorkerSnapshots"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listStaleWorkerSnapshots"]> {
    return this.delegateLegacy("listStaleWorkerSnapshots", "worker", "listStaleWorkerSnapshots", ...args);
  }

  public override getCoordinatorInstanceSnapshot(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getCoordinatorInstanceSnapshot"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getCoordinatorInstanceSnapshot"]> {
    return this.delegateLegacyNullable("getCoordinatorInstanceSnapshot", "worker", "getCoordinatorInstanceSnapshot", ...args);
  }

  public override listCoordinatorInstanceSnapshots(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listCoordinatorInstanceSnapshots"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listCoordinatorInstanceSnapshots"]> {
    return this.delegateLegacy("listCoordinatorInstanceSnapshots", "worker", "listCoordinatorInstanceSnapshots", ...args);
  }

  public override listHeartbeatSnapshotsByExecution(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listHeartbeatSnapshotsByExecution"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listHeartbeatSnapshotsByExecution"]> {
    return this.delegateLegacy("listHeartbeatSnapshotsByExecution", "worker", "listHeartbeatSnapshotsByExecution", ...args);
  }

  public override getExecutionTicket(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getExecutionTicket"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getExecutionTicket"]> {
    return this.delegateLegacyNullable("getExecutionTicket", "worker", "getExecutionTicket", ...args);
  }

  public override getActiveExecutionTicket(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getActiveExecutionTicket"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getActiveExecutionTicket"]> {
    return this.delegateLegacyNullable("getActiveExecutionTicket", "worker", "getActiveExecutionTicket", ...args);
  }

  public override listExecutionTicketsByExecution(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listExecutionTicketsByExecution"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listExecutionTicketsByExecution"]> {
    return this.delegateLegacy("listExecutionTicketsByExecution", "worker", "listExecutionTicketsByExecution", ...args);
  }

  public override listExecutionTicketsByStatuses(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listExecutionTicketsByStatuses"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listExecutionTicketsByStatuses"]> {
    return this.delegateLegacy("listExecutionTicketsByStatuses", "worker", "listExecutionTicketsByStatuses", ...args);
  }

  public override listDispatchableExecutionTickets(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listDispatchableExecutionTickets"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listDispatchableExecutionTickets"]> {
    return this.delegateLegacy("listDispatchableExecutionTickets", "worker", "listDispatchableExecutionTickets", ...args);
  }

  public override getExecutionLease(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getExecutionLease"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getExecutionLease"]> {
    return this.delegateLegacyNullable("getExecutionLease", "worker", "getExecutionLease", ...args);
  }

  public override getActiveExecutionLease(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getActiveExecutionLease"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getActiveExecutionLease"]> {
    return this.delegateLegacyNullable("getActiveExecutionLease", "worker", "getActiveExecutionLease", ...args);
  }

  public override getLatestExecutionLease(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getLatestExecutionLease"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getLatestExecutionLease"]> {
    return this.delegateLegacyNullable("getLatestExecutionLease", "worker", "getLatestExecutionLease", ...args);
  }

  public override listExecutionLeases(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listExecutionLeases"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listExecutionLeases"]> {
    return this.delegateLegacy("listExecutionLeases", "worker", "listExecutionLeases", ...args);
  }

  public override listExecutionLeasesByStatuses(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listExecutionLeasesByStatuses"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listExecutionLeasesByStatuses"]> {
    return this.delegateLegacy("listExecutionLeasesByStatuses", "worker", "listExecutionLeasesByStatuses", ...args);
  }

  public override listExpiredExecutionLeases(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listExpiredExecutionLeases"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listExpiredExecutionLeases"]> {
    return this.delegateLegacy("listExpiredExecutionLeases", "worker", "listExpiredExecutionLeases", ...args);
  }

  public override getLatestFencingToken(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getLatestFencingToken"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getLatestFencingToken"]> {
    return this.delegateLegacy("getLatestFencingToken", "worker", "getLatestFencingToken", ...args);
  }

  public override listApprovalsByTask(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listApprovalsByTask"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listApprovalsByTask"]> {
    return this.delegateLegacy("listApprovalsByTask", "approval", "listApprovalsByTask", ...args);
  }

  public override getApproval(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getApproval"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getApproval"]> {
    return this.delegateLegacy("getApproval", "approval", "getApproval", ...args);
  }

  public override insertApproval(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertApproval"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertApproval"]> {
    return this.delegateLegacy("insertApproval", "approval", "insertApproval", ...args);
  }

  public override updateApprovalDecision(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["updateApprovalDecision"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["updateApprovalDecision"]> {
    return this.delegateLegacy("updateApprovalDecision", "approval", "updateApprovalDecision", ...args);
  }

  public override listTakeoverSessionsByTask(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listTakeoverSessionsByTask"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listTakeoverSessionsByTask"]> {
    return this.delegateLegacy("listTakeoverSessionsByTask", "approval", "listTakeoverSessionsByTask", ...args);
  }

  public override insertTakeoverSession(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertTakeoverSession"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertTakeoverSession"]> {
    return this.delegateLegacy("insertTakeoverSession", "approval", "insertTakeoverSession", ...args);
  }

  public override getTakeoverSession(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getTakeoverSession"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getTakeoverSession"]> {
    return this.delegateLegacy("getTakeoverSession", "approval", "getTakeoverSession", ...args);
  }

  public override closeTakeoverSession(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["closeTakeoverSession"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["closeTakeoverSession"]> {
    return this.delegateLegacy("closeTakeoverSession", "approval", "closeTakeoverSession", ...args);
  }

  public override insertOperatorAction(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertOperatorAction"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertOperatorAction"]> {
    return this.delegateLegacy("insertOperatorAction", "approval", "insertOperatorAction", ...args);
  }

  public override listOperatorActionsByTask(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listOperatorActionsByTask"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listOperatorActionsByTask"]> {
    return this.delegateLegacy("listOperatorActionsByTask", "approval", "listOperatorActionsByTask", ...args);
  }

  public override listMemories(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listMemories"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listMemories"]> {
    return this.delegateLegacy("listMemories", "memory", "listMemories", ...args);
  }

  public override insertMemory(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertMemory"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertMemory"]> {
    return this.delegateLegacy("insertMemory", "memory", "insertMemory", ...args);
  }

  public override getMemory(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getMemory"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getMemory"]> {
    return this.delegateLegacy("getMemory", "memory", "getMemory", ...args);
  }

  public override recordMemoryAccess(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["recordMemoryAccess"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["recordMemoryAccess"]> {
    return this.delegateLegacy("recordMemoryAccess", "memory", "recordMemoryAccess", ...args);
  }

  public override revokeMemory(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["revokeMemory"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["revokeMemory"]> {
    return this.delegateLegacy("revokeMemory", "memory", "revokeMemory", ...args);
  }

  public override findMemoryByContentHash(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["findMemoryByContentHash"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["findMemoryByContentHash"]> {
    return this.delegateLegacy("findMemoryByContentHash", "memory", "findMemoryByContentHash", ...args);
  }

  public override getMemoryQualityReport(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getMemoryQualityReport"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getMemoryQualityReport"]> {
    return this.delegateLegacy("getMemoryQualityReport", "memory", "getMemoryQualityReport", ...args);
  }

  public override getArtifact(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getArtifact"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getArtifact"]> {
    return this.delegateLegacy("getArtifact", "artifact", "getArtifact", ...args);
  }

  public override insertArtifact(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertArtifact"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertArtifact"]> {
    return this.delegateLegacy("insertArtifact", "artifact", "insertArtifact", ...args);
  }

  public override listArtifactsByTask(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listArtifactsByTask"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listArtifactsByTask"]> {
    return this.delegateLegacy("listArtifactsByTask", "artifact", "listArtifactsByTask", ...args);
  }

  public listEventsByType(...args: Parameters<AuthoritativeTaskStoreRepositories["event"]["listEventsByType"]>): ReturnType<AuthoritativeTaskStoreRepositories["event"]["listEventsByType"]> {
    return this.delegateRepo("event", "listEventsByType", ...args);
  }

  public insertEventConsumerAck(...args: Parameters<AuthoritativeTaskStoreRepositories["event"]["insertEventConsumerAck"]>): ReturnType<AuthoritativeTaskStoreRepositories["event"]["insertEventConsumerAck"]> {
    return this.delegateRepo("event", "insertEventConsumerAck", ...args);
  }

  public getEventConsumerAck(...args: Parameters<AuthoritativeTaskStoreRepositories["event"]["getEventConsumerAck"]>): ReturnType<AuthoritativeTaskStoreRepositories["event"]["getEventConsumerAck"]> {
    return this.delegateRepo("event", "getEventConsumerAck", ...args);
  }

  public listPendingExecutionTickets(...args: Parameters<AuthoritativeTaskStoreRepositories["worker"]["listPendingExecutionTickets"]>): ReturnType<AuthoritativeTaskStoreRepositories["worker"]["listPendingExecutionTickets"]> {
    return this.delegateRepo("worker", "listPendingExecutionTickets", ...args);
  }
}
/* c8 ignore stop */
