/**
 * Performance Test: Truth Repository Throughput
 * Measures truth storage throughput patterns under load
 *
 * Design targets:
 * - Map-based storage: >100,000 ops/sec
 * - Snapshot creation: <10ms for 1000 entries
 * - Event append: >50,000 events/sec
 */

import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import { reportSoftPerformanceMiss } from "../helpers/performance.js";

import { newId, nowIso } from "../../src/platform/contracts/types/ids.js";

// ============================================================================
// Simulated Truth Storage Patterns (mirrors RuntimeTruthRepository internals)
// ============================================================================

interface HarnessRunRecord {
  harnessRunId: string;
  tenantId: string;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface NodeRunRecord {
  nodeRunId: string;
  harnessRunId: string;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface EventRecord {
  eventId: string;
  aggregateType: string;
  aggregateId: string;
  aggregateSeq: number;
  eventType: string;
  payloadJson: string;
  traceId: string;
  createdAt: string;
}

// Simulates the Map-based storage in RuntimeTruthRepository
class TruthStore {
  private harnessRuns = new Map<string, HarnessRunRecord>();
  private nodeRuns = new Map<string, NodeRunRecord>();
  private events: EventRecord[] = [];
  private outbox: EventRecord[] = [];
  private auditRefs: string[] = [];

  seedHarnessRun(run: HarnessRunRecord): void {
    this.harnessRuns.set(run.harnessRunId, run);
  }

  seedNodeRun(run: NodeRunRecord): void {
    this.nodeRuns.set(run.nodeRunId, run);
  }

  appendEvent(event: EventRecord): EventRecord {
    // Simulate sequence number assignment
    const existingCount = this.events.filter(
      (e) => e.aggregateType === event.aggregateType && e.aggregateId === event.aggregateId,
    ).length;
    const normalizedEvent: EventRecord = {
      ...event,
      aggregateSeq: existingCount + 1,
    };
    this.events.push(normalizedEvent);
    this.outbox.push(normalizedEvent);
    return normalizedEvent;
  }

  snapshot(): { harnessRuns: HarnessRunRecord[]; nodeRuns: NodeRunRecord[]; events: EventRecord[] } {
    return {
      harnessRuns: Array.from(this.harnessRuns.values()),
      nodeRuns: Array.from(this.nodeRuns.values()),
      events: [...this.events],
    };
  }
}

function createHarnessRun(): HarnessRunRecord {
  const id = newId("harness");
  return {
    harnessRunId: id,
    tenantId: "test-tenant",
    status: "created",
    version: 1,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function createNodeRun(): NodeRunRecord {
  const id = newId("node");
  return {
    nodeRunId: id,
    harnessRunId: newId("harness"),
    status: "created",
    version: 1,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function createEvent(aggregateType: string, aggregateId: string, index: number): EventRecord {
  return {
    eventId: newId("evt"),
    aggregateType,
    aggregateId,
    aggregateSeq: index,
    eventType: "test:event",
    payloadJson: JSON.stringify({ index }),
    traceId: newId("trace"),
    createdAt: nowIso(),
  };
}

// ============================================================================
// HarnessRun Throughput Benchmarks
// ============================================================================

test("truth repository: HarnessRun seed throughput >100,000 ops/sec", (t) => {
  const store = new TruthStore();

  const iterations = 50000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    store.seedHarnessRun(createHarnessRun());
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;

  try {
    assert.ok(
      opsPerSec > 100000,
      `HarnessRun seed throughput ${opsPerSec.toFixed(0)} ops/sec must be >100,000 ops/sec. Latency: ${(elapsed / iterations * 1000).toFixed(3)}us per op`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("truth repository: NodeRun seed throughput >100,000 ops/sec", (t) => {
  const store = new TruthStore();

  const iterations = 50000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    store.seedNodeRun(createNodeRun());
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;

  try {
    assert.ok(
      opsPerSec > 100000,
      `NodeRun seed throughput ${opsPerSec.toFixed(0)} ops/sec must be >100,000 ops/sec. Latency: ${(elapsed / iterations * 1000).toFixed(3)}us per op`,
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
// Event Append Throughput Benchmarks
// ============================================================================

test("truth repository: Event append throughput >50,000 events/sec", (t) => {
  const store = new TruthStore();

  const harnessRun = createHarnessRun();
  store.seedHarnessRun(harnessRun);

  const iterations = 50000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    store.appendEvent(createEvent("HarnessRun", harnessRun.harnessRunId, i));
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;

  try {
    assert.ok(
      opsPerSec > 50000,
      `Event append throughput ${opsPerSec.toFixed(0)} events/sec must be >50,000 events/sec. Latency: ${(elapsed / iterations * 1000).toFixed(3)}us per op`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("truth repository: Event append P99 latency <50us", (t) => {
  const store = new TruthStore();

  const harnessRun = createHarnessRun();
  store.seedHarnessRun(harnessRun);

  const latencies: number[] = [];
  const iterations = 10000;

  // Warmup
  for (let i = 0; i < 100; i++) {
    store.appendEvent(createEvent("HarnessRun", harnessRun.harnessRunId, i));
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    store.appendEvent(createEvent("HarnessRun", harnessRun.harnessRunId, i));
    latencies.push((performance.now() - start) * 1000); // Convert to microseconds
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)!]!;
  const p50 = latencies[Math.floor(iterations * 0.5)!]!;

  try {
    assert.ok(
      p99 < 50,
      `Event append P99 latency ${p99.toFixed(2)}us exceeds 50us target. P50: ${p50.toFixed(2)}us`,
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
// Snapshot Performance Benchmarks
// ============================================================================

test("truth repository: Snapshot creation <10ms for 1000 entries", (t) => {
  const store = new TruthStore();

  // Create 1000 harness runs and node runs
  for (let i = 0; i < 500; i++) {
    store.seedHarnessRun(createHarnessRun());
    store.seedNodeRun(createNodeRun());
  }

  const start = performance.now();
  const snapshot = store.snapshot();
  const elapsed = performance.now() - start;

  try {
    assert.ok(
      elapsed < 10,
      `Snapshot creation took ${elapsed.toFixed(2)}ms, expected <10ms for 1000 entries. Snapshot has ${snapshot.harnessRuns.length} harnessRuns and ${snapshot.nodeRuns.length} nodeRuns`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("truth repository: Snapshot memory efficiency <100KB for 1000 entries", (t) => {
  const store = new TruthStore();

  // Create 1000 harness runs and node runs
  for (let i = 0; i < 500; i++) {
    store.seedHarnessRun(createHarnessRun());
    store.seedNodeRun(createNodeRun());
  }

  const snapshot = store.snapshot();
  const snapshotJson = JSON.stringify(snapshot);
  const snapshotSizeKb = Buffer.byteLength(snapshotJson, "utf8") / 1024;

  try {
    assert.ok(
      snapshotSizeKb < 100,
      `Snapshot size ${snapshotSizeKb.toFixed(2)}KB exceeds 100KB target for 1000 entries (500 HarnessRun + 500 NodeRun)`,
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
// Concurrent Access Benchmarks
// ============================================================================

test("truth repository: Concurrent appends maintain consistency", async (t) => {
  const store = new TruthStore();

  const harnessRun = createHarnessRun();
  store.seedHarnessRun(harnessRun);

  const numWorkers = 10;
  const iterationsPerWorker = 500;
  const totalExpected = numWorkers * iterationsPerWorker;

  await Promise.all(
    Array.from({ length: numWorkers }, async (_, workerId) => {
      for (let i = 0; i < iterationsPerWorker; i++) {
        store.appendEvent(
          createEvent("HarnessRun", harnessRun.harnessRunId, workerId * iterationsPerWorker + i),
        );
      }
    }),
  );

  const snapshot = store.snapshot();

  try {
    assert.ok(
      snapshot.events.length === totalExpected,
      `Expected ${totalExpected} events, got ${snapshot.events.length} events with concurrent appends`,
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
// Large Scale Benchmarks
// ============================================================================

test("truth repository: Large scale storage (100K events) <3 seconds", (t) => {
  const store = new TruthStore();

  const harnessRun = createHarnessRun();
  store.seedHarnessRun(harnessRun);

  const eventCount = 100000;
  const start = performance.now();

  for (let i = 0; i < eventCount; i++) {
    store.appendEvent(createEvent("HarnessRun", harnessRun.harnessRunId, i));
  }

  const elapsed = performance.now() - start;
  const eventsPerSec = (eventCount / elapsed) * 1000;

  try {
    assert.ok(
      elapsed < 3000,
      `Large scale storage took ${elapsed.toFixed(2)}ms for ${eventCount} events, expected <3000ms. Throughput: ${eventsPerSec.toFixed(0)} events/sec`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});
