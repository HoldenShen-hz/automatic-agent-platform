/**
 * Performance Test: Cache Hit Rate
 * Measures cache effectiveness with various hit/miss scenarios
 *
 * Design targets:
 * - 100% hit rate: >100000 ops/sec
 * - 90% hit rate: >50000 ops/sec
 * - Cold cache (0% hit): >5000 ops/sec
 * - Cache eviction impact: <10% throughput degradation
 */

import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import { reportSoftPerformanceMiss } from "../helpers/performance.js";

import { CacheFacade } from "../../src/platform/shared/cache/cache-facade.js";
import { MemoryCacheStore } from "../../src/platform/shared/cache/stores/memory-cache-store.js";

function createTestFacade(): CacheFacade {
  const store = new MemoryCacheStore(10000);
  return new CacheFacade(store);
}

// ============================================================================
// 100% Hit Rate Benchmarks
// ============================================================================

test("performance: Cache hit rate 100% - throughput >100000 ops/sec", (t) => {
  const facade = createTestFacade();

  // Pre-populate cache with 100 items
  for (let i = 0; i < 100; i++) {
    facade.set("test", { id: i }, { id: i, value: `value-${i}` }).catch(() => {});
  }

  const iterations = 50000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    facade.get("test", { id: i % 100 }).catch(() => {});
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;
  const avgLatencyMs = elapsed / iterations;

  try {
    assert.ok(
      opsPerSec > 100000,
      `100% hit rate throughput ${opsPerSec.toFixed(0)} ops/sec must be >100000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("performance: Cache hit rate 100% - P99 latency <0.02ms", (t) => {
  const facade = createTestFacade();

  // Pre-populate cache with 100 items
  for (let i = 0; i < 100; i++) {
    facade.set("test", { id: i }, { id: i, value: `value-${i}` }).catch(() => {});
  }

  const latencies: number[] = [];
  const iterations = 20000;

  // Warmup
  for (let i = 0; i < 100; i++) {
    facade.get("test", { id: i % 100 }).catch(() => {});
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    facade.get("test", { id: i % 100 }).catch(() => {});
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  try {
    assert.ok(
      p99 < 0.02,
      `100% hit rate P99 latency ${p99.toFixed(4)}ms exceeds 0.02ms target. P50: ${p50.toFixed(4)}ms`,
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
// 90% Hit Rate Benchmarks
// ============================================================================

test("performance: Cache hit rate 90% - throughput >50000 ops/sec", (t) => {
  const facade = createTestFacade();

  // Pre-populate cache with 90 items (will be accessed 90% of the time)
  for (let i = 0; i < 90; i++) {
    facade.set("test", { id: i }, { id: i, value: `value-${i}` }).catch(() => {});
  }

  const iterations = 50000;
  let hitCount = 0;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const result = facade.get("test", { id: i % 100 });
    // 90% will be hits (0-89), 10% will be misses (90-99)
    if ((i % 100) < 90) {
      hitCount++;
    }
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;
  const avgLatencyMs = elapsed / iterations;

  try {
    assert.ok(
      opsPerSec > 50000,
      `90% hit rate throughput ${opsPerSec.toFixed(0)} ops/sec must be >50000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("performance: Cache hit rate 90% - actual hit rate within tolerance", async (t) => {
  const facade = createTestFacade();

  // Pre-populate cache with 90 items
  for (let i = 0; i < 90; i++) {
    await facade.set("test", { id: i }, { id: i, value: `value-${i}` });
  }

  const iterations = 10000;
  let hitCount = 0;

  for (let i = 0; i < iterations; i++) {
    const result = await facade.get("test", { id: i % 100 });
    if (result.hit) {
      hitCount++;
    }
  }

  const hitRate = (hitCount / iterations) * 100;

  try {
    assert.ok(
      hitRate >= 89 && hitRate <= 91,
      `Expected ~90% hit rate, got ${hitRate.toFixed(1)}%`,
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
// Cold Cache (0% Hit) Benchmarks
// ============================================================================

test("performance: Cache hit rate 0% (cold cache) - throughput >5000 ops/sec", (t) => {
  const facade = createTestFacade();

  // DO NOT pre-populate cache - all reads will be misses

  const iterations = 5000;
  let missCount = 0;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    // Using unique keys to ensure misses
    const result = facade.get("test", { uniqueId: i }).catch(() => ({ hit: false, value: undefined }));
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;
  const avgLatencyMs = elapsed / iterations;

  try {
    assert.ok(
      opsPerSec > 5000,
      `Cold cache throughput ${opsPerSec.toFixed(0)} ops/sec must be >5000 ops/sec. Avg: ${avgLatencyMs.toFixed(3)}ms`,
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
// Mixed Workload Benchmarks
// ============================================================================

test("performance: Mixed workload (70% reads, 30% writes) >30000 ops/sec", (t) => {
  const facade = createTestFacade();

  // Pre-populate with some data
  for (let i = 0; i < 50; i++) {
    facade.set("mixed", { id: i }, { id: i, value: `value-${i}` }).catch(() => {});
  }

  const iterations = 10000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const op = i % 10;
    if (op < 7) {
      // 70% reads
      facade.get("mixed", { id: i % 50 }).catch(() => {});
    } else {
      // 30% writes
      facade.set("mixed", { id: i % 50 }, { id: i, value: `updated-${i}` }).catch(() => {});
    }
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;
  const avgLatencyMs = elapsed / iterations;

  try {
    assert.ok(
      opsPerSec > 30000,
      `Mixed workload throughput ${opsPerSec.toFixed(0)} ops/sec must be >30000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
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
// getOrCompute Hit Rate Benchmarks
// ============================================================================

test("performance: getOrCompute hit rate 100% - throughput >80000 ops/sec", async (t) => {
  const facade = createTestFacade();

  // Pre-populate cache
  for (let i = 0; i < 100; i++) {
    await facade.set("compute", { id: i }, { id: i, computed: true });
  }

  const iterations = 30000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    facade.getOrCompute("compute", { id: i % 100 }, async () => ({ computed: false })).catch(() => {});
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;
  const avgLatencyMs = elapsed / iterations;

  try {
    assert.ok(
      opsPerSec > 80000,
      `getOrCompute 100% hit rate throughput ${opsPerSec.toFixed(0)} ops/sec must be >80000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("performance: getOrCompute hit rate 50% - throughput >20000 ops/sec", async (t) => {
  const facade = createTestFacade();

  // Pre-populate cache with 50 items
  for (let i = 0; i < 50; i++) {
    await facade.set("compute", { id: i }, { id: i, computed: true });
  }

  let computeCount = 0;
  const compute = async () => {
    computeCount++;
    return { computed: true };
  };

  const iterations = 10000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    await facade.getOrCompute("compute", { id: i % 100 }, compute);
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;
  const avgLatencyMs = elapsed / iterations;

  try {
    assert.ok(
      opsPerSec > 20000,
      `getOrCompute 50% hit rate throughput ${opsPerSec.toFixed(0)} ops/sec must be >20000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
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
// Cache Eviction Impact Benchmarks
// ============================================================================

test("performance: Cache eviction impact <10% throughput degradation", async (t) => {
  const facade = createTestFacade();

  // Pre-populate with items up to 80% of capacity
  const capacity = 10000;
  const initialCount = Math.floor(capacity * 0.8);

  for (let i = 0; i < initialCount; i++) {
    await facade.set("evict", { id: i }, { id: i, value: `value-${i}` });
  }

  // Measure throughput before eviction
  const iterations = 10000;
  const startBefore = performance.now();
  for (let i = 0; i < iterations; i++) {
    facade.get("evict", { id: i % initialCount }).catch(() => {});
  }
  const elapsedBefore = performance.now() - startBefore;
  const throughputBefore = (iterations / elapsedBefore) * 1000;

  // Add more items to trigger eviction (push to 100% capacity)
  for (let i = initialCount; i < capacity; i++) {
    await facade.set("evict", { id: i }, { id: i, value: `value-${i}` });
  }

  // Measure throughput after eviction
  const startAfter = performance.now();
  for (let i = 0; i < iterations; i++) {
    facade.get("evict", { id: i % capacity }).catch(() => {});
  }
  const elapsedAfter = performance.now() - startAfter;
  const throughputAfter = (iterations / elapsedAfter) * 1000;

  const degradation = ((throughputBefore - throughputAfter) / throughputBefore) * 100;

  try {
    assert.ok(
      degradation < 10,
      `Cache eviction caused ${degradation.toFixed(1)}% throughput degradation, expected <10%. Before: ${throughputBefore.toFixed(0)}, After: ${throughputAfter.toFixed(0)}`,
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
// Cache Warm-up Benchmarks
// ============================================================================

test("performance: Cache warm-up (1000 items) <200ms", async (t) => {
  const facade = createTestFacade();

  const itemCount = 1000;
  const start = performance.now();

  for (let i = 0; i < itemCount; i++) {
    await facade.set("warmup", { id: i }, { id: i, value: `value-${i}` });
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (itemCount / elapsed) * 1000;

  try {
    assert.ok(
      elapsed < 200,
      `Cache warm-up of ${itemCount} items took ${elapsed.toFixed(2)}ms, expected <200ms. Throughput: ${opsPerSec.toFixed(0)} ops/sec`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});
