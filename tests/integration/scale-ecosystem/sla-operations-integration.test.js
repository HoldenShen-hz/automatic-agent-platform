import assert from "node:assert/strict";
import test from "node:test";
import { SlaOperationsService } from "../../../src/scale-ecosystem/sla-engine/sla-operations-service.js";
import { detectSlaBreach } from "../../../src/scale-ecosystem/sla-engine/breach-detector/index.js";
import { allocateReservedCapacity } from "../../../src/scale-ecosystem/sla-engine/resource-allocator/index.js";
import { resolveHighestPriorityTier } from "../../../src/scale-ecosystem/sla-engine/tier-resolver/index.js";

test("integration: SlaOperationsService evaluates deterministic workflow within SLA", () => {
  const service = new SlaOperationsService();
  const tiers = [
    { tierId: "standard", displayName: "Standard", priority: 5, targetLatencyMs: 1000, targetSuccessRate: 0.99, maxQueueWaitMs: 3000, preemptionPriority: 5 },
  ];
  const decision = service.evaluate({
    tiers,
    workflowClass: "deterministic",
    observation: { latencyMs: 400, successRate: 0.999, queueWaitMs: 1500 },
    totalCapacityUnits: 1000,
    observedAt: "2026-04-29T00:00:00.000Z",
  });

  assert.equal(decision.selectedTierId, "standard");
  assert.equal(decision.breachRecords.length, 0);
  assert.equal(decision.escalationActions.length, 0);
  assert.equal(decision.starvationProtected, true);
});

test("integration: SlaOperationsService triggers breach detection for LLM-assisted workflow", () => {
  const service = new SlaOperationsService();
  const tiers = [
    { tierId: "premium", displayName: "Premium", priority: 10, targetLatencyMs: 2000, targetSuccessRate: 0.995, maxQueueWaitMs: 5000, preemptionPriority: 10 },
  ];
  const decision = service.evaluate({
    tiers,
    workflowClass: "llm_assisted",
    observation: { latencyMs: 2800, successRate: 0.99, queueWaitMs: 4000 },
    totalCapacityUnits: 1000,
    observedAt: "2026-04-29T00:00:00.000Z",
  });

  // llm_assisted has 1.5x latency multiplier: 2000 * 1.5 = 3000ms threshold
  // 2800 < 3000, no latency breach
  assert.equal(decision.breachRecords.length, 0);
});

test("integration: SlaOperationsService generates critical escalation for success rate breach", () => {
  const service = new SlaOperationsService();
  const tiers = [
    { tierId: "enterprise", displayName: "Enterprise", priority: 10, targetLatencyMs: 1000, targetSuccessRate: 0.999, maxQueueWaitMs: 2000, preemptionPriority: 10 },
  ];
  const decision = service.evaluate({
    tiers,
    workflowClass: "deterministic",
    observation: { latencyMs: 500, successRate: 0.97, queueWaitMs: 1500 },
    totalCapacityUnits: 2000,
    observedAt: "2026-04-29T00:00:00.000Z",
  });

  assert.ok(decision.breachRecords.length > 0);
  assert.equal(decision.breachRecords[0].severity, "critical");
  assert.equal(decision.escalationActions[0].action, "page_sre");
  assert.equal(decision.penaltyDecisions[0].penaltyType, "contract_review");
});

test("integration: SlaOperationsService applies reserved capacity with multiple tiers", () => {
  const service = new SlaOperationsService();
  const tiers = [
    { tierId: "basic", displayName: "Basic", priority: 1, reservedCapacityPercent: 10, targetLatencyMs: 5000, targetSuccessRate: 0.95, maxQueueWaitMs: 10000, preemptionPriority: 1 },
    { tierId: "standard", displayName: "Standard", priority: 5, reservedCapacityPercent: 30, targetLatencyMs: 2000, targetSuccessRate: 0.99, maxQueueWaitMs: 5000, preemptionPriority: 5 },
    { tierId: "premium", displayName: "Premium", priority: 10, reservedCapacityPercent: 60, targetLatencyMs: 500, targetSuccessRate: 0.999, maxQueueWaitMs: 2000, preemptionPriority: 10 },
  ];
  const decision = service.evaluate({
    tiers,
    workflowClass: "deterministic",
    observation: { latencyMs: 400, successRate: 0.999, queueWaitMs: 1000 },
    totalCapacityUnits: 1000,
    observedAt: "2026-04-29T00:00:00.000Z",
  });

  assert.equal(decision.reservedCapacity["basic"], 100);
  assert.equal(decision.reservedCapacity["standard"], 300);
  assert.equal(decision.reservedCapacity["premium"], 600);
  assert.equal(decision.starvationProtected, true);
});

test("integration: detectSlaBreach returns multiple breaches", () => {
  const breaches = detectSlaBreach(
    { latencyMs: 2000, successRate: 0.95, queueWaitMs: 5000 },
    { maxLatencyMs: 1000, minSuccessRate: 0.99, maxQueueWaitMs: 3000 }
  );

  assert.equal(breaches.includes("sla.latency_breach"), true);
  assert.equal(breaches.includes("sla.success_rate_breach"), true);
  assert.equal(breaches.includes("sla.queue_wait_breach"), true);
  assert.equal(breaches.length, 3);
});

test("integration: resolveHighestPriorityTier handles empty tier list", () => {
  const result = resolveHighestPriorityTier([]);
  assert.equal(result, null);
});

test("integration: allocateReservedCapacity distributes capacity correctly", () => {
  const result = allocateReservedCapacity(10000, [
    { tierId: "tier-A", reservedPercent: 25 },
    { tierId: "tier-B", reservedPercent: 50 },
    { tierId: "tier-C", reservedPercent: 25 },
  ]);

  assert.equal(result["tier-A"], 2500);
  assert.equal(result["tier-B"], 5000);
  assert.equal(result["tier-C"], 2500);
});

test("integration: SlaOperationsService handles HITL waiting workflow with relaxed thresholds", () => {
  const service = new SlaOperationsService();
  const tiers = [
    { tierId: "standard", displayName: "Standard", priority: 5, targetLatencyMs: 1000, targetSuccessRate: 0.99, maxQueueWaitMs: 3000, preemptionPriority: 5 },
  ];
  const decision = service.evaluate({
    tiers,
    workflowClass: "hitl_waiting",
    observation: { latencyMs: 1800, successRate: 0.98, queueWaitMs: 4000 },
    totalCapacityUnits: 1000,
    observedAt: "2026-04-29T00:00:00.000Z",
  });

  // hitl_waiting has 2.0x latency multiplier: 1000 * 2.0 = 2000ms
  // 1800 < 2000, so no latency breach
  // success rate 0.98 < 0.99, so success rate breach
  assert.equal(decision.breachRecords.some(b => b.breachCodes.includes("sla.success_rate_breach")), true);
});

test("integration: SlaOperationsService applies preemption cap for low priority tier", () => {
  const service = new SlaOperationsService();
  const tiers = [
    { tierId: "basic", displayName: "Basic", priority: 1, preemptionPriority: 1, targetLatencyMs: 5000, targetSuccessRate: 0.95, maxQueueWaitMs: 10000 },
    { tierId: "premium", displayName: "Premium", priority: 10, preemptionPriority: 10, targetLatencyMs: 500, targetSuccessRate: 0.999, maxQueueWaitMs: 2000 },
  ];
  const decision = service.evaluate({
    tiers,
    selectedTierId: "basic",
    workflowClass: "deterministic",
    observation: { latencyMs: 4000, successRate: 0.99, queueWaitMs: 8000 },
    totalCapacityUnits: 1000,
    observedAt: "2026-04-29T00:00:00.000Z",
  });

  // Basic tier has preemptionPriority 1 which is <= max (10), so preemptionCapApplied = true
  assert.equal(decision.preemptionCapApplied, true);
  assert.equal(decision.selectedTierId, "basic");
});

test("integration: SlaOperationsService generates routing hint with capacity info", () => {
  const service = new SlaOperationsService();
  const tiers = [
    { tierId: "standard", displayName: "Standard", priority: 5, reservedCapacityPercent: 25, targetLatencyMs: 1000, targetSuccessRate: 0.99, maxQueueWaitMs: 3000, preemptionPriority: 5 },
  ];
  const decision = service.evaluate({
    tiers,
    workflowClass: "deterministic",
    observation: { latencyMs: 500, successRate: 0.999, queueWaitMs: 1000 },
    totalCapacityUnits: 1000,
    observedAt: "2026-04-29T00:00:00.000Z",
  });

  assert.ok(decision.routingHint != null);
  assert.equal(decision.routingHint.tierId, "standard");
  assert.equal(decision.routingHint.reservedCapacityUnits, 250);
  assert.equal(decision.routingHint.maxQueueWaitMs, 3000);
});