/**
 * Comprehensive unit tests for RegionFailoverController
 *
 * @see src/scale-ecosystem/multi-region/failover-controller/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  RegionFailoverController,
  type RegionFailoverInput,
  type FencingToken,
} from "../../../../src/scale-ecosystem/multi-region/failover-controller/index.js";

function createTestFailoverInput(overrides: Partial<RegionFailoverInput> = {}): RegionFailoverInput {
  return {
    primaryHealthy: overrides.primaryHealthy ?? true,
    candidateRegionIds: overrides.candidateRegionIds ?? ["us-west-2", "eu-west-1"],
    primaryLatencyMs: overrides.primaryLatencyMs,
    maxAcceptableLatencyMs: overrides.maxAcceptableLatencyMs ?? 100,
    primaryErrorRate: overrides.primaryErrorRate,
    maxAcceptableErrorRate: overrides.maxAcceptableErrorRate ?? 0.05,
    preferredRegionId: overrides.preferredRegionId,
  };
}

test("RegionFailoverController.getLeaderState returns initial state", () => {
  const controller = new RegionFailoverController();

  const state = controller.getLeaderState();

  assert.equal(state.currentLeaderId, null);
  assert.equal(state.promoteEpoch, 0);
  assert.equal(state.isDemotionAcknowledged, true);
  assert.equal(state.fencingToken, null);
});

test("RegionFailoverController.resolveRegionFailover returns no failover for healthy primary", () => {
  const controller = new RegionFailoverController();
  const input = createTestFailoverInput({ primaryHealthy: true });

  const decision = controller.resolveRegionFailover(input);

  assert.equal(decision.shouldFailover, false);
  assert.equal(decision.targetRegionId, null);
  assert.equal(decision.rationale, "multi_region.primary_within_threshold");
});

test("RegionFailoverController.resolveRegionFailover triggers failover for unhealthy primary", () => {
  const controller = new RegionFailoverController();
  const input = createTestFailoverInput({ primaryHealthy: false });

  const decision = controller.resolveRegionFailover(input);

  assert.equal(decision.shouldFailover, true);
  assert.ok(decision.targetRegionId);
});

test("RegionFailoverController.resolveRegionFailover triggers failover for latency breach", () => {
  const controller = new RegionFailoverController();
  const input = createTestFailoverInput({
    primaryHealthy: true,
    primaryLatencyMs: 150,
    maxAcceptableLatencyMs: 100,
  });

  const decision = controller.resolveRegionFailover(input);

  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.rationale, "multi_region.primary_latency_breached");
});

test("RegionFailoverController.resolveRegionFailover triggers failover for error rate breach", () => {
  const controller = new RegionFailoverController();
  const input = createTestFailoverInput({
    primaryHealthy: true,
    primaryErrorRate: 0.1,
    maxAcceptableErrorRate: 0.05,
  });

  const decision = controller.resolveRegionFailover(input);

  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.rationale, "multi_region.primary_error_rate_breached");
});

test("RegionFailoverController.resolveRegionFailover respects preferred region", () => {
  const controller = new RegionFailoverController();
  const input = createTestFailoverInput({
    primaryHealthy: false,
    preferredRegionId: "eu-west-1",
  });

  const decision = controller.resolveRegionFailover(input);

  assert.equal(decision.targetRegionId, "eu-west-1");
});

test("RegionFailoverController.resolveRegionFailover returns no failover for empty candidates", () => {
  const controller = new RegionFailoverController();
  const input = createTestFailoverInput({
    primaryHealthy: false,
    candidateRegionIds: [],
  });

  const decision = controller.resolveRegionFailover(input);

  assert.equal(decision.shouldFailover, false);
  assert.equal(decision.rationale, "multi_region.no_candidate_available");
});

test("RegionFailoverController.resolveRegionFailover increments promote epoch on each failover", () => {
  const controller = new RegionFailoverController();

  controller.resolveRegionFailover(createTestFailoverInput({ primaryHealthy: false, preferredRegionId: "us-west-2" }));
  const decision2 = controller.resolveRegionFailover(createTestFailoverInput({ primaryHealthy: false, preferredRegionId: "eu-west-1" }));

  assert.equal(decision2.promoteEpoch, 2);
});

test("RegionFailoverController.resolveRegionFailover sets demoteOldLeader for leader change", () => {
  const controller = new RegionFailoverController();
  // First failover establishes a leader
  controller.resolveRegionFailover(createTestFailoverInput({ primaryHealthy: false, preferredRegionId: "us-west-2" }));
  // Second failover changes leader
  const decision = controller.resolveRegionFailover(createTestFailoverInput({
    primaryHealthy: false,
    preferredRegionId: "eu-west-1",
  }));

  assert.equal(decision.demoteOldLeader, true);
  assert.equal(decision.oldLeaderId, "us-west-2");
});

test("RegionFailoverController.resolveRegionFailover does not set demoteOldLeader for initial promotion", () => {
  const controller = new RegionFailoverController();
  const decision = controller.resolveRegionFailover(createTestFailoverInput({ primaryHealthy: false }));

  assert.equal(decision.demoteOldLeader, false);
  assert.equal(decision.oldLeaderId, null);
});

test("RegionFailoverController.generateFencingToken creates valid token", () => {
  const controller = new RegionFailoverController();

  const token = controller.generateFencingToken(1, null);

  assert.equal(token.epoch, 1);
  assert.equal(token.isAcknowledged, false);
  assert.ok(token.issuedAt);
  assert.equal(token.previousLeaderId, null);
  assert.equal(token.issuedBy, "system");
});

test("RegionFailoverController.generateFencingToken stores token in state", () => {
  const controller = new RegionFailoverController();

  controller.generateFencingToken(5, "old-leader");

  const state = controller.getLeaderState();
  assert.equal(state.fencingToken?.epoch, 5);
  assert.equal(state.fencingToken?.previousLeaderId, "old-leader");
});

test("RegionFailoverController.validateFencingToken returns true for valid token", () => {
  const controller = new RegionFailoverController();
  controller.resolveRegionFailover(createTestFailoverInput({ primaryHealthy: false }));
  const token = controller.getFencingToken();

  assert.ok(token);
  const isValid = controller.validateFencingToken(token!);
  assert.equal(isValid, true);
});

test("RegionFailoverController.validateFencingToken returns false for wrong epoch", () => {
  const controller = new RegionFailoverController();
  controller.resolveRegionFailover(createTestFailoverInput({ primaryHealthy: false }));

  const invalidToken: FencingToken = {
    epoch: 999,
    issuedAt: new Date().toISOString(),
    issuedBy: "system",
    previousLeaderId: null,
    isAcknowledged: true,
  };

  const isValid = controller.validateFencingToken(invalidToken);
  assert.equal(isValid, false);
});

test("RegionFailoverController.acknowledgeDemotion updates state", () => {
  const controller = new RegionFailoverController();
  controller.resolveRegionFailover(createTestFailoverInput({ primaryHealthy: false, preferredRegionId: "us-west-2" }));
  controller.resolveRegionFailover(createTestFailoverInput({ primaryHealthy: false, preferredRegionId: "eu-west-1" }));

  const acknowledged = controller.acknowledgeDemotion("us-west-2");

  assert.equal(acknowledged, true);
});

test("RegionFailoverController.canLeaderServeWrites returns correct value", () => {
  const controller = new RegionFailoverController();

  assert.equal(controller.canLeaderServeWrites(), true);

  controller.resolveRegionFailover(createTestFailoverInput({ primaryHealthy: false, preferredRegionId: "us-west-2" }));
  // After first failover (initial promotion), demotion not needed
  assert.equal(controller.canLeaderServeWrites(), true);

  controller.resolveRegionFailover(createTestFailoverInput({ primaryHealthy: false, preferredRegionId: "eu-west-1" }));
  // After second failover (leader change), demotion needed
  // But since isDemotionAcknowledged was already true before this failover...

  // Actually let me trace through:
  // First failover: oldLeaderId=null, isLeaderChange=false, isDemotionAcknowledged=!false=true
  // Second failover: oldLeaderId="us-west-2", isLeaderChange=true, isDemotionAcknowledged=!true=false
  assert.equal(controller.canLeaderServeWrites(), false);

  controller.acknowledgeDemotion("us-west-2");
  assert.equal(controller.canLeaderServeWrites(), true);
});

test("RegionFailoverController.detectSplitBrain returns true for stale epoch", () => {
  const controller = new RegionFailoverController();
  controller.resolveRegionFailover(createTestFailoverInput({ primaryHealthy: false, preferredRegionId: "us-west-2" }));

  const hasSplitBrain = controller.detectSplitBrain("some-region", 0);

  assert.equal(hasSplitBrain, true);
});

test("RegionFailoverController.detectSplitBrain returns true for dual leadership", () => {
  const controller = new RegionFailoverController();
  controller.resolveRegionFailover(createTestFailoverInput({ primaryHealthy: false, preferredRegionId: "us-west-2" }));

  const hasSplitBrain = controller.detectSplitBrain("eu-west-1", 1);

  assert.equal(hasSplitBrain, true);
});

test("RegionFailoverController.detectSplitBrain returns false for valid claim", () => {
  const controller = new RegionFailoverController();
  controller.resolveRegionFailover(createTestFailoverInput({ primaryHealthy: false, preferredRegionId: "us-west-2" }));

  const hasSplitBrain = controller.detectSplitBrain("us-west-2", 1);

  assert.equal(hasSplitBrain, false);
});

test("RegionFailoverController.detectSplitBrain returns false for higher epoch from same leader", () => {
  const controller = new RegionFailoverController();
  controller.resolveRegionFailover(createTestFailoverInput({ primaryHealthy: false, preferredRegionId: "us-west-2" }));

  // Epoch 2 is higher than current 1, and same leader - valid
  const hasSplitBrain = controller.detectSplitBrain("us-west-2", 2);

  assert.equal(hasSplitBrain, false);
});

test("RegionFailoverController.getPromoteEpoch returns current epoch", () => {
  const controller = new RegionFailoverController();

  assert.equal(controller.getPromoteEpoch(), 0);

  controller.resolveRegionFailover(createTestFailoverInput({ primaryHealthy: false }));
  assert.equal(controller.getPromoteEpoch(), 1);

  controller.resolveRegionFailover(createTestFailoverInput({ primaryHealthy: false }));
  assert.equal(controller.getPromoteEpoch(), 2);
});

test("RegionFailoverController.getFencingToken returns null initially", () => {
  const controller = new RegionFailoverController();

  assert.equal(controller.getFencingToken(), null);
});

test("RegionFailoverController.getFencingToken returns current token", () => {
  const controller = new RegionFailoverController();
  controller.resolveRegionFailover(createTestFailoverInput({ primaryHealthy: false }));

  const token = controller.getFencingToken();

  assert.ok(token);
  assert.equal(token?.epoch, 1);
});

test("RegionFailoverController.resolveRegionFailover handles exact latency boundary", () => {
  const controller = new RegionFailoverController();
  const input = createTestFailoverInput({
    primaryHealthy: true,
    primaryLatencyMs: 100,
    maxAcceptableLatencyMs: 100,
  });

  const decision = controller.resolveRegionFailover(input);

  // At exactly the boundary, should NOT trigger failover (not greater than)
  assert.equal(decision.shouldFailover, false);
});

test("RegionFailoverController.resolveRegionFailover handles exact error rate boundary", () => {
  const controller = new RegionFailoverController();
  const input = createTestFailoverInput({
    primaryHealthy: true,
    primaryErrorRate: 0.05,
    maxAcceptableErrorRate: 0.05,
  });

  const decision = controller.resolveRegionFailover(input);

  // At exactly the boundary, should NOT trigger failover (not greater than)
  assert.equal(decision.shouldFailover, false);
});

test("RegionFailoverController.resolveRegionFailover handles zero latency", () => {
  const controller = new RegionFailoverController();
  const input = createTestFailoverInput({
    primaryHealthy: true,
    primaryLatencyMs: 0,
    maxAcceptableLatencyMs: 100,
  });

  const decision = controller.resolveRegionFailover(input);

  assert.equal(decision.shouldFailover, false);
});

test("RegionFailoverController.resolveRegionFailover handles zero error rate", () => {
  const controller = new RegionFailoverController();
  const input = createTestFailoverInput({
    primaryHealthy: true,
    primaryErrorRate: 0,
    maxAcceptableErrorRate: 0.05,
  });

  const decision = controller.resolveRegionFailover(input);

  assert.equal(decision.shouldFailover, false);
});

test("RegionFailoverController.resolveRegionFailover includes fencing token in decision", () => {
  const controller = new RegionFailoverController();
  const input = createTestFailoverInput({ primaryHealthy: false });

  const decision = controller.resolveRegionFailover(input);

  assert.ok(decision.fencingToken);
  assert.equal(decision.fencingToken!.epoch, 1);
});

test("RegionFailoverController.acknowledgeDemotion returns false for null leader", () => {
  const controller = new RegionFailoverController();

  const result = controller.acknowledgeDemotion("some-region");

  assert.equal(result, false);
});

test("RegionFailoverController.generateFencingToken with previous leader ID", () => {
  const controller = new RegionFailoverController();

  const token = controller.generateFencingToken(3, "previous-leader");

  assert.equal(token.epoch, 3);
  assert.equal(token.previousLeaderId, "previous-leader");
  assert.equal(token.isAcknowledged, false);
});

test("RegionFailoverController.validateFencingToken returns true when demotion already acknowledged", () => {
  const controller = new RegionFailoverController();
  // Set up state with isDemotionAcknowledged = true
  controller.resolveRegionFailover(createTestFailoverInput({ primaryHealthy: false }));

  // Create a token with isAcknowledged=false but state says demotion acknowledged
  const token: FencingToken = {
    epoch: 1,
    issuedAt: new Date().toISOString(),
    issuedBy: "system",
    previousLeaderId: null,
    isAcknowledged: false, // Token not acknowledged, but...
  };

  // validateFencingToken checks: token.isAcknowledged || this.leaderState.isDemotionAcknowledged
  // Since isDemotionAcknowledged is true (initial state and first failover sets it to true when !isLeaderChange)
  const isValid = controller.validateFencingToken(token);
  assert.equal(isValid, true);
});
