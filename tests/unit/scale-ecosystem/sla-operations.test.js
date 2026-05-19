import assert from "node:assert/strict";
import test from "node:test";
import { detectSlaBreach } from "../../../src/scale-ecosystem/sla-engine/breach-detector/index.js";
import { resolveHighestPriorityTier, SlaTierSchema } from "../../../src/scale-ecosystem/sla-engine/tier-resolver/index.js";
import { allocateReservedCapacity } from "../../../src/scale-ecosystem/sla-engine/resource-allocator/index.js";
import { SlaOperationsService } from "../../../src/scale-ecosystem/sla-engine/sla-operations-service.js";

test("detectSlaBreach returns empty array when all metrics within commitment", () => {
  const observation = { latencyMs: 500, successRate: 0.999, queueWaitMs: 2000 };
  const commitment = { maxLatencyMs: 1000, minSuccessRate: 0.99, maxQueueWaitMs: 3000 };
  const breaches = detectSlaBreach(observation, commitment);
  assert.equal(breaches.length, 0);
});

test("detectSlaBreach detects latency breach", () => {
  const observation = { latencyMs: 1500, successRate: 0.999, queueWaitMs: 2000 };
  const commitment = { maxLatencyMs: 1000, minSuccessRate: 0.99, maxQueueWaitMs: 3000 };
  const breaches = detectSlaBreach(observation, commitment);
  assert.equal(breaches.includes("sla.latency_breach"), true);
});

test("detectSlaBreach detects success rate breach", () => {
  const observation = { latencyMs: 500, successRate: 0.95, queueWaitMs: 2000 };
  const commitment = { maxLatencyMs: 1000, minSuccessRate: 0.99, maxQueueWaitMs: 3000 };
  const breaches = detectSlaBreach(observation, commitment);
  assert.equal(breaches.includes("sla.success_rate_breach"), true);
});

test("detectSlaBreach detects queue wait breach", () => {
  const observation = { latencyMs: 500, successRate: 0.999, queueWaitMs: 4000 };
  const commitment = { maxLatencyMs: 1000, minSuccessRate: 0.99, maxQueueWaitMs: 3000 };
  const breaches = detectSlaBreach(observation, commitment);
  assert.equal(breaches.includes("sla.queue_wait_breach"), true);
});

test("detectSlaBreach detects execution timeout breach", () => {
  const observation = { latencyMs: 500, successRate: 0.999, queueWaitMs: 2000, executionTimeoutRate: 0.15 };
  const commitment = { maxLatencyMs: 1000, minSuccessRate: 0.99, maxQueueWaitMs: 3000, maxExecutionTimeoutRate: 0.1 };
  const breaches = detectSlaBreach(observation, commitment);
  assert.equal(breaches.includes("sla.execution_timeout_breach"), true);
});

test("detectSlaBreach detects dependency unavailability breach", () => {
  const observation = { latencyMs: 500, successRate: 0.999, queueWaitMs: 2000, dependencyAvailability: 0.8 };
  const commitment = { maxLatencyMs: 1000, minSuccessRate: 0.99, maxQueueWaitMs: 3000, minDependencyAvailability: 0.95 };
  const breaches = detectSlaBreach(observation, commitment);
  assert.equal(breaches.includes("sla.dependency_unavailability_breach"), true);
});

test("resolveHighestPriorityTier returns highest priority tier", () => {
  const tiers = [
    SlaTierSchema.parse({ tierId: "tier-1", displayName: "Basic", priority: 1 }),
    SlaTierSchema.parse({ tierId: "tier-2", displayName: "Standard", priority: 5 }),
    SlaTierSchema.parse({ tierId: "tier-3", displayName: "Premium", priority: 10 }),
  ];
  const selected = resolveHighestPriorityTier(tiers);
  assert.equal(selected?.tierId, "tier-3");
});

test("resolveHighestPriorityTier returns null for empty tiers", () => {
  const selected = resolveHighestPriorityTier([]);
  assert.equal(selected, null);
});

test("allocateReservedCapacity distributes capacity proportionally", () => {
  const allocations = [
    { tierId: "tier-1", reservedPercent: 20 },
    { tierId: "tier-2", reservedPercent: 30 },
    { tierId: "tier-3", reservedPercent: 50 },
  ];
  const result = allocateReservedCapacity(1000, allocations);
  assert.equal(result["tier-1"], 200);
  assert.equal(result["tier-2"], 300);
  assert.equal(result["tier-3"], 500);
});

test("allocateReservedCapacity handles zero total units", () => {
  const allocations = [{ tierId: "tier-1", reservedPercent: 50 }];
  const result = allocateReservedCapacity(0, allocations);
  assert.equal(result["tier-1"], 0);
});

test("SlaOperationsService.evaluate selects highest priority tier when none specified", () => {
  const service = new SlaOperationsService();
  const tiers = [
    { tierId: "tier-1", displayName: "Basic", priority: 1, targetLatencyMs: 2000, targetSuccessRate: 0.95, maxQueueWaitMs: 5000, preemptionPriority: 1 },
    { tierId: "tier-2", displayName: "Premium", priority: 10, targetLatencyMs: 500, targetSuccessRate: 0.999, maxQueueWaitMs: 1000, preemptionPriority: 10 },
  ];
  const decision = service.evaluate({
    tiers,
    workflowClass: "deterministic",
    observation: { latencyMs: 400, successRate: 0.999, queueWaitMs: 500 },
    totalCapacityUnits: 1000,
    observedAt: "2026-04-29T00:00:00.000Z",
  });
  assert.equal(decision.selectedTierId, "tier-2");
  assert.equal(decision.routingHint?.tierId, "tier-2");
});

test("SlaOperationsService.evaluate generates breach records on violation", () => {
  const service = new SlaOperationsService();
  const tiers = [
    { tierId: "tier-1", displayName: "Standard", priority: 5, targetLatencyMs: 1000, targetSuccessRate: 0.99, maxQueueWaitMs: 3000, preemptionPriority: 5 },
  ];
  const decision = service.evaluate({
    tiers,
    workflowClass: "deterministic",
    observation: { latencyMs: 1500, successRate: 0.98, queueWaitMs: 2000 },
    totalCapacityUnits: 1000,
    observedAt: "2026-04-29T00:00:00.000Z",
  });
  assert.equal(decision.breachRecords.length, 1);
  assert.equal(decision.breachRecords[0].severity, "warning");
  assert.equal(decision.breachRecords[0].breachCodes.includes("sla.latency_breach"), true);
});

test("SlaOperationsService.evaluate applies workflow class latency multiplier", () => {
  const service = new SlaOperationsService();
  const tiers = [
    { tierId: "tier-1", displayName: "Standard", priority: 5, targetLatencyMs: 1000, targetSuccessRate: 0.99, maxQueueWaitMs: 3000, preemptionPriority: 5 },
  ];
  const decision = service.evaluate({
    tiers,
    workflowClass: "hitl_waiting",
    observation: { latencyMs: 1800, successRate: 0.99, queueWaitMs: 3000 },
    totalCapacityUnits: 1000,
    observedAt: "2026-04-29T00:00:00.000Z",
  });
  // hitl_waiting has 2.0 multiplier, so 1000 * 2.0 = 2000ms threshold
  // 1800 < 2000, so no latency breach
  assert.equal(decision.breachRecords.length, 0);
});

test("SlaOperationsService.evaluate generates escalation actions for breaches", () => {
  const service = new SlaOperationsService();
  const tiers = [
    { tierId: "tier-1", displayName: "Standard", priority: 5, targetLatencyMs: 1000, targetSuccessRate: 0.99, maxQueueWaitMs: 3000, preemptionPriority: 5 },
  ];
  const decision = service.evaluate({
    tiers,
    workflowClass: "deterministic",
    observation: { latencyMs: 1500, successRate: 0.95, queueWaitMs: 2000 },
    totalCapacityUnits: 1000,
    observedAt: "2026-04-29T00:00:00.000Z",
  });
  assert.ok(decision.escalationActions.length > 0);
  assert.equal(decision.escalationActions[0].tierId, "tier-1");
});

test("SlaOperationsService.evaluate generates penalty decisions for breaches", () => {
  const service = new SlaOperationsService();
  const tiers = [
    { tierId: "tier-1", displayName: "Standard", priority: 5, targetLatencyMs: 1000, targetSuccessRate: 0.99, maxQueueWaitMs: 3000, preemptionPriority: 5 },
  ];
  const decision = service.evaluate({
    tiers,
    workflowClass: "deterministic",
    observation: { latencyMs: 1500, successRate: 0.95, queueWaitMs: 2000 },
    totalCapacityUnits: 1000,
    observedAt: "2026-04-29T00:00:00.000Z",
  });
  assert.ok(decision.penaltyDecisions.length > 0);
  assert.equal(decision.penaltyDecisions[0].tierId, "tier-1");
});

test("SlaOperationsService.evaluate applies reserved capacity allocation", () => {
  const service = new SlaOperationsService();
  const tiers = [
    { tierId: "tier-1", displayName: "Basic", priority: 1, reservedCapacityPercent: 20, targetLatencyMs: 2000, targetSuccessRate: 0.95, maxQueueWaitMs: 5000, preemptionPriority: 1 },
    { tierId: "tier-2", displayName: "Premium", priority: 10, reservedCapacityPercent: 30, targetLatencyMs: 500, targetSuccessRate: 0.999, maxQueueWaitMs: 1000, preemptionPriority: 10 },
  ];
  const decision = service.evaluate({
    tiers,
    workflowClass: "deterministic",
    observation: { latencyMs: 400, successRate: 0.999, queueWaitMs: 500 },
    totalCapacityUnits: 1000,
    observedAt: "2026-04-29T00:00:00.000Z",
  });
  assert.equal(decision.reservedCapacity["tier-1"], 200);
  assert.equal(decision.reservedCapacity["tier-2"], 300);
});

test("SlaOperationsService.evaluate marks starvation protection when capacity reserved", () => {
  const service = new SlaOperationsService();
  const tiers = [
    { tierId: "tier-1", displayName: "Basic", priority: 1, reservedCapacityPercent: 10, targetLatencyMs: 2000, targetSuccessRate: 0.95, maxQueueWaitMs: 5000, preemptionPriority: 1 },
  ];
  const decision = service.evaluate({
    tiers,
    workflowClass: "deterministic",
    observation: { latencyMs: 1500, successRate: 0.99, queueWaitMs: 4000 },
    totalCapacityUnits: 1000,
    observedAt: "2026-04-29T00:00:00.000Z",
  });
  assert.equal(decision.starvationProtected, true);
});

test("SlaOperationsService.evaluate uses explicit selectedTierId when provided", () => {
  const service = new SlaOperationsService();
  const tiers = [
    { tierId: "tier-1", displayName: "Basic", priority: 1, targetLatencyMs: 2000, targetSuccessRate: 0.95, maxQueueWaitMs: 5000, preemptionPriority: 1 },
    { tierId: "tier-2", displayName: "Premium", priority: 10, targetLatencyMs: 500, targetSuccessRate: 0.999, maxQueueWaitMs: 1000, preemptionPriority: 10 },
  ];
  const decision = service.evaluate({
    tiers,
    selectedTierId: "tier-1",
    workflowClass: "deterministic",
    observation: { latencyMs: 1500, successRate: 0.99, queueWaitMs: 4000 },
    totalCapacityUnits: 1000,
    observedAt: "2026-04-29T00:00:00.000Z",
  });
  assert.equal(decision.selectedTierId, "tier-1");
});