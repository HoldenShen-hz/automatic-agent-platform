import assert from "node:assert/strict";
import test from "node:test";

import {
  CDCReplicationService,
  MultiRegionReplicationCoordinator,
  type CDCReplicationEvent,
  type CDCReplicationBatch,
  type RegionReplicationConfig,
} from "../../../src/scale-ecosystem/multi-region/cdc-replication-service.js";

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
// CDCReplicationService Tests
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

test("CDCReplicationService.getConfig returns undefined for unregistered pair", () => {
  const service = new CDCReplicationService();

  const config = service.getConfig("unknown-source", "unknown-target");

  assert.equal(config, undefined);
});

test("CDCReplicationService.getCheckpoint returns undefined for unregistered pair", () => {
  const service = new CDCReplicationService();

  const checkpoint = service.getCheckpoint("unknown-source", "unknown-target");

  assert.equal(checkpoint, undefined);
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
  const events = [
    createReplicationEvent({ sequence: 0 }),
    createReplicationEvent({ sequence: 1 }),
  ];

  const batch = service.prepareBatch("us-west-2", "eu-west-1", events);

  // No events after checkpoint (which starts at sequence 0)
  assert.equal(batch, null);
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

test("CDCReplicationService.recordFailure logs error without throwing", () => {
  const service = new CDCReplicationService();
  const events = [createReplicationEvent()];
  const batch: CDCReplicationBatch = {
    batchId: "batch-1",
    sourceRegionId: "us-west-2",
    targetRegionId: "eu-west-1",
    events,
    startSequence: 1,
    endSequence: 1,
    createdAt: "2026-04-20T00:00:00.000Z",
  };

  // Should not throw
  service.recordFailure("us-west-2", "eu-west-1", batch, "Test error");

  // No assertion needed - just verify no exception
  assert.ok(true);
});

test("CDCReplicationService.getStatus returns idle when no queue", () => {
  const service = new CDCReplicationService();

  const status = service.getStatus("us-west-2", "eu-west-1");

  assert.equal(status, "idle");
});

test("CDCReplicationService.getStatus returns idle when queue is empty", () => {
  const service = new CDCReplicationService();
  service.registerReplication(createReplicationConfig());
  // RegisterReplication initializes queue as empty

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

test("CDCReplicationService.isEnabled returns false for unregistered pair", () => {
  const service = new CDCReplicationService();

  const enabled = service.isEnabled("unknown", "unknown");

  assert.equal(enabled, false);
});

test("CDCReplicationService.getReplicationLag returns total events when no checkpoint", () => {
  const service = new CDCReplicationService();

  const lag = service.getReplicationLag("unknown", "unknown", 100);

  assert.equal(lag, 100);
});

test("CDCReplicationService.getReplicationLag calculates correct lag", () => {
  const service = new CDCReplicationService();
  service.registerReplication(createReplicationConfig());
  // Confirm a batch that processed events up to sequence 50
  const batch: CDCReplicationBatch = {
    batchId: "batch-1",
    sourceRegionId: "us-west-2",
    targetRegionId: "eu-west-1",
    events: [createReplicationEvent({ id: "event-50", sequence: 50 })],
    startSequence: 50,
    endSequence: 50,
    createdAt: "2026-04-20T00:00:00.000Z",
  };
  service.confirmBatch("us-west-2", "eu-west-1", batch);

  const lag = service.getReplicationLag("us-west-2", "eu-west-1", 100);

  assert.equal(lag, 50);
});

test("CDCReplicationService.getReplicationLag returns zero when caught up", () => {
  const service = new CDCReplicationService();
  service.registerReplication(createReplicationConfig());

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