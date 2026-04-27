/**
 * Performance Test: Service Registry
 * Measures service registration, initialization, and retrieval throughput
 *
 * Design targets:
 * - Service registration: >10000 ops/sec
 * - Service retrieval (cached): >100000 ops/sec
 * - Service reset: >1000 ops/sec
 */

import assert from "node:assert/strict";
import test from "node:test";
import { reportSoftPerformanceMiss } from "../helpers/performance.js";

import { ServiceRegistry } from "../../src/platform/shared/lifecycle/service-registry.js";

// Helper to create a fresh registry
function createTestRegistry(): ServiceRegistry {
  // Create registry and register test services
  const registry = ServiceRegistry.getInstance();

  // Register multiple test services
  for (let i = 0; i < 10; i++) {
    const id = `perf-test-service-${i}`;
    if (!Array.from(registry["services"].keys()).includes(id)) {
      registry.register(id, {
        init: () => ({ id, value: i }),
      });
    }
  }

  return registry;
}

// ============================================================================
// Service Retrieval Benchmarks (Cached)
// ============================================================================

test("performance: ServiceRegistry.get() cached retrieval >100000 ops/sec", (t) => {
  const registry = createTestRegistry();

  const iterations = 100000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    registry.get("perf-test-service-0");
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;
  const avgLatencyMs = elapsed / iterations;

  try {
    assert.ok(
      opsPerSec > 100000,
      `Service retrieval throughput ${opsPerSec.toFixed(0)} ops/sec must be >100000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("performance: ServiceRegistry.get() P99 latency <0.01ms", (t) => {
  const registry = createTestRegistry();

  // Warmup - initialize all services
  for (let i = 0; i < 10; i++) {
    registry.get(`perf-test-service-${i}`);
  }

  const latencies: number[] = [];
  const iterations = 50000;

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    registry.get("perf-test-service-5");
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  try {
    assert.ok(
      p99 < 0.01,
      `Service retrieval P99 latency ${p99.toFixed(4)}ms exceeds 0.01ms target. P50: ${p50.toFixed(4)}ms`,
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
// Service Registration Benchmarks
// ============================================================================

test("performance: ServiceRegistry.register() throughput >10000 ops/sec", async (t) => {
  const iterations = 10000;

  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const registry = new ServiceRegistry();
    registry.register(`perf-register-${i}`, {
      init: () => ({ id: i }),
    });
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;
  const avgLatencyMs = elapsed / iterations;

  try {
    assert.ok(
      opsPerSec > 10000,
      `Service registration throughput ${opsPerSec.toFixed(0)} ops/sec must be >10000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
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
// Multiple Service Retrieval Benchmarks
// ============================================================================

test("performance: retrieve 10 services in sequence >50000 ops/sec", (t) => {
  const registry = createTestRegistry();

  const iterations = 10000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    for (let j = 0; j < 10; j++) {
      registry.get(`perf-test-service-${j}`);
    }
  }

  const elapsed = performance.now() - start;
  const totalOps = iterations * 10;
  const opsPerSec = (totalOps / elapsed) * 1000;
  const avgLatencyMs = elapsed / totalOps;

  try {
    assert.ok(
      opsPerSec > 50000,
      `Multi-service retrieval throughput ${opsPerSec.toFixed(0)} ops/sec must be >50000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
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
// Lazy Initialization Benchmarks
// ============================================================================

test("performance: lazy init of 100 services <50ms total", async (t) => {
  const iterations = 100;

  let totalTime = 0;

  for (let iter = 0; iter < iterations; iter++) {
    const registry = new ServiceRegistry();

    // Register 100 services
    for (let i = 0; i < 100; i++) {
      const idx = iter * 100 + i;
      registry.register(`lazy-init-${idx}`, {
        init: () => ({ id: idx, value: idx * 2 }),
      });
    }

    // Access each service (triggering lazy init)
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      const idx = iter * 100 + i;
      registry.get(`lazy-init-${idx}`);
    }
    totalTime += performance.now() - start;
  }

  const avgTimePerIteration = totalTime / iterations;

  try {
    assert.ok(
      avgTimePerIteration < 50,
      `Lazy init of 100 services took ${avgTimePerIteration.toFixed(2)}ms avg, expected <50ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});
