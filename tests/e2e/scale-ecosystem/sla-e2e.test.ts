/**
 * SLA E2E Tests
 *
 * End-to-end tests for SLA operations including breach detection,
 * preemption decisions, and capacity allocation.
 */

import assert from "node:assert/strict";
import test from "node:test";

// @ts-ignore
import { SlaOperationsService, type SlaTierProfile, type SlaOperationsRequest, type SlaObservation } from "../../../src/scale-ecosystem/sla-engine/sla-operations-service.js";

// ─────────────────────────────────────────────────────────────────────────────
// SLA E2E Tests
// ─────────────────────────────────────────────────────────────────────────────

function createTier(overrides: Partial<SlaTierProfile> = {}): SlaTierProfile {
  return {
    tierId: overrides.tierId ?? "tier-standard",
    displayName: overrides.displayName ?? "Standard Tier",
    priority: overrides.priority ?? 1,
    targetLatencyMs: overrides.targetLatencyMs ?? 1000,
    targetSuccessRate: overrides.targetSuccessRate ?? 0.99,
    maxQueueWaitMs: overrides.maxQueueWaitMs ?? 3000,
    preemptionPriority: overrides.preemptionPriority ?? 5,
    reservedCapacityPercent: overrides.reservedCapacityPercent ?? 10,
    ...overrides,
  };
}

function createObservation(overrides: Partial<SlaObservation> = {}): SlaObservation {
  return {
    latencyMs: overrides.latencyMs ?? 500,
    successRate: overrides.successRate ?? 0.999,
    queueWaitMs: overrides.queueWaitMs ?? 1000,
    executionTimeoutRate: overrides.executionTimeoutRate ?? 0.001,
    dependencyAvailability: overrides.dependencyAvailability ?? 1.0,
    ...overrides,
  };
}

function createSlaRequest(overrides: Partial<SlaOperationsRequest> = {}): SlaOperationsRequest {
  return {
    tiers: overrides.tiers ?? [createTier()],
    selectedTierId: overrides.selectedTierId ?? null,
    workflowClass: overrides.workflowClass ?? "deterministic",
    observation: overrides.observation ?? createObservation(),
    totalCapacityUnits: overrides.totalCapacityUnits ?? 100,
    observedAt: overrides.observedAt ?? new Date().toISOString(),
    ...overrides,
  };
}

test("E2E: SLA tier selection with automatic highest priority", () => {
  const service = new SlaOperationsService();

  const bronzeTier = createTier({
    tierId: "bronze",
    priority: 1,
    targetLatencyMs: 2000,
    targetSuccessRate: 0.95,
    maxQueueWaitMs: 10000,
    preemptionPriority: 1,
  });

  const silverTier = createTier({
    tierId: "silver",
    priority: 2,
    targetLatencyMs: 1000,
    targetSuccessRate: 0.99,
    maxQueueWaitMs: 5000,
    preemptionPriority: 5,
  });

  const goldTier = createTier({
    tierId: "gold",
    priority: 3,
    targetLatencyMs: 500,
    targetSuccessRate: 0.999,
    maxQueueWaitMs: 2000,
    preemptionPriority: 10,
  });

  const request = createSlaRequest({
    tiers: [bronzeTier, silverTier, goldTier],
    selectedTierId: null, // Auto-select highest priority
  });

  const decision = service.evaluate(request);

  // Should automatically select gold tier (highest priority)
  assert.equal(decision.selectedTierId, "gold");
  assert.equal(decision.routingHint?.tierId, "gold");
});

test("E2E: SLA breach detection with multiple violations", () => {
  const service = new SlaOperationsService();

  const tier = createTier({
    tierId: "standard",
    targetLatencyMs: 500,
    targetSuccessRate: 0.99,
    maxQueueWaitMs: 2000,
  });

  // Create observation that breaches all SLAs
  const request = createSlaRequest({
    tiers: [tier],
    selectedTierId: "standard",
    observation: createObservation({
      latencyMs: 1500, // 3x target
      successRate: 0.80, // 19% error rate vs 1% target
      queueWaitMs: 8000, // 4x max
    }),
  });

  const decision = service.evaluate(request);

  // Should detect all breach types
  assert.ok(decision.breachRecords.length > 0);
  const breachCodes = decision.breachRecords.flatMap((r) => r.breachCodes);
  assert.ok(breachCodes.includes("sla.latency_breach"));
  assert.ok(breachCodes.includes("sla.success_rate_breach"));
  assert.ok(breachCodes.includes("sla.queue_wait_breach"));

  // Should have escalation actions
  assert.ok(decision.escalationActions.length > 0);

  // Should have penalty decisions
  assert.ok(decision.penaltyDecisions.length > 0);
});

test("E2E: SLA with preemption decisions for high-priority tier", () => {
  const service = new SlaOperationsService();

  const lowTier = createTier({
    tierId: "low-priority",
    preemptionPriority: 1,
    reservedCapacityPercent: 20,
  });

  const mediumTier = createTier({
    tierId: "medium-priority",
    preemptionPriority: 5,
    reservedCapacityPercent: 30,
  });

  const highTier = createTier({
    tierId: "high-priority",
    preemptionPriority: 10,
    reservedCapacityPercent: 40,
  });

  // High priority tier with breaches should trigger preemption
  const request = createSlaRequest({
    tiers: [lowTier, mediumTier, highTier],
    selectedTierId: "high-priority",
    observation: createObservation({
      latencyMs: 2000, // Breaches high tier's 500ms target
      successRate: 0.85, // Breaches 99.9% target
      queueWaitMs: 10000, // Breaches 2000ms max
    }),
    workflowClass: "llm_assisted",
  });

  const decision = service.evaluate(request);

  // Should have preemption decisions
// @ts-ignore
  assert.ok(decision.preemptionDecisions.length > 0);

  // High priority tier selected
  assert.equal(decision.selectedTierId, "high-priority");
});

test("E2E: SLA reserved capacity allocation across tiers", () => {
  const service = new SlaOperationsService();

  const tiers = [
    createTier({
      tierId: "gold",
      reservedCapacityPercent: 30,
    }),
    createTier({
      tierId: "silver",
      reservedCapacityPercent: 25,
    }),
    createTier({
      tierId: "bronze",
      reservedCapacityPercent: 20,
    }),
  ];

  const request = createSlaRequest({
    tiers,
    totalCapacityUnits: 1000,
  });

  const decision = service.evaluate(request);

  // Reserved capacity should be allocated
  assert.equal(decision.reservedCapacity["gold"], 300);
  assert.equal(decision.reservedCapacity["silver"], 250);
  assert.equal(decision.reservedCapacity["bronze"], 200);

  // Total reserved = 750, leaving 250 for burst
});

test("E2E: SLA starvation protection", () => {
  const service = new SlaOperationsService();

  const tier = createTier({
    tierId: "guaranteed",
    reservedCapacityPercent: 50,
  });

  const request = createSlaRequest({
    tiers: [tier],
    totalCapacityUnits: 100,
  });

  const decision = service.evaluate(request);

  // Should be protected from starvation because it has reserved capacity
  assert.equal(decision.starvationProtected, true);
});

test("E2E: SLA with different workflow classes", () => {
  const service = new SlaOperationsService();

  const tier = createTier({
    tierId: "realtime",
    targetLatencyMs: 100,
    targetSuccessRate: 0.999,
    maxQueueWaitMs: 500,
  });

  const workflowClasses = ["deterministic", "llm_assisted", "hitl_waiting"] as const;

  for (const workflowClass of workflowClasses) {
    const request = createSlaRequest({
      tiers: [tier],
      selectedTierId: "realtime",
      workflowClass,
      observation: createObservation({
        latencyMs: 80,
        successRate: 0.9995,
        queueWaitMs: 300,
      }),
    });

    const decision = service.evaluate(request);

    assert.equal(decision.workflowClass, workflowClass);
    assert.equal(decision.selectedTierId, "realtime");
  }
});

test("E2E: SLA escalation actions for critical breaches", () => {
  const service = new SlaOperationsService();

  const tier = createTier({
    tierId: "critical-tier",
    targetSuccessRate: 0.9999, // Very high success rate requirement
  });

  // Observation with severe success rate breach
  const request = createSlaRequest({
    tiers: [tier],
    selectedTierId: "critical-tier",
    observation: createObservation({
      successRate: 0.90, // 10% error rate vs 0.01% max
    }),
  });

  const decision = service.evaluate(request);

  // Should have escalation actions
  assert.ok(decision.escalationActions.length > 0);

  // Success rate breach is critical severity
  const successBreach = decision.breachRecords.find((r) =>
    r.breachCodes.includes("sla.success_rate_breach")
  );
  assert.ok(successBreach);
  assert.equal(successBreach.severity, "critical");

  // Critical breach should trigger page_sre action
  const pageAction = decision.escalationActions.find((a) => a.action === "page_sre");
  assert.ok(pageAction);
});

test("E2E: SLA with no breaches returns healthy decision", () => {
  const service = new SlaOperationsService();

  const tier = createTier({
    tierId: "healthy-tier",
    targetLatencyMs: 1000,
    targetSuccessRate: 0.99,
    maxQueueWaitMs: 5000,
  });

  const request = createSlaRequest({
    tiers: [tier],
    selectedTierId: "healthy-tier",
    observation: createObservation({
      latencyMs: 500,
      successRate: 0.999,
      queueWaitMs: 2000,
    }),
  });

  const decision = service.evaluate(request);

  // No breach records
  assert.equal(decision.breachRecords.length, 0);

  // No escalation actions
  assert.equal(decision.escalationActions.length, 0);

  // Still returns valid decision
  assert.equal(decision.selectedTierId, "healthy-tier");
  assert.ok(decision.routingHint);
});

test("E2E: SLA delay prediction with historical observations", () => {
  const service = new SlaOperationsService();

  const tier = createTier({
    tierId: "predicted-tier",
    targetLatencyMs: 500,
    targetSuccessRate: 0.99,
    maxQueueWaitMs: 3000,
  });

  // Create historical observations showing degradation trend
  const historicalObservations: SlaObservation[] = [
    createObservation({ queueWaitMs: 1000, latencyMs: 300 }),
    createObservation({ queueWaitMs: 1200, latencyMs: 350 }),
    createObservation({ queueWaitMs: 1500, latencyMs: 400 }),
    createObservation({ queueWaitMs: 2000, latencyMs: 500 }),
    createObservation({ queueWaitMs: 2800, latencyMs: 600 }),
  ];

  const request = createSlaRequest({
    tiers: [tier],
    selectedTierId: "predicted-tier",
    observation: createObservation({
      queueWaitMs: 3000, // At limit
      latencyMs: 650, // Over target
    }),
// @ts-ignore
    historicalObservations,
    workflowClass: "llm_assisted",
  });

  const decision = service.evaluate(request);

  // Should have delay prediction
// @ts-ignore
  assert.ok(decision.delayPrediction !== null);
// @ts-ignore
  assert.ok(decision.delayPrediction!.confidence >= 0);
// @ts-ignore
  assert.ok(decision.delayPrediction!.predictedQueueWaitMs >= 0);

  // Scaling recommendation should be present
// @ts-ignore
  assert.ok(decision.scalingRecommendation !== null);
});

test("E2E: SLA preemption decisions when high-priority tier is at risk", () => {
  const service = new SlaOperationsService();

  const lowTier = createTier({
    tierId: "batch-tier",
    preemptionPriority: 1,
    maxQueueWaitMs: 30000,
  });

  const highTier = createTier({
    tierId: "realtime-tier",
    preemptionPriority: 10,
    maxQueueWaitMs: 1000,
  });

  // High priority tier experiencing SLA pressure
  const request = createSlaRequest({
    tiers: [lowTier, highTier],
    selectedTierId: "realtime-tier",
    observation: createObservation({
      queueWaitMs: 8000, // High queue wait for realtime tier
    }),
    workflowClass: "deterministic",
  });

  const decision = service.evaluate(request);

  // Preemption decisions should recommend preempting lower priority
// @ts-ignore
  assert.ok(decision.preemptionDecisions.length > 0);

// @ts-ignore
  const batchPreemption = decision.preemptionDecisions.find(
// @ts-ignore
    (p) => p.tierId === "batch-tier"
  );
  assert.ok(batchPreemption);
  // Should recommend preempting batch work to free resources for realtime
  assert.ok(batchPreemption.shouldPreempt || batchPreemption.reason.includes("preempt"));
});

test("E2E: SLA capacity allocation with over-provisioned tiers", () => {
  const service = new SlaOperationsService();

  const tiers = [
    createTier({
      tierId: "tier-1",
      reservedCapacityPercent: 60,
    }),
    createTier({
      tierId: "tier-2",
      reservedCapacityPercent: 50,
    }),
    // Total = 110%, exceeds 100%
  ];

  const request = createSlaRequest({
    tiers,
    totalCapacityUnits: 100,
  });

  const decision = service.evaluate(request);

  // Even with over-provisioning, allocations are made
  // Issue #2195: No validation prevents this
  assert.equal(decision.reservedCapacity["tier-1"], 60);
  assert.equal(decision.reservedCapacity["tier-2"], 50);

  // Total would be 110% - exceeds capacity
  const totalAllocated = decision.reservedCapacity["tier-1"] + decision.reservedCapacity["tier-2"];
  assert.equal(totalAllocated, 110);
});
