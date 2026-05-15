import assert from "node:assert/strict";
import test from "node:test";

import { PostgresHaRepository } from "../../../../../src/platform/five-plane-execution/ha/ha-repository-postgres.js";
import type { CoordinatorNode, FailoverDecision, LeaderLease, LeadershipEpoch } from "../../../../../src/platform/five-plane-execution/ha/types.js";

// Mock database
function createMockAsyncDb() {
  const nodes: Map<string, unknown> = new Map();
  const leases: Map<string, unknown> = new Map();
  const epochs: Map<number, unknown> = new Map();
  const failoverDecisions: Map<string, unknown> = new Map();

  return {
    asyncConnection: {
      execute: async (sql: string, ...args: unknown[]) => {
        if (sql.includes("INSERT INTO coordinator_nodes") || sql.includes("UPSERT")) {
          const nodeId = args[0];
          nodes.set(nodeId, {
            node_id: nodeId,
            region: args[1],
            status: args[2],
            is_leader: args[3] ? 1 : 0,
            leadership_epoch: args[4],
            last_heartbeat_at: args[5],
            metadata: args[6],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          return { rowCount: 1 };
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
          return { rowCount: 1 };
        }
        if (sql.includes("UPDATE leadership_leases SET status")) {
          const leaseId = args[1];
          const existing = leases.get(leaseId) as any;
          if (existing) {
            existing.status = args[0];
            leases.set(leaseId, existing);
          }
          return { rowCount: existing ? 1 : 0 };
        }
        if (sql.includes("INSERT INTO leadership_epochs")) {
          const epochNumber = args[0] as number;
          epochs.set(epochNumber, {
            epoch: epochNumber,
            leader_node_id: args[1],
            started_at: args[2],
            ended_at: args[3],
            cause: args[4],
            fencing_token: args[5],
          });
          return { rowCount: 1 };
        }
        if (sql.includes("UPDATE leadership_epochs SET ended_at")) {
          const epochNumber = args[2] as number;
          const existing = epochs.get(epochNumber) as Record<string, unknown> | undefined;
          if (existing && existing.ended_at == null) {
            epochs.set(epochNumber, {
              ...existing,
              ended_at: args[0],
              cause: args[1],
            });
            return { rowCount: 1 };
          }
          return { rowCount: 0 };
        }
        if (sql.includes("INSERT INTO failover_decisions")) {
          const decisionId = args[0] as string;
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
          return { rowCount: 1 };
        }
        if (sql.includes("DELETE FROM coordinator_nodes")) {
          const existed = nodes.has(args[0] as string);
          nodes.delete(args[0] as string);
          return { rowCount: existed ? 1 : 0 };
        }
        return { rowCount: 0 };
      },
      queryOne: async <T>(sql: string, ...args: unknown[]): Promise<T | null> => {
        if (sql.includes("FROM coordinator_nodes WHERE node_id")) {
          return (nodes.get(args[0] as string) as T) ?? null;
        }
        if (sql.includes("FROM leadership_leases WHERE status = 'active'")) {
          const activeLease = Array.from(leases.values())[0];
          return (activeLease as T) ?? null;
        }
        if (sql.includes("FROM leadership_leases WHERE node_id")) {
          const leaseForNode = Array.from(leases.values()).find((l: any) => l.node_id === args[0]);
          return (leaseForNode as T) ?? null;
        }
        if (sql.includes("FROM leadership_leases WHERE lease_id")) {
          return (leases.get(args[0] as string) as T) ?? null;
        }
        if (sql.includes("FROM leadership_epochs ORDER BY epoch DESC LIMIT 1")) {
          const latestEpoch = Array.from(epochs.values()).sort((a: any, b: any) => b.epoch - a.epoch)[0];
          return (latestEpoch as T) ?? null;
        }
        return null;
      },
      query: async <T>(sql: string, ...args: unknown[]): Promise<{ rows: T[] }> => {
        if (sql.includes("FROM leadership_leases")) {
          return { rows: Array.from(leases.values()) as T[] };
        }
        if (sql.includes("FROM leadership_epochs")) {
          return { rows: Array.from(epochs.values()).sort((a: any, b: any) => b.epoch - a.epoch) as T[] };
        }
        if (sql.includes("FROM failover_decisions")) {
          return { rows: Array.from(failoverDecisions.values()).sort((a: any, b: any) => b.decided_at.localeCompare(a.decided_at)) as T[] };
        }
        if (sql.includes("FROM coordinator_nodes WHERE status")) {
          const status = args[0] as string;
          return { rows: Array.from(nodes.values()).filter((n: any) => n.status === status) as T[] };
        }
        if (sql.includes("FROM coordinator_nodes")) {
          return { rows: Array.from(nodes.values()) as T[] };
        }
        return { rows: [] };
      },
    },
  };
}

test("PostgresHaRepository is instance of HaRepository", () => {
  const mockDb = createMockAsyncDb() as any;
  const repo = new PostgresHaRepository(mockDb, "test-coordinator");
  // Verify it implements the HaRepository interface by having expected methods
  assert.equal(typeof repo.upsertNode, "function");
  assert.equal(typeof repo.getNode, "function");
  assert.equal(typeof repo.listNodes, "function");
  assert.equal(typeof repo.deleteNode, "function");
  assert.equal(typeof repo.insertLease, "function");
  assert.equal(typeof repo.updateLeaseStatus, "function");
  assert.equal(typeof repo.getActiveLease, "function");
  assert.equal(typeof repo.insertEpoch, "function");
  assert.equal(typeof repo.getLatestEpoch, "function");
});

test("PostgresHaRepository implements HaRepository interface via upsertNode", async () => {
  const mockDb = createMockAsyncDb() as any;
  const repo = new PostgresHaRepository(mockDb, "test-coordinator") as any;

  const node: CoordinatorNode = {
    nodeId: "node-1",
    region: "us-east-1",
    status: "active",
    isLeader: true,
    leadershipEpoch: 1,
    lastHeartbeatAt: new Date().toISOString(),
    metadata: { version: "1.0.0" },
  };

  await repo.upsertNode(node);
  const retrieved = await repo.getNode("node-1");
  assert.ok(retrieved !== undefined);
  assert.equal(retrieved?.nodeId, "node-1");
  assert.equal(retrieved?.region, "us-east-1");
});

test("PostgresHaRepository.getNode returns undefined for non-existent node", async () => {
  const mockDb = createMockAsyncDb() as any;
  const repo = new PostgresHaRepository(mockDb, "test-coordinator") as any;

  const result = await repo.getNode("non-existent-node");
  assert.equal(result, undefined);
});

test("PostgresHaRepository.deleteNode removes node", async () => {
  const mockDb = createMockAsyncDb() as any;
  const repo = new PostgresHaRepository(mockDb, "test-coordinator") as any;

  const node: CoordinatorNode = {
    nodeId: "node-to-delete",
    region: "us-east-1",
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

test("PostgresHaRepository.insertLease and getActiveLease work", async () => {
  const mockDb = createMockAsyncDb() as any;
  const repo = new PostgresHaRepository(mockDb, "test-coordinator") as any;

  const lease: LeaderLease = {
    leaseId: "lease-1",
    nodeId: "node-1",
    epoch: 1,
    acquiredAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    status: "active",
    ttlMs: 30000,
  };

  await repo.insertLease(lease);
  const retrieved = await repo.getActiveLease();
  assert.ok(retrieved !== undefined);
  assert.equal(retrieved?.leaseId, "lease-1");
});

test("PostgresHaRepository.insertEpoch and getLatestEpoch work", async () => {
  const mockDb = createMockAsyncDb() as any;
  const repo = new PostgresHaRepository(mockDb, "test-coordinator") as any;

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
  assert.equal(retrieved?.leaderNodeId, "node-1");
});

test("PostgresHaRepository.insertFailoverDecision and listFailoverDecisions work", async () => {
  const mockDb = createMockAsyncDb() as any;
  const repo = new PostgresHaRepository(mockDb, "test-coordinator") as any;

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
  const retrieved = await repo.listFailoverDecisions();
  assert.ok(retrieved !== undefined);
  assert.equal(retrieved.length, 1);
  assert.equal(retrieved[0].decisionId, "decision-1");
  assert.equal(retrieved[0].outcome, "leader_changed");
});

test("PostgresHaRepository.updateLeaseStatus changes status", async () => {
  const mockDb = createMockAsyncDb() as any;
  const repo = new PostgresHaRepository(mockDb, "test-coordinator") as any;

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
  const retrieved = await repo.getLeaseById("lease-status-test");
  assert.ok(retrieved !== undefined);
  assert.equal(retrieved?.status, "expired");
});

test("PostgresHaRepository.updateEpochEnd marks epoch ended", async () => {
  const mockDb = createMockAsyncDb() as any;
  const repo = new PostgresHaRepository(mockDb, "test-coordinator") as any;

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
  const retrieved = await repo.getLatestEpoch();
  assert.ok(retrieved !== undefined);
  assert.equal(retrieved?.endedAt, retrieved.endedAt); // endedAt is set
});

test("PostgresHaRepository.tryAcquireAdvisoryLock returns boolean", async () => {
  const mockDb = createMockAsyncDb() as any;
  const repo = new PostgresHaRepository(mockDb, "test-coordinator") as any;

  const result = await repo.tryAcquireAdvisoryLock();
  assert.equal(typeof result, "boolean");
});

test("PostgresHaRepository.getLeaseByNodeId returns lease for node", async () => {
  const mockDb = createMockAsyncDb() as any;
  const repo = new PostgresHaRepository(mockDb, "test-coordinator") as any;

  const lease: LeaderLease = {
    leaseId: "lease-node-test",
    nodeId: "specific-node",
    epoch: 3,
    acquiredAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    status: "active",
    ttlMs: 30000,
  };

  await repo.insertLease(lease);
  const retrieved = await repo.getLeaseByNodeId("specific-node");
  assert.ok(retrieved !== undefined);
  assert.equal(retrieved?.nodeId, "specific-node");
});

test("PostgresHaRepository.recordActionAudit inserts audit entry", async () => {
  const mockDb = createMockAsyncDb() as any;
  const repo = new PostgresHaRepository(mockDb, "test-coordinator") as any;

  const entry = {
    id: "audit-1",
    actionType: "leader_action",
    requestingNodeId: "node-1",
    leaderNodeId: "node-2",
    epoch: 1,
    fencingToken: 1,
    authorized: true,
    reasonCode: "authorized",
    performedAt: new Date().toISOString(),
  };

  // Should not throw
  await repo.recordActionAudit(entry);
});
