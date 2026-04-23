/**
 * WorkerRepository - Data access for workers, tickets, leases, heartbeats, and runtime snapshots.
 *
 * This class keeps the legacy repository surface while delegating to smaller
 * repositories grouped by concern.
 */
import { AgentExecutionRepository } from "./agent-execution-repository.js";
import { ExecutionTicketRepository } from "./execution-ticket-repository.js";
import { WorkerSnapshotRepository } from "./worker-snapshot-repository.js";
export class WorkerRepository {
    snapshotRepo;
    executionRepo;
    ticketRepo;
    constructor(conn) {
        this.snapshotRepo = new WorkerSnapshotRepository(conn);
        this.executionRepo = new AgentExecutionRepository(conn);
        this.ticketRepo = new ExecutionTicketRepository(conn);
    }
    insertHeartbeatSnapshot(snapshot) {
        this.snapshotRepo.insertHeartbeatSnapshot(snapshot);
    }
    upsertWorkerSnapshot(snapshot) {
        this.snapshotRepo.upsertWorkerSnapshot(snapshot);
    }
    upsertCoordinatorInstanceSnapshot(snapshot) {
        this.snapshotRepo.upsertCoordinatorInstanceSnapshot(snapshot);
    }
    getWorkerSnapshot(workerId) {
        return this.snapshotRepo.getWorkerSnapshot(workerId);
    }
    listWorkerSnapshots(status, limit) {
        return this.snapshotRepo.listWorkerSnapshots(status, limit);
    }
    listStaleWorkerSnapshots(heartbeatBefore) {
        return this.snapshotRepo.listStaleWorkerSnapshots(heartbeatBefore);
    }
    getCoordinatorInstanceSnapshot(coordinatorId) {
        return this.snapshotRepo.getCoordinatorInstanceSnapshot(coordinatorId);
    }
    listCoordinatorInstanceSnapshots(limit = 100) {
        return this.snapshotRepo.listCoordinatorInstanceSnapshots(limit);
    }
    listHeartbeatSnapshotsByExecution(executionId, tenantId) {
        return this.snapshotRepo.listHeartbeatSnapshotsByExecution(executionId, tenantId);
    }
    insertRemoteLog(record) {
        this.executionRepo.insertRemoteLog(record);
    }
    upsertAgentExecutionRecord(record) {
        this.executionRepo.upsertAgentExecutionRecord(record);
    }
    getAgentExecutionRecord(executionId, tenantId) {
        return this.executionRepo.getAgentExecutionRecord(executionId, tenantId);
    }
    listAgentExecutionRecordsByTask(taskId, tenantId) {
        return this.executionRepo.listAgentExecutionRecordsByTask(taskId, tenantId);
    }
    listRemoteLogsByTask(taskId, tenantId) {
        return this.executionRepo.listRemoteLogsByTask(taskId, tenantId);
    }
    listRemoteLogsByExecution(executionId, tenantId) {
        return this.executionRepo.listRemoteLogsByExecution(executionId, tenantId);
    }
    insertWorkerRegistrationChallenge(record) {
        this.ticketRepo.insertWorkerRegistrationChallenge(record);
    }
    getWorkerRegistrationChallenge(challengeId) {
        return this.ticketRepo.getWorkerRegistrationChallenge(challengeId);
    }
    consumeWorkerRegistrationChallenge(challengeId, usedAt) {
        this.ticketRepo.consumeWorkerRegistrationChallenge(challengeId, usedAt);
    }
    insertExecutionTicket(ticket) {
        this.ticketRepo.insertExecutionTicket(ticket);
    }
    claimExecutionTicket(ticketIdOrInput, assignedWorkerId, claimedAt) {
        if (typeof ticketIdOrInput === "string") {
            this.ticketRepo.claimExecutionTicket(ticketIdOrInput, assignedWorkerId ?? "", claimedAt ?? "");
            return;
        }
        this.ticketRepo.claimExecutionTicket(ticketIdOrInput);
    }
    consumeExecutionTicket(ticketId, consumedAt) {
        this.ticketRepo.consumeExecutionTicket(ticketId, consumedAt);
    }
    invalidateExecutionTicket(ticketIdOrInput, invalidatedAt) {
        if (typeof ticketIdOrInput === "string") {
            this.ticketRepo.invalidateExecutionTicket(ticketIdOrInput, invalidatedAt ?? "");
            return;
        }
        this.ticketRepo.invalidateExecutionTicket(ticketIdOrInput);
    }
    listPendingExecutionTickets(queueName, limit) {
        return this.ticketRepo.listPendingExecutionTickets(queueName, limit);
    }
    getExecutionTicket(ticketId) {
        return this.ticketRepo.getExecutionTicket(ticketId);
    }
    getActiveExecutionTicket(executionId, attempt) {
        return this.ticketRepo.getActiveExecutionTicket(executionId, attempt);
    }
    listExecutionTicketsByExecution(executionId) {
        return this.ticketRepo.listExecutionTicketsByExecution(executionId);
    }
    listExecutionTicketsByStatuses(statuses) {
        return this.ticketRepo.listExecutionTicketsByStatuses(statuses);
    }
    listDispatchableExecutionTickets(now, queueName = null) {
        return this.ticketRepo.listDispatchableExecutionTickets(now, queueName);
    }
    insertExecutionLease(lease) {
        this.ticketRepo.insertExecutionLease(lease);
    }
    renewExecutionLease(leaseId, expiresAt, lastHeartbeatAt) {
        return this.ticketRepo.renewExecutionLease(leaseId, expiresAt, lastHeartbeatAt);
    }
    closeExecutionLease(leaseIdOrInput, releasedAt) {
        if (typeof leaseIdOrInput === "string") {
            this.ticketRepo.closeExecutionLease(leaseIdOrInput, releasedAt ?? "");
            return;
        }
        this.ticketRepo.closeExecutionLease(leaseIdOrInput);
    }
    insertLeaseAudit(audit) {
        this.ticketRepo.insertLeaseAudit(audit);
    }
    getExecutionLease(leaseId) {
        return this.ticketRepo.getExecutionLease(leaseId);
    }
    getActiveExecutionLease(executionId) {
        return this.ticketRepo.getActiveExecutionLease(executionId);
    }
    getLatestExecutionLease(executionId) {
        return this.ticketRepo.getLatestExecutionLease(executionId);
    }
    listExecutionLeases(executionId) {
        return this.ticketRepo.listExecutionLeases(executionId);
    }
    listExecutionLeasesByStatuses(statuses) {
        return this.ticketRepo.listExecutionLeasesByStatuses(statuses);
    }
    listExpiredExecutionLeases(now) {
        return this.ticketRepo.listExpiredExecutionLeases(now);
    }
    getLatestFencingToken(executionId) {
        return this.ticketRepo.getLatestFencingToken(executionId);
    }
}
//# sourceMappingURL=worker-repository.js.map