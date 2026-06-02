import assert from "node:assert/strict";
import test from "node:test";

import { AsyncEventRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/async-repositories/event-repository.js";
import type { AsyncSqlConnection, AsyncQueryResult } from "../../../../../src/platform/five-plane-state-evidence/truth/async-sql-database.js";
import type { EventRecord, EventConsumerAckRecord, EventDeadLetterRecord } from "../../../../../src/platform/contracts/types/domain.js";

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

const now = "2026-04-20T10:00:00.000Z";

test("AsyncEventRepository insertEventDeadLetter inserts dead letter record", async () => {
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncEventRepository(connection);

  await repo.insertEventDeadLetter({
    id: "dl-1",
    originalEventId: "event-1",
    eventType: "task:status_changed",
    payloadJson: '{"error":"boom"}',
    consumerId: "consumer-1",
    failureCount: 3,
    lastError: "projection.failed",
    deadLetteredAt: now,
    reprocessedAt: null,
    reprocessResult: null,
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO event_dead_letters/);
  assert.deepEqual(calls[0]!.params, [
    "dl-1", "event-1", "task:status_changed", '{"error":"boom"}', "consumer-1",
    3, "projection.failed", now, null, null,
  ]);
});

test("AsyncEventRepository listEventDeadLetters returns dead letters with default limit", async () => {
  const deadLetter: EventDeadLetterRecord = {
    id: "dl-1",
    originalEventId: "event-1",
    eventType: "task:status_changed",
    payloadJson: "{}",
    consumerId: "consumer-1",
    failureCount: 2,
    lastError: "boom",
    deadLetteredAt: now,
    reprocessedAt: null,
    reprocessResult: null,
  };
  const { connection, calls } = createConnection({ queryRows: [[deadLetter]] });
  const repo = new AsyncEventRepository(connection);

  const result = await repo.listEventDeadLetters();

  assert.deepEqual(result, {
    records: [deadLetter],
    hasMore: false,
    nextCursor: null,
    limit: 100,
  });
  assert.match(calls[0]!.sql, /FROM event_dead_letters/);
  assert.match(calls[0]!.sql, /ORDER BY dead_lettered_at DESC, id DESC/);
  assert.deepEqual(calls[0]!.params, [101]);
});

test("AsyncEventRepository listEventDeadLetters respects custom limit and cursor", async () => {
  const deadLetter: EventDeadLetterRecord = {
    id: "dl-2",
    originalEventId: "event-2",
    eventType: "task:created",
    payloadJson: "{}",
    consumerId: "consumer-2",
    failureCount: 1,
    lastError: "timeout",
    deadLetteredAt: "2026-04-20T12:00:00.000Z",
    reprocessedAt: null,
    reprocessResult: null,
  };
  const { connection, calls } = createConnection({ queryRows: [[deadLetter]] });
  const repo = new AsyncEventRepository(connection);

  const result = await repo.listEventDeadLetters(25, {
    deadLetteredAt: "2026-04-20T11:00:00.000Z",
    id: "dl-9",
  });

  assert.deepEqual(result, {
    records: [deadLetter],
    hasMore: false,
    nextCursor: null,
    limit: 25,
  });
  assert.match(calls[0]!.sql, /WHERE \(dead_lettered_at < \$1 OR \(dead_lettered_at = \$1 AND id < \$2\)\)/);
  assert.deepEqual(calls[0]!.params, ["2026-04-20T11:00:00.000Z", "dl-9", 26]);
});

test("AsyncEventRepository listEventsByType returns events filtered by type without limit", async () => {
  const event: EventRecord = {
    id: "event-1",
    taskId: "task-1",
    sessionId: null,
    executionId: null,
    eventType: "task:created",
    eventTier: "tier_1",
    payloadJson: "{}",
    traceId: "trace-1",
    createdAt: now,
  };
  const { connection, calls } = createConnection({ queryRows: [[event], [event]] });
  const repo = new AsyncEventRepository(connection);

  const result = await repo.listEventsByType("task:created");

  assert.deepEqual(result, [event]);
  assert.match(calls[0]!.sql, /WHERE event_type = \$1/);
  assert.match(calls[0]!.sql, /ORDER BY created_at DESC/);
  assert.doesNotMatch(calls[0]!.sql, /LIMIT/);
});

test("AsyncEventRepository listEventsByType respects limit parameter", async () => {
  const event: EventRecord = {
    id: "event-1",
    taskId: "task-1",
    sessionId: null,
    executionId: null,
    eventType: "task:created",
    eventTier: "tier_1",
    payloadJson: "{}",
    traceId: "trace-1",
    createdAt: now,
  };
  const { connection, calls } = createConnection({ queryRows: [[event]] });
  const repo = new AsyncEventRepository(connection);

  const result = await repo.listEventsByType("task:created", 5);

  assert.deepEqual(result, [event]);
  assert.match(calls[0]!.sql, /LIMIT \$2/);
  assert.deepEqual(calls[0]!.params, ["task:created", 5]);
});

test("AsyncEventRepository insertEventConsumerAck inserts ack record", async () => {
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncEventRepository(connection);

  await repo.insertEventConsumerAck({
    id: "ack-1",
    eventId: "event-1",
    consumerId: "consumer-1",
    status: "pending",
    lastAttemptAt: null,
    ackedAt: null,
    errorCode: null,
    attemptCount: 0,
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO event_consumer_acks/);
  assert.deepEqual(calls[0]!.params, ["ack-1", "event-1", "consumer-1", "pending", null, null, null, 0]);
});

test("AsyncEventRepository markEventAck updates ack status", async () => {
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncEventRepository(connection);

  await repo.markEventAck("event-1", "consumer-1", "acked", now, "success");

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /UPDATE event_consumer_acks SET status = \$1/);
  assert.deepEqual(calls[0]!.params, ["acked", now, "success", "event-1", "consumer-1"]);
  assert.match(calls[0]!.sql, /acked_at = CASE WHEN \$1 = 'acked' THEN \$2 ELSE acked_at END/);
});

test("AsyncEventRepository markEventAck handles failed status without errorCode", async () => {
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncEventRepository(connection);

  await repo.markEventAck("event-1", "consumer-1", "failed", now);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0]!.params, ["failed", now, null, "event-1", "consumer-1"]);
});

test("AsyncEventRepository markEventDeadLettered updates ack to dead_lettered", async () => {
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncEventRepository(connection);

  await repo.markEventDeadLettered({
    eventId: "event-1",
    consumerId: "consumer-1",
    occurredAt: now,
    errorCode: "dead_lettered",
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /status = 'dead_lettered'/);
  assert.deepEqual(calls[0]!.params, [now, "dead_lettered", "event-1", "consumer-1"]);
});

test("AsyncEventRepository getEventConsumerAck returns ack when exists", async () => {
  const ack: EventConsumerAckRecord = {
    id: "ack-1",
    eventId: "event-1",
    consumerId: "consumer-1",
    status: "pending",
    lastAttemptAt: now,
    ackedAt: null,
    errorCode: null,
    attemptCount: 0,
  };
  const { connection, calls } = createConnection({ queryOneRows: [ack] });
  const repo = new AsyncEventRepository(connection);

  const result = await repo.getEventConsumerAck("event-1", "consumer-1");

  assert.deepEqual(result, ack);
  assert.match(calls[0]!.sql, /FROM event_consumer_acks WHERE event_id = \$1 AND consumer_id = \$2/);
});

test("AsyncEventRepository getEventConsumerAck returns null when not found", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncEventRepository(connection);

  const result = await repo.getEventConsumerAck("event-missing", "consumer-missing");

  assert.equal(result, null);
});

test("AsyncEventRepository getRequiredConsumerIds returns consumer ids for event", async () => {
  const { connection, calls } = createConnection({
    queryRows: [[{ consumerId: "consumer-1" }, { consumerId: "consumer-2" }]],
  });
  const repo = new AsyncEventRepository(connection);

  const result = await repo.getRequiredConsumerIds("event-1");

  assert.deepEqual(result, ["consumer-1", "consumer-2"]);
  assert.match(calls[0]!.sql, /FROM event_consumer_acks WHERE event_id = \$1/);
});

test("AsyncEventRepository ackAllConsumersForEvent acks all pending and failed consumers", async () => {
  const { connection, calls } = createConnection({ executeResults: [3] });
  const repo = new AsyncEventRepository(connection);

  await repo.ackAllConsumersForEvent("event-1", now);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /UPDATE event_consumer_acks SET status = 'acked'/);
  assert.match(calls[0]!.sql, /WHERE event_id = \$3 AND status IN \('pending', 'failed'\)/);
  assert.deepEqual(calls[0]!.params, [now, now, "event-1"]);
});

test("AsyncEventRepository listEventsForTask with numeric limit returns limited results", async () => {
  const event: EventRecord = {
    id: "event-1",
    taskId: "task-1",
    sessionId: null,
    executionId: null,
    eventType: "task:status_changed",
    eventTier: "tier_1",
    payloadJson: "{}",
    traceId: "trace-1",
    createdAt: now,
  };
  const { connection, calls } = createConnection({ queryRows: [[event]] });
  const repo = new AsyncEventRepository(connection);

  const result = await repo.listEventsForTask("task-1", 3);

  assert.deepEqual(result, [event]);
  assert.match(calls[0]!.sql, /WHERE task_id = \$1 ORDER BY created_at DESC LIMIT \$2/);
  assert.deepEqual(calls[0]!.params, ["task-1", 3]);
});

test("AsyncEventRepository listEventsForTask with string tenantId returns tenant-scoped results", async () => {
  const event: EventRecord = {
    id: "event-1",
    taskId: "task-1",
    sessionId: null,
    executionId: null,
    eventType: "task:status_changed",
    eventTier: "tier_1",
    payloadJson: "{}",
    traceId: "trace-1",
    createdAt: now,
  };
  const { connection, calls } = createConnection({ queryRows: [[event]] });
  const repo = new AsyncEventRepository(connection);

  const result = await repo.listEventsForTask("task-1", "tenant-a");

  assert.deepEqual(result, [event]);
  assert.match(calls[0]!.sql, /INNER JOIN tasks t ON t\.id = e\.task_id/);
  assert.match(calls[0]!.sql, /WHERE e\.task_id = \$1 AND t\.tenant_id = \$2/);
  assert.deepEqual(calls[0]!.params, ["task-1", "tenant-a"]);
});

test("AsyncEventRepository listEventsForTask without args returns all events for task", async () => {
  const event: EventRecord = {
    id: "event-1",
    taskId: "task-1",
    sessionId: null,
    executionId: null,
    eventType: "task:status_changed",
    eventTier: "tier_1",
    payloadJson: "{}",
    traceId: "trace-1",
    createdAt: now,
  };
  const { connection, calls } = createConnection({ queryRows: [[event]] });
  const repo = new AsyncEventRepository(connection);

  const result = await repo.listEventsForTask("task-1");

  assert.deepEqual(result, [event]);
  assert.match(calls[0]!.sql, /WHERE task_id = \$1 ORDER BY created_at ASC/);
  assert.doesNotMatch(calls[0]!.sql, /INNER JOIN tasks/);
});

test("AsyncEventRepository getEvent returns event when exists", async () => {
  const event: EventRecord = {
    id: "event-1",
    taskId: "task-1",
    sessionId: null,
    executionId: null,
    eventType: "task:created",
    eventTier: "tier_1",
    payloadJson: "{}",
    traceId: "trace-1",
    createdAt: now,
  };
  const { connection, calls } = createConnection({ queryOneRows: [event] });
  const repo = new AsyncEventRepository(connection);

  const result = await repo.getEvent("event-1");

  assert.deepEqual(result, event);
  assert.match(calls[0]!.sql, /FROM events WHERE id = \$1/);
});

test("AsyncEventRepository getEvent returns null when not found", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncEventRepository(connection);

  const result = await repo.getEvent("event-missing");

  assert.equal(result, null);
});

test("AsyncEventRepository countPendingTier1Acks returns correct count", async () => {
  const { connection, calls } = createConnection({ queryOneRows: [{ count: 42 }] });
  const repo = new AsyncEventRepository(connection);

  const result = await repo.countPendingTier1Acks();

  assert.equal(result, 42);
  assert.match(calls[0]!.sql, /COUNT\(\*\) AS count/);
  assert.match(calls[0]!.sql, /event_tier = 'tier_1'/);
  assert.match(calls[0]!.sql, /a\.status = 'pending'/);
});

test("AsyncEventRepository countFailedTier1Acks returns correct count", async () => {
  const { connection, calls } = createConnection({ queryOneRows: [{ count: 7 }] });
  const repo = new AsyncEventRepository(connection);

  const result = await repo.countFailedTier1Acks();

  assert.equal(result, 7);
  assert.match(calls[0]!.sql, /event_tier = 'tier_1'/);
  assert.match(calls[0]!.sql, /a\.status = 'failed'/);
});
