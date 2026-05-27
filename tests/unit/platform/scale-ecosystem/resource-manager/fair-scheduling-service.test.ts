import { describe } from "node:test";
import test from "node:test";
import { strict as assert } from "node:assert/strict";
import {
  FairSchedulingService,
  type SchedulingClass,
  type ResourceClaim,
  type FairSchedulingRequest,
} from "../../../../../src/scale-ecosystem/resource-manager/fair-scheduling-service.js";
import { orderFairQueue, type FairQueueItem } from "../../../../../src/scale-ecosystem/resource-manager/fair-queue/index.js";
import { choosePreemptionVictim, type PreemptionCandidate } from "../../../../../src/scale-ecosystem/resource-manager/preemption/index.js";
import { isQuotaExceeded, evaluateQuota, type QuotaPolicy } from "../../../../../src/scale-ecosystem/resource-manager/quota-enforcer/index.js";

test("FairSchedulingService schedules request with no preemption needed [fair-scheduling-service]", () => {
  const service = new FairSchedulingService();
  const schedulingClass: SchedulingClass = {
    tenantId: "tenant-1",
    orgNodeId: null,
    domainId: "domain-1",
    slaTierId: "standard",
    priority: 5,
  };

  const claim: ResourceClaim = {
    claimId: "claim-1",
    schedulingClass,
    requestedUnits: 10,
  };

  const quotaPolicy: QuotaPolicy = {
    scopeId: "tenant-1",
    resourceType: "runtime_units",
    hardLimit: 100,
    softLimit: 80,
    currentUsage: 50,
  };

  const queueItems: FairQueueItem[] = [
    { itemId: "item-1", tenantId: "tenant-1", priority: 5, ageMs: 60_000 },
    { itemId: "item-2", tenantId: "tenant-1", priority: 3, ageMs: 120_000 },
  ];

  const preemptionCandidates: PreemptionCandidate[] = [];

  const request: FairSchedulingRequest = {
    quotaPolicy,
    claim,
    queueItems,
    preemptionCandidates,
  };

  const decision = service.schedule(request);

  assert.strictEqual(decision.queue.quotaExceeded, false);
  assert.strictEqual(decision.preemption.shouldPreempt, false);
  assert.strictEqual(decision.preemption.victimExecutionId, null);
  assert.strictEqual(decision.preemption.reason, null);
});

test("FairSchedulingService detects quota exceeded and selects victim [fair-scheduling-service]", () => {
  const service = new FairSchedulingService();
  const schedulingClass: SchedulingClass = {
    tenantId: "tenant-1",
    domainId: "domain-1",
    slaTierId: "standard",
    priority: 5,
  };

  const claim: ResourceClaim = {
    claimId: "claim-1",
    schedulingClass,
    requestedUnits: 60,
  };

  const quotaPolicy: QuotaPolicy = {
    scopeId: "tenant-1",
    resourceType: "runtime_units",
    hardLimit: 100,
    softLimit: 80,
    currentUsage: 50,
  };

  const queueItems: FairQueueItem[] = [
    { itemId: "item-1", tenantId: "tenant-1", priority: 5, ageMs: 60_000 },
  ];

  const checkpointAt = Date.now();
  const preemptionCandidates: PreemptionCandidate[] = [
    { executionId: "exec-1", priority: 1, progressPercent: 90, lastCheckpointTimestampMs: checkpointAt },
    { executionId: "exec-2", priority: 2, progressPercent: 50, lastCheckpointTimestampMs: checkpointAt },
  ];

  const request: FairSchedulingRequest = {
    quotaPolicy,
    claim,
    queueItems,
    preemptionCandidates,
  };

  const decision = service.schedule(request);

  assert.strictEqual(decision.queue.quotaExceeded, true);
  assert.strictEqual(decision.preemption.shouldPreempt, true);
  assert.strictEqual(decision.preemption.victimExecutionId, "exec-1");
  assert.strictEqual(decision.preemption.reason, "resource_manager.quota_exceeded_preempt_low_priority");
});

test("FairSchedulingService identifies starved items by age [fair-scheduling-service]", () => {
  const service = new FairSchedulingService();
  const schedulingClass: SchedulingClass = {
    tenantId: "tenant-1",
    domainId: "domain-1",
    slaTierId: "standard",
    priority: 5,
  };

  const claim: ResourceClaim = {
    claimId: "claim-1",
    schedulingClass,
    requestedUnits: 10,
  };

  const quotaPolicy: QuotaPolicy = {
    scopeId: "tenant-1",
    resourceType: "runtime_units",
    hardLimit: 100,
    currentUsage: 50,
  };

  const queueItems: FairQueueItem[] = [
    { itemId: "item-new", tenantId: "tenant-1", priority: 5, ageMs: 30_000 },
    { itemId: "item-starved", tenantId: "tenant-1", priority: 5, ageMs: 16 * 60_000 },
  ];

  const request: FairSchedulingRequest = {
    quotaPolicy,
    claim,
    queueItems,
    preemptionCandidates: [],
  };

  const decision = service.schedule(request);

  assert.deepStrictEqual(decision.queue.starvedItemIds, ["item-starved"]);
});

test("orderFairQueue sorts items by priority and age score [fair-scheduling-service]", () => {
  const items: FairQueueItem[] = [
    { itemId: "low-priority", tenantId: "t1", priority: 1, ageMs: 0 },
    { itemId: "high-priority", tenantId: "t1", priority: 10, ageMs: 0 },
    { itemId: "medium-priority", tenantId: "t1", priority: 5, ageMs: 0 },
  ];

  const ordered = orderFairQueue(items);

  assert.strictEqual(ordered[0]!.itemId, "low-priority");
  assert.strictEqual(ordered[1]!.itemId, "medium-priority");
  assert.strictEqual(ordered[2]!.itemId, "high-priority");
});

test("orderFairQueue prioritizes older items within same priority [fair-scheduling-service]", () => {
  const items: FairQueueItem[] = [
    { itemId: "newer", tenantId: "t1", priority: 5, ageMs: 60_000 },
    { itemId: "older", tenantId: "t1", priority: 5, ageMs: 300_000 },
  ];

  const ordered = orderFairQueue(items);

  assert.strictEqual(ordered[0]!.itemId, "newer");
  assert.strictEqual(ordered[1]!.itemId, "older");
});

test("orderFairQueue caps age score at 9 to prevent overflow [fair-scheduling-service]", () => {
  const items: FairQueueItem[] = [
    { itemId: "very-old", tenantId: "t1", priority: 5, ageMs: 600_000 },
    { itemId: "max-age", tenantId: "t1", priority: 5, ageMs: 600_000 },
  ];

  const ordered = orderFairQueue(items);

  assert.strictEqual(ordered.length, 2);
});

test("choosePreemptionVictim selects lowest priority candidate [fair-scheduling-service]", () => {
  const checkpointAt = Date.now();
  const candidates: PreemptionCandidate[] = [
    { executionId: "high-priority", priority: 10, progressPercent: 50, lastCheckpointTimestampMs: checkpointAt },
    { executionId: "low-priority", priority: 1, progressPercent: 30, lastCheckpointTimestampMs: checkpointAt },
    { executionId: "medium-priority", priority: 5, progressPercent: 70, lastCheckpointTimestampMs: checkpointAt },
  ];

  const victim = choosePreemptionVictim(candidates);

  assert.strictEqual(victim?.executionId, "low-priority");
});

test("choosePreemptionVictim breaks tie by progress percent [fair-scheduling-service]", () => {
  const checkpointAt = Date.now();
  const candidates: PreemptionCandidate[] = [
    { executionId: "less-progress", priority: 3, progressPercent: 20, lastCheckpointTimestampMs: checkpointAt },
    { executionId: "more-progress", priority: 3, progressPercent: 80, lastCheckpointTimestampMs: checkpointAt },
  ];

  const victim = choosePreemptionVictim(candidates);

  assert.strictEqual(victim?.executionId, "more-progress");
});

test("choosePreemptionVictim returns null for empty array [fair-scheduling-service]", () => {
  const victims: PreemptionCandidate[] = [];

  const victim = choosePreemptionVictim(victims);

  assert.strictEqual(victim, null);
});

test("isQuotaExceeded returns true when projected usage exceeds limit [fair-scheduling-service]", () => {
  const policy: QuotaPolicy = {
    scopeId: "tenant-1",
    resourceType: "runtime_units",
    hardLimit: 100,
    currentUsage: 90,
  };

  const exceeded = isQuotaExceeded(policy, 20);

  assert.strictEqual(exceeded, true);
});

test("isQuotaExceeded returns false when within limit [fair-scheduling-service]", () => {
  const policy: QuotaPolicy = {
    scopeId: "tenant-1",
    resourceType: "runtime_units",
    hardLimit: 100,
    currentUsage: 50,
  };

  const exceeded = isQuotaExceeded(policy, 30);

  assert.strictEqual(exceeded, false);
});

test("evaluateQuota calculates correct warning state [fair-scheduling-service]", () => {
  const policy: QuotaPolicy = {
    scopeId: "tenant-1",
    resourceType: "runtime_units",
    hardLimit: 100,
    softLimit: 80,
    currentUsage: 70,
  };

  const decision = evaluateQuota(policy, 15);

  assert.strictEqual(decision.warning, true);
  assert.strictEqual(decision.exceeded, false);
});

test("evaluateQuota calculates usesBurst correctly [fair-scheduling-service]", () => {
  const policy: QuotaPolicy = {
    scopeId: "tenant-1",
    resourceType: "runtime_units",
    hardLimit: 100,
    softLimit: 80,
    burstLimit: 120,
    currentUsage: 90,
  };

  const decision = evaluateQuota(policy, 20);

  assert.strictEqual(decision.usesBurst, true);
  assert.strictEqual(decision.exceeded, false);
});

test("evaluateQuota calculates remaining units correctly [fair-scheduling-service]", () => {
  const policy: QuotaPolicy = {
    scopeId: "tenant-1",
    resourceType: "runtime_units",
    hardLimit: 100,
    burstLimit: 150,
    currentUsage: 50,
  };

  const decision = evaluateQuota(policy, 30);

  assert.strictEqual(decision.remainingUnits, 70);
});

test("FairSchedulingService returns ordered item IDs in queue snapshot [fair-scheduling-service]", () => {
  const service = new FairSchedulingService();
  const schedulingClass: SchedulingClass = {
    tenantId: "tenant-1",
    domainId: "domain-1",
    slaTierId: "standard",
    priority: 5,
  };

  const claim: ResourceClaim = {
    claimId: "claim-1",
    schedulingClass,
    requestedUnits: 10,
  };

  const quotaPolicy: QuotaPolicy = {
    scopeId: "tenant-1",
    resourceType: "runtime_units",
    hardLimit: 100,
    currentUsage: 50,
  };

  const queueItems: FairQueueItem[] = [
    { itemId: "item-a", tenantId: "tenant-1", priority: 2, ageMs: 60_000 },
    { itemId: "item-b", tenantId: "tenant-1", priority: 8, ageMs: 60_000 },
  ];

  const request: FairSchedulingRequest = {
    quotaPolicy,
    claim,
    queueItems,
    preemptionCandidates: [],
  };

  const decision = service.schedule(request);

  assert.deepStrictEqual(decision.queue.orderedItemIds, ["item-a", "item-b"]);
});

test("FairSchedulingService handles empty queue items [fair-scheduling-service]", () => {
  const service = new FairSchedulingService();
  const schedulingClass: SchedulingClass = {
    tenantId: "tenant-1",
    domainId: "domain-1",
    slaTierId: "standard",
    priority: 5,
  };

  const claim: ResourceClaim = {
    claimId: "claim-1",
    schedulingClass,
    requestedUnits: 10,
  };

  const quotaPolicy: QuotaPolicy = {
    scopeId: "tenant-1",
    resourceType: "runtime_units",
    hardLimit: 100,
    currentUsage: 50,
  };

  const request: FairSchedulingRequest = {
    quotaPolicy,
    claim,
    queueItems: [],
    preemptionCandidates: [],
  };

  const decision = service.schedule(request);

  assert.deepStrictEqual(decision.queue.orderedItemIds, []);
  assert.deepStrictEqual(decision.queue.starvedItemIds, []);
});
