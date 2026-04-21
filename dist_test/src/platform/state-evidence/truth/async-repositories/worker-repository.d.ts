/**
 * AsyncWorkerRepository - Async data access for workers, tickets, leases, heartbeats, and runtime snapshots.
 */
import type { AgentExecutionRecord, CoordinatorInstanceRecord, ExecutionLeaseRecord, ExecutionTicketRecord, HeartbeatSnapshotRecord, LeaseAuditRecord, RemoteLogRecord, WorkerSnapshotRecord } from "../../../contracts/types/domain.js";
import type { AsyncSqlConnection } from "../async-sql-database.js";
export declare class AsyncWorkerRepository {
    private readonly conn;
    constructor(conn: AsyncSqlConnection);
    insertHeartbeatSnapshot(snapshot: HeartbeatSnapshotRecord): Promise<void>;
    insertRemoteLog(record: RemoteLogRecord): Promise<void>;
    upsertAgentExecutionRecord(record: AgentExecutionRecord): Promise<void>;
    upsertWorkerSnapshot(snapshot: WorkerSnapshotRecord): Promise<void>;
    upsertCoordinatorInstanceSnapshot(snapshot: CoordinatorInstanceRecord): Promise<void>;
    getWorkerSnapshot(workerId: string): Promise<WorkerSnapshotRecord | null>;
    getAgentExecutionRecord(executionId: string, tenantId?: string | null): Promise<AgentExecutionRecord | null>;
    listAgentExecutionRecordsByTask(taskId: string, tenantId?: string | null): Promise<AgentExecutionRecord[]>;
    listWorkerSnapshots(status?: string, limit?: number): Promise<WorkerSnapshotRecord[]>;
    listStaleWorkerSnapshots(heartbeatBefore: string): Promise<WorkerSnapshotRecord[]>;
    listRemoteLogsByTask(taskId: string, tenantId?: string | null): Promise<RemoteLogRecord[]>;
    listRemoteLogsByExecution(executionId: string, tenantId?: string | null): Promise<RemoteLogRecord[]>;
    listHeartbeatSnapshotsByExecution(executionId: string): Promise<HeartbeatSnapshotRecord[]>;
    insertExecutionTicket(ticket: ExecutionTicketRecord): Promise<void>;
    claimExecutionTicket(input: {
        ticketId: string;
        assignedWorkerId: string;
        leaseId: string;
        claimedAt: string;
    }): Promise<void>;
    consumeExecutionTicket(ticketId: string, consumedAt: string): Promise<void>;
    invalidateExecutionTicket(input: {
        ticketId: string;
        status: Extract<ExecutionTicketRecord["status"], "cancelled" | "expired">;
        invalidatedAt: string;
    }): Promise<void>;
    listPendingExecutionTickets(queueName?: string, limit?: number): Promise<ExecutionTicketRecord[]>;
    getExecutionTicket(ticketId: string): Promise<ExecutionTicketRecord | null>;
    getActiveExecutionTicket(executionId: string, attempt: number): Promise<ExecutionTicketRecord | null>;
    listExecutionTicketsByExecution(executionId: string): Promise<ExecutionTicketRecord[]>;
    insertExecutionLease(lease: ExecutionLeaseRecord): Promise<void>;
    renewExecutionLease(leaseId: string, expiresAt: string, lastHeartbeatAt?: string): Promise<void>;
    closeExecutionLease(input: {
        leaseId: string;
        status: ExecutionLeaseRecord["status"];
        releasedAt: string;
        reasonCode: string | null;
    }): Promise<void>;
    insertLeaseAudit(audit: LeaseAuditRecord): Promise<void>;
    getExecutionLease(leaseId: string): Promise<ExecutionLeaseRecord | null>;
    getActiveExecutionLease(executionId: string): Promise<ExecutionLeaseRecord | null>;
    getLatestExecutionLease(executionId: string): Promise<ExecutionLeaseRecord | null>;
    listExecutionLeases(executionId: string): Promise<ExecutionLeaseRecord[]>;
    listExpiredExecutionLeases(now: string): Promise<ExecutionLeaseRecord[]>;
    getLatestFencingToken(executionId: string): Promise<number>;
}
