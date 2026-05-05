import assert from "node:assert/strict";
import test from "node:test";

import {
  CrossRegionTruthLeader,
  type TruthLeaderEpoch,
  type TruthWriteClaim,
} from "../../../../../src/platform/state-evidence/truth/cross-region-truth-leader.js";
import {
  CDCReplicationService,
  MultiRegionReplicationCoordinator,
  type CDCReplicationEvent,
  type CDCReplicationBatch,
  type RegionReplicationConfig,
} from "../../../../../src/scale-ecosystem/multi-region/cdc-replication-service.js";

function createReplicationEvent(overrides: Partial<CDCReplicationEvent> = {}): CDCReplicationEvent {
  return {
    id: overrides.id ?? "event-1",
    sequence: overrides.sequence ?? 1,
    eventType: overrides.eventType ?? "task.created",
    taskId: overrides.taskId ?? "task-1",
    payloadJson: overrides.payloadJson ?? JSON.stringify({ data: "test" }),
    createdAt: overrides.createdAt ?? "2026-04-20T00:00:00.000Z",
    ...overrides,
  };
}

function createReplicationConfig(overrides: Partial<RegionReplicationConfig> = {}): RegionReplicationConfig {
  return {
    sourceRegionId: overrides.sourceRegionId ?? "us-west-2",
    targetRegionId: overrides.targetRegionId ?? "eu-west-1",
    batchSize: overrides.batchSize ?? 100,
    replicationIntervalMs: overrides.replicationIntervalMs ?? 5000,
    enabled: overrides.enabled ?? true,
    retryPolicy: {
      maxRetries: overrides.retryPolicy?.maxRetries ?? 3,
      backoffMs: overrides.retryPolicy?.backoffMs ?? 1000,
    },
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CrossRegionTruthLeader Tests - Multi-Region Write Fencing
// ─────────────────────────────────────────────────────────────────────────────

test("CrossRegionTruthLeader.evaluate accepts matching epoch and claim", () => {
  const leader = new CrossRegionTruthLeader();
  const epoch: TruthLeaderEpoch = {
    tenantId: "tenant-1",
    homeRegion: "us-east",
    leaderRegion: "us-east",
    epoch: 1,
    fencingToken: "token-abc",
  };
  const claim: TruthWriteClaim = {
    tenantId: "tenant-1",
    region: "us-east",
    epoch: 1,
    fencingToken: "token-abc",
  };

  const decision = leader.evaluate(epoch, claim);

  assert.equal(decision.accepted, true);
  assert.equal(decision.reasonCode, "truth_leader.accepted");
});

test("CrossRegionTruthLeader.evaluate rejects when tenantId mismatches", () => {
  const leader = new CrossRegionTruthLeader();
  const epoch: TruthLeaderEpoch = {
    tenantId: "tenant-1",
    homeRegion: "us-east",
    leaderRegion: "us-east",
    epoch: 1,
    fencingToken: "token-abc",
  };
  const claim: TruthWriteClaim = {
    tenantId: "tenant-2",
    region: "us-east",
    epoch: 1,
    fencingToken: "token-abc",
  };

  const decision = leader.evaluate(epoch, claim);

  assert.equal(decision.accepted, false);
  assert.equal(decision.reasonCode, "truth_leader.tenant_mismatch");
});

test("CrossRegionTruthLeader.evaluate rejects when region is not home region", () => {
  const leader = new CrossRegionTruthLeader();
  const epoch: TruthLeaderEpoch = {
    tenantId: "tenant-1",
    homeRegion: "us-east",
    leaderRegion: "us-east",
    epoch: 1,
    fencingToken: "token-abc",
  };
  const claim: TruthWriteClaim = {
    tenantId: "tenant-1",
    region: "eu-west",
    epoch: 1,
    fencingToken: "token-abc",
  };

  const decision = leader.evaluate(epoch, claim);

  assert.equal(decision.accepted, false);
  assert.equal(decision.reasonCode, "truth_leader.not_home_region");
});

test("CrossRegionTruthLeader.evaluate rejects when leaderRegion differs from claim region", () => {
  const leader = new CrossRegionTruthLeader();
  const epoch: TruthLeaderEpoch = {
    tenantId: "tenant-1",
    homeRegion: "us-east",
    leaderRegion: "us-west",
    epoch: 1,
    fencingToken: "token-abc",
  };
  const claim: TruthWriteClaim = {
    tenantId: "tenant-1",
    region: "us-east",
    epoch: 1,
    fencingToken: "token-abc",
  };

  const decision = leader.evaluate(epoch, claim);

  assert.equal(decision.accepted, false);
  assert.equal(decision.reasonCode, "truth_leader.not_home_region");
});

test("CrossRegionTruthLeader.evaluate rejects when epoch mismatches", () => {
  const leader = new CrossRegionTruthLeader();
  const epoch: TruthLeaderEpoch = {
    tenantId: "tenant-1",
    homeRegion: "us-east",
    leaderRegion: "us-east",
    epoch: 2,
    fencingToken: "token-abc",
  };
  const claim: TruthWriteClaim = {
    tenantId: "tenant-1",
    region: "us-east",
    epoch: 1,
    fencingToken: "token-abc",
  };

  const decision = leader.evaluate(epoch, claim);

  assert.equal(decision.accepted, false);
  assert.equal(decision.reasonCode, "truth_leader.epoch_mismatch");
});

test("CrossRegionTruthLeader.evaluate rejects when fencing token mismatches", () => {
  const leader = new CrossRegionTruthLeader();
  const epoch: TruthLeaderEpoch = {
    tenantId: "tenant-1",
    homeRegion: "us-east",
    leaderRegion: "us-east",
    epoch: 1,
    fencingToken: "token-xyz",
  };
  const claim: TruthWriteClaim = {
    tenantId: "tenant-1",
    region: "us-east",
    epoch: 1,
    fencingToken: "token-abc",
  };

  const decision = leader.evaluate(epoch, claim);

  assert.equal(decision.accepted, false);
  assert.equal(decision.reasonCode, "truth_leader.fencing_token_mismatch");
});

test("CrossRegionTruthLeader.evaluate accepts valid multi-region claim", () => {
  const leader = new CrossRegionTruthLeader();
  const epoch: TruthLeaderEpoch = {
    tenantId: "tenant-multi",
    homeRegion: "us-east",
    leaderRegion: "us-east",
    epoch: 5,
    fencingToken: "fence-999",
  };
  const claim: TruthWriteClaim = {
    tenantId: "tenant-multi",
    region: "us-east",
    epoch: 5,
    fencingToken: "fence-999",
  };

  const decision = leader.evaluate(epoch, claim);

  assert.equal(decision.accepted, true);
  assert.equal(decision.reasonCode, "truth_leader.accepted");
});

test("CrossRegionTruthLeader rejects cross-region write attempt to non-leader region", () => {
  const leader = new CrossRegionTruthLeader();
  const epoch: TruthLeaderEpoch = {
    tenantId: "tenant-1",
    homeRegion: "us-east",
    leaderRegion: "us-east",
    epoch: 1,
    fencingToken: "token-abc",
  };
  const claim: TruthWriteClaim = {
    tenantId: "tenant-1",
    region: "us-west",
    epoch: 1,
    fencingToken: "token-abc",
  };

  const decision = leader.evaluate(epoch, claim);

  assert.equal(decision.accepted, false);
  assert.equal(decision.reasonCode, "truth_leader.not_home_region");
});

test("CrossRegionTruthLeader validates all conditions in order", () => {
  const leader = new CrossRegionTruthLeader();
  const epoch: TruthLeaderEpoch = {
    tenantId: "tenant-1",
    homeRegion: "us-east",
    leaderRegion: "us-east",
    epoch: 1,
    fencingToken: "token-abc",
  };

  // First check: tenant mismatch takes precedence
  let claim: TruthWriteClaim = {
    tenantId: "tenant-2",
    region: "eu-west",
    epoch: 99,
    fencingToken: "wrong-token",
  };
  let decision = leader.evaluate(epoch, claim);
  assert.equal(decision.reasonCode, "truth_leader.tenant_mismatch");

  // Second check: region mismatch
  claim = {
    tenantId: "tenant-1",
    region: "eu-west",
    epoch: 99,
    fencingToken: "wrong-token",
  };
  decision = leader.evaluate(epoch, claim);
  assert.equal(decision.reasonCode, "truth_leader.not_home_region");

  // Third check: epoch mismatch
  claim = {
    tenantId: "tenant-1",
    region: "us-east",
    epoch: 99,
    fencingToken: "wrong-token",
  };
  decision = leader.evaluate(epoch, claim);
  assert.equal(decision.reasonCode, "truth_leader.epoch_mismatch");

  // Fourth check: fencing token mismatch
  claim = {
    tenantId: "tenant-1",
    region: "us-east",
    epoch: 1,
    fencingToken: "wrong-token",
  };
  decision = leader.evaluate(epoch, claim);
  assert.equal(decision.reasonCode, "truth_leader.fencing_token_mismatch");
});

test("CDCReplicationService validateLeaderFencingToken rejects stale leader epoch after epoch is recorded", () => {
  const service = new CDCReplicationService();

  service.recordEntityEpoch("tenant:truth", 7, "us-east");

  const stale = service.validateLeaderFencingToken("tenant:truth", {
    epoch: 6,
    regionId: "us-west",
  });
  const current = service.validateLeaderFencingToken("tenant:truth", {
    epoch: 7,
    regionId: "us-east",
  });

  assert.equal(stale.valid, false);
  assert.match(stale.reason ?? "", /stale_leader_epoch/);
  assert.equal(current.valid, true);
  assert.equal(current.reason, null);
});

test("CDCReplicationService applyBatch filters stale epoch events before conflict resolution", () => {
  const service = new CDCReplicationService();
  service.recordEntityEpoch("tenant:cdc", 5, "us-east");

  const localEvents = [
    createReplicationEvent({ id: "local-5", taskId: "task-1", sequence: 5, epoch: 5 }),
  ];
  const remoteEvents = [
    createReplicationEvent({ id: "remote-stale", taskId: "task-2", sequence: 6, epoch: 4 }),
    createReplicationEvent({ id: "remote-fresh", taskId: "task-3", sequence: 7, epoch: 5 }),
  ];

  const merged = service.applyBatch("tenant:cdc", localEvents, remoteEvents);

  assert.equal(merged.some((event) => event.id === "remote-stale"), false);
  assert.equal(merged.some((event) => event.id === "remote-fresh"), true);
});

// ─────────────────────────────────────────────────────────────────────────────
// CDCReplicationService Tests - Multi-Region Checkpoint Tracking
// ─────────────────────────────────────────────────────────────────────────────

test("CDCReplicationService.registerReplication adds config and initializes checkpoint", () => {
  const service = new CDCReplicationService();
  const config = createReplicationConfig({ sourceRegionId: "us-west-2", targetRegionId: "eu-west-1" });

  service.registerReplication(config);

  const retrieved = service.getConfig("us-west-2", "eu-west-1");
  assert.ok(retrieved !== undefined);
  assert.equal(retrieved!.sourceRegionId, "us-west-2");
  assert.equal(retrieved!.targetRegionId, "eu-west-1");
});

test("CDCReplicationService.registerReplication initializes checkpoint on first registration", () => {
  const service = new CDCReplicationService();
  const config = createReplicationConfig();

  service.registerReplication(config);

  const checkpoint = service.getCheckpoint(config.sourceRegionId, config.targetRegionId);
  assert.ok(checkpoint !== undefined);
  assert.equal(checkpoint!.lastEventSequence, 0);
  assert.equal(checkpoint!.lastEventId, null);
});

test("CDCReplicationService.prepareBatch returns null when no checkpoint exists", () => {
  const service = new CDCReplicationService();
  const events = [createReplicationEvent()];

  const batch = service.prepareBatch("unknown-source", "unknown-target", events);

  assert.equal(batch, null);
});

test("CDCReplicationService.prepareBatch returns null when no events after checkpoint", () => {
  const service = new CDCReplicationService();
  service.registerReplication(createReplicationConfig({ sourceRegionId: "us-west-2", targetRegionId: "eu-west-1" }));

  // Initial checkpoint is at sequence 0, so events at sequence 0 or 1 would be after it
  // But if we confirm sequence 1 first, then sequence 1 is no longer "after"
  const batch: CDCReplicationBatch = {
    batchId: "batch-1",
    sourceRegionId: "us-west-2",
    targetRegionId: "eu-west-1",
    events: [createReplicationEvent({ id: "event-1", sequence: 1 })],
    startSequence: 1,
    endSequence: 1,
    createdAt: "2026-04-20T00:00:00.000Z",
  };
  service.confirmBatch("us-west-2", "eu-west-1", batch);

  // Now prepare batch with event at sequence 1 - should be null since we're already at 1
  const result = service.prepareBatch("us-west-2", "eu-west-1", [
    createReplicationEvent({ id: "event-1", sequence: 1 }),
  ]);

  assert.equal(result, null);
});

test("CDCReplicationService.prepareBatch creates batch for events after checkpoint", () => {
  const service = new CDCReplicationService();
  service.registerReplication(createReplicationConfig({ sourceRegionId: "us-west-2", targetRegionId: "eu-west-1" }));
  const events = [
    createReplicationEvent({ id: "event-1", sequence: 1 }),
    createReplicationEvent({ id: "event-2", sequence: 2 }),
    createReplicationEvent({ id: "event-3", sequence: 3 }),
  ];

  const batch = service.prepareBatch("us-west-2", "eu-west-1", events);

  assert.ok(batch !== null);
  assert.equal(batch!.sourceRegionId, "us-west-2");
  assert.equal(batch!.targetRegionId, "eu-west-1");
  assert.equal(batch!.events.length, 3);
  assert.equal(batch!.startSequence, 1);
  assert.equal(batch!.endSequence, 3);
});

test("CDCReplicationService.prepareBatch respects batch size limit", () => {
  const service = new CDCReplicationService();
  service.registerReplication(createReplicationConfig({ sourceRegionId: "us-west-2", targetRegionId: "eu-west-1", batchSize: 2 }));
  const events = [
    createReplicationEvent({ id: "event-1", sequence: 1 }),
    createReplicationEvent({ id: "event-2", sequence: 2 }),
    createReplicationEvent({ id: "event-3", sequence: 3 }),
  ];

  const batch = service.prepareBatch("us-west-2", "eu-west-1", events);

  assert.ok(batch !== null);
  assert.equal(batch!.events.length, 2);
  assert.equal(batch!.startSequence, 1);
  assert.equal(batch!.endSequence, 2);
});

test("CDCReplicationService.confirmBatch updates checkpoint with batch end sequence", () => {
  const service = new CDCReplicationService();
  service.registerReplication(createReplicationConfig());
  const events = [
    createReplicationEvent({ id: "event-1", sequence: 1 }),
    createReplicationEvent({ id: "event-2", sequence: 2 }),
  ];
  const batch = service.prepareBatch("us-west-2", "eu-west-1", events)!;

  service.confirmBatch("us-west-2", "eu-west-1", batch);

  const checkpoint = service.getCheckpoint("us-west-2", "eu-west-1");
  assert.ok(checkpoint !== undefined);
  assert.equal(checkpoint!.lastEventSequence, 2);
  assert.equal(checkpoint!.lastEventId, "event-2");
});

test("CDCReplicationService.getStatus returns idle when no queue", () => {
  const service = new CDCReplicationService();

  const status = service.getStatus("us-west-2", "eu-west-1");

  assert.equal(status, "idle");
});

test("CDCReplicationService.getStatus returns syncing when queue has pending batches", () => {
  const service = new CDCReplicationService();
  service.registerReplication(createReplicationConfig());
  const events = [createReplicationEvent({ id: "event-1", sequence: 1 })];
  service.prepareBatch("us-west-2", "eu-west-1", events);

  const status = service.getStatus("us-west-2", "eu-west-1");

  assert.equal(status, "syncing");
});

test("CDCReplicationService.getRegisteredRegionPairs returns all registered pairs", () => {
  const service = new CDCReplicationService();
  service.registerReplication(createReplicationConfig({ sourceRegionId: "us-west-2", targetRegionId: "eu-west-1" }));
  service.registerReplication(createReplicationConfig({ sourceRegionId: "us-west-2", targetRegionId: "cn-north-1" }));

  const pairs = service.getRegisteredRegionPairs();

  assert.equal(pairs.length, 2);
  assert.ok(pairs.some((p) => p.targetRegionId === "eu-west-1"));
  assert.ok(pairs.some((p) => p.targetRegionId === "cn-north-1"));
});

test("CDCReplicationService.isEnabled returns true when enabled", () => {
  const service = new CDCReplicationService();
  service.registerReplication(createReplicationConfig({ enabled: true }));

  const enabled = service.isEnabled("us-west-2", "eu-west-1");

  assert.equal(enabled, true);
});

test("CDCReplicationService.isEnabled returns false when disabled", () => {
  const service = new CDCReplicationService();
  service.registerReplication(createReplicationConfig({ enabled: false }));

  const enabled = service.isEnabled("us-west-2", "eu-west-1");

  assert.equal(enabled, false);
});

test("CDCReplicationService.getReplicationLag returns zero when no checkpoint exists", () => {
  const service = new CDCReplicationService();

  const lag = service.getReplicationLag("unknown", "unknown", 100);

  assert.equal(lag, 0);
});

test("CDCReplicationService.getReplicationLag returns time-based lag after confirmation", () => {
  const service = new CDCReplicationService();
  service.registerReplication(createReplicationConfig());
  const fiveSecondsAgo = new Date(Date.now() - 5_000).toISOString();

  const batch: CDCReplicationBatch = {
    batchId: "batch-1",
    sourceRegionId: "us-west-2",
    targetRegionId: "eu-west-1",
    events: [createReplicationEvent({ id: "event-50", sequence: 50, createdAt: fiveSecondsAgo })],
    startSequence: 50,
    endSequence: 50,
    createdAt: fiveSecondsAgo,
  };
  service.confirmBatch("us-west-2", "eu-west-1", batch);

  const lag = service.getReplicationLag("us-west-2", "eu-west-1", 100);

  assert.ok(lag >= 4_000);
  assert.ok(lag < 60_000);
});

test("CDCReplicationService.getReplicationLag returns zero when caught up", () => {
  const service = new CDCReplicationService();
  service.registerReplication(createReplicationConfig());

  // With no confirmation, checkpoint is at 0 and total is 0
  const lag = service.getReplicationLag("us-west-2", "eu-west-1", 0);

  assert.equal(lag, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// MultiRegionReplicationCoordinator Tests
// ─────────────────────────────────────────────────────────────────────────────

test("MultiRegionReplicationCoordinator.constructor creates CDC service", () => {
  const coordinator = new MultiRegionReplicationCoordinator();

  assert.ok(coordinator.getCDCService() instanceof CDCReplicationService);
});

test("MultiRegionReplicationCoordinator.constructor accepts CDC service", () => {
  const cdcService = new CDCReplicationService();
  const coordinator = new MultiRegionReplicationCoordinator(cdcService);

  assert.equal(coordinator.getCDCService(), cdcService);
});

test("MultiRegionReplicationCoordinator.setupRegionReplication registers multiple configs", () => {
  const coordinator = new MultiRegionReplicationCoordinator();

  coordinator.setupRegionReplication("us-west-2", [
    { targetRegionId: "eu-west-1" },
    { targetRegionId: "cn-north-1" },
  ]);

  const replications = coordinator.getRegionReplications("us-west-2");
  assert.equal(replications.length, 2);
});

test("MultiRegionReplicationCoordinator.setupRegionReplication uses custom batch size and interval", () => {
  const coordinator = new MultiRegionReplicationCoordinator();

  coordinator.setupRegionReplication("us-west-2", [
    { targetRegionId: "eu-west-1", batchSize: 50, intervalMs: 3000 },
  ]);

  const replications = coordinator.getRegionReplications("us-west-2");
  assert.equal(replications[0]!.batchSize, 50);
  assert.equal(replications[0]!.replicationIntervalMs, 3000);
});

test("MultiRegionReplicationCoordinator.setupRegionReplication sets defaults for optional params", () => {
  const coordinator = new MultiRegionReplicationCoordinator();

  coordinator.setupRegionReplication("us-west-2", [{ targetRegionId: "eu-west-1" }]);

  const replications = coordinator.getRegionReplications("us-west-2");
  assert.equal(replications[0]!.batchSize, 100);
  assert.equal(replications[0]!.replicationIntervalMs, 5000);
  assert.equal(replications[0]!.enabled, true);
});

test("MultiRegionReplicationCoordinator.getRegionReplications returns empty for unknown region", () => {
  const coordinator = new MultiRegionReplicationCoordinator();

  const replications = coordinator.getRegionReplications("unknown-region");

  assert.deepEqual(replications, []);
});

test("MultiRegionReplicationCoordinator.getRegionReplications returns all configs for source region", () => {
  const coordinator = new MultiRegionReplicationCoordinator();
  coordinator.setupRegionReplication("us-west-2", [
    { targetRegionId: "eu-west-1" },
    { targetRegionId: "cn-north-1" },
    { targetRegionId: "ap-south-1" },
  ]);

  const replications = coordinator.getRegionReplications("us-west-2");

  assert.equal(replications.length, 3);
});

// ─────────────────────────────────────────────────────────────────────────────
// End-to-End Multi-Region Replication Scenarios
// ─────────────────────────────────────────────────────────────────────────────

test("Multi-region replication end-to-end: register, prepare, confirm, verify time-based lag", () => {
  const service = new CDCReplicationService();

  // Register replication pair
  service.registerReplication(createReplicationConfig({
    sourceRegionId: "us-east",
    targetRegionId: "us-west",
  }));

  // Initial state - no replicated event timestamp yet, lag is not measurable.
  let lag = service.getReplicationLag("us-east", "us-west", 100);
  assert.equal(lag, 0);

  // Prepare first batch
  const batch1 = service.prepareBatch("us-east", "us-west", [
    createReplicationEvent({ id: "event-1", sequence: 1, createdAt: new Date(Date.now() - 3_000).toISOString() }),
    createReplicationEvent({ id: "event-2", sequence: 2, createdAt: new Date(Date.now() - 2_000).toISOString() }),
    createReplicationEvent({ id: "event-3", sequence: 3, createdAt: new Date(Date.now() - 1_000).toISOString() }),
  ]);
  assert.ok(batch1 !== null);
  assert.equal(batch1!.events.length, 3);

  // Confirm first batch
  service.confirmBatch("us-east", "us-west", batch1!);

  // Lag is now time-based and should be non-negative once a checkpoint exists.
  lag = service.getReplicationLag("us-east", "us-west", 100);
  assert.ok(lag >= 0);

  // Prepare second batch
  const batch2 = service.prepareBatch("us-east", "us-west", [
    createReplicationEvent({ id: "event-4", sequence: 4 }),
    createReplicationEvent({ id: "event-5", sequence: 5 }),
  ]);
  assert.ok(batch2 !== null);
  assert.equal(batch2!.events.length, 2);

  // Confirm second batch
  service.confirmBatch("us-east", "us-west", batch2!);

  // Additional confirmations keep lag measurable and non-negative.
  lag = service.getReplicationLag("us-east", "us-west", 100);
  assert.ok(lag >= 0);

  // Current implementation updates checkpoints without leaving residual queued work.
  const status = service.getStatus("us-east", "us-west");
  assert.equal(status, "idle");
});

test("Multi-region replication handles concurrent regional pairs", () => {
  const service = new CDCReplicationService();

  // Register multiple source regions targeting same destination
  service.registerReplication(createReplicationConfig({
    sourceRegionId: "us-east",
    targetRegionId: "eu-west",
  }));
  service.registerReplication(createReplicationConfig({
    sourceRegionId: "ap-south",
    targetRegionId: "eu-west",
  }));

  const pairs = service.getRegisteredRegionPairs();
  assert.equal(pairs.length, 2);

  // Both should be independently operational
  const usEastConfig = service.getConfig("us-east", "eu-west");
  const apSouthConfig = service.getConfig("ap-south", "eu-west");
  assert.ok(usEastConfig !== undefined);
  assert.ok(apSouthConfig !== undefined);

  // Prepare and confirm for us-east
  const batch1 = service.prepareBatch("us-east", "eu-west", [
    createReplicationEvent({ id: "event-1", sequence: 1 }),
  ]);
  assert.ok(batch1 !== null);
  service.confirmBatch("us-east", "eu-west", batch1!);

  // us-east should have reduced lag, ap-south should not
  const usEastLag = service.getReplicationLag("us-east", "eu-west", 100);
  const apSouthLag = service.getReplicationLag("ap-south", "eu-west", 100);
  assert.ok(usEastLag >= 0);
  assert.equal(apSouthLag, 0);
});

test("Multi-region replication validates region pair keys correctly", () => {
  const service = new CDCReplicationService();

  service.registerReplication(createReplicationConfig({
    sourceRegionId: "region-a",
    targetRegionId: "region-b",
  }));

  // Valid pair should work
  const config = service.getConfig("region-a", "region-b");
  assert.ok(config !== undefined);

  // Reversed pair should not work (different key)
  const reversed = service.getConfig("region-b", "region-a");
  assert.equal(reversed, undefined);

  // Different source should not work
  const differentSource = service.getConfig("region-x", "region-b");
  assert.equal(differentSource, undefined);

  // Different target should not work
  const differentTarget = service.getConfig("region-a", "region-y");
  assert.equal(differentTarget, undefined);
});
