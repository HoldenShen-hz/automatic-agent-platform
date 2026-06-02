/**
 * TicketPriorityQueue Comprehensive Tests
 *
 * Tests for the priority queue implementation used in ticket-based dispatch.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { TicketPriorityQueue, type Ticket, type EnqueueTicketInput } from "../../../../../src/platform/five-plane-execution/queue/ticket-priority-queue.js";

test("TicketPriorityQueue can be instantiated [ticket-priority-queue-comprehensive]", () => {
  const queue = new TicketPriorityQueue();
  assert.ok(queue instanceof TicketPriorityQueue);
});

test("TicketPriorityQueue is forbidden in production mode [ticket-priority-queue-comprehensive]", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    assert.throws(
      () => new TicketPriorityQueue(),
      /ticket_queue\.memory_only_forbidden_in_production/,
    );
  } finally {
    if (previousNodeEnv == null) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  }
});

test("TicketPriorityQueue size starts at zero [ticket-priority-queue-comprehensive]", () => {
  const queue = new TicketPriorityQueue();
  assert.equal(queue.size, 0);
});

test("TicketPriorityQueue enqueue increments size [ticket-priority-queue-comprehensive]", () => {
  const queue = new TicketPriorityQueue();
  queue.enqueue({ payload: "test" });
  assert.equal(queue.size, 1);
  queue.enqueue({ payload: "test2" });
  assert.equal(queue.size, 2);
});

test("TicketPriorityQueue enqueue with default priority of 0 [ticket-priority-queue-comprehensive]", () => {
  const queue = new TicketPriorityQueue();
  const ticket = queue.enqueue({ payload: "test" });
  assert.equal(ticket.priority, 0);
});

test("TicketPriorityQueue enqueue with custom priority [ticket-priority-queue-comprehensive]", () => {
  const queue = new TicketPriorityQueue();
  const ticket = queue.enqueue({ payload: "test", priority: 5 });
  assert.equal(ticket.priority, 5);
});

test("TicketPriorityQueue enqueue with negative priority [ticket-priority-queue-comprehensive]", () => {
  const queue = new TicketPriorityQueue();
  const ticket = queue.enqueue({ payload: "test", priority: -1 });
  assert.equal(ticket.priority, -1);
});

test("TicketPriorityQueue enqueue with null dispatchAfter [ticket-priority-queue-comprehensive]", () => {
  const queue = new TicketPriorityQueue();
  const ticket = queue.enqueue({ payload: "test", dispatchAfter: null });
  assert.equal(ticket.dispatchAfter, null);
});

test("TicketPriorityQueue enqueue with future dispatchAfter [ticket-priority-queue-comprehensive]", () => {
  const futureTime = "2099-12-31T23:59:59.999Z";
  const queue = new TicketPriorityQueue();
  const ticket = queue.enqueue({ payload: "test", dispatchAfter: futureTime });
  assert.equal(ticket.dispatchAfter, futureTime);
});

test("TicketPriorityQueue rejects malformed dispatchAfter [ticket-priority-queue-comprehensive]", () => {
  const queue = new TicketPriorityQueue();
  assert.throws(
    () => queue.enqueue({ payload: "test", dispatchAfter: "not-a-date" }),
    /ticket_queue\.dispatch_after_invalid/,
  );
});

test("TicketPriorityQueue enforces max ticket capacity [ticket-priority-queue-comprehensive]", () => {
  const queue = new TicketPriorityQueue({ maxTickets: 1 });
  queue.enqueue({ payload: "first" });
  assert.throws(
    () => queue.enqueue({ payload: "second" }),
    /ticket_queue\.capacity_exceeded/,
  );
});

test("TicketPriorityQueue prunes expired tickets before counting or dequeuing [ticket-priority-queue-comprehensive]", async () => {
  const queue = new TicketPriorityQueue({ ticketTtlMs: 1 });
  queue.enqueue({ payload: "stale" });
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(queue.size, 0);
  assert.equal(queue.dequeue(), null);
});

test("TicketPriorityQueue enqueue ticket has correct structure [ticket-priority-queue-comprehensive]", () => {
  const queue = new TicketPriorityQueue();
  const ticket = queue.enqueue({ payload: { data: "value" }, priority: 10 });

  assert.ok(typeof ticket.id === "string");
  assert.ok(ticket.id.length > 0);
  assert.equal(ticket.priority, 10);
  assert.deepEqual(ticket.payload, { data: "value" });
  assert.equal(ticket.dispatchAfter, null);
  assert.ok(typeof ticket.createdAt === "string");
});

test("TicketPriorityQueue enqueue ticket id is prefixed with ticket- [ticket-priority-queue-comprehensive]", () => {
  const queue = new TicketPriorityQueue();
  const ticket = queue.enqueue({ payload: "test" });
  assert.ok(ticket.id.startsWith("ticket-"));
});

test("TicketPriorityQueue dequeue returns null when empty [ticket-priority-queue-comprehensive]", () => {
  const queue = new TicketPriorityQueue();
  assert.equal(queue.dequeue(), null);
});

test("TicketPriorityQueue dequeue removes and returns ticket [ticket-priority-queue-comprehensive]", () => {
  const queue = new TicketPriorityQueue();
  queue.enqueue({ payload: "test" });
  const result = queue.dequeue();

  assert.deepEqual(result!.payload, "test");
  assert.equal(queue.size, 0);
});

test("TicketPriorityQueue dequeue returns highest priority ticket first [ticket-priority-queue-comprehensive]", () => {
  const queue = new TicketPriorityQueue();

  queue.enqueue({ payload: "low", priority: 1 });
  queue.enqueue({ payload: "high", priority: 10 });
  queue.enqueue({ payload: "medium", priority: 5 });

  const first = queue.dequeue();
  assert.deepEqual(first!.payload, "high");
  assert.equal(first!.priority, 10);
});

test("TicketPriorityQueue dequeue returns FIFO for same priority [ticket-priority-queue-comprehensive]", () => {
  const queue = new TicketPriorityQueue();

  queue.enqueue({ payload: "first", priority: 5 });
  queue.enqueue({ payload: "second", priority: 5 });

  const first = queue.dequeue();
  assert.deepEqual(first!.payload, "first");

  const second = queue.dequeue();
  assert.deepEqual(second!.payload, "second");
});

test("TicketPriorityQueue dequeue skips tickets with future dispatchAfter [ticket-priority-queue-comprehensive]", () => {
  const queue = new TicketPriorityQueue();

  const futureTime = "2099-01-01T00:00:00.000Z";
  queue.enqueue({ payload: "future", priority: 10, dispatchAfter: futureTime });
  queue.enqueue({ payload: "now", priority: 5 });

  const result = queue.dequeue();
  assert.deepEqual(result!.payload, "now");
});

test("TicketPriorityQueue dequeue returns null when all tickets have future dispatchAfter [ticket-priority-queue-comprehensive]", () => {
  const queue = new TicketPriorityQueue();

  const futureTime = "2099-01-01T00:00:00.000Z";
  queue.enqueue({ payload: "future", priority: 10, dispatchAfter: futureTime });

  const result = queue.dequeue();
  assert.equal(result, null);
});

test("TicketPriorityQueue dequeue respects priority regardless of dispatchAfter [ticket-priority-queue-comprehensive]", () => {
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

test("TicketPriorityQueue peek returns null when empty [ticket-priority-queue-comprehensive]", () => {
  const queue = new TicketPriorityQueue();
  assert.equal(queue.peek(), null);
});

test("TicketPriorityQueue peek does not remove ticket [ticket-priority-queue-comprehensive]", () => {
  const queue = new TicketPriorityQueue();
  queue.enqueue({ payload: "test" });
  queue.peek();

  assert.equal(queue.size, 1);
});

test("TicketPriorityQueue peek returns highest priority ticket [ticket-priority-queue-comprehensive]", () => {
  const queue = new TicketPriorityQueue();

  queue.enqueue({ payload: "low", priority: 1 });
  queue.enqueue({ payload: "high", priority: 10 });

  const peeked = queue.peek();
  assert.deepEqual(peeked!.payload, "high");
});

test("TicketPriorityQueue clear removes all tickets [ticket-priority-queue-comprehensive]", () => {
  const queue = new TicketPriorityQueue();

  queue.enqueue({ payload: "test1" });
  queue.enqueue({ payload: "test2" });
  queue.enqueue({ payload: "test3" });

  assert.equal(queue.size, 3);
  queue.clear();
  assert.equal(queue.size, 0);
});

test("TicketPriorityQueue clear makes dequeue return null [ticket-priority-queue-comprehensive]", () => {
  const queue = new TicketPriorityQueue();
  queue.enqueue({ payload: "test" });
  queue.clear();
  assert.equal(queue.dequeue(), null);
});

test("TicketPriorityQueue priority ordering descending [ticket-priority-queue-comprehensive]", () => {
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

test("TicketPriorityQueue handles many tickets [ticket-priority-queue-comprehensive]", () => {
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

test("TicketPriorityQueue empty after all dequeued [ticket-priority-queue-comprehensive]", () => {
  const queue = new TicketPriorityQueue();

  queue.enqueue({ payload: "test" });
  queue.dequeue();

  assert.equal(queue.size, 0);
  assert.equal(queue.peek(), null);
});

test("TicketPriorityQueue Ticket interface accepts valid structure [ticket-priority-queue-comprehensive]", () => {
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

test("TicketPriorityQueue EnqueueTicketInput minimal structure [ticket-priority-queue-comprehensive]", () => {
  const input: EnqueueTicketInput = {
    payload: "minimal",
  };

  assert.equal(input.payload, "minimal");
  assert.equal(input.priority, undefined);
  assert.equal(input.dispatchAfter, undefined);
});

test("TicketPriorityQueue EnqueueTicketInput full structure [ticket-priority-queue-comprehensive]", () => {
  const input: EnqueueTicketInput = {
    payload: { complex: { nested: true } },
    priority: 100,
    dispatchAfter: "2025-12-31T23:59:59.999Z",
  };

  assert.deepEqual(input.payload, { complex: { nested: true } });
  assert.equal(input.priority, 100);
  assert.equal(input.dispatchAfter, "2025-12-31T23:59:59.999Z");
});

test("TicketPriorityQueue payload can be any type [ticket-priority-queue-comprehensive]", () => {
  const queue = new TicketPriorityQueue();

  queue.enqueue({ payload: "string" });
  queue.enqueue({ payload: 123 });
  queue.enqueue({ payload: { object: true } });
  queue.enqueue({ payload: [1, 2, 3] });
  queue.enqueue({ payload: null });
  queue.enqueue({ payload: undefined });

  assert.equal(queue.size, 6);
});

test("TicketPriorityQueue dispatchAfter with past date is treated as ready [ticket-priority-queue-comprehensive]", () => {
  const queue = new TicketPriorityQueue();

  const pastTime = "2020-01-01T00:00:00.000Z";
  queue.enqueue({ payload: "past", priority: 5, dispatchAfter: pastTime });

  const result = queue.dequeue();
  assert.deepEqual(result!.payload, "past");
});

test("TicketPriorityQueue dispatchAfter with current time is ready [ticket-priority-queue-comprehensive]", () => {
  const queue = new TicketPriorityQueue();

  const now = new Date().toISOString();
  queue.enqueue({ payload: "now", priority: 5, dispatchAfter: now });

  const result = queue.dequeue();
  assert.deepEqual(result!.payload, "now");
});
