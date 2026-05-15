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
  type FencingEpochState,
  type RejectRegionJoinInput,
} from "../../../../src/scale-ecosystem/multi-region/failover-controller/index.js";

function createTestFailoverInput(overrides: Partial<RegionFailoverInput> = {}): RegionFailoverInput {
  const primaryLatencyMs = overrides.primaryLatencyMs;
  const maxAcceptableLatencyMs = overrides.maxAcceptableLatencyMs;
  const primaryErrorRate = overrides.primaryErrorRate;
  const maxAcceptableErrorRate = overrides.maxAcceptableErrorRate;
  const preferredRegionId = overrides.preferredRegionId;
  const forceDemote = overrides.forceDemote;
  const promoteEpoch = overrides.promoteEpoch;

  const result: RegionFailoverInput = {
    primaryHealthy: overrides.primaryHealthy ?? true,
    candidateRegionIds: overrides.candidateRegionIds ?? ["us-west-2", "eu-west-1"],
    currentLeaderRegionId: overrides.currentLeaderRegionId ?? null,
    partitionKey: overrides.partitionKey ?? "global",
    ...(primaryLatencyMs !== undefined ? { primaryLatencyMs } : {}),
    ...(maxAcceptableLatencyMs !== undefined ? { maxAcceptableLatencyMs } : {}),
    ...(primaryErrorRate !== undefined ? { primaryErrorRate } : {}),
    ...(maxAcceptableErrorRate !== undefined ? { maxAcceptableErrorRate } : {}),
    ...(preferredRegionId !== undefined ? { preferredRegionId } : {}),
    ...(forceDemote !== undefined ? { forceDemote } : {}),
    ...(promoteEpoch !== undefined ? { promoteEpoch } : {}),
  };
  return result;
}

test("RegionFailoverController.resolve returns no failover for healthy primary", () => {
  const controller = new RegionFailoverController();
  const input = createTestFailoverInput({ primaryHealthy: true });

  const decision = controller.resolve(input);

  assert.equal(decision.shouldFailover, false);
  assert.equal(decision.targetRegionId, null);
  assert.equal(decision.rationale, "multi_region.primary_within_threshold");
});

test("RegionFailoverController.resolve triggers failover for unhealthy primary", () => {
  const controller = new RegionFailoverController();
  const input = createTestFailoverInput({ primaryHealthy: false });

  const decision = controller.resolve(input);

  assert.equal(decision.shouldFailover, true);
  assert.ok(decision.targetRegionId);
});

test("RegionFailoverController.resolve triggers failover for latency breach", () => {
  const controller = new RegionFailoverController();
  const input = createTestFailoverInput({
    primaryHealthy: true,
    primaryLatencyMs: 150,
    maxAcceptableLatencyMs: 100,
  });

  const decision = controller.resolve(input);

  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.rationale, "multi_region.primary_latency_breached");
});

test("RegionFailoverController.resolve triggers failover for error rate breach", () => {
  const controller = new RegionFailoverController();
  const input = createTestFailoverInput({
    primaryHealthy: true,
    primaryErrorRate: 0.1,
    maxAcceptableErrorRate: 0.05,
  });

  const decision = controller.resolve(input);

  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.rationale, "multi_region.primary_error_rate_breached");
});

test("RegionFailoverController.resolve respects preferred region", () => {
  const controller = new RegionFailoverController();
  const input = createTestFailoverInput({
    primaryHealthy: false,
    preferredRegionId: "eu-west-1",
  });

  const decision = controller.resolve(input);

  assert.equal(decision.targetRegionId, "eu-west-1");
});

test("RegionFailoverController.resolve returns no failover for empty candidates", () => {
  const controller = new RegionFailoverController();
  const input = createTestFailoverInput({
    primaryHealthy: false,
    candidateRegionIds: [],
  });

  const decision = controller.resolve(input);

  assert.equal(decision.shouldFailover, false);
  assert.equal(decision.rationale, "multi_region.no_candidate_available");
});

test("RegionFailoverController.resolve increments fencing epoch on each failover", () => {
  const controller = new RegionFailoverController();

  controller.resolve(createTestFailoverInput({ primaryHealthy: false, preferredRegionId: "us-west-2" }));
  const decision2 = controller.resolve(createTestFailoverInput({ primaryHealthy: false, preferredRegionId: "eu-west-1" }));

  assert.equal(decision2.fencingEpoch, 2);
});

test("RegionFailoverController.resolve sets demotedRegionId for leader change", () => {
  const controller = new RegionFailoverController();
  // First failover establishes a leader
  controller.resolve(createTestFailoverInput({
    primaryHealthy: false,
    preferredRegionId: "us-west-2",
    currentLeaderRegionId: "primary-region",
  }));
  // Second failover changes leader
  const decision = controller.resolve(createTestFailoverInput({
    primaryHealthy: false,
    preferredRegionId: "eu-west-1",
    currentLeaderRegionId: "us-west-2",
  }));

  assert.equal(decision.demotedRegionId, "us-west-2");
  assert.equal(decision.leaderState, "demoted_previous_leader");
});

test("RegionFailoverController.resolve does not set demotedRegionId for initial promotion", () => {
  const controller = new RegionFailoverController();
  const decision = controller.resolve(createTestFailoverInput({ primaryHealthy: false }));

  assert.equal(decision.demotedRegionId, null);
  assert.equal(decision.leaderState, "promoted");
});

test("RegionFailoverController.resolve handles forced demotion", () => {
  const controller = new RegionFailoverController();
  const input = createTestFailoverInput({
    primaryHealthy: true, // primary is healthy but we're forcing demotion
    forceDemote: true,
    currentLeaderRegionId: "current-leader",
    preferredRegionId: "new-leader",
  });

  const decision = controller.resolve(input);

  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.demotedRegionId, "current-leader");
  assert.equal(decision.rationale, "multi_region.forced_demotion");
});

test("RegionFailoverController.getState returns initial state", () => {
  const controller = new RegionFailoverController();

  const state = controller.getState();

  assert.equal(state, null); // No state recorded yet
});

test("RegionFailoverController.getState returns recorded state", () => {
  const controller = new RegionFailoverController();
  controller.resolve(createTestFailoverInput({ primaryHealthy: false, preferredRegionId: "us-west-2" }));

  const state = controller.getState();

  assert.ok(state);
  assert.equal(state?.leaderRegionId, "us-west-2");
  assert.equal(state?.fencingEpoch, 1);
});

test("RegionFailoverController.resolve handles exact latency boundary", () => {
  const controller = new RegionFailoverController();
  const input = createTestFailoverInput({
    primaryHealthy: true,
    primaryLatencyMs: 100,
    maxAcceptableLatencyMs: 100,
  });

  const decision = controller.resolve(input);

  // At exactly the boundary, should NOT trigger failover (not greater than)
  assert.equal(decision.shouldFailover, false);
});

test("RegionFailoverController.resolve handles exact error rate boundary", () => {
  const controller = new RegionFailoverController();
  const input = createTestFailoverInput({
    primaryHealthy: true,
    primaryErrorRate: 0.05,
    maxAcceptableErrorRate: 0.05,
  });

  const decision = controller.resolve(input);

  // At exactly the boundary, should NOT trigger failover (not greater than)
  assert.equal(decision.shouldFailover, false);
});

test("RegionFailoverController.resolve handles zero latency", () => {
  const controller = new RegionFailoverController();
  const input = createTestFailoverInput({
    primaryHealthy: true,
    primaryLatencyMs: 0,
    maxAcceptableLatencyMs: 100,
  });

  const decision = controller.resolve(input);

  assert.equal(decision.shouldFailover, false);
});

test("RegionFailoverController.resolve handles zero error rate", () => {
  const controller = new RegionFailoverController();
  const input = createTestFailoverInput({
    primaryHealthy: true,
    primaryErrorRate: 0,
    maxAcceptableErrorRate: 0.05,
  });

  const decision = controller.resolve(input);

  assert.equal(decision.shouldFailover, false);
});

test("RegionFailoverController.resolve includes fencing epoch in decision", () => {
  const controller = new RegionFailoverController();
  const input = createTestFailoverInput({ primaryHealthy: false });

  const decision = controller.resolve(input);

  assert.equal(decision.fencingEpoch, 1);
});

test("RegionFailoverController.rejectRegionJoin accepts region with no prior state", () => {
  const controller = new RegionFailoverController();
  const input: RejectRegionJoinInput = {
    regionId: "us-west-2",
    offeredFencingEpoch: 1,
    partitionKey: "global",
  };

  const result = controller.rejectRegionJoin(input);

  assert.equal(result.accepted, true);
  assert.equal(result.currentFencingEpoch, 0);
});

test("RegionFailoverController.rejectRegionJoin rejects stale demoted leader", () => {
  const controller = new RegionFailoverController();
  // First, establish a state with a demoted leader
  controller.resolve(createTestFailoverInput({
    primaryHealthy: false,
    preferredRegionId: "eu-west-1",
    currentLeaderRegionId: "us-west-2",
  }));

  const input: RejectRegionJoinInput = {
    regionId: "us-west-2",
    offeredFencingEpoch: 0,
    partitionKey: "global",
  };

  const result = controller.rejectRegionJoin(input);

  assert.equal(result.accepted, false);
  assert.equal(result.mustRejoinAsFollower, true);
});

test("RegionFailoverController.rejectRegionJoin accepts current epoch from demoted leader", () => {
  const controller = new RegionFailoverController();
  // Establish state
  controller.resolve(createTestFailoverInput({
    primaryHealthy: false,
    preferredRegionId: "eu-west-1",
    currentLeaderRegionId: "us-west-2",
  }));

  const state = controller.getState();
  const currentEpoch = state?.fencingEpoch ?? 1;

  const input: RejectRegionJoinInput = {
    regionId: "us-west-2",
    offeredFencingEpoch: currentEpoch,
    partitionKey: "global",
  };

  const result = controller.rejectRegionJoin(input);

  assert.equal(result.accepted, true);
});

test("RegionFailoverController.resolve uses explicit promoteEpoch when provided", () => {
  const controller = new RegionFailoverController();
  const input = createTestFailoverInput({
    primaryHealthy: false,
    promoteEpoch: 100,
  });

  const decision = controller.resolve(input);

  assert.equal(decision.fencingEpoch, 100);
});

test("RegionFailoverController.resolve handles custom partition key", () => {
  const controller = new RegionFailoverController();
  const input = createTestFailoverInput({
    primaryHealthy: false,
    preferredRegionId: "us-west-2",
    partitionKey: "partition-1",
  });

  controller.resolve(input);

  const state = controller.getState("partition-1");
  assert.ok(state);
  assert.equal(state?.leaderRegionId, "us-west-2");
});

test("RegionFailoverController.resolve returns stable leaderState when no failover", () => {
  const controller = new RegionFailoverController();
  const input = createTestFailoverInput({ primaryHealthy: true });

  const decision = controller.resolve(input);

  assert.equal(decision.leaderState, "stable");
});

test("RegionFailoverController.resolve handles null currentLeaderRegionId", () => {
  const controller = new RegionFailoverController();
  const input = createTestFailoverInput({
    primaryHealthy: false,
    currentLeaderRegionId: null,
    preferredRegionId: "us-west-2",
  });

  const decision = controller.resolve(input);

  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.demotedRegionId, null); // No previous leader to demote
  assert.equal(decision.leaderState, "promoted");
});
