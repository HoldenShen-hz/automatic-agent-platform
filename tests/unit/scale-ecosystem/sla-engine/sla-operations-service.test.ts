/**
 * Unit tests for SlaOperationsService
 *
 * @see src/scale-ecosystem/sla-engine/sla-operations-service.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  SlaOperationsService,
  type SlaTierProfile,
  type SlaOperationsRequest,
  type SlaObservation,
  type ReservedCapacityAllocation,
} from "../../../../src/scale-ecosystem/sla-engine/index.js";
import { detectSlaBreach, type SlaCommitment } from "../../../../src/scale-ecosystem/sla-engine/breach-detector/index.js";
import { allocateReservedCapacity } from "../../../../src/scale-ecosystem/sla-engine/resource-allocator/index.js";
import { resolveHighestPriorityTier, type SlaTier } from "../../../../src/scale-ecosystem/sla-engine/tier-resolver/index.js";

function createTestTier(overrides: Partial<SlaTier> = {}): SlaTier {
  return {
    tierId: overrides.tierId ?? "tier-1",
    displayName: overrides.displayName ?? "Test Tier",
    priority: overrides.priority ?? 1,
    targetLatencyMs: overrides.targetLatencyMs ?? 1000,
    targetSuccessRate: overrides.targetSuccessRate ?? 0.99,
    maxQueueWaitMs: overrides.maxQueueWaitMs ?? 3000,
    preemptionPriority: overrides.preemptionPriority ?? 0,
    reservedCapacityPercent: overrides.reservedCapacityPercent ?? 10,
  };
}

function createTestObservation(overrides: Partial<SlaObservation> = {}): SlaObservation {
  return {
    latencyMs: overrides.latencyMs ?? 500,
    successRate: overrides.successRate ?? 1.0,
    queueWaitMs: overrides.queueWaitMs ?? 1000,
  };
}

test("SlaOperationsService.evaluate selects highest priority tier when none selected", () => {
  const service = new SlaOperationsService();
  const tiers: SlaTierProfile[] = [
    { ...createTestTier({ tierId: "gold", priority: 2 }), targetLatencyMs: 500, targetSuccessRate: 0.999, maxQueueWaitMs: 2000, preemptionPriority: 10 },
    { ...createTestTier({ tierId: "silver", priority: 1 }), targetLatencyMs: 1000, targetSuccessRate: 0.99, maxQueueWaitMs: 3000, preemptionPriority: 5 },
  ];

  const request: SlaOperationsRequest = {
    tiers,
    selectedTierId: null,
    workflowClass: "deterministic",
    observation: createTestObservation(),
    totalCapacityUnits: 100,
    observedAt: new Date().toISOString(),
  };

  const decision = service.evaluate(request);

  assert.equal(decision.selectedTierId, "gold");
  assert.ok(decision.routingHint);
  assert.equal(decision.routingHint?.tierId, "gold");
});

test("SlaOperationsService.evaluate uses selectedTierId when provided", () => {
  const service = new SlaOperationsService();
  const tiers: SlaTierProfile[] = [
    { ...createTestTier({ tierId: "gold", priority: 2 }), targetLatencyMs: 500, targetSuccessRate: 0.999, maxQueueWaitMs: 2000, preemptionPriority: 10 },
    { ...createTestTier({ tierId: "silver", priority: 1 }), targetLatencyMs: 1000, targetSuccessRate: 0.99, maxQueueWaitMs: 3000, preemptionPriority: 5 },
  ];

  const request: SlaOperationsRequest = {
    tiers,
    selectedTierId: "silver",
    workflowClass: "deterministic",
    observation: createTestObservation(),
    totalCapacityUnits: 100,
    observedAt: new Date().toISOString(),
  };

  const decision = service.evaluate(request);

  assert.equal(decision.selectedTierId, "silver");
});

test("SlaOperationsService.evaluate detects latency breach", () => {
  const service = new SlaOperationsService();
  const tiers: SlaTierProfile[] = [
    { ...createTestTier({ tierId: "gold" }), targetLatencyMs: 500, targetSuccessRate: 0.999, maxQueueWaitMs: 2000, preemptionPriority: 10 },
  ];

  const request: SlaOperationsRequest = {
    tiers,
    selectedTierId: "gold",
    workflowClass: "deterministic",
    observation: createTestObservation({ latencyMs: 600 }), // exceeds 500ms target
    totalCapacityUnits: 100,
    observedAt: new Date().toISOString(),
  };

  const decision = service.evaluate(request);

  assert.ok(decision.breachRecords.length > 0);
  assert.ok(decision.breachRecords[0]!.breachCodes.includes("sla.latency_breach"));
  assert.equal(decision.breachRecords[0]!.severity, "warning");
});

test("SlaOperationsService.evaluate detects success rate breach", () => {
  const service = new SlaOperationsService();
  const tiers: SlaTierProfile[] = [
    { ...createTestTier({ tierId: "gold", targetSuccessRate: 0.999 }), targetLatencyMs: 500, targetSuccessRate: 0.999, maxQueueWaitMs: 2000, preemptionPriority: 10 },
  ];

  const request: SlaOperationsRequest = {
    tiers,
    selectedTierId: "gold",
    workflowClass: "deterministic",
    observation: createTestObservation({ successRate: 0.98 }), // below 0.999 target
    totalCapacityUnits: 100,
    observedAt: new Date().toISOString(),
  };

  const decision = service.evaluate(request);

  assert.ok(decision.breachRecords.length > 0);
  assert.ok(decision.breachRecords[0]!.breachCodes.includes("sla.success_rate_breach"));
  assert.equal(decision.breachRecords[0]!.severity, "critical");
});

test("SlaOperationsService.evaluate detects queue wait breach", () => {
  const service = new SlaOperationsService();
  const tiers: SlaTierProfile[] = [
    { ...createTestTier({ tierId: "gold", maxQueueWaitMs: 2000 }), targetLatencyMs: 500, targetSuccessRate: 0.999, maxQueueWaitMs: 2000, preemptionPriority: 10 },
  ];

  const request: SlaOperationsRequest = {
    tiers,
    selectedTierId: "gold",
    workflowClass: "deterministic",
    observation: createTestObservation({ queueWaitMs: 2500 }), // exceeds 2000ms max
    totalCapacityUnits: 100,
    observedAt: new Date().toISOString(),
  };

  const decision = service.evaluate(request);

  assert.ok(decision.breachRecords.length > 0);
  assert.ok(decision.breachRecords[0]!.breachCodes.includes("sla.queue_wait_breach"));
});

test("SlaOperationsService.evaluate returns no breaches when within commitment", () => {
  const service = new SlaOperationsService();
  const tiers: SlaTierProfile[] = [
    { ...createTestTier({ tierId: "gold" }), targetLatencyMs: 500, targetSuccessRate: 0.99, maxQueueWaitMs: 2000, preemptionPriority: 10 },
  ];

  const request: SlaOperationsRequest = {
    tiers,
    selectedTierId: "gold",
    workflowClass: "llm_assisted",
    observation: createTestObservation({ latencyMs: 400, successRate: 1.0, queueWaitMs: 1500 }),
    totalCapacityUnits: 100,
    observedAt: new Date().toISOString(),
  };

  const decision = service.evaluate(request);

  assert.equal(decision.breachRecords.length, 0);
});

test("SlaOperationsService.evaluate calculates reserved capacity", () => {
  const service = new SlaOperationsService();
  const tiers: SlaTierProfile[] = [
    { ...createTestTier({ tierId: "gold", reservedCapacityPercent: 20 }), targetLatencyMs: 500, targetSuccessRate: 0.99, maxQueueWaitMs: 2000, preemptionPriority: 10 },
    { ...createTestTier({ tierId: "silver", reservedCapacityPercent: 10 }), targetLatencyMs: 1000, targetSuccessRate: 0.99, maxQueueWaitMs: 3000, preemptionPriority: 5 },
  ];

  const request: SlaOperationsRequest = {
    tiers,
    selectedTierId: "gold",
    workflowClass: "deterministic",
    observation: createTestObservation(),
    totalCapacityUnits: 100,
    observedAt: new Date().toISOString(),
  };

  const decision = service.evaluate(request);

  assert.ok(decision.reservedCapacity["gold"]);
  assert.ok(decision.reservedCapacity["silver"]);
});

test("SlaOperationsService.evaluate handles custom reserved capacity plan", () => {
  const service = new SlaOperationsService();
  const tiers: SlaTierProfile[] = [
    { ...createTestTier({ tierId: "gold", reservedCapacityPercent: 20 }), targetLatencyMs: 500, targetSuccessRate: 0.99, maxQueueWaitMs: 2000, preemptionPriority: 10 },
  ];

  const customPlan: ReservedCapacityAllocation[] = [
    { tierId: "gold", reservedPercent: 50 },
  ];

  const request: SlaOperationsRequest = {
    tiers,
    selectedTierId: "gold",
    workflowClass: "deterministic",
    observation: createTestObservation(),
    reservedCapacityPlan: customPlan,
    totalCapacityUnits: 100,
    observedAt: new Date().toISOString(),
  };

  const decision = service.evaluate(request);

  assert.equal(decision.reservedCapacity["gold"], 50);
});

test("SlaOperationsService.evaluate handles empty tiers", () => {
  const service = new SlaOperationsService();

  const request: SlaOperationsRequest = {
    tiers: [],
    selectedTierId: null,
    workflowClass: "deterministic",
    observation: createTestObservation(),
    totalCapacityUnits: 100,
    observedAt: new Date().toISOString(),
  };

  const decision = service.evaluate(request);

  assert.equal(decision.selectedTierId, null);
  assert.equal(decision.routingHint, null);
  assert.equal(decision.breachRecords.length, 0);
});

test("detectSlaBreach returns empty array when within commitment", () => {
  const observation: SlaObservation = { latencyMs: 400, successRate: 1.0, queueWaitMs: 1500 };
  const commitment: SlaCommitment = { maxLatencyMs: 500, minSuccessRate: 0.99, maxQueueWaitMs: 2000 };

  const breaches = detectSlaBreach(observation, commitment);

  assert.equal(breaches.length, 0);
});

test("detectSlaBreach detects all three breach types", () => {
  const observation: SlaObservation = { latencyMs: 600, successRate: 0.95, queueWaitMs: 2500 };
  const commitment: SlaCommitment = { maxLatencyMs: 500, minSuccessRate: 0.99, maxQueueWaitMs: 2000 };

  const breaches = detectSlaBreach(observation, commitment);

  assert.equal(breaches.length, 3);
  assert.ok(breaches.includes("sla.latency_breach"));
  assert.ok(breaches.includes("sla.success_rate_breach"));
  assert.ok(breaches.includes("sla.queue_wait_breach"));
});

test("allocateReservedCapacity calculates correct amounts", () => {
  const allocations: ReservedCapacityAllocation[] = [
    { tierId: "gold", reservedPercent: 50 },
    { tierId: "silver", reservedPercent: 25 },
  ];

  const result = allocateReservedCapacity(100, allocations);

  assert.equal(result["gold"], 50);
  assert.equal(result["silver"], 25);
});

test("resolveHighestPriorityTier returns highest priority", () => {
  const tiers: SlaTier[] = [
    createTestTier({ tierId: "bronze", priority: 1 }),
    createTestTier({ tierId: "silver", priority: 2 }),
    createTestTier({ tierId: "gold", priority: 3 }),
  ];

  const result = resolveHighestPriorityTier(tiers);

  assert.equal(result?.tierId, "gold");
});

test("resolveHighestPriorityTier returns null for empty array", () => {
  const result = resolveHighestPriorityTier([]);
  assert.equal(result, null);
});
