/**
 * Integration tests for Resource Manager - combining quota enforcement,
 * resource pools, and scheduling decisions
 *
 * @see src/scale-ecosystem/resource-manager/
 */

import assert from "node:assert/strict";
import test from "node:test";
import { ResourcePoolService } from "../../../../src/scale-ecosystem/resource-manager/resource-pool-service.js";
import { FairSchedulingService } from "../../../../src/scale-ecosystem/resource-manager/fair-scheduling-service.js";
import {
  evaluateQuota,
  evaluateMultiDimensionalQuota,
  isQuotaExceeded,
  type QuotaPolicy,
  type MultiResourceQuotaVector,
} from "../../../../src/scale-ecosystem/resource-manager/quota-enforcer/index.js";

function createQuotaPolicy(overrides: Partial<QuotaPolicy> = {}): QuotaPolicy {
  return {
    scope: overrides.scope ?? "tenant",
    scopeId: overrides.scopeId ?? "tenant-1",
    resourceType: overrides.resourceType ?? "runtime_units",
    hardLimit: overrides.hardLimit ?? 100,
    softLimit: overrides.softLimit,
    burstLimit: overrides.burstLimit,
    resetWindow: overrides.resetWindow ?? "1h",
    currentUsage: overrides.currentUsage ?? 0,
    multiResourceQuota: overrides.multiResourceQuota,
    multiResourceHardLimits: overrides.multiResourceHardLimits,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Resource Pool + Quota Enforcement Integration
// ─────────────────────────────────────────────────────────────────────────────

test("integration: quota enforcement coordinates with resource pool allocation", () => {
  const poolService = new ResourcePoolService();

  // Register a compute pool
  poolService.registerPool({
    poolId: "compute-pool",
    resourceType: "compute",
    capacityUnits: 100,
    allocatedUnits: 0,
    burstUnits: 20,
  });

  // Simulate quota policy tracking
  const quotaPolicy = createQuotaPolicy({
    scopeId: "tenant-1",
    hardLimit: 100,
    burstLimit: 120,
    currentUsage: 0,
  });

  // Allocate from pool
  const allocation1 = poolService.allocate("compute-pool", "workflow-1", 40);
  assert.equal(allocation1.granted, true);

  // Check quota reflects allocation
  const updatedQuota = evaluateQuota(quotaPolicy, 40);
  assert.equal(updatedQuota.exceeded, false);
  assert.equal(updatedQuota.remainingUnits, 80);

  // Second allocation
  const allocation2 = poolService.allocate("compute-pool", "workflow-2", 50);
  assert.equal(allocation2.granted, true);

  // Third allocation would exceed
  const allocation3 = poolService.allocate("compute-pool", "workflow-3", 35);
  assert.equal(allocation3.granted, false); // 40 + 50 + 35 = 125 > 120
});

test("integration: resource release restores quota headroom", () => {
  const poolService = new ResourcePoolService();

  poolService.registerPool({
    poolId: "io-pool",
    resourceType: "io",
    capacityUnits: 50,
    allocatedUnits: 40,
    burstUnits: 10,
  });

  // Release capacity
  const pool = poolService.release("io-pool", 30);

  assert.equal(pool.allocatedUnits, 10);

  // Should be able to allocate now
  const allocation = poolService.allocate("io-pool", "workflow-new", 45);
  assert.equal(allocation.granted, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Fair Scheduling + Quota Enforcement Integration
// ─────────────────────────────────────────────────────────────────────────────

test("integration: fair scheduling with quota exceeded triggers preemption", () => {
  const schedulingService = new FairSchedulingService();

  const quotaPolicy = createQuotaPolicy({
    scopeId: "tenant-1",
    hardLimit: 100,
    burstLimit: 100,
    currentUsage: 95, // nearly at limit
  });

  const request = {
    quotaPolicy,
    claim: {
      claimId: "claim-1",
      schedulingClass: {
        tenantId: "tenant-1",
        domainId: "domain-1",
        slaTierId: "gold",
        priority: 5,
      },
      requestedUnits: 10,
    },
    queueItems: [
      {
        itemId: "item-1",
        tenantId: "tenant-1",
        priority: 5,
        ageMs: 10 * 60_000, // 10 minutes
      },
      {
        itemId: "item-2",
        tenantId: "tenant-1",
        priority: 3,
        ageMs: 5 * 60_000,
      },
    ],
    preemptionCandidates: [
      { executionId: "exec-1", priority: 1, progressPercent: 80 },
      { executionId: "exec-2", priority: 2, progressPercent: 60 },
    ],
  };

  const decision = schedulingService.schedule(request);

  // Quota exceeded (95 + 10 = 105 > 100)
  assert.equal(decision.queue.quotaExceeded, true);
  assert.equal(decision.preemption.shouldPreempt, true);
  assert.notEqual(decision.preemption.victimExecutionId, null);
});

test("integration: fair scheduling under quota allows normal queuing", () => {
  const schedulingService = new FairSchedulingService();

  const quotaPolicy = createQuotaPolicy({
    scopeId: "tenant-1",
    hardLimit: 100,
    currentUsage: 30,
  });

  const request = {
    quotaPolicy,
    claim: {
      claimId: "claim-1",
      schedulingClass: {
        tenantId: "tenant-1",
        domainId: "domain-1",
        slaTierId: "gold",
        priority: 5,
      },
      requestedUnits: 20,
    },
    queueItems: [
      {
        itemId: "item-1",
        tenantId: "tenant-1",
        priority: 5,
        ageMs: 2 * 60_000,
      },
    ],
    preemptionCandidates: [
      { executionId: "exec-1", priority: 1, progressPercent: 80 },
    ],
  };

  const decision = schedulingService.schedule(request);

  assert.equal(decision.queue.quotaExceeded, false);
  assert.equal(decision.preemption.shouldPreempt, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Multi-dimensional Quota + Pool Integration
// ─────────────────────────────────────────────────────────────────────────────

test("integration: multi-dimensional quota tracks multiple resource types", () => {
  const quotaPolicy = createQuotaPolicy({
    scopeId: "tenant-1",
    hardLimit: 100,
    multiResourceHardLimits: {
      worker_concurrency: 10,
      tool_qps: 100,
      model_tpm: 50000,
      model_rpm: 10000,
      budget_amount: 1000,
      approval_capacity: 50,
      storage_io: 1000,
    },
  });

  // First request - all within limits
  const request1: MultiResourceQuotaVector = {
    worker_concurrency: 5,
    tool_qps: 50,
    model_tpm: 25000,
    model_rpm: 5000,
    budget_amount: 500,
    approval_capacity: 25,
    storage_io: 500,
  };

  const decision1 = evaluateMultiDimensionalQuota(quotaPolicy, request1);
  assert.equal(decision1.passed, true);
  assert.equal(decision1.failedDimensions.length, 0);

  // Second request - exceeds one dimension
  const request2: MultiResourceQuotaVector = {
    worker_concurrency: 5,
    tool_qps: 50,
    model_tpm: 25000,
    model_rpm: 5000,
    budget_amount: 500,
    approval_capacity: 25,
    storage_io: 500,
  };
  // Exceed storage_io
  (request2 as any).storage_io = 1200;

  const decision2 = evaluateMultiDimensionalQuota(quotaPolicy, request2);
  assert.equal(decision2.passed, false);
  assert.ok(decision2.failedDimensions.includes("storage_io"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Starvation Detection Integration
// ─────────────────────────────────────────────────────────────────────────────

test("integration: items starved over 15 minutes are identified", () => {
  const schedulingService = new FairSchedulingService();

  const quotaPolicy = createQuotaPolicy({
    scopeId: "tenant-1",
    hardLimit: 100,
    currentUsage: 50,
  });

  const request = {
    quotaPolicy,
    claim: {
      claimId: "claim-1",
      schedulingClass: {
        tenantId: "tenant-1",
        domainId: "domain-1",
        slaTierId: "silver",
        priority: 5,
      },
      requestedUnits: 10,
    },
    queueItems: [
      {
        itemId: "item-starved",
        tenantId: "tenant-1",
        priority: 5,
        ageMs: 20 * 60_000, // 20 minutes - starved
      },
      {
        itemId: "item-normal",
        tenantId: "tenant-1",
        priority: 5,
        ageMs: 5 * 60_000, // 5 minutes - not starved
      },
    ],
    preemptionCandidates: [],
  };

  const decision = schedulingService.schedule(request);

  assert.ok(decision.queue.starvedItemIds.includes("item-starved"));
  assert.ok(!decision.queue.starvedItemIds.includes("item-normal"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Quota Reset Window Simulation
// ─────────────────────────────────────────────────────────────────────────────

test("integration: quota resets after window with full usage release", () => {
  const poolService = new ResourcePoolService();

  poolService.registerPool({
    poolId: "reset-pool",
    resourceType: "compute",
    capacityUnits: 100,
    allocatedUnits: 100, // fully utilized
    burstUnits: 0,
  });

  // Simulate quota policy at limit
  let quotaPolicy = createQuotaPolicy({
    scopeId: "tenant-1",
    hardLimit: 100,
    currentUsage: 100,
  });

  assert.equal(isQuotaExceeded(quotaPolicy, 1), true);

  // Release resources (simulating window reset)
  poolService.release("reset-pool", 100);
  quotaPolicy = createQuotaPolicy({
    scopeId: "tenant-1",
    hardLimit: 100,
    currentUsage: 0, // reset
  });

  // Quota should allow new requests
  const allocation = poolService.allocate("reset-pool", "workflow-post-reset", 50);
  assert.equal(allocation.granted, true);
  assert.equal(isQuotaExceeded(quotaPolicy, 50), false);
});
