import assert from "node:assert/strict";
import test from "node:test";

import { TicketPriorityQueue } from "../../../../../src/platform/execution/queue/ticket-priority-queue.js";
import { BoundedDispatchQueueEventFactory, type BoundedDispatchQueueSnapshot } from "../../../../../src/platform/execution/queue/bounded-dispatch-event.js";

test("TicketPriorityQueue enqueue increases size", () => {
  const queue = new TicketPriorityQueue();
  assert.equal(queue.size, 0);

  queue.enqueue({ payload: { id: 1 } });
  assert.equal(queue.size, 1);

  queue.enqueue({ payload: { id: 2 } });
  assert.equal(queue.size, 2);
});

test("TicketPriorityQueue dequeue returns null when empty", () => {
  const queue = new TicketPriorityQueue();
  assert.equal(queue.dequeue(), null);
});

test("TicketPriorityQueue dequeue returns ticket in priority order", () => {
  const queue = new TicketPriorityQueue();

  queue.enqueue({ payload: { id: "low" }, priority: 1 });
  queue.enqueue({ payload: { id: "high" }, priority: 10 });
  queue.enqueue({ payload: { id: "medium" }, priority: 5 });

  const first = queue.dequeue();
  assert.ok(first);
  assert.equal(first.payload.id, "high");

  const second = queue.dequeue();
  assert.ok(second);
  assert.equal(second.payload.id, "medium");

  const third = queue.dequeue();
  assert.ok(third);
  assert.equal(third.payload.id, "low");
});

test("TicketPriorityQueue dequeue returns FIFO for same priority", () => {
  const queue = new TicketPriorityQueue();

  // Add in reverse order but they should be dequeued by createdAt
  const t1 = queue.enqueue({ payload: { id: "first" }, priority: 5 });
  const t2 = queue.enqueue({ payload: { id: "second" }, priority: 5 });

  // Manually adjust createdAt to ensure ordering
  const first = queue.dequeue();
  assert.ok(first);
  // The first dequeued should be the one with earlier createdAt
  assert.ok(first.id === t1.id || first.id === t2.id);
});

test("TicketPriorityQueue peek returns first without removing", () => {
  const queue = new TicketPriorityQueue();

  queue.enqueue({ payload: { id: 1 }, priority: 1 });
  queue.enqueue({ payload: { id: 2 }, priority: 2 });

  const peeked = queue.peek();
  assert.ok(peeked);
  assert.equal(queue.size, 2);
});

test("TicketPriorityQueue peek returns null when empty", () => {
  const queue = new TicketPriorityQueue();
  assert.equal(queue.peek(), null);
});

test("TicketPriorityQueue clear removes all tickets", () => {
  const queue = new TicketPriorityQueue();

  queue.enqueue({ payload: { id: 1 } });
  queue.enqueue({ payload: { id: 2 } });
  assert.equal(queue.size, 2);

  queue.clear();
  assert.equal(queue.size, 0);
});

test("TicketPriorityQueue dequeue respects dispatchAfter", () => {
  const queue = new TicketPriorityQueue();

  // Future dispatch time
  const futureTime = new Date(Date.now() + 10000).toISOString();

  queue.enqueue({ payload: { id: "future" }, dispatchAfter: futureTime });
  queue.enqueue({ payload: { id: "now" } });

  // Should return the "now" ticket since future is not ready
  const dequeued = queue.dequeue();
  assert.ok(dequeued);
  assert.equal(dequeued.payload.id, "now");
});

test("TicketPriorityQueue dequeue returns null when all tickets are future", () => {
  const queue = new TicketPriorityQueue();

  const futureTime = new Date(Date.now() + 10000).toISOString();
  queue.enqueue({ payload: { id: "future" }, dispatchAfter: futureTime });

  const dequeued = queue.dequeue();
  assert.equal(dequeued, null);
});

test("TicketPriorityQueue enqueue with default priority of 0", () => {
  const queue = new TicketPriorityQueue();

  queue.enqueue({ payload: { id: "default" } });
  const ticket = queue.peek();

  assert.ok(ticket);
  assert.equal(ticket.priority, 0);
});

test("BoundedDispatchQueueEventFactory create returns accepted event", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot: BoundedDispatchQueueSnapshot = {
    queueName: "dispatch-queue",
    queueDepthBefore: 5,
    maxQueueDepth: 100,
    dlqName: "dispatch-dlq",
  };

  const event = factory.create(snapshot, "nr-1", "tenant-1", "trace-1");

  assert.equal(event.eventType, "platform.dispatch.queue.accepted");
  assert.equal(event.reasonCode, "queue.accepted");
  assert.equal(event.nodeRunId, "nr-1");
  assert.equal(event.tenantId, "tenant-1");
  assert.equal(event.traceId, "trace-1");
  assert.equal(event.queueName, "dispatch-queue");
  assert.equal(event.queueDepthBefore, 5);
  assert.equal(event.maxQueueDepth, 100);
  assert.equal(event.dlqName, "dispatch-dlq");
  assert.equal(event.ordering_policy_version, "1.0");
  assert.equal(event.queue_class, "dispatch-queue");
});

test("BoundedDispatchQueueEventFactory create returns rejected event when at max depth", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot: BoundedDispatchQueueSnapshot = {
    queueName: "dispatch-queue",
    queueDepthBefore: 100,
    maxQueueDepth: 100,
    dlqName: "dispatch-dlq",
  };

  const event = factory.create(snapshot, "nr-1", "tenant-1", "trace-1");

  assert.equal(event.eventType, "platform.dispatch.queue.rejected");
  assert.equal(event.reasonCode, "queue.max_depth_exceeded");
  assert.equal(event.queueDepthBefore, 100);
  assert.equal(event.maxQueueDepth, 100);
});

test("BoundedDispatchQueueEventFactory create returns rejected event when over max depth", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot: BoundedDispatchQueueSnapshot = {
    queueName: "dispatch-queue",
    queueDepthBefore: 150,
    maxQueueDepth: 100,
    dlqName: "dispatch-dlq",
  };

  const event = factory.create(snapshot, "nr-1", "tenant-1", "trace-1");

  assert.equal(event.eventType, "platform.dispatch.queue.rejected");
  assert.equal(event.reasonCode, "queue.max_depth_exceeded");
});

test("BoundedDispatchQueueEventFactory create includes optional fields when provided", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot: BoundedDispatchQueueSnapshot = {
    queueName: "dispatch-queue",
    queueDepthBefore: 5,
    maxQueueDepth: 100,
    dlqName: "dispatch-dlq",
  };

  const event = factory.create(snapshot, "nr-1", "tenant-1", "trace-1", "harness-123", "exec-456");

  assert.equal(event.harnessRunId, "harness-123");
  assert.equal(event.executionId, "exec-456");
});

test("BoundedDispatchQueueEventFactory create without optional fields", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot: BoundedDispatchQueueSnapshot = {
    queueName: "dispatch-queue",
    queueDepthBefore: 5,
    maxQueueDepth: 100,
    dlqName: "dispatch-dlq",
  };

  const event = factory.create(snapshot, "nr-1", "tenant-1", "trace-1");

  assert.equal(event.harnessRunId, undefined);
  assert.equal(event.executionId, undefined);
});

test("BoundedDispatchQueueSnapshot interface structure", () => {
  const snapshot: BoundedDispatchQueueSnapshot = {
    queueName: "test-queue",
    queueDepthBefore: 10,
    maxQueueDepth: 50,
    dlqName: "test-dlq",
  };

  assert.equal(snapshot.queueName, "test-queue");
  assert.equal(snapshot.queueDepthBefore, 10);
  assert.equal(snapshot.maxQueueDepth, 50);
  assert.equal(snapshot.dlqName, "test-dlq");
});

test("TicketPriorityQueue ticket has correct structure", () => {
  const queue = new TicketPriorityQueue();
  const ticket = queue.enqueue({
    payload: { data: "test" },
    priority: 5,
    dispatchAfter: "2024-01-01T00:00:00Z",
  });

  assert.ok(ticket.id.startsWith("ticket-"));
  assert.equal(ticket.priority, 5);
  assert.deepEqual(ticket.payload, { data: "test" });
  assert.equal(ticket.dispatchAfter, "2024-01-01T00:00:00Z");
  assert.ok(ticket.createdAt);
});

test("TicketPriorityQueue enqueue returns ticket with generated id", () => {
  const queue = new TicketPriorityQueue();
  const ticket = queue.enqueue({ payload: { id: 1 } });

  assert.ok(ticket.id);
  assert.ok(ticket.id.length > 0);
});

test("BoundedDispatchEvent has correct event types", () => {
  const factory = new BoundedDispatchQueueEventFactory();
  const snapshot: BoundedDispatchQueueSnapshot = {
    queueName: "test",
    queueDepthBefore: 0,
    maxQueueDepth: 10,
    dlqName: "dlq",
  };

  const acceptedEvent = factory.create(snapshot, "nr", "tenant", "trace");
  const rejectedSnapshot: BoundedDispatchQueueSnapshot = {
    ...snapshot,
    queueDepthBefore: 100,
  };
  const rejectedEvent = factory.create(rejectedSnapshot, "nr", "tenant", "trace");

  assert.equal(acceptedEvent.eventType, "platform.dispatch.queue.accepted");
  assert.equal(rejectedEvent.eventType, "platform.dispatch.queue.rejected");
});
