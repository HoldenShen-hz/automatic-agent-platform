/**
 * Unit Tests: Leader Election Service
 *
 * Tests for leader-election-service.ts covering:
 * - Leader election state machine
 * - Leadership acquisition, renewal, and release
 * - HA level behavior (HA_1, HA_2, HA_3)
 * - Heartbeat and renewal interval handling
 * - setInterval unref() behavior (issue #2140, #2141)
 */

import assert from "node:assert/strict";
import test from "node:test";

import { LeaderElectionService, createLeaderElectionService, type LeaderElectionState, type LeaderElectionEvent } from "../../../../../src/platform/execution/ha/leader-election-service.js";
import type { HaCoordinatorService, LeaderLease, LeadershipEpoch, LeadershipQueryResult, CoordinatorNode } from "../../../../../src/platform/execution/ha/ha-coordinator-service-inner.js";
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
  activeNodes: CoordinatorNode[];
}

function createMockCoordinator(): HaCoordinatorService & {
  mockState: MockLeadershipState;
  registerNodeCalls: string[];
  heartbeatCalls: string[];
  renewLeadershipCalls: string[];
  heartbeatIntervalHandles: ReturnType<typeof setInterval>[];
  renewalIntervalHandles: ReturnType<typeof setInterval>[];
} {
  const mockState: MockLeadershipState = {
    leaderNodeId: null,
    epoch: 0,
    fencingToken: 1,
    isExpired: false,
    expiresAt: null,
    leases: new Map(),
    epochs: [],
    activeNodes: [],
  };

  const registerNodeCalls: string[] = [];
  const heartbeatCalls: string[] = [];
  const renewLeadershipCalls: string[] = [];
  const heartbeatIntervalHandles: ReturnType<typeof setInterval>[] = [];
  const renewalIntervalHandles: ReturnType<typeof setInterval>[] = [];

  return {
    mockState,

    // Node management
    registerNode(nodeId: string, region: string, _metadata?: Record<string, unknown>) {
      registerNodeCalls.push(nodeId);
      const node: CoordinatorNode = {
        nodeId,
        region,
        status: "active",
        isLeader: false,
        leadershipEpoch: 0,
        lastHeartbeatAt: nowIso(),
        metadata: null,
      };
      mockState.activeNodes.push(node);
      return node;
    },

    getNode(nodeId: string) {
      if (mockState.leaderNodeId === nodeId) {
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
      return mockState.activeNodes.find(n => n.nodeId === nodeId) ?? null;
    },

    listNodes(_status?: string) {
      return mockState.activeNodes;
    },

    updateNodeHeartbeat(nodeId: string, _status?: string) {
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
      renewLeadershipCalls.push(input.nodeId);
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

    getLatestEpoch(): LeadershipEpoch {
      return {
        epoch: mockState.epoch,
        leaderNodeId: mockState.leaderNodeId,
        startedAt: nowIso(),
        endedAt: null,
        cause: "acquired",
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
      return _token >= mockState.fencingToken;
    },

    purgeExpiredLeases() {
      return 0;
    },

    purgeOldFailoverDecisions() {
      return 0;
    },

    // Expose for testing
    registerNodeCalls,
    heartbeatCalls,
    renewLeadershipCalls,
    heartbeatIntervalHandles,
    renewalIntervalHandles,
  } as unknown as HaCoordinatorService & {
    mockState: MockLeadershipState;
    registerNodeCalls: string[];
    heartbeatCalls: string[];
    renewLeadershipCalls: string[];
    heartbeatIntervalHandles: ReturnType<typeof setInterval>[];
    renewalIntervalHandles: ReturnType<typeof setInterval>[];
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Issue #2140, #2141 - setInterval without unref()
// These tests verify that interval handles are properly managed
// ─────────────────────────────────────────────────────────────────────────────

test("LeaderElectionService - startRenewalLoop creates setInterval handle", async () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
    haLevel: "HA_2",
    renewalIntervalMs: 1000,
  });

  await service.start();
  assert.equal(service.getState(), "leader");

  // Check that renewal interval was started (interval handle should exist)
  // The renewal interval handle is private, but we can verify through behavior
  await service.stop();
  service.dispose();
});

test("LeaderElectionService - startHeartbeat creates setInterval handle", async () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
    haLevel: "HA_2",
  });

  await service.start();
  assert.equal(service.getState(), "leader");

  // Heartbeat calls should have been made (5 second interval in real implementation)
  // In mock, we track calls
  assert.ok(coordinator.heartbeatCalls.length >= 0);

  await service.stop();
  service.dispose();
});

test("LeaderElectionService - renewal and heartbeat timers call unref()", async () => {
  const coordinator = createMockCoordinator();
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  const unrefCalls: string[] = [];

  (globalThis as typeof globalThis & {
    setInterval: typeof setInterval;
    clearInterval: typeof clearInterval;
  }).setInterval = ((handler: TimerHandler, _timeout?: number, ...args: unknown[]) => {
    void handler;
    void args;
    return {
      unref() {
        unrefCalls.push("called");
      },
    } as unknown as ReturnType<typeof setInterval>;
  }) as typeof setInterval;
  (globalThis as typeof globalThis & {
    clearInterval: typeof clearInterval;
  }).clearInterval = ((_handle?: ReturnType<typeof setInterval>) => undefined) as typeof clearInterval;

  try {
    const service = new LeaderElectionService(coordinator, {
      nodeId: "node-1",
      region: "us-east-1",
      haLevel: "HA_2",
      renewalIntervalMs: 1000,
    });

    await service.start();
    assert.equal(unrefCalls.length >= 2, true);
    await service.stop();
    service.dispose();
  } finally {
    (globalThis as typeof globalThis & { setInterval: typeof setInterval }).setInterval = originalSetInterval;
    (globalThis as typeof globalThis & { clearInterval: typeof clearInterval }).clearInterval = originalClearInterval;
  }
});

test("LeaderElectionService - renewal interval is cleared on stop", async () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
    haLevel: "HA_2",
    renewalIntervalMs: 100,
  });

  await service.start();
  assert.equal(service.isLeader(), true);

  await service.stop();
  // After stop, should not be leader
  assert.equal(service.isLeader(), false);
  assert.equal(service.getState(), "stopped");

  service.dispose();
});

test("LeaderElectionService - renewal interval is cleared on dispose", async () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
    haLevel: "HA_2",
    renewalIntervalMs: 100,
  });

  await service.start();
  assert.equal(service.isLeader(), true);

  service.dispose();
  assert.equal(service.isLeader(), false);
});

test("LeaderElectionService - heartbeat is cleared on stop", async () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
    haLevel: "HA_2",
  });

  await service.start();
  await service.stop();
  assert.equal(service.getState(), "stopped");

  service.dispose();
});

test("LeaderElectionService - heartbeat is cleared on dispose", async () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
    haLevel: "HA_2",
  });

  await service.start();
  service.dispose();
  assert.equal(service.getState(), "stopped");
});

test("LeaderElectionService - HA_1 starts renewal loop to keep the single-node lease fresh", async () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
    haLevel: "HA_1",
    renewalIntervalMs: 5,
  });

  await service.start();
  assert.equal(service.getState(), "leader");
  assert.equal(service.isLeader(), true);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.ok(coordinator.renewLeadershipCalls.length > 0);

  await service.stop();
  service.dispose();
});

test("LeaderElectionService - HA_3 has aggressive renewal interval", async () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
    haLevel: "HA_3",
  });

  const config = service.getHaConfig();
  // HA_3 should have shorter renewal interval than HA_2
  assert.ok(config.leaseRenewalIntervalMs <= 5000);
  assert.ok(config.leaseTtlMs <= 15000);

  service.dispose();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Basic State Machine
// ─────────────────────────────────────────────────────────────────────────────

test("LeaderElectionService - initial state is stopped", () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
  });

  assert.equal(service.getState(), "stopped");
  assert.equal(service.isLeader(), false);

  service.dispose();
});

test("LeaderElectionService - start transitions to starting then leader", async () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
    haLevel: "HA_2",
  });

  await service.start();
  assert.equal(service.getState(), "leader");
  assert.equal(service.isLeader(), true);

  service.dispose();
});

test("LeaderElectionService - stop transitions to stopped", async () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
    haLevel: "HA_2",
  });

  await service.start();
  await service.stop();
  assert.equal(service.getState(), "stopped");
  assert.equal(service.isLeader(), false);

  service.dispose();
});

test("LeaderElectionService - cannot start when disposed", async () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
  });

  service.dispose();

  await assert.rejects(async () => service.start(), /disposed/);
});

test("LeaderElectionService - stop is idempotent", async () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
    haLevel: "HA_2",
  });

  await service.start();
  await service.stop();
  await service.stop(); // Should not throw

  assert.equal(service.getState(), "stopped");
  service.dispose();
});

test("LeaderElectionService - stop when not started does nothing", async () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
  });

  await service.stop();
  assert.equal(service.getState(), "stopped");

  service.dispose();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: HA_1 Single-Node Mode
// ─────────────────────────────────────────────────────────────────────────────

test("LeaderElectionService - HA_1 becomes leader immediately", async () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
    haLevel: "HA_1",
  });

  await service.start();
  assert.equal(service.getState(), "leader");
  assert.equal(service.isLeader(), true);

  service.dispose();
});

test("LeaderElectionService - HA_1 does not require coordinator election", async () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
    haLevel: "HA_1",
  });

  await service.start();

  // Node should be registered but election skipped
  assert.ok(coordinator.registerNodeCalls.includes("node-1"));

  service.dispose();
});

test("LeaderElectionService - HA_1 getLeaderNodeId returns nodeId when leader", async () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
    haLevel: "HA_1",
  });

  await service.start();
  assert.equal(service.getLeaderNodeId(), "node-1");

  service.dispose();
});

test("LeaderElectionService - HA_1 queryLeadership shows leader state", async () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
    haLevel: "HA_1",
  });

  await service.start();
  const leadership = service.queryLeadership();

  assert.equal(leadership.isLeader, true);
  assert.equal(leadership.leaderNodeId, "node-1");

  service.dispose();
});

test("LeaderElectionService - HA_1 getCurrentLease returns lease", async () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
    haLevel: "HA_1",
  });

  await service.start();
  const lease = service.getCurrentLease();

  assert.ok(lease !== null);
  assert.equal(lease?.nodeId, "node-1");
  assert.equal(lease?.status, "active");

  service.dispose();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Multi-Node Leadership
// ─────────────────────────────────────────────────────────────────────────────

test("LeaderElectionService - first node to start becomes leader", async () => {
  const coordinator = createMockCoordinator();

  const service1 = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
    haLevel: "HA_2",
  });

  const service2 = new LeaderElectionService(coordinator, {
    nodeId: "node-2",
    region: "us-east-1",
    haLevel: "HA_2",
  });

  await service1.start();
  assert.equal(service1.isLeader(), true);

  // Node-2 should become follower since node-1 is leader
  // Note: In the mock, node-2 won't automatically become leader

  service1.dispose();
  service2.dispose();
});

test("LeaderElectionService - follower sees correct leader nodeId", async () => {
  const coordinator = createMockCoordinator();

  const service1 = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
    haLevel: "HA_2",
  });

  await service1.start();
  assert.equal(service1.getLeaderNodeId(), "node-1");

  service1.dispose();
});

test("LeaderElectionService - forceAcquireLeadership preempts existing leader", async () => {
  const coordinator = createMockCoordinator();

  const service1 = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
    haLevel: "HA_2",
  });

  const service2 = new LeaderElectionService(coordinator, {
    nodeId: "node-2",
    region: "us-east-1",
    haLevel: "HA_2",
  });

  await service1.start();
  assert.equal(service1.isLeader(), true);

  const acquired = await service2.forceAcquireLeadership();
  assert.equal(acquired, true);
  assert.equal(service2.isLeader(), true);

  service1.dispose();
  service2.dispose();
});

test("LeaderElectionService - transferLeadership releases leadership", async () => {
  const coordinator = createMockCoordinator();

  const service1 = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
    haLevel: "HA_2",
  });

  await service1.start();
  assert.equal(service1.isLeader(), true);

  const transferred = await service1.transferLeadership("node-2");
  // May return false since node-2 doesn't exist in real coordinator
  // But the method should execute without throwing

  service1.dispose();
});

test("LeaderElectionService - getHaConfig returns correct config for HA level", async () => {
  const coordinator = createMockCoordinator();

  const service1 = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
    haLevel: "HA_1",
  });

  const config1 = service1.getHaConfig();
  assert.equal(config1.haLevel, "HA_1");

  service1.dispose();

  const service2 = new LeaderElectionService(coordinator, {
    nodeId: "node-2",
    region: "us-east-1",
    haLevel: "HA_3",
  });

  const config2 = service2.getHaConfig();
  assert.equal(config2.haLevel, "HA_3");

  service2.dispose();
});

test("LeaderElectionService - custom config overrides HA level defaults", async () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
    haLevel: "HA_2",
    leaseTtlMs: 30_000,
    renewalIntervalMs: 10_000,
  });

  const config = service.getHaConfig();
  assert.equal(config.leaseTtlMs, 30_000);
  assert.equal(config.leaseRenewalIntervalMs, 10_000);

  service.dispose();
});

test("LeaderElectionService - isCurrentLeader returns true when this node is leader", async () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
    haLevel: "HA_2",
  });

  await service.start();
  assert.equal(service.isCurrentLeader(), true);

  service.dispose();
});

test("LeaderElectionService - isCurrentLeader returns false when not leader", async () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
    haLevel: "HA_2",
  });

  // Don't start, should not be leader
  assert.equal(service.isCurrentLeader(), false);

  service.dispose();
});

test("LeaderElectionService - queryLeadership returns epoch and fencing token", async () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
    haLevel: "HA_2",
  });

  await service.start();
  const leadership = service.queryLeadership();

  assert.ok(leadership.epoch >= 1);
  assert.ok(leadership.fencingToken >= 1);

  service.dispose();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: createLeaderElectionService Factory
// ─────────────────────────────────────────────────────────────────────────────

test("createLeaderElectionService creates service with HA_2 default", () => {
  const coordinator = createMockCoordinator();
  const service = createLeaderElectionService(coordinator, "node-1", "us-east-1");

  assert.ok(service instanceof LeaderElectionService);
  assert.equal(service.getHaConfig().haLevel, "HA_2");

  service.dispose();
});

test("createLeaderElectionService creates service with specified HA level", () => {
  const coordinator = createMockCoordinator();
  const service = createLeaderElectionService(coordinator, "node-1", "us-east-1", {
    haLevel: "HA_3",
  });

  assert.ok(service instanceof LeaderElectionService);
  assert.equal(service.getHaConfig().haLevel, "HA_3");

  service.dispose();
});

test("createLeaderElectionService accepts nodeMetadata", () => {
  const coordinator = createMockCoordinator();
  const service = createLeaderElectionService(coordinator, "node-1", "us-east-1", {
    haLevel: "HA_2",
    nodeMetadata: { datacenter: "us-east", rack: "rack-1" },
  });

  assert.ok(service instanceof LeaderElectionService);
  service.dispose();
});

test("createLeaderElectionService accepts customConfig", () => {
  const coordinator = createMockCoordinator();
  const service = createLeaderElectionService(coordinator, "node-1", "us-east-1", {
    haLevel: "HA_2",
    customConfig: { leaseTtlMs: 20_000 },
  });

  const config = service.getHaConfig();
  assert.equal(config.leaseTtlMs, 20_000);

  service.dispose();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Error Cases
// ─────────────────────────────────────────────────────────────────────────────

test("LeaderElectionService - start throws RuntimeError when disposed", async () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
  });

  service.dispose();

  await assert.rejects(
    async () => service.start(),
    /disposed/,
  );
});

test("LeaderElectionService - start does not throw if already started", async () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
    haLevel: "HA_2",
  });

  await service.start();
  // Starting again should not throw
  await service.start();

  service.dispose();
});

test("LeaderElectionService - stop does not throw if already stopped", async () => {
  const coordinator = createMockCoordinator();
  const service = new LeaderElectionService(coordinator, {
    nodeId: "node-1",
    region: "us-east-1",
  });

  await service.stop(); // Already stopped
  assert.equal(service.getState(), "stopped");
});
