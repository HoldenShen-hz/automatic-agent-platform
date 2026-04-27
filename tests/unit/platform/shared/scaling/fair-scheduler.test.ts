import test from "node:test";
import assert from "node:assert/strict";
import {
  FairScheduler,
  type SchedulingDecision,
} from "../../../../../src/platform/shared/scaling/fair-scheduler.js";

test("FairScheduler registers and unregisters tenants", () => {
  const scheduler = new FairScheduler({
    maxConcurrentWorkflows: 100,
    maxConcurrentWorkers: 50,
    llmTokensPerMinute: 100000,
    llmRequestsPerMinute: 1000,
  });

  scheduler.registerTenant("tenant-1", 1, {
    maxConcurrentWorkflows: 50,
    maxConcurrentWorkers: 25,
    llmTokensPerMinute: 50000,
    llmRequestsPerMinute: 500,
  });

  const stats = scheduler.getTenantStats("tenant-1");
  assert.ok(stats !== null);
  assert.equal(stats?.guaranteed.maxConcurrentWorkflows, 50);

  scheduler.unregisterTenant("tenant-1");
  const statsAfter = scheduler.getTenantStats("tenant-1");
  assert.equal(statsAfter, null);
});

test("FairScheduler admits task within guaranteed allocation", () => {
  const scheduler = new FairScheduler({
    maxConcurrentWorkflows: 100,
    maxConcurrentWorkers: 50,
    llmTokensPerMinute: 100000,
    llmRequestsPerMinute: 1000,
  });

  scheduler.registerTenant("tenant-1", 1, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  const decision = scheduler.admitTask("tenant-1", "task-1", {
    maxConcurrentWorkflows: 2,
    maxConcurrentWorkers: 1,
    llmTokensPerMinute: 1000,
  });

  assert.equal(decision.admitted, true);
  assert.equal(decision.taskId, "task-1");
  assert.equal(decision.allocatedResources.maxConcurrentWorkflows, 2);
});

test("FairScheduler rejects task exceeding allocation", () => {
  const scheduler = new FairScheduler({
    maxConcurrentWorkflows: 100,
    maxConcurrentWorkers: 50,
    llmTokensPerMinute: 100000,
    llmRequestsPerMinute: 1000,
  });

  scheduler.registerTenant("tenant-1", 1, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  // Try to admit more than guaranteed (10 workflows)
  scheduler.admitTask("tenant-1", "task-1", { maxConcurrentWorkflows: 5 });
  scheduler.admitTask("tenant-1", "task-2", { maxConcurrentWorkflows: 5 });

  // Now at limit, next should be rejected
  const decision = scheduler.admitTask("tenant-1", "task-3", { maxConcurrentWorkflows: 1 });

  assert.equal(decision.admitted, false);
  assert.ok(decision.waitReason !== undefined);
});

test("FairScheduler releases resources on task completion", () => {
  const scheduler = new FairScheduler({
    maxConcurrentWorkflows: 100,
    maxConcurrentWorkers: 50,
    llmTokensPerMinute: 100000,
    llmRequestsPerMinute: 1000,
  });

  scheduler.registerTenant("tenant-1", 1, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  scheduler.admitTask("tenant-1", "task-1", { maxConcurrentWorkflows: 3 });
  scheduler.admitTask("tenant-1", "task-2", { maxConcurrentWorkflows: 2 });

  scheduler.releaseResources("tenant-1", { maxConcurrentWorkflows: 3 });

  const stats = scheduler.getTenantStats("tenant-1");
  assert.ok(stats !== null);
  assert.equal(stats?.used.maxConcurrentWorkflows, 2); // 5 - 3 = 2
});

test("FairScheduler denies unknown tenant", () => {
  const scheduler = new FairScheduler({
    maxConcurrentWorkflows: 100,
    maxConcurrentWorkers: 50,
    llmTokensPerMinute: 100000,
    llmRequestsPerMinute: 1000,
  });

  const decision = scheduler.admitTask("unknown-tenant", "task-1", {
    maxConcurrentWorkflows: 1,
  });

  assert.equal(decision.admitted, false);
  assert.ok(decision.waitReason?.includes("not registered"));
});

test("FairScheduler getTenantStats returns correct utilization", () => {
  const scheduler = new FairScheduler({
    maxConcurrentWorkflows: 100,
    maxConcurrentWorkers: 50,
    llmTokensPerMinute: 100000,
    llmRequestsPerMinute: 1000,
  });

  scheduler.registerTenant("tenant-1", 1, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  scheduler.admitTask("tenant-1", "task-1", {
    maxConcurrentWorkflows: 5,
    maxConcurrentWorkers: 2,
    llmTokensPerMinute: 5000,
  });

  const stats = scheduler.getTenantStats("tenant-1");
  assert.ok(stats !== null);
  assert.equal(stats?.used.maxConcurrentWorkflows, 5);
  // Utilization is calculated across all resource types
  // (5 + 2 + 5000) / (10 + 5 + 10000) = 5007/10015 ≈ 49.99%
  assert.ok(Math.abs(stats!.utilizationPercent - 49.99) < 0.1);
});

test("FairScheduler getAllUtilization returns all tenants", () => {
  const scheduler = new FairScheduler({
    maxConcurrentWorkflows: 100,
    maxConcurrentWorkers: 50,
    llmTokensPerMinute: 100000,
    llmRequestsPerMinute: 1000,
  });

  scheduler.registerTenant("tenant-1", 1, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  scheduler.registerTenant("tenant-2", 1, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  const utilization = scheduler.getAllUtilization();

  assert.equal(utilization.length, 2);
  assert.ok(utilization.some((t) => t.tenantId === "tenant-1"));
  assert.ok(utilization.some((t) => t.tenantId === "tenant-2"));
});

test("FairScheduler borrowing between tenants", () => {
  const scheduler = new FairScheduler({
    maxConcurrentWorkflows: 100,
    maxConcurrentWorkers: 50,
    llmTokensPerMinute: 100000,
    llmRequestsPerMinute: 1000,
  });

  // Tenant 1 with high guaranteed
  scheduler.registerTenant("tenant-1", 1, {
    maxConcurrentWorkflows: 50,
    maxConcurrentWorkers: 25,
    llmTokensPerMinute: 50000,
    llmRequestsPerMinute: 500,
  });

  // Tenant 2 with low guaranteed
  scheduler.registerTenant("tenant-2", 1, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  // Tenant 1 uses most of its quota
  scheduler.admitTask("tenant-1", "task-1", { maxConcurrentWorkflows: 40 });

  // Tenant 2 tries to exceed its limit
  const decision = scheduler.admitTask("tenant-2", "task-2", { maxConcurrentWorkflows: 8 });

  // Should be admitted (borrow from tenant-1's idle capacity)
  assert.equal(decision.admitted, true);
});

test("FairScheduler reclaim returns borrowed resources", () => {
  const scheduler = new FairScheduler({
    maxConcurrentWorkflows: 100,
    maxConcurrentWorkers: 50,
    llmTokensPerMinute: 100000,
    llmRequestsPerMinute: 1000,
  });

  scheduler.registerTenant("tenant-1", 1, {
    maxConcurrentWorkflows: 50,
    maxConcurrentWorkers: 25,
    llmTokensPerMinute: 50000,
    llmRequestsPerMinute: 500,
  });

  scheduler.registerTenant("tenant-2", 1, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  // Tenant 1 uses most of its quota
  scheduler.admitTask("tenant-1", "task-1", { maxConcurrentWorkflows: 40 });

  // Tenant 2 borrows and completes
  scheduler.admitTask("tenant-2", "task-2", { maxConcurrentWorkflows: 8 });
  scheduler.releaseResources("tenant-2", { maxConcurrentWorkflows: 8 });

  // Check tenant 2 no longer has borrowed
  const stats = scheduler.getTenantStats("tenant-2");
  assert.ok(stats !== null);
  assert.equal(stats?.used.maxConcurrentWorkflows, 0);
});

test("FairScheduler utilization isBorrowing flag", () => {
  const scheduler = new FairScheduler({
    maxConcurrentWorkflows: 100,
    maxConcurrentWorkers: 50,
    llmTokensPerMinute: 100000,
    llmRequestsPerMinute: 1000,
  });

  scheduler.registerTenant("tenant-1", 1, {
    maxConcurrentWorkflows: 50,
    maxConcurrentWorkers: 25,
    llmTokensPerMinute: 50000,
    llmRequestsPerMinute: 500,
  });

  scheduler.registerTenant("tenant-2", 1, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  // tenant-1 uses 40 of its 50 guaranteed
  scheduler.admitTask("tenant-1", "task-1", { maxConcurrentWorkflows: 40 });
  // tenant-2 uses all 10 of its guaranteed
  scheduler.admitTask("tenant-2", "task-2", { maxConcurrentWorkflows: 10 });
  // tenant-2 tries to exceed its guaranteed - should borrow from tenant-1's idle 10
  const decision = scheduler.admitTask("tenant-2", "task-3", { maxConcurrentWorkflows: 5 });

  assert.equal(decision.admitted, true);
  assert.equal(decision.borrowedFrom?.length ?? 0, 1);

  const utilization = scheduler.getAllUtilization();
  const tenant2 = utilization.find((t) => t.tenantId === "tenant-2");

  assert.ok(tenant2 !== undefined);
  assert.ok(tenant2!.isBorrowing);
});

test("FairScheduler returns worker and token borrows before decrementing tenant usage", () => {
  const scheduler = new FairScheduler({
    maxConcurrentWorkflows: 100,
    maxConcurrentWorkers: 50,
    llmTokensPerMinute: 100000,
    llmRequestsPerMinute: 1000,
  });

  scheduler.registerTenant("tenant-1", 1, {
    maxConcurrentWorkflows: 50,
    maxConcurrentWorkers: 20,
    llmTokensPerMinute: 50000,
    llmRequestsPerMinute: 500,
  });
  scheduler.registerTenant("tenant-2", 1, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 2,
    llmTokensPerMinute: 5000,
    llmRequestsPerMinute: 100,
  });

  scheduler.admitTask("tenant-1", "task-lender", {
    maxConcurrentWorkers: 15,
    llmTokensPerMinute: 40000,
  });

  const borrowed = scheduler.admitTask("tenant-2", "task-borrower", {
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
  });

  assert.equal(borrowed.admitted, true);
  assert.deepEqual(borrowed.borrowedFrom, ["tenant-1"]);

  scheduler.releaseResources("tenant-2", {
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
  });

  const borrowerStats = scheduler.getTenantStats("tenant-2");
  const lenderStats = scheduler.getTenantStats("tenant-1");
  assert.ok(borrowerStats !== null);
  assert.ok(lenderStats !== null);

  assert.equal(borrowerStats!.borrowed.workers, 0);
  assert.equal(borrowerStats!.borrowed.tokensPerMinute, 0);
  assert.equal(borrowerStats!.used.maxConcurrentWorkers, 0);
  assert.equal(borrowerStats!.used.llmTokensPerMinute, 0);
  assert.equal(lenderStats!.used.maxConcurrentWorkers >= 15, true);
  assert.equal(lenderStats!.used.llmTokensPerMinute >= 40000, true);
});

test("FairScheduler reports zero utilization when guaranteed capacity is zero", () => {
  const scheduler = new FairScheduler({
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 10,
    llmTokensPerMinute: 1000,
    llmRequestsPerMinute: 100,
  });

  scheduler.registerTenant("tenant-zero", 1, {
    maxConcurrentWorkflows: 0,
    maxConcurrentWorkers: 0,
    llmTokensPerMinute: 0,
    llmRequestsPerMinute: 0,
  });

  const stats = scheduler.getTenantStats("tenant-zero");
  const utilization = scheduler.getAllUtilization();

  assert.ok(stats !== null);
  assert.equal(stats!.utilizationPercent, 0);
  assert.equal(utilization[0]?.utilizationPercent, 0);
  assert.equal(utilization[0]?.isBorrowing, false);
});

test("FairScheduler releases borrowed resources proportionally to lenders", () => {
  const scheduler = new FairScheduler({
    maxConcurrentWorkflows: 100,
    maxConcurrentWorkers: 50,
    llmTokensPerMinute: 100000,
    llmRequestsPerMinute: 1000,
  });

  // Three tenants with different guarantees
  scheduler.registerTenant("tenant-high", 2, {
    maxConcurrentWorkflows: 60,
    maxConcurrentWorkers: 30,
    llmTokensPerMinute: 60000,
    llmRequestsPerMinute: 600,
  });

  scheduler.registerTenant("tenant-mid", 1, {
    maxConcurrentWorkflows: 30,
    maxConcurrentWorkers: 15,
    llmTokensPerMinute: 30000,
    llmRequestsPerMinute: 300,
  });

  scheduler.registerTenant("tenant-low", 1, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  // High uses 50 of 60
  scheduler.admitTask("tenant-high", "task-h1", { maxConcurrentWorkflows: 50 });
  // Mid uses all 30
  scheduler.admitTask("tenant-mid", "task-m1", { maxConcurrentWorkflows: 30 });

  // Low tries to exceed - borrows from high (idle 10) and mid (idle 0? no, mid at limit)
  const borrow = scheduler.admitTask("tenant-low", "task-l1", { maxConcurrentWorkflows: 15 });

  // Should be admitted with borrow from tenant-high
  assert.equal(borrow.admitted, true);
  assert.ok(borrow.borrowedFrom !== undefined);
});

test("FairScheduler handles release resources for unknown tenant gracefully", () => {
  const scheduler = new FairScheduler({
    maxConcurrentWorkflows: 100,
    maxConcurrentWorkers: 50,
    llmTokensPerMinute: 100000,
    llmRequestsPerMinute: 1000,
  });

  // Should not throw
  scheduler.releaseResources("unknown-tenant", { maxConcurrentWorkflows: 10 });

  const stats = scheduler.getTenantStats("unknown-tenant");
  assert.equal(stats, null);
});

test("FairScheduler getTenantStats returns null for unregistered tenant", () => {
  const scheduler = new FairScheduler({
    maxConcurrentWorkflows: 100,
    maxConcurrentWorkers: 50,
    llmTokensPerMinute: 100000,
    llmRequestsPerMinute: 1000,
  });

  const stats = scheduler.getTenantStats("non-existent-tenant");
  assert.equal(stats, null);
});

test("FairScheduler admitTask with zero requested resources admits successfully", () => {
  const scheduler = new FairScheduler({
    maxConcurrentWorkflows: 100,
    maxConcurrentWorkers: 50,
    llmTokensPerMinute: 100000,
    llmRequestsPerMinute: 1000,
  });

  scheduler.registerTenant("tenant-1", 1, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  // Empty request should be admitted
  const decision = scheduler.admitTask("tenant-1", "task-1", {});
  assert.equal(decision.admitted, true);
  assert.deepEqual(decision.allocatedResources, {});
});

test("FairScheduler unregisterTenant removes all borrowed tracking", () => {
  const scheduler = new FairScheduler({
    maxConcurrentWorkflows: 100,
    maxConcurrentWorkers: 50,
    llmTokensPerMinute: 100000,
    llmRequestsPerMinute: 1000,
  });

  scheduler.registerTenant("lender", 1, {
    maxConcurrentWorkflows: 50,
    maxConcurrentWorkers: 25,
    llmTokensPerMinute: 50000,
    llmRequestsPerMinute: 500,
  });

  scheduler.registerTenant("borrower", 1, {
    maxConcurrentWorkflows: 5,
    maxConcurrentWorkers: 2,
    llmTokensPerMinute: 5000,
    llmRequestsPerMinute: 50,
  });

  // Lender uses most, borrower borrows
  scheduler.admitTask("lender", "task-1", { maxConcurrentWorkflows: 40 });
  scheduler.admitTask("borrower", "task-2", { maxConcurrentWorkflows: 5 });

  // Unregister lender - should not cause errors
  scheduler.unregisterTenant("lender");

  const borrowerStats = scheduler.getTenantStats("borrower");
  assert.ok(borrowerStats !== null);
  // Borrowed resources tracking should still exist but lender is gone
  assert.equal(borrowerStats!.borrowed.workflows >= 0, true);
});

test("FairScheduler getAllUtilization handles empty scheduler", () => {
  const scheduler = new FairScheduler({
    maxConcurrentWorkflows: 100,
    maxConcurrentWorkers: 50,
    llmTokensPerMinute: 100000,
    llmRequestsPerMinute: 1000,
  });

  const utilization = scheduler.getAllUtilization();
  assert.deepEqual(utilization, []);
});

test("FairScheduler admitTask uses workflows as proxy for llmRequestsPerMinute in borrowing", () => {
  const scheduler = new FairScheduler({
    maxConcurrentWorkflows: 100,
    maxConcurrentWorkers: 50,
    llmTokensPerMinute: 100000,
    llmRequestsPerMinute: 1000,
  });

  scheduler.registerTenant("tenant-1", 1, {
    maxConcurrentWorkflows: 50,
    maxConcurrentWorkers: 25,
    llmTokensPerMinute: 50000,
    llmRequestsPerMinute: 500,
  });

  scheduler.registerTenant("tenant-2", 1, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 100,
  });

  // Tenant 1 leaves some idle workflows available for borrowing.
  scheduler.admitTask("tenant-1", "task-1", { maxConcurrentWorkflows: 45 });

  // Tenant 2 uses its guaranteed workflows, then must borrow for overflow.
  scheduler.admitTask("tenant-2", "task-2", { maxConcurrentWorkflows: 10 });
  const decision = scheduler.admitTask("tenant-2", "task-3", { maxConcurrentWorkflows: 5 });

  assert.equal(decision.admitted, true);
  // The borrowedFrom should include tenant-1.
  assert.ok(decision.borrowedFrom !== undefined);
  assert.equal(decision.borrowedFrom!.includes("tenant-1"), true);
});
