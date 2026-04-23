export function mapNode(row) {
    return {
        nodeId: String(row.node_id),
        region: String(row.region),
        status: String(row.status),
        isLeader: Boolean(row.is_leader),
        leadershipEpoch: Number(row.leadership_epoch),
        lastHeartbeatAt: String(row.last_heartbeat_at),
        metadata: row.metadata ? JSON.parse(row.metadata) : null,
    };
}
export function mapLease(row) {
    return {
        leaseId: String(row.lease_id),
        nodeId: String(row.node_id),
        epoch: Number(row.epoch),
        acquiredAt: String(row.acquired_at),
        expiresAt: String(row.expires_at),
        status: String(row.status),
        ttlMs: Number(row.ttl_ms),
    };
}
export function mapEpoch(row) {
    return {
        epoch: Number(row.epoch),
        leaderNodeId: row.leader_node_id ? String(row.leader_node_id) : null,
        startedAt: String(row.started_at),
        endedAt: row.ended_at ? String(row.ended_at) : null,
        cause: String(row.cause),
        fencingToken: Number(row.fencing_token),
    };
}
export function mapFailoverDecision(row) {
    return {
        decisionId: String(row.decision_id),
        oldLeaderNodeId: row.old_leader_node_id ? String(row.old_leader_node_id) : null,
        newLeaderNodeId: row.new_leader_node_id ? String(row.new_leader_node_id) : null,
        epoch: Number(row.epoch),
        cause: String(row.cause),
        outcome: String(row.outcome),
        decidedAt: String(row.decided_at),
        fencingToken: Number(row.fencing_token),
    };
}
//# sourceMappingURL=mappers.js.map