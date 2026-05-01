import assert from "node:assert/strict";
import test from "node:test";
import {
  DataReplicatorService,
  ReplicationEventBuffer,
  computeChecksum,
  ReplicationPolicySchema,
  shouldReplicateToRegion,
} from "../../../../../src/scale-ecosystem/multi-region/data-replicator/index.js";

test("ReplicationEventBuffer adds events and triggers flush on max size", () => {
  const buffer = new ReplicationEventBuffer(3, 60000);

  const result = buffer.add({ eventId: "e1", sourceRegionId: "us", targetRegionId: "eu", aggregateType: "task", aggregateId: "a1", payload: {}, timestamp: "now", checksum: "c1" });

  assert.equal(result, false); // no flush triggered
  assert.equal(buffer.size(), 1);

  buffer.add({ eventId: "e2", sourceRegionId: "us", targetRegionId: "eu", aggregateType: "task", aggregateId: "a2", payload: {}, timestamp: "now", checksum: "c2" });
  const shouldFlush = buffer.add({ eventId: "e3", sourceRegionId: "us", targetRegionId: "eu", aggregateType: "task", aggregateId: "a3", payload: {}, timestamp: "now", checksum: "c3" });

  assert.equal(shouldFlush, true); // flush triggered at max size
});

test("ReplicationEventBuffer flush returns all events and clears", () => {
  const buffer = new ReplicationEventBuffer(100, 60000);

  buffer.add({ eventId: "e1", sourceRegionId: "us", targetRegionId: "eu", aggregateType: "task", aggregateId: "a1", payload: {}, timestamp: "now", checksum: "c1" });
  buffer.add({ eventId: "e2", sourceRegionId: "us", targetRegionId: "eu", aggregateType: "task", aggregateId: "a2", payload: {}, timestamp: "now", checksum: "c2" });

  const events = buffer.flush();

  assert.equal(events.length, 2);
  assert.equal(buffer.size(), 0);
});

test("ReplicationEventBuffer shouldFlush returns false for new buffer", () => {
  const buffer = new ReplicationEventBuffer(1000, 60000); // long interval

  buffer.add({ eventId: "e1", sourceRegionId: "us", targetRegionId: "eu", aggregateType: "task", aggregateId: "a1", payload: {}, timestamp: "now", checksum: "c1" });

  const result = buffer.shouldFlush();

  assert.equal(result, false); // interval hasn't elapsed since construction
});

test("computeChecksum generates consistent checksums", () => {
  const payload = { data: "test" };

  const sha256 = computeChecksum(payload, "sha256");
  const md5 = computeChecksum(payload, "md5");

  assert.ok(sha256.length === 64); // SHA256 hex is 64 chars
  assert.ok(md5.length === 32); // MD5 hex is 32 chars
  assert.notEqual(sha256, md5);
});

test("computeChecksum produces same result for same payload", () => {
  const payload = { key: "value" };

  const checksum1 = computeChecksum(payload);
  const checksum2 = computeChecksum(payload);

  assert.equal(checksum1, checksum2);
});

test("shouldReplicateToRegion respects blocked residency mode", () => {
  const policy = ReplicationPolicySchema.parse({
    sourceRegionId: "us",
    targetRegionIds: ["eu", "ap"],
    residencyMode: "blocked",
  });

  assert.equal(shouldReplicateToRegion(policy, "eu"), false);
  assert.equal(shouldReplicateToRegion(policy, "ap"), false);
});

test("shouldReplicateToRegion allows replication when not blocked", () => {
  const policy = ReplicationPolicySchema.parse({
    sourceRegionId: "us",
    targetRegionIds: ["eu"],
    residencyMode: "allowed_cross_border",
  });

  assert.equal(shouldReplicateToRegion(policy, "eu"), true);
});

test("shouldReplicateToRegion only allows configured target regions", () => {
  const policy = ReplicationPolicySchema.parse({
    sourceRegionId: "us",
    targetRegionIds: ["eu"],
    residencyMode: "same_jurisdiction",
  });

  assert.equal(shouldReplicateToRegion(policy, "eu"), true);
  assert.equal(shouldReplicateToRegion(policy, "ap"), false);
});

test("ReplicationPolicySchema applies defaults", () => {
  const result = ReplicationPolicySchema.safeParse({
    sourceRegionId: "us",
    targetRegionIds: ["eu"],
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.residencyMode, "same_jurisdiction");
  }
});

test("DataReplicatorService generates unique event IDs under rapid writes", () => {
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

  const eventIds = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const event = replicator.recordEvent("eu-west-1", "Task", `task-${i}`, { i });
    assert.ok(event != null);
    eventIds.add(event!.eventId);
  }

  assert.equal(eventIds.size, 200);
});

test("DataReplicatorService keeps checkpoint sequence cumulative across flushes", async () => {
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

  replicator.recordEvent("eu-west-1", "Task", "task-1", { step: 1 });
  replicator.recordEvent("eu-west-1", "Task", "task-2", { step: 2 });
  await replicator.flush("eu-west-1");

  replicator.recordEvent("eu-west-1", "Task", "task-3", { step: 3 });
  await replicator.flush("eu-west-1");

  const checkpoint = replicator.getCheckpoint("eu-west-1");
  assert.equal(checkpoint?.sequenceNumber, 3);
  assert.equal(checkpoint?.pendingCount, 0);
});
