/**
 * Unit tests for sqlite-dlq-repository.ts
 *
 * Tests SQLite-backed DLQ persistence for Dead Letter Queue records.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { SqliteDlqRepository } from "../../../../../src/platform/five-plane-state-evidence/events/sqlite-dlq-repository.js";
import type { ExtendedDeadLetterRecord, OperatorActionRecord } from "../../../../../src/platform/five-plane-state-evidence/events/dlq-service.js";
import type { SqliteConnection } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/query-helper.js";

// Mock SqliteConnection for testing
function createMockConnection(): SqliteConnection {
  const storage = new Map<string, Map<string, unknown[]>>();
  const detailsStorage = new Map<string, Map<string, unknown>>();

  const tablesCreated = new Set<string>();

  return {
    exec(sql: string): void {
      const createTableMatch = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/);
      if (createTableMatch) {
        tablesCreated.add(createTableMatch[1]!);
      }
    },
    prepare(sql: string) {
      return {
        run(...params: unknown[]): { changes: number } {
          const tableName = sql.includes("dlq_record_details") ? "dlq_record_details" : "dlq_records";
          if (!storage.has(tableName)) {
            storage.set(tableName, new Map());
          }
          const table = storage.get(tableName)!;

          if (sql.includes("INSERT")) {
            const key = params[0] as string;
            if (table.has(key)) {
              // conflict case
              if (tableName === "dlq_record_details") {
                detailsStorage.set(key, new Map(params as unknown as [string, unknown]));
              } else {
                table.set(key, params as unknown[]);
              }
            } else {
              if (tableName === "dlq_record_details") {
                detailsStorage.set(key, new Map(params as unknown as [string, unknown]));
              } else {
                table.set(key, params as unknown[]);
              }
            }
            return { changes: 1 };
          }
          if (sql.includes("UPDATE")) {
            const key = params[params.length - 1] as string;
            table.set(key, params as unknown[]);
            return { changes: 1 };
          }
          return { changes: 0 };
        },
        all(...params: unknown[]): unknown[] {
          const tableName = sql.includes("dlq_record_details") ? "dlq_record_details" : "dlq_records";
          if (sql.includes("SELECT") && sql.includes("WHERE dead_letter_id IN")) {
            const ids = params as string[];
            const results: unknown[] = [];
            for (const id of ids) {
              const row = detailsStorage.get(id);
              if (row) {
                results.push(Object.fromEntries(row));
              }
            }
            return results;
          }
          if (sql.includes("WHERE")) {
            const key = params[0] as string;
            const row = table.get(key);
            return row ? [Object.fromEntries(new Map(Object.entries(row[0] as Record<string, unknown>).map(([k, v]) => [k.replace(/([A-Z])/g, '_$1').toLowerCase(), v])))] : [];
          }
          const allRows: unknown[] = [];
          table.forEach((rows) => {
            for (const row of rows as unknown[]) {
              allRows.push(Object.fromEntries(new Map(Object.entries(row as Record<string, unknown>).map(([k, v]) => [k.replace(/([A-Z])/g, '_$1').toLowerCase(), v]))));
            }
          });
          return allRows;
        },
      } as ReturnType<SqliteConnection["prepare"]>;
    },
  };
}

function createSampleRecord(overrides?: Partial<ExtendedDeadLetterRecord>): ExtendedDeadLetterRecord {
  const base: ExtendedDeadLetterRecord = {
    deadLetterId: "dlq-001",
    sourceEventId: "evt-123",
    eventType: "TaskExecutionFailed",
    consumerId: "task-consumer",
    errorCode: "EXECUTION_TIMEOUT",
    errorMessage: "Task execution timed out after 300 seconds",
    payloadJson: '{"taskId":"task-456","executionId":"exec-789"}',
    status: "retrying",
    retryCount: 2,
    maxRetries: 5,
    nextRetryAt: "2026-05-21T12:00:00Z",
    createdAt: "2026-05-21T10:00:00Z",
    updatedAt: "2026-05-21T11:00:00Z",
    originalTimestamp: "2026-05-21T09:00:00Z",
    firstFailedAt: "2026-05-21T09:00:00Z",
    lastFailedAt: "2026-05-21T11:00:00Z",
    failureCategory: "timeout",
    reason: "Execution exceeded maximum allowed time",
    retryExhaustedAt: null,
    lastAttemptAt: "2026-05-21T11:00:00Z",
    linkedIncidentId: null,
    operatorActionLog: [],
  };
  return { ...base, ...overrides };
}

test("SqliteDlqRepository inserts record", () => {
  const conn = createMockConnection();
  const repo = new SqliteDlqRepository(conn);

  const record = createSampleRecord();
  repo.insert(record);

  const found = repo.findById("dlq-001");
  assert.ok(found !== null, "Record should be found after insert");
  assert.equal(found?.deadLetterId, "dlq-001");
  assert.equal(found?.sourceEventId, "evt-123");
});

test("SqliteDlqRepository findById returns null for non-existent record", () => {
  const conn = createMockConnection();
  const repo = new SqliteDlqRepository(conn);

  const found = repo.findById("non-existent");
  assert.equal(found, null);
});

test("SqliteDlqRepository updates existing record", () => {
  const conn = createMockConnection();
  const repo = new SqliteDlqRepository(conn);

  const record = createSampleRecord({ retryCount: 1 });
  repo.insert(record);

  const updated = createSampleRecord({ retryCount: 3, status: "dead" });
  repo.update(updated);

  const found = repo.findById("dlq-001");
  assert.ok(found !== null);
  assert.equal(found?.retryCount, 3);
  assert.equal(found?.status, "dead");
});

test("SqliteDlqRepository update inserts if not exists", () => {
  const conn = createMockConnection();
  const repo = new SqliteDlqRepository(conn);

  const record = createSampleRecord();
  repo.update(record);

  const found = repo.findById("dlq-001");
  assert.ok(found !== null);
  assert.equal(found?.deadLetterId, "dlq-001");
});

test("SqliteDlqRepository listAll returns all records", () => {
  const conn = createMockConnection();
  const repo = new SqliteDlqRepository(conn);

  repo.insert(createSampleRecord({ deadLetterId: "dlq-001" }));
  repo.insert(createSampleRecord({ deadLetterId: "dlq-002" }));
  repo.insert(createSampleRecord({ deadLetterId: "dlq-003" }));

  const all = repo.listAll();
  assert.equal(all.length, 3);
});

test("SqliteDlqRepository listByConsumer returns filtered records", () => {
  const conn = createMockConnection();
  const repo = new SqliteDlqRepository(conn);

  repo.insert(createSampleRecord({ deadLetterId: "dlq-001", consumerId: "consumer-a" }));
  repo.insert(createSampleRecord({ deadLetterId: "dlq-002", consumerId: "consumer-b" }));
  repo.insert(createSampleRecord({ deadLetterId: "dlq-003", consumerId: "consumer-a" }));

  const consumerARecords = repo.listByConsumer("consumer-a");
  assert.equal(consumerARecords.length, 2);
  assert.ok(consumerARecords.every((r) => r.consumerId === "consumer-a"));
});

test("SqliteDlqRepository listByConsumer returns empty for unknown consumer", () => {
  const conn = createMockConnection();
  const repo = new SqliteDlqRepository(conn);

  const records = repo.listByConsumer("unknown-consumer");
  assert.equal(records.length, 0);
});

test("SqliteDlqRepository listRetryable filters by status and next_retry_at", () => {
  const conn = createMockConnection();
  const repo = new SqliteDlqRepository(conn);

  const now = "2026-05-21T12:00:00Z";
  repo.insert(createSampleRecord({
    deadLetterId: "dlq-retryable-1",
    status: "retrying",
    nextRetryAt: "2026-05-21T11:00:00Z", // in the past, should be retryable
  }));
  repo.insert(createSampleRecord({
    deadLetterId: "dlq-retryable-2",
    status: "retrying",
    nextRetryAt: "2026-05-21T13:00:00Z", // in the future, should not be retryable
  }));
  repo.insert(createSampleRecord({
    deadLetterId: "dlq-dead",
    status: "dead",
    nextRetryAt: "2026-05-21T11:00:00Z",
  }));

  const retryable = repo.listRetryable(now);
  assert.equal(retryable.length, 1);
  assert.equal(retryable[0]?.deadLetterId, "dlq-retryable-1");
});

test("SqliteDlqRepository constructor ensures schema", () => {
  const conn = createMockConnection();
  let execCalled = false;
  const trackingConn = {
    ...conn,
    exec(sql: string): void {
      execCalled = true;
      conn.exec(sql);
    },
  };

  new SqliteDlqRepository(trackingConn as SqliteConnection);
  assert.ok(execCalled, "exec should be called to create schema");
});

test("SqliteDlqRepository stores operator action log as JSON", () => {
  const conn = createMockConnection();
  const repo = new SqliteDlqRepository(conn);

  const operatorLog: OperatorActionRecord[] = [
    {
      actionId: "action-1",
      operatorId: "op-123",
      action: "retry",
      timestamp: "2026-05-21T10:00:00Z",
      reason: "Manual retry requested",
    },
    {
      actionId: "action-2",
      operatorId: "op-456",
      action: "acknowledge",
      timestamp: "2026-05-21T11:00:00Z",
      reason: "Acknowledged by operator",
    },
  ];

  const record = createSampleRecord({
    operatorActionLog: operatorLog,
  });

  repo.insert(record);

  const found = repo.findById("dlq-001");
  assert.ok(found !== null);
  assert.equal(found?.operatorActionLog.length, 2);
  assert.equal(found?.operatorActionLog[0]?.actionId, "action-1");
  assert.equal(found?.operatorActionLog[1]?.actionId, "action-2");
});

test("SqliteDlqRepository rowToRecord handles missing details", () => {
  const conn = createMockConnection();
  const repo = new SqliteDlqRepository(conn);

  // Insert base record without details
  const record = createSampleRecord();
  repo.insert(record);

  const found = repo.findById("dlq-001");
  assert.ok(found !== null);
  // When details are missing, eventType falls back to errorCode
  assert.equal(found?.eventType, "EXECUTION_TIMEOUT");
  // operatorActionLog should default to empty array
  assert.ok(Array.isArray(found?.operatorActionLog));
  assert.equal(found?.operatorActionLog.length, 0);
});