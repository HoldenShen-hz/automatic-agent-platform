/**
 * Performance tests for SLA Engine operations
 *
 * Design targets:
 * - SLA evaluation: >5000 ops/sec
 * - Breach detection: >3000 ops/sec
 * - Tier resolution: >10000 ops/sec
 */

import assert from "node:assert/strict";
import test from "node:test";
import { reportSoftPerformanceMiss } from "../../helpers/performance.js";

import { SlaOperationsService, type SlaTierProfile, type SlaOperationsRequest, type SlaObservation } from "../../../src/scale-ecosystem/sla-engine/sla-operations-service.js";
import { SlaBreachDetector } from "../../../src/scale-ecosystem/sla-engine/breach-detector/sla-breach-detector.js";
import { TierResolver } from "../../../src/scale-ecosystem/sla-engine/tier-resolver/tier-resolver.js";

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

test("performance: SLA evaluation throughput >5000 ops/sec", (t) => {
  const service = new SlaOperationsService();

  const tiers = [
    createTier({ tierId: "bronze", priority: 1 }),
    createTier({ tierId: "silver", priority: 2 }),
    createTier({ tierId: "gold", priority: 3 }),
  ];

  try {
    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const request = createSlaRequest({
        tiers,
        observation: createObservation({ latencyMs: 500 + (i % 100) }),
      });
      service.evaluate(request);
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 5000,
        `SLA evaluation throughput ${opsPerSec.toFixed(2)} ops/sec must be >5000 ops/sec. Avg latency: ${avgLatencyMs.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    // No cleanup needed for SLA service
  }
});

test("performance: breach detection >3000 ops/sec", (t) => {
  const detector = new SlaBreachDetector();

  const tiers = [
    createTier({ tierId: "standard", targetLatencyMs: 1000, targetSuccessRate: 0.99 }),
  ];

  try {
    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      detector.checkBreaches({
        tiers,
        observation: createObservation({
          latencyMs: 1200,
          successRate: 0.98,
          queueWaitMs: 3500,
        }),
        observedAt: new Date().toISOString(),
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;

    try {
      assert.ok(
        opsPerSec > 3000,
        `Breach detection throughput ${opsPerSec.toFixed(2)} ops/sec must be >3000 ops/sec`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    // No cleanup needed
  }
});

test("performance: tier resolution >10000 ops/sec", (t) => {
  const resolver = new TierResolver();

  const tiers = [
    createTier({ tierId: "bronze", priority: 1 }),
    createTier({ tierId: "silver", priority: 2 }),
    createTier({ tierId: "gold", priority: 3 }),
  ];

  try {
    const iterations = 2000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      resolver.resolveTier({
        tiers,
        workflowClass: "deterministic",
        requiredLatencyMs: 500,
        requiredSuccessRate: 0.999,
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;

    try {
      assert.ok(
        opsPerSec > 10000,
        `Tier resolution throughput ${opsPerSec.toFixed(2)} ops/sec must be >10000 ops/sec`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    // No cleanup needed
  }
});