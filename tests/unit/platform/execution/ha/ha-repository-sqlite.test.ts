import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SqliteHaRepository } from "../../../../../src/platform/execution/ha/ha-repository-sqlite.js";
import { HA_COORDINATOR_DDL, type CoordinatorNode, type FailoverDecision, type LeaderLease, type LeadershipEpoch } from "../../../../../src/platform/execution/ha/types.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

// Mock SQLite database
function createMockSqliteDb() {
  const nodes: Map<string, unknown> = new Map();
  const leases: Map<string, unknown> = new Map();
  const epochs: Map<number, unknown> = new Map();
  const failoverDecisions: Map<string, unknown> = new Map();

  return {
    connection: {
      prepare: (sql: string) => ({
        run: (...args: unknown[]) => {
          if (sql.includes("INSERT OR REPLACE INTO coordinator_nodes")) {
            const nodeId = args[0];
            nodes.set(nodeId, {
              node_id: nodeId,
              region: args[1],
              status: args[2],
              is_leader: args[3],
              leadership_epoch: args[4],
              last_heartbeat_at: args[5],
              metadata: args[6],
              created_at: args[7],
              updated_at: args[8],
            });
            return { changes: 1 };
          }
          if (sql.includes("DELETE FROM coordinator_nodes")) {
            const existed = nodes.has(args[0] as string);
            nodes.delete(args[0] as string);
            return { changes: existed ? 1 : 0 };
          }
          if (sql.includes("INSERT INTO leadership_leases")) {
            const leaseId = args[0];
            leases.set(leaseId, {
              lease_id: leaseId,
              node_id: args[1],
              epoch: args[2],
              acquired_at: args[3],
              expires_at: args[4],
              status: args[5],
              ttl_ms: args[6],
              fencing_token: 0,
            });
            return { changes: 1 };
          }
          if (sql.includes("UPDATE leadership_leases SET status")) {
            const status = args[0];
            const leaseId = args[1];
            const existing = leases.get(leaseId) as any;
            if (existing) {
              existing.status = status;
              leases.set(leaseId, existing);
            }
            return { changes: existing ? 1 : 0 };
          }
          if (sql.includes("UPDATE leadership_epochs SET ended_at")) {
            const endedAt = args[0];
            const cause = args[1];
            const epochNum = args[2];
            const existing = epochs.get(epochNum as number) as any;
            if (existing) {
              existing.ended_at = endedAt;
              existing.cause = cause;
              epochs.set(epochNum as number, existing);
            }
            return { changes: existing ? 1 : 0 };
          }
          if (sql.includes("INSERT INTO leadership_epochs")) {
            const epoch = args[0] as number;
            epochs.set(epoch, {
              epoch: epoch,
              leader_node_id: args[1],
              started_at: args[2],
              ended_at: args[3],
              cause: args[4],
              fencing_token: args[5],
            });
            return { changes: 1 };
          }
          if (sql.includes("INSERT INTO failover_decisions")) {
            const decisionId = args[0];
            failoverDecisions.set(decisionId, {
              decision_id: decisionId,
              old_leader_node_id: args[1],
              new_leader_node_id: args[2],
              epoch: args[3],
              cause: args[4],
              outcome: args[5],
              decided_at: args[6],
              fencing_token: args[7],
            });
            return { changes: 1 };
          }
          return { changes: 0 };
        },
        get: (...args: unknown[]) => {
          if (sql.includes("WHERE node_id")) {
            return nodes.get(args[0] as string) ?? undefined;
          }
          if (sql.includes("WHERE status = 'active' AND expires_at")) {
            const now = args[0] as string;
            return Array.from(leases.values()).find((l: any) => l.status === "active" && l.expires_at > now) ?? undefined;
          }
          if (sql.includes("WHERE node_id") && sql.includes("status = 'active'")) {
            return Array.from(leases.values()).find((l: any) => l.node_id === args[0] && l.status === "active") ?? undefined;
          }
          if (sql.includes("WHERE lease_id")) {
            return leases.get(args[0] as string) ?? undefined;
          }
          if (sql.includes("ORDER BY epoch DESC LIMIT 1")) {
            return Array.from(epochs.values()).sort((a: any, b: any) => b.epoch - a.epoch)[0] ?? undefined;
          }
          return undefined;
        },
        all: (...args: unknown[]) => {
          if (sql.includes("WHERE status = 'active' AND expires_at")) {
            return Array.from(leases.values()).filter((l: any) => l.status === "active" && l.expires_at <= args[0]);
          }
          if (sql.includes("ORDER BY epoch DESC LIMIT")) {
            const limit = args[0] as number;
            return Array.from(epochs.values()).sort((a: any, b: any) => b.epoch - a.epoch).slice(0, limit);
          }
          if (sql.includes("ORDER BY decided_at DESC LIMIT")) {
            const limit = args[0] as number;
            return Array.from(failoverDecisions.values())
              .sort((a: any, b: any) => b.decided_at.localeCompare(a.decided_at))
              .slice(0, limit);
          }
          if (sql.includes("WHERE last_heartbeat_at")) {
            const threshold = args[0] as string;
            return Array.from(nodes.values()).filter((n: any) => n.last_heartbeat_at < threshold);
          }
          return [];
        },
      }),
    },
  };
}

test("SqliteHaRepository implements HaRepository interface via upsertNode", () => {
  const mockDb = createMockSqliteDb() as any;
  const repo = new SqliteHaRepository(mockDb);

  assert.equal(typeof repo.upsertNode, "function");
  assert.equal(typeof repo.getNode, "function");
  assert.equal(typeof repo.listNodes, "function");
  assert.equal(typeof repo.deleteNode, "function");
  assert.equal(typeof repo.insertLease, "function");
  assert.equal(typeof repo.updateLeaseStatus, "function");
});

test("SqliteHaRepository.upsertNode and getNode work", async () => {
  const mockDb = createMockSqliteDb() as any;
  const repo = new SqliteHaRepository(mockDb) as any;

  const node: CoordinatorNode = {
    nodeId: "sqlite-node-1",
    region: "us-west-1",
    status: "active",
    isLeader: true,
    leadershipEpoch: 1,
    lastHeartbeatAt: new Date().toISOString(),
    metadata: { version: "1.0.0" },
  };

  await repo.upsertNode(node);
  const retrieved = await repo.getNode("sqlite-node-1");
  assert.ok(retrieved !== undefined);
  assert.equal(retrieved?.nodeId, "sqlite-node-1");
  assert.equal(retrieved?.region, "us-west-1");
});

test("SqliteHaRepository.getNode returns undefined for non-existent node", async () => {
  const mockDb = createMockSqliteDb() as any;
  const repo = new SqliteHaRepository(mockDb) as any;

  const result = await repo.getNode("non-existent");
  assert.equal(result, undefined);
});

test("SqliteHaRepository.deleteNode removes node", async () => {
  const mockDb = createMockSqliteDb() as any;
  const repo = new SqliteHaRepository(mockDb) as any;

  const node: CoordinatorNode = {
    nodeId: "node-to-delete",
    region: "us-west-1",
    status: "active",
    isLeader: false,
    leadershipEpoch: 0,
    lastHeartbeatAt: new Date().toISOString(),
    metadata: null,
  };

  await repo.upsertNode(node);
  await repo.deleteNode("node-to-delete");
  const result = await repo.getNode("node-to-delete");
  assert.equal(result, undefined);
});

test("SqliteHaRepository.insertLease works", async () => {
  const mockDb = createMockSqliteDb() as any;
  const repo = new SqliteHaRepository(mockDb) as any;

  const lease: LeaderLease = {
    leaseId: "sqlite-lease-1",
    nodeId: "node-1",
    epoch: 1,
    acquiredAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    status: "active",
    ttlMs: 30000,
  };

  await repo.insertLease(lease);
});

test("SqliteHaRepository.updateLeaseStatus changes status", async () => {
  const mockDb = createMockSqliteDb() as any;
  const repo = new SqliteHaRepository(mockDb) as any;

  const lease: LeaderLease = {
    leaseId: "lease-status-test",
    nodeId: "node-1",
    epoch: 1,
    acquiredAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    status: "active",
    ttlMs: 30000,
  };

  await repo.insertLease(lease);
  await repo.updateLeaseStatus("lease-status-test", "expired");
});

test("SqliteHaRepository.insertEpoch and getLatestEpoch work", async () => {
  const mockDb = createMockSqliteDb() as any;
  const repo = new SqliteHaRepository(mockDb) as any;

  const epoch: LeadershipEpoch = {
    epoch: 1,
    leaderNodeId: "node-1",
    startedAt: new Date().toISOString(),
    endedAt: null,
    cause: "acquired",
    fencingToken: 1,
  };

  await repo.insertEpoch(epoch);
  const retrieved = await repo.getLatestEpoch();
  assert.ok(retrieved !== undefined);
  assert.equal(retrieved?.epoch, 1);
});

test("SqliteHaRepository.updateEpochEnd marks epoch ended", async () => {
  const mockDb = createMockSqliteDb() as any;
  const repo = new SqliteHaRepository(mockDb) as any;

  const epoch: LeadershipEpoch = {
    epoch: 5,
    leaderNodeId: "node-1",
    startedAt: new Date().toISOString(),
    endedAt: null,
    cause: "acquired",
    fencingToken: 5,
  };

  await repo.insertEpoch(epoch);
  await repo.updateEpochEnd(5, new Date().toISOString(), "voluntary");
});

test("SqliteHaRepository.insertFailoverDecision works", async () => {
  const mockDb = createMockSqliteDb() as any;
  const repo = new SqliteHaRepository(mockDb) as any;

  const decision: FailoverDecision = {
    decisionId: "decision-1",
    oldLeaderNodeId: "node-1",
    newLeaderNodeId: "node-2",
    epoch: 2,
    cause: "heartbeat_missing",
    outcome: "leader_changed",
    decidedAt: new Date().toISOString(),
    fencingToken: 2,
  };

  await repo.insertFailoverDecision(decision);
  const decisions = await repo.listFailoverDecisions();
  assert.ok(decisions !== undefined);
});

test("SqliteHaRepository.acquireLeadershipAtomically rotates leader state in one transaction", async () => {
  const workspace = createTempWorkspace("ha-sqlite-");
  const dbPath = join(workspace, "ha-coordinator.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.connection.exec(HA_COORDINATOR_DDL);
    const repo = new SqliteHaRepository(db);
    const now = new Date().toISOString();

    await repo.upsertNode({
      nodeId: "node-1",
      region: "cn-sh",
      status: "active",
      isLeader: true,
      leadershipEpoch: 1,
      lastHeartbeatAt: now,
      metadata: null,
    });
    await repo.upsertNode({
      nodeId: "node-2",
      region: "cn-sh",
      status: "active",
      isLeader: false,
      leadershipEpoch: 0,
      lastHeartbeatAt: now,
      metadata: null,
    });
    await repo.insertLease({
      leaseId: "lease-node-1",
      nodeId: "node-1",
      epoch: 1,
      acquiredAt: now,
      expiresAt: new Date(Date.now() + 30_000).toISOString(),
      status: "active",
      ttlMs: 30_000,
    });
    await repo.insertEpoch({
      epoch: 1,
      leaderNodeId: "node-1",
      startedAt: now,
      endedAt: null,
      cause: "acquired",
      fencingToken: 1,
    });

    const result = await repo.acquireLeadershipAtomically({
      nodeId: "node-2",
      ttlMs: 20_000,
      forceAcquire: true,
    });

    assert.equal(result.acquired, true);
    assert.equal(result.lease?.nodeId, "node-2");
    assert.equal((await repo.getNode("node-1"))?.isLeader, false);
    assert.equal((await repo.getNode("node-2"))?.isLeader, true);
    assert.equal((await repo.getLeaseById("lease-node-1"))?.status, "expired");
    assert.equal((await repo.getLatestEpoch())?.leaderNodeId, "node-2");
    assert.equal((await repo.listFailoverDecisions()).length, 1);
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
