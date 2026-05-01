import assert from "node:assert/strict";
import test from "node:test";

import {
  BoundedDispatchQueueEventFactory,
  type BoundedDispatchQueueSnapshot,
  type BoundedDispatchEvent,
} from "../../../../../src/platform/execution/queue/bounded-dispatch-event.js";

test("BoundedDispatchQueueEventFactory.create returns accepted event when queue has capacity", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot: BoundedDispatchQueueSnapshot = {
    queueName: "test-queue",
    queueDepthBefore: 5,
    maxQueueDepth: 10,
    dlqName: "test-dlq",
  };

  const event = factory.create(snapshot, "nr-123", "tenant-1", "trace-abc");

  assert.equal(event.eventType, "platform.dispatch.queue.accepted");
  assert.equal(event.nodeRunId, "nr-123");
  assert.equal(event.tenantId, "tenant-1");
  assert.equal(event.traceId, "trace-abc");
  assert.equal(event.queueName, "test-queue");
  assert.equal(event.queueDepthBefore, 5);
  assert.equal(event.maxQueueDepth, 10);
  assert.equal(event.dlqName, "test-dlq");
  assert.equal(event.reasonCode, "queue.accepted");
  assert.equal(event.ordering_policy_version, "1.0");
  assert.equal(event.queue_class, "test-queue");
});

test("BoundedDispatchQueueEventFactory.create returns rejected event when queue is at max depth", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot: BoundedDispatchQueueSnapshot = {
    queueName: "full-queue",
    queueDepthBefore: 10,
    maxQueueDepth: 10,
    dlqName: "full-dlq",
  };

  const event = factory.create(snapshot, "nr-456", "tenant-2", "trace-def");

  assert.equal(event.eventType, "platform.dispatch.queue.rejected");
  assert.equal(event.reasonCode, "queue.max_depth_exceeded");
  assert.equal(event.queueDepthBefore, 10);
  assert.equal(event.maxQueueDepth, 10);
});

test("BoundedDispatchQueueEventFactory.create returns rejected when queue exceeds max depth", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot: BoundedDispatchQueueSnapshot = {
    queueName: "overflow-queue",
    queueDepthBefore: 15,
    maxQueueDepth: 10,
    dlqName: "overflow-dlq",
  };

  const event = factory.create(snapshot, "nr-789", "tenant-3", "trace-ghi");

  assert.equal(event.eventType, "platform.dispatch.queue.rejected");
  assert.equal(event.reasonCode, "queue.max_depth_exceeded");
  assert.equal(event.queueDepthBefore, 15);
});

test("BoundedDispatchQueueEventFactory.create includes optional harnessRunId and executionId", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot: BoundedDispatchQueueSnapshot = {
    queueName: "test-queue",
    queueDepthBefore: 5,
    maxQueueDepth: 10,
    dlqName: "test-dlq",
  };

  const event = factory.create(snapshot, "nr-123", "tenant-1", "trace-abc", "harness-1", "exec-1");

  assert.equal(event.harnessRunId, "harness-1");
  assert.equal(event.executionId, "exec-1");
});

test("BoundedDispatchQueueEventFactory.create handles zero queue depth", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot: BoundedDispatchQueueSnapshot = {
    queueName: "empty-queue",
    queueDepthBefore: 0,
    maxQueueDepth: 100,
    dlqName: "empty-dlq",
  };

  const event = factory.create(snapshot, "nr-123", "tenant-1", "trace-abc");

  assert.equal(event.eventType, "platform.dispatch.queue.accepted");
  assert.equal(event.reasonCode, "queue.accepted");
});

test("BoundedDispatchQueueEventFactory.create uses queueName as queue_class", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot: BoundedDispatchQueueSnapshot = {
    queueName: "priority-queue",
    queueDepthBefore: 1,
    maxQueueDepth: 50,
    dlqName: "priority-dlq",
  };

  const event = factory.create(snapshot, "nr-123", "tenant-1", "trace-abc");

  assert.equal(event.queue_class, "priority-queue");
});

test("BoundedDispatchQueueSnapshot type accepts valid values", () => {
  const snapshot: BoundedDispatchQueueSnapshot = {
    queueName: "test",
    queueDepthBefore: 5,
    maxQueueDepth: 10,
    dlqName: "test-dlq",
  };

  assert.equal(snapshot.queueName, "test");
  assert.equal(snapshot.queueDepthBefore, 5);
  assert.equal(snapshot.maxQueueDepth, 10);
});

test("BoundedDispatchEvent reasonCode is either accepted or max_depth_exceeded", () => {
  const factory = new BoundedDispatchQueueEventFactory();

  const acceptedSnapshot: BoundedDispatchQueueSnapshot = {
    queueName: "q",
    queueDepthBefore: 1,
    maxQueueDepth: 10,
    dlqName: "dlq",
  };
  const acceptedEvent = factory.create(acceptedSnapshot, "nr", "tenant", "trace");
  assert.equal(acceptedEvent.reasonCode, "queue.accepted");

  const rejectedSnapshot: BoundedDispatchQueueSnapshot = {
    queueName: "q",
    queueDepthBefore: 10,
    maxQueueDepth: 10,
    dlqName: "dlq",
  };
  const rejectedEvent = factory.create(rejectedSnapshot, "nr", "tenant", "trace");
  assert.equal(rejectedEvent.reasonCode, "queue.max_depth_exceeded");
});