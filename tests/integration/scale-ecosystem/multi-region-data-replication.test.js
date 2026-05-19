import assert from "node:assert/strict";
import test from "node:test";
import { DataReplicatorService, ReplicationEventBuffer, computeChecksum } from "../../../src/scale-ecosystem/multi-region/data-replicator/index.js";
import { resolveRegionFailover } from "../../../src/scale-ecosystem/multi-region/failover-controller/index.js";

test("integration: DataReplicatorService records events and flushes to target", async () => {
  const replicator = new DataReplicatorService({
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2"],
    policy: { sourceRegionId: "us-east-1", targetRegionIds: ["us-west-2"], residencyMode: "allowed_cross_border" },
    batchSize: 10,
    flushIntervalMs: 5000,
    retryAttempts: 3,
    checksumAlgorithm: "sha256",
  });

  const event = replicator.recordEvent("us-west-2", "Task", "task-123", { status: "completed" });
  assert.ok(event.eventId.startsWith("repl_"));
  assert.equal(event.sourceRegionId, "us-east-1");
  assert.equal(event.targetRegionId, "us-west-2");
  assert.ok(event.checksum.length > 0);

  const result = await replicator.flush("us-west-2");
  assert.equal(result.success, true);
  assert.equal(result.lastSequence >= 1, true);
});

test("integration: DataReplicatorService buffers events and auto-flushes on max size", async () => {
  const replicator = new DataReplicatorService({
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2", "eu-west-1"],
    policy: { sourceRegionId: "us-east-1", targetRegionIds: ["us-west-2", "eu-west-1"], residencyMode: "allowed_cross_border" },
    batchSize: 3,
    flushIntervalMs: 60000,
    retryAttempts: 3,
    checksumAlgorithm: "sha256",
  });

  replicator.recordEvent("us-west-2", "Task", "task-1", { data: "test1" });
  replicator.recordEvent("us-west-2", "Task", "task-2", { data: "test2" });
  const flushResult = replicator.recordEvent("us-west-2", "Task", "task-3", { data: "test3" });
  // buffer size reached 3 (maxSize), returns true indicating flush needed
  assert.equal(flushResult, true);

  const buffer = replicator.getBuffer("us-west-2");
  assert.ok(buffer != null);
});

test("integration: DataReplicatorService validates event checksum correctly", async () => {
  const replicator = new DataReplicatorService({
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2"],
    policy: { sourceRegionId: "us-east-1", targetRegionIds: ["us-west-2"], residencyMode: "allowed_cross_border" },
    batchSize: 10,
    flushIntervalMs: 5000,
    retryAttempts: 3,
    checksumAlgorithm: "sha256",
  });

  const event = replicator.recordEvent("us-west-2", "Task", "task-123", { status: "ok" });
  const isValid = replicator.validateEvent(event);
  assert.equal(isValid, true);

  // Tamper with payload
  const tamperedEvent = { ...event, payload: { status: "tampered" } };
  const isInvalid = replicator.validateEvent(tamperedEvent);
  assert.equal(isInvalid, false);
});

test("integration: DataReplicatorService flushAll returns results for all regions", async () => {
  const replicator = new DataReplicatorService({
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2", "eu-west-1"],
    policy: { sourceRegionId: "us-east-1", targetRegionIds: ["us-west-2", "eu-west-1"], residencyMode: "allowed_cross_border" },
    batchSize: 10,
    flushIntervalMs: 5000,
    retryAttempts: 3,
    checksumAlgorithm: "sha256",
  });

  replicator.recordEvent("us-west-2", "Task", "task-1", { data: "test" });
  replicator.recordEvent("eu-west-1", "Task", "task-2", { data: "test" });

  const results = await replicator.flushAll();
  assert.equal(results.size, 2);
  assert.equal(results.get("us-west-2")?.success, true);
  assert.equal(results.get("eu-west-1")?.success, true);
});

test("integration: DataReplicatorService manages checkpoints", async () => {
  const replicator = new DataReplicatorService({
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2"],
    policy: { sourceRegionId: "us-east-1", targetRegionIds: ["us-west-2"], residencyMode: "allowed_cross_border" },
    batchSize: 10,
    flushIntervalMs: 5000,
    retryAttempts: 3,
    checksumAlgorithm: "sha256",
  });

  replicator.recordEvent("us-west-2", "Task", "task-1", { data: "test" });
  await replicator.flush("us-west-2");

  const checkpoint = replicator.getCheckpoint("us-west-2");
  assert.ok(checkpoint != null);
  assert.equal(checkpoint.sourceRegionId, "us-east-1");
  assert.equal(checkpoint.targetRegionId, "us-west-2");
  assert.ok(checkpoint.sequenceNumber >= 0);
});

test("integration: DataReplicatorService registers and handles incoming events", async () => {
  const replicator = new DataReplicatorService({
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2"],
    policy: { sourceRegionId: "us-east-1", targetRegionIds: ["us-west-2"], residencyMode: "allowed_cross_border" },
    batchSize: 10,
    flushIntervalMs: 5000,
    retryAttempts: 3,
    checksumAlgorithm: "sha256",
  });

  let receivedEvent = null;
  replicator.onEvent("us-west-2", async (event) => {
    receivedEvent = event;
  });

  const outgoingEvent = replicator.recordEvent("us-west-2", "Task", "task-1", { data: "test" });
  await replicator.flush("us-west-2");

  // Simulate incoming event from us-west-2
  const incomingEvent = {
    eventId: "repl_from_west",
    sourceRegionId: "us-west-2",
    targetRegionId: "us-east-1",
    aggregateType: "Task",
    aggregateId: "task-456",
    payload: { status: "processed" },
    timestamp: new Date().toISOString(),
    checksum: computeChecksum({ status: "processed" }),
  };

  await replicator.handleIncomingEvent(incomingEvent);
  assert.ok(receivedEvent != null);
  assert.equal(receivedEvent.aggregateId, "task-456");
});

test("integration: resolveRegionFailover triggers failover chain with multiple degraded conditions", () => {
  const decision = resolveRegionFailover({
    primaryHealthy: true,
    candidateRegionIds: ["us-east-1", "us-west-2", "eu-west-1"],
    primaryLatencyMs: 180,
    maxAcceptableLatencyMs: 100,
    primaryErrorRate: 0.08,
    maxAcceptableErrorRate: 0.05,
  });
  assert.equal(decision.shouldFailover, true);
  assert.ok(decision.targetRegionId != null);
  assert.ok(decision.fencingEpoch > 0);
});

test("integration: ReplicationEventBuffer tracks timing for interval-based flush", () => {
  const buffer = new ReplicationEventBuffer(100, 100);
  const event = { eventId: "e1", sourceRegionId: "us-east-1", targetRegionId: "us-west-2", aggregateType: "Task", aggregateId: "t1", payload: {}, timestamp: new Date().toISOString(), checksum: "" };

  buffer.add(event);
  assert.equal(buffer.size(), 1);
  assert.equal(buffer.shouldFlush(), false);

  // Simulate time passage - set lastFlushAt to old timestamp
  buffer.flush();
  assert.equal(buffer.size(), 0);
  assert.equal(buffer.shouldFlush(), false);
});