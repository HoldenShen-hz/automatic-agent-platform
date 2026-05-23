import assert from "node:assert/strict";
import test from "node:test";

import {
  HA_LEVEL_CONFIGS,
  type HaLevelConfig,
  type LeaderLease,
  type LeadershipQueryResult,
} from "../../../../../src/platform/five-plane-execution/ha/types.js";
import {
  LeaderElectionService,
  type LeaderElectionServiceOptions,
} from "../../../../../src/platform/five-plane-execution/ha/leader-election-service.js";
import type { HaCoordinatorService } from "../../../../../src/platform/five-plane-execution/ha/ha-coordinator-service-inner.js";

class TestCoordinator {
  public registrations: Array<{ nodeId: string; region: string; metadata?: Record<string, unknown> }> = [];
  public heartbeats: Array<{ nodeId: string; status: string }> = [];
  public releases: Array<{ nodeId?: string; leaseId?: string }> = [];
  public activeLease: LeaderLease | null = null;
  public leaderNodeId: string | null = null;
  public epoch = 0;
  public fencingToken = 0;
  public expired = false;

  getCurrentLeader(): { nodeId: string } | null {
    return this.leaderNodeId == null ? null : { nodeId: this.leaderNodeId };
  }

  getActiveLease(): LeaderLease | null {
    return this.activeLease;
  }

  registerNode(nodeId: string, region: string, metadata?: Record<string, unknown>): void {
    this.registrations.push({ nodeId, region, metadata });
  }

  updateNodeHeartbeat(nodeId: string, status: string): void {
    this.heartbeats.push({ nodeId, status });
  }

  queryLeadership(_nodeId?: string): LeadershipQueryResult {
    return {
      isLeader: this.leaderNodeId != null,
      leaderNodeId: this.leaderNodeId,
      epoch: this.epoch,
      fencingToken: this.fencingToken,
      expiresAt: this.activeLease?.expiresAt ?? null,
      isExpired: this.expired,
    };
  }

  acquireLeadership(input: { nodeId: string; ttlMs?: number; forceAcquire?: boolean }): {
    acquired: boolean;
    lease: LeaderLease;
    epoch: number;
    fencingToken: number;
  } {
    const ttlMs = input.ttlMs ?? 15_000;
    const now = new Date().toISOString();
    this.epoch += 1;
    this.fencingToken += 1;
    this.leaderNodeId = input.nodeId;
    this.expired = false;
    this.activeLease = {
      leaseId: `lease-${this.epoch}`,
      nodeId: input.nodeId,
      epoch: this.epoch,
      acquiredAt: now,
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
      status: "active",
      ttlMs,
    };
    return {
      acquired: true,
      lease: this.activeLease,
      epoch: this.epoch,
      fencingToken: this.fencingToken,
    };
  }

  renewLeadership(): {
    renewed: boolean;
    lease: LeaderLease | null;
    fencingToken: number;
  } {
    if (this.activeLease == null) {
      return { renewed: false, lease: null, fencingToken: this.fencingToken };
    }
    this.activeLease = {
      ...this.activeLease,
      expiresAt: new Date(Date.now() + this.activeLease.ttlMs).toISOString(),
    };
    return {
      renewed: true,
      lease: this.activeLease,
      fencingToken: this.fencingToken,
    };
  }

  releaseLeadership(nodeId?: string, leaseId?: string): boolean {
    this.releases.push({ nodeId, leaseId });
    this.activeLease = null;
    this.leaderNodeId = null;
    this.expired = true;
    return true;
  }
}

function createService(
  coordinator: TestCoordinator = new TestCoordinator(),
  overrides: Partial<LeaderElectionServiceOptions> = {},
): { coordinator: TestCoordinator; service: LeaderElectionService } {
  const service = new LeaderElectionService(
    coordinator as unknown as HaCoordinatorService,
    {
      nodeId: "node-1",
      region: "us-east-1",
      haLevel: "HA_2",
      haConfig: {
        leaseRenewalIntervalMs: 0,
        heartbeatIntervalMs: 0,
        ...(overrides.haConfig ?? {}),
      },
      ...overrides,
    },
  );
  return { coordinator, service };
}

test("HA_LEVEL_CONFIGS expose immutable canonical defaults", () => {
  assert.equal(HA_LEVEL_CONFIGS.HA_1.leaseRenewalIntervalMs, 0);
  assert.equal(HA_LEVEL_CONFIGS.HA_2.leaseTtlMs, 15_000);
  assert.equal(HA_LEVEL_CONFIGS.HA_3.crossRegionFailover, true);
  assert.ok(Object.isFrozen(HA_LEVEL_CONFIGS.HA_1));
  assert.ok(Object.isFrozen(HA_LEVEL_CONFIGS.HA_2));
  assert.ok(Object.isFrozen(HA_LEVEL_CONFIGS.HA_3));
});

test("constructor exposes node identity and effective config", () => {
  const { service } = createService(new TestCoordinator(), {
    haLevel: "HA_3",
    haConfig: { leaseTtlMs: 22_000 },
  });

  assert.equal(service.getState(), "stopped");
  assert.equal(service.getNodeId(), "node-1");
  assert.equal(service.getRegion(), "us-east-1");
  assert.equal(service.getHaLevel(), "HA_3");
  assert.equal(service.getConfig().leaseTtlMs, 22_000);
});

test("HA_1 start enters leader state without coordinator lease calls", async () => {
  const coordinator = new TestCoordinator();
  const { service } = createService(coordinator, { haLevel: "HA_1", haConfig: {} });

  await service.start();

  assert.equal(service.getState(), "leader");
  assert.equal(service.isLeader(), true);
  assert.equal(service.getLeaderNodeId(), "node-1");
  assert.equal(coordinator.activeLease, null);
  assert.deepEqual(service.queryLeadership(), {
    isLeader: true,
    leaderNodeId: "node-1",
    epoch: 1,
    fencingToken: 1,
    expiresAt: service.getCurrentLease()?.expiresAt ?? null,
    isExpired: false,
  });
});

test("start acquires leadership when coordinator reports no active leader", async () => {
  const { coordinator, service } = createService();

  await service.start();

  assert.equal(coordinator.registrations.length, 1);
  assert.equal(service.getState(), "leader");
  assert.equal(service.hasLeadership(), true);
  assert.equal(service.getLeaderNodeId(), "node-1");
  assert.equal(service.getFencingToken(), 1);
});

test("start becomes follower when another leader holds a valid lease", async () => {
  const coordinator = new TestCoordinator();
  coordinator.leaderNodeId = "node-2";
  coordinator.epoch = 7;
  coordinator.fencingToken = 9;
  coordinator.activeLease = {
    leaseId: "lease-7",
    nodeId: "node-2",
    epoch: 7,
    acquiredAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 15_000).toISOString(),
    status: "active",
    ttlMs: 15_000,
  };

  const { service } = createService(coordinator);
  await service.start();

  assert.equal(service.getState(), "follower");
  assert.equal(service.isFollower(), true);
  assert.equal(service.isLeader(), false);
  assert.equal(service.getLeaderNodeId(), "node-2");
});

test("forceAcquireLeadership promotes the node and records a lease", async () => {
  const { service } = createService();

  const acquired = await service.forceAcquireLeadership();

  assert.equal(acquired, true);
  assert.equal(service.getState(), "leader");
  assert.equal(service.getCurrentLease()?.nodeId, "node-1");
  assert.equal(service.getFencingToken(), 1);
});

test("stop releases the active lease and returns to stopped state", async () => {
  const { coordinator, service } = createService();
  await service.start();

  await service.stop();

  assert.equal(service.getState(), "stopped");
  assert.equal(service.getCurrentLease(), null);
  assert.equal(coordinator.releases.length, 1);
  assert.equal(coordinator.releases[0]?.nodeId, "node-1");
});

test("registerWithGracefulShutdown adds a critical stop handler", () => {
  const { service } = createService();
  const calls: Array<{
    name: string;
    timeoutMs?: number;
    critical?: boolean;
    handler: () => Promise<void>;
  }> = [];

  service.registerWithGracefulShutdown({
    addHandler(handler) {
      calls.push(handler);
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.name, "leader-election:node-1");
  assert.equal(calls[0]?.critical, true);
  assert.equal(calls[0]?.timeoutMs, service.getConfig().leaseTtlMs);
});

test("dispose is idempotent and clears volatile leadership state", async () => {
  const { service } = createService();
  await service.forceAcquireLeadership();

  service.dispose();
  service.dispose();

  assert.equal(service.getState(), "stopped");
  assert.equal(service.getCurrentLease(), null);
});

test("getHaConfig returns a defensive copy", () => {
  const { service } = createService();
  const config = service.getHaConfig();
  const mutated = { ...config, leaseTtlMs: 1 } satisfies HaLevelConfig;

  assert.equal(service.getHaConfig().leaseTtlMs, HA_LEVEL_CONFIGS.HA_2.leaseTtlMs);
  assert.equal(mutated.leaseTtlMs, 1);
});
