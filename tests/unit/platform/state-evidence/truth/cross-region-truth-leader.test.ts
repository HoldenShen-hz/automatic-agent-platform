import assert from "node:assert/strict";
import test from "node:test";

import {
  CrossRegionTruthLeader,
  type TruthLeaderEpoch,
  type TruthWriteClaim,
  type TruthLeaderDecision,
} from "../../../../../src/platform/five-plane-state-evidence/truth/cross-region-truth-leader.js";

test("CrossRegionTruthLeader.evaluate accepts matching epoch and claim", () => {
  const leader = new CrossRegionTruthLeader();
  const epoch: TruthLeaderEpoch = {
    tenantId: "tenant-1",
    homeRegion: "us-east",
    leaderRegion: "us-east",
    epoch: 1,
    fencingToken: "token-abc",
  };
  const claim: TruthWriteClaim = {
    tenantId: "tenant-1",
    region: "us-east",
    epoch: 1,
    fencingToken: "token-abc",
  };

  const decision = leader.evaluate(epoch, claim);

  assert.equal(decision.accepted, true);
  assert.equal(decision.reasonCode, "truth_leader.accepted");
});

test("CrossRegionTruthLeader.evaluate rejects when tenantId mismatches", () => {
  const leader = new CrossRegionTruthLeader();
  const epoch: TruthLeaderEpoch = {
    tenantId: "tenant-1",
    homeRegion: "us-east",
    leaderRegion: "us-east",
    epoch: 1,
    fencingToken: "token-abc",
  };
  const claim: TruthWriteClaim = {
    tenantId: "tenant-2",
    region: "us-east",
    epoch: 1,
    fencingToken: "token-abc",
  };

  const decision = leader.evaluate(epoch, claim);

  assert.equal(decision.accepted, false);
  assert.equal(decision.reasonCode, "truth_leader.tenant_mismatch");
});

test("CrossRegionTruthLeader.evaluate rejects when region is not home region", () => {
  const leader = new CrossRegionTruthLeader();
  const epoch: TruthLeaderEpoch = {
    tenantId: "tenant-1",
    homeRegion: "us-east",
    leaderRegion: "us-east",
    epoch: 1,
    fencingToken: "token-abc",
  };
  const claim: TruthWriteClaim = {
    tenantId: "tenant-1",
    region: "eu-west",
    epoch: 1,
    fencingToken: "token-abc",
  };

  const decision = leader.evaluate(epoch, claim);

  assert.equal(decision.accepted, false);
  assert.equal(decision.reasonCode, "truth_leader.not_home_region");
});

test("CrossRegionTruthLeader.evaluate rejects when leaderRegion differs from claim region", () => {
  const leader = new CrossRegionTruthLeader();
  const epoch: TruthLeaderEpoch = {
    tenantId: "tenant-1",
    homeRegion: "us-east",
    leaderRegion: "us-west",
    epoch: 1,
    fencingToken: "token-abc",
  };
  const claim: TruthWriteClaim = {
    tenantId: "tenant-1",
    region: "us-east",
    epoch: 1,
    fencingToken: "token-abc",
  };

  const decision = leader.evaluate(epoch, claim);

  assert.equal(decision.accepted, false);
  assert.equal(decision.reasonCode, "truth_leader.not_home_region");
});

test("CrossRegionTruthLeader.evaluate rejects when epoch mismatches", () => {
  const leader = new CrossRegionTruthLeader();
  const epoch: TruthLeaderEpoch = {
    tenantId: "tenant-1",
    homeRegion: "us-east",
    leaderRegion: "us-east",
    epoch: 2,
    fencingToken: "token-abc",
  };
  const claim: TruthWriteClaim = {
    tenantId: "tenant-1",
    region: "us-east",
    epoch: 1,
    fencingToken: "token-abc",
  };

  const decision = leader.evaluate(epoch, claim);

  assert.equal(decision.accepted, false);
  assert.equal(decision.reasonCode, "truth_leader.epoch_mismatch");
});

test("CrossRegionTruthLeader.evaluate rejects when fencing token mismatches", () => {
  const leader = new CrossRegionTruthLeader();
  const epoch: TruthLeaderEpoch = {
    tenantId: "tenant-1",
    homeRegion: "us-east",
    leaderRegion: "us-east",
    epoch: 1,
    fencingToken: "token-xyz",
  };
  const claim: TruthWriteClaim = {
    tenantId: "tenant-1",
    region: "us-east",
    epoch: 1,
    fencingToken: "token-abc",
  };

  const decision = leader.evaluate(epoch, claim);

  assert.equal(decision.accepted, false);
  assert.equal(decision.reasonCode, "truth_leader.fencing_token_mismatch");
});

test("CrossRegionTruthLeader.evaluate accepts valid multi-region claim", () => {
  const leader = new CrossRegionTruthLeader();
  const epoch: TruthLeaderEpoch = {
    tenantId: "tenant-multi",
    homeRegion: "us-east",
    leaderRegion: "us-east",
    epoch: 5,
    fencingToken: "fence-999",
  };
  const claim: TruthWriteClaim = {
    tenantId: "tenant-multi",
    region: "us-east",
    epoch: 5,
    fencingToken: "fence-999",
  };

  const decision = leader.evaluate(epoch, claim);

  assert.equal(decision.accepted, true);
  assert.equal(decision.reasonCode, "truth_leader.accepted");
});

test("TruthLeaderDecision type allows all reason codes", () => {
  const acceptedDecision: TruthLeaderDecision = {
    accepted: true,
    reasonCode: "truth_leader.accepted",
  };
  assert.equal(acceptedDecision.accepted, true);

  const tenantMismatch: TruthLeaderDecision = {
    accepted: false,
    reasonCode: "truth_leader.tenant_mismatch",
  };
  assert.equal(tenantMismatch.reasonCode, "truth_leader.tenant_mismatch");

  const regionMismatch: TruthLeaderDecision = {
    accepted: false,
    reasonCode: "truth_leader.not_home_region",
  };
  assert.equal(regionMismatch.reasonCode, "truth_leader.not_home_region");

  const epochMismatch: TruthLeaderDecision = {
    accepted: false,
    reasonCode: "truth_leader.epoch_mismatch",
  };
  assert.equal(epochMismatch.reasonCode, "truth_leader.epoch_mismatch");

  const tokenMismatch: TruthLeaderDecision = {
    accepted: false,
    reasonCode: "truth_leader.fencing_token_mismatch",
  };
  assert.equal(tokenMismatch.reasonCode, "truth_leader.fencing_token_mismatch");
});
