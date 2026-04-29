import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ResourceAllocation,
  ResourceQuota,
  QuotaUsage,
  QuotaAllocationResult,
  DEFAULT_RESOURCE_ALLOCATION,
  createResourceQuota,
  canAllocate,
  calculateBurstCapacity,
  inheritQuota,
} from "../../../../src/platform/shared/scaling/resource-quota.js";

test("ResourceQuota - DEFAULT_RESOURCE_ALLOCATION has expected values", () => {
  assert.equal(DEFAULT_RESOURCE_ALLOCATION.maxConcurrentWorkflows, 10);
  assert.equal(DEFAULT_RESOURCE_ALLOCATION.maxConcurrentWorkers, 5);
  assert.equal(DEFAULT_RESOURCE_ALLOCATION.llmTokensPerMinute, 10000);
  assert.equal(DEFAULT_RESOURCE_ALLOCATION.llmRequestsPerMinute, 60);
});

test("ResourceQuota - createResourceQuota creates quota with defaults", () => {
  const quota = createResourceQuota("org-1");

  assert.equal(quota.orgNodeId, "org-1");
  assert.deepEqual(quota.guaranteed, DEFAULT_RESOURCE_ALLOCATION);
  assert.deepEqual(quota.burstable, DEFAULT_RESOURCE_ALLOCATION);
  assert.deepEqual(quota.maxLimit, DEFAULT_RESOURCE_ALLOCATION);
});

test("ResourceQuota - createResourceQuota applies overrides", () => {
  const quota = createResourceQuota("org-1", {
    guaranteed: { maxConcurrentWorkflows: 20 },
    burstable: { maxConcurrentWorkers: 10 },
    maxLimit: { llmTokensPerMinute: 20000 },
  });

  assert.equal(quota.guaranteed.maxConcurrentWorkflows, 20);
  assert.equal(quota.guaranteed.maxConcurrentWorkers, 5); // default
  assert.equal(quota.burstable.maxConcurrentWorkers, 10);
  assert.equal(quota.maxLimit.llmTokensPerMinute, 20000);
});

test("canAllocate - returns admitted true when within limits", () => {
  const quota = createResourceQuota("org-1");
  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 5,
    activeWorkers: 2,
    llmTokensUsedLastMinute: 5000,
    llmRequestsUsedLastMinute: 30,
  };

  const result = canAllocate(quota, usage, { maxConcurrentWorkflows: 2 });

  assert.equal(result.admitted, true);
  assert.equal(result.reason, "Within quota limits");
  assert.ok(result.availableQuota);
});

test("canAllocate - returns admitted false when exceeding max limit", () => {
  const quota = createResourceQuota("org-1");
  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 9,
    activeWorkers: 0,
    llmTokensUsedLastMinute: 0,
    llmRequestsUsedLastMinute: 0,
  };

  const result = canAllocate(quota, usage, { maxConcurrentWorkflows: 5 });

  assert.equal(result.admitted, false);
  assert.equal(result.rejectedDueTo, "maxConcurrentWorkflows");
  assert.ok(result.reason.includes("max limit"));
});

test("canAllocate - returns admitted false when exceeding burstable limit", () => {
  const quota = createResourceQuota("org-1");
  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 8,
    activeWorkers: 0,
    llmTokensUsedLastMinute: 0,
    llmRequestsUsedLastMinute: 0,
  };

  // Within max (10) but exceeds burstable (10, same as default)
  const result = canAllocate(quota, usage, { maxConcurrentWorkflows: 3 });

  // Default: burstable = 10, so 8+3=11 > 10 -> rejected due to burstable
  assert.equal(result.admitted, false);
});

test("canAllocate - LLM token limit check", () => {
  const quota = createResourceQuota("org-1");
  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 0,
    activeWorkers: 0,
    llmTokensUsedLastMinute: 9500,
    llmRequestsUsedLastMinute: 0,
  };

  const result = canAllocate(quota, usage, { llmTokensPerMinute: 1000 });

  assert.equal(result.admitted, false);
  assert.equal(result.rejectedDueTo, "llmTokensPerMinute");
  assert.ok(result.reason.includes("LLM token limit"));
});

test("canAllocate - empty requested resources returns admitted", () => {
  const quota = createResourceQuota("org-1");
  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 5,
    activeWorkers: 5,
    llmTokensUsedLastMinute: 10000,
    llmRequestsUsedLastMinute: 60,
  };

  const result = canAllocate(quota, usage, {});

  assert.equal(result.admitted, true);
});

test("calculateBurstCapacity - returns correct burst capacity", () => {
  const quota = createResourceQuota("org-1");
  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 3,  // within guaranteed (10)
    activeWorkers: 5,
    llmTokensUsedLastMinute: 3000,
    llmRequestsUsedLastMinute: 10,
  };

  const burst = calculateBurstCapacity(quota, usage);

  // burstable - guaranteedUsed
  assert.equal(burst.maxConcurrentWorkflows, quota.burstable.maxConcurrentWorkflows - 3);
  assert.equal(burst.maxConcurrentWorkers, 0); // all used
  assert.equal(burst.llmTokensPerMinute, quota.burstable.llmTokensPerMinute - 3000);
  assert.equal(burst.llmRequestsPerMinute, quota.burstable.llmRequestsPerMinute - 10);
});

test("calculateBurstCapacity - returns zeros when usage exceeds burstable", () => {
  const quota = createResourceQuota("org-1");
  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 20, // exceeds both guaranteed and burstable
    activeWorkers: 20,
    llmTokensUsedLastMinute: 20000,
    llmRequestsUsedLastMinute: 100,
  };

  const burst = calculateBurstCapacity(quota, usage);

  assert.ok(burst.maxConcurrentWorkflows <= 0);
  assert.ok(burst.maxConcurrentWorkers <= 0);
  assert.ok(burst.llmTokensPerMinute <= 0);
  assert.ok(burst.llmRequestsPerMinute <= 0);
});

test("inheritQuota - scales down parent quota", () => {
  const parentQuota: ResourceQuota = {
    orgNodeId: "parent",
    guaranteed: { maxConcurrentWorkflows: 20, maxConcurrentWorkers: 10, llmTokensPerMinute: 20000, llmRequestsPerMinute: 120 },
    burstable: { maxConcurrentWorkflows: 30, maxConcurrentWorkers: 15, llmTokensPerMinute: 30000, llmRequestsPerMinute: 180 },
    maxLimit: { maxConcurrentWorkflows: 40, maxConcurrentWorkers: 20, llmTokensPerMinute: 40000, llmRequestsPerMinute: 240 },
  };

  const childQuota = inheritQuota(parentQuota, 0.5);

  assert.notEqual(childQuota.orgNodeId, "parent"); // Child must set own ID
  assert.equal(childQuota.guaranteed.maxConcurrentWorkflows, 10); // floor(20 * 0.5)
  assert.equal(childQuota.guaranteed.maxConcurrentWorkers, 5);   // floor(10 * 0.5)
  assert.equal(childQuota.guaranteed.llmTokensPerMinute, 10000); // floor(20000 * 0.5)
  assert.equal(childQuota.guaranteed.llmRequestsPerMinute, 60);  // floor(120 * 0.5)
});

test("inheritQuota - minimum value is 1", () => {
  const parentQuota: ResourceQuota = {
    orgNodeId: "parent",
    guaranteed: { maxConcurrentWorkflows: 1, maxConcurrentWorkers: 1, llmTokensPerMinute: 1, llmRequestsPerMinute: 1 },
    burstable: { maxConcurrentWorkflows: 1, maxConcurrentWorkers: 1, llmTokensPerMinute: 1, llmRequestsPerMinute: 1 },
    maxLimit: { maxConcurrentWorkflows: 1, maxConcurrentWorkers: 1, llmTokensPerMinute: 1, llmRequestsPerMinute: 1 },
  };

  const childQuota = inheritQuota(parentQuota, 0.1);

  // All values should be at least 1
  assert.ok(childQuota.guaranteed.maxConcurrentWorkflows >= 1);
  assert.ok(childQuota.guaranteed.maxConcurrentWorkers >= 1);
  assert.ok(childQuota.guaranteed.llmTokensPerMinute >= 1);
  assert.ok(childQuota.guaranteed.llmRequestsPerMinute >= 1);
});

test("inheritQuota - default ratio is 0.5", () => {
  const parentQuota: ResourceQuota = {
    orgNodeId: "parent",
    guaranteed: { maxConcurrentWorkflows: 20, maxConcurrentWorkers: 10, llmTokensPerMinute: 20000, llmRequestsPerMinute: 120 },
    burstable: { maxConcurrentWorkflows: 30, maxConcurrentWorkers: 15, llmTokensPerMinute: 30000, llmRequestsPerMinute: 180 },
    maxLimit: { maxConcurrentWorkflows: 40, maxConcurrentWorkers: 20, llmTokensPerMinute: 40000, llmRequestsPerMinute: 240 },
  };

  const childQuota = inheritQuota(parentQuota);

  assert.equal(childQuota.guaranteed.maxConcurrentWorkflows, 10); // 20 * 0.5
});

test("QuotaAllocationResult - contains currentUsage and availableQuota", () => {
  const quota = createResourceQuota("org-1");
  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 3,
    activeWorkers: 2,
    llmTokensUsedLastMinute: 2000,
    llmRequestsUsedLastMinute: 10,
  };

  const result = canAllocate(quota, usage, { maxConcurrentWorkflows: 2 });

  assert.deepEqual(result.currentUsage, usage);
  assert.ok(result.availableQuota);
  assert.ok(result.availableQuota.maxConcurrentWorkflows >= 0);
});