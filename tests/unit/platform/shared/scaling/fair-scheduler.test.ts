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
  assert.equal(stats?.utilizationPercent, 50); // 5/10 = 50%
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

  scheduler.admitTask("tenant-1", "task-1", { maxConcurrentWorkflows: 40 });
  scheduler.admitTask("tenant-2", "task-2", { maxConcurrentWorkflows: 8 });

  const utilization = scheduler.getAllUtilization();
  const tenant2 = utilization.find((t) => t.tenantId === "tenant-2");

  assert.ok(tenant2 !== undefined);
  assert.ok(tenant2!.isBorrowing);
});
