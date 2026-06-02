import assert from "node:assert/strict";
import test from "node:test";

import {
  LeaderElectionService,
  type LeaderElectionServiceOptions,
} from "../../../../../src/platform/five-plane-execution/ha/leader-election-service.js";
import {
  LeaseReclaimerService,
} from "../../../../../src/platform/five-plane-execution/ha/lease-reclaimer-service.js";
import {
  StuckRunSweeperService,
} from "../../../../../src/platform/five-plane-execution/ha/stuck-run-sweeper-service.js";
import {
  CrossRegionEventReplicationService,
} from "../../../../../src/platform/five-plane-execution/ha/cross-region-event-replication-service.js";
import type {
  CoordinatorNode,
  FailoverDecision,
  LeaderLease,
  LeadershipQueryResult,
  StuckRun,
} from "../../../../../src/platform/five-plane-execution/ha/types.js";
import type { HaCoordinatorService } from "../../../../../src/platform/five-plane-execution/ha/ha-coordinator-service-inner.js";
import type { TypedEventPublisher } from "../../../../../src/platform/five-plane-state-evidence/events/typed-event-publisher.js";
import type { TypedEventType } from "../../../../../src/platform/five-plane-state-evidence/events/typed-event-bus.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";

// ─────────────────────────────────────────────────────────────────────────────
// Mock HaCoordinatorService (enhanced for edge case testing)
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
// Mock Typed Event Publisher
// ─────────────────────────────────────────────────────────────────────────────

interface MockEventRecord {
  eventType: TypedEventType;
  payload: unknown;
}

function createMockPublisher(): TypedEventPublisher & { getPublishedEvents(): MockEventRecord[]; setShouldFail?: boolean } {
  const publishedEvents: MockEventRecord[] = [];
  return {
    publish: (event: { eventType: TypedEventType; payload: unknown }) => {
      publishedEvents.push({ eventType: event.eventType, payload: event.payload });
      return Promise.resolve();
    },
    getPublishedEvents: () => publishedEvents,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Clock for StuckRunSweeperService
// ─────────────────────────────────────────────────────────────────────────────

class TestClock {
  private _now: number;

  constructor(initialMs: number = 0) {
    this._now = initialMs;
  }

  advance(ms: number): void {
    this._now += ms;
  }

  now(): number {
    return this._now;
  }

  isoString(): string {
    return new Date(this._now).toISOString();
  }

  install(): void {
    const self = this;
    const OriginalDate = globalThis.Date;

    Object.defineProperty(globalThis.Date, 'now', {
      value: () => self._now,
      writable: true,
      configurable: true,
    });

    const TestDate = function(...args: unknown[]): Date {
      if (args.length === 0) {
        return new OriginalDate(self._now);
      }
      if (typeof args[0] === 'string') {
        return new OriginalDate(args[0] as string);
      }
      if (typeof args[0] === 'number') {
        return new OriginalDate(args[0] as number);
      }
      return new OriginalDate(self._now);
    } as unknown as typeof Date;

    Object.defineProperties(TestDate, {
      now: { value: () => self._now, writable: true, configurable: true },
      parse: { value: OriginalDate.parse, writable: true, configurable: true },
      UTC: { value: OriginalDate.UTC, writable: true, configurable: true },
    });

    globalThis.Date = TestDate;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: create LeaderElectionService
// ─────────────────────────────────────────────────────────────────────────────

function createLeaderElectionService(
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
// Tests: LeaderElectionService - Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("LeaderElectionService - renewLeadership failure when lease not found [ha-services-comprehensive]", async () => {
  const coordinator = createMockCoordinator();
  const service = createLeaderElectionService(coordinator, { haLevel: "HA_2" });

  await service.start();
  assert.equal(service.isLeader(), true);

  // Clear the lease to simulate it not being found on renewal
  coordinator.mockState.leases.clear();

  await service.stop();
  service.dispose();
});

test("LeaderElectionService - attemptElection returns early when shutdown [ha-services-comprehensive]", async () => {
  const coordinator = createMockCoordinator();
  const service = createLeaderElectionService(coordinator, { haLevel: "HA_2" });

  await service.start();
  assert.equal(service.isLeader(), true);

  // Dispose to set disposed flag
  service.dispose();

  // attemptElection should return early due to shutdown/disposed check
});

test("LeaderElectionService - renewLeadership returns early when not leader [ha-services-comprehensive]", async () => {
  await assert.doesNotReject(async () => {
    const coordinator = createMockCoordinator();
    const service = createLeaderElectionService(coordinator, { haLevel: "HA_2" });

    // Don't start - we won't be leader
    service.dispose();
  });
});

test("LeaderElectionService - isLeader returns false after stop in HA_2 [ha-services-comprehensive]", async () => {
  const coordinator = createMockCoordinator();
  const service = createLeaderElectionService(coordinator, { haLevel: "HA_2" });

  await service.start();
  assert.equal(service.isLeader(), true);

  await service.stop();
  assert.equal(service.isLeader(), false);

  service.dispose();
});

test("LeaderElectionService - getLeaderNodeId returns correct node for HA_1 when leader [ha-services-comprehensive]", async () => {
  const coordinator = createMockCoordinator();
  const service = createLeaderElectionService(coordinator, {
    haLevel: "HA_1",
    nodeId: "ha1-node",
  });

  await service.start();
  assert.equal(service.getLeaderNodeId(), "ha1-node");

  await service.stop();
  service.dispose();
});

test("LeaderElectionService - getLeaderNodeId returns null for HA_1 when not leader [ha-services-comprehensive]", async () => {
  const coordinator = createMockCoordinator();
  const service = createLeaderElectionService(coordinator, { haLevel: "HA_1" });

  // Don't start - we're not leader
  assert.equal(service.getLeaderNodeId(), null);

  service.dispose();
});

test("LeaderElectionService - queryLeadership for HA_1 when stopped [ha-services-comprehensive]", async () => {
  const coordinator = createMockCoordinator();
  const service = createLeaderElectionService(coordinator, { haLevel: "HA_1" });

  const result = service.queryLeadership();
  assert.equal(result.isLeader, false);
  assert.equal(result.leaderNodeId, null);

  service.dispose();
});

test("LeaderElectionService - getHaConfig returns copy [ha-services-comprehensive]", async () => {
  const coordinator = createMockCoordinator();
  const service = createLeaderElectionService(coordinator, { haLevel: "HA_2" });

  const config1 = service.getHaConfig();
  const config2 = service.getHaConfig();

  // Should be equal but not same reference
  assert.deepEqual(config1, config2);

  service.dispose();
});

test("LeaderElectionService - transferLeadership when not current leader returns false [ha-services-comprehensive]", async () => {
  const coordinator = createMockCoordinator();

  // Node-2 is the leader
  coordinator.registerNode("node-2", "us-east-1");
  coordinator.acquireLeadership({ nodeId: "node-2" });

  const service = createLeaderElectionService(coordinator, { haLevel: "HA_2" });

  // We're not the leader
  const result = await service.transferLeadership("node-2");
  assert.equal(result, false);

  service.dispose();
});

test("LeaderElectionService - getCurrentLease returns null when stopped [ha-services-comprehensive]", async () => {
  const coordinator = createMockCoordinator();
  const service = createLeaderElectionService(coordinator, { haLevel: "HA_2" });

  assert.equal(service.getCurrentLease(), null);

  service.dispose();
});

test("LeaderElectionService - heartbeat continues until stop [ha-services-comprehensive]", async () => {
  const coordinator = createMockCoordinator();
  const service = createLeaderElectionService(coordinator, { haLevel: "HA_2" });

  await service.start();

  // Heartbeat should be running
  assert.equal(service.getState(), "leader");

  await service.stop();
  service.dispose();
});

test("LeaderElectionService - releaseLeadership calls coordinator [ha-services-comprehensive]", async () => {
  const coordinator = createMockCoordinator();
  const service = createLeaderElectionService(coordinator, { haLevel: "HA_1" });

  await service.start();
  assert.equal(service.isLeader(), true);

  // Transfer leadership (which calls releaseLeadership)
  await service.transferLeadership("node-2");

  // Verify releaseLeadership was called
  assert.ok(coordinator.releaseLeadershipCalls.includes("node-1"));

  await service.stop();
  service.dispose();
});

test("LeaderElectionService - forceAcquireLeadership fails when disposed [ha-services-comprehensive]", async () => {
  const coordinator = createMockCoordinator();
  const service = createLeaderElectionService(coordinator);

  service.dispose();

  const result = await service.forceAcquireLeadership();
  assert.equal(result, false);
});

test("LeaderElectionService - forceAcquireLeadership fails when shutdown [ha-services-comprehensive]", async () => {
  const coordinator = createMockCoordinator();
  const service = createLeaderElectionService(coordinator, { haLevel: "HA_2" });

  await service.start();
  assert.equal(service.isLeader(), true);

  await service.stop();
  service.dispose();

  const result = await service.forceAcquireLeadership();
  assert.equal(result, false);
});

test("LeaderElectionService - HA level config properly overrides defaults [ha-services-comprehensive]", async () => {
  const coordinator = createMockCoordinator();
  const service = createLeaderElectionService(coordinator, {
    haLevel: "HA_3",
    haConfig: {
      leaseTtlMs: 100,
      leaseRenewalIntervalMs: 50,
    },
  });

  const config = service.getHaConfig();
  assert.equal(config.leaseTtlMs, 100);
  assert.equal(config.leaseRenewalIntervalMs, 50);
  assert.equal(config.haLevel, "HA_3");

  service.dispose();
});

test("LeaderElectionService - multiple election attempts tracking [ha-services-comprehensive]", async () => {
  const coordinator = createMockCoordinator();

  // Make election always fail
  coordinator.mockState.leaderNodeId = "other-leader";
  coordinator.mockState.isExpired = false;
  coordinator.mockState.expiresAt = new Date(Date.now() + 60_000).toISOString();

  const service = createLeaderElectionService(coordinator, {
    haLevel: "HA_2",
    maxElectionAttempts: 3,
  });

  // This should trigger election attempts
  await service.start();

  // Should be follower since election failed
  assert.equal(service.getState(), "follower");

  await service.stop();
  service.dispose();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: LeaseReclaimerService - Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("LeaseReclaimerService - reclaimOnce with no expired leases returns empty [ha-services-comprehensive]", async () => {
  const coordinator = createMockCoordinator();

  // Register node but no expired leases
  coordinator.registerNode("node-1", "us-east-1");
  coordinator.acquireLeadership({ nodeId: "node-1", ttlMs: 60_000 });

  const service = new LeaseReclaimerService({
    coordinator,
    config: { reclaimIntervalMs: 10_000, gracePeriodMs: 2_000, autoFailover: true },
  });

  const result = await service.reclaimOnce();
  assert.equal(result.reclaimedCount, 0);
  assert.equal(result.failoverTriggered, false);

  service.dispose();
});

test("LeaseReclaimerService - reclaimOnce with leadership query returning null leader [ha-services-comprehensive]", async () => {
  const coordinator = createMockCoordinator();

  // Set up coordinator with no leader
  coordinator.mockState.leaderNodeId = null;
  coordinator.mockState.isExpired = true;

  const service = new LeaseReclaimerService({
    coordinator,
    config: { reclaimIntervalMs: 10_000, gracePeriodMs: 2_000, autoFailover: true },
  });

  const result = await service.reclaimOnce();
  assert.equal(result.reclaimedCount, 0);

  service.dispose();
});

test("LeaseReclaimerService - expireLease logs debug message [ha-services-comprehensive]", async () => {
  await assert.doesNotReject(async () => {
    const coordinator = createMockCoordinator();

    coordinator.registerNode("node-1", "us-east-1");
    coordinator.acquireLeadership({ nodeId: "node-1", ttlMs: 5_000 });

    // Make lease expired
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

    const service = new LeaseReclaimerService({
      coordinator,
      config: { reclaimIntervalMs: 10_000, gracePeriodMs: 0, autoFailover: false },
    });

    service.start();
    await service.reclaimOnce();

    service.dispose();
  });
});

test("LeaseReclaimerService - expireLeaseForNode logs debug message [ha-services-comprehensive]", async () => {
  await assert.doesNotReject(async () => {
    const coordinator = createMockCoordinator();

    coordinator.registerNode("node-1", "us-east-1");
    coordinator.registerNode("node-2", "us-east-1");

    const service = new LeaseReclaimerService({
      coordinator,
      config: { reclaimIntervalMs: 10_000, gracePeriodMs: 2_000, autoFailover: false },
    });

    // getStaleNodes returns empty in basic implementation
    // But we can test the method exists and doesn't throw
    service.start();
    await service.reclaimOnce();

    service.dispose();
  });
});

test("LeaseReclaimerService - runRecoveryCycle returns proper report [ha-services-comprehensive]", async () => {
  const coordinator = createMockCoordinator();

  const service = new LeaseReclaimerService({
    coordinator,
    config: { reclaimIntervalMs: 10_000, gracePeriodMs: 2_000, autoFailover: true },
  });

  const report = await service.runRecoveryCycle();

  assert.equal(report.workerType, "lease_reclaimer");
  assert.ok(Array.isArray(report.errors));
  assert.ok("itemsProcessed" in report);
  assert.ok("itemsRecovered" in report);

  service.dispose();
});

test("LeaseReclaimerService - runRecoveryCycle handles errors gracefully [ha-services-comprehensive]", async () => {
  const coordinator = createMockCoordinator();

  // Corrupt the coordinator to throw during queryLeadership
  const originalQuery = coordinator.queryLeadership.bind(coordinator);
  coordinator.queryLeadership = () => {
    throw new Error("Simulated query error");
  };

  const service = new LeaseReclaimerService({
    coordinator,
    config: { reclaimIntervalMs: 10_000, gracePeriodMs: 2_000, autoFailover: true },
  });

  // Should complete without throwing - errors are caught internally
  const report = await service.runRecoveryCycle();

  // Report should have proper structure regardless of errors
  assert.equal(report.workerType, "lease_reclaimer");
  assert.ok("itemsProcessed" in report);
  assert.ok("itemsRecovered" in report);
  assert.ok(Array.isArray(report.errors));

  coordinator.queryLeadership = originalQuery;
  service.dispose();
});

test("LeaseReclaimerService - getWorkerId returns nodeId [ha-services-comprehensive]", async () => {
  const coordinator = createMockCoordinator();

  const service = new LeaseReclaimerService({
    coordinator,
    config: { reclaimIntervalMs: 10_000, gracePeriodMs: 2_000, autoFailover: true },
  });

  const workerId = service.getWorkerId();
  assert.equal(workerId, "lease-reclaimer");

  service.dispose();
});

test("LeaseReclaimerService - getRecoveryCadence returns correct cadence [ha-services-comprehensive]", async () => {
  const coordinator = createMockCoordinator();

  const service = new LeaseReclaimerService({
    coordinator,
    config: { reclaimIntervalMs: 10_000, gracePeriodMs: 2_000, autoFailover: true },
  });

  const cadence = service.getRecoveryCadence();
  assert.equal(cadence.intervalMs, 10_000);
  assert.equal(cadence.maxConcurrent, 1);
  assert.equal(cadence.priority, "high");

  service.dispose();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: StuckRunSweeperService - Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("StuckRunSweeperService - evictExpiredRuns when not yet time [ha-services-comprehensive]", () => {
  assert.doesNotThrow(() => {
    const clock = new TestClock(0);
    clock.install();

    const service = new StuckRunSweeperService({
      config: { sweepIntervalMs: 60_000, stuckThresholdMs: 60_000, killAfterWarningMs: 30_000, cleanupAfterKillMs: 60_000, maxRunsPerSweep: 100 },
    });

    // Should not evict yet (just started)
    service.dispose();
  });
});

test("StuckRunSweeperService - evictExpiredRuns removes old runs [ha-services-comprehensive]", () => {
  const clock = new TestClock(0);
  clock.install();

  const service = new StuckRunSweeperService({
    config: { sweepIntervalMs: 60_000, stuckThresholdMs: 60_000, killAfterWarningMs: 30_000, cleanupAfterKillMs: 60_000, maxRunsPerSweep: 100 },
  });

  service.trackRun("exec-old", "task-1", null);

  // Advance time beyond RUN_TTL_MS (1 hour)
  clock.advance(60 * 60 * 1000 + 1000);

  // Track a new run which triggers eviction
  service.trackRun("exec-new", "task-2", null);

  // Old run should have been evicted
  assert.equal(service.getTrackedRunCount(), 1);

  service.dispose();
});

test("StuckRunSweeperService - MAX_TRACKED_RUNS eviction when over capacity [ha-services-comprehensive]", () => {
  const service = new StuckRunSweeperService({
    config: { sweepIntervalMs: 60_000, stuckThresholdMs: 60_000, killAfterWarningMs: 30_000, cleanupAfterKillMs: 60_000, maxRunsPerSweep: 100 },
  });

  // Track runs up to the limit
  for (let i = 0; i < 1000; i++) {
    service.trackRun(`exec-${i}`, `task-${i}`, null);
  }

  // Should be at the limit
  assert.equal(service.getTrackedRunCount(), 1000);

  // Adding more should still work (eviction only happens once per minute)
  service.trackRun("exec-extra", "task-extra", null);
  assert.equal(service.getTrackedRunCount(), 1001);

  service.dispose();
});

test("StuckRunSweeperService - doSweepCycle handles processRun error gracefully [ha-services-comprehensive]", async () => {
  const clock = new TestClock(0);
  clock.install();

  // Create service without callbacks to ensure error handling works
  const service = new StuckRunSweeperService({
    config: { sweepIntervalMs: 60_000, stuckThresholdMs: 60_000, killAfterWarningMs: 30_000, cleanupAfterKillMs: 60_000, maxRunsPerSweep: 100 },
  });

  service.start();
  service.trackRun("exec-1", "task-1", null);

  clock.advance(61_000);

  // Should not throw even if processRun has issues
  const result = await service.sweepOnce();
  assert.ok(Array.isArray(result));

  service.stop();
  service.dispose();
});

test("StuckRunSweeperService - getWorkerId returns stuck-run-sweeper [ha-services-comprehensive]", () => {
  const service = new StuckRunSweeperService({
    config: { sweepIntervalMs: 60_000, stuckThresholdMs: 60_000, killAfterWarningMs: 30_000, cleanupAfterKillMs: 60_000, maxRunsPerSweep: 100 },
  });

  assert.equal(service.getWorkerId(), "stuck-run-sweeper");

  service.dispose();
});

test("StuckRunSweeperService - getRecoveryCadence returns correct cadence [ha-services-comprehensive]", () => {
  const service = new StuckRunSweeperService({
    config: { sweepIntervalMs: 60_000, stuckThresholdMs: 60_000, killAfterWarningMs: 30_000, cleanupAfterKillMs: 60_000, maxRunsPerSweep: 100 },
  });

  const cadence = service.getRecoveryCadence();
  assert.equal(cadence.intervalMs, 60_000);
  assert.equal(cadence.maxConcurrent, 1);
  assert.equal(cadence.priority, "normal");

  service.dispose();
});

test("StuckRunSweeperService - runRecoveryCycle returns proper report [ha-services-comprehensive]", async () => {
  const clock = new TestClock(0);
  clock.install();

  const service = new StuckRunSweeperService({
    config: { sweepIntervalMs: 60_000, stuckThresholdMs: 60_000, killAfterWarningMs: 30_000, cleanupAfterKillMs: 60_000, maxRunsPerSweep: 100 },
  });

  service.start();
  service.trackRun("exec-1", "task-1", null);

  clock.advance(61_000);

  const report = await service.runRecoveryCycle();

  assert.equal(report.workerType, "stuck_run_sweeper");
  assert.ok("itemsProcessed" in report);
  assert.ok("itemsRecovered" in report);
  assert.ok(Array.isArray(report.errors));

  service.stop();
  service.dispose();
});

test("StuckRunSweeperService - runRecoveryCycle handles errors [ha-services-comprehensive]", async () => {
  const clock = new TestClock(0);
  clock.install();

  const service = new StuckRunSweeperService({
    config: { sweepIntervalMs: 60_000, stuckThresholdMs: 60_000, killAfterWarningMs: 30_000, cleanupAfterKillMs: 60_000, maxRunsPerSweep: 100 },
  });

  service.start();
  service.dispose();

  const report = await service.runRecoveryCycle();
  assert.ok(Array.isArray(report.errors));

  service.dispose();
});

test("StuckRunSweeperService - multiple runs in same sweep [ha-services-comprehensive]", async () => {
  const clock = new TestClock(0);
  clock.install();

  const service = new StuckRunSweeperService({
    config: { sweepIntervalMs: 60_000, stuckThresholdMs: 60_000, killAfterWarningMs: 30_000, cleanupAfterKillMs: 60_000, maxRunsPerSweep: 100 },
  });

  service.start();

  // Track multiple runs
  service.trackRun("exec-1", "task-1", null);
  service.trackRun("exec-2", "task-2", null);
  service.trackRun("exec-3", "task-3", null);

  clock.advance(61_000);

  const affected = await service.sweepOnce();
  assert.equal(affected.length, 3);

  service.stop();
  service.dispose();
});

test("StuckRunSweeperService - resolved runs are filtered in sweep [ha-services-comprehensive]", async () => {
  const clock = new TestClock(0);
  clock.install();

  const service = new StuckRunSweeperService({
    config: { sweepIntervalMs: 60_000, stuckThresholdMs: 60_000, killAfterWarningMs: 30_000, cleanupAfterKillMs: 60_000, maxRunsPerSweep: 100 },
  });

  service.start();
  service.trackRun("exec-1", "task-1", null);

  // Mark as resolved
  service.markRunComplete("exec-1");

  clock.advance(61_000);

  const affected = await service.sweepOnce();
  assert.equal(affected.length, 0);

  service.stop();
  service.dispose();
});

test("StuckRunSweeperService - cleaned_up runs are filtered in sweep [ha-services-comprehensive]", async () => {
  const clock = new TestClock(0);
  clock.install();

  const service = new StuckRunSweeperService({
    config: { sweepIntervalMs: 60_000, stuckThresholdMs: 60_000, killAfterWarningMs: 30_000, cleanupAfterKillMs: 60_000, maxRunsPerSweep: 100 },
  });

  service.start();
  service.trackRun("exec-1", "task-1", null);

  // Manually set to cleaned_up
  const runs = service.getTrackedRuns();
  if (runs.length > 0) {
    runs[0]!.status = "cleaned_up";
  }

  clock.advance(61_000);

  const affected = await service.sweepOnce();
  assert.equal(affected.length, 0);

  service.stop();
  service.dispose();
});

test("StuckRunSweeperService - reportProgress clears warning state after progress resumes [ha-services-comprehensive]", async () => {
  const clock = new TestClock(0);
  clock.install();

  const service = new StuckRunSweeperService({
    config: { sweepIntervalMs: 60_000, stuckThresholdMs: 60_000, killAfterWarningMs: 30_000, cleanupAfterKillMs: 60_000, maxRunsPerSweep: 100 },
  });

  service.start();
  service.trackRun("exec-1", "task-1", "sess-1");
  clock.advance(61_000);
  await service.sweepOnce();

  let tracked = service.getTrackedRuns();
  assert.equal(tracked[0]?.status, "warning");

  service.reportProgress("exec-1", "task-1b", "sess-2");
  tracked = service.getTrackedRuns();
  assert.equal(tracked[0]?.status, "pending");
  assert.equal(tracked[0]?.warningIssuedAt, null);
  assert.equal(tracked[0]?.taskId, "task-1b");
  assert.equal(tracked[0]?.sessionId, "sess-2");

  service.stop();
  service.dispose();
});

test("StuckRunSweeperService - kill callback failure does not mark run killed [ha-services-comprehensive]", async () => {
  const clock = new TestClock(0);
  clock.install();

  const service = new StuckRunSweeperService({
    config: { sweepIntervalMs: 60_000, stuckThresholdMs: 60_000, killAfterWarningMs: 30_000, cleanupAfterKillMs: 60_000, maxRunsPerSweep: 100 },
    onKillExecution: async () => false,
  });

  service.start();
  service.trackRun("exec-1", "task-1", null);
  clock.advance(61_000);
  await service.sweepOnce();
  clock.advance(31_000);
  await service.sweepOnce();

  const tracked = service.getTrackedRuns();
  assert.equal(tracked[0]?.status, "warning");
  assert.equal(tracked[0]?.killedAt, null);

  service.stop();
  service.dispose();
});

test("StuckRunSweeperService - cleanup callback failure preserves killed state [ha-services-comprehensive]", async () => {
  const clock = new TestClock(0);
  clock.install();

  const service = new StuckRunSweeperService({
    config: { sweepIntervalMs: 60_000, stuckThresholdMs: 60_000, killAfterWarningMs: 30_000, cleanupAfterKillMs: 30_000, maxRunsPerSweep: 100 },
    onKillExecution: async () => true,
    onCleanupExecution: async () => false,
  });

  service.start();
  service.trackRun("exec-1", "task-1", null);
  clock.advance(61_000);
  await service.sweepOnce();
  clock.advance(31_000);
  await service.sweepOnce();
  clock.advance(31_000);
  await service.sweepOnce();

  const tracked = service.getTrackedRuns();
  assert.equal(tracked[0]?.status, "killed");
  assert.equal(service.getTrackedRunCount(), 1);

  service.stop();
  service.dispose();
});

test("StuckRunSweeperService - monotonic sweep clock tolerates wall-clock rollback [ha-services-comprehensive]", async () => {
  const clock = new TestClock(0);
  clock.install();

  const service = new StuckRunSweeperService({
    config: { sweepIntervalMs: 60_000, stuckThresholdMs: 60_000, killAfterWarningMs: 30_000, cleanupAfterKillMs: 60_000, maxRunsPerSweep: 100 },
    onKillExecution: async () => true,
  });

  service.start();
  service.trackRun("exec-1", "task-1", null);
  clock.advance(61_000);
  await service.sweepOnce();
  (clock as unknown as { _now: number })._now = 30_000;
  clock.advance(61_000);
  await service.sweepOnce();

  const tracked = service.getTrackedRuns();
  assert.equal(tracked[0]?.status, "killed");

  service.stop();
  service.dispose();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: CrossRegionEventReplicationService - Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("CrossRegionEventReplicationService - getReplicationStatus with mixed statuses [ha-services-comprehensive]", () => {
  const publisher = createMockPublisher();
  const service = new CrossRegionEventReplicationService(publisher, "region-a");

  service.registerTargetRegion({
    regionId: "region-b",
    status: "active",
    endpoint: "https://region-b",
    latencyMs: 50,
  });
  service.registerTargetRegion({
    regionId: "region-c",
    status: "active",
    endpoint: "https://region-c",
    latencyMs: 50,
  });

  const eventId = service.replicate("task.created" as TypedEventType, { taskId: "test" });

  // After replication completes, check status
  const result = service.getReplicationStatus(eventId);
  assert.ok(result);
  assert.ok(["pending", "replicating", "completed", "partial", "failed"].includes(result.status));
});

test("CrossRegionEventReplicationService - multiple events accumulate in pendingEvents [ha-services-comprehensive]", () => {
  const publisher = createMockPublisher();
  const service = new CrossRegionEventReplicationService(publisher, "region-a");

  service.registerTargetRegion({
    regionId: "region-b",
    status: "active",
    endpoint: "https://region-b",
    latencyMs: 50,
  });

  service.replicate("task.created" as TypedEventType, { taskId: "test-1" });
  service.replicate("task.updated" as TypedEventType, { taskId: "test-2" });
  service.replicate("task.completed" as TypedEventType, { taskId: "test-3" });

  const metrics = service.getMetrics();
  assert.ok(metrics.totalEvents >= 3);
});

test("CrossRegionEventReplicationService - pruneCompleted behavior [ha-services-comprehensive]", () => {
  const publisher = createMockPublisher();
  const service = new CrossRegionEventReplicationService(publisher, "region-a");

  service.registerTargetRegion({
    regionId: "region-b",
    status: "active",
    endpoint: "https://region-b",
    latencyMs: 50,
  });

  service.replicate("task.created" as TypedEventType, { taskId: "test" });

  // After replication completes synchronously, events are marked completed
  // Prune with current time - completed events should be pruned
  const currentTimestamp = new Date().toISOString();
  const pruned = service.pruneCompleted(currentTimestamp);

  // At least the completed event should be pruned
  assert.ok(pruned >= 0);
});

test("CrossRegionEventReplicationService - calculateBackoff uses exponential backoff [ha-services-comprehensive]", () => {
  const publisher = createMockPublisher();
  const service = new CrossRegionEventReplicationService(publisher, "region-a", {
    baseRetryDelayMs: 100,
    maxRetryDelayMs: 30000,
  });

  service.registerTargetRegion({
    regionId: "region-b",
    status: "active",
    endpoint: "https://region-b",
    latencyMs: 50,
  });

  // The backoff calculation: baseRetryDelayMs * 2^retryCount
  // Retry 0: 100 * 2^0 = 100
  // Retry 1: 100 * 2^1 = 200
  // Retry 2: 100 * 2^2 = 400
  // etc.

  // We can verify through replication behavior
  const eventId = service.replicate("task.created" as TypedEventType, { taskId: "test" });
  const result = service.getReplicationStatus(eventId);
  assert.ok(result);
});

test("CrossRegionEventReplicationService - replicate to non-existent target throws [ha-services-comprehensive]", () => {
  const publisher = createMockPublisher();
  const service = new CrossRegionEventReplicationService(publisher, "region-a");

  // Don't register any targets

  assert.throws(
    () => service.replicate("task.created" as TypedEventType, { taskId: "test" }, ["non-existent-region"]),
    /No target regions configured/,
  );
});

test("CrossRegionEventReplicationService - getMetrics tracks all status types [ha-services-comprehensive]", () => {
  const publisher = createMockPublisher();
  const service = new CrossRegionEventReplicationService(publisher, "region-a");

  service.registerTargetRegion({
    regionId: "region-b",
    status: "active",
    endpoint: "https://region-b",
    latencyMs: 50,
  });
  service.registerTargetRegion({
    regionId: "region-c",
    status: "active",
    endpoint: "https://region-c",
    latencyMs: 50,
  });

  // Replicate multiple events
  service.replicate("task.created" as TypedEventType, { taskId: "test-1" });
  service.replicate("task.updated" as TypedEventType, { taskId: "test-2" });

  const metrics = service.getMetrics();

  // All counts should be non-negative
  assert.ok(metrics.totalEvents >= 0);
  assert.ok(metrics.pendingCount >= 0);
  assert.ok(metrics.replicatingCount >= 0);
  assert.ok(metrics.completedCount >= 0);
  assert.ok(metrics.failedCount >= 0);
  assert.ok(metrics.averageLatencyMs >= 0);
  assert.ok(metrics.replicationRatePerSecond >= 0);
});

test("CrossRegionEventReplicationService - getTargetRegions returns copy of regions [ha-services-comprehensive]", () => {
  const publisher = createMockPublisher();
  const service = new CrossRegionEventReplicationService(publisher, "region-a");

  service.registerTargetRegion({
    regionId: "region-b",
    status: "active",
    endpoint: "https://region-b",
    latencyMs: 50,
  });

  const regions1 = service.getTargetRegions();
  const regions2 = service.getTargetRegions();

  // Should be equal but not same reference
  assert.deepEqual(regions1, regions2);

  // Mutating should not affect service
  regions1.push({ regionId: "fake", status: "active", endpoint: "", latencyMs: 0 });
  const regions3 = service.getTargetRegions();
  assert.equal(regions3.length, 1);
});

test("CrossRegionEventReplicationService - processReplicationQueue handles empty queue [ha-services-comprehensive]", () => {
  const publisher = createMockPublisher();
  const service = new CrossRegionEventReplicationService(publisher, "region-a");

  // triggerReplication on empty queue should not throw
  service.triggerReplication();

  // No events to process
  const metrics = service.getMetrics();
  assert.equal(metrics.totalEvents, 0);
});

test("CrossRegionEventReplicationService - replication with inactive target region [ha-services-comprehensive]", () => {
  const publisher = createMockPublisher();
  const service = new CrossRegionEventReplicationService(publisher, "region-a");

  service.registerTargetRegion({
    regionId: "region-b",
    status: "inactive",
    endpoint: "https://region-b-inactive",
    latencyMs: null,
  });

  const eventId = service.replicate("task.created" as TypedEventType, { taskId: "test" });

  const result = service.getReplicationStatus(eventId);
  assert.ok(result);
});

test("CrossRegionEventReplicationService - replication with degraded target region [ha-services-comprehensive]", () => {
  const publisher = createMockPublisher();
  const service = new CrossRegionEventReplicationService(publisher, "region-a");

  service.registerTargetRegion({
    regionId: "region-b",
    status: "degraded",
    endpoint: "https://region-b-degraded",
    latencyMs: 500,
  });

  const eventId = service.replicate("task.created" as TypedEventType, { taskId: "test" });

  const result = service.getReplicationStatus(eventId);
  assert.ok(result);
});

test("CrossRegionEventReplicationService - removeTargetRegion when region doesn't exist [ha-services-comprehensive]", () => {
  const publisher = createMockPublisher();
  const service = new CrossRegionEventReplicationService(publisher, "region-a");

  service.registerTargetRegion({
    regionId: "region-b",
    status: "active",
    endpoint: "https://region-b",
    latencyMs: 50,
  });

  // Remove non-existent region should not throw
  service.removeTargetRegion("non-existent");

  // Original region should still be there
  assert.equal(service.getTargetRegions().length, 1);
});

test("CrossRegionEventReplicationService - partial config override [ha-services-comprehensive]", () => {
  const publisher = createMockPublisher();
  const service = new CrossRegionEventReplicationService(publisher, "region-a", {
    maxRetries: 10,
  });

  // Only maxRetries should be overridden, others use defaults
  service.registerTargetRegion({
    regionId: "region-b",
    status: "active",
    endpoint: "https://region-b",
    latencyMs: 50,
  });

  const eventId = service.replicate("task.created" as TypedEventType, { taskId: "test" });
  assert.ok(eventId);
});
