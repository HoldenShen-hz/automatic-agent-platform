import type {
  CoordinatorNode,
  CoordinatorNodeMetadata,
  CoordinatorNodeStatus,
  FailoverDecision,
  LeaderLease,
  LeadershipEpoch,
  RawRow,
} from "./types.js";

export function mapNode(row: RawRow): CoordinatorNode {
  return {
    nodeId: String(row.node_id),
    region: String(row.region),
    status: String(row.status) as CoordinatorNodeStatus,
    isLeader: Boolean(row.is_leader),
    leadershipEpoch: Number(row.leadership_epoch),
    lastHeartbeatAt: String(row.last_heartbeat_at),
    metadata: row.metadata ? (JSON.parse(row.metadata as string) as unknown) as CoordinatorNodeMetadata : null,
  };
}

export function mapLease(row: RawRow): LeaderLease {
  return {
    leaseId: String(row.lease_id),
    nodeId: String(row.node_id),
    epoch: Number(row.epoch),
    acquiredAt: String(row.acquired_at),
    expiresAt: String(row.expires_at),
    status: String(row.status) as LeaderLease["status"],
    ttlMs: Number(row.ttl_ms),
  };
}

export function mapEpoch(row: RawRow): LeadershipEpoch {
  return {
    epoch: Number(row.epoch),
    leaderNodeId: row.leader_node_id ? String(row.leader_node_id) : null,
    startedAt: String(row.started_at),
    endedAt: row.ended_at ? String(row.ended_at) : null,
    cause: String(row.cause) as LeadershipEpoch["cause"],
    fencingToken: Number(row.fencing_token),
  };
}

export function mapFailoverDecision(row: RawRow): FailoverDecision {
  return {
    decisionId: String(row.decision_id),
    oldLeaderNodeId: row.old_leader_node_id ? String(row.old_leader_node_id) : null,
    newLeaderNodeId: row.new_leader_node_id ? String(row.new_leader_node_id) : null,
    epoch: Number(row.epoch),
    cause: String(row.cause) as FailoverDecision["cause"],
    outcome: String(row.outcome) as FailoverDecision["outcome"],
    decidedAt: String(row.decided_at),
    fencingToken: Number(row.fencing_token),
  };
}
