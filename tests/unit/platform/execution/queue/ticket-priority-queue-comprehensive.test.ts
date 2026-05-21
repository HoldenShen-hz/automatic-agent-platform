/**
 * TicketPriorityQueue Comprehensive Tests
 *
 * Tests for the priority queue implementation used in ticket-based dispatch.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { TicketPriorityQueue, type Ticket, type EnqueueTicketInput } from "../../../../../src/platform/five-plane-execution/queue/ticket-priority-queue.js";

test("TicketPriorityQueue can be instantiated", () => {
  const queue = new TicketPriorityQueue();
  assert.ok(queue instanceof TicketPriorityQueue);
});

test("TicketPriorityQueue size starts at zero", () => {
  const queue = new TicketPriorityQueue();
  assert.equal(queue.size, 0);
});

test("TicketPriorityQueue enqueue increments size", () => {
  const queue = new TicketPriorityQueue();
  queue.enqueue({ payload: "test" });
  assert.equal(queue.size, 1);
  queue.enqueue({ payload: "test2" });
  assert.equal(queue.size, 2);
});

test("TicketPriorityQueue enqueue with default priority of 0", () => {
  const queue = new TicketPriorityQueue();
  const ticket = queue.enqueue({ payload: "test" });
  assert.equal(ticket.priority, 0);
});

test("TicketPriorityQueue enqueue with custom priority", () => {
  const queue = new TicketPriorityQueue();
  const ticket = queue.enqueue({ payload: "test", priority: 5 });
  assert.equal(ticket.priority, 5);
});

test("TicketPriorityQueue enqueue with negative priority", () => {
  const queue = new TicketPriorityQueue();
  const ticket = queue.enqueue({ payload: "test", priority: -1 });
  assert.equal(ticket.priority, -1);
});

test("TicketPriorityQueue enqueue with null dispatchAfter", () => {
  const queue = new TicketPriorityQueue();
  const ticket = queue.enqueue({ payload: "test", dispatchAfter: null });
  assert.equal(ticket.dispatchAfter, null);
});

test("TicketPriorityQueue enqueue with future dispatchAfter", () => {
  const futureTime = "2099-12-31T23:59:59.999Z";
  const queue = new TicketPriorityQueue();
  const ticket = queue.enqueue({ payload: "test", dispatchAfter: futureTime });
  assert.equal(ticket.dispatchAfter, futureTime);
});

test("TicketPriorityQueue enqueue ticket has correct structure", () => {
  const queue = new TicketPriorityQueue();
  const ticket = queue.enqueue({ payload: { data: "value" }, priority: 10 });

  assert.ok(typeof ticket.id === "string");
  assert.ok(ticket.id.length > 0);
  assert.equal(ticket.priority, 10);
  assert.deepEqual(ticket.payload, { data: "value" });
  assert.equal(ticket.dispatchAfter, null);
  assert.ok(typeof ticket.createdAt === "string");
});

test("TicketPriorityQueue enqueue ticket id is prefixed with ticket-", () => {
  const queue = new TicketPriorityQueue();
  const ticket = queue.enqueue({ payload: "test" });
  assert.ok(ticket.id.startsWith("ticket-"));
});

test("TicketPriorityQueue dequeue returns null when empty", () => {
  const queue = new TicketPriorityQueue();
  assert.equal(queue.dequeue(), null);
});

test("TicketPriorityQueue dequeue removes and returns ticket", () => {
  const queue = new TicketPriorityQueue();
  queue.enqueue({ payload: "test" });
  const result = queue.dequeue();

  assert.deepEqual(result!.payload, "test");
  assert.equal(queue.size, 0);
});

test("TicketPriorityQueue dequeue returns highest priority ticket first", () => {
  const queue = new TicketPriorityQueue();

  queue.enqueue({ payload: "low", priority: 1 });
  queue.enqueue({ payload: "high", priority: 10 });
  queue.enqueue({ payload: "medium", priority: 5 });

  const first = queue.dequeue();
  assert.deepEqual(first!.payload, "high");
  assert.equal(first!.priority, 10);
});

test("TicketPriorityQueue dequeue returns FIFO for same priority", () => {
  const queue = new TicketPriorityQueue();

  queue.enqueue({ payload: "first", priority: 5 });
  queue.enqueue({ payload: "second", priority: 5 });

  const first = queue.dequeue();
  assert.deepEqual(first!.payload, "first");

  const second = queue.dequeue();
  assert.deepEqual(second!.payload, "second");
});

test("TicketPriorityQueue dequeue skips tickets with future dispatchAfter", () => {
  const queue = new TicketPriorityQueue();

  const futureTime = "2099-01-01T00:00:00.000Z";
  queue.enqueue({ payload: "future", priority: 10, dispatchAfter: futureTime });
  queue.enqueue({ payload: "now", priority: 5 });

  const result = queue.dequeue();
  assert.deepEqual(result!.payload, "now");
});

test("TicketPriorityQueue dequeue returns null when all tickets have future dispatchAfter", () => {
  const queue = new TicketPriorityQueue();

  const futureTime = "2099-01-01T00:00:00.000Z";
  queue.enqueue({ payload: "future", priority: 10, dispatchAfter: futureTime });

  const result = queue.dequeue();
  assert.equal(result, null);
});

test("TicketPriorityQueue dequeue respects priority regardless of dispatchAfter", () => {
  const queue = new TicketPriorityQueue();

  // High priority but in the future
  const futureTime = "2099-01-01T00:00:00.000Z";
  queue.enqueue({ payload: "high-future", priority: 10, dispatchAfter: futureTime });
  // Low priority but ready now
  queue.enqueue({ payload: "low-now", priority: 1 });

  // Should return low-now because high-future is not ready yet
  const result = queue.dequeue();
  assert.deepEqual(result!.payload, "low-now");
});

test("TicketPriorityQueue peek returns null when empty", () => {
  const queue = new TicketPriorityQueue();
  assert.equal(queue.peek(), null);
});

test("TicketPriorityQueue peek does not remove ticket", () => {
  const queue = new TicketPriorityQueue();
  queue.enqueue({ payload: "test" });
  queue.peek();

  assert.equal(queue.size, 1);
});

test("TicketPriorityQueue peek returns highest priority ticket", () => {
  const queue = new TicketPriorityQueue();

  queue.enqueue({ payload: "low", priority: 1 });
  queue.enqueue({ payload: "high", priority: 10 });

  const peeked = queue.peek();
  assert.deepEqual(peeked!.payload, "high");
});

test("TicketPriorityQueue clear removes all tickets", () => {
  const queue = new TicketPriorityQueue();

  queue.enqueue({ payload: "test1" });
  queue.enqueue({ payload: "test2" });
  queue.enqueue({ payload: "test3" });

  assert.equal(queue.size, 3);
  queue.clear();
  assert.equal(queue.size, 0);
});

test("TicketPriorityQueue clear makes dequeue return null", () => {
  const queue = new TicketPriorityQueue();
  queue.enqueue({ payload: "test" });
  queue.clear();
  assert.equal(queue.dequeue(), null);
});

test("TicketPriorityQueue priority ordering descending", () => {
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

test("TicketPriorityQueue handles many tickets", () => {
  const queue = new TicketPriorityQueue();

  for (let i = 0; i < 100; i++) {
    queue.enqueue({ payload: `task-${i}`, priority: i % 10 });
  }

  assert.equal(queue.size, 100);

  let count = 0;
  while (queue.dequeue() !== null) {
    count++;
  }
  assert.equal(count, 100);
});

test("TicketPriorityQueue empty after all dequeued", () => {
  const queue = new TicketPriorityQueue();

  queue.enqueue({ payload: "test" });
  queue.dequeue();

  assert.equal(queue.size, 0);
  assert.equal(queue.peek(), null);
});

test("TicketPriorityQueue Ticket interface accepts valid structure", () => {
  const ticket: Ticket = {
    id: "ticket-123",
    priority: 5,
    payload: { key: "value" },
    dispatchAfter: "2025-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
  };

  assert.equal(ticket.id, "ticket-123");
  assert.equal(ticket.priority, 5);
  assert.deepEqual(ticket.payload, { key: "value" });
});

test("TicketPriorityQueue EnqueueTicketInput minimal structure", () => {
  const input: EnqueueTicketInput = {
    payload: "minimal",
  };

  assert.equal(input.payload, "minimal");
  assert.equal(input.priority, undefined);
  assert.equal(input.dispatchAfter, undefined);
});

test("TicketPriorityQueue EnqueueTicketInput full structure", () => {
  const input: EnqueueTicketInput = {
    payload: { complex: { nested: true } },
    priority: 100,
    dispatchAfter: "2025-12-31T23:59:59.999Z",
  };

  assert.deepEqual(input.payload, { complex: { nested: true } });
  assert.equal(input.priority, 100);
  assert.equal(input.dispatchAfter, "2025-12-31T23:59:59.999Z");
});

test("TicketPriorityQueue payload can be any type", () => {
  const queue = new TicketPriorityQueue();

  queue.enqueue({ payload: "string" });
  queue.enqueue({ payload: 123 });
  queue.enqueue({ payload: { object: true } });
  queue.enqueue({ payload: [1, 2, 3] });
  queue.enqueue({ payload: null });
  queue.enqueue({ payload: undefined });

  assert.equal(queue.size, 6);
});

test("TicketPriorityQueue dispatchAfter with past date is treated as ready", () => {
  const queue = new TicketPriorityQueue();

  const pastTime = "2020-01-01T00:00:00.000Z";
  queue.enqueue({ payload: "past", priority: 5, dispatchAfter: pastTime });

  const result = queue.dequeue();
  assert.deepEqual(result!.payload, "past");
});

test("TicketPriorityQueue dispatchAfter with current time is ready", () => {
  const queue = new TicketPriorityQueue();

  const now = new Date().toISOString();
  queue.enqueue({ payload: "now", priority: 5, dispatchAfter: now });

  const result = queue.dequeue();
  assert.deepEqual(result!.payload, "now");
});