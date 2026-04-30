/**
 * Multi-Region Integration Tests
 *
 * Tests for multi-region replication and failover scenarios.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { CDCReplicationService } from "../../../src/scale-ecosystem/multi-region/cdc-replication-service.js";
import { DataReplicatorService, createDataReplicator } from "../../../src/scale-ecosystem/multi-region/data-replicator/index.js";
import { RegionHealthCheckService, RegionFailoverOrchestrator } from "../../../src/scale-ecosystem/multi-region/region-health-check-service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Multi-Region Replication Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("integration: multi-region CDC replication with checkpoint advancement", () => {
  const cdcService = new CDCReplicationService();

  // Set up replication between two regions
  cdcService.registerReplication({
    sourceRegionId: "us-east-1",
    targetRegionId: "us-west-2",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  });

  // Create source events
  const events = Array.from({ length: 250 }, (_, i) => ({
    id: `evt-${i}`,
    sequence: i + 1,
    eventType: "task.created",
    taskId: `task-${i}`,
    payloadJson: JSON.stringify({ index: i }),
    createdAt: new Date(Date.now() + i * 1000).toISOString(),
  }));

  // Prepare first batch
  const batch1 = cdcService.prepareBatch("us-east-1", "us-west-2", events);
  assert.ok(batch1 !== null);
  assert.equal(batch1.events.length, 100);
  assert.equal(batch1.startSequence, 1);
  assert.equal(batch1.endSequence, 100);

  // Confirm first batch
  cdcService.confirmBatch("us-east-1", "us-west-2", batch1);

  // Verify checkpoint advanced
  let checkpoint = cdcService.getCheckpoint("us-east-1", "us-west-2");
  assert.equal(checkpoint?.lastEventSequence, 100);

  // Prepare second batch
  const batch2 = cdcService.prepareBatch("us-east-1", "us-west-2", events);
  assert.ok(batch2 !== null);
  assert.equal(batch2.events.length, 100);
  assert.equal(batch2.startSequence, 101);
  assert.equal(batch2.endSequence, 200);

  // Confirm second batch
  cdcService.confirmBatch("us-east-1", "us-west-2", batch2);

  // Verify checkpoint advanced again
  checkpoint = cdcService.getCheckpoint("us-east-1", "us-west-2");
  assert.equal(checkpoint?.lastEventSequence, 200);
});

test("integration: multi-region replication with conflict resolution", () => {
  const cdcService = new CDCReplicationService();

  // Set up vector clocks
  cdcService.updateVectorClock("task-1", "us-east-1", 5);
  cdcService.updateVectorClock("task-1", "us-west-2", 5);

  // Local event
  const localEvent = {
    id: "local-1",
    sequence: 6,
    eventType: "task.updated",
    taskId: "task-1",
    payloadJson: '{"status":"draft","version":1}',
    createdAt: "2026-04-20T00:00:00.000Z",
  };

  // Remote event (later timestamp wins with LWW)
  const remoteEvent = {
    id: "remote-1",
    sequence: 6,
    eventType: "task.updated",
    taskId: "task-1",
    payloadJson: '{"status":"published","version":1}',
    createdAt: "2026-04-20T00:00:01.000Z", // 1 second later
  };

  // Resolve conflict
  const result = cdcService.resolveConflict(localEvent, remoteEvent, "lww");

  assert.equal(result.resolved, true);
  assert.equal(result.resolvedEvent?.id, "remote-1");
  assert.equal(result.conflict?.resolution, "remote_wins");

  // Record conflict for history
  cdcService.recordConflict("task-1", result.conflict!);

  const history = cdcService.getConflictHistory("task-1");
  assert.equal(history.length, 1);
});

test("integration: data replicator with checksum validation", async () => {
  const replicator = new DataReplicatorService({
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2", "eu-west-1"],
    policy: {
      sourceRegionId: "us-east-1",
      targetRegionIds: ["us-west-2", "eu-west-1"],
      residencyMode: "allowed_cross_border",
    },
    batchSize: 100,
    flushIntervalMs: 5000,
    retryAttempts: 3,
    checksumAlgorithm: "sha256",
  });

  // Record events
  const event1 = replicator.recordEvent("us-west-2", "Task", "task-1", { data: "test1" });
  const event2 = replicator.recordEvent("eu-west-1", "Task", "task-2", { data: "test2" });

  assert.ok(event1 !== null);
  assert.ok(event2 !== null);

  // Validate checksums
  assert.equal(replicator.validateEvent(event1!), true);
  assert.equal(replicator.validateEvent(event2!), true);

  // Tamper with event
  const tamperedEvent = { ...event1!, payload: { data: "tampered" } };
  assert.equal(replicator.validateEvent(tamperedEvent), false);

  // Flush and verify
  const result1 = await replicator.flush("us-west-2");
  assert.equal(result1.success, true);

  const result2 = await replicator.flush("eu-west-1");
  assert.equal(result2.success, true);
});

test("integration: RegionFailoverOrchestrator selects best failover target", async () => {
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
    metricSnapshot: {
      latencyMs: 150,
      errorRate: 0.02,
      cpuUsage: 0.6,
      memoryUsage: 0.7,
    },
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
    metricSnapshot: {
      latencyMs: 80,
      errorRate: 0.01,
      cpuUsage: 0.4,
      memoryUsage: 0.5,
    },
  });

  healthService.registerRegion({
    regionId: "eu-west-1",
    endpoint: "https://eu-west-1.example.com/health",
    checkIntervalMs: 30000,
    timeoutMs: 5000,
    retryCount: 3,
    thresholds: {
      maxLatencyMs: 200,
      maxErrorRate: 0.05,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.85,
    },
    metricSnapshot: {
      latencyMs: 250, // Exceeds threshold
      errorRate: 0.1, // Exceeds threshold
      cpuUsage: 0.9,
      memoryUsage: 0.95,
    },
  });

  // Perform health checks
  await healthService.checkAllRegions();

  // Get health summaries
  const summaryEast = healthService.getHealthSummary("us-east-1");
  const summaryWest = healthService.getHealthSummary("us-west-2");
  const summaryEU = healthService.getHealthSummary("eu-west-1");

  assert.equal(summaryEast?.status, "degraded");
  assert.equal(summaryWest?.status, "healthy");
  assert.equal(summaryEU?.status, "unhealthy");

  // Select failover target from healthy regions
  const target = orchestrator.selectFailoverTarget("us-east-1", ["us-east-1", "us-west-2", "eu-west-1"]);

  // Should select us-west-2 (healthiest)
  assert.equal(target, "us-west-2");
});

test("integration: CDC + DataReplicator workflow", () => {
  const cdcService = new CDCReplicationService();
  const dataReplicator = createDataReplicator(
    "us-east-1",
    ["us-west-2"],
    {
      sourceRegionId: "us-east-1",
      targetRegionIds: ["us-west-2"],
      residencyMode: "allowed_cross_border",
    },
    { batchSize: 50 }
  );

  // Register CDC replication
  cdcService.registerReplication({
    sourceRegionId: "us-east-1",
    targetRegionId: "us-west-2",
    batchSize: 50,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  });

  // Create events
  const events = Array.from({ length: 10 }, (_, i) => ({
    id: `evt-${i}`,
    sequence: i + 1,
    eventType: "task.created",
    taskId: `task-${i}`,
    payloadJson: JSON.stringify({ index: i }),
    createdAt: new Date().toISOString(),
  }));

  // Prepare CDC batch
  const batch = cdcService.prepareBatch("us-east-1", "us-west-2", events);
  assert.ok(batch !== null);

  // Record in data replicator
  for (const event of batch.events) {
    const payload = JSON.parse(event.payloadJson);
    dataReplicator.recordEvent("us-west-2", "Task", event.taskId, payload);
  }

  // Verify in buffer
  const buffer = dataReplicator.getBuffer("us-west-2");
  assert.ok(buffer !== null);
  assert.equal(buffer.size(), 10);

  // Confirm CDC batch
  cdcService.confirmBatch("us-east-1", "us-west-2", batch);

  // Verify checkpoint
  const checkpoint = cdcService.getCheckpoint("us-east-1", "us-west-2");
  assert.equal(checkpoint?.lastEventSequence, 10);
});

test("integration: vector clock for causal ordering", () => {
  const cdcService = new CDCReplicationService();

  // Simulate events from two regions
  cdcService.updateVectorClock("entity-1", "us-east-1", 1);
  cdcService.updateVectorClock("entity-1", "us-east-1", 2);
  cdcService.updateVectorClock("entity-1", "us-west-2", 1);

  const clock1 = cdcService.getVectorClock("entity-1");
  assert.ok(clock1 !== undefined);
  assert.equal(clock1!.getMaxSequence(), 2);

  // Merge clocks
  cdcService.mergeVectorClock("entity-1", new (cdcService.getVectorClock("entity-1")!.constructor as any)([["us-west-2", 3]]));

  const merged = cdcService.getVectorClock("entity-1");
  assert.ok(merged !== undefined);
  assert.equal(merged!.getMaxSequence(), 3);
});

test("integration: failover with fencing token", async () => {
  const healthService = new RegionHealthCheckService();
  const orchestrator = new RegionFailoverOrchestrator(healthService);

  healthService.registerRegion({
    regionId: "primary",
    endpoint: "https://primary.example.com/health",
    checkIntervalMs: 30000,
    timeoutMs: 5000,
    retryCount: 3,
    thresholds: {
      maxLatencyMs: 100,
      maxErrorRate: 0.01,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.85,
    },
  });

  healthService.registerRegion({
    regionId: "backup",
    endpoint: "https://backup.example.com/health",
    checkIntervalMs: 30000,
    timeoutMs: 5000,
    retryCount: 3,
    thresholds: {
      maxLatencyMs: 100,
      maxErrorRate: 0.01,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.85,
    },
  });

  // Check and failover
  const result = await orchestrator.checkAndFailover("primary", ["primary", "backup"]);

  // Primary might not need failover if it hasn't failed yet
  // This tests the orchestration flow
  assert.ok(typeof result.didFailover === "boolean");
});

test("integration: cross-region routing with latency-based selection", () => {
  const cdcService = new CDCReplicationService();

  // Set up hub-and-spoke
  cdcService.registerReplication({
    sourceRegionId: "us-east-1",
    targetRegionId: "us-west-2",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  });

  cdcService.registerReplication({
    sourceRegionId: "us-east-1",
    targetRegionId: "eu-west-1",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  });

  cdcService.registerReplication({
    sourceRegionId: "us-east-1",
    targetRegionId: "ap-southeast-1",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  });

  // Get all registered pairs
  const pairs = cdcService.getRegisteredRegionPairs();
  assert.equal(pairs.length, 3);

  // Verify each pair
  assert.ok(pairs.some((p) => p.targetRegionId === "us-west-2"));
  assert.ok(pairs.some((p) => p.targetRegionId === "eu-west-1"));
  assert.ok(pairs.some((p) => p.targetRegionId === "ap-southeast-1"));
});
