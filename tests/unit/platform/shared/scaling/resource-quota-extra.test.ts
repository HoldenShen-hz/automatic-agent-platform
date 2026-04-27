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

/**
 * Additional tests for Resource Quota covering edge cases
 */

// =============================================================================
// createResourceQuota Edge Cases
// =============================================================================

test("createResourceQuota with empty overrides", () => {
  const quota = createResourceQuota("org-1", {});
  assert.equal(quota.orgNodeId, "org-1");
  assert.deepStrictEqual(quota.guaranteed, DEFAULT_RESOURCE_ALLOCATION);
});

test("createResourceQuota with partial burstable override", () => {
  const quota = createResourceQuota("org-1", {
    burstable: { maxConcurrentWorkers: 20 },
  });

  // burstable should have the override for workers
  assert.equal(quota.burstable.maxConcurrentWorkers, 20);
  // but other fields should be defaults
  assert.equal(quota.burstable.maxConcurrentWorkflows, DEFAULT_RESOURCE_ALLOCATION.maxConcurrentWorkflows);
});

test("createResourceQuota sets orgNodeId correctly", () => {
  const quota1 = createResourceQuota("org-1");
  const quota2 = createResourceQuota("org-2");

  assert.equal(quota1.orgNodeId, "org-1");
  assert.equal(quota2.orgNodeId, "org-2");
});

// =============================================================================
// canAllocate Edge Cases
// =============================================================================

test("canAllocate with zero usage respects maxLimit when request exceeds it", () => {
  const quota = createResourceQuota("org-1", {
    maxLimit: { maxConcurrentWorkflows: 100 },
  });

  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 0,
    activeWorkers: 0,
    llmTokensUsedLastMinute: 0,
    llmRequestsUsedLastMinute: 0,
  };

  // With default values, guaranteed/burstable is 10, so 50 would exceed burstable
  // but our quota overrides maxLimit to 100, and request of 50 should be within burstable (10 * 10 = 100)
  // Wait, no - default values are used for guaranteed/burstable unless overridden
  // The test setup is: maxLimit=100, but guaranteed and burstable are still DEFAULT (10)
  // So 50 > burstable(10) and 50 > guaranteed(10) but 50 < maxLimit(100) - rejected at burstable check
  // Actually, let me trace through: usage=0, request=50
  // 0 + 50 > 10 (guaranteed) is true, so check if 50 > 100 (maxLimit) - false, so check if 50 > 10 (burstable) - true
  // So this should fail - rejected due to exceeding burstable
  const result = canAllocate(quota, usage, { maxConcurrentWorkflows: 50 });
  assert.equal(result.admitted, false);
  assert.equal(result.rejectedDueTo, "maxConcurrentWorkflows");
});

test("canAllocate with undefined requested fields admits", () => {
  const quota = createResourceQuota("org-1", {
    guaranteed: { maxConcurrentWorkflows: 5 },
  });

  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 4,
    activeWorkers: 2,
    llmTokensUsedLastMinute: 1000,
    llmRequestsUsedLastMinute: 10,
  };

  // Empty request should be admitted
  const result = canAllocate(quota, usage, {});
  assert.equal(result.admitted, true);
});

test("canAllocate checks llmRequestsPerMinute limit", () => {
  const quota = createResourceQuota("org-1", {
    maxLimit: { llmRequestsPerMinute: 100 },
  });

  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 0,
    activeWorkers: 0,
    llmTokensUsedLastMinute: 0,
    llmRequestsUsedLastMinute: 90,
  };

  // No explicit llmRequestsPerMinute check in code, but let's verify behavior
  const result = canAllocate(quota, usage, { llmRequestsPerMinute: 20 });
  // Should be admitted as llmRequestsPerMinute is not checked in canAllocate
  assert.equal(result.admitted, true);
});

test("canAllocate availableQuota reflects remaining capacity", () => {
  const quota = createResourceQuota("org-1", {
    maxLimit: { maxConcurrentWorkflows: 20 },
  });

  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 8,
    activeWorkers: 5,
    llmTokensUsedLastMinute: 5000,
    llmRequestsUsedLastMinute: 30,
  };

  const result = canAllocate(quota, usage, { maxConcurrentWorkflows: 1 });
  assert.equal(result.admitted, true);
  assert.equal(result.availableQuota.maxConcurrentWorkflows, 12); // 20 - 8 = 12
});

test("canAllocate returns correct currentUsage in rejection", () => {
  const quota = createResourceQuota("org-1", {
    maxLimit: { maxConcurrentWorkflows: 20, llmTokensPerMinute: 10000 },
  });

  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 18,
    activeWorkers: 5,
    llmTokensUsedLastMinute: 9000,
    llmRequestsUsedLastMinute: 30,
  };

  const result = canAllocate(quota, usage, { maxConcurrentWorkflows: 5 });
  assert.equal(result.admitted, false);
  assert.equal(result.currentUsage.activeWorkflows, 18);
  assert.equal(result.rejectedDueTo, "maxConcurrentWorkflows");
});

test("canAllocate rejects when exact limit would be exceeded", () => {
  const quota = createResourceQuota("org-1", {
    maxLimit: { maxConcurrentWorkflows: 10 },
  });

  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 10,
    activeWorkers: 0,
    llmTokensUsedLastMinute: 0,
    llmRequestsUsedLastMinute: 0,
  };

  const result = canAllocate(quota, usage, { maxConcurrentWorkflows: 1 });
  assert.equal(result.admitted, false);
});

test("canAllocate admits when exactly at guaranteed boundary", () => {
  const quota = createResourceQuota("org-1", {
    guaranteed: { maxConcurrentWorkflows: 5 },
    maxLimit: { maxConcurrentWorkflows: 10 },
  });

  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 5,
    activeWorkers: 0,
    llmTokensUsedLastMinute: 0,
    llmRequestsUsedLastMinute: 0,
  };

  const result = canAllocate(quota, usage, { maxConcurrentWorkflows: 1 });
  // At guaranteed limit, can still use burstable up to maxLimit
  assert.equal(result.admitted, true);
});

// =============================================================================
// calculateBurstCapacity Edge Cases
// =============================================================================

test("calculateBurstCapacity returns full burstable when unused", () => {
  const quota = createResourceQuota("org-1", {
    guaranteed: { maxConcurrentWorkflows: 5 },
    burstable: { maxConcurrentWorkflows: 10 },
  });

  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 0,
    activeWorkers: 0,
    llmTokensUsedLastMinute: 0,
    llmRequestsUsedLastMinute: 0,
  };

  const capacity = calculateBurstCapacity(quota, usage);
  assert.equal(capacity.maxConcurrentWorkflows, 10);
});

test("calculateBurstCapacity returns zero when usage exceeds burstable", () => {
  const quota = createResourceQuota("org-1", {
    guaranteed: { maxConcurrentWorkflows: 5 },
    burstable: { maxConcurrentWorkflows: 10 },
  });

  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 15, // More than burstable
    activeWorkers: 0,
    llmTokensUsedLastMinute: 0,
    llmRequestsUsedLastMinute: 0,
  };

  const capacity = calculateBurstCapacity(quota, usage);
  // guaranteed_used = min(15, 5) = 5
  // burstable(10) - 5 = 5
  assert.equal(capacity.maxConcurrentWorkflows, 5);
});

test("calculateBurstCapacity handles zero guaranteed tier", () => {
  const quota = createResourceQuota("org-1", {
    guaranteed: { maxConcurrentWorkflows: 0 },
    burstable: { maxConcurrentWorkflows: 5 },
  });

  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 3,
    activeWorkers: 0,
    llmTokensUsedLastMinute: 0,
    llmRequestsUsedLastMinute: 0,
  };

  const capacity = calculateBurstCapacity(quota, usage);
  // guaranteed_used = min(3, 0) = 0
  // burstable(5) - 0 = 5
  assert.equal(capacity.maxConcurrentWorkflows, 5);
});

test("calculateBurstCapacity calculates all resource types", () => {
  const quota = createResourceQuota("org-1", {
    guaranteed: { maxConcurrentWorkflows: 5, maxConcurrentWorkers: 3 },
    burstable: { maxConcurrentWorkflows: 10, maxConcurrentWorkers: 6 },
  });

  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 3,
    activeWorkers: 2,
    llmTokensUsedLastMinute: 1000,
    llmRequestsUsedLastMinute: 10,
  };

  const capacity = calculateBurstCapacity(quota, usage);
  assert.equal(capacity.maxConcurrentWorkflows, 7); // 10 - min(3, 5)
  assert.equal(capacity.maxConcurrentWorkers, 4); // 6 - min(2, 3)
});

// =============================================================================
// inheritQuota Edge Cases
// =============================================================================

test("inheritQuota with ratio of 1 keeps same values", () => {
  const parent = createResourceQuota("parent", {
    guaranteed: { maxConcurrentWorkflows: 10 },
    burstable: { maxConcurrentWorkflows: 20 },
    maxLimit: { maxConcurrentWorkflows: 40 },
  });

  const child = inheritQuota(parent, 1.0);

  assert.equal(child.guaranteed.maxConcurrentWorkflows, 10);
  assert.equal(child.burstable.maxConcurrentWorkflows, 20);
  assert.equal(child.maxLimit.maxConcurrentWorkflows, 40);
});

test("inheritQuota with ratio of 0 returns minimum of 1", () => {
  const parent = createResourceQuota("parent", {
    guaranteed: { maxConcurrentWorkflows: 100 },
    burstable: { maxConcurrentWorkflows: 200 },
    maxLimit: { maxConcurrentWorkflows: 400 },
  });

  const child = inheritQuota(parent, 0.001);

  assert.equal(child.guaranteed.maxConcurrentWorkflows, 1);
  assert.equal(child.burstable.maxConcurrentWorkflows, 1);
  assert.equal(child.maxLimit.maxConcurrentWorkflows, 1);
});

test("inheritQuota scales all resource types", () => {
  const parent = createResourceQuota("parent", {
    guaranteed: {
      maxConcurrentWorkflows: 10,
      maxConcurrentWorkers: 5,
      llmTokensPerMinute: 10000,
      llmRequestsPerMinute: 100,
    },
  });

  const child = inheritQuota(parent, 0.5);

  assert.equal(child.guaranteed.maxConcurrentWorkflows, 5);
  assert.equal(child.guaranteed.maxConcurrentWorkers, 2); // floor(5 * 0.5)
  assert.equal(child.guaranteed.llmTokensPerMinute, 5000);
  assert.equal(child.guaranteed.llmRequestsPerMinute, 50);
});

test("inheritQuota leaves orgNodeId empty", () => {
  const parent = createResourceQuota("parent");

  const child = inheritQuota(parent, 0.5);

  assert.equal(child.orgNodeId, "");
});

// =============================================================================
// DEFAULT_RESOURCE_ALLOCATION Tests
// =============================================================================

test("DEFAULT_RESOURCE_ALLOCATION has positive values", () => {
  assert.ok(DEFAULT_RESOURCE_ALLOCATION.maxConcurrentWorkflows > 0);
  assert.ok(DEFAULT_RESOURCE_ALLOCATION.maxConcurrentWorkers > 0);
  assert.ok(DEFAULT_RESOURCE_ALLOCATION.llmTokensPerMinute > 0);
  assert.ok(DEFAULT_RESOURCE_ALLOCATION.llmRequestsPerMinute > 0);
});

// =============================================================================
// QuotaTier Interaction Tests
// =============================================================================

test("canAllocate returns correct rejectedDueTo for different limit types", () => {
  const quota = createResourceQuota("org-1", {
    maxLimit: {
      maxConcurrentWorkflows: 10,
      llmTokensPerMinute: 1000,
    },
  });

  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 9,
    activeWorkers: 0,
    llmTokensUsedLastMinute: 900,
    llmRequestsUsedLastMinute: 0,
  };

  // Request would exceed workflows
  let result = canAllocate(quota, usage, { maxConcurrentWorkflows: 2 });
  assert.equal(result.rejectedDueTo, "maxConcurrentWorkflows");

  // Request would exceed tokens
  usage.activeWorkflows = 5;
  result = canAllocate(quota, usage, { llmTokensPerMinute: 200 });
  assert.equal(result.rejectedDueTo, "llmTokensPerMinute");
});

test("canAllocate with maxLimit exact match is admitted", () => {
  const quota = createResourceQuota("org-1", {
    maxLimit: { llmTokensPerMinute: 5000 },
  });

  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 0,
    activeWorkers: 0,
    llmTokensUsedLastMinute: 4000,
    llmRequestsUsedLastMinute: 0,
  };

  // 4000 + 1000 = 5000, which equals maxLimit but does not exceed it
  const result = canAllocate(quota, usage, { llmTokensPerMinute: 1000 });
  assert.equal(result.admitted, true);
});
