/**
 * SQLite Lease Repository
 *
 * Implements LeaseRepository for single-node SQLite-backed lease state.
 */
const EXECUTION_LEASE_COLS = `
  id, execution_id, worker_id, attempt, fencing_token, queue_name, status,
  leased_at, expires_at, last_heartbeat_at, released_at, reason_code
`;
const LEASE_AUDIT_COLS = `
  id, execution_id, lease_id, worker_id, fencing_token, event_type, reason_code, recorded_at
`;
export class SqliteLeaseRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async insertLease(lease) {
        this.db.connection
            .prepare(`INSERT INTO execution_leases (
          id, execution_id, worker_id, attempt, fencing_token, queue_name, status,
          leased_at, expires_at, last_heartbeat_at, released_at, reason_code
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(lease.id, lease.executionId, lease.workerId, lease.attempt, lease.fencingToken, lease.queueName, lease.status, lease.leasedAt, lease.expiresAt, lease.lastHeartbeatAt, lease.releasedAt, lease.reasonCode);
    }
    async getLease(leaseId) {
        return this.db.connection
            .prepare(`SELECT ${EXECUTION_LEASE_COLS}
         FROM execution_leases
         WHERE id = ?`)
            .get(leaseId);
    }
    async getActiveLeaseForExecution(executionId) {
        return this.db.connection
            .prepare(`SELECT ${EXECUTION_LEASE_COLS}
         FROM execution_leases
         WHERE execution_id = ?
           AND status = 'active'`)
            .get(executionId);
    }
    async getLatestFencingToken(executionId) {
        const row = this.db.connection
            .prepare(`SELECT MAX(fencing_token) AS maxFencingToken
         FROM execution_leases
         WHERE execution_id = ?`)
            .get(executionId);
        return Number(row?.maxFencingToken ?? 0);
    }
    async listExecutionLeases(executionId) {
        return this.db.connection
            .prepare(`SELECT ${EXECUTION_LEASE_COLS}
         FROM execution_leases
         WHERE execution_id = ?
         ORDER BY fencing_token ASC`)
            .all(executionId);
    }
    async updateLeaseStatus(leaseId, status) {
        this.db.connection
            .prepare(`UPDATE execution_leases SET status = ? WHERE id = ?`)
            .run(status, leaseId);
    }
    async updateLeaseHeartbeat(leaseId, lastHeartbeatAt) {
        this.db.connection
            .prepare(`UPDATE execution_leases SET last_heartbeat_at = ? WHERE id = ?`)
            .run(lastHeartbeatAt, leaseId);
    }
    async updateLeaseRelease(leaseId, releasedAt, reasonCode) {
        this.db.connection
            .prepare(`UPDATE execution_leases
         SET status = 'released', released_at = ?, reason_code = ?
         WHERE id = ?`)
            .run(releasedAt, reasonCode, leaseId);
    }
    async insertLeaseAudit(audit) {
        this.db.connection
            .prepare(`INSERT INTO lease_audits (
          id, execution_id, lease_id, worker_id, fencing_token, event_type, reason_code, recorded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(audit.id, audit.executionId, audit.leaseId, audit.workerId, audit.fencingToken, audit.eventType, audit.reasonCode, audit.recordedAt);
    }
    async listLeaseAudits(executionId) {
        return this.db.connection
            .prepare(`SELECT ${LEASE_AUDIT_COLS}
         FROM lease_audits
         WHERE execution_id = ?
         ORDER BY recorded_at ASC`)
            .all(executionId);
    }
}
//# sourceMappingURL=lease-repository-sqlite.js.map