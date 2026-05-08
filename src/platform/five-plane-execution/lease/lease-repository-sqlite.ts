/**
 * SQLite Lease Repository
 *
 * Implements LeaseRepository for single-node SQLite-backed lease state.
 */

import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import type { LeaseRepository } from "./lease-repository.js";
import type { ExecutionLeaseRecord, LeaseAuditRecord } from "../../contracts/types/domain.js";

const EXECUTION_LEASE_COLS = `
  id, execution_id, worker_id, attempt, fencing_token, queue_name, status,
  leased_at, expires_at, last_heartbeat_at, released_at, reason_code
`;

const LEASE_AUDIT_COLS = `
  id, execution_id, lease_id, worker_id, fencing_token, event_type, reason_code, recorded_at
`;

export class SqliteLeaseRepository implements LeaseRepository {
  constructor(private readonly db: AuthoritativeSqlDatabase) {}

  async insertLease(lease: ExecutionLeaseRecord): Promise<void> {
    this.db.connection
      .prepare(
        `INSERT INTO execution_leases (
          id, execution_id, worker_id, attempt, fencing_token, queue_name, status,
          leased_at, expires_at, last_heartbeat_at, released_at, reason_code
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
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

  async getLease(leaseId: string): Promise<ExecutionLeaseRecord | undefined> {
    return this.db.connection
      .prepare(
        `SELECT ${EXECUTION_LEASE_COLS}
         FROM execution_leases
         WHERE id = ?`,
      )
      .get(leaseId) as unknown as ExecutionLeaseRecord | undefined;
  }

  async getActiveLeaseForExecution(executionId: string): Promise<ExecutionLeaseRecord | undefined> {
    return this.db.connection
      .prepare(
        `SELECT ${EXECUTION_LEASE_COLS}
         FROM execution_leases
         WHERE execution_id = ?
           AND status = 'active'`,
      )
      .get(executionId) as unknown as ExecutionLeaseRecord | undefined;
  }

  async getLatestFencingToken(executionId: string): Promise<number> {
    const row = this.db.connection
      .prepare(
        `SELECT MAX(fencing_token) AS maxFencingToken
         FROM execution_leases
         WHERE execution_id = ?`,
      )
      .get(executionId) as { maxFencingToken?: number } | undefined;
    return Number(row?.maxFencingToken ?? 0);
  }

  async listExecutionLeases(executionId: string): Promise<ExecutionLeaseRecord[]> {
    return this.db.connection
      .prepare(
        `SELECT ${EXECUTION_LEASE_COLS}
         FROM execution_leases
         WHERE execution_id = ?
         ORDER BY fencing_token ASC`,
      )
      .all(executionId) as unknown as ExecutionLeaseRecord[];
  }

  async updateLeaseStatus(leaseId: string, status: ExecutionLeaseRecord["status"]): Promise<void> {
    this.db.connection
      .prepare(`UPDATE execution_leases SET status = ? WHERE id = ?`)
      .run(status, leaseId);
  }

  async updateLeaseHeartbeat(leaseId: string, lastHeartbeatAt: string): Promise<void> {
    this.db.connection
      .prepare(`UPDATE execution_leases SET last_heartbeat_at = ? WHERE id = ?`)
      .run(lastHeartbeatAt, leaseId);
  }

  async updateLeaseRelease(leaseId: string, releasedAt: string, reasonCode: string | null): Promise<void> {
    this.db.connection
      .prepare(
        `UPDATE execution_leases
         SET status = 'released', released_at = ?, reason_code = ?
         WHERE id = ?`,
      )
      .run(releasedAt, reasonCode, leaseId);
  }

  async insertLeaseAudit(audit: LeaseAuditRecord): Promise<void> {
    this.db.connection
      .prepare(
        `INSERT INTO lease_audits (
          id, execution_id, lease_id, worker_id, fencing_token, event_type, reason_code, recorded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
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

  async listLeaseAudits(executionId: string): Promise<LeaseAuditRecord[]> {
    return this.db.connection
      .prepare(
        `SELECT ${LEASE_AUDIT_COLS}
         FROM lease_audits
         WHERE execution_id = ?
         ORDER BY recorded_at ASC`,
      )
      .all(executionId) as unknown as LeaseAuditRecord[];
  }
}
