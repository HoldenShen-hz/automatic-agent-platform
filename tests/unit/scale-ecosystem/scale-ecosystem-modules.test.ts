/**
 * Unit tests for scale-ecosystem modules covering:
 * 1. Multi-region routing
 * 2. Fair scheduling
 * 3. SLA tracking
 * 4. Connectors
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  CrossRegionRoutingService,
  type CrossRegionRouteRequest,
  type ResidencyPolicy,
} from "../../../src/scale-ecosystem/multi-region/cross-region-routing-service.js";
import {
  selectPreferredRegion,
  type RegionDescriptor,
} from "../../../src/scale-ecosystem/multi-region/region-router/index.js";
import {
  resolveRegionFailover,
  getNextFencingEpoch,
  type RegionFailoverInput,
} from "../../../src/scale-ecosystem/multi-region/failover-controller/index.js";
import { shouldReplicateToRegion } from "../../../src/scale-ecosystem/multi-region/data-replicator/index.js";
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
  isQuotaExceeded,
  evaluateQuota,
  evaluateMultiDimensionalQuota,
  type QuotaPolicy,
} from "../../../src/scale-ecosystem/resource-manager/quota-enforcer/index.js";
import {
  choosePreemptionVictim,
  type PreemptionCandidate,
} from "../../../src/scale-ecosystem/resource-manager/preemption/index.js";
import { ResourcePoolService } from "../../../src/scale-ecosystem/resource-manager/resource-pool-service.js";
import {
  SlaOperationsService,
  type SlaTierProfile,
  type SlaObservation,
} from "../../../src/scale-ecosystem/sla-engine/sla-operations-service.js";
import {
  detectSlaBreach,
  type SlaCommitment,
} from "../../../src/scale-ecosystem/sla-engine/breach-detector/index.js";
import {
  resolveHighestPriorityTier,
} from "../../../src/scale-ecosystem/sla-engine/tier-resolver/index.js";
import {
  allocateReservedCapacity,
  type ReservedCapacityAllocation,
} from "../../../src/scale-ecosystem/sla-engine/resource-allocator/index.js";
import {
  ConnectorFrameworkService,
  type ConnectorManifest,
} from "../../../src/scale-ecosystem/integration/connector-framework-service.js";
import {
  ConnectorManifestSchema,
  listEnabledConnectors,
} from "../../../src/scale-ecosystem/integration/connector-registry/index.js";
import {
  buildConnectorExecutionKey,
  ConnectorExecutionRequestSchema,
} from "../../../src/scale-ecosystem/integration/connector-runtime/index.js";
import {
  summarizeConnectorHealth,
  type ConnectorHealthReport,
} from "../../../src/scale-ecosystem/integration/health-monitor/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Factories
// ─────────────────────────────────────────────────────────────────────────────

function createRegion(overrides: Partial<RegionDescriptor> = {}): RegionDescriptor {
  return {
    regionId: overrides.regionId ?? "region-1",
    provider: overrides.provider ?? "aws",
    endpoints: overrides.endpoints ?? { api: "https://region-1.example.com" },
    dataResidencyPolicy: overrides.dataResidencyPolicy ?? "regional",
    countryCode: overrides.countryCode ?? "US",
    jurisdiction: overrides.jurisdiction ?? "US",
    capabilities: overrides.capabilities ?? [],
    status: overrides.status ?? "active",
    latencyScore: overrides.latencyScore ?? 0,
    residencyAllowed: overrides.residencyAllowed ?? true,
  };
}

function createResidencyPolicy(overrides: Partial<ResidencyPolicy> = {}): ResidencyPolicy {
  return {
    policyId: overrides.policyId ?? "policy-1",
    allowedJurisdictions: overrides.allowedJurisdictions ?? ["US", "EU"],
    blockedRegionIds: overrides.blockedRegionIds ?? [],
    requiredCapabilities: overrides.requiredCapabilities ?? [],
    allowCrossBorder: overrides.allowCrossBorder ?? false,
  };
}

function createQueueItem(overrides: Partial<FairQueueItem> = {}): FairQueueItem {
  return {
    itemId: overrides.itemId ?? "item-1",
    tenantId: overrides.tenantId ?? "tenant-1",
    orgId: overrides.orgId,
    domainId: overrides.domainId,
    slaTier: overrides.slaTier,
    priority: overrides.priority ?? 5,
    ageMs: overrides.ageMs ?? 0,
  };
}

function createQuotaPolicy(overrides: Partial<QuotaPolicy> = {}): QuotaPolicy {
  return {
    scopeId: overrides.scopeId ?? "tenant-1",
    resourceType: overrides.resourceType ?? "runtime_units",
    hardLimit: overrides.hardLimit ?? 100,
    softLimit: overrides.softLimit ?? 80,
    burstLimit: overrides.burstLimit ?? 120,
    resetWindow: overrides.resetWindow ?? "1h",
    currentUsage: overrides.currentUsage ?? 50,
    ...overrides,
  };
}

function createPreemptionCandidate(overrides: Partial<PreemptionCandidate> = {}): PreemptionCandidate {
  return {
    executionId: overrides.executionId ?? "exec-1",
    priority: overrides.priority ?? 3,
    progressPercent: overrides.progressPercent ?? 50,
  };
}

function createSchedulingClass(overrides: Partial<SchedulingClass> = {}): SchedulingClass {
  return {
    tenantId: overrides.tenantId ?? "tenant-1",
    orgNodeId: overrides.orgNodeId ?? null,
    domainId: overrides.domainId ?? "domain-1",
    slaTierId: overrides.slaTierId ?? "gold",
    priority: overrides.priority ?? 5,
  };
}

function createSlaTierProfile(overrides: Partial<SlaTierProfile> = {}): SlaTierProfile {
  return {
    tierId: overrides.tierId ?? "standard",
    displayName: overrides.displayName ?? "Standard",
    priority: overrides.priority ?? 1,
    availability: overrides.availability ?? 0.999,
    targetLatencyMs: overrides.targetLatencyMs ?? 1000,
    targetSuccessRate: overrides.targetSuccessRate ?? 0.99,
    maxQueueWaitMs: overrides.maxQueueWaitMs ?? 3000,
    preemptionPriority: overrides.preemptionPriority ?? 0,
    reservedCapacityPercent: overrides.reservedCapacityPercent ?? 0,
  };
}

function createManifest(lifecycleState: ConnectorManifest["lifecycleState"] = "enabled", extra: Partial<ConnectorManifest> = {}): ConnectorManifest {
  return {
    connectorId: extra.connectorId ?? "test_connector",
    provider: extra.provider ?? "test_provider",
    capabilities: extra.capabilities ?? ["read", "write"],
    lifecycleState,
    ...extra,
  };
}

function createScheduleRequest(overrides: Partial<FairSchedulingRequest> = {}): FairSchedulingRequest {
  const claim: ResourceClaim = {
    claimId: "claim-1",
    schedulingClass: createSchedulingClass(),
    requestedUnits: overrides.claim?.requestedUnits ?? 10,
    ...overrides.claim,
  };
  return {
    quotaPolicy: createQuotaPolicy(),
    claim,
    queueItems: overrides.queueItems ?? [],
    preemptionCandidates: overrides.preemptionCandidates ?? [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Multi-region routing tests
// ─────────────────────────────────────────────────────────────────────────────

test("selectPreferredRegion returns lowest latency active region", () => {
  const regions = [
    createRegion({ regionId: "us-east", latencyScore: 50 }),
    createRegion({ regionId: "us-west", latencyScore: 30 }),
    createRegion({ regionId: "eu-west", latencyScore: 80 }),
  ];

  const selected = selectPreferredRegion(regions);

  assert.equal(selected?.regionId, "us-west");
});

test("selectPreferredRegion excludes draining regions", () => {
  const regions = [
    createRegion({ regionId: "us-east", latencyScore: 10, status: "draining" }),
    createRegion({ regionId: "eu-west", latencyScore: 50, status: "active" }),
  ];

  const selected = selectPreferredRegion(regions);

  assert.equal(selected?.regionId, "eu-west");
});

test("selectPreferredRegion excludes regions with residencyAllowed false", () => {
  const regions = [
    createRegion({ regionId: "us-east", latencyScore: 10, residencyAllowed: false }),
    createRegion({ regionId: "eu-west", latencyScore: 50, residencyAllowed: true }),
  ];

  const selected = selectPreferredRegion(regions);

  assert.equal(selected?.regionId, "eu-west");
});

test("selectPreferredRegion returns null for empty array", () => {
  const selected = selectPreferredRegion([]);
  assert.equal(selected, null);
});

test("CrossRegionRoutingService.route selects lowest latency region", () => {
  const service = new CrossRegionRoutingService();
  const regions = [
    createRegion({ regionId: "us-east", latencyScore: 30 }),
    createRegion({ regionId: "eu-west", latencyScore: 80 }),
  ];

  const decision = service.route({
    regions,
    policy: createResidencyPolicy(),
    primaryRegionId: "us-east",
    primaryRegionHealthy: true,
  });

  assert.equal(decision.selectedRegionId, "us-east");
  assert.equal(decision.residencyDecision, "allowed");
});

test("CrossRegionRoutingService.route respects blockedRegionIds", () => {
  const service = new CrossRegionRoutingService();
  const regions = [
    createRegion({ regionId: "us-east", latencyScore: 10 }),
    createRegion({ regionId: "eu-west", latencyScore: 20 }),
  ];

  const decision = service.route({
    regions,
    policy: createResidencyPolicy({ blockedRegionIds: ["us-east"] }),
    primaryRegionId: "us-east",
    primaryRegionHealthy: true,
  });

  assert.ok(decision.blockedRegions.includes("us-east"));
  assert.equal(decision.selectedRegionId, "eu-west");
});

test("CrossRegionRoutingService.route respects allowedJurisdictions", () => {
  const regions = [
    createRegion({ regionId: "us-east", jurisdiction: "US", latencyScore: 10 }),
    createRegion({ regionId: "cn-north", jurisdiction: "CN", latencyScore: 5 }),
  ];

  const decision = new CrossRegionRoutingService().route({
    regions,
    policy: createResidencyPolicy({ allowedJurisdictions: ["US"] }),
    primaryRegionId: "us-east",
    primaryRegionHealthy: true,
  });

  assert.ok(decision.blockedRegions.includes("cn-north"));
  assert.equal(decision.selectedRegionId, "us-east");
});

test("CrossRegionRoutingService.route requires capabilities when specified", () => {
  const regions = [
    createRegion({ regionId: "us-east", capabilities: ["llm", "storage"] }),
    createRegion({ regionId: "eu-west", capabilities: ["storage"] }),
  ];

  const decision = new CrossRegionRoutingService().route({
    regions,
    policy: createResidencyPolicy({ requiredCapabilities: ["llm"] }),
    primaryRegionId: "us-east",
    primaryRegionHealthy: true,
  });

  assert.ok(decision.blockedRegions.includes("eu-west"));
  assert.equal(decision.selectedRegionId, "us-east");
});

test("CrossRegionRoutingService.route blocks unhealthy primary", () => {
  const regions = [
    createRegion({ regionId: "us-east", latencyScore: 10 }),
    createRegion({ regionId: "eu-west", latencyScore: 20 }),
  ];

  const decision = new CrossRegionRoutingService().route({
    regions,
    policy: createResidencyPolicy(),
    primaryRegionId: "us-east",
    primaryRegionHealthy: false,
  });

  assert.ok(decision.blockedRegions.includes("us-east"));
  assert.equal(decision.selectedRegionId, "eu-west");
});

test("CrossRegionRoutingService.route returns blocked when no valid region", () => {
  const regions = [
    createRegion({ regionId: "cn-north", jurisdiction: "CN", status: "disabled" }),
  ];

  const decision = new CrossRegionRoutingService().route({
    regions,
    policy: createResidencyPolicy({ allowedJurisdictions: ["US"] }),
    primaryRegionId: "cn-north",
    primaryRegionHealthy: true,
  });

  assert.equal(decision.residencyDecision, "blocked");
  assert.equal(decision.selectedRegionId, null);
});

test("CrossRegionRoutingService.route uses preferredRegionId over latency", () => {
  const regions = [
    createRegion({ regionId: "us-east", latencyScore: 10 }),
    createRegion({ regionId: "eu-west", latencyScore: 5 }),
  ];

  const decision = new CrossRegionRoutingService().route({
    regions,
    policy: createResidencyPolicy(),
    primaryRegionId: "us-east",
    preferredRegionId: "eu-west",
    primaryRegionHealthy: true,
  });

  assert.equal(decision.selectedRegionId, "eu-west");
});

test("resolveRegionFailover returns no failover when primary healthy", () => {
  const decision = resolveRegionFailover({
    primaryHealthy: true,
    candidateRegionIds: ["eu-west"],
  });

  assert.equal(decision.shouldFailover, false);
  assert.equal(decision.rationale, "multi_region.primary_within_threshold");
});

test("resolveRegionFailover triggers failover on unhealthy primary", () => {
  const decision = resolveRegionFailover({
    primaryHealthy: false,
    candidateRegionIds: ["eu-west"],
  });

  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.targetRegionId, "eu-west");
  assert.equal(decision.rationale, "multi_region.primary_unhealthy");
});

test("resolveRegionFailover triggers on latency breach", () => {
  const decision = resolveRegionFailover({
    primaryHealthy: true,
    primaryLatencyMs: 300,
    maxAcceptableLatencyMs: 200,
    candidateRegionIds: ["eu-west"],
  });

  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.rationale, "multi_region.primary_latency_breached");
});

test("resolveRegionFailover triggers on error rate breach", () => {
  const decision = resolveRegionFailover({
    primaryHealthy: true,
    primaryErrorRate: 0.1,
    maxAcceptableErrorRate: 0.05,
    candidateRegionIds: ["eu-west"],
  });

  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.rationale, "multi_region.primary_error_rate_breached");
});

test("resolveRegionFailover uses preferredRegionId when available", () => {
  const decision = resolveRegionFailover({
    primaryHealthy: false,
    candidateRegionIds: ["eu-west", "ap-south"],
    preferredRegionId: "ap-south",
  });

  assert.equal(decision.targetRegionId, "ap-south");
});

test("resolveRegionFailover returns no candidate when candidates empty", () => {
  const decision = resolveRegionFailover({
    primaryHealthy: false,
    candidateRegionIds: [],
  });

  assert.equal(decision.shouldFailover, false);
  assert.equal(decision.rationale, "multi_region.no_candidate_available");
});

test("getNextFencingEpoch increments on each call", () => {
  const first = getNextFencingEpoch();
  const second = getNextFencingEpoch();
  const third = getNextFencingEpoch();

  assert.ok(second > first);
  assert.ok(third > second);
});

test("shouldReplicateToRegion respects blocked residency mode", () => {
  const policy = { sourceRegionId: "us-east", targetRegionIds: ["eu-west"], residencyMode: "blocked" as const };

  const result = shouldReplicateToRegion(policy, "eu-west");

  assert.equal(result, false);
});

test("shouldReplicateToRegion allows replication when not blocked", () => {
  const policy = { sourceRegionId: "us-east", targetRegionIds: ["eu-west"], residencyMode: "allowed_cross_border" as const };

  const result = shouldReplicateToRegion(policy, "eu-west");

  assert.equal(result, true);
});

test("shouldReplicateToRegion returns false for non-target region", () => {
  const policy = { sourceRegionId: "us-east", targetRegionIds: ["eu-west"], residencyMode: "same_jurisdiction" as const };

  const result = shouldReplicateToRegion(policy, "ap-south");

  assert.equal(result, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Fair scheduling tests
// ─────────────────────────────────────────────────────────────────────────────

test("FairSchedulingService.schedule orders queue by priority and age", () => {
  const service = new FairSchedulingService();
  const queueItems = [
    createQueueItem({ itemId: "low", priority: 1, ageMs: 0 }),
    createQueueItem({ itemId: "high", priority: 10, ageMs: 0 }),
    createQueueItem({ itemId: "medium-old", priority: 5, ageMs: 10 * 60_000 }),
  ];

  const decision = service.schedule(createScheduleRequest({ queueItems }));

  assert.equal(decision.queue.orderedItemIds[0], "high");
  assert.equal(decision.queue.orderedItemIds[1], "medium-old");
  assert.equal(decision.queue.orderedItemIds[2], "low");
});

test("FairSchedulingService.schedule identifies starved items at 15 minutes", () => {
  const service = new FairSchedulingService();
  const queueItems = [
    createQueueItem({ itemId: "fresh", ageMs: 5 * 60_000 }),
    createQueueItem({ itemId: "starved", ageMs: 16 * 60_000 }),
  ];

  const decision = service.schedule(createScheduleRequest({ queueItems }));

  assert.ok(decision.queue.starvedItemIds.includes("starved"));
  assert.ok(!decision.queue.starvedItemIds.includes("fresh"));
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
});

test("FairSchedulingService.schedule preempts when quota exceeded", () => {
  const service = new FairSchedulingService();
  const candidates = [
    createPreemptionCandidate({ executionId: "high-prio", priority: 10 }),
    createPreemptionCandidate({ executionId: "low-prio", priority: 1 }),
  ];

  // currentUsage 95 + requestedUnits 10 = 105 > burstLimit 100
  const decision = service.schedule(createScheduleRequest({
    quotaPolicy: createQuotaPolicy({ currentUsage: 95, hardLimit: 80, burstLimit: 100 }),
    preemptionCandidates: candidates,
  }));

  assert.equal(decision.queue.quotaExceeded, true);
  assert.equal(decision.preemption.shouldPreempt, true);
  assert.equal(decision.preemption.victimExecutionId, "low-prio");
});

test("FairSchedulingService.schedule reports quota exceeded without victim", () => {
  const service = new FairSchedulingService();
  // currentUsage 95 + requestedUnits 10 = 105 > burstLimit 100
  const decision = service.schedule(createScheduleRequest({
    quotaPolicy: createQuotaPolicy({ currentUsage: 95, hardLimit: 80, burstLimit: 100 }),
    preemptionCandidates: [],
  }));

  assert.equal(decision.queue.quotaExceeded, true);
  assert.equal(decision.preemption.shouldPreempt, false);
  assert.equal(decision.preemption.reason, "resource_manager.quota_exceeded_without_victim");
});

test("orderFairQueue sorts by priority descending", () => {
  const items = [
    createQueueItem({ itemId: "low", priority: 1 }),
    createQueueItem({ itemId: "high", priority: 10 }),
    createQueueItem({ itemId: "medium", priority: 5 }),
  ];

  const ordered = orderFairQueue(items);

  assert.equal(ordered[0]!.itemId, "high");
  assert.equal(ordered[1]!.itemId, "medium");
  assert.equal(ordered[2]!.itemId, "low");
});

test("orderFairQueue considers age in scoring with cap at 99 minutes", () => {
  const items = [
    createQueueItem({ itemId: "new-high", priority: 5, ageMs: 0 }),
    createQueueItem({ itemId: "old-medium", priority: 4, ageMs: 10 * 60_000 }),
  ];

  const ordered = orderFairQueue(items);

  // new-high score: 5*1000 + 5*100 + min(99,0) = 5500
  // old-medium score: 4*1000 + 4*100 + min(99,10) = 4410
  assert.equal(ordered[0]!.itemId, "new-high");
});

test("orderFairQueue handles empty array", () => {
  const ordered = orderFairQueue([]);
  assert.deepEqual(ordered, []);
});

test("orderFairQueue does not modify original array", () => {
  const items = [
    createQueueItem({ itemId: "first", priority: 1 }),
    createQueueItem({ itemId: "second", priority: 2 }),
  ];
  const original = [...items];

  orderFairQueue(items);

  assert.equal(items[0]!.itemId, original[0]!.itemId);
});

test("isQuotaExceeded returns false when within burst limit", () => {
  const policy = createQuotaPolicy({ currentUsage: 50, hardLimit: 100, burstLimit: 120 });
  assert.equal(isQuotaExceeded(policy, 10), false);
});

test("isQuotaExceeded returns true when exceeds burst limit", () => {
  const policy = createQuotaPolicy({ currentUsage: 100, hardLimit: 80, burstLimit: 100 });
  assert.equal(isQuotaExceeded(policy, 10), true);
});

test("evaluateQuota returns correct remaining units", () => {
  const policy = createQuotaPolicy({ currentUsage: 50, hardLimit: 80, burstLimit: 100 });
  const decision = evaluateQuota(policy, 30);

  assert.equal(decision.exceeded, false);
  assert.equal(decision.warning, false);
  assert.equal(decision.remainingUnits, 20);
});

test("evaluateQuota usesBurst when between hard and burst limits", () => {
  const policy = createQuotaPolicy({ currentUsage: 70, softLimit: 60, hardLimit: 80, burstLimit: 100 });
  const decision = evaluateQuota(policy, 20);

  assert.equal(decision.exceeded, false);
  assert.equal(decision.warning, true);
  assert.equal(decision.usesBurst, true);
});

test("choosePreemptionVictim selects lowest priority", () => {
  const candidates = [
    createPreemptionCandidate({ executionId: "high", priority: 10 }),
    createPreemptionCandidate({ executionId: "low", priority: 1 }),
  ];

  const victim = choosePreemptionVictim(candidates);

  assert.equal(victim?.executionId, "low");
});

test("choosePreemptionVictim breaks tie by progressPercent ascending", () => {
  const candidates = [
    createPreemptionCandidate({ executionId: "more-progress", priority: 5, progressPercent: 80 }),
    createPreemptionCandidate({ executionId: "less-progress", priority: 5, progressPercent: 20 }),
  ];

  const victim = choosePreemptionVictim(candidates);

  assert.equal(victim?.executionId, "less-progress");
});

test("choosePreemptionVictim returns null for empty array", () => {
  const victim = choosePreemptionVictim([]);
  assert.equal(victim, null);
});

test("evaluateMultiDimensionalQuota fails dimension that exceeds hard limit", () => {
  const policy = createQuotaPolicy({
    currentUsage: 50,
    hardLimit: 100,
    multiResourceHardLimits: {
      worker_concurrency: 10,
      tool_qps: 100,
      model_tpm: 1000,
      model_rpm: 500,
      budget_amount: 0,
      approval_capacity: 0,
      storage_io: 0,
    },
  });

  const result = evaluateMultiDimensionalQuota(policy, {
    worker_concurrency: 15, // exceeds 10
    tool_qps: 50,
    model_tpm: 500,
    model_rpm: 200,
    budget_amount: 0,
    approval_capacity: 0,
    storage_io: 0,
  });

  assert.equal(result.passed, false);
  assert.ok(result.failedDimensions.includes("worker_concurrency"));
});

test("ResourcePoolService.allocate grants within capacity", () => {
  const service = new ResourcePoolService();
  service.registerPool({ poolId: "pool-1", resourceType: "compute", capacityUnits: 100, allocatedUnits: 0, burstUnits: 20 });

  const allocation = service.allocate("pool-1", "consumer-1", 30);

  assert.equal(allocation.granted, true);
  assert.equal(allocation.poolId, "pool-1");
});

test("ResourcePoolService.allocate denies when exceeded", () => {
  const service = new ResourcePoolService();
  service.registerPool({ poolId: "pool-1", resourceType: "compute", capacityUnits: 100, allocatedUnits: 90, burstUnits: 20 });

  const allocation = service.allocate("pool-1", "consumer-1", 40);

  assert.equal(allocation.granted, false);
  assert.ok(allocation.reasonCodes.includes("resource_pool.capacity_exceeded"));
});

test("ResourcePoolService.release reduces allocated units", () => {
  const service = new ResourcePoolService();
  service.registerPool({ poolId: "pool-1", resourceType: "compute", capacityUnits: 100, allocatedUnits: 50, burstUnits: 20 });

  const updated = service.release("pool-1", 20);

  assert.equal(updated.allocatedUnits, 30);
});

test("ResourcePoolService.release does not go below zero", () => {
  const service = new ResourcePoolService();
  service.registerPool({ poolId: "pool-1", resourceType: "compute", capacityUnits: 100, allocatedUnits: 10, burstUnits: 20 });

  const updated = service.release("pool-1", 50);

  assert.equal(updated.allocatedUnits, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. SLA tracking tests
// ─────────────────────────────────────────────────────────────────────────────

test("SlaOperationsService selects highest priority tier when no tier selected", () => {
  const service = new SlaOperationsService();
  const decision = service.evaluate({
    tiers: [
      createSlaTierProfile({ tierId: "standard", priority: 1 }),
      createSlaTierProfile({ tierId: "enterprise", priority: 3 }),
    ],
    observation: { latencyMs: 100, successRate: 0.99, queueWaitMs: 500 },
    totalCapacityUnits: 100,
    workflowClass: "deterministic",
    observedAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(decision.selectedTierId, "enterprise");
});

test("SlaOperationsService uses selected tier when provided", () => {
  const service = new SlaOperationsService();
  const decision = service.evaluate({
    tiers: [
      createSlaTierProfile({ tierId: "standard", priority: 1 }),
      createSlaTierProfile({ tierId: "enterprise", priority: 3 }),
    ],
    selectedTierId: "standard",
    observation: { latencyMs: 100, successRate: 0.99, queueWaitMs: 500 },
    totalCapacityUnits: 100,
    workflowClass: "deterministic",
    observedAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(decision.selectedTierId, "standard");
});

test("SlaOperationsService records breach when observation exceeds commitment", () => {
  const service = new SlaOperationsService();
  const decision = service.evaluate({
    tiers: [createSlaTierProfile({ tierId: "standard", targetLatencyMs: 200, targetSuccessRate: 0.95 })],
    selectedTierId: "standard",
    observation: { latencyMs: 300, successRate: 0.90, queueWaitMs: 1500 },
    totalCapacityUnits: 100,
    workflowClass: "deterministic",
    observedAt: "2026-04-20T00:00:00.000Z",
  });

  assert.ok(decision.breachRecords.length > 0);
  assert.ok(decision.breachRecords[0]!.breachCodes.includes("sla.latency_breach"));
  assert.ok(decision.breachRecords[0]!.breachCodes.includes("sla.success_rate_breach"));
});

test("SlaOperationsService applies workflow class latency multiplier", () => {
  const service = new SlaOperationsService();
  const tiers = [createSlaTierProfile({ tierId: "standard", targetLatencyMs: 200, priority: 1 })];

  // hitl_waiting has multiplier 2.0, so 200 * 2.0 = 400 max latency
  const decision = service.evaluate({
    tiers,
    selectedTierId: "standard",
    observation: { latencyMs: 350, successRate: 0.99, queueWaitMs: 500 },
    totalCapacityUnits: 100,
    workflowClass: "hitl_waiting",
    observedAt: "2026-04-20T00:00:00.000Z",
  });

  // 350 < 400 (adjusted limit), so no latency breach
  assert.ok(!decision.breachRecords.some(r => r.breachCodes.includes("sla.latency_breach")));
});

test("SlaOperationsService returns null tier when no tiers provided", () => {
  const service = new SlaOperationsService();
  const decision = service.evaluate({
    tiers: [],
    observation: { latencyMs: 100, successRate: 0.99, queueWaitMs: 500 },
    totalCapacityUnits: 100,
    workflowClass: "deterministic",
    observedAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(decision.selectedTierId, null);
  assert.equal(decision.routingHint, null);
});

test("detectSlaBreach returns empty array when no breaches", () => {
  const observation: SlaObservation = { latencyMs: 100, successRate: 0.99, queueWaitMs: 500 };
  const commitment: SlaCommitment = { maxLatencyMs: 200, minSuccessRate: 0.95, maxQueueWaitMs: 1000 };

  const breaches = detectSlaBreach(observation, commitment);

  assert.deepEqual(breaches, []);
});

test("detectSlaBreach detects latency breach", () => {
  const observation: SlaObservation = { latencyMs: 300, successRate: 0.99, queueWaitMs: 500 };
  const commitment: SlaCommitment = { maxLatencyMs: 200, minSuccessRate: 0.95, maxQueueWaitMs: 1000 };

  const breaches = detectSlaBreach(observation, commitment);

  assert.ok(breaches.includes("sla.latency_breach"));
});

test("detectSlaBreach detects success rate breach", () => {
  const observation: SlaObservation = { latencyMs: 100, successRate: 0.90, queueWaitMs: 500 };
  const commitment: SlaCommitment = { maxLatencyMs: 200, minSuccessRate: 0.95, maxQueueWaitMs: 1000 };

  const breaches = detectSlaBreach(observation, commitment);

  assert.ok(breaches.includes("sla.success_rate_breach"));
});

test("detectSlaBreach detects queue wait breach", () => {
  const observation: SlaObservation = { latencyMs: 100, successRate: 0.99, queueWaitMs: 1500 };
  const commitment: SlaCommitment = { maxLatencyMs: 200, minSuccessRate: 0.95, maxQueueWaitMs: 1000 };

  const breaches = detectSlaBreach(observation, commitment);

  assert.ok(breaches.includes("sla.queue_wait_breach"));
});

test("detectSlaBreach returns multiple breaches", () => {
  const observation: SlaObservation = { latencyMs: 300, successRate: 0.90, queueWaitMs: 1500 };
  const commitment: SlaCommitment = { maxLatencyMs: 200, minSuccessRate: 0.95, maxQueueWaitMs: 1000 };

  const breaches = detectSlaBreach(observation, commitment);

  assert.equal(breaches.length, 3);
});

test("resolveHighestPriorityTier returns highest priority tier", () => {
  const tiers = [
    createSlaTierProfile({ tierId: "basic", priority: 0 }),
    createSlaTierProfile({ tierId: "standard", priority: 2 }),
    createSlaTierProfile({ tierId: "premium", priority: 5 }),
  ];

  const result = resolveHighestPriorityTier(tiers);

  assert.equal(result?.tierId, "premium");
});

test("resolveHighestPriorityTier returns null for empty array", () => {
  const result = resolveHighestPriorityTier([]);
  assert.equal(result, null);
});

test("allocateReservedCapacity calculates correct allocation", () => {
  const allocations: ReservedCapacityAllocation[] = [
    { tierId: "enterprise", reservedPercent: 40 },
    { tierId: "standard", reservedPercent: 20 },
  ];

  const result = allocateReservedCapacity(100, allocations);

  assert.equal(result["enterprise"], 40);
  assert.equal(result["standard"], 20);
});

test("allocateReservedCapacity handles zero total units", () => {
  const allocations: ReservedCapacityAllocation[] = [{ tierId: "enterprise", reservedPercent: 40 }];

  const result = allocateReservedCapacity(0, allocations);

  assert.equal(result["enterprise"], 0);
});

test("allocateReservedCapacity returns empty for empty allocations", () => {
  const result = allocateReservedCapacity(100, []);
  assert.deepEqual(result, {});
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Connector tests
// ─────────────────────────────────────────────────────────────────────────────

test("ConnectorFrameworkService.register stores manifest", () => {
  const service = new ConnectorFrameworkService();
  const manifest = createManifest("enabled");

  const registered = service.register(manifest);

  assert.equal(registered.connectorId, manifest.connectorId);
  assert.equal(service.getManifest(manifest.connectorId)?.connectorId, manifest.connectorId);
});

test("ConnectorFrameworkService.bind creates binding for prod with verified connector", () => {
  const service = new ConnectorFrameworkService();
  service.register(createManifest("verified"));

  const binding = service.bind("test_connector", "tenant-1", "prod", "2026-04-20T00:00:00.000Z");

  assert.equal(binding.connectorId, "test_connector");
  assert.equal(binding.tenantId, "tenant-1");
  assert.equal(binding.environment, "prod");
});

test("ConnectorFrameworkService.bind throws for prod with non-verified connector", () => {
  const service = new ConnectorFrameworkService();
  service.register(createManifest("configured"));

  assert.throws(() => {
    service.bind("test_connector", "tenant-1", "prod");
  }, /connector_framework\.prod_requires_verified/);
});

test("ConnectorFrameworkService.execute returns failed for missing secretBindings", () => {
  const service = new ConnectorFrameworkService();
  service.register(createManifest("enabled"));

  const result = service.execute({
    connectorId: "test_connector",
    capability: "sync",
    payload: {},
  }, {
    environment: "prod",
  });

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("ConnectorFrameworkService.execute returns failed for unsupported event type", () => {
  const service = new ConnectorFrameworkService();
  service.register(createManifest("enabled", { supportedEvents: ["event.a"] }));

  const result = service.execute({
    connectorId: "test_connector",
    capability: "sync",
    payload: {},
    policyRef: "policy-1",
    secretBindings: [{ secretRef: "secret://test/token", purpose: "api_token" }],
  }, {
    environment: "prod",
    eventType: "event.b",
  });

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("ConnectorFrameworkService.execute returns failed for connector with failed health", () => {
  const service = new ConnectorFrameworkService();
  service.register(createManifest("enabled"));
  service.recordHealth({
    connectorId: "test_connector",
    status: "failed",
    latencyMs: 1000,
    checkedAt: "2026-04-20T00:01:00.000Z",
  });

  const result = service.execute({
    connectorId: "test_connector",
    capability: "sync",
    payload: {},
    policyRef: "policy-1",
    secretBindings: [{ secretRef: "secret://test/token", purpose: "api_token" }],
  }, {
    environment: "prod",
  });

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("ConnectorFrameworkService.execute returns succeeded for healthy verified connector", () => {
  const service = new ConnectorFrameworkService();
  service.register(createManifest("verified"));
  service.recordHealth({
    connectorId: "test_connector",
    status: "healthy",
    latencyMs: 100,
    checkedAt: "2026-04-20T00:01:00.000Z",
  });

  const result = service.execute({
    connectorId: "test_connector",
    capability: "sync",
    payload: {},
    policyRef: "policy-1",
    secretBindings: [{ secretRef: "secret://test/token", purpose: "api_token" }],
  }, {
    environment: "prod",
  });

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("ConnectorFrameworkService.execute returns deferred for degraded connector", () => {
  const service = new ConnectorFrameworkService();
  service.register(createManifest("enabled"));
  service.recordHealth({
    connectorId: "test_connector",
    status: "degraded",
    latencyMs: 500,
    checkedAt: "2026-04-20T00:01:00.000Z",
  });

  const result = service.execute({
    connectorId: "test_connector",
    capability: "sync",
    payload: {},
    policyRef: "policy-1",
    secretBindings: [{ secretRef: "secret://test/token", purpose: "api_token" }],
  }, {
    environment: "prod",
  });

  assert.equal(result.success, true);
  assert.equal(result.status, "deferred");
});

test("ConnectorFrameworkService.listBindings filters by connectorId", () => {
  const service = new ConnectorFrameworkService();
  service.register(createManifest("verified"));
  service.register(createManifest("verified", { connectorId: "other_connector" }));
  service.bind("test_connector", "tenant-1", "dev");
  service.bind("test_connector", "tenant-2", "dev");
  service.bind("other_connector", "tenant-1", "dev");

  const bindings = service.listBindings({ connectorId: "test_connector" });

  assert.equal(bindings.length, 2);
  assert.ok(bindings.every(b => b.connectorId === "test_connector"));
});

test("ConnectorFrameworkService.listBindings filters by tenantId", () => {
  const service = new ConnectorFrameworkService();
  service.register(createManifest("verified"));
  service.bind("test_connector", "tenant-1", "dev");
  service.bind("test_connector", "tenant-2", "dev");

  const bindings = service.listBindings({ tenantId: "tenant-1" });

  assert.equal(bindings.length, 1);
  assert.equal(bindings[0]!.tenantId, "tenant-1");
});

test("ConnectorFrameworkService.listBindings filters by environment", () => {
  const service = new ConnectorFrameworkService();
  service.register(createManifest("verified"));
  service.bind("test_connector", "tenant-1", "dev");
  service.bind("test_connector", "tenant-1", "prod");

  const bindings = service.listBindings({ environment: "prod" });

  assert.equal(bindings.length, 1);
  assert.equal(bindings[0]!.environment, "prod");
});

test("ConnectorManifestSchema parses valid manifest", () => {
  const result = ConnectorManifestSchema.safeParse({
    connectorId: "test",
    provider: "provider",
    capabilities: ["read"],
    lifecycleState: "enabled",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.lifecycleState, "enabled");
  }
});

test("ConnectorManifestSchema rejects invalid lifecycleState", () => {
  const result = ConnectorManifestSchema.safeParse({
    connectorId: "test",
    provider: "provider",
    capabilities: [],
    lifecycleState: "invalid",
  });

  assert.equal(result.success, false);
});

test("listEnabledConnectors filters to only enabled connectors", () => {
  const connectors = [
    createManifest("enabled"),
    createManifest("registered"),
    createManifest("verified"),
  ];

  const enabled = listEnabledConnectors(connectors);

  assert.equal(enabled.length, 1);
  assert.equal(enabled[0]!.lifecycleState, "enabled");
});

test("buildConnectorExecutionKey creates correct key format", () => {
  const key = buildConnectorExecutionKey({
    connectorId: "my_connector",
    capability: "sync",
    payload: {},
  });

  assert.equal(key, "my_connector:sync");
});

test("ConnectorExecutionRequestSchema parses valid request", () => {
  const result = ConnectorExecutionRequestSchema.safeParse({
    connectorId: "test",
    capability: "sync",
    payload: { key: "value" },
    policyRef: "policy-1",
  });

  assert.equal(result.success, true);
});

test("ConnectorExecutionRequestSchema provides defaults for optional fields", () => {
  const result = ConnectorExecutionRequestSchema.safeParse({
    connectorId: "test",
    capability: "sync",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data.payload, {});
    assert.deepEqual(result.data.secretBindings, []);
  }
});

test("summarizeConnectorHealth returns failed when any report is failed", () => {
  const reports: ConnectorHealthReport[] = [
    { connectorId: "c1", status: "healthy", latencyMs: 100, checkedAt: "2026-04-20T00:00:00.000Z" },
    { connectorId: "c1", status: "failed", latencyMs: 1000, checkedAt: "2026-04-20T00:01:00.000Z" },
  ];

  const result = summarizeConnectorHealth(reports);

  assert.equal(result, "failed");
});

test("summarizeConnectorHealth returns degraded when any report is degraded", () => {
  const reports: ConnectorHealthReport[] = [
    { connectorId: "c1", status: "healthy", latencyMs: 100, checkedAt: "2026-04-20T00:00:00.000Z" },
    { connectorId: "c1", status: "degraded", latencyMs: 500, checkedAt: "2026-04-20T00:01:00.000Z" },
  ];

  const result = summarizeConnectorHealth(reports);

  assert.equal(result, "degraded");
});

test("summarizeConnectorHealth returns healthy when all reports are healthy", () => {
  const reports: ConnectorHealthReport[] = [
    { connectorId: "c1", status: "healthy", latencyMs: 100, checkedAt: "2026-04-20T00:00:00.000Z" },
    { connectorId: "c1", status: "healthy", latencyMs: 90, checkedAt: "2026-04-20T00:01:00.000Z" },
  ];

  const result = summarizeConnectorHealth(reports);

  assert.equal(result, "healthy");
});

test("summarizeConnectorHealth handles empty array", () => {
  const result = summarizeConnectorHealth([]);
  assert.equal(result, "healthy");
});