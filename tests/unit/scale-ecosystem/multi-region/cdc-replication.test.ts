import test from "node:test";
import assert from "node:assert/strict";
import {
  CDCReplicationService,
  MultiRegionReplicationCoordinator,
  CDC_EVENT_TYPES,
  type CDCReplicationEvent,
  type CDCReplicationBatch,
  type RegionReplicationConfig,
} from "../../../../src/scale-ecosystem/multi-region/cdc-replication-service.js";

test("CDCReplicationService exports CDC_EVENT_TYPES [cdc-replication]", () => {
  assert.ok(Array.isArray(CDC_EVENT_TYPES));
  assert.ok(CDC_EVENT_TYPES.includes("cdc:replication_started"));
  assert.ok(CDC_EVENT_TYPES.includes("cdc:replication_completed"));
  assert.ok(CDC_EVENT_TYPES.includes("cdc:replication_failed"));
  assert.ok(CDC_EVENT_TYPES.includes("cdc:checkpoint_updated"));
  assert.equal(CDC_EVENT_TYPES.length, 4);
});

test("CDCReplicationService prepareBatch returns null when checkpoint not found [cdc-replication]", () => {
  const service = new CDCReplicationService();

  const events = [
    { id: "evt_1", sequence: 1, eventType: "task:created", taskId: "task_1", payloadJson: "{}", createdAt: "2024-01-01T00:00:00Z" },
  ] as any;

  const batch = service.prepareBatch("us-east", "eu-west", events);
  assert.equal(batch, null);
});

test("CDCReplicationService getStatus returns syncing when batches are queued [cdc-replication]", () => {
  const service = new CDCReplicationService();

  service.registerReplication({
    sourceRegionId: "us-east",
    targetRegionId: "eu-west",
    batchSize: 10,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  });

  const events = Array.from({ length: 15 }, (_, i) => ({
    id: `evt_${i}`,
    sequence: i + 1,
    eventType: "task:created",
    taskId: "task_1",
    payloadJson: "{}",
    createdAt: "2024-01-01T00:00:00Z",
  })) as any;

  // First batch (should be syncing)
  const batch = service.prepareBatch("us-east", "eu-west", events);
  assert.ok(batch !== null);

  const status = service.getStatus("us-east", "eu-west");
  assert.equal(status, "syncing");
});

test("CDCReplicationService confirmBatch updates lastEventId correctly [cdc-replication]", () => {
  const service = new CDCReplicationService();

  service.registerReplication({
    sourceRegionId: "us-east",
    targetRegionId: "eu-west",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  });

  const events = [
    { id: "evt_1", sequence: 1, eventType: "task:created", taskId: "task_1", payloadJson: "{}", createdAt: "2024-01-01T00:00:00Z" },
    { id: "evt_2", sequence: 2, eventType: "task:updated", taskId: "task_1", payloadJson: "{}", createdAt: "2024-01-01T00:01:00Z" },
    { id: "evt_3", sequence: 3, eventType: "task:completed", taskId: "task_1", payloadJson: "{}", createdAt: "2024-01-01T00:02:00Z" },
  ] as any;

  const batch = service.prepareBatch("us-east", "eu-west", events);
  assert.ok(batch !== null);

  service.confirmBatch("us-east", "eu-west", batch);

  const checkpoint = service.getCheckpoint("us-east", "eu-west");
  assert.equal(checkpoint?.lastEventId, "evt_3");
  assert.equal(checkpoint?.lastEventSequence, 3);
});

test("CDCReplicationService prepareBatch respects batch size limit [cdc-replication]", () => {
  const service = new CDCReplicationService();

  service.registerReplication({
    sourceRegionId: "us-east",
    targetRegionId: "eu-west",
    batchSize: 2,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  });

  const events = Array.from({ length: 10 }, (_, i) => ({
    id: `evt_${i}`,
    sequence: i + 1,
    eventType: "task:created",
    taskId: "task_1",
    payloadJson: "{}",
    createdAt: "2024-01-01T00:00:00Z",
  })) as any;

  const batch = service.prepareBatch("us-east", "eu-west", events);
  assert.ok(batch !== null);
  assert.equal(batch.events.length, 2); // Limited by batch size
  assert.equal(batch.startSequence, 1);
  assert.equal(batch.endSequence, 2);
});

test("CDCReplicationService prepareBatch skips already processed events [cdc-replication]", () => {
  const service = new CDCReplicationService();

  service.registerReplication({
    sourceRegionId: "us-east",
    targetRegionId: "eu-west",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  });

  // Initial batch
  const events1 = [
    { id: "evt_1", sequence: 1, eventType: "task:created", taskId: "task_1", payloadJson: "{}", createdAt: "2024-01-01T00:00:00Z" },
    { id: "evt_2", sequence: 2, eventType: "task:updated", taskId: "task_1", payloadJson: "{}", createdAt: "2024-01-01T00:01:00Z" },
  ] as any;

  const batch1 = service.prepareBatch("us-east", "eu-west", events1);
  assert.ok(batch1 !== null);
  service.confirmBatch("us-east", "eu-west", batch1);

  // Next batch should start from sequence 3
  const events2 = [
    { id: "evt_1", sequence: 1, eventType: "task:created", taskId: "task_1", payloadJson: "{}", createdAt: "2024-01-01T00:00:00Z" },
    { id: "evt_2", sequence: 2, eventType: "task:updated", taskId: "task_1", payloadJson: "{}", createdAt: "2024-01-01T00:01:00Z" },
    { id: "evt_3", sequence: 3, eventType: "task:completed", taskId: "task_1", payloadJson: "{}", createdAt: "2024-01-01T00:02:00Z" },
  ] as any;

  const batch2 = service.prepareBatch("us-east", "eu-west", events2);
  assert.ok(batch2 !== null);
  assert.equal(batch2.startSequence, 3);
  assert.equal(batch2.endSequence, 3);
});

test("CDCReplicationService recordFailure logs error [cdc-replication]", () => {
  const service = new CDCReplicationService();

  service.registerReplication({
    sourceRegionId: "us-east",
    targetRegionId: "eu-west",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  });

  const events = [
    { id: "evt_1", sequence: 1, eventType: "task:created", taskId: "task_1", payloadJson: "{}", createdAt: "2024-01-01T00:00:00Z" },
  ] as any;

  const batch = service.prepareBatch("us-east", "eu-west", events);
  assert.ok(batch !== null);

  // Should not throw
  service.recordFailure("us-east", "eu-west", batch, "Network timeout");
});

test("CDCReplicationService getReplicationLag returns totalSourceEvents when no checkpoint [cdc-replication]", () => {
  const service = new CDCReplicationService();

  const lag = service.getReplicationLag("us-east", "eu-west", 100);
  assert.equal(lag, 100);
});

test("CDCReplicationService getReplicationLag returns 0 when caught up [cdc-replication]", () => {
  const service = new CDCReplicationService();

  service.registerReplication({
    sourceRegionId: "us-east",
    targetRegionId: "eu-west",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  });

  const events = Array.from({ length: 50 }, (_, i) => ({
    id: `evt_${i}`,
    sequence: i + 1,
    eventType: "task:created",
    taskId: "task_1",
    payloadJson: "{}",
    createdAt: "2024-01-01T00:00:00Z",
  })) as any;

  const batch = service.prepareBatch("us-east", "eu-west", events);
  assert.ok(batch !== null);
  service.confirmBatch("us-east", "eu-west", batch);

  const lag = service.getReplicationLag("us-east", "eu-west", 50);
  assert.equal(lag, 0);
});

test("MultiRegionReplicationCoordinator registers with CDC service [cdc-replication]", () => {
  const coordinator = new MultiRegionReplicationCoordinator();

  coordinator.setupRegionReplication("us-east", [
    { targetRegionId: "eu-west" },
  ]);

  const cdcService = coordinator.getCDCService();
  assert.ok(cdcService.isEnabled("us-east", "eu-west"));
});

test("MultiRegionReplicationCoordinator setup uses defaults [cdc-replication]", () => {
  const coordinator = new MultiRegionReplicationCoordinator();

  coordinator.setupRegionReplication("us-east", [
    { targetRegionId: "eu-west" },
  ]);

  const replications = coordinator.getRegionReplications("us-east");
  assert.equal(replications.length, 1);
  assert.equal(replications[0]!.batchSize, 100); // Default
  assert.equal(replications[0]!.replicationIntervalMs, 5000); // Default
});

test("MultiRegionReplicationCoordinator getRegionReplications returns empty for unknown region [cdc-replication]", () => {
  const coordinator = new MultiRegionReplicationCoordinator();

  const replications = coordinator.getRegionReplications("us-east");
  assert.equal(replications.length, 0);
});

test("MultiRegionReplicationCoordinator getCDCService returns same instance [cdc-replication]", () => {
  const coordinator = new MultiRegionReplicationCoordinator();

  const cdc1 = coordinator.getCDCService();
  const cdc2 = coordinator.getCDCService();
  assert.strictEqual(cdc1, cdc2);
});

test("CDCReplicationService handles empty events array [cdc-replication]", () => {
  const service = new CDCReplicationService();

  service.registerReplication({
    sourceRegionId: "us-east",
    targetRegionId: "eu-west",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  });

  const batch = service.prepareBatch("us-east", "eu-west", []);
  assert.equal(batch, null);
});

test("CDCReplicationService handles checkpoint after all events processed [cdc-replication]", () => {
  const service = new CDCReplicationService();

  service.registerReplication({
    sourceRegionId: "us-east",
    targetRegionId: "eu-west",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  });

  // Process all events
  const events = [
    { id: "evt_1", sequence: 1, eventType: "task:created", taskId: "task_1", payloadJson: "{}", createdAt: "2024-01-01T00:00:00Z" },
  ] as any;

  const batch = service.prepareBatch("us-east", "eu-west", events);
  assert.ok(batch !== null);
  service.confirmBatch("us-east", "eu-west", batch);

  // Try to prepare another batch with same events
  const batch2 = service.prepareBatch("us-east", "eu-west", events);
  assert.equal(batch2, null);
});

test("CDCReplicationService getRegisteredRegionPairs returns correct format [cdc-replication]", () => {
  const service = new CDCReplicationService();

  service.registerReplication({
    sourceRegionId: "us-east",
    targetRegionId: "eu-west",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  });

  const pairs = service.getRegisteredRegionPairs();
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0]!.sourceRegionId, "us-east");
  assert.equal(pairs[0]!.targetRegionId, "eu-west");
});

test("CDCReplicationService confirmBatch with empty events handles null lastEvent [cdc-replication]", () => {
  const service = new CDCReplicationService();

  service.registerReplication({
    sourceRegionId: "us-east",
    targetRegionId: "eu-west",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  });

  const emptyBatch: CDCReplicationBatch = {
    batchId: "batch_1",
    sourceRegionId: "us-east",
    targetRegionId: "eu-west",
    events: [],
    startSequence: 0,
    endSequence: 0,
    createdAt: "2024-01-01T00:00:00Z",
  };

  service.confirmBatch("us-east", "eu-west", emptyBatch);

  const checkpoint = service.getCheckpoint("us-east", "eu-west");
  assert.equal(checkpoint?.lastEventId, null);
  assert.equal(checkpoint?.lastEventSequence, 0);
});

test("MultiRegionReplicationCoordinator setup multiple targets for same source [cdc-replication]", () => {
  const coordinator = new MultiRegionReplicationCoordinator();

  coordinator.setupRegionReplication("us-east", [
    { targetRegionId: "eu-west", batchSize: 100 },
    { targetRegionId: "ap-south", batchSize: 50 },
    { targetRegionId: "us-west", batchSize: 75 },
  ]);

  const replications = coordinator.getRegionReplications("us-east");
  assert.equal(replications.length, 3);

  const cdcService = coordinator.getCDCService();
  assert.ok(cdcService.isEnabled("us-east", "eu-west"));
  assert.ok(cdcService.isEnabled("us-east", "ap-south"));
  assert.ok(cdcService.isEnabled("us-east", "us-west"));
});

test("CDCReplicationService getConfig returns undefined for unregistered pair [cdc-replication]", () => {
  const service = new CDCReplicationService();

  const config = service.getConfig("us-east", "eu-west");
  assert.equal(config, undefined);
});

test("CDCReplicationService getCheckpoint returns undefined for unregistered pair [cdc-replication]", () => {
  const service = new CDCReplicationService();

  const checkpoint = service.getCheckpoint("us-east", "eu-west");
  assert.equal(checkpoint, undefined);
});