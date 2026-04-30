/**
 * Performance Test: Task Priority Sorting Operations
 * Measures priority queue insertion, dequeue, and sorting throughput and latency
 *
 * Design targets:
 * - Priority queue insertion: >10000 ops/sec
 * - Priority queue dequeue: >5000 ops/sec
 * - Sorting 1000 tasks: <10ms
 *
 * Note: Performance thresholds are set for reference hardware. On slower machines,
 * tests that miss the reference target are recorded as diagnostics rather than skipped.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { reportSoftPerformanceMiss } from "../../../helpers/performance.js";
import { TicketPriorityQueue, type Ticket, type EnqueueTicketInput } from "../../../../src/platform/five-plane-execution/queue/ticket-priority-queue.js";
import { newId, nowIso } from "../../../../src/platform/contracts/types/ids.js";

function createTestTicket(priority: number = 0): EnqueueTicketInput {
  return {
    payload: { data: `test-${Math.random()}` },
    priority,
  };
}

function createMixedPriorityTickets(count: number): EnqueueTicketInput[] {
  const priorities = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const tickets: EnqueueTicketInput[] = [];
  for (let i = 0; i < count; i++) {
    tickets.push(createTestTicket(priorities[i % priorities.length]!));
  }
  return tickets;
}

// ============================================================================
// Priority Queue Insertion Performance Tests
// ============================================================================

test("performance: priority queue insertion throughput >10000 ops/sec", (t) => {
  const queue = new TicketPriorityQueue();

  try {
    const iterations = 5000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      queue.enqueue(createTestTicket(i % 10));
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 10000,
        `Priority queue insertion throughput ${opsPerSec.toFixed(2)} ops/sec must be >10000 ops/sec. Avg latency: ${avgLatencyMs.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    queue.clear();
  }
});

test("performance: priority queue insertion P99 latency <0.5ms", (t) => {
  const queue = new TicketPriorityQueue();

  try {
    const latencies: number[] = [];
    const iterations = 2000;

    // Warmup
    for (let i = 0; i < 100; i++) {
      queue.enqueue(createTestTicket());
    }

    // Measure
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      queue.enqueue(createTestTicket(i % 10));
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 0.5,
        `Priority queue insertion P99 latency ${p99.toFixed(3)}ms exceeds 0.5ms target. P50: ${p50.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    queue.clear();
  }
});

// ============================================================================
// Priority Queue Dequeue Performance Tests
// ============================================================================

test("performance: priority queue dequeue throughput >5000 ops/sec", (t) => {
  const queue = new TicketPriorityQueue();

  try {
    // Pre-fill queue with 1000 tickets
    for (let i = 0; i < 1000; i++) {
      queue.enqueue(createTestTicket(i % 10));
    }

    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      queue.dequeue();
      // Replenish to keep queue populated
      queue.enqueue(createTestTicket(i % 10));
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 5000,
        `Priority queue dequeue throughput ${opsPerSec.toFixed(2)} ops/sec must be >5000 ops/sec. Avg latency: ${avgLatencyMs.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    queue.clear();
  }
});

test("performance: priority queue dequeue P99 latency <1ms", (t) => {
  const queue = new TicketPriorityQueue();

  try {
    // Pre-fill queue
    for (let i = 0; i < 500; i++) {
      queue.enqueue(createTestTicket(i % 10));
    }

    const latencies: number[] = [];
    const iterations = 500;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      queue.dequeue();
      // Replenish
      queue.enqueue(createTestTicket(i % 10));
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 1,
        `Priority queue dequeue P99 latency ${p99.toFixed(3)}ms exceeds 1ms target. P50: ${p50.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    queue.clear();
  }
});

// ============================================================================
// Priority Queue Ordering Verification Tests
// ============================================================================

test("performance: priority queue maintains correct ordering", (t) => {
  const queue = new TicketPriorityQueue();

  try {
    // Insert tickets with varying priorities
    const priorities = [5, 3, 8, 1, 9, 2, 7, 4, 6, 0];
    for (const priority of priorities) {
      queue.enqueue(createTestTicket(priority));
    }

    // Dequeue and verify ordering (highest priority first)
    const extractedPriorities: number[] = [];
    let ticket: Ticket | null;
    while ((ticket = queue.dequeue()) !== null) {
      extractedPriorities.push(ticket.priority);
    }

    // Verify extracted priorities are in descending order
    for (let i = 1; i < extractedPriorities.length; i++) {
      assert.ok(
        extractedPriorities[i - 1]! >= extractedPriorities[i]!,
        `Priority ordering violated at position ${i}: ${extractedPriorities[i - 1]} < ${extractedPriorities[i]}`,
      );
    }
  } finally {
    queue.clear();
  }
});

test("performance: priority queue FIFO ordering for same priority", (t) => {
  const queue = new TicketPriorityQueue();

  try {
    // Insert tickets with same priority, verify FIFO order
    const ticketCount = 100;
    for (let i = 0; i < ticketCount; i++) {
      queue.enqueue({ payload: { index: i }, priority: 5 });
    }

    let prevIndex = -1;
    let ticket: Ticket | null;
    while ((ticket = queue.dequeue()) !== null) {
      const index = (ticket.payload as { index: number }).index;
      assert.ok(
        index > prevIndex,
        `FIFO ordering violated: ${index} <= ${prevIndex}`,
      );
      prevIndex = index;
    }
  } finally {
    queue.clear();
  }
});

// ============================================================================
// Bulk Operations Performance Tests
// ============================================================================

test("performance: bulk insertion of 1000 tickets <50ms", (t) => {
  const queue = new TicketPriorityQueue();

  try {
    const ticketCount = 1000;
    const start = performance.now();

    for (let i = 0; i < ticketCount; i++) {
      queue.enqueue(createTestTicket(i % 10));
    }

    const elapsed = performance.now() - start;

    try {
      assert.ok(
        elapsed < 50,
        `Bulk insertion of ${ticketCount} tickets took ${elapsed.toFixed(2)}ms, expected <50ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    queue.clear();
  }
});

test("performance: bulk dequeue of 1000 tickets <100ms", (t) => {
  const queue = new TicketPriorityQueue();

  try {
    // Pre-fill queue
    const ticketCount = 1000;
    for (let i = 0; i < ticketCount; i++) {
      queue.enqueue(createTestTicket(i % 10));
    }

    const start = performance.now();

    let ticket: Ticket | null;
    while ((ticket = queue.dequeue()) !== null) {
      // Dequeue all
    }

    const elapsed = performance.now() - start;

    try {
      assert.ok(
        elapsed < 100,
        `Bulk dequeue of ${ticketCount} tickets took ${elapsed.toFixed(2)}ms, expected <100ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    queue.clear();
  }
});

// ============================================================================
// Scaling Tests
// ============================================================================

test("performance: priority queue scales linearly with size", (t) => {
  const queue = new TicketPriorityQueue();

  try {
    const sizes = [100, 500, 1000];
    const results: { size: number; insertTime: number; dequeueTime: number }[] = [];

    for (const size of sizes) {
      // Clear and refill
      queue.clear();

      const insertStart = performance.now();
      for (let i = 0; i < size; i++) {
        queue.enqueue(createTestTicket(i % 10));
      }
      const insertTime = performance.now() - insertStart;

      const dequeueStart = performance.now();
      let ticket: Ticket | null;
      while ((ticket = queue.dequeue()) !== null) {
        // Dequeue all
      }
      const dequeueTime = performance.now() - dequeueStart;

      results.push({ size, insertTime, dequeueTime });
    }

    // Verify insert time scales roughly linearly (within 3x tolerance)
    const baselineInsert = results[0]!.insertTime;
    const baselineDequeue = results[0]!.dequeueTime;

    for (const { size, insertTime, dequeueTime } of results.slice(1)) {
      const sizeRatio = size / 100;
      const insertRatio = insertTime / baselineInsert;
      const dequeueRatio = dequeueTime / baselineDequeue;

      assert.ok(
        insertRatio < sizeRatio * 3,
        `Insert time for size=${size} scaled by ${insertRatio.toFixed(1)}x, expected <${(sizeRatio * 3).toFixed(1)}x`,
      );
      assert.ok(
        dequeueRatio < sizeRatio * 3,
        `Dequeue time for size=${size} scaled by ${dequeueRatio.toFixed(1)}x, expected <${(sizeRatio * 3).toFixed(1)}x`,
      );
    }
  } finally {
    queue.clear();
  }
});

test("performance: peek operation <0.1ms", (t) => {
  const queue = new TicketPriorityQueue();

  try {
    // Pre-fill queue
    for (let i = 0; i < 1000; i++) {
      queue.enqueue(createTestTicket(i % 10));
    }

    const latencies: number[] = [];
    const iterations = 1000;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      queue.peek();
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const avg = latencies.reduce((a, b) => a + b, 0) / iterations;

    try {
      assert.ok(
        p99 < 0.1,
        `Peek P99 latency ${p99.toFixed(3)}ms exceeds 0.1ms target. Avg: ${avg.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    queue.clear();
  }
});

// ============================================================================
// Memory Usage Tests
// ============================================================================

test("performance: memory usage stable during repeated operations", (t) => {
  const queue = new TicketPriorityQueue();

  try {
    const iterations = 100;
    const batchSize = 100;

    // Perform repeated bulk insert/dequeue cycles
    for (let i = 0; i < iterations; i++) {
      for (let j = 0; j < batchSize; j++) {
        queue.enqueue(createTestTicket(j % 10));
      }
      for (let j = 0; j < batchSize; j++) {
        queue.dequeue();
      }
    }

    // Verify queue is empty after all operations
    assert.strictEqual(queue.size, 0, "Queue should be empty after all dequeue operations");
  } finally {
    queue.clear();
  }
});

// ============================================================================
// Concurrent Priority Tests
// ============================================================================

test("performance: mixed priority operations maintain correctness", (t) => {
  const queue = new TicketPriorityQueue();

  try {
    // Insert tickets with specific priority pattern
    const pattern = [10, 5, 10, 3, 10, 5, 10, 1, 10, 7];
    for (const priority of pattern) {
      queue.enqueue(createTestTicket(priority));
    }

    // Dequeue all and verify we get all 10s first, then 7s, then 5s, then 3s, then 1s
    const extracted: number[] = [];
    let ticket: Ticket | null;
    while ((ticket = queue.dequeue()) !== null) {
      extracted.push(ticket.priority);
    }

    // Verify we got all tickets
    assert.strictEqual(extracted.length, 10, "Should have extracted 10 tickets");

    // Verify ordering: all 10s should come before 7s, etc.
    let prevPriority = Infinity;
    for (const priority of extracted) {
      assert.ok(
        priority <= prevPriority,
        `Priority ${priority} should be <= ${prevPriority}`,
      );
      prevPriority = priority;
    }
  } finally {
    queue.clear();
  }
});
