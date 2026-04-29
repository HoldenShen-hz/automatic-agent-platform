/**
 * BoundedDispatchQueue Integration Tests
 *
 * Integration tests for BoundedDispatchQueue event types per §17.1.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  BoundedDispatchQueueEventFactory,
  type BoundedDispatchQueueSnapshot,
  type BoundedDispatchEvent,
} from "../../../../../src/platform/execution/queue/bounded-dispatch-event.js";
import { runConcurrentInvariant } from "../../../../helpers/concurrent-runner.js";

test("BoundedDispatchQueue integration: accepted event emitted when queue has capacity", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot: BoundedDispatchQueueSnapshot = {
    queueName: "integration-queue",
    queueDepthBefore: 5,
    maxQueueDepth: 10,
    dlqName: "integration-dlq",
  };

  const event = factory.create(snapshot, "node-1", "tenant-1", "trace-1");

  assert.equal(event.eventType, "platform.dispatch.queue.accepted");
  assert.equal(event.reasonCode, "queue.accepted");
  assert.equal(event.queueName, "integration-queue");
});

test("BoundedDispatchQueue integration: rejected event emitted when queue at max depth", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot: BoundedDispatchQueueSnapshot = {
    queueName: "integration-queue",
    queueDepthBefore: 10,
    maxQueueDepth: 10,
    dlqName: "integration-dlq",
  };

  const event = factory.create(snapshot, "node-1", "tenant-1", "trace-1");

  assert.equal(event.eventType, "platform.dispatch.queue.rejected");
  assert.equal(event.reasonCode, "queue.max_depth_exceeded");
});

test("BoundedDispatchQueue integration: event contains all required fields", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot: BoundedDispatchQueueSnapshot = {
    queueName: "full-event-test",
    queueDepthBefore: 5,
    maxQueueDepth: 20,
    dlqName: "full-event-dlq",
  };

  const event = factory.create(snapshot, "node-run-123", "tenant-456", "trace-789");

  assert.equal(event.eventType, "platform.dispatch.queue.accepted");
  assert.equal(event.nodeRunId, "node-run-123");
  assert.equal(event.tenantId, "tenant-456");
  assert.equal(event.traceId, "trace-789");
  assert.equal(event.queueName, "full-event-test");
  assert.equal(event.queueDepthBefore, 5);
  assert.equal(event.maxQueueDepth, 20);
  assert.equal(event.dlqName, "full-event-dlq");
  assert.equal(event.ordering_policy_version, "1.0");
  assert.equal(event.queue_class, "full-event-test");
});

test("BoundedDispatchQueue integration: events for different queues are independent", () => {
  const factory = new BoundedDispatchQueueEventFactory();

  const snapshotA: BoundedDispatchQueueSnapshot = {
    queueName: "queue-a",
    queueDepthBefore: 5,
    maxQueueDepth: 10,
    dlqName: "dlq-a",
  };
  const snapshotB: BoundedDispatchQueueSnapshot = {
    queueName: "queue-b",
    queueDepthBefore: 10,
    maxQueueDepth: 10,
    dlqName: "dlq-b",
  };

  const eventA = factory.create(snapshotA, "node-a", "tenant-a", "trace-a");
  const eventB = factory.create(snapshotB, "node-b", "tenant-b", "trace-b");

  assert.equal(eventA.eventType, "platform.dispatch.queue.accepted");
  assert.equal(eventB.eventType, "platform.dispatch.queue.rejected");
  assert.notEqual(eventA.queueName, eventB.queueName);
});

test("BoundedDispatchQueue integration: multiple accepted events with same snapshot produce consistent results", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot: BoundedDispatchQueueSnapshot = {
    queueName: "consistent-queue",
    queueDepthBefore: 3,
    maxQueueDepth: 10,
    dlqName: "consistent-dlq",
  };

  const events = Array.from({ length: 5 }, (_, i) =>
    factory.create(snapshot, `node-${i}`, `tenant-${i}`, `trace-${i}`)
  );

  for (const event of events) {
    assert.equal(event.eventType, "platform.dispatch.queue.accepted");
    assert.equal(event.queueDepthBefore, 3);
    assert.equal(event.maxQueueDepth, 10);
  }
});

test("BoundedDispatchQueue integration: events at boundary depth", () => {
  const factory = new BoundedDispatchQueueEventFactory();

  const atBoundary: BoundedDispatchQueueSnapshot = {
    queueName: "boundary-queue",
    queueDepthBefore: 9,
    maxQueueDepth: 10,
    dlqName: "boundary-dlq",
  };
  const overBoundary: BoundedDispatchQueueSnapshot = {
    queueName: "boundary-queue",
    queueDepthBefore: 10,
    maxQueueDepth: 10,
    dlqName: "boundary-dlq",
  };

  const eventAt = factory.create(atBoundary, "node-at", "tenant", "trace");
  const eventOver = factory.create(overBoundary, "node-over", "tenant", "trace");

  assert.equal(eventAt.eventType, "platform.dispatch.queue.accepted");
  assert.equal(eventOver.eventType, "platform.dispatch.queue.rejected");
});

// §17.1 Concurrency Integration Tests

test("BoundedDispatchQueue concurrent event creation maintains consistency", async () => {
  const factory = new BoundedDispatchQueueEventFactory();

  const result = await runConcurrentInvariant(async (workerId: number) => {
    const snapshot: BoundedDispatchQueueSnapshot = {
      queueName: `concurrent-queue-${workerId}`,
      queueDepthBefore: workerId,
      maxQueueDepth: 10,
      dlqName: "concurrent-dlq",
    };
    return factory.create(snapshot, `node-${workerId}`, `tenant-${workerId}`, `trace-${workerId}`);
  }, { concurrency: 10 });

  assert.equal(result.errors.length, 0, "No errors during concurrent event creation");
  assert.equal(result.values.length, 10, "All 10 events created");

  for (const event of result.values) {
    assert.ok(
      event.eventType === "platform.dispatch.queue.accepted" ||
      event.eventType === "platform.dispatch.queue.rejected"
    );
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

test("BoundedDispatchQueue concurrent mixed depth events", async () => {
  const factory = new BoundedDispatchQueueEventFactory();

  const result = await runConcurrentInvariant(async (workerId: number) => {
    const isAccepted = workerId < 5;
    const snapshot: BoundedDispatchQueueSnapshot = {
      queueName: "mixed-queue",
      queueDepthBefore: isAccepted ? 3 : 10,
      maxQueueDepth: 10,
      dlqName: "mixed-dlq",
    };
    return factory.create(snapshot, `node-${workerId}`, "tenant", "trace");
  }, { concurrency: 10 });

  assert.equal(result.errors.length, 0, "No errors during concurrent event creation");

  const acceptedCount = result.values.filter(
    (e) => e.eventType === "platform.dispatch.queue.accepted"
  ).length;
  const rejectedCount = result.values.filter(
    (e) => e.eventType === "platform.dispatch.queue.rejected"
  ).length;

  assert.ok(acceptedCount > 0, "Some events should be accepted");
  assert.ok(rejectedCount > 0, "Some events should be rejected");
});