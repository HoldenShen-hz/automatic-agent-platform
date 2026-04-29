import assert from "node:assert/strict";
import test from "node:test";

import { TicketPriorityQueue } from "../../../../../src/platform/five-plane-execution/queue/ticket-priority-queue.js";

test("ticket-priority-queue: higher priority tickets are dequeued first", () => {
  const queue = new TicketPriorityQueue();

  queue.enqueue({ payload: { id: 1 }, priority: 1 });
  queue.enqueue({ payload: { id: 2 }, priority: 10 });
  queue.enqueue({ payload: { id: 3 }, priority: 5 });

  const first = queue.dequeue();
  const second = queue.dequeue();
  const third = queue.dequeue();

  assert.ok(first);
  assert.ok(second);
  assert.ok(third);
  assert.equal((first!.payload as { id: number }).id, 2); // priority 10
  assert.equal((second!.payload as { id: number }).id, 3); // priority 5
  assert.equal((third!.payload as { id: number }).id, 1); // priority 1
});

test("ticket-priority-queue: FIFO ordering for same priority tickets", () => {
  const queue = new TicketPriorityQueue();

  queue.enqueue({ payload: { id: 1 }, priority: 5 });
  queue.enqueue({ payload: { id: 2 }, priority: 5 });
  queue.enqueue({ payload: { id: 3 }, priority: 5 });

  const first = queue.dequeue();
  const second = queue.dequeue();
  const third = queue.dequeue();

  assert.ok(first);
  assert.ok(second);
  assert.ok(third);
  assert.equal((first!.payload as { id: number }).id, 1);
  assert.equal((second!.payload as { id: number }).id, 2);
  assert.equal((third!.payload as { id: number }).id, 3);
});

test("ticket-priority-queue: empty queue returns null on dequeue", () => {
  const queue = new TicketPriorityQueue();

  const result = queue.dequeue();

  assert.equal(result, null);
});

test("ticket-priority-queue: queue size is tracked correctly", () => {
  const queue = new TicketPriorityQueue();

  assert.equal(queue.size, 0);

  queue.enqueue({ payload: { id: 1 }, priority: 1 });
  assert.equal(queue.size, 1);

  queue.enqueue({ payload: { id: 2 }, priority: 2 });
  assert.equal(queue.size, 2);

  queue.enqueue({ payload: { id: 3 }, priority: 3 });
  assert.equal(queue.size, 3);

  queue.dequeue();
  assert.equal(queue.size, 2);

  queue.dequeue();
  assert.equal(queue.size, 1);

  queue.dequeue();
  assert.equal(queue.size, 0);

  const result = queue.dequeue();
  assert.equal(result, null);
  assert.equal(queue.size, 0);
});

test("ticket-priority-queue: dispatchAfter is respected for delayed dispatch", () => {
  const queue = new TicketPriorityQueue();
  const pastDate = "2020-01-01T00:00:00.000Z";
  const futureDate = "2099-01-01T00:00:00.000Z";

  // Enqueue a delayed ticket with high priority
  queue.enqueue({ payload: { id: 1 }, priority: 10, dispatchAfter: futureDate });
  // Enqueue an immediate ticket with low priority
  queue.enqueue({ payload: { id: 2 }, priority: 1, dispatchAfter: null });

  // The immediate ticket should be dequeued first despite lower priority
  const first = queue.dequeue();
  assert.ok(first);
  assert.equal((first!.payload as { id: number }).id, 2);

  // The delayed high-priority ticket should still be in queue
  assert.equal(queue.size, 1);

  // Trying to dequeue again should return null since the delayed ticket is not yet ready
  const second = queue.dequeue();
  assert.equal(second, null);

  // Now enqueue another past-dated ticket
  queue.enqueue({ payload: { id: 3 }, priority: 5, dispatchAfter: pastDate });

  const third = queue.dequeue();
  assert.ok(third);
  assert.equal((third!.payload as { id: number }).id, 3);
});

test("ticket-priority-queue: negative priority values are handled correctly", () => {
  const queue = new TicketPriorityQueue();

  queue.enqueue({ payload: { id: 1 }, priority: -10 });
  queue.enqueue({ payload: { id: 2 }, priority: 0 });
  queue.enqueue({ payload: { id: 3 }, priority: 10 });

  const first = queue.dequeue();
  const second = queue.dequeue();
  const third = queue.dequeue();

  assert.ok(first);
  assert.ok(second);
  assert.ok(third);
  assert.equal((first!.payload as { id: number }).id, 3); // priority 10
  assert.equal((second!.payload as { id: number }).id, 2); // priority 0
  assert.equal((third!.payload as { id: number }).id, 1); // priority -10
});

test("ticket-priority-queue: default priority is zero", () => {
  const queue = new TicketPriorityQueue();

  queue.enqueue({ payload: { id: 1 } }); // default priority 0
  queue.enqueue({ payload: { id: 2 }, priority: -5 });

  const first = queue.dequeue();
  const second = queue.dequeue();

  assert.ok(first);
  assert.ok(second);
  assert.equal((first!.payload as { id: number }).id, 1); // priority 0
  assert.equal((second!.payload as { id: number }).id, 2); // priority -5
});

test("ticket-priority-queue: peek returns next ticket without removing it", () => {
  const queue = new TicketPriorityQueue();

  assert.equal(queue.peek(), null);

  queue.enqueue({ payload: { id: 1 }, priority: 5 });
  queue.enqueue({ payload: { id: 2 }, priority: 10 });

  const peeked = queue.peek();
  assert.ok(peeked);
  assert.equal((peeked!.payload as { id: number }).id, 2); // highest priority

  // Queue size should not change
  assert.equal(queue.size, 2);

  // Dequeue should return the same ticket
  const dequeued = queue.dequeue();
  assert.equal(dequeued!.id, peeked!.id);
});

test("ticket-priority-queue: clear removes all tickets", () => {
  const queue = new TicketPriorityQueue();

  queue.enqueue({ payload: { id: 1 }, priority: 1 });
  queue.enqueue({ payload: { id: 2 }, priority: 2 });

  assert.equal(queue.size, 2);

  queue.clear();

  assert.equal(queue.size, 0);
  assert.equal(queue.dequeue(), null);
});

test("ticket-priority-queue: mixed priorities and dispatch times", () => {
  const queue = new TicketPriorityQueue();
  const pastDate = "2020-01-01T00:00:00.000Z";
  const futureDate = "2099-01-01T00:00:00.000Z";

  // Low priority, immediate
  queue.enqueue({ payload: { id: 1 }, priority: 1, dispatchAfter: null });
  // High priority, delayed
  queue.enqueue({ payload: { id: 2 }, priority: 100, dispatchAfter: futureDate });
  // Medium priority, immediate
  queue.enqueue({ payload: { id: 3 }, priority: 50, dispatchAfter: null });
  // High priority, immediate
  queue.enqueue({ payload: { id: 4 }, priority: 100, dispatchAfter: null });

  // First: highest priority immediate (id: 4)
  const first = queue.dequeue();
  assert.ok(first);
  assert.equal((first!.payload as { id: number }).id, 4);

  // Second: medium priority immediate (id: 3)
  const second = queue.dequeue();
  assert.ok(second);
  assert.equal((second!.payload as { id: number }).id, 3);

  // Third: low priority immediate (id: 1)
  const third = queue.dequeue();
  assert.ok(third);
  assert.equal((third!.payload as { id: number }).id, 1);

  // Fourth: high priority but delayed - still in queue
  assert.equal(queue.size, 1);

  // Dequeue returns null since only remaining ticket is delayed
  const fourth = queue.dequeue();
  assert.equal(fourth, null);

  // Now make the delayed ticket available
  queue.enqueue({ payload: { id: 5 }, priority: 100, dispatchAfter: pastDate });

  const fifth = queue.dequeue();
  assert.ok(fifth);
  assert.equal((fifth!.payload as { id: number }).id, 5);
});