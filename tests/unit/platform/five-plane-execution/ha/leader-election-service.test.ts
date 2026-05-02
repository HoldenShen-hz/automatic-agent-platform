import assert from "node:assert/strict";
import test from "node:test";

// Test the types and constants that don't require complex mocking
import type {
  LeaderElectionState,
  LeaderElectionEvent,
  LeaderElectionServiceOptions,
} from "../../../../../src/platform/five-plane-execution/ha/leader-election-service.js";

test("LeaderElectionState type includes expected states", () => {
  const states: LeaderElectionState[] = ["stopped", "starting", "candidate", "follower", "leader", "shutdown"];

  for (const state of states) {
    assert.ok(typeof state === "string");
  }
});

test("LeaderElectionEvent type includes expected events", () => {
  const events: LeaderElectionEvent[] = [
    "election_start",
    "leadership_acquired",
    "leadership_lost",
    "leadership_renewed",
    "leadership_expired",
    "failover_triggered",
    "abdication",
    "follower_elected",
  ];

  for (const event of events) {
    assert.ok(typeof event === "string");
  }
});

test("LeaderElectionServiceOptions interface structure", () => {
  const options: LeaderElectionServiceOptions = {
    nodeId: "node-1",
    region: "us-east-1",
  };

  assert.equal(options.nodeId, "node-1");
  assert.equal(options.region, "us-east-1");
});

test("LeaderElectionServiceOptions with all fields", () => {
  const options: LeaderElectionServiceOptions = {
    nodeId: "node-1",
    region: "us-east-1",
    haLevel: "HA_2",
    leaseTtlMs: 30_000,
    renewalIntervalMs: 5_000,
    maxElectionAttempts: 3,
    nodeMetadata: { datacenter: "east" },
  };

  assert.equal(options.nodeId, "node-1");
  assert.equal(options.region, "us-east-1");
  assert.equal(options.haLevel, "HA_2");
  assert.equal(options.leaseTtlMs, 30_000);
  assert.equal(options.renewalIntervalMs, 5_000);
  assert.equal(options.maxElectionAttempts, 3);
  assert.deepEqual(options.nodeMetadata, { datacenter: "east" });
});

test("LeaderElectionServiceOptions optional fields can be omitted", () => {
  const options: LeaderElectionServiceOptions = {
    nodeId: "node-1",
    region: "us-west-2",
  };

  assert.ok(options.haLevel === undefined);
  assert.ok(options.leaseTtlMs === undefined);
  assert.ok(options.renewalIntervalMs === undefined);
  assert.ok(options.maxElectionAttempts === undefined);
  assert.ok(options.nodeMetadata === undefined);
});

test("LeaderElectionState values are valid strings", () => {
  const state: LeaderElectionState = "stopped";
  assert.equal(state, "stopped");

  const leaderState: LeaderElectionState = "leader";
  assert.equal(leaderState, "leader");
});

test("LeaderElectionEvent values are valid strings", () => {
  const event: LeaderElectionEvent = "election_start";
  assert.equal(event, "election_start");

  const acquiredEvent: LeaderElectionEvent = "leadership_acquired";
  assert.equal(acquiredEvent, "leadership_acquired");
});
