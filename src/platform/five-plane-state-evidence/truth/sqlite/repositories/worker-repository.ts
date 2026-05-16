/**
 * WorkerRepository - Data access for workers, tickets, leases, heartbeats, and runtime snapshots.
 *
 * This class keeps the legacy repository surface while delegating to smaller
 * repositories grouped by concern.
 */

import type {
  AgentExecutionRecord,
  CoordinatorInstanceRecord,
  ExecutionTicketRecord,
  HeartbeatSnapshotRecord,
  LeaseAuditRecord,
  RemoteLogRecord,
  WorkerRegistrationChallengeRecord,
  WorkerSnapshotRecord,
  ExecutionLeaseRecord,
} from "../sqlite-repository-contracts.js";
import type { SqliteConnection } from "../query-helper.js";
import { AgentExecutionRepository } from "./agent-execution-repository.js";
import { ExecutionTicketRepository } from "./execution-ticket-repository.js";
import { WorkerSnapshotRepository } from "./worker-snapshot-repository.js";

export class WorkerRepository {
  private readonly snapshotRepo: WorkerSnapshotRepository;
  private readonly executionRepo: AgentExecutionRepository;
  private readonly ticketRepo: ExecutionTicketRepository;

  public constructor(conn: SqliteConnection) {
    this.snapshotRepo = new WorkerSnapshotRepository(conn);
    this.executionRepo = new AgentExecutionRepository(conn);
    this.ticketRepo = new ExecutionTicketRepository(conn);
  }

  public insertHeartbeatSnapshot(snapshot: HeartbeatSnapshotRecord): void {
    this.snapshotRepo.insertHeartbeatSnapshot(snapshot);
  }

  public upsertWorkerSnapshot(snapshot: WorkerSnapshotRecord): void {
    this.snapshotRepo.upsertWorkerSnapshot(snapshot);
  }

  public upsertCoordinatorInstanceSnapshot(snapshot: CoordinatorInstanceRecord): void {
    this.snapshotRepo.upsertCoordinatorInstanceSnapshot(snapshot);
  }

  public getWorkerSnapshot(workerId: string): WorkerSnapshotRecord | undefined {
    return this.snapshotRepo.getWorkerSnapshot(workerId);
  }

  public listWorkerSnapshots(status?: string, limit?: number): WorkerSnapshotRecord[] {
    return this.snapshotRepo.listWorkerSnapshots(status, limit);
  }

  public listStaleWorkerSnapshots(heartbeatBefore: string): WorkerSnapshotRecord[] {
    return this.snapshotRepo.listStaleWorkerSnapshots(heartbeatBefore);
  }

  public getCoordinatorInstanceSnapshot(coordinatorId: string): CoordinatorInstanceRecord | undefined {
    return this.snapshotRepo.getCoordinatorInstanceSnapshot(coordinatorId);
  }

  public listCoordinatorInstanceSnapshots(limit = 100): CoordinatorInstanceRecord[] {
    return this.snapshotRepo.listCoordinatorInstanceSnapshots(limit);
  }

  public listHeartbeatSnapshotsByExecution(executionId: string, tenantId?: string | null): HeartbeatSnapshotRecord[] {
    return this.snapshotRepo.listHeartbeatSnapshotsByExecution(executionId, tenantId);
  }

  public insertRemoteLog(record: RemoteLogRecord): void {
    this.executionRepo.insertRemoteLog(record);
  }

  public upsertAgentExecutionRecord(record: AgentExecutionRecord): void {
    this.executionRepo.upsertAgentExecutionRecord(record);
  }

  public getAgentExecutionRecord(executionId: string, tenantId?: string | null): AgentExecutionRecord | undefined {
    return this.executionRepo.getAgentExecutionRecord(executionId, tenantId);
  }

  public listAgentExecutionRecordsByTask(taskId: string, tenantId?: string | null): AgentExecutionRecord[] {
    return this.executionRepo.listAgentExecutionRecordsByTask(taskId, tenantId);
  }

  public listRemoteLogsByTask(taskId: string, tenantId?: string | null): RemoteLogRecord[] {
    return this.executionRepo.listRemoteLogsByTask(taskId, tenantId);
  }

  public listRemoteLogsByExecution(executionId: string, tenantId?: string | null): RemoteLogRecord[] {
    return this.executionRepo.listRemoteLogsByExecution(executionId, tenantId);
  }

  public insertWorkerRegistrationChallenge(record: WorkerRegistrationChallengeRecord): void {
    this.ticketRepo.insertWorkerRegistrationChallenge(record);
  }

  public getWorkerRegistrationChallenge(challengeId: string): WorkerRegistrationChallengeRecord | undefined {
    return this.ticketRepo.getWorkerRegistrationChallenge(challengeId);
  }

  public consumeWorkerRegistrationChallenge(challengeId: string, usedAt: string): void {
    this.ticketRepo.consumeWorkerRegistrationChallenge(challengeId, usedAt);
  }

  public insertExecutionTicket(ticket: ExecutionTicketRecord): void {
    this.ticketRepo.insertExecutionTicket(ticket);
  }

  public claimExecutionTicket(ticketId: string, assignedWorkerId: string, claimedAt: string): void;
  public claimExecutionTicket(input: {
    ticketId: string;
    assignedWorkerId: string;
    leaseId: string;
    claimedAt: string;
  }): void;
  public claimExecutionTicket(
    ticketIdOrInput:
      | string
      | {
          ticketId: string;
          assignedWorkerId: string;
          leaseId: string;
          claimedAt: string;
        },
    assignedWorkerId?: string,
    claimedAt?: string,
  ): void {
    if (typeof ticketIdOrInput === "string") {
      this.ticketRepo.claimExecutionTicket(ticketIdOrInput, assignedWorkerId ?? "", claimedAt ?? "");
      return;
    }
    this.ticketRepo.claimExecutionTicket(ticketIdOrInput);
  }

  public consumeExecutionTicket(ticketId: string, consumedAt: string): void {
    this.ticketRepo.consumeExecutionTicket(ticketId, consumedAt);
  }

  public invalidateExecutionTicket(ticketId: string, invalidatedAt: string): void;
  public invalidateExecutionTicket(input: {
    ticketId: string;
    status: Extract<ExecutionTicketRecord["status"], "cancelled" | "expired">;
    invalidatedAt: string;
  }): void;
  public invalidateExecutionTicket(
    ticketIdOrInput:
      | string
      | {
          ticketId: string;
          status: Extract<ExecutionTicketRecord["status"], "cancelled" | "expired">;
          invalidatedAt: string;
        },
    invalidatedAt?: string,
  ): void {
    if (typeof ticketIdOrInput === "string") {
      this.ticketRepo.invalidateExecutionTicket(ticketIdOrInput, invalidatedAt ?? "");
      return;
    }
    this.ticketRepo.invalidateExecutionTicket(ticketIdOrInput);
  }

  public listPendingExecutionTickets(queueName?: string, limit?: number): ExecutionTicketRecord[] {
    return this.ticketRepo.listPendingExecutionTickets(queueName, limit);
  }

  public getExecutionTicket(ticketId: string): ExecutionTicketRecord | undefined {
    return this.ticketRepo.getExecutionTicket(ticketId);
  }

  public getActiveExecutionTicket(executionId: string, attempt: number): ExecutionTicketRecord | undefined {
    return this.ticketRepo.getActiveExecutionTicket(executionId, attempt);
  }

  public listExecutionTicketsByExecution(executionId: string): ExecutionTicketRecord[] {
    return this.ticketRepo.listExecutionTicketsByExecution(executionId);
  }

  public listExecutionTicketsByStatuses(statuses: ExecutionTicketRecord["status"][]): ExecutionTicketRecord[] {
    return this.ticketRepo.listExecutionTicketsByStatuses(statuses);
  }

  public listDispatchableExecutionTickets(now: string, queueName: string | null = null): ExecutionTicketRecord[] {
    return this.ticketRepo.listDispatchableExecutionTickets(now, queueName);
  }

  public insertExecutionLease(lease: ExecutionLeaseRecord): void {
    this.ticketRepo.insertExecutionLease(lease);
  }

  public renewExecutionLease(leaseId: string, expiresAt: string): void;
  public renewExecutionLease(leaseId: string, expiresAt: string, lastHeartbeatAt: string): void;
  public renewExecutionLease(leaseId: string, expiresAt: string, lastHeartbeatAt?: string): void {
    return this.ticketRepo.renewExecutionLease(leaseId, expiresAt, lastHeartbeatAt);
  }

  public closeExecutionLease(leaseId: string, releasedAt: string): void;
  public closeExecutionLease(input: {
    leaseId: string;
    status: ExecutionLeaseRecord["status"];
    releasedAt: string;
    reasonCode: string | null;
  }): void;
  public closeExecutionLease(
    leaseIdOrInput:
      | string
      | {
          leaseId: string;
          status: ExecutionLeaseRecord["status"];
          releasedAt: string;
          reasonCode: string | null;
        },
    releasedAt?: string,
  ): void {
    if (typeof leaseIdOrInput === "string") {
      this.ticketRepo.closeExecutionLease(leaseIdOrInput, releasedAt ?? "");
      return;
    }
    this.ticketRepo.closeExecutionLease(leaseIdOrInput);
  }

  public insertLeaseAudit(audit: LeaseAuditRecord): void {
    this.ticketRepo.insertLeaseAudit(audit);
  }

  public getExecutionLease(leaseId: string): ExecutionLeaseRecord | undefined {
    return this.ticketRepo.getExecutionLease(leaseId);
  }

  public getActiveExecutionLease(executionId: string): ExecutionLeaseRecord | undefined {
    return this.ticketRepo.getActiveExecutionLease(executionId);
  }

  public getLatestExecutionLease(executionId: string): ExecutionLeaseRecord | undefined {
    return this.ticketRepo.getLatestExecutionLease(executionId);
  }

  public listExecutionLeases(executionId: string): ExecutionLeaseRecord[] {
    return this.ticketRepo.listExecutionLeases(executionId);
  }

  public listLeasesByExecution(executionId: string): ExecutionLeaseRecord[] {
    return this.listExecutionLeases(executionId);
  }

  public listLeasesByWorker(workerId: string): ExecutionLeaseRecord[] {
    return this.ticketRepo.listLeasesByWorker(workerId);
  }

  public listExecutionLeasesByStatuses(statuses: ExecutionLeaseRecord["status"][]): ExecutionLeaseRecord[] {
    return this.ticketRepo.listExecutionLeasesByStatuses(statuses);
  }

  public listExpiredExecutionLeases(now: string): ExecutionLeaseRecord[] {
    return this.ticketRepo.listExpiredExecutionLeases(now);
  }

  public getLatestFencingToken(executionId: string): number {
    return this.ticketRepo.getLatestFencingToken(executionId);
  }
}
