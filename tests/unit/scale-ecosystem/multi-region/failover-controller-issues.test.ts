/**
 * Failover Controller Issue #2202 Tests
 *
 * Issue #2202: Failover blindly picks candidates[0]
 *
 * The resolveRegionFailover method picks the first candidate without
 * checking health or latency, which may not be the best choice.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  RegionFailoverController,
  type RegionFailoverInput,
} from "../../../../src/scale-ecosystem/multi-region/failover-controller/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Issue #2202: Failover blindly picks candidates[0]
// ─────────────────────────────────────────────────────────────────────────────

test("failover-controller-2202: uses candidate signals instead of blindly picking index 0", () => {
  const controller = new RegionFailoverController();

  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["region-a", "region-b", "region-c"],
    candidateRegionSignals: {
      "region-a": { healthy: true, latencyMs: 400, errorRate: 0.03 },
      "region-b": { healthy: true, latencyMs: 50, errorRate: 0.01 },
      "region-c": { healthy: false, latencyMs: 20, errorRate: 0.5 },
    },
  };

  const decision = controller.resolveRegionFailover(input);
  assert.equal(decision.targetRegionId, "region-b");
});

test("failover-controller-2202: preferredRegionId overrides blind pick", () => {
  const controller = new RegionFailoverController();

  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["region-a", "region-b", "region-c"],
    preferredRegionId: "region-b",
  };

  const decision = controller.resolveRegionFailover(input);

  // When preferredRegionId is provided and valid, it overrides
  assert.equal(decision.targetRegionId, "region-b");
});

test("failover-controller-2202: skips candidates whose circuit breaker is open", () => {
  const controller = new RegionFailoverController();
  controller.recordFailure("first");
  controller.recordFailure("first");
  controller.recordFailure("first");

  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["first", "second", "third"],
  };

  const decision = controller.resolveRegionFailover(input);
  assert.equal(decision.targetRegionId, "second");
});

test("failover-controller-2202: best practice is to select healthiest region", () => {
  const controller = new RegionFailoverController();

  // Issue #2202: Best practice is to select based on:
  // 1. Health status (healthy > degraded > unhealthy)
  // 2. Latency (lowest first)
  // 3. Error rate (lowest first)

  // But current implementation ignores all of these

  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["unhealthy-region", "healthy-region", "degraded-region"],
    candidateRegionSignals: {
      "unhealthy-region": { healthy: false, latencyMs: 20, errorRate: 0.8 },
      "healthy-region": { healthy: true, latencyMs: 70, errorRate: 0.01 },
      "degraded-region": { healthy: true, latencyMs: 250, errorRate: 0.04 },
    },
  };

  const decision = controller.resolveRegionFailover(input);
  assert.equal(decision.targetRegionId, "healthy-region");
});

test("failover-controller-2202: latency information participates in ranking", () => {
  const controller = new RegionFailoverController();

  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["high-latency", "low-latency"],
    primaryLatencyMs: 200,
    maxAcceptableLatencyMs: 100,
    candidateRegionSignals: {
      "high-latency": { healthy: true, latencyMs: 400, errorRate: 0.02 },
      "low-latency": { healthy: true, latencyMs: 25, errorRate: 0.02 },
    },
  };

  const decision = controller.resolveRegionFailover(input);
  assert.equal(decision.targetRegionId, "low-latency");
});

test("failover-controller-2202: ordered candidates no longer affects outcome when signals differ", () => {
  const controller = new RegionFailoverController();

  // Same regions, different order
  const input1: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["best", "worst"],
    candidateRegionSignals: {
      best: { healthy: true, latencyMs: 40, errorRate: 0.01 },
      worst: { healthy: true, latencyMs: 400, errorRate: 0.2 },
    },
  };

  const input2: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["worst", "best"],
    candidateRegionSignals: {
      best: { healthy: true, latencyMs: 40, errorRate: 0.01 },
      worst: { healthy: true, latencyMs: 400, errorRate: 0.2 },
    },
  };

  const decision1 = controller.resolveRegionFailover(input1);
  const decision2 = controller.resolveRegionFailover(input2);
  assert.equal(decision1.targetRegionId, "best");
  assert.equal(decision2.targetRegionId, "best");
});

test("failover-controller-2202: with preferredRegionId not in candidates, falls back to best eligible candidate", () => {
  const controller = new RegionFailoverController();

  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["region-a", "region-b"],
    preferredRegionId: "not-in-list", // Not in candidates
    candidateRegionSignals: {
      "region-a": { healthy: true, latencyMs: 300, errorRate: 0.04 },
      "region-b": { healthy: true, latencyMs: 50, errorRate: 0.01 },
    },
  };

  const decision = controller.resolveRegionFailover(input);
  assert.equal(decision.targetRegionId, "region-b");
});

test("failover-controller-2202: empty candidates returns null", () => {
  const controller = new RegionFailoverController();

  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: [],
  };

  const decision = controller.resolveRegionFailover(input);

  assert.equal(decision.shouldFailover, false);
  assert.equal(decision.targetRegionId, null);
});

test("failover-controller-2202: healthy primary does not failover", () => {
  const controller = new RegionFailoverController();

  const input: RegionFailoverInput = {
    primaryHealthy: true,
    candidateRegionIds: ["region-a", "region-b"],
  };

  const decision = controller.resolveRegionFailover(input);

  assert.equal(decision.shouldFailover, false);
  assert.equal(decision.targetRegionId, null);
});

test("failover-controller-2202: generates proper fencing token on failover", () => {
  const controller = new RegionFailoverController();

  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["region-b"],
  };

  const decision = controller.resolveRegionFailover(input);

  assert.equal(decision.shouldFailover, true);
  assert.ok(decision.fencingToken !== null);
  assert.equal(decision.fencingToken?.epoch, 1);
  assert.equal(decision.fencingToken?.previousLeaderId, null); // First leader
});

test("failover-controller-2202: second failover increments epoch", () => {
  const controller = new RegionFailoverController();

  // First failover
  const input1: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["region-b"],
  };
  const decision1 = controller.resolveRegionFailover(input1);

  // Second failover
  const input2: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["region-c"],
  };
  const decision2 = controller.resolveRegionFailover(input2);

  assert.equal(decision1.fencingToken?.epoch, 1);
  assert.equal(decision2.fencingToken?.epoch, 2);
});

test("failover-controller-2202: demotion acknowledgment required for leader change", () => {
  const controller = new RegionFailoverController();

  // First failover to region-b
  const input1: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["region-b"],
  };
  controller.resolveRegionFailover(input1);

  // Acknowledge demotion (region-b is now leader, so this is a no-op initially)
  controller.acknowledgeDemotion("region-b");

  // Second failover to region-c
  const input2: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["region-c"],
  };
  const decision2 = controller.resolveRegionFailover(input2);

  // Shoulddemote old leader (region-b)
  assert.equal(decision2.demoteOldLeader, true);
  assert.equal(decision2.oldLeaderId, "region-b");
});

test("failover-controller-2202: split-brain detection", () => {
  const controller = new RegionFailoverController();

  // Set initial leader
  controller.resolveRegionFailover({
    primaryHealthy: false,
    candidateRegionIds: ["region-a"],
  });

  // Another region claims to be leader with same epoch
  const hasSplitBrain = controller.detectSplitBrain("region-b", 1);

  // Same epoch, different leader = split brain
  assert.equal(hasSplitBrain, true);
});

test("failover-controller-2202: stale leader is detected", () => {
  const controller = new RegionFailoverController();

  // Set initial leader with epoch 1
  controller.resolveRegionFailover({
    primaryHealthy: false,
    candidateRegionIds: ["region-a"],
  });

  // Another region claims to be leader with lower epoch
  const hasSplitBrain = controller.detectSplitBrain("region-c", 0);

  // Lower epoch = stale
  assert.equal(hasSplitBrain, true);
});

test("failover-controller-2202: valid leader is accepted", () => {
  const controller = new RegionFailoverController();

  // Set initial leader with epoch 1
  controller.resolveRegionFailover({
    primaryHealthy: false,
    candidateRegionIds: ["region-a"],
  });

  // Same region re-affirms leadership
  const hasSplitBrain = controller.detectSplitBrain("region-a", 1);

  // Same region, same epoch = valid
  assert.equal(hasSplitBrain, false);
});
