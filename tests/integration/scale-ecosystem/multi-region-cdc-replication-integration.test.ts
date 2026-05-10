/**
 * Multi-region CDC Replication Integration Tests
 *
 * Tests end-to-end CDC replication scenarios including:
 * - Full replication cycle (prepare -> replicate -> confirm)
 * - Conflict resolution across multiple regions
 * - Failover and recovery scenarios
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  CDCReplicationService,
  MultiRegionReplicationCoordinator,
  type CDCReplicationEvent,
  type CDCReplicationBatch,
  type RegionReplicationConfig,
} from "../../../src/scale-ecosystem/multi-region/cdc-replication-service.js";
import {
  DataReplicatorService,
  createDataReplicator,
} from "../../../src/scale-ecosystem/multi-region/data-replicator/index.js";
import {
  RegionHealthCheckService,
  RegionFailoverOrchestrator,
} from "../../../src/scale-ecosystem/multi-region/region-health-check-service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Full Replication Cycle Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("integration: full CDC replication cycle - prepare, replicate, confirm", () => {
  const cdcService = new CDCReplicationService();

  // Register replication pair
  cdcService.registerReplication({
    sourceRegionId: "us-east-1",
    targetRegionId: "us-west-2",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  });

  // Prepare events to replicate
  const events: CDCReplicationEvent[] = [
    {
      id: "evt-1",
      sequence: 1,
      eventType: "task.created",
      taskId: "task-1",
      payloadJson: '{"status":"created"}',
      createdAt: "2026-04-20T00:00:00.000Z",
    },
    {
      id: "evt-2",
      sequence: 2,
      eventType: "task.started",
      taskId: "task-1",
      payloadJson: '{"status":"started"}',
      createdAt: "2026-04-20T00:00:01.000Z",
    },
  ];

  // Prepare batch
  const batch = cdcService.prepareBatch("us-east-1", "us-west-2", events);
  assert.ok(batch !== null);
  assert.equal(batch!.events.length, 2);
  assert.equal(batch!.sourceRegionId, "us-east-1");
  assert.equal(batch!.targetRegionId, "us-west-2");

  // Confirm batch replication
  cdcService.confirmBatch("us-east-1", "us-west-2", batch!);

  // Verify checkpoint advanced
  const checkpoint = cdcService.getCheckpoint("us-east-1", "us-west-2");
  assert.ok(checkpoint !== null);
  assert.equal(checkpoint!.lastEventSequence, 2);
  assert.equal(checkpoint!.lastEventId, "evt-2");

  // Verify status is idle (no pending work)
  const status = cdcService.getStatus("us-east-1", "us-west-2");
  assert.equal(status, "idle");
});

test("integration: CDC replication with multiple region pairs", () => {
  const cdcService = new CDCReplicationService();

  // Set up hub-and-spoke topology: us-east-1 replicates to multiple regions
  const coordinator = new MultiRegionReplicationCoordinator(cdcService);
  coordinator.setupRegionReplication("us-east-1", [
    { targetRegionId: "us-west-2" },
    { targetRegionId: "eu-west-1" },
    { targetRegionId: "ap-southeast-1" },
  ]);

  const events: CDCReplicationEvent[] = [
    {
      id: "evt-global-1",
      sequence: 1,
      eventType: "task.created",
      taskId: "task-global",
      payloadJson: "{}",
      createdAt: "2026-04-20T00:00:00.000Z",
    },
  ];

  // Prepare batches for each target
  const batchUS = cdcService.prepareBatch("us-east-1", "us-west-2", events);
  const batchEU = cdcService.prepareBatch("us-east-1", "eu-west-1", events);
  const batchAP = cdcService.prepareBatch("us-east-1", "ap-southeast-1", events);

  assert.ok(batchUS !== null);
  assert.ok(batchEU !== null);
  assert.ok(batchAP !== null);

  // Verify all batches have same events but different batch IDs
  assert.notEqual(batchUS!.batchId, batchEU!.batchId);
  assert.notEqual(batchEU!.batchId, batchAP!.batchId);

  // Confirm all
  cdcService.confirmBatch("us-east-1", "us-west-2", batchUS!);
  cdcService.confirmBatch("us-east-1", "eu-west-1", batchEU!);
  cdcService.confirmBatch("us-east-1", "ap-southeast-1", batchAP!);

  // Get all registered pairs
  const pairs = cdcService.getRegisteredRegionPairs();
  assert.equal(pairs.length, 3);
});

test("integration: CDC replication batch size limiting", () => {
  const cdcService = new CDCReplicationService();

  cdcService.registerReplication({
    sourceRegionId: "us-east-1",
    targetRegionId: "us-west-2",
    batchSize: 2, // Small batch size
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  });

  // Create 5 events
  const events: CDCReplicationEvent[] = [
    { id: "evt-1", sequence: 1, eventType: "task", taskId: "task-1", payloadJson: "{}", createdAt: "2026-04-20T00:00:00.000Z" },
    { id: "evt-2", sequence: 2, eventType: "task", taskId: "task-1", payloadJson: "{}", createdAt: "2026-04-20T00:00:00.000Z" },
    { id: "evt-3", sequence: 3, eventType: "task", taskId: "task-1", payloadJson: "{}", createdAt: "2026-04-20T00:00:00.000Z" },
    { id: "evt-4", sequence: 4, eventType: "task", taskId: "task-1", payloadJson: "{}", createdAt: "2026-04-20T00:00:00.000Z" },
    { id: "evt-5", sequence: 5, eventType: "task", taskId: "task-1", payloadJson: "{}", createdAt: "2026-04-20T00:00:00.000Z" },
  ];

  // First batch should have only 2 events
  const batch1 = cdcService.prepareBatch("us-east-1", "us-west-2", events);
  assert.ok(batch1 !== null);
  assert.equal(batch1!.events.length, 2);
  assert.equal(batch1!.startSequence, 1);
  assert.equal(batch1!.endSequence, 2);

  // Confirm first batch
  cdcService.confirmBatch("us-east-1", "us-west-2", batch1!);

  // Second batch should have next 2 events
  const batch2 = cdcService.prepareBatch("us-east-1", "us-west-2", events);
  assert.ok(batch2 !== null);
  assert.equal(batch2!.events.length, 2);
  assert.equal(batch2!.startSequence, 3);
  assert.equal(batch2!.endSequence, 4);

  // Confirm second batch
  cdcService.confirmBatch("us-east-1", "us-west-2", batch2!);

  // Third batch should have last event
  const batch3 = cdcService.prepareBatch("us-east-1", "us-west-2", events);
  assert.ok(batch3 !== null);
  assert.equal(batch3!.events.length, 1);
  assert.equal(batch3!.startSequence, 5);
  assert.equal(batch3!.endSequence, 5);
});

test("integration: CDC replication incremental catch-up", () => {
  const cdcService = new CDCReplicationService();

  cdcService.registerReplication({
    sourceRegionId: "us-east-1",
    targetRegionId: "us-west-2",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  });

  // Initial events
  const events1: CDCReplicationEvent[] = [
    { id: "evt-1", sequence: 1, eventType: "task", taskId: "task-1", payloadJson: "{}", createdAt: "2026-04-20T00:00:00.000Z" },
  ];

  const batch1 = cdcService.prepareBatch("us-east-1", "us-west-2", events1);
  cdcService.confirmBatch("us-east-1", "us-west-2", batch1!);

  // Checkpoint now at sequence 1
  let checkpoint = cdcService.getCheckpoint("us-east-1", "us-west-2");
  assert.equal(checkpoint!.lastEventSequence, 1);

  // New events come in
  const events2: CDCReplicationEvent[] = [
    { id: "evt-2", sequence: 2, eventType: "task", taskId: "task-1", payloadJson: "{}", createdAt: "2026-04-20T00:00:01.000Z" },
    { id: "evt-3", sequence: 3, eventType: "task", taskId: "task-1", payloadJson: "{}", createdAt: "2026-04-20T00:00:02.000Z" },
  ];

  // Passing old events + new events should only replicate new ones
  const allEvents = [...events1, ...events2];
  const batch2 = cdcService.prepareBatch("us-east-1", "us-west-2", allEvents);

  assert.ok(batch2 !== null);
  assert.equal(batch2!.events.length, 2);
  assert.equal(batch2!.startSequence, 2);
  assert.equal(batch2!.endSequence, 3);
});

// ─────────────────────────────────────────────────────────────────────────────
// Conflict Resolution Integration Tests
// ─────────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────────
// Data Replicator + CDC Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("integration: DataReplicator flush returns success with no errors", async () => {
  const replicator = new DataReplicatorService({
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2"],
    policy: { sourceRegionId: "us-east-1", targetRegionIds: ["us-west-2"], residencyMode: "allowed_cross_border" },
    batchSize: 10,
    flushIntervalMs: 5000,
    retryAttempts: 3,
    checksumAlgorithm: "sha256",
  });

  replicator.recordEvent("us-west-2", "Task", "task-1", { status: "completed" });

  const result = await replicator.flush("us-west-2");

  assert.equal(result.success, true);
  assert.ok(result.eventsReplicated >= 1);
  assert.equal(result.errors.length, 0);
});

test("integration: DataReplicator tracks checkpoints after flush", async () => {
  const replicator = new DataReplicatorService({
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2"],
    policy: { sourceRegionId: "us-east-1", targetRegionIds: ["us-west-2"], residencyMode: "allowed_cross_border" },
    batchSize: 10,
    flushIntervalMs: 5000,
    retryAttempts: 3,
    checksumAlgorithm: "sha256",
  });

  replicator.recordEvent("us-west-2", "Task", "task-1", { data: "test1" });
  replicator.recordEvent("us-west-2", "Task", "task-2", { data: "test2" });

  await replicator.flush("us-west-2");

  const checkpoint = replicator.getCheckpoint("us-west-2");
  assert.ok(checkpoint !== null);
  assert.equal(checkpoint!.sourceRegionId, "us-east-1");
  assert.equal(checkpoint!.targetRegionId, "us-west-2");
  assert.ok(checkpoint!.sequenceNumber >= 0);
});

test("integration: CDC + DataReplicator cross-region workflow", () => {
  // CDC Replication Service manages ordering and checkpoints
  const cdcService = new CDCReplicationService();

  cdcService.registerReplication({
    sourceRegionId: "us-east-1",
    targetRegionId: "us-west-2",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  });

  // Data Replicator handles actual data transfer with checksum validation
  const dataReplicator = createDataReplicator(
    "us-east-1",
    ["us-west-2"],
    { sourceRegionId: "us-east-1", targetRegionIds: ["us-west-2"], residencyMode: "allowed_cross_border" },
  );

  // Simulate CDC preparing a batch
  const events: CDCReplicationEvent[] = [
    { id: "evt-1", sequence: 1, eventType: "task", taskId: "task-1", payloadJson: '{"data":"test"}', createdAt: "2026-04-20T00:00:00.000Z" },
  ];

  const batch = cdcService.prepareBatch("us-east-1", "us-west-2", events);
  assert.ok(batch !== null);

  // Data replicator records the events
  for (const event of batch!.events) {
    const payload = JSON.parse(event.payloadJson);
    dataReplicator.recordEvent("us-west-2", "Task", event.taskId, payload);
  }

  // Verify event is in buffer
  const buffer = dataReplicator.getBuffer("us-west-2");
  assert.ok(buffer !== null);
  assert.equal(buffer!.size(), 1);
});

test("integration: RegionFailoverOrchestrator selects healthiest region", async () => {
  const healthService = new RegionHealthCheckService();
  const orchestrator = new RegionFailoverOrchestrator(healthService);

  // Register regions with different health profiles
  healthService.registerRegion({
    regionId: "us-east-1",
    endpoint: "https://us-east-1.example.com/health",
    checkIntervalMs: 30000,
    timeoutMs: 5000,
    retryCount: 3,
    thresholds: {
      maxLatencyMs: 200,
      maxErrorRate: 0.05,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.85,
    },
    metricSnapshot: { latencyMs: 100, errorRate: 0.01, cpuUsage: 0.5, memoryUsage: 0.6 },
  });

  healthService.registerRegion({
    regionId: "us-west-2",
    endpoint: "https://us-west-2.example.com/health",
    checkIntervalMs: 30000,
    timeoutMs: 5000,
    retryCount: 3,
    thresholds: {
      maxLatencyMs: 200,
      maxErrorRate: 0.05,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.85,
    },
    metricSnapshot: { latencyMs: 50, errorRate: 0.001, cpuUsage: 0.3, memoryUsage: 0.4 }, // Healthier
  });

  // Perform health checks
  await healthService.checkAllRegions();

  // Select failover target
  const target = orchestrator.selectFailoverTarget("us-east-1", ["us-east-1", "us-west-2"]);

  assert.equal(target, "us-west-2"); // Lower latency region should be selected
});

test("integration: Multi-region replication coordinator setup", () => {
  const coordinator = new MultiRegionReplicationCoordinator();

  // Set up multi-region replication topology
  coordinator.setupRegionReplication("us-east-1", [
    { targetRegionId: "us-west-2", batchSize: 100, intervalMs: 5000 },
    { targetRegionId: "eu-west-1", batchSize: 50, intervalMs: 10000 },
    { targetRegionId: "ap-southeast-1", batchSize: 75, intervalMs: 7500 },
  ]);

  const replications = coordinator.getRegionReplications("us-east-1");

  assert.equal(replications.length, 3);

  // Verify each target has correct configuration
  const usWest = replications.find((r) => r.targetRegionId === "us-west-2");
  assert.ok(usWest !== undefined);
  assert.equal(usWest!.batchSize, 100);
  assert.equal(usWest!.replicationIntervalMs, 5000);

  const euWest = replications.find((r) => r.targetRegionId === "eu-west-1");
  assert.ok(euWest !== undefined);
  assert.equal(euWest!.batchSize, 50);
  assert.equal(euWest!.replicationIntervalMs, 10000);
});

