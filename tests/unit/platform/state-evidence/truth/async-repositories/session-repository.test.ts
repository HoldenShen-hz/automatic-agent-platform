import assert from "node:assert/strict";
import test from "node:test";

import { AsyncSessionRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/async-repositories/session-repository.js";
import type { AsyncSqlConnection, AsyncQueryResult } from "../../../../../../src/platform/five-plane-state-evidence/truth/async-sql-database.js";
import type {
  CompactionRecord,
  GatewayTargetRecord,
  MessageRecord,
  SessionEventRecord,
  SessionRecord,
  SessionSummaryRecord,
} from "../../../../../../src/platform/contracts/types/domain.js";

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

const now = "2026-04-23T10:00:00.000Z";

function sessionRecord(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: "sess-1",
    taskId: "task-1",
    channel: "api",
    status: "active",
    externalSessionId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function messageRecord(overrides: Partial<MessageRecord> = {}): MessageRecord {
  return {
    id: "msg-1",
    sessionId: "sess-1",
    direction: "incoming",
    messageType: "text",
    content: "Hello",
    partsJson: null,
    attachmentsJson: "[]",
    createdAt: now,
    ...overrides,
  };
}

function compactionRecord(overrides: Partial<CompactionRecord> = {}): CompactionRecord {
  return {
    id: "comp-1",
    sessionId: "sess-1",
    taskId: "task-1",
    stage: "trim",
    sourceMessageIdsJson: '["msg-1","msg-2"]',
    summaryText: "Session summarized",
    summaryRef: null,
    compactionReason: "token_limit",
    overflowTriggered: 1,
    autoTriggered: 0,
    tokenReductionEstimate: 1000,
    createdAt: now,
    ...overrides,
  };
}

function gatewayTargetRecord(overrides: Partial<GatewayTargetRecord> = {}): GatewayTargetRecord {
  return {
    targetId: "target-1",
    channel: "api",
    targetKind: "user",
    externalTargetId: "user-123",
    displayName: "User One",
    aliasesJson: "[]",
    metadataJson: "{}",
    source: "manual",
    lastSeenAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// === Session Tests ===

test("AsyncSessionRepository insertSession inserts session record", async () => {
  const session = sessionRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncSessionRepository(connection);

  await repo.insertSession(session);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO sessions/);
});

test("AsyncSessionRepository getSession returns session when found", async () => {
  const session = sessionRecord();
  const { connection, calls } = createConnection({ queryOneRows: [session] });
  const repo = new AsyncSessionRepository(connection);

  const result = await repo.getSession("sess-1");

  assert.deepEqual(result, session);
  assert.match(calls[0]!.sql, /FROM sessions WHERE id = \$1/);
});

test("AsyncSessionRepository getSession returns null when not found", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncSessionRepository(connection);

  const result = await repo.getSession("sess-missing");

  assert.equal(result, null);
});

test("AsyncSessionRepository listSessionsByTask returns sessions for task", async () => {
  const session = sessionRecord();
  const { connection, calls } = createConnection({ queryRows: [[session]] });
  const repo = new AsyncSessionRepository(connection);

  const result = await repo.listSessionsByTask("task-1");

  assert.deepEqual(result, [session]);
  assert.match(calls[0]!.sql, /FROM sessions WHERE task_id = \$1/);
  assert.match(calls[0]!.sql, /ORDER BY created_at DESC/);
});

test("AsyncSessionRepository updateSessionStatus updates session status", async () => {
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncSessionRepository(connection);

  const result = await repo.updateSessionStatus("sess-1", "closed", now);

  assert.equal(result, 1);
  assert.match(calls[0]!.sql, /UPDATE sessions SET status = \$1/);
  assert.deepEqual(calls[0]!.params, ["closed", now, "sess-1"]);
});

// === Message Tests ===

test("AsyncSessionRepository insertMessage inserts message record", async () => {
  const message = messageRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncSessionRepository(connection);

  await repo.insertMessage(message);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO messages/);
});

test("AsyncSessionRepository listMessagesBySession returns messages without limit", async () => {
  const message = messageRecord();
  const { connection, calls } = createConnection({ queryRows: [[message]] });
  const repo = new AsyncSessionRepository(connection);

  const result = await repo.listMessagesBySession("sess-1");

  assert.deepEqual(result, [message]);
  assert.match(calls[0]!.sql, /FROM messages WHERE session_id = \$1/);
  assert.match(calls[0]!.sql, /ORDER BY created_at ASC/);
  assert.doesNotMatch(calls[0]!.sql, /LIMIT/);
});

test("AsyncSessionRepository listMessagesBySession returns messages with limit", async () => {
  const message = messageRecord();
  const { connection, calls } = createConnection({ queryRows: [[message]] });
  const repo = new AsyncSessionRepository(connection);

  const result = await repo.listMessagesBySession("sess-1", 10);

  assert.deepEqual(result, [message]);
  assert.match(calls[0]!.sql, /LIMIT 10/);
});

// === Session Summary Tests ===

test("AsyncSessionRepository insertSessionSummary inserts summary record", async () => {
  const summary: SessionSummaryRecord = {
    id: "summary-1",
    sessionId: "sess-1",
    taskId: "task-1",
    agentId: "agent-1",
    summaryText: "Session completed successfully",
    keyDecisions: "[]",
    keyOutcomes: "[]",
    memoryIdsReferenced: "[]",
    tokenCount: 500,
    createdAt: now,
  };
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncSessionRepository(connection);

  await repo.insertSessionSummary(summary);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO session_summaries/);
});

test("AsyncSessionRepository getLatestSessionSummary returns summary when found", async () => {
  const summary: SessionSummaryRecord = {
    id: "summary-1",
    sessionId: "sess-1",
    taskId: "task-1",
    agentId: "agent-1",
    summaryText: "Session completed",
    keyDecisions: "[]",
    keyOutcomes: "[]",
    memoryIdsReferenced: "[]",
    tokenCount: 500,
    createdAt: now,
  };
  const { connection, calls } = createConnection({ queryOneRows: [summary] });
  const repo = new AsyncSessionRepository(connection);

  const result = await repo.getLatestSessionSummary("sess-1");

  assert.deepEqual(result, summary);
  assert.match(calls[0]!.sql, /FROM session_summaries/);
  assert.match(calls[0]!.sql, /ORDER BY created_at DESC/);
  assert.match(calls[0]!.sql, /LIMIT 1/);
});

test("AsyncSessionRepository getLatestSessionSummary returns null when not found", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncSessionRepository(connection);

  const result = await repo.getLatestSessionSummary("sess-missing");

  assert.equal(result, null);
});

// === Compaction Tests ===

test("AsyncSessionRepository insertCompactionRecord inserts compaction record", async () => {
  const compaction = compactionRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncSessionRepository(connection);

  await repo.insertCompactionRecord(compaction);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO compaction_records/);
});

test("AsyncSessionRepository listCompactionRecordsBySession returns records without tenant", async () => {
  const compaction = compactionRecord();
  const { connection, calls } = createConnection({ queryRows: [[compaction]] });
  const repo = new AsyncSessionRepository(connection);

  const result = await repo.listCompactionRecordsBySession("sess-1");

  assert.deepEqual(result, [compaction]);
  assert.match(calls[0]!.sql, /FROM compaction_records/);
  assert.match(calls[0]!.sql, /WHERE session_id = \$1/);
});

test("AsyncSessionRepository listCompactionRecordsBySession returns records with tenant", async () => {
  const compaction = compactionRecord();
  const { connection, calls } = createConnection({ queryRows: [[compaction]] });
  const repo = new AsyncSessionRepository(connection);

  const result = await repo.listCompactionRecordsBySession("sess-1", "tenant-a");

  assert.deepEqual(result, [compaction]);
  assert.match(calls[0]!.sql, /INNER JOIN tasks t ON t\.id = c\.task_id/);
  assert.match(calls[0]!.sql, /t\.tenant_id = \$2/);
});

// === Gateway Target Tests ===

test("AsyncSessionRepository upsertGatewayTarget inserts new target", async () => {
  const target = gatewayTargetRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncSessionRepository(connection);

  await repo.upsertGatewayTarget(target);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO gateway_targets/);
  assert.match(calls[0]!.sql, /ON CONFLICT\(target_id\) DO UPDATE SET/);
});

test("AsyncSessionRepository getGatewayTarget returns target when found", async () => {
  const target = gatewayTargetRecord();
  const { connection, calls } = createConnection({ queryOneRows: [target] });
  const repo = new AsyncSessionRepository(connection);

  const result = await repo.getGatewayTarget("target-1");

  assert.deepEqual(result, target);
  assert.match(calls[0]!.sql, /FROM gateway_targets WHERE target_id = \$1/);
});

test("AsyncSessionRepository getGatewayTarget returns null when not found", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncSessionRepository(connection);

  const result = await repo.getGatewayTarget("target-missing");

  assert.equal(result, null);
});

test("AsyncSessionRepository listGatewayTargetsByChannel returns targets for channel", async () => {
  const target = gatewayTargetRecord();
  const { connection, calls } = createConnection({ queryRows: [[target]] });
  const repo = new AsyncSessionRepository(connection);

  const result = await repo.listGatewayTargetsByChannel("api");

  assert.deepEqual(result, [target]);
  assert.match(calls[0]!.sql, /FROM gateway_targets WHERE channel = \$1/);
  assert.match(calls[0]!.sql, /ORDER BY display_name/);
});
