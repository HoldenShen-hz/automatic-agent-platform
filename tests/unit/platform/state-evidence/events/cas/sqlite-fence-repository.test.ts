/**
 * Unit tests for sqlite-fence-repository.ts
 *
 * Tests SQLite-backed fence repository for distributed fencing tokens.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { SqliteFenceRepository } from "../../../../../../src/platform/five-plane-state-evidence/events/cas/sqlite-fence-repository.js";
import type { FenceInfo } from "../../../../../../src/platform/five-plane-state-evidence/events/cas/fencing-token-service.js";

// Mock SqliteConnection for testing
function createMockConnection(): {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): { changes: number };
    all(...params: unknown[]): unknown[];
  };
} {
  const fenceStorage = new Map<string, unknown[]>();
  const tableCreated = new Set<string>();

  return {
    exec(sql: string): void {
      if (sql.includes("CREATE TABLE")) {
        tableCreated.add("fence_records");
      }
    },
    prepare(sql: string) {
      return {
        run(...params: unknown[]): { changes: number } {
          if (sql.includes("INSERT") || sql.includes("ON CONFLICT")) {
            const key = params[0] as string;
            fenceStorage.set(key, params as unknown[]);
            return { changes: 1 };
          }
          if (sql.includes("DELETE")) {
            const key = params[0] as string;
            const existed = fenceStorage.has(key);
            fenceStorage.delete(key);
            return { changes: existed ? 1 : 0 };
          }
          return { changes: 0 };
        },
        all(...params: unknown[]): unknown[] {
          const executionId = params[0] as string | undefined;
          const nodeId = params[0] as string | undefined;

          if (sql.includes("WHERE execution_id")) {
            const results: unknown[] = [];
            fenceStorage.forEach((row) => {
              if ((row[1] as string) === executionId) {
                results.push(Object.fromEntries(
                  Object.entries(row as Record<string, unknown>).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), v])
                ));
              }
            });
            return results;
          }
          if (sql.includes("WHERE owner_node_id")) {
            const results: unknown[] = [];
            fenceStorage.forEach((row) => {
              if ((row[2] as string) === nodeId) {
                results.push(Object.fromEntries(
                  Object.entries(row as Record<string, unknown>).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), v])
                ));
              }
            });
            return results;
          }
          if (sql.includes("WHERE fence_key")) {
            const key = params[0] as string;
            const row = fenceStorage.get(key);
            if (!row) return [];
            return [Object.fromEntries(
              Object.entries(row as Record<string, unknown>).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), v])
            )];
          }
          // getAll
          const results: unknown[] = [];
          fenceStorage.forEach((row) => {
            results.push(Object.fromEntries(
              Object.entries(row as Record<string, unknown>).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), v])
            ));
          });
          return results;
        },
      };
    },
  };
}

function createSampleFenceInfo(overrides?: Partial<FenceInfo>): FenceInfo {
  return {
    executionId: "exec-123",
    mode: "exclusive",
    fenceToken: "token-xyz-789",
    ownerNodeId: "node-1",
    acquiredAt: new Date("2026-05-21T10:00:00Z"),
    expiresAt: new Date("2026-05-21T11:00:00Z"),
    ...overrides,
  };
}

test("SqliteFenceRepository.getFencesForExecution returns fences for execution", () => {
  const conn = createMockConnection();
  const repo = new SqliteFenceRepository(conn);

  const fence = createSampleFenceInfo();
  repo.set("exec-123::node-1", fence);

  const fences = repo.getFencesForExecution("exec-123");
  assert.equal(fences.length, 1);
  assert.equal(fences[0]?.executionId, "exec-123");
  assert.equal(fences[0]?.ownerNodeId, "node-1");
});

test("SqliteFenceRepository.getFencesForExecution returns empty for unknown execution", () => {
  const conn = createMockConnection();
  const repo = new SqliteFenceRepository(conn);

  const fences = repo.getFencesForExecution("unknown-exec");
  assert.equal(fences.length, 0);
});

test("SqliteFenceRepository.getFencesForNode returns fences for node", () => {
  const conn = createMockConnection();
  const repo = new SqliteFenceRepository(conn);

  const fence = createSampleFenceInfo({ ownerNodeId: "target-node" });
  repo.set("exec-456::target-node", fence);

  const fences = repo.getFencesForNode("target-node");
  assert.equal(fences.length, 1);
  assert.equal(fences[0]?.ownerNodeId, "target-node");
});

test("SqliteFenceRepository.get returns specific fence", () => {
  const conn = createMockConnection();
  const repo = new SqliteFenceRepository(conn);

  const fence = createSampleFenceInfo();
  repo.set("specific-key", fence);

  const found = repo.get("specific-key");
  assert.ok(found !== undefined);
  assert.equal(found?.executionId, "exec-123");
});

test("SqliteFenceRepository.get returns undefined for missing key", () => {
  const conn = createMockConnection();
  const repo = new SqliteFenceRepository(conn);

  const found = repo.get("missing-key");
  assert.equal(found, undefined);
});

test("SqliteFenceRepository.set inserts new fence record", () => {
  const conn = createMockConnection();
  const repo = new SqliteFenceRepository(conn);

  const fence = createSampleFenceInfo();
  repo.set("new-fence-key", fence);

  const found = repo.get("new-fence-key");
  assert.ok(found !== undefined);
  assert.equal(found?.fenceToken, "token-xyz-789");
});

test("SqliteFenceRepository.set updates existing fence record", () => {
  const conn = createMockConnection();
  const repo = new SqliteFenceRepository(conn);

  const fence1 = createSampleFenceInfo({ fenceToken: "original-token" });
  repo.set("update-key", fence1);

  const fence2 = createSampleFenceInfo({ fenceToken: "updated-token" });
  repo.set("update-key", fence2);

  const found = repo.get("update-key");
  assert.ok(found !== undefined);
  assert.equal(found?.fenceToken, "updated-token");
});

test("SqliteFenceRepository.delete removes fence and returns true", () => {
  const conn = createMockConnection();
  const repo = new SqliteFenceRepository(conn);

  const fence = createSampleFenceInfo();
  repo.set("delete-me", fence);

  const deleted = repo.delete("delete-me");
  assert.equal(deleted, true);

  const found = repo.get("delete-me");
  assert.equal(found, undefined);
});

test("SqliteFenceRepository.delete returns false for non-existent key", () => {
  const conn = createMockConnection();
  const repo = new SqliteFenceRepository(conn);

  const deleted = repo.delete("non-existent");
  assert.equal(deleted, false);
});

test("SqliteFenceRepository.deleteExpired removes expired fences", () => {
  const conn = createMockConnection();
  const repo = new SqliteFenceRepository(conn);

  const expiredFence = createSampleFenceInfo({
    executionId: "exec-expired",
    expiresAt: new Date("2026-05-20T00:00:00Z"),
  });
  repo.set("expired-key", expiredFence);

  const validFence = createSampleFenceInfo({
    executionId: "exec-valid",
    expiresAt: new Date("2026-05-22T00:00:00Z"),
  });
  repo.set("valid-key", validFence);

  const now = new Date("2026-05-21T12:00:00Z");
  const deletedCount = repo.deleteExpired(now);

  assert.equal(deletedCount, 1);

  const remaining = repo.getAll();
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0]?.executionId, "exec-valid");
});

test("SqliteFenceRepository.deleteExpired does not remove records with null expiresAt", () => {
  const conn = createMockConnection();
  const repo = new SqliteFenceRepository(conn);

  const noExpiryFence = createSampleFenceInfo({
    executionId: "exec-no-expiry",
    expiresAt: null,
  });
  repo.set("no-expiry-key", noExpiryFence);

  const now = new Date("2026-05-21T12:00:00Z");
  const deletedCount = repo.deleteExpired(now);

  // Null expiresAt should not be considered expired
  assert.equal(deletedCount, 0);

  const remaining = repo.getAll();
  assert.equal(remaining.length, 1);
});

test("SqliteFenceRepository.getAll returns all fences", () => {
  const conn = createMockConnection();
  const repo = new SqliteFenceRepository(conn);

  repo.set("key-1", createSampleFenceInfo({ executionId: "exec-a" }));
  repo.set("key-2", createSampleFenceInfo({ executionId: "exec-b", ownerNodeId: "node-b" }));
  repo.set("key-3", createSampleFenceInfo({ executionId: "exec-c", ownerNodeId: "node-c" }));

  const all = repo.getAll();
  assert.equal(all.length, 3);
});

test("SqliteFenceRepository.getAll returns empty when no fences", () => {
  const conn = createMockConnection();
  const repo = new SqliteFenceRepository(conn);

  const all = repo.getAll();
  assert.equal(all.length, 0);
});

test("SqliteFenceRepository.toFenceInfo converts snake_case to camelCase", () => {
  const conn = createMockConnection();
  const repo = new SqliteFenceRepository(conn);

  const fence = createSampleFenceInfo({
    executionId: "exec-camelcase",
    mode: "shared",
  });
  repo.set("camelcase-key", fence);

  const fences = repo.getFencesForExecution("exec-camelcase");
  assert.equal(fences.length, 1);
  // Verify camelCase conversion worked
  assert.equal((fences[0] as unknown as Record<string, unknown>).executionId, "exec-camelcase");
  assert.equal((fences[0] as unknown as Record<string, unknown>).ownerNodeId, "node-1");
});

test("SqliteFenceRepository handles mode conversion correctly", () => {
  const conn = createMockConnection();
  const repo = new SqliteFenceRepository(conn);

  const sharedFence = createSampleFenceInfo({ executionId: "exec-shared", mode: "shared" });
  repo.set("shared-key", sharedFence);

  const exclusiveFence = createSampleFenceInfo({ executionId: "exec-exclusive", mode: "exclusive" });
  repo.set("exclusive-key", exclusiveFence);

  const sharedFences = repo.getFencesForExecution("exec-shared");
  assert.equal(sharedFences[0]?.mode, "shared");

  const exclusiveFences = repo.getFencesForExecution("exec-exclusive");
  assert.equal(exclusiveFences[0]?.mode, "exclusive");
});

test("SqliteFenceRepository handles date conversion for acquiredAt and expiresAt", () => {
  const conn = createMockConnection();
  const repo = new SqliteFenceRepository(conn);

  const customDate = new Date("2026-01-15T08:30:00Z");
  const futureDate = new Date("2026-12-31T23:59:59Z");
  const fence = createSampleFenceInfo({
    acquiredAt: customDate,
    expiresAt: futureDate,
  });
  repo.set("date-key", fence);

  const found = repo.get("date-key");
  assert.ok(found !== undefined);
  assert.ok(found?.acquiredAt instanceof Date);
  assert.ok(found?.expiresAt instanceof Date);
  assert.equal(found?.acquiredAt.getUTCFullYear(), 2026);
  assert.equal(found?.expiresAt.getUTCFullYear(), 2026);
});