import assert from "node:assert/strict";
import test from "node:test";

import { SlaOperationsService } from "../../../src/scale-ecosystem/sla-engine/sla-operations-service.js";

test("SlaOperationsService resolves routing hint and records breaches", () => {
  const service = new SlaOperationsService();
  const decision = service.evaluate({
    tiers: [
      {
        tierId: "enterprise",
        displayName: "Enterprise",
        priority: 3,
        reservedCapacityPercent: 40,
        targetLatencyMs: 300,
        targetSuccessRate: 0.995,
        maxQueueWaitMs: 800,
        preemptionPriority: 10,
      },
      {
        tierId: "standard",
        displayName: "Standard",
        priority: 1,
        reservedCapacityPercent: 20,
        targetLatencyMs: 800,
        targetSuccessRate: 0.98,
        maxQueueWaitMs: 3000,
        preemptionPriority: 2,
      },
    ],
    selectedTierId: "enterprise",
    observation: {
      latencyMs: 500,
      successRate: 0.99,
      queueWaitMs: 1200,
    },
    totalCapacityUnits: 100,
    observedAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(decision.selectedTierId, "enterprise");
  assert.equal(decision.routingHint?.reservedCapacityUnits, 40);
  assert.deepEqual(
    decision.breachRecords[0]?.breachCodes,
    ["sla.latency_breach", "sla.success_rate_breach", "sla.queue_wait_breach"],
  );
});
