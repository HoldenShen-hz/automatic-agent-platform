export type CoordinatorNodeStatus = "active" | "draining" | "offline";
export type LeaderActionAuthority = "leader_only" | "follower_allowed" | "any";

export type LeaderCoordinatorAction =
  | "dispatch_execution"
  | "renew_leader_lease"
  | "trigger_failover"
  | "write_authoritative_state"
  | "observe_cluster";

export type FollowerCoordinatorAction =
  | "observe_cluster"
  | "ack_replication"
  | "stream_health";

export interface LeaderCoordinatorMetadata {
  role: "leader";
  allowedActions: readonly LeaderCoordinatorAction[];
  authoritativeWritesEnabled: true;
}

export interface FollowerCoordinatorMetadata {
  role: "follower";
  allowedActions: readonly FollowerCoordinatorAction[];
  authoritativeWritesEnabled: false;
}

export type CoordinatorNodeMetadata = LeaderCoordinatorMetadata | FollowerCoordinatorMetadata;

export interface CoordinatorNode {
  nodeId: string;
  region: string;
  status: CoordinatorNodeStatus;
  isLeader: boolean;
  leadershipEpoch: number;
  lastHeartbeatAt: string;
  metadata: CoordinatorNodeMetadata | null;
}

export function canCoordinatorPerformLeaderAction(
  node: CoordinatorNode,
  action: LeaderCoordinatorAction,
): boolean {
  if (!node.isLeader) {
    return false;
  }
  return node.metadata?.role === "leader" && node.metadata.allowedActions.includes(action);
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

// ── HA Levels ────────────────────────────────────────────────────────

/**
 * HA Level classification for the execution platform.
 *
 * HA-1: Single-node, no redundancy (development/testing)
 * HA-2: Active-standby, single-region failover
 * HA-3: Multi-region active-active with cross-region replication
 */
export type HaLevel = "HA_1" | "HA_2" | "HA_3";

/**
 * Configuration for a specific HA level.
 */
export interface HaLevelConfig {
  haLevel: HaLevel;
  /** Interval for lease renewal in milliseconds */
  leaseRenewalIntervalMs: number;
  /** TTL for leadership leases in milliseconds */
  leaseTtlMs: number;
  /** Interval for checking expired leases in milliseconds */
  leaseReclaimerIntervalMs: number;
  /** Interval for checking stuck runs in milliseconds */
  stuckRunSweeperIntervalMs: number;
  /** Threshold in ms beyond which a run is considered stuck */
  stuckRunThresholdMs: number;
  /** Enable cross-region failover (HA-3 only) */
  crossRegionFailover: boolean;
  /** Enable WAL for crash recovery */
  walEnabled: boolean;
  /** WAL checkpoint interval in milliseconds */
  walCheckpointIntervalMs: number;
  /** Maximum age of WAL entries before pruning in milliseconds */
  walRetentionMs: number;
  /** Enable event replay for projection rebuild */
  eventReplayEnabled: boolean;
}

/**
 * Predefined HA level configurations.
 */
export const HA_LEVEL_CONFIGS: Record<HaLevel, HaLevelConfig> = Object.freeze({
  HA_1: Object.freeze({
    haLevel: "HA_1",
    leaseRenewalIntervalMs: 0, // Not needed for single-node
    leaseTtlMs: 60_000,
    leaseReclaimerIntervalMs: 0, // No reclamation needed
    stuckRunSweeperIntervalMs: 300_000,
    stuckRunThresholdMs: 3_600_000,
    crossRegionFailover: false,
    walEnabled: false,
    walCheckpointIntervalMs: 0,
    walRetentionMs: 0,
    eventReplayEnabled: false,
  }),
  HA_2: Object.freeze({
    haLevel: "HA_2",
    leaseRenewalIntervalMs: 5_000,
    leaseTtlMs: 15_000,
    leaseReclaimerIntervalMs: 10_000,
    stuckRunSweeperIntervalMs: 60_000,
    stuckRunThresholdMs: 1_800_000,
    crossRegionFailover: false,
    walEnabled: true,
    walCheckpointIntervalMs: 30_000,
    walRetentionMs: 86_400_000,
    eventReplayEnabled: true,
  }),
  HA_3: Object.freeze({
    haLevel: "HA_3",
    leaseRenewalIntervalMs: 3_000,
    leaseTtlMs: 10_000,
    leaseReclaimerIntervalMs: 5_000,
    stuckRunSweeperIntervalMs: 30_000,
    stuckRunThresholdMs: 600_000,
    crossRegionFailover: true,
    walEnabled: true,
    walCheckpointIntervalMs: 15_000,
    walRetentionMs: 604_800_000,
    eventReplayEnabled: true,
  }),
});

// ── WAL Types ───────────────────────────────────────────────────────

/**
 * WAL (Write-Ahead Log) entry types.
 */
export type WalEntryType =
  | "execution_start"
  | "execution_update"
  | "execution_complete"
  | "execution_failed"
  | "checkpoint"
  | "lease_acquired"
  | "lease_released"
  | "failover_start"
  | "failover_complete";

/**
 * WAL entry for crash recovery.
 */
export interface WalEntry {
  id: string;
  entryType: WalEntryType;
  executionId: string | null;
  taskId: string | null;
  sessionId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
  checkpointId: string | null;
  sequenceNumber: number;
}

/**
 * Checkpoint for state recovery.
 */
export interface Checkpoint {
  id: string;
  executionId: string;
  state: Record<string, unknown>;
  createdAt: string;
  lastWalSequence: number;
  metadata: Record<string, unknown> | null;
}

/**
 * Options for WAL checkpoint creation.
 */
export interface CheckpointOptions {
  executionId: string;
  state: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

// ── Stuck Run Types ─────────────────────────────────────────────────

/**
 * Status of a stuck run sweep operation.
 */
export type StuckRunSweepStatus = "pending" | "warning" | "killed" | "cleaned_up" | "resolved";

/**
 * A run that has been detected as stuck.
 */
export interface StuckRun {
  executionId: string;
  taskId: string;
  sessionId: string | null;
  status: StuckRunSweepStatus;
  startedAt: string;
  lastProgressAt: string | null;
  sweepCount: number;
  warningIssuedAt: string | null;
  killedAt: string | null;
}

/**
 * Configuration for stuck run sweeper.
 */
export interface StuckRunSweeperConfig {
  /** How often to check for stuck runs */
  sweepIntervalMs: number;
  /** How long a run can be inactive before being considered stuck */
  stuckThresholdMs: number;
  /** How long to wait before killing a warned run */
  killAfterWarningMs: number;
  /** How long to wait before cleaning up a killed run */
  cleanupAfterKillMs: number;
  /** Maximum number of runs to process per sweep */
  maxRunsPerSweep: number;
}

// ── Lease Reclaimer Types ────────────────────────────────────────────

/**
 * Result of a lease reclamation operation.
 */
export interface LeaseReclaimResult {
  reclaimedCount: number;
  failoverTriggered: boolean;
  failedNodeIds: string[];
}

/**
 * Configuration for lease reclaimer.
 */
export interface LeaseReclaimerConfig {
  /** How often to check for expired leases */
  reclaimIntervalMs: number;
  /** Grace period before reclaiming a lease after expiration */
  gracePeriodMs: number;
  /** Whether to trigger automatic failover */
  autoFailover: boolean;
}

// ── Event Replay Types ──────────────────────────────────────────────

/**
 * Position in the event stream for replay.
 */
export interface EventReplayPosition {
  lastProcessedEventId: string | null;
  lastProcessedSequence: number;
  lastCheckpointId: string | null;
}

/**
 * Result of an event replay operation.
 */
export interface EventReplayResult {
  eventsReplayed: number;
  projectionsRebuilt: number;
  startPosition: EventReplayPosition;
  endPosition: EventReplayPosition;
  durationMs: number;
}
