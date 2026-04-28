/**
 * Unit Tests: HA Coordinator Service barrel (ha-coordinator-service.ts)
 *
 * Tests that ha-coordinator-service barrel exports correctly from:
 * - ha-coordinator-service-inner.js (HaCoordinatorService, constants, types)
 * - ha-coordinator-factory.js (createHaCoordinatorService, createHaRepositoryForBackend)
 */

import assert from "node:assert/strict";
import { test } from "node:test";

// Import from the barrel file
import {
  HaCoordinatorService,
  // Constants from ha-coordinator-service-inner
  DEFAULT_LEASE_TTL_MS,
  EPOCH_FENCING_TOKEN_START,
  HA_COORDINATOR_DDL,
  MAX_LEASE_TTL_MS,
  MIN_LEASE_TTL_MS,
  // Factory functions
  createHaCoordinatorService,
  createHaRepositoryForBackend,
  // Types (re-exported from ha-coordinator-service-inner)
  type CoordinatorNode,
  type CoordinatorNodeStatus,
  type FailoverDecision,
  type HaCoordinatorServiceOptions,
  type LeaderActionAuthorization,
  type LeaderActionAuthority,
  type LeaderLease,
  type LeadershipAcquisitionInput,
  type LeadershipEpoch,
  type LeadershipQueryResult,
  type LeadershipRenewalInput,
} from "../../../../../src/platform/execution/ha/ha-coordinator-service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Mock Storage Backend Factory
// ─────────────────────────────────────────────────────────────────────────────

function createMockSqliteBackend(): any {
  const nodes = new Map<string, Record<string, unknown>>();

  return {
    driver: "sqlite" as const,
    sql: {
      connection: {
        exec: () => {},
        prepare: (sql: string) => ({
          run: (...args: unknown[]) => {
            if (sql.includes("INSERT OR REPLACE INTO coordinator_nodes")) {
              const nodeId = args[0] as string;
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
            return { changes: 0 };
          },
          get: (...args: unknown[]) => {
            if (sql.includes("FROM coordinator_nodes WHERE node_id = ?")) {
              return nodes.get(args[0] as string);
            }
            return undefined;
          },
          all: (...args: unknown[]) => {
            if (sql.includes("FROM coordinator_nodes WHERE status = ?")) {
              return [...nodes.values()].filter((node) => node.status === args[0]);
            }
            if (sql.includes("FROM coordinator_nodes ORDER BY")) {
              return [...nodes.values()];
            }
            return [];
          },
        }),
      },
      filePath: ":memory:",
      backendType: "sqlite" as const,
      migrate: () => {},
      getSchemaStatus: () => ({
        currentVersion: 1,
        pendingMigrations: 0,
        expectedVersion: 1,
        upToDate: true,
        pendingVersions: [],
        checksumMismatches: false,
      } as any),
      assertSchemaCurrent: () => {},
      integrityCheck: () => [],
      healthCheck: () => Promise.resolve(true),
      transaction: <T>(work: () => T) => work(),
      readTransaction: <T>(work: () => T) => work(),
    },
  };
}

function createMockPostgresBackend(coordinatorId?: string): any {
  return {
    driver: "postgres" as const,
    asyncSql: {
      asyncConnection: {
        execute: async () => 0 as any,
        query: async <T>(
          _sql: string,
          _params?: unknown[],
        ): Promise<{ rows: T[]; rowCount: number }> => ({
          rows: [] as T[],
          rowCount: 0,
        }),
        queryOne: async <T>(
          _sql: string,
          _params?: unknown[],
        ): Promise<T | undefined> => undefined,
      },
    },
    coordinatorId: coordinatorId ?? "test-coord",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Barrel exports factory functions
// ─────────────────────────────────────────────────────────────────────────────

test("ha-coordinator-service exports createHaCoordinatorService", async () => {
  assert.equal(typeof createHaCoordinatorService, "function");
});

test("ha-coordinator-service exports createHaRepositoryForBackend", async () => {
  assert.equal(typeof createHaRepositoryForBackend, "function");
});

test("createHaCoordinatorService and createHaRepositoryForBackend are different functions", async () => {
  assert.notStrictEqual(
    createHaCoordinatorService,
    createHaRepositoryForBackend,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Barrel exports HaCoordinatorService class
// ─────────────────────────────────────────────────────────────────────────────

test("ha-coordinator-service exports HaCoordinatorService class", async () => {
  assert.equal(typeof HaCoordinatorService, "function");
  // Should be instantiable
  const backend = createMockSqliteBackend();
  const service = new HaCoordinatorService(backend.sql);
  assert.ok(service !== null);
});

test("HaCoordinatorService can be instantiated with default options", async () => {
  const backend = createMockSqliteBackend();
  const service = new HaCoordinatorService(backend.sql);
  assert.ok(service !== null);
});

test("HaCoordinatorService can be instantiated with custom options", async () => {
  const backend = createMockSqliteBackend();
  const service = new HaCoordinatorService(backend.sql, {
    defaultTtlMs: 30_000,
    strictLeaderAuthority: false,
  });
  assert.ok(service !== null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Barrel exports constants from ha-coordinator-service-inner
// ─────────────────────────────────────────────────────────────────────────────

test("ha-coordinator-service exports DEFAULT_LEASE_TTL_MS constant", async () => {
  assert.equal(DEFAULT_LEASE_TTL_MS, 15_000);
});

test("ha-coordinator-service exports MIN_LEASE_TTL_MS constant", async () => {
  assert.equal(MIN_LEASE_TTL_MS, 5_000);
});

test("ha-coordinator-service exports MAX_LEASE_TTL_MS constant", async () => {
  assert.equal(MAX_LEASE_TTL_MS, 60_000);
});

test("ha-coordinator-service exports EPOCH_FENCING_TOKEN_START constant", async () => {
  assert.equal(EPOCH_FENCING_TOKEN_START, 1);
});

test("ha-coordinator-service exports HA_COORDINATOR_DDL string", async () => {
  assert.equal(typeof HA_COORDINATOR_DDL, "string");
  assert.ok(HA_COORDINATOR_DDL.length > 0);
  // Should contain the main tables
  assert.ok(HA_COORDINATOR_DDL.includes("coordinator_nodes"));
  assert.ok(HA_COORDINATOR_DDL.includes("leadership_leases"));
  assert.ok(HA_COORDINATOR_DDL.includes("leadership_epochs"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Barrel exports types from ha-coordinator-service-inner
// ─────────────────────────────────────────────────────────────────────────────

test("ha-coordinator-service exports CoordinatorNode type", async () => {
  const node: CoordinatorNode = {
    nodeId: "test-node",
    region: "us-east-1",
    status: "active",
    isLeader: false,
    leadershipEpoch: 0,
    lastHeartbeatAt: new Date().toISOString(),
    metadata: null,
  };
  assert.equal(node.nodeId, "test-node");
  assert.equal(node.region, "us-east-1");
  assert.equal(node.status, "active");
});

test("ha-coordinator-service exports CoordinatorNodeStatus type", async () => {
  const statuses: CoordinatorNodeStatus[] = ["active", "draining", "offline"];
  assert.deepEqual(statuses, ["active", "draining", "offline"]);
});

test("ha-coordinator-service exports LeaderLease type", async () => {
  const lease: LeaderLease = {
    leaseId: "lease-1",
    nodeId: "node-1",
    epoch: 1,
    acquiredAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 15000).toISOString(),
    status: "active",
    ttlMs: 15_000,
  };
  assert.equal(lease.leaseId, "lease-1");
  assert.equal(lease.status, "active");
});

test("ha-coordinator-service exports LeadershipEpoch type", async () => {
  const epoch: LeadershipEpoch = {
    epoch: 1,
    leaderNodeId: "node-1",
    startedAt: new Date().toISOString(),
    endedAt: null,
    cause: "acquired",
    fencingToken: 1,
  };
  assert.equal(epoch.epoch, 1);
  assert.equal(epoch.cause, "acquired");
});

test("ha-coordinator-service exports FailoverDecision type", async () => {
  const decision: FailoverDecision = {
    decisionId: "decision-1",
    oldLeaderNodeId: "node-old",
    newLeaderNodeId: "node-new",
    epoch: 2,
    cause: "heartbeat_missing",
    outcome: "leader_changed",
    decidedAt: new Date().toISOString(),
    fencingToken: 2,
  };
  assert.equal(decision.decisionId, "decision-1");
  assert.equal(decision.outcome, "leader_changed");
});

test("ha-coordinator-service exports LeaderActionAuthority type", async () => {
  const authorities: LeaderActionAuthority[] = [
    "leader_only",
    "follower_allowed",
    "any",
  ];
  assert.deepEqual(authorities, ["leader_only", "follower_allowed", "any"]);
});

test("ha-coordinator-service exports LeadershipAcquisitionInput type", async () => {
  const input: LeadershipAcquisitionInput = {
    nodeId: "node-1",
    ttlMs: 15_000,
    forceAcquire: false,
  };
  assert.equal(input.nodeId, "node-1");
  assert.equal(input.forceAcquire, false);
});

test("ha-coordinator-service exports LeadershipRenewalInput type", async () => {
  const input: LeadershipRenewalInput = {
    nodeId: "node-1",
    ttlMs: 10_000,
  };
  assert.equal(input.nodeId, "node-1");
});

test("ha-coordinator-service exports LeadershipQueryResult type", async () => {
  const result: LeadershipQueryResult = {
    isLeader: true,
    leaderNodeId: "node-1",
    epoch: 1,
    fencingToken: 1,
    expiresAt: new Date(Date.now() + 15000).toISOString(),
    isExpired: false,
  };
  assert.equal(result.isLeader, true);
  assert.equal(result.isExpired, false);
});

test("ha-coordinator-service exports LeaderActionAuthorization type", async () => {
  const auth: LeaderActionAuthorization = {
    authorized: true,
    authority: "leader_only",
    reasonCode: "ok",
    leaderNodeId: "node-1",
    epoch: 1,
    fencingToken: 1,
  };
  assert.equal(auth.authorized, true);
  assert.equal(auth.authority, "leader_only");
});

test("ha-coordinator-service exports HaCoordinatorServiceOptions type", async () => {
  const options: HaCoordinatorServiceOptions = {
    defaultTtlMs: 30_000,
    strictLeaderAuthority: true,
  };
  assert.equal(options.defaultTtlMs, 30_000);
  assert.equal(options.strictLeaderAuthority, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: HaCoordinatorService instance methods via barrel
// ─────────────────────────────────────────────────────────────────────────────

test("HaCoordinatorService instance - registerNode and getNode", async () => {
  const backend = createMockSqliteBackend();
  const service = new HaCoordinatorService(backend.sql);

  // Register a node
  const node = service.registerNode("node-1", "us-east-1");
  assert.equal(node.nodeId, "node-1");
  assert.equal(node.region, "us-east-1");
  assert.equal(node.status, "active");

  // Get the node
  const retrieved = service.getNode("node-1");
  assert.ok(retrieved !== null);
  assert.equal(retrieved!.nodeId, "node-1");
});

test("HaCoordinatorService instance - getNode returns null for unknown node", async () => {
  const backend = createMockSqliteBackend();
  const service = new HaCoordinatorService(backend.sql);

  const retrieved = service.getNode("unknown-node");
  assert.equal(retrieved, null);
});

test("HaCoordinatorService instance - listNodes", async () => {
  const backend = createMockSqliteBackend();
  const service = new HaCoordinatorService(backend.sql);

  service.registerNode("node-1", "us-east-1");
  service.registerNode("node-2", "us-west-2");

  const nodes = service.listNodes();
  assert.equal(nodes.length, 2);
});

test("HaCoordinatorService instance - getCurrentLeader when no leader", async () => {
  const backend = createMockSqliteBackend();
  const service = new HaCoordinatorService(backend.sql);

  const leader = service.getCurrentLeader();
  assert.equal(leader, null);
});

test("HaCoordinatorService instance - getLatestEpoch when no epochs", async () => {
  const backend = createMockSqliteBackend();
  const service = new HaCoordinatorService(backend.sql);

  const epoch = service.getLatestEpoch();
  assert.equal(epoch.epoch, 0);
  assert.equal(epoch.leaderNodeId, null);
});

test("HaCoordinatorService instance - queryLeadership when no leader", async () => {
  const backend = createMockSqliteBackend();
  const service = new HaCoordinatorService(backend.sql);

  const result = service.queryLeadership();
  assert.equal(result.isLeader, false);
  assert.equal(result.leaderNodeId, null);
  assert.equal(result.isExpired, true);
});

test("HaCoordinatorService instance - verifyWriteAuthority", async () => {
  const backend = createMockSqliteBackend();
  const service = new HaCoordinatorService(backend.sql);

  // No epochs yet, fencing token should be 0
  assert.equal(service.verifyWriteAuthority(0), true);
  assert.equal(service.verifyWriteAuthority(1), true);
});

test("HaCoordinatorService instance - purgeExpiredLeases returns 0 when none", async () => {
  const backend = createMockSqliteBackend();
  const service = new HaCoordinatorService(backend.sql);

  const count = service.purgeExpiredLeases();
  assert.equal(count, 0);
});

test("HaCoordinatorService instance - purgeOldFailoverDecisions returns 0 when none", async () => {
  const backend = createMockSqliteBackend();
  const service = new HaCoordinatorService(backend.sql);

  const count = service.purgeOldFailoverDecisions();
  assert.equal(count, 0);
});

test("HaCoordinatorService instance - getFailoverHistory returns empty array", async () => {
  const backend = createMockSqliteBackend();
  const service = new HaCoordinatorService(backend.sql);

  const history = service.getFailoverHistory();
  assert.ok(Array.isArray(history));
  assert.equal(history.length, 0);
});

test("HaCoordinatorService instance - listEpochs returns empty array", async () => {
  const backend = createMockSqliteBackend();
  const service = new HaCoordinatorService(backend.sql);

  const epochs = service.listEpochs();
  assert.ok(Array.isArray(epochs));
  assert.equal(epochs.length, 0);
});
