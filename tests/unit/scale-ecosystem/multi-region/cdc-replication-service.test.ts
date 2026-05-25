import test from "node:test";
import assert from "node:assert/strict";
import {
  CDCReplicationService,
  MultiRegionReplicationCoordinator,
  type RegionReplicationConfig,
  type CDCReplicationBatch,
} from "../../../../src/scale-ecosystem/multi-region/cdc-replication-service.js";

test("CDCReplicationService registers and retrieves replication config", () => {
  const service = new CDCReplicationService();

  const config: RegionReplicationConfig = {
    sourceRegionId: "us-east",
    targetRegionId: "eu-west",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  };

  service.registerReplication(config);

  const retrieved = service.getConfig("us-east", "eu-west");
  assert.ok(retrieved !== undefined);
  assert.equal(retrieved?.sourceRegionId, "us-east");
  assert.equal(retrieved?.targetRegionId, "eu-west");
  assert.equal(retrieved?.batchSize, 100);
});

test("CDCReplicationService initializes checkpoint on registration", () => {
  const service = new CDCReplicationService();

  const config: RegionReplicationConfig = {
    sourceRegionId: "us-east",
    targetRegionId: "eu-west",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  };

  service.registerReplication(config);

  const checkpoint = service.getCheckpoint("us-east", "eu-west");
  assert.ok(checkpoint !== undefined);
  assert.equal(checkpoint?.sourceRegionId, "us-east");
  assert.equal(checkpoint?.targetRegionId, "eu-west");
  assert.equal(checkpoint?.lastEventSequence, 0);
});

test("CDCReplicationService prepares batch from events", () => {
  const service = new CDCReplicationService();

  const config: RegionReplicationConfig = {
    sourceRegionId: "us-east",
    targetRegionId: "eu-west",
    batchSize: 2,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  };

  service.registerReplication(config);

  const events = [
    { id: "evt_1", sequence: 1, eventType: "task:created", taskId: "task_1", payloadJson: "{}", createdAt: "2024-01-01T00:00:00Z" },
    { id: "evt_2", sequence: 2, eventType: "task:updated", taskId: "task_1", payloadJson: "{}", createdAt: "2024-01-01T00:01:00Z" },
    { id: "evt_3", sequence: 3, eventType: "task:completed", taskId: "task_1", payloadJson: "{}", createdAt: "2024-01-01T00:02:00Z" },
  ] as any;

  const batch = service.prepareBatch("us-east", "eu-west", events);

  assert.ok(batch !== null);
  assert.equal(batch!.events.length, 2); // batch size is 2
  assert.equal(batch!.startSequence, 1);
  assert.equal(batch!.endSequence, 2);
});

test("CDCReplicationService confirms batch and updates checkpoint", () => {
  const service = new CDCReplicationService();

  const config: RegionReplicationConfig = {
    sourceRegionId: "us-east",
    targetRegionId: "eu-west",
    batchSize: 2,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  };

  service.registerReplication(config);

  const events = [
    { id: "evt_1", sequence: 1, eventType: "task:created", taskId: "task_1", payloadJson: "{}", createdAt: "2024-01-01T00:00:00Z" },
    { id: "evt_2", sequence: 2, eventType: "task:updated", taskId: "task_1", payloadJson: "{}", createdAt: "2024-01-01T00:01:00Z" },
  ] as any;

  const batch = service.prepareBatch("us-east", "eu-west", events);
  assert.ok(batch !== null);

  service.confirmBatch("us-east", "eu-west", batch);

  const checkpoint = service.getCheckpoint("us-east", "eu-west");
  assert.equal(checkpoint?.lastEventSequence, 2);
  assert.equal(checkpoint?.lastEventId, "evt_2");
});

test("CDCReplicationService returns null when no new events", () => {
  const service = new CDCReplicationService();

  const config: RegionReplicationConfig = {
    sourceRegionId: "us-east",
    targetRegionId: "eu-west",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  };

  service.registerReplication(config);

  const events = [
    { id: "evt_1", sequence: 1, eventType: "task:created", taskId: "task_1", payloadJson: "{}", createdAt: "2024-01-01T00:00:00Z" },
  ] as any;

  // First batch
  const batch1 = service.prepareBatch("us-east", "eu-west", events);
  assert.ok(batch1 !== null);

  // Confirm it
  service.confirmBatch("us-east", "eu-west", batch1);

  // Second batch should be null (no new events after checkpoint)
  const batch2 = service.prepareBatch("us-east", "eu-west", events);
  assert.equal(batch2, null);
});

test("CDCReplicationService does not enqueue a second batch while one is already pending", () => {
  const service = new CDCReplicationService();
  service.registerReplication({
    sourceRegionId: "us-east",
    targetRegionId: "eu-west",
    batchSize: 2,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  });

  const events = [
    { id: "evt_1", sequence: 1, eventType: "task:created", taskId: "task_1", payloadJson: "{}", createdAt: "2024-01-01T00:00:00Z" },
    { id: "evt_2", sequence: 2, eventType: "task:updated", taskId: "task_1", payloadJson: "{}", createdAt: "2024-01-01T00:01:00Z" },
    { id: "evt_3", sequence: 3, eventType: "task:completed", taskId: "task_1", payloadJson: "{}", createdAt: "2024-01-01T00:02:00Z" },
  ] as any;

  const firstBatch = service.prepareBatch("us-east", "eu-west", events);
  const secondBatch = service.prepareBatch("us-east", "eu-west", events);

  assert.ok(firstBatch != null);
  assert.equal(secondBatch, null);
});

test("CDCReplicationService isEnabled returns correct value", () => {
  const service = new CDCReplicationService();

  const enabledConfig: RegionReplicationConfig = {
    sourceRegionId: "us-east",
    targetRegionId: "eu-west",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  };

  service.registerReplication(enabledConfig);

  assert.equal(service.isEnabled("us-east", "eu-west"), true);
  assert.equal(service.isEnabled("us-east", "ap-south"), false); // Not registered
});

test("CDCReplicationService calculates replication lag", () => {
  const service = new CDCReplicationService();

  const config: RegionReplicationConfig = {
    sourceRegionId: "us-east",
    targetRegionId: "eu-west",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  };

  service.registerReplication(config);

  // 100 events in source, 0 processed = lag of 100
  const lag = service.getReplicationLag("us-east", "eu-west", 100);
  assert.equal(lag, 100);

  // Process half
  const events = Array.from({ length: 50 }, (_, i) => ({
    id: `evt_${i}`,
    sequence: i + 1,
    eventType: "task:created",
    taskId: "task_1",
    payloadJson: "{}",
    createdAt: "2024-01-01T00:00:00Z",
  })) as any;

  const batch = service.prepareBatch("us-east", "eu-west", events);
  if (batch) {
    service.confirmBatch("us-east", "eu-west", batch);
  }

  const lagAfter = service.getReplicationLag("us-east", "eu-west", 100);
  assert.equal(lagAfter, 50);
});

test("MultiRegionReplicationCoordinator sets up region replications", () => {
  const coordinator = new MultiRegionReplicationCoordinator();

  coordinator.setupRegionReplication("us-east", [
    { targetRegionId: "eu-west", batchSize: 100 },
    { targetRegionId: "ap-south", batchSize: 50 },
  ]);

  const replications = coordinator.getRegionReplications("us-east");
  assert.equal(replications.length, 2);
  assert.ok(replications.some((r) => r.targetRegionId === "eu-west"));
  assert.ok(replications.some((r) => r.targetRegionId === "ap-south"));
});

test("CDCReplicationService getRegisteredRegionPairs", () => {
  const service = new CDCReplicationService();

  service.registerReplication({
    sourceRegionId: "us-east",
    targetRegionId: "eu-west",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  });

  service.registerReplication({
    sourceRegionId: "us-east",
    targetRegionId: "ap-south",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  });

  const pairs = service.getRegisteredRegionPairs();
  assert.equal(pairs.length, 2);
});

test("CDCReplicationService returns idle status when no pending work", () => {
  const service = new CDCReplicationService();

  service.registerReplication({
    sourceRegionId: "us-east",
    targetRegionId: "eu-west",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  });

  const status = service.getStatus("us-east", "eu-west");
  assert.equal(status, "idle");
});
