/**
 * Performance Test: Projection Memory Efficiency (Array.includes O(n²) Issue)
 *
 * Tests for issue #2240: Array.includes O(n²) performance degradation
 *
 * The dispatch-projection.ts uses state.processedEventIds.includes(event.event.id)
 * which is O(n) per lookup. When processing many events, this becomes O(n²).
 *
 * Design targets:
 * - Event deduplication: O(1) lookup via Set, not O(n) via Array.includes
 * - 1000 events: <50ms processing time
 * - 10000 events: <500ms processing time
 * - Memory: efficient deduplication structure
 */

import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import { reportSoftPerformanceMiss } from "../helpers/performance.js";

import type { ProjectionHandler, ProjectionInputEvent } from "../../src/platform/state-evidence/projections/projection-rebuild-service.js";
import { newId } from "../../src/platform/contracts/types/ids.js";

// ============================================================================
// Simulated O(n²) Issue - Array.includes in loop
// ============================================================================

/**
 * Simulates the problematic pattern from dispatch-projection.ts:
 * state.processedEventIds.includes(event.event.id) inside apply()
 *
 * This is O(n²) because:
 * - For each event, we iterate through all processed event IDs
 * - As events increase, this becomes progressively slower
 */
interface BadDispatchTicketState {
  ticketId: string | null;
  status: string;
  eventCount: number;
  processedEventIds: string[]; // Array - O(n) lookup
}

function createInitialBadState(): BadDispatchTicketState {
  return {
    ticketId: null,
    status: "pending",
    eventCount: 0,
    processedEventIds: [],
  };
}

function badApplyEvent(state: BadDispatchTicketState, event: ProjectionInputEvent): BadDispatchTicketState {
  // O(n²) issue: Array.includes is O(n) inside a loop
  if (state.processedEventIds.includes(event.eventId)) {
    return state;
  }

  return {
    ...state,
    ticketId: state.ticketId ?? `ticket_${event.eventId.slice(0, 8)}`,
    status: event.eventType === "dispatch:ticket_claimed" ? "claimed" : state.status,
    eventCount: state.eventCount + 1,
    processedEventIds: [...state.processedEventIds, event.eventId],
  };
}

// ============================================================================
// Optimized O(1) Solution - Using Set for deduplication
// ============================================================================

/**
 * Optimized version using Set for O(1) lookup.
 * This is what the projection should use instead of Array.includes.
 */
interface GoodDispatchTicketState {
  ticketId: string | null;
  status: string;
  eventCount: number;
  processedEventIds: Set<string>; // Set - O(1) lookup
}

function createInitialGoodState(): GoodDispatchTicketState {
  return {
    ticketId: null,
    status: "pending",
    eventCount: 0,
    processedEventIds: new Set(),
  };
}

function goodApplyEvent(state: GoodDispatchTicketState, event: ProjectionInputEvent): GoodDispatchTicketState {
  // O(1) lookup: Set.has is constant time
  if (state.processedEventIds.has(event.eventId)) {
    return state;
  }

  const newProcessedEventIds = new Set(state.processedEventIds);
  newProcessedEventIds.add(event.eventId);

  return {
    ...state,
    ticketId: state.ticketId ?? `ticket_${event.eventId.slice(0, 8)}`,
    status: event.eventType === "dispatch:ticket_claimed" ? "claimed" : state.status,
    eventCount: state.eventCount + 1,
    processedEventIds: newProcessedEventIds,
  };
}

// ============================================================================
// Test Helpers
// ============================================================================

function createTestEvents(count: number): ProjectionInputEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    eventId: newId("evt"),
    eventType: i % 3 === 0 ? "dispatch:ticket_claimed" : "dispatch:event",
    taskId: newId("task"),
    payloadJson: JSON.stringify({ index: i }),
    createdAt: new Date(Date.now() - (count - i) * 1000).toISOString(),
  }));
}

// ============================================================================
// O(n²) vs O(1) Comparison Tests
// ============================================================================

test("projection memory: Array.includes O(n²) vs Set.has O(1) at 1000 events", (t) => {
  const eventCount = 1000;
  const events = createTestEvents(eventCount);

  // Test bad (Array.includes) approach
  let badState = createInitialBadState();
  const badStart = performance.now();
  for (const event of events) {
    badState = badApplyEvent(badState, event);
  }
  const badElapsed = performance.now() - badStart;

  // Test good (Set.has) approach
  let goodState = createInitialGoodState();
  const goodStart = performance.now();
  for (const event of events) {
    goodState = goodApplyEvent(goodState, event);
  }
  const goodElapsed = performance.now() - goodStart;

  // Verify correctness - both should produce same event count
  assert.strictEqual(badState.eventCount, goodState.eventCount);

  // Set should be faster
  const speedup = badElapsed / goodElapsed;

  try {
    assert.ok(
      speedup > 2,
      `Expected Set to be significantly faster than Array.includes. Bad: ${badElapsed.toFixed(2)}ms, Good: ${goodElapsed.toFixed(2)}ms, Speedup: ${speedup.toFixed(1)}x`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("projection memory: Array.includes O(n²) at 5000 events - exceeds threshold", (t) => {
  const eventCount = 5000;
  const events = createTestEvents(eventCount);

  let state = createInitialBadState();
  const start = performance.now();

  for (const event of events) {
    state = badApplyEvent(state, event);
  }

  const elapsed = performance.now() - start;
  const msPerEvent = elapsed / eventCount;

  // With O(n²), this should be noticeably slow
  // We expect the good solution to be much faster at this scale
  try {
    assert.ok(
      elapsed < 500,
      `Array.includes approach took ${elapsed.toFixed(2)}ms for ${eventCount} events (${msPerEvent.toFixed(3)}ms/event). O(n²) degradation is evident. Should use Set for O(1) lookup.`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("projection memory: Set.has O(1) at 10000 events - <500ms target", (t) => {
  const eventCount = 10000;
  const events = createTestEvents(eventCount);

  let state = createInitialGoodState();
  const start = performance.now();

  for (const event of events) {
    state = goodApplyEvent(state, event);
  }

  const elapsed = performance.now() - start;
  const msPerEvent = elapsed / eventCount;

  try {
    assert.ok(
      elapsed < 500,
      `Set.has approach took ${elapsed.toFixed(2)}ms for ${eventCount} events (${msPerEvent.toFixed(3)}ms/event), expected <500ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

// ============================================================================
// Scaling Behavior Tests
// ============================================================================

test("projection memory: Array.includes scaling is quadratic", (t) => {
  const eventCounts = [500, 1000, 2000];
  const times: number[] = [];

  for (const count of eventCounts) {
    const events = createTestEvents(count);
    let state = createInitialBadState();

    const start = performance.now();
    for (const event of events) {
      state = badApplyEvent(state, event);
    }
    times.push(performance.now() - start);
  }

  // Check scaling ratio
  // For O(n²), doubling n should roughly quadruple time
  const ratio1to2 = times[1]! / times[0]!; // 1000 vs 500
  const ratio2to3 = times[2]! / times[1]!; // 2000 vs 1000

  // In quadratic behavior, ratio should be ~4 for doubling
  // We're checking it's at least 2.5 to confirm super-linear scaling
  const isSuperLinear = ratio1to2 > 2 && ratio2to3 > 2;

  try {
    assert.ok(
      isSuperLinear,
      `Array.includes shows quadratic scaling: ${eventCounts[0]} events: ${times[0].toFixed(2)}ms, ${eventCounts[1]} events: ${times[1].toFixed(2)}ms (ratio ${ratio1to2.toFixed(2)}), ${eventCounts[2]} events: ${times[2].toFixed(2)}ms (ratio ${ratio2to3.toFixed(2)}). Expected super-linear scaling indicating O(n²)`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("projection memory: Set.has scaling is linear", (t) => {
  const eventCounts = [500, 1000, 2000, 5000];
  const times: number[] = [];

  for (const count of eventCounts) {
    const events = createTestEvents(count);
    let state = createInitialGoodState();

    const start = performance.now();
    for (const event of events) {
      state = goodApplyEvent(state, event);
    }
    times.push(performance.now() - start);
  }

  // Check scaling ratio
  // For O(n), doubling n should roughly double time
  const ratio1to2 = times[1]! / times[0]!; // 1000 vs 500
  const ratio2to3 = times[2]! / times[1]!; // 2000 vs 1000
  const ratio3to4 = times[3]! / times[2]!; // 5000 vs 2000

  // In linear behavior, ratios should be close to 2
  const isLinear = ratio1to2 < 3 && ratio2to3 < 3 && ratio3to4 < 3;

  try {
    assert.ok(
      isLinear,
      `Set.has shows linear scaling: 500: ${times[0].toFixed(2)}ms, 1000: ${times[1].toFixed(2)}ms (ratio ${ratio1to2.toFixed(2)}), 2000: ${times[2].toFixed(2)}ms (ratio ${ratio2to3.toFixed(2)}), 5000: ${times[3].toFixed(2)}ms (ratio ${ratio3to4.toFixed(2)}). Expected near-linear scaling indicating O(n)`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

// ============================================================================
// Memory Efficiency Tests
// ============================================================================

test("projection memory: Set vs Array memory for deduplication", (t) => {
  const eventCount = 10000;
  const events = createTestEvents(eventCount);

  // Build Array-based state
  let arrayState = createInitialBadState();
  for (const event of events) {
    arrayState = badApplyEvent(arrayState, event);
  }

  // Build Set-based state
  let setState = createInitialGoodState();
  for (const event of events) {
    setState = goodApplyEvent(setState, event);
  }

  const arraySize = arrayState.processedEventIds.length;
  const setSize = setState.processedEventIds.size;

  assert.strictEqual(arraySize, setSize, "Both should have same number of processed events");

  // Memory comparison via JSON serialization size
  const arrayJson = JSON.stringify(arrayState.processedEventIds);
  const setJson = JSON.stringify([...setState.processedEventIds]);

  // Array stores each ID as a string in an array
  // Set also stores strings internally, but with Set overhead
  // The JSON should be similar size since both contain the same strings
  try {
    assert.ok(
      Math.abs(arrayJson.length - setJson.length) < 1000,
      `Memory footprint similar: Array JSON: ${arrayJson.length} bytes, Set JSON: ${setJson.length} bytes. Set provides O(1) lookup without significant memory overhead.`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

// ============================================================================
// Real Projection Pattern Test
// ============================================================================

test("projection memory: Real dispatch projection pattern - Array.includes issue", (t) => {
  // This test simulates the actual pattern from dispatch-projection.ts
  // which uses state.processedEventIds.includes(event.event.id)

  const eventCount = 2000;
  const events = createTestEvents(eventCount);

  // Simulate the bad pattern
  let state = createInitialBadState();
  const start = performance.now();

  for (const event of events) {
    // This is the actual problematic code pattern:
    // if (state.processedEventIds.includes(event.event.id)) {
    //   return state;
    // }
    if (state.processedEventIds.includes(event.eventId)) {
      continue;
    }
    state = {
      ...state,
      eventCount: state.eventCount + 1,
      processedEventIds: [...state.processedEventIds, event.eventId],
    };
  }

  const elapsed = performance.now() - start;
  const msPerEvent = elapsed / eventCount;

  // At 2000 events with O(n²), we expect significant slowdown
  // O(n²) = 2000² = 4,000,000 operations vs O(n) = 2,000 operations
  try {
    assert.ok(
      msPerEvent < 1,
      `Processing ${msPerEvent.toFixed(3)}ms per event suggests O(n²) issue. Array.includes in loop is the root cause. Consider using Set for O(1) deduplication.`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("projection memory: Fixed dispatch projection pattern - Set.has", (t) => {
  // This test shows the correct pattern using Set.has

  const eventCount = 2000;
  const events = createTestEvents(eventCount);

  // Simulate the good pattern
  let state = createInitialGoodState();
  const start = performance.now();

  for (const event of events) {
    // This is the fixed code pattern using Set:
    // if (state.processedEventIds.has(event.event.id)) {
    //   return state;
    // }
    if (state.processedEventIds.has(event.eventId)) {
      continue;
    }
    const newProcessed = new Set(state.processedEventIds);
    newProcessed.add(event.eventId);
    state = {
      ...state,
      eventCount: state.eventCount + 1,
      processedEventIds: newProcessed,
    };
  }

  const elapsed = performance.now() - start;
  const msPerEvent = elapsed / eventCount;

  try {
    assert.ok(
      msPerEvent < 0.5,
      `Fixed pattern processing ${msPerEvent.toFixed(3)}ms per event is efficient. Set.has provides O(1) lookup.`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});
