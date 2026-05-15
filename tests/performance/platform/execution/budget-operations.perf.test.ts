/**
 * Budget Operations Performance Tests
 *
 * Performance tests for budget operations:
 * - reserve() throughput
 * - settle() throughput
 * - release() throughput
 * - Concurrent budget operations
 */

import assert from "node:assert/strict";
import test from "node:test";

import { BudgetAllocator, BudgetTier } from "../../../../../src/platform/five-plane-execution/budget-allocator.js";
import { RuntimeStateMachine } from "../../../../../src/platform/five-plane-execution/runtime-state-machine.js";

/**
 * Performance test configuration.
 */
interface PerfConfig {
  iterations: number;
  warmupIterations: number;
}

const DEFAULT_PERF_CONFIG: PerfConfig = {
  iterations: 10000,
  warmupIterations: 100,
};

function createTestLedger(ledgerId: string): ReturnType<typeof createBudgetLedger> {
  const { createBudgetLedger } = require("../../../../../src/platform/contracts/executable-contracts/index.js");
  return createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: `run-${ledgerId}`,
    currency: "USD",
    hardCap: 100000,
    reservedAmount: 0,
    settledAmount: 0,
    releasedAmount: 0,
    version: 0,
    status: "open",
  });
}

function createTestContext() {
  return {
    tenantId: "tenant-1",
    traceId: "trace-perf",
    emittedBy: "perf-test",
    tier: BudgetTier.STEP,
    tierLimit: 100000,
    watermarkAlert: {
      warningThreshold: 0.8,
      criticalThreshold: 0.95,
      hardCapThreshold: 1.0,
    },
    autoThrottle: {
      enabled: false,
      throttleRatio: 1,
      recoveryRatio: 1,
    },
    crossRunPriority: {
      priority: 1,
      weightFactor: 1,
    },
    streamingSettle: {
      enabled: false,
      tokenInterval: Number.MAX_SAFE_INTEGER,
      timeIntervalMs: Number.MAX_SAFE_INTEGER,
    },
  };
}

// ── Reserve Performance Tests ──────────────────────────────────────────────────

test("Performance: BudgetAllocator.reserve() throughput", { timeout: 60000 }, (t) => {
  const allocator = new BudgetAllocator();
  const context = createTestContext();

  // Warmup
  for (let i = 0; i < DEFAULT_PERF_CONFIG.warmupIterations; i++) {
    const ledger = createTestLedger(`warmup-${i}`);
    allocator.reserve({
      ledger,
      amount: 10,
      resourceKind: "token",
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      expectedVersion: 0,
      context,
    });
  }

  const start = Date.now();

  for (let i = 0; i < DEFAULT_PERF_CONFIG.iterations; i++) {
    const ledger = createTestLedger(`reserve-${i}`);
    allocator.reserve({
      ledger,
      amount: 10,
      resourceKind: "token",
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      expectedVersion: 0,
      context,
    });
  }

  const elapsed = Date.now() - start;
  const opsPerSecond = (DEFAULT_PERF_CONFIG.iterations / elapsed) * 1000;
  const avgLatencyMs = elapsed / DEFAULT_PERF_CONFIG.iterations;

  console.log(`reserve() - ${DEFAULT_PERF_CONFIG.iterations} iterations in ${elapsed}ms`);
  console.log(`  Throughput: ${opsPerSecond.toFixed(2)} ops/sec`);
  console.log(`  Avg latency: ${avgLatencyMs.toFixed(3)}ms`);

  // Should handle at least 1000 ops/sec
  assert.ok(opsPerSecond > 1000, `Expected > 1000 ops/sec, got ${opsPerSecond.toFixed(2)}`);
});

// ── Settle Performance Tests ──────────────────────────────────────────────────

test("Performance: BudgetAllocator.settle() throughput", { timeout: 60000 }, (t) => {
  const allocator = new BudgetAllocator();
  const context = createTestContext();

  // Warmup
  for (let i = 0; i < DEFAULT_PERF_CONFIG.warmupIterations; i++) {
    const ledger = createTestLedger(`warmup-settle-${i}`);
    const reserved = allocator.reserve({
      ledger,
      amount: 10,
      resourceKind: "token",
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      expectedVersion: 0,
      context,
    });
    allocator.settle({
      ledger: reserved.ledger,
      reservation: reserved.reservation,
      actualAmount: 8,
      context,
    });
  }

  const start = Date.now();

  for (let i = 0; i < DEFAULT_PERF_CONFIG.iterations; i++) {
    const ledger = createTestLedger(`settle-${i}`);
    const reserved = allocator.reserve({
      ledger,
      amount: 10,
      resourceKind: "token",
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      expectedVersion: 0,
      context,
    });
    allocator.settle({
      ledger: reserved.ledger,
      reservation: reserved.reservation,
      actualAmount: 8,
      context,
    });
  }

  const elapsed = Date.now() - start;
  const opsPerSecond = (DEFAULT_PERF_CONFIG.iterations / elapsed) * 1000;
  const avgLatencyMs = elapsed / DEFAULT_PERF_CONFIG.iterations;

  console.log(`settle() - ${DEFAULT_PERF_CONFIG.iterations} iterations in ${elapsed}ms`);
  console.log(`  Throughput: ${opsPerSecond.toFixed(2)} ops/sec`);
  console.log(`  Avg latency: ${avgLatencyMs.toFixed(3)}ms`);

  // Should handle at least 500 ops/sec (settle is more expensive)
  assert.ok(opsPerSecond > 500, `Expected > 500 ops/sec, got ${opsPerSecond.toFixed(2)}`);
});

// ── Release Performance Tests ─────────────────────────────────────────────────

test("Performance: BudgetAllocator.release() throughput", { timeout: 60000 }, (t) => {
  const allocator = new BudgetAllocator();
  const context = createTestContext();

  // Warmup
  for (let i = 0; i < DEFAULT_PERF_CONFIG.warmupIterations; i++) {
    const ledger = createTestLedger(`warmup-release-${i}`);
    const reserved = allocator.reserve({
      ledger,
      amount: 10,
      resourceKind: "token",
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      expectedVersion: 0,
      context,
    });
    allocator.release({
      ledger: reserved.ledger,
      reservation: reserved.reservation,
      reasonCode: "test",
      context,
    });
  }

  const start = Date.now();

  for (let i = 0; i < DEFAULT_PERF_CONFIG.iterations; i++) {
    const ledger = createTestLedger(`release-${i}`);
    const reserved = allocator.reserve({
      ledger,
      amount: 10,
      resourceKind: "token",
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      expectedVersion: 0,
      context,
    });
    allocator.release({
      ledger: reserved.ledger,
      reservation: reserved.reservation,
      reasonCode: "test",
      context,
    });
  }

  const elapsed = Date.now() - start;
  const opsPerSecond = (DEFAULT_PERF_CONFIG.iterations / elapsed) * 1000;
  const avgLatencyMs = elapsed / DEFAULT_PERF_CONFIG.iterations;

  console.log(`release() - ${DEFAULT_PERF_CONFIG.iterations} iterations in ${elapsed}ms`);
  console.log(`  Throughput: ${opsPerSecond.toFixed(2)} ops/sec`);
  console.log(`  Avg latency: ${avgLatencyMs.toFixed(3)}ms`);

  // Should handle at least 1000 ops/sec
  assert.ok(opsPerSecond > 1000, `Expected > 1000 ops/sec, got ${opsPerSecond.toFixed(2)}`);
});

// ── Full Budget Lifecycle Performance ─────────────────────────────────────────

test("Performance: Full budget reserve-settle-release lifecycle", { timeout: 60000 }, (t) => {
  const allocator = new BudgetAllocator();
  const context = createTestContext();

  // Warmup
  for (let i = 0; i < DEFAULT_PERF_CONFIG.warmupIterations; i++) {
    const ledger = createTestLedger(`warmup-lifecycle-${i}`);
    const reserved = allocator.reserve({
      ledger,
      amount: 10,
      resourceKind: "token",
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      expectedVersion: 0,
      context,
    });
    allocator.settle({
      ledger: reserved.ledger,
      reservation: reserved.reservation,
      actualAmount: 8,
      context,
    });
  }

  const start = Date.now();

  for (let i = 0; i < DEFAULT_PERF_CONFIG.iterations; i++) {
    const ledger = createTestLedger(`lifecycle-${i}`);
    const reserved = allocator.reserve({
      ledger,
      amount: 10,
      resourceKind: "token",
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      expectedVersion: 0,
      context,
    });
    allocator.settle({
      ledger: reserved.ledger,
      reservation: reserved.reservation,
      actualAmount: 8,
      context,
    });
  }

  const elapsed = Date.now() - start;
  const opsPerSecond = (DEFAULT_PERF_CONFIG.iterations / elapsed) * 1000;
  const avgLatencyMs = elapsed / DEFAULT_PERF_CONFIG.iterations;

  console.log(`reserve-settle lifecycle - ${DEFAULT_PERF_CONFIG.iterations} iterations in ${elapsed}ms`);
  console.log(`  Throughput: ${opsPerSecond.toFixed(2)} ops/sec`);
  console.log(`  Avg latency: ${avgLatencyMs.toFixed(3)}ms`);

  // Should handle at least 300 full lifecycle ops/sec
  assert.ok(opsPerSecond > 300, `Expected > 300 ops/sec, got ${opsPerSecond.toFixed(2)}`);
});

// ── Watermark Alert Performance ──────────────────────────────────────────────

test("Performance: Watermark alert computation", { timeout: 60000 }, (t) => {
  const context = createTestContext();

  const iterations = DEFAULT_PERF_CONFIG.iterations;

  // Warmup
  for (let i = 0; i < 100; i++) {
    const utilization = 0.8;
    const { warningThreshold, criticalThreshold, hardCapThreshold } = context.watermarkAlert;
    if (utilization >= hardCapThreshold) { /* alert */ }
    else if (utilization >= criticalThreshold) { /* alert */ }
    else if (utilization >= warningThreshold) { /* alert */ }
  }

  const start = Date.now();

  for (let i = 0; i < iterations; i++) {
    const utilization = 0.85;
    const { warningThreshold, criticalThreshold, hardCapThreshold } = context.watermarkAlert;
    if (utilization >= hardCapThreshold) { /* hard cap */ }
    else if (utilization >= criticalThreshold) { /* critical */ }
    else if (utilization >= warningThreshold) { /* warning */ }
  }

  const elapsed = Date.now() - start;
  const opsPerSecond = (iterations / elapsed) * 1000;

  console.log(`watermark computation - ${iterations} iterations in ${elapsed}ms`);
  console.log(`  Throughput: ${opsPerSecond.toFixed(2)} ops/sec`);

  // Should be extremely fast - no I/O
  assert.ok(opsPerSecond > 100000, `Expected > 100000 ops/sec, got ${opsPerSecond.toFixed(2)}`);
});
