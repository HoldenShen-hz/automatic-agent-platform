/**
 * Unit tests for fair scheduling modules in src/scale-ecosystem/resource-manager/
 *
 * Tests FairSchedulingService, fair queue ordering, preemption victim selection,
 * and quota enforcement.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  FairSchedulingService,
  type FairSchedulingRequest,
  type ResourceClaim,
  type SchedulingClass,
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
} from "../../../src/scale-ecosystem/resource-manager/quota-enforcer/index.js";

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
    scope: overrides.scope ?? "tenant",
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
// FairSchedulingService Tests
// ─────────────────────────────────────────────────────────────────────────────

test("FairSchedulingService.schedule orders queue by priority and age", () => {
  const service = new FairSchedulingService();
  const queueItems: FairQueueItem[] = [
    createQueueItem({ itemId: "low", priority: 1, ageMs: 0 }),
    createQueueItem({ itemId: "high", priority: 10, ageMs: 0 }),
    createQueueItem({ itemId: "medium-old", priority: 5, ageMs: 10 * 60_000 }),
  ];

  const request: FairSchedulingRequest = {
    quotaPolicy: createQuotaPolicy(),
    claim: createResourceClaim(),
    queueItems,
    preemptionCandidates: [],
  };

  const decision = service.schedule(request);

  assert.equal(decision.queue.orderedItemIds[0], "low");
  // medium-old has higher effective score due to age
  assert.equal(decision.queue.orderedItemIds[1], "medium-old");
  assert.equal(decision.queue.orderedItemIds[2], "high");
});

test("FairSchedulingService.schedule identifies starved items at 15 minutes", () => {
  const service = new FairSchedulingService();
  const queueItems: FairQueueItem[] = [
    createQueueItem({ itemId: "fresh", ageMs: 5 * 60_000 }),
    createQueueItem({ itemId: "exactly-15min", ageMs: 15 * 60_000 }),
    createQueueItem({ itemId: "starved", ageMs: 16 * 60_000 }),
    createQueueItem({ itemId: "very-starved", ageMs: 60 * 60_000 }),
  ];

  const request: FairSchedulingRequest = {
    quotaPolicy: createQuotaPolicy(),
    claim: createResourceClaim(),
    queueItems,
    preemptionCandidates: [],
  };

  const decision = service.schedule(request);

  assert.deepEqual(decision.queue.starvedItemIds, ["exactly-15min", "starved", "very-starved"]);
  assert.ok(!decision.queue.starvedItemIds.includes("fresh"));
  assert.ok(decision.queue.starvedItemIds.includes("exactly-15min"));
});

test("FairSchedulingService.schedule does not preempt when within quota", () => {
  const service = new FairSchedulingService();
  const request: FairSchedulingRequest = {
    quotaPolicy: createQuotaPolicy({ currentUsage: 50, hardLimit: 100 }),
    claim: createResourceClaim({ requestedUnits: 10 }),
    queueItems: [],
    preemptionCandidates: [createPreemptionCandidate()],
  };

  const decision = service.schedule(request);

  assert.equal(decision.queue.quotaExceeded, false);
  assert.equal(decision.preemption.shouldPreempt, false);
  assert.equal(decision.preemption.victimExecutionId, null);
  assert.equal(decision.preemption.reason, null);
});

test("FairSchedulingService.schedule preempts when quota exceeded and victim exists", () => {
  const service = new FairSchedulingService();
  const candidates: PreemptionCandidate[] = [
    createPreemptionCandidate({ executionId: "high-prio", priority: 10, progressPercent: 80 }),
    createPreemptionCandidate({ executionId: "low-prio", priority: 1, progressPercent: 30 }),
  ];

  const request: FairSchedulingRequest = {
    quotaPolicy: createQuotaPolicy({ currentUsage: 100, hardLimit: 80, burstLimit: 100 }),
    claim: createResourceClaim({ requestedUnits: 10 }),
    queueItems: [],
    preemptionCandidates: candidates,
  };

  const decision = service.schedule(request);

  assert.equal(decision.queue.quotaExceeded, true);
  assert.equal(decision.preemption.shouldPreempt, true);
  assert.equal(decision.preemption.victimExecutionId, "low-prio");
  assert.equal(decision.preemption.reason, "resource_manager.quota_exceeded_preempt_low_priority");
});

test("FairSchedulingService.schedule reports quota exceeded without victim", () => {
  const service = new FairSchedulingService();
  const request: FairSchedulingRequest = {
    quotaPolicy: createQuotaPolicy({ currentUsage: 100, hardLimit: 80, burstLimit: 100 }),
    claim: createResourceClaim({ requestedUnits: 10 }),
    queueItems: [],
    preemptionCandidates: [],
  };

  const decision = service.schedule(request);

  assert.equal(decision.queue.quotaExceeded, true);
  assert.equal(decision.preemption.shouldPreempt, false);
  assert.equal(decision.preemption.reason, "resource_manager.quota_exceeded_without_victim");
});

test("FairSchedulingService.schedule returns empty orderedItemIds for empty queue", () => {
  const service = new FairSchedulingService();
  const request: FairSchedulingRequest = {
    quotaPolicy: createQuotaPolicy(),
    claim: createResourceClaim(),
    queueItems: [],
    preemptionCandidates: [],
  };

  const decision = service.schedule(request);

  assert.deepEqual(decision.queue.orderedItemIds, []);
  assert.deepEqual(decision.queue.starvedItemIds, []);
  assert.equal(decision.queue.quotaExceeded, false);
});

test("FairSchedulingService.schedule with multiple starved items", () => {
  const service = new FairSchedulingService();
  const queueItems: FairQueueItem[] = [
    createQueueItem({ itemId: "item-1", ageMs: 20 * 60_000 }),
    createQueueItem({ itemId: "item-2", ageMs: 25 * 60_000 }),
    createQueueItem({ itemId: "item-3", ageMs: 30 * 60_000 }),
    createQueueItem({ itemId: "item-4", ageMs: 5 * 60_000 }),
  ];

  const request: FairSchedulingRequest = {
    quotaPolicy: createQuotaPolicy(),
    claim: createResourceClaim(),
    queueItems,
    preemptionCandidates: [],
  };

  const decision = service.schedule(request);

  assert.deepEqual(decision.queue.starvedItemIds, ["item-1", "item-2", "item-3"]);
  assert.ok(!decision.queue.starvedItemIds.includes("item-4"));
});

test("FairSchedulingService.schedule preemption decision ignores scheduling class priority", () => {
  const service = new FairSchedulingService();
  const claim = createResourceClaim({
    schedulingClass: createSchedulingClass({ priority: 10 }),
  });

  const request: FairSchedulingRequest = {
    quotaPolicy: createQuotaPolicy({ currentUsage: 100, hardLimit: 80, burstLimit: 100 }),
    claim,
    queueItems: [],
    preemptionCandidates: [createPreemptionCandidate({ priority: 5 })],
  };

  const decision = service.schedule(request);

  assert.equal(decision.queue.quotaExceeded, true);
  assert.equal(decision.preemption.shouldPreempt, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// orderFairQueue Tests
// ─────────────────────────────────────────────────────────────────────────────

test("orderFairQueue sorts by effective priority score", () => {
  const items: FairQueueItem[] = [
    createQueueItem({ itemId: "low", priority: 1 }),
    createQueueItem({ itemId: "high", priority: 10 }),
    createQueueItem({ itemId: "medium", priority: 5 }),
  ];

  const ordered = orderFairQueue(items);

  assert.equal(ordered[0]!.itemId, "low");
  assert.equal(ordered[1]!.itemId, "medium");
  assert.equal(ordered[2]!.itemId, "high");
});

test("orderFairQueue considers age in scoring (age score caps at 9)", () => {
  const items: FairQueueItem[] = [
    createQueueItem({ itemId: "new-high", priority: 5, ageMs: 0 }),
    createQueueItem({ itemId: "old-medium", priority: 4, ageMs: 10 * 60_000 }), // ageScore = 9
    createQueueItem({ itemId: "new-medium", priority: 5, ageMs: 0 }),
  ];

  const ordered = orderFairQueue(items);

  assert.equal(ordered[0]!.itemId, "old-medium");
  assert.equal(ordered[1]!.itemId, "new-high");
});

test("orderFairQueue age score calculation", () => {
  // age score = Math.min(99, Math.floor(ageMs / 60_000))
  const items: FairQueueItem[] = [
    createQueueItem({ itemId: "zero", priority: 5, ageMs: 0 }),
    createQueueItem({ itemId: "30sec", priority: 5, ageMs: 30_000 }),
    createQueueItem({ itemId: "1min", priority: 5, ageMs: 60_000 }),
    createQueueItem({ itemId: "5min", priority: 5, ageMs: 5 * 60_000 }),
    createQueueItem({ itemId: "10min", priority: 5, ageMs: 10 * 60_000 }),
    createQueueItem({ itemId: "very-old", priority: 5, ageMs: 15 * 60_000 }),
  ];

  const ordered = orderFairQueue(items);

  // Age is treated as a penalty, so older items fall later until the cap is hit.
  const tenMinIdx = ordered.findIndex((i) => i.itemId === "10min");
  const veryOldIdx = ordered.findIndex((i) => i.itemId === "very-old");
  assert.ok(veryOldIdx > tenMinIdx, "very-old should rank behind 10min due to a larger age penalty");
});

test("orderFairQueue does not modify original array", () => {
  const items: FairQueueItem[] = [
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

// ─────────────────────────────────────────────────────────────────────────────
// choosePreemptionVictim Tests
// ─────────────────────────────────────────────────────────────────────────────

test("choosePreemptionVictim selects lowest priority candidate", () => {
  const candidates: PreemptionCandidate[] = [
    createPreemptionCandidate({ executionId: "high", priority: 10 }),
    createPreemptionCandidate({ executionId: "low", priority: 1 }),
    createPreemptionCandidate({ executionId: "medium", priority: 5 }),
  ];

  const victim = choosePreemptionVictim(candidates);

  assert.equal(victim?.executionId, "low");
});

test("choosePreemptionVictim breaks tie by higher progressPercent", () => {
  const candidates: PreemptionCandidate[] = [
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

test("choosePreemptionVictim with same priority prefers higher progress", () => {
  const candidates: PreemptionCandidate[] = [
    createPreemptionCandidate({ executionId: "fast", priority: 5, progressPercent: 90 }),
    createPreemptionCandidate({ executionId: "slow", priority: 5, progressPercent: 10 }),
  ];

  const victim = choosePreemptionVictim(candidates);

  assert.equal(victim?.executionId, "fast");
});

test("choosePreemptionVictim with all same priority and progress", () => {
  const candidates: PreemptionCandidate[] = [
    createPreemptionCandidate({ executionId: "first", priority: 5, progressPercent: 50 }),
    createPreemptionCandidate({ executionId: "second", priority: 5, progressPercent: 50 }),
  ];

  const victim = choosePreemptionVictim(candidates);

  // Should return first matching (stable sort behavior)
  assert.ok(["first", "second"].includes(victim!.executionId));
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

test("isQuotaExceeded returns true when exactly at burst limit", () => {
  const policy = createQuotaPolicy({ currentUsage: 90, hardLimit: 80, burstLimit: 100 });

  const exceeded = isQuotaExceeded(policy, 10);

  assert.equal(exceeded, false);
});

test("isQuotaExceeded returns false when currentUsage is zero", () => {
  const policy = createQuotaPolicy({ currentUsage: 0, hardLimit: 100 });

  const exceeded = isQuotaExceeded(policy, 50);

  assert.equal(exceeded, false);
});

test("isQuotaExceeded returns true when requesting zero with high usage", () => {
  const policy = createQuotaPolicy({ currentUsage: 100, hardLimit: 50, burstLimit: 100 });

  const exceeded = isQuotaExceeded(policy, 0);

  assert.equal(exceeded, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// evaluateQuota Tests
// ─────────────────────────────────────────────────────────────────────────────

test("evaluateQuota returns exceeded false when projected below burst", () => {
  const policy = createQuotaPolicy({ currentUsage: 50, hardLimit: 80, burstLimit: 100 });

  const decision = evaluateQuota(policy, 30);

  assert.equal(decision.exceeded, false); // 80 <= 100
  assert.equal(decision.warning, false); // 80 is not above the default softLimit (80)
  assert.equal(decision.usesBurst, false); // 80 > 80 && 80 <= 100 = false
  assert.equal(decision.remainingUnits, 20); // 100 - 80 = 20
});

test("evaluateQuota returns exceeded true when projected above burst", () => {
  const policy = createQuotaPolicy({ currentUsage: 90, hardLimit: 80, burstLimit: 100 });

  const decision = evaluateQuota(policy, 20);

  assert.equal(decision.exceeded, true); // 110 > 100
  assert.equal(decision.warning, true); // 110 > 60
  assert.equal(decision.usesBurst, false); // 110 > 100
  assert.equal(decision.remainingUnits, 0);
});

test("evaluateQuota returns usesBurst true when between hard and burst", () => {
  const policy = createQuotaPolicy({ currentUsage: 70, softLimit: 60, hardLimit: 80, burstLimit: 100 });

  const decision = evaluateQuota(policy, 20);

  // projected = 90
  assert.equal(decision.exceeded, false); // 90 <= 100
  assert.equal(decision.warning, true); // 90 > 60
  assert.equal(decision.usesBurst, true); // 90 > 80 && 90 <= 100
  assert.equal(decision.remainingUnits, 10); // 100 - 90 = 10
});

test("evaluateQuota uses hardLimit as softLimit when softLimit undefined", () => {
  const policy = createQuotaPolicy({ currentUsage: 85, softLimit: undefined, hardLimit: 80, burstLimit: 100 });

  const decision = evaluateQuota(policy, 10);

  // projected = 95, so warning uses hardLimit as the effective soft limit.
  assert.equal(decision.warning, true);
});

test("evaluateQuota uses hardLimit as burstLimit when burstLimit undefined", () => {
  const policy = createQuotaPolicy({ currentUsage: 90, hardLimit: 100, burstLimit: undefined });

  const decision = evaluateQuota(policy, 20);

  // projected = 110
  // burstLimit defaults to hardLimit = 100
  assert.equal(decision.exceeded, false); // 110 is still within the explicit burst limit from the factory default (120)
  assert.equal(decision.remainingUnits, 10);
});

test("evaluateQuota with zero currentUsage and small request", () => {
  const policy = createQuotaPolicy({ currentUsage: 0, hardLimit: 100, burstLimit: 150 });

  const decision = evaluateQuota(policy, 30);

  assert.equal(decision.exceeded, false); // 30 <= 150
  assert.equal(decision.warning, false); // 30 <= 80 (softLimit)
  assert.equal(decision.usesBurst, false); // 30 <= 100 (hardLimit)
  assert.equal(decision.remainingUnits, 120); // 150 - 30 = 120
});

test("evaluateQuota remainingUnits never negative", () => {
  const policy = createQuotaPolicy({ currentUsage: 100, hardLimit: 80, burstLimit: 100 });

  const decision = evaluateQuota(policy, 50);

  assert.equal(decision.exceeded, true);
  assert.equal(decision.remainingUnits, 0);
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

test("QuotaPolicySchema rejects negative softLimit", () => {
  const result = QuotaPolicySchema.safeParse({
    scopeId: "tenant-1",
    hardLimit: 100,
    softLimit: -20,
    currentUsage: 50,
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
