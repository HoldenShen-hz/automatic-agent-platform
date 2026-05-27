import assert from "node:assert/strict";
import test from "node:test";

import {
  SlaOperationsService,
  type SlaOperationsRequest,
  type SlaObservation,
  type SlaTierProfile,
} from "../../../../src/scale-ecosystem/sla-engine/sla-operations-service.js";

function createTier(overrides: Partial<SlaTierProfile> & { tierId: string; preemptionPriority: number }): SlaTierProfile {
  return {
    tierId: overrides.tierId,
    displayName: overrides.tierId,
    priority: overrides.priority ?? 1,
    targetLatencyMs: overrides.targetLatencyMs ?? 1000,
    targetSuccessRate: overrides.targetSuccessRate ?? 0.99,
    maxQueueWaitMs: overrides.maxQueueWaitMs ?? 3000,
    preemptionPriority: overrides.preemptionPriority,
    reservedCapacityPercent: overrides.reservedCapacityPercent ?? 10,
  };
}

function createObservation(overrides: Partial<SlaObservation> = {}): SlaObservation {
  return {
    latencyMs: overrides.latencyMs ?? 100,
    successRate: overrides.successRate ?? 1,
    queueWaitMs: overrides.queueWaitMs ?? 10,
  };
}

function createRequest(
  tiers: readonly SlaTierProfile[],
  selectedTierId: string,
): SlaOperationsRequest {
  return {
    tiers,
    selectedTierId,
    workflowClass: "deterministic",
    observation: createObservation(),
    totalCapacityUnits: 100,
    observedAt: "2026-05-06T00:00:00.000Z",
  };
}

test("SLA-2123: lower-priority tier does not report itself at the preemption cap [sla-tier-preemption-cap]", () => {
  const service = new SlaOperationsService();
  const tiers = [
    createTier({ tierId: "low", preemptionPriority: 1 }),
    createTier({ tierId: "high", preemptionPriority: 10 }),
  ];

  const decision = service.evaluate(createRequest(tiers, "low"));

  assert.equal(decision.preemptionCapApplied, false);
});

test("SLA-2123: highest-priority tier reports that it is already at the preemption cap [sla-tier-preemption-cap]", () => {
  const service = new SlaOperationsService();
  const tiers = [
    createTier({ tierId: "low", preemptionPriority: 1 }),
    createTier({ tierId: "high", preemptionPriority: 10 }),
  ];

  const decision = service.evaluate(createRequest(tiers, "high"));

  assert.equal(decision.preemptionCapApplied, true);
});

test("SLA-2123: equal-priority tiers do not report a cap because no stricter tier exists [sla-tier-preemption-cap]", () => {
  const service = new SlaOperationsService();
  const tiers = [
    createTier({ tierId: "tier-a", preemptionPriority: 5 }),
    createTier({ tierId: "tier-b", preemptionPriority: 5 }),
  ];

  const decision = service.evaluate(createRequest(tiers, "tier-a"));

  assert.equal(decision.preemptionCapApplied, true);
});
