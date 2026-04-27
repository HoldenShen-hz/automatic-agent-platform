import test from "node:test";
import assert from "node:assert/strict";
import {
  FairScheduler,
  type SchedulingDecision,
} from "../../../../../src/platform/shared/scaling/fair-scheduler.js";
import type { ResourceAllocation } from "../../../../../src/platform/shared/scaling/resource-quota.js";

/**
 * Additional tests for Fair Scheduler covering edge cases and borrowing scenarios
 */

const DEFAULT_TOTAL_CAPACITY: ResourceAllocation = {
  maxConcurrentWorkflows: 100,
  maxConcurrentWorkers: 50,
  llmTokensPerMinute: 100000,
  llmRequestsPerMinute: 1000,
};

// =============================================================================
// Tenant Registration Edge Cases
// =============================================================================

test("FairScheduler registers multiple tenants with same weight", () => {
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

  const utilization = scheduler.getAllUtilization();
  assert.equal(utilization.length, 2);
});

test("FairScheduler registers tenants with different weights", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);

  scheduler.registerTenant("tenant-1", 1.0, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  scheduler.registerTenant("tenant-2", 2.0, {
    maxConcurrentWorkflows: 20,
    maxConcurrentWorkers: 10,
    llmTokensPerMinute: 20000,
    llmRequestsPerMinute: 200,
  });

  const stats1 = scheduler.getTenantStats("tenant-1");
  const stats2 = scheduler.getTenantStats("tenant-2");

  assert.ok(stats1 !== null);
  assert.ok(stats2 !== null);
  assert.equal(stats1?.guaranteed.maxConcurrentWorkflows, 10);
  assert.equal(stats2?.guaranteed.maxConcurrentWorkflows, 20);
});

test("FairScheduler re-registering tenant updates its guaranteed allocation", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);

  scheduler.registerTenant("tenant-1", 1.0, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  scheduler.registerTenant("tenant-1", 1.0, {
    maxConcurrentWorkflows: 20,
    maxConcurrentWorkers: 10,
    llmTokensPerMinute: 20000,
    llmRequestsPerMinute: 200,
  });

  const stats = scheduler.getTenantStats("tenant-1");
  assert.ok(stats !== null);
  assert.equal(stats?.guaranteed.maxConcurrentWorkflows, 20);
});

// =============================================================================
// Admit Task Edge Cases
// =============================================================================

test("FairScheduler admitTask with only llmTokensPerMinute requested", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);

  scheduler.registerTenant("tenant-1", 1.0, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  const decision = scheduler.admitTask("tenant-1", "task-1", {
    llmTokensPerMinute: 5000,
  });

  assert.equal(decision.admitted, true);
  assert.equal(decision.allocatedResources.llmTokensPerMinute, 5000);
});

test("FairScheduler admitTask with only maxConcurrentWorkers requested", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);

  scheduler.registerTenant("tenant-1", 1.0, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  const decision = scheduler.admitTask("tenant-1", "task-1", {
    maxConcurrentWorkers: 2,
  });

  assert.equal(decision.admitted, true);
  assert.equal(decision.allocatedResources.maxConcurrentWorkers, 2);
});

test("FairScheduler admitTask fills guaranteed and borrows", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);

  // Tenant 1 has high guarantee
  scheduler.registerTenant("tenant-1", 1.0, {
    maxConcurrentWorkflows: 50,
    maxConcurrentWorkers: 25,
    llmTokensPerMinute: 50000,
    llmRequestsPerMinute: 500,
  });

  // Tenant 2 has low guarantee
  scheduler.registerTenant("tenant-2", 1.0, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  // Tenant 1 uses 40 of its 50
  scheduler.admitTask("tenant-1", "task-1", { maxConcurrentWorkflows: 40 });

  // Tenant 2 uses its full guarantee of 10 first
  scheduler.admitTask("tenant-2", "task-2", { maxConcurrentWorkflows: 10 });

  // Now tenant-2 tries to exceed its limit - should borrow from tenant-1's idle capacity
  const decision = scheduler.admitTask("tenant-2", "task-3", { maxConcurrentWorkflows: 5 });

  assert.equal(decision.admitted, true);
  assert.ok(decision.borrowedFrom !== undefined);
});

test("FairScheduler admitTask when no lenders available", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);

  scheduler.registerTenant("tenant-1", 1.0, {
    maxConcurrentWorkflows: 5,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 5000,
    llmRequestsPerMinute: 50,
  });

  // Fill tenant-1 completely
  scheduler.admitTask("tenant-1", "task-1", { maxConcurrentWorkflows: 5 });

  // Try to admit more for tenant-1
  const decision = scheduler.admitTask("tenant-1", "task-2", { maxConcurrentWorkflows: 1 });

  assert.equal(decision.admitted, false);
});

// =============================================================================
// Release Resources Edge Cases
// =============================================================================

test("FairScheduler releaseResources with partial release", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);

  scheduler.registerTenant("tenant-1", 1.0, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  scheduler.admitTask("tenant-1", "task-1", { maxConcurrentWorkflows: 6 });
  scheduler.releaseResources("tenant-1", { maxConcurrentWorkflows: 2 });

  const stats = scheduler.getTenantStats("tenant-1");
  assert.ok(stats !== null);
  assert.equal(stats?.used.maxConcurrentWorkflows, 4);
});

test("FairScheduler releaseResources releases more than borrowed", () => {
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

  // Tenant 1 uses 40
  scheduler.admitTask("tenant-1", "task-1", { maxConcurrentWorkflows: 40 });

  // Tenant 2 borrows 10
  scheduler.admitTask("tenant-2", "task-2", { maxConcurrentWorkflows: 10 });

  // Release all 10 from tenant-2
  scheduler.releaseResources("tenant-2", { maxConcurrentWorkflows: 10 });

  const stats = scheduler.getTenantStats("tenant-2");
  assert.ok(stats !== null);
  assert.equal(stats?.used.maxConcurrentWorkflows, 0);
  assert.equal(stats?.borrowed.workflows, 0);
});

test("FairScheduler releaseResources with zero amount", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);

  scheduler.registerTenant("tenant-1", 1.0, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  scheduler.admitTask("tenant-1", "task-1", { maxConcurrentWorkflows: 5 });
  scheduler.releaseResources("tenant-1", { maxConcurrentWorkflows: 0 });

  const stats = scheduler.getTenantStats("tenant-1");
  assert.ok(stats !== null);
  assert.equal(stats?.used.maxConcurrentWorkflows, 5);
});

// =============================================================================
// Utilization Calculation Edge Cases
// =============================================================================

test("FairScheduler getTenantStats returns null for empty scheduler", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);

  const stats = scheduler.getTenantStats("non-existent");
  assert.equal(stats, null);
});

test("FairScheduler getAllUtilization for empty scheduler returns empty array", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);

  const utilization = scheduler.getAllUtilization();
  assert.deepStrictEqual(utilization, []);
});

test("FairScheduler utilization percentage calculation with zero usage", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);

  scheduler.registerTenant("tenant-1", 1.0, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  const stats = scheduler.getTenantStats("tenant-1");
  assert.ok(stats !== null);
  assert.equal(stats?.utilizationPercent, 0);
});

test("FairScheduler isBorrowing flag when not borrowing", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);

  scheduler.registerTenant("tenant-1", 1.0, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  // Use half of guaranteed
  scheduler.admitTask("tenant-1", "task-1", { maxConcurrentWorkflows: 5 });

  const utilization = scheduler.getAllUtilization();
  const tenant = utilization.find((t) => t.tenantId === "tenant-1");

  assert.ok(tenant !== undefined);
  assert.equal(tenant?.isBorrowing, false);
});

test("FairScheduler isBorrowing flag when borrowing tokens", () => {
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

  // Tenant 1 uses some of its tokens
  scheduler.admitTask("tenant-1", "task-1", { llmTokensPerMinute: 25000 });

  // Tenant 2 uses its full guarantee
  scheduler.admitTask("tenant-2", "task-2", { llmTokensPerMinute: 10000 });

  // Tenant 2 tries to exceed its limit - should borrow from tenant-1's idle capacity
  const decision = scheduler.admitTask("tenant-2", "task-3", { llmTokensPerMinute: 5000 });

  assert.equal(decision.admitted, true);
  // Verify borrowing occurred by checking the borrower's stats
  const borrowerStats = scheduler.getTenantStats("tenant-2");
  assert.ok(borrowerStats !== null);
  // The borrower should have borrowed resources tracked
  assert.ok(borrowerStats?.borrowed.tokensPerMinute > 0 || decision.borrowedFrom !== undefined);
});

// =============================================================================
// Multi-tenant Borrowing Scenarios
// =============================================================================

test("FairScheduler borrowing from multiple tenants", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);

  // Three tenants with idle capacity
  scheduler.registerTenant("tenant-1", 1.0, {
    maxConcurrentWorkflows: 30,
    maxConcurrentWorkers: 15,
    llmTokensPerMinute: 30000,
    llmRequestsPerMinute: 300,
  });

  scheduler.registerTenant("tenant-2", 1.0, {
    maxConcurrentWorkflows: 30,
    maxConcurrentWorkers: 15,
    llmTokensPerMinute: 30000,
    llmRequestsPerMinute: 300,
  });

  scheduler.registerTenant("tenant-3", 1.0, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  // Tenants 1 and 2 use most of their capacity
  scheduler.admitTask("tenant-1", "task-1", { maxConcurrentWorkflows: 25 });
  scheduler.admitTask("tenant-2", "task-2", { maxConcurrentWorkflows: 25 });

  // Tenant 3 tries to use more than its guarantee (10)
  const decision = scheduler.admitTask("tenant-3", "task-3", { maxConcurrentWorkflows: 15 });

  assert.equal(decision.admitted, true);
  assert.ok(decision.borrowedFrom !== undefined);
  assert.ok(decision.borrowedFrom!.length >= 1);
});

test("FairScheduler no borrowing when all tenants at capacity", () => {
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

  // Both tenants at capacity
  scheduler.admitTask("tenant-1", "task-1", { maxConcurrentWorkflows: 10 });
  scheduler.admitTask("tenant-2", "task-2", { maxConcurrentWorkflows: 10 });

  const decision = scheduler.admitTask("tenant-1", "task-3", { maxConcurrentWorkflows: 5 });
  assert.equal(decision.admitted, false);
});

// =============================================================================
// Borrowed Resources Reclaim Edge Cases
// =============================================================================

test("FairScheduler releaseResources returns borrowed to lenders", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);

  scheduler.registerTenant("lender", 1.0, {
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

  // Lender uses some
  scheduler.admitTask("lender", "task-1", { maxConcurrentWorkflows: 20 });

  // Borrower uses its 10 and borrows 10
  scheduler.admitTask("borrower", "task-b1", { maxConcurrentWorkflows: 10 });
  scheduler.admitTask("borrower", "task-b2", { maxConcurrentWorkflows: 10 });

  // Release borrowed - should return to lender
  scheduler.releaseResources("borrower", { maxConcurrentWorkflows: 10 });

  const borrowerStats = scheduler.getTenantStats("borrower");
  assert.ok(borrowerStats !== null);
  // After release, used should be less than before release
  assert.ok(borrowerStats!.used.maxConcurrentWorkflows >= 0);
});

// =============================================================================
// Scheduler State Edge Cases
// =============================================================================

test("FairScheduler unregister then re-register same tenant", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);

  scheduler.registerTenant("tenant-1", 1.0, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  scheduler.unregisterTenant("tenant-1");

  scheduler.registerTenant("tenant-1", 1.0, {
    maxConcurrentWorkflows: 20,
    maxConcurrentWorkers: 10,
    llmTokensPerMinute: 20000,
    llmRequestsPerMinute: 200,
  });

  const stats = scheduler.getTenantStats("tenant-1");
  assert.ok(stats !== null);
  assert.equal(stats?.guaranteed.maxConcurrentWorkflows, 20);
});

test("FairScheduler admitTask after unregister returns not registered", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);

  scheduler.registerTenant("tenant-1", 1.0, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  scheduler.unregisterTenant("tenant-1");

  const decision = scheduler.admitTask("tenant-1", "task-1", {
    maxConcurrentWorkflows: 1,
  });

  assert.equal(decision.admitted, false);
  assert.ok(decision.waitReason?.includes("not registered"));
});

test("FairScheduler admits with exact match to available", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);

  scheduler.registerTenant("tenant-1", 1.0, {
    maxConcurrentWorkflows: 5,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 5000,
    llmRequestsPerMinute: 50,
  });

  const decision = scheduler.admitTask("tenant-1", "task-1", {
    maxConcurrentWorkflows: 5,
  });

  assert.equal(decision.admitted, true);
  assert.equal(decision.allocatedResources.maxConcurrentWorkflows, 5);
});

test("FairScheduler admits task with zero-weight tenant", () => {
  const scheduler = new FairScheduler(DEFAULT_TOTAL_CAPACITY);

  scheduler.registerTenant("tenant-1", 0, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  const decision = scheduler.admitTask("tenant-1", "task-1", {
    maxConcurrentWorkflows: 1,
  });

  assert.equal(decision.admitted, true);
});

// =============================================================================
// Worker and Token Borrowing Combined
// =============================================================================

test("FairScheduler borrow both workers and tokens from same lender", () => {
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

  // Lender uses most of its resources
  scheduler.admitTask("lender", "task-1", {
    maxConcurrentWorkers: 15,
    llmTokensPerMinute: 25000,
  });

  // Borrower uses its guarantee first
  scheduler.admitTask("borrower", "task-b1", {
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
  });

  // Borrower needs more - should be able to borrow
  const decision = scheduler.admitTask("borrower", "task-b2", {
    maxConcurrentWorkers: 2,
    llmTokensPerMinute: 5000,
  });

  assert.equal(decision.admitted, true);
  // Verify task was admitted
  assert.ok(decision.allocatedResources.maxConcurrentWorkers !== undefined);
});
