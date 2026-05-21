/**
 * @fileoverview Comprehensive edge case tests for BoundedDispatchEvent
 *
 * Tests edge cases, boundary conditions, and error scenarios for the
 * BoundedDispatchQueueEventFactory and BoundedDispatchEvent types.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  BoundedDispatchQueueEventFactory,
  type BoundedDispatchQueueSnapshot,
  type BoundedDispatchEvent,
} from "../../../../../src/platform/five-plane-execution/queue/bounded-dispatch-event.js";

function makeSnapshot(overrides: Partial<BoundedDispatchQueueSnapshot> = {}): BoundedDispatchQueueSnapshot {
  return {
    queueName: "test-queue",
    queueDepthBefore: 5,
    maxQueueDepth: 10,
    dlqName: "test-dlq",
    ...overrides,
  };
}

test("BoundedDispatchQueueEventFactory rejects when queueDepthBefore exceeds maxQueueDepth", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot = makeSnapshot({ queueDepthBefore: 15, maxQueueDepth: 10 });

  const event = factory.create(snapshot, "nr-123", "tenant-1", "trace-abc");

  assert.equal(event.eventType, "platform.dispatch.queue.rejected");
  assert.equal(event.reasonCode, "queue.max_depth_exceeded");
});

test("BoundedDispatchQueueEventFactory accepts when queueDepthBefore equals maxQueueDepth - 1", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot = makeSnapshot({ queueDepthBefore: 9, maxQueueDepth: 10 });

  const event = factory.create(snapshot, "nr-123", "tenant-1", "trace-abc");

  assert.equal(event.eventType, "platform.dispatch.queue.accepted");
  assert.equal(event.reasonCode, "queue.accepted");
});

test("BoundedDispatchQueueEventFactory rejects when queueDepthBefore equals maxQueueDepth", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot = makeSnapshot({ queueDepthBefore: 10, maxQueueDepth: 10 });

  const event = factory.create(snapshot, "nr-123", "tenant-1", "trace-abc");

  assert.equal(event.eventType, "platform.dispatch.queue.rejected");
  assert.equal(event.reasonCode, "queue.max_depth_exceeded");
});

test("BoundedDispatchQueueEventFactory accepts zero queue depth", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot = makeSnapshot({ queueDepthBefore: 0, maxQueueDepth: 10 });

  const event = factory.create(snapshot, "nr-123", "tenant-1", "trace-abc");

  assert.equal(event.eventType, "platform.dispatch.queue.accepted");
  assert.equal(event.queueDepthBefore, 0);
});

test("BoundedDispatchQueueEventFactory accepts very large maxQueueDepth", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot = makeSnapshot({ queueDepthBefore: 1000, maxQueueDepth: 10000 });

  const event = factory.create(snapshot, "nr-123", "tenant-1", "trace-abc");

  assert.equal(event.eventType, "platform.dispatch.queue.accepted");
});

test("BoundedDispatchQueueEventFactory handles very large queue depth values", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot = makeSnapshot({ queueDepthBefore: 999999, maxQueueDepth: 1000000 });

  const event = factory.create(snapshot, "nr-123", "tenant-1", "trace-abc");

  assert.equal(event.eventType, "platform.dispatch.queue.accepted");
  assert.equal(event.queueDepthBefore, 999999);
});

test("BoundedDispatchQueueEventFactory handles negative queue depth as accepted", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot = makeSnapshot({ queueDepthBefore: -1, maxQueueDepth: 10 });

  const event = factory.create(snapshot, "nr-123", "tenant-1", "trace-abc");

  // Negative depth is still less than max, so accepted
  assert.equal(event.eventType, "platform.dispatch.queue.accepted");
  assert.equal(event.queueDepthBefore, -1);
});

test("BoundedDispatchQueueEventFactory creates event with full input object signature", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot = makeSnapshot({ queueName: "custom-queue", dlqName: "custom-dlq" });

  const event = factory.create({
    queueName: "custom-queue",
    nodeRunId: "node-custom",
    tenantId: "tenant-custom",
    traceId: "trace-custom",
    orderingPolicyVersion: "2.0",
    queueClass: "custom-class",
    snapshot,
    harnessRunId: "harness-custom",
    executionId: "exec-custom",
  });

  assert.equal(event.queueName, "custom-queue");
  assert.equal(event.nodeRunId, "node-custom");
  assert.equal(event.tenantId, "tenant-custom");
  assert.equal(event.traceId, "trace-custom");
  assert.equal(event.orderingPolicyVersion, "2.0");
  assert.equal(event.queueClass, "custom-class");
  assert.equal(event.harnessRunId, "harness-custom");
  assert.equal(event.executionId, "exec-custom");
});

test("BoundedDispatchQueueEventFactory omits harnessRunId when not provided", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot = makeSnapshot();

  const event = factory.create({
    queueName: "test",
    nodeRunId: "node-1",
    tenantId: "tenant-1",
    traceId: "trace-1",
    orderingPolicyVersion: "1.0",
    queueClass: "standard",
    snapshot,
  });

  assert.equal(event.harnessRunId, undefined);
  assert.equal("harnessRunId" in event, false);
});

test("BoundedDispatchQueueEventFactory omits executionId when not provided", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot = makeSnapshot();

  const event = factory.create({
    queueName: "test",
    nodeRunId: "node-1",
    tenantId: "tenant-1",
    traceId: "trace-1",
    orderingPolicyVersion: "1.0",
    queueClass: "standard",
    snapshot,
  });

  assert.equal(event.executionId, undefined);
  assert.equal("executionId" in event, false);
});

test("BoundedDispatchQueueEventFactory includes harnessRunId when explicitly undefined", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot = makeSnapshot();

  const event = factory.create({
    queueName: "test",
    nodeRunId: "node-1",
    tenantId: "tenant-1",
    traceId: "trace-1",
    orderingPolicyVersion: "1.0",
    queueClass: "standard",
    snapshot,
    harnessRunId: undefined,
    executionId: undefined,
  });

  // When explicitly undefined, field is still omitted in spread
  assert.equal(event.harnessRunId, undefined);
});

test("BoundedDispatchQueueEventFactory positional signature uses snapshot queueName as default queueClass", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot = makeSnapshot({ queueName: "my-special-queue" });

  const event = factory.create(snapshot, "node-1", "tenant-1", "trace-1");

  assert.equal(event.queueClass, "my-special-queue");
  assert.equal(event.queue_class, "my-special-queue");
});

test("BoundedDispatchQueueEventFactory positional signature defaults orderingPolicyVersion to 1.0", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot = makeSnapshot();

  const event = factory.create(snapshot, "node-1", "tenant-1", "trace-1");

  assert.equal(event.orderingPolicyVersion, "1.0");
  assert.equal(event.ordering_policy_version, "1.0");
});

test("BoundedDispatchQueueEventFactory input object signature preserves custom orderingPolicyVersion", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot = makeSnapshot();

  const event = factory.create({
    queueName: "test",
    nodeRunId: "node-1",
    tenantId: "tenant-1",
    traceId: "trace-1",
    orderingPolicyVersion: "3.0",
    queueClass: "priority",
    snapshot,
  });

  assert.equal(event.orderingPolicyVersion, "3.0");
  assert.equal(event.ordering_policy_version, "3.0");
});

test("BoundedDispatchQueueEventFactory both signatures produce same eventType for same snapshot", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot = makeSnapshot({ queueDepthBefore: 5, maxQueueDepth: 10 });

  const eventPositional = factory.create(snapshot, "node-1", "tenant-1", "trace-1");
  const eventInputObject = factory.create({
    queueName: snapshot.queueName,
    nodeRunId: "node-1",
    tenantId: "tenant-1",
    traceId: "trace-1",
    orderingPolicyVersion: "1.0",
    queueClass: snapshot.queueName,
    snapshot,
  });

  assert.equal(eventPositional.eventType, eventInputObject.eventType);
  assert.equal(eventPositional.reasonCode, eventInputObject.reasonCode);
});

test("BoundedDispatchQueueEventFactory both signatures produce same eventType for full snapshot", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot = makeSnapshot({ queueDepthBefore: 10, maxQueueDepth: 10 });

  const eventPositional = factory.create(snapshot, "node-1", "tenant-1", "trace-1");
  const eventInputObject = factory.create({
    queueName: snapshot.queueName,
    nodeRunId: "node-1",
    tenantId: "tenant-1",
    traceId: "trace-1",
    orderingPolicyVersion: "1.0",
    queueClass: snapshot.queueName,
    snapshot,
  });

  assert.equal(eventPositional.eventType, eventInputObject.eventType);
  assert.equal(eventPositional.reasonCode, eventInputObject.reasonCode);
});

test("BoundedDispatchEvent type accepts all valid eventType values", () => {
  const acceptedEvent: BoundedDispatchEvent = {
    eventType: "platform.dispatch.queue.accepted",
    queueName: "test",
    nodeRunId: "node-1",
    tenantId: "tenant-1",
    traceId: "trace-1",
    orderingPolicyVersion: "1.0",
    ordering_policy_version: "1.0",
    queueClass: "standard",
    queue_class: "standard",
    queueDepthBefore: 5,
    maxQueueDepth: 10,
    dlqName: "dlq",
    reasonCode: "queue.accepted",
  };

  const rejectedEvent: BoundedDispatchEvent = {
    eventType: "platform.dispatch.queue.rejected",
    queueName: "test",
    nodeRunId: "node-1",
    tenantId: "tenant-1",
    traceId: "trace-1",
    orderingPolicyVersion: "1.0",
    ordering_policy_version: "1.0",
    queueClass: "standard",
    queue_class: "standard",
    queueDepthBefore: 10,
    maxQueueDepth: 10,
    dlqName: "dlq",
    reasonCode: "queue.max_depth_exceeded",
  };

  assert.equal(acceptedEvent.eventType, "platform.dispatch.queue.accepted");
  assert.equal(rejectedEvent.eventType, "platform.dispatch.queue.rejected");
});

test("BoundedDispatchEvent type accepts all valid reasonCode values", () => {
  const acceptedEvent: BoundedDispatchEvent = {
    eventType: "platform.dispatch.queue.accepted",
    queueName: "test",
    nodeRunId: "node-1",
    tenantId: "tenant-1",
    traceId: "trace-1",
    orderingPolicyVersion: "1.0",
    ordering_policy_version: "1.0",
    queueClass: "standard",
    queue_class: "standard",
    queueDepthBefore: 5,
    maxQueueDepth: 10,
    dlqName: "dlq",
    reasonCode: "queue.accepted",
  };

  const rejectedEvent: BoundedDispatchEvent = {
    eventType: "platform.dispatch.queue.rejected",
    queueName: "test",
    nodeRunId: "node-1",
    tenantId: "tenant-1",
    traceId: "trace-1",
    orderingPolicyVersion: "1.0",
    ordering_policy_version: "1.0",
    queueClass: "standard",
    queue_class: "standard",
    queueDepthBefore: 10,
    maxQueueDepth: 10,
    dlqName: "dlq",
    reasonCode: "queue.max_depth_exceeded",
  };

  assert.equal(acceptedEvent.reasonCode, "queue.accepted");
  assert.equal(rejectedEvent.reasonCode, "queue.max_depth_exceeded");
});

test("BoundedDispatchQueueSnapshot type accepts all required fields", () => {
  const snapshot: BoundedDispatchQueueSnapshot = {
    queueName: "full-test-queue",
    queueDepthBefore: 50,
    maxQueueDepth: 100,
    dlqName: "full-test-dlq",
  };

  assert.equal(snapshot.queueName, "full-test-queue");
  assert.equal(snapshot.queueDepthBefore, 50);
  assert.equal(snapshot.maxQueueDepth, 100);
  assert.equal(snapshot.dlqName, "full-test-dlq");
});

test("BoundedDispatchQueueEventFactory handles empty string nodeRunId", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot = makeSnapshot();

  const event = factory.create(snapshot, "", "tenant-1", "trace-1");

  assert.equal(event.nodeRunId, "");
});

test("BoundedDispatchQueueEventFactory handles empty string tenantId", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot = makeSnapshot();

  const event = factory.create(snapshot, "node-1", "", "trace-1");

  assert.equal(event.tenantId, "");
});

test("BoundedDispatchQueueEventFactory handles empty string traceId", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot = makeSnapshot();

  const event = factory.create(snapshot, "node-1", "tenant-1", "");

  assert.equal(event.traceId, "");
});

test("BoundedDispatchQueueEventFactory handles special characters in queueName", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot = makeSnapshot({ queueName: "queue/with/slashes" });

  const event = factory.create(snapshot, "node-1", "tenant-1", "trace-1");

  assert.equal(event.queueName, "queue/with/slashes");
});

test("BoundedDispatchQueueEventFactory handles unicode in tenantId", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot = makeSnapshot();

  const event = factory.create(snapshot, "node-1", "tenant-中文", "trace-1");

  assert.equal(event.tenantId, "tenant-中文");
});

test("BoundedDispatchQueueEventFactory handles very long queue class names", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const longClassName = "a".repeat(1000);
  const snapshot = makeSnapshot();

  const event = factory.create({
    queueName: "test",
    nodeRunId: "node-1",
    tenantId: "tenant-1",
    traceId: "trace-1",
    orderingPolicyVersion: "1.0",
    queueClass: longClassName,
    snapshot,
  });

  assert.equal(event.queueClass, longClassName);
  assert.equal(event.queue_class, longClassName);
});

test("BoundedDispatchQueueEventFactory preserves all snapshot fields in output event", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot = makeSnapshot({
    queueName: "preserve-test-queue",
    queueDepthBefore: 42,
    maxQueueDepth: 100,
    dlqName: "preserve-test-dlq",
  });

  const event = factory.create(snapshot, "node-1", "tenant-1", "trace-1");

  assert.equal(event.queueName, snapshot.queueName);
  assert.equal(event.queueDepthBefore, snapshot.queueDepthBefore);
  assert.equal(event.maxQueueDepth, snapshot.maxQueueDepth);
  assert.equal(event.dlqName, snapshot.dlqName);
});

test("BoundedDispatchQueueEventFactory create method is chainable with multiple calls", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot1 = makeSnapshot({ queueDepthBefore: 5, maxQueueDepth: 10 });
  const snapshot2 = makeSnapshot({ queueDepthBefore: 10, maxQueueDepth: 10 });

  const event1 = factory.create(snapshot1, "node-1", "tenant-1", "trace-1");
  const event2 = factory.create(snapshot2, "node-2", "tenant-2", "trace-2");

  assert.equal(event1.eventType, "platform.dispatch.queue.accepted");
  assert.equal(event2.eventType, "platform.dispatch.queue.rejected");
});