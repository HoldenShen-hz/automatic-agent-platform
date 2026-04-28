import assert from "node:assert/strict";
import test from "node:test";

import { analyzeFeedbackSignals } from "../../../src/scale-ecosystem/feedback-loop/analyzer/index.js";
import { summarizeImprovementTracking } from "../../../src/scale-ecosystem/feedback-loop/improvement-tracker/index.js";
import { listEnabledConnectors } from "../../../src/scale-ecosystem/integration/connector-registry/index.js";
import { buildConnectorExecutionKey } from "../../../src/scale-ecosystem/integration/connector-runtime/index.js";
import { summarizeConnectorHealth } from "../../../src/scale-ecosystem/integration/health-monitor/index.js";
import { sortMarketplaceCatalog } from "../../../src/scale-ecosystem/marketplace/catalog/index.js";
import { isMarketplaceListingCertified } from "../../../src/scale-ecosystem/marketplace/certification/index.js";
import { canPublisherReleaseArtifact } from "../../../src/scale-ecosystem/marketplace/publisher/index.js";
import { shouldReplicateToRegion } from "../../../src/scale-ecosystem/multi-region/data-replicator/index.js";
import { resolveRegionFailover } from "../../../src/scale-ecosystem/multi-region/failover-controller/index.js";
import { selectPreferredRegion } from "../../../src/scale-ecosystem/multi-region/region-router/index.js";
import { orderFairQueue } from "../../../src/scale-ecosystem/resource-manager/fair-queue/index.js";
import { choosePreemptionVictim } from "../../../src/scale-ecosystem/resource-manager/preemption/index.js";
import { isQuotaExceeded } from "../../../src/scale-ecosystem/resource-manager/quota-enforcer/index.js";
import { detectSlaBreach } from "../../../src/scale-ecosystem/sla-engine/breach-detector/index.js";
import { allocateReservedCapacity } from "../../../src/scale-ecosystem/sla-engine/resource-allocator/index.js";
import { resolveHighestPriorityTier } from "../../../src/scale-ecosystem/sla-engine/tier-resolver/index.js";

test("scale-ecosystem support modules provide contract-aligned helpers", () => {
  assert.deepEqual(
    analyzeFeedbackSignals([
      {
        signalId: "sig_1",
        taskId: "task_1",
        source: "user",
        category: "failure",
        severity: "critical",
        payload: {},
        stepOutputRefs: [],
        timestamp: 1,
      },
    ]),
    {
      totalSignals: 1,
      bySeverity: { critical: 1 },
      topSubjects: ["task:task_1"],
    },
  );

  assert.deepEqual(
    summarizeImprovementTracking([
      { candidateId: "cand_1", sourceSignalIds: ["sig_1"], status: "proposed", owner: "ops" },
      { candidateId: "cand_2", sourceSignalIds: ["sig_2"], status: "released", owner: "ops" },
    ]),
    { proposed: 1, released: 1 },
  );

  assert.equal(
    listEnabledConnectors([
      { connectorId: "slack", provider: "slack", capabilities: ["notify"], lifecycleState: "enabled" },
      { connectorId: "crm", provider: "crm", capabilities: ["sync"], lifecycleState: "disabled" },
    ]).length,
    1,
  );
  assert.equal(buildConnectorExecutionKey({ connectorId: "slack", capability: "notify", payload: {} }), "slack:notify");
  assert.equal(
    summarizeConnectorHealth([{ connectorId: "slack", status: "degraded", latencyMs: 100, checkedAt: "2026-04-20T00:00:00.000Z" }]),
    "degraded",
  );

  assert.equal(
    sortMarketplaceCatalog([
      { listingId: "l1", title: "Community", trustLevel: "community", lifecycleState: "active", qualityMetrics: { reliabilityScore: 0.8, usabilityScore: 0.7, supportScore: 0.6 } },
      { listingId: "l2", title: "Verified", trustLevel: "verified", lifecycleState: "active", qualityMetrics: { reliabilityScore: 0.9, usabilityScore: 0.85, supportScore: 0.9 } },
    ])[0]?.listingId,
    "l2",
  );
  assert.equal(
    isMarketplaceListingCertified({ listingId: "l1", certificationId: "c1", status: "approved", approvedAt: "2026-04-20T00:00:00.000Z" }),
    true,
  );
  assert.equal(
    canPublisherReleaseArtifact({ publisherId: "pub_1", displayName: "Publisher", trustLevel: "verified", allowedArtifactTypes: ["plugin"], reputationScore: 0.5, publishedArtifactCount: 10 }, "plugin"),
    true,
  );

  assert.equal(
    shouldReplicateToRegion({ sourceRegionId: "cn-sh", targetRegionIds: ["cn-bj"], residencyMode: "same_jurisdiction" }, "cn-bj"),
    true,
  );
  assert.deepEqual(
    resolveRegionFailover({ primaryHealthy: false, candidateRegionIds: ["us-west-2"] }),
    {
      shouldFailover: true,
      targetRegionId: "us-west-2",
      rationale: "multi_region.primary_unhealthy",
    },
  );
  assert.equal(
    selectPreferredRegion([
      { regionId: "us-west-2", jurisdiction: "US", latencyScore: 120, residencyAllowed: true },
      { regionId: "cn-sh", jurisdiction: "CN", latencyScore: 30, residencyAllowed: false },
    ])?.regionId,
    "us-west-2",
  );

  assert.equal(
    orderFairQueue([
      { itemId: "a", tenantId: "t1", priority: 1, ageMs: 1_000 },
      { itemId: "b", tenantId: "t2", priority: 2, ageMs: 1_000 },
    ])[0]?.itemId,
    "b",
  );
  assert.equal(
    choosePreemptionVictim([
      { executionId: "exec_1", priority: 1, progressPercent: 50 },
      { executionId: "exec_2", priority: 2, progressPercent: 10 },
    ])?.executionId,
    "exec_1",
  );
  assert.equal(isQuotaExceeded({ scopeId: "tenant_1", hardLimit: 10, currentUsage: 8 }, 3), true);

  assert.deepEqual(
    detectSlaBreach(
      { latencyMs: 500, successRate: 0.98, queueWaitMs: 3000 },
      { maxLatencyMs: 300, minSuccessRate: 0.99, maxQueueWaitMs: 1000 },
    ),
    ["sla.latency_breach", "sla.success_rate_breach", "sla.queue_wait_breach"],
  );
  assert.deepEqual(
    allocateReservedCapacity(100, [
      { tierId: "enterprise", reservedPercent: 40 },
      { tierId: "standard", reservedPercent: 20 },
    ]),
    { enterprise: 40, standard: 20 },
  );
  assert.equal(
    resolveHighestPriorityTier([
      { tierId: "standard", displayName: "Standard", priority: 1, reservedCapacityPercent: 20 },
      { tierId: "enterprise", displayName: "Enterprise", priority: 3, reservedCapacityPercent: 40 },
    ])?.tierId,
    "enterprise",
  );
});
