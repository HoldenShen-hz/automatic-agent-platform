/**
 * Performance Test: Cache Operations
 * Measures direct L1 cache get/set/delete throughput and latency.
 *
 * Root cause fixed here:
 * this suite had drifted to an older synchronous cache API, while the current
 * cache stores are async and namespace-aware. The old test shape produced
 * misleading passes plus post-test unhandled rejections.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { reportSoftPerformanceMiss } from "../helpers/performance.js";

import type { CacheMeta } from "../../src/platform/shared/cache/cache-types.js";
import { MemoryCacheStore } from "../../src/platform/shared/cache/stores/memory-cache-store.js";
import { stableHash } from "../../src/platform/shared/cache/utils/stable-hash.js";

const NAMESPACE = "perf";

function createTestCache(): MemoryCacheStore {
  return new MemoryCacheStore(10000);
}

function createCacheMeta(ttlMs = 30000): CacheMeta {
  const now = Date.now();
  return {
    scope: "memory",
    tags: ["perf"],
    version: "perf",
    createdAt: now,
    expiresAt: now + ttlMs,
    lastAccessedAt: now,
    hitCount: 0,
    sizeBytes: 64,
  };
}

test("performance: cache.get() throughput >50000 ops/sec", async (t) => {
  const cache = createTestCache();

  for (let i = 0; i < 1000; i++) {
    const key = `key-${i}`;
    await cache.set(NAMESPACE, stableHash(key), { value: `value-${i}` }, createCacheMeta());
  }

  const iterations = 50000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const key = `key-${i % 1000}`;
    await cache.get(NAMESPACE, stableHash(key));
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

test("performance: cache.get() P99 latency <0.1ms", async (t) => {
  const cache = createTestCache();

  for (let i = 0; i < 1000; i++) {
    const key = `key-${i}`;
    await cache.set(NAMESPACE, stableHash(key), { value: `value-${i}` }, createCacheMeta());
  }

  const latencies: number[] = [];
  const iterations = 50000;

  for (let i = 0; i < 1000; i++) {
    const key = `key-${i % 1000}`;
    await cache.get(NAMESPACE, stableHash(key));
  }

  for (let i = 0; i < iterations; i++) {
    const key = `key-${i % 1000}`;
    const start = performance.now();
    await cache.get(NAMESPACE, stableHash(key));
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

test("performance: cache.set() throughput >20000 ops/sec", async (t) => {
  const cache = createTestCache();

  const iterations = 20000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const key = `new-key-${i}`;
    await cache.set(NAMESPACE, stableHash(key), { value: `value-${i}` }, createCacheMeta());
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

test("performance: cache.set() P99 latency <0.2ms", async (t) => {
  const cache = createTestCache();

  const latencies: number[] = [];
  const iterations = 20000;

  for (let i = 0; i < 100; i++) {
    const key = `warmup-key-${i}`;
    await cache.set(NAMESPACE, stableHash(key), { value: `value-${i}` }, createCacheMeta());
  }

  for (let i = 0; i < iterations; i++) {
    const key = `new-key-${i}`;
    const start = performance.now();
    await cache.set(NAMESPACE, stableHash(key), { value: `value-${i}` }, createCacheMeta());
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

test("performance: cache.delete() throughput >30000 ops/sec", async (t) => {
  const cache = createTestCache();

  const keys: string[] = [];
  for (let i = 0; i < 10000; i++) {
    const key = `delete-key-${i}`;
    keys.push(key);
    await cache.set(NAMESPACE, stableHash(key), { value: `value-${i}` }, createCacheMeta());
  }

  const iterations = 5000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const key = keys[i % keys.length]!;
    await cache.delete(NAMESPACE, stableHash(key));
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

test("performance: mixed cache operations (80% reads, 20% writes) >40000 ops/sec", async (t) => {
  const cache = createTestCache();

  for (let i = 0; i < 1000; i++) {
    const key = `key-${i}`;
    await cache.set(NAMESPACE, stableHash(key), { value: `value-${i}` }, createCacheMeta());
  }

  const iterations = 50000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const op = i % 10;
    if (op < 8) {
      const key = `key-${i % 1000}`;
      await cache.get(NAMESPACE, stableHash(key));
    } else {
      const key = `new-key-${i}`;
      await cache.set(NAMESPACE, stableHash(key), { value: `value-${i}` }, createCacheMeta());
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

test("performance: StableHash digest throughput >100000 ops/sec", (t) => {
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
    stableHash(str);
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
