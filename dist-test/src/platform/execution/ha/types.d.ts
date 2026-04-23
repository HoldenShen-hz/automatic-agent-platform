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
export declare const HA_COORDINATOR_DDL = "\nCREATE TABLE IF NOT EXISTS coordinator_nodes (\n  node_id TEXT PRIMARY KEY,\n  region TEXT NOT NULL,\n  status TEXT NOT NULL DEFAULT 'active',\n  is_leader INTEGER NOT NULL DEFAULT 0,\n  leadership_epoch INTEGER NOT NULL DEFAULT 0,\n  last_heartbeat_at TEXT NOT NULL,\n  metadata TEXT,\n  created_at TEXT NOT NULL,\n  updated_at TEXT NOT NULL\n);\nCREATE INDEX IF NOT EXISTS idx_coordinator_nodes_status ON coordinator_nodes(status);\nCREATE INDEX IF NOT EXISTS idx_coordinator_nodes_leader ON coordinator_nodes(is_leader);\n\nCREATE TABLE IF NOT EXISTS leadership_leases (\n  lease_id TEXT PRIMARY KEY,\n  node_id TEXT NOT NULL,\n  epoch INTEGER NOT NULL,\n  acquired_at TEXT NOT NULL,\n  expires_at TEXT NOT NULL,\n  status TEXT NOT NULL DEFAULT 'active',\n  ttl_ms INTEGER NOT NULL DEFAULT 30000,\n  fencing_token INTEGER NOT NULL DEFAULT 1,\n  metadata TEXT,\n  FOREIGN KEY (node_id) REFERENCES coordinator_nodes(node_id)\n);\nCREATE INDEX IF NOT EXISTS idx_leadership_leases_node ON leadership_leases(node_id);\nCREATE INDEX IF NOT EXISTS idx_leadership_leases_status ON leadership_leases(status);\nCREATE INDEX IF NOT EXISTS idx_leadership_leases_expires ON leadership_leases(expires_at);\n\nCREATE TABLE IF NOT EXISTS leadership_epochs (\n  epoch INTEGER PRIMARY KEY,\n  leader_node_id TEXT,\n  started_at TEXT NOT NULL,\n  ended_at TEXT,\n  cause TEXT NOT NULL,\n  fencing_token INTEGER NOT NULL DEFAULT 1\n);\nCREATE INDEX IF NOT EXISTS idx_leadership_epochs_leader ON leadership_epochs(leader_node_id);\n\nCREATE TABLE IF NOT EXISTS failover_decisions (\n  decision_id TEXT PRIMARY KEY,\n  old_leader_node_id TEXT,\n  new_leader_node_id TEXT,\n  epoch INTEGER NOT NULL,\n  cause TEXT NOT NULL,\n  outcome TEXT NOT NULL,\n  decided_at TEXT NOT NULL,\n  fencing_token INTEGER NOT NULL\n);\nCREATE INDEX IF NOT EXISTS idx_failover_decisions_epoch ON failover_decisions(epoch);\n\nCREATE TABLE IF NOT EXISTS leader_action_audit (\n  id TEXT PRIMARY KEY,\n  action_type TEXT NOT NULL,\n  requesting_node_id TEXT NOT NULL,\n  leader_node_id TEXT,\n  epoch INTEGER NOT NULL,\n  fencing_token INTEGER NOT NULL,\n  authorized INTEGER NOT NULL,\n  reason_code TEXT NOT NULL,\n  performed_at TEXT NOT NULL\n);\nCREATE INDEX IF NOT EXISTS idx_leader_action_audit_performed ON leader_action_audit(performed_at);\n";
export declare const DEFAULT_LEASE_TTL_MS = 15000;
export declare const MIN_LEASE_TTL_MS = 5000;
export declare const MAX_LEASE_TTL_MS = 60000;
export declare const EPOCH_FENCING_TOKEN_START = 1;
export type RawRow = Record<string, unknown>;
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
export declare const HA_LEVEL_CONFIGS: Record<HaLevel, HaLevelConfig>;
/**
 * WAL (Write-Ahead Log) entry types.
 */
export type WalEntryType = "execution_start" | "execution_update" | "execution_complete" | "execution_failed" | "checkpoint" | "lease_acquired" | "lease_released" | "failover_start" | "failover_complete";
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
