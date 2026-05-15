/**
 * PostgreSQL Lease Repository
 *
 * Implements LeaseRepository for multi-node PostgreSQL-backed lease state.
 * Uses AsyncSqlDatabase for async operations with proper connection pooling.
 */

import type { AsyncSqlDatabase } from "../../five-plane-state-evidence/truth/async-sql-database.js";
import type { LeaseRepository } from "./lease-repository.js";
import type { ExecutionLeaseRecord, LeaseAuditRecord } from "../../contracts/types/domain.js";

export class PostgresLeaseRepository implements LeaseRepository {
  constructor(private readonly db: AsyncSqlDatabase) {}

  async insertLease(lease: ExecutionLeaseRecord): Promise<void> {
    await this.db.asyncConnection.execute(
      `INSERT INTO execution_leases (
        id, execution_id, worker_id, attempt, fencing_token, queue_name, status,
        leased_at, expires_at, last_heartbeat_at, released_at, reason_code
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
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
    const result = await this.db.asyncConnection.query<ExecutionLeaseRecord>(
      `SELECT id, execution_id, worker_id, attempt, fencing_token, queue_name, status,
              leased_at, expires_at, last_heartbeat_at, released_at, reason_code
       FROM execution_leases
       WHERE id = $1`,
      leaseId,
    );
    return result.rows[0];
  }

  async getActiveLeaseForExecution(executionId: string): Promise<ExecutionLeaseRecord | undefined> {
    const result = await this.db.asyncConnection.query<ExecutionLeaseRecord>(
      `SELECT id, execution_id, worker_id, attempt, fencing_token, queue_name, status,
              leased_at, expires_at, last_heartbeat_at, released_at, reason_code
       FROM execution_leases
       WHERE execution_id = $1
         AND status = 'active'`,
      executionId,
    );
    return result.rows[0];
  }

  async getLatestFencingToken(executionId: string): Promise<number> {
    const result = await this.db.asyncConnection.query<{ maxFencingToken?: number }>(
      `SELECT MAX(fencing_token) AS "maxFencingToken"
       FROM execution_leases
       WHERE execution_id = $1`,
      executionId,
    );
    return Number(result.rows[0]?.maxFencingToken ?? 0);
  }

  async listExecutionLeases(executionId: string): Promise<ExecutionLeaseRecord[]> {
    const result = await this.db.asyncConnection.query<ExecutionLeaseRecord>(
      `SELECT id, execution_id, worker_id, attempt, fencing_token, queue_name, status,
              leased_at, expires_at, last_heartbeat_at, released_at, reason_code
       FROM execution_leases
       WHERE execution_id = $1
       ORDER BY fencing_token ASC`,
      executionId,
    );
    return result.rows;
  }

  async updateLeaseStatus(leaseId: string, status: ExecutionLeaseRecord["status"]): Promise<void> {
    await this.db.asyncConnection.execute(
      `UPDATE execution_leases SET status = $1 WHERE id = $2`,
      status,
      leaseId,
    );
  }

  async updateLeaseHeartbeat(leaseId: string, lastHeartbeatAt: string): Promise<void> {
    await this.db.asyncConnection.execute(
      `UPDATE execution_leases SET last_heartbeat_at = $1 WHERE id = $2`,
      lastHeartbeatAt,
      leaseId,
    );
  }

  async updateLeaseRelease(leaseId: string, releasedAt: string, reasonCode: string | null): Promise<void> {
    await this.db.asyncConnection.execute(
      `UPDATE execution_leases
       SET status = 'released', released_at = $1, reason_code = $2
       WHERE id = $3`,
      releasedAt,
      reasonCode,
      leaseId,
    );
  }

  async insertLeaseAudit(audit: LeaseAuditRecord): Promise<void> {
    await this.db.asyncConnection.execute(
      `INSERT INTO lease_audits (
        id, execution_id, lease_id, worker_id, fencing_token, event_type, reason_code, recorded_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
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
    const result = await this.db.asyncConnection.query<LeaseAuditRecord>(
      `SELECT id, execution_id, lease_id, worker_id, fencing_token, event_type, reason_code, recorded_at
       FROM lease_audits
       WHERE execution_id = $1
       ORDER BY recorded_at ASC`,
      executionId,
    );
    return result.rows;
  }
}
