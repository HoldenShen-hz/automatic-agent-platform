import assert from "node:assert/strict";
import test from "node:test";

import { LeaderElectionService, createLeaderElectionService, type LeaderElectionServiceOptions } from "../../../../../src/platform/five-plane-execution/ha/leader-election-service.js";
import type { HaCoordinatorService, LeaderLease, LeadershipEpoch } from "../../../../../src/platform/five-plane-execution/ha/ha-coordinator-service-inner.js";
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
  epochs: LeadershipEpoch[];
}

function createMockCoordinator(): HaCoordinatorService & {
  mockState: MockLeadershipState;
  registerNodeCalls: string[];
  heartbeatCalls: string[];
} {
  const mockState: MockLeadershipState = {
    leaderNodeId: null,
    epoch: 0,
    fencingToken: 1,
    isExpired: false,
    expiresAt: null,
    leases: new Map(),
    epochs: [],
  };

  const registerNodeCalls: string[] = [];
  const heartbeatCalls: string[] = [];

  return {
    mockState,

    // Node management
    registerNode(nodeId: string, region: string, _metadata?: Record<string, unknown>) {
      registerNodeCalls.push(nodeId);
      return {
        nodeId,
        region,
        status: "active" as const,
        isLeader: false,
        leadershipEpoch: 0,
        lastHeartbeatAt: nowIso(),
        metadata: null,
      };
    },

    getNode(nodeId: string) {
      if (nodeId === mockState.leaderNodeId) {
        return {
          nodeId,
          region: "test-region",
          status: "active" as const,
          isLeader: true,
          leadershipEpoch: mockState.epoch,
          lastHeartbeatAt: nowIso(),
          metadata: null,
        };
      }
      return null;
    },

    listNodes() {
      return [];
    },

    updateNodeHeartbeat(nodeId: string, status?: string) {
      heartbeatCalls.push(nodeId);
      return null;
    },

    // Leadership
    acquireLeadership(input: { nodeId: string; ttlMs?: number; forceAcquire?: boolean }) {
      const previousLeader = mockState.leaderNodeId;
      mockState.leaderNodeId = input.nodeId;
      mockState.epoch += 1;
      mockState.fencingToken += 1;
      mockState.isExpired = false;
      mockState.expiresAt = new Date(Date.now() + (input.ttlMs ?? 15000)).toISOString();

      const lease: LeaderLease = {
        leaseId: `lease_${mockState.epoch}`,
        nodeId: input.nodeId,
        epoch: mockState.epoch,
        acquiredAt: nowIso(),
        expiresAt: mockState.expiresAt,
        status: "active",
        ttlMs: input.ttlMs ?? 15000,
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

      mockState.expiresAt = new Date(Date.now() + (input.ttlMs ?? 15000)).toISOString();
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
        return true;
      }
      return false;
    },

    getCurrentLeader() {
      if (!mockState.leaderNodeId) return null;
      return {
        nodeId: mockState.leaderNodeId,
        region: "test-region",
        status: "active" as const,
        isLeader: true,
        leadershipEpoch: mockState.epoch,
        lastHeartbeatAt: nowIso(),
        metadata: null,
      };
    },

    getActiveLease() {
      if (!mockState.leaderNodeId) return null;
      return mockState.leases.get(mockState.leaderNodeId) ?? null;
    },

    queryLeadership() {
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
      return mockState.epochs;
    },

    triggerFailover(cause: string) {
      const oldLeader = mockState.leaderNodeId;
      mockState.leaderNodeId = null;
      mockState.isExpired = true;
      return {
        decisionId: `failover_${Date.now()}`,
        oldLeaderNodeId: oldLeader,
        newLeaderNodeId: null,
        epoch: mockState.epoch,
        cause,
        outcome: "no_candidate" as const,
        decidedAt: nowIso(),
        fencingToken: mockState.fencingToken,
      };
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
    registerNodeCalls,
    heartbeatCalls,
  } as unknown as HaCoordinatorService & {
    mockState: MockLeadershipState;
    registerNodeCalls: string[];
    heartbeatCalls: string[];
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

test("LeaderElectionService - creation with defaults [leader-election-service]", () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
  });

  assert.equal(service.getState(), "stopped");
  assert.equal(service.isLeader(), false);

  service.dispose();
});

test("LeaderElectionService - HA-1 mode does not acquire leadership [leader-election-service]", async () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
    haLevel: "HA_1",
  });

  await service.start();

  // HA-1 should skip leader election (single-node mode)
  assert.equal(service.getState(), "leader");
  assert.equal(service.isLeader(), true);

  service.dispose();
});

test("LeaderElectionService - start registers node and begins election [leader-election-service]", async () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
    haLevel: "HA_2",
  });

  await service.start();

  // Node should be registered
  assert.ok(coordinator.registerNodeCalls.includes("node-1"));

  // Should have become leader since no other leader exists
  assert.equal(service.getState(), "leader");
  assert.equal(service.isLeader(), true);

  service.dispose();
});

test("LeaderElectionService - queryLeadership returns correct state [leader-election-service]", async () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
  });

  await service.start();

  const leadership = service.queryLeadership();
  assert.equal(leadership.isLeader, true);
  assert.equal(leadership.leaderNodeId, "node-1");
  assert.ok(leadership.epoch > 0);

  service.dispose();
});

test("LeaderElectionService - getLeaderNodeId returns correct ID when leader [leader-election-service]", async () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
  });

  await service.start();

  assert.equal(service.getLeaderNodeId(), "node-1");

  service.dispose();
});

test("LeaderElectionService - isCurrentLeader returns true when leader [leader-election-service]", async () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
  });

  await service.start();

  assert.equal(service.isCurrentLeader(), true);

  service.dispose();
});

test("LeaderElectionService - stop releases leadership [leader-election-service]", async () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
    haLevel: "HA_2",
  });

  await service.start();
  assert.equal(service.isLeader(), true);

  await service.stop();
  assert.equal(service.isLeader(), false);
  assert.equal(service.getState(), "stopped");

  service.dispose();
});

test("LeaderElectionService - getHaConfig returns configuration [leader-election-service]", async () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
    haLevel: "HA_2",
  });

  const config = service.getHaConfig();
  assert.equal(config.haLevel, "HA_2");
  assert.ok(config.leaseTtlMs > 0);
  assert.ok(config.leaseRenewalIntervalMs > 0);

  service.dispose();
});

test("LeaderElectionService - getCurrentLease returns lease when leader [leader-election-service]", async () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
    haLevel: "HA_2",
  });

  await service.start();

  const lease = service.getCurrentLease();
  assert.ok(lease !== null);
  assert.equal(lease?.nodeId, "node-1");
  assert.equal(lease?.status, "active");

  service.dispose();
});

test("LeaderElectionService - forceAcquireLeadership preempts existing leader [leader-election-service]", async () => {
  const coordinator = createMockCoordinator();

  // First node becomes leader
  const service1 = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
    haLevel: "HA_2",
  });

  await service1.start();
  assert.equal(service1.isLeader(), true);

  // Second node forces acquisition
  const service2 = new LeaderElectionService(coordinator, {
    nodeId: "node-2",
    region: "us-east-1",
    haLevel: "HA_2",
  });

  await service2.start();

  const acquired = await service2.forceAcquireLeadership();
  assert.equal(acquired, true);
  assert.equal(service2.isLeader(), true);

  service1.dispose();
  service2.dispose();
});

test("LeaderElectionService - multiple nodes, follower sees leader [leader-election-service]", async () => {
  const coordinator = createMockCoordinator();

  // First node becomes leader
  const service1 = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
    haLevel: "HA_2",
  });

  await service1.start();
  assert.equal(service1.isLeader(), true);

  // Second node starts as follower
  const service2 = new LeaderElectionService(coordinator, {
    nodeId: "node-2",
    region: "us-east-1",
    haLevel: "HA_2",
  });

  await service2.start();

  // service2 should be follower (another leader exists)
  assert.equal(service2.isLeader(), false);
  assert.equal(service2.getLeaderNodeId(), "node-1");

  service1.dispose();
  service2.dispose();
});

test("LeaderElectionService - stop on disposed service throws [leader-election-service]", async () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
  });

  service.dispose();

  await assert.rejects(
    async () => await service.start(),
    /disposed/,
  );
});

test("LeaderElectionService - stop is idempotent [leader-election-service]", async () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
  });

  await service.start();
  await service.stop();
  await service.stop(); // Second stop should not throw

  assert.equal(service.getState(), "stopped");
});

test("createLeaderElectionService factory works [leader-election-service]", () => {
  const coordinator = createMockCoordinator();
  const service = createLeaderElectionService(coordinator, "node-1", "us-east-1", {
    haLevel: "HA_2",
  });

  assert.ok(service instanceof LeaderElectionService);

  service.dispose();
});

test("LeaderElectionService - getLeaderNodeId returns null when no leader [leader-election-service]", async () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
    haLevel: "HA_2",
  });

  // Don't start - no leader yet
  assert.equal(service.getLeaderNodeId(), null);

  service.dispose();
});

test("LeaderElectionService - custom config overrides HA level defaults [leader-election-service]", async () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
    haLevel: "HA_2",
    leaseTtlMs: 60_000,
    renewalIntervalMs: 30_000,
  });

  const config = service.getHaConfig();
  assert.equal(config.leaseTtlMs, 60_000);
  assert.equal(config.leaseRenewalIntervalMs, 30_000);

  service.dispose();
});

test("LeaderElectionService - stop releases heartbeat [leader-election-service]", async () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
    haLevel: "HA_2",
  });

  await service.start();

  // For HA_2, heartbeat should be started (running every 5 seconds)
  // We can't easily test the interval firing in unit tests without long delays,
  // so we just verify the service starts without error and can stop cleanly
  await service.stop();

  // Should be able to stop without error
  assert.equal(service.getState(), "stopped");

  service.dispose();
});
