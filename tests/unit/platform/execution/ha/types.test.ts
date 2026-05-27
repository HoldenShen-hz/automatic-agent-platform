import assert from "node:assert/strict";
import test from "node:test";

import {
  HA_COORDINATOR_DDL,
  DEFAULT_LEASE_TTL_MS,
  MIN_LEASE_TTL_MS,
  MAX_LEASE_TTL_MS,
  EPOCH_FENCING_TOKEN_START,
  HA_LEVEL_CONFIGS,
  type HaLevel,
  type HaLevelConfig,
  type CoordinatorNodeStatus,
  type LeaderActionAuthority,
  type CoordinatorNode,
  type LeaderLease,
  type LeadershipEpoch,
  type FailoverDecision,
  type LeadershipAcquisitionInput,
  type LeadershipRenewalInput,
  type LeadershipQueryResult,
  type LeaderActionAuthorization,
  type HaCoordinatorServiceOptions,
  type WalEntryType,
  type WalEntry,
  type Checkpoint,
  type CheckpointOptions,
  type StuckRunSweepStatus,
  type StuckRun,
  type StuckRunSweeperConfig,
  type LeaseReclaimResult,
  type LeaseReclaimerConfig,
  type EventReplayPosition,
  type EventReplayResult,
} from "../../../../../src/platform/five-plane-execution/ha/types.js";

test("HA_COORDINATOR_DDL contains required tables [types]", () => {
  assert.ok(HA_COORDINATOR_DDL.includes("CREATE TABLE IF NOT EXISTS coordinator_nodes"));
  assert.ok(HA_COORDINATOR_DDL.includes("CREATE TABLE IF NOT EXISTS leadership_leases"));
  assert.ok(HA_COORDINATOR_DDL.includes("CREATE TABLE IF NOT EXISTS leadership_epochs"));
  assert.ok(HA_COORDINATOR_DDL.includes("CREATE TABLE IF NOT EXISTS failover_decisions"));
  assert.ok(HA_COORDINATOR_DDL.includes("CREATE TABLE IF NOT EXISTS leader_action_audit"));
});

test("HA_COORDINATOR_DDL contains required indexes [types]", () => {
  assert.ok(HA_COORDINATOR_DDL.includes("CREATE INDEX IF NOT EXISTS idx_coordinator_nodes_status"));
  assert.ok(HA_COORDINATOR_DDL.includes("CREATE INDEX IF NOT EXISTS idx_coordinator_nodes_leader"));
  assert.ok(HA_COORDINATOR_DDL.includes("CREATE INDEX IF NOT EXISTS idx_leadership_leases_node"));
  assert.ok(HA_COORDINATOR_DDL.includes("CREATE INDEX IF NOT EXISTS idx_leadership_leases_status"));
  assert.ok(HA_COORDINATOR_DDL.includes("CREATE INDEX IF NOT EXISTS idx_leadership_leases_expires"));
});

test("DEFAULT_LEASE_TTL_MS is 15000 [types]", () => {
  assert.equal(DEFAULT_LEASE_TTL_MS, 15_000);
});

test("MIN_LEASE_TTL_MS is 5000 [types]", () => {
  assert.equal(MIN_LEASE_TTL_MS, 5_000);
});

test("MAX_LEASE_TTL_MS is 60000 [types]", () => {
  assert.equal(MAX_LEASE_TTL_MS, 60_000);
});

test("EPOCH_FENCING_TOKEN_START is 1 [types]", () => {
  assert.equal(EPOCH_FENCING_TOKEN_START, 1);
});

test("HA_LEVEL_CONFIGS contains all three HA levels [types]", () => {
  assert.ok(HA_LEVEL_CONFIGS["HA_1"]);
  assert.ok(HA_LEVEL_CONFIGS["HA_2"]);
  assert.ok(HA_LEVEL_CONFIGS["HA_3"]);
});

test("HA_LEVEL_CONFIGS.HA_1 is configured for single-node [types]", () => {
  const config = HA_LEVEL_CONFIGS["HA_1"];
  assert.equal(config.haLevel, "HA_1");
  assert.equal(config.leaseRenewalIntervalMs, 0); // Not needed for single-node
  assert.equal(config.leaseTtlMs, 60_000);
  assert.equal(config.leaseReclaimerIntervalMs, 0); // No reclamation needed
  assert.equal(config.crossRegionFailover, false);
  assert.equal(config.walEnabled, false);
  assert.equal(config.eventReplayEnabled, false);
});

test("HA_LEVEL_CONFIGS.HA_2 is configured for active-standby [types]", () => {
  const config = HA_LEVEL_CONFIGS["HA_2"];
  assert.equal(config.haLevel, "HA_2");
  assert.equal(config.leaseRenewalIntervalMs, 5_000);
  assert.equal(config.leaseTtlMs, 15_000);
  assert.equal(config.leaseReclaimerIntervalMs, 10_000);
  assert.equal(config.crossRegionFailover, false);
  assert.equal(config.walEnabled, true);
  assert.equal(config.walCheckpointIntervalMs, 30_000);
  assert.equal(config.walRetentionMs, 86_400_000); // 24 hours
  assert.equal(config.eventReplayEnabled, true);
});

test("HA_LEVEL_CONFIGS.HA_3 is configured for multi-region [types]", () => {
  const config = HA_LEVEL_CONFIGS["HA_3"];
  assert.equal(config.haLevel, "HA_3");
  assert.equal(config.leaseRenewalIntervalMs, 3_000);
  assert.equal(config.leaseTtlMs, 10_000);
  assert.equal(config.leaseReclaimerIntervalMs, 5_000);
  assert.equal(config.crossRegionFailover, true);
  assert.equal(config.walEnabled, true);
  assert.equal(config.walCheckpointIntervalMs, 15_000);
  assert.equal(config.walRetentionMs, 604_800_000); // 7 days
  assert.equal(config.eventReplayEnabled, true);
});

test("CoordinatorNodeStatus type accepts valid values [types]", () => {
  const statuses: CoordinatorNodeStatus[] = ["active", "draining", "offline"];
  assert.deepEqual(statuses, ["active", "draining", "offline"]);
});

test("LeaderActionAuthority type accepts valid values [types]", () => {
  const authorities: LeaderActionAuthority[] = ["leader_only", "follower_allowed", "any"];
  assert.deepEqual(authorities, ["leader_only", "follower_allowed", "any"]);
});

test("LeaderLease status type accepts valid values [types]", () => {
  const statuses: LeaderLease["status"][] = ["active", "expired", "released", "transferred"];
  assert.deepEqual(statuses, ["active", "expired", "released", "transferred"]);
});

test("LeadershipEpoch cause type accepts valid values [types]", () => {
  const causes: LeadershipEpoch["cause"][] = ["acquired", "renewed", "expired", "preempted", "voluntary"];
  assert.deepEqual(causes, ["acquired", "renewed", "expired", "preempted", "voluntary"]);
});

test("FailoverDecision cause type accepts valid values [types]", () => {
  const causes: FailoverDecision["cause"][] = ["heartbeat_missing", "node_unhealthy", "voluntary", "operator_forced", "epoch_preempted"];
  assert.deepEqual(causes, ["heartbeat_missing", "node_unhealthy", "voluntary", "operator_forced", "epoch_preempted"]);
});

test("FailoverDecision outcome type accepts valid values [types]", () => {
  const outcomes: FailoverDecision["outcome"][] = ["leader_changed", "no_change", "no_candidate"];
  assert.deepEqual(outcomes, ["leader_changed", "no_change", "no_candidate"]);
});

test("WalEntryType contains all expected entry types [types]", () => {
  const entryTypes: WalEntryType[] = [
    "execution_start",
    "execution_update",
    "execution_complete",
    "execution_failed",
    "checkpoint",
    "lease_acquired",
    "lease_released",
    "failover_start",
    "failover_complete",
  ];
  assert.equal(entryTypes.length, 9);
});

test("StuckRunSweepStatus type accepts valid values [types]", () => {
  const statuses: StuckRunSweepStatus[] = ["pending", "warning", "killed", "cleaned_up", "resolved"];
  assert.deepEqual(statuses, ["pending", "warning", "killed", "cleaned_up", "resolved"]);
});

test("HaLevel type accepts valid values [types]", () => {
  const levels: HaLevel[] = ["HA_1", "HA_2", "HA_3"];
  assert.deepEqual(levels, ["HA_1", "HA_2", "HA_3"]);
});

test("HaLevelConfig interface structure [types]", () => {
  const config: HaLevelConfig = {
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
  };

  assert.equal(config.haLevel, "HA_2");
  assert.equal(config.leaseRenewalIntervalMs, 5_000);
  assert.equal(config.walEnabled, true);
});

test("CoordinatorNode interface structure [types]", () => {
  const node: CoordinatorNode = {
    nodeId: "node_1",
    region: "us-east-1",
    status: "active",
    isLeader: true,
    leadershipEpoch: 1,
    lastHeartbeatAt: "2026-04-26T10:00:00Z",
    metadata: { tags: ["production"] },
  };

  assert.equal(node.nodeId, "node_1");
  assert.equal(node.isLeader, true);
  assert.ok(node.metadata);
});

test("LeaderLease interface structure [types]", () => {
  const lease: LeaderLease = {
    leaseId: "lease_1",
    nodeId: "node_1",
    epoch: 1,
    acquiredAt: "2026-04-26T10:00:00Z",
    expiresAt: "2026-04-26T10:30:00Z",
    status: "active",
    ttlMs: 30_000,
  };

  assert.equal(lease.leaseId, "lease_1");
  assert.equal(lease.status, "active");
  assert.equal(lease.ttlMs, 30_000);
});

test("LeadershipEpoch interface structure [types]", () => {
  const epoch: LeadershipEpoch = {
    epoch: 1,
    leaderNodeId: "node_1",
    startedAt: "2026-04-26T10:00:00Z",
    endedAt: null,
    cause: "acquired",
    fencingToken: 1,
  };

  assert.equal(epoch.epoch, 1);
  assert.equal(epoch.cause, "acquired");
  assert.equal(epoch.fencingToken, 1);
});

test("FailoverDecision interface structure [types]", () => {
  const decision: FailoverDecision = {
    decisionId: "decision_1",
    oldLeaderNodeId: "node_old",
    newLeaderNodeId: "node_new",
    epoch: 2,
    cause: "heartbeat_missing",
    outcome: "leader_changed",
    decidedAt: "2026-04-26T10:30:00Z",
    fencingToken: 5,
  };

  assert.equal(decision.decisionId, "decision_1");
  assert.equal(decision.outcome, "leader_changed");
});

test("LeadershipAcquisitionInput interface structure [types]", () => {
  const input: LeadershipAcquisitionInput = {
    nodeId: "node_1",
    ttlMs: 15_000,
    forceAcquire: false,
  };

  assert.equal(input.nodeId, "node_1");
  assert.equal(input.forceAcquire, false);
});

test("LeadershipRenewalInput interface structure [types]", () => {
  const input: LeadershipRenewalInput = {
    nodeId: "node_1",
    ttlMs: 10_000,
  };

  assert.equal(input.nodeId, "node_1");
});

test("LeadershipQueryResult interface structure [types]", () => {
  const result: LeadershipQueryResult = {
    isLeader: true,
    leaderNodeId: "node_1",
    epoch: 3,
    fencingToken: 10,
    expiresAt: "2026-04-26T11:00:00Z",
    isExpired: false,
  };

  assert.equal(result.isLeader, true);
  assert.equal(result.isExpired, false);
});

test("LeaderActionAuthorization interface structure [types]", () => {
  const auth: LeaderActionAuthorization = {
    authorized: true,
    authority: "leader_only",
    reasonCode: "ok",
    leaderNodeId: "node_1",
    epoch: 1,
    fencingToken: 1,
  };

  assert.equal(auth.authorized, true);
  assert.equal(auth.authority, "leader_only");
});

test("HaCoordinatorServiceOptions interface structure [types]", () => {
  const options: HaCoordinatorServiceOptions = {
    defaultTtlMs: 30_000,
    strictLeaderAuthority: true,
  };

  assert.equal(options.defaultTtlMs, 30_000);
  assert.equal(options.strictLeaderAuthority, true);
});

test("WalEntry interface structure [types]", () => {
  const entry: WalEntry = {
    id: "wal_1",
    entryType: "execution_start",
    executionId: "exec_1",
    taskId: "task_1",
    sessionId: "session_1",
    payload: { key: "value" },
    createdAt: "2026-04-26T10:00:00Z",
    checkpointId: null,
    sequenceNumber: 1,
  };

  assert.equal(entry.id, "wal_1");
  assert.equal(entry.entryType, "execution_start");
  assert.equal(entry.sequenceNumber, 1);
});

test("Checkpoint interface structure [types]", () => {
  const checkpoint: Checkpoint = {
    id: "cp_1",
    executionId: "exec_1",
    state: { counter: 42 },
    createdAt: "2026-04-26T10:00:00Z",
    lastWalSequence: 100,
    metadata: null,
  };

  assert.equal(checkpoint.id, "cp_1");
  assert.deepEqual(checkpoint.state, { counter: 42 });
});

test("CheckpointOptions interface structure [types]", () => {
  const options: CheckpointOptions = {
    executionId: "exec_1",
    state: { data: "test" },
    metadata: { version: "1.0" },
  };

  assert.equal(options.executionId, "exec_1");
  assert.ok(options.metadata);
});

test("StuckRun interface structure [types]", () => {
  const run: StuckRun = {
    executionId: "exec_1",
    taskId: "task_1",
    sessionId: null,
    status: "pending",
    startedAt: "2026-04-26T09:00:00Z",
    lastProgressAt: null,
    sweepCount: 0,
    warningIssuedAt: null,
    killedAt: null,
  };

  assert.equal(run.status, "pending");
  assert.equal(run.sweepCount, 0);
});

test("StuckRunSweeperConfig interface structure [types]", () => {
  const config: StuckRunSweeperConfig = {
    sweepIntervalMs: 60_000,
    stuckThresholdMs: 1_800_000,
    killAfterWarningMs: 300_000,
    cleanupAfterKillMs: 600_000,
    maxRunsPerSweep: 100,
  };

  assert.equal(config.maxRunsPerSweep, 100);
});

test("LeaseReclaimResult interface structure [types]", () => {
  const result: LeaseReclaimResult = {
    reclaimedCount: 5,
    failoverTriggered: true,
    failedNodeIds: ["node_1", "node_2"],
  };

  assert.equal(result.reclaimedCount, 5);
  assert.equal(result.failoverTriggered, true);
  assert.equal(result.failedNodeIds.length, 2);
});

test("LeaseReclaimerConfig interface structure [types]", () => {
  const config: LeaseReclaimerConfig = {
    reclaimIntervalMs: 10_000,
    gracePeriodMs: 5_000,
    autoFailover: true,
  };

  assert.equal(config.autoFailover, true);
});

test("EventReplayPosition interface structure [types]", () => {
  const position: EventReplayPosition = {
    lastProcessedEventId: "event_100",
    lastProcessedSequence: 100,
    lastCheckpointId: "cp_50",
  };

  assert.equal(position.lastProcessedSequence, 100);
});

test("EventReplayResult interface structure [types]", () => {
  const result: EventReplayResult = {
    eventsReplayed: 50,
    projectionsRebuilt: 3,
    startPosition: {
      lastProcessedEventId: null,
      lastProcessedSequence: 0,
      lastCheckpointId: null,
    },
    endPosition: {
      lastProcessedEventId: "event_50",
      lastProcessedSequence: 50,
      lastCheckpointId: "cp_25",
    },
    durationMs: 1500,
  };

  assert.equal(result.eventsReplayed, 50);
  assert.equal(result.durationMs, 1500);
});
