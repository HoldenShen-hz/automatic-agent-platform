/**
 * Infrastructure: Ticket Priority Queue Tests
 *
 * Tests for TicketPriorityQueue class - in-memory priority queue
 * for ticket-based dispatch ordering.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";

import { TicketPriorityQueue, type Ticket, type EnqueueTicketInput } from "../../../src/platform/five-plane-execution/queue/ticket-priority-queue.js";

// ── TicketPriorityQueue Tests ─────────────────────────────────────────────────

describe("TicketPriorityQueue", () => {
  let queue: TicketPriorityQueue;

  beforeEach(() => {
    queue = new TicketPriorityQueue();
  });

  describe("constructor and size", () => {
    it("starts empty", () => {
      assert.equal(queue.size, 0);
    });

    it("size reflects number of tickets", () => {
      queue.enqueue({ payload: { data: 1 } });
      queue.enqueue({ payload: { data: 2 } });
      assert.equal(queue.size, 2);
    });
  });

  describe("enqueue", () => {
    it("creates ticket with generated id", () => {
      const ticket = queue.enqueue({ payload: { data: "test" } });
      assert.ok(ticket.id);
      assert.ok(ticket.id.startsWith("ticket-"));
    });

    it("sets priority from input", () => {
      const ticket = queue.enqueue({ payload: { data: "test" }, priority: 10 });
      assert.equal(ticket.priority, 10);
    });

    it("defaults priority to 0", () => {
      const ticket = queue.enqueue({ payload: { data: "test" } });
      assert.equal(ticket.priority, 0);
    });

    it("sets dispatchAfter from input", () => {
      const dispatchTime = new Date(Date.now() + 5000).toISOString();
      const ticket = queue.enqueue({ payload: { data: "test" }, dispatchAfter: dispatchTime });
      assert.equal(ticket.dispatchAfter, dispatchTime);
    });

    it("defaults dispatchAfter to null", () => {
      const ticket = queue.enqueue({ payload: { data: "test" } });
      assert.equal(ticket.dispatchAfter, null);
    });

    it("sets createdAt timestamp", () => {
      const before = new Date().toISOString();
      const ticket = queue.enqueue({ payload: { data: "test" } });
      const after = new Date().toISOString();
      assert.ok(ticket.createdAt >= before);
      assert.ok(ticket.createdAt <= after);
    });

    it("inserts higher priority tickets earlier", () => {
      queue.enqueue({ payload: { n: 1 }, priority: 1 });
      queue.enqueue({ payload: { n: 3 }, priority: 3 });
      queue.enqueue({ payload: { n: 2 }, priority: 2 });
      const first = queue.dequeue();
      assert.deepEqual(first?.payload, { n: 3 });
    });

    it("maintains FIFO for same priority tickets", () => {
      const t1 = queue.enqueue({ payload: { n: 1 }, priority: 5 });
      const t2 = queue.enqueue({ payload: { n: 2 }, priority: 5 });
      const t3 = queue.enqueue({ payload: { n: 3 }, priority: 5 });
      const first = queue.dequeue();
      const second = queue.dequeue();
      const third = queue.dequeue();
      assert.deepEqual(first?.payload, { n: 1 });
      assert.deepEqual(second?.payload, { n: 2 });
      assert.deepEqual(third?.payload, { n: 3 });
    });
  });

  describe("dequeue", () => {
    it("returns null when queue is empty", () => {
      const result = queue.dequeue();
      assert.equal(result, null);
    });

    it("returns and removes the highest priority ready ticket", () => {
      queue.enqueue({ payload: { n: 1 }, priority: 1 });
      queue.enqueue({ payload: { n: 2 }, priority: 10 });
      const result = queue.dequeue();
      assert.deepEqual(result?.payload, { n: 2 });
      assert.equal(queue.size, 1);
    });

    it("skips tickets with future dispatchAfter time", () => {
      const future = new Date(Date.now() + 10000).toISOString();
      queue.enqueue({ payload: { n: 1 }, priority: 10 });
      queue.enqueue({ payload: { n: 2 }, priority: 5, dispatchAfter: future });
      const result = queue.dequeue();
      assert.deepEqual(result?.payload, { n: 1 });
    });

    it("returns ticket with null dispatchAfter regardless of time", () => {
      queue.enqueue({ payload: { n: 1 }, priority: 5 });
      const result = queue.dequeue();
      assert.deepEqual(result?.payload, { n: 1 });
    });

    it("returns ready ticket even if not highest priority but not ready", () => {
      const future = new Date(Date.now() + 10000).toISOString();
      queue.enqueue({ payload: { n: 1 }, priority: 1 }); // lower priority but ready
      queue.enqueue({ payload: { n: 2 }, priority: 10, dispatchAfter: future }); // higher priority but not ready
      const result = queue.dequeue();
      assert.deepEqual(result?.payload, { n: 1 });
    });
  });

  describe("peek", () => {
    it("returns null when empty", () => {
      assert.equal(queue.peek(), null);
    });

    it("returns highest priority ticket without removing it", () => {
      queue.enqueue({ payload: { n: 1 }, priority: 1 });
      queue.enqueue({ payload: { n: 2 }, priority: 10 });
      const peeked = queue.peek();
      assert.deepEqual(peeked?.payload, { n: 2 });
      assert.equal(queue.size, 2);
    });
  });

  describe("clear", () => {
    it("removes all tickets", () => {
      queue.enqueue({ payload: { n: 1 } });
      queue.enqueue({ payload: { n: 2 } });
      queue.clear();
      assert.equal(queue.size, 0);
      assert.equal(queue.dequeue(), null);
    });
  });
});