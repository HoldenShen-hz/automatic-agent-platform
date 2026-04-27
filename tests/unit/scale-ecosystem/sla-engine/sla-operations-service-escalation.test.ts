/**
 * Unit tests for SlaOperationsService escalation and penalty decision handling
 *
 * @see src/scale-ecosystem/sla-engine/sla-operations-service.ts
 */

import assert from "node:assert";
import test from "node:test";
import {
  SlaOperationsService,
  type SlaTierProfile,
  type SlaOperationsRequest,
  type SlaObservation,
} from "../../../../src/scale-ecosystem/sla-engine/index.js";

function createTestTier(overrides: Partial<SlaTierProfile> & { tierId: string; priority: number }): SlaTierProfile {
  return {
    tierId: overrides.tierId,
    displayName: overrides.displayName ?? overrides.tierId,
    priority: overrides.priority,
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

test("SlaOperationsService.evaluate generates correct escalationActions for critical breach", () => {
  const service = new SlaOperationsService();
  const tiers: SlaTierProfile[] = [
    createTestTier({ tierId: "gold", priority: 1, targetSuccessRate: 0.999 }),
  ];

  // Create observation that breaches success rate (critical severity)
  const request: SlaOperationsRequest = {
    tiers,
    selectedTierId: "gold",
    observation: createTestObservation({ successRate: 0.95 }), // Below 0.999, triggers critical
    totalCapacityUnits: 100,
    observedAt: new Date().toISOString(),
  };

  const decision = service.evaluate(request);

  assert.ok(decision.breachRecords.length > 0, "Should have breach records");
  assert.ok(decision.escalationActions.length > 0, "Should have escalation actions");

  const escalationAction = decision.escalationActions[0];
  assert.equal(escalationAction?.tierId, "gold");
  assert.equal(escalationAction?.action, "page_sre", "Critical breach should trigger page_sre");
});

test("SlaOperationsService.evaluate generates correct escalationActions for warning breach", () => {
  const service = new SlaOperationsService();
  const tiers: SlaTierProfile[] = [
    createTestTier({ tierId: "gold", priority: 1, targetLatencyMs: 500 }),
  ];

  // Create observation that breaches latency (warning severity, not success rate)
  const request: SlaOperationsRequest = {
    tiers,
    selectedTierId: "gold",
    observation: createTestObservation({ latencyMs: 600 }), // Above 500ms but success rate is fine
    totalCapacityUnits: 100,
    observedAt: new Date().toISOString(),
  };

  const decision = service.evaluate(request);

  assert.ok(decision.breachRecords.length > 0, "Should have breach records");
  assert.ok(decision.escalationActions.length > 0, "Should have escalation actions");

  const escalationAction = decision.escalationActions[0];
  assert.equal(escalationAction?.tierId, "gold");
  assert.equal(escalationAction?.action, "notify_owner", "Warning breach should trigger notify_owner");
});

test("SlaOperationsService.evaluate generates correct penaltyDecisions for critical breach", () => {
  const service = new SlaOperationsService();
  const tiers: SlaTierProfile[] = [
    createTestTier({ tierId: "gold", priority: 1, targetSuccessRate: 0.999 }),
  ];

  const request: SlaOperationsRequest = {
    tiers,
    selectedTierId: "gold",
    observation: createTestObservation({ successRate: 0.95 }), // Triggers critical
    totalCapacityUnits: 100,
    observedAt: new Date().toISOString(),
  };

  const decision = service.evaluate(request);

  assert.ok(decision.penaltyDecisions.length > 0, "Should have penalty decisions");

  const penaltyDecision = decision.penaltyDecisions[0];
  assert.equal(penaltyDecision?.tierId, "gold");
  assert.equal(penaltyDecision?.penaltyType, "contract_review", "Critical breach should trigger contract_review");
  assert.equal(penaltyDecision?.severity, "critical");
});

test("SlaOperationsService.evaluate generates correct penaltyDecisions for warning breach", () => {
  const service = new SlaOperationsService();
  const tiers: SlaTierProfile[] = [
    createTestTier({ tierId: "gold", priority: 1, targetLatencyMs: 500 }),
  ];

  const request: SlaOperationsRequest = {
    tiers,
    selectedTierId: "gold",
    observation: createTestObservation({ latencyMs: 600 }), // Warning breach only
    totalCapacityUnits: 100,
    observedAt: new Date().toISOString(),
  };

  const decision = service.evaluate(request);

  assert.ok(decision.penaltyDecisions.length > 0, "Should have penalty decisions");

  const penaltyDecision = decision.penaltyDecisions[0];
  assert.equal(penaltyDecision?.tierId, "gold");
  assert.equal(penaltyDecision?.penaltyType, "credit", "Warning breach should trigger credit");
  assert.equal(penaltyDecision?.severity, "warning");
});

test("SlaOperationsService.evaluate generates correct routingHint", () => {
  const service = new SlaOperationsService();
  const tiers: SlaTierProfile[] = [
    createTestTier({
      tierId: "gold",
      priority: 1,
      targetLatencyMs: 500,
      targetSuccessRate: 0.999,
      maxQueueWaitMs: 2000,
      preemptionPriority: 10,
      reservedCapacityPercent: 20,
    }),
  ];

  const request: SlaOperationsRequest = {
    tiers,
    selectedTierId: "gold",
    observation: createTestObservation(),
    totalCapacityUnits: 100,
    observedAt: new Date().toISOString(),
  };

  const decision = service.evaluate(request);

  assert.ok(decision.routingHint, "Should have routing hint");
  assert.equal(decision.routingHint?.tierId, "gold");
  assert.equal(decision.routingHint?.preemptionPriority, 10);
  assert.equal(decision.routingHint?.maxQueueWaitMs, 2000);
  assert.equal(decision.routingHint?.reservedCapacityUnits, 20, "Reserved capacity should be 20% of 100 = 20");
});

test("SlaOperationsService.evaluate generates no escalationActions when no breach", () => {
  const service = new SlaOperationsService();
  const tiers: SlaTierProfile[] = [
    createTestTier({ tierId: "gold", priority: 1 }),
  ];

  const request: SlaOperationsRequest = {
    tiers,
    selectedTierId: "gold",
    observation: createTestObservation({ latencyMs: 400, successRate: 1.0, queueWaitMs: 1500 }),
    totalCapacityUnits: 100,
    observedAt: new Date().toISOString(),
  };

  const decision = service.evaluate(request);

  assert.equal(decision.breachRecords.length, 0, "Should have no breach records");
  assert.equal(decision.escalationActions.length, 0, "Should have no escalation actions");
  assert.equal(decision.penaltyDecisions.length, 0, "Should have no penalty decisions");
});

test("SlaOperationsService.evaluate generates multiple escalationActions for multiple breach types", () => {
  const service = new SlaOperationsService();
  const tiers: SlaTierProfile[] = [
    createTestTier({
      tierId: "gold",
      priority: 1,
      targetLatencyMs: 500,
      targetSuccessRate: 0.999,
      maxQueueWaitMs: 2000,
    }),
  ];

  // Observation that triggers both latency breach (warning) and success rate breach (critical)
  const request: SlaOperationsRequest = {
    tiers,
    selectedTierId: "gold",
    observation: createTestObservation({
      latencyMs: 600, // breach
      successRate: 0.95, // breach
      queueWaitMs: 2500, // breach
    }),
    totalCapacityUnits: 100,
    observedAt: new Date().toISOString(),
  };

  const decision = service.evaluate(request);

  assert.ok(decision.breachRecords.length > 0);
  // Should have escalation actions and penalty decisions
  assert.ok(decision.escalationActions.length > 0);
  assert.ok(decision.penaltyDecisions.length > 0);

  // The reason field should contain all breach codes
  const escalationReason = decision.escalationActions[0]?.reason;
  assert.ok(escalationReason?.includes("sla.latency_breach"));
  assert.ok(escalationReason?.includes("sla.success_rate_breach"));
  assert.ok(escalationReason?.includes("sla.queue_wait_breach"));
});

test("SlaOperationsService.evaluate handles selectedTierId not found", () => {
  const service = new SlaOperationsService();
  const tiers: SlaTierProfile[] = [
    createTestTier({ tierId: "gold", priority: 1 }),
  ];

  const request: SlaOperationsRequest = {
    tiers,
    selectedTierId: "nonexistent",
    observation: createTestObservation(),
    totalCapacityUnits: 100,
    observedAt: new Date().toISOString(),
  };

  const decision = service.evaluate(request);

  assert.equal(decision.selectedTierId, null, "Should return null when tier not found");
  assert.equal(decision.routingHint, null, "Should have no routing hint");
});

test("SlaOperationsService.evaluate uses tier defaults when optional fields missing", () => {
  const service = new SlaOperationsService();
  const tiers: SlaTierProfile[] = [
    createTestTier({ tierId: "minimal", priority: 1 }),
  ];

  const request: SlaOperationsRequest = {
    tiers,
    selectedTierId: "minimal",
    observation: createTestObservation(),
    totalCapacityUnits: 100,
    observedAt: new Date().toISOString(),
  };

  const decision = service.evaluate(request);

  assert.ok(decision.routingHint, "Should have routing hint");
  // Default values from tier resolver: targetLatencyMs: 1000, targetSuccessRate: 0.99, maxQueueWaitMs: 3000
  // But commitment uses selectedTier values which come from createTestTier defaults
});
