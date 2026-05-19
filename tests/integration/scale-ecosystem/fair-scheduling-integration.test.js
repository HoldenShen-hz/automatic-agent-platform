import assert from "node:assert/strict";
import test from "node:test";
import { FairSchedulingService } from "../../../src/scale-ecosystem/resource-manager/fair-scheduling-service.js";
import { evaluateMultiDimensionalQuota, isQuotaExceeded } from "../../../src/scale-ecosystem/resource-manager/quota-enforcer/index.js";

test("integration: FairSchedulingService schedules with quota exceeded and preemption", () => {
  const service = new FairSchedulingService();
  const result = service.schedule({
    quotaPolicy: { scope: "tenant", scopeId: "tenant-1", hardLimit: 10, currentUsage: 8 },
    claim: {
      claimId: "claim-1",
      schedulingClass: { tenantId: "tenant-1", domainId: "d1", slaTierId: "gold", priority: 5 },
      requestedUnits: 5,
    },
    queueItems: [
      { itemId: "item-1", tenantId: "tenant-1", orgId: "org-1", domainId: "d1", priority: 5, ageMs: 10 * 60_000, slaTier: 2 },
      { itemId: "item-2", tenantId: "tenant-1", orgId: "org-1", domainId: "d1", priority: 3, ageMs: 5 * 60_000, slaTier: 1 },
    ],
    preemptionCandidates: [
      { executionId: "exec-low", priority: 1, progressPercent: 80 },
      { executionId: "exec-mid", priority: 5, progressPercent: 50 },
    ],
  });

  assert.equal(result.queue.quotaExceeded, true);
  assert.equal(result.preemption.shouldPreempt, true);
  assert.equal(result.preemption.victimExecutionId, "exec-low");
  assert.ok(result.queue.starvedItemIds.includes("item-1")); // 10 min > 15 min threshold
});

test("integration: FairSchedulingService avoids preemption when quota not exceeded", () => {
  const service = new FairSchedulingService();
  const result = service.schedule({
    quotaPolicy: { scope: "tenant", scopeId: "tenant-1", hardLimit: 100, currentUsage: 20 },
    claim: {
      claimId: "claim-1",
      schedulingClass: { tenantId: "tenant-1", domainId: "d1", slaTierId: "silver", priority: 3 },
      requestedUnits: 5,
    },
    queueItems: [
      { itemId: "item-1", tenantId: "tenant-1", priority: 5, ageMs: 20 * 60_000, slaTier: 2 },
    ],
    preemptionCandidates: [
      { executionId: "exec-old", priority: 1, progressPercent: 95 },
    ],
  });

  assert.equal(result.queue.quotaExceeded, false);
  assert.equal(result.preemption.shouldPreempt, false);
  assert.equal(result.preemption.victimExecutionId, null);
});

test("integration: FairSchedulingService respects priority ordering in queue", () => {
  const service = new FairSchedulingService();
  const result = service.schedule({
    quotaPolicy: { scope: "tenant", hardLimit: 100, currentUsage: 10 },
    claim: {
      claimId: "claim-1",
      schedulingClass: { tenantId: "tenant-1", domainId: "d1", slaTierId: "bronze", priority: 1 },
      requestedUnits: 1,
    },
    queueItems: [
      { itemId: "low-priority", tenantId: "tenant-1", orgId: "org-A", domainId: "d1", priority: 1, ageMs: 60_000, slaTier: 1 },
      { itemId: "high-priority", tenantId: "tenant-1", orgId: "org-A", domainId: "d1", priority: 10, ageMs: 30_000, slaTier: 1 },
    ],
    preemptionCandidates: [],
  });

  // High priority (10) should come before low priority (1)
  assert.equal(result.queue.orderedItemIds[0], "high-priority");
  assert.equal(result.queue.orderedItemIds[1], "low-priority");
});

test("integration: evaluateMultiDimensionalQuota enforces multiple resource limits", () => {
  const policy = {
    scope: "tenant",
    hardLimit: 100,
    multiResourceHardLimits: {
      worker_concurrency: 20,
      tool_qps: 100,
      model_tpm: 5000,
      model_rpm: 1000,
      budget_amount: 50000,
      approval_capacity: 50,
      storage_io: 1000,
    },
  };

  // Request exceeding worker_concurrency
  const result = evaluateMultiDimensionalQuota(policy, {
    worker_concurrency: 25,
    tool_qps: 80,
    model_tpm: 4000,
    model_rpm: 800,
    budget_amount: 40000,
    approval_capacity: 40,
    storage_io: 800,
  });

  assert.equal(result.passed, false);
  assert.equal(result.failedDimensions.includes("worker_concurrency"), true);
  assert.equal(result.warningDimensions.length, 0);
});

test("integration: evaluateMultiDimensionalQuota warns when approaching limits", () => {
  const policy = {
    scope: "tenant",
    hardLimit: 100,
    multiResourceHardLimits: {
      worker_concurrency: 20,
      tool_qps: 100,
      model_tpm: 5000,
      model_rpm: 1000,
      budget_amount: 50000,
      approval_capacity: 50,
      storage_io: 1000,
    },
  };

  // Request approaching but not exceeding limits (over 80% soft limit)
  const result = evaluateMultiDimensionalQuota(policy, {
    worker_concurrency: 18, // 18 > 16 (80% of 20)
    tool_qps: 90, // 90 > 80 (80% of 100)
    model_tpm: 4000,
    model_rpm: 800,
    budget_amount: 40000,
    approval_capacity: 40,
    storage_io: 800,
  });

  assert.equal(result.passed, true);
  assert.equal(result.failedDimensions.length, 0);
  assert.equal(result.warningDimensions.includes("worker_concurrency"), true);
  assert.equal(result.warningDimensions.includes("tool_qps"), true);
});

test("integration: isQuotaExceeded detects burst limit breach", () => {
  const policy = { scope: "tenant", hardLimit: 100, burstLimit: 150, currentUsage: 120 };
  assert.equal(isQuotaExceeded(policy, 40), true); // 160 > 150

  const policy2 = { scope: "tenant", hardLimit: 100, burstLimit: 150, currentUsage: 100 };
  assert.equal(isQuotaExceeded(policy2, 30), false); // 130 <= 150
});

test("integration: FairSchedulingService identifies starved items after threshold", () => {
  const service = new FairSchedulingService();
  const result = service.schedule({
    quotaPolicy: { scope: "tenant", hardLimit: 100, currentUsage: 10 },
    claim: {
      claimId: "claim-1",
      schedulingClass: { tenantId: "tenant-1", domainId: "d1", slaTierId: "basic", priority: 1 },
      requestedUnits: 1,
    },
    queueItems: [
      { itemId: "starved-1", tenantId: "tenant-1", priority: 5, ageMs: 16 * 60_000, slaTier: 1 },
      { itemId: "starved-2", tenantId: "tenant-2", priority: 5, ageMs: 20 * 60_000, slaTier: 1 },
      { itemId: "fresh", tenantId: "tenant-1", priority: 5, ageMs: 5 * 60_000, slaTier: 1 },
    ],
    preemptionCandidates: [],
  });

  assert.equal(result.queue.starvedItemIds.includes("starved-1"), true);
  assert.equal(result.queue.starvedItemIds.includes("starved-2"), true);
  assert.equal(result.queue.starvedItemIds.includes("fresh"), false);
});

test("integration: FairSchedulingService selects preemption victim by lowest priority and progress", () => {
  const service = new FairSchedulingService();
  const result = service.schedule({
    quotaPolicy: { scope: "tenant", hardLimit: 10, burstLimit: 10, currentUsage: 10 },
    claim: {
      claimId: "claim-1",
      schedulingClass: { tenantId: "tenant-1", domainId: "d1", slaTierId: "gold", priority: 10 },
      requestedUnits: 5,
    },
    queueItems: [],
    preemptionCandidates: [
      { executionId: "exec-1", priority: 3, progressPercent: 20 },
      { executionId: "exec-2", priority: 3, progressPercent: 80 },
      { executionId: "exec-3", priority: 1, progressPercent: 50 },
    ],
  });

  assert.equal(result.preemption.shouldPreempt, true);
  // Priority 1 is lowest, so exec-3 should be selected
  assert.equal(result.preemption.victimExecutionId, "exec-3");
});