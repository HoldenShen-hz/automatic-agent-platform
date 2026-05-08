/**
 * PostgreSQL HA Repository
 *
 * Implements HaRepository for multi-node PostgreSQL-backed HA state.
 * Uses PostgreSQL advisory locks for leader election.
 */

import { createHash } from "node:crypto";
import type { AsyncSqlDatabase } from "../../state-evidence/truth/async-sql-database.js";
import type { HaRepository, LeaderActionAuditEntry } from "./ha-repository.js";
import type { CoordinatorNode, CoordinatorNodeStatus, FailoverDecision, LeaderLease, LeadershipEpoch } from "./types.js";

export class PostgresHaRepository implements HaRepository {
  private readonly lockId: bigint;

  constructor(
    private readonly db: AsyncSqlDatabase,
    private readonly coordinatorId: string,
    lockNamespace: string = "ha_leader",
  ) {
    // Deterministic lock ID from namespace (hash to bigint)
    this.lockId = BigInt("0x" + createHash("sha256").update(lockNamespace).digest("hex").slice(0, 15));
  }

  // Node Management

  async upsertNode(node: CoordinatorNode): Promise<void> {
    await this.db.asyncConnection.execute(
      `INSERT INTO coordinator_nodes (node_id, region, status, is_leader, leadership_epoch, last_heartbeat_at, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       ON CONFLICT (node_id) DO UPDATE SET
         region = EXCLUDED.region,
         status = EXCLUDED.status,
         is_leader = EXCLUDED.is_leader,
         leadership_epoch = EXCLUDED.leadership_epoch,
         last_heartbeat_at = EXCLUDED.last_heartbeat_at,
         metadata = EXCLUDED.metadata,
         updated_at = NOW()`,
      node.nodeId,
      node.region,
      node.status,
      node.isLeader ? 1 : 0,
      node.leadershipEpoch,
      node.lastHeartbeatAt,
      node.metadata != null ? JSON.stringify(node.metadata) : null,
    );
  }

  async getNode(nodeId: string): Promise<CoordinatorNode | undefined> {
    const row = await this.db.asyncConnection.queryOne<CoordinatorNodeRow>(
      `SELECT * FROM coordinator_nodes WHERE node_id = $1`,
      nodeId,
    );
    return row ? this.mapRowToNode(row) : undefined;
  }

  async listNodes(status?: CoordinatorNodeStatus): Promise<CoordinatorNode[]> {
    if (status) {
      const result = await this.db.asyncConnection.query<CoordinatorNodeRow>(
        `SELECT * FROM coordinator_nodes WHERE status = $1 ORDER BY last_heartbeat_at DESC`,
        status,
      );
      return result.rows.map((r) => this.mapRowToNode(r));
    }
    const result = await this.db.asyncConnection.query<CoordinatorNodeRow>(
      `SELECT * FROM coordinator_nodes ORDER BY last_heartbeat_at DESC`,
    );
    return result.rows.map((r) => this.mapRowToNode(r));
  }

  async updateNodeHeartbeat(nodeId: string, status?: CoordinatorNodeStatus): Promise<void> {
    if (status) {
      await this.db.asyncConnection.execute(
        `UPDATE coordinator_nodes SET last_heartbeat_at = NOW(), status = $1, updated_at = NOW() WHERE node_id = $2`,
        status,
        nodeId,
      );
    } else {
      await this.db.asyncConnection.execute(
        `UPDATE coordinator_nodes SET last_heartbeat_at = NOW(), updated_at = NOW() WHERE node_id = $1`,
        nodeId,
      );
    }
  }

  async deleteNode(nodeId: string): Promise<void> {
    await this.db.asyncConnection.execute(
      `DELETE FROM coordinator_nodes WHERE node_id = $1`,
      nodeId,
    );
  }

  // Lease Management

  async insertLease(lease: LeaderLease): Promise<void> {
    await this.db.asyncConnection.execute(
      `INSERT INTO leadership_leases (lease_id, node_id, epoch, acquired_at, expires_at, status, ttl_ms, fencing_token)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      lease.leaseId,
      lease.nodeId,
      lease.epoch,
      lease.acquiredAt,
      lease.expiresAt,
      lease.status,
      lease.ttlMs,
      0,
    );
  }

  async updateLeaseStatus(leaseId: string, status: LeaderLease["status"]): Promise<void> {
    await this.db.asyncConnection.execute(
      `UPDATE leadership_leases SET status = $1 WHERE lease_id = $2`,
      status,
      leaseId,
    );
  }

  async updateLeaseExpiration(leaseId: string, expiresAt: string): Promise<void> {
    await this.db.asyncConnection.execute(
      `UPDATE leadership_leases SET expires_at = $1 WHERE lease_id = $2`,
      expiresAt,
      leaseId,
    );
  }

  async getActiveLease(): Promise<LeaderLease | undefined> {
    const row = await this.db.asyncConnection.queryOne<LeaderLeaseRow>(
      `SELECT * FROM leadership_leases WHERE status = 'active' AND expires_at > NOW() ORDER BY acquired_at DESC LIMIT 1`,
    );
    return row ? this.mapRowToLease(row) : undefined;
  }

  async getLeaseByNodeId(nodeId: string): Promise<LeaderLease | undefined> {
    const row = await this.db.asyncConnection.queryOne<LeaderLeaseRow>(
      `SELECT * FROM leadership_leases WHERE node_id = $1 AND status = 'active' ORDER BY acquired_at DESC LIMIT 1`,
      nodeId,
    );
    return row ? this.mapRowToLease(row) : undefined;
  }

  async getLeaseById(leaseId: string): Promise<LeaderLease | undefined> {
    const row = await this.db.asyncConnection.queryOne<LeaderLeaseRow>(
      `SELECT * FROM leadership_leases WHERE lease_id = $1`,
      leaseId,
    );
    return row ? this.mapRowToLease(row) : undefined;
  }

  async getExpiredLeases(): Promise<LeaderLease[]> {
    const result = await this.db.asyncConnection.query<LeaderLeaseRow>(
      `SELECT * FROM leadership_leases WHERE status = 'active' AND expires_at <= NOW()`,
    );
    return result.rows.map((r) => this.mapRowToLease(r));
  }

  async getActiveLeaseByNode(nodeId: string): Promise<LeaderLease | undefined> {
    const row = await this.db.asyncConnection.queryOne<LeaderLeaseRow>(
      `SELECT * FROM leadership_leases WHERE node_id = $1 AND status = 'active' ORDER BY acquired_at DESC LIMIT 1`,
      nodeId,
    );
    return row ? this.mapRowToLease(row) : undefined;
  }

  // Epoch Management

  async insertEpoch(epoch: LeadershipEpoch): Promise<void> {
    await this.db.asyncConnection.execute(
      `INSERT INTO leadership_epochs (epoch, leader_node_id, started_at, ended_at, cause, fencing_token)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      epoch.epoch,
      epoch.leaderNodeId,
      epoch.startedAt,
      epoch.endedAt,
      epoch.cause,
      epoch.fencingToken,
    );
  }

  async updateEpochEnd(epochNumber: number, endedAt: string, cause: string): Promise<void> {
    await this.db.asyncConnection.execute(
      `UPDATE leadership_epochs SET ended_at = $1, cause = $2 WHERE epoch = $3 AND ended_at IS NULL`,
      endedAt,
      cause,
      epochNumber,
    );
  }

  async getLatestEpoch(): Promise<LeadershipEpoch | undefined> {
    const row = await this.db.asyncConnection.queryOne<EpochRow>(
      `SELECT * FROM leadership_epochs ORDER BY epoch DESC LIMIT 1`,
    );
    return row ? this.mapRowToEpoch(row) : undefined;
  }

  async listEpochs(limit = 100): Promise<LeadershipEpoch[]> {
    const result = await this.db.asyncConnection.query<EpochRow>(
      `SELECT * FROM leadership_epochs ORDER BY epoch DESC LIMIT $1`,
      limit,
    );
    return result.rows.map((r) => this.mapRowToEpoch(r));
  }

  // Failover Decisions

  async insertFailoverDecision(decision: FailoverDecision): Promise<void> {
    await this.db.asyncConnection.execute(
      `INSERT INTO failover_decisions (decision_id, old_leader_node_id, new_leader_node_id, epoch, cause, outcome, decided_at, fencing_token)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      decision.decisionId,
      decision.oldLeaderNodeId,
      decision.newLeaderNodeId,
      decision.epoch,
      decision.cause,
      decision.outcome,
      decision.decidedAt,
      decision.fencingToken,
    );
  }

  async listFailoverDecisions(limit = 100): Promise<FailoverDecision[]> {
    const result = await this.db.asyncConnection.query<FailoverDecisionRow>(
      `SELECT * FROM failover_decisions ORDER BY decided_at DESC LIMIT $1`,
      limit,
    );
    return result.rows.map((r) => this.mapRowToFailoverDecision(r));
  }

  // Leader Action Audit

  async recordActionAudit(entry: LeaderActionAuditEntry): Promise<void> {
    await this.db.asyncConnection.execute(
      `INSERT INTO leader_action_audit (id, action_type, requesting_node_id, leader_node_id, epoch, fencing_token, authorized, reason_code, performed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      entry.id,
      entry.actionType,
      entry.requestingNodeId,
      entry.leaderNodeId,
      entry.epoch,
      entry.fencingToken,
      entry.authorized ? 1 : 0,
      entry.reasonCode,
      entry.performedAt,
    );
  }

  // Stale Detection

  async getStaleNodes(thresholdMs: number): Promise<CoordinatorNode[]> {
    const result = await this.db.asyncConnection.query<CoordinatorNodeRow>(
      `SELECT * FROM coordinator_nodes WHERE last_heartbeat_at < NOW() - INTERVAL '${Math.ceil(thresholdMs)} milliseconds'`,
    );
    return result.rows.map((r) => this.mapRowToNode(r));
  }

  // Leader Election via Advisory Locks

  async tryAcquireAdvisoryLock(): Promise<boolean> {
    const result = await this.db.asyncConnection.queryOne<{ acquired: boolean }>(
      `SELECT pg_try_advisory_lock($1) AS acquired`,
      this.lockId,
    );
    return result?.acquired ?? false;
  }

  async releaseAdvisoryLock(): Promise<void> {
    await this.db.asyncConnection.execute(
      `SELECT pg_advisory_unlock($1)`,
      this.lockId,
    );
  }

  // Row Mappers

  private mapRowToNode(row: CoordinatorNodeRow): CoordinatorNode {
    return {
      nodeId: row.node_id,
      region: row.region,
      status: row.status as CoordinatorNodeStatus,
      isLeader: row.is_leader === 1,
      leadershipEpoch: row.leadership_epoch,
      lastHeartbeatAt: row.last_heartbeat_at,
      metadata: row.metadata != null ? JSON.parse(row.metadata) : null,
    };
  }

  private mapRowToLease(row: LeaderLeaseRow): LeaderLease {
    return {
      leaseId: row.lease_id,
      nodeId: row.node_id,
      epoch: row.epoch,
      acquiredAt: row.acquired_at,
      expiresAt: row.expires_at,
      status: row.status as LeaderLease["status"],
      ttlMs: row.ttl_ms,
    };
  }

  private mapRowToEpoch(row: EpochRow): LeadershipEpoch {
    return {
      epoch: row.epoch,
      leaderNodeId: row.leader_node_id ?? null,
      startedAt: row.started_at,
      endedAt: row.ended_at ?? null,
      cause: row.cause as LeadershipEpoch["cause"],
      fencingToken: row.fencing_token,
    };
  }

  private mapRowToFailoverDecision(row: FailoverDecisionRow): FailoverDecision {
    return {
      decisionId: row.decision_id,
      oldLeaderNodeId: row.old_leader_node_id ?? null,
      newLeaderNodeId: row.new_leader_node_id ?? null,
      epoch: row.epoch,
      cause: row.cause as FailoverDecision["cause"],
      outcome: row.outcome as FailoverDecision["outcome"],
      decidedAt: row.decided_at,
      fencingToken: row.fencing_token,
    };
  }
}

// Row types matching PostgreSQL schema
interface CoordinatorNodeRow {
  node_id: string;
  region: string;
  status: string;
  is_leader: number;
  leadership_epoch: number;
  last_heartbeat_at: string;
  metadata: string | null;
  created_at: string;
  updated_at: string;
}

interface LeaderLeaseRow {
  lease_id: string;
  node_id: string;
  epoch: number;
  acquired_at: string;
  expires_at: string;
  status: string;
  ttl_ms: number;
  fencing_token: number;
}

interface EpochRow {
  epoch: number;
  leader_node_id: string | null;
  started_at: string;
  ended_at: string | null;
  cause: string;
  fencing_token: number;
}

interface FailoverDecisionRow {
  decision_id: string;
  old_leader_node_id: string | null;
  new_leader_node_id: string | null;
  epoch: number;
  cause: string;
  outcome: string;
  decided_at: string;
  fencing_token: number;
}
