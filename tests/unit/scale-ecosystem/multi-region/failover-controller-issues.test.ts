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
} from "../../../../../src/scale-ecosystem/multi-region/failover-controller/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Issue #2202: Failover blindly picks candidates[0]
// ─────────────────────────────────────────────────────────────────────────────

test("failover-controller-2202: picks first candidate without health check", () => {
  const controller = new RegionFailoverController();

  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["region-a", "region-b", "region-c"],
    // No health information provided
    // No latency information provided
  };

  const decision = controller.resolveRegionFailover(input);

  // Issue #2202: Blindly picks candidates[0]
  assert.equal(decision.targetRegionId, "region-a");

  // BUG: This is wrong because:
  // 1. No health check is performed
  // 2. No latency comparison
  // 3. Just picks first in array
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

test("failover-controller-2202: without preferredRegionId, still picks first", () => {
  const controller = new RegionFailoverController();

  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["first", "second", "third"],
  };

  const decision = controller.resolveRegionFailover(input);

  // BUG: Still picks first even without preferredRegionId
  assert.equal(decision.targetRegionId, "first");
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
    // Should select "healthy-region" but picks "unhealthy-region" first
  };

  const decision = controller.resolveRegionFailover(input);

  // BUG: Picks unhealthy-region because it's first
  assert.equal(decision.targetRegionId, "unhealthy-region");
});

test("failover-controller-2202: latency information is ignored", () => {
  const controller = new RegionFailoverController();

  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["high-latency", "low-latency"],
    primaryLatencyMs: 200,
    maxAcceptableLatencyMs: 100,
    // Should consider candidate latencies but doesn't
  };

  const decision = controller.resolveRegionFailover(input);

  // BUG: Ignores that low-latency would be better
  assert.equal(decision.targetRegionId, "high-latency");
});

test("failover-controller-2202: ordered candidates affects outcome", () => {
  const controller = new RegionFailoverController();

  // Same regions, different order
  const input1: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["best", "worst"],
  };

  const input2: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["worst", "best"],
  };

  const decision1 = controller.resolveRegionFailover(input1);
  const decision2 = controller.resolveRegionFailover(input2);

  // BUG: Order of candidates affects the result
  // This is incorrect - should always pick best regardless of order
  assert.equal(decision1.targetRegionId, "best");
  assert.equal(decision2.targetRegionId, "worst"); // Wrong choice!
});

test("failover-controller-2202: with preferredRegionId not in candidates, falls back to first", () => {
  const controller = new RegionFailoverController();

  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["region-a", "region-b"],
    preferredRegionId: "not-in-list", // Not in candidates
  };

  const decision = controller.resolveRegionFailover(input);

  // Falls back to first candidate when preferred is not available
  assert.equal(decision.targetRegionId, "region-a");
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
