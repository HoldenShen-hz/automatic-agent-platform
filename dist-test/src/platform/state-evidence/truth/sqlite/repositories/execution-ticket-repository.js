import { execute, queryAll, queryOne } from "../query-helper.js";
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
    conn;
    constructor(conn) {
        this.conn = conn;
    }
    insertWorkerRegistrationChallenge(record) {
        execute(this.conn, `INSERT INTO worker_registration_challenges (
        id, worker_id, challenge_token_hash, allowed_capabilities_json, expires_at, used_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`, record.id, record.workerId, record.challengeTokenHash, record.allowedCapabilitiesJson, record.expiresAt, record.usedAt, record.createdAt);
    }
    getWorkerRegistrationChallenge(challengeId) {
        return queryOne(this.conn, `SELECT
        id,
        worker_id AS "workerId",
        challenge_token_hash AS "challengeTokenHash",
        allowed_capabilities_json AS "allowedCapabilitiesJson",
        expires_at AS "expiresAt",
        used_at AS "usedAt",
        created_at AS "createdAt"
       FROM worker_registration_challenges
       WHERE id = ?`, challengeId);
    }
    consumeWorkerRegistrationChallenge(challengeId, usedAt) {
        execute(this.conn, `UPDATE worker_registration_challenges
       SET used_at = ?
       WHERE id = ?`, usedAt, challengeId);
    }
    insertExecutionTicket(ticket) {
        execute(this.conn, `INSERT INTO execution_tickets (
        id, execution_id, task_id, priority, queue_name, dispatch_target,
        required_isolation_level, required_repo_version, required_capabilities_json,
        dispatch_after, attempt, status, assigned_worker_id, lease_id, claimed_at,
        consumed_at, invalidated_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ticket.id, ticket.executionId, ticket.taskId, ticket.priority, ticket.queueName, ticket.dispatchTarget ?? "any", ticket.requiredIsolationLevel ?? "standard", ticket.requiredRepoVersion ?? null, ticket.requiredCapabilitiesJson, ticket.dispatchAfter, ticket.attempt, ticket.status, ticket.assignedWorkerId, ticket.leaseId, ticket.claimedAt, ticket.consumedAt, ticket.invalidatedAt, ticket.createdAt, ticket.updatedAt);
    }
    claimExecutionTicket(ticketIdOrInput, assignedWorkerId, claimedAt) {
        const input = typeof ticketIdOrInput === "string"
            ? {
                ticketId: ticketIdOrInput,
                assignedWorkerId: assignedWorkerId ?? "",
                leaseId: null,
                claimedAt: claimedAt ?? "",
            }
            : ticketIdOrInput;
        execute(this.conn, `UPDATE execution_tickets
       SET status = 'claimed',
           assigned_worker_id = ?,
           lease_id = COALESCE(?, lease_id),
           claimed_at = ?,
           updated_at = ?
       WHERE id = ?
         AND status = 'pending'`, input.assignedWorkerId, input.leaseId, input.claimedAt, input.claimedAt, input.ticketId);
    }
    consumeExecutionTicket(ticketId, consumedAt) {
        execute(this.conn, `UPDATE execution_tickets
       SET status = 'consumed',
           consumed_at = ?,
           updated_at = ?
       WHERE id = ?`, consumedAt, consumedAt, ticketId);
    }
    invalidateExecutionTicket(ticketIdOrInput, invalidatedAt) {
        const input = typeof ticketIdOrInput === "string"
            ? {
                ticketId: ticketIdOrInput,
                status: "cancelled",
                invalidatedAt: invalidatedAt ?? "",
            }
            : ticketIdOrInput;
        execute(this.conn, `UPDATE execution_tickets
       SET status = ?,
           invalidated_at = ?,
           updated_at = ?
       WHERE id = ?`, input.status, input.invalidatedAt, input.invalidatedAt, input.ticketId);
    }
    listPendingExecutionTickets(queueName, limit) {
        const params = [];
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
        return queryAll(this.conn, sql, ...params);
    }
    getExecutionTicket(ticketId) {
        return queryOne(this.conn, `${EXECUTION_TICKET_SELECT}
       WHERE id = ?`, ticketId);
    }
    getActiveExecutionTicket(executionId, attempt) {
        return queryOne(this.conn, `${EXECUTION_TICKET_SELECT}
       WHERE execution_id = ?
         AND attempt = ?
         AND status IN ('pending', 'claimed')
       ORDER BY created_at ASC
       LIMIT 1`, executionId, attempt);
    }
    listExecutionTicketsByExecution(executionId) {
        return queryAll(this.conn, `${EXECUTION_TICKET_SELECT}
       WHERE execution_id = ?
       ORDER BY created_at ASC, id ASC`, executionId);
    }
    listExecutionTicketsByStatuses(statuses) {
        if (statuses.length === 0) {
            return [];
        }
        const placeholders = statuses.map(() => "?").join(", ");
        return queryAll(this.conn, `${EXECUTION_TICKET_SELECT}
       WHERE status IN (${placeholders})
       ORDER BY created_at ASC, id ASC`, ...statuses);
    }
    listDispatchableExecutionTickets(now, queueName = null) {
        const params = [now];
        let sql = `${EXECUTION_TICKET_SELECT}
      WHERE status = 'pending'
        AND (dispatch_after IS NULL OR dispatch_after <= ?)`;
        if (queueName != null) {
            sql += " AND queue_name = ?";
            params.push(queueName);
        }
        sql += " ORDER BY priority DESC, created_at ASC";
        return queryAll(this.conn, sql, ...params);
    }
    insertExecutionLease(lease) {
        execute(this.conn, `INSERT INTO execution_leases (
        id, execution_id, worker_id, attempt, fencing_token, queue_name, status,
        leased_at, expires_at, last_heartbeat_at, released_at, reason_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, lease.id, lease.executionId, lease.workerId, lease.attempt, lease.fencingToken, lease.queueName, lease.status, lease.leasedAt, lease.expiresAt, lease.lastHeartbeatAt, lease.releasedAt, lease.reasonCode);
    }
    renewExecutionLease(leaseId, expiresAt, lastHeartbeatAt) {
        execute(this.conn, `UPDATE execution_leases
       SET expires_at = ?,
           last_heartbeat_at = COALESCE(?, last_heartbeat_at)
       WHERE id = ?`, expiresAt, lastHeartbeatAt ?? null, leaseId);
    }
    closeExecutionLease(leaseIdOrInput, releasedAt) {
        const input = typeof leaseIdOrInput === "string"
            ? {
                leaseId: leaseIdOrInput,
                status: "released",
                releasedAt: releasedAt ?? "",
                reasonCode: null,
            }
            : leaseIdOrInput;
        execute(this.conn, `UPDATE execution_leases
       SET status = ?,
           released_at = ?,
           reason_code = ?
       WHERE id = ?`, input.status, input.releasedAt, input.reasonCode, input.leaseId);
    }
    insertLeaseAudit(audit) {
        execute(this.conn, `INSERT INTO lease_audits (
        id, execution_id, lease_id, worker_id, fencing_token, event_type, reason_code, recorded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, audit.id, audit.executionId, audit.leaseId, audit.workerId, audit.fencingToken, audit.eventType, audit.reasonCode, audit.recordedAt);
    }
    getExecutionLease(leaseId) {
        return queryOne(this.conn, `${EXECUTION_LEASE_SELECT}
       WHERE id = ?`, leaseId);
    }
    getActiveExecutionLease(executionId) {
        return queryOne(this.conn, `${EXECUTION_LEASE_SELECT}
       WHERE execution_id = ?
         AND status = 'active'`, executionId);
    }
    getLatestExecutionLease(executionId) {
        return queryOne(this.conn, `${EXECUTION_LEASE_SELECT}
       WHERE execution_id = ?
       ORDER BY fencing_token DESC
       LIMIT 1`, executionId);
    }
    listExecutionLeases(executionId) {
        return queryAll(this.conn, `${EXECUTION_LEASE_SELECT}
       WHERE execution_id = ?
       ORDER BY fencing_token ASC`, executionId);
    }
    listExecutionLeasesByStatuses(statuses) {
        if (statuses.length === 0) {
            return [];
        }
        const placeholders = statuses.map(() => "?").join(", ");
        return queryAll(this.conn, `${EXECUTION_LEASE_SELECT}
       WHERE status IN (${placeholders})
       ORDER BY leased_at ASC, id ASC`, ...statuses);
    }
    listExpiredExecutionLeases(now) {
        return queryAll(this.conn, `${EXECUTION_LEASE_SELECT}
       WHERE status = 'active'
         AND expires_at < ?
       ORDER BY expires_at ASC`, now);
    }
    getLatestFencingToken(executionId) {
        const result = queryOne(this.conn, `SELECT MAX(fencing_token) AS "maxFencingToken"
       FROM execution_leases
       WHERE execution_id = ?`, executionId);
        return Number(result?.maxFencingToken ?? 0);
    }
}
//# sourceMappingURL=execution-ticket-repository.js.map