/**
 * Additional unit tests for OutboxRepository - covering more methods
 */

import assert from "node:assert/strict";
import test from "node:test";
import { OutboxRepository } from "../../../../../src/platform/shared/outbox/outbox-repository.js";
import type { SqliteConnection } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/query-helper.js";
import { OutboxStatus } from "../../../../../src/platform/shared/outbox/outbox-types.js";

type ConnectionMock = Pick<SqliteConnection, "prepare">;

function createMockConnection(): ConnectionMock {
  return {
    prepare: () => ({
      run: () => ({ changes: 1 }),
      get: () => null,
      all: () => [],
    }),
  } as unknown as ConnectionMock;
}

// Mock result types for queryOne and queryAll
interface MockQueryResult {
  row: Record<string, unknown> | undefined;
  allRows: Record<string, unknown>[];
}

function createConnectionWithQuerySupport(results: Record<string, MockQueryResult>): ConnectionMock {
  return {
    prepare: (sql: string) => {
      const key = Object.keys(results).find(k => sql.includes(k)) ?? "";
      const result = results[key] ?? { row: undefined, allRows: [] };
      return {
        run: () => ({ changes: 1 }),
        get: () => result.row,
        all: () => result.allRows,
      };
    },
  } as unknown as ConnectionMock;
}

test("OutboxRepository.insertOutboxEntries bulk insert returns all records", () => {
  const conn = createMockConnection();
  const repo = new OutboxRepository(conn as SqliteConnection);

  const entries = [
    { aggregateType: "task", aggregateId: "task-1", eventType: "task:created", payload: { taskId: "task-1" } },
    { aggregateType: "task", aggregateId: "task-2", eventType: "task:created", payload: { taskId: "task-2" } },
    { aggregateType: "execution", aggregateId: "exec-1", eventType: "execution:started", payload: { executionId: "exec-1" } },
  ];

  const records = repo.insertOutboxEntries(entries);

  assert.equal(records.length, 3);
  assert.equal(records[0]!.aggregateType, "task");
  assert.equal(records[1]!.aggregateType, "task");
  assert.equal(records[2]!.aggregateType, "execution");
});

test("OutboxRepository.insertOutboxEntries returns empty array for empty input", () => {
  const conn = createMockConnection();
  const repo = new OutboxRepository(conn as SqliteConnection);

  const records = repo.insertOutboxEntries([]);

  assert.deepEqual(records, []);
});

test("OutboxRepository.insertOutboxEntriesBulk with mismatched lengths throws", () => {
  const conn = createMockConnection();
  const repo = new OutboxRepository(conn as SqliteConnection);

  const entries = [
    { aggregateType: "task", aggregateId: "task-1", eventType: "task:created", payload: {} },
  ];
  const ids = ["id-1", "id-2"]; // Length mismatch

  assert.throws(
    () => repo.insertOutboxEntriesBulk(entries, ids),
    /entries and ids must have the same length/,
  );
});

test("OutboxRepository.insertOutboxEntriesBulk with matching lengths returns records", () => {
  const conn = createMockConnection();
  const repo = new OutboxRepository(conn as SqliteConnection);

  const entries = [
    { aggregateType: "task", aggregateId: "task-1", eventType: "task:created", payload: {} },
    { aggregateType: "task", aggregateId: "task-2", eventType: "task:created", payload: {} },
  ];
  const ids = ["bulk-id-1", "bulk-id-2"];

  const records = repo.insertOutboxEntriesBulk(entries, ids);

  assert.equal(records.length, 2);
  assert.equal(records[0]!.id, "bulk-id-1");
  assert.equal(records[1]!.id, "bulk-id-2");
});

test("OutboxRepository.insertOutboxEntriesBulk with empty input returns empty array", () => {
  const conn = createMockConnection();
  const repo = new OutboxRepository(conn as SqliteConnection);

  const records = repo.insertOutboxEntriesBulk([], []);

  assert.deepEqual(records, []);
});

test("OutboxRepository.markPublishedBatch with empty ids returns early", () => {
  const conn = createMockConnection();
  const repo = new OutboxRepository(conn as SqliteConnection);

  // Should not throw
  repo.markPublishedBatch([], "2026-04-26T00:00:00Z");

  assert.ok(true);
});

test("OutboxRepository.listPendingEntries delegates to query", () => {
  const mockResult: MockQueryResult = {
    row: undefined,
    allRows: [],
  };

  const conn = createConnectionWithQuerySupport({
    "SELECT": mockResult,
  });
  const repo = new OutboxRepository(conn as SqliteConnection);

  const entries = repo.listPendingEntries(10);

  // Mock returns empty, but we can verify the method works
  assert.ok(Array.isArray(entries));
});

test("OutboxRepository.listFailedEntries delegates to query", () => {
  const mockResult: MockQueryResult = {
    row: undefined,
    allRows: [],
  };

  const conn = createConnectionWithQuerySupport({
    "SELECT": mockResult,
  });
  const repo = new OutboxRepository(conn as SqliteConnection);

  const entries = repo.listFailedEntries(10);

  assert.ok(Array.isArray(entries));
});

test("OutboxRepository.countPending returns count", () => {
  const mockResult: MockQueryResult = {
    row: { count: 42 },
    allRows: [],
  };

  const conn = createConnectionWithQuerySupport({
    "SELECT COUNT": mockResult,
  });
  const repo = new OutboxRepository(conn as SqliteConnection);

  const count = repo.countPending();

  assert.equal(count, 42);
});

test("OutboxRepository.countPending returns 0 when no result", () => {
  const mockResult: MockQueryResult = {
    row: undefined,
    allRows: [],
  };

  const conn = createConnectionWithQuerySupport({
    "SELECT COUNT": mockResult,
  });
  const repo = new OutboxRepository(conn as SqliteConnection);

  const count = repo.countPending();

  assert.equal(count, 0);
});

test("OutboxRepository.countFailed returns count", () => {
  const mockResult: MockQueryResult = {
    row: { count: 5 },
    allRows: [],
  };

  const conn = createConnectionWithQuerySupport({
    "SELECT COUNT": mockResult,
  });
  const repo = new OutboxRepository(conn as SqliteConnection);

  const count = repo.countFailed();

  assert.equal(count, 5);
});

test("OutboxRepository.countFailed returns 0 when no result", () => {
  const mockResult: MockQueryResult = {
    row: undefined,
    allRows: [],
  };

  const conn = createConnectionWithQuerySupport({
    "SELECT COUNT": mockResult,
  });
  const repo = new OutboxRepository(conn as SqliteConnection);

  const count = repo.countFailed();

  assert.equal(count, 0);
});

test("OutboxRepository.getStatus returns PUBLISHED when publishedAt is set", () => {
  const mockResult: MockQueryResult = {
    row: {
      id: "entry-1",
      aggregateType: "task",
      aggregateId: "task-1",
      eventType: "task:created",
      payloadJson: "{}",
      traceId: null,
      createdAt: "2026-04-26T00:00:00Z",
      publishedAt: "2026-04-26T01:00:00Z",
      retryCount: 0,
      lastError: null,
      lastAttemptAt: null,
    },
    allRows: [],
  };

  const conn = createConnectionWithQuerySupport({
    "SELECT": mockResult,
  });
  const repo = new OutboxRepository(conn as SqliteConnection);

  const status = repo.getStatus("entry-1");

  assert.ok(status !== undefined);
  assert.equal(status!.status, OutboxStatus.PUBLISHED);
  assert.equal(status!.retryCount, 0);
});

test("OutboxRepository.getStatus returns FAILED when retryCount > 0", () => {
  const mockResult: MockQueryResult = {
    row: {
      id: "entry-1",
      aggregateType: "task",
      aggregateId: "task-1",
      eventType: "task:created",
      payloadJson: "{}",
      traceId: null,
      createdAt: "2026-04-26T00:00:00Z",
      publishedAt: null,
      retryCount: 3,
      lastError: "Connection refused",
      lastAttemptAt: "2026-04-26T00:30:00Z",
    },
    allRows: [],
  };

  const conn = createConnectionWithQuerySupport({
    "SELECT": mockResult,
  });
  const repo = new OutboxRepository(conn as SqliteConnection);

  const status = repo.getStatus("entry-1");

  assert.ok(status !== undefined);
  assert.equal(status!.status, OutboxStatus.FAILED);
  assert.equal(status!.retryCount, 3);
});

test("OutboxRepository.getStatus returns PENDING when not published and no retries", () => {
  const mockResult: MockQueryResult = {
    row: {
      id: "entry-1",
      aggregateType: "task",
      aggregateId: "task-1",
      eventType: "task:created",
      payloadJson: "{}",
      traceId: null,
      createdAt: "2026-04-26T00:00:00Z",
      publishedAt: null,
      retryCount: 0,
      lastError: null,
      lastAttemptAt: null,
    },
    allRows: [],
  };

  const conn = createConnectionWithQuerySupport({
    "SELECT": mockResult,
  });
  const repo = new OutboxRepository(conn as SqliteConnection);

  const status = repo.getStatus("entry-1");

  assert.ok(status !== undefined);
  assert.equal(status!.status, OutboxStatus.PENDING);
  assert.equal(status!.retryCount, 0);
});

test("OutboxRepository.getStatus returns undefined when entry not found", () => {
  const mockResult: MockQueryResult = {
    row: undefined,
    allRows: [],
  };

  const conn = createConnectionWithQuerySupport({
    "SELECT": mockResult,
  });
  const repo = new OutboxRepository(conn as SqliteConnection);

  const status = repo.getStatus("nonexistent");

  assert.equal(status, undefined);
});

test("OutboxRepository.cleanupPublishedBefore calls DELETE with correct days", () => {
  let deletedSql = "";
  let deletedParams: unknown[] = [];
  const before = Date.now();

  const conn = {
    prepare: (sql: string) => ({
      run: (...params: unknown[]) => {
        deletedSql = sql;
        deletedParams = params;
        return { changes: 5 };
      },
      get: () => null,
      all: () => [],
    }),
  } as unknown as SqliteConnection;

  const repo = new OutboxRepository(conn);

  const deleted = repo.cleanupPublishedBefore(7);
  const after = Date.now();

  assert.equal(deleted, 5);
  assert.ok(deletedSql.includes("DELETE FROM outbox"));
  const cutoff = String(deletedParams[0]);
  const cutoffMs = Date.parse(cutoff);
  assert.match(cutoff, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(Number.isFinite(cutoffMs));
  assert.ok(cutoffMs >= before - 7 * 24 * 60 * 60 * 1000 - 2_000);
  assert.ok(cutoffMs <= after - 7 * 24 * 60 * 60 * 1000 + 2_000);
});

test("OutboxRepository.cleanupPublishedBefore with zero days", () => {
  let deletedSql = "";
  let deletedParams: unknown[] = [];
  const before = Date.now();
  const conn = {
    prepare: (sql: string) => ({
      run: (...params: unknown[]) => {
        deletedSql = sql;
        deletedParams = params;
        return { changes: 1 };
      },
      get: () => null,
      all: () => [],
    }),
  } as unknown as SqliteConnection;
  const repo = new OutboxRepository(conn);

  const deleted = repo.cleanupPublishedBefore(0);
  const after = Date.now();

  assert.equal(deleted, 1);
  assert.ok(deletedSql.includes("DELETE FROM outbox"));
  const cutoff = String(deletedParams[0]);
  const cutoffMs = Date.parse(cutoff);
  assert.ok(Number.isFinite(cutoffMs));
  assert.ok(cutoffMs >= before - 2_000);
  assert.ok(cutoffMs <= after + 2_000);
});

test("OutboxRepository.markFailed updates entry correctly", () => {
  let updatedSql = "";
  let updatedParams: unknown[] = [];

  const conn = {
    prepare: (sql: string) => ({
      run: (...params: unknown[]) => {
        updatedSql = sql;
        updatedParams = params;
        return { changes: 1 };
      },
      get: () => null,
      all: () => [],
    }),
  } as unknown as SqliteConnection;

  const repo = new OutboxRepository(conn);

  repo.markFailed("entry-1", "Connection refused", 3, "2026-04-26T12:00:00Z");

  assert.ok(updatedSql.includes("UPDATE outbox"));
  assert.ok(updatedSql.includes("last_error"));
  assert.ok(updatedSql.includes("retry_count"));
  assert.ok(updatedSql.includes("last_attempt_at"));
  assert.equal(updatedParams[0], "Connection refused");
  assert.equal(updatedParams[1], 3);
  assert.equal(updatedParams[2], "2026-04-26T12:00:00Z");
  assert.equal(updatedParams[3], "entry-1");
});

test("OutboxRepository.markPublished updates published_at", () => {
  let updatedSql = "";
  let updatedParams: unknown[] = [];

  const conn = {
    prepare: (sql: string) => ({
      run: (...params: unknown[]) => {
        updatedSql = sql;
        updatedParams = params;
        return { changes: 1 };
      },
      get: () => null,
      all: () => [],
    }),
  } as unknown as SqliteConnection;

  const repo = new OutboxRepository(conn);

  repo.markPublished("entry-1", "2026-04-26T12:00:00Z");

  assert.ok(updatedSql.includes("UPDATE outbox"));
  assert.ok(updatedSql.includes("published_at"));
  assert.equal(updatedParams[0], "2026-04-26T12:00:00Z");
  assert.equal(updatedParams[1], "entry-1");
});
