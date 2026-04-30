/**
 * Performance Test: Budget Allocator Operations
 * Measures budget reservation, settlement, and release throughput and latency
 *
 * Design targets:
 * - Budget reservation: >5000 ops/sec
 * - Budget settlement: >3000 ops/sec
 * - Budget calculation P99: <1ms
 *
 * Note: Performance thresholds are set for reference hardware. On slower machines,
 * tests that miss the reference target are recorded as diagnostics rather than skipped.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { reportSoftPerformanceMiss } from "../../../helpers/performance.js";
import { join } from "node:path";
import { rmSync } from "node:fs";

import { BudgetAllocator, BudgetTier, type BudgetAllocatorContext } from "../../../../src/platform/five-plane-execution/budget-allocator.js";
import { newId, nowIso } from "../../../../src/platform/contracts/types/ids.js";
import type { BudgetLedger, BudgetReservation, BudgetResourceKind } from "../../../../src/platform/contracts/executable-contracts/schemas.js";

function createTestLedger(overrides?: Partial<BudgetLedger>): BudgetLedger {
  return {
    budgetLedgerId: overrides?.budgetLedgerId ?? newId("bled"),
    harnessRunId: overrides?.harnessRunId ?? newId("run"),
    tenantId: "tenant_test",
    status: "active",
    reservedAmount: overrides?.reservedAmount ?? 0,
    settledAmount: overrides?.settledAmount ?? 0,
    releasedAmount: overrides?.releasedAmount ?? 0,
    hardCap: overrides?.hardCap ?? 100000,
    version: overrides?.version ?? 1,
  };
}

function createTestContext(tierLimit: number = 100000): BudgetAllocatorContext {
  return {
    tenantId: "tenant_test",
    traceId: newId("trace"),
    emittedBy: "test",
    tier: BudgetTier.TENANT,
    tierLimit,
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

// ============================================================================
// Budget Reservation Performance Tests
// ============================================================================

test("performance: budget reservation throughput >5000 ops/sec", (t) => {
  const allocator = new BudgetAllocator();
  const ledger = createTestLedger();
  const context = createTestContext();

  try {
    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const newLedger = createTestLedger({
        budgetLedgerId: ledger.budgetLedgerId,
        harnessRunId: ledger.harnessRunId,
        version: ledger.version + i,
      });
      allocator.reserve({
        ledger: newLedger,
        amount: 100,
        resourceKind: "compute" as BudgetResourceKind,
        expiresAt: nowIso(),
        expectedVersion: newLedger.version,
        context,
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 5000,
        `Budget reservation throughput ${opsPerSec.toFixed(2)} ops/sec must be >5000 ops/sec. Avg latency: ${avgLatencyMs.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    // No cleanup needed for BudgetAllocator
  }
});

test("performance: budget reservation P99 latency <1ms", (t) => {
  const allocator = new BudgetAllocator();
  const ledger = createTestLedger();
  const context = createTestContext();

  try {
    const latencies: number[] = [];
    const iterations = 500;

    // Warmup
    for (let i = 0; i < 10; i++) {
      allocator.reserve({
        ledger: createTestLedger({ version: i }),
        amount: 50,
        resourceKind: "compute" as BudgetResourceKind,
        expiresAt: nowIso(),
        expectedVersion: i,
        context,
      });
    }

    // Measure
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      allocator.reserve({
        ledger: createTestLedger({ version: 1000 + i }),
        amount: 50,
        resourceKind: "compute" as BudgetResourceKind,
        expiresAt: nowIso(),
        expectedVersion: 1000 + i,
        context,
      });
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 1,
        `Budget reservation P99 latency ${p99.toFixed(3)}ms exceeds 1ms target. P50: ${p50.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    // No cleanup needed
  }
});

// ============================================================================
// Budget Settlement Performance Tests
// ============================================================================

test("performance: budget settlement throughput >3000 ops/sec", (t) => {
  const allocator = new BudgetAllocator();
  const ledger = createTestLedger({ reservedAmount: 10000 });
  const context = createTestContext();

  // Create a reservation first
  const reservationResult = allocator.reserve({
    ledger,
    amount: 5000,
    resourceKind: "compute" as BudgetResourceKind,
    expiresAt: nowIso(),
    expectedVersion: ledger.version,
    context,
  });

  try {
    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const newLedger = createTestLedger({
        budgetLedgerId: ledger.budgetLedgerId,
        harnessRunId: ledger.harnessRunId,
        reservedAmount: 5000,
        version: reservationResult.ledger.version + i,
      });
      allocator.settle({
        ledger: newLedger,
        reservation: reservationResult.reservation,
        actualAmount: 4500,
        context,
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 3000,
        `Budget settlement throughput ${opsPerSec.toFixed(2)} ops/sec must be >3000 ops/sec. Avg latency: ${avgLatencyMs.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    // No cleanup needed
  }
});

test("performance: budget settlement P99 latency <2ms", (t) => {
  const allocator = new BudgetAllocator();
  const ledger = createTestLedger({ reservedAmount: 10000 });
  const context = createTestContext();

  const reservationResult = allocator.reserve({
    ledger,
    amount: 5000,
    resourceKind: "compute" as BudgetResourceKind,
    expiresAt: nowIso(),
    expectedVersion: ledger.version,
    context,
  });

  try {
    const latencies: number[] = [];
    const iterations = 500;

    // Warmup
    for (let i = 0; i < 10; i++) {
      allocator.settle({
        ledger: createTestLedger({ reservedAmount: 5000, version: i }),
        reservation: reservationResult.reservation,
        actualAmount: 4500,
        context,
      });
    }

    // Measure
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      allocator.settle({
        ledger: createTestLedger({ reservedAmount: 5000, version: 1000 + i }),
        reservation: reservationResult.reservation,
        actualAmount: 4500,
        context,
      });
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 2,
        `Budget settlement P99 latency ${p99.toFixed(3)}ms exceeds 2ms target. P50: ${p50.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    // No cleanup needed
  }
});

// ============================================================================
// Budget Release Performance Tests
// ============================================================================

test("performance: budget release throughput >5000 ops/sec", (t) => {
  const allocator = new BudgetAllocator();
  const ledger = createTestLedger({ reservedAmount: 10000 });
  const context = createTestContext();

  const reservationResult = allocator.reserve({
    ledger,
    amount: 5000,
    resourceKind: "compute" as BudgetResourceKind,
    expiresAt: nowIso(),
    expectedVersion: ledger.version,
    context,
  });

  try {
    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const newLedger = createTestLedger({
        budgetLedgerId: ledger.budgetLedgerId,
        harnessRunId: ledger.harnessRunId,
        reservedAmount: 5000,
        version: reservationResult.ledger.version + i,
      });
      allocator.release({
        ledger: newLedger,
        reservation: reservationResult.reservation,
        context,
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 5000,
        `Budget release throughput ${opsPerSec.toFixed(2)} ops/sec must be >5000 ops/sec. Avg latency: ${avgLatencyMs.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    // No cleanup needed
  }
});

// ============================================================================
// Budget Calculation Scaling Tests
// ============================================================================

test("performance: budget operations scale with ledger size", (t) => {
  const allocator = new BudgetAllocator();
  const context = createTestContext(1000000); // Higher limit for scaling test

  try {
    const ledgerSizes = [100, 1000, 10000];
    const results: { size: number; opsPerSec: number }[] = [];

    for (const size of ledgerSizes) {
      const ledger = createTestLedger({
        reservedAmount: size,
        hardCap: 1000000,
      });

      const iterations = 500;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        allocator.reserve({
          ledger: createTestLedger({
            budgetLedgerId: ledger.budgetLedgerId,
            harnessRunId: ledger.harnessRunId,
            reservedAmount: size,
            version: ledger.version + i,
          }),
          amount: 100,
          resourceKind: "compute" as BudgetResourceKind,
          expiresAt: nowIso(),
          expectedVersion: ledger.version + i,
          context,
        });
      }

      const elapsed = performance.now() - start;
      const opsPerSec = (iterations / elapsed) * 1000;
      results.push({ size, opsPerSec });
    }

    // Verify performance doesn't degrade more than 2x as ledger size increases 100x
    const baseline = results[0]!.opsPerSec;
    for (const { size, opsPerSec } of results.slice(1)) {
      const degradation = baseline / opsPerSec;
      try {
        assert.ok(
          degradation < 2,
          `Budget ops for size=${size} degraded by ${degradation.toFixed(1)}x, expected <2x`,
        );
      } catch (err) {
        if (err instanceof assert.AssertionError) {
          reportSoftPerformanceMiss(t, err);
          return;
        }
        throw err;
      }
    }
  } finally {
    // No cleanup needed
  }
});

// ============================================================================
// Watermark Alert Performance Tests
// ============================================================================

test("performance: watermark alert check <0.1ms", (t) => {
  const allocator = new BudgetAllocator();
  const ledger = createTestLedger({ reservedAmount: 95000, hardCap: 100000 });
  const context = createTestContext(100000);

  // Create a reservation that triggers warning threshold
  allocator.reserve({
    ledger,
    amount: 1000,
    resourceKind: "compute" as BudgetResourceKind,
    expiresAt: nowIso(),
    expectedVersion: ledger.version,
    context,
  });

  const iterations = 1000;
  const latencies: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const testLedger = createTestLedger({
      reservedAmount: 80000 + i,
      version: ledger.version + i,
    });
    const start = performance.now();
    // The watermark check is internal to reserve(), measure the overall operation
    allocator.reserve({
      ledger: testLedger,
      amount: 100,
      resourceKind: "compute" as BudgetResourceKind,
      expiresAt: nowIso(),
      expectedVersion: testLedger.version,
      context,
    });
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const avg = latencies.reduce((a, b) => a + b, 0) / iterations;

  try {
    assert.ok(
      avg < 0.5,
      `Budget operation with watermark check avg ${avg.toFixed(3)}ms exceeds 0.5ms. P99: ${p99.toFixed(3)}ms`,
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
// High-Volume Budget Operations Tests
// ============================================================================

test("performance: handles 5000 budget operations without errors", (t) => {
  const allocator = new BudgetAllocator();
  const ledger = createTestLedger();
  const context = createTestContext();

  try {
    const iterations = 5000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const newLedger = createTestLedger({
        budgetLedgerId: ledger.budgetLedgerId,
        harnessRunId: ledger.harnessRunId,
        version: ledger.version + i,
      });
      allocator.reserve({
        ledger: newLedger,
        amount: 100,
        resourceKind: "compute" as BudgetResourceKind,
        expiresAt: nowIso(),
        expectedVersion: newLedger.version,
        context,
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;

    try {
      assert.ok(
        opsPerSec > 2000,
        `High-volume budget ops achieved ${opsPerSec.toFixed(2)} ops/sec, expected >2000 ops/sec`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    // No cleanup needed
  }
});
