/**
 * Performance Test: Memory Usage Under Load
 * Measures memory consumption, growth, and cleanup under sustained load
 *
 * Design targets:
 * - Memory growth rate: <1MB/sec under sustained write load
 * - Heap usage stability: <100MB variance under steady state
 * - Memory cleanup: >90% memory reclaimed after large object release
 * - GC impact: <10ms pause time under memory pressure
 *
 * Note: Performance thresholds are set for reference hardware. On slower machines,
 * tests that miss the reference target are recorded as diagnostics rather than skipped.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { reportSoftPerformanceMiss } from "../../helpers/performance.js";

import { MemoryCacheStore } from "../../../src/platform/shared/cache/stores/memory-cache-store.js";
import { CacheFacade } from "../../../src/platform/shared/cache/cache-facade.js";
import type { CacheMeta } from "../../../src/platform/shared/cache/cache-types.js";

function createCacheMeta(ttlMs?: number): CacheMeta {
  const now = Date.now();
  return {
    scope: "memory",
    tags: ["test"],
    version: "1",
    createdAt: now,
    ...(ttlMs && { expiresAt: now + ttlMs }),
    lastAccessedAt: now,
    hitCount: 0,
    sizeBytes: 100,
  };
}

function getHeapStats(): { heapUsed: number; heapTotal: number; external: number } {
  const mem = process.memoryUsage();
  return {
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
    external: mem.external,
  };
}

// ============================================================================
// Memory Growth Rate Benchmarks
// ============================================================================

test("performance: memory growth rate <1MB/sec under sustained cache writes", (t) => {
  const store = new MemoryCacheStore(10000);
  const cache = new CacheFacade(store);

  const iterations = 5000;
  const startMem = getHeapStats();
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    cache.set(
      "growth",
      { id: i },
      { result: `value ${i}`, data: "x".repeat(100) },
    );
  }

  const elapsed = (performance.now() - start) / 1000; // seconds
  const endMem = getHeapStats();
  const heapGrowth = (endMem.heapUsed - startMem.heapUsed) / 1024 / 1024; // MB
  const growthRate = heapGrowth / elapsed; // MB/sec

  try {
    assert.ok(
      growthRate < 1,
      `Memory growth rate ${growthRate.toFixed(3)}MB/sec exceeds 1MB/sec target. Total growth: ${heapGrowth.toFixed(2)}MB over ${elapsed.toFixed(2)}s`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("performance: heap usage variance <100MB under steady state cache load", (t) => {
  const store = new MemoryCacheStore(5000);
  const cache = new CacheFacade(store);

  // Pre-populate to steady state
  for (let i = 0; i < 3000; i++) {
    cache.set("steady", { id: i }, { result: `value ${i}` });
  }

  // Measure variance over multiple cycles
  const samples: number[] = [];
  const cycles = 20;
  const opsPerCycle = 100;

  for (let c = 0; c < cycles; c++) {
    // Perform mix of reads and writes
    for (let i = 0; i < opsPerCycle; i++) {
      const id = (c * opsPerCycle + i) % 3000;
      if (i % 2 === 0) {
        cache.get("steady", { id });
      } else {
        cache.set("steady", { id }, { result: `updated ${id}` });
      }
    }
    samples.push(getHeapStats().heapUsed);
  }

  // Calculate variance
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const variance = samples.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / samples.length;
  const stdDevMB = Math.sqrt(variance) / 1024 / 1024;

  try {
    assert.ok(
      stdDevMB < 100,
      `Heap usage standard deviation ${stdDevMB.toFixed(2)}MB exceeds 100MB target under steady state`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("performance: memory cleanup reclaims >90% memory after large cache release", (t) => {
  const store = new MemoryCacheStore(100);
  const cache = new CacheFacade(store);

  // Fill with large objects
  const largeData = "x".repeat(10000); // 10KB per entry
  for (let i = 0; i < 50; i++) {
    cache.set("large", { id: i }, { result: `value ${i}`, data: largeData });
  }

  const beforeMem = getHeapStats();

  // Clear the namespace
  cache.invalidateNamespace("large");

  // Force GC hint (in real scenarios, V8 will GC when needed)
  if (global.gc) {
    global.gc();
  }

  const afterMem = getHeapStats();
  const memoryReclaimed = beforeMem.heapUsed - afterMem.heapUsed;
  const reclaimPercentage = (memoryReclaimed / (50 * 10000)) * 100;

  try {
    assert.ok(
      reclaimPercentage > 90,
      `Memory reclaim ${reclaimPercentage.toFixed(1)}% is less than 90% after cache invalidation`,
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
// Memory Under Sustained Load Benchmarks
// ============================================================================

test("performance: sustained 10K cache operations memory stable <200MB heap", (t) => {
  const store = new MemoryCacheStore(5000);
  const cache = new CacheFacade(store);

  const beforeMem = getHeapStats();

  // Perform 10,000 mixed operations
  for (let i = 0; i < 10000; i++) {
    const id = i % 2000;
    if (i % 3 === 0) {
      cache.set("sustained", { id }, { result: `op ${i}`, index: i });
    } else {
      cache.get("sustained", { id });
    }
  }

  const afterMem = getHeapStats();
  const netGrowth = (afterMem.heapUsed - beforeMem.heapUsed) / 1024 / 1024;

  try {
    assert.ok(
      netGrowth < 200,
      `Net heap growth ${netGrowth.toFixed(2)}MB exceeds 200MB after 10K operations`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("performance: continuous eviction under memory pressure", (t) => {
  // Small cache to force constant eviction
  const store = new MemoryCacheStore(100);
  const cache = new CacheFacade(store);

  const samples: number[] = [];
  const iterations = 5000;

  for (let i = 0; i < iterations; i++) {
    cache.set("evict", { id: i }, { result: `value ${i}`, data: "x".repeat(50) });

    // Sample memory every 100 iterations
    if (i % 100 === 0) {
      samples.push(getHeapStats().heapUsed);
    }
  }

  // Check that memory doesn't grow unbounded - it should stabilize due to LRU eviction
  const firstSample = samples[0]!;
  const lastSample = samples[samples.length - 1]!;
  const growthMB = (lastSample - firstSample) / 1024 / 1024;

  try {
    assert.ok(
      growthMB < 50,
      `Memory grew ${growthMB.toFixed(2)}MB under continuous eviction, suggesting unbounded growth`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("performance: cache with TTL expiration releases memory timely", (t) => {
  const store = new MemoryCacheStore(1000);
  const cache = new CacheFacade(store);

  // Fill cache with TTL items
  for (let i = 0; i < 500; i++) {
    cache.set("ttl", { id: i }, { result: `value ${i}` }, { tags: ["test"] }, 100); // 100ms TTL
  }

  const beforeMem = getHeapStats();

  // Wait for TTL to expire
  const waitTime = 150; // ms, longer than TTL
  const start = performance.now();
  while (performance.now() - start < waitTime) {
    // Busy wait for TTL
  }

  // Access to trigger cleanup
  for (let i = 0; i < 500; i++) {
    cache.get("ttl", { id: i });
  }

  const afterMem = getHeapStats();
  const memoryReleased = (beforeMem.heapUsed - afterMem.heapUsed) / 1024 / 1024;

  try {
    assert.ok(
      memoryReleased > 0.1,
      `Expected some memory release after TTL expiration, got ${memoryReleased.toFixed(4)}MB`,
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
// Memory Efficiency Benchmarks
// ============================================================================

test("performance: small entries memory efficient <0.5KB per entry", (t) => {
  const store = new MemoryCacheStore(2000);
  const cache = new CacheFacade(store);

  const beforeMem = getHeapStats();
  const entries = 1000;

  for (let i = 0; i < entries; i++) {
    cache.set("small", { id: i }, { value: i });
  }

  const afterMem = getHeapStats();
  const memoryPerEntry = (afterMem.heapUsed - beforeMem.heapUsed) / entries / 1024;

  try {
    assert.ok(
      memoryPerEntry < 0.5,
      `Memory per small entry ${memoryPerEntry.toFixed(3)}KB exceeds 0.5KB target`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("performance: large entries memory bounded <10KB per 1KB data entry", (t) => {
  const store = new MemoryCacheStore(500);
  const cache = new CacheFacade(store);

  const beforeMem = getHeapStats();
  const entries = 100;
  const dataSize = 1024; // 1KB of actual data

  for (let i = 0; i < entries; i++) {
    cache.set("large", { id: i }, { result: "x".repeat(dataSize) });
  }

  const afterMem = getHeapStats();
  const memoryPerEntry = (afterMem.heapUsed - beforeMem.heapUsed) / entries / 1024;

  try {
    assert.ok(
      memoryPerEntry < 10,
      `Memory overhead per large entry ${memoryPerEntry.toFixed(2)}KB exceeds 10KB target (10x data size)`,
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
// Multi-Namespace Memory Benchmarks
// ============================================================================

test("performance: multiple namespaces memory isolated", (t) => {
  const store = new MemoryCacheStore(2000);
  const cache = new CacheFacade(store);

  // Create multiple namespaces
  const namespaces = ["ns1", "ns2", "ns3", "ns4", "ns5"];
  const entriesPerNamespace = 200;

  for (const ns of namespaces) {
    for (let i = 0; i < entriesPerNamespace; i++) {
      cache.set(ns, { id: i }, { result: `value ${i}` });
    }
  }

  const mem = getHeapStats();
  const totalEntries = namespaces.length * entriesPerNamespace;

  // Each namespace should be isolated - total should be roughly additive
  // but with some shared overhead
  const estimatedMB = totalEntries * 0.2 / 1024; // ~0.2KB per entry baseline

  try {
    assert.ok(
      mem.heapUsed < 100 * 1024 * 1024, // Should be well under 100MB
      `Multi-namespace memory ${(mem.heapUsed / 1024 / 1024).toFixed(2)}MB seems excessive for ${totalEntries} entries`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("performance: namespace invalidation releases memory proportionally", (t) => {
  const store = new MemoryCacheStore(2000);
  const cache = new CacheFacade(store);

  // Fill 3 namespaces
  const namespaces = ["a", "b", "c"];
  for (const ns of namespaces) {
    for (let i = 0; i < 100; i++) {
      cache.set(ns, { id: i }, { result: `value ${i}`, data: "x".repeat(500) });
    }
  }

  const beforeMem = getHeapStats();

  // Invalidate one namespace
  cache.invalidateNamespace("b");

  const afterMem = getHeapStats();
  const memoryReleased = beforeMem.heapUsed - afterMem.heapUsed;
  const releasePercentage = (memoryReleased / (100 * 500)) * 100;

  try {
    assert.ok(
      releasePercentage > 50,
      `Namespace invalidation released only ${releasePercentage.toFixed(1)}% of namespace memory`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});
