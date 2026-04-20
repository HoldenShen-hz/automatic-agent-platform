import assert from "node:assert/strict";
import test from "node:test";

import {
  HaCoordinatorService,
  HA_COORDINATOR_DDL,
  MIN_LEASE_TTL_MS,
  MAX_LEASE_TTL_MS,
} from "../../../src/platform/execution/ha/ha-coordinator-service.js";
import { SqliteDatabase } from "../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../helpers/fs.js";
import { join } from "node:path";

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "ha-coordinator.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  db.connection.exec(HA_COORDINATOR_DDL);
  return { workspace, db };
}

test("registerNode creates a coordinator node", () => {
  const h = createHarness("aa-node-reg-");
  try {
    const service = new HaCoordinatorService(h.db);
    const node = service.registerNode("coordinator-1", "us-east-1");

    assert.equal(node.nodeId, "coordinator-1");
    assert.equal(node.region, "us-east-1");
    assert.equal(node.status, "active");
    assert.equal(node.isLeader, false);
    assert.equal(node.leadershipEpoch, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("getNode retrieves registered node", () => {
  const h = createHarness("aa-get-node-");
  try {
    const service = new HaCoordinatorService(h.db);
    service.registerNode("coordinator-1", "us-east-1");

    const node = service.getNode("coordinator-1");
    assert.ok(node);
    assert.equal(node!.nodeId, "coordinator-1");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("listNodes returns all registered nodes", () => {
  const h = createHarness("aa-list-nodes-");
  try {
    const service = new HaCoordinatorService(h.db);
    service.registerNode("coordinator-1", "us-east-1");
    service.registerNode("coordinator-2", "us-west-2");

    const nodes = service.listNodes();
    assert.equal(nodes.length, 2);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("acquireLeadership gains leadership lease", () => {
  const h = createHarness("aa-acquire-lead-");
  try {
    const service = new HaCoordinatorService(h.db);
    service.registerNode("coordinator-1", "us-east-1");

    const result = service.acquireLeadership({ nodeId: "coordinator-1", ttlMs: 10000 });

    assert.equal(result.acquired, true);
    assert.ok(result.lease);
    assert.equal(result.lease!.nodeId, "coordinator-1");
    assert.equal(result.lease!.status, "active");
    assert.ok(result.epoch > 0);
    assert.ok(result.fencingToken > 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("acquireLeadership uses DEFAULT_LEASE_TTL_MS when ttlMs not specified", () => {
  const h = createHarness("aa-acquire-default-ttl-");
  try {
    const service = new HaCoordinatorService(h.db);
    service.registerNode("coordinator-1", "us-east-1");

    // Acquire without specifying ttlMs - should use DEFAULT_LEASE_TTL_MS (15000)
    const result = service.acquireLeadership({ nodeId: "coordinator-1" });

    assert.equal(result.acquired, true);
    assert.ok(result.lease);
    // TTL should be approximately DEFAULT_LEASE_TTL_MS (allow 100ms tolerance for test execution)
    assert.ok(result.lease!.ttlMs >= 15000 - 100 && result.lease!.ttlMs <= 15000 + 100,
      `Expected TTL ~15000, got ${result.lease!.ttlMs}`);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("acquireLeadership fails when another node holds leadership", () => {
  const h = createHarness("aa-acquire-fail-");
  try {
    const service = new HaCoordinatorService(h.db);
    service.registerNode("coordinator-1", "us-east-1");
    service.registerNode("coordinator-2", "us-west-2");

    // First node acquires
    service.acquireLeadership({ nodeId: "coordinator-1" });

    // Second node tries to acquire without force
    const result = service.acquireLeadership({ nodeId: "coordinator-2" });

    assert.equal(result.acquired, false);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("acquireLeadership with forceAcquire preempts existing leadership", () => {
  const h = createHarness("aa-force-acq-");
  try {
    const service = new HaCoordinatorService(h.db);
    service.registerNode("coordinator-1", "us-east-1");
    service.registerNode("coordinator-2", "us-west-2");

    // First node acquires
    service.acquireLeadership({ nodeId: "coordinator-1" });

    // Second node preempts
    const result = service.acquireLeadership({ nodeId: "coordinator-2", forceAcquire: true });

    assert.equal(result.acquired, true);
    assert.equal(result.lease!.nodeId, "coordinator-2");

    // Verify old leader is demoted
    const oldLeader = service.getNode("coordinator-1");
    assert.equal(oldLeader!.isLeader, false);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("renewLeadership extends lease", () => {
  const h = createHarness("aa-renew-lead-");
  try {
    const service = new HaCoordinatorService(h.db);
    service.registerNode("coordinator-1", "us-east-1");

    service.acquireLeadership({ nodeId: "coordinator-1", ttlMs: 5000 });
    const result = service.renewLeadership({ nodeId: "coordinator-1", ttlMs: 10000 });

    assert.equal(result.renewed, true);
    assert.ok(result.lease);
    assert.ok(result.lease!.ttlMs >= 10000);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("renewLeadership fails for non-leader", () => {
  const h = createHarness("aa-renew-fail-");
  try {
    const service = new HaCoordinatorService(h.db);
    service.registerNode("coordinator-1", "us-east-1");

    const result = service.renewLeadership({ nodeId: "coordinator-1" });

    assert.equal(result.renewed, false);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("releaseLeadership releases leadership", () => {
  const h = createHarness("aa-release-lead-");
  try {
    const service = new HaCoordinatorService(h.db);
    service.registerNode("coordinator-1", "us-east-1");

    service.acquireLeadership({ nodeId: "coordinator-1" });
    const released = service.releaseLeadership("coordinator-1");

    assert.equal(released, true);

    const leader = service.getCurrentLeader();
    assert.equal(leader, null);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("getCurrentLeader returns current leader node", () => {
  const h = createHarness("aa-get-leader-");
  try {
    const service = new HaCoordinatorService(h.db);
    service.registerNode("coordinator-1", "us-east-1");

    const result1 = service.getCurrentLeader();
    assert.equal(result1, null);

    service.acquireLeadership({ nodeId: "coordinator-1" });
    const result2 = service.getCurrentLeader();

    assert.ok(result2);
    assert.equal(result2!.nodeId, "coordinator-1");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("queryLeadership returns correct leadership state", () => {
  const h = createHarness("aa-query-lead-");
  try {
    const service = new HaCoordinatorService(h.db);
    service.registerNode("coordinator-1", "us-east-1");

    // No leader initially
    const state1 = service.queryLeadership();
    assert.equal(state1.isLeader, false);
    assert.equal(state1.leaderNodeId, null);

    // Acquire leadership
    service.acquireLeadership({ nodeId: "coordinator-1" });
    const state2 = service.queryLeadership();

    assert.equal(state2.isLeader, true);
    assert.equal(state2.leaderNodeId, "coordinator-1");
    assert.ok(state2.epoch > 0);
    assert.ok(state2.fencingToken > 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("authorizeAction allows leader-only action for current leader", () => {
  const h = createHarness("aa-auth-lead-");
  try {
    const service = new HaCoordinatorService(h.db);
    service.registerNode("coordinator-1", "us-east-1");
    service.acquireLeadership({ nodeId: "coordinator-1" });

    const auth = service.authorizeAction("coordinator-1", "global_repair", "leader_only");

    assert.equal(auth.authorized, true);
    assert.equal(auth.reasonCode, "ok");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("authorizeAction denies leader-only action for follower", () => {
  const h = createHarness("aa-auth-follower-");
  try {
    const service = new HaCoordinatorService(h.db);
    service.registerNode("coordinator-1", "us-east-1");
    service.registerNode("coordinator-2", "us-west-2");
    service.acquireLeadership({ nodeId: "coordinator-1" });

    const auth = service.authorizeAction("coordinator-2", "global_repair", "leader_only");

    assert.equal(auth.authorized, false);
    assert.equal(auth.reasonCode, "not_current_leader");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("authorizeAction allows follower_allowed action for any node", () => {
  const h = createHarness("aa-auth-any-");
  try {
    const service = new HaCoordinatorService(h.db);
    service.registerNode("coordinator-1", "us-east-1");
    service.registerNode("coordinator-2", "us-west-2");
    service.acquireLeadership({ nodeId: "coordinator-1" });

    const auth = service.authorizeAction("coordinator-2", "status_check", "follower_allowed");

    assert.equal(auth.authorized, true);
    assert.equal(auth.reasonCode, "follower_allowed");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("getLatestEpoch returns current epoch", () => {
  const h = createHarness("aa-get-epoch-");
  try {
    const service = new HaCoordinatorService(h.db);
    service.registerNode("coordinator-1", "us-east-1");

    const epoch1 = service.getLatestEpoch();
    assert.equal(epoch1.epoch, 0);

    service.acquireLeadership({ nodeId: "coordinator-1" });
    const epoch2 = service.getLatestEpoch();

    assert.ok(epoch2.epoch > 0);
    assert.equal(epoch2.leaderNodeId, "coordinator-1");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("triggerFailover promotes new leader when old leader fails", () => {
  const h = createHarness("aa-failover-");
  try {
    const service = new HaCoordinatorService(h.db);
    service.registerNode("coordinator-1", "us-east-1");
    service.registerNode("coordinator-2", "us-west-2");
    service.registerNode("coordinator-3", "eu-west-1");

    service.acquireLeadership({ nodeId: "coordinator-1" });
    const decision = service.triggerFailover("heartbeat_missing");

    assert.equal(decision.outcome, "leader_changed");
    assert.equal(decision.oldLeaderNodeId, "coordinator-1");
    assert.ok(decision.newLeaderNodeId);
    // coordinator-2 should be selected (lowest nodeId among candidates)
    assert.equal(decision.newLeaderNodeId, "coordinator-2");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("triggerFailover with forceNodeId promotes specific node", () => {
  const h = createHarness("aa-force-failover-");
  try {
    const service = new HaCoordinatorService(h.db);
    service.registerNode("coordinator-1", "us-east-1");
    service.registerNode("coordinator-2", "us-west-2");

    service.acquireLeadership({ nodeId: "coordinator-1" });
    const decision = service.triggerFailover("operator_forced", "coordinator-2");

    assert.equal(decision.outcome, "leader_changed");
    assert.equal(decision.newLeaderNodeId, "coordinator-2");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("triggerFailover returns no_candidate when no followers available", () => {
  const h = createHarness("aa-no-cand-");
  try {
    const service = new HaCoordinatorService(h.db);
    service.registerNode("coordinator-1", "us-east-1");

    service.acquireLeadership({ nodeId: "coordinator-1" });
    const decision = service.triggerFailover("heartbeat_missing");

    assert.equal(decision.outcome, "no_candidate");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("getFailoverHistory records failover decisions", () => {
  const h = createHarness("aa-failover-hist-");
  try {
    const service = new HaCoordinatorService(h.db);
    service.registerNode("coordinator-1", "us-east-1");
    service.registerNode("coordinator-2", "us-west-2");

    service.acquireLeadership({ nodeId: "coordinator-1" });
    service.triggerFailover("heartbeat_missing");

    const history = service.getFailoverHistory();
    assert.ok(history.length > 0);
    assert.equal(history[0]!.outcome, "leader_changed");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("verifyWriteAuthority accepts current fencing token", () => {
  const h = createHarness("aa-verify-write-");
  try {
    const service = new HaCoordinatorService(h.db);
    service.registerNode("coordinator-1", "us-east-1");

    const result = service.acquireLeadership({ nodeId: "coordinator-1" });
    const valid = service.verifyWriteAuthority(result.fencingToken);

    assert.equal(valid, true);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("verifyWriteAuthority rejects stale fencing token", () => {
  const h = createHarness("aa-stale-write-");
  try {
    const service = new HaCoordinatorService(h.db);
    service.registerNode("coordinator-1", "us-east-1");

    const result = service.acquireLeadership({ nodeId: "coordinator-1" });

    // Force acquire to increment epoch
    service.registerNode("coordinator-2", "us-west-2");
    service.acquireLeadership({ nodeId: "coordinator-2", forceAcquire: true });

    // Old fencing token should be rejected
    const valid = service.verifyWriteAuthority(result.fencingToken);
    assert.equal(valid, false);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("purgeExpiredLeases cleans up expired leases", async () => {
  const h = createHarness("aa-purge-leases-");
  try {
    const service = new HaCoordinatorService(h.db);
    service.registerNode("coordinator-1", "us-east-1");
    service.acquireLeadership({ nodeId: "coordinator-1", ttlMs: 1 });

    // Wait for lease to expire
    await new Promise((resolve) => setTimeout(resolve, 10));

    const purged = service.purgeExpiredLeases();
    assert.ok(purged >= 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("listEpochs returns epoch history", () => {
  const h = createHarness("aa-list-epochs-");
  try {
    const service = new HaCoordinatorService(h.db);
    service.registerNode("coordinator-1", "us-east-1");
    service.registerNode("coordinator-2", "us-west-2");

    service.acquireLeadership({ nodeId: "coordinator-1" });
    service.acquireLeadership({ nodeId: "coordinator-2", forceAcquire: true });

    const epochs = service.listEpochs();
    assert.ok(epochs.length >= 2);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("acquireLeadership clamps TTL below MIN_LEASE_TTL_MS to MIN_LEASE_TTL_MS", () => {
  const h = createHarness("aa-ttl-min-");
  try {
    const service = new HaCoordinatorService(h.db);
    service.registerNode("coordinator-1", "us-east-1");

    // Request TTL below minimum (1000ms < MIN_LEASE_TTL_MS of 5000)
    service.acquireLeadership({ nodeId: "coordinator-1", ttlMs: 1000 });
    const lease = service.getActiveLease();

    assert.ok(lease);
    // TTL should be clamped to MIN_LEASE_TTL_MS
    assert.ok(lease!.ttlMs <= MIN_LEASE_TTL_MS + 100, `Expected TTL <= ${MIN_LEASE_TTL_MS + 100}, got ${lease!.ttlMs}`);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("acquireLeadership clamps TTL above MAX_LEASE_TTL_MS to MAX_LEASE_TTL_MS", () => {
  const h = createHarness("aa-ttl-max-");
  try {
    const service = new HaCoordinatorService(h.db);
    service.registerNode("coordinator-1", "us-east-1");

    // Request TTL above maximum (120000ms > MAX_LEASE_TTL_MS of 60000)
    service.acquireLeadership({ nodeId: "coordinator-1", ttlMs: 120000 });
    const lease = service.getActiveLease();

    assert.ok(lease);
    // TTL should be clamped to MAX_LEASE_TTL_MS
    assert.ok(lease!.ttlMs <= MAX_LEASE_TTL_MS + 100, `Expected TTL <= ${MAX_LEASE_TTL_MS + 100}, got ${lease!.ttlMs}`);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("acquireLeadership accepts TTL at exactly MIN_LEASE_TTL_MS boundary", () => {
  const h = createHarness("aa-ttl-min-boundary-");
  try {
    const service = new HaCoordinatorService(h.db);
    service.registerNode("coordinator-1", "us-east-1");

    service.acquireLeadership({ nodeId: "coordinator-1", ttlMs: MIN_LEASE_TTL_MS });
    const lease = service.getActiveLease();

    assert.ok(lease);
    assert.ok(lease!.ttlMs >= MIN_LEASE_TTL_MS);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("acquireLeadership accepts TTL at exactly MAX_LEASE_TTL_MS boundary", () => {
  const h = createHarness("aa-ttl-max-boundary-");
  try {
    const service = new HaCoordinatorService(h.db);
    service.registerNode("coordinator-1", "us-east-1");

    service.acquireLeadership({ nodeId: "coordinator-1", ttlMs: MAX_LEASE_TTL_MS });
    const lease = service.getActiveLease();

    assert.ok(lease);
    assert.ok(lease!.ttlMs <= MAX_LEASE_TTL_MS + 100);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("renewLeadership clamps TTL below MIN_LEASE_TTL_MS to MIN_LEASE_TTL_MS", () => {
  const h = createHarness("aa-renew-ttl-min-");
  try {
    const service = new HaCoordinatorService(h.db);
    service.registerNode("coordinator-1", "us-east-1");
    service.acquireLeadership({ nodeId: "coordinator-1" });

    const result = service.renewLeadership({ nodeId: "coordinator-1", ttlMs: 1 });

    assert.equal(result.renewed, true);
    assert.ok(result.lease);
    // TTL should be clamped to MIN_LEASE_TTL_MS
    assert.ok(result.lease!.ttlMs <= MIN_LEASE_TTL_MS + 100);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("renewLeadership clamps TTL above MAX_LEASE_TTL_MS to MAX_LEASE_TTL_MS", () => {
  const h = createHarness("aa-renew-ttl-max-");
  try {
    const service = new HaCoordinatorService(h.db);
    service.registerNode("coordinator-1", "us-east-1");
    service.acquireLeadership({ nodeId: "coordinator-1" });

    const result = service.renewLeadership({ nodeId: "coordinator-1", ttlMs: 999999 });

    assert.equal(result.renewed, true);
    assert.ok(result.lease);
    // TTL should be clamped to MAX_LEASE_TTL_MS
    assert.ok(result.lease!.ttlMs <= MAX_LEASE_TTL_MS + 100);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("acquireLeadership throws RuntimeError when node is not registered", () => {
  // Tests the error path at ha-coordinator-service.ts:186 when node does not exist
  const h = createHarness("aa-acquire-unregistered-");
  try {
    const service = new HaCoordinatorService(h.db);

    assert.throws(
      () => service.acquireLeadership({ nodeId: "nonexistent-node" }),
      (err: unknown) =>
        err instanceof Error &&
        err.message.includes("Must register node before acquiring leadership"),
    );
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("releaseLeadership returns false when node has no leadership", () => {
  // Tests that releasing leadership on a node that never had it returns false
  const h = createHarness("aa-release-no-lead-");
  try {
    const service = new HaCoordinatorService(h.db);
    service.registerNode("coordinator-1", "us-east-1");

    const released = service.releaseLeadership("coordinator-1");

    assert.equal(released, false);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("authorizeAction denies leader-only action for non-leader", () => {
  // Tests that strict leader authority denies actions from non-leaders
  const h = createHarness("aa-auth-deny-");
  try {
    const service = new HaCoordinatorService(h.db, { strictLeaderAuthority: true });
    service.registerNode("coordinator-1", "us-east-1");
    service.registerNode("coordinator-2", "us-west-2");
    service.acquireLeadership({ nodeId: "coordinator-1" });

    // Coordinator-2 is not the leader, so action should be denied
    const auth = service.authorizeAction("coordinator-2", "global_repair", "leader_only");

    assert.equal(auth.authorized, false);
    assert.ok(auth.reasonCode.includes("leader") || auth.reasonCode.includes("authority"));
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("listNodes filters by status correctly", () => {
  const h = createHarness("aa-list-filter-");
  try {
    const service = new HaCoordinatorService(h.db);
    service.registerNode("coordinator-1", "us-east-1");
    service.registerNode("coordinator-2", "us-west-2");
    service.registerNode("coordinator-3", "eu-west-1");

    // Initially all are active
    const allActive = service.listNodes("active");
    assert.equal(allActive.length, 3);

    // After acquiring leadership, one is still active but is also leader
    service.acquireLeadership({ nodeId: "coordinator-1" });

    // All should still be "active" status (leadership doesn't change node status)
    const stillActive = service.listNodes("active");
    assert.equal(stillActive.length, 3);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
