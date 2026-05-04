/**
 * SQLite HA Repository
 *
 * Implements HaRepository for single-node SQLite-backed HA state.
 */

import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import type {
  AtomicLeadershipAcquisitionResult,
  AtomicLeadershipCapableRepository,
  HaRepository,
  LeaderActionAuditEntry,
} from "./ha-repository.js";
import type {
  CoordinatorNode,
  CoordinatorNodeStatus,
  FailoverDecision,
  LeaderLease,
  LeadershipAcquisitionInput,
  LeadershipEpoch,
} from "./types.js";
import { DEFAULT_LEASE_TTL_MS } from "./types.js";
import { newId, nowIso } from "../../contracts/types/ids.js";

export class SqliteHaRepository implements HaRepository, AtomicLeadershipCapableRepository {
  constructor(private readonly db: AuthoritativeSqlDatabase) {}

  // Node Management

  async upsertNode(node: CoordinatorNode): Promise<void> {
    this.db.connection
      .prepare(
        `INSERT OR REPLACE INTO coordinator_nodes (node_id, region, status, is_leader, leadership_epoch, last_heartbeat_at, metadata, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        node.nodeId,
        node.region,
        node.status,
        node.isLeader ? 1 : 0,
        node.leadershipEpoch,
        node.lastHeartbeatAt,
        node.metadata != null ? JSON.stringify(node.metadata) : null,
        nowIso(),
        nowIso(),
      );
  }

  async getNode(nodeId: string): Promise<CoordinatorNode | undefined> {
    const row = this.db.connection
      .prepare(`SELECT * FROM coordinator_nodes WHERE node_id = ?`)
      .get(nodeId) as unknown as CoordinatorNodeRow | undefined;
    return row ? this.mapRowToNode(row) : undefined;
  }

  async listNodes(status?: CoordinatorNodeStatus): Promise<CoordinatorNode[]> {
    if (status) {
      return (this.db.connection
        .prepare(`SELECT * FROM coordinator_nodes WHERE status = ? ORDER BY last_heartbeat_at DESC`)
        .all(status) as unknown as CoordinatorNodeRow[]).map((r) => this.mapRowToNode(r));
    }
    return (this.db.connection
      .prepare(`SELECT * FROM coordinator_nodes ORDER BY last_heartbeat_at DESC`)
      .all() as unknown as CoordinatorNodeRow[]).map((r) => this.mapRowToNode(r));
  }

  async updateNodeHeartbeat(nodeId: string, status?: CoordinatorNodeStatus): Promise<void> {
    const now = nowIso();
    const updates: string[] = ["last_heartbeat_at = ?", "updated_at = ?"];
    const values: (string | number | null | Uint8Array)[] = [now, now];

    if (status) {
      updates.push("status = ?");
      values.push(status);
    }

    values.push(nodeId);
    this.db.connection
      .prepare(`UPDATE coordinator_nodes SET ${updates.join(", ")} WHERE node_id = ?`)
      .run(...values);
  }

  async deleteNode(nodeId: string): Promise<void> {
    this.db.connection
      .prepare(`DELETE FROM coordinator_nodes WHERE node_id = ?`)
      .run(nodeId);
  }

  // Lease Management

  async insertLease(lease: LeaderLease): Promise<void> {
    this.db.connection
      .prepare(
        `INSERT INTO leadership_leases (lease_id, node_id, epoch, acquired_at, expires_at, status, ttl_ms, fencing_token)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(lease.leaseId, lease.nodeId, lease.epoch, lease.acquiredAt, lease.expiresAt, lease.status, lease.ttlMs, 0);
  }

  async updateLeaseStatus(leaseId: string, status: LeaderLease["status"]): Promise<void> {
    this.db.connection
      .prepare(`UPDATE leadership_leases SET status = ? WHERE lease_id = ?`)
      .run(status, leaseId);
  }

  async updateLeaseExpiration(leaseId: string, expiresAt: string): Promise<void> {
    this.db.connection
      .prepare(`UPDATE leadership_leases SET expires_at = ? WHERE lease_id = ?`)
      .run(expiresAt, leaseId);
  }

  async getActiveLease(): Promise<LeaderLease | undefined> {
    const now = nowIso();
    const row = this.db.connection
      .prepare(`SELECT * FROM leadership_leases WHERE status = 'active' AND expires_at > ? ORDER BY acquired_at DESC LIMIT 1`)
      .get(now) as LeaderLeaseRow | undefined;
    return row ? this.mapRowToLease(row) : undefined;
  }

  async getLeaseByNodeId(nodeId: string): Promise<LeaderLease | undefined> {
    const row = this.db.connection
      .prepare(`SELECT * FROM leadership_leases WHERE node_id = ? AND status = 'active' ORDER BY acquired_at DESC LIMIT 1`)
      .get(nodeId) as LeaderLeaseRow | undefined;
    return row ? this.mapRowToLease(row) : undefined;
  }

  async getLeaseById(leaseId: string): Promise<LeaderLease | undefined> {
    const row = this.db.connection
      .prepare(`SELECT * FROM leadership_leases WHERE lease_id = ?`)
      .get(leaseId) as LeaderLeaseRow | undefined;
    return row ? this.mapRowToLease(row) : undefined;
  }

  async getExpiredLeases(): Promise<LeaderLease[]> {
    const now = nowIso();
    return (this.db.connection
      .prepare(`SELECT * FROM leadership_leases WHERE status = 'active' AND expires_at <= ?`)
      .all(now) as unknown as LeaderLeaseRow[]).map((r) => this.mapRowToLease(r));
  }

  async getActiveLeaseByNode(nodeId: string): Promise<LeaderLease | undefined> {
    const row = this.db.connection
      .prepare(`SELECT * FROM leadership_leases WHERE node_id = ? AND status = 'active' ORDER BY acquired_at DESC LIMIT 1`)
      .get(nodeId) as LeaderLeaseRow | undefined;
    return row ? this.mapRowToLease(row) : undefined;
  }

  // Epoch Management

  async insertEpoch(epoch: LeadershipEpoch): Promise<void> {
    this.db.connection
      .prepare(
        `INSERT INTO leadership_epochs (epoch, leader_node_id, started_at, ended_at, cause, fencing_token)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(epoch.epoch, epoch.leaderNodeId, epoch.startedAt, epoch.endedAt, epoch.cause, epoch.fencingToken);
  }

  async updateEpochEnd(epochNumber: number, endedAt: string, cause: string): Promise<void> {
    this.db.connection
      .prepare(`UPDATE leadership_epochs SET ended_at = ?, cause = ? WHERE epoch = ? AND ended_at IS NULL`)
      .run(endedAt, cause, epochNumber);
  }

  async getLatestEpoch(): Promise<LeadershipEpoch | undefined> {
    const row = this.db.connection
      .prepare(`SELECT * FROM leadership_epochs ORDER BY epoch DESC LIMIT 1`)
      .get() as EpochRow | undefined;
    return row ? this.mapRowToEpoch(row) : undefined;
  }

  async listEpochs(limit = 100): Promise<LeadershipEpoch[]> {
    return (this.db.connection
      .prepare(`SELECT * FROM leadership_epochs ORDER BY epoch DESC LIMIT ?`)
      .all(limit) as unknown as unknown[]).map((r) => this.mapRowToEpoch(r as EpochRow));
  }

  // Failover Decisions

  async insertFailoverDecision(decision: FailoverDecision): Promise<void> {
    this.db.connection
      .prepare(
        `INSERT INTO failover_decisions (decision_id, old_leader_node_id, new_leader_node_id, epoch, cause, outcome, decided_at, fencing_token)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
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
    return (this.db.connection
      .prepare(`SELECT * FROM failover_decisions ORDER BY decided_at DESC LIMIT ?`)
      .all(limit) as unknown as unknown[]).map((r) => this.mapRowToFailoverDecision(r as FailoverDecisionRow));
  }

  async purgeOldFailoverDecisions(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
    const result = this.db.connection
      .prepare(`DELETE FROM failover_decisions WHERE decided_at < ?`)
      .run(cutoffDate);
    return Number(result.changes ?? 0);
  }

  // Leader Action Audit

  async recordActionAudit(entry: LeaderActionAuditEntry): Promise<void> {
    this.db.connection
      .prepare(
        `INSERT INTO leader_action_audit (id, action_type, requesting_node_id, leader_node_id, epoch, fencing_token, authorized, reason_code, performed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
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

  async acquireLeadershipAtomically(
    input: LeadershipAcquisitionInput,
  ): Promise<AtomicLeadershipAcquisitionResult> {
    return this.db.transaction(() => {
      const { nodeId, ttlMs, forceAcquire = false } = input;
      const node = this.db.connection
        .prepare(`SELECT * FROM coordinator_nodes WHERE node_id = ?`)
        .get(nodeId) as CoordinatorNodeRow | undefined;
      if (!node) {
        throw new Error("Must register node before acquiring leadership");
      }

      const now = nowIso();
      const effectiveTtlMs = ttlMs ?? DEFAULT_LEASE_TTL_MS;
      const expiresAt = new Date(Date.now() + effectiveTtlMs).toISOString();
      const currentLeaderRow = this.db.connection
        .prepare(`SELECT * FROM coordinator_nodes WHERE is_leader = 1 LIMIT 1`)
        .get() as CoordinatorNodeRow | undefined;
      const currentLeader = currentLeaderRow ? this.mapRowToNode(currentLeaderRow) : null;
      const currentLeaderLeaseRow =
        currentLeader == null
          ? undefined
          : this.db.connection
            .prepare(`SELECT * FROM leadership_leases WHERE node_id = ? AND status = 'active' ORDER BY acquired_at DESC LIMIT 1`)
            .get(currentLeader.nodeId) as LeaderLeaseRow | undefined;
      const currentLeaderLease = currentLeaderLeaseRow ? this.mapRowToLease(currentLeaderLeaseRow) : null;
      const currentEpochRow = this.db.connection
        .prepare(`SELECT * FROM leadership_epochs ORDER BY epoch DESC LIMIT 1`)
        .get() as EpochRow | undefined;
      const currentEpoch = currentEpochRow
        ? this.mapRowToEpoch(currentEpochRow)
        : {
          epoch: 0,
          leaderNodeId: null,
          startedAt: now,
          endedAt: null,
          cause: "acquired" as const,
          fencingToken: 0,
        };

      if (currentLeader && !forceAcquire && currentLeaderLease && currentLeader.nodeId !== nodeId) {
        const isExpired = new Date(currentLeaderLease.expiresAt) <= new Date(now);
        if (!isExpired) {
          return {
            acquired: false,
            lease: null,
            epoch: currentEpoch.epoch,
            fencingToken: currentEpoch.fencingToken,
            cause: "leadership_held_by_another_node",
          };
        }
      }

      const newEpoch = currentEpoch.epoch + 1;
      const newFencingToken = currentEpoch.fencingToken + 1;
      const lease: LeaderLease = {
        leaseId: newId("llease"),
        nodeId,
        epoch: newEpoch,
        acquiredAt: now,
        expiresAt,
        status: "active",
        ttlMs: effectiveTtlMs,
      };

      this.db.connection
        .prepare(`UPDATE coordinator_nodes SET is_leader = 0 WHERE is_leader = 1`)
        .run();
      this.db.connection
        .prepare(`UPDATE leadership_leases SET status = 'expired' WHERE status = 'active'`)
        .run();

      if (currentEpoch.epoch > 0) {
        this.db.connection
          .prepare(`UPDATE leadership_epochs SET ended_at = ?, cause = ? WHERE epoch = ? AND ended_at IS NULL`)
          .run(now, forceAcquire ? "preempted" : "expired", currentEpoch.epoch);
      }

      this.db.connection
        .prepare(
          `INSERT INTO leadership_leases (lease_id, node_id, epoch, acquired_at, expires_at, status, ttl_ms, fencing_token)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(lease.leaseId, lease.nodeId, lease.epoch, lease.acquiredAt, lease.expiresAt, lease.status, lease.ttlMs, newFencingToken);
      this.db.connection
        .prepare(`UPDATE coordinator_nodes SET is_leader = 1, leadership_epoch = ? WHERE node_id = ?`)
        .run(newEpoch, nodeId);
      this.db.connection
        .prepare(
          `INSERT INTO leadership_epochs (epoch, leader_node_id, started_at, ended_at, cause, fencing_token)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(newEpoch, nodeId, now, null, forceAcquire ? "preempted" : "acquired", newFencingToken);

      if (currentLeader && currentLeader.nodeId !== nodeId) {
        this.db.connection
          .prepare(
            `INSERT INTO failover_decisions (decision_id, old_leader_node_id, new_leader_node_id, epoch, cause, outcome, decided_at, fencing_token)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            newId("failover"),
            currentLeader.nodeId,
            nodeId,
            newEpoch,
            forceAcquire ? "epoch_preempted" : "voluntary",
            "leader_changed",
            now,
            newFencingToken,
          );
      }

      return {
        acquired: true,
        lease,
        epoch: newEpoch,
        fencingToken: newFencingToken,
      };
    });
  }

  // Stale Detection

  async getStaleNodes(thresholdMs: number): Promise<CoordinatorNode[]> {
    const thresholdDate = new Date(Date.now() - thresholdMs).toISOString();
    return (this.db.connection
      .prepare(`SELECT * FROM coordinator_nodes WHERE last_heartbeat_at < ?`)
      .all(thresholdDate) as unknown as unknown[]).map((r) => this.mapRowToNode(r as CoordinatorNodeRow));
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
      metadata: row.metadata != null ? JSON.parse(row.metadata as string) : null,
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

// Row types matching SQLite schema
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
