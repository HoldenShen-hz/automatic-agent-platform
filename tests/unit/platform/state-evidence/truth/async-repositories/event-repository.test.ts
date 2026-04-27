// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";

import { AsyncEventRepository } from "../../../../../../src/platform/state-evidence/truth/async-repositories/event-repository.js";
import type { AsyncSqlConnection, AsyncQueryResult } from "../../../../../../src/platform/state-evidence/truth/async-sql-database.js";

type SqlCall = {
  method: "query" | "queryOne" | "execute";
  sql: string;
  params: unknown[];
};

function createConnection(options: {
  queryRows?: unknown[][];
  queryOneRows?: unknown[];
  executeResults?: number[];
} = {}) {
  const calls: SqlCall[] = [];
  let queryIndex = 0;
  let queryOneIndex = 0;
  let executeIndex = 0;

  const connection: AsyncSqlConnection = {
    async query<T>(sql: string, ...params: unknown[]): Promise<AsyncQueryResult<T>> {
      calls.push({ method: "query", sql, params });
      const rows = (options.queryRows?.[queryIndex++] ?? []) as T[];
      return { rows, rowCount: rows.length, changes: rows.length };
    },
    async queryOne<T>(sql: string, ...params: unknown[]): Promise<T | undefined> {
      calls.push({ method: "queryOne", sql, params });
      return options.queryOneRows?.[queryOneIndex++] as T | undefined;
    },
    async execute(sql: string, ...params: unknown[]): Promise<number> {
      calls.push({ method: "execute", sql, params });
      return options.executeResults?.[executeIndex++] ?? 1;
    },
  };

  return { connection, calls };
}

const now = "2026-04-26T10:00:00.000Z";

function eventRecord(overrides: Partial<import("../../../../../../src/platform/contracts/types/domain.js").EventRecord> = {}): import("../../../../../../src/platform/contracts/types/domain.js").EventRecord {
  return {
    id: "evt-1",
    taskId: "task-1",
    sessionId: null,
    executionId: null,
    eventType: "task.started",
    eventTier: "tier_1",
    payloadJson: '{"key":"value"}',
    traceId: null,
    createdAt: now,
    ...overrides,
  };
}

// ─── insertEvent ─────────────────────────────────────────────────────────────

test("insertEvent executes INSERT with event fields", async () => {
  const { connection, calls } = createConnection();
  const repo = new AsyncEventRepository(connection);

  const record = eventRecord();
  await repo.insertEvent(record);

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "execute");
  assert.ok(calls[0]!.sql.includes("INSERT INTO events"));
  assert.deepEqual(calls[0]!.params.slice(0, 9), [
    "evt-1",
    "task-1",
    null,
    null,
    "task.started",
    "tier_1",
    '{"key":"value"}',
    null,
    now,
  ]);
});

test("insertEvent generates eventTier from eventType when not provided", async () => {
  const { connection, calls } = createConnection();
  const repo = new AsyncEventRepository(connection);

  const record = eventRecord({ eventTier: undefined as any });
  await repo.insertEvent(record);

  // The repo calls getEventTier to determine tier
  assert.equal(calls[0]!.method, "execute");
});

test("insertEvent returns the event record", async () => {
  const { connection } = createConnection();
  const repo = new AsyncEventRepository(connection);

  const record = eventRecord();
  const result = await repo.insertEvent(record);

  assert.equal(result.id, "evt-1");
  assert.equal(result.eventType, "task.started");
});

// ─── insertEventDeadLetter ───────────────────────────────────────────────────

test("insertEventDeadLetter executes INSERT with dead letter fields", async () => {
  const { connection, calls } = createConnection();
  const repo = new AsyncEventRepository(connection);

  await repo.insertEventDeadLetter({
    id: "dl-1",
    originalEventId: "evt-1",
    eventType: "task.started",
    payloadJson: '{"error":"failed"}',
    consumerId: "consumer-1",
    failureCount: 3,
    lastError: "connection timeout",
    deadLetteredAt: now,
    reprocessedAt: null,
    reprocessResult: null,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "execute");
  assert.ok(calls[0]!.sql.includes("INSERT INTO event_dead_letters"));
  assert.deepEqual(calls[0]!.params.slice(0, 5), [
    "dl-1",
    "evt-1",
    "task.started",
    '{"error":"failed"}',
    "consumer-1",
  ]);
});

// ─── listEventDeadLetters ────────────────────────────────────────────────────

test("listEventDeadLetters queries with default limit", async () => {
  const { connection, calls } = createConnection({ queryRows: [[]] });
  const repo = new AsyncEventRepository(connection);

  await repo.listEventDeadLetters();

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "query");
  assert.ok(calls[0]!.sql.includes("ORDER BY dead_lettered_at DESC"));
});

test("listEventDeadLetters uses custom limit", async () => {
  const { connection, calls } = createConnection({ queryRows: [[]] });
  const repo = new AsyncEventRepository(connection);

  await repo.listEventDeadLetters(50);

  assert.ok(calls[0]!.sql.includes("LIMIT $"));
  assert.ok(calls[0]!.params.includes(50));
});

test("listEventDeadLetters applies cursor for pagination", async () => {
  const { connection, calls } = createConnection({ queryRows: [[]] });
  const repo = new AsyncEventRepository(connection);

  await repo.listEventDeadLetters(100, "2026-04-25T00:00:00.000Z");

  assert.ok(calls[0]!.sql.includes("WHERE dead_lettered_at < $"));
  assert.ok(calls[0]!.params.includes("2026-04-25T00:00:00.000Z"));
});

// ─── listEventsByType ─────────────────────────────────────────────────────────

test("listEventsByType queries with event type", async () => {
  const { connection, calls } = createConnection({ queryRows: [[eventRecord()]] });
  const repo = new AsyncEventRepository(connection);

  await repo.listEventsByType("task.started");

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "query");
  assert.ok(calls[0]!.sql.includes("WHERE event_type = $1"));
  assert.deepEqual(calls[0]!.params, ["task.started"]);
});

test("listEventsByType applies optional limit", async () => {
  const { connection, calls } = createConnection({ queryRows: [[]] });
  const repo = new AsyncEventRepository(connection);

  await repo.listEventsByType("task.started", 10);

  assert.ok(calls[0]!.sql.includes("LIMIT $2"));
});

// ─── insertEventConsumerAck ───────────────────────────────────────────────────

test("insertEventConsumerAck executes INSERT with ack fields", async () => {
  const { connection, calls } = createConnection();
  const repo = new AsyncEventRepository(connection);

  await repo.insertEventConsumerAck({
    id: "ack-1",
    eventId: "evt-1",
    consumerId: "consumer-1",
    status: "pending",
    lastAttemptAt: null,
    ackedAt: null,
    errorCode: null,
    attemptCount: 0,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "execute");
  assert.ok(calls[0]!.sql.includes("INSERT INTO event_consumer_acks"));
  assert.deepEqual(calls[0]!.params.slice(0, 4), [
    "ack-1",
    "evt-1",
    "consumer-1",
    "pending",
  ]);
});

// ─── markEventAck ─────────────────────────────────────────────────────────────

test("markEventAck updates ack status", async () => {
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncEventRepository(connection);

  await repo.markEventAck("evt-1", "consumer-1", "acked", now, null);

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "execute");
  assert.ok(calls[0]!.sql.includes("UPDATE event_consumer_acks"));
  assert.ok(calls[0]!.sql.includes("status = $1"));
});

test("markEventAck includes error code when provided", async () => {
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncEventRepository(connection);

  await repo.markEventAck("evt-1", "consumer-1", "failed", now, "ERR_TIMEOUT");

  assert.ok(calls[0]!.sql.includes("error_code = $3"));
});

// ─── markEventDeadLettered ───────────────────────────────────────────────────

test("markEventDeadLettered updates status to dead_lettered", async () => {
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncEventRepository(connection);

  await repo.markEventDeadLettered({
    eventId: "evt-1",
    consumerId: "consumer-1",
    occurredAt: now,
    errorCode: "ERR_DEAD_LETTERED",
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "execute");
  assert.ok(calls[0]!.sql.includes("UPDATE event_consumer_acks"));
  assert.ok(calls[0]!.sql.includes("status = 'dead_lettered'"));
});

// ─── getEventConsumerAck ─────────────────────────────────────────────────────

test("getEventConsumerAck queries with event and consumer IDs", async () => {
  const { connection, calls } = createConnection({
    queryOneRows: [{
      id: "ack-1",
      eventId: "evt-1",
      consumerId: "consumer-1",
      status: "acked",
      lastAttemptAt: now,
      ackedAt: now,
      errorCode: null,
      attemptCount: 1,
    }],
  });
  const repo = new AsyncEventRepository(connection);

  const result = await repo.getEventConsumerAck("evt-1", "consumer-1");

  assert.equal(calls.length, 1);
  assert.ok(calls[0]!.sql.includes("WHERE event_id = $1 AND consumer_id = $2"));
  assert.equal(result?.consumerId, "consumer-1");
});

test("getEventConsumerAck returns null when not found", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncEventRepository(connection);

  const result = await repo.getEventConsumerAck("evt-none", "consumer-none");

  assert.equal(result, null);
});

// ─── getRequiredConsumerIds ───────────────────────────────────────────────────

test("getRequiredConsumerIds queries consumer IDs for event", async () => {
  const { connection, calls } = createConnection({
    queryRows: [[{ consumerId: "consumer-1" }, { consumerId: "consumer-2" }]],
  });
  const repo = new AsyncEventRepository(connection);

  const result = await repo.getRequiredConsumerIds("evt-1");

  assert.equal(calls.length, 1);
  assert.ok(calls[0]!.sql.includes("SELECT consumer_id"));
  assert.deepEqual(result, ["consumer-1", "consumer-2"]);
});

// ─── ackAllConsumersForEvent ─────────────────────────────────────────────────

test("ackAllConsumersForEvent updates all pending/failed acks", async () => {
  const { connection, calls } = createConnection({ executeResults: [5] });
  const repo = new AsyncEventRepository(connection);

  await repo.ackAllConsumersForEvent("evt-1", now);

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "execute");
  assert.ok(calls[0]!.sql.includes("UPDATE event_consumer_acks"));
  assert.ok(calls[0]!.sql.includes("status = 'acked'"));
  assert.ok(calls[0]!.sql.includes("WHERE event_id = $3"));
});

// ─── listEventsForTask ────────────────────────────────────────────────────────

test("listEventsForTask with number limit", async () => {
  const { connection, calls } = createConnection({ queryRows: [[eventRecord()]] });
  const repo = new AsyncEventRepository(connection);

  await repo.listEventsForTask("task-1", 50);

  assert.equal(calls.length, 1);
  assert.ok(calls[0]!.sql.includes("LIMIT $2"));
});

test("listEventsForTask with tenant ID", async () => {
  const { connection, calls } = createConnection({ queryRows: [[]] });
  const repo = new AsyncEventRepository(connection);

  await repo.listEventsForTask("task-1", "tenant-123");

  assert.ok(calls[0]!.sql.includes("INNER JOIN tasks t ON"));
  assert.ok(calls[0]!.sql.includes("tenant_id = $2"));
});

test("listEventsForTask without tenant or limit", async () => {
  const { connection, calls } = createConnection({ queryRows: [[]] });
  const repo = new AsyncEventRepository(connection);

  await repo.listEventsForTask("task-1");

  assert.ok(calls[0]!.sql.includes("WHERE task_id = $1"));
  assert.ok(!calls[0]!.sql.includes("INNER JOIN tasks"));
});

// ─── getEvent ─────────────────────────────────────────────────────────────────

test("getEvent queries by event ID", async () => {
  const { connection, calls } = createConnection({
    queryOneRows: [eventRecord()],
  });
  const repo = new AsyncEventRepository(connection);

  await repo.getEvent("evt-1");

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "queryOne");
  assert.ok(calls[0]!.sql.includes("WHERE id = $1"));
  assert.deepEqual(calls[0]!.params, ["evt-1"]);
});

test("getEvent returns null when not found", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncEventRepository(connection);

  const result = await repo.getEvent("nonexistent");

  assert.equal(result, null);
});

// ─── countPendingTier1Acks ────────────────────────────────────────────────────

test("countPendingTier1Acks queries count of pending tier 1 acks", async () => {
  const { connection, calls } = createConnection({
    queryOneRows: [{ count: 42 }],
  });
  const repo = new AsyncEventRepository(connection);

  const count = await repo.countPendingTier1Acks();

  assert.equal(calls.length, 1);
  assert.ok(calls[0]!.sql.includes("COUNT(*)"));
  assert.ok(calls[0]!.sql.includes("event_tier = 'tier_1'"));
  assert.ok(calls[0]!.sql.includes("status = 'pending'"));
  assert.equal(count, 42);
});

// ─── countFailedTier1Acks ────────────────────────────────────────────────────

test("countFailedTier1Acks queries count of failed tier 1 acks", async () => {
  const { connection, calls } = createConnection({
    queryOneRows: [{ count: 7 }],
  });
  const repo = new AsyncEventRepository(connection);

  const count = await repo.countFailedTier1Acks();

  assert.equal(calls.length, 1);
  assert.ok(calls[0]!.sql.includes("status = 'failed'"));
  assert.equal(count, 7);
});