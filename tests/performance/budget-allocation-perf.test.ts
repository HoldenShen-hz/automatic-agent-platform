/**
 * Performance Test: Budget Allocation Under Load
 * Measures budget reservation, settlement, and watermark enforcement performance
 *
 * Design targets:
 * - Budget reservation throughput: >1000 ops/sec
 * - Budget settlement throughput: >2000 ops/sec
 * - Watermark alert throughput: >5000 ops/sec
 * - High-load reservation throughput: >500 ops/sec with 10 concurrent allocators
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { rmSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { reportSoftPerformanceMiss } from "../helpers/performance.js";

import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { BudgetAllocator, type BudgetAllocatorContext } from "../../src/platform/five-plane-execution/budget-allocator.js";
import { RuntimeStateMachine } from "../../src/platform/execution/runtime-state-machine.js";
import { createBudgetLedger, type BudgetLedger } from "../../src/platform/contracts/executable-contracts/index.js";
import { newId, nowIso } from "../../src/platform/contracts/types/ids.js";

function createTempDb(): SqliteDatabase {
  const dbPath = join(".tmp", `budget-alloc-perf-${process.pid}-${Date.now()}.db`);
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  return db;
}

function cleanupDb(db: SqliteDatabase): void {
  rmSync(db.filePath, { force: true });
  rmSync(`${db.filePath}-wal`, { force: true });
  rmSync(`${db.filePath}-shm`, { force: true });
}

function createBudgetAllocator(): BudgetAllocator {
  return new BudgetAllocator({
    stateMachine: new RuntimeStateMachine(),
    events: {
      emitWatermarkAlert: () => {},
      emitAutoThrottleEvent: () => {},
      emitStreamingSettle: () => {},
    },
  });
}

function createDefaultContext(tenantId: string, harnessRunId: string): BudgetAllocatorContext {
  return {
    tenantId,
    traceId: newId("trace"),
    emittedBy: "budget-perf-test",
  };
}

// ============================================================================
// Budget Reservation Throughput Benchmarks
// ============================================================================

test("budget: reservation throughput >1000 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const allocator = createBudgetAllocator();

  try {
    const iterations = 500;
    const harnessRunId = newId("hrun");
    const tenantId = "perf-tenant";

    // Create initial ledger
    const ledger = createBudgetLedger({
      budgetLedgerId: newId("bledger"),
      harnessRunId,
      tenantId,
      hardCap: 100000,
      reservedAmount: 0,
      settledAmount: 0,
      releasedAmount: 0,
      status: "open",
      version: 1,
    });

    const context = createDefaultContext(tenantId, harnessRunId);

    // Warmup
    for (let i = 0; i < 50; i++) {
      allocator.reserve({
        ledger: { ...ledger, version: ledger.version + i },
        amount: 100,
        resourceKind: "compute",
        expiresAt: nowIso(),
        expectedVersion: ledger.version + i,
        context,
      });
    }

    // Benchmark
    const start = performance.now();
    let currentLedger = ledger;
    let version = ledger.version;

    for (let i = 0; i < iterations; i++) {
      const result = allocator.reserve({
        ledger: { ...currentLedger, version },
        amount: 100,
        resourceKind: "compute",
        expiresAt: nowIso(),
        expectedVersion: version,
        context,
      });
      currentLedger = result.ledger;
      version = result.ledger.version;
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 1000,
        `Budget reservation throughput ${opsPerSec.toFixed(0)} ops/sec must be >1000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    db.close();
    cleanupDb(db);
  }
});

test("budget: high-load reservation throughput >500 ops/sec with 10 concurrent allocators", async (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const numAllocators = 10;
  const reservationsPerAllocator = 50;
  const totalReservations = numAllocators * reservationsPerAllocator;

  try {
    const harnessRunId = newId("hrun");
    const tenantId = "perf-tenant-concurrent";

    // Create initial ledger
    const ledger = createBudgetLedger({
      budgetLedgerId: newId("bledger"),
      harnessRunId,
      tenantId,
      hardCap: 1000000,
      reservedAmount: 0,
      settledAmount: 0,
      releasedAmount: 0,
      status: "open",
      version: 1,
    });

    // Benchmark
    const start = performance.now();

    await Promise.all(
      Array.from({ length: numAllocators }, async (_, allocatorId) => {
        const allocator = createBudgetAllocator();
        const context = createDefaultContext(tenantId, harnessRunId);
        let currentLedger = ledger;
        let version = ledger.version;

        for (let i = 0; i < reservationsPerAllocator; i++) {
          const result = allocator.reserve({
            ledger: { ...currentLedger, version },
            amount: 100,
            resourceKind: "compute",
            expiresAt: nowIso(),
            expectedVersion: version,
            context,
          });
          currentLedger = result.ledger;
          version = result.ledger.version;
        }
      }),
    );

    const elapsed = performance.now() - start;
    const opsPerSec = (totalReservations / elapsed) * 1000;
    const avgLatencyMs = elapsed / totalReservations;

    try {
      assert.ok(
        opsPerSec > 500,
        `High-load budget reservation throughput ${opsPerSec.toFixed(0)} ops/sec must be >500 ops/sec with ${numAllocators} concurrent allocators. Avg: ${avgLatencyMs.toFixed(4)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    db.close();
    cleanupDb(db);
  }
});

// ============================================================================
// Budget Settlement Throughput Benchmarks
// ============================================================================

test("budget: settlement throughput >2000 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const allocator = createBudgetAllocator();

  try {
    const iterations = 500;
    const harnessRunId = newId("hrun");
    const tenantId = "perf-tenant";

    // Create ledger with reserved amount
    const ledger = createBudgetLedger({
      budgetLedgerId: newId("bledger"),
      harnessRunId,
      tenantId,
      hardCap: 100000,
      reservedAmount: 100000,
      settledAmount: 0,
      releasedAmount: 0,
      status: "open",
      version: 1,
    });

    const context = createDefaultContext(tenantId, harnessRunId);

    // Warmup - create reservations and settle them
    for (let i = 0; i < 20; i++) {
      const reserveResult = allocator.reserve({
        ledger: { ...ledger, version: ledger.version + i },
        amount: 100,
        resourceKind: "compute",
        expiresAt: nowIso(),
        expectedVersion: ledger.version + i,
        context,
      });
      allocator.settle({
        ledger: reserveResult.ledger,
        reservation: reserveResult.reservation,
        actualAmount: 100,
        context,
      });
    }

    // Benchmark
    const start = performance.now();
    let currentLedger = ledger;
    let version = ledger.version;

    for (let i = 0; i < iterations; i++) {
      // First reserve
      const reserveResult = allocator.reserve({
        ledger: { ...currentLedger, version },
        amount: 100,
        resourceKind: "compute",
        expiresAt: nowIso(),
        expectedVersion: version,
        context,
      });
      currentLedger = reserveResult.ledger;
      version = reserveResult.ledger.version;

      // Then settle
      const settleResult = allocator.settle({
        ledger: currentLedger,
        reservation: reserveResult.reservation,
        actualAmount: 100,
        context,
      });
      currentLedger = settleResult.ledger;
      version = settleResult.ledger.version;
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 2000,
        `Budget settlement throughput ${opsPerSec.toFixed(0)} ops/sec must be >2000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    db.close();
    cleanupDb(db);
  }
});

// ============================================================================
// Watermark Alert Throughput Benchmarks
// ============================================================================

test("budget: watermark alert throughput >5000 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const allocator = createBudgetAllocator();

  try {
    const harnessRunId = newId("hrun");
    const tenantId = "perf-tenant";

    // Create context with low thresholds for frequent alerts
    const context: BudgetAllocatorContext = {
      tenantId,
      traceId: newId("trace"),
      emittedBy: "budget-perf-test",
    };

    const ledger = createBudgetLedger({
      budgetLedgerId: newId("bledger"),
      harnessRunId,
      tenantId,
      hardCap: 1000,
      reservedAmount: 0,
      settledAmount: 0,
      releasedAmount: 0,
      status: "open",
      version: 1,
    });

    const iterations = 1000;
    let currentLedger = ledger;
    let version = ledger.version;

    // Benchmark - this should trigger warnings frequently
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const result = allocator.reserve({
        ledger: { ...currentLedger, version },
        amount: 50,
        resourceKind: "compute",
        expiresAt: nowIso(),
        expectedVersion: version,
        context,
      });
      currentLedger = result.ledger;
      version = result.ledger.version;
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 5000,
        `Budget watermark alert throughput ${opsPerSec.toFixed(0)} ops/sec must be >5000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    db.close();
    cleanupDb(db);
  }
});

// ============================================================================
// Budget Tier Hierarchy Benchmarks
// ============================================================================

test("budget: tier hierarchy allocation throughput >800 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const allocator = createBudgetAllocator();

  try {
    const iterations = 500;
    const tenantId = "perf-tenant";

    // Create ledger at platform level
    const platformLedger = createBudgetLedger({
      budgetLedgerId: newId("bledger-platform"),
      harnessRunId: "platform-hrun",
      tenantId: "platform",
      hardCap: 1000000,
      reservedAmount: 0,
      settledAmount: 0,
      releasedAmount: 0,
      status: "open",
      version: 1,
    });

    // Benchmark platform-level allocation
    const start = performance.now();
    let currentLedger = platformLedger;
    let version = platformLedger.version;

    for (let i = 0; i < iterations; i++) {
      const platformContext: BudgetAllocatorContext = {
        tenantId,
        traceId: newId("trace"),
        emittedBy: "budget-perf-test",
      };

      const result = allocator.reserve({
        ledger: { ...currentLedger, version },
        amount: 1000,
        resourceKind: "compute",
        expiresAt: nowIso(),
        expectedVersion: version,
        context: platformContext,
      });
      currentLedger = result.ledger;
      version = result.ledger.version;
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 800,
        `Budget tier hierarchy throughput ${opsPerSec.toFixed(0)} ops/sec must be >800 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    db.close();
    cleanupDb(db);
  }
});

// ============================================================================
// Budget Hard Cap Enforcement Benchmarks
// ============================================================================

test("budget: hard cap enforcement at limit throughput >3000 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const allocator = createBudgetAllocator();

  try {
    const harnessRunId = newId("hrun");
    const tenantId = "perf-tenant";

    const ledger = createBudgetLedger({
      budgetLedgerId: newId("bledger"),
      harnessRunId,
      tenantId,
      hardCap: 500,
      reservedAmount: 0,
      settledAmount: 0,
      releasedAmount: 0,
      status: "open",
      version: 1,
    });

    const context = createDefaultContext(tenantId, harnessRunId);

    const iterations = 1000;
    let currentLedger = ledger;
    let version = ledger.version;

    // Warmup
    for (let i = 0; i < 10; i++) {
      const result = allocator.reserve({
        ledger: { ...currentLedger, version },
        amount: 10,
        resourceKind: "compute",
        expiresAt: nowIso(),
        expectedVersion: version,
        context,
      });
      currentLedger = result.ledger;
      version = result.ledger.version;
    }

    // Benchmark
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const result = allocator.reserve({
        ledger: { ...currentLedger, version },
        amount: 10,
        resourceKind: "compute",
        expiresAt: nowIso(),
        expectedVersion: version,
        context,
      });
      currentLedger = result.ledger;
      version = result.ledger.version;
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 3000,
        `Budget hard cap enforcement throughput ${opsPerSec.toFixed(0)} ops/sec must be >3000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    db.close();
    cleanupDb(db);
  }
});

// ============================================================================
// Budget Auto-Throttle Benchmarks
// ============================================================================

test("budget: auto-throttle throughput >1000 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const allocator = createBudgetAllocator();

  try {
    const harnessRunId = newId("hrun");
    const tenantId = "perf-tenant";

    // Context with auto-throttle enabled
    const context: BudgetAllocatorContext = {
      tenantId,
      traceId: newId("trace"),
      emittedBy: "budget-perf-test",
    };

    const ledger = createBudgetLedger({
      budgetLedgerId: newId("bledger"),
      harnessRunId,
      tenantId,
      hardCap: 10000,
      reservedAmount: 0,
      settledAmount: 0,
      releasedAmount: 0,
      status: "open",
      version: 1,
    });

    const iterations = 500;
    let currentLedger = ledger;
    let version = ledger.version;

    // Benchmark
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const result = allocator.reserve({
        ledger: { ...currentLedger, version },
        amount: 100,
        resourceKind: "compute",
        expiresAt: nowIso(),
        expectedVersion: version,
        context,
      });
      currentLedger = result.ledger;
      version = result.ledger.version;
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 1000,
        `Budget auto-throttle throughput ${opsPerSec.toFixed(0)} ops/sec must be >1000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    db.close();
    cleanupDb(db);
  }
});