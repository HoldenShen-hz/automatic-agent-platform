import assert from "node:assert/strict";
import test from "node:test";

import { DataReplicatorService } from "../../../../src/scale-ecosystem/multi-region/data-replicator/index.js";
import {
  RegionHealthCheckService,
  type RegionHealthCheckConfig,
} from "../../../../src/scale-ecosystem/multi-region/region-health-check-service.js";
import { allocateReservedCapacity } from "../../../../src/scale-ecosystem/sla-engine/resource-allocator/index.js";

test("RegionHealthCheckService marks a region degraded when latency exceeds the threshold", async () => {
  const service = new RegionHealthCheckService();

  service.registerRegion({
    regionId: "us-east",
    endpoint: "https://us-east.api.example.com",
    checkIntervalMs: 30000,
    timeoutMs: 5000,
    retryCount: 3,
    thresholds: {
      maxLatencyMs: 100,
      maxErrorRate: 0.05,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.9,
    },
  });

  (service as unknown as {
    performHealthCheck: (config: RegionHealthCheckConfig) => Promise<{
      metrics: { metricName: string; value: number; threshold: number; isHealthy: boolean }[];
    }>;
  }).performHealthCheck = async (config) => ({
    metrics: [{
      metricName: "latency",
      value: config.thresholds.maxLatencyMs + 25,
      threshold: config.thresholds.maxLatencyMs,
      isHealthy: false,
    }],
  });

  const result = await service.checkRegion("us-east");
  assert.equal(result.status, "degraded");
});

test("allocateReservedCapacity rejects cumulative reserved percentages above capacity", () => {
  assert.throws(
    () =>
      allocateReservedCapacity(100, [
        { tierId: "tier-1", reservedPercent: 60 },
        { tierId: "tier-2", reservedPercent: 50 },
      ]),
    /resource_allocator\.total_reserved_exceeds_100/,
  );

  assert.deepEqual(
    allocateReservedCapacity(100, [
      { tierId: "tier-1", reservedPercent: 50 },
      { tierId: "tier-2", reservedPercent: 50 },
    ]),
    { "tier-1": 50, "tier-2": 50 },
  );
});

test("DataReplicatorService scheduled flush emits buffered events and checkpoints them", async () => {
  const emitted: string[] = [];
  const replicator = new DataReplicatorService({
    sourceRegionId: "us-east-1",
    targetRegionIds: ["eu-west-1"],
    policy: {
      sourceRegionId: "us-east-1",
      targetRegionIds: ["eu-west-1"],
      residencyMode: "allowed_cross_border",
    },
    batchSize: 100,
    flushIntervalMs: 15,
    retryAttempts: 2,
    checksumAlgorithm: "sha256",
    emit: (_targetRegionId, event) => {
      emitted.push(event.eventId);
    },
  });

  const event = replicator.recordEvent("eu-west-1", "Task", "task-1", { step: 1 });
  assert.ok(event != null);

  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.deepEqual(emitted, [event!.eventId]);
  assert.equal(replicator.getBuffer("eu-west-1")?.size(), 0);
  assert.equal(replicator.getCheckpoint("eu-west-1")?.sequenceNumber, 1);
});

test("DataReplicatorService checkpoint pendingCount tracks only unconfirmed events", async () => {
  const replicator = new DataReplicatorService({
    sourceRegionId: "us-east-1",
    targetRegionIds: ["eu-west-1"],
    policy: {
      sourceRegionId: "us-east-1",
      targetRegionIds: ["eu-west-1"],
      residencyMode: "allowed_cross_border",
    },
    batchSize: 100,
    flushIntervalMs: 5000,
    retryAttempts: 2,
    checksumAlgorithm: "sha256",
  });

  let invocation = 0;
  replicator.onEvent("eu-west-1", async (event) => {
    invocation++;
    if (event.aggregateId === "task-2") {
      throw new Error(`permanent failure:${invocation}`);
    }
  });

  replicator.recordEvent("eu-west-1", "Task", "task-1", { step: 1 });
  replicator.recordEvent("eu-west-1", "Task", "task-2", { step: 2 });

  const result = await replicator.flush("eu-west-1");
  const checkpoint = replicator.getCheckpoint("eu-west-1");

  assert.equal(result.lastSequence, 1);
  assert.equal(checkpoint?.sequenceNumber, 1);
  assert.equal(checkpoint?.pendingCount, 1);
});

test("DataReplicatorService does not double-count sequence after a successful retry", async () => {
  const replicator = new DataReplicatorService({
    sourceRegionId: "us-east-1",
    targetRegionIds: ["eu-west-1"],
    policy: {
      sourceRegionId: "us-east-1",
      targetRegionIds: ["eu-west-1"],
      residencyMode: "allowed_cross_border",
    },
    batchSize: 100,
    flushIntervalMs: 5000,
    retryAttempts: 3,
    checksumAlgorithm: "sha256",
  });

  let attempts = 0;
  replicator.onEvent("eu-west-1", async () => {
    attempts++;
    if (attempts === 1) {
      throw new Error("transient failure");
    }
  });

  replicator.recordEvent("eu-west-1", "Task", "task-1", { step: 1 });
  const result = await replicator.flush("eu-west-1");
  const checkpoint = replicator.getCheckpoint("eu-west-1");

  assert.equal(attempts, 2);
  assert.equal(result.lastSequence, 1);
  assert.equal(result.eventsReplicated, 1);
  assert.deepEqual(result.errors, []);
  assert.equal(checkpoint?.sequenceNumber, 1);
  assert.equal(checkpoint?.pendingCount, 0);
});
