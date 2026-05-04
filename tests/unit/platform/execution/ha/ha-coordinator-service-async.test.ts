import assert from "node:assert/strict";
import test from "node:test";

import { HaCoordinatorServiceAsync, DEFAULT_LEASE_TTL_MS, MAX_LEASE_TTL_MS, MIN_LEASE_TTL_MS } from "../../../../../src/platform/execution/ha/ha-coordinator-service-async.js";
import type { HaRepository, LeaderActionAuditEntry } from "../../../../../src/platform/execution/ha/ha-repository.js";
import type {
  CoordinatorNode,
  CoordinatorNodeStatus,
  FailoverDecision,
  LeaderLease,
  LeadershipEpoch,
  LeadershipQueryResult,
} from "../../../../../src/platform/execution/ha/types.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";

// ─────────────────────────────────────────────────────────────────────────────
// Mock HaRepository
// ─────────────────────────────────────────────────────────────────────────────

interface MockRepoState {
  nodes: Map<string, CoordinatorNode>;
  leases: Map<string, LeaderLease>;
  epochs: LeadershipEpoch[];
  failoverDecisions: FailoverDecision[];
  actionAudits: LeaderActionAuditEntry[];
}

function createMockRepo(initialState: Partial<MockRepoState> = {}): HaRepository {
  const state: MockRepoState = {
    nodes: initialState.nodes ?? new Map(),
    leases: initialState.leases ?? new Map(),
    epochs: initialState.epochs ?? [],
    failoverDecisions: initialState.failoverDecisions ?? [],
    actionAudits: initialState.actionAudits ?? [],
  };

  return {
    _state: state as any,

    async upsertNode(node: CoordinatorNode): Promise<void> {
      state.nodes.set(node.nodeId, node);
    },

    async getNode(nodeId: string): Promise<CoordinatorNode | undefined> {
      return state.nodes.get(nodeId);
    },

    async listNodes(status?: CoordinatorNodeStatus): Promise<CoordinatorNode[]> {
      const nodes = Array.from(state.nodes.values());
      if (status) {
        return nodes.filter((n) => n.status === status);
      }
      return nodes;
    },

    async updateNodeHeartbeat(nodeId: string, status?: CoordinatorNodeStatus): Promise<void> {
      const node = state.nodes.get(nodeId);
      if (node) {
        const updated = { ...node, lastHeartbeatAt: nowIso() };
        if (status) updated.status = status;
        state.nodes.set(nodeId, updated);
      }
    },

    async deleteNode(nodeId: string): Promise<void> {
      state.nodes.delete(nodeId);
    },

    async insertLease(lease: LeaderLease): Promise<void> {
      state.leases.set(lease.leaseId, lease);
    },

    async updateLeaseStatus(leaseId: string, status: LeaderLease["status"]): Promise<void> {
      const lease = state.leases.get(leaseId);
      if (lease) {
        state.leases.set(leaseId, { ...lease, status });
      }
    },

    async updateLeaseExpiration(leaseId: string, expiresAt: string): Promise<void> {
      const lease = state.leases.get(leaseId);
      if (lease) {
        state.leases.set(leaseId, { ...lease, expiresAt });
      }
    },

    async getActiveLease(): Promise<LeaderLease | undefined> {
      const now = new Date();
      for (const lease of state.leases.values()) {
        if (lease.status === "active" && new Date(lease.expiresAt) > now) {
          return lease;
        }
      }
      return undefined;
    },

    async getLeaseByNodeId(nodeId: string): Promise<LeaderLease | undefined> {
      for (const lease of state.leases.values()) {
        if (lease.nodeId === nodeId && lease.status === "active") {
          return lease;
        }
      }
      return undefined;
    },

    async getLeaseById(leaseId: string): Promise<LeaderLease | undefined> {
      return state.leases.get(leaseId);
    },

    async getExpiredLeases(): Promise<LeaderLease[]> {
      const now = new Date();
      const expired: LeaderLease[] = [];
      for (const lease of state.leases.values()) {
        if (lease.status === "active" && new Date(lease.expiresAt) <= now) {
          expired.push(lease);
        }
      }
      return expired;
    },

    async getActiveLeaseByNode(nodeId: string): Promise<LeaderLease | undefined> {
      for (const lease of state.leases.values()) {
        if (lease.nodeId === nodeId && lease.status === "active") {
          return lease;
        }
      }
      return undefined;
    },

    async insertEpoch(epoch: LeadershipEpoch): Promise<void> {
      state.epochs.push(epoch);
    },

    async updateEpochEnd(epochNumber: number, endedAt: string, cause: string): Promise<void> {
      const epoch = state.epochs.find((e) => e.epoch === epochNumber && e.endedAt === null);
      if (epoch) {
        epoch.endedAt = endedAt;
        epoch.cause = cause as LeadershipEpoch["cause"];
      }
    },

    async getLatestEpoch(): Promise<LeadershipEpoch | undefined> {
      if (state.epochs.length === 0) return undefined;
      return state.epochs.reduce((latest, e) => (e.epoch > latest.epoch ? e : latest));
    },

    async listEpochs(limit = 100): Promise<LeadershipEpoch[]> {
      return [...state.epochs].sort((a, b) => b.epoch - a.epoch).slice(0, limit);
    },

    async insertFailoverDecision(decision: FailoverDecision): Promise<void> {
      state.failoverDecisions.push(decision);
    },

    async listFailoverDecisions(limit = 100): Promise<FailoverDecision[]> {
      return [...state.failoverDecisions]
        .sort((a, b) => new Date(b.decidedAt).getTime() - new Date(a.decidedAt).getTime())
        .slice(0, limit);
    },

    async purgeOldFailoverDecisions(olderThanDays: number): Promise<number> {
      const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
      const before = state.failoverDecisions.length;
      state.failoverDecisions = state.failoverDecisions.filter(
        (decision) => new Date(decision.decidedAt).getTime() >= cutoff,
      );
      return before - state.failoverDecisions.length;
    },

    async recordActionAudit(entry: LeaderActionAuditEntry): Promise<void> {
      state.actionAudits.push(entry);
    },

    async getStaleNodes(thresholdMs: number): Promise<CoordinatorNode[]> {
      const threshold = Date.now() - thresholdMs;
      return Array.from(state.nodes.values()).filter(
        (n) => new Date(n.lastHeartbeatAt).getTime() < threshold,
      );
    },
  } as unknown as HaRepository;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function createNode(overrides: Partial<CoordinatorNode> = {}): CoordinatorNode {
  return {
    nodeId: "node-1",
    region: "us-east-1",
    status: "active",
    isLeader: false,
    leadershipEpoch: 0,
    lastHeartbeatAt: nowIso(),
    metadata: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Construction
// ─────────────────────────────────────────────────────────────────────────────

test("HaCoordinatorServiceAsync - creation with defaults", () => {
  const repo = createMockRepo();
  const service = new HaCoordinatorServiceAsync(repo);

  assert.equal(service instanceof HaCoordinatorServiceAsync, true);
});

test("HaCoordinatorServiceAsync - creation with custom options", () => {
  const repo = createMockRepo();
  const service = new HaCoordinatorServiceAsync(repo, {
    defaultTtlMs: 30_000,
    strictLeaderAuthority: false,
    coordinatorId: "coord-1",
  });

  assert.equal(service instanceof HaCoordinatorServiceAsync, true);
});

test("HaCoordinatorServiceAsync - constants are exported correctly", () => {
  assert.equal(DEFAULT_LEASE_TTL_MS, 15_000);
  assert.equal(MAX_LEASE_TTL_MS, 60_000);
  assert.equal(MIN_LEASE_TTL_MS, 5_000);
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Node Management
// ─────────────────────────────────────────────────────────────────────────────

test("HaCoordinatorServiceAsync - registerNode adds a new node", async () => {
  const repo = createMockRepo();
  const service = new HaCoordinatorServiceAsync(repo);

  const node = await service.registerNode("node-1", "us-east-1");

  assert.equal(node.nodeId, "node-1");
  assert.equal(node.region, "us-east-1");
  assert.equal(node.status, "active");
  assert.equal(node.isLeader, false);
});

test("HaCoordinatorServiceAsync - registerNode updates existing node", async () => {
  const repo = createMockRepo();
  (repo as any)._state.nodes.set("node-1", createNode({ nodeId: "node-1", isLeader: true }));

  const service = new HaCoordinatorServiceAsync(repo);
  const node = await service.registerNode("node-1", "us-west-1");

  // Existing node should be updated but keep isLeader status
  assert.equal(node.nodeId, "node-1");
  assert.equal(node.region, "us-west-1");
  assert.equal(node.isLeader, true);
});

test("HaCoordinatorServiceAsync - registerNode with metadata", async () => {
  const repo = createMockRepo();
  const service = new HaCoordinatorServiceAsync(repo);

  const node = await service.registerNode("node-1", "us-east-1", { priority: 1 });

  assert.deepEqual(node.metadata, { priority: 1 });
});

test("HaCoordinatorServiceAsync - getNode returns node when exists", async () => {
  const repo = createMockRepo();
  (repo as any)._state.nodes.set("node-1", createNode({ nodeId: "node-1" }));

  const service = new HaCoordinatorServiceAsync(repo);
  const node = await service.getNode("node-1");

  assert.ok(node !== null);
  assert.equal(node!.nodeId, "node-1");
});

test("HaCoordinatorServiceAsync - getNode returns null when not exists", async () => {
  const repo = createMockRepo();
  const service = new HaCoordinatorServiceAsync(repo);

  const node = await service.getNode("nonexistent");

  assert.equal(node, null);
});

test("HaCoordinatorServiceAsync - listNodes returns all nodes", async () => {
  const repo = createMockRepo();
  (repo as any)._state.nodes.set("node-1", createNode({ nodeId: "node-1" }));
  (repo as any)._state.nodes.set("node-2", createNode({ nodeId: "node-2" }));

  const service = new HaCoordinatorServiceAsync(repo);
  const nodes = await service.listNodes();

  assert.equal(nodes.length, 2);
});

test("HaCoordinatorServiceAsync - listNodes filters by status", async () => {
  const repo = createMockRepo();
  (repo as any)._state.nodes.set("node-1", createNode({ nodeId: "node-1", status: "active" }));
  (repo as any)._state.nodes.set("node-2", createNode({ nodeId: "node-2", status: "offline" }));

  const service = new HaCoordinatorServiceAsync(repo);
  const activeNodes = await service.listNodes("active");

  assert.equal(activeNodes.length, 1);
  assert.equal(activeNodes[0]!.nodeId, "node-1");
});

test("HaCoordinatorServiceAsync - updateNodeHeartbeat updates timestamp", async () => {
  const repo = createMockRepo();
  const oldTimestamp = new Date(Date.now() - 10000).toISOString(); // 10 seconds ago
  const originalNode = createNode({ nodeId: "node-1", lastHeartbeatAt: oldTimestamp });
  (repo as any)._state.nodes.set("node-1", originalNode);

  const service = new HaCoordinatorServiceAsync(repo);
  const updated = await service.updateNodeHeartbeat("node-1");

  assert.ok(updated !== null);
  assert.notEqual(updated!.lastHeartbeatAt, oldTimestamp);
});

test("HaCoordinatorServiceAsync - removeNode deletes node", async () => {
  const repo = createMockRepo();
  (repo as any)._state.nodes.set("node-1", createNode({ nodeId: "node-1" }));

  const service = new HaCoordinatorServiceAsync(repo);
  await service.removeNode("node-1");

  const node = await service.getNode("node-1");
  assert.equal(node, null);
});

test("HaCoordinatorServiceAsync - removeNode demotes leader first", async () => {
  const repo = createMockRepo();
  const leaderNode = createNode({ nodeId: "node-1", isLeader: true });
  (repo as any)._state.nodes.set("node-1", leaderNode);
  (repo as any)._state.leases.set("lease-1", {
    leaseId: "lease-1",
    nodeId: "node-1",
    epoch: 1,
    acquiredAt: nowIso(),
    expiresAt: new Date(Date.now() + 10_000).toISOString(),
    status: "active",
    ttlMs: 10_000,
  });

  // Override deleteNode to not actually delete (so we can check state)
  repo.deleteNode = async () => {};

  const service = new HaCoordinatorServiceAsync(repo);
  await service.removeNode("node-1");

  const node = await service.getNode("node-1");
  assert.ok(node !== null);
  assert.equal(node!.isLeader, false);
  assert.equal(node!.status, "offline");
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Leadership Acquisition
// ─────────────────────────────────────────────────────────────────────────────

test("HaCoordinatorServiceAsync - acquireLeadership succeeds for registered node", async () => {
  const repo = createMockRepo();
  (repo as any)._state.nodes.set("node-1", createNode({ nodeId: "node-1" }));

  const service = new HaCoordinatorServiceAsync(repo);
  const result = await service.acquireLeadership({ nodeId: "node-1" });

  assert.equal(result.acquired, true);
  assert.ok(result.lease !== null);
  assert.equal(result.lease!.nodeId, "node-1");
  assert.ok(result.epoch >= 1);
  assert.ok(result.fencingToken >= 1);
});

test("HaCoordinatorServiceAsync - acquireLeadership throws for unregistered node", async () => {
  const repo = createMockRepo();
  const service = new HaCoordinatorServiceAsync(repo);

  await assert.rejects(
    async () => service.acquireLeadership({ nodeId: "nonexistent" }),
    /Must register node before acquiring leadership/,
  );
});

test("HaCoordinatorServiceAsync - acquireLeadership fails when another leader exists", async () => {
  const repo = createMockRepo();
  (repo as any)._state.nodes.set("node-1", createNode({ nodeId: "node-1", isLeader: true }));
  (repo as any)._state.nodes.set("node-2", createNode({ nodeId: "node-2" }));
  (repo as any)._state.leases.set("lease-1", {
    leaseId: "lease-1",
    nodeId: "node-1",
    epoch: 1,
    acquiredAt: nowIso(),
    expiresAt: new Date(Date.now() + 10_000).toISOString(),
    status: "active",
    ttlMs: 10_000,
  });

  const service = new HaCoordinatorServiceAsync(repo);
  const result = await service.acquireLeadership({ nodeId: "node-2" });

  assert.equal(result.acquired, false);
  assert.equal(result.cause, "leadership_held_by_another_node");
});

test("HaCoordinatorServiceAsync - acquireLeadership succeeds with forceAcquire", async () => {
  const repo = createMockRepo();
  (repo as any)._state.nodes.set("node-1", createNode({ nodeId: "node-1", isLeader: true }));
  (repo as any)._state.nodes.set("node-2", createNode({ nodeId: "node-2" }));
  (repo as any)._state.leases.set("lease-1", {
    leaseId: "lease-1",
    nodeId: "node-1",
    epoch: 1,
    acquiredAt: nowIso(),
    expiresAt: new Date(Date.now() + 10_000).toISOString(),
    status: "active",
    ttlMs: 10_000,
  });

  const service = new HaCoordinatorServiceAsync(repo);
  const result = await service.acquireLeadership({ nodeId: "node-2", forceAcquire: true });

  assert.equal(result.acquired, true);
});

test("HaCoordinatorServiceAsync - acquireLeadership clamps TTL to valid range", async () => {
  const repo = createMockRepo();
  (repo as any)._state.nodes.set("node-1", createNode({ nodeId: "node-1" }));

  const service = new HaCoordinatorServiceAsync(repo);

  // Too small TTL
  const result1 = await service.acquireLeadership({ nodeId: "node-1", ttlMs: 100 });
  assert.equal(result1.lease!.ttlMs, MIN_LEASE_TTL_MS);

  // Too large TTL
  const result2 = await service.acquireLeadership({ nodeId: "node-1", ttlMs: 1_000_000 });
  assert.equal(result2.lease!.ttlMs, MAX_LEASE_TTL_MS);
});

test("HaCoordinatorServiceAsync - acquireLeadership increments epoch", async () => {
  const repo = createMockRepo();
  (repo as any)._state.nodes.set("node-1", createNode({ nodeId: "node-1" }));

  const service = new HaCoordinatorServiceAsync(repo);
  const result1 = await service.acquireLeadership({ nodeId: "node-1" });

  (repo as any)._state.nodes.set("node-2", createNode({ nodeId: "node-2" }));
  const result2 = await service.acquireLeadership({ nodeId: "node-2", forceAcquire: true });

  assert.ok(result2.epoch > result1.epoch);
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Leadership Renewal
// ─────────────────────────────────────────────────────────────────────────────

test("HaCoordinatorServiceAsync - renewLeadership succeeds for current leader", async () => {
  const repo = createMockRepo();
  (repo as any)._state.nodes.set("node-1", createNode({ nodeId: "node-1", isLeader: true }));
  (repo as any)._state.leases.set("lease-1", {
    leaseId: "lease-1",
    nodeId: "node-1",
    epoch: 1,
    acquiredAt: nowIso(),
    expiresAt: new Date(Date.now() + 10_000).toISOString(),
    status: "active",
    ttlMs: 10_000,
  });

  const service = new HaCoordinatorServiceAsync(repo);
  const result = await service.renewLeadership({ nodeId: "node-1" });

  assert.equal(result.renewed, true);
  assert.ok(result.lease !== null);
});

test("HaCoordinatorServiceAsync - renewLeadership fails for unregistered node", async () => {
  const repo = createMockRepo();
  const service = new HaCoordinatorServiceAsync(repo);

  const result = await service.renewLeadership({ nodeId: "nonexistent" });

  assert.equal(result.renewed, false);
  assert.equal(result.lease, null);
});

test("HaCoordinatorServiceAsync - renewLeadership fails when not current leader", async () => {
  const repo = createMockRepo();
  (repo as any)._state.nodes.set("node-1", createNode({ nodeId: "node-1" }));
  (repo as any)._state.nodes.set("node-2", createNode({ nodeId: "node-2" }));
  (repo as any)._state.leases.set("lease-1", {
    leaseId: "lease-1",
    nodeId: "node-1",
    epoch: 1,
    acquiredAt: nowIso(),
    expiresAt: new Date(Date.now() + 10_000).toISOString(),
    status: "active",
    ttlMs: 10_000,
  });

  const service = new HaCoordinatorServiceAsync(repo);
  const result = await service.renewLeadership({ nodeId: "node-2" });

  assert.equal(result.renewed, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Leadership Release
// ─────────────────────────────────────────────────────────────────────────────

test("HaCoordinatorServiceAsync - releaseLeadership succeeds for leader", async () => {
  const repo = createMockRepo();
  (repo as any)._state.nodes.set("node-1", createNode({ nodeId: "node-1", isLeader: true }));
  (repo as any)._state.leases.set("lease-1", {
    leaseId: "lease-1",
    nodeId: "node-1",
    epoch: 1,
    acquiredAt: nowIso(),
    expiresAt: new Date(Date.now() + 10_000).toISOString(),
    status: "active",
    ttlMs: 10_000,
  });

  const service = new HaCoordinatorServiceAsync(repo);
  const result = await service.releaseLeadership("node-1");

  assert.equal(result, true);

  const node = await service.getNode("node-1");
  assert.equal(node!.isLeader, false);
});

test("HaCoordinatorServiceAsync - releaseLeadership fails for non-leader", async () => {
  const repo = createMockRepo();
  (repo as any)._state.nodes.set("node-1", createNode({ nodeId: "node-1", isLeader: false }));

  const service = new HaCoordinatorServiceAsync(repo);
  const result = await service.releaseLeadership("node-1");

  assert.equal(result, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Leadership Query
// ─────────────────────────────────────────────────────────────────────────────

test("HaCoordinatorServiceAsync - getCurrentLeader returns leader node", async () => {
  const repo = createMockRepo();
  (repo as any)._state.nodes.set("node-1", createNode({ nodeId: "node-1", isLeader: true }));

  const service = new HaCoordinatorServiceAsync(repo);
  const leader = await service.getCurrentLeader();

  assert.ok(leader !== null);
  assert.equal(leader!.nodeId, "node-1");
});

test("HaCoordinatorServiceAsync - getCurrentLeader returns null when no leader", async () => {
  const repo = createMockRepo();
  const service = new HaCoordinatorServiceAsync(repo);

  const leader = await service.getCurrentLeader();

  assert.equal(leader, null);
});

test("HaCoordinatorServiceAsync - queryLeadership returns correct structure", async () => {
  const repo = createMockRepo();
  (repo as any)._state.nodes.set("node-1", createNode({ nodeId: "node-1", isLeader: true }));
  (repo as any)._state.leases.set("lease-1", {
    leaseId: "lease-1",
    nodeId: "node-1",
    epoch: 1,
    acquiredAt: nowIso(),
    expiresAt: new Date(Date.now() + 10_000).toISOString(),
    status: "active",
    ttlMs: 10_000,
  });

  const service = new HaCoordinatorServiceAsync(repo);
  const result = await service.queryLeadership();

  assert.equal(result.isLeader, true);
  assert.equal(result.leaderNodeId, "node-1");
  assert.equal(result.isExpired, false);
  assert.ok(result.epoch >= 0);
  assert.ok(result.fencingToken >= 0);
});

test("HaCoordinatorServiceAsync - queryLeadership detects expired lease", async () => {
  const repo = createMockRepo();
  (repo as any)._state.nodes.set("node-1", createNode({ nodeId: "node-1", isLeader: true }));
  (repo as any)._state.leases.set("lease-1", {
    leaseId: "lease-1",
    nodeId: "node-1",
    epoch: 1,
    acquiredAt: nowIso(),
    expiresAt: new Date(Date.now() - 10_000).toISOString(), // Expired
    status: "active",
    ttlMs: 10_000,
  });

  const service = new HaCoordinatorServiceAsync(repo);
  const result = await service.queryLeadership();

  assert.equal(result.isLeader, false);
  assert.equal(result.isExpired, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Action Authorization
// ─────────────────────────────────────────────────────────────────────────────

test("HaCoordinatorServiceAsync - authorizeAction with 'any' authority always succeeds", async () => {
  const repo = createMockRepo();
  (repo as any)._state.nodes.set("node-1", createNode({ nodeId: "node-1" }));

  const service = new HaCoordinatorServiceAsync(repo);
  const result = await service.authorizeAction("node-1", "read", "any");

  assert.equal(result.authorized, true);
  assert.equal(result.reasonCode, "ok");
});

test("HaCoordinatorServiceAsync - authorizeAction with 'follower_allowed' always succeeds", async () => {
  const repo = createMockRepo();
  (repo as any)._state.nodes.set("node-1", createNode({ nodeId: "node-1", isLeader: true }));
  (repo as any)._state.nodes.set("node-2", createNode({ nodeId: "node-2", isLeader: false }));

  const service = new HaCoordinatorServiceAsync(repo);
  const result = await service.authorizeAction("node-2", "read", "follower_allowed");

  assert.equal(result.authorized, true);
  assert.equal(result.reasonCode, "follower_allowed");
});

test("HaCoordinatorServiceAsync - authorizeAction with 'leader_only' succeeds for leader", async () => {
  const repo = createMockRepo();
  (repo as any)._state.nodes.set("node-1", createNode({ nodeId: "node-1", isLeader: true }));
  (repo as any)._state.leases.set("lease-1", {
    leaseId: "lease-1",
    nodeId: "node-1",
    epoch: 1,
    acquiredAt: nowIso(),
    expiresAt: new Date(Date.now() + 10_000).toISOString(),
    status: "active",
    ttlMs: 10_000,
  });

  const service = new HaCoordinatorServiceAsync(repo);
  const result = await service.authorizeAction("node-1", "write", "leader_only");

  assert.equal(result.authorized, true);
  assert.equal(result.reasonCode, "ok");
});

test("HaCoordinatorServiceAsync - authorizeAction with 'leader_only' fails when not leader", async () => {
  const repo = createMockRepo();
  (repo as any)._state.nodes.set("node-1", createNode({ nodeId: "node-1", isLeader: true }));
  (repo as any)._state.nodes.set("node-2", createNode({ nodeId: "node-2", isLeader: false }));

  const service = new HaCoordinatorServiceAsync(repo);
  const result = await service.authorizeAction("node-2", "write", "leader_only");

  assert.equal(result.authorized, false);
  assert.equal(result.reasonCode, "not_current_leader");
});

test("HaCoordinatorServiceAsync - authorizeAction with 'leader_only' fails when no leader", async () => {
  const repo = createMockRepo();
  (repo as any)._state.nodes.set("node-1", createNode({ nodeId: "node-1" }));

  const service = new HaCoordinatorServiceAsync(repo);
  const result = await service.authorizeAction("node-1", "write", "leader_only");

  assert.equal(result.authorized, false);
  assert.equal(result.reasonCode, "no_active_leader");
});

test("HaCoordinatorServiceAsync - authorizeAction fails for unknown node", async () => {
  const repo = createMockRepo();
  const service = new HaCoordinatorServiceAsync(repo);

  const result = await service.authorizeAction("nonexistent", "write", "leader_only");

  assert.equal(result.authorized, false);
  assert.equal(result.reasonCode, "node_not_found");
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Epoch Management
// ─────────────────────────────────────────────────────────────────────────────

test("HaCoordinatorServiceAsync - getLatestEpoch returns current epoch", async () => {
  const repo = createMockRepo();
  (repo as any)._state.nodes.set("node-1", createNode({ nodeId: "node-1" }));

  const service = new HaCoordinatorServiceAsync(repo);
  await service.acquireLeadership({ nodeId: "node-1" });

  const epoch = await service.getLatestEpoch();

  assert.ok(epoch.epoch >= 1);
  assert.equal(epoch.leaderNodeId, "node-1");
});

test("HaCoordinatorServiceAsync - getLatestEpoch returns default when no epochs", async () => {
  const repo = createMockRepo();
  const service = new HaCoordinatorServiceAsync(repo);

  const epoch = await service.getLatestEpoch();

  assert.equal(epoch.epoch, 0);
  assert.equal(epoch.leaderNodeId, null);
});

test("HaCoordinatorServiceAsync - listEpochs returns epochs in descending order", async () => {
  const repo = createMockRepo();
  (repo as any)._state.nodes.set("node-1", createNode({ nodeId: "node-1" }));

  const service = new HaCoordinatorServiceAsync(repo);
  await service.acquireLeadership({ nodeId: "node-1" });
  await service.releaseLeadership("node-1");
  await service.acquireLeadership({ nodeId: "node-1" });

  const epochs = await service.listEpochs();

  assert.ok(epochs.length >= 2);
  assert.ok(epochs[0]!.epoch >= epochs[1]!.epoch);
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Failover
// ─────────────────────────────────────────────────────────────────────────────

test("HaCoordinatorServiceAsync - triggerFailover with forceNodeId", async () => {
  const repo = createMockRepo();
  (repo as any)._state.nodes.set("node-1", createNode({ nodeId: "node-1", isLeader: true }));
  (repo as any)._state.nodes.set("node-2", createNode({ nodeId: "node-2" }));
  (repo as any)._state.leases.set("lease-1", {
    leaseId: "lease-1",
    nodeId: "node-1",
    epoch: 1,
    acquiredAt: nowIso(),
    expiresAt: new Date(Date.now() + 10_000).toISOString(),
    status: "active",
    ttlMs: 10_000,
  });

  const service = new HaCoordinatorServiceAsync(repo);
  const decision = await service.triggerFailover("heartbeat_missing", "node-2");

  assert.equal(decision.outcome, "leader_changed");
  assert.equal(decision.newLeaderNodeId, "node-2");
});

test("HaCoordinatorServiceAsync - triggerFailover without candidates", async () => {
  const repo = createMockRepo();
  (repo as any)._state.nodes.set("node-1", createNode({ nodeId: "node-1", isLeader: true }));
  (repo as any)._state.leases.set("lease-1", {
    leaseId: "lease-1",
    nodeId: "node-1",
    epoch: 1,
    acquiredAt: nowIso(),
    expiresAt: new Date(Date.now() + 10_000).toISOString(),
    status: "active",
    ttlMs: 10_000,
  });

  const service = new HaCoordinatorServiceAsync(repo);
  const decision = await service.triggerFailover("heartbeat_missing");

  assert.equal(decision.outcome, "no_candidate");
  assert.equal(decision.newLeaderNodeId, null);
});

test("HaCoordinatorServiceAsync - triggerFailover records decision", async () => {
  const repo = createMockRepo();
  (repo as any)._state.nodes.set("node-1", createNode({ nodeId: "node-1", isLeader: true }));
  (repo as any)._state.nodes.set("node-2", createNode({ nodeId: "node-2" }));
  (repo as any)._state.leases.set("lease-1", {
    leaseId: "lease-1",
    nodeId: "node-1",
    epoch: 1,
    acquiredAt: nowIso(),
    expiresAt: new Date(Date.now() + 10_000).toISOString(),
    status: "active",
    ttlMs: 10_000,
  });

  const service = new HaCoordinatorServiceAsync(repo);
  await service.triggerFailover("heartbeat_missing", "node-2");

  const history = await service.getFailoverHistory();

  assert.ok(history.length >= 1);
  assert.equal(history[0]!.outcome, "leader_changed");
});

test("HaCoordinatorServiceAsync - getFailoverHistory respects limit", async () => {
  const repo = createMockRepo();
  (repo as any)._state.nodes.set("node-1", createNode({ nodeId: "node-1", isLeader: true }));
  (repo as any)._state.nodes.set("node-2", createNode({ nodeId: "node-2" }));

  const service = new HaCoordinatorServiceAsync(repo);

  // Create multiple failover decisions
  for (let i = 0; i < 5; i++) {
    (repo as any)._state.nodes.get("node-1")!.isLeader = false;
    (repo as any)._state.nodes.get("node-2")!.isLeader = true;
    (repo as any)._state.failoverDecisions.push({
      decisionId: `failover-${i}`,
      oldLeaderNodeId: "node-1",
      newLeaderNodeId: "node-2",
      epoch: i + 1,
      cause: "voluntary",
      outcome: "leader_changed",
      decidedAt: nowIso(),
      fencingToken: i + 1,
    });
  }

  const history = await service.getFailoverHistory(3);

  assert.equal(history.length, 3);
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Write Authority Verification
// ─────────────────────────────────────────────────────────────────────────────

test("HaCoordinatorServiceAsync - verifyWriteAuthority only accepts tokens greater than current token", () => {
  const repo = createMockRepo();
  const service = new HaCoordinatorServiceAsync(repo);
  (service as unknown as { cachedFencingToken: number }).cachedFencingToken = 100;

  assert.equal(service.verifyWriteAuthority(100), false);
  assert.equal(service.verifyWriteAuthority(101), true);
});

test("HaCoordinatorServiceAsync - verifyWriteAuthority rejects stale token", () => {
  const repo = createMockRepo();
  const service = new HaCoordinatorServiceAsync(repo);

  // First acquire leadership to increment counter
  (repo as any)._state.nodes.set("node-1", createNode({ nodeId: "node-1" }));

  // Counter starts at EPOCH_FENCING_TOKEN_START (1)
  const result = service.verifyWriteAuthority(0);

  assert.equal(result, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Cleanup
// ─────────────────────────────────────────────────────────────────────────────

test("HaCoordinatorServiceAsync - purgeExpiredLeases updates expired leases", async () => {
  const repo = createMockRepo();
  (repo as any)._state.leases.set("lease-1", {
    leaseId: "lease-1",
    nodeId: "node-1",
    epoch: 1,
    acquiredAt: nowIso(),
    expiresAt: new Date(Date.now() - 10_000).toISOString(), // Expired
    status: "active",
    ttlMs: 10_000,
  });

  const service = new HaCoordinatorServiceAsync(repo);
  const count = await service.purgeExpiredLeases();

  assert.equal(count, 1);
  assert.equal((repo as any)._state.leases.get("lease-1")!.status, "expired");
});

test("HaCoordinatorServiceAsync - purgeExpiredLeases returns 0 when no expired leases", async () => {
  const repo = createMockRepo();
  (repo as any)._state.leases.set("lease-1", {
    leaseId: "lease-1",
    nodeId: "node-1",
    epoch: 1,
    acquiredAt: nowIso(),
    expiresAt: new Date(Date.now() + 10_000).toISOString(), // Not expired
    status: "active",
    ttlMs: 10_000,
  });

  const service = new HaCoordinatorServiceAsync(repo);
  const count = await service.purgeExpiredLeases();

  assert.equal(count, 0);
});

test("HaCoordinatorServiceAsync - purgeOldFailoverDecisions removes aged decisions through the repo", async () => {
  const repo = createMockRepo({
    failoverDecisions: [
      {
        decisionId: "old-decision",
        oldLeaderNodeId: "node-1",
        newLeaderNodeId: null,
        epoch: 1,
        cause: "heartbeat_missing",
        outcome: "no_candidate",
        decidedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        fencingToken: 1,
      },
      {
        decisionId: "recent-decision",
        oldLeaderNodeId: "node-2",
        newLeaderNodeId: "node-3",
        epoch: 2,
        cause: "heartbeat_missing",
        outcome: "leader_changed",
        decidedAt: nowIso(),
        fencingToken: 2,
      },
    ],
  });
  const service = new HaCoordinatorServiceAsync(repo);

  const count = await service.purgeOldFailoverDecisions(7);

  assert.equal(count, 1);
  assert.deepEqual(
    (repo as unknown as { _state: MockRepoState })._state.failoverDecisions.map((decision) => decision.decisionId),
    ["recent-decision"],
  );
});
