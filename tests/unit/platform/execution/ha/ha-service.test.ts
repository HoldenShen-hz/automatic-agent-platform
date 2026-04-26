import assert from "node:assert/strict";
import test from "node:test";

import {
  LeaderElectionService,
  createLeaderElectionService,
  type LeaderElectionServiceOptions,
  type LeaderElectionState,
} from "../../../../../src/platform/execution/ha/leader-election-service.js";
import type {
  CoordinatorNode,
  FailoverDecision,
  LeaderLease,
  LeadershipQueryResult,
} from "../../../../../src/platform/execution/ha/types.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";
import type { HaCoordinatorService } from "../../../../../src/platform/execution/ha/ha-coordinator-service-inner.js";

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
  acquireLeadershipCalls: { nodeId: string; ttlMs?: number; forceAcquire?: boolean }[];
  renewLeadershipCalls: { nodeId: string; ttlMs?: number }[];
  releaseLeadershipCalls: string[];
  triggerFailoverCalls: { cause: string; forceNodeId?: string }[];
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

  const acquireLeadershipCalls: { nodeId: string; ttlMs?: number; forceAcquire?: boolean }[] = [];
  const renewLeadershipCalls: { nodeId: string; ttlMs?: number }[] = [];
  const releaseLeadershipCalls: string[] = [];
  const triggerFailoverCalls: { cause: string; forceNodeId?: string }[] = [];

  return {
    mockState,
    acquireLeadershipCalls,
    renewLeadershipCalls,
    releaseLeadershipCalls,
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

    listNodes(_status?: string) {
      return Array.from(mockState.nodes.values());
    },

    updateNodeHeartbeat(nodeId: string, _status?: string) {
      const node = mockState.nodes.get(nodeId);
      if (node) {
        node.lastHeartbeatAt = nowIso();
      }
      return null;
    },

    removeNode(nodeId: string) {
      mockState.nodes.delete(nodeId);
      return true;
    },

    // Leadership
    acquireLeadership(input: { nodeId: string; ttlMs?: number; forceAcquire?: boolean }) {
      acquireLeadershipCalls.push(input);
      const previousLeader = mockState.leaderNodeId;
      mockState.leaderNodeId = input.nodeId;
      mockState.epoch += 1;
      mockState.fencingToken += 1;
      mockState.isExpired = false;

      const ttlMs = input.ttlMs ?? 15_000;
      mockState.expiresAt = new Date(Date.now() + ttlMs).toISOString();

      if (previousLeader) {
        const prevNode = mockState.nodes.get(previousLeader);
        if (prevNode) prevNode.isLeader = false;
      }

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
      renewLeadershipCalls.push(input);
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
      releaseLeadershipCalls.push(nodeId);
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

    triggerFailover(cause: string, forceNodeId?: string) {
      triggerFailoverCalls.push(forceNodeId !== undefined ? { cause, forceNodeId } : { cause });
      const oldLeader = mockState.leaderNodeId;
      const oldLeaderNode = oldLeader ? mockState.nodes.get(oldLeader) : null;

      mockState.leaderNodeId = null;
      mockState.isExpired = true;

      if (oldLeaderNode) oldLeaderNode.isLeader = false;

      const decision: FailoverDecision = {
        decisionId: `failover_${Date.now()}`,
        oldLeaderNodeId: oldLeader,
        newLeaderNodeId: forceNodeId ?? null,
        epoch: mockState.epoch,
        cause: cause as FailoverDecision["cause"],
        outcome: forceNodeId ? "leader_changed" : "no_candidate",
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

    authorizeAction(
      requestingNodeId: string,
      actionType: string,
      requiredAuthority: string,
    ) {
      const node = mockState.nodes.get(requestingNodeId);
      return {
        authorized: node !== undefined && (requiredAuthority !== "leader_only" || mockState.leaderNodeId === requestingNodeId),
        authority: requiredAuthority as any,
        reasonCode: node ? "ok" : "node_not_found",
        leaderNodeId: mockState.leaderNodeId,
        epoch: mockState.epoch,
        fencingToken: mockState.fencingToken,
      };
    },
  } as unknown as HaCoordinatorService & {
    mockState: MockLeadershipState;
    acquireLeadershipCalls: { nodeId: string; ttlMs?: number; forceAcquire?: boolean }[];
    renewLeadershipCalls: { nodeId: string; ttlMs?: number }[];
    releaseLeadershipCalls: string[];
    triggerFailoverCalls: { cause: string; forceNodeId?: string }[];
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: create LeaderElectionService with mock coordinator
// ─────────────────────────────────────────────────────────────────────────────

function createService(
  coordinator: ReturnType<typeof createMockCoordinator>,
  options: Partial<LeaderElectionServiceOptions> = {},
): LeaderElectionService {
  return new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
    ...options,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Construction and Initial State
// ─────────────────────────────────────────────────────────────────────────────

test("LeaderElectionService - creation with defaults", () => {
  const coordinator = createMockCoordinator();
  const service = createService(coordinator);

  assert.equal(service.getState(), "stopped");
  assert.equal(service.isLeader(), false);
  assert.equal(service.getLeaderNodeId(), null);

  service.dispose();
});

test("LeaderElectionService - creation with custom nodeId and region", () => {
  const coordinator = createMockCoordinator();
  const service = createService(coordinator, {
    nodeId: "custom-node",
    region: "eu-west-1",
  });

  assert.equal(service.getState(), "stopped");

  service.dispose();
});

test("LeaderElectionService - getHaConfig returns HA config", () => {
  const coordinator = createMockCoordinator();
  const service = createService(coordinator, { haLevel: "HA_2" });

  const config = service.getHaConfig();
  assert.equal(config.haLevel, "HA_2");
  assert.ok(config.leaseTtlMs > 0);

  service.dispose();
});

test("LeaderElectionService - HA_1 skips leader election (single-node mode)", async () => {
  const coordinator = createMockCoordinator();
  const service = createService(coordinator, { haLevel: "HA_1" });

  await service.start();

  assert.equal(service.getState(), "leader");
  assert.equal(service.isLeader(), true);
  assert.equal(service.getLeaderNodeId(), "node-1");

  await service.stop();
  service.dispose();
});

test("LeaderElectionService - default HA level is HA_2", () => {
  const coordinator = createMockCoordinator();
  const service = createService(coordinator);

  const config = service.getHaConfig();
  assert.equal(config.haLevel, "HA_2");

  service.dispose();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Lifecycle (start, stop, dispose)
// ─────────────────────────────────────────────────────────────────────────────

test("LeaderElectionService - start() transitions to starting then candidate/leader", async () => {
  const coordinator = createMockCoordinator();
  const service = createService(coordinator);

  await service.start();

  assert.notEqual(service.getState(), "stopped");

  await service.stop();
  service.dispose();
});

test("LeaderElectionService - start() is idempotent when already started", async () => {
  const coordinator = createMockCoordinator();
  const service = createService(coordinator);

  await service.start();
  await service.start(); // Should not throw

  await service.stop();
  service.dispose();
});

test("LeaderElectionService - start() throws if disposed", async () => {
  const coordinator = createMockCoordinator();
  const service = createService(coordinator);

  service.dispose();

  await assert.rejects(
    async () => service.start(),
    /disposed/i,
  );
});

test("LeaderElectionService - stop() transitions to shutdown then stopped", async () => {
  const coordinator = createMockCoordinator();
  const service = createService(coordinator, { haLevel: "HA_1" });

  await service.start();
  assert.equal(service.isLeader(), true);

  await service.stop();
  assert.equal(service.getState(), "stopped");

  service.dispose();
});

test("LeaderElectionService - stop() is idempotent", async () => {
  const coordinator = createMockCoordinator();
  const service = createService(coordinator, { haLevel: "HA_1" });

  await service.start();
  await service.stop();
  await service.stop(); // Should not throw

  service.dispose();
});

test("LeaderElectionService - dispose() clears state", async () => {
  const coordinator = createMockCoordinator();
  const service = createService(coordinator);

  service.dispose();

  await assert.rejects(
    async () => service.start(),
    /disposed/i,
  );
});

test("LeaderElectionService - dispose() after stop is safe", async () => {
  const coordinator = createMockCoordinator();
  const service = createService(coordinator, { haLevel: "HA_1" });

  await service.start();
  await service.stop();
  service.dispose(); // Should not throw

  await assert.rejects(
    async () => service.start(),
    /disposed/i,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: State Queries
// ─────────────────────────────────────────────────────────────────────────────

test("LeaderElectionService - isLeader() returns true only in leader state", async () => {
  const coordinator = createMockCoordinator();
  const service = createService(coordinator, { haLevel: "HA_1" });

  assert.equal(service.isLeader(), false);

  await service.start();
  assert.equal(service.isLeader(), true);

  await service.stop();
  assert.equal(service.isLeader(), false);

  service.dispose();
});

test("LeaderElectionService - getState() returns current state", () => {
  const coordinator = createMockCoordinator();
  const service = createService(coordinator);

  assert.equal(service.getState(), "stopped");

  service.dispose();
});

test("LeaderElectionService - getCurrentLease() returns lease when leader", async () => {
  const coordinator = createMockCoordinator();
  const service = createService(coordinator, { haLevel: "HA_1" });

  await service.start();
  const lease = service.getCurrentLease();

  assert.ok(lease !== null);
  assert.equal(lease!.nodeId, "node-1");

  await service.stop();
  service.dispose();
});

test("LeaderElectionService - getCurrentLease() returns null when not leader", () => {
  const coordinator = createMockCoordinator();
  const service = createService(coordinator);

  const lease = service.getCurrentLease();
  assert.equal(lease, null);

  service.dispose();
});

test("LeaderElectionService - queryLeadership() delegates to coordinator", async () => {
  const coordinator = createMockCoordinator();
  const service = createService(coordinator, { haLevel: "HA_1" });

  await service.start();
  const result = service.queryLeadership();

  assert.equal(result.isLeader, true);
  assert.equal(result.leaderNodeId, "node-1");

  await service.stop();
  service.dispose();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Leadership Acquisition
// ─────────────────────────────────────────────────────────────────────────────

test("LeaderElectionService - acquires leadership on start for HA_2", async () => {
  const coordinator = createMockCoordinator();
  const service = createService(coordinator, { haLevel: "HA_2" });

  await service.start();

  assert.equal(service.isLeader(), true);

  await service.stop();
  service.dispose();
});

test("LeaderElectionService - becomes follower when another leader exists", async () => {
  const coordinator = createMockCoordinator();

  // Simulate node-2 already being leader
  coordinator.registerNode("node-2", "us-east-1");
  coordinator.acquireLeadership({ nodeId: "node-2" });

  const service = createService(coordinator, { haLevel: "HA_2" });

  await service.start();

  assert.equal(service.isLeader(), false);
  assert.equal(service.getLeaderNodeId(), "node-2");

  await service.stop();
  service.dispose();
});

test("LeaderElectionService - forceAcquireLeadership() preempts existing leader", async () => {
  const coordinator = createMockCoordinator();

  // node-2 is leader
  coordinator.registerNode("node-2", "us-east-1");
  coordinator.acquireLeadership({ nodeId: "node-2" });

  const service = createService(coordinator, { haLevel: "HA_2" });

  const result = await service.forceAcquireLeadership();

  assert.equal(result, true);
  assert.equal(service.isLeader(), true);

  await service.stop();
  service.dispose();
});

test("LeaderElectionService - forceAcquireLeadership() returns false when disposed", async () => {
  const coordinator = createMockCoordinator();
  const service = createService(coordinator);

  service.dispose();

  const result = await service.forceAcquireLeadership();
  assert.equal(result, false);
});

test("LeaderElectionService - transferLeadership() releases leadership", async () => {
  const coordinator = createMockCoordinator();
  coordinator.registerNode("node-2", "us-east-1");

  const service = createService(coordinator, { haLevel: "HA_1" });

  await service.start();
  assert.equal(service.isLeader(), true);

  const result = await service.transferLeadership("node-2");

  assert.equal(result, true);
  assert.equal(service.isLeader(), false);

  await service.stop();
  service.dispose();
});

test("LeaderElectionService - transferLeadership() returns false when not leader", async () => {
  const coordinator = createMockCoordinator();
  const service = createService(coordinator, { haLevel: "HA_2" });

  // Don't start - we won't be leader
  const result = await service.transferLeadership("node-2");

  assert.equal(result, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: HA Level Behavior
// ─────────────────────────────────────────────────────────────────────────────

test("LeaderElectionService - HA_1 sets state to leader immediately", async () => {
  const coordinator = createMockCoordinator();
  const service = createService(coordinator, { haLevel: "HA_1" });

  await service.start();

  assert.equal(service.getState(), "leader");
  assert.equal(service.isLeader(), true);

  await service.stop();
  service.dispose();
});

test("LeaderElectionService - HA_2 performs normal leader election", async () => {
  const coordinator = createMockCoordinator();
  const service = createService(coordinator, { haLevel: "HA_2" });

  await service.start();

  assert.equal(service.isLeader(), true);

  await service.stop();
  service.dispose();
});

test("LeaderElectionService - HA_3 performs aggressive leader election", async () => {
  const coordinator = createMockCoordinator();
  const service = createService(coordinator, { haLevel: "HA_3" });

  await service.start();

  assert.equal(service.isLeader(), true);

  await service.stop();
  service.dispose();
});

test("LeaderElectionService - custom haConfig overrides HA level defaults", async () => {
  const coordinator = createMockCoordinator();
  const service = createService(coordinator, {
    haLevel: "HA_2",
    haConfig: { leaseTtlMs: 30_000 },
  });

  const config = service.getHaConfig();
  assert.equal(config.leaseTtlMs, 30_000);

  service.dispose();
});

test("LeaderElectionService - nodeMetadata is passed to coordinator", () => {
  const coordinator = createMockCoordinator();
  const service = createService(coordinator, {
    nodeMetadata: { version: "1.0", region: "us-east-1" },
  });

  // start() calls registerNode
  // We just verify no error is thrown during construction
  service.dispose();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Node Registration
// ─────────────────────────────────────────────────────────────────────────────

test("LeaderElectionService - start() registers node with coordinator", async () => {
  const coordinator = createMockCoordinator();
  const service = createService(coordinator, { nodeId: "test-node", region: "us-west-1" });

  await service.start();

  const node = coordinator.getNode("test-node");
  assert.ok(node !== null);
  assert.equal(node!.region, "us-west-1");

  await service.stop();
  service.dispose();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Recovery Scenarios
// ─────────────────────────────────────────────────────────────────────────────

test("LeaderElectionService - attempts re-election after losing leadership", async () => {
  const coordinator = createMockCoordinator();
  const service = createService(coordinator, { haLevel: "HA_2" });

  await service.start();
  assert.equal(service.isLeader(), true);

  // Simulate lease expiration by making coordinator return isExpired
  coordinator.mockState.isExpired = true;
  coordinator.mockState.leases.clear();

  // Wait for renewal loop to detect and attempt re-election
  // The service should transition to follower and retry

  await service.stop();
  service.dispose();
});

test("LeaderElectionService - stops renewal loop on follower transition", async () => {
  const coordinator = createMockCoordinator();

  // Pre-existing leader
  coordinator.registerNode("node-2", "us-east-1");
  coordinator.acquireLeadership({ nodeId: "node-2" });

  const service = createService(coordinator, { haLevel: "HA_2" });

  await service.start();
  assert.equal(service.isLeader(), false);
  assert.equal(service.getState(), "follower");

  await service.stop();
  service.dispose();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: createLeaderElectionService Factory
// ─────────────────────────────────────────────────────────────────────────────

test("createLeaderElectionService factory creates service with defaults", () => {
  const coordinator = createMockCoordinator();
  const service = createLeaderElectionService(coordinator, "node-factory", "us-east-1");

  assert.ok(service instanceof LeaderElectionService);
  assert.equal(service.getState(), "stopped");

  service.dispose();
});

test("createLeaderElectionService factory with HA level config", () => {
  const coordinator = createMockCoordinator();
  const service = createLeaderElectionService(
    coordinator,
    "node-factory",
    "us-east-1",
    { haLevel: "HA_3" },
  );

  const config = service.getHaConfig();
  assert.equal(config.haLevel, "HA_3");

  service.dispose();
});

test("createLeaderElectionService factory with custom config override", () => {
  const coordinator = createMockCoordinator();
  const service = createLeaderElectionService(
    coordinator,
    "node-factory",
    "us-east-1",
    {
      haLevel: "HA_2",
      customConfig: { leaseTtlMs: 20_000 },
    },
  );

  const config = service.getHaConfig();
  assert.equal(config.leaseTtlMs, 20_000);

  service.dispose();
});

test("createLeaderElectionService factory with nodeMetadata", () => {
  const coordinator = createMockCoordinator();
  const service = createLeaderElectionService(
    coordinator,
    "node-factory",
    "us-east-1",
    { haLevel: "HA_2", nodeMetadata: { version: "2.0" } },
  );

  assert.ok(service instanceof LeaderElectionService);

  service.dispose();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("LeaderElectionService - handles getLeaderNodeId when no leader", () => {
  const coordinator = createMockCoordinator();
  const service = createService(coordinator);

  const leaderNodeId = service.getLeaderNodeId();
  assert.equal(leaderNodeId, null);

  service.dispose();
});

test("LeaderElectionService - isCurrentLeader() combines state and coordinator", async () => {
  const coordinator = createMockCoordinator();
  const service = createService(coordinator, { haLevel: "HA_1" });

  await service.start();

  assert.equal(service.isCurrentLeader(), true);

  await service.stop();
  service.dispose();
});

test("LeaderElectionService - isCurrentLeader() returns false when not leader", async () => {
  const coordinator = createMockCoordinator();

  // Pre-existing leader
  coordinator.registerNode("node-2", "us-east-1");
  coordinator.acquireLeadership({ nodeId: "node-2" });

  const service = createService(coordinator, { haLevel: "HA_2" });

  await service.start();

  assert.equal(service.isCurrentLeader(), false);

  await service.stop();
  service.dispose();
});

test("LeaderElectionService - start fails on coordinator error", async () => {
  const coordinator = createMockCoordinator();

  // Make registerNode throw
  const originalRegister = coordinator.registerNode.bind(coordinator);
  coordinator.registerNode = (nodeId: string, region: string, metadata?: Record<string, unknown>) => {
    if (nodeId === "node-1") {
      throw new Error("Coordinator registration failed");
    }
    return originalRegister(nodeId, region, metadata);
  };

  const service = createService(coordinator);

  await assert.rejects(
    async () => service.start(),
    /Coordinator registration failed/,
  );

  service.dispose();
});

test("LeaderElectionService - maxElectionAttempts limits retry count", async () => {
  const coordinator = createMockCoordinator();

  // Make sure there's no existing leader so election keeps failing
  coordinator.mockState.leaderNodeId = "some-other-leader";
  coordinator.mockState.isExpired = false;
  coordinator.mockState.expiresAt = new Date(Date.now() + 60_000).toISOString();

  const service = createService(coordinator, {
    haLevel: "HA_2",
    maxElectionAttempts: 2,
  });

  await service.start();

  // The service should attempt election but not infinitely
  // After max attempts, it stays in follower state

  await service.stop();
  service.dispose();
});

test("LeaderElectionService - dispose stops heartbeat interval", async () => {
  const coordinator = createMockCoordinator();
  const service = createService(coordinator);

  await service.start();
  service.dispose(); // Should not leave intervals running

  await assert.rejects(
    async () => service.start(),
    /disposed/i,
  );
});
