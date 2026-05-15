import assert from "node:assert/strict";
import test from "node:test";

import {
  WAL_CHECKPOINT_DDL,
} from "../../../../src/platform/five-plane-execution/ha/wal-checkpoint-service.js";
import {
  CROSS_REGION_DDL,
} from "../../../../src/platform/five-plane-execution/ha/cross-region-deployment-service.js";
import {
  HA_LEVEL_CONFIGS,
  HA_COORDINATOR_DDL,
  DEFAULT_LEASE_TTL_MS,
  MIN_LEASE_TTL_MS,
  MAX_LEASE_TTL_MS,
  EPOCH_FENCING_TOKEN_START,
  type CoordinatorNodeStatus,
  type HaLevel,
  type HaLevelConfig,
  type LeaderLease,
  type LeadershipEpoch,
  type FailoverDecision,
  type LeadershipQueryResult,
  type LeaderActionAuthorization,
  type LeaderActionAuthority,
} from "../../../../src/platform/five-plane-execution/ha/types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Tests: WAL_CHECKPOINT_DDL
// ─────────────────────────────────────────────────────────────────────────────

test("WAL_CHECKPOINT_DDL contains required tables", () => {
  assert.ok(WAL_CHECKPOINT_DDL.includes("wal_entries"));
  assert.ok(WAL_CHECKPOINT_DDL.includes("checkpoints"));
  assert.ok(WAL_CHECKPOINT_DDL.includes("event_replay_positions"));
  assert.ok(WAL_CHECKPOINT_DDL.includes("idx_wal_entries_sequence"));
});

test("WAL_CHECKPOINT_DDL has correct schema for wal_entries", () => {
  assert.ok(WAL_CHECKPOINT_DDL.includes("entry_type TEXT NOT NULL"));
  assert.ok(WAL_CHECKPOINT_DDL.includes("sequence_number INTEGER NOT NULL"));
  assert.ok(WAL_CHECKPOINT_DDL.includes("checkpoint_id TEXT"));
});

test("WAL_CHECKPOINT_DDL has correct schema for checkpoints", () => {
  assert.ok(WAL_CHECKPOINT_DDL.includes("execution_id TEXT NOT NULL"));
  assert.ok(WAL_CHECKPOINT_DDL.includes("last_wal_sequence INTEGER NOT NULL"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: HA_COORDINATOR_DDL
// ─────────────────────────────────────────────────────────────────────────────

test("HA_COORDINATOR_DDL contains coordinator_nodes table", () => {
  assert.ok(HA_COORDINATOR_DDL.includes("coordinator_nodes"));
  assert.ok(HA_COORDINATOR_DDL.includes("node_id TEXT PRIMARY KEY"));
  assert.ok(HA_COORDINATOR_DDL.includes("region TEXT NOT NULL"));
  assert.ok(HA_COORDINATOR_DDL.includes("is_leader INTEGER NOT NULL DEFAULT 0"));
});

test("HA_COORDINATOR_DDL contains leadership_leases table", () => {
  assert.ok(HA_COORDINATOR_DDL.includes("leadership_leases"));
  assert.ok(HA_COORDINATOR_DDL.includes("lease_id TEXT PRIMARY KEY"));
  assert.ok(HA_COORDINATOR_DDL.includes("epoch INTEGER NOT NULL"));
  assert.ok(HA_COORDINATOR_DDL.includes("fencing_token INTEGER NOT NULL DEFAULT 1"));
});

test("HA_COORDINATOR_DDL contains leadership_epochs table", () => {
  assert.ok(HA_COORDINATOR_DDL.includes("leadership_epochs"));
  assert.ok(HA_COORDINATOR_DDL.includes("epoch INTEGER PRIMARY KEY"));
  assert.ok(HA_COORDINATOR_DDL.includes("cause TEXT NOT NULL"));
});

test("HA_COORDINATOR_DDL contains failover_decisions table", () => {
  assert.ok(HA_COORDINATOR_DDL.includes("failover_decisions"));
  assert.ok(HA_COORDINATOR_DDL.includes("decision_id TEXT PRIMARY KEY"));
  assert.ok(HA_COORDINATOR_DDL.includes("outcome TEXT NOT NULL"));
});

test("HA_COORDINATOR_DDL contains leader_action_audit table", () => {
  assert.ok(HA_COORDINATOR_DDL.includes("leader_action_audit"));
  assert.ok(HA_COORDINATOR_DDL.includes("authorized INTEGER NOT NULL"));
  assert.ok(HA_COORDINATOR_DDL.includes("reason_code TEXT NOT NULL"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: CROSS_REGION_DDL
// ─────────────────────────────────────────────────────────────────────────────

test("CROSS_REGION_DDL contains required tables", () => {
  assert.ok(CROSS_REGION_DDL.includes("regions"));
  assert.ok(CROSS_REGION_DDL.includes("region_topologies"));
  assert.ok(CROSS_REGION_DDL.includes("traffic_weights"));
  assert.ok(CROSS_REGION_DDL.includes("region_health_checks"));
  assert.ok(CROSS_REGION_DDL.includes("failover_plans"));
});

test("CROSS_REGION_DDL regions table has correct schema", () => {
  assert.ok(CROSS_REGION_DDL.includes("region_id TEXT PRIMARY KEY"));
  assert.ok(CROSS_REGION_DDL.includes("health_score REAL NOT NULL DEFAULT 100"));
  assert.ok(CROSS_REGION_DDL.includes("max_concurrency INTEGER NOT NULL DEFAULT 1000"));
});

test("CROSS_REGION_DDL failover_plans table has correct schema", () => {
  assert.ok(CROSS_REGION_DDL.includes("source_region_id TEXT NOT NULL"));
  assert.ok(CROSS_REGION_DDL.includes("steps_json TEXT NOT NULL"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: HA Level Constants
// ─────────────────────────────────────────────────────────────────────────────

test("DEFAULT_LEASE_TTL_MS is 15000", () => {
  assert.equal(DEFAULT_LEASE_TTL_MS, 15_000);
});

test("MIN_LEASE_TTL_MS is 5000", () => {
  assert.equal(MIN_LEASE_TTL_MS, 5_000);
});

test("MAX_LEASE_TTL_MS is 60000", () => {
  assert.equal(MAX_LEASE_TTL_MS, 60_000);
});

test("EPOCH_FENCING_TOKEN_START is 1", () => {
  assert.equal(EPOCH_FENCING_TOKEN_START, 1);
});

test("TTL constants are defined correctly", () => {
  assert.equal(DEFAULT_LEASE_TTL_MS, 15_000);
  assert.equal(MIN_LEASE_TTL_MS, 5_000);
  assert.equal(MAX_LEASE_TTL_MS, 60_000);
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: HA_LEVEL_CONFIGS
// ─────────────────────────────────────────────────────────────────────────────

test("HA_LEVEL_CONFIGS has all three levels", () => {
  assert.ok(HA_LEVEL_CONFIGS.HA_1 !== undefined);
  assert.ok(HA_LEVEL_CONFIGS.HA_2 !== undefined);
  assert.ok(HA_LEVEL_CONFIGS.HA_3 !== undefined);
});

test("HA_1 config disables redundancy features", () => {
  const config = HA_LEVEL_CONFIGS.HA_1;
  assert.equal(config.haLevel, "HA_1");
  assert.equal(config.leaseRenewalIntervalMs, 0);
  assert.equal(config.leaseReclaimerIntervalMs, 0);
  assert.equal(config.crossRegionFailover, false);
  assert.equal(config.walEnabled, false);
  assert.equal(config.eventReplayEnabled, false);
});

test("HA_1 config has appropriate stuck run thresholds", () => {
  const config = HA_LEVEL_CONFIGS.HA_1;
  assert.equal(config.stuckRunSweeperIntervalMs, 300_000); // 5 minutes
  assert.equal(config.stuckRunThresholdMs, 3_600_000); // 60 minutes
});

test("HA_2 config enables basic HA features", () => {
  const config = HA_LEVEL_CONFIGS.HA_2;
  assert.equal(config.haLevel, "HA_2");
  assert.equal(config.leaseRenewalIntervalMs, 5_000);
  assert.equal(config.leaseTtlMs, 15_000);
  assert.equal(config.leaseReclaimerIntervalMs, 10_000);
  assert.equal(config.crossRegionFailover, false);
  assert.equal(config.walEnabled, true);
  assert.equal(config.eventReplayEnabled, true);
});

test("HA_2 config has intermediate thresholds", () => {
  const config = HA_LEVEL_CONFIGS.HA_2;
  assert.equal(config.stuckRunSweeperIntervalMs, 60_000); // 1 minute
  assert.equal(config.stuckRunThresholdMs, 1_800_000); // 30 minutes
  assert.equal(config.walCheckpointIntervalMs, 30_000);
  assert.equal(config.walRetentionMs, 86_400_000); // 24 hours
});

test("HA_3 config enables full HA features", () => {
  const config = HA_LEVEL_CONFIGS.HA_3;
  assert.equal(config.haLevel, "HA_3");
  assert.equal(config.leaseRenewalIntervalMs, 3_000);
  assert.equal(config.leaseTtlMs, 10_000);
  assert.equal(config.leaseReclaimerIntervalMs, 5_000);
  assert.equal(config.crossRegionFailover, true);
  assert.equal(config.walEnabled, true);
  assert.equal(config.eventReplayEnabled, true);
});

test("HA_3 config has aggressive thresholds", () => {
  const config = HA_LEVEL_CONFIGS.HA_3;
  assert.equal(config.stuckRunSweeperIntervalMs, 30_000); // 30 seconds
  assert.equal(config.stuckRunThresholdMs, 600_000); // 10 minutes
  assert.equal(config.walCheckpointIntervalMs, 15_000);
  assert.equal(config.walRetentionMs, 604_800_000); // 7 days
});

test("HA levels have increasing aggressiveness", () => {
  const ha1 = HA_LEVEL_CONFIGS.HA_1;
  const ha2 = HA_LEVEL_CONFIGS.HA_2;
  const ha3 = HA_LEVEL_CONFIGS.HA_3;

  // HA_1 has 0 renewal (disabled for single-node), HA_2/HA_3 decrease
  assert.ok(ha2.leaseRenewalIntervalMs >= ha3.leaseRenewalIntervalMs);

  // Lease TTLs decrease (HA_1 is highest for single-node stability)
  assert.ok(ha1.leaseTtlMs >= ha2.leaseTtlMs);
  assert.ok(ha2.leaseTtlMs >= ha3.leaseTtlMs);

  // Stuck thresholds decrease (faster detection in higher HA levels)
  assert.ok(ha1.stuckRunThresholdMs >= ha2.stuckRunThresholdMs);
  assert.ok(ha2.stuckRunThresholdMs >= ha3.stuckRunThresholdMs);
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Type definitions
// ─────────────────────────────────────────────────────────────────────────────

test("CoordinatorNodeStatus is a union type", () => {
  const statuses: CoordinatorNodeStatus[] = ["active", "draining", "offline"];
  assert.deepEqual(statuses, ["active", "draining", "offline"]);
});

test("HaLevel is a union type", () => {
  const levels: HaLevel[] = ["HA_1", "HA_2", "HA_3"];
  assert.deepEqual(levels, ["HA_1", "HA_2", "HA_3"]);
});

test("LeaderActionAuthority is a union type", () => {
  const authorities: LeaderActionAuthority[] = ["leader_only", "follower_allowed", "any"];
  assert.deepEqual(authorities, ["leader_only", "follower_allowed", "any"]);
});

test("HaLevelConfig has all required fields", () => {
  const config = HA_LEVEL_CONFIGS.HA_2;
  assert.ok("haLevel" in config);
  assert.ok("leaseRenewalIntervalMs" in config);
  assert.ok("leaseTtlMs" in config);
  assert.ok("leaseReclaimerIntervalMs" in config);
  assert.ok("stuckRunSweeperIntervalMs" in config);
  assert.ok("stuckRunThresholdMs" in config);
  assert.ok("crossRegionFailover" in config);
  assert.ok("walEnabled" in config);
  assert.ok("walCheckpointIntervalMs" in config);
  assert.ok("walRetentionMs" in config);
  assert.ok("eventReplayEnabled" in config);
});

test("LeaderLease status is a valid union", () => {
  const statuses: LeaderLease["status"][] = ["active", "expired", "released", "transferred"];
  assert.deepEqual(statuses, ["active", "expired", "released", "transferred"]);
});

test("LeadershipEpoch cause is a valid union", () => {
  const causes: LeadershipEpoch["cause"][] = ["acquired", "renewed", "expired", "preempted", "voluntary"];
  assert.deepEqual(causes, ["acquired", "renewed", "expired", "preempted", "voluntary"]);
});

test("FailoverDecision outcome is a valid union", () => {
  const outcomes: FailoverDecision["outcome"][] = ["leader_changed", "no_change", "no_candidate"];
  assert.deepEqual(outcomes, ["leader_changed", "no_change", "no_candidate"]);
});

test("FailoverDecision cause is a valid union", () => {
  const causes: FailoverDecision["cause"][] = ["heartbeat_missing", "node_unhealthy", "voluntary", "operator_forced", "epoch_preempted"];
  assert.deepEqual(causes, ["heartbeat_missing", "node_unhealthy", "voluntary", "operator_forced", "epoch_preempted"]);
});

test("LeadershipQueryResult has expected shape", () => {
  const result: LeadershipQueryResult = {
    isLeader: false,
    leaderNodeId: null,
    epoch: 0,
    fencingToken: 0,
    expiresAt: null,
    isExpired: true,
  };

  assert.equal(result.isLeader, false);
  assert.equal(result.leaderNodeId, null);
  assert.equal(result.epoch, 0);
  assert.equal(result.isExpired, true);
});

test("LeaderActionAuthorization has expected shape", () => {
  const auth: LeaderActionAuthorization = {
    authorized: false,
    authority: "leader_only",
    reasonCode: "not_current_leader",
    leaderNodeId: "node-1",
    epoch: 1,
    fencingToken: 1,
  };

  assert.equal(auth.authorized, false);
  assert.equal(auth.authority, "leader_only");
  assert.equal(auth.reasonCode, "not_current_leader");
});
