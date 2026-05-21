/**
 * Unit tests for postgres-fence-repository.ts
 *
 * Tests PostgreSQL-backed fence repository for distributed fencing tokens.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { PostgresFenceRepository } from "../../../../../../src/platform/five-plane-state-evidence/events/cas/postgres-fence-repository.js";
import type { FenceInfo } from "../../../../../../src/platform/five-plane-state-evidence/events/cas/fencing-token-service.js";

// Mock AsyncSqlConnection for testing
interface MockQueryResult {
  rows: Record<string, unknown>[];
}

function createMockConnection(): {
  query<T>(sql: string, ...params: unknown[]): Promise<MockQueryResult>;
  execute(sql: string, ...params: unknown[]): Promise<number>;
} {
  const storage = new Map<string, { fence: FenceInfo; key: string }[]>([]);
  const allRecords: { fence: FenceInfo; key: string }[] = [];

  return {
    async query<T extends Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<MockQueryResult> {
      const executionId = params[0] as string;
      const nodeId = params[0] as string;

      if (sql.includes("WHERE execution_id")) {
        const matching = allRecords.filter((r) => r.fence.executionId === executionId);
        return {
          rows: matching.map((r) => ({
            executionId: r.fence.executionId,
            ownerNodeId: r.fence.ownerNodeId,
            mode: r.fence.mode,
            fenceToken: r.fence.fenceToken,
            acquiredAt: r.fence.acquiredAt.toISOString(),
            expiresAt: r.fence.expiresAt?.toISOString() ?? null,
          })),
        };
      }
      if (sql.includes("WHERE owner_node_id")) {
        const matching = allRecords.filter((r) => r.fence.ownerNodeId === nodeId);
        return {
          rows: matching.map((r) => ({
            executionId: r.fence.executionId,
            ownerNodeId: r.fence.ownerNodeId,
            mode: r.fence.mode,
            fenceToken: r.fence.fenceToken,
            acquiredAt: r.fence.acquiredAt.toISOString(),
            expiresAt: r.fence.expiresAt?.toISOString() ?? null,
          })),
        };
      }
      if (sql.includes("WHERE fence_key")) {
        const key = params[0] as string;
        const found = allRecords.find((r) => r.key === key);
        return {
          rows: found
            ? [
                {
                  executionId: found.fence.executionId,
                  ownerNodeId: found.fence.ownerNodeId,
                  mode: found.fence.mode,
                  fenceToken: found.fence.fenceToken,
                  acquiredAt: found.fence.acquiredAt.toISOString(),
                  expiresAt: found.fence.expiresAt?.toISOString() ?? null,
                },
              ]
            : [],
        };
      }
      // getAll query
      return {
        rows: allRecords.map((r) => ({
          executionId: r.fence.executionId,
          ownerNodeId: r.fence.ownerNodeId,
          mode: r.fence.mode,
          fenceToken: r.fence.fenceToken,
          acquiredAt: r.fence.acquiredAt.toISOString(),
          expiresAt: r.fence.expiresAt?.toISOString() ?? null,
        })),
      };
    },
    async execute(sql: string, ...params: unknown[]): Promise<number> {
      const key = params[0] as string;
      const fence = params[1] as FenceInfo;

      if (sql.includes("INSERT") || sql.includes("ON CONFLICT")) {
        const existing = allRecords.findIndex((r) => r.key === key);
        if (existing >= 0) {
          allRecords[existing] = { key, fence };
        } else {
          allRecords.push({ key, fence });
        }
        return 1;
      }
      if (sql.includes("DELETE") && sql.includes("fence_key")) {
        const before = allRecords.length;
        const filtered = allRecords.filter((r) => r.key !== key);
        const removed = before - filtered.length;
        allRecords.length = 0;
        allRecords.push(...filtered);
        return removed;
      }
      if (sql.includes("DELETE") && sql.includes("expires_at")) {
        const now = new Date(params[0] as string);
        const before = allRecords.length;
        const filtered = allRecords.filter((r) => r.fence.expiresAt === null || r.fence.expiresAt > now);
        const removed = before - filtered.length;
        allRecords.length = 0;
        allRecords.push(...filtered);
        return removed;
      }
      return 0;
    },
  };
}

function createSampleFenceInfo(overrides?: Partial<FenceInfo>): FenceInfo {
  return {
    executionId: "exec-123",
    mode: "exclusive",
    fenceToken: "token-abc-123",
    ownerNodeId: "node-1",
    acquiredAt: new Date("2026-05-21T10:00:00Z"),
    expiresAt: new Date("2026-05-21T11:00:00Z"),
    ...overrides,
  };
}

test("PostgresFenceRepository.getFencesForExecution returns fences for execution", async () => {
  const conn = createMockConnection();
  const repo = new PostgresFenceRepository(conn);

  // Add a fence directly via storage manipulation (simulating existing data)
  const fence = createSampleFenceInfo();
  await conn.execute(
    `INSERT INTO fence_records (fence_key, execution_id, owner_node_id, mode, fence_token, acquired_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT DO UPDATE SET execution_id = EXCLUDED.execution_id`,
    "exec-123::node-1",
    fence.executionId,
    fence.ownerNodeId,
    fence.mode,
    fence.fenceToken,
    fence.acquiredAt.toISOString(),
    fence.expiresAt?.toISOString() ?? null,
  );

  const fences = await repo.getFencesForExecution("exec-123");
  assert.equal(fences.length, 1);
  assert.equal(fences[0]?.executionId, "exec-123");
  assert.equal(fences[0]?.ownerNodeId, "node-1");
});

test("PostgresFenceRepository.getFencesForExecution returns empty for unknown execution", async () => {
  const conn = createMockConnection();
  const repo = new PostgresFenceRepository(conn);

  const fences = await repo.getFencesForExecution("unknown-exec");
  assert.equal(fences.length, 0);
});

test("PostgresFenceRepository.getFencesForNode returns fences for node", async () => {
  const conn = createMockConnection();
  const repo = new PostgresFenceRepository(conn);

  const fence = createSampleFenceInfo({ ownerNodeId: "specific-node" });
  await conn.execute(
    `INSERT INTO fence_records (fence_key, execution_id, owner_node_id, mode, fence_token, acquired_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    "exec-456::specific-node",
    fence.executionId,
    fence.ownerNodeId,
    fence.mode,
    fence.fenceToken,
    fence.acquiredAt.toISOString(),
    fence.expiresAt?.toISOString() ?? null,
  );

  const fences = await repo.getFencesForNode("specific-node");
  assert.equal(fences.length, 1);
  assert.equal(fences[0]?.ownerNodeId, "specific-node");
});

test("PostgresFenceRepository.set inserts new fence", async () => {
  const conn = createMockConnection();
  const repo = new PostgresFenceRepository(conn);

  const fence = createSampleFenceInfo();
  await repo.set("new-key", fence);

  const fences = await repo.getFencesForExecution("exec-123");
  assert.equal(fences.length, 1);
});

test("PostgresFenceRepository.set updates existing fence", async () => {
  const conn = createMockConnection();
  const repo = new PostgresFenceRepository(conn);

  const fence1 = createSampleFenceInfo({ executionId: "exec-update" });
  await repo.set("update-key", fence1);

  const fence2 = createSampleFenceInfo({ executionId: "exec-update", fenceToken: "new-token" });
  await repo.set("update-key", fence2);

  const fences = await repo.getFencesForExecution("exec-update");
  assert.equal(fences.length, 1);
  assert.equal(fences[0]?.fenceToken, "new-token");
});

test("PostgresFenceRepository.delete removes fence and returns true", async () => {
  const conn = createMockConnection();
  const repo = new PostgresFenceRepository(conn);

  const fence = createSampleFenceInfo();
  await repo.set("delete-key", fence);

  const deleted = await repo.delete("delete-key");
  assert.equal(deleted, true);

  const fences = await repo.getFencesForExecution("exec-123");
  assert.equal(fences.length, 0);
});

test("PostgresFenceRepository.delete returns false for non-existent key", async () => {
  const conn = createMockConnection();
  const repo = new PostgresFenceRepository(conn);

  const deleted = await repo.delete("non-existent-key");
  assert.equal(deleted, false);
});

test("PostgresFenceRepository.deleteExpired removes expired fences", async () => {
  const conn = createMockConnection();
  const repo = new PostgresFenceRepository(conn);

  const expiredFence = createSampleFenceInfo({
    executionId: "exec-expired",
    expiresAt: new Date("2026-05-20T00:00:00Z"), // in the past
  });
  await repo.set("expired-key", expiredFence);

  const validFence = createSampleFenceInfo({
    executionId: "exec-valid",
    expiresAt: new Date("2026-05-22T00:00:00Z"), // in the future
  });
  await repo.set("valid-key", validFence);

  const now = new Date("2026-05-21T12:00:00Z");
  const deletedCount = await repo.deleteExpired(now);

  assert.equal(deletedCount, 1);

  const remainingFences = await repo.getAll();
  assert.equal(remainingFences.length, 1);
  assert.equal(remainingFences[0]?.executionId, "exec-valid");
});

test("PostgresFenceRepository.deleteExpired handles null expiresAt (never expires)", async () => {
  const conn = createMockConnection();
  const repo = new PostgresFenceRepository(conn);

  const fenceWithNullExpiry = createSampleFenceInfo({
    executionId: "exec-no-expiry",
    expiresAt: null,
  });
  await repo.set("no-expiry-key", fenceWithNullExpiry);

  const now = new Date("2026-05-21T12:00:00Z");
  const deletedCount = await repo.deleteExpired(now);

  // Should not delete records with null expiresAt
  assert.equal(deletedCount, 0);

  const remainingFences = await repo.getAll();
  assert.equal(remainingFences.length, 1);
});

test("PostgresFenceRepository.getAll returns all fences", async () => {
  const conn = createMockConnection();
  const repo = new PostgresFenceRepository(conn);

  await repo.set("key-1", createSampleFenceInfo({ executionId: "exec-1" }));
  await repo.set("key-2", createSampleFenceInfo({ executionId: "exec-2", ownerNodeId: "node-2" }));
  await repo.set("key-3", createSampleFenceInfo({ executionId: "exec-3", ownerNodeId: "node-3" }));

  const allFences = await repo.getAll();
  assert.equal(allFences.length, 3);
});

test("PostgresFenceRepository.getAll returns empty array when no fences", async () => {
  const conn = createMockConnection();
  const repo = new PostgresFenceRepository(conn);

  const allFences = await repo.getAll();
  assert.equal(allFences.length, 0);
});

test("PostgresFenceRepository.toFenceInfo maps row fields correctly", async () => {
  const conn = createMockConnection();
  const repo = new PostgresFenceRepository(conn);

  const fence = createSampleFenceInfo({
    executionId: "exec-field-test",
    mode: "shared",
    fenceToken: "token-shared",
    ownerNodeId: "owner-node",
  });
  await repo.set("field-test-key", fence);

  const fences = await repo.getFencesForExecution("exec-field-test");
  assert.equal(fences.length, 1);
  assert.equal(fences[0]?.mode, "shared");
  assert.equal(fences[0]?.fenceToken, "token-shared");
  assert.equal(fences[0]?.ownerNodeId, "owner-node");
  assert.ok(fences[0]?.acquiredAt instanceof Date);
  assert.ok(fences[0]?.expiresAt instanceof Date);
});