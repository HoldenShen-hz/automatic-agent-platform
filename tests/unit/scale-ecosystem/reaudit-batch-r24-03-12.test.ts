import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { PackSecurityService } from "../../../src/scale-ecosystem/marketplace/pack-security-service.js";
import { ResourcePoolService } from "../../../src/scale-ecosystem/resource-manager/resource-pool-service.js";
import { orderFairQueue, type FairQueueItem } from "../../../src/scale-ecosystem/resource-manager/fair-queue/index.js";
import { evaluateQuota, evaluateMultiDimensionalQuota } from "../../../src/scale-ecosystem/resource-manager/quota-enforcer/index.js";
import { SlaOperationsService } from "../../../src/scale-ecosystem/sla-engine/sla-operations-service.js";
import { resolveHighestPriorityTier } from "../../../src/scale-ecosystem/sla-engine/tier-resolver/index.js";
import { allocateReservedCapacity } from "../../../src/scale-ecosystem/sla-engine/resource-allocator/index.js";
import { FairSchedulingService } from "../../../src/scale-ecosystem/resource-manager/fair-scheduling-service.js";

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

test("PackSecurityService scans actual sourceCode instead of only scanning the URI string", async () => {
  const service = new PackSecurityService();
  const benignUri = "registry://packs/analytics";
  const maliciousSource = "export const payload = user; exec(user)";

  const result = await service.runSecurityScan({
    packId: "pack-r24-03",
    version: "1.0.0",
    sourceUri: benignUri,
    sourceCode: maliciousSource,
    manifestChecksum: sha256(maliciousSource),
    capabilities: ["reporting"],
    permissions: ["read.audit"],
  });

  assert.equal(result.issues.some((issue) => issue.code === "SAND001"), true);
});

test("PackSecurityService performs dependency vulnerability scanning", () => {
  const service = new PackSecurityService();
  const vulnerabilities = service.scanDependencyVulnerabilities([
    { packId: "axios", version: "0.21.1", capabilities: [] },
    { packId: "lodash", version: "4.17.20", capabilities: [] },
  ]);

  assert.equal(vulnerabilities[0]!.vulnerabilities.length > 0, true);
  assert.equal(vulnerabilities[1]!.vulnerabilities.length > 0, true);
});

test("ResourcePoolService exposes per-consumer allocation breakdown", () => {
  const service = new ResourcePoolService();
  service.registerPool({
    poolId: "pool-r24-05",
    resourceType: "compute_units",
    capacityUnits: 100,
    allocatedUnits: 0,
    burstUnits: 0,
  });
  service.allocate("pool-r24-05", "consumer-a", 10);
  service.allocate("pool-r24-05", "consumer-b", 25);

  const allocations = service.getConsumerAllocations("pool-r24-05");

  assert.deepEqual(allocations, [
    { poolId: "pool-r24-05", consumerId: "consumer-a", allocatedUnits: 10 },
    { poolId: "pool-r24-05", consumerId: "consumer-b", allocatedUnits: 25 },
  ]);
});

test("orderFairQueue ordering is score-driven, not orgId lexicographic", () => {
  const items: FairQueueItem[] = [
    { itemId: "low", tenantId: "tenant", orgId: "aaa", priority: 1, ageMs: 0, slaTier: 1 },
    { itemId: "high", tenantId: "tenant", orgId: "zzz", priority: 10, ageMs: 0, slaTier: 2 },
  ];

  const sorted = orderFairQueue(items);

  assert.equal(sorted[0]!.itemId, "high");
  assert.equal(sorted[1]!.itemId, "low");
});

test("evaluateQuota marks burst usage before the explicit burstLimit is exceeded", () => {
  const decision = evaluateQuota({
    hardLimit: 100,
    softLimit: 80,
    burstLimit: 150,
    currentUsage: 95,
  }, 10);

  assert.equal(decision.exceeded, false);
  assert.equal(decision.usesBurst, true);
});

test("SlaOperationsService produces concrete penalty decisions with credit amount and audit description", () => {
  const service = new SlaOperationsService();
  const decision = service.evaluate({
    tiers: [{
      tierId: "gold",
      displayName: "Gold",
      priority: 1,
      targetLatencyMs: 500,
      targetSuccessRate: 0.99,
      maxQueueWaitMs: 1000,
      preemptionPriority: 10,
      reservedCapacityPercent: 20,
      budgetAllocationPercent: 40,
    }],
    selectedTierId: "gold",
    workflowClass: "deterministic",
    observation: {
      latencyMs: 900,
      successRate: 0.999,
      queueWaitMs: 500,
    },
    totalCapacityUnits: 100,
    observedAt: "2026-05-01T00:00:00.000Z",
  });

  assert.equal(decision.penaltyDecisions.length, 1);
  assert.equal(decision.penaltyDecisions[0]!.penaltyType, "credit");
  assert.equal((decision.penaltyDecisions[0]!.creditAmount ?? 0) > 0, true);
  assert.equal(typeof decision.penaltyDecisions[0]!.description, "string");
});

test("resolveHighestPriorityTier supports tenant-aware tier resolution", () => {
  const selected = resolveHighestPriorityTier([
    { tierId: "global", displayName: "Global", priority: 1 },
    { tierId: "tenant-specific", tenantId: "tenant-a", displayName: "Tenant A", priority: 10 },
    { tierId: "other-tenant", tenantId: "tenant-b", displayName: "Tenant B", priority: 20 },
  ], "tenant-a");

  assert.equal(selected?.tierId, "tenant-specific");
});

test("SlaOperationsService preemptionCapApplied is derived from the selected tier priority, not a hard-coded true", () => {
  const service = new SlaOperationsService();
  const lowTierDecision = service.evaluate({
    tiers: [
      { tierId: "gold", displayName: "Gold", priority: 10, preemptionPriority: 10 },
      { tierId: "silver", displayName: "Silver", priority: 5, preemptionPriority: 1 },
    ],
    selectedTierId: "silver",
    workflowClass: "deterministic",
    observation: { latencyMs: 100, successRate: 1, queueWaitMs: 100 },
    totalCapacityUnits: 10,
    observedAt: "2026-05-01T00:00:00.000Z",
  });

  assert.equal(lowTierDecision.preemptionCapApplied, false);
});

test("allocateReservedCapacity rejects over-allocation above 100 percent", () => {
  assert.throws(() => {
    allocateReservedCapacity(100, [
      { tierId: "gold", reservedPercent: 60 },
      { tierId: "silver", reservedPercent: 50 },
    ]);
  }, /total_reserved_exceeds_100/);
});

test("FairSchedulingService only preempts once quota is actually exceeded", () => {
  const service = new FairSchedulingService();
  const decision = service.schedule({
    quotaPolicy: {
      scope: "tenant",
      scopeId: "tenant-r24-12",
      workerUnits: {
        hardLimit: 100,
        softLimit: 90,
        burstLimit: 150,
        currentUsage: 95,
      },
    },
    claim: {
      claimId: "claim-r24-12",
      schedulingClass: {
        tenantId: "tenant-r24-12",
        domainId: "ops",
        slaTierId: "gold",
        priority: 10,
      },
      requestedUnits: 10,
    },
    queueItems: [],
    preemptionCandidates: [{
      executionId: "victim-r24-12",
      priority: 1,
      progressPercent: 10,
      lastCheckpointTimestampMs: Date.now(),
    }],
  });

  assert.equal(decision.queue.quotaExceeded, false);
  assert.equal(decision.preemption.shouldPreempt, false);
});

test("evaluateMultiDimensionalQuota surfaces burst usage before the explicit burstLimit is exceeded", () => {
  const decision = evaluateMultiDimensionalQuota({
    scope: "tenant",
    scopeId: "tenant-multi",
    workerUnits: {
      hardLimit: 100,
      softLimit: 80,
      burstLimit: 140,
      currentUsage: 95,
    },
  }, {
    workerUnits: 10,
  });

  assert.equal(decision.exceeded, false);
  assert.equal(decision.usesBurst, true);
  assert.deepEqual(decision.exceededDimensions, []);
});
