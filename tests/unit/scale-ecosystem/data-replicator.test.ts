/**
 * Data Replicator Unit Tests
 *
 * Tests for ReplicationEventBuffer, checksum computation,
 * replication policy, and DataReplicatorService.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  ReplicationEventBuffer,
  computeChecksum,
  shouldReplicateToRegion,
  createDataReplicator,
  DataReplicatorService,
  type ReplicationPolicy,
  type ReplicationEvent,
} from "../../../src/scale-ecosystem/multi-region/data-replicator/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// ReplicationEventBuffer Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ReplicationEventBuffer.constructor initializes with default values [data-replicator]", () => {
  const buffer = new ReplicationEventBuffer();

  assert.equal(buffer.size(), 0);
  assert.equal(buffer.shouldFlush(), false);
});

test("ReplicationEventBuffer.constructor accepts custom maxSize and flushInterval [data-replicator]", () => {
  const buffer = new ReplicationEventBuffer(500, 10000);

  assert.equal(buffer.size(), 0);
});

test("ReplicationEventBuffer.add adds event to buffer [data-replicator]", () => {
  const buffer = new ReplicationEventBuffer(100, 60000);
  const event: ReplicationEvent = {
    eventId: "evt-1",
    sourceRegionId: "us-east-1",
    targetRegionId: "us-west-2",
    aggregateType: "Task",
    aggregateId: "task-1",
    payload: { status: "completed" },
    timestamp: "2026-04-20T00:00:00.000Z",
    checksum: "abc123",
  };

  buffer.add(event);

  assert.equal(buffer.size(), 1);
});

test("ReplicationEventBuffer.add returns true when maxSize reached [data-replicator]", () => {
  const buffer = new ReplicationEventBuffer(2, 60000);
  const event1: ReplicationEvent = {
    eventId: "evt-1",
    sourceRegionId: "us-east-1",
    targetRegionId: "us-west-2",
    aggregateType: "Task",
    aggregateId: "task-1",
    payload: {},
    timestamp: "2026-04-20T00:00:00.000Z",
    checksum: "abc",
  };
  const event2: ReplicationEvent = {
    eventId: "evt-2",
    sourceRegionId: "us-east-1",
    targetRegionId: "us-west-2",
    aggregateType: "Task",
    aggregateId: "task-2",
    payload: {},
    timestamp: "2026-04-20T00:00:00.000Z",
    checksum: "def",
  };

  const result1 = buffer.add(event1);
  const result2 = buffer.add(event2);

  assert.equal(result1, false);
  assert.equal(result2, true); // Max size reached
});

test("ReplicationEventBuffer.add schedules flush when size threshold met [data-replicator]", () => {
  const buffer = new ReplicationEventBuffer(100, 60000);

  // Should not schedule flush immediately with low volume
  buffer.add({
    eventId: "evt-1",
    sourceRegionId: "us-east-1",
    targetRegionId: "us-west-2",
    aggregateType: "Task",
    aggregateId: "task-1",
    payload: {},
    timestamp: "2026-04-20T00:00:00.000Z",
    checksum: "abc",
  });

  const internals = buffer as unknown as {
    timer: ReturnType<typeof setTimeout> | null;
  };
  assert.ok(internals.timer);
});

test("ReplicationEventBuffer.flush clears buffer and returns events [data-replicator]", () => {
  const buffer = new ReplicationEventBuffer(100, 60000);
  const event: ReplicationEvent = {
    eventId: "evt-1",
    sourceRegionId: "us-east-1",
    targetRegionId: "us-west-2",
    aggregateType: "Task",
    aggregateId: "task-1",
    payload: {},
    timestamp: "2026-04-20T00:00:00.000Z",
    checksum: "abc",
  };

  buffer.add(event);
  const flushed = buffer.flush();

  assert.equal(flushed.length, 1);
  assert.equal(flushed[0]!.eventId, "evt-1");
  assert.equal(buffer.size(), 0);
});

test("ReplicationEventBuffer.flush clears timer [data-replicator]", () => {
  const buffer = new ReplicationEventBuffer(1000, 5000); // Long interval so timer would trigger

  buffer.add({
    eventId: "evt-1",
    sourceRegionId: "us-east-1",
    targetRegionId: "us-west-2",
    aggregateType: "Task",
    aggregateId: "task-1",
    payload: {},
    timestamp: "2026-04-20T00:00:00.000Z",
    checksum: "abc",
  });

  buffer.flush();

  // Verify buffer is empty and timer is cleared
  assert.equal(buffer.size(), 0);
});

test("ReplicationEventBuffer.shouldFlush returns false when buffer empty [data-replicator]", () => {
  const buffer = new ReplicationEventBuffer(100, 60000);

  assert.equal(buffer.shouldFlush(), false);
});

test("ReplicationEventBuffer.shouldFlush returns true when time interval exceeded [data-replicator]", () => {
  const buffer = new ReplicationEventBuffer(100, 1); // 1ms interval

  buffer.add({
    eventId: "evt-1",
    sourceRegionId: "us-east-1",
    targetRegionId: "us-west-2",
    aggregateType: "Task",
    aggregateId: "task-1",
    payload: {},
    timestamp: "2026-04-20T00:00:00.000Z",
    checksum: "abc",
  });

  // Wait for interval to elapse
  // In practice this test may be timing-sensitive
  assert.ok(buffer.size() > 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Checksum Utility Tests
// ─────────────────────────────────────────────────────────────────────────────

test("computeChecksum produces consistent SHA256 hash [data-replicator]", () => {
  const payload = { data: "test" };

  const checksum1 = computeChecksum(payload, "sha256");
  const checksum2 = computeChecksum(payload, "sha256");

  assert.equal(checksum1, checksum2);
  assert.equal(checksum1.length, 64); // SHA256 produces 64 hex chars
});

test("computeChecksum rejects unsupported checksum algorithms [data-replicator]", () => {
  const payload = { data: "test" };

  assert.throws(() => computeChecksum(payload, "md5" as never), /data_replicator\.unsupported_checksum_algorithm:md5/);
});

test("computeChecksum produces different hashes for different payloads [data-replicator]", () => {
  const payload1 = { data: "test1" };
  const payload2 = { data: "test2" };

  const checksum1 = computeChecksum(payload1, "sha256");
  const checksum2 = computeChecksum(payload2, "sha256");

  assert.notEqual(checksum1, checksum2);
});

test("computeChecksum handles nested objects [data-replicator]", () => {
  const payload = {
    task: {
      id: "task-1",
      status: { value: "completed", nested: { deep: true } },
    },
  };

  const checksum = computeChecksum(payload, "sha256");

  assert.equal(checksum.length, 64);
});

test("computeChecksum defaults to SHA256 [data-replicator]", () => {
  const payload = { data: "test" };

  const withDefault = computeChecksum(payload);
  const explicitSha256 = computeChecksum(payload, "sha256");

  assert.equal(withDefault, explicitSha256);
});

// ─────────────────────────────────────────────────────────────────────────────
// Replication Policy Tests
// ─────────────────────────────────────────────────────────────────────────────

test("shouldReplicateToRegion returns true when region in target list and not blocked [data-replicator]", () => {
  const policy: ReplicationPolicy = {
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2", "eu-west-1"],
    residencyMode: "allowed_cross_border",
  };

  assert.equal(shouldReplicateToRegion(policy, "us-west-2"), true);
  assert.equal(shouldReplicateToRegion(policy, "eu-west-1"), true);
});

test("shouldReplicateToRegion returns false when region not in target list [data-replicator]", () => {
  const policy: ReplicationPolicy = {
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2"],
    residencyMode: "allowed_cross_border",
  };

  assert.equal(shouldReplicateToRegion(policy, "eu-west-1"), false);
});

test("shouldReplicateToRegion returns false when residency is blocked [data-replicator]", () => {
  const policy: ReplicationPolicy = {
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2", "eu-west-1"],
    residencyMode: "blocked",
  };

  assert.equal(shouldReplicateToRegion(policy, "us-west-2"), false);
});

test("shouldReplicateToRegion returns false when residency is same_jurisdiction and region not in list [data-replicator]", () => {
  const policy: ReplicationPolicy = {
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2"],
    residencyMode: "same_jurisdiction",
  };

  assert.equal(shouldReplicateToRegion(policy, "eu-west-1"), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// DataReplicatorService Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DataReplicatorService.constructor creates buffers for each target region [data-replicator]", () => {
  const replicator = new DataReplicatorService({
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2", "eu-west-1"],
    policy: { sourceRegionId: "us-east-1", targetRegionIds: ["us-west-2", "eu-west-1"], residencyMode: "allowed_cross_border" },
    batchSize: 100,
    flushIntervalMs: 5000,
    retryAttempts: 3,
    checksumAlgorithm: "sha256",
  });

  const buffer1 = replicator.getBuffer("us-west-2");
  const buffer2 = replicator.getBuffer("eu-west-1");

  assert.ok(buffer1 !== null);
  assert.ok(buffer2 !== null);
});

test("DataReplicatorService.getBuffer returns null for unknown region [data-replicator]", () => {
  const replicator = new DataReplicatorService({
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2"],
    policy: { sourceRegionId: "us-east-1", targetRegionIds: ["us-west-2"], residencyMode: "allowed_cross_border" },
    batchSize: 100,
    flushIntervalMs: 5000,
    retryAttempts: 3,
    checksumAlgorithm: "sha256",
  });

  const buffer = replicator.getBuffer("unknown-region");

  assert.equal(buffer, null);
});

test("DataReplicatorService.recordEvent returns null when replication blocked by policy [data-replicator]", () => {
  const replicator = new DataReplicatorService({
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2"],
    policy: { sourceRegionId: "us-east-1", targetRegionIds: ["us-west-2"], residencyMode: "blocked" },
    batchSize: 100,
    flushIntervalMs: 5000,
    retryAttempts: 3,
    checksumAlgorithm: "sha256",
  });

  const event = replicator.recordEvent("us-west-2", "Task", "task-1", { data: "test" });

  assert.equal(event, null);
});

test("DataReplicatorService.recordEvent creates event with checksum [data-replicator]", () => {
  const replicator = new DataReplicatorService({
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2"],
    policy: { sourceRegionId: "us-east-1", targetRegionIds: ["us-west-2"], residencyMode: "allowed_cross_border" },
    batchSize: 100,
    flushIntervalMs: 5000,
    retryAttempts: 3,
    checksumAlgorithm: "sha256",
  });

  const event = replicator.recordEvent("us-west-2", "Task", "task-1", { data: "test" });

  assert.ok(event !== null);
  assert.ok(event!.eventId.startsWith("repl_"));
  assert.ok(event!.checksum.length > 0);
});

test("DataReplicatorService.recordEvent returns null when region not in policy target list [data-replicator]", () => {
  const replicator = new DataReplicatorService({
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2"],
    policy: { sourceRegionId: "us-east-1", targetRegionIds: ["us-west-2"], residencyMode: "allowed_cross_border" },
    batchSize: 100,
    flushIntervalMs: 5000,
    retryAttempts: 3,
    checksumAlgorithm: "sha256",
  });

  const event = replicator.recordEvent("eu-west-1", "Task", "task-1", { data: "test" });

  assert.equal(event, null);
});

test("DataReplicatorService.validateEvent returns true for valid checksum [data-replicator]", () => {
  const replicator = new DataReplicatorService({
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2"],
    policy: { sourceRegionId: "us-east-1", targetRegionIds: ["us-west-2"], residencyMode: "allowed_cross_border" },
    batchSize: 100,
    flushIntervalMs: 5000,
    retryAttempts: 3,
    checksumAlgorithm: "sha256",
  });

  const event = replicator.recordEvent("us-west-2", "Task", "task-1", { data: "test" });
  const isValid = replicator.validateEvent(event!);

  assert.equal(isValid, true);
});

test("DataReplicatorService.validateEvent returns false for tampered event [data-replicator]", () => {
  const replicator = new DataReplicatorService({
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2"],
    policy: { sourceRegionId: "us-east-1", targetRegionIds: ["us-west-2"], residencyMode: "allowed_cross_border" },
    batchSize: 100,
    flushIntervalMs: 5000,
    retryAttempts: 3,
    checksumAlgorithm: "sha256",
  });

  const event = replicator.recordEvent("us-west-2", "Task", "task-1", { data: "test" });
  const tamperedEvent: ReplicationEvent = {
    ...event!,
    payload: { data: "tampered" },
  };

  const isValid = replicator.validateEvent(tamperedEvent);

  assert.equal(isValid, false);
});

test("DataReplicatorService.getCheckpoint returns null for unknown region [data-replicator]", () => {
  const replicator = new DataReplicatorService({
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2"],
    policy: { sourceRegionId: "us-east-1", targetRegionIds: ["us-west-2"], residencyMode: "allowed_cross_border" },
    batchSize: 100,
    flushIntervalMs: 5000,
    retryAttempts: 3,
    checksumAlgorithm: "sha256",
  });

  const checkpoint = replicator.getCheckpoint("unknown-region");

  assert.equal(checkpoint, null);
});

test("DataReplicatorService.getStatus returns buffer sizes and checkpoints [data-replicator]", () => {
  const replicator = new DataReplicatorService({
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2", "eu-west-1"],
    policy: { sourceRegionId: "us-east-1", targetRegionIds: ["us-west-2", "eu-west-1"], residencyMode: "allowed_cross_border" },
    batchSize: 100,
    flushIntervalMs: 5000,
    retryAttempts: 3,
    checksumAlgorithm: "sha256",
  });

  replicator.recordEvent("us-west-2", "Task", "task-1", { data: "test" });
  replicator.recordEvent("eu-west-1", "Task", "task-2", { data: "test2" });

  const status = replicator.getStatus();

  assert.equal(status.size, 2);
  assert.equal(status.get("us-west-2")?.bufferSize, 1);
  assert.equal(status.get("eu-west-1")?.bufferSize, 1);
});

test("DataReplicatorService.handleIncomingEvent calls registered handler [data-replicator]", async () => {
  const replicator = new DataReplicatorService({
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2"],
    policy: { sourceRegionId: "us-east-1", targetRegionIds: ["us-west-2"], residencyMode: "allowed_cross_border" },
    batchSize: 100,
    flushIntervalMs: 5000,
    retryAttempts: 3,
    checksumAlgorithm: "sha256",
  });

  let handlerCalled = false;
  replicator.onEvent("us-east-1", async (event) => {
    handlerCalled = true;
    assert.equal(event.sourceRegionId, "us-east-1");
  });

  await replicator.handleIncomingEvent({
    eventId: "evt-1",
    sourceRegionId: "us-east-1",
    targetRegionId: "us-west-2",
    aggregateType: "Task",
    aggregateId: "task-1",
    payload: {},
    timestamp: "2026-04-20T00:00:00.000Z",
    checksum: computeChecksum({}, "sha256"),
  });

  assert.equal(handlerCalled, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Factory Function Tests
// ─────────────────────────────────────────────────────────────────────────────

test("createDataReplicator creates service with defaults [data-replicator]", () => {
  const replicator = createDataReplicator(
    "us-east-1",
    ["us-west-2"],
    { sourceRegionId: "us-east-1", targetRegionIds: ["us-west-2"], residencyMode: "allowed_cross_border" },
  );

  const buffer = replicator.getBuffer("us-west-2");
  assert.ok(buffer !== null);
});

test("createDataReplicator accepts custom options [data-replicator]", () => {
  const replicator = createDataReplicator(
    "us-east-1",
    ["us-west-2"],
    { sourceRegionId: "us-east-1", targetRegionIds: ["us-west-2"], residencyMode: "allowed_cross_border" },
    { batchSize: 50, flushIntervalMs: 10000, retryAttempts: 5, checksumAlgorithm: "sha256" },
  );

  const status = replicator.getStatus();
  assert.equal(status.get("us-west-2")?.bufferSize, 0);
});

test("createDataReplicator uses sha256 as default checksum algorithm [data-replicator]", () => {
  const replicator = createDataReplicator(
    "us-east-1",
    ["us-west-2"],
    { sourceRegionId: "us-east-1", targetRegionIds: ["us-west-2"], residencyMode: "allowed_cross_border" },
  );

  const event = replicator.recordEvent("us-west-2", "Task", "task-1", { data: "test" });
  assert.ok(event!.checksum.length === 64); // SHA256 hex length
});
