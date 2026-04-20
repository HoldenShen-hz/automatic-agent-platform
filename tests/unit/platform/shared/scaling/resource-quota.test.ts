import test from "node:test";
import assert from "node:assert/strict";
import {
  createResourceQuota,
  canAllocate,
  calculateBurstCapacity,
  inheritQuota,
  DEFAULT_RESOURCE_ALLOCATION,
  type ResourceQuota,
  type ResourceAllocation,
  type QuotaUsage,
} from "../../../../../src/platform/shared/scaling/resource-quota.js";

test("createResourceQuota creates with default values", () => {
  const quota = createResourceQuota("org-1");

  assert.equal(quota.orgNodeId, "org-1");
  assert.equal(quota.guaranteed.maxConcurrentWorkflows, 10);
  assert.equal(quota.burstable.maxConcurrentWorkflows, 10);
  assert.equal(quota.maxLimit.maxConcurrentWorkflows, 10);
});

test("createResourceQuota applies overrides", () => {
  const quota = createResourceQuota("org-1", {
    guaranteed: { maxConcurrentWorkflows: 20 },
    maxLimit: { maxConcurrentWorkflows: 50 },
  });

  assert.equal(quota.guaranteed.maxConcurrentWorkflows, 20);
  assert.equal(quota.maxLimit.maxConcurrentWorkflows, 50);
});

test("canAllocate admits within guaranteed limits", () => {
  const quota = createResourceQuota("org-1", {
    guaranteed: { maxConcurrentWorkflows: 5, llmTokensPerMinute: 5000 },
    burstable: { maxConcurrentWorkflows: 10, llmTokensPerMinute: 10000 },
    maxLimit: { maxConcurrentWorkflows: 20, llmTokensPerMinute: 20000 },
  });

  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 2,
    activeWorkers: 1,
    llmTokensUsedLastMinute: 1000,
    llmRequestsUsedLastMinute: 10,
  };

  const result = canAllocate(quota, usage, { maxConcurrentWorkflows: 1 });

  assert.equal(result.admitted, true);
  assert.equal(result.reason, "Within quota limits");
});

test("canAllocate rejects exceeding maxLimit", () => {
  const quota = createResourceQuota("org-1", {
    guaranteed: { maxConcurrentWorkflows: 5 },
    burstable: { maxConcurrentWorkflows: 10 },
    maxLimit: { maxConcurrentWorkflows: 20 },
  });

  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 19,
    activeWorkers: 5,
    llmTokensUsedLastMinute: 5000,
    llmRequestsUsedLastMinute: 30,
  };

  const result = canAllocate(quota, usage, { maxConcurrentWorkflows: 2 });

  assert.equal(result.admitted, false);
  assert.equal(result.rejectedDueTo, "maxConcurrentWorkflows");
});

test("canAllocate rejects exceeding burstable but within maxLimit", () => {
  const quota = createResourceQuota("org-1", {
    guaranteed: { maxConcurrentWorkflows: 5 },
    burstable: { maxConcurrentWorkflows: 10 },
    maxLimit: { maxConcurrentWorkflows: 20 },
  });

  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 9,
    activeWorkers: 5,
    llmTokensUsedLastMinute: 5000,
    llmRequestsUsedLastMinute: 30,
  };

  const result = canAllocate(quota, usage, { maxConcurrentWorkflows: 2 });

  assert.equal(result.admitted, false);
  assert.equal(result.rejectedDueTo, "maxConcurrentWorkflows");
  assert.ok(result.reason.includes("burstable"));
});

test("canAllocate checks LLM token limits", () => {
  const quota = createResourceQuota("org-1", {
    maxLimit: { llmTokensPerMinute: 10000 },
  });

  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 0,
    activeWorkers: 0,
    llmTokensUsedLastMinute: 9000,
    llmRequestsUsedLastMinute: 0,
  };

  const result = canAllocate(quota, usage, { llmTokensPerMinute: 2000 });

  assert.equal(result.admitted, false);
  assert.equal(result.rejectedDueTo, "llmTokensPerMinute");
});

test("canAllocate returns available quota", () => {
  const quota = createResourceQuota("org-1", {
    maxLimit: { maxConcurrentWorkflows: 20, llmTokensPerMinute: 10000 },
  });

  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 5,
    activeWorkers: 2,
    llmTokensUsedLastMinute: 3000,
    llmRequestsUsedLastMinute: 20,
  };

  const result = canAllocate(quota, usage, { maxConcurrentWorkflows: 1 });

  assert.equal(result.admitted, true);
  assert.equal(result.availableQuota.maxConcurrentWorkflows, 15);
  assert.equal(result.availableQuota.llmTokensPerMinute, 7000);
});

test("calculateBurstCapacity returns correct capacity", () => {
  const quota = createResourceQuota("org-1", {
    guaranteed: { maxConcurrentWorkflows: 5 },
    burstable: { maxConcurrentWorkflows: 10 },
  });

  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 3,
    activeWorkers: 2,
    llmTokensUsedLastMinute: 1000,
    llmRequestsUsedLastMinute: 10,
  };

  const capacity = calculateBurstCapacity(quota, usage);

  // burstable (10) - min(guaranteed_used 3, guaranteed_limit 5) = 7
  assert.equal(capacity.maxConcurrentWorkflows, 7);
});

test("inheritQuota scales parent quota", () => {
  const parent = createResourceQuota("parent-org", {
    guaranteed: { maxConcurrentWorkflows: 10, llmTokensPerMinute: 10000 },
    burstable: { maxConcurrentWorkflows: 20, llmTokensPerMinute: 20000 },
    maxLimit: { maxConcurrentWorkflows: 40, llmTokensPerMinute: 40000 },
  });

  const child = inheritQuota(parent, 0.5);

  assert.equal(child.guaranteed.maxConcurrentWorkflows, 5);
  assert.equal(child.burstable.maxConcurrentWorkflows, 10);
  assert.equal(child.maxLimit.maxConcurrentWorkflows, 20);
  assert.equal(child.guaranteed.llmTokensPerMinute, 5000);
});

test("inheritQuota uses minimum of 1", () => {
  const parent = createResourceQuota("parent-org", {
    guaranteed: { maxConcurrentWorkflows: 1 },
  });

  const child = inheritQuota(parent, 0.1);

  // Math.max(1, Math.floor(1 * 0.1)) = Math.max(1, 0) = 1
  assert.equal(child.guaranteed.maxConcurrentWorkflows, 1);
});

test("DEFAULT_RESOURCE_ALLOCATION has correct values", () => {
  assert.equal(DEFAULT_RESOURCE_ALLOCATION.maxConcurrentWorkflows, 10);
  assert.equal(DEFAULT_RESOURCE_ALLOCATION.maxConcurrentWorkers, 5);
  assert.equal(DEFAULT_RESOURCE_ALLOCATION.llmTokensPerMinute, 10000);
  assert.equal(DEFAULT_RESOURCE_ALLOCATION.llmRequestsPerMinute, 60);
});
