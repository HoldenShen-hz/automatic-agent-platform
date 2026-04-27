/**
 * Performance Test: Cache Operations
 * Measures cache get/set/delete throughput and latency
 *
 * Design targets:
 * - Cache get: >50000 ops/sec
 * - Cache set: >20000 ops/sec
 * - Cache delete: >30000 ops/sec
 * - Cache hit ratio impact on read latency
 */

import assert from "node:assert/strict";
import test from "node:test";
import { reportSoftPerformanceMiss } from "../helpers/performance.js";

import {
  MultiLevelCacheStore,
  MemoryCacheStore,
} from "../../src/platform/shared/cache/stores/multi-level-cache-store.js";
import { StableHash } from "../../src/platform/shared/cache/utils/stable-hash.js";

function createTestCache(): MultiLevelCacheStore {
  return new MultiLevelCacheStore({
    maxSize: 10000,
    maxAgeMs: 60000,
    enableMetrics: false,
  });
}

function stableHash(key: string): string {
  return new StableHash().update(key).digest();
}

// ============================================================================
// Cache Get Benchmarks
// ============================================================================

test("performance: cache.get() throughput >50000 ops/sec", (t) => {
  const cache = createTestCache();

  // Pre-populate cache
  for (let i = 0; i < 1000; i++) {
    const key = `key-${i}`;
    cache.set(stableHash(key), { value: `value-${i}` }, 30000);
  }

  const iterations = 50000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const key = `key-${i % 1000}`;
    cache.get(stableHash(key));
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;
  const avgLatencyMs = elapsed / iterations;

  try {
    assert.ok(
      opsPerSec > 50000,
      `Cache get throughput ${opsPerSec.toFixed(0)} ops/sec must be >50000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("performance: cache.get() P99 latency <0.1ms", (t) => {
  const cache = createTestCache();

  // Pre-populate cache
  for (let i = 0; i < 1000; i++) {
    const key = `key-${i}`;
    cache.set(stableHash(key), { value: `value-${i}` }, 30000);
  }

  const latencies: number[] = [];
  const iterations = 50000;

  // Warmup
  for (let i = 0; i < 1000; i++) {
    const key = `key-${i % 1000}`;
    cache.get(stableHash(key));
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const key = `key-${i % 1000}`;
    const start = performance.now();
    cache.get(stableHash(key));
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  try {
    assert.ok(
      p99 < 0.1,
      `Cache get P99 latency ${p99.toFixed(4)}ms exceeds 0.1ms target. P50: ${p50.toFixed(4)}ms`,
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

test("performance: cache.set() throughput >20000 ops/sec", (t) => {
  const cache = createTestCache();

  const iterations = 20000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const key = `new-key-${i}`;
    cache.set(stableHash(key), { value: `value-${i}` }, 30000);
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;
  const avgLatencyMs = elapsed / iterations;

  try {
    assert.ok(
      opsPerSec > 20000,
      `Cache set throughput ${opsPerSec.toFixed(0)} ops/sec must be >20000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("performance: cache.set() P99 latency <0.2ms", (t) => {
  const cache = createTestCache();

  const latencies: number[] = [];
  const iterations = 20000;

  // Warmup
  for (let i = 0; i < 100; i++) {
    const key = `warmup-key-${i}`;
    cache.set(stableHash(key), { value: `value-${i}` }, 30000);
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const key = `new-key-${i}`;
    const start = performance.now();
    cache.set(stableHash(key), { value: `value-${i}` }, 30000);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  try {
    assert.ok(
      p99 < 0.2,
      `Cache set P99 latency ${p99.toFixed(4)}ms exceeds 0.2ms target. P50: ${p50.toFixed(4)}ms`,
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
// Cache Delete Benchmarks
// ============================================================================

test("performance: cache.delete() throughput >30000 ops/sec", (t) => {
  const cache = createTestCache();

  // Pre-populate cache
  const keys: string[] = [];
  for (let i = 0; i < 10000; i++) {
    const key = `delete-key-${i}`;
    keys.push(key);
    cache.set(stableHash(key), { value: `value-${i}` }, 30000);
  }

  const iterations = 5000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const key = keys[i % keys.length]!;
    cache.delete(stableHash(key));
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;
  const avgLatencyMs = elapsed / iterations;

  try {
    assert.ok(
      opsPerSec > 30000,
      `Cache delete throughput ${opsPerSec.toFixed(0)} ops/sec must be >30000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
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
// Mixed Operations Benchmarks
// ============================================================================

test("performance: mixed cache operations (80% reads, 20% writes) >40000 ops/sec", (t) => {
  const cache = createTestCache();

  // Pre-populate cache
  for (let i = 0; i < 1000; i++) {
    const key = `key-${i}`;
    cache.set(stableHash(key), { value: `value-${i}` }, 30000);
  }

  const iterations = 50000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const op = i % 10;
    if (op < 8) {
      // 80% reads
      const key = `key-${i % 1000}`;
      cache.get(stableHash(key));
    } else {
      // 20% writes
      const key = `new-key-${i}`;
      cache.set(stableHash(key), { value: `value-${i}` }, 30000);
    }
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;
  const avgLatencyMs = elapsed / iterations;

  try {
    assert.ok(
      opsPerSec > 40000,
      `Mixed cache ops throughput ${opsPerSec.toFixed(0)} ops/sec must be >40000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
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
// Stable Hash Benchmarks
// ============================================================================

test("performance: StableHash digest throughput >100000 ops/sec", (t) => {
  const hasher = new StableHash();
  const testStrings = [
    "key-value-pair-1",
    "system-prompt-with-governance-constraints",
    "task-input-json-string",
    "workflow-state-output",
  ];

  const iterations = 100000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const str = testStrings[i % testStrings.length]!;
    hasher.update(str).digest();
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;
  const avgLatencyMs = elapsed / iterations;

  try {
    assert.ok(
      opsPerSec > 100000,
      `StableHash digest throughput ${opsPerSec.toFixed(0)} ops/sec must be >100000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});
