import assert from "node:assert/strict";
import test from "node:test";

import {
  mapNode,
  mapLease,
  mapEpoch,
  mapFailoverDecision,
} from "../../../src/platform/execution/ha/mappers.js";

// mapNode tests

test("mapNode maps a database row to CoordinatorNode", () => {
  const row = {
    node_id: "node_abc",
    region: "us-east-1",
    status: "active",
    is_leader: 1,
    leadership_epoch: 5,
    last_heartbeat_at: "2026-04-14T00:00:00.000Z",
    metadata: null,
  };

  const node = mapNode(row);
  assert.equal(node.nodeId, "node_abc");
  assert.equal(node.region, "us-east-1");
  assert.equal(node.status, "active");
  assert.equal(node.isLeader, true);
  assert.equal(node.leadershipEpoch, 5);
  assert.equal(node.lastHeartbeatAt, "2026-04-14T00:00:00.000Z");
  assert.equal(node.metadata, null);
});

test("mapNode parses metadata JSON when present", () => {
  const row = {
    node_id: "node_abc",
    region: "us-east-1",
    status: "active",
    is_leader: 0,
    leadership_epoch: 0,
    last_heartbeat_at: "2026-04-14T00:00:00.000Z",
    metadata: '{"key": "value", "num": 42}',
  };

  const node = mapNode(row);
  assert.deepEqual(node.metadata, { key: "value", num: 42 });
});

test("mapNode maps is_leader=0 to false", () => {
  const row = {
    node_id: "node_abc",
    region: "us-west-2",
    status: "standby",
    is_leader: 0,
    leadership_epoch: 3,
    last_heartbeat_at: "2026-04-14T00:00:00.000Z",
    metadata: null,
  };

  const node = mapNode(row);
  assert.equal(node.isLeader, false);
});

// mapLease tests

test("mapLease maps a database row to LeaderLease", () => {
  const row = {
    lease_id: "lease_123",
    node_id: "node_abc",
    epoch: 5,
    acquired_at: "2026-04-14T00:00:00.000Z",
    expires_at: "2026-04-14T00:01:00.000Z",
    status: "active",
    ttl_ms: 60_000,
  };

  const lease = mapLease(row);
  assert.equal(lease.leaseId, "lease_123");
  assert.equal(lease.nodeId, "node_abc");
  assert.equal(lease.epoch, 5);
  assert.equal(lease.acquiredAt, "2026-04-14T00:00:00.000Z");
  assert.equal(lease.expiresAt, "2026-04-14T00:01:00.000Z");
  assert.equal(lease.status, "active");
  assert.equal(lease.ttlMs, 60_000);
});

test("mapLease coerces string ttl_ms to number", () => {
  const row = {
    lease_id: "lease_123",
    node_id: "node_abc",
    epoch: "5",
    acquired_at: "2026-04-14T00:00:00.000Z",
    expires_at: "2026-04-14T00:01:00.000Z",
    status: "expired",
    ttl_ms: "30000",
  };

  const lease = mapLease(row);
  assert.equal(lease.epoch, 5);
  assert.equal(lease.ttlMs, 30_000);
  assert.ok(typeof lease.epoch === "number");
  assert.ok(typeof lease.ttlMs === "number");
});

// mapEpoch tests

test("mapEpoch maps a database row to LeadershipEpoch", () => {
  const row = {
    epoch: 3,
    leader_node_id: "node_abc",
    started_at: "2026-04-14T00:00:00.000Z",
    ended_at: null,
    cause: "election",
    fencing_token: 12,
  };

  const epoch = mapEpoch(row);
  assert.equal(epoch.epoch, 3);
  assert.equal(epoch.leaderNodeId, "node_abc");
  assert.equal(epoch.startedAt, "2026-04-14T00:00:00.000Z");
  assert.equal(epoch.endedAt, null);
  assert.equal(epoch.cause, "election");
  assert.equal(epoch.fencingToken, 12);
});

test("mapEpoch maps null leader_node_id to null", () => {
  const row = {
    epoch: 0,
    leader_node_id: null,
    started_at: "2026-04-14T00:00:00.000Z",
    ended_at: "2026-04-14T01:00:00.000Z",
    cause: "bootstrap",
    fencing_token: 0,
  };

  const epoch = mapEpoch(row);
  assert.equal(epoch.leaderNodeId, null);
  assert.equal(epoch.endedAt, "2026-04-14T01:00:00.000Z");
});

// mapFailoverDecision tests

test("mapFailoverDecision maps a database row to FailoverDecision", () => {
  const row = {
    decision_id: "decision_123",
    old_leader_node_id: "node_old",
    new_leader_node_id: "node_new",
    epoch: 4,
    cause: "heartbeat_timeout",
    outcome: "completed",
    decided_at: "2026-04-14T00:00:00.000Z",
    fencing_token: 15,
  };

  const decision = mapFailoverDecision(row);
  assert.equal(decision.decisionId, "decision_123");
  assert.equal(decision.oldLeaderNodeId, "node_old");
  assert.equal(decision.newLeaderNodeId, "node_new");
  assert.equal(decision.epoch, 4);
  assert.equal(decision.cause, "heartbeat_timeout");
  assert.equal(decision.outcome, "completed");
  assert.equal(decision.decidedAt, "2026-04-14T00:00:00.000Z");
  assert.equal(decision.fencingToken, 15);
});

test("mapFailoverDecision maps null node IDs to null", () => {
  const row = {
    decision_id: "decision_456",
    old_leader_node_id: null,
    new_leader_node_id: null,
    epoch: 1,
    cause: "manual",
    outcome: "pending",
    decided_at: "2026-04-14T00:00:00.000Z",
    fencing_token: 1,
  };

  const decision = mapFailoverDecision(row);
  assert.equal(decision.oldLeaderNodeId, null);
  assert.equal(decision.newLeaderNodeId, null);
});

test("mapFailoverDecision coerces string epoch and fencing_token to numbers", () => {
  const row = {
    decision_id: "decision_789",
    old_leader_node_id: "node_a",
    new_leader_node_id: "node_b",
    epoch: "7",
    cause: "forced",
    outcome: "failed",
    decided_at: "2026-04-14T00:00:00.000Z",
    fencing_token: "42",
  };

  const decision = mapFailoverDecision(row);
  assert.equal(decision.epoch, 7);
  assert.equal(decision.fencingToken, 42);
  assert.ok(typeof decision.epoch === "number");
  assert.ok(typeof decision.fencingToken === "number");
});
