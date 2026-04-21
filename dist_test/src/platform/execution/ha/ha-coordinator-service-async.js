/**
 * @fileoverview Async HA Coordinator Service using Repository Pattern
 *
 * This is the async version of HaCoordinatorService that uses HaRepository
 * for data access, enabling both SQLite and PostgreSQL backends.
 *
 * Provides:
 * - Multi-coordinator leader election with authoritative backend
 * - Leadership epoch tracking and fencing
 * - Failover decision making
 * - Follower restriction enforcement for leader-authority-only actions
 */
import { newId, nowIso } from "../../contracts/types/ids.js";
import { DEFAULT_LEASE_TTL_MS, EPOCH_FENCING_TOKEN_START, MAX_LEASE_TTL_MS, MIN_LEASE_TTL_MS } from "./types.js";
export { DEFAULT_LEASE_TTL_MS, EPOCH_FENCING_TOKEN_START, MAX_LEASE_TTL_MS, MIN_LEASE_TTL_MS };
export class HaCoordinatorServiceAsync {
    repo;
    defaultTtlMs;
    strictLeaderAuthority;
    fencingTokenCounter;
    coordinatorId;
    constructor(repo, options) {
        this.repo = repo;
        this.defaultTtlMs = options?.defaultTtlMs ?? DEFAULT_LEASE_TTL_MS;
        this.strictLeaderAuthority = options?.strictLeaderAuthority ?? true;
        this.fencingTokenCounter = { value: EPOCH_FENCING_TOKEN_START };
        this.coordinatorId = options?.coordinatorId ?? newId("coord");
    }
    // ── Node Management ────────────────────────────────────────────────
    async registerNode(nodeId, region, metadata) {
        const now = nowIso();
        const existing = await this.repo.getNode(nodeId);
        const node = {
            nodeId,
            region,
            status: "active",
            isLeader: existing?.isLeader ?? false,
            leadershipEpoch: existing?.leadershipEpoch ?? 0,
            lastHeartbeatAt: now,
            metadata: metadata ?? null,
        };
        await this.repo.upsertNode(node);
        return (await this.repo.getNode(nodeId));
    }
    async getNode(nodeId) {
        return (await this.repo.getNode(nodeId)) ?? null;
    }
    async listNodes(status) {
        return this.repo.listNodes(status);
    }
    async updateNodeHeartbeat(nodeId, status) {
        await this.repo.updateNodeHeartbeat(nodeId, status);
        return (await this.repo.getNode(nodeId)) ?? null;
    }
    async removeNode(nodeId) {
        const node = await this.repo.getNode(nodeId);
        if (node?.isLeader) {
            await this.repo.upsertNode({ ...node, isLeader: false, status: "offline" });
        }
        await this.repo.deleteNode(nodeId);
        return true;
    }
    // ── Leadership Election ────────────────────────────────────────────
    async acquireLeadership(input) {
        const { nodeId, ttlMs = this.defaultTtlMs, forceAcquire = false } = input;
        const node = await this.getNode(nodeId);
        if (!node) {
            throw new Error("Must register node before acquiring leadership");
        }
        const effectiveTtl = Math.min(MAX_LEASE_TTL_MS, Math.max(MIN_LEASE_TTL_MS, ttlMs));
        const now = nowIso();
        const expiresAt = new Date(Date.now() + effectiveTtl).toISOString();
        const currentLeader = await this.getCurrentLeader();
        const currentEpoch = await this.getLatestEpoch();
        if (currentLeader && !forceAcquire) {
            const existingLease = await this.getActiveLease();
            if (existingLease && existingLease.nodeId !== nodeId) {
                const isExpired = new Date(existingLease.expiresAt) <= new Date(now);
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
        const newEpoch = currentEpoch.epoch + 1;
        const newFencingToken = this.nextFencingToken();
        const leaseId = newId("llease");
        const lease = {
            leaseId,
            nodeId,
            epoch: newEpoch,
            acquiredAt: now,
            expiresAt,
            status: "active",
            ttlMs: effectiveTtl,
        };
        // Update all nodes to demote any existing leader
        const allNodes = await this.listNodes();
        for (const n of allNodes) {
            if (n.isLeader) {
                await this.repo.upsertNode({ ...n, isLeader: false });
            }
        }
        await this.repo.insertLease(lease);
        const updatedNode = (await this.repo.getNode(nodeId));
        await this.repo.upsertNode({ ...updatedNode, isLeader: true, leadershipEpoch: newEpoch });
        const epochRecord = {
            epoch: newEpoch,
            leaderNodeId: nodeId,
            startedAt: now,
            endedAt: null,
            cause: forceAcquire ? "preempted" : "acquired",
            fencingToken: newFencingToken,
        };
        await this.repo.insertEpoch(epochRecord);
        if (currentLeader && currentLeader.nodeId !== nodeId) {
            const decision = {
                decisionId: newId("failover"),
                oldLeaderNodeId: currentLeader.nodeId,
                newLeaderNodeId: nodeId,
                epoch: newEpoch,
                cause: forceAcquire ? "epoch_preempted" : "voluntary",
                outcome: "leader_changed",
                decidedAt: now,
                fencingToken: newFencingToken,
            };
            await this.repo.insertFailoverDecision(decision);
        }
        return {
            acquired: true,
            lease,
            epoch: newEpoch,
            fencingToken: newFencingToken,
        };
    }
    async renewLeadership(input) {
        const { nodeId, ttlMs = this.defaultTtlMs } = input;
        const node = await this.getNode(nodeId);
        if (!node) {
            return { renewed: false, lease: null, fencingToken: 0 };
        }
        const currentLease = await this.getActiveLease();
        if (!currentLease || currentLease.nodeId !== nodeId) {
            return { renewed: false, lease: null, fencingToken: 0 };
        }
        const effectiveTtl = Math.min(MAX_LEASE_TTL_MS, Math.max(MIN_LEASE_TTL_MS, ttlMs));
        const expiresAt = new Date(Date.now() + effectiveTtl).toISOString();
        await this.repo.updateLeaseExpiration(currentLease.leaseId, expiresAt);
        await this.repo.updateNodeHeartbeat(nodeId);
        const updatedLease = {
            ...currentLease,
            expiresAt,
            ttlMs: effectiveTtl,
        };
        return {
            renewed: true,
            lease: updatedLease,
            fencingToken: currentLease.ttlMs,
        };
    }
    async releaseLeadership(nodeId) {
        const node = await this.getNode(nodeId);
        if (!node || !node.isLeader) {
            return false;
        }
        const now = nowIso();
        const currentLease = await this.getActiveLease();
        if (currentLease) {
            await this.repo.updateLeaseStatus(currentLease.leaseId, "released");
        }
        await this.repo.upsertNode({ ...node, isLeader: false });
        const latestEpoch = await this.getLatestEpoch();
        await this.repo.updateEpochEnd(latestEpoch.epoch, now, "voluntary");
        return true;
    }
    async getCurrentLeader() {
        const nodes = await this.repo.listNodes("active");
        return nodes.find((n) => n.isLeader) ?? null;
    }
    async getActiveLease() {
        return (await this.repo.getActiveLease()) ?? null;
    }
    async queryLeadership() {
        const leader = await this.getCurrentLeader();
        const activeLease = await this.getActiveLease();
        const latestEpoch = await this.getLatestEpoch();
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
    async authorizeAction(requestingNodeId, actionType, requiredAuthority) {
        const node = await this.getNode(requestingNodeId);
        const leader = await this.getCurrentLeader();
        const latestEpoch = await this.getLatestEpoch();
        const activeLease = await this.getActiveLease();
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
        if (requiredAuthority === "any") {
            await this.recordActionAudit(actionType, requestingNodeId, leader?.nodeId ?? null, latestEpoch.epoch, latestEpoch.fencingToken, true, "ok");
            return {
                authorized: true,
                authority: requiredAuthority,
                reasonCode: "ok",
                leaderNodeId: leader?.nodeId ?? null,
                epoch: latestEpoch.epoch,
                fencingToken: latestEpoch.fencingToken,
            };
        }
        if (requiredAuthority === "follower_allowed") {
            await this.recordActionAudit(actionType, requestingNodeId, leader?.nodeId ?? null, latestEpoch.epoch, latestEpoch.fencingToken, true, "follower_allowed");
            return {
                authorized: true,
                authority: requiredAuthority,
                reasonCode: "follower_allowed",
                leaderNodeId: leader?.nodeId ?? null,
                epoch: latestEpoch.epoch,
                fencingToken: latestEpoch.fencingToken,
            };
        }
        if (requiredAuthority === "leader_only") {
            if (!leader) {
                await this.recordActionAudit(actionType, requestingNodeId, null, latestEpoch.epoch, latestEpoch.fencingToken, false, "no_active_leader");
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
                await this.recordActionAudit(actionType, requestingNodeId, leader.nodeId, latestEpoch.epoch, latestEpoch.fencingToken, false, "not_current_leader");
                return {
                    authorized: false,
                    authority: requiredAuthority,
                    reasonCode: "not_current_leader",
                    leaderNodeId: leader.nodeId,
                    epoch: latestEpoch.epoch,
                    fencingToken: latestEpoch.fencingToken,
                };
            }
            if (activeLease && new Date(activeLease.expiresAt) <= new Date()) {
                await this.recordActionAudit(actionType, requestingNodeId, leader.nodeId, latestEpoch.epoch, latestEpoch.fencingToken, false, "leadership_lease_expired");
                return {
                    authorized: false,
                    authority: requiredAuthority,
                    reasonCode: "leadership_lease_expired",
                    leaderNodeId: leader.nodeId,
                    epoch: latestEpoch.epoch,
                    fencingToken: latestEpoch.fencingToken,
                };
            }
            await this.recordActionAudit(actionType, requestingNodeId, leader.nodeId, latestEpoch.epoch, latestEpoch.fencingToken, true, "ok");
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
    // ── Epoch Management ─────────────────────────────────────────────
    async getLatestEpoch() {
        const epoch = await this.repo.getLatestEpoch();
        if (epoch) {
            return epoch;
        }
        return {
            epoch: 0,
            leaderNodeId: null,
            startedAt: nowIso(),
            endedAt: null,
            cause: "acquired",
            fencingToken: 0,
        };
    }
    async listEpochs(limit = 100) {
        return this.repo.listEpochs(limit);
    }
    // ── Failover ───────────────────────────────────────────────────────
    async triggerFailover(cause, forceNodeId) {
        const now = nowIso();
        const currentLeader = await this.getCurrentLeader();
        const latestEpoch = await this.getLatestEpoch();
        let newLeaderNodeId = null;
        let outcome = "no_change";
        if (forceNodeId) {
            newLeaderNodeId = forceNodeId;
            outcome = "leader_changed";
        }
        else {
            const candidates = (await this.listNodes("active")).filter((n) => n.nodeId !== currentLeader?.nodeId);
            if (candidates.length > 0) {
                candidates.sort((a, b) => a.nodeId.localeCompare(b.nodeId));
                newLeaderNodeId = candidates[0].nodeId;
                outcome = "leader_changed";
            }
            else {
                outcome = "no_candidate";
            }
        }
        if (outcome === "leader_changed" && newLeaderNodeId) {
            if (currentLeader) {
                await this.repo.upsertNode({ ...currentLeader, isLeader: false });
                const oldLease = await this.repo.getActiveLeaseByNode(currentLeader.nodeId);
                if (oldLease) {
                    await this.repo.updateLeaseStatus(oldLease.leaseId, "expired");
                }
            }
            await this.acquireLeadership({ nodeId: newLeaderNodeId, forceAcquire: true });
        }
        const decision = {
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
            await this.repo.insertFailoverDecision(decision);
        }
        return decision;
    }
    async getFailoverHistory(limit = 100) {
        return this.repo.listFailoverDecisions(limit);
    }
    // ── Stale Write Rejection ──────────────────────────────────────────
    verifyWriteAuthority(presentedFencingToken) {
        // Note: This is synchronous because it only reads in-memory state
        // For async validation, use queryLeadership() and check fencingToken
        return presentedFencingToken >= this.fencingTokenCounter.value;
    }
    // ── Cleanup ────────────────────────────────────────────────────────
    async purgeExpiredLeases() {
        const expired = await this.repo.getExpiredLeases();
        for (const lease of expired) {
            await this.repo.updateLeaseStatus(lease.leaseId, "expired");
        }
        return expired.length;
    }
    async purgeOldFailoverDecisions(olderThanDays = 7) {
        // This would need a method in HaRepository - for now return 0
        return 0;
    }
    // ── Helpers ─────────────────────────────────────────────────────
    nextFencingToken() {
        this.fencingTokenCounter.value += 1;
        return this.fencingTokenCounter.value;
    }
    async recordActionAudit(actionType, requestingNodeId, leaderNodeId, epoch, fencingToken, authorized, reasonCode) {
        const entry = {
            id: newId("leaderact"),
            actionType,
            requestingNodeId,
            leaderNodeId,
            epoch,
            fencingToken,
            authorized,
            reasonCode,
            performedAt: nowIso(),
        };
        await this.repo.recordActionAudit(entry);
    }
}
//# sourceMappingURL=ha-coordinator-service-async.js.map