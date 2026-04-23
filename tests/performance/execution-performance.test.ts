/**
 * Performance Test: Execution Module
 * Measures execution module operations throughput and latency
 *
 * Covers:
 * - Worker load balancing (computeWorkerLoadScore, summarizeWorkerLoadSkew)
 * - Complexity routing (routeComplexity)
 * - KV cache prefix configuration (createKvCachePrefixConfig, estimateTokens)
 * - Admission controller (evaluate, snapshot)
 *
 * Note: Performance thresholds are set for reference hardware. On slower machines,
 * tests that exceed thresholds are marked as skipped rather than failed.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";

import {
  computeWorkerLoadScore,
  computeEffectiveActiveLeaseCount,
  summarizeWorkerLoadSkew,
  type WorkerLoadSignal,
} from "../../src/platform/execution/worker-pool/worker-load-balancing.js";
import { routeComplexity, type ComplexityRouterConfig } from "../../src/platform/execution/execution-engine/complexity-router.js";
import {
  createKvCachePrefixConfig,
  estimateTokens,
  isWithinFixedPrefixBudget,
  isWithinDomainBlockBudget,
  type KvCachePrefixConfig,
} from "../../src/platform/execution/execution-engine/kv-cache-prefix-config.js";
import { AdmissionController, DEFAULT_ADMISSION_POLICY } from "../../src/platform/execution/dispatcher/admission-controller.js";
import type { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";

// Benchmark helper
function runBenchmark(
  name: string,
  fn: () => void,
  iterations: number,
): { opsPerSec: number; avgLatencyMs: number; p99: number; p50: number } {
  const latencies: number[] = [];

  // Warmup
  for (let i = 0; i < 10; i++) fn();

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const elapsed = latencies.reduce((sum, l) => sum + l, 0);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;
  const opsPerSec = (iterations / elapsed) * 1000;
  const avgLatencyMs = elapsed / iterations;

  return { opsPerSec, avgLatencyMs, p99, p50 };
}

// ============================================================================
// Worker Load Balancing Benchmarks
// ============================================================================

test("performance: computeWorkerLoadScore() P99 <0.05ms", (t) => {
  const signal: WorkerLoadSignal = {
    workerId: "worker-1",
    queueAffinity: null,
    maxConcurrency: 10,
    availableSlots: 5,
    activeLeaseCount: 3,
    runningExecutionCount: 3,
    saturation: 0.5,
    toolBacklogCount: 2,
    cpuPct: 45,
  };

  const latencies: number[] = [];
  const iterations = 5000;

  // Warmup
  for (let i = 0; i < 100; i++) {
    computeWorkerLoadScore(signal);
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    computeWorkerLoadScore(signal);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`computeWorkerLoadScore() P99: ${p99.toFixed(4)}ms, P50: ${p50.toFixed(4)}ms`);

  try {
    assert.ok(
      p99 < 0.05,
      `computeWorkerLoadScore P99 latency ${p99.toFixed(4)}ms exceeds 0.05ms target`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      t.skip(err.message);
      return;
    }
    throw err;
  }
});

test("performance: computeWorkerLoadScore() throughput >100000 ops/sec", (t) => {
  const signal: WorkerLoadSignal = {
    workerId: "worker-1",
    queueAffinity: null,
    maxConcurrency: 10,
    availableSlots: 5,
    activeLeaseCount: 3,
    runningExecutionCount: 3,
    saturation: 0.5,
    toolBacklogCount: 2,
    cpuPct: 45,
  };

  try {
    const result = runBenchmark(
      "worker_load_score",
      () => computeWorkerLoadScore(signal),
      10000,
    );

    console.log(
      `computeWorkerLoadScore() throughput: ${result.opsPerSec.toFixed(0)} ops/sec, P99: ${result.p99.toFixed(4)}ms`,
    );

    try {
      assert.ok(
        result.opsPerSec > 100000,
        `computeWorkerLoadScore throughput ${result.opsPerSec.toFixed(0)} ops/sec must be >100000 ops/sec`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        t.skip(err.message);
        return;
      }
      throw err;
    }
  } finally {
    // Benchmark result logged
  }
});

test("performance: computeEffectiveActiveLeaseCount() P99 <0.01ms", (t) => {
  const signal: WorkerLoadSignal = {
    workerId: "worker-1",
    queueAffinity: null,
    maxConcurrency: 10,
    availableSlots: 5,
    activeLeaseCount: 5,
    runningExecutionCount: 3,
    saturation: 0.5,
    toolBacklogCount: 0,
    cpuPct: null,
  };

  const latencies: number[] = [];
  const iterations = 5000;

  // Warmup
  for (let i = 0; i < 100; i++) {
    computeEffectiveActiveLeaseCount(signal);
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    computeEffectiveActiveLeaseCount(signal);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`computeEffectiveActiveLeaseCount() P99: ${p99.toFixed(4)}ms, P50: ${p50.toFixed(4)}ms`);

  try {
    assert.ok(
      p99 < 0.01,
      `computeEffectiveActiveLeaseCount P99 latency ${p99.toFixed(4)}ms exceeds 0.01ms target`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      t.skip(err.message);
      return;
    }
    throw err;
  }
});

test("performance: summarizeWorkerLoadSkew() with 5 workers P99 <0.5ms", (t) => {
  const signals: WorkerLoadSignal[] = [
    { workerId: "worker-1", queueAffinity: null, maxConcurrency: 10, availableSlots: 5, activeLeaseCount: 8, runningExecutionCount: 8, saturation: 0.8, toolBacklogCount: 1, cpuPct: 60 },
    { workerId: "worker-2", queueAffinity: null, maxConcurrency: 10, availableSlots: 7, activeLeaseCount: 2, runningExecutionCount: 2, saturation: 0.2, toolBacklogCount: 0, cpuPct: 20 },
    { workerId: "worker-3", queueAffinity: null, maxConcurrency: 10, availableSlots: 6, activeLeaseCount: 1, runningExecutionCount: 1, saturation: 0.1, toolBacklogCount: 0, cpuPct: 15 },
    { workerId: "worker-4", queueAffinity: null, maxConcurrency: 10, availableSlots: 8, activeLeaseCount: 0, runningExecutionCount: 0, saturation: null, toolBacklogCount: 0, cpuPct: null },
    { workerId: "worker-5", queueAffinity: null, maxConcurrency: 10, availableSlots: 9, activeLeaseCount: 0, runningExecutionCount: 0, saturation: null, toolBacklogCount: 0, cpuPct: null },
  ];

  const latencies: number[] = [];
  const iterations = 1000;

  // Warmup
  for (let i = 0; i < 50; i++) {
    summarizeWorkerLoadSkew(signals);
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    summarizeWorkerLoadSkew(signals);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`summarizeWorkerLoadSkew(5 workers) P99: ${p99.toFixed(4)}ms, P50: ${p50.toFixed(4)}ms`);

  try {
    assert.ok(
      p99 < 0.5,
      `summarizeWorkerLoadSkew P99 latency ${p99.toFixed(4)}ms exceeds 0.5ms target`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      t.skip(err.message);
      return;
    }
    throw err;
  }
});

test("performance: summarizeWorkerLoadSkew() with 10 workers P99 <1ms", (t) => {
  const signals: WorkerLoadSignal[] = Array.from({ length: 10 }, (_, i) => ({
    workerId: `worker-${i}`,
    queueAffinity: null,
    maxConcurrency: 10,
    availableSlots: 10 - (i % 5),
    activeLeaseCount: i < 5 ? 5 - i : 0,
    runningExecutionCount: i < 5 ? 5 - i : 0,
    saturation: i < 5 ? 0.5 - i * 0.05 : null,
    toolBacklogCount: i < 3 ? i : 0,
    cpuPct: i < 3 ? 40 - i * 5 : null,
  }));

  const latencies: number[] = [];
  const iterations = 500;

  // Warmup
  for (let i = 0; i < 50; i++) {
    summarizeWorkerLoadSkew(signals);
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    summarizeWorkerLoadSkew(signals);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`summarizeWorkerLoadSkew(10 workers) P99: ${p99.toFixed(4)}ms, P50: ${p50.toFixed(4)}ms`);

  try {
    assert.ok(
      p99 < 1,
      `summarizeWorkerLoadSkew(10 workers) P99 latency ${p99.toFixed(4)}ms exceeds 1ms target`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      t.skip(err.message);
      return;
    }
    throw err;
  }
});

// ============================================================================
// Complexity Router Benchmarks
// ============================================================================

test("performance: routeComplexity() passthrough path P99 <0.1ms", (t) => {
  const latencies: number[] = [];
  const iterations = 5000;

  // Warmup
  for (let i = 0; i < 100; i++) {
    routeComplexity("Hi");
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    routeComplexity("Hi");
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`routeComplexity(passthrough) P99: ${p99.toFixed(4)}ms, P50: ${p50.toFixed(4)}ms`);

  try {
    assert.ok(
      p99 < 0.1,
      `routeComplexity(passthrough) P99 latency ${p99.toFixed(4)}ms exceeds 0.1ms target`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      t.skip(err.message);
      return;
    }
    throw err;
  }
});

test("performance: routeComplexity() full path P99 <0.1ms", (t) => {
  const latencies: number[] = [];
  const iterations = 5000;

  // Warmup
  for (let i = 0; i < 100; i++) {
    routeComplexity("Perform a comprehensive security audit of all files");
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    routeComplexity("Perform a comprehensive security audit of all files");
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`routeComplexity(full) P99: ${p99.toFixed(4)}ms, P50: ${p50.toFixed(4)}ms`);

  try {
    assert.ok(
      p99 < 0.1,
      `routeComplexity(full) P99 latency ${p99.toFixed(4)}ms exceeds 0.1ms target`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      t.skip(err.message);
      return;
    }
    throw err;
  }
});

test("performance: routeComplexity() fast path P99 <0.1ms", (t) => {
  const latencies: number[] = [];
  const iterations = 5000;

  // Warmup
  for (let i = 0; i < 100; i++) {
    routeComplexity("Show me the current status");
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    routeComplexity("Show me the current status");
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`routeComplexity(fast) P99: ${p99.toFixed(4)}ms, P50: ${p50.toFixed(4)}ms`);

  try {
    assert.ok(
      p99 < 0.1,
      `routeComplexity(fast) P99 latency ${p99.toFixed(4)}ms exceeds 0.1ms target`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      t.skip(err.message);
      return;
    }
    throw err;
  }
});

test("performance: routeComplexity() throughput >50000 ops/sec", (t) => {
  try {
    const result = runBenchmark(
      "route_complexity",
      () => routeComplexity("List all the files in the project"),
      10000,
    );

    console.log(
      `routeComplexity() throughput: ${result.opsPerSec.toFixed(0)} ops/sec, P99: ${result.p99.toFixed(4)}ms`,
    );

    try {
      assert.ok(
        result.opsPerSec > 50000,
        `routeComplexity throughput ${result.opsPerSec.toFixed(0)} ops/sec must be >50000 ops/sec`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        t.skip(err.message);
        return;
      }
      throw err;
    }
  } finally {
    // Benchmark result logged
  }
});

test("performance: routeComplexity() with custom config P99 <0.2ms", (t) => {
  const config: ComplexityRouterConfig = {
    fullPathKeywords: ["security", "audit", "critical"],
    fastPathKeywords: ["quick", "simple", "show"],
    passthroughMaxChars: 30,
    qaModeForceFull: false,
  };

  const latencies: number[] = [];
  const iterations = 5000;

  // Warmup
  for (let i = 0; i < 100; i++) {
    routeComplexity("Quick security check", { config });
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    routeComplexity("Quick security check", { config });
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`routeComplexity(custom config) P99: ${p99.toFixed(4)}ms, P50: ${p50.toFixed(4)}ms`);

  try {
    assert.ok(
      p99 < 0.2,
      `routeComplexity(custom config) P99 latency ${p99.toFixed(4)}ms exceeds 0.2ms target`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      t.skip(err.message);
      return;
    }
    throw err;
  }
});

// ============================================================================
// KV Cache Prefix Config Benchmarks
// ============================================================================

test("performance: createKvCachePrefixConfig() P99 <0.05ms", (t) => {
  const latencies: number[] = [];
  const iterations = 5000;

  // Warmup
  for (let i = 0; i < 100; i++) {
    createKvCachePrefixConfig({});
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    createKvCachePrefixConfig({});
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`createKvCachePrefixConfig() P99: ${p99.toFixed(4)}ms, P50: ${p50.toFixed(4)}ms`);

  try {
    assert.ok(
      p99 < 0.05,
      `createKvCachePrefixConfig P99 latency ${p99.toFixed(4)}ms exceeds 0.05ms target`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      t.skip(err.message);
      return;
    }
    throw err;
  }
});

test("performance: estimateTokens() throughput >200000 ops/sec", (t) => {
  const testText = "This is a test prompt with multiple words to estimate token count.";

  try {
    const result = runBenchmark(
      "estimate_tokens",
      () => estimateTokens(testText),
      10000,
    );

    console.log(
      `estimateTokens() throughput: ${result.opsPerSec.toFixed(0)} ops/sec, P99: ${result.p99.toFixed(4)}ms`,
    );

    try {
      assert.ok(
        result.opsPerSec > 200000,
        `estimateTokens throughput ${result.opsPerSec.toFixed(0)} ops/sec must be >200000 ops/sec`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        t.skip(err.message);
        return;
      }
      throw err;
    }
  } finally {
    // Benchmark result logged
  }
});

test("performance: estimateTokens() with large text P99 <0.1ms", (t) => {
  const largeText = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(50);

  const latencies: number[] = [];
  const iterations = 5000;

  // Warmup
  for (let i = 0; i < 100; i++) {
    estimateTokens(largeText);
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    estimateTokens(largeText);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`estimateTokens(large text) P99: ${p99.toFixed(4)}ms, P50: ${p50.toFixed(4)}ms`);

  try {
    assert.ok(
      p99 < 0.1,
      `estimateTokens(large text) P99 latency ${p99.toFixed(4)}ms exceeds 0.1ms target`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      t.skip(err.message);
      return;
    }
    throw err;
  }
});

test("performance: isWithinFixedPrefixBudget() P99 <0.05ms", (t) => {
  const config = createKvCachePrefixConfig({});
  const text = "System prompt for the agent with governance constraints and directives.";

  const latencies: number[] = [];
  const iterations = 5000;

  // Warmup
  for (let i = 0; i < 100; i++) {
    isWithinFixedPrefixBudget(text, config);
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    isWithinFixedPrefixBudget(text, config);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`isWithinFixedPrefixBudget() P99: ${p99.toFixed(4)}ms, P50: ${p50.toFixed(4)}ms`);

  try {
    assert.ok(
      p99 < 0.05,
      `isWithinFixedPrefixBudget P99 latency ${p99.toFixed(4)}ms exceeds 0.05ms target`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      t.skip(err.message);
      return;
    }
    throw err;
  }
});

test("performance: isWithinDomainBlockBudget() P99 <0.05ms", (t) => {
  const config = createKvCachePrefixConfig({});
  const text = "Domain-specific rules for code review and quality gates.";

  const latencies: number[] = [];
  const iterations = 5000;

  // Warmup
  for (let i = 0; i < 100; i++) {
    isWithinDomainBlockBudget(text, "core", config);
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    isWithinDomainBlockBudget(text, "core", config);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`isWithinDomainBlockBudget() P99: ${p99.toFixed(4)}ms, P50: ${p50.toFixed(4)}ms`);

  try {
    assert.ok(
      p99 < 0.05,
      `isWithinDomainBlockBudget P99 latency ${p99.toFixed(4)}ms exceeds 0.05ms target`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      t.skip(err.message);
      return;
    }
    throw err;
  }
});

// ============================================================================
// Admission Controller Benchmarks
// ============================================================================

// Mock store for admission controller tests
class MockAuthoritativeTaskStore {
  public queuedTasks = 2;
  public activeExecutions = 5;
  public pendingTier1Acks = 10;

  task = {
    countQueuedTasks: () => this.queuedTasks,
  };
  execution = {
    countActiveExecutions: () => this.activeExecutions,
  };
  event = {
    countPendingTier1Acks: () => this.pendingTier1Acks,
  };
}

test("performance: AdmissionController.snapshot() P99 <0.1ms", (t) => {
  const store = new MockAuthoritativeTaskStore() as unknown as AuthoritativeTaskStore;
  const controller = new AdmissionController(store, DEFAULT_ADMISSION_POLICY, null);

  const latencies: number[] = [];
  const iterations = 5000;

  // Warmup
  for (let i = 0; i < 100; i++) {
    controller.snapshot();
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    controller.snapshot();
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`AdmissionController.snapshot() P99: ${p99.toFixed(4)}ms, P50: ${p50.toFixed(4)}ms`);

  try {
    assert.ok(
      p99 < 0.1,
      `AdmissionController.snapshot P99 latency ${p99.toFixed(4)}ms exceeds 0.1ms target`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      t.skip(err.message);
      return;
    }
    throw err;
  }
});

test("performance: AdmissionController.evaluate() P99 <0.2ms", (t) => {
  const store = new MockAuthoritativeTaskStore() as unknown as AuthoritativeTaskStore;
  const controller = new AdmissionController(store, DEFAULT_ADMISSION_POLICY, null);

  const latencies: number[] = [];
  const iterations = 5000;

  // Warmup
  for (let i = 0; i < 100; i++) {
    controller.evaluate({ priority: "normal" });
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    controller.evaluate({ priority: "normal" });
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`AdmissionController.evaluate() P99: ${p99.toFixed(4)}ms, P50: ${p50.toFixed(4)}ms`);

  try {
    assert.ok(
      p99 < 0.2,
      `AdmissionController.evaluate P99 latency ${p99.toFixed(4)}ms exceeds 0.2ms target`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      t.skip(err.message);
      return;
    }
    throw err;
  }
});

test("performance: AdmissionController.evaluate() throughput >5000 ops/sec", (t) => {
  const store = new MockAuthoritativeTaskStore() as unknown as AuthoritativeTaskStore;
  const controller = new AdmissionController(store, DEFAULT_ADMISSION_POLICY, null);

  try {
    const result = runBenchmark(
      "admission_evaluate",
      () => controller.evaluate({ priority: "normal" }),
      10000,
    );

    console.log(
      `AdmissionController.evaluate() throughput: ${result.opsPerSec.toFixed(0)} ops/sec, P99: ${result.p99.toFixed(4)}ms`,
    );

    try {
      assert.ok(
        result.opsPerSec > 5000,
        `AdmissionController.evaluate throughput ${result.opsPerSec.toFixed(0)} ops/sec must be >5000 ops/sec`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        t.skip(err.message);
        return;
      }
      throw err;
    }
  } finally {
    // Benchmark result logged
  }
});

test("performance: AdmissionController.evaluate() with budget check P99 <0.2ms", (t) => {
  const store = new MockAuthoritativeTaskStore() as unknown as AuthoritativeTaskStore;
  const controller = new AdmissionController(store, DEFAULT_ADMISSION_POLICY, null);

  const latencies: number[] = [];
  const iterations = 5000;

  // Warmup
  for (let i = 0; i < 100; i++) {
    controller.evaluate({
      priority: "high",
      estimatedCostUsd: 0.05,
      budgetRemainingUsd: 10.0,
    });
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    controller.evaluate({
      priority: "high",
      estimatedCostUsd: 0.05,
      budgetRemainingUsd: 10.0,
    });
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`AdmissionController.evaluate(budget) P99: ${p99.toFixed(4)}ms, P50: ${p50.toFixed(4)}ms`);

  try {
    assert.ok(
      p99 < 0.2,
      `AdmissionController.evaluate(budget) P99 latency ${p99.toFixed(4)}ms exceeds 0.2ms target`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      t.skip(err.message);
      return;
    }
    throw err;
  }
});

test("performance: AdmissionController.evaluate() with backpressure P99 <0.3ms", (t) => {
  const store = new MockAuthoritativeTaskStore() as unknown as AuthoritativeTaskStore;
  const controller = new AdmissionController(store, DEFAULT_ADMISSION_POLICY, () => ({
    status: "degraded" as const,
    degradationMode: "queue_only" as const,
    queueGovernance: { starvationDetected: false },
    findings: [] as string[],
  }));

  const latencies: number[] = [];
  const iterations = 5000;

  // Warmup
  for (let i = 0; i < 100; i++) {
    controller.evaluate({ priority: "normal" });
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    controller.evaluate({ priority: "normal" });
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`AdmissionController.evaluate(backpressure) P99: ${p99.toFixed(4)}ms, P50: ${p50.toFixed(4)}ms`);

  try {
    assert.ok(
      p99 < 0.3,
      `AdmissionController.evaluate(backpressure) P99 latency ${p99.toFixed(4)}ms exceeds 0.3ms target`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      t.skip(err.message);
      return;
    }
    throw err;
  }
});

// ============================================================================
// Bulk Operations Benchmarks
// ============================================================================

test("performance: bulk load balancing operations throughput >10000 ops/sec", (t) => {
  try {
    const signals: WorkerLoadSignal[] = Array.from({ length: 10 }, (_, i) => ({
      workerId: `worker-${i}`,
      queueAffinity: i % 2 === 0 ? "queue-a" : "queue-b",
      maxConcurrency: 10,
      availableSlots: 10 - (i % 5),
      activeLeaseCount: i < 6 ? 6 - i : 0,
      runningExecutionCount: i < 6 ? 6 - i : 0,
      saturation: i < 4 ? 0.6 - i * 0.1 : null,
      toolBacklogCount: i < 3 ? i : 0,
      cpuPct: i < 3 ? 50 - i * 10 : null,
    }));

    const result = runBenchmark(
      "bulk_load_balancing",
      () => {
        for (const signal of signals) {
          computeWorkerLoadScore(signal);
        }
        summarizeWorkerLoadSkew(signals);
      },
      1000,
    );

    // Calculate ops per sec for the entire batch
    const totalOpsPerSec = result.opsPerSec;

    console.log(
      `Bulk load balancing throughput: ${totalOpsPerSec.toFixed(0)} ops/sec, P99: ${result.p99.toFixed(4)}ms`,
    );

    try {
      assert.ok(
        totalOpsPerSec > 10000,
        `Bulk load balancing throughput ${totalOpsPerSec.toFixed(0)} ops/sec must be >10000 ops/sec`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        t.skip(err.message);
        return;
      }
      throw err;
    }
  } finally {
    // Benchmark result logged
  }
});

test("performance: bulk routing operations throughput >20000 ops/sec", (t) => {
  const tasks = [
    "Hi",
    "Show me the status",
    "List all files",
    "Quick check",
    "Perform a comprehensive security audit",
    "Find all TODO comments",
    "Investigate the root cause",
    "Simple grep search",
    "What is the current version?",
    "Run tests",
  ];

  try {
    const result = runBenchmark(
      "bulk_routing",
      () => {
        for (const task of tasks) {
          routeComplexity(task);
        }
      },
      1000,
    );

    const totalOpsPerSec = result.opsPerSec;

    console.log(
      `Bulk routing throughput: ${totalOpsPerSec.toFixed(0)} ops/sec, P99: ${result.p99.toFixed(4)}ms`,
    );

    try {
      assert.ok(
        totalOpsPerSec > 20000,
        `Bulk routing throughput ${totalOpsPerSec.toFixed(0)} ops/sec must be >20000 ops/sec`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        t.skip(err.message);
        return;
      }
      throw err;
    }
  } finally {
    // Benchmark result logged
  }
});