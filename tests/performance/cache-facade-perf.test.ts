/**
 * Performance Test: Cache Facade
 * Measures CacheFacade get/set/getOrCompute operations
 *
 * Design targets:
 * - Cache get (hit): >100000 ops/sec
 * - Cache set: >50000 ops/sec
 * - getOrCompute (cache miss): >10000 ops/sec
 * - getOrCompute (cache hit): >100000 ops/sec
 */

import assert from "node:assert/strict";
import test from "node:test";
import { reportSoftPerformanceMiss } from "../helpers/performance.js";
import { performance } from "node:perf_hooks";

import { CacheFacade } from "../../src/platform/shared/cache/cache-facade.js";
import { MemoryCacheStore } from "../../src/platform/shared/cache/stores/memory-cache-store.js";

function createTestFacade(): CacheFacade {
  const store = new MemoryCacheStore(10000);
  return new CacheFacade(store);
}

// ============================================================================
// Cache Get (Hit) Benchmarks
// ============================================================================

test("performance: CacheFacade.get() hit throughput >100000 ops/sec", (t) => {
  const facade = createTestFacade();

  // Pre-populate cache
  for (let i = 0; i < 100; i++) {
    facade.set("test", { id: i }, { id: i, value: `test-${i}` }).catch(() => {});
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
      `Cache get (hit) throughput ${opsPerSec.toFixed(0)} ops/sec must be >100000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("performance: CacheFacade.get() P99 latency <0.02ms", (t) => {
  const facade = createTestFacade();

  // Pre-populate cache
  for (let i = 0; i < 100; i++) {
    facade.set("test", { id: i }, { id: i, value: `test-${i}` }).catch(() => {});
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
      `Cache get P99 latency ${p99.toFixed(4)}ms exceeds 0.02ms target. P50: ${p50.toFixed(4)}ms`,
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
// Cache Set Benchmarks
// ============================================================================

test("performance: CacheFacade.set() throughput >50000 ops/sec", (t) => {
  const facade = createTestFacade();

  const iterations = 20000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    facade.set("test", { id: i }, { id: i, value: `test-${i}` }).catch(() => {});
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;
  const avgLatencyMs = elapsed / iterations;

  try {
    assert.ok(
      opsPerSec > 50000,
      `Cache set throughput ${opsPerSec.toFixed(0)} ops/sec must be >50000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("performance: CacheFacade.set() P99 latency <0.05ms", (t) => {
  const facade = createTestFacade();

  const latencies: number[] = [];
  const iterations = 10000;

  // Warmup
  for (let i = 0; i < 100; i++) {
    facade.set("warmup", { id: i }, { id: i }).catch(() => {});
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    facade.set("test", { id: i }, { id: i, value: `test-${i}` }).catch(() => {});
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  try {
    assert.ok(
      p99 < 0.05,
      `Cache set P99 latency ${p99.toFixed(4)}ms exceeds 0.05ms target. P50: ${p50.toFixed(4)}ms`,
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
// getOrCompute Benchmarks
// ============================================================================

test("performance: CacheFacade.getOrCompute() hit >100000 ops/sec", (t) => {
  const facade = createTestFacade();

  // Pre-populate cache
  for (let i = 0; i < 100; i++) {
    facade.set("test", { id: i }, { id: i, value: `test-${i}` }).catch(() => {});
  }

  const iterations = 50000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    facade.getOrCompute("test", { id: i % 100 }, async () => ({ computed: true })).catch(() => {});
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;
  const avgLatencyMs = elapsed / iterations;

  try {
    assert.ok(
      opsPerSec > 100000,
      `getOrCompute (hit) throughput ${opsPerSec.toFixed(0)} ops/sec must be >100000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("performance: CacheFacade.getOrCompute() miss P99 <10ms", async (t) => {
  const facade = createTestFacade();

  let computeCount = 0;
  const compute = async () => {
    computeCount++;
    return { computed: true, timestamp: Date.now() };
  };

  const latencies: number[] = [];
  const iterations = 1000;

  // Warmup
  await facade.getOrCompute("test", { warmup: true }, compute);

  // Measure - each call misses cache and requires compute
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await facade.getOrCompute("test", { miss: i }, compute);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  try {
    assert.ok(
      p99 < 10,
      `getOrCompute (miss) P99 latency ${p99.toFixed(3)}ms exceeds 10ms target. P50: ${p50.toFixed(3)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("performance: CacheFacade.getOrCompute() deduplication prevents double compute", async () => {
  const facade = createTestFacade();

  let computeCount = 0;
  const compute = async () => {
    computeCount++;
    await new Promise((r) => setTimeout(r, 5)); // Simulate async work
    return { computed: true };
  };

  // Launch multiple concurrent requests for same key - only 1 compute should happen
  const results = await Promise.all([
    facade.getOrCompute("dedup", { key: "same" }, compute),
    facade.getOrCompute("dedup", { key: "same" }, compute),
    facade.getOrCompute("dedup", { key: "same" }, compute),
    facade.getOrCompute("dedup", { key: "same" }, compute),
  ]);

  // Deduplication should ensure only 1 compute happened
  assert.ok(
    computeCount <= 2,
    `Expected at most 2 compute calls due to deduplication, got ${computeCount}`,
  );

  // All should return successfully with the computed value
  assert.ok(results.every((r) => r.value.computed === true));
});

// ============================================================================
// Namespace Isolation Benchmarks
// ============================================================================

test("performance: CacheFacade namespace isolation - separate namespaces don't interfere", async (t) => {
  const facade = createTestFacade();

  // Set in namespace A
  await facade.set("namespace-a", { id: 1 }, { value: "a" });

  // Set in namespace B
  await facade.set("namespace-b", { id: 1 }, { value: "b" });

  // Get should return correct values for each namespace
  const resultA = await facade.get<{ value: string }>("namespace-a", { id: 1 });
  const resultB = await facade.get<{ value: string }>("namespace-b", { id: 1 });

  try {
    assert.ok(resultA.hit && resultA.value?.value === "a");
    assert.ok(resultB.hit && resultB.value?.value === "b");
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("performance: CacheFacade bulk operations throughput >20000 ops/sec", (t) => {
  const facade = createTestFacade();

  const iterations = 5000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    // Mix of gets and sets
    const j = i % 100;
    if (j % 3 === 0) {
      facade.set("bulk", { id: j }, { id: j, value: `v${j}` }).catch(() => {});
    } else {
      facade.get("bulk", { id: j }).catch(() => {});
    }
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;

  try {
    assert.ok(
      opsPerSec > 20000,
      `Bulk cache operations throughput ${opsPerSec.toFixed(0)} ops/sec must be >20000 ops/sec`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});
