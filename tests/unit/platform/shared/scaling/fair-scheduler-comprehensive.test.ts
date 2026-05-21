import test from "node:test";
import assert from "node:assert/strict";
import {
  FairScheduler,
  type SchedulingTenant,
  type BorrowedResources,
  type SchedulingDecision,
} from "../../../../../src/platform/shared/scaling/fair-scheduler.js";
import type { ResourceAllocation } from "../../../../../src/platform/shared/scaling/resource-quota.js";

/**
 * Comprehensive tests for FairScheduler - fair-scheduler.ts
 * Weighted Fair Queuing with borrowing and reclaim
 */

const DEFAULT_TOTAL_CAPACITY: ResourceAllocation = {
  maxConcurrentWorkflows: 100,
  maxConcurrentWorkers: 50,
  llmTokensPerMinute: 100000,
  llmRequestsPerMinute: 1000,
};

// =============================================================================
// Constructor and Initialization
// =============================================================================

test("FairScheduler constructor initializes with total capacity", () => {
  const capacity: ResourceAllocation = {
    maxConcurrentWorkflows: 200,
    maxConcurrentWorkers: 100,
    llmTokensPerMinute: 200000,
    llmRequestsPerMinute: 2000,
  };
  const scheduler = new FairScheduler(capacity);

  // Scheduler should be functional even with no tenants
  const utilization = scheduler.getAllUtilization();
  assert.deepStrictEqual(utilization, []);
});

test("FairScheduler constructor does not modify original capacity object", () => {
  const originalCapacity: ResourceAllocation = {
    maxConcurrentWorkflows: 100,
    maxConcurrentWorkers: 50,
    llmTokensPerMinute: 100000,
    llmRequestsPerMinute: 1000,
  };
  const originalCopy = { ...originalCapacity };

  new FairScheduler(originalCapacity);

  assert.deepStrictEqual(originalCapacity, originalCopy);
});

// =============================================================================
// Tenant Registration - registerTenant
// =============================================================================

test("FairScheduler registerTenant creates tenant with correct initial state", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);
  const guaranteed: ResourceAllocation = {
    maxConcurrentWorkflows: 20,
    maxConcurrentWorkers: 10,
    llmTokensPerMinute: 20000,
    llmRequestsPerMinute: 200,
  };

  scheduler.registerTenant("tenant-1", 1.5, guaranteed);

  const stats = scheduler.getTenantStats("tenant-1");
  assert.ok(stats !== null);
  assert.equal(stats!.guaranteed.maxConcurrentWorkflows, 20);
  assert.equal(stats!.guaranteed.maxConcurrentWorkers, 10);
  assert.equal(stats!.guaranteed.llmTokensPerMinute, 20000);
  assert.equal(stats!.used.maxConcurrentWorkflows, 0);
  assert.equal(stats!.used.maxConcurrentWorkers, 0);
  assert.equal(stats!.used.llmTokensPerMinute, 0);
  assert.deepStrictEqual(stats!.borrowed, { workflows: 0, workers: 0, tokensPerMinute: 0 });
});

test("FairScheduler registerTenant with zero weight is allowed", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);

  scheduler.registerTenant("zero-weight", 0, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  const decision = scheduler.admitTask("zero-weight", "task-1", { maxConcurrentWorkflows: 1 });
  assert.equal(decision.admitted, true);
});

test("FairScheduler registerTenant stores weight for future WFQ calculations", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);

  scheduler.registerTenant("high-weight", 3.0, {
    maxConcurrentWorkflows: 30,
    maxConcurrentWorkers: 15,
    llmTokensPerMinute: 30000,
    llmRequestsPerMinute: 300,
  });

  scheduler.registerTenant("low-weight", 1.0, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  const utilization = scheduler.getAllUtilization();
  assert.equal(utilization.length, 2);
});

// =============================================================================
// Task Admission - admitTask
// =============================================================================

test("FairScheduler admitTask with empty request admits successfully", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);
  scheduler.registerTenant("tenant-1", 1.0, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  const decision = scheduler.admitTask("tenant-1", "task-empty", {});

  assert.equal(decision.admitted, true);
  assert.equal(decision.taskId, "task-empty");
  assert.equal(decision.tenantId, "tenant-1");
  assert.deepStrictEqual(decision.allocatedResources, {});
});

test("FairScheduler admitTask tracks all resource types", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);
  scheduler.registerTenant("tenant-1", 1.0, {
    maxConcurrentWorkflows: 50,
    maxConcurrentWorkers: 25,
    llmTokensPerMinute: 50000,
    llmRequestsPerMinute: 500,
  });

  const decision = scheduler.admitTask("tenant-1", "task-1", {
    maxConcurrentWorkflows: 5,
    maxConcurrentWorkers: 3,
    llmTokensPerMinute: 5000,
    llmRequestsPerMinute: 50,
  });

  assert.equal(decision.admitted, true);
  assert.equal(decision.allocatedResources.maxConcurrentWorkflows, 5);
  assert.equal(decision.allocatedResources.maxConcurrentWorkers, 3);
  assert.equal(decision.allocatedResources.llmTokensPerMinute, 5000);
  assert.equal(decision.allocatedResources.llmRequestsPerMinute, 50);
});

test("FairScheduler admitTask rejects when exceeding guaranteed + borrowed capacity", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);
  scheduler.registerTenant("tenant-1", 1.0, {
    maxConcurrentWorkflows: 5,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 5000,
    llmRequestsPerMinute: 50,
  });

  // Use exactly the guaranteed
  scheduler.admitTask("tenant-1", "task-1", { maxConcurrentWorkflows: 5 });

  // This should fail since there's no other tenant to borrow from
  const decision = scheduler.admitTask("tenant-1", "task-2", { maxConcurrentWorkflows: 1 });
  assert.equal(decision.admitted, false);
  assert.ok(decision.waitReason !== undefined);
});

test("FairScheduler admitTask admits when resources available within guaranteed", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);
  scheduler.registerTenant("tenant-1", 1.0, {
    maxConcurrentWorkflows: 20,
    maxConcurrentWorkers: 10,
    llmTokensPerMinute: 20000,
    llmRequestsPerMinute: 200,
  });

  const decision = scheduler.admitTask("tenant-1", "task-1", {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
  });

  assert.equal(decision.admitted, true);
  assert.equal(decision.allocatedResources.maxConcurrentWorkflows, 10);
});

test("FairScheduler admitTask uses workflows as proxy for llmRequestsPerMinute in borrowing", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);
  scheduler.registerTenant("lender", 1.0, {
    maxConcurrentWorkflows: 50,
    maxConcurrentWorkers: 25,
    llmTokensPerMinute: 50000,
    llmRequestsPerMinute: 500,
  });

  scheduler.registerTenant("borrower", 1.0, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  // Lender uses some workflows
  scheduler.admitTask("lender", "task-1", { maxConcurrentWorkflows: 40 });

  // Borrower uses its guaranteed workflows
  scheduler.admitTask("borrower", "task-2", { maxConcurrentWorkflows: 10 });

  // Borrower tries to exceed - should borrow using workflows as proxy
  const decision = scheduler.admitTask("borrower", "task-3", { maxConcurrentWorkflows: 5 });

  assert.equal(decision.admitted, true);
  assert.ok(decision.borrowedFrom !== undefined);
  assert.ok(decision.borrowedFrom!.includes("lender"));
});

// =============================================================================
// Resource Release - releaseResources
// =============================================================================

test("FairScheduler releaseResources with borrowed resources triggers reclaim", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);
  scheduler.registerTenant("lender", 1.0, {
    maxConcurrentWorkflows: 50,
    maxConcurrentWorkers: 25,
    llmTokensPerMinute: 50000,
    llmRequestsPerMinute: 500,
  });

  scheduler.registerTenant("borrower", 1.0, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  // Lender uses some capacity
  scheduler.admitTask("lender", "task-1", { maxConcurrentWorkflows: 30 });

  // Borrower uses its guarantee then borrows
  scheduler.admitTask("borrower", "task-2", { maxConcurrentWorkflows: 10 });
  scheduler.admitTask("borrower", "task-3", { maxConcurrentWorkflows: 5 });

  // Release the borrowed resources
  scheduler.releaseResources("borrower", { maxConcurrentWorkflows: 5 });

  // Borrower should have no borrowed workflows remaining
  const stats = scheduler.getTenantStats("borrower");
  assert.ok(stats !== null);
  assert.equal(stats!.borrowed.workflows, 0);
});

test("FairScheduler releaseResources decrements used resources correctly", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);
  scheduler.registerTenant("tenant-1", 1.0, {
    maxConcurrentWorkflows: 20,
    maxConcurrentWorkers: 10,
    llmTokensPerMinute: 20000,
    llmRequestsPerMinute: 200,
  });

  scheduler.admitTask("tenant-1", "task-1", {
    maxConcurrentWorkflows: 8,
    maxConcurrentWorkers: 4,
    llmTokensPerMinute: 8000,
  });

  scheduler.releaseResources("tenant-1", {
    maxConcurrentWorkflows: 3,
    maxConcurrentWorkers: 2,
    llmTokensPerMinute: 3000,
  });

  const stats = scheduler.getTenantStats("tenant-1");
  assert.ok(stats !== null);
  assert.equal(stats!.used.maxConcurrentWorkflows, 5);
  assert.equal(stats!.used.maxConcurrentWorkers, 2);
  assert.equal(stats!.used.llmTokensPerMinute, 5000);
});

test("FairScheduler releaseResources does not go negative", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);
  scheduler.registerTenant("tenant-1", 1.0, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  scheduler.admitTask("tenant-1", "task-1", { maxConcurrentWorkflows: 5 });
  scheduler.releaseResources("tenant-1", { maxConcurrentWorkflows: 10 }); // Release more than used

  const stats = scheduler.getTenantStats("tenant-1");
  assert.ok(stats !== null);
  assert.equal(stats!.used.maxConcurrentWorkflows, 0);
});

test("FairScheduler releaseResources handles unknown tenant gracefully", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);

  // Should not throw
  scheduler.releaseResources("non-existent", { maxConcurrentWorkflows: 10 });

  const stats = scheduler.getTenantStats("non-existent");
  assert.equal(stats, null);
});

// =============================================================================
// Tenant Unregistration - unregisterTenant
// =============================================================================

test("FairScheduler unregisterTenant removes tenant and releases borrowed tracking", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);
  scheduler.registerTenant("tenant-1", 1.0, {
    maxConcurrentWorkflows: 50,
    maxConcurrentWorkers: 25,
    llmTokensPerMinute: 50000,
    llmRequestsPerMinute: 500,
  });

  scheduler.registerTenant("tenant-2", 1.0, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  // tenant-2 borrows from tenant-1
  scheduler.admitTask("tenant-1", "task-1", { maxConcurrentWorkflows: 40 });
  scheduler.admitTask("tenant-2", "task-2", { maxConcurrentWorkflows: 10 });

  // Unregister tenant-1
  scheduler.unregisterTenant("tenant-1");

  // tenant-2 should still exist
  const stats = scheduler.getTenantStats("tenant-2");
  assert.ok(stats !== null);

  // And tenant-1 should be gone
  const stats1 = scheduler.getTenantStats("tenant-1");
  assert.equal(stats1, null);
});

test("FairScheduler unregisterTenant updates utilization list", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);
  scheduler.registerTenant("tenant-1", 1.0, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  scheduler.registerTenant("tenant-2", 1.0, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  scheduler.unregisterTenant("tenant-1");

  const utilization = scheduler.getAllUtilization();
  assert.equal(utilization.length, 1);
  assert.equal(utilization[0]!.tenantId, "tenant-2");
});

// =============================================================================
// Multi-Tenant Borrowing Scenarios
// =============================================================================

test("FairScheduler borrowing from multiple lenders", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);

  scheduler.registerTenant("lender-1", 1.0, {
    maxConcurrentWorkflows: 30,
    maxConcurrentWorkers: 15,
    llmTokensPerMinute: 30000,
    llmRequestsPerMinute: 300,
  });

  scheduler.registerTenant("lender-2", 1.0, {
    maxConcurrentWorkflows: 30,
    maxConcurrentWorkers: 15,
    llmTokensPerMinute: 30000,
    llmRequestsPerMinute: 300,
  });

  scheduler.registerTenant("borrower", 1.0, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  // Use most of both lenders' capacity
  scheduler.admitTask("lender-1", "task-1", { maxConcurrentWorkflows: 25 });
  scheduler.admitTask("lender-2", "task-2", { maxConcurrentWorkflows: 25 });

  // Borrower needs 15 total (10 guaranteed + 5 borrowed)
  const decision = scheduler.admitTask("borrower", "task-3", { maxConcurrentWorkflows: 15 });

  assert.equal(decision.admitted, true);
  assert.ok(decision.borrowedFrom !== undefined);
  assert.ok(decision.borrowedFrom!.length! >= 1);
});

test("FairScheduler no borrowing possible when all tenants at capacity", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);

  scheduler.registerTenant("tenant-1", 1.0, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  scheduler.registerTenant("tenant-2", 1.0, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  // Both at capacity
  scheduler.admitTask("tenant-1", "task-1", { maxConcurrentWorkflows: 10 });
  scheduler.admitTask("tenant-2", "task-2", { maxConcurrentWorkflows: 10 });

  // tenant-1 tries to exceed
  const decision = scheduler.admitTask("tenant-1", "task-3", { maxConcurrentWorkflows: 5 });

  assert.equal(decision.admitted, false);
});

test("FairScheduler borrowing not used when guaranteed is sufficient", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);

  scheduler.registerTenant("tenant-1", 1.0, {
    maxConcurrentWorkflows: 50,
    maxConcurrentWorkers: 25,
    llmTokensPerMinute: 50000,
    llmRequestsPerMinute: 500,
  });

  scheduler.registerTenant("tenant-2", 1.0, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  // tenant-2 uses only its guaranteed
  const decision = scheduler.admitTask("tenant-2", "task-1", { maxConcurrentWorkflows: 8 });

  assert.equal(decision.admitted, true);
  assert.equal(decision.borrowedFrom, undefined);
});

// =============================================================================
// Utilization Calculations
// =============================================================================

test("FairScheduler getTenantStats calculates utilization percentage correctly", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);
  scheduler.registerTenant("tenant-1", 1.0, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  // Use 5 workflows, 2 workers, 5000 tokens (half of each)
  scheduler.admitTask("tenant-1", "task-1", {
    maxConcurrentWorkflows: 5,
    maxConcurrentWorkers: 2,
    llmTokensPerMinute: 5000,
  });

  const stats = scheduler.getTenantStats("tenant-1");
  assert.ok(stats !== null);
  // (5 + 2 + 5000) / (10 + 5 + 10000) = 5007/10015 ≈ 49.99%
  assert.ok(Math.abs(stats!.utilizationPercent - 49.99) < 0.1);
});

test("FairScheduler getAllUtilization returns isBorrowing true when borrowing", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);
  scheduler.registerTenant("lender", 1.0, {
    maxConcurrentWorkflows: 50,
    maxConcurrentWorkers: 25,
    llmTokensPerMinute: 50000,
    llmRequestsPerMinute: 500,
  });

  scheduler.registerTenant("borrower", 1.0, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  // lender uses most of its capacity
  scheduler.admitTask("lender", "task-1", { maxConcurrentWorkflows: 40 });

  // borrower exceeds its guaranteed and borrows
  scheduler.admitTask("borrower", "task-2", { maxConcurrentWorkflows: 10 });
  scheduler.admitTask("borrower", "task-3", { maxConcurrentWorkflows: 5 });

  const utilization = scheduler.getAllUtilization();
  const borrower = utilization.find((t) => t.tenantId === "borrower");

  assert.ok(borrower !== undefined);
  assert.equal(borrower!.isBorrowing, true);
});

test("FairScheduler getAllUtilization returns isBorrowing false when not borrowing", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);
  scheduler.registerTenant("tenant-1", 1.0, {
    maxConcurrentWorkflows: 20,
    maxConcurrentWorkers: 10,
    llmTokensPerMinute: 20000,
    llmRequestsPerMinute: 200,
  });

  // Use only half of guaranteed
  scheduler.admitTask("tenant-1", "task-1", { maxConcurrentWorkflows: 5 });

  const utilization = scheduler.getAllUtilization();
  const tenant = utilization.find((t) => t.tenantId === "tenant-1");

  assert.ok(tenant !== undefined);
  assert.equal(tenant!.isBorrowing, false);
});

test("FairScheduler utilizationPercent is zero when guaranteed is zero", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);
  scheduler.registerTenant("tenant-zero", 1.0, {
    maxConcurrentWorkflows: 0,
    maxConcurrentWorkers: 0,
    llmTokensPerMinute: 0,
    llmRequestsPerMinute: 0,
  });

  scheduler.admitTask("tenant-zero", "task-1", {});

  const stats = scheduler.getTenantStats("tenant-zero");
  assert.ok(stats !== null);
  assert.equal(stats!.utilizationPercent, 0);
});

// =============================================================================
// Edge Cases and Error Handling
// =============================================================================

test("FairScheduler admitTask returns correct waitReason for unregistered tenant", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);

  const decision = scheduler.admitTask("unknown", "task-1", { maxConcurrentWorkflows: 1 });

  assert.equal(decision.admitted, false);
  assert.ok(decision.waitReason !== undefined);
  assert.ok(decision.waitReason!.includes("not registered"));
});

test("FairScheduler admitTask provides specific rejection reasons", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);
  scheduler.registerTenant("tenant-1", 1.0, {
    maxConcurrentWorkflows: 5,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 5000,
    llmRequestsPerMinute: 50,
  });

  scheduler.admitTask("tenant-1", "task-1", { maxConcurrentWorkflows: 5 });

  const decision = scheduler.admitTask("tenant-1", "task-2", { maxConcurrentWorkflows: 1 });

  assert.equal(decision.admitted, false);
  assert.ok(decision.waitReason !== undefined);
  assert.ok(
    decision.waitReason!.includes("Workflow limit") ||
    decision.waitReason!.includes("limit")
  );
});

test("FairScheduler multiple tasks admitted in sequence", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);
  scheduler.registerTenant("tenant-1", 1.0, {
    maxConcurrentWorkflows: 20,
    maxConcurrentWorkers: 10,
    llmTokensPerMinute: 20000,
    llmRequestsPerMinute: 200,
  });

  const results = [];
  for (let i = 0; i < 5; i++) {
    results.push(
      scheduler.admitTask("tenant-1", `task-${i}`, { maxConcurrentWorkflows: 2 })
    );
  }

  assert.equal(results.every((r) => r.admitted), true);
});

test("FairScheduler getAllUtilization with multiple tenants", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);
  scheduler.registerTenant("tenant-1", 1.0, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  scheduler.registerTenant("tenant-2", 1.0, {
    maxConcurrentWorkflows: 20,
    maxConcurrentWorkers: 10,
    llmTokensPerMinute: 20000,
    llmRequestsPerMinute: 200,
  });

  scheduler.registerTenant("tenant-3", 1.0, {
    maxConcurrentWorkflows: 15,
    maxConcurrentWorkers: 8,
    llmTokensPerMinute: 15000,
    llmRequestsPerMinute: 150,
  });

  const utilization = scheduler.getAllUtilization();
  assert.equal(utilization.length, 3);
  assert.ok(utilization.every((u) => u.utilizationPercent === 0));
});
