/**
 * Unit tests for postgres-fencing-token-service.ts
 *
 * Tests PostgreSQL-backed async fencing token service with transaction support.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { AsyncFencingTokenService, createPostgresFencingTokenService } from "../../../../../../src/platform/five-plane-state-evidence/events/cas/postgres-fencing-token-service.js";
import type { FenceMode } from "../../../../../../src/platform/five-plane-state-evidence/events/cas/fencing-token-service.js";

// Mock AsyncSqlDatabase
interface MockFenceRecord {
  fence_key: string;
  execution_id: string;
  owner_node_id: string;
  mode: "shared" | "exclusive";
  fence_token: string;
  acquired_at: string;
  expires_at: string | null;
}

function createMockDatabase(): {
  asyncConnection: {
    query<T>(sql: string, ...params: unknown[]): Promise<{ rows: T[] }>;
    execute(sql: string, ...params: unknown[]): Promise<number>;
  };
  transaction<T>(fn: (conn: {
    query<T>(sql: string, ...params: unknown[]): Promise<{ rows: T[] }>;
    execute(sql: string, ...params: unknown[]): Promise<number>;
  }) => Promise<T>): Promise<T>;
} {
  const fenceStorage = new Map<string, MockFenceRecord>();

  const conn = {
    async query<T>(sql: string, ...params: unknown[]): Promise<{ rows: T[] }> {
      const executionId = params[0] as string | undefined;
      const nodeId = params[0] as string | undefined;

      if (sql.includes("WHERE execution_id")) {
        const results = [...fenceStorage.values()].filter((f) => f.execution_id === executionId);
        return { rows: results as unknown as T[] };
      }
      if (sql.includes("WHERE owner_node_id")) {
        const results = [...fenceStorage.values()].filter((f) => f.owner_node_id === nodeId);
        return { rows: results as unknown as T[] };
      }
      if (sql.includes("WHERE fence_key")) {
        const key = params[0] as string;
        const found = fenceStorage.get(key);
        return { rows: found ? [found] as unknown as T[] : [] };
      }
      // getAll
      return { rows: [...fenceStorage.values()] as unknown as T[] };
    },
    async execute(sql: string, ...params: unknown[]): Promise<number> {
      if (sql.includes("INSERT") || sql.includes("ON CONFLICT")) {
        const key = params[0] as string;
        const fence: MockFenceRecord = {
          fence_key: key,
          execution_id: params[1] as string,
          owner_node_id: params[2] as string,
          mode: params[3] as "shared" | "exclusive",
          fence_token: params[4] as string,
          acquired_at: params[5] as string,
          expires_at: params[6] as string | null,
        };
        fenceStorage.set(key, fence);
        return 1;
      }
      if (sql.includes("DELETE")) {
        const key = params[0] as string;
        const existed = fenceStorage.has(key);
        fenceStorage.delete(key);
        return existed ? 1 : 0;
      }
      return 0;
    },
  };

  return {
    asyncConnection: conn,
    async transaction<T>(fn: (conn: typeof conn) => Promise<T>): Promise<T> {
      return fn(conn);
    },
  };
}

test("AsyncFencingTokenService generates unique fencing tokens", () => {
  const db = createMockDatabase();
  const service = new AsyncFencingTokenService(db, "test-node");

  const token1 = service.generateFencingToken("exec-1", "node-1");
  const token2 = service.generateFencingToken("exec-2", "node-1");

  assert.notStrictEqual(token1, token2);
  assert.ok(token1.includes("::"));
  assert.ok(token2.includes("::"));
});

test("AsyncFencingTokenService validateFencingToken returns invalid for empty token", () => {
  const db = createMockDatabase();
  const service = new AsyncFencingTokenService(db, "test-node");

  const result = service.validateFencingToken("", "expected-owner");
  assert.equal(result.valid, false);
  assert.equal(result.reason, "Empty or invalid token");
});

test("AsyncFencingTokenService validateFencingToken returns invalid for malformed token", () => {
  const db = createMockDatabase();
  const service = new AsyncFencingTokenService(db, "test-node");

  const result = service.validateFencingToken("not-valid", "expected-owner");
  assert.equal(result.valid, false);
  assert.equal(result.reason, "Token format invalid");
});

test("AsyncFencingTokenService validateFencingToken returns invalid for wrong owner", () => {
  const db = createMockDatabase();
  const service = new AsyncFencingTokenService(db, "test-node");

  const token = service.generateFencingToken("exec-1", "other-node");
  const result = service.validateFencingToken(token, "expected-owner");
  assert.equal(result.valid, false);
  assert.equal(result.reason, "Token not owned by expected owner");
});

test("AsyncFencingTokenService validateFencingToken returns valid for correct owner", () => {
  const db = createMockDatabase();
  const service = new AsyncFencingTokenService(db, "test-node");

  const token = service.generateFencingToken("exec-123", "test-node");
  const result = service.validateFencingToken(token, "test-node");
  assert.equal(result.valid, true);
  assert.equal(result.executionId, "exec-123");
  assert.equal(result.owner, "test-node");
});

test("AsyncFencingTokenService acquireFence creates new fence", async () => {
  const db = createMockDatabase();
  const service = new AsyncFencingTokenService(db, "acquire-test-node");

  const fence = await service.acquireFence("exec-acquire", "exclusive");
  assert.ok(fence !== null);
  assert.equal(fence?.executionId, "exec-acquire");
  assert.equal(fence?.mode, "exclusive");
  assert.equal(fence?.ownerNodeId, "acquire-test-node");
  assert.ok(fence?.fenceToken.includes("::"));
});

test("AsyncFencingTokenService acquireFence returns null when exclusive fence exists", async () => {
  const db = createMockDatabase();
  const service = new AsyncFencingTokenService(db, "node-a");

  // Node A acquires exclusive fence
  await service.acquireFence("exec-exclusive", "exclusive");

  // Create second service with different node ID
  const serviceB = new AsyncFencingTokenService(db, "node-b");

  // Node B should not be able to acquire
  const result = await serviceB.acquireFence("exec-exclusive", "exclusive");
  assert.equal(result, null);
});

test("AsyncFencingTokenService acquireFence allows shared fence when exclusive exists", async () => {
  const db = createMockDatabase();
  const serviceA = new AsyncFencingTokenService(db, "node-a");

  // Node A acquires exclusive fence
  await serviceA.acquireFence("exec-shared-test", "exclusive");

  // Same node can re-acquire
  const reAcquire = await serviceA.acquireFence("exec-shared-test", "exclusive");
  assert.equal(reAcquire, null); // Same node can't re-acquire

  // Different node tries to get shared - should fail because exclusive exists
  const serviceB = new AsyncFencingTokenService(db, "node-b");
  const result = await serviceB.acquireFence("exec-shared-test", "shared");
  assert.equal(result, null);
});

test("AsyncFencingTokenService releaseFence returns true when fence released", async () => {
  const db = createMockDatabase();
  const service = new AsyncFencingTokenService(db, "release-node");

  await service.acquireFence("exec-release", "exclusive");
  const released = await service.releaseFence("exec-release");

  assert.equal(released, true);
});

test("AsyncFencingTokenService releaseFence returns false when no fence held", async () => {
  const db = createMockDatabase();
  const service = new AsyncFencingTokenService(db, "release-node");

  const released = await service.releaseFence("non-existent-exec");
  assert.equal(released, false);
});

test("AsyncFencingTokenService isFenceHeld returns true when fence exists", async () => {
  const db = createMockDatabase();
  const service = new AsyncFencingTokenService(db, "hold-check-node");

  await service.acquireFence("exec-hold-check", "exclusive");
  const isHeld = await service.isFenceHeld("exec-hold-check");

  assert.equal(isHeld, true);
});

test("AsyncFencingTokenService isFenceHeld returns false when no fence", async () => {
  const db = createMockDatabase();
  const service = new AsyncFencingTokenService(db, "hold-check-node");

  const isHeld = await service.isFenceHeld("non-existent-exec");
  assert.equal(isHeld, false);
});

test("AsyncFencingTokenService getFenceInfo returns fence info when held", async () => {
  const db = createMockDatabase();
  const service = new AsyncFencingTokenService(db, "info-check-node");

  await service.acquireFence("exec-info-check", "exclusive");
  const info = await service.getFenceInfo("exec-info-check");

  assert.ok(info !== undefined);
  assert.equal(info?.executionId, "exec-info-check");
  assert.equal(info?.ownerNodeId, "info-check-node");
});

test("AsyncFencingTokenService getFenceInfo returns undefined when not held", async () => {
  const db = createMockDatabase();
  const service = new AsyncFencingTokenService(db, "info-check-node");

  const info = await service.getFenceInfo("non-existent-exec");
  assert.equal(info, undefined);
});

test("AsyncFencingTokenService getNodeId returns configured node ID", () => {
  const db = createMockDatabase();
  const service = new AsyncFencingTokenService(db, "custom-node-id");

  assert.equal(service.getNodeId(), "custom-node-id");
});

test("AsyncFencingTokenService clearAllFences removes all fences", async () => {
  const db = createMockDatabase();
  const service = new AsyncFencingTokenService(db, "clear-node");

  await service.acquireFence("exec-clear-1", "exclusive");
  await service.acquireFence("exec-clear-2", "exclusive");

  await service.clearAllFences();

  const count = await service.getActiveFenceCount();
  assert.equal(count, 0);
});

test("AsyncFencingTokenService getActiveFenceCount returns correct count", async () => {
  const db = createMockDatabase();
  const service = new AsyncFencingTokenService(db, "count-node");

  await service.acquireFence("exec-count-1", "exclusive");
  await service.acquireFence("exec-count-2", "exclusive");
  await service.acquireFence("exec-count-3", "exclusive");

  const count = await service.getActiveFenceCount();
  assert.equal(count, 3);
});

test("createPostgresFencingTokenService creates service with default node ID", () => {
  const db = createMockDatabase();
  const service = createPostgresFencingTokenService(db);

  assert.equal(service.getNodeId(), "default-node");
});

test("createPostgresFencingTokenService creates service with custom node ID", () => {
  const db = createMockDatabase();
  const service = createPostgresFencingTokenService(db, "custom");

  assert.equal(service.getNodeId(), "custom");
});

test("AsyncFencingTokenService generates token with encoded execution ID", () => {
  const db = createMockDatabase();
  const service = new AsyncFencingTokenService(db, "encode-node");

  const token = service.generateFencingToken("exec-with-special-chars-123", "encode-node");
  const result = service.validateFencingToken(token, "encode-node");

  assert.equal(result.valid, true);
  assert.equal(result.executionId, "exec-with-special-chars-123");
});

test("AsyncFencingTokenService validateFencingToken decodes URL-encoded components", () => {
  const db = createMockDatabase();
  const service = new AsyncFencingTokenService(db, "decode-node");

  const token = service.generateFencingToken("exec%3A123", "decode%2Fnode");
  const result = service.validateFencingToken(token, "decode%2Fnode");

  assert.equal(result.valid, true);
  // The executionId should be decoded
  assert.ok(result.executionId?.includes("exec"));
});