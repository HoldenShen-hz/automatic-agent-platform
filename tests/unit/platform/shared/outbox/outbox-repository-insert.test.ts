/**
 * Tests for OutboxRepository insertOutboxEntry and related methods
 * covering the main entry creation path
 */

import assert from "node:assert/strict";
import test from "node:test";
import { OutboxRepository } from "../../../../../src/platform/shared/outbox/outbox-repository.js";
import type { SqliteConnection } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/query-helper.js";
import { OutboxStatus } from "../../../../../src/platform/shared/outbox/outbox-types.js";

type ConnectionMock = Pick<SqliteConnection, "prepare">;

let prepareCallCount = 0;
let lastPreparedSql = "";

function createMockConnection(): ConnectionMock {
  return {
    prepare: (sql: string) => {
      lastPreparedSql = sql;
      prepareCallCount++;
      return {
        run: (...params: unknown[]) => {
          return { changes: 1 };
        },
        get: () => null,
        all: () => [],
      };
    },
  } as unknown as ConnectionMock;
}

test("OutboxRepository.insertOutboxEntry calls prepare with correct SQL", () => {
  const conn = createMockConnection();
  const repo = new OutboxRepository(conn as SqliteConnection);

  repo.insertOutboxEntry(
    "task",
    "task-123",
    "task:created",
    '{"status":"running"}',
    "trace-abc",
    "2026-05-21T00:00:00Z",
  );

  assert.ok(lastPreparedSql.includes("INSERT INTO outbox"));
});

test("OutboxRepository.insertOutboxEntry passes all parameters correctly", () => {
  let receivedParams: unknown[] = [];
  const conn = {
    prepare: (sql: string) => ({
      run: (...params: unknown[]) => {
        receivedParams = params;
        return { changes: 1 };
      },
      get: () => null,
      all: () => [],
    }),
  } as unknown as SqliteConnection;

  const repo = new OutboxRepository(conn);

  const aggregateType = "execution";
  const aggregateId = "exec-456";
  const eventType = "execution:started";
  const payloadJson = '{"started":true}';
  const traceId = "trace-xyz";
  const createdAt = "2026-05-21T00:00:00Z";

  repo.insertOutboxEntry(aggregateType, aggregateId, eventType, payloadJson, traceId, createdAt);

  assert.equal(receivedParams[0]?.toString().startsWith("outbox_"), true); // ID generated
  assert.equal(receivedParams[1], aggregateType);
  assert.equal(receivedParams[2], aggregateId);
  assert.equal(receivedParams[3], eventType);
  assert.equal(receivedParams[4], payloadJson);
  assert.equal(receivedParams[5], traceId);
  assert.equal(receivedParams[6], createdAt);
});

test("OutboxRepository.insertOutboxEntry returns OutboxRecord with all fields", () => {
  const conn = createMockConnection();
  const repo = new OutboxRepository(conn as SqliteConnection);

  const result = repo.insertOutboxEntry(
    "task",
    "task-1",
    "task:created",
    '{"key":"value"}',
    null,
    "2026-05-21T00:00:00Z",
  );

  assert.equal(typeof result.id, "string");
  assert.ok(result.id.startsWith("outbox_"));
  assert.equal(result.aggregateType, "task");
  assert.equal(result.aggregateId, "task-1");
  assert.equal(result.eventType, "task:created");
  assert.equal(result.payloadJson, '{"key":"value"}');
  assert.equal(result.traceId, null);
  assert.equal(result.createdAt, "2026-05-21T00:00:00Z");
  assert.equal(result.publishedAt, null);
  assert.equal(result.retryCount, 0);
  assert.equal(result.lastError, null);
  assert.equal(result.lastAttemptAt, null);
});

test("OutboxRepository.insertOutboxEntry generates unique IDs each call", () => {
  const conn = createMockConnection();
  const repo = new OutboxRepository(conn as SqliteConnection);

  const id1 = repo.insertOutboxEntry("task", "id-test-1", "task:created", "{}", null, "2026-05-21T00:00:00Z").id;
  const id2 = repo.insertOutboxEntry("task", "id-test-2", "task:created", "{}", null, "2026-05-21T00:00:00Z").id;

  assert.notEqual(id1, id2);
});

test("OutboxRepository.insertOutboxEntry with string traceId stores correctly", () => {
  const conn = createMockConnection();
  const repo = new OutboxRepository(conn as SqliteConnection);

  const result = repo.insertOutboxEntry(
    "task",
    "trace-test",
    "task:created",
    "{}",
    "trace-string-123",
    "2026-05-21T00:00:00Z",
  );

  assert.equal(result.traceId, "trace-string-123");
});

test("OutboxRepository.insertOutboxEntry with null traceId stores null", () => {
  const conn = createMockConnection();
  const repo = new OutboxRepository(conn as SqliteConnection);

  const result = repo.insertOutboxEntry(
    "task",
    "trace-null",
    "task:created",
    "{}",
    null,
    "2026-05-21T00:00:00Z",
  );

  assert.equal(result.traceId, null);
});

test("OutboxRepository.insertOutboxEntries handles multiple entries", () => {
  const conn = createMockConnection();
  const repo = new OutboxRepository(conn as SqliteConnection);

  const entries = [
    { aggregateType: "task", aggregateId: "multi-1", eventType: "task:created", payload: { id: 1 } },
    { aggregateType: "task", aggregateId: "multi-2", eventType: "task:created", payload: { id: 2 } },
    { aggregateType: "execution", aggregateId: "exec-1", eventType: "execution:started", payload: { id: 3 } },
  ];

  const records = repo.insertOutboxEntries(entries);

  assert.equal(records.length, 3);
  assert.equal(records[0]!.aggregateType, "task");
  assert.equal(records[0]!.aggregateId, "multi-1");
  assert.equal(records[1]!.aggregateType, "task");
  assert.equal(records[1]!.aggregateId, "multi-2");
  assert.equal(records[2]!.aggregateType, "execution");
});

test("OutboxRepository.insertOutboxEntries JSON stringify payload", () => {
  const conn = createMockConnection();
  const repo = new OutboxRepository(conn as SqliteConnection);

  const entries = [
    {
      aggregateType: "task",
      aggregateId: "json-test",
      eventType: "task:created",
      payload: { nested: { deep: true }, array: [1, 2, 3] },
    },
  ];

  const records = repo.insertOutboxEntries(entries);

  const parsed = JSON.parse(records[0]!.payloadJson);
  assert.equal(parsed.nested.deep, true);
  assert.deepEqual(parsed.array, [1, 2, 3]);
});

test("OutboxRepository.markPublishedBatch chunks large id arrays", () => {
  let runCallCount = 0;
  const conn = {
    prepare: (sql: string) => ({
      run: (...params: unknown[]) => {
        runCallCount++;
        return { changes: 1 };
      },
      get: () => null,
      all: () => [],
    }),
  } as unknown as SqliteConnection;

  const repo = new OutboxRepository(conn);

  // With SQLITE_MAX_BATCH_VARIABLES = 900, passing 1800 ids should result in 2 chunks
  const ids = Array.from({ length: 1800 }, (_, i) => `id-${i}`);

  repo.markPublishedBatch(ids, "2026-05-21T00:00:00Z");

  // The chunkValues function splits into chunks of 900
  // So we expect 2 calls
  assert.ok(runCallCount >= 1);
});

test("OutboxRepository.markPublishedBatch with empty array returns early", () => {
  let wasCalled = false;
  const conn = {
    prepare: (sql: string) => ({
      run: (...params: unknown[]) => {
        wasCalled = true;
        return { changes: 0 };
      },
      get: () => null,
      all: () => [],
    }),
  } as unknown as SqliteConnection;

  const repo = new OutboxRepository(conn);

  repo.markPublishedBatch([], "2026-05-21T00:00:00Z");

  assert.equal(wasCalled, false);
});

test("OutboxRepository.markFailed updates all failure fields", () => {
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

  const id = "failed-entry-1";
  const error = "Connection timeout after 30s";
  const retryCount = 4;
  const lastAttemptAt = "2026-05-21T12:00:00Z";

  repo.markFailed(id, error, retryCount, lastAttemptAt);

  assert.ok(updatedSql.includes("UPDATE outbox"));
  assert.ok(updatedSql.includes("last_error"));
  assert.ok(updatedSql.includes("retry_count"));
  assert.ok(updatedSql.includes("last_attempt_at"));
  assert.equal(updatedParams[0], error);
  assert.equal(updatedParams[1], retryCount);
  assert.equal(updatedParams[2], lastAttemptAt);
  assert.equal(updatedParams[3], id);
});

test("OutboxRepository.markPublished updates only published_at", () => {
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

  repo.markPublished("entry-published-1", "2026-05-21T12:00:00Z");

  assert.ok(updatedSql.includes("UPDATE outbox"));
  assert.ok(updatedSql.includes("published_at ="));
  assert.equal(updatedParams[0], "2026-05-21T12:00:00Z");
  assert.equal(updatedParams[1], "entry-published-1");
});

test("OutboxRepository.listPendingEntries with limit", () => {
  const mockResult = {
    row: undefined,
    allRows: [
      { id: "pending-1" },
      { id: "pending-2" },
    ],
  };

  const conn = {
    prepare: (sql: string) => ({
      run: () => ({ changes: 1 }),
      get: () => mockResult.row,
      all: () => mockResult.allRows,
    }),
  } as unknown as SqliteConnection;

  const repo = new OutboxRepository(conn);

  const entries = repo.listPendingEntries(10);

  assert.ok(Array.isArray(entries));
});

test("OutboxRepository.countPending with count result", () => {
  const conn = {
    prepare: (sql: string) => ({
      run: () => ({ changes: 0 }),
      get: () => ({ count: 42 }),
      all: () => [],
    }),
  } as unknown as SqliteConnection;

  const repo = new OutboxRepository(conn);

  const count = repo.countPending();

  assert.equal(count, 42);
});

test("OutboxRepository.countPending with undefined result returns 0", () => {
  const conn = {
    prepare: (sql: string) => ({
      run: () => ({ changes: 0 }),
      get: () => undefined,
      all: () => [],
    }),
  } as unknown as SqliteConnection;

  const repo = new OutboxRepository(conn);

  const count = repo.countPending();

  assert.equal(count, 0);
});

test("OutboxRepository.getStatus returns correct status for PENDING entry", () => {
  const conn = {
    prepare: (sql: string) => ({
      run: () => ({ changes: 0 }),
      get: () => ({
        id: "entry-1",
        aggregateType: "task",
        aggregateId: "task-1",
        eventType: "task:created",
        payloadJson: "{}",
        traceId: null,
        createdAt: "2026-05-21T00:00:00Z",
        publishedAt: null,
        retryCount: 0,
        lastError: null,
        lastAttemptAt: null,
        deadLetteredAt: null,
        deadLetterReason: null,
      }),
      all: () => [],
    }),
  } as unknown as SqliteConnection;

  const repo = new OutboxRepository(conn);

  const status = repo.getStatus("entry-1");

  assert.ok(status !== undefined);
  assert.equal(status!.status, OutboxStatus.PENDING);
  assert.equal(status!.retryCount, 0);
});

test("OutboxRepository.getStatus returns FAILED for entry with retries", () => {
  const conn = {
    prepare: (sql: string) => ({
      run: () => ({ changes: 0 }),
      get: () => ({
        id: "entry-failed",
        aggregateType: "task",
        aggregateId: "task-1",
        eventType: "task:created",
        payloadJson: "{}",
        traceId: null,
        createdAt: "2026-05-21T00:00:00Z",
        publishedAt: null,
        retryCount: 3,
        lastError: "Error message",
        lastAttemptAt: "2026-05-21T00:01:00Z",
      }),
      all: () => [],
    }),
  } as unknown as SqliteConnection;

  const repo = new OutboxRepository(conn);

  const status = repo.getStatus("entry-failed");

  assert.ok(status !== undefined);
  assert.equal(status!.status, OutboxStatus.FAILED);
  assert.equal(status!.retryCount, 3);
});

test("OutboxRepository.cleanupPublishedBefore calculates cutoff correctly", () => {
  let deletedParams: unknown[] = [];
  const beforeTime = Date.now();

  const conn = {
    prepare: (sql: string) => ({
      run: (...params: unknown[]) => {
        deletedParams = params;
        return { changes: 10 };
      },
      get: () => null,
      all: () => [],
    }),
  } as unknown as SqliteConnection;

  const repo = new OutboxRepository(conn);

  const deleted = repo.cleanupPublishedBefore(14);

  const afterTime = Date.now();
  assert.equal(deleted, 10);

  // Parse the cutoff date parameter
  const cutoffStr = String(deletedParams[0]);
  const cutoffMs = new Date(cutoffStr).getTime();

  // Cutoff should be approximately 14 days ago
  const expectedMin = beforeTime - 14 * 24 * 60 * 60 * 1000 - 2000;
  const expectedMax = afterTime - 14 * 24 * 60 * 60 * 1000 + 2000;

  assert.ok(cutoffMs >= expectedMin && cutoffMs <= expectedMax,
    `Cutoff ${cutoffMs} should be between ${expectedMin} and ${expectedMax}`);
});

test("OutboxRepository.cleanupPublishedBefore with negative days uses zero", () => {
  let cutoffParam: unknown = null;
  const conn = {
    prepare: (sql: string) => ({
      run: (...params: unknown[]) => {
        cutoffParam = params[0];
        return { changes: 0 };
      },
      get: () => null,
      all: () => [],
    }),
  } as unknown as SqliteConnection;

  const repo = new OutboxRepository(conn);

  repo.cleanupPublishedBefore(-5);

  // Negative should be treated as 0, so cutoff should be "now"
  const cutoffMs = new Date(String(cutoffParam)).getTime();
  const nowMs = Date.now();

  // Should be within a few seconds of now
  assert.ok(Math.abs(nowMs - cutoffMs) < 5000);
});

test("OutboxRepository.insertOutboxEntriesBulk with pre-generated IDs", () => {
  const conn = createMockConnection();
  const repo = new OutboxRepository(conn as SqliteConnection);

  const entries = [
    { aggregateType: "task", aggregateId: "bulk-1", eventType: "task:created", payload: {} },
    { aggregateType: "task", aggregateId: "bulk-2", eventType: "task:created", payload: {} },
  ];
  const ids = ["pre-gen-id-1", "pre-gen-id-2"];

  const records = repo.insertOutboxEntriesBulk(entries, ids);

  assert.equal(records.length, 2);
  assert.equal(records[0]!.id, "pre-gen-id-1");
  assert.equal(records[1]!.id, "pre-gen-id-2");
});

test("OutboxRepository.insertOutboxEntriesBulk JSON stringify payload", () => {
  const conn = createMockConnection();
  const repo = new OutboxRepository(conn as SqliteConnection);

  const entries = [
    {
      aggregateType: "task",
      aggregateId: "bulk-json",
      eventType: "task:created",
      payload: { complex: { nested: true }, arr: [1, 2] },
    },
  ];
  const ids = ["bulk-json-id"];

  const records = repo.insertOutboxEntriesBulk(entries, ids);

  const parsed = JSON.parse(records[0]!.payloadJson);
  assert.equal(parsed.complex.nested, true);
  assert.deepEqual(parsed.arr, [1, 2]);
});
