import assert from "node:assert/strict";
import test from "node:test";

import {
  listEnabledConnectors,
  summarizeConnectorHealth,
  isQuotaExceeded,
  orderFairQueue,
  choosePreemptionVictim,
  detectSlaBreach,
  allocateReservedCapacity,
  resolveHighestPriorityTier,
} from "../../../src/scale-ecosystem/index.js";
import { selectPreferredRegion } from "../../../src/scale-ecosystem/multi-region/region-router/index.js";
import { shouldReplicateToRegion } from "../../../src/scale-ecosystem/multi-region/data-replicator/index.js";
import { resolveRegionFailover } from "../../../src/scale-ecosystem/multi-region/failover-controller/index.js";

test("scale-ecosystem support modules coordinate connector, region, quota, and SLA decisions", () => {
  const connectors = listEnabledConnectors([
    {
      connectorId: "slack_primary",
      provider: "slack",
      capabilities: ["notify"],
      lifecycleState: "enabled",
    },
    {
      connectorId: "crm_sync",
      provider: "crm",
      capabilities: ["sync"],
      lifecycleState: "disabled",
    },
  ]);

  assert.equal(connectors.length, 1);
  assert.equal(
    summarizeConnectorHealth([
      {
        connectorId: "slack_primary",
        status: "healthy",
        latencyMs: 120,
        checkedAt: "2026-04-20T00:00:00.000Z",
      },
    ]),
    "healthy",
  );

  const selectedRegion = selectPreferredRegion([
    { regionId: "cn-sh", jurisdiction: "CN", latencyScore: 30, residencyAllowed: true },
    { regionId: "us-west-2", jurisdiction: "US", latencyScore: 120, residencyAllowed: true },
  ]);
  assert.equal(selectedRegion?.regionId, "cn-sh");

  assert.equal(
    shouldReplicateToRegion(
      {
        sourceRegionId: "cn-sh",
        targetRegionIds: ["cn-bj", "cn-sz"],
        residencyMode: "same_jurisdiction",
      },
      "cn-bj",
    ),
    true,
  );

  const queue = orderFairQueue([
    { itemId: "tenant_a_job", tenantId: "tenant_a", priority: 1, ageMs: 60_000 },
    { itemId: "tenant_b_job", tenantId: "tenant_b", priority: 3, ageMs: 1_000 },
  ]);
  assert.equal(queue[0]?.itemId, "tenant_b_job");

  assert.equal(
    isQuotaExceeded({ scopeId: "tenant_b", hardLimit: 5, currentUsage: 4 }, 2),
    true,
  );

  assert.equal(
    choosePreemptionVictim([
      { executionId: "exec_low", priority: 1, progressPercent: 20 },
      { executionId: "exec_high", priority: 3, progressPercent: 10 },
    ])?.executionId,
    "exec_low",
  );

  const enterpriseTier = resolveHighestPriorityTier([
    { tierId: "standard", displayName: "Standard", priority: 1, reservedCapacityPercent: 20 },
    { tierId: "enterprise", displayName: "Enterprise", priority: 3, reservedCapacityPercent: 40 },
  ]);
  assert.equal(enterpriseTier?.tierId, "enterprise");

  assert.deepEqual(
    allocateReservedCapacity(100, [
      { tierId: "enterprise", reservedPercent: 40 },
      { tierId: "standard", reservedPercent: 20 },
    ]),
    { enterprise: 40, standard: 20 },
  );

  assert.deepEqual(
    detectSlaBreach(
      { latencyMs: 600, successRate: 0.97, queueWaitMs: 3_500 },
      { maxLatencyMs: 300, minSuccessRate: 0.99, maxQueueWaitMs: 1_000 },
    ),
    ["sla.latency_breach", "sla.success_rate_breach", "sla.queue_wait_breach"],
  );

  assert.deepEqual(
    resolveRegionFailover({
      primaryHealthy: false,
      candidateRegionIds: ["cn-bj", "us-west-2"],
    }),
    {
      shouldFailover: true,
      targetRegionId: "cn-bj",
      rationale: "multi_region.primary_unhealthy",
    },
  );
});
