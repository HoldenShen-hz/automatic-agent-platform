/**
 * PostgreSQL Lease Repository
 *
 * Implements LeaseRepository for multi-node PostgreSQL-backed lease state.
 * Uses AsyncSqlDatabase for async operations with proper connection pooling.
 */
export class PostgresLeaseRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async insertLease(lease) {
        await this.db.asyncConnection.execute(`INSERT INTO execution_leases (
        id, execution_id, worker_id, attempt, fencing_token, queue_name, status,
        leased_at, expires_at, last_heartbeat_at, released_at, reason_code
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`, lease.id, lease.executionId, lease.workerId, lease.attempt, lease.fencingToken, lease.queueName, lease.status, lease.leasedAt, lease.expiresAt, lease.lastHeartbeatAt, lease.releasedAt, lease.reasonCode);
    }
    async getLease(leaseId) {
        const result = await this.db.asyncConnection.query(`SELECT id, execution_id, worker_id, attempt, fencing_token, queue_name, status,
              leased_at, expires_at, last_heartbeat_at, released_at, reason_code
       FROM execution_leases
       WHERE id = $1`, leaseId);
        return result.rows[0];
    }
    async getActiveLeaseForExecution(executionId) {
        const result = await this.db.asyncConnection.query(`SELECT id, execution_id, worker_id, attempt, fencing_token, queue_name, status,
              leased_at, expires_at, last_heartbeat_at, released_at, reason_code
       FROM execution_leases
       WHERE execution_id = $1
         AND status = 'active'`, executionId);
        return result.rows[0];
    }
    async getLatestFencingToken(executionId) {
        const result = await this.db.asyncConnection.query(`SELECT MAX(fencing_token) AS "maxFencingToken"
       FROM execution_leases
       WHERE execution_id = $1`, executionId);
        return Number(result.rows[0]?.maxFencingToken ?? 0);
    }
    async listExecutionLeases(executionId) {
        const result = await this.db.asyncConnection.query(`SELECT id, execution_id, worker_id, attempt, fencing_token, queue_name, status,
              leased_at, expires_at, last_heartbeat_at, released_at, reason_code
       FROM execution_leases
       WHERE execution_id = $1
       ORDER BY fencing_token ASC`, executionId);
        return result.rows;
    }
    async updateLeaseStatus(leaseId, status) {
        await this.db.asyncConnection.execute(`UPDATE execution_leases SET status = $1 WHERE id = $2`, status, leaseId);
    }
    async updateLeaseHeartbeat(leaseId, lastHeartbeatAt) {
        await this.db.asyncConnection.execute(`UPDATE execution_leases SET last_heartbeat_at = $1 WHERE id = $2`, lastHeartbeatAt, leaseId);
    }
    async updateLeaseRelease(leaseId, releasedAt, reasonCode) {
        await this.db.asyncConnection.execute(`UPDATE execution_leases
       SET status = 'released', released_at = $1, reason_code = $2
       WHERE id = $3`, releasedAt, reasonCode, leaseId);
    }
    async insertLeaseAudit(audit) {
        await this.db.asyncConnection.execute(`INSERT INTO lease_audits (
        id, execution_id, lease_id, worker_id, fencing_token, event_type, reason_code, recorded_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, audit.id, audit.executionId, audit.leaseId, audit.workerId, audit.fencingToken, audit.eventType, audit.reasonCode, audit.recordedAt);
    }
    async listLeaseAudits(executionId) {
        const result = await this.db.asyncConnection.query(`SELECT id, execution_id, lease_id, worker_id, fencing_token, event_type, reason_code, recorded_at
       FROM lease_audits
       WHERE execution_id = $1
       ORDER BY recorded_at ASC`, executionId);
        return result.rows;
    }
}
//# sourceMappingURL=lease-repository-postgres.js.map