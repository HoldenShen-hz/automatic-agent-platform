import assert from "node:assert/strict";
import test from "node:test";

import {
  CDCReplicationService,
  MultiRegionReplicationCoordinator,
  type CDCReplicationEvent,
  type RegionReplicationConfig,
} from "../../../src/scale-ecosystem/multi-region/cdc-replication-service.js";

test("cdc replication service registers and retrieves replication config", () => {
  const service = new CDCReplicationService();

  const config: RegionReplicationConfig = {
    sourceRegionId: "us-east-1",
    targetRegionId: "eu-west-1",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  };

  service.registerReplication(config);

  const retrieved = service.getConfig("us-east-1", "eu-west-1");
  assert.ok(retrieved);
  assert.equal(retrieved?.sourceRegionId, "us-east-1");
  assert.equal(retrieved?.targetRegionId, "eu-west-1");
  assert.equal(retrieved?.enabled, true);
});

test("cdc replication service initializes checkpoint on registration", () => {
  const service = new CDCReplicationService();

  const config: RegionReplicationConfig = {
    sourceRegionId: "us-east-1",
    targetRegionId: "ap-south-1",
    batchSize: 50,
    replicationIntervalMs: 3000,
    enabled: true,
    retryPolicy: { maxRetries: 2, backoffMs: 500 },
  };

  service.registerReplication(config);

  const checkpoint = service.getCheckpoint("us-east-1", "ap-south-1");
  assert.ok(checkpoint);
  assert.equal(checkpoint?.sourceRegionId, "us-east-1");
  assert.equal(checkpoint?.targetRegionId, "ap-south-1");
  assert.equal(checkpoint?.lastEventId, null);
  assert.equal(checkpoint?.lastEventSequence, 0);
});

test("cdc replication service prepares batch from source events after checkpoint", () => {
  const service = new CDCReplicationService();

  const config: RegionReplicationConfig = {
    sourceRegionId: "us-east-1",
    targetRegionId: "us-west-2",
    batchSize: 10,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  };
  service.registerReplication(config);

  const events: CDCReplicationEvent[] = [
    { id: "evt_001", sequence: 1, eventType: "task.created", taskId: "task_1", payloadJson: "{}", createdAt: "2026-04-20T10:00:00.000Z" },
    { id: "evt_002", sequence: 2, eventType: "task.started", taskId: "task_1", payloadJson: "{}", createdAt: "2026-04-20T10:01:00.000Z" },
    { id: "evt_003", sequence: 3, eventType: "task.completed", taskId: "task_1", payloadJson: "{}", createdAt: "2026-04-20T10:02:00.000Z" },
  ];

  const batch = service.prepareBatch("us-east-1", "us-west-2", events);

  assert.ok(batch);
  assert.equal(batch.sourceRegionId, "us-east-1");
  assert.equal(batch.targetRegionId, "us-west-2");
  assert.equal(batch.events.length, 3);
  assert.equal(batch.startSequence, 1);
  assert.equal(batch.endSequence, 3);
});

test("cdc replication service skips already replicated events when preparing batch", () => {
  const service = new CDCReplicationService();

  const config: RegionReplicationConfig = {
    sourceRegionId: "us-east-1",
    targetRegionId: "eu-west-1",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  };
  service.registerReplication(config);

  // Confirm a batch to advance checkpoint
  const events: CDCReplicationEvent[] = [
    { id: "evt_001", sequence: 1, eventType: "task.created", taskId: "task_1", payloadJson: "{}", createdAt: "2026-04-20T10:00:00.000Z" },
    { id: "evt_002", sequence: 2, eventType: "task.started", taskId: "task_1", payloadJson: "{}", createdAt: "2026-04-20T10:01:00.000Z" },
    { id: "evt_003", sequence: 3, eventType: "task.completed", taskId: "task_1", payloadJson: "{}", createdAt: "2026-04-20T10:02:00.000Z" },
  ];

  const firstBatch = service.prepareBatch("us-east-1", "eu-west-1", events);
  assert.ok(firstBatch);
  service.confirmBatch("us-east-1", "eu-west-1", firstBatch);

  // New events with sequences 4-6
  const newEvents: CDCReplicationEvent[] = [
    { id: "evt_004", sequence: 4, eventType: "task.created", taskId: "task_2", payloadJson: "{}", createdAt: "2026-04-20T11:00:00.000Z" },
    { id: "evt_005", sequence: 5, eventType: "task.started", taskId: "task_2", payloadJson: "{}", createdAt: "2026-04-20T11:01:00.000Z" },
    { id: "evt_006", sequence: 6, eventType: "task.completed", taskId: "task_2", payloadJson: "{}", createdAt: "2026-04-20T11:02:00.000Z" },
  ];

  const secondBatch = service.prepareBatch("us-east-1", "eu-west-1", newEvents);

  assert.ok(secondBatch);
  assert.equal(secondBatch.events.length, 3);
  assert.equal(secondBatch.startSequence, 4);
  assert.equal(secondBatch.endSequence, 6);
});

test("cdc replication service confirms batch and updates checkpoint", () => {
  const service = new CDCReplicationService();

  const config: RegionReplicationConfig = {
    sourceRegionId: "us-east-1",
    targetRegionId: "ap-south-1",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  };
  service.registerReplication(config);

  const events: CDCReplicationEvent[] = [
    { id: "evt_001", sequence: 1, eventType: "task.created", taskId: "task_1", payloadJson: "{}", createdAt: "2026-04-20T10:00:00.000Z" },
    { id: "evt_002", sequence: 2, eventType: "task.started", taskId: "task_1", payloadJson: "{}", createdAt: "2026-04-20T10:01:00.000Z" },
  ];

  const batch = service.prepareBatch("us-east-1", "ap-south-1", events);
  assert.ok(batch);

  service.confirmBatch("us-east-1", "ap-south-1", batch);

  const checkpoint = service.getCheckpoint("us-east-1", "ap-south-1");
  assert.ok(checkpoint);
  assert.equal(checkpoint.lastEventSequence, 2);
  assert.equal(checkpoint.lastEventId, "evt_002");
});

test("cdc replication service returns null when no new events after checkpoint", () => {
  const service = new CDCReplicationService();

  const config: RegionReplicationConfig = {
    sourceRegionId: "us-east-1",
    targetRegionId: "ca-central-1",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  };
  service.registerReplication(config);

  // Confirm a batch first
  const events: CDCReplicationEvent[] = [
    { id: "evt_001", sequence: 1, eventType: "task.created", taskId: "task_1", payloadJson: "{}", createdAt: "2026-04-20T10:00:00.000Z" },
  ];

  const batch = service.prepareBatch("us-east-1", "ca-central-1", events);
  assert.ok(batch);
  service.confirmBatch("us-east-1", "ca-central-1", batch);

  // Try to prepare another batch with the same events (already replicated)
  const secondBatch = service.prepareBatch("us-east-1", "ca-central-1", events);

  assert.equal(secondBatch, null);
});

test("cdc replication service reports idle status when no pending batches", () => {
  const service = new CDCReplicationService();

  const config: RegionReplicationConfig = {
    sourceRegionId: "us-east-1",
    targetRegionId: "us-west-1",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  };
  service.registerReplication(config);

  const status = service.getStatus("us-east-1", "us-west-1");
  assert.equal(status, "idle");
});

test("cdc replication service reports syncing status with pending batches", () => {
  const service = new CDCReplicationService();

  const config: RegionReplicationConfig = {
    sourceRegionId: "us-east-1",
    targetRegionId: "eu-west-1",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  };
  service.registerReplication(config);

  const events: CDCReplicationEvent[] = [
    { id: "evt_001", sequence: 1, eventType: "task.created", taskId: "task_1", payloadJson: "{}", createdAt: "2026-04-20T10:00:00.000Z" },
  ];

  service.prepareBatch("us-east-1", "eu-west-1", events);

  const status = service.getStatus("us-east-1", "eu-west-1");
  assert.equal(status, "syncing");
});

test("cdc replication service calculates replication lag correctly", () => {
  const service = new CDCReplicationService();

  const config: RegionReplicationConfig = {
    sourceRegionId: "us-east-1",
    targetRegionId: "ap-northeast-1",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  };
  service.registerReplication(config);

  const events: CDCReplicationEvent[] = [
    { id: "evt_001", sequence: 1, eventType: "task.created", taskId: "task_1", payloadJson: "{}", createdAt: "2026-04-20T10:00:00.000Z" },
    { id: "evt_002", sequence: 2, eventType: "task.started", taskId: "task_1", payloadJson: "{}", createdAt: "2026-04-20T10:01:00.000Z" },
    { id: "evt_003", sequence: 3, eventType: "task.completed", taskId: "task_1", payloadJson: "{}", createdAt: "2026-04-20T10:02:00.000Z" },
  ];

  const batch = service.prepareBatch("us-east-1", "ap-northeast-1", events);
  assert.ok(batch);
  service.confirmBatch("us-east-1", "ap-northeast-1", batch);

  const totalEvents = 10;
  const lag = service.getReplicationLag("us-east-1", "ap-northeast-1", totalEvents);
  assert.equal(lag, 7);
});

test("cdc replication service returns full lag when no checkpoint exists", () => {
  const service = new CDCReplicationService();

  const totalEvents = 15;
  const lag = service.getReplicationLag("us-east-1", "eu-west-1", totalEvents);
  assert.equal(lag, 15);
});

test("cdc replication service checks if replication is enabled", () => {
  const service = new CDCReplicationService();

  const config: RegionReplicationConfig = {
    sourceRegionId: "us-east-1",
    targetRegionId: "us-west-2",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  };
  service.registerReplication(config);

  assert.equal(service.isEnabled("us-east-1", "us-west-2"), true);
  assert.equal(service.isEnabled("us-east-1", "eu-west-1"), false);
});

test("cdc replication service returns registered region pairs", () => {
  const service = new CDCReplicationService();

  service.registerReplication({
    sourceRegionId: "us-east-1",
    targetRegionId: "us-west-2",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  });

  service.registerReplication({
    sourceRegionId: "us-east-1",
    targetRegionId: "eu-west-1",
    batchSize: 50,
    replicationIntervalMs: 3000,
    enabled: true,
    retryPolicy: { maxRetries: 2, backoffMs: 500 },
  });

  const pairs = service.getRegisteredRegionPairs();
  assert.equal(pairs.length, 2);
  assert.ok(pairs.some((p: { sourceRegionId: string; targetRegionId: string }) => p.sourceRegionId === "us-east-1" && p.targetRegionId === "us-west-2"));
  assert.ok(pairs.some((p: { sourceRegionId: string; targetRegionId: string }) => p.sourceRegionId === "us-east-1" && p.targetRegionId === "eu-west-1"));
});

test("multi region replication coordinator sets up region with multiple targets", () => {
  const coordinator = new MultiRegionReplicationCoordinator();

  coordinator.setupRegionReplication("us-east-1", [
    { targetRegionId: "us-west-2", batchSize: 100, intervalMs: 5000 },
    { targetRegionId: "eu-west-1", batchSize: 50, intervalMs: 3000 },
    { targetRegionId: "ap-south-1", batchSize: 75, intervalMs: 4000 },
  ]);

  const replications = coordinator.getRegionReplications("us-east-1");
  assert.equal(replications.length, 3);
  assert.ok(replications.some((r: RegionReplicationConfig) => r.targetRegionId === "us-west-2"));
  assert.ok(replications.some((r: RegionReplicationConfig) => r.targetRegionId === "eu-west-1"));
  assert.ok(replications.some((r: RegionReplicationConfig) => r.targetRegionId === "ap-south-1"));
});

test("multi region replication coordinator uses default batch size and interval", () => {
  const coordinator = new MultiRegionReplicationCoordinator();

  coordinator.setupRegionReplication("us-east-1", [
    { targetRegionId: "us-west-2" },
  ]);

  const replications = coordinator.getRegionReplications("us-east-1");
  assert.equal(replications.length, 1);
  assert.equal(replications[0]!.batchSize, 100);
  assert.equal(replications[0]!.replicationIntervalMs, 5000);
});
