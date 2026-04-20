import assert from "node:assert/strict";
import test from "node:test";

import { CrossRegionRoutingService } from "../../../src/scale-ecosystem/multi-region/cross-region-routing-service.js";
import { FairSchedulingService } from "../../../src/scale-ecosystem/resource-manager/fair-scheduling-service.js";
import { SlaOperationsService } from "../../../src/scale-ecosystem/sla-engine/sla-operations-service.js";

test("integration: runtime orchestration combines region routing, fair scheduling, and SLA protection", () => {
  const routing = new CrossRegionRoutingService();
  const route = routing.route({
    regions: [
      { regionId: "cn-sh", jurisdiction: "CN", latencyScore: 30, residencyAllowed: true, capabilities: ["llm", "storage"] },
      { regionId: "cn-bj", jurisdiction: "CN", latencyScore: 40, residencyAllowed: true, capabilities: ["llm", "storage"] },
      { regionId: "us-west-2", jurisdiction: "US", latencyScore: 20, residencyAllowed: true, capabilities: ["llm", "storage"] },
    ],
    policy: {
      policyId: "cn_resident",
      allowedJurisdictions: ["CN"],
      requiredCapabilities: ["llm", "storage"],
      allowCrossBorder: false,
    },
    primaryRegionId: "cn-sh",
    primaryRegionHealthy: false,
  });

  const scheduling = new FairSchedulingService();
  const queue = scheduling.schedule({
    quotaPolicy: {
      scopeId: "tenant_enterprise",
      hardLimit: 20,
      currentUsage: 19,
    },
    claim: {
      claimId: "claim_enterprise",
      schedulingClass: {
        tenantId: "tenant_enterprise",
        orgNodeId: "org_enterprise",
        domainId: "operations",
        slaTierId: "enterprise",
        priority: 10,
      },
      requestedUnits: 3,
    },
    queueItems: [
      { itemId: "tenant_standard_job", tenantId: "tenant_standard", priority: 2, ageMs: 18 * 60_000 },
      { itemId: "tenant_enterprise_job", tenantId: "tenant_enterprise", priority: 8, ageMs: 60_000 },
    ],
    preemptionCandidates: [
      { executionId: "exec_standard", priority: 1, progressPercent: 15 },
      { executionId: "exec_enterprise", priority: 8, progressPercent: 70 },
    ],
  });

  const sla = new SlaOperationsService();
  const slaDecision = sla.evaluate({
    tiers: [
      {
        tierId: "enterprise",
        displayName: "Enterprise",
        priority: 3,
        reservedCapacityPercent: 40,
        targetLatencyMs: 300,
        targetSuccessRate: 0.995,
        maxQueueWaitMs: 1000,
        preemptionPriority: 10,
      },
      {
        tierId: "standard",
        displayName: "Standard",
        priority: 1,
        reservedCapacityPercent: 20,
        targetLatencyMs: 900,
        targetSuccessRate: 0.98,
        maxQueueWaitMs: 4000,
        preemptionPriority: 2,
      },
    ],
    selectedTierId: "enterprise",
    observation: {
      latencyMs: 280,
      successRate: 0.997,
      queueWaitMs: 900,
    },
    totalCapacityUnits: 50,
    observedAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(route.selectedRegionId, "cn-sh");
  assert.equal(queue.preemption.victimExecutionId, "exec_standard");
  assert.equal(slaDecision.routingHint?.tierId, "enterprise");
  assert.equal(slaDecision.breachRecords.length, 0);
});
