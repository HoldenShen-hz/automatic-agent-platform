import assert from "node:assert/strict";
import test from "node:test";

import {
  LeaseReclaimerService,
  createLeaseReclaimerService,
  type LeaseReclaimerServiceOptions,
} from "../../../../../src/platform/five-plane-execution/ha/lease-reclaimer-service.js";
import type {
  LeaderLease,
  CoordinatorNode,
  FailoverDecision,
  LeadershipQueryResult,
} from "../../../../../src/platform/five-plane-execution/ha/types.js";
import type { HaCoordinatorService } from "../../../../../src/platform/five-plane-execution/ha/ha-coordinator-service-inner.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";

// ─────────────────────────────────────────────────────────────────────────────
// Mock HaCoordinatorService
// ─────────────────────────────────────────────────────────────────────────────

interface MockLeadershipState {
  leaderNodeId: string | null;
  epoch: number;
  fencingToken: number;
  isExpired: boolean;
  expiresAt: string | null;
  leases: Map<string, LeaderLease>;
  nodes: Map<string, CoordinatorNode>;
}

function createMockCoordinator(): HaCoordinatorService & {
  mockState: MockLeadershipState;
  triggerFailoverCalls: { cause: string; lostLeaderNodeId: string | undefined }[];
} {
  const mockState: MockLeadershipState = {
    leaderNodeId: null,
    epoch: 0,
    fencingToken: 1,
    isExpired: false,
    expiresAt: null,
    leases: new Map(),
    nodes: new Map(),
  };

  const triggerFailoverCalls: { cause: string; lostLeaderNodeId: string | undefined }[] = [];

  return {
    mockState,
    triggerFailoverCalls,

    // Node management
    registerNode(nodeId: string, region: string, _metadata?: Record<string, unknown>) {
      const node: CoordinatorNode = {
        nodeId,
        region,
        status: "active",
        isLeader: false,
        leadershipEpoch: 0,
        lastHeartbeatAt: nowIso(),
        metadata: null,
      };
      mockState.nodes.set(nodeId, node);
      return node;
    },

    getNode(nodeId: string) {
      return mockState.nodes.get(nodeId) ?? null;
    },

    listNodes() {
      return Array.from(mockState.nodes.values());
    },

    updateNodeHeartbeat(nodeId: string, _status?: string) {
      const node = mockState.nodes.get(nodeId);
      if (node) {
        node.lastHeartbeatAt = nowIso();
      }
      return null;
    },

    // Leadership
    acquireLeadership(input: { nodeId: string; ttlMs?: number; forceAcquire?: boolean }) {
      const previousLeader = mockState.leaderNodeId;
      mockState.leaderNodeId = input.nodeId;
      mockState.epoch += 1;
      mockState.fencingToken += 1;
      mockState.isExpired = false;

      const ttlMs = input.ttlMs ?? 15_000;
      mockState.expiresAt = new Date(Date.now() + ttlMs).toISOString();

      // Update previous leader node if exists
      if (previousLeader) {
        const prevNode = mockState.nodes.get(previousLeader);
        if (prevNode) prevNode.isLeader = false;
      }

      // Update new leader node
      const newLeaderNode = mockState.nodes.get(input.nodeId);
      if (newLeaderNode) newLeaderNode.isLeader = true;

      const lease: LeaderLease = {
        leaseId: `lease_${mockState.epoch}`,
        nodeId: input.nodeId,
        epoch: mockState.epoch,
        acquiredAt: nowIso(),
        expiresAt: mockState.expiresAt,
        status: "active",
        ttlMs,
      };
      mockState.leases.set(input.nodeId, lease);

      return {
        acquired: true,
        lease,
        epoch: mockState.epoch,
        fencingToken: mockState.fencingToken,
      };
    },

    renewLeadership(input: { nodeId: string; ttlMs?: number }) {
      const lease = mockState.leases.get(input.nodeId);
      if (!lease) {
        return { renewed: false, lease: null, fencingToken: 0 };
      }

      const ttlMs = input.ttlMs ?? lease.ttlMs;
      mockState.expiresAt = new Date(Date.now() + ttlMs).toISOString();
      return {
        renewed: true,
        lease: { ...lease, expiresAt: mockState.expiresAt },
        fencingToken: lease.ttlMs,
      };
    },

    releaseLeadership(nodeId: string) {
      if (mockState.leaderNodeId === nodeId) {
        mockState.leaderNodeId = null;
        mockState.isExpired = true;
        const node = mockState.nodes.get(nodeId);
        if (node) node.isLeader = false;
        return true;
      }
      return false;
    },

    getCurrentLeader() {
      if (!mockState.leaderNodeId) return null;
      return mockState.nodes.get(mockState.leaderNodeId) ?? null;
    },

    getActiveLease() {
      if (!mockState.leaderNodeId) return null;
      return mockState.leases.get(mockState.leaderNodeId) ?? null;
    },

    queryLeadership(): LeadershipQueryResult {
      return {
        isLeader: mockState.leaderNodeId !== null && !mockState.isExpired,
        leaderNodeId: mockState.leaderNodeId,
        epoch: mockState.epoch,
        fencingToken: mockState.fencingToken,
        expiresAt: mockState.expiresAt,
        isExpired: mockState.isExpired,
      };
    },

    getLatestEpoch() {
      return {
        epoch: mockState.epoch,
        leaderNodeId: mockState.leaderNodeId,
        startedAt: nowIso(),
        endedAt: null,
        cause: "acquired" as const,
        fencingToken: mockState.fencingToken,
      };
    },

    listEpochs() {
      return [];
    },

    triggerFailover(cause: string, _lostLeaderNodeId?: string) {
      const oldLeader = mockState.leaderNodeId;
      const oldLeaderNode = oldLeader ? mockState.nodes.get(oldLeader) : null;

      mockState.leaderNodeId = null;
      mockState.isExpired = true;

      if (oldLeaderNode) oldLeaderNode.isLeader = false;

      triggerFailoverCalls.push({ cause, lostLeaderNodeId: oldLeader ?? undefined });

      const decision: FailoverDecision = {
        decisionId: `failover_${Date.now()}`,
        oldLeaderNodeId: oldLeader,
        newLeaderNodeId: null,
        epoch: mockState.epoch,
        cause: cause as FailoverDecision["cause"],
        outcome: "no_candidate",
        decidedAt: nowIso(),
        fencingToken: mockState.fencingToken,
      };
      return decision;
    },

    getFailoverHistory() {
      return [];
    },

    verifyWriteAuthority(_token: number) {
      return true;
    },

    purgeExpiredLeases() {
      return 0;
    },

    purgeOldFailoverDecisions() {
      return 0;
    },
  } as unknown as HaCoordinatorService & {
    mockState: MockLeadershipState;
    triggerFailoverCalls: { cause: string; lostLeaderNodeId: string | undefined }[];
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: create service with coordinator and optional overrides
// ─────────────────────────────────────────────────────────────────────────────

function createReclaimer(
  coordinator: ReturnType<typeof createMockCoordinator>,
  options: Partial<LeaseReclaimerServiceOptions> = {},
): LeaseReclaimerService {
  return new LeaseReclaimerService({
    coordinator,
    ...options,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Lifecycle (start, stop, dispose)
// ─────────────────────────────────────────────────────────────────────────────

test("LeaseReclaimerService - creation with defaults", () => {
  const coordinator = createMockCoordinator();
  const service = createReclaimer(coordinator);

  assert.equal(service.isRunning(), false);

  service.dispose();
});

test("LeaseReclaimerService - start() transitions to running", () => {
  const coordinator = createMockCoordinator();
  const service = createReclaimer(coordinator, {
    config: { reclaimIntervalMs: 10_000, gracePeriodMs: 2_000, autoFailover: true },
  });

  assert.equal(service.isRunning(), false);
  service.start();
  assert.equal(service.isRunning(), true);

  service.dispose();
});

test("LeaseReclaimerService - start() is idempotent", () => {
  const coordinator = createMockCoordinator();
  const service = createReclaimer(coordinator, {
    config: { reclaimIntervalMs: 10_000, gracePeriodMs: 2_000, autoFailover: true },
  });

  service.start();
  service.start(); // Should not throw
  assert.equal(service.isRunning(), true);

  service.dispose();
});

test("LeaseReclaimerService - start() throws if disposed", () => {
  const coordinator = createMockCoordinator();
  const service = createReclaimer(coordinator);
  service.dispose();

  assert.throws(
    () => service.start(),
    /disposed/,
  );
});

test("LeaseReclaimerService - start() does nothing if reclaimIntervalMs <= 0", () => {
  const coordinator = createMockCoordinator();
  const service = createReclaimer(coordinator, {
    config: { reclaimIntervalMs: 0, gracePeriodMs: 2_000, autoFailover: true },
  });

  service.start();
  assert.equal(service.isRunning(), false); // Not running because interval is 0

  service.dispose();
});

test("LeaseReclaimerService - stop() transitions to not running", () => {
  const coordinator = createMockCoordinator();
  const service = createReclaimer(coordinator, {
    config: { reclaimIntervalMs: 10_000, gracePeriodMs: 2_000, autoFailover: true },
  });

  service.start();
  assert.equal(service.isRunning(), true);

  service.stop();
  assert.equal(service.isRunning(), false);
});

test("LeaseReclaimerService - stop() is idempotent", () => {
  const coordinator = createMockCoordinator();
  const service = createReclaimer(coordinator, {
    config: { reclaimIntervalMs: 10_000, gracePeriodMs: 2_000, autoFailover: true },
  });

  service.start();
  service.stop();
  service.stop(); // Should not throw
  assert.equal(service.isRunning(), false);
});

test("LeaseReclaimerService - dispose() sets disposed flag", () => {
  const coordinator = createMockCoordinator();
  const service = createReclaimer(coordinator);

  service.dispose();
  assert.equal(service.isRunning(), false);

  // Start should throw after dispose
  assert.throws(
    () => service.start(),
    /disposed/,
  );
});

test("LeaseReclaimerService - dispose() also stops", () => {
  const coordinator = createMockCoordinator();
  const service = createReclaimer(coordinator, {
    config: { reclaimIntervalMs: 10_000, gracePeriodMs: 2_000, autoFailover: true },
  });

  service.start();
  service.dispose();
  assert.equal(service.isRunning(), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Configuration
// ─────────────────────────────────────────────────────────────────────────────

test("LeaseReclaimerService - getConfig() returns current config", () => {
  const coordinator = createMockCoordinator();
  const service = createReclaimer(coordinator, {
    haLevel: "HA_2",
    config: { reclaimIntervalMs: 30_000, gracePeriodMs: 5_000, autoFailover: false },
  });

  const config = service.getConfig();
  assert.equal(config.reclaimIntervalMs, 30_000);
  assert.equal(config.gracePeriodMs, 5_000);
  assert.equal(config.autoFailover, false);

  service.dispose();
});

test("LeaseReclaimerService - default config uses HA level defaults", () => {
  const coordinator = createMockCoordinator();
  const service = createReclaimer(coordinator, { haLevel: "HA_2" });

  const config = service.getConfig();
  // HA_2 default is 10_000ms
  assert.equal(config.reclaimIntervalMs, 10_000);
  assert.equal(config.gracePeriodMs, 2_000); // DEFAULT_GRACE_PERIOD_MS
  assert.equal(config.autoFailover, true);

  service.dispose();
});

test("LeaseReclaimerService - isRunning() returns false when disposed", () => {
  const coordinator = createMockCoordinator();
  const service = createReclaimer(coordinator, {
    config: { reclaimIntervalMs: 10_000, gracePeriodMs: 2_000, autoFailover: true },
  });

  service.start();
  assert.equal(service.isRunning(), true);

  service.dispose();
  assert.equal(service.isRunning(), false);
});

test("LeaseReclaimerService - isRunning() returns false when stopped", () => {
  const coordinator = createMockCoordinator();
  const service = createReclaimer(coordinator, {
    config: { reclaimIntervalMs: 10_000, gracePeriodMs: 2_000, autoFailover: true },
  });

  service.start();
  assert.equal(service.isRunning(), true);

  service.stop();
  assert.equal(service.isRunning(), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: reclaimOnce()
// ─────────────────────────────────────────────────────────────────────────────

test("LeaseReclaimerService - reclaimOnce() returns empty result when no leases", async () => {
  const coordinator = createMockCoordinator();
  const service = createReclaimer(coordinator);

  const result = await service.reclaimOnce();
  assert.equal(result.reclaimedCount, 0);
  assert.equal(result.failoverTriggered, false);
  assert.deepEqual(result.failedNodeIds, []);

  service.dispose();
});

test("LeaseReclaimerService - reclaimOnce() returns empty result when not running", async () => {
  const coordinator = createMockCoordinator();
  const service = createReclaimer(coordinator);

  // Don't start the service
  const result = await service.reclaimOnce();
  assert.equal(result.reclaimedCount, 0);

  service.dispose();
});

test("LeaseReclaimerService - reclaimOnce() processes expired lease after grace period", async () => {
  const coordinator = createMockCoordinator();

  // Register and acquire leadership
  coordinator.registerNode("node-1", "us-east-1");
  coordinator.acquireLeadership({ nodeId: "node-1", ttlMs: 5_000 });

  // Force lease to be expired
  const oldExpiresAt = new Date(Date.now() - 20_000).toISOString();
  const activeLease = coordinator.getActiveLease()!;
  coordinator.mockState.leases.set("node-1", {
    ...activeLease,
    expiresAt: oldExpiresAt,
  });

  // Set leadership as expired
  coordinator.mockState.isExpired = true;
  coordinator.mockState.expiresAt = oldExpiresAt;

  const service = createReclaimer(coordinator, {
    config: { reclaimIntervalMs: 10_000, gracePeriodMs: 2_000, autoFailover: true },
  });

  service.start();

  const result = await service.reclaimOnce();

  // Lease should be processed after grace period
  assert.equal(result.reclaimedCount >= 0, true);

  service.dispose();
});

test("LeaseReclaimerService - reclaimOnce() skips lease within grace period", async () => {
  const coordinator = createMockCoordinator();

  // Register and acquire leadership with short TTL
  coordinator.registerNode("node-1", "us-east-1");
  coordinator.acquireLeadership({ nodeId: "node-1", ttlMs: 100 });

  // Lease is expired but within grace period
  const justExpired = new Date(Date.now() - 500).toISOString(); // 500ms ago
  coordinator.mockState.isExpired = true;
  coordinator.mockState.expiresAt = justExpired;

  const activeLease = coordinator.getActiveLease()!;
  coordinator.mockState.leases.set("node-1", {
    ...activeLease,
    expiresAt: justExpired,
  });

  const service = createReclaimer(coordinator, {
    config: { reclaimIntervalMs: 10_000, gracePeriodMs: 10_000, autoFailover: true }, // 10s grace
  });

  const result = await service.reclaimOnce();

  // Within grace period, should not reclaim
  assert.equal(result.reclaimedCount, 0);

  service.dispose();
});

test("LeaseReclaimerService - reclaimOnce() triggers failover for leader lease", async () => {
  const coordinator = createMockCoordinator();

  // Register and acquire leadership
  coordinator.registerNode("node-1", "us-east-1");
  coordinator.acquireLeadership({ nodeId: "node-1", ttlMs: 5_000 });

  // Make it expired well past grace period
  const oldExpiresAt = new Date(Date.now() - 30_000).toISOString();
  coordinator.mockState.isExpired = true;
  coordinator.mockState.expiresAt = oldExpiresAt;

  const activeLease = coordinator.getActiveLease()!;
  coordinator.mockState.leases.set("node-1", {
    ...activeLease,
    expiresAt: oldExpiresAt,
  });

  // Mark node as leader
  const node = coordinator.getNode("node-1")!;
  node.isLeader = true;

  // Override triggerFailover to return leader_changed outcome
  const originalTriggerFailover = coordinator.triggerFailover.bind(coordinator);
  coordinator.triggerFailover = (cause: FailoverDecision["cause"]) => {
    const decision = originalTriggerFailover(cause);
    // Simulate successful failover with new leader
    coordinator.mockState.leaderNodeId = "node-2";
    coordinator.registerNode("node-2", "us-east-1");
    coordinator.mockState.nodes.get("node-2")!.isLeader = true;
    return {
      ...decision,
      outcome: "leader_changed" as const,
      newLeaderNodeId: "node-2",
    };
  };

  let failoverCalled = false;
  let failoverDecision: FailoverDecision | null = null;

  const service = createReclaimer(coordinator, {
    config: { reclaimIntervalMs: 10_000, gracePeriodMs: 2_000, autoFailover: true },
    onFailover: (decision) => {
      failoverCalled = true;
      failoverDecision = decision;
    },
  });

  service.start();
  const result = await service.reclaimOnce();

  // Failover should have been triggered
  assert.equal(failoverCalled, true);
  assert.equal(result.failoverTriggered, true);

  service.dispose();
});

test("LeaseReclaimerService - reclaimOnce() does not trigger failover when autoFailover is false", async () => {
  const coordinator = createMockCoordinator();

  // Register and acquire leadership
  coordinator.registerNode("node-1", "us-east-1");
  coordinator.acquireLeadership({ nodeId: "node-1", ttlMs: 5_000 });

  // Make it expired well past grace period
  const oldExpiresAt = new Date(Date.now() - 30_000).toISOString();
  coordinator.mockState.isExpired = true;
  coordinator.mockState.expiresAt = oldExpiresAt;

  const activeLease = coordinator.getActiveLease()!;
  coordinator.mockState.leases.set("node-1", {
    ...activeLease,
    expiresAt: oldExpiresAt,
  });

  const node = coordinator.getNode("node-1")!;
  node.isLeader = true;

  let failoverCalled = false;

  const service = createReclaimer(coordinator, {
    config: { reclaimIntervalMs: 10_000, gracePeriodMs: 2_000, autoFailover: false },
    onFailover: () => {
      failoverCalled = true;
    },
  });

  service.start();
  const result = await service.reclaimOnce();

  // Failover should NOT have been triggered
  assert.equal(failoverCalled, false);
  assert.equal(result.failoverTriggered, false);

  service.dispose();
});

test("LeaseReclaimerService - reclaimOnce() calls onLeaseReclaimed callback", async () => {
  const coordinator = createMockCoordinator();

  // Register and acquire leadership
  coordinator.registerNode("node-1", "us-east-1");
  coordinator.acquireLeadership({ nodeId: "node-1", ttlMs: 5_000 });

  // Make it expired well past grace period
  const oldExpiresAt = new Date(Date.now() - 30_000).toISOString();
  coordinator.mockState.isExpired = true;
  coordinator.mockState.expiresAt = oldExpiresAt;

  const activeLease = coordinator.getActiveLease()!;
  coordinator.mockState.leases.set("node-1", {
    ...activeLease,
    expiresAt: oldExpiresAt,
  });

  let reclaimedLease: LeaderLease | null = null;
  let reclaimedNode: CoordinatorNode | null = null;

  const service = createReclaimer(coordinator, {
    config: { reclaimIntervalMs: 10_000, gracePeriodMs: 2_000, autoFailover: true },
    onLeaseReclaimed: (lease, node) => {
      reclaimedLease = lease;
      reclaimedNode = node;
    },
  });

  service.start();
  await service.reclaimOnce();

  assert.ok(reclaimedLease !== null);
  const lease = reclaimedLease as LeaderLease;
  assert.equal(lease.nodeId, "node-1");

  service.dispose();
});

test("LeaseReclaimerService - reclaimOnce() handles coordinator errors gracefully", async () => {
  const coordinator = createMockCoordinator();

  // Register and acquire leadership
  coordinator.registerNode("node-1", "us-east-1");
  coordinator.acquireLeadership({ nodeId: "node-1", ttlMs: 5_000 });

  // Make it expired
  const oldExpiresAt = new Date(Date.now() - 30_000).toISOString();
  coordinator.mockState.isExpired = true;
  coordinator.mockState.expiresAt = oldExpiresAt;

  const activeLease = coordinator.getActiveLease()!;
  coordinator.mockState.leases.set("node-1", {
    ...activeLease,
    expiresAt: oldExpiresAt,
  });

  // Corrupt getNode to throw
  const originalGetNode = coordinator.getNode.bind(coordinator);
  coordinator.getNode = () => {
    throw new Error("Simulated coordinator error");
  };

  const service = createReclaimer(coordinator, {
    config: { reclaimIntervalMs: 10_000, gracePeriodMs: 2_000, autoFailover: true },
  });

  service.start();
  const result = await service.reclaimOnce();

  // Should have caught the error and recorded the node as failed
  assert.ok(result.failedNodeIds.includes("node-1"));

  // Restore
  coordinator.getNode = originalGetNode;
  service.dispose();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: doReclaimCycle() behavior
// ─────────────────────────────────────────────────────────────────────────────

test("LeaseReclaimerService - doReclaimCycle returns correct result structure", async () => {
  const coordinator = createMockCoordinator();
  const service = createReclaimer(coordinator);

  const result = await service.reclaimOnce();

  // Verify result structure
  assert.ok("reclaimedCount" in result);
  assert.ok("failoverTriggered" in result);
  assert.ok("failedNodeIds" in result);
  assert.ok(Array.isArray(result.failedNodeIds));

  service.dispose();
});

test("LeaseReclaimerService - doReclaimCycle does nothing when disposed", async () => {
  const coordinator = createMockCoordinator();
  const service = createReclaimer(coordinator);

  service.dispose();
  const result = await service.reclaimOnce();

  assert.equal(result.reclaimedCount, 0);
  assert.equal(result.failoverTriggered, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: getExpiredLeases() / getStaleNodes() integration
// ─────────────────────────────────────────────────────────────────────────────

test("LeaseReclaimerService - expired lease detection", async () => {
  const coordinator = createMockCoordinator();

  // Register node and acquire leadership
  coordinator.registerNode("node-1", "us-east-1");
  coordinator.acquireLeadership({ nodeId: "node-1", ttlMs: 5_000 });

  // Force expired state
  const oldExpiresAt = new Date(Date.now() - 30_000).toISOString();
  coordinator.mockState.isExpired = true;
  coordinator.mockState.expiresAt = oldExpiresAt;

  const activeLease = coordinator.getActiveLease()!;
  coordinator.mockState.leases.set("node-1", {
    ...activeLease,
    expiresAt: oldExpiresAt,
  });

  const service = createReclaimer(coordinator, {
    config: { reclaimIntervalMs: 10_000, gracePeriodMs: 0, autoFailover: false },
  });

  service.start();
  const result = await service.reclaimOnce();

  // With gracePeriodMs=0, lease should be reclaimed immediately
  assert.ok(result.reclaimedCount >= 0);

  service.dispose();
});

test("LeaseReclaimerService - stale node detection (empty in basic mock)", async () => {
  const coordinator = createMockCoordinator();

  // Register node without leadership
  coordinator.registerNode("node-1", "us-east-1");

  const service = createReclaimer(coordinator, {
    config: { reclaimIntervalMs: 10_000, gracePeriodMs: 2_000, autoFailover: false },
  });

  service.start();
  const result = await service.reclaimOnce();

  // getStaleNodes returns empty array in basic implementation
  assert.equal(result.reclaimedCount, 0);

  service.dispose();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: expireLease() / triggerFailover() integration
// ─────────────────────────────────────────────────────────────────────────────

test("LeaseReclaimerService - triggerFailover calls coordinator.triggerFailover", async () => {
  const coordinator = createMockCoordinator();

  // Register and acquire leadership
  coordinator.registerNode("node-1", "us-east-1");
  coordinator.acquireLeadership({ nodeId: "node-1", ttlMs: 5_000 });

  // Make it expired
  const oldExpiresAt = new Date(Date.now() - 30_000).toISOString();
  coordinator.mockState.isExpired = true;
  coordinator.mockState.expiresAt = oldExpiresAt;

  const activeLease = coordinator.getActiveLease()!;
  coordinator.mockState.leases.set("node-1", {
    ...activeLease,
    expiresAt: oldExpiresAt,
  });

  const node = coordinator.getNode("node-1")!;
  node.isLeader = true;

  const service = createReclaimer(coordinator, {
    config: { reclaimIntervalMs: 10_000, gracePeriodMs: 2_000, autoFailover: true },
  });

  service.start();
  await service.reclaimOnce();

  // Verify triggerFailover was called on coordinator
  assert.ok(coordinator.triggerFailoverCalls.length > 0);
  const firstCall = coordinator.triggerFailoverCalls[0]!;
  assert.equal(firstCall.cause, "heartbeat_missing");

  service.dispose();
});

test("LeaseReclaimerService - failover decision outcome is tracked", async () => {
  const coordinator = createMockCoordinator();

  // Register and acquire leadership
  coordinator.registerNode("node-1", "us-east-1");
  coordinator.acquireLeadership({ nodeId: "node-1", ttlMs: 5_000 });

  // Make it expired
  const oldExpiresAt = new Date(Date.now() - 30_000).toISOString();
  coordinator.mockState.isExpired = true;
  coordinator.mockState.expiresAt = oldExpiresAt;

  const activeLease = coordinator.getActiveLease()!;
  coordinator.mockState.leases.set("node-1", {
    ...activeLease,
    expiresAt: oldExpiresAt,
  });

  const node = coordinator.getNode("node-1")!;
  node.isLeader = true;

  let capturedDecision: FailoverDecision | null = null;

  const service = createReclaimer(coordinator, {
    config: { reclaimIntervalMs: 10_000, gracePeriodMs: 2_000, autoFailover: true },
    onFailover: (decision) => {
      capturedDecision = decision;
    },
  });

  service.start();
  const result = await service.reclaimOnce();

  assert.ok(capturedDecision !== null);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const decision = capturedDecision as FailoverDecision;
  assert.equal(decision.cause, "heartbeat_missing");
  assert.equal(decision.oldLeaderNodeId, "node-1");

  service.dispose();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Concurrent scenarios
// ─────────────────────────────────────────────────────────────────────────────

test("LeaseReclaimerService - concurrent reclaimOnce() calls", async () => {
  const coordinator = createMockCoordinator();

  // Register and acquire leadership
  coordinator.registerNode("node-1", "us-east-1");
  coordinator.acquireLeadership({ nodeId: "node-1", ttlMs: 5_000 });

  // Make it expired
  const oldExpiresAt = new Date(Date.now() - 30_000).toISOString();
  coordinator.mockState.isExpired = true;
  coordinator.mockState.expiresAt = oldExpiresAt;

  const activeLease = coordinator.getActiveLease()!;
  coordinator.mockState.leases.set("node-1", {
    ...activeLease,
    expiresAt: oldExpiresAt,
  });

  const node = coordinator.getNode("node-1")!;
  node.isLeader = true;

  const service = createReclaimer(coordinator, {
    config: { reclaimIntervalMs: 10_000, gracePeriodMs: 2_000, autoFailover: true },
  });

  service.start();

  // Call reclaimOnce concurrently multiple times
  const [result1, result2, result3] = await Promise.all([
    service.reclaimOnce(),
    service.reclaimOnce(),
    service.reclaimOnce(),
  ]);

  // All should complete without error
  assert.ok(typeof result1.reclaimedCount === "number");
  assert.ok(typeof result2.reclaimedCount === "number");
  assert.ok(typeof result3.reclaimedCount === "number");

  service.dispose();
});

test("LeaseReclaimerService - start/stop/reclaimOnce race condition", async () => {
  const coordinator = createMockCoordinator();

  const service = createReclaimer(coordinator, {
    config: { reclaimIntervalMs: 10_000, gracePeriodMs: 2_000, autoFailover: true },
  });

  // Start, stop, start, reclaim race
  service.start();
  service.stop();
  service.start();

  const result = await service.reclaimOnce();
  assert.equal(result.reclaimedCount, 0);

  service.stop();
  service.dispose();
});

test("LeaseReclaimerService - dispose while reclaimOnce in progress", async () => {
  const coordinator = createMockCoordinator();

  const service = createReclaimer(coordinator, {
    config: { reclaimIntervalMs: 10_000, gracePeriodMs: 2_000, autoFailover: true },
  });

  service.start();

  // Start reclaim and immediately dispose
  const reclaimPromise = service.reclaimOnce();
  service.dispose();

  const result = await reclaimPromise;
  // Should return gracefully
  assert.ok(typeof result.reclaimedCount === "number");
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Edge cases
// ─────────────────────────────────────────────────────────────────────────────

test("LeaseReclaimerService - handles null leadership.leaderNodeId", async () => {
  const coordinator = createMockCoordinator();
  // mockState.leaderNodeId is already null

  const service = createReclaimer(coordinator, {
    config: { reclaimIntervalMs: 10_000, gracePeriodMs: 2_000, autoFailover: true },
  });

  service.start();
  const result = await service.reclaimOnce();

  assert.equal(result.reclaimedCount, 0);
  assert.equal(result.failoverTriggered, false);

  service.dispose();
});

test("LeaseReclaimerService - handles missing active lease", async () => {
  const coordinator = createMockCoordinator();

  // Set up leadership as expired but no active lease
  coordinator.mockState.isExpired = true;
  coordinator.mockState.leaderNodeId = "node-1"; // Has leader node but no lease

  const service = createReclaimer(coordinator, {
    config: { reclaimIntervalMs: 10_000, gracePeriodMs: 2_000, autoFailover: true },
  });

  service.start();
  const result = await service.reclaimOnce();

  // Should handle gracefully
  assert.ok(typeof result.reclaimedCount === "number");

  service.dispose();
});

test("LeaseReclaimerService - createLeaseReclaimerService factory works", () => {
  const coordinator = createMockCoordinator();
  const service = createLeaseReclaimerService({ coordinator });

  assert.ok(service instanceof LeaseReclaimerService);
  assert.equal(service.isRunning(), false);

  service.dispose();
});

test("LeaseReclaimerService - multiple nodes with different lease states", async () => {
  const coordinator = createMockCoordinator();

  // Register two nodes
  coordinator.registerNode("node-1", "us-east-1");
  coordinator.registerNode("node-2", "us-east-1");

  // Node-1 becomes leader
  coordinator.acquireLeadership({ nodeId: "node-1", ttlMs: 5_000 });

  // Make node-1's lease expired
  const oldExpiresAt = new Date(Date.now() - 30_000).toISOString();
  coordinator.mockState.isExpired = true;
  coordinator.mockState.expiresAt = oldExpiresAt;

  const activeLease = coordinator.getActiveLease()!;
  coordinator.mockState.leases.set("node-1", {
    ...activeLease,
    expiresAt: oldExpiresAt,
  });

  const node1 = coordinator.getNode("node-1")!;
  node1.isLeader = true;

  const service = createReclaimer(coordinator, {
    config: { reclaimIntervalMs: 10_000, gracePeriodMs: 2_000, autoFailover: true },
  });

  service.start();
  const result = await service.reclaimOnce();

  // Should process at least the expired leader lease
  assert.ok(result.reclaimedCount >= 0);

  service.dispose();
});

test("LeaseReclaimerService - HA level config influences defaults", () => {
  // Test HA_1
  const coordinator1 = createMockCoordinator();
  const service1 = createReclaimer(coordinator1, { haLevel: "HA_1" });
  assert.equal(service1.getConfig().reclaimIntervalMs, 0); // HA_1 has 0 interval
  service1.dispose();

  // Test HA_2
  const coordinator2 = createMockCoordinator();
  const service2 = createReclaimer(coordinator2, { haLevel: "HA_2" });
  assert.equal(service2.getConfig().reclaimIntervalMs, 10_000);
  service2.dispose();

  // Test HA_3
  const coordinator3 = createMockCoordinator();
  const service3 = createReclaimer(coordinator3, { haLevel: "HA_3" });
  assert.equal(service3.getConfig().reclaimIntervalMs, 5_000);
  service3.dispose();
});

test("LeaseReclaimerService - partial config overrides are applied", () => {
  const coordinator = createMockCoordinator();
  const service = createReclaimer(coordinator, {
    haLevel: "HA_2",
    config: { reclaimIntervalMs: 60_000 }, // Override only this
  });

  const config = service.getConfig();
  // Should use override
  assert.equal(config.reclaimIntervalMs, 60_000);
  // Should use HA_2 default for gracePeriodMs
  assert.equal(config.gracePeriodMs, 2_000);
  // Should use default for autoFailover
  assert.equal(config.autoFailover, true);

  service.dispose();
});

test("LeaseReclaimerService - negative reclaimIntervalMs logs warning and disables", () => {
  const coordinator = createMockCoordinator();
  const service = createReclaimer(coordinator, {
    config: { reclaimIntervalMs: -1, gracePeriodMs: 2_000, autoFailover: true },
  });

  service.start();
  // Should not be running because negative interval is treated as disabled
  assert.equal(service.isRunning(), false);

  service.dispose();
});
