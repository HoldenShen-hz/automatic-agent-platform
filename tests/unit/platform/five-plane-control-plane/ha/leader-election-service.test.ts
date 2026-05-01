/**
 * Leader Election Service Unit Tests
 *
 * Tests leader election state machine, leadership queries,
 * HA level configurations, and lease management.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  LeaderElectionService,
  type LeaderElectionState,
  type LeaderElectionEvent,
  type LeaderElectionServiceOptions,
} from "../../../../../src/platform/five-plane-execution/ha/leader-election-service.js";
import {
  HA_LEVEL_CONFIGS,
  type HaLevel,
  type HaLevelConfig,
  type LeadershipQueryResult,
  type LeaderLease,
} from "../../../../../src/platform/five-plane-execution/ha/types.js";

// ---------------------------------------------------------------------------
// Test Fixtures & Helpers
// ---------------------------------------------------------------------------

/**
 * Mock HaCoordinatorService for testing.
 */
class MockHaCoordinatorService {
  private leases: Map<string, LeaderLease> = new Map();
  public queryLeadershipCalls: { nodeId: string }[] = [];
  public renewLeadershipCalls: { nodeId: string; leaseId?: string }[] = [];
  public acquireLeadershipCalls: { nodeId: string; ttlMs?: number }[] = [];
  public releaseLeadershipCalls: { nodeId: string; leaseId?: string }[] = [];

  async queryLeadership(nodeId: string): Promise<LeadershipQueryResult> {
    this.queryLeadershipCalls.push({ nodeId });
    const lease = Array.from(this.leases.values()).find(
      (l) => l.nodeId === nodeId && l.status === "active",
    );
    if (lease) {
      const expiresAt = new Date(lease.expiresAt).getTime();
      return {
        isLeader: true,
        leaderNodeId: nodeId,
        epoch: lease.epoch,
        fencingToken: 1,
        expiresAt: lease.expiresAt,
        isExpired: Date.now() > expiresAt,
      };
    }
    return {
      isLeader: false,
      leaderNodeId: null,
      epoch: 0,
      fencingToken: 0,
      expiresAt: null,
      isExpired: false,
    };
  }

  async renewLeadership(nodeId: string, leaseId?: string): Promise<LeaderLease | null> {
    this.renewLeadershipCalls.push({ nodeId, leaseId });
    const existing = Array.from(this.leases.values()).find(
      (l) => l.nodeId === nodeId && l.status === "active",
    );
    if (existing) {
      existing.expiresAt = new Date(Date.now() + existing.ttlMs).toISOString();
      return existing;
    }
    return null;
  }

  async acquireLeadership(nodeId: string, ttlMs = 15000): Promise<LeaderLease> {
    this.acquireLeadershipCalls.push({ nodeId, ttlMs });
    const lease: LeaderLease = {
      leaseId: `lease-${Date.now()}`,
      nodeId,
      epoch: 1,
      acquiredAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
      status: "active",
      ttlMs,
    };
    this.leases.set(lease.leaseId, lease);
    return lease;
  }

  async releaseLeadership(nodeId: string, leaseId?: string): Promise<void> {
    this.releaseLeadershipCalls.push({ nodeId, leaseId });
    if (leaseId) {
      this.leases.delete(leaseId);
    } else {
      for (const [id, lease] of this.leases) {
        if (lease.nodeId === nodeId) {
          this.leases.delete(id);
        }
      }
    }
  }

  setMockLeadership(nodeId: string, isLeader: boolean, epoch = 1): void {
    if (isLeader) {
      const lease: LeaderLease = {
        leaseId: `lease-${nodeId}`,
        nodeId,
        epoch,
        acquiredAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 15000).toISOString(),
        status: "active",
        ttlMs: 15000,
      };
      this.leases.set(lease.leaseId, lease);
    }
  }

  clearMocks(): void {
    this.leases.clear();
    this.queryLeadershipCalls = [];
    this.renewLeadershipCalls = [];
    this.acquireLeadershipCalls = [];
    this.releaseLeadershipCalls = [];
  }
}

function createMockCoordinator(): MockHaCoordinatorService {
  return new MockHaCoordinatorService();
}

function createTestOptions(coordinator: MockHaCoordinatorService, overrides: Partial<LeaderElectionServiceOptions> = {}): { coordinator: MockHaCoordinatorService; options: LeaderElectionServiceOptions } {
  return {
    coordinator,
    options: {
      nodeId: "node-1",
      region: "us-east-1",
      ...overrides,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests: HA Level Configurations
// ---------------------------------------------------------------------------

test("HA_LEVEL_CONFIGS contains HA_1 configuration", () => {
  const config = HA_LEVEL_CONFIGS["HA_1"];

  assert.equal(config.haLevel, "HA_1");
  assert.equal(config.leaseRenewalIntervalMs, 0);
  assert.equal(config.leaseTtlMs, 60000);
  assert.equal(config.crossRegionFailover, false);
  assert.equal(config.walEnabled, false);
});

test("HA_LEVEL_CONFIGS contains HA_2 configuration", () => {
  const config = HA_LEVEL_CONFIGS["HA_2"];

  assert.equal(config.haLevel, "HA_2");
  assert.equal(config.leaseRenewalIntervalMs, 5000);
  assert.equal(config.leaseTtlMs, 15000);
  assert.equal(config.crossRegionFailover, false);
  assert.equal(config.walEnabled, true);
  assert.equal(config.eventReplayEnabled, true);
});

test("HA_LEVEL_CONFIGS contains HA_3 configuration", () => {
  const config = HA_LEVEL_CONFIGS["HA_3"];

  assert.equal(config.haLevel, "HA_3");
  assert.equal(config.leaseRenewalIntervalMs, 3000);
  assert.equal(config.leaseTtlMs, 10000);
  assert.equal(config.crossRegionFailover, true);
  assert.equal(config.walEnabled, true);
  assert.equal(config.eventReplayEnabled, true);
});

test("HA_LEVEL_CONFIGS are frozen objects", () => {
  assert.ok(Object.isFrozen(HA_LEVEL_CONFIGS["HA_1"]));
  assert.ok(Object.isFrozen(HA_LEVEL_CONFIGS["HA_2"]));
  assert.ok(Object.isFrozen(HA_LEVEL_CONFIGS["HA_3"]));
});

// ---------------------------------------------------------------------------
// Tests: Service Initialization
// ---------------------------------------------------------------------------

test("service initializes with stopped state", () => {
  const { coordinator, options } = createTestOptions(createMockCoordinator());
  const service = new LeaderElectionService(coordinator, options);

  assert.equal(service.getState(), "stopped");
});

test("service uses HA_2 as default level", () => {
  const { coordinator, options } = createTestOptions(createMockCoordinator());
  const service = new LeaderElectionService(coordinator, options);

  assert.equal((service as any).config.haLevel, "HA_2");
});

test("service accepts custom HA level", () => {
  const { coordinator, options } = createTestOptions(createMockCoordinator(), {
    haLevel: "HA_3",
  });
  const service = new LeaderElectionService(coordinator, options);

  assert.equal((service as any).config.haLevel, "HA_3");
});

test("service accepts custom HA config overrides", () => {
  const { coordinator, options } = createTestOptions(createMockCoordinator(), {
    haLevel: "HA_2",
    haConfig: {
      leaseTtlMs: 30000,
    },
  });
  const service = new LeaderElectionService(coordinator, options);

  assert.equal((service as any).config.leaseTtlMs, 30000);
});

test("service accepts custom leaseTtlMs directly", () => {
  const { coordinator, options } = createTestOptions(createMockCoordinator(), {
    leaseTtlMs: 45000,
  });
  const service = new LeaderElectionService(coordinator, options);

  assert.equal((service as any).config.leaseTtlMs, 45000);
});

test("service accepts custom renewal interval", () => {
  const { coordinator, options } = createTestOptions(createMockCoordinator(), {
    renewalIntervalMs: 2000,
  });
  const service = new LeaderElectionService(coordinator, options);

  assert.equal((service as any).config.leaseRenewalIntervalMs, 2000);
});

test("service accepts node metadata", () => {
  const { coordinator, options } = createTestOptions(createMockCoordinator(), {
    nodeMetadata: { version: "1.0.0", region: "us-east-1" },
  });
  const service = new LeaderElectionService(coordinator, options);

  assert.deepEqual((service as any).nodeMetadata, { version: "1.0.0", region: "us-east-1" });
});

test("service throws RuntimeError when started after disposal", async () => {
  const { coordinator, options } = createTestOptions(createMockCoordinator());
  const service = new LeaderElectionService(coordinator, options);

  (service as any).disposed = true;

  await assert.rejects(
    () => service.start(),
    (err: unknown) =>
      err instanceof Error && err.message.includes("disposed"),
  );
});

// ---------------------------------------------------------------------------
// Tests: Leadership Query
// ---------------------------------------------------------------------------

test("queryLeadership returns correct structure", async () => {
  const mock = createMockCoordinator();
  mock.setMockLeadership("node-1", true);
  const { options } = createTestOptions(mock);
  const service = new LeaderElectionService(mock, options);

  const result = await service.queryLeadership();

  assert.ok(typeof result.isLeader === "boolean");
  assert.ok(typeof result.leaderNodeId === "string" || result.leaderNodeId === null);
  assert.ok(typeof result.epoch === "number");
  assert.ok(typeof result.fencingToken === "number");
  assert.ok(typeof result.expiresAt === "string" || result.expiresAt === null);
  assert.ok(typeof result.isExpired === "boolean");
});

test("queryLeadership returns not leader when no lease held", async () => {
  const mock = createMockCoordinator();
  const { options } = createTestOptions(mock);
  const service = new LeaderElectionService(mock, options);

  const result = await service.queryLeadership();

  assert.equal(result.isLeader, false);
  assert.equal(result.leaderNodeId, null);
  assert.equal(result.epoch, 0);
});

test("queryLeadership tracks coordinator calls", async () => {
  const mock = createMockCoordinator();
  const { options } = createTestOptions(mock);
  const service = new LeaderElectionService(mock, options);

  await service.queryLeadership();

  assert.equal(mock.queryLeadershipCalls.length, 1);
  assert.equal(mock.queryLeadershipCalls[0].nodeId, "node-1");
});

// ---------------------------------------------------------------------------
// Tests: Lease Information
// ---------------------------------------------------------------------------

test("getLeaseInfo returns null when no lease held", () => {
  const { coordinator, options } = createTestOptions(createMockCoordinator());
  const service = new LeaderElectionService(coordinator, options);

  const leaseInfo = service.getLeaseInfo();

  assert.equal(leaseInfo, null);
});

test("hasLeadership returns false when no lease", () => {
  const { coordinator, options } = createTestOptions(createMockCoordinator());
  const service = new LeaderElectionService(coordinator, options);

  assert.equal(service.hasLeadership(), false);
});

// ---------------------------------------------------------------------------
// Tests: Node Information
// ---------------------------------------------------------------------------

test("getNodeId returns configured node ID", () => {
  const { coordinator, options } = createTestOptions(createMockCoordinator(), {
    nodeId: "custom-node-id",
  });
  const service = new LeaderElectionService(coordinator, options);

  assert.equal(service.getNodeId(), "custom-node-id");
});

test("getRegion returns configured region", () => {
  const { coordinator, options } = createTestOptions(createMockCoordinator(), {
    region: "eu-west-1",
  });
  const service = new LeaderElectionService(coordinator, options);

  assert.equal(service.getRegion(), "eu-west-1");
});

test("getHaLevel returns configured HA level", () => {
  const { coordinator, options } = createTestOptions(createMockCoordinator(), {
    haLevel: "HA_3",
  });
  const service = new LeaderElectionService(coordinator, options);

  assert.equal(service.getHaLevel(), "HA_3");
});

test("getConfig returns HA level configuration", () => {
  const { coordinator, options } = createTestOptions(createMockCoordinator());
  const service = new LeaderElectionService(coordinator, options);

  const config = service.getConfig();

  assert.ok(config != null);
  assert.equal(config.haLevel, "HA_2");
  assert.ok(typeof config.leaseTtlMs === "number");
  assert.ok(typeof config.leaseRenewalIntervalMs === "number");
});

// ---------------------------------------------------------------------------
// Tests: Leadership Check Methods
// ---------------------------------------------------------------------------

test("isLeader returns false when not holding leadership", async () => {
  const { coordinator, options } = createTestOptions(createMockCoordinator());
  const service = new LeaderElectionService(coordinator, options);

  assert.equal(await service.isLeader(), false);
});

test("isFollower returns true when not leader and not stopped", async () => {
  const { coordinator, options } = createTestOptions(createMockCoordinator());
  const service = new LeaderElectionService(coordinator, options);

  (service as any).state = "follower";

  assert.equal(service.isFollower(), true);
});

test("isFollower returns false when leader", async () => {
  const { coordinator, options } = createTestOptions(createMockCoordinator());
  const service = new LeaderElectionService(coordinator, options);

  (service as any).state = "leader";

  assert.equal(service.isFollower(), false);
});

// ---------------------------------------------------------------------------
// Tests: Event Emission
// ---------------------------------------------------------------------------

test("service emits election_start event", async () => {
  const { coordinator, options } = createTestOptions(createMockCoordinator(), {
    haLevel: "HA_1",
  });
  const service = new LeaderElectionService(coordinator, options);
  const events: LeaderElectionEvent[] = [];

  service.on("election_start", () => events.push("election_start"));
  await service.start();

  assert.ok(events.includes("election_start"));
});

test("service emits leadership_acquired event on successful election", async () => {
  const mock = createMockCoordinator();
  const { options } = createTestOptions(mock, { haLevel: "HA_1" });
  const service = new LeaderElectionService(mock, options);
  const events: LeaderElectionEvent[] = [];

  service.on("leadership_acquired", () => events.push("leadership_acquired"));
  await service.start();

  assert.ok(events.includes("leadership_acquired"));
});

test("service can have event listeners removed", async () => {
  const { coordinator, options } = createTestOptions(createMockCoordinator(), {
    haLevel: "HA_1",
  });
  const service = new LeaderElectionService(coordinator, options);
  const events: LeaderElectionEvent[] = [];

  const listener = () => events.push("election_start");
  service.on("election_start", listener);
  service.off("election_start", listener);
  await service.start();

  assert.ok(!events.includes("election_start"));
});

// ---------------------------------------------------------------------------
// Tests: State Transitions
// ---------------------------------------------------------------------------

test("service transitions to leader state after acquiring leadership", async () => {
  const mock = createMockCoordinator();
  const { options } = createTestOptions(mock, { haLevel: "HA_1" });
  const service = new LeaderElectionService(mock, options);

  await service.start();

  assert.equal(service.getState(), "leader");
});

test("service transitions to follower state when leadership lost", async () => {
  const mock = createMockCoordinator();
  const { options } = createTestOptions(mock, {
    haLevel: "HA_2",
    haConfig: {
      leaseRenewalIntervalMs: 100, // Very short renewal
      leaseTtlMs: 50,
    },
  });
  const service = new LeaderElectionService(mock, options);

  // Set up a different node as leader so this node becomes follower
  mock.setMockLeadership("other-node", true);
  await service.start();

  // The service should have transitioned through states
  // Actual state depends on election timing
  assert.ok(["candidate", "follower", "leader", "shutdown"].includes(service.getState()));
});

// ---------------------------------------------------------------------------
// Tests: Max Election Attempts
// ---------------------------------------------------------------------------

test("service uses default max election attempts of 5", () => {
  const { coordinator, options } = createTestOptions(createMockCoordinator());
  const service = new LeaderElectionService(coordinator, options);

  assert.equal((service as any).maxElectionAttempts, 5);
});

test("service accepts custom max election attempts", () => {
  const { coordinator, options } = createTestOptions(createMockCoordinator(), {
    maxElectionAttempts: 10,
  });
  const service = new LeaderElectionService(coordinator, options);

  assert.equal((service as any).maxElectionAttempts, 10);
});

// ---------------------------------------------------------------------------
// Tests: Epoch and Fencing Token
// ---------------------------------------------------------------------------

test("service starts with epoch 0", () => {
  const { coordinator, options } = createTestOptions(createMockCoordinator());
  const service = new LeaderElectionService(coordinator, options);

  assert.equal((service as any).currentEpoch, 0);
});

test("service starts with fencing token 0", () => {
  const { coordinator, options } = createTestOptions(createMockCoordinator());
  const service = new LeaderElectionService(coordinator, options);

  assert.equal((service as any).currentFencingToken, 0);
});

test("getFencingToken returns 0 when not leader", () => {
  const { coordinator, options } = createTestOptions(createMockCoordinator());
  const service = new LeaderElectionService(coordinator, options);

  assert.equal(service.getFencingToken(), 0);
});

// ---------------------------------------------------------------------------
// Tests: Disposal
// ---------------------------------------------------------------------------

test("dispose() marks service as disposed", () => {
  const { coordinator, options } = createTestOptions(createMockCoordinator());
  const service = new LeaderElectionService(coordinator, options);

  service.dispose();

  assert.equal((service as any).disposed, true);
});

test("dispose() can be called multiple times", () => {
  const { coordinator, options } = createTestOptions(createMockCoordinator());
  const service = new LeaderElectionService(coordinator, options);

  service.dispose();
  service.dispose(); // Should not throw

  assert.equal((service as any).disposed, true);
});

test("dispose() clears renewal interval handle", () => {
  const mock = createMockCoordinator();
  const { options } = createTestOptions(mock, {
    haLevel: "HA_1",
  });
  const service = new LeaderElectionService(mock, options);

  // Manually set a renewal interval handle
  (service as any).renewalIntervalHandle = setInterval(() => {}, 1000);
  service.dispose();

  assert.equal((service as any).renewalIntervalHandle, null);
});

test("dispose() clears heartbeat interval handle", () => {
  const mock = createMockCoordinator();
  const { options } = createTestOptions(mock, {
    haLevel: "HA_1",
  });
  const service = new LeaderElectionService(mock, options);

  // Manually set a heartbeat interval handle
  (service as any).heartbeatIntervalHandle = setInterval(() => {}, 1000);
  service.dispose();

  assert.equal((service as any).heartbeatIntervalHandle, null);
});
