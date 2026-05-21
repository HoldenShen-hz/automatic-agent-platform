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
  type QuotaAllocationResult,
} from "../../../../../src/platform/shared/scaling/resource-quota.js";

/**
 * Comprehensive tests for Resource Quota - resource-quota.ts
 * Org-level resource allocation with guaranteed, burstable, and max_limit tiers
 */

// =============================================================================
// DEFAULT_RESOURCE_ALLOCATION
// =============================================================================

test("DEFAULT_RESOURCE_ALLOCATION has all required fields", () => {
  assert.ok(DEFAULT_RESOURCE_ALLOCATION.maxConcurrentWorkflows !== undefined);
  assert.ok(DEFAULT_RESOURCE_ALLOCATION.maxConcurrentWorkers !== undefined);
  assert.ok(DEFAULT_RESOURCE_ALLOCATION.llmTokensPerMinute !== undefined);
  assert.ok(DEFAULT_RESOURCE_ALLOCATION.llmRequestsPerMinute !== undefined);
});

test("DEFAULT_RESOURCE_ALLOCATION values are positive", () => {
  assert.ok(DEFAULT_RESOURCE_ALLOCATION.maxConcurrentWorkflows > 0);
  assert.ok(DEFAULT_RESOURCE_ALLOCATION.maxConcurrentWorkers > 0);
  assert.ok(DEFAULT_RESOURCE_ALLOCATION.llmTokensPerMinute > 0);
  assert.ok(DEFAULT_RESOURCE_ALLOCATION.llmRequestsPerMinute > 0);
});

// =============================================================================
// createResourceQuota
// =============================================================================

test("createResourceQuota sets orgNodeId correctly", () => {
  const quota = createResourceQuota("org-test-123");
  assert.equal(quota.orgNodeId, "org-test-123");
});

test("createResourceQuota uses defaults when no overrides", () => {
  const quota = createResourceQuota("org-1");

  assert.equal(quota.guaranteed.maxConcurrentWorkflows, DEFAULT_RESOURCE_ALLOCATION.maxConcurrentWorkflows);
  assert.equal(quota.guaranteed.maxConcurrentWorkers, DEFAULT_RESOURCE_ALLOCATION.maxConcurrentWorkers);
  assert.equal(quota.guaranteed.llmTokensPerMinute, DEFAULT_RESOURCE_ALLOCATION.llmTokensPerMinute);
  assert.equal(quota.guaranteed.llmRequestsPerMinute, DEFAULT_RESOURCE_ALLOCATION.llmRequestsPerMinute);

  assert.equal(quota.burstable.maxConcurrentWorkflows, DEFAULT_RESOURCE_ALLOCATION.maxConcurrentWorkflows);
  assert.equal(quota.burstable.maxConcurrentWorkers, DEFAULT_RESOURCE_ALLOCATION.maxConcurrentWorkers);
  assert.equal(quota.burstable.llmTokensPerMinute, DEFAULT_RESOURCE_ALLOCATION.llmTokensPerMinute);
  assert.equal(quota.burstable.llmRequestsPerMinute, DEFAULT_RESOURCE_ALLOCATION.llmRequestsPerMinute);

  assert.equal(quota.maxLimit.maxConcurrentWorkflows, DEFAULT_RESOURCE_ALLOCATION.maxConcurrentWorkflows);
  assert.equal(quota.maxLimit.maxConcurrentWorkers, DEFAULT_RESOURCE_ALLOCATION.maxConcurrentWorkers);
  assert.equal(quota.maxLimit.llmTokensPerMinute, DEFAULT_RESOURCE_ALLOCATION.llmTokensPerMinute);
  assert.equal(quota.maxLimit.llmRequestsPerMinute, DEFAULT_RESOURCE_ALLOCATION.llmRequestsPerMinute);
});

test("createResourceQuota applies partial guaranteed override", () => {
  const quota = createResourceQuota("org-1", {
    guaranteed: { maxConcurrentWorkflows: 50 },
  });

  assert.equal(quota.guaranteed.maxConcurrentWorkflows, 50);
  assert.equal(quota.guaranteed.maxConcurrentWorkers, DEFAULT_RESOURCE_ALLOCATION.maxConcurrentWorkers);
  assert.equal(quota.guaranteed.llmTokensPerMinute, DEFAULT_RESOURCE_ALLOCATION.llmTokensPerMinute);
  assert.equal(quota.guaranteed.llmRequestsPerMinute, DEFAULT_RESOURCE_ALLOCATION.llmRequestsPerMinute);
});

test("createResourceQuota applies partial burstable override", () => {
  const quota = createResourceQuota("org-1", {
    burstable: { maxConcurrentWorkers: 100 },
  });

  assert.equal(quota.burstable.maxConcurrentWorkflows, DEFAULT_RESOURCE_ALLOCATION.maxConcurrentWorkflows);
  assert.equal(quota.burstable.maxConcurrentWorkers, 100);
});

test("createResourceQuota applies partial maxLimit override", () => {
  const quota = createResourceQuota("org-1", {
    maxLimit: { llmTokensPerMinute: 100000 },
  });

  assert.equal(quota.maxLimit.maxConcurrentWorkflows, DEFAULT_RESOURCE_ALLOCATION.maxConcurrentWorkflows);
  assert.equal(quota.maxLimit.llmTokensPerMinute, 100000);
});

test("createResourceQuota applies multiple tier overrides", () => {
  const quota = createResourceQuota("org-1", {
    guaranteed: { maxConcurrentWorkflows: 20, maxConcurrentWorkers: 10 },
    burstable: { maxConcurrentWorkflows: 40 },
    maxLimit: { llmTokensPerMinute: 50000, llmRequestsPerMinute: 500 },
  });

  assert.equal(quota.guaranteed.maxConcurrentWorkflows, 20);
  assert.equal(quota.guaranteed.maxConcurrentWorkers, 10);
  assert.equal(quota.burstable.maxConcurrentWorkflows, 40);
  assert.equal(quota.maxLimit.llmTokensPerMinute, 50000);
  assert.equal(quota.maxLimit.llmRequestsPerMinute, 500);
});

// =============================================================================
// canAllocate - Basic Cases
// =============================================================================

test("canAllocate admits when all resources within guaranteed limits", () => {
  const quota = createResourceQuota("org-1", {
    guaranteed: { maxConcurrentWorkflows: 10, maxConcurrentWorkers: 5 },
  });

  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 3,
    activeWorkers: 2,
    llmTokensUsedLastMinute: 1000,
    llmRequestsUsedLastMinute: 10,
  };

  const result = canAllocate(quota, usage, {
    maxConcurrentWorkflows: 2,
    maxConcurrentWorkers: 1,
  });

  assert.equal(result.admitted, true);
});

test("canAllocate rejects when exceeding maxLimit workflows", () => {
  const quota = createResourceQuota("org-1", {
    maxLimit: { maxConcurrentWorkflows: 10 },
  });

  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 9,
    activeWorkers: 0,
    llmTokensUsedLastMinute: 0,
    llmRequestsUsedLastMinute: 0,
  };

  const result = canAllocate(quota, usage, { maxConcurrentWorkflows: 2 });

  assert.equal(result.admitted, false);
  assert.equal(result.rejectedDueTo, "maxConcurrentWorkflows");
  assert.ok(result.reason.includes("max limit"));
});

test("canAllocate rejects when exceeding maxLimit tokens", () => {
  const quota = createResourceQuota("org-1", {
    maxLimit: { llmTokensPerMinute: 10000 },
  });

  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 0,
    activeWorkers: 0,
    llmTokensUsedLastMinute: 9500,
    llmRequestsUsedLastMinute: 0,
  };

  const result = canAllocate(quota, usage, { llmTokensPerMinute: 600 });

  assert.equal(result.admitted, false);
  assert.equal(result.rejectedDueTo, "llmTokensPerMinute");
});

test("canAllocate rejects when exceeding burstable but within maxLimit", () => {
  const quota = createResourceQuota("org-1", {
    guaranteed: { maxConcurrentWorkflows: 5 },
    burstable: { maxConcurrentWorkflows: 10 },
    maxLimit: { maxConcurrentWorkflows: 20 },
  });

  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 9,
    activeWorkers: 0,
    llmTokensUsedLastMinute: 0,
    llmRequestsUsedLastMinute: 0,
  };

  const result = canAllocate(quota, usage, { maxConcurrentWorkflows: 2 });

  assert.equal(result.admitted, false);
  assert.equal(result.rejectedDueTo, "maxConcurrentWorkflows");
  assert.ok(result.reason.includes("burstable"));
});

test("canAllocate with empty request admits successfully", () => {
  const quota = createResourceQuota("org-1", {
    guaranteed: { maxConcurrentWorkflows: 5 },
  });

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

// =============================================================================
// canAllocate - Boundary Cases
// =============================================================================

test("canAllocate at exact guaranteed boundary allows burstable usage", () => {
  const quota = createResourceQuota("org-1", {
    guaranteed: { maxConcurrentWorkflows: 5 },
    burstable: { maxConcurrentWorkflows: 10 },
    maxLimit: { maxConcurrentWorkflows: 15 },
  });

  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 5, // exactly at guaranteed
    activeWorkers: 0,
    llmTokensUsedLastMinute: 0,
    llmRequestsUsedLastMinute: 0,
  };

  const result = canAllocate(quota, usage, { maxConcurrentWorkflows: 3 });

  // Should be admitted - using burstable tier
  assert.equal(result.admitted, true);
});

test("canAllocate at exact burstable boundary rejected", () => {
  const quota = createResourceQuota("org-1", {
    guaranteed: { maxConcurrentWorkflows: 5 },
    burstable: { maxConcurrentWorkflows: 10 },
    maxLimit: { maxConcurrentWorkflows: 15 },
  });

  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 10, // exactly at burstable
    activeWorkers: 0,
    llmTokensUsedLastMinute: 0,
    llmRequestsUsedLastMinute: 0,
  };

  const result = canAllocate(quota, usage, { maxConcurrentWorkflows: 1 });

  assert.equal(result.admitted, false);
});

test("canAllocate at maxLimit boundary rejected", () => {
  const quota = createResourceQuota("org-1", {
    maxLimit: { maxConcurrentWorkflows: 10 },
  });

  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 10, // exactly at maxLimit
    activeWorkers: 0,
    llmTokensUsedLastMinute: 0,
    llmRequestsUsedLastMinute: 0,
  };

  const result = canAllocate(quota, usage, { maxConcurrentWorkflows: 1 });

  assert.equal(result.admitted, false);
});

// =============================================================================
// canAllocate - Multiple Resource Types
// =============================================================================

test("canAllocate checks multiple resource types independently", () => {
  const quota = createResourceQuota("org-1", {
    guaranteed: {
      maxConcurrentWorkflows: 10,
      maxConcurrentWorkers: 5,
      llmTokensPerMinute: 10000,
    },
  });

  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 9, // near limit
    activeWorkers: 2,
    llmTokensUsedLastMinute: 9000, // near limit
    llmRequestsUsedLastMinute: 50,
  };

  // Request that would exceed both workflows and tokens
  const result = canAllocate(quota, usage, {
    maxConcurrentWorkflows: 2,
    llmTokensPerMinute: 2000,
  });

  // Could be rejected for either resource
  assert.equal(result.admitted, false);
  assert.ok(result.rejectedDueTo === "maxConcurrentWorkflows" || result.rejectedDueTo === "llmTokensPerMinute");
});

test("canAllocate availableQuota reflects remaining capacity after allocation", () => {
  const quota = createResourceQuota("org-1", {
    maxLimit: {
      maxConcurrentWorkflows: 20,
      maxConcurrentWorkers: 10,
      llmTokensPerMinute: 20000,
      llmRequestsPerMinute: 200,
    },
  });

  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 5,
    activeWorkers: 3,
    llmTokensUsedLastMinute: 5000,
    llmRequestsUsedLastMinute: 50,
  };

  const result = canAllocate(quota, usage, { maxConcurrentWorkflows: 1 });

  assert.equal(result.admitted, true);
  assert.equal(result.availableQuota.maxConcurrentWorkflows, 15); // 20 - 5 (doesn't subtract requested)
  assert.equal(result.availableQuota.maxConcurrentWorkers, 7); // 10 - 3
  assert.equal(result.availableQuota.llmTokensPerMinute, 15000); // 20000 - 5000
  assert.equal(result.availableQuota.llmRequestsPerMinute, 150); // 200 - 50
});

// =============================================================================
// calculateBurstCapacity
// =============================================================================

test("calculateBurstCapacity with unused guaranteed returns full burstable", () => {
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

test("calculateBurstCapacity with partial guaranteed usage", () => {
  const quota = createResourceQuota("org-1", {
    guaranteed: { maxConcurrentWorkflows: 5 },
    burstable: { maxConcurrentWorkflows: 10 },
  });

  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 3, // used 3 of guaranteed 5
    activeWorkers: 0,
    llmTokensUsedLastMinute: 0,
    llmRequestsUsedLastMinute: 0,
  };

  const capacity = calculateBurstCapacity(quota, usage);

  // burstable(10) - guaranteed_used(3) = 7
  assert.equal(capacity.maxConcurrentWorkflows, 7);
});

test("calculateBurstCapacity when usage exceeds guaranteed but within burstable", () => {
  const quota = createResourceQuota("org-1", {
    guaranteed: { maxConcurrentWorkflows: 5 },
    burstable: { maxConcurrentWorkflows: 10 },
  });

  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 7, // exceeds guaranteed
    activeWorkers: 0,
    llmTokensUsedLastMinute: 0,
    llmRequestsUsedLastMinute: 0,
  };

  const capacity = calculateBurstCapacity(quota, usage);

  // guaranteed_used = min(7, 5) = 5
  // burstable(10) - 5 = 5
  assert.equal(capacity.maxConcurrentWorkflows, 5);
});

test("calculateBurstCapacity with all resource types", () => {
  const quota = createResourceQuota("org-1", {
    guaranteed: {
      maxConcurrentWorkflows: 5,
      maxConcurrentWorkers: 3,
      llmTokensPerMinute: 5000,
      llmRequestsPerMinute: 50,
    },
    burstable: {
      maxConcurrentWorkflows: 10,
      maxConcurrentWorkers: 6,
      llmTokensPerMinute: 10000,
      llmRequestsPerMinute: 100,
    },
  });

  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 3,
    activeWorkers: 2,
    llmTokensUsedLastMinute: 3000,
    llmRequestsUsedLastMinute: 30,
  };

  const capacity = calculateBurstCapacity(quota, usage);

  assert.equal(capacity.maxConcurrentWorkflows, 7); // 10 - 3
  assert.equal(capacity.maxConcurrentWorkers, 4); // 6 - 2
  assert.equal(capacity.llmTokensPerMinute, 7000); // 10000 - 3000
  assert.equal(capacity.llmRequestsPerMinute, 70); // 100 - 30
});

test("calculateBurstCapacity with zero guaranteed tier", () => {
  const quota = createResourceQuota("org-1", {
    guaranteed: { maxConcurrentWorkflows: 0 },
    burstable: { maxConcurrentWorkflows: 10 },
  });

  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 5,
    activeWorkers: 0,
    llmTokensUsedLastMinute: 0,
    llmRequestsUsedLastMinute: 0,
  };

  const capacity = calculateBurstCapacity(quota, usage);

  // guaranteed_used = min(5, 0) = 0
  // burstable(10) - 0 = 10
  assert.equal(capacity.maxConcurrentWorkflows, 10);
});

// =============================================================================
// inheritQuota
// =============================================================================

test("inheritQuota scales by ratio correctly", () => {
  const parent = createResourceQuota("parent", {
    guaranteed: { maxConcurrentWorkflows: 10 },
    burstable: { maxConcurrentWorkflows: 20 },
    maxLimit: { maxConcurrentWorkflows: 40 },
  });

  const child = inheritQuota(parent, 0.5);

  assert.equal(child.guaranteed.maxConcurrentWorkflows, 5);
  assert.equal(child.burstable.maxConcurrentWorkflows, 10);
  assert.equal(child.maxLimit.maxConcurrentWorkflows, 20);
});

test("inheritQuota uses minimum of 1 for small values", () => {
  const parent = createResourceQuota("parent", {
    guaranteed: { maxConcurrentWorkflows: 1 },
  });

  const child = inheritQuota(parent, 0.1);

  // Math.max(1, Math.floor(1 * 0.1)) = Math.max(1, 0) = 1
  assert.equal(child.guaranteed.maxConcurrentWorkflows, 1);
});

test("inheritQuota with ratio of 1 keeps same values", () => {
  const parent = createResourceQuota("parent", {
    guaranteed: { maxConcurrentWorkflows: 10, maxConcurrentWorkers: 5 },
    burstable: { maxConcurrentWorkflows: 20, maxConcurrentWorkers: 10 },
    maxLimit: { maxConcurrentWorkflows: 40, maxConcurrentWorkers: 20 },
  });

  const child = inheritQuota(parent, 1.0);

  assert.equal(child.guaranteed.maxConcurrentWorkflows, 10);
  assert.equal(child.guaranteed.maxConcurrentWorkers, 5);
  assert.equal(child.burstable.maxConcurrentWorkflows, 20);
  assert.equal(child.burstable.maxConcurrentWorkers, 10);
  assert.equal(child.maxLimit.maxConcurrentWorkflows, 40);
  assert.equal(child.maxLimit.maxConcurrentWorkers, 20);
});

test("inheritQuota leaves orgNodeId empty", () => {
  const parent = createResourceQuota("parent");

  const child = inheritQuota(parent, 0.5);

  assert.equal(child.orgNodeId, "");
});

test("inheritQuota scales all resource types", () => {
  const parent = createResourceQuota("parent", {
    guaranteed: {
      maxConcurrentWorkflows: 20,
      maxConcurrentWorkers: 10,
      llmTokensPerMinute: 20000,
      llmRequestsPerMinute: 200,
    },
  });

  const child = inheritQuota(parent, 0.25);

  assert.equal(child.guaranteed.maxConcurrentWorkflows, 5);
  assert.equal(child.guaranteed.maxConcurrentWorkers, 2);
  assert.equal(child.guaranteed.llmTokensPerMinute, 5000);
  assert.equal(child.guaranteed.llmRequestsPerMinute, 50);
});

test("inheritQuota handles small ratios correctly", () => {
  const parent = createResourceQuota("parent", {
    guaranteed: {
      maxConcurrentWorkflows: 1000,
      maxConcurrentWorkers: 500,
      llmTokensPerMinute: 100000,
      llmRequestsPerMinute: 1000,
    },
  });

  const child = inheritQuota(parent, 0.01);

  assert.equal(child.guaranteed.maxConcurrentWorkflows, 10);
  assert.equal(child.guaranteed.maxConcurrentWorkers, 5);
  assert.equal(child.guaranteed.llmTokensPerMinute, 1000);
  assert.equal(child.guaranteed.llmRequestsPerMinute, 10);
});

// =============================================================================
// Quota Usage and Rejection Details
// =============================================================================

test("canAllocate returns currentUsage in result", () => {
  const quota = createResourceQuota("org-1");
  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 5,
    activeWorkers: 3,
    llmTokensUsedLastMinute: 5000,
    llmRequestsUsedLastMinute: 30,
  };

  const result = canAllocate(quota, usage, {});

  assert.equal(result.currentUsage.activeWorkflows, 5);
  assert.equal(result.currentUsage.activeWorkers, 3);
  assert.equal(result.currentUsage.llmTokensUsedLastMinute, 5000);
});

test("canAllocate returns availableQuota in result", () => {
  const quota = createResourceQuota("org-1", {
    maxLimit: {
      maxConcurrentWorkflows: 20,
      maxConcurrentWorkers: 10,
      llmTokensPerMinute: 20000,
      llmRequestsPerMinute: 200,
    },
  });

  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 8,
    activeWorkers: 4,
    llmTokensUsedLastMinute: 8000,
    llmRequestsUsedLastMinute: 80,
  };

  const result = canAllocate(quota, usage, {});

  assert.equal(result.availableQuota.maxConcurrentWorkflows, 12);
  assert.equal(result.availableQuota.maxConcurrentWorkers, 6);
  assert.equal(result.availableQuota.llmTokensPerMinute, 12000);
  assert.equal(result.availableQuota.llmRequestsPerMinute, 120);
});

test("canAllocate rejection includes rejectedDueTo field", () => {
  const quota = createResourceQuota("org-1", {
    maxLimit: { maxConcurrentWorkflows: 10, llmTokensPerMinute: 5000 },
  });

  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 9,
    activeWorkers: 5,
    llmTokensUsedLastMinute: 4000,
    llmRequestsUsedLastMinute: 50,
  };

  const result = canAllocate(quota, usage, { maxConcurrentWorkflows: 2 });

  assert.equal(result.rejectedDueTo, "maxConcurrentWorkflows");
});

test("canAllocate admission includes reason string", () => {
  const quota = createResourceQuota("org-1");
  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 0,
    activeWorkers: 0,
    llmTokensUsedLastMinute: 0,
    llmRequestsUsedLastMinute: 0,
  };

  const result = canAllocate(quota, usage, { maxConcurrentWorkflows: 1 });

  assert.equal(result.admitted, true);
  assert.ok(result.reason !== undefined);
  assert.ok(result.reason.length > 0);
});
