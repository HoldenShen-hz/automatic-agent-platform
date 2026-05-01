import type {
  ExecutionLeaseRecord,
  ExecutionTicketRecord,
  LeaseAuditRecord,
  WorkerRegistrationChallengeRecord,
} from "../../../../contracts/types/domain.js";
import { execute, queryAll, queryOne, type SqliteConnection } from "../query-helper.js";

const EXECUTION_TICKET_SELECT = `SELECT
  id,
  execution_id AS "executionId",
  task_id AS "taskId",
  priority,
  queue_name AS "queueName",
  dispatch_target AS "dispatchTarget",
  required_isolation_level AS "requiredIsolationLevel",
  required_repo_version AS "requiredRepoVersion",
  required_capabilities_json AS "requiredCapabilitiesJson",
  dispatch_after AS "dispatchAfter",
  attempt,
  status,
  assigned_worker_id AS "assignedWorkerId",
  lease_id AS "leaseId",
  claimed_at AS "claimedAt",
  consumed_at AS "consumedAt",
  invalidated_at AS "invalidatedAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
 FROM execution_tickets`;

const EXECUTION_LEASE_SELECT = `SELECT
  id,
  execution_id AS "executionId",
  worker_id AS "workerId",
  attempt,
  fencing_token AS "fencingToken",
  queue_name AS "queueName",
  status,
  leased_at AS "leasedAt",
  expires_at AS "expiresAt",
  last_heartbeat_at AS "lastHeartbeatAt",
  released_at AS "releasedAt",
  reason_code AS "reasonCode"
 FROM execution_leases`;

export class ExecutionTicketRepository {
  public constructor(private readonly conn: SqliteConnection) {}

  public insertWorkerRegistrationChallenge(record: WorkerRegistrationChallengeRecord): void {
    execute(
      this.conn,
      `INSERT INTO worker_registration_challenges (
        id, worker_id, challenge_token_hash, allowed_capabilities_json, expires_at, used_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      record.id,
      record.workerId,
      record.challengeTokenHash,
      record.allowedCapabilitiesJson,
      record.expiresAt,
      record.usedAt,
      record.createdAt,
    );
  }

  public getWorkerRegistrationChallenge(challengeId: string): WorkerRegistrationChallengeRecord | undefined {
    return queryOne<WorkerRegistrationChallengeRecord>(
      this.conn,
      `SELECT
        id,
        worker_id AS "workerId",
        challenge_token_hash AS "challengeTokenHash",
        allowed_capabilities_json AS "allowedCapabilitiesJson",
        expires_at AS "expiresAt",
        used_at AS "usedAt",
        created_at AS "createdAt"
       FROM worker_registration_challenges
       WHERE id = ?`,
      challengeId,
    );
  }

  public consumeWorkerRegistrationChallenge(challengeId: string, usedAt: string): void {
    execute(
      this.conn,
      `UPDATE worker_registration_challenges
       SET used_at = ?
       WHERE id = ?`,
      usedAt,
      challengeId,
    );
  }

  public insertExecutionTicket(ticket: ExecutionTicketRecord): void {
    this.ensureExecutionForLegacyTicket(ticket);
    const requiredCapabilitiesJson = ticket.requiredCapabilitiesJson ?? "[]";
    execute(
      this.conn,
      `INSERT INTO execution_tickets (
        id, execution_id, task_id, priority, queue_name, dispatch_target,
        required_isolation_level, required_repo_version, required_capabilities_json,
        dispatch_after, attempt, status, assigned_worker_id, lease_id, claimed_at,
        consumed_at, invalidated_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ticket.id,
      ticket.executionId,
      ticket.taskId,
      ticket.priority,
      ticket.queueName,
      ticket.dispatchTarget ?? "any",
      ticket.requiredIsolationLevel ?? "standard",
      ticket.requiredRepoVersion ?? null,
      requiredCapabilitiesJson,
      ticket.dispatchAfter ?? null,
      ticket.attempt ?? 1,
      ticket.status,
      ticket.assignedWorkerId ?? null,
      ticket.leaseId ?? null,
      ticket.claimedAt ?? null,
      ticket.consumedAt ?? null,
      ticket.invalidatedAt ?? null,
      ticket.createdAt,
      ticket.updatedAt,
    );
  }

  private ensureExecutionForLegacyTicket(ticket: ExecutionTicketRecord): void {
    const existing = queryOne<{ id: string }>(
      this.conn,
      "SELECT id FROM executions WHERE id = ?",
      ticket.executionId,
    );
    if (existing) {
      return;
    }

    execute(
      this.conn,
      `INSERT INTO executions (
        id, task_id, workflow_id, parent_execution_id, agent_id, role_id,
        run_kind, status, input_ref, trace_id, attempt, timeout_ms,
        budget_usd_limit, requires_approval, sandbox_mode, allowed_tools_json,
        allowed_paths_json, max_retries, retry_backoff, last_error_code,
        last_error_message, started_at, finished_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ticket.executionId,
      ticket.taskId,
      null,
      null,
      "legacy-ticket-dispatcher",
      "general_executor",
      "task_run",
      "created",
      null,
      `trace:${ticket.executionId}`,
      ticket.attempt ?? 1,
      0,
      null,
      0,
      "workspace_write",
      "[]",
      "[]",
      0,
      "none",
      null,
      null,
      null,
      null,
      ticket.createdAt,
      ticket.updatedAt,
    );
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
    const input =
      typeof ticketIdOrInput === "string"
        ? {
            ticketId: ticketIdOrInput,
            assignedWorkerId: assignedWorkerId ?? "",
            leaseId: null,
            claimedAt: claimedAt ?? "",
          }
        : ticketIdOrInput;
    execute(
      this.conn,
      `UPDATE execution_tickets
       SET status = 'claimed',
           assigned_worker_id = ?,
           lease_id = COALESCE(?, lease_id),
           claimed_at = ?,
           updated_at = ?
       WHERE id = ?
         AND status = 'pending'`,
      input.assignedWorkerId,
      input.leaseId,
      input.claimedAt,
      input.claimedAt,
      input.ticketId,
    );
  }

  public consumeExecutionTicket(ticketId: string, consumedAt: string): void {
    execute(
      this.conn,
      `UPDATE execution_tickets
       SET status = 'consumed',
           consumed_at = ?,
           updated_at = ?
       WHERE id = ?`,
      consumedAt,
      consumedAt,
      ticketId,
    );
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
    const input =
      typeof ticketIdOrInput === "string"
        ? {
            ticketId: ticketIdOrInput,
            status: "cancelled" as const,
            invalidatedAt: invalidatedAt ?? "",
          }
        : ticketIdOrInput;
    execute(
      this.conn,
      `UPDATE execution_tickets
       SET status = ?,
           invalidated_at = ?,
           updated_at = ?
       WHERE id = ?`,
      input.status,
      input.invalidatedAt,
      input.invalidatedAt,
      input.ticketId,
    );
  }

  public listPendingExecutionTickets(queueName?: string, limit?: number): ExecutionTicketRecord[] {
    const params: Array<string | number> = [];
    let sql = `${EXECUTION_TICKET_SELECT}
      WHERE status = 'pending'
        AND (dispatch_after IS NULL OR dispatch_after <= strftime('%Y-%m-%dT%H:%M:%SZ', 'now', 'utc'))`;
    if (queueName != null) {
      sql += " AND queue_name = ?";
      params.push(queueName);
    }
    sql += " ORDER BY priority DESC, created_at ASC";
    if (limit != null) {
      sql += " LIMIT ?";
      params.push(limit);
    }
    return queryAll<ExecutionTicketRecord>(this.conn, sql, ...params);
  }

  public getExecutionTicket(ticketId: string): ExecutionTicketRecord | undefined {
    return queryOne<ExecutionTicketRecord>(
      this.conn,
      `${EXECUTION_TICKET_SELECT}
       WHERE id = ?`,
      ticketId,
    );
  }

  public getActiveExecutionTicket(executionId: string, attempt: number): ExecutionTicketRecord | undefined {
    return queryOne<ExecutionTicketRecord>(
      this.conn,
      `${EXECUTION_TICKET_SELECT}
       WHERE execution_id = ?
         AND attempt = ?
         AND status IN ('pending', 'claimed')
       ORDER BY created_at ASC
       LIMIT 1`,
      executionId,
      attempt,
    );
  }

  public listExecutionTicketsByExecution(executionId: string): ExecutionTicketRecord[] {
    return queryAll<ExecutionTicketRecord>(
      this.conn,
      `${EXECUTION_TICKET_SELECT}
       WHERE execution_id = ?
       ORDER BY created_at ASC, id ASC`,
      executionId,
    );
  }

  public listExecutionTicketsByStatuses(statuses: ExecutionTicketRecord["status"][]): ExecutionTicketRecord[] {
    if (statuses.length === 0) {
      return [];
    }
    const placeholders = statuses.map(() => "?").join(", ");
    return queryAll<ExecutionTicketRecord>(
      this.conn,
      `${EXECUTION_TICKET_SELECT}
       WHERE status IN (${placeholders})
       ORDER BY created_at ASC, id ASC`,
      ...statuses,
    );
  }

  // Issue #1910 P1: Paginated version for large-scale reconciliation to prevent OOM
  public listExecutionTicketsByStatusesPaginated(
    statuses: ExecutionTicketRecord["status"][],
    limit: number,
    offset: number,
  ): ExecutionTicketRecord[] {
    if (statuses.length === 0) {
      return [];
    }
    const placeholders = statuses.map(() => "?").join(", ");
    return queryAll<ExecutionTicketRecord>(
      this.conn,
      `${EXECUTION_TICKET_SELECT}
       WHERE status IN (${placeholders})
       ORDER BY created_at ASC, id ASC
       LIMIT ? OFFSET ?`,
      ...statuses,
      limit,
      offset,
    );
  }

  // R6-4: Deterministic graph scheduler per §14.9
  // Orders by priority/risk_class/critical_path_rank/created_order/scheduler_seed
  // Note: critical_path_rank and scheduler_seed fields require schema migration
  // For now, uses available fields: priority DESC, created_at ASC, id ASC (stable sort)
  //
  // R13-14 fix: Priority is lexicographically sorted but should be semantic (critical > high > normal > low).
  // SQLite's CASE expression maps priority strings to numeric values for correct ordering.
  public listDispatchableExecutionTickets(now: string, queueName: string | null = null): ExecutionTicketRecord[] {
    const params: Array<string | number> = [now];
    let sql = `${EXECUTION_TICKET_SELECT}
      WHERE status = 'pending'
        AND (dispatch_after IS NULL OR dispatch_after <= ?)`;
    if (queueName != null) {
      sql += " AND queue_name = ?";
      params.push(queueName);
    }
    // R6-4: Deterministic ordering - add id ASC for stable sort when priorities match
    // Full §14.9 ordering (critical_path_rank, scheduler_seed) requires schema migration
    // R13-14 fix: Use CASE expression for semantic priority ordering (critical=4, high=3, normal=2, low=1)
    sql += " ORDER BY CASE priority WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'normal' THEN 2 WHEN 'low' THEN 1 ELSE 0 END DESC, created_at ASC, id ASC";
    return queryAll<ExecutionTicketRecord>(this.conn, sql, ...params);
  }

  public insertExecutionLease(lease: ExecutionLeaseRecord): void {
    execute(
      this.conn,
      `INSERT INTO execution_leases (
        id, execution_id, worker_id, attempt, fencing_token, queue_name, status,
        leased_at, expires_at, last_heartbeat_at, released_at, reason_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      lease.id,
      lease.executionId,
      lease.workerId,
      lease.attempt,
      lease.fencingToken,
      lease.queueName,
      lease.status,
      lease.leasedAt,
      lease.expiresAt,
      lease.lastHeartbeatAt,
      lease.releasedAt,
      lease.reasonCode,
    );
  }

  public renewExecutionLease(leaseId: string, expiresAt: string, lastHeartbeatAt?: string): void {
    execute(
      this.conn,
      `UPDATE execution_leases
       SET expires_at = ?,
           last_heartbeat_at = COALESCE(?, last_heartbeat_at)
       WHERE id = ?`,
      expiresAt,
      lastHeartbeatAt ?? null,
      leaseId,
    );
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
    const input =
      typeof leaseIdOrInput === "string"
        ? {
            leaseId: leaseIdOrInput,
            status: "released" as const,
            releasedAt: releasedAt ?? "",
            reasonCode: null,
          }
        : leaseIdOrInput;
    execute(
      this.conn,
      `UPDATE execution_leases
       SET status = ?,
           released_at = ?,
           reason_code = ?
       WHERE id = ?`,
      input.status,
      input.releasedAt,
      input.reasonCode,
      input.leaseId,
    );
  }

  public insertLeaseAudit(audit: LeaseAuditRecord): void {
    execute(
      this.conn,
      `INSERT INTO lease_audits (
        id, execution_id, lease_id, worker_id, fencing_token, event_type, reason_code, recorded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      audit.id,
      audit.executionId,
      audit.leaseId,
      audit.workerId,
      audit.fencingToken,
      audit.eventType,
      audit.reasonCode,
      audit.recordedAt,
    );
  }

  public getExecutionLease(leaseId: string): ExecutionLeaseRecord | undefined {
    return queryOne<ExecutionLeaseRecord>(
      this.conn,
      `${EXECUTION_LEASE_SELECT}
       WHERE id = ?`,
      leaseId,
    );
  }

  public getActiveExecutionLease(executionId: string): ExecutionLeaseRecord | undefined {
    return queryOne<ExecutionLeaseRecord>(
      this.conn,
      `${EXECUTION_LEASE_SELECT}
       WHERE execution_id = ?
         AND status = 'active'`,
      executionId,
    );
  }

  public getLatestExecutionLease(executionId: string): ExecutionLeaseRecord | undefined {
    return queryOne<ExecutionLeaseRecord>(
      this.conn,
      `${EXECUTION_LEASE_SELECT}
       WHERE execution_id = ?
       ORDER BY fencing_token DESC
       LIMIT 1`,
      executionId,
    );
  }

  public listExecutionLeases(executionId: string): ExecutionLeaseRecord[] {
    return queryAll<ExecutionLeaseRecord>(
      this.conn,
      `${EXECUTION_LEASE_SELECT}
       WHERE execution_id = ?
       ORDER BY fencing_token ASC`,
      executionId,
    );
  }

  public listLeasesByWorker(workerId: string): ExecutionLeaseRecord[] {
    return queryAll<ExecutionLeaseRecord>(
      this.conn,
      `${EXECUTION_LEASE_SELECT}
       WHERE worker_id = ?
       ORDER BY leased_at ASC, id ASC`,
      workerId,
    );
  }

  public listExecutionLeasesByStatuses(statuses: ExecutionLeaseRecord["status"][]): ExecutionLeaseRecord[] {
    if (statuses.length === 0) {
      return [];
    }
    const placeholders = statuses.map(() => "?").join(", ");
    return queryAll<ExecutionLeaseRecord>(
      this.conn,
      `${EXECUTION_LEASE_SELECT}
       WHERE status IN (${placeholders})
       ORDER BY leased_at ASC, id ASC`,
      ...statuses,
    );
  }

  public listExpiredExecutionLeases(now: string): ExecutionLeaseRecord[] {
    return queryAll<ExecutionLeaseRecord>(
      this.conn,
      `${EXECUTION_LEASE_SELECT}
       WHERE status = 'active'
         AND expires_at < ?
       ORDER BY expires_at ASC`,
      now,
    );
  }

  public getLatestFencingToken(executionId: string): number {
    const result = queryOne<{ maxFencingToken?: number }>(
      this.conn,
      `SELECT MAX(fencing_token) AS "maxFencingToken"
       FROM execution_leases
       WHERE execution_id = ?`,
      executionId,
    );
    return Number(result?.maxFencingToken ?? 0);
  }
}
