/**
 * WorkerRepository - Data access for workers, tickets, leases, heartbeats, and runtime snapshots.
 *
 * This class keeps the legacy repository surface while delegating to smaller
 * repositories grouped by concern.
 */
import type { AgentExecutionRecord, CoordinatorInstanceRecord, ExecutionTicketRecord, HeartbeatSnapshotRecord, LeaseAuditRecord, RemoteLogRecord, WorkerRegistrationChallengeRecord, WorkerSnapshotRecord } from "../../../../contracts/types/domain.js";
import type { ExecutionLeaseRecord } from "../../../../contracts/types/domain.js";
import type { SqliteConnection } from "../query-helper.js";
export declare class WorkerRepository {
    private readonly snapshotRepo;
    private readonly executionRepo;
    private readonly ticketRepo;
    constructor(conn: SqliteConnection);
    insertHeartbeatSnapshot(snapshot: HeartbeatSnapshotRecord): void;
    upsertWorkerSnapshot(snapshot: WorkerSnapshotRecord): void;
    upsertCoordinatorInstanceSnapshot(snapshot: CoordinatorInstanceRecord): void;
    getWorkerSnapshot(workerId: string): WorkerSnapshotRecord | undefined;
    listWorkerSnapshots(status?: string, limit?: number): WorkerSnapshotRecord[];
    listStaleWorkerSnapshots(heartbeatBefore: string): WorkerSnapshotRecord[];
    getCoordinatorInstanceSnapshot(coordinatorId: string): CoordinatorInstanceRecord | undefined;
    listCoordinatorInstanceSnapshots(limit?: number): CoordinatorInstanceRecord[];
    listHeartbeatSnapshotsByExecution(executionId: string, tenantId?: string | null): HeartbeatSnapshotRecord[];
    insertRemoteLog(record: RemoteLogRecord): void;
    upsertAgentExecutionRecord(record: AgentExecutionRecord): void;
    getAgentExecutionRecord(executionId: string, tenantId?: string | null): AgentExecutionRecord | undefined;
    listAgentExecutionRecordsByTask(taskId: string, tenantId?: string | null): AgentExecutionRecord[];
    listRemoteLogsByTask(taskId: string, tenantId?: string | null): RemoteLogRecord[];
    listRemoteLogsByExecution(executionId: string, tenantId?: string | null): RemoteLogRecord[];
    insertWorkerRegistrationChallenge(record: WorkerRegistrationChallengeRecord): void;
    getWorkerRegistrationChallenge(challengeId: string): WorkerRegistrationChallengeRecord | undefined;
    consumeWorkerRegistrationChallenge(challengeId: string, usedAt: string): void;
    insertExecutionTicket(ticket: ExecutionTicketRecord): void;
    claimExecutionTicket(ticketId: string, assignedWorkerId: string, claimedAt: string): void;
    claimExecutionTicket(input: {
        ticketId: string;
        assignedWorkerId: string;
        leaseId: string;
        claimedAt: string;
    }): void;
    consumeExecutionTicket(ticketId: string, consumedAt: string): void;
    invalidateExecutionTicket(ticketId: string, invalidatedAt: string): void;
    invalidateExecutionTicket(input: {
        ticketId: string;
        status: Extract<ExecutionTicketRecord["status"], "cancelled" | "expired">;
        invalidatedAt: string;
    }): void;
    listPendingExecutionTickets(queueName?: string, limit?: number): ExecutionTicketRecord[];
    getExecutionTicket(ticketId: string): ExecutionTicketRecord | undefined;
    getActiveExecutionTicket(executionId: string, attempt: number): ExecutionTicketRecord | undefined;
    listExecutionTicketsByExecution(executionId: string): ExecutionTicketRecord[];
    listExecutionTicketsByStatuses(statuses: ExecutionTicketRecord["status"][]): ExecutionTicketRecord[];
    listDispatchableExecutionTickets(now: string, queueName?: string | null): ExecutionTicketRecord[];
    insertExecutionLease(lease: ExecutionLeaseRecord): void;
    renewExecutionLease(leaseId: string, expiresAt: string): void;
    renewExecutionLease(leaseId: string, expiresAt: string, lastHeartbeatAt: string): void;
    closeExecutionLease(leaseId: string, releasedAt: string): void;
    closeExecutionLease(input: {
        leaseId: string;
        status: ExecutionLeaseRecord["status"];
        releasedAt: string;
        reasonCode: string | null;
    }): void;
    insertLeaseAudit(audit: LeaseAuditRecord): void;
    getExecutionLease(leaseId: string): ExecutionLeaseRecord | undefined;
    getActiveExecutionLease(executionId: string): ExecutionLeaseRecord | undefined;
    getLatestExecutionLease(executionId: string): ExecutionLeaseRecord | undefined;
    listExecutionLeases(executionId: string): ExecutionLeaseRecord[];
    listExecutionLeasesByStatuses(statuses: ExecutionLeaseRecord["status"][]): ExecutionLeaseRecord[];
    listExpiredExecutionLeases(now: string): ExecutionLeaseRecord[];
    getLatestFencingToken(executionId: string): number;
}
