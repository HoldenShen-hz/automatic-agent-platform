/**
 * Unit tests for fair scheduling modules in src/scale-ecosystem/resource-manager/
 *
 * Tests FairSchedulingService, fair queue ordering, preemption victim selection,
 * quota enforcement, and resource pool allocation.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  FairSchedulingService,
  type FairSchedulingRequest,
  type ResourceClaim,
  type SchedulingClass,
  type FairQueueSnapshot,
  type PreemptionDecision,
} from "../../../src/scale-ecosystem/resource-manager/fair-scheduling-service.js";
import {
  orderFairQueue,
  type FairQueueItem,
} from "../../../src/scale-ecosystem/resource-manager/fair-queue/index.js";
import {
  choosePreemptionVictim,
  type PreemptionCandidate,
} from "../../../src/scale-ecosystem/resource-manager/preemption/index.js";
import {
  isQuotaExceeded,
  evaluateQuota,
  QuotaPolicySchema,
  type QuotaPolicy,
  type QuotaDecision,
} from "../../../src/scale-ecosystem/resource-manager/quota-enforcer/index.js";
import {
  ResourcePoolService,
  type ResourcePool,
} from "../../../src/scale-ecosystem/resource-manager/resource-pool-service.js";

// ─────────────────────────────────────────────────────────────────────────────
// FairQueueItem Factory
// ─────────────────────────────────────────────────────────────────────────────

function createQueueItem(overrides: Partial<FairQueueItem> = {}): FairQueueItem {
  return {
    itemId: overrides.itemId ?? "item-1",
    tenantId: overrides.tenantId ?? "tenant-1",
    priority: overrides.priority ?? 5,
    ageMs: overrides.ageMs ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PreemptionCandidate Factory
// ─────────────────────────────────────────────────────────────────────────────

function createPreemptionCandidate(overrides: Partial<PreemptionCandidate> = {}): PreemptionCandidate {
  return {
    executionId: overrides.executionId ?? "exec-1",
    priority: overrides.priority ?? 3,
    progressPercent: overrides.progressPercent ?? 50,
    lastCheckpointTimestampMs: overrides.lastCheckpointTimestampMs ?? Date.now() - 1_000,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SchedulingClass Factory
// ─────────────────────────────────────────────────────────────────────────────

function createSchedulingClass(overrides: Partial<SchedulingClass> = {}): SchedulingClass {
  return {
    tenantId: overrides.tenantId ?? "tenant-1",
    orgNodeId: overrides.orgNodeId ?? null,
    domainId: overrides.domainId ?? "domain-1",
    slaTierId: overrides.slaTierId ?? "gold",
    priority: overrides.priority ?? 5,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ResourceClaim Factory
// ─────────────────────────────────────────────────────────────────────────────

function createResourceClaim(overrides: Partial<ResourceClaim> = {}): ResourceClaim {
  return {
    claimId: overrides.claimId ?? "claim-1",
    schedulingClass: overrides.schedulingClass ?? createSchedulingClass(),
    requestedUnits: overrides.requestedUnits ?? 10,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// QuotaPolicy Factory
// ─────────────────────────────────────────────────────────────────────────────

function createQuotaPolicy(overrides: Partial<QuotaPolicy> = {}): QuotaPolicy {
  return {
    scopeId: overrides.scopeId ?? "tenant-1",
    resourceType: overrides.resourceType ?? "runtime_units",
    hardLimit: overrides.hardLimit ?? 100,
    softLimit: overrides.softLimit ?? 80,
    burstLimit: overrides.burstLimit ?? 120,
    resetWindow: overrides.resetWindow ?? "1h",
    currentUsage: overrides.currentUsage ?? 50,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ResourcePool Factory
// ─────────────────────────────────────────────────────────────────────────────

function createResourcePool(overrides: Partial<ResourcePool> = {}): ResourcePool {
  return {
    poolId: overrides.poolId ?? "pool-1",
    resourceType: overrides.resourceType ?? "compute",
    capacityUnits: overrides.capacityUnits ?? 100,
    allocatedUnits: overrides.allocatedUnits ?? 0,
    burstUnits: overrides.burstUnits ?? 20,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FairSchedulingService Tests
// ─────────────────────────────────────────────────────────────────────────────

test("FairSchedulingService.schedule orders queue by priority and age", () => {
  const service = new FairSchedulingService();
  const queueItems = [
    createQueueItem({ itemId: "low", priority: 1, ageMs: 0 }),
    createQueueItem({ itemId: "high", priority: 10, ageMs: 0 }),
    createQueueItem({ itemId: "medium-old", priority: 5, ageMs: 10 * 60_000 }),
  ];

  const request = createScheduleRequest({ queueItems });
  const decision = service.schedule(request);

  assert.equal(decision.queue.orderedItemIds[0], "low");
  assert.equal(decision.queue.orderedItemIds[1], "medium-old");
  assert.equal(decision.queue.orderedItemIds[2], "high");
});

test("FairSchedulingService.schedule identifies starved items at 15 minutes", () => {
  const service = new FairSchedulingService();
  const queueItems = [
    createQueueItem({ itemId: "fresh", ageMs: 5 * 60_000 }),
    createQueueItem({ itemId: "exactly-15min", ageMs: 15 * 60_000 }),
    createQueueItem({ itemId: "starved", ageMs: 16 * 60_000 }),
    createQueueItem({ itemId: "very-starved", ageMs: 60 * 60_000 }),
  ];

  const request = createScheduleRequest({ queueItems });
  const decision = service.schedule(request);

  assert.deepEqual(decision.queue.starvedItemIds, ["exactly-15min", "starved", "very-starved"]);
  assert.ok(!decision.queue.starvedItemIds.includes("fresh"));
  assert.ok(decision.queue.starvedItemIds.includes("exactly-15min"));
});

test("FairSchedulingService.schedule does not preempt when within quota", () => {
  const service = new FairSchedulingService();
  const request = createScheduleRequest({
    quotaPolicy: createQuotaPolicy({ currentUsage: 50, hardLimit: 100 }),
    preemptionCandidates: [createPreemptionCandidate()],
  });

  const decision = service.schedule(request);

  assert.equal(decision.queue.quotaExceeded, false);
  assert.equal(decision.preemption.shouldPreempt, false);
  assert.equal(decision.preemption.victimExecutionId, null);
  assert.equal(decision.preemption.reason, null);
});

test("FairSchedulingService.schedule preempts when quota exceeded and victim exists", () => {
  const service = new FairSchedulingService();
  const candidates = [
    createPreemptionCandidate({ executionId: "high-prio", priority: 10 }),
    createPreemptionCandidate({ executionId: "low-prio", priority: 1 }),
  ];

  const request = createScheduleRequest({
    quotaPolicy: createQuotaPolicy({ currentUsage: 100, hardLimit: 80, burstLimit: 100 }),
    preemptionCandidates: candidates,
  });

  const decision = service.schedule(request);

  assert.equal(decision.queue.quotaExceeded, true);
  assert.equal(decision.preemption.shouldPreempt, true);
  assert.equal(decision.preemption.victimExecutionId, "low-prio");
  assert.equal(decision.preemption.reason, "resource_manager.quota_exceeded_preempt_low_priority");
});

test("FairSchedulingService.schedule reports quota exceeded without victim", () => {
  const service = new FairSchedulingService();
  const request = createScheduleRequest({
    quotaPolicy: createQuotaPolicy({ currentUsage: 100, hardLimit: 80, burstLimit: 100 }),
    preemptionCandidates: [],
  });

  const decision = service.schedule(request);

  assert.equal(decision.queue.quotaExceeded, true);
  assert.equal(decision.preemption.shouldPreempt, false);
  assert.equal(decision.preemption.reason, "resource_manager.quota_exceeded_without_victim");
});

test("FairSchedulingService.schedule returns empty queue snapshot for empty input", () => {
  const service = new FairSchedulingService();
  const request = createScheduleRequest({ queueItems: [], preemptionCandidates: [] });

  const decision = service.schedule(request);

  assert.deepEqual(decision.queue.orderedItemIds, []);
  assert.deepEqual(decision.queue.starvedItemIds, []);
  assert.equal(decision.queue.quotaExceeded, false);
});

test("FairSchedulingService.schedule identifies all items starved when all over 15 min", () => {
  const service = new FairSchedulingService();
  const queueItems = [
    createQueueItem({ itemId: "item-1", ageMs: 20 * 60_000 }),
    createQueueItem({ itemId: "item-2", ageMs: 25 * 60_000 }),
    createQueueItem({ itemId: "item-3", ageMs: 30 * 60_000 }),
  ];

  const request = createScheduleRequest({ queueItems });
  const decision = service.schedule(request);

  assert.deepEqual(decision.queue.starvedItemIds, ["item-1", "item-2", "item-3"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// orderFairQueue Tests
// ─────────────────────────────────────────────────────────────────────────────

test("orderFairQueue sorts by effective priority score", () => {
  const items = [
    createQueueItem({ itemId: "low", priority: 1 }),
    createQueueItem({ itemId: "high", priority: 10 }),
    createQueueItem({ itemId: "medium", priority: 5 }),
  ];

  const ordered = orderFairQueue(items);

  assert.equal(ordered[0]!.itemId, "low");
  assert.equal(ordered[1]!.itemId, "medium");
  assert.equal(ordered[2]!.itemId, "high");
});

test("orderFairQueue considers age in scoring with cap at 9", () => {
  const items = [
    createQueueItem({ itemId: "new-high", priority: 5, ageMs: 0 }),
    createQueueItem({ itemId: "old-medium", priority: 4, ageMs: 10 * 60_000 }),
    createQueueItem({ itemId: "new-medium", priority: 5, ageMs: 0 }),
  ];

  const ordered = orderFairQueue(items);

  assert.equal(ordered[0]!.itemId, "old-medium");
  assert.equal(ordered[1]!.itemId, "new-high");
});

test("orderFairQueue does not modify original array", () => {
  const items = [
    createQueueItem({ itemId: "first", priority: 1 }),
    createQueueItem({ itemId: "second", priority: 2 }),
  ];
  const original = [...items];

  orderFairQueue(items);

  assert.equal(items[0]!.itemId, original[0]!.itemId);
  assert.equal(items[1]!.itemId, original[1]!.itemId);
});

test("orderFairQueue handles single item", () => {
  const items = [createQueueItem({ itemId: "only" })];
  const ordered = orderFairQueue(items);
  assert.equal(ordered.length, 1);
  assert.equal(ordered[0]!.itemId, "only");
});

test("orderFairQueue handles empty array", () => {
  const ordered = orderFairQueue([]);
  assert.deepEqual(ordered, []);
});

test("orderFairQueue age penalty continues accumulating until the 99-minute cap", () => {
  const items = [
    createQueueItem({ itemId: "old", priority: 5, ageMs: 15 * 60_000 }),
    createQueueItem({ itemId: "very-old", priority: 5, ageMs: 60 * 60_000 }),
  ];

  const ordered = orderFairQueue(items);

  const oldIdx = ordered.findIndex((i) => i.itemId === "old");
  const veryOldIdx = ordered.findIndex((i) => i.itemId === "very-old");
  assert.ok(veryOldIdx > oldIdx);
});

// ─────────────────────────────────────────────────────────────────────────────
// choosePreemptionVictim Tests
// ─────────────────────────────────────────────────────────────────────────────

test("choosePreemptionVictim selects lowest priority", () => {
  const candidates = [
    createPreemptionCandidate({ executionId: "high", priority: 10 }),
    createPreemptionCandidate({ executionId: "low", priority: 1 }),
    createPreemptionCandidate({ executionId: "medium", priority: 5 }),
  ];

  const victim = choosePreemptionVictim(candidates);

  assert.equal(victim?.executionId, "low");
});

test("choosePreemptionVictim breaks tie by higher progressPercent", () => {
  const candidates = [
    createPreemptionCandidate({ executionId: "more-progress", priority: 5, progressPercent: 80 }),
    createPreemptionCandidate({ executionId: "less-progress", priority: 5, progressPercent: 20 }),
  ];

  const victim = choosePreemptionVictim(candidates);

  assert.equal(victim?.executionId, "more-progress");
});

test("choosePreemptionVictim returns null for empty array", () => {
  const victim = choosePreemptionVictim([]);
  assert.equal(victim, null);
});

test("choosePreemptionVictim selects more progressed when same priority", () => {
  const candidates = [
    createPreemptionCandidate({ executionId: "fast", priority: 5, progressPercent: 90 }),
    createPreemptionCandidate({ executionId: "slow", priority: 5, progressPercent: 10 }),
  ];

  const victim = choosePreemptionVictim(candidates);

  assert.equal(victim?.executionId, "fast");
});

// ─────────────────────────────────────────────────────────────────────────────
// isQuotaExceeded Tests
// ─────────────────────────────────────────────────────────────────────────────

test("isQuotaExceeded returns false when within burst limit", () => {
  const policy = createQuotaPolicy({ currentUsage: 50, hardLimit: 100, burstLimit: 120 });

  const exceeded = isQuotaExceeded(policy, 10);

  assert.equal(exceeded, false);
});

test("isQuotaExceeded returns true when exceeds burst limit", () => {
  const policy = createQuotaPolicy({ currentUsage: 100, hardLimit: 80, burstLimit: 100 });

  const exceeded = isQuotaExceeded(policy, 10);

  assert.equal(exceeded, true);
});

test("isQuotaExceeded returns false when exactly at burst limit", () => {
  const policy = createQuotaPolicy({ currentUsage: 90, hardLimit: 80, burstLimit: 100 });

  const exceeded = isQuotaExceeded(policy, 10);

  assert.equal(exceeded, false);
});

test("isQuotaExceeded returns false when currentUsage is zero", () => {
  const policy = createQuotaPolicy({ currentUsage: 0, hardLimit: 100 });

  const exceeded = isQuotaExceeded(policy, 50);

  assert.equal(exceeded, false);
});

test("isQuotaExceeded returns false when requesting zero with high usage", () => {
  const policy = createQuotaPolicy({ currentUsage: 100, hardLimit: 50, burstLimit: 100 });

  const exceeded = isQuotaExceeded(policy, 0);

  assert.equal(exceeded, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// evaluateQuota Tests
// ─────────────────────────────────────────────────────────────────────────────

test("evaluateQuota returns not exceeded when projected below burst", () => {
  const policy = createQuotaPolicy({ currentUsage: 50, hardLimit: 80, burstLimit: 100 });

  const decision = evaluateQuota(policy, 30);

  assert.equal(decision.exceeded, false);
  assert.equal(decision.warning, false);
  assert.equal(decision.usesBurst, false);
  assert.equal(decision.remainingUnits, 20);
});

test("evaluateQuota returns exceeded when projected above burst", () => {
  const policy = createQuotaPolicy({ currentUsage: 90, hardLimit: 80, burstLimit: 100 });

  const decision = evaluateQuota(policy, 20);

  assert.equal(decision.exceeded, true);
  assert.equal(decision.warning, true);
  assert.equal(decision.usesBurst, false);
  assert.equal(decision.remainingUnits, 0);
});

test("evaluateQuota usesBurst true when between hard and burst", () => {
  const policy = createQuotaPolicy({ currentUsage: 70, softLimit: 60, hardLimit: 80, burstLimit: 100 });

  const decision = evaluateQuota(policy, 20);

  // projected = 90
  assert.equal(decision.exceeded, false);
  assert.equal(decision.warning, true);
  assert.equal(decision.usesBurst, true);
  assert.equal(decision.remainingUnits, 10);
});

test("evaluateQuota uses hardLimit as softLimit when undefined", () => {
  const policy = createQuotaPolicy({ currentUsage: 85, softLimit: undefined, hardLimit: 80, burstLimit: 100 });

  const decision = evaluateQuota(policy, 10);

  // projected = 95, softLimit defaults to hardLimit = 80
  assert.equal(decision.warning, true);
});

test("evaluateQuota remainingUnits never negative", () => {
  const policy = createQuotaPolicy({ currentUsage: 100, hardLimit: 80, burstLimit: 100 });

  const decision = evaluateQuota(policy, 50);

  assert.equal(decision.exceeded, true);
  assert.equal(decision.remainingUnits, 0);
});

test("evaluateQuota with zero currentUsage", () => {
  const policy = createQuotaPolicy({ currentUsage: 0, hardLimit: 100, burstLimit: 150 });

  const decision = evaluateQuota(policy, 30);

  assert.equal(decision.exceeded, false);
  assert.equal(decision.warning, false);
  assert.equal(decision.remainingUnits, 120);
});

// ─────────────────────────────────────────────────────────────────────────────
// QuotaPolicySchema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("QuotaPolicySchema parses valid minimal input", () => {
  const result = QuotaPolicySchema.safeParse({
    scopeId: "tenant-1",
    hardLimit: 100,
    currentUsage: 50,
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.resourceType, "runtime_units");
    assert.equal(result.data.resetWindow, "1h");
  }
});

test("QuotaPolicySchema accepts valid full input", () => {
  const result = QuotaPolicySchema.safeParse({
    scopeId: "tenant-1",
    resourceType: "compute_units",
    hardLimit: 200,
    softLimit: 150,
    burstLimit: 250,
    resetWindow: "30m",
    currentUsage: 100,
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.softLimit, 150);
    assert.equal(result.data.burstLimit, 250);
  }
});

test("QuotaPolicySchema rejects empty scopeId", () => {
  const result = QuotaPolicySchema.safeParse({
    scopeId: "",
    hardLimit: 100,
    currentUsage: 50,
  });

  assert.equal(result.success, false);
});

test("QuotaPolicySchema rejects negative hardLimit", () => {
  const result = QuotaPolicySchema.safeParse({
    scopeId: "tenant-1",
    hardLimit: -10,
    currentUsage: 50,
  });

  assert.equal(result.success, false);
});

test("QuotaPolicySchema rejects negative currentUsage", () => {
  const result = QuotaPolicySchema.safeParse({
    scopeId: "tenant-1",
    hardLimit: 100,
    currentUsage: -5,
  });

  assert.equal(result.success, false);
});

test("QuotaPolicySchema accepts zero values", () => {
  const result = QuotaPolicySchema.safeParse({
    scopeId: "tenant-1",
    hardLimit: 0,
    currentUsage: 0,
  });

  assert.equal(result.success, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// ResourcePoolService Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ResourcePoolService.registerPool adds pool and returns parsed result", () => {
  const service = new ResourcePoolService();
  const pool = createResourcePool({ poolId: "pool-1", capacityUnits: 100 });

  const registered = service.registerPool(pool);

  assert.equal(registered.poolId, "pool-1");
  assert.equal(registered.capacityUnits, 100);
});

test("ResourcePoolService.allocate grants when capacity available", () => {
  const service = new ResourcePoolService();
  service.registerPool(createResourcePool({ poolId: "pool-1", capacityUnits: 100, allocatedUnits: 0 }));

  const allocation = service.allocate("pool-1", "consumer-1", 30);

  assert.equal(allocation.granted, true);
  assert.equal(allocation.poolId, "pool-1");
  assert.equal(allocation.consumerId, "consumer-1");
  assert.ok(!allocation.reasonCodes.includes("resource_pool.capacity_exceeded"));
});

test("ResourcePoolService.allocate denies when capacity exceeded", () => {
  const service = new ResourcePoolService();
  service.registerPool(createResourcePool({ poolId: "pool-1", capacityUnits: 100, allocatedUnits: 90 }));

  const allocation = service.allocate("pool-1", "consumer-1", 40);

  assert.equal(allocation.granted, false);
  assert.equal(allocation.reasonCodes[0], "resource_pool.capacity_exceeded");
});

test("ResourcePoolService.allocate uses burst capacity", () => {
  const service = new ResourcePoolService();
  service.registerPool(createResourcePool({
    poolId: "pool-1",
    capacityUnits: 100,
    allocatedUnits: 100,
    burstUnits: 20,
  }));

  const allocation = service.allocate("pool-1", "consumer-1", 15);

  assert.equal(allocation.granted, true);
});

test("ResourcePoolService.allocate exceeds total capacity", () => {
  const service = new ResourcePoolService();
  service.registerPool(createResourcePool({
    poolId: "pool-1",
    capacityUnits: 100,
    allocatedUnits: 100,
    burstUnits: 20,
  }));

  const allocation = service.allocate("pool-1", "consumer-1", 30);

  assert.equal(allocation.granted, false);
});

test("ResourcePoolService.release reduces allocated units", () => {
  const service = new ResourcePoolService();
  service.registerPool(createResourcePool({ poolId: "pool-1", capacityUnits: 100, allocatedUnits: 50 }));

  const updated = service.release("pool-1", 20);

  assert.equal(updated.allocatedUnits, 30);
});

test("ResourcePoolService.release does not go below zero", () => {
  const service = new ResourcePoolService();
  service.registerPool(createResourcePool({ poolId: "pool-1", capacityUnits: 100, allocatedUnits: 10 }));

  const updated = service.release("pool-1", 50);

  assert.equal(updated.allocatedUnits, 0);
});

test("ResourcePoolService.release throws for unknown pool", () => {
  const service = new ResourcePoolService();

  assert.throws(() => {
    service.release("unknown-pool", 10);
  }, /resource_pool.not_found/);
});

test("ResourcePoolService.getPool returns pool when registered", () => {
  const service = new ResourcePoolService();
  service.registerPool(createResourcePool({ poolId: "pool-1" }));

  const pool = service.getPool("pool-1");

  assert.ok(pool !== null);
  assert.equal(pool!.poolId, "pool-1");
});

test("ResourcePoolService.getPool returns null for unknown pool", () => {
  const service = new ResourcePoolService();

  const pool = service.getPool("unknown");

  assert.equal(pool, null);
});

test("ResourcePoolService.allocate throws for unknown pool", () => {
  const service = new ResourcePoolService();

  assert.throws(() => {
    service.allocate("unknown-pool", "consumer-1", 10);
  }, /resource_pool.not_found/);
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function createScheduleRequest(overrides: {
  quotaPolicy?: QuotaPolicy;
  claim?: ResourceClaim;
  queueItems?: FairQueueItem[];
  preemptionCandidates?: PreemptionCandidate[];
} = {}): FairSchedulingRequest {
  return {
    quotaPolicy: overrides.quotaPolicy ?? createQuotaPolicy(),
    claim: overrides.claim ?? createResourceClaim(),
    queueItems: overrides.queueItems ?? [],
    preemptionCandidates: overrides.preemptionCandidates ?? [],
  };
}
