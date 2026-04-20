import assert from "node:assert/strict";
import test from "node:test";

import { RuntimeGovernanceService } from "../../../src/scale-ecosystem/runtime-governance-service.js";

test("RuntimeGovernanceService combines connector, region, quota, queue, and SLA decisions", () => {
  const service = new RuntimeGovernanceService();
  const decision = service.evaluate({
    capability: "notify",
    connectors: [
      { connectorId: "slack_primary", provider: "slack", capabilities: ["notify"], lifecycleState: "enabled" },
    ],
    connectorHealthReports: [
      { connectorId: "slack_primary", status: "healthy", latencyMs: 100, checkedAt: "2026-04-20T00:00:00.000Z" },
    ],
    regions: [
      { regionId: "cn-sh", jurisdiction: "CN", latencyScore: 30, residencyAllowed: true },
      { regionId: "us-west-2", jurisdiction: "US", latencyScore: 80, residencyAllowed: true },
    ],
    primaryRegionHealthy: false,
    quotaPolicy: { scopeId: "tenant_1", hardLimit: 10, currentUsage: 3 },
    requestedUnits: 2,
    queueItems: [
      { itemId: "job_1", tenantId: "tenant_1", priority: 1, ageMs: 60_000 },
      { itemId: "job_2", tenantId: "tenant_2", priority: 2, ageMs: 1_000 },
    ],
    preemptionCandidates: [
      { executionId: "exec_1", priority: 1, progressPercent: 20 },
      { executionId: "exec_2", priority: 3, progressPercent: 50 },
    ],
    tiers: [
      { tierId: "standard", displayName: "Standard", priority: 1, reservedCapacityPercent: 20 },
      { tierId: "enterprise", displayName: "Enterprise", priority: 3, reservedCapacityPercent: 40 },
    ],
    reservedCapacityPlan: [
      { tierId: "enterprise", reservedPercent: 40 },
      { tierId: "standard", reservedPercent: 20 },
    ],
    totalCapacityUnits: 100,
    observation: { latencyMs: 350, successRate: 0.98, queueWaitMs: 500 },
    commitment: { maxLatencyMs: 300, minSuccessRate: 0.99, maxQueueWaitMs: 1000 },
  });

  assert.equal(decision.connectorId, "slack_primary");
  assert.equal(decision.regionId, "cn-sh");
  assert.equal(decision.failoverRegionId, "us-west-2");
  assert.equal(decision.quotaAllowed, true);
  assert.equal(decision.queueOrder[0], "job_2");
  assert.equal(decision.preemptionVictimId, "exec_1");
  assert.equal(decision.highestTierId, "enterprise");
  assert.deepEqual(decision.reservedCapacity, { enterprise: 40, standard: 20 });
  assert.deepEqual(decision.breaches, ["sla.latency_breach", "sla.success_rate_breach"]);
});
