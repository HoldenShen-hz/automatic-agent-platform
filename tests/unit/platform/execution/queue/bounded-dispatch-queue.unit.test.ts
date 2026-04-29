/**
 * BoundedDispatchQueue Unit Tests
 *
 * Tests the BoundedDispatchQueueEventFactory and related types per §17.1.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  BoundedDispatchQueueEventFactory,
  type BoundedDispatchQueueSnapshot,
  type BoundedDispatchEvent,
} from "../../../../../src/platform/execution/queue/bounded-dispatch-event.js";
import { runConcurrentInvariant } from "../../../../helpers/concurrent-runner.js";

test("BoundedDispatchQueueEventFactory create returns accepted event when queue has capacity", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot: BoundedDispatchQueueSnapshot = {
    queueName: "test-queue",
    queueDepthBefore: 5,
    maxQueueDepth: 10,
    dlqName: "test-dlq",
  };

  const event = factory.create(snapshot, "node-1", "tenant-1", "trace-1");

  assert.equal(event.eventType, "platform.dispatch.queue.accepted");
  assert.equal(event.reasonCode, "queue.accepted");
  assert.equal(event.queueName, "test-queue");
  assert.equal(event.queueDepthBefore, 5);
  assert.equal(event.maxQueueDepth, 10);
});

test("BoundedDispatchQueueEventFactory create returns rejected event when queue at max depth", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot: BoundedDispatchQueueSnapshot = {
    queueName: "test-queue",
    queueDepthBefore: 10,
    maxQueueDepth: 10,
    dlqName: "test-dlq",
  };

  const event = factory.create(snapshot, "node-1", "tenant-1", "trace-1");

  assert.equal(event.eventType, "platform.dispatch.queue.rejected");
  assert.equal(event.reasonCode, "queue.max_depth_exceeded");
  assert.equal(event.queueName, "test-queue");
  assert.equal(event.queueDepthBefore, 10);
  assert.equal(event.maxQueueDepth, 10);
});

test("BoundedDispatchQueueEventFactory create includes all required fields", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot: BoundedDispatchQueueSnapshot = {
    queueName: "full-queue",
    queueDepthBefore: 100,
    maxQueueDepth: 100,
    dlqName: "full-dlq",
  };

  const event = factory.create(snapshot, "node-run-123", "tenant-456", "trace-789");

  assert.equal(event.nodeRunId, "node-run-123");
  assert.equal(event.tenantId, "tenant-456");
  assert.equal(event.traceId, "trace-789");
  assert.equal(event.queue_class, "full-queue");
  assert.equal(event.ordering_policy_version, "1.0");
  assert.equal(event.dlqName, "full-dlq");
});

test("BoundedDispatchQueueEventFactory creates snapshot with correct structure", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot: BoundedDispatchQueueSnapshot = {
    queueName: "snapshot-test",
    queueDepthBefore: 3,
    maxQueueDepth: 50,
    dlqName: "snapshot-dlq",
  };

  const event = factory.create(snapshot, "node-1", "tenant-1", "trace-1");

  assert.equal(event.queueDepthBefore, snapshot.queueDepthBefore);
  assert.equal(event.maxQueueDepth, snapshot.maxQueueDepth);
  assert.equal(event.dlqName, snapshot.dlqName);
});

test("BoundedDispatchQueueEventFactory accepted event structure", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot: BoundedDispatchQueueSnapshot = {
    queueName: "accepted-queue",
    queueDepthBefore: 0,
    maxQueueDepth: 5,
    dlqName: "accepted-dlq",
  };

  const event = factory.create(snapshot, "node-1", "tenant-1", "trace-1") as BoundedDispatchEvent;

  assert.equal(event.eventType, "platform.dispatch.queue.accepted");
  assert.ok("nodeRunId" in event);
  assert.ok("tenantId" in event);
  assert.ok("traceId" in event);
});

test("BoundedDispatchQueueEventFactory rejected event structure", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot: BoundedDispatchQueueSnapshot = {
    queueName: "rejected-queue",
    queueDepthBefore: 100,
    maxQueueDepth: 50,
    dlqName: "rejected-dlq",
  };

  const event = factory.create(snapshot, "node-1", "tenant-1", "trace-1") as BoundedDispatchEvent;

  assert.equal(event.eventType, "platform.dispatch.queue.rejected");
  assert.equal(event.reasonCode, "queue.max_depth_exceeded");
});

// §17.1 Concurrency Tests for BoundedDispatchQueue

test("BoundedDispatchQueue concurrent event creation maintains consistency", async () => {
  const factory = new BoundedDispatchQueueEventFactory();

  const result = await runConcurrentInvariant(async (workerId: number) => {
    const snapshot: BoundedDispatchQueueSnapshot = {
      queueName: `queue-${workerId}`,
      queueDepthBefore: workerId,
      maxQueueDepth: 10,
      dlqName: "dlq",
    };
    return factory.create(snapshot, `node-${workerId}`, `tenant-${workerId}`, `trace-${workerId}`);
  }, { concurrency: 10 });

  assert.equal(result.errors.length, 0, "No errors during concurrent event creation");
  assert.equal(result.values.length, 10, "All 10 events created");

  for (const event of result.values) {
    assert.ok(event.eventType === "platform.dispatch.queue.accepted" ||
               event.eventType === "platform.dispatch.queue.rejected");
  }
});

test("BoundedDispatchQueue concurrent accepted events for same queue", async () => {
  const factory = new BoundedDispatchQueueEventFactory();

  const result = await runConcurrentInvariant(async (workerId: number) => {
    const snapshot: BoundedDispatchQueueSnapshot = {
      queueName: "shared-queue",
      queueDepthBefore: workerId,
      maxQueueDepth: 10,
      dlqName: "shared-dlq",
    };
    return factory.create(snapshot, `node-${workerId}`, "shared-tenant", "shared-trace");
  }, { concurrency: 5 });

  assert.equal(result.errors.length, 0, "No errors during concurrent event creation");

  const acceptedCount = result.values.filter(
    (e) => e.eventType === "platform.dispatch.queue.accepted"
  ).length;
  assert.ok(acceptedCount > 0, "Some events should be accepted");
});

test("BoundedDispatchQueue rejected events have correct reason code", async () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot: BoundedDispatchQueueSnapshot = {
    queueName: "overloaded-queue",
    queueDepthBefore: 100,
    maxQueueDepth: 50,
    dlqName: "overloaded-dlq",
  };

  const event = factory.create(snapshot, "node-overload", "tenant-overload", "trace-overload");

  assert.equal(event.eventType, "platform.dispatch.queue.rejected");
  assert.equal(event.reasonCode, "queue.max_depth_exceeded");
});

test("BoundedDispatchQueueEventFactory multiple create calls produce unique events", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshots: BoundedDispatchQueueSnapshot[] = [
    { queueName: "q1", queueDepthBefore: 1, maxQueueDepth: 10, dlqName: "dlq1" },
    { queueName: "q2", queueDepthBefore: 2, maxQueueDepth: 10, dlqName: "dlq2" },
    { queueName: "q3", queueDepthBefore: 9, maxQueueDepth: 10, dlqName: "dlq3" },
  ];

  const events = snapshots.map((s, i) =>
    factory.create(s, `node-${i}`, `tenant-${i}`, `trace-${i}`)
  );

  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      assert.notEqual(events[i].nodeRunId, events[j].nodeRunId);
    }
  }
});

test("BoundedDispatchQueue event types are correct values", () => {
  const factory = new BoundedDispatchQueueEventFactory();

  const acceptedSnapshot: BoundedDispatchQueueSnapshot = {
    queueName: "test",
    queueDepthBefore: 0,
    maxQueueDepth: 10,
    dlqName: "dlq",
  };
  const acceptedEvent = factory.create(acceptedSnapshot, "n1", "t1", "tr1");

  const rejectedSnapshot: BoundedDispatchQueueSnapshot = {
    queueName: "test",
    queueDepthBefore: 10,
    maxQueueDepth: 10,
    dlqName: "dlq",
  };
  const rejectedEvent = factory.create(rejectedSnapshot, "n2", "t2", "tr2");

  assert.equal(
    acceptedEvent.eventType,
    "platform.dispatch.queue.accepted"
  );
  assert.equal(
    rejectedEvent.eventType,
    "platform.dispatch.queue.rejected"
  );
});