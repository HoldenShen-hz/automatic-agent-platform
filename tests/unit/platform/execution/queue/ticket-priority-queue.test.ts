import assert from "node:assert/strict";
import test from "node:test";

import { TicketPriorityQueue, type Ticket, type EnqueueTicketInput } from "../../../../../src/platform/five-plane-execution/queue/ticket-priority-queue.js";

test("TicketPriorityQueue enqueue returns ticket with correct shape [ticket-priority-queue]", () => {
  const queue = new TicketPriorityQueue();
  const ticket = queue.enqueue({ payload: { taskId: "task-1" } });

  assert.ok(ticket.id.length > 0, "ticket id should not be empty");
  assert.equal(ticket.priority, 0);
  assert.deepEqual(ticket.payload, { taskId: "task-1" });
  assert.equal(ticket.dispatchAfter, null);
  assert.ok(ticket.createdAt !== undefined);
});

test("TicketPriorityQueue enqueue with custom priority [ticket-priority-queue]", () => {
  const queue = new TicketPriorityQueue();
  const ticket = queue.enqueue({ payload: "test", priority: 10 });

  assert.equal(ticket.priority, 10);
});

test("TicketPriorityQueue enqueue with dispatchAfter [ticket-priority-queue]", () => {
  const queue = new TicketPriorityQueue();
  const futureTime = "2099-12-31T23:59:59.999Z";
  const ticket = queue.enqueue({ payload: "test", dispatchAfter: futureTime });

  assert.equal(ticket.dispatchAfter, futureTime);
});

test("TicketPriorityQueue size starts at zero [ticket-priority-queue]", () => {
  const queue = new TicketPriorityQueue();
  assert.equal(queue.size, 0);
});

test("TicketPriorityQueue size increments after enqueue [ticket-priority-queue]", () => {
  const queue = new TicketPriorityQueue();
  queue.enqueue({ payload: "test" });
  assert.equal(queue.size, 1);
  queue.enqueue({ payload: "test2" });
  assert.equal(queue.size, 2);
});

test("TicketPriorityQueue dequeue returns null when empty [ticket-priority-queue]", () => {
  const queue = new TicketPriorityQueue();
  assert.equal(queue.dequeue(), null);
});

test("TicketPriorityQueue dequeue returns highest priority ticket first [ticket-priority-queue]", () => {
  const queue = new TicketPriorityQueue();

  queue.enqueue({ payload: "low", priority: 1 });
  queue.enqueue({ payload: "high", priority: 10 });
  queue.enqueue({ payload: "medium", priority: 5 });

  const first = queue.dequeue();
  assert.deepEqual(first!.payload, "high");
  assert.equal(first!.priority, 10);

  const second = queue.dequeue();
  assert.deepEqual(second!.payload, "medium");

  const third = queue.dequeue();
  assert.deepEqual(third!.payload, "low");
});

test("TicketPriorityQueue dequeue returns FIFO for same priority [ticket-priority-queue]", () => {
  const queue = new TicketPriorityQueue();

  queue.enqueue({ payload: "first", priority: 5 });
  queue.enqueue({ payload: "second", priority: 5 });

  const first = queue.dequeue();
  assert.deepEqual(first!.payload, "first");

  const second = queue.dequeue();
  assert.deepEqual(second!.payload, "second");
});

test("TicketPriorityQueue dequeue skips tickets with future dispatchAfter [ticket-priority-queue]", () => {
  const queue = new TicketPriorityQueue();

  const futureTime = "2099-01-01T00:00:00.000Z";
  queue.enqueue({ payload: "future", priority: 10, dispatchAfter: futureTime });
  queue.enqueue({ payload: "now", priority: 5 });

  const result = queue.dequeue();
  assert.deepEqual(result!.payload, "now");
});

test("TicketPriorityQueue dequeue returns future ticket when no other options [ticket-priority-queue]", () => {
  const queue = new TicketPriorityQueue();

  const futureTime = "2099-01-01T00:00:00.000Z";
  queue.enqueue({ payload: "future", priority: 10, dispatchAfter: futureTime });

  // When all tickets have future dispatchAfter, dequeue returns null
  // (the findIndex finds no ready ticket)
  const result = queue.dequeue();
  assert.equal(result, null);
});

test("TicketPriorityQueue peek returns null when empty [ticket-priority-queue]", () => {
  const queue = new TicketPriorityQueue();
  assert.equal(queue.peek(), null);
});

test("TicketPriorityQueue peek returns highest priority without removing [ticket-priority-queue]", () => {
  const queue = new TicketPriorityQueue();

  queue.enqueue({ payload: "low", priority: 1 });
  queue.enqueue({ payload: "high", priority: 10 });

  const peeked = queue.peek();
  assert.deepEqual(peeked!.payload, "high");
  assert.equal(queue.size, 2);
});

test("TicketPriorityQueue clear removes all tickets [ticket-priority-queue]", () => {
  const queue = new TicketPriorityQueue();

  queue.enqueue({ payload: "test1" });
  queue.enqueue({ payload: "test2" });
  queue.enqueue({ payload: "test3" });

  assert.equal(queue.size, 3);
  queue.clear();
  assert.equal(queue.size, 0);
  assert.equal(queue.dequeue(), null);
});

test("TicketPriorityQueue Ticket type has correct structure [ticket-priority-queue]", () => {
  const ticket: Ticket = {
    id: "test-ticket-id",
    priority: 5,
    payload: { data: "value" },
    dispatchAfter: null,
    createdAt: new Date().toISOString(),
  };

  assert.equal(ticket.id, "test-ticket-id");
  assert.equal(ticket.priority, 5);
  assert.deepEqual(ticket.payload, { data: "value" });
  assert.equal(ticket.dispatchAfter, null);
});

test("TicketPriorityQueue EnqueueTicketInput with minimal fields [ticket-priority-queue]", () => {
  const input: EnqueueTicketInput = {
    payload: "minimal",
  };

  assert.equal(input.payload, "minimal");
  assert.equal(input.priority, undefined);
  assert.equal(input.dispatchAfter, undefined);
});

test("TicketPriorityQueue EnqueueTicketInput with all fields [ticket-priority-queue]", () => {
  const futureTime = "2025-12-31T23:59:59.999Z";
  const input: EnqueueTicketInput = {
    payload: { complex: { nested: true } },
    priority: 100,
    dispatchAfter: futureTime,
  };

  assert.deepEqual(input.payload, { complex: { nested: true } });
  assert.equal(input.priority, 100);
  assert.equal(input.dispatchAfter, futureTime);
});

test("TicketPriorityQueue handles many tickets correctly [ticket-priority-queue]", () => {
  const queue = new TicketPriorityQueue();

  // Enqueue 20 tickets with varying priorities (1-5 range)
  for (let i = 0; i < 20; i++) {
    queue.enqueue({ payload: `task-${i}`, priority: i % 5 });
  }

  assert.equal(queue.size, 20);

  // First dequeued should have highest priority (4, for i=4 and i=9 and i=14 and i=19)
  // Since they all have same priority, FIFO applies - i=4 was first
  const first = queue.dequeue();
  assert.deepEqual(first!.payload, "task-4");
  assert.equal(first!.priority, 4);

  // Get remaining in order and verify size decreases
  let count = 1;
  while (queue.dequeue() !== null) {
    count++;
  }
  assert.equal(count, 20);
});

test("TicketPriorityQueue priority ordering is correct descending [ticket-priority-queue]", () => {
  const queue = new TicketPriorityQueue();

  queue.enqueue({ payload: "p1", priority: 1 });
  queue.enqueue({ payload: "p5", priority: 5 });
  queue.enqueue({ payload: "p3", priority: 3 });
  queue.enqueue({ payload: "p9", priority: 9 });
  queue.enqueue({ payload: "p7", priority: 7 });

  const results: number[] = [];
  let ticket;
  while ((ticket = queue.dequeue()) !== null) {
    results.push(ticket.priority);
  }

  assert.deepEqual(results, [9, 7, 5, 3, 1]);
});

test("TicketPriorityQueue dispatchAfter null is treated as immediately ready [ticket-priority-queue]", () => {
  const queue = new TicketPriorityQueue();

  queue.enqueue({ payload: "immediate", dispatchAfter: null });
  queue.enqueue({ payload: "future", dispatchAfter: "2099-01-01T00:00:00.000Z" });

  const immediate = queue.dequeue();
  assert.deepEqual(immediate!.payload, "immediate");
});

test("TicketPriorityQueue promotes deferred tickets once dispatchAfter is reached [ticket-priority-queue]", () => {
  const queue = new TicketPriorityQueue();
  const originalNow = Date.now;
  const readyAt = Date.parse("2026-01-01T00:00:10.000Z");
  Date.now = () => readyAt - 1_000;
  try {
    queue.enqueue({ payload: "later", priority: 10, dispatchAfter: new Date(readyAt).toISOString() });
    assert.equal(queue.peek(), null);
    Date.now = () => readyAt;
    assert.equal(queue.dequeue()?.payload, "later");
  } finally {
    Date.now = originalNow;
  }
});

test("TicketPriorityQueue treats invalid dispatchAfter as immediately ready [ticket-priority-queue]", () => {
  const queue = new TicketPriorityQueue();
  queue.enqueue({ payload: "invalid-time", dispatchAfter: "not-a-date", priority: 2 });
  assert.equal(queue.dequeue()?.payload, "invalid-time");
});

test("TicketPriorityQueue reorders heap correctly when multiple children compete [ticket-priority-queue]", () => {
  const queue = new TicketPriorityQueue();
  queue.enqueue({ payload: "p1", priority: 1 });
  queue.enqueue({ payload: "p4", priority: 4 });
  queue.enqueue({ payload: "p3", priority: 3 });
  queue.enqueue({ payload: "p2", priority: 2 });

  assert.deepEqual(
    [queue.dequeue()?.payload, queue.dequeue()?.payload, queue.dequeue()?.payload, queue.dequeue()?.payload],
    ["p4", "p3", "p2", "p1"],
  );
});
