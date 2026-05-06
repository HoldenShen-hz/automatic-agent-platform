/**
 * @fileoverview HA Coordinator and Leader Election Service
 *
 * Provides:
 * - Multi-coordinator leader election with authoritative backend
 * - Leadership epoch tracking and fencing
 * - Failover decision making
 * - Follower restriction enforcement for leader-authority-only actions
 *
 * @see docs_zh/contracts/ha_coordinator_and_leader_election_contract.md
 * @see docs_zh/contracts/task_lease_and_fencing_contract.md
 */

import { newId, nowIso } from "../../contracts/types/ids.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import { RuntimeError } from "../../contracts/errors.js";
import {
  mapEpoch,
  mapFailoverDecision,
  mapLease,
  mapNode,
} from "./mappers.js";
import {
  DEFAULT_LEASE_TTL_MS,
  EPOCH_FENCING_TOKEN_START,
  HA_COORDINATOR_DDL,
  MAX_LEASE_TTL_MS,
  MIN_LEASE_TTL_MS,
  type CoordinatorNode,
  type CoordinatorNodeStatus,
  type FailoverDecision,
  type HaCoordinatorServiceOptions,
  type LeaderActionAuthorization,
  type LeaderActionAuthority,
  type LeaderLease,
  type LeadershipAcquisitionInput,
  type LeadershipEpoch,
  type LeadershipQueryResult,
  type LeadershipRenewalInput,
  type RawRow,
} from "./types.js";

export {
  DEFAULT_LEASE_TTL_MS,
  EPOCH_FENCING_TOKEN_START,
  HA_COORDINATOR_DDL,
  MAX_LEASE_TTL_MS,
  MIN_LEASE_TTL_MS,
} from "./types.js";
export type {
  CoordinatorNode,
  CoordinatorNodeStatus,
  FailoverDecision,
  HaCoordinatorServiceOptions,
  LeaderActionAuthorization,
  LeaderActionAuthority,
  LeaderLease,
  LeadershipAcquisitionInput,
  LeadershipEpoch,
  LeadershipQueryResult,
  LeadershipRenewalInput,
} from "./types.js";

// ── Service ─────────────────────────────────────────────────────────

/**
 * Singleton instance of HaCoordinatorService for leader authority checks.
 * R4-36 fix: Wired into write paths to enforce leader-only authorization.
 */
let _haCoordinatorInstance: HaCoordinatorService | null = null;

/**
 * Gets the singleton HA Coordinator instance.
 * Throws if no instance has been set via setHaCoordinatorInstance().
 */
export function getHaCoordinatorInstance(): HaCoordinatorService {
  if (!_haCoordinatorInstance) {
    throw new Error("HA Coordinator not initialized. Call setHaCoordinatorInstance() first.");
  }
  return _haCoordinatorInstance;
}

/**
 * Sets the singleton HA Coordinator instance.
 * Should be called during application startup.
 */
export function setHaCoordinatorInstance(db: AuthoritativeSqlDatabase, options?: HaCoordinatorServiceOptions): HaCoordinatorService {
  _haCoordinatorInstance = new HaCoordinatorService(db, options);
  return _haCoordinatorInstance;
}

export class HaCoordinatorService {
  private readonly defaultTtlMs: number;
  private readonly strictLeaderAuthority: boolean;

  constructor(
    private readonly db: AuthoritativeSqlDatabase,
    options?: HaCoordinatorServiceOptions,
  ) {
    this.defaultTtlMs = options?.defaultTtlMs ?? DEFAULT_LEASE_TTL_MS;
    this.strictLeaderAuthority = options?.strictLeaderAuthority ?? true;
  }

  // ── Node Management ────────────────────────────────────────────────

  registerNode(nodeId: string, region: string, metadata?: Record<string, unknown>): CoordinatorNode {
    return this.db.transaction(() => {
      const now = nowIso();
      const existing = this.getNode(nodeId);

      const node: CoordinatorNode = {
        nodeId,
        region,
        status: "active",
        isLeader: existing?.isLeader ?? false,
        leadershipEpoch: existing?.leadershipEpoch ?? 0,
        lastHeartbeatAt: now,
        metadata: metadata ?? null,
      };

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
          node.metadata ? JSON.stringify(node.metadata) : null,
          existing?.lastHeartbeatAt ?? now,
          now,
        );

      return this.getNode(nodeId)!;
    });
  }

  getNode(nodeId: string): CoordinatorNode | null {
    const row = this.db.connection
      .prepare(`SELECT * FROM coordinator_nodes WHERE node_id = ?`)
      .get(nodeId) as RawRow | undefined;
    return row ? mapNode(row) : null;
  }

  listNodes(status?: CoordinatorNodeStatus): CoordinatorNode[] {
    if (status) {
      return (this.db.connection
        .prepare(`SELECT * FROM coordinator_nodes WHERE status = ? ORDER BY last_heartbeat_at DESC`)
        .all(status) as RawRow[]).map((r) => mapNode(r));
    }
    return (this.db.connection
      .prepare(`SELECT * FROM coordinator_nodes ORDER BY last_heartbeat_at DESC`)
      .all() as RawRow[]).map((r) => mapNode(r));
  }

  updateNodeHeartbeat(nodeId: string, status?: CoordinatorNodeStatus): CoordinatorNode | null {
    const now = nowIso();
    const updates: string[] = ["last_heartbeat_at = ?", "updated_at = ?"];
    const values: unknown[] = [now, now];

    if (status) {
      updates.push("status = ?");
      values.push(status);
    }

    values.push(nodeId);
    this.db.connection
      .prepare(`UPDATE coordinator_nodes SET ${updates.join(", ")} WHERE node_id = ?`)
      .run(...(values as (string | number | null | Uint8Array)[]));

    return this.getNode(nodeId);
  }

  removeNode(nodeId: string): boolean {
    return this.db.transaction(() => {
      const node = this.getNode(nodeId);
      if (!node) {
        return false;
      }

      if (node.isLeader) {
        const now = nowIso();
        this.db.connection
          .prepare(`UPDATE coordinator_nodes SET is_leader = 0, status = 'offline' WHERE node_id = ?`)
          .run(nodeId);
        this.db.connection
          .prepare(`UPDATE leadership_leases SET status = 'expired' WHERE node_id = ? AND status = 'active'`)
          .run(nodeId);
        this.db.connection
          .prepare(`UPDATE leadership_epochs SET ended_at = ?, cause = 'expired' WHERE leader_node_id = ? AND ended_at IS NULL`)
          .run(now, nodeId);
      }

      this.db.connection
        .prepare(`DELETE FROM leadership_leases WHERE node_id = ?`)
        .run(nodeId);

      const result = this.db.connection
        .prepare(`DELETE FROM coordinator_nodes WHERE node_id = ?`)
        .run(nodeId);
      return Number(result.changes) > 0;
    });
  }

  // ── Leadership Election ────────────────────────────────────────────

  /**
   * Attempt to acquire leadership. If forceAcquire is true, preempt any existing leader.
   */
  acquireLeadership(input: LeadershipAcquisitionInput): {
    acquired: boolean;
    lease: LeaderLease | null;
    epoch: number;
    fencingToken: number;
    cause?: string;
  } {
    return this.db.transaction(() => {
      const { nodeId, ttlMs = this.defaultTtlMs, forceAcquire = false } = input;
      const node = this.getNode(nodeId);
      if (!node) {
        throw new RuntimeError("ha_coordinator.node_not_found", "Must register node before acquiring leadership", {
          details: { nodeId },
        });
      }

      const effectiveTtl = Math.min(MAX_LEASE_TTL_MS, Math.max(MIN_LEASE_TTL_MS, ttlMs));
      const now = nowIso();
      const expiresAt = new Date(Date.now() + effectiveTtl).toISOString();

      // Check existing leadership
      const currentLeader = this.getCurrentLeader();
      const currentEpoch = this.getLatestEpoch();
      const currentLeaderLease = currentLeader == null ? null : this.getLeaseByNodeId(currentLeader.nodeId);

      if (currentLeader && !forceAcquire) {
        if (currentLeader.status !== "active") {
          this.db.connection
            .prepare(`UPDATE coordinator_nodes SET is_leader = 0 WHERE node_id = ?`)
            .run(currentLeader.nodeId);
          if (currentLeaderLease) {
            this.db.connection
              .prepare(`UPDATE leadership_leases SET status = 'expired' WHERE lease_id = ?`)
              .run(currentLeaderLease.leaseId);
          }
          this.db.connection
            .prepare(`UPDATE leadership_epochs SET ended_at = ?, cause = 'expired' WHERE leader_node_id = ? AND ended_at IS NULL`)
            .run(now, currentLeader.nodeId);
        } else if (currentLeaderLease && currentLeaderLease.nodeId !== nodeId) {
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
      }

      // Increment epoch for new leadership
      const newEpoch = currentEpoch.epoch + 1;
      const newFencingToken = this.nextFencingToken();

      // Create new lease
      const leaseId = newId("llease");
      const lease: LeaderLease = {
        leaseId,
        nodeId,
        epoch: newEpoch,
        acquiredAt: now,
        expiresAt,
        status: "active",
        ttlMs: effectiveTtl,
      };

      // Demote any existing leader
      this.db.connection
        .prepare(`UPDATE coordinator_nodes SET is_leader = 0 WHERE is_leader = 1`)
        .run();

      // Insert new lease
      this.db.connection
        .prepare(
          `INSERT INTO leadership_leases (lease_id, node_id, epoch, acquired_at, expires_at, status, ttl_ms, fencing_token)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(lease.leaseId, lease.nodeId, lease.epoch, lease.acquiredAt, lease.expiresAt, lease.status, lease.ttlMs, newFencingToken);

      // Promote new leader
      this.db.connection
        .prepare(`UPDATE coordinator_nodes SET is_leader = 1, leadership_epoch = ? WHERE node_id = ?`)
        .run(newEpoch, nodeId);

      // Record epoch transition
      this.db.connection
        .prepare(
          `INSERT INTO leadership_epochs (epoch, leader_node_id, started_at, cause, fencing_token)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(newEpoch, nodeId, now, forceAcquire ? "preempted" : "acquired", newFencingToken);

      // Record failover decision if leadership changed
      if (currentLeader && currentLeader.nodeId !== nodeId) {
        const decision: FailoverDecision = {
          decisionId: newId("failover"),
          oldLeaderNodeId: currentLeader.nodeId,
          newLeaderNodeId: nodeId,
          epoch: newEpoch,
          cause: forceAcquire ? "epoch_preempted" : "voluntary",
          outcome: "leader_changed",
          decidedAt: now,
          fencingToken: newFencingToken,
        };
        this.db.connection
          .prepare(
            `INSERT INTO failover_decisions (decision_id, old_leader_node_id, new_leader_node_id, epoch, cause, outcome, decided_at, fencing_token)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(decision.decisionId, decision.oldLeaderNodeId, decision.newLeaderNodeId, decision.epoch, decision.cause, decision.outcome, decision.decidedAt, decision.fencingToken);
      }

      return {
        acquired: true,
        lease,
        epoch: newEpoch,
        fencingToken: newFencingToken,
      };
    });
  }

  renewLeadership(input: LeadershipRenewalInput): {
    renewed: boolean;
    lease: LeaderLease | null;
    fencingToken: number;
  } {
    return this.db.transaction(() => {
      const { nodeId, ttlMs = this.defaultTtlMs } = input;
      const node = this.getNode(nodeId);
      if (!node) {
        throw new RuntimeError("ha_coordinator.node_not_found", "Node not found", {
          details: { nodeId },
        });
      }

      const currentLease = this.getActiveLease();
      if (!currentLease || currentLease.nodeId !== nodeId) {
        return { renewed: false, lease: null, fencingToken: 0 };
      }

      const effectiveTtl = Math.min(MAX_LEASE_TTL_MS, Math.max(MIN_LEASE_TTL_MS, ttlMs));
      const now = nowIso();
      const expiresAt = new Date(Date.now() + effectiveTtl).toISOString();

      // Update lease expiration
      this.db.connection
        .prepare(`UPDATE leadership_leases SET expires_at = ?, ttl_ms = ? WHERE lease_id = ? AND status = 'active'`)
        .run(expiresAt, effectiveTtl, currentLease.leaseId);

      // Update node heartbeat
      this.updateNodeHeartbeat(nodeId);

      // §209-2464: Get latestEpoch before using - stale-write verification
      // requires the current epoch token to detect writes from previous leadership cycles
      const latestEpoch = this.getLatestEpoch();

      const updatedLease: LeaderLease = {
        ...currentLease,
        expiresAt,
        ttlMs: effectiveTtl,
      };

      return {
        renewed: true,
        lease: updatedLease,
        fencingToken: latestEpoch.fencingToken,
      };
    });
  }

  releaseLeadership(nodeId: string): boolean {
    return this.db.transaction(() => {
      const node = this.getNode(nodeId);
      if (!node || !node.isLeader) {
        return false;
      }

      const now = nowIso();

      // Mark lease as released
      this.db.connection
        .prepare(`UPDATE leadership_leases SET status = 'released' WHERE node_id = ? AND status = 'active'`)
        .run(nodeId);

      // Demote leader
      this.db.connection
        .prepare(`UPDATE coordinator_nodes SET is_leader = 0 WHERE node_id = ?`)
        .run(nodeId);

      // Record epoch end
      const latestEpoch = this.getLatestEpoch();
      this.db.connection
        .prepare(`UPDATE leadership_epochs SET ended_at = ?, cause = 'voluntary' WHERE epoch = ? AND ended_at IS NULL`)
        .run(now, latestEpoch.epoch);

      return true;
    });
  }

  getCurrentLeader(): CoordinatorNode | null {
    const row = this.db.connection
      .prepare(`SELECT * FROM coordinator_nodes WHERE is_leader = 1 LIMIT 1`)
      .get() as RawRow | undefined;
    return row ? mapNode(row) : null;
  }

  getActiveLease(): LeaderLease | null {
    const now = nowIso();
    const row = this.db.connection
      .prepare(`SELECT * FROM leadership_leases WHERE status = 'active' AND expires_at > ? ORDER BY acquired_at DESC LIMIT 1`)
      .get(now) as RawRow | undefined;
    return row ? mapLease(row) : null;
  }

  private getLeaseByNodeId(nodeId: string): LeaderLease | null {
    const row = this.db.connection
      .prepare(`SELECT * FROM leadership_leases WHERE node_id = ? AND status = 'active' ORDER BY acquired_at DESC LIMIT 1`)
      .get(nodeId) as RawRow | undefined;
    return row ? mapLease(row) : null;
  }

  queryLeadership(): LeadershipQueryResult {
    const leader = this.getCurrentLeader();
    const activeLease = this.getActiveLease();
    const latestEpoch = this.getLatestEpoch();
    const now = new Date();

    if (!leader || !activeLease) {
      return {
        isLeader: false,
        leaderNodeId: null,
        epoch: latestEpoch.epoch,
        fencingToken: latestEpoch.fencingToken,
        expiresAt: null,
        isExpired: true,
      };
    }

    const isExpired = new Date(activeLease.expiresAt) <= now;

    return {
      isLeader: !isExpired,
      leaderNodeId: leader.nodeId,
      epoch: latestEpoch.epoch,
      fencingToken: latestEpoch.fencingToken,
      expiresAt: activeLease.expiresAt,
      isExpired,
    };
  }

  // ── Leader Authority Verification ─────────────────────────────────

  /**
   * Check if a node is authorized to perform a leader-authority-only action.
   * In strict mode, only the current leader can perform such actions.
   */
  authorizeAction(
    requestingNodeId: string,
    actionType: string,
    requiredAuthority: LeaderActionAuthority,
  ): LeaderActionAuthorization {
    const now = nowIso();
    const node = this.getNode(requestingNodeId);
    const leader = this.getCurrentLeader();
    const latestEpoch = this.getLatestEpoch();
    const activeLease = this.getActiveLease();

    if (!node) {
      return {
        authorized: false,
        authority: requiredAuthority,
        reasonCode: "node_not_found",
        leaderNodeId: leader?.nodeId ?? null,
        epoch: latestEpoch.epoch,
        fencingToken: latestEpoch.fencingToken,
      };
    }

    // Any node can perform "any" authority actions
    if (requiredAuthority === "any") {
      this.recordActionAudit(actionType, requestingNodeId, leader?.nodeId ?? null, latestEpoch.epoch, latestEpoch.fencingToken, true, "ok");
      return {
        authorized: true,
        authority: requiredAuthority,
        reasonCode: "ok",
        leaderNodeId: leader?.nodeId ?? null,
        epoch: latestEpoch.epoch,
        fencingToken: latestEpoch.fencingToken,
      };
    }

    // Followers can perform "follower_allowed" actions
    if (requiredAuthority === "follower_allowed") {
      this.recordActionAudit(actionType, requestingNodeId, leader?.nodeId ?? null, latestEpoch.epoch, latestEpoch.fencingToken, true, "follower_allowed");
      return {
        authorized: true,
        authority: requiredAuthority,
        reasonCode: "follower_allowed",
        leaderNodeId: leader?.nodeId ?? null,
        epoch: latestEpoch.epoch,
        fencingToken: latestEpoch.fencingToken,
      };
    }

    // Leader-only actions require strict verification
    if (requiredAuthority === "leader_only") {
      if (!this.strictLeaderAuthority) {
        this.recordActionAudit(actionType, requestingNodeId, leader?.nodeId ?? null, latestEpoch.epoch, latestEpoch.fencingToken, true, "strict_leader_authority_disabled");
        return {
          authorized: true,
          authority: requiredAuthority,
          reasonCode: "strict_leader_authority_disabled",
          leaderNodeId: leader?.nodeId ?? null,
          epoch: latestEpoch.epoch,
          fencingToken: latestEpoch.fencingToken,
        };
      }

      if (!leader) {
        this.recordActionAudit(actionType, requestingNodeId, null, latestEpoch.epoch, latestEpoch.fencingToken, false, "no_active_leader");
        return {
          authorized: false,
          authority: requiredAuthority,
          reasonCode: "no_active_leader",
          leaderNodeId: null,
          epoch: latestEpoch.epoch,
          fencingToken: latestEpoch.fencingToken,
        };
      }

      if (leader.nodeId !== requestingNodeId) {
        this.recordActionAudit(actionType, requestingNodeId, leader.nodeId, latestEpoch.epoch, latestEpoch.fencingToken, false, "not_current_leader");
        return {
          authorized: false,
          authority: requiredAuthority,
          reasonCode: "not_current_leader",
          leaderNodeId: leader.nodeId,
          epoch: latestEpoch.epoch,
          fencingToken: latestEpoch.fencingToken,
        };
      }

      // R29-16 FIX: Add explicit null check for activeLease.
      // Root cause: When activeLease is null, the condition `activeLease && ...` short-circuits
      // to false, causing the code to fall through and grant authorization at line 545.
      // This is wrong - if there's no active lease, authorization must be DENIED.
      if (!activeLease) {
        this.recordActionAudit(actionType, requestingNodeId, leader.nodeId, latestEpoch.epoch, latestEpoch.fencingToken, false, "no_active_lease");
        return {
          authorized: false,
          authority: requiredAuthority,
          reasonCode: "no_active_lease",
          leaderNodeId: leader.nodeId,
          epoch: latestEpoch.epoch,
          fencingToken: latestEpoch.fencingToken,
        };
      }

      // Check if lease is still valid
      if (new Date(activeLease.expiresAt) <= new Date(now)) {
        this.recordActionAudit(actionType, requestingNodeId, leader.nodeId, latestEpoch.epoch, latestEpoch.fencingToken, false, "leadership_lease_expired");
        return {
          authorized: false,
          authority: requiredAuthority,
          reasonCode: "leadership_lease_expired",
          leaderNodeId: leader.nodeId,
          epoch: latestEpoch.epoch,
          fencingToken: latestEpoch.fencingToken,
        };
      }

      this.recordActionAudit(actionType, requestingNodeId, leader.nodeId, latestEpoch.epoch, latestEpoch.fencingToken, true, "ok");
      return {
        authorized: true,
        authority: requiredAuthority,
        reasonCode: "ok",
        leaderNodeId: leader.nodeId,
        epoch: latestEpoch.epoch,
        fencingToken: latestEpoch.fencingToken,
      };
    }

    return {
      authorized: false,
      authority: requiredAuthority,
      reasonCode: "unknown_authority_requirement",
      leaderNodeId: leader?.nodeId ?? null,
      epoch: latestEpoch.epoch,
      fencingToken: latestEpoch.fencingToken,
    };
  }

  // ── Epoch Management ───────────────────────────────────────────────

  getLatestEpoch(): LeadershipEpoch {
    const row = this.db.connection
      .prepare(`SELECT * FROM leadership_epochs ORDER BY epoch DESC LIMIT 1`)
      .get() as RawRow | undefined;

    if (row) {
      return mapEpoch(row);
    }

    // No epochs yet - return epoch 0
    return {
      epoch: 0,
      leaderNodeId: null,
      startedAt: nowIso(),
      endedAt: null,
      cause: "acquired",
      fencingToken: 0,
    };
  }

  listEpochs(limit = 100): LeadershipEpoch[] {
    return (this.db.connection
      .prepare(`SELECT * FROM leadership_epochs ORDER BY epoch DESC LIMIT ?`)
      .all(limit) as RawRow[]).map((r) => mapEpoch(r));
  }

  // ── Failover ───────────────────────────────────────────────────────

  /**
   * Perform a failover, selecting a new leader from active nodes.
   */
  triggerFailover(cause: FailoverDecision["cause"], forceNodeId?: string): FailoverDecision {
    return this.db.transaction(() => {
      const now = nowIso();
      const currentLeader = this.getCurrentLeader();
      const latestEpoch = this.getLatestEpoch();

      let newLeaderNodeId: string | null = null;
      let outcome: FailoverDecision["outcome"] = "no_change";

      if (forceNodeId) {
        // Explicitly promote a specific node
        newLeaderNodeId = forceNodeId;
        outcome = "leader_changed";
      } else {
        // Find eligible follower
        const candidates = this.listNodes("active").filter((n) => n.nodeId !== currentLeader?.nodeId);
        if (candidates.length > 0) {
          // Select by lowest nodeId (deterministic selection)
          candidates.sort((a, b) => a.nodeId.localeCompare(b.nodeId));
          newLeaderNodeId = candidates[0]!.nodeId;
          outcome = "leader_changed";
        } else {
          outcome = "no_candidate";
        }
      }

      if (outcome === "leader_changed" && newLeaderNodeId) {
        // Demote old leader
        if (currentLeader) {
          this.db.connection
            .prepare(`UPDATE coordinator_nodes SET is_leader = 0 WHERE node_id = ?`)
            .run(currentLeader.nodeId);

          // Mark old lease as expired
          this.db.connection
            .prepare(`UPDATE leadership_leases SET status = 'expired' WHERE node_id = ? AND status = 'active'`)
            .run(currentLeader.nodeId);
        }

        // Acquire leadership for new leader
        this.acquireLeadership({ nodeId: newLeaderNodeId, forceAcquire: true });
      }

      const decision: FailoverDecision = {
        decisionId: newId("failover"),
        oldLeaderNodeId: currentLeader?.nodeId ?? null,
        newLeaderNodeId,
        epoch: latestEpoch.epoch + (outcome === "leader_changed" ? 1 : 0),
        cause,
        outcome,
        decidedAt: now,
        fencingToken: latestEpoch.fencingToken,
      };

      if (outcome === "leader_changed") {
        this.db.connection
          .prepare(
            `INSERT INTO failover_decisions (decision_id, old_leader_node_id, new_leader_node_id, epoch, cause, outcome, decided_at, fencing_token)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(decision.decisionId, decision.oldLeaderNodeId, decision.newLeaderNodeId, decision.epoch, decision.cause, decision.outcome, decision.decidedAt, decision.fencingToken);
      }

      return decision;
    });
  }

  getFailoverHistory(limit = 100): FailoverDecision[] {
    return (this.db.connection
      .prepare(`SELECT * FROM failover_decisions ORDER BY decided_at DESC LIMIT ?`)
      .all(limit) as RawRow[]).map((r) => mapFailoverDecision(r));
  }

  // ── Stale Write Rejection ──────────────────────────────────────────

  /**
   * Verify that a write operation comes from the current epoch.
   * Returns true if the write is valid (current fencing token matches).
   */
  verifyWriteAuthority(presentedFencingToken: number): boolean {
    const latestEpoch = this.getLatestEpoch();
    // P0-2133: Use > instead of >= to reject stale writes. An old leader possessing
    // the current token must be rejected; only a token GREATER than current indicates
    // a newer epoch. Using >= would allow a stale leader with the same token to write.
    return presentedFencingToken > latestEpoch.fencingToken;
  }

  /**
   * Gets all expired leases (status = "active" but expires_at <= now).
   * Used by LeaseReclaimerService to find leases that need reclamation.
   */
  getExpiredLeaseRows(): LeaderLease[] {
    const now = nowIso();
    const rows = this.db.connection
      .prepare(`SELECT * FROM leadership_leases WHERE status = 'active' AND expires_at <= ? ORDER BY acquired_at DESC`)
      .all(now) as RawRow[];
    return rows.map((r) => mapLease(r));
  }

  // ── Cleanup ────────────────────────────────────────────────────────

  purgeExpiredLeases(): number {
    const now = nowIso();
    const result = this.db.connection
      .prepare(`UPDATE leadership_leases SET status = 'expired' WHERE status = 'active' AND expires_at <= ?`)
      .run(now);
    return Number(result.changes) as number;
  }

  /**
   * Expires a specific lease by updating its status to "expired".
   * Used by LeaseReclaimerService when reclaiming expired leases.
   */
  expireLease(leaseId: string): void {
    this.db.connection
      .prepare(`UPDATE leadership_leases SET status = 'expired' WHERE lease_id = ?`)
      .run(leaseId);
  }

  purgeOldFailoverDecisions(olderThanDays = 7): number {
    const cutoff = new Date(Date.now() - olderThanDays * 86400 * 1000).toISOString();
    const result = this.db.connection
      .prepare(`DELETE FROM failover_decisions WHERE decided_at < ?`)
      .run(cutoff);
    return Number(result.changes) as number;
  }

  // ── Helpers ───────────────────────────────────────────────────────

  // §209-2466: Use MAX(fencing_token)+1 from DB instead of in-memory counter
  // In-memory counter resets on restart, allowing token reuse and stale-write attacks
  private nextFencingToken(): number {
    const row = this.db.connection
      .prepare(`SELECT MAX(fencing_token) as max_token FROM leadership_epochs`)
      .get() as { max_token: number } | undefined;
    const maxToken = row?.max_token ?? EPOCH_FENCING_TOKEN_START - 1;
    return maxToken + 1;
  }

  private recordActionAudit(
    actionType: string,
    requestingNodeId: string,
    leaderNodeId: string | null,
    epoch: number,
    fencingToken: number,
    authorized: boolean,
    reasonCode: string,
  ): void {
    const id = newId("leaderact");
    const now = nowIso();
    this.db.connection
      .prepare(
        `INSERT INTO leader_action_audit (id, action_type, requesting_node_id, leader_node_id, epoch, fencing_token, authorized, reason_code, performed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, actionType, requestingNodeId, leaderNodeId, epoch, fencingToken, authorized ? 1 : 0, reasonCode, now);
  }
}

// ── Leader Authority Helper ─────────────────────────────────────────

import { LeaderAuthorityError } from "../../contracts/errors.js";

/**
 * Asserts that the given node is the current leader and authorized to perform
 * leader-only actions. Throws LeaderAuthorityError if not authorized.
 *
 * R4-36 fix: This helper wires HACoordinator.authorizeAction into write paths
 * to enforce that only the current leader can perform write operations.
 *
 * @param nodeId - The node ID requesting authorization
 * @param actionType - The action type being authorized (for audit logging)
 * @throws LeaderAuthorityError if the node is not the current leader
 */
export function assertLeaderAuthoritative(nodeId: string, actionType: string): void {
  const coordinator = getHaCoordinatorInstance();
  const auth = coordinator.authorizeAction(nodeId, actionType, "leader_only");
  if (!auth.authorized) {
    throw new LeaderAuthorityError(
      "ha.leader_authority_required",
      `Node ${nodeId} not authorized for ${actionType}: ${auth.reasonCode}`,
      {
        details: {
          nodeId,
          actionType,
          reasonCode: auth.reasonCode,
          leaderNodeId: auth.leaderNodeId,
          epoch: auth.epoch,
        },
      },
    );
  }
}
