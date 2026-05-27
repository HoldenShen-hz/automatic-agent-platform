import assert from "node:assert/strict";
import test from "node:test";

import { mapNode, mapLease, mapEpoch, mapFailoverDecision } from "../../../../../src/platform/five-plane-execution/ha/mappers.js";

test("mapNode converts raw row to CoordinatorNode [mappers]", () => {
  const row = {
    node_id: "node_1",
    region: "us-east-1",
    status: "active",
    is_leader: 1,
    leadership_epoch: 5,
    last_heartbeat_at: "2026-04-22T10:00:00Z",
    metadata: '{"tags":["production"]}',
  };

  const node = mapNode(row);

  assert.equal(node.nodeId, "node_1");
  assert.equal(node.region, "us-east-1");
  assert.equal(node.status, "active");
  assert.equal(node.isLeader, true);
  assert.equal(node.leadershipEpoch, 5);
  assert.equal(node.lastHeartbeatAt, "2026-04-22T10:00:00Z");
  assert.deepEqual(node.metadata, { tags: ["production"] });
});

test("mapNode handles null metadata [mappers]", () => {
  const row = {
    node_id: "node_1",
    region: "us-east-1",
    status: "active",
    is_leader: 0,
    leadership_epoch: 1,
    last_heartbeat_at: "2026-04-22T10:00:00Z",
    metadata: null,
  };

  const node = mapNode(row);

  assert.equal(node.metadata, null);
  assert.equal(node.isLeader, false);
});

test("mapNode converts numeric booleans correctly [mappers]", () => {
  const leaderRow = {
    node_id: "node_leader",
    region: "us-west-2",
    status: "active",
    is_leader: 1,
    leadership_epoch: 3,
    last_heartbeat_at: "2026-04-22T10:00:00Z",
    metadata: null,
  };

  const followerRow = {
    node_id: "node_follower",
    region: "us-west-2",
    status: "active",
    is_leader: 0,
    leadership_epoch: 3,
    last_heartbeat_at: "2026-04-22T10:00:00Z",
    metadata: null,
  };

  assert.equal(mapNode(leaderRow).isLeader, true);
  assert.equal(mapNode(followerRow).isLeader, false);
});

test("mapLease converts raw row to LeaderLease [mappers]", () => {
  const row = {
    lease_id: "lease_1",
    node_id: "node_1",
    epoch: 2,
    acquired_at: "2026-04-22T09:00:00Z",
    expires_at: "2026-04-22T09:30:00Z",
    status: "active",
    ttl_ms: 30000,
  };

  const lease = mapLease(row);

  assert.equal(lease.leaseId, "lease_1");
  assert.equal(lease.nodeId, "node_1");
  assert.equal(lease.epoch, 2);
  assert.equal(lease.acquiredAt, "2026-04-22T09:00:00Z");
  assert.equal(lease.expiresAt, "2026-04-22T09:30:00Z");
  assert.equal(lease.status, "active");
  assert.equal(lease.ttlMs, 30000);
});

test("mapLease handles expired status [mappers]", () => {
  const row = {
    lease_id: "lease_expired",
    node_id: "node_1",
    epoch: 1,
    acquired_at: "2026-04-22T08:00:00Z",
    expires_at: "2026-04-22T08:15:00Z",
    status: "expired",
    ttl_ms: 15000,
  };

  const lease = mapLease(row);

  assert.equal(lease.status, "expired");
});

test("mapLease handles released status [mappers]", () => {
  const row = {
    lease_id: "lease_released",
    node_id: "node_1",
    epoch: 1,
    acquired_at: "2026-04-22T08:00:00Z",
    expires_at: "2026-04-22T08:15:00Z",
    status: "released",
    ttl_ms: 15000,
  };

  const lease = mapLease(row);

  assert.equal(lease.status, "released");
});

test("mapEpoch converts raw row to LeadershipEpoch [mappers]", () => {
  const row = {
    epoch: 3,
    leader_node_id: "node_1",
    started_at: "2026-04-22T09:00:00Z",
    ended_at: "2026-04-22T10:00:00Z",
    cause: "expired",
    fencing_token: 7,
  };

  const epoch = mapEpoch(row);

  assert.equal(epoch.epoch, 3);
  assert.equal(epoch.leaderNodeId, "node_1");
  assert.equal(epoch.startedAt, "2026-04-22T09:00:00Z");
  assert.equal(epoch.endedAt, "2026-04-22T10:00:00Z");
  assert.equal(epoch.cause, "expired");
  assert.equal(epoch.fencingToken, 7);
});

test("mapEpoch handles null leader_node_id [mappers]", () => {
  const row = {
    epoch: 1,
    leader_node_id: null,
    started_at: "2026-04-22T09:00:00Z",
    ended_at: null,
    cause: "acquired",
    fencing_token: 1,
  };

  const epoch = mapEpoch(row);

  assert.equal(epoch.leaderNodeId, null);
  assert.equal(epoch.endedAt, null);
});

test("mapEpoch handles various causes [mappers]", () => {
  const causes = ["acquired", "renewed", "expired", "preempted", "voluntary"] as const;

  causes.forEach((cause) => {
    const row = {
      epoch: 1,
      leader_node_id: "node_1",
      started_at: "2026-04-22T09:00:00Z",
      ended_at: null,
      cause,
      fencing_token: 1,
    };

    const epoch = mapEpoch(row);
    assert.equal(epoch.cause, cause, `Failed for cause: ${cause}`);
  });
});

test("mapFailoverDecision converts raw row to FailoverDecision [mappers]", () => {
  const row = {
    decision_id: "decision_1",
    old_leader_node_id: "node_old",
    new_leader_node_id: "node_new",
    epoch: 5,
    cause: "heartbeat_missing",
    outcome: "leader_changed",
    decided_at: "2026-04-22T10:30:00Z",
    fencing_token: 12,
  };

  const decision = mapFailoverDecision(row);

  assert.equal(decision.decisionId, "decision_1");
  assert.equal(decision.oldLeaderNodeId, "node_old");
  assert.equal(decision.newLeaderNodeId, "node_new");
  assert.equal(decision.epoch, 5);
  assert.equal(decision.cause, "heartbeat_missing");
  assert.equal(decision.outcome, "leader_changed");
  assert.equal(decision.decidedAt, "2026-04-22T10:30:00Z");
  assert.equal(decision.fencingToken, 12);
});

test("mapFailoverDecision handles null old leader [mappers]", () => {
  const row = {
    decision_id: "decision_initial",
    old_leader_node_id: null,
    new_leader_node_id: "node_1",
    epoch: 1,
    cause: "acquired",
    outcome: "leader_changed",
    decided_at: "2026-04-22T09:00:00Z",
    fencing_token: 1,
  };

  const decision = mapFailoverDecision(row);

  assert.equal(decision.oldLeaderNodeId, null);
  assert.equal(decision.newLeaderNodeId, "node_1");
});

test("mapFailoverDecision handles no_change outcome [mappers]", () => {
  const row = {
    decision_id: "decision_no_change",
    old_leader_node_id: "node_1",
    new_leader_node_id: null,
    epoch: 2,
    cause: "voluntary",
    outcome: "no_change",
    decided_at: "2026-04-22T09:30:00Z",
    fencing_token: 3,
  };

  const decision = mapFailoverDecision(row);

  assert.equal(decision.outcome, "no_change");
  assert.equal(decision.newLeaderNodeId, null);
});

test("mapFailoverDecision handles no_candidate outcome [mappers]", () => {
  const row = {
    decision_id: "decision_no_candidate",
    old_leader_node_id: "node_1",
    new_leader_node_id: null,
    epoch: 3,
    cause: "node_unhealthy",
    outcome: "no_candidate",
    decided_at: "2026-04-22T10:00:00Z",
    fencing_token: 4,
  };

  const decision = mapFailoverDecision(row);

  assert.equal(decision.outcome, "no_candidate");
});

test("mapFailoverDecision handles various causes [mappers]", () => {
  const causes = [
    "heartbeat_missing",
    "node_unhealthy",
    "voluntary",
    "operator_forced",
    "epoch_preempted",
  ] as const;

  causes.forEach((cause) => {
    const row = {
      decision_id: `decision_${cause}`,
      old_leader_node_id: "node_1",
      new_leader_node_id: "node_2",
      epoch: 1,
      cause,
      outcome: "leader_changed",
      decided_at: "2026-04-22T10:00:00Z",
      fencing_token: 1,
    };

    const decision = mapFailoverDecision(row);
    assert.equal(decision.cause, cause, `Failed for cause: ${cause}`);
  });
});

test("mapNode handles string numbers correctly [mappers]", () => {
  const row = {
    node_id: "node_1",
    region: "us-east-1",
    status: "active",
    is_leader: "1", // String instead of number
    leadership_epoch: "5", // String instead of number
    last_heartbeat_at: "2026-04-22T10:00:00Z",
    metadata: null,
  };

  const node = mapNode(row);

  assert.equal(node.leadershipEpoch, 5);
  assert.equal(node.isLeader, true);
});

test("mapLease handles string numeric values [mappers]", () => {
  const row = {
    lease_id: "lease_1",
    node_id: "node_1",
    epoch: "2",
    acquired_at: "2026-04-22T09:00:00Z",
    expires_at: "2026-04-22T09:30:00Z",
    status: "active",
    ttl_ms: "30000",
  };

  const lease = mapLease(row);

  assert.equal(lease.epoch, 2);
  assert.equal(lease.ttlMs, 30000);
});
