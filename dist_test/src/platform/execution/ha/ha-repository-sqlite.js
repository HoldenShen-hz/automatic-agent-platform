/**
 * SQLite HA Repository
 *
 * Implements HaRepository for single-node SQLite-backed HA state.
 */
import { nowIso } from "../../contracts/types/ids.js";
export class SqliteHaRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    // Node Management
    async upsertNode(node) {
        this.db.connection
            .prepare(`INSERT OR REPLACE INTO coordinator_nodes (node_id, region, status, is_leader, leadership_epoch, last_heartbeat_at, metadata, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(node.nodeId, node.region, node.status, node.isLeader ? 1 : 0, node.leadershipEpoch, node.lastHeartbeatAt, node.metadata != null ? JSON.stringify(node.metadata) : null, nowIso(), nowIso());
    }
    async getNode(nodeId) {
        const row = this.db.connection
            .prepare(`SELECT * FROM coordinator_nodes WHERE node_id = ?`)
            .get(nodeId);
        return row ? this.mapRowToNode(row) : undefined;
    }
    async listNodes(status) {
        if (status) {
            return this.db.connection
                .prepare(`SELECT * FROM coordinator_nodes WHERE status = ? ORDER BY last_heartbeat_at DESC`)
                .all(status).map((r) => this.mapRowToNode(r));
        }
        return this.db.connection
            .prepare(`SELECT * FROM coordinator_nodes ORDER BY last_heartbeat_at DESC`)
            .all().map((r) => this.mapRowToNode(r));
    }
    async updateNodeHeartbeat(nodeId, status) {
        const now = nowIso();
        const updates = ["last_heartbeat_at = ?", "updated_at = ?"];
        const values = [now, now];
        if (status) {
            updates.push("status = ?");
            values.push(status);
        }
        values.push(nodeId);
        this.db.connection
            .prepare(`UPDATE coordinator_nodes SET ${updates.join(", ")} WHERE node_id = ?`)
            .run(...values);
    }
    async deleteNode(nodeId) {
        this.db.connection
            .prepare(`DELETE FROM coordinator_nodes WHERE node_id = ?`)
            .run(nodeId);
    }
    // Lease Management
    async insertLease(lease) {
        this.db.connection
            .prepare(`INSERT INTO leadership_leases (lease_id, node_id, epoch, acquired_at, expires_at, status, ttl_ms, fencing_token)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(lease.leaseId, lease.nodeId, lease.epoch, lease.acquiredAt, lease.expiresAt, lease.status, lease.ttlMs, 0);
    }
    async updateLeaseStatus(leaseId, status) {
        this.db.connection
            .prepare(`UPDATE leadership_leases SET status = ? WHERE lease_id = ?`)
            .run(status, leaseId);
    }
    async updateLeaseExpiration(leaseId, expiresAt) {
        this.db.connection
            .prepare(`UPDATE leadership_leases SET expires_at = ? WHERE lease_id = ?`)
            .run(expiresAt, leaseId);
    }
    async getActiveLease() {
        const now = nowIso();
        const row = this.db.connection
            .prepare(`SELECT * FROM leadership_leases WHERE status = 'active' AND expires_at > ? ORDER BY acquired_at DESC LIMIT 1`)
            .get(now);
        return row ? this.mapRowToLease(row) : undefined;
    }
    async getLeaseByNodeId(nodeId) {
        const row = this.db.connection
            .prepare(`SELECT * FROM leadership_leases WHERE node_id = ? AND status = 'active' ORDER BY acquired_at DESC LIMIT 1`)
            .get(nodeId);
        return row ? this.mapRowToLease(row) : undefined;
    }
    async getLeaseById(leaseId) {
        const row = this.db.connection
            .prepare(`SELECT * FROM leadership_leases WHERE lease_id = ?`)
            .get(leaseId);
        return row ? this.mapRowToLease(row) : undefined;
    }
    async getExpiredLeases() {
        const now = nowIso();
        return this.db.connection
            .prepare(`SELECT * FROM leadership_leases WHERE status = 'active' AND expires_at <= ?`)
            .all(now).map((r) => this.mapRowToLease(r));
    }
    async getActiveLeaseByNode(nodeId) {
        const row = this.db.connection
            .prepare(`SELECT * FROM leadership_leases WHERE node_id = ? AND status = 'active' ORDER BY acquired_at DESC LIMIT 1`)
            .get(nodeId);
        return row ? this.mapRowToLease(row) : undefined;
    }
    // Epoch Management
    async insertEpoch(epoch) {
        this.db.connection
            .prepare(`INSERT INTO leadership_epochs (epoch, leader_node_id, started_at, ended_at, cause, fencing_token)
         VALUES (?, ?, ?, ?, ?, ?)`)
            .run(epoch.epoch, epoch.leaderNodeId, epoch.startedAt, epoch.endedAt, epoch.cause, epoch.fencingToken);
    }
    async updateEpochEnd(epochNumber, endedAt, cause) {
        this.db.connection
            .prepare(`UPDATE leadership_epochs SET ended_at = ?, cause = ? WHERE epoch = ? AND ended_at IS NULL`)
            .run(endedAt, cause, epochNumber);
    }
    async getLatestEpoch() {
        const row = this.db.connection
            .prepare(`SELECT * FROM leadership_epochs ORDER BY epoch DESC LIMIT 1`)
            .get();
        return row ? this.mapRowToEpoch(row) : undefined;
    }
    async listEpochs(limit = 100) {
        return this.db.connection
            .prepare(`SELECT * FROM leadership_epochs ORDER BY epoch DESC LIMIT ?`)
            .all(limit).map((r) => this.mapRowToEpoch(r));
    }
    // Failover Decisions
    async insertFailoverDecision(decision) {
        this.db.connection
            .prepare(`INSERT INTO failover_decisions (decision_id, old_leader_node_id, new_leader_node_id, epoch, cause, outcome, decided_at, fencing_token)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(decision.decisionId, decision.oldLeaderNodeId, decision.newLeaderNodeId, decision.epoch, decision.cause, decision.outcome, decision.decidedAt, decision.fencingToken);
    }
    async listFailoverDecisions(limit = 100) {
        return this.db.connection
            .prepare(`SELECT * FROM failover_decisions ORDER BY decided_at DESC LIMIT ?`)
            .all(limit).map((r) => this.mapRowToFailoverDecision(r));
    }
    // Leader Action Audit
    async recordActionAudit(entry) {
        this.db.connection
            .prepare(`INSERT INTO leader_action_audit (id, action_type, requesting_node_id, leader_node_id, epoch, fencing_token, authorized, reason_code, performed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(entry.id, entry.actionType, entry.requestingNodeId, entry.leaderNodeId, entry.epoch, entry.fencingToken, entry.authorized ? 1 : 0, entry.reasonCode, entry.performedAt);
    }
    // Stale Detection
    async getStaleNodes(thresholdMs) {
        const thresholdDate = new Date(Date.now() - thresholdMs).toISOString();
        return this.db.connection
            .prepare(`SELECT * FROM coordinator_nodes WHERE last_heartbeat_at < ?`)
            .all(thresholdDate).map((r) => this.mapRowToNode(r));
    }
    // Row Mappers
    mapRowToNode(row) {
        return {
            nodeId: row.node_id,
            region: row.region,
            status: row.status,
            isLeader: row.is_leader === 1,
            leadershipEpoch: row.leadership_epoch,
            lastHeartbeatAt: row.last_heartbeat_at,
            metadata: row.metadata != null ? JSON.parse(row.metadata) : null,
        };
    }
    mapRowToLease(row) {
        return {
            leaseId: row.lease_id,
            nodeId: row.node_id,
            epoch: row.epoch,
            acquiredAt: row.acquired_at,
            expiresAt: row.expires_at,
            status: row.status,
            ttlMs: row.ttl_ms,
        };
    }
    mapRowToEpoch(row) {
        return {
            epoch: row.epoch,
            leaderNodeId: row.leader_node_id ?? null,
            startedAt: row.started_at,
            endedAt: row.ended_at ?? null,
            cause: row.cause,
            fencingToken: row.fencing_token,
        };
    }
    mapRowToFailoverDecision(row) {
        return {
            decisionId: row.decision_id,
            oldLeaderNodeId: row.old_leader_node_id ?? null,
            newLeaderNodeId: row.new_leader_node_id ?? null,
            epoch: row.epoch,
            cause: row.cause,
            outcome: row.outcome,
            decidedAt: row.decided_at,
            fencingToken: row.fencing_token,
        };
    }
}
//# sourceMappingURL=ha-repository-sqlite.js.map