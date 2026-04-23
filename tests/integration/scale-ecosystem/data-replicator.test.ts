import assert from "node:assert/strict";
import test from "node:test";

import {
  DataReplicatorService,
  ReplicationEventBuffer,
  createDataReplicator,
  computeChecksum,
  shouldReplicateToRegion,
  type ReplicationPolicy,
} from "../../../../src/scale-ecosystem/multi-region/data-replicator/index.js";

test("replication event buffer adds events and signals when flush needed at max size", () => {
  const buffer = new ReplicationEventBuffer(3, 60000);

  const event1 = { eventId: "evt_1", sourceRegionId: "us-east", targetRegionId: "us-west", aggregateType: "task", aggregateId: "task_1", payload: { foo: "bar" }, timestamp: "2026-04-20T10:00:00.000Z", checksum: "" };
  const event2 = { eventId: "evt_2", sourceRegionId: "us-east", targetRegionId: "us-west", aggregateType: "task", aggregateId: "task_2", payload: { baz: "qux" }, timestamp: "2026-04-20T10:01:00.000Z", checksum: "" };

  const shouldFlush1 = buffer.add(event1);
  assert.equal(shouldFlush1, false);
  assert.equal(buffer.size(), 1);

  const shouldFlush2 = buffer.add(event2);
  assert.equal(shouldFlush2, false);
  assert.equal(buffer.size(), 2);
});

test("replication event buffer flushes when max size reached", () => {
  const buffer = new ReplicationEventBuffer(2, 60000);

  const event1 = { eventId: "evt_1", sourceRegionId: "us-east", targetRegionId: "us-west", aggregateType: "task", aggregateId: "task_1", payload: { data: 1 }, timestamp: "2026-04-20T10:00:00.000Z", checksum: "" };
  const event2 = { eventId: "evt_2", sourceRegionId: "us-east", targetRegionId: "us-west", aggregateType: "task", aggregateId: "task_2", payload: { data: 2 }, timestamp: "2026-04-20T10:01:00.000Z", checksum: "" };

  buffer.add(event1);
  const shouldFlush = buffer.add(event2);

  assert.equal(shouldFlush, true);
  assert.equal(buffer.size(), 2);
});

test("replication event buffer flush returns all events", () => {
  const buffer = new ReplicationEventBuffer(10, 60000);

  const event1 = { eventId: "evt_1", sourceRegionId: "us-east", targetRegionId: "eu-west", aggregateType: "execution", aggregateId: "exec_1", payload: { value: 1 }, timestamp: "2026-04-20T10:00:00.000Z", checksum: "" };
  const event2 = { eventId: "evt_2", sourceRegionId: "us-east", targetRegionId: "eu-west", aggregateType: "execution", aggregateId: "exec_2", payload: { value: 2 }, timestamp: "2026-04-20T10:01:00.000Z", checksum: "" };

  buffer.add(event1);
  buffer.add(event2);

  const flushed = buffer.flush();

  assert.equal(flushed.length, 2);
  assert.equal(flushed[0].eventId, "evt_1");
  assert.equal(flushed[1].eventId, "evt_2");
  assert.equal(buffer.size(), 0);
});

test("replication event buffer reports should flush based on time interval", () => {
  const buffer = new ReplicationEventBuffer(100, 1); // 1ms interval for testing

  buffer.add({ eventId: "evt_1", sourceRegionId: "us-east", targetRegionId: "us-west", aggregateType: "task", aggregateId: "task_1", payload: {}, timestamp: "2026-04-20T10:00:00.000Z", checksum: "" });

  // Should not flush immediately
  assert.equal(buffer.shouldFlush(), false);

  // Wait for interval to elapse
  const start = Date.now();
  while (Date.now() - start < 10) {
    // busy wait
  }

  assert.equal(buffer.shouldFlush(), true);
});

test("compute checksum generates deterministic sha256 hash", () => {
  const payload = { taskId: "task_001", status: "completed" };

  const checksum1 = computeChecksum(payload, "sha256");
  const checksum2 = computeChecksum(payload, "sha256");

  assert.equal(checksum1, checksum2);
  assert.equal(checksum1.length, 64); // SHA256 produces 64 hex characters
});

test("compute checksum different payloads produce different checksums", () => {
  const payload1 = { data: "first" };
  const payload2 = { data: "second" };

  const checksum1 = computeChecksum(payload1);
  const checksum2 = computeChecksum(payload2);

  assert.notEqual(checksum1, checksum2);
});

test("should replicate to region returns true when region is in target list and mode is not blocked", () => {
  const policy: ReplicationPolicy = {
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2", "eu-west-1"],
    residencyMode: "same_jurisdiction",
  };

  assert.equal(shouldReplicateToRegion(policy, "us-west-2"), true);
  assert.equal(shouldReplicateToRegion(policy, "eu-west-1"), true);
  assert.equal(shouldReplicateToRegion(policy, "ap-south-1"), false);
});

test("should replicate to region returns false when residency mode is blocked", () => {
  const policy: ReplicationPolicy = {
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2", "eu-west-1"],
    residencyMode: "blocked",
  };

  assert.equal(shouldReplicateToRegion(policy, "us-west-2"), false);
});

test("data replicator service records and retrieves events", () => {
  const replicator = createDataReplicator("us-east-1", ["us-west-2", "eu-west-1"], {
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2", "eu-west-1"],
    residencyMode: "same_jurisdiction",
  });

  const event = replicator.recordEvent("us-west-2", "task", "task_001", { status: "updated" });

  assert.equal(event.sourceRegionId, "us-east-1");
  assert.equal(event.targetRegionId, "us-west-2");
  assert.equal(event.aggregateType, "task");
  assert.equal(event.aggregateId, "task_001");
  assert.ok(event.eventId);
  assert.ok(event.checksum);
});

test("data replicator service gets buffer for target region", () => {
  const replicator = createDataReplicator("us-east-1", ["us-west-2", "eu-west-1"], {
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2", "eu-west-1"],
    residencyMode: "same_jurisdiction",
  });

  const buffer = replicator.getBuffer("us-west-2");

  assert.ok(buffer);
  assert.equal(buffer?.size(), 0);
});

test("data replicator service returns null for unknown target region", () => {
  const replicator = createDataReplicator("us-east-1", ["us-west-2"], {
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2"],
    residencyMode: "same_jurisdiction",
  });

  const buffer = replicator.getBuffer("ap-south-1");

  assert.equal(buffer, null);
});

test("data replicator service flushes and returns success with no errors", async () => {
  const replicator = createDataReplicator("us-east-1", ["us-west-2"], {
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2"],
    residencyMode: "same_jurisdiction",
  });

  replicator.recordEvent("us-west-2", "task", "task_flush", { data: "test" });

  const result = await replicator.flush("us-west-2");

  assert.equal(result.success, true);
  assert.equal(result.eventsReplicated >= 0, true);
});

test("data replicator service flushes unknown region returns failure", async () => {
  const replicator = createDataReplicator("us-east-1", ["us-west-2"], {
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2"],
    residencyMode: "same_jurisdiction",
  });

  const result = await replicator.flush("ap-south-1");

  assert.equal(result.success, false);
  assert.equal(result.eventsReplicated, 0);
  assert.ok(result.errors.length > 0);
});

test("data replicator service flushes all regions", async () => {
  const replicator = createDataReplicator("us-east-1", ["us-west-2", "eu-west-1"], {
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2", "eu-west-1"],
    residencyMode: "same_jurisdiction",
  });

  replicator.recordEvent("us-west-2", "task", "task_1", { data: 1 });
  replicator.recordEvent("eu-west-1", "task", "task_2", { data: 2 });

  const results = await replicator.flushAll();

  assert.equal(results.size, 2);
  assert.ok(results.has("us-west-2"));
  assert.ok(results.has("eu-west-1"));
});

test("data replicator service validates event checksum", () => {
  const replicator = createDataReplicator("us-east-1", ["us-west-2"], {
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2"],
    residencyMode: "same_jurisdiction",
  });

  const event = replicator.recordEvent("us-west-2", "task", "task_checksum", { value: 123 });

  const isValid = replicator.validateEvent(event);
  assert.equal(isValid, true);

  // Tamper with payload
  const tamperedEvent = { ...event, payload: { tampered: true } };
  const isInvalid = replicator.validateEvent(tamperedEvent);
  assert.equal(isInvalid, false);
});

test("data replicator service gets status for all target regions", () => {
  const replicator = createDataReplicator("us-east-1", ["us-west-2", "eu-west-1"], {
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2", "eu-west-1"],
    residencyMode: "same_jurisdiction",
  });

  replicator.recordEvent("us-west-2", "task", "task_status", { data: "status_test" });

  const status = replicator.getStatus();

  assert.equal(status.size, 2);
  assert.ok(status.has("us-west-2"));
  assert.ok(status.has("eu-west-1"));

  const usWestStatus = status.get("us-west-2");
  assert.equal(usWestStatus?.bufferSize, 1);
});

test("data replicator service records multiple events to buffer", () => {
  const replicator = createDataReplicator("us-east-1", ["us-west-2"], {
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2"],
    residencyMode: "same_jurisdiction",
  });

  replicator.recordEvent("us-west-2", "task", "task_1", { seq: 1 });
  replicator.recordEvent("us-west-2", "task", "task_2", { seq: 2 });
  replicator.recordEvent("us-west-2", "task", "task_3", { seq: 3 });

  const buffer = replicator.getBuffer("us-west-2");
  assert.equal(buffer?.size(), 3);
});

test("data replicator service updates checkpoint after flush", async () => {
  const replicator = createDataReplicator("us-east-1", ["us-west-2"], {
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2"],
    residencyMode: "same_jurisdiction",
  });

  replicator.recordEvent("us-west-2", "task", "task_cp", { checkpoint: true });

  await replicator.flush("us-west-2");

  const checkpoint = replicator.getCheckpoint("us-west-2");
  assert.ok(checkpoint);
  assert.equal(checkpoint?.sourceRegionId, "us-east-1");
  assert.equal(checkpoint?.targetRegionId, "us-west-2");
});