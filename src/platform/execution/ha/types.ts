export type CoordinatorNodeStatus = "active" | "draining" | "offline";
export type LeaderActionAuthority = "leader_only" | "follower_allowed" | "any";

export interface CoordinatorNode {
  nodeId: string;
  region: string;
  status: CoordinatorNodeStatus;
  isLeader: boolean;
  leadershipEpoch: number;
  lastHeartbeatAt: string;
  metadata: Record<string, unknown> | null;
}

export interface LeaderLease {
  leaseId: string;
  nodeId: string;
  epoch: number;
  acquiredAt: string;
  expiresAt: string;
  status: "active" | "expired" | "released" | "transferred";
  ttlMs: number;
}

export interface LeadershipEpoch {
  epoch: number;
  leaderNodeId: string | null;
  startedAt: string;
  endedAt: string | null;
  cause: "acquired" | "renewed" | "expired" | "preempted" | "voluntary";
  fencingToken: number;
}

export interface FailoverDecision {
  decisionId: string;
  oldLeaderNodeId: string | null;
  newLeaderNodeId: string | null;
  epoch: number;
  cause: "heartbeat_missing" | "node_unhealthy" | "voluntary" | "operator_forced" | "epoch_preempted";
  outcome: "leader_changed" | "no_change" | "no_candidate";
  decidedAt: string;
  fencingToken: number;
}

export interface LeadershipAcquisitionInput {
  nodeId: string;
  ttlMs?: number;
  forceAcquire?: boolean;
}

export interface LeadershipRenewalInput {
  nodeId: string;
  ttlMs?: number;
}

export interface LeadershipQueryResult {
  isLeader: boolean;
  leaderNodeId: string | null;
  epoch: number;
  fencingToken: number;
  expiresAt: string | null;
  isExpired: boolean;
}

export interface LeaderActionAuthorization {
  authorized: boolean;
  authority: LeaderActionAuthority;
  reasonCode: string;
  leaderNodeId: string | null;
  epoch: number;
  fencingToken: number;
}

export interface HaCoordinatorServiceOptions {
  defaultTtlMs?: number;
  strictLeaderAuthority?: boolean;
}

export const HA_COORDINATOR_DDL = `
CREATE TABLE IF NOT EXISTS coordinator_nodes (
  node_id TEXT PRIMARY KEY,
  region TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  is_leader INTEGER NOT NULL DEFAULT 0,
  leadership_epoch INTEGER NOT NULL DEFAULT 0,
  last_heartbeat_at TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_coordinator_nodes_status ON coordinator_nodes(status);
CREATE INDEX IF NOT EXISTS idx_coordinator_nodes_leader ON coordinator_nodes(is_leader);

CREATE TABLE IF NOT EXISTS leadership_leases (
  lease_id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL,
  epoch INTEGER NOT NULL,
  acquired_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  ttl_ms INTEGER NOT NULL DEFAULT 30000,
  fencing_token INTEGER NOT NULL DEFAULT 1,
  metadata TEXT,
  FOREIGN KEY (node_id) REFERENCES coordinator_nodes(node_id)
);
CREATE INDEX IF NOT EXISTS idx_leadership_leases_node ON leadership_leases(node_id);
CREATE INDEX IF NOT EXISTS idx_leadership_leases_status ON leadership_leases(status);
CREATE INDEX IF NOT EXISTS idx_leadership_leases_expires ON leadership_leases(expires_at);

CREATE TABLE IF NOT EXISTS leadership_epochs (
  epoch INTEGER PRIMARY KEY,
  leader_node_id TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  cause TEXT NOT NULL,
  fencing_token INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_leadership_epochs_leader ON leadership_epochs(leader_node_id);

CREATE TABLE IF NOT EXISTS failover_decisions (
  decision_id TEXT PRIMARY KEY,
  old_leader_node_id TEXT,
  new_leader_node_id TEXT,
  epoch INTEGER NOT NULL,
  cause TEXT NOT NULL,
  outcome TEXT NOT NULL,
  decided_at TEXT NOT NULL,
  fencing_token INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_failover_decisions_epoch ON failover_decisions(epoch);

CREATE TABLE IF NOT EXISTS leader_action_audit (
  id TEXT PRIMARY KEY,
  action_type TEXT NOT NULL,
  requesting_node_id TEXT NOT NULL,
  leader_node_id TEXT,
  epoch INTEGER NOT NULL,
  fencing_token INTEGER NOT NULL,
  authorized INTEGER NOT NULL,
  reason_code TEXT NOT NULL,
  performed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_leader_action_audit_performed ON leader_action_audit(performed_at);
`;

export const DEFAULT_LEASE_TTL_MS = 15_000;
export const MIN_LEASE_TTL_MS = 5_000;
export const MAX_LEASE_TTL_MS = 60_000;
export const EPOCH_FENCING_TOKEN_START = 1;

export type RawRow = Record<string, unknown>;
