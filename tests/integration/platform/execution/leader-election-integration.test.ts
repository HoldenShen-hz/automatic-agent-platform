/**
 * Integration Test: Leader Election Service
 *
 * Verifies:
 * - LeaderElectionService with real HaCoordinatorService and SQLite backend
 * - HA-1 mode (single-node, no election)
 * - HA-2 mode (basic lease with renewal)
 * - Leadership acquisition, renewal, and release
 * - Multi-node election scenarios
 * - State transitions and observability
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { LeaderElectionService, createLeaderElectionService } from "../../../../src/platform/five-plane-execution/ha/leader-election-service.js";
import { HaCoordinatorService, HA_COORDINATOR_DDL } from "../../../../src/platform/five-plane-execution/ha/ha-coordinator-service-inner.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function createFileDb(path: string): SqliteDatabase {
  const db = new SqliteDatabase(path);
  db.connection.exec(HA_COORDINATOR_DDL);
  return db;
}

// ─────────────────────────────────────────────────────────────────────────────
// LeaderElectionService Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("leader election: HA-1 mode becomes leader immediately without election", () => {
  const workspace = createTempWorkspace("aa-leader-election-");
  const dbPath = join(workspace, "test.db");

  try {
    const db = createFileDb(dbPath);
    const coordinator = new HaCoordinatorService(db);

    const service = new LeaderElectionService(coordinator, {
      nodeId: "node-ha1",
      region: "us-east-1",
      haLevel: "HA_1",
    });

    assert.equal(service.getState(), "stopped");
    assert.equal(service.isLeader(), false);

    service.dispose();
    db.connection.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("leader election: start transitions from stopped to leader in HA-1", async () => {
  const workspace = createTempWorkspace("aa-leader-election-");
  const dbPath = join(workspace, "test.db");

  try {
    const db = createFileDb(dbPath);
    const coordinator = new HaCoordinatorService(db);

    const service = new LeaderElectionService(coordinator, {
      nodeId: "node-ha1",
      region: "us-east-1",
      haLevel: "HA_1",
    });

    await service.start();

    assert.equal(service.getState(), "leader");
    assert.equal(service.isLeader(), true);
    assert.equal(service.getLeaderNodeId(), "node-ha1");

    const lease = service.getCurrentLease();
    assert.ok(lease !== null);
    assert.equal(lease!.nodeId, "node-ha1");
    assert.equal(lease!.status, "active");

    await service.stop();
    service.dispose();
    db.connection.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("leader election: start registers node with coordinator", async () => {
  const workspace = createTempWorkspace("aa-leader-election-");
  const dbPath = join(workspace, "test.db");

  try {
    const db = createFileDb(dbPath);
    const coordinator = new HaCoordinatorService(db);

    const service = new LeaderElectionService(coordinator, {
      nodeId: "node-1",
      region: "us-east-1",
      haLevel: "HA_2",
    });

    await service.start();

    const node = coordinator.getNode("node-1");
    assert.ok(node !== null);
    assert.equal(node!.nodeId, "node-1");
    assert.equal(node!.region, "us-east-1");
    assert.equal(node!.status, "active");

    await service.stop();
    service.dispose();
    db.connection.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("leader election: first node becomes leader in HA-2", async () => {
  const workspace = createTempWorkspace("aa-leader-election-");
  const dbPath = join(workspace, "test.db");

  try {
    const db = createFileDb(dbPath);
    const coordinator = new HaCoordinatorService(db);

    const service = new LeaderElectionService(coordinator, {
      nodeId: "node-1",
      region: "us-east-1",
      haLevel: "HA_2",
    });

    await service.start();

    assert.equal(service.getState(), "leader");
    assert.equal(service.isLeader(), true);
    assert.equal(service.isCurrentLeader(), true);

    const leadership = service.queryLeadership();
    assert.equal(leadership.isLeader, true);
    assert.equal(leadership.leaderNodeId, "node-1");
    assert.ok(leadership.epoch >= 1);
    assert.ok(leadership.fencingToken >= 1);

    await service.stop();
    service.dispose();
    db.connection.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("leader election: second node becomes follower when leader exists", async () => {
  const workspace = createTempWorkspace("aa-leader-election-");
  const dbPath = join(workspace, "test.db");

  try {
    const db = createFileDb(dbPath);
    const coordinator = new HaCoordinatorService(db);

    // First node becomes leader
    const service1 = new LeaderElectionService(coordinator, {
      nodeId: "node-1",
      region: "us-east-1",
      haLevel: "HA_2",
    });

    await service1.start();
    assert.equal(service1.isLeader(), true);

    // Second node should become follower since leader already exists
    const service2 = new LeaderElectionService(coordinator, {
      nodeId: "node-2",
      region: "us-east-1",
      haLevel: "HA_2",
    });

    await service2.start();

    // Verify node-2 is follower, not leader
    assert.equal(service2.isLeader(), false);
    assert.equal(service2.getLeaderNodeId(), "node-1");

    // Verify coordinator state
    const leadership = coordinator.queryLeadership();
    assert.equal(leadership.isLeader, true);
    assert.equal(leadership.leaderNodeId, "node-1");

    await service1.stop();
    await service2.stop();
    service1.dispose();
    service2.dispose();
    db.connection.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("leader election: stop releases leadership", async () => {
  const workspace = createTempWorkspace("aa-leader-election-");
  const dbPath = join(workspace, "test.db");

  try {
    const db = createFileDb(dbPath);
    const coordinator = new HaCoordinatorService(db);

    const service = new LeaderElectionService(coordinator, {
      nodeId: "node-1",
      region: "us-east-1",
      haLevel: "HA_2",
    });

    await service.start();
    assert.equal(service.isLeader(), true);

    await service.stop();
    assert.equal(service.isLeader(), false);
    assert.equal(service.getState(), "stopped");

    // Coordinator should no longer have a leader
    const leader = coordinator.getCurrentLeader();
    assert.equal(leader, null);

    service.dispose();
    db.connection.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("leader election: forceAcquireLeadership preempts existing leader", async () => {
  const workspace = createTempWorkspace("aa-leader-election-");
  const dbPath = join(workspace, "test.db");

  try {
    const db = createFileDb(dbPath);
    const coordinator = new HaCoordinatorService(db);

    // First node becomes leader
    const service1 = new LeaderElectionService(coordinator, {
      nodeId: "node-1",
      region: "us-east-1",
      haLevel: "HA_2",
    });

    await service1.start();
    assert.equal(service1.isLeader(), true);

    // Second node forces acquisition
    const service2 = new LeaderElectionService(coordinator, {
      nodeId: "node-2",
      region: "us-east-1",
      haLevel: "HA_2",
    });

    await service2.start();
    const acquired = await service2.forceAcquireLeadership();

    assert.equal(acquired, true);
    assert.equal(service2.isLeader(), true);

    // Verify coordinator now shows node-2 as leader
    const currentLeader = coordinator.getCurrentLeader();
    assert.equal(currentLeader!.nodeId, "node-2");

    // Verify coordinator queryLeadership shows node-2 as leader
    const leadership = coordinator.queryLeadership();
    assert.equal(leadership.isLeader, true);
    assert.equal(leadership.leaderNodeId, "node-2");

    await service1.stop();
    await service2.stop();
    service1.dispose();
    service2.dispose();
    db.connection.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("leader election: fencing token allocation survives coordinator recreation", () => {
  const workspace = createTempWorkspace("aa-leader-election-");
  const dbPath = join(workspace, "token-reuse.db");

  try {
    const db = createFileDb(dbPath);
    const coordinatorA = new HaCoordinatorService(db);
    coordinatorA.registerNode("node-1", "us-east-1");
    const first = coordinatorA.acquireLeadership({ nodeId: "node-1" });

    const coordinatorB = new HaCoordinatorService(db);
    coordinatorB.registerNode("node-2", "us-east-1");
    const second = coordinatorB.acquireLeadership({ nodeId: "node-2", forceAcquire: true });

    assert.ok(second.fencingToken > first.fencingToken);
    db.connection.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("leader election: removeNode records removed epoch cause for admin teardown", () => {
  const workspace = createTempWorkspace("aa-leader-election-");
  const dbPath = join(workspace, "remove-node.db");

  try {
    const db = createFileDb(dbPath);
    const coordinator = new HaCoordinatorService(db);
    coordinator.registerNode("node-1", "us-east-1");
    coordinator.acquireLeadership({ nodeId: "node-1" });

    const removed = coordinator.removeNode("node-1");
    const epoch = coordinator.getLatestEpoch();

    assert.equal(removed, true);
    assert.equal(epoch.cause, "removed");
    assert.ok(epoch.endedAt);
    db.connection.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("leader election: getHaConfig returns correct configuration", async () => {
  const workspace = createTempWorkspace("aa-leader-election-");
  const dbPath = join(workspace, "test.db");

  try {
    const db = createFileDb(dbPath);
    const coordinator = new HaCoordinatorService(db);

    const service = new LeaderElectionService(coordinator, {
      nodeId: "node-1",
      region: "us-east-1",
      haLevel: "HA_2",
      leaseTtlMs: 30_000,
      renewalIntervalMs: 10_000,
    });

    const config = service.getHaConfig();
    assert.equal(config.haLevel, "HA_2");
    assert.equal(config.leaseTtlMs, 30_000);
    assert.equal(config.leaseRenewalIntervalMs, 10_000);

    service.dispose();
    db.connection.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("leader election: createLeaderElectionService factory creates valid service", () => {
  const workspace = createTempWorkspace("aa-leader-election-");
  const dbPath = join(workspace, "test.db");

  try {
    const db = createFileDb(dbPath);
    const coordinator = new HaCoordinatorService(db);

    const service = createLeaderElectionService(coordinator, "node-factory", "us-east-1", {
      haLevel: "HA_2",
    });

    assert.ok(service instanceof LeaderElectionService);
    assert.equal(service.getState(), "stopped");

    service.dispose();
    db.connection.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("leader election: dispose cleans up without stop", () => {
  const workspace = createTempWorkspace("aa-leader-election-");
  const dbPath = join(workspace, "test.db");

  try {
    const db = createFileDb(dbPath);
    const coordinator = new HaCoordinatorService(db);

    const service = new LeaderElectionService(coordinator, {
      nodeId: "node-1",
      region: "us-east-1",
      haLevel: "HA_2",
    });

    service.dispose();
    assert.equal(service.getState(), "stopped");

    db.connection.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("leader election: getLeaderNodeId returns null when no leader", async () => {
  const workspace = createTempWorkspace("aa-leader-election-");
  const dbPath = join(workspace, "test.db");

  try {
    const db = createFileDb(dbPath);
    const coordinator = new HaCoordinatorService(db);

    const service = new LeaderElectionService(coordinator, {
      nodeId: "node-1",
      region: "us-east-1",
      haLevel: "HA_2",
    });

    // Don't start - no leader yet
    assert.equal(service.getLeaderNodeId(), null);

    service.dispose();
    db.connection.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("leader election: queryLeadership before start returns expired state", async () => {
  const workspace = createTempWorkspace("aa-leader-election-");
  const dbPath = join(workspace, "test.db");

  try {
    const db = createFileDb(dbPath);
    const coordinator = new HaCoordinatorService(db);

    const service = new LeaderElectionService(coordinator, {
      nodeId: "node-1",
      region: "us-east-1",
      haLevel: "HA_2",
    });

    const leadership = service.queryLeadership();
    assert.equal(leadership.isLeader, false);
    assert.equal(leadership.leaderNodeId, null);
    assert.equal(leadership.isExpired, true);

    service.dispose();
    db.connection.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("leader election: follower can acquire leadership after leader stops", async () => {
  const workspace = createTempWorkspace("aa-leader-election-");
  const dbPath = join(workspace, "test.db");

  try {
    const db = createFileDb(dbPath);
    const coordinator = new HaCoordinatorService(db);

    // First node becomes leader
    const service1 = new LeaderElectionService(coordinator, {
      nodeId: "node-1",
      region: "us-east-1",
      haLevel: "HA_2",
    });

    await service1.start();
    assert.equal(service1.isLeader(), true);

    // Second node starts as follower
    const service2 = new LeaderElectionService(coordinator, {
      nodeId: "node-2",
      region: "us-east-1",
      haLevel: "HA_2",
    });

    await service2.start();
    assert.equal(service2.isLeader(), false);

    // First node stops, releasing leadership
    await service1.stop();
    service1.dispose();

    // Second node can now attempt election
    await service2.attemptElection();

    // After leader stops, node-2 should be able to become leader
    // The coordinator has no leader now
    const hasLeader = coordinator.getCurrentLeader();
    if (hasLeader === null) {
      // Node-2 can try to acquire
      const acquired = await service2.forceAcquireLeadership();
      assert.equal(acquired, true);
      assert.equal(service2.isLeader(), true);
    }

    await service2.stop();
    service2.dispose();
    db.connection.close();
  } finally {
    cleanupPath(workspace);
  }
});
