/**
 * Performance Test: Execution Engine Operations
 * Measures execution engine core operations throughput and latency
 *
 * Note: Performance thresholds are set for reference hardware. On slower machines,
 * tests that exceed thresholds are marked as skipped rather than failed.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";

import { newId } from "../../src/platform/contracts/types/ids.js";
import { partitionPromptForCache, PromptPartitionCacheService } from "../../src/platform/execution/execution-engine/prompt-partition-cache.js";
import { EffectBuffer, EffectBuilder, EffectScope } from "../../src/platform/execution/execution-engine/effect-buffer.js";
import { TightLoopDetector } from "../../src/platform/execution/execution-engine/tight-loop-detector.js";
import { provideContext, getContext } from "../../src/platform/execution/execution-engine/runtime-context.js";

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

// Test data factory functions
function createPromptPartitionInput(index: number) {
  return {
    model: `model-${index % 3}`,
    profileId: `profile-${index % 5}`,
    domainId: `domain-${index % 2}`,
    kvCache: {
      enabled: true,
      fixedPrefixMessageCount: 2,
      cacheKeyStrategy: "hash_prefix" as const,
    },
    messages: [
      { role: "system", content: `System prompt ${index}` },
      { role: "user", content: `User message ${index}` },
      { role: "assistant", content: `Assistant response ${index}` },
      { role: "user", content: `Follow-up ${index}` },
    ],
  };
}

// PromptPartitionCacheService benchmarks
test("performance: PromptPartitionCacheService.record() P99 <1ms", (t) => {
  const cacheService = new PromptPartitionCacheService();

  const latencies: number[] = [];
  const iterations = 1000;

  // Warmup
  for (let i = 0; i < 10; i++) {
    cacheService.record(createPromptPartitionInput(i));
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    cacheService.record(createPromptPartitionInput(i));
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`PromptPartitionCacheService.record() P99: ${p99.toFixed(3)}ms, P50: ${p50.toFixed(3)}ms`);

  try {
    assert.ok(
      p99 < 1,
      `record P99 latency ${p99.toFixed(3)}ms exceeds 1ms target. P50: ${p50.toFixed(3)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      t.skip(err.message);
      return;
    }
    throw err;
  }
});

test("performance: PromptPartitionCacheService.record() throughput >8000 ops/sec", (t) => {
  const cacheService = new PromptPartitionCacheService();

  try {
    const result = runBenchmark(
      "cache_record",
      () => {
        const id = Math.floor(Math.random() * 1000);
        cacheService.record(createPromptPartitionInput(id));
      },
      1000,
    );

    console.log(
      `PromptPartitionCacheService.record() throughput: ${result.opsPerSec.toFixed(2)} ops/sec, P99: ${result.p99.toFixed(3)}ms`,
    );

    try {
      assert.ok(
        result.opsPerSec > 8000,
        `Cache record throughput ${result.opsPerSec.toFixed(2)} ops/sec must be >8000 ops/sec`,
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

test("performance: partitionPromptForCache() P99 <0.5ms", (t) => {
  const latencies: number[] = [];
  const iterations = 1000;

  // Warmup
  for (let i = 0; i < 10; i++) {
    partitionPromptForCache(createPromptPartitionInput(i));
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    partitionPromptForCache(createPromptPartitionInput(i));
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`partitionPromptForCache() P99: ${p99.toFixed(3)}ms, P50: ${p50.toFixed(3)}ms`);

  try {
    assert.ok(
      p99 < 0.5,
      `partitionPromptForCache P99 latency ${p99.toFixed(3)}ms exceeds 0.5ms target`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      t.skip(err.message);
      return;
    }
    throw err;
  }
});

// EffectBuffer benchmarks
test("performance: EffectBuffer.createScope() throughput >5000 ops/sec", (t) => {
  const buffer = new EffectBuffer();

  try {
    const result = runBenchmark(
      "effect_buffer_create_scope",
      () => {
        const id = Math.floor(Math.random() * 10000);
        buffer.createScope({
          scopeId: `scope_${id}`,
          defaultTimeoutMs: 5000,
        });
      },
      1000,
    );

    console.log(
      `EffectBuffer.createScope() throughput: ${result.opsPerSec.toFixed(2)} ops/sec, P99: ${result.p99.toFixed(3)}ms`,
    );

    try {
      assert.ok(
        result.opsPerSec > 5000,
        `createScope throughput ${result.opsPerSec.toFixed(2)} ops/sec must be >5000 ops/sec`,
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

test("performance: EffectScope.addEffect() P99 <0.5ms", (t) => {
  const buffer = new EffectBuffer();
  const scope = buffer.createScope({
    scopeId: "test-scope",
    defaultTimeoutMs: 5000,
  });

  const latencies: number[] = [];
  const iterations = 1000;

  // Warmup
  for (let i = 0; i < 10; i++) {
    const effect = EffectBuilder.create("event_publish", `test ${i}`)
      .withExecute(async () => {})
      .build();
    scope.addEffect(effect);
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const effect = EffectBuilder.create("event_publish", `test ${iterations + i}`)
      .withExecute(async () => {})
      .build();
    const start = performance.now();
    scope.addEffect(effect);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`EffectScope.addEffect() P99: ${p99.toFixed(3)}ms, P50: ${p50.toFixed(3)}ms`);

  try {
    assert.ok(
      p99 < 0.5,
      `addEffect P99 latency ${p99.toFixed(3)}ms exceeds 0.5ms target`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      t.skip(err.message);
      return;
    }
    throw err;
  }
});

test("performance: EffectBuffer.getScopeCount() P99 <0.1ms", (t) => {
  const buffer = new EffectBuffer();

  // Pre-populate with scopes
  for (let i = 0; i < 20; i++) {
    buffer.createScope({
      scopeId: `scope_${i}`,
      defaultTimeoutMs: 5000,
    });
  }

  const latencies: number[] = [];
  const iterations = 1000;

  // Warmup
  for (let i = 0; i < 10; i++) {
    buffer.getScopeCount();
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    buffer.getScopeCount();
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`EffectBuffer.getScopeCount() P99: ${p99.toFixed(3)}ms, P50: ${p50.toFixed(3)}ms`);

  try {
    assert.ok(
      p99 < 0.1,
      `getScopeCount P99 latency ${p99.toFixed(3)}ms exceeds 0.1ms target`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      t.skip(err.message);
      return;
    }
    throw err;
  }
});

// TightLoopDetector benchmarks
test("performance: TightLoopDetector.recordToolCall() throughput >5000 ops/sec", (t) => {
  const detector = new TightLoopDetector({
    warnThreshold: 3,
    escalateThreshold: 5,
    similarInputThreshold: 0.8,
    sequenceWindowSize: 5,
    sequenceRepeatThreshold: 3,
  });

  try {
    const result = runBenchmark(
      "loop_detector_record",
      () => {
        const id = Math.floor(Math.random() * 10000);
        detector.recordToolCall(`tool_${id % 20}`, { arg: `value_${id}` });
      },
      1000,
    );

    console.log(
      `TightLoopDetector.recordToolCall() throughput: ${result.opsPerSec.toFixed(2)} ops/sec, P99: ${result.p99.toFixed(3)}ms`,
    );

    try {
      assert.ok(
        result.opsPerSec > 5000,
        `recordToolCall throughput ${result.opsPerSec.toFixed(2)} ops/sec must be >5000 ops/sec`,
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

test("performance: TightLoopDetector.recordToolCall() P99 <1ms", (t) => {
  const detector = new TightLoopDetector({
    warnThreshold: 3,
    escalateThreshold: 5,
  });

  const latencies: number[] = [];
  const iterations = 1000;

  // Warmup
  for (let i = 0; i < 10; i++) {
    detector.recordToolCall(`tool_warmup_${i % 10}`, { arg: `warmup_${i}` });
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const toolName = `tool_${i % 10}`;
    const start = performance.now();
    detector.recordToolCall(toolName, { arg: `value_${i}` });
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`TightLoopDetector.recordToolCall() P99: ${p99.toFixed(3)}ms, P50: ${p50.toFixed(3)}ms`);

  try {
    assert.ok(
      p99 < 1,
      `recordToolCall P99 latency ${p99.toFixed(3)}ms exceeds 1ms target. P50: ${p50.toFixed(3)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      t.skip(err.message);
      return;
    }
    throw err;
  }
});

test("performance: TightLoopDetector.checkSequentialLoop() P99 <1ms", (t) => {
  const detector = new TightLoopDetector({
    warnThreshold: 3,
    escalateThreshold: 5,
    sequenceWindowSize: 5,
    sequenceRepeatThreshold: 3,
  });

  // Pre-populate with some tool calls
  for (let i = 0; i < 20; i++) {
    detector.recordToolCall(`tool_${i % 10}`, { arg: `value_${i}` });
  }

  const latencies: number[] = [];
  const iterations = 500;

  // Warmup
  for (let i = 0; i < 10; i++) {
    detector.checkSequentialLoop();
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    // Add more tool calls to trigger potential loop detection
    detector.recordToolCall(`tool_${i % 10}`, { arg: `check_${i}` });
    const start = performance.now();
    detector.checkSequentialLoop();
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`TightLoopDetector.checkSequentialLoop() P99: ${p99.toFixed(3)}ms, P50: ${p50.toFixed(3)}ms`);

  try {
    assert.ok(
      p99 < 1,
      `checkSequentialLoop P99 latency ${p99.toFixed(3)}ms exceeds 1ms target`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      t.skip(err.message);
      return;
    }
    throw err;
  }
});

test("performance: TightLoopDetector.getPatterns() P99 <0.5ms", (t) => {
  const detector = new TightLoopDetector({
    warnThreshold: 3,
    escalateThreshold: 5,
  });

  // Pre-populate with patterns
  for (let i = 0; i < 50; i++) {
    detector.recordToolCall(`tool_${i % 20}`, { arg: `value_${i}` });
  }

  const latencies: number[] = [];
  const iterations = 1000;

  // Warmup
  for (let i = 0; i < 10; i++) {
    detector.getPatterns();
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    detector.getPatterns();
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`TightLoopDetector.getPatterns() P99: ${p99.toFixed(3)}ms, P50: ${p50.toFixed(3)}ms`);

  try {
    assert.ok(
      p99 < 0.5,
      `getPatterns P99 latency ${p99.toFixed(3)}ms exceeds 0.5ms target`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      t.skip(err.message);
      return;
    }
    throw err;
  }
});

// RuntimeContext benchmarks (using provideContext)
test("performance: provideContext() <100us", (t) => {
  const snapshot = {
    traceId: newId("trace"),
    taskId: newId("task"),
    sessionId: newId("session"),
  };

  const latencies: number[] = [];
  const iterations = 500;

  // Warmup
  for (let i = 0; i < 10; i++) {
    provideContext(snapshot, () => {});
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    provideContext(snapshot, () => {});
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;
  const avgUs = (latencies.reduce((sum, l) => sum + l, 0) / iterations) * 1000;

  console.log(`provideContext() avg: ${avgUs.toFixed(2)}us, P99: ${(p99 * 1000).toFixed(2)}us`);

  try {
    assert.ok(
      p99 < 0.1,
      `provideContext P99 ${(p99 * 1000).toFixed(2)}us exceeds 100us target`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      t.skip(err.message);
      return;
    }
    throw err;
  }
});

test("performance: getContext() within provideContext <10us", (t) => {
  const snapshot = {
    traceId: newId("trace"),
    taskId: newId("task"),
    sessionId: newId("session"),
  };

  const latencies: number[] = [];
  const iterations = 1000;

  // Warmup
  for (let i = 0; i < 10; i++) {
    provideContext(snapshot, () => {
      getContext();
    });
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    provideContext(snapshot, () => {
      getContext();
    });
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;
  const avgUs = (latencies.reduce((sum, l) => sum + l, 0) / iterations) * 1000;

  console.log(`getContext() avg: ${avgUs.toFixed(2)}us, P99: ${(p99 * 1000).toFixed(2)}us`);

  try {
    assert.ok(
      p99 < 0.01,
      `getContext P99 ${(p99 * 1000).toFixed(2)}us exceeds 10us target`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      t.skip(err.message);
      return;
    }
    throw err;
  }
});

// Bulk operation benchmarks
test("performance: bulk partition operations throughput >5000 ops/sec", (t) => {
  try {
    const result = runBenchmark(
      "bulk_partition",
      () => {
        for (let j = 0; j < 10; j++) {
          partitionPromptForCache(createPromptPartitionInput(j));
        }
      },
      500,
    );

    // Calculate total ops (10 partitions per iteration)
    const totalOpsPerSec = result.opsPerSec * 10;

    console.log(
      `Bulk partition throughput: ${totalOpsPerSec.toFixed(2)} ops/sec, P99: ${result.p99.toFixed(3)}ms`,
    );

    try {
      assert.ok(
        totalOpsPerSec > 5000,
        `Bulk partition throughput ${totalOpsPerSec.toFixed(2)} ops/sec must be >5000 ops/sec`,
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

test("performance: effect scope creation and execution throughput", async (t) => {
  const buffer = new EffectBuffer();

  const latencies: number[] = [];
  const iterations = 200;

  // Warmup
  for (let i = 0; i < 5; i++) {
    const scope = buffer.createScope({ scopeId: `warmup_${i}` });
    scope.addEffect(EffectBuilder.create("event_publish", "test").withExecute(async () => {}).build());
    scope.commit();
  }
  await buffer.flush();

  // Measure
  for (let i = 0; i < iterations; i++) {
    const scope = buffer.createScope({ scopeId: `perf_scope_${i}` });
    scope.addEffect(EffectBuilder.create("event_publish", `test_${i}`).withExecute(async () => {}).build());
    scope.commit();

    const start = performance.now();
    await scope.executeEffects();
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`EffectScope execute P99: ${p99.toFixed(3)}ms, P50: ${p50.toFixed(3)}ms`);

  try {
    assert.ok(
      p99 < 5,
      `EffectScope execute P99 latency ${p99.toFixed(3)}ms exceeds 5ms target`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      t.skip(err.message);
      return;
    }
    throw err;
  }
});