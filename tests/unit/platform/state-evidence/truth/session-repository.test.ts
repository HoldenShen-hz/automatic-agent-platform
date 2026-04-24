// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";

import { SessionRepository } from "../../../../../src/platform/state-evidence/truth/sqlite/repositories/session-repository.js";
import type { SqliteConnection } from "../../../../../src/platform/state-evidence/truth/sqlite/query-helper.js";
import type {
  CompactionRecord,
  GatewayTargetRecord,
  MessageRecord,
  SessionEventRecord,
  SessionRecord,
  SessionSummaryRecord,
} from "../../../../../src/platform/contracts/types/domain.js";

type SqlCall = {
  method: "query" | "queryOne" | "execute";
  sql: string;
  params: unknown[];
};

function createMockConnection(options: {
  queryRows?: unknown[][];
  queryOneRows?: unknown[];
  executeResults?: number[];
} = {}) {
  const calls: SqlCall[] = [];
  let queryIndex = 0;
  let queryOneIndex = 0;
  let executeIndex = 0;

  const mockPrepare = () => ({
    run: (..._params: unknown[]) => ({ changes: options.executeResults?.[executeIndex++] ?? 1 }),
    get: (..._params: unknown[]) => options.queryOneRows?.[queryOneIndex++],
    all: (..._params: unknown[]) => options.queryRows?.[queryIndex++] ?? [],
  });

  const connection: SqliteConnection = {
    exec: () => {},
    prepare: mockPrepare,
  };

  return { connection, calls };
}

const now = "2026-04-24T10:00:00.000Z";

function sessionRecord(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: "sess-1",
    taskId: "task-1",
    channel: "cli",
    status: "open",
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
    direction: "inbound",
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
    channel: "slack",
    targetKind: "room",
    externalTargetId: "C0123456789",
    displayName: "general",
    aliasesJson: "[]",
    metadataJson: "{}",
    source: "directory",
    lastSeenAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// === Session Tests ===

test("SessionRepository insertSession calls prepare and run with correct SQL", () => {
  const session = sessionRecord();
  const { connection, calls } = createMockConnection({ executeResults: [1] });
  const repo = new SessionRepository(connection);

  repo.insertSession(session);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO sessions/);
  assert.match(calls[0]!.sql, /VALUES \(\?/);
});

test("SessionRepository getSession returns session when found", () => {
  const session = sessionRecord();
  const { connection } = createMockConnection({ queryOneRows: [session] });
  const repo = new SessionRepository(connection);

  const result = repo.getSession("sess-1");

  assert.deepEqual(result, session);
  assert.match((calls) => calls.some(c => c.sql.includes("FROM sessions WHERE id = ?")), true);
});

test("SessionRepository getSession returns undefined when not found", () => {
  const { connection } = createMockConnection({ queryOneRows: [undefined] });
  const repo = new SessionRepository(connection);

  const result = repo.getSession("sess-missing");

  assert.strictEqual(result, undefined);
});

test("SessionRepository listSessionsByTask returns sessions for task", () => {
  const session = sessionRecord();
  const { connection } = createMockConnection({ queryRows: [[session]] });
  const repo = new SessionRepository(connection);

  const result = repo.listSessionsByTask("task-1");

  assert.deepEqual(result, [session]);
});

test("SessionRepository updateSessionStatus updates session status", () => {
  const { connection } = createMockConnection({ executeResults: [1] });
  const repo = new SessionRepository(connection);

  repo.updateSessionStatus("sess-1", "completed", now);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /UPDATE sessions SET status = \?/);
});

test("SessionRepository updateSessionStatusCas performs compare-and-swap", () => {
  const { connection } = createMockConnection({ executeResults: [1] });
  const repo = new SessionRepository(connection);

  const result = repo.updateSessionStatusCas("sess-1", "open", "completed", now);

  assert.equal(result, 1);
  assert.match(calls[0]!.sql, /UPDATE sessions SET status = \? WHERE id = \? AND status = \?/);
});

// === Message Tests ===

test("SessionRepository insertMessage inserts message record", () => {
  const message = messageRecord();
  const { connection } = createMockConnection({ executeResults: [1] });
  const repo = new SessionRepository(connection);

  repo.insertMessage(message);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO messages/);
});

test("SessionRepository listMessagesBySession returns messages without limit", () => {
  const message = messageRecord();
  const { connection } = createMockConnection({ queryRows: [[message]] });
  const repo = new SessionRepository(connection);

  const result = repo.listMessagesBySession("sess-1");

  assert.deepEqual(result, [message]);
  assert.match(calls[0]!.sql, /FROM messages WHERE session_id = \?/);
  assert.match(calls[0]!.sql, /ORDER BY created_at ASC/);
  assert.doesNotMatch(calls[0]!.sql, /LIMIT/);
});

test("SessionRepository listMessagesBySession returns messages with limit", () => {
  const message = messageRecord();
  const { connection } = createMockConnection({ queryRows: [[message]] });
  const repo = new SessionRepository(connection);

  const result = repo.listMessagesBySession("sess-1", 10);

  assert.deepEqual(result, [message]);
  assert.match(calls[0]!.sql, /LIMIT 10/);
});

// === Session Summary Tests ===

test("SessionRepository insertSessionSummary inserts summary record", () => {
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
  const { connection } = createMockConnection({ executeResults: [1] });
  const repo = new SessionRepository(connection);

  repo.insertSessionSummary(summary);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO session_summaries/);
});

test("SessionRepository getLatestSessionSummary returns summary when found", () => {
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
  const { connection } = createMockConnection({ queryOneRows: [summary] });
  const repo = new SessionRepository(connection);

  const result = repo.getLatestSessionSummary("sess-1");

  assert.deepEqual(result, summary);
  assert.match(calls[0]!.sql, /FROM session_summaries/);
  assert.match(calls[0]!.sql, /ORDER BY created_at DESC/);
  assert.match(calls[0]!.sql, /LIMIT 1/);
});

test("SessionRepository getLatestSessionSummary returns null when not found", () => {
  const { connection } = createMockConnection({ queryOneRows: [undefined] });
  const repo = new SessionRepository(connection);

  const result = repo.getLatestSessionSummary("sess-missing");

  assert.equal(result, null);
});

// === Session Event Tests ===

test("SessionRepository insertSessionEvent inserts event record", () => {
  const event: SessionEventRecord = {
    id: "event-1",
    sessionId: "sess-1",
    eventType: "message.created",
    payloadJson: '{"id":"msg-1"}',
    createdAt: now,
  };
  const { connection } = createMockConnection({ executeResults: [1] });
  const repo = new SessionRepository(connection);

  repo.insertSessionEvent(event);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO session_events/);
});

test("SessionRepository listSessionEvents returns events for session", () => {
  const event: SessionEventRecord = {
    id: "event-1",
    sessionId: "sess-1",
    eventType: "message.created",
    payloadJson: '{"id":"msg-1"}',
    createdAt: now,
  };
  const { connection } = createMockConnection({ queryRows: [[event]] });
  const repo = new SessionRepository(connection);

  const result = repo.listSessionEvents("sess-1");

  assert.deepEqual(result, [event]);
  assert.match(calls[0]!.sql, /FROM session_events WHERE session_id = \?/);
  assert.match(calls[0]!.sql, /ORDER BY created_at ASC/);
});

test("SessionRepository listSessionEvents respects limit parameter", () => {
  const event: SessionEventRecord = {
    id: "event-1",
    sessionId: "sess-1",
    eventType: "message.created",
    payloadJson: '{"id":"msg-1"}',
    createdAt: now,
  };
  const { connection } = createMockConnection({ queryRows: [[event]] });
  const repo = new SessionRepository(connection);

  const result = repo.listSessionEvents("sess-1", 50);

  assert.deepEqual(result, [event]);
  assert.match(calls[0]!.sql, /LIMIT \?/);
});

// === Compaction Tests ===

test("SessionRepository insertCompactionRecord inserts compaction record", () => {
  const compaction = compactionRecord();
  const { connection } = createMockConnection({ executeResults: [1] });
  const repo = new SessionRepository(connection);

  repo.insertCompactionRecord(compaction);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO compaction_records/);
});

test("SessionRepository listCompactionRecordsBySession returns records without tenant", () => {
  const compaction = compactionRecord();
  const { connection } = createMockConnection({ queryRows: [[compaction]] });
  const repo = new SessionRepository(connection);

  const result = repo.listCompactionRecordsBySession("sess-1");

  assert.deepEqual(result, [compaction]);
  assert.match(calls[0]!.sql, /FROM compaction_records/);
  assert.match(calls[0]!.sql, /WHERE session_id = \?/);
});

test("SessionRepository listCompactionRecordsBySession returns records with tenant scope", () => {
  const compaction = compactionRecord();
  const { connection } = createMockConnection({ queryRows: [[compaction]] });
  const repo = new SessionRepository(connection);

  const result = repo.listCompactionRecordsBySession("sess-1", "tenant-a");

  assert.deepEqual(result, [compaction]);
  assert.match(calls[0]!.sql, /INNER JOIN tasks t ON t\.id = c\.task_id/);
  assert.match(calls[0]!.sql, /t\.tenant_id = \?/);
});

// === Gateway Target Tests ===

test("SessionRepository upsertGatewayTarget inserts new target", () => {
  const target = gatewayTargetRecord();
  const { connection } = createMockConnection({ executeResults: [1] });
  const repo = new SessionRepository(connection);

  repo.upsertGatewayTarget(target);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO gateway_targets/);
  assert.match(calls[0]!.sql, /ON CONFLICT\(target_id\) DO UPDATE SET/);
});

test("SessionRepository getGatewayTarget returns target when found", () => {
  const target = gatewayTargetRecord();
  const { connection } = createMockConnection({ queryOneRows: [target] });
  const repo = new SessionRepository(connection);

  const result = repo.getGatewayTarget("target-1");

  assert.deepEqual(result, target);
  assert.match(calls[0]!.sql, /FROM gateway_targets WHERE target_id = \?/);
});

test("SessionRepository getGatewayTarget returns undefined when not found", () => {
  const { connection } = createMockConnection({ queryOneRows: [undefined] });
  const repo = new SessionRepository(connection);

  const result = repo.getGatewayTarget("target-missing");

  assert.strictEqual(result, undefined);
});

test("SessionRepository listGatewayTargetsByChannel returns targets for channel", () => {
  const target = gatewayTargetRecord();
  const { connection } = createMockConnection({ queryRows: [[target]] });
  const repo = new SessionRepository(connection);

  const result = repo.listGatewayTargetsByChannel("slack");

  assert.deepEqual(result, [target]);
  assert.match(calls[0]!.sql, /FROM gateway_targets WHERE channel = \?/);
  assert.match(calls[0]!.sql, /ORDER BY display_name/);
});

// === Gateway Session Target Candidates Tests ===

test("SessionRepository listGatewaySessionTargetCandidates returns candidates", () => {
  const candidate = {
    sessionId: "sess-1",
    taskId: "task-1",
    channel: "slack",
    sessionStatus: "open",
    externalSessionId: "ext-1",
    taskTitle: "Test task",
    latestMessage: "Hello",
    latestMessageAt: now,
    lastSeenAt: now,
  };
  const { connection } = createMockConnection({ queryRows: [[candidate]] });
  const repo = new SessionRepository(connection);

  const result = repo.listGatewaySessionTargetCandidates(10, "slack");

  assert.equal(result.length, 1);
  assert.equal(result[0]!.sessionId, "sess-1");
  assert.match(calls[0]!.sql, /FROM sessions s/);
  assert.match(calls[0]!.sql, /LEFT JOIN tasks t ON t\.id = s\.task_id/);
});

test("SessionRepository listGatewaySessionTargetCandidates filters by channel", () => {
  const candidate = {
    sessionId: "sess-1",
    taskId: "task-1",
    channel: "cli",
    sessionStatus: "open",
    externalSessionId: null,
    taskTitle: "Test task",
    latestMessage: null,
    latestMessageAt: null,
    lastSeenAt: now,
  };
  const { connection } = createMockConnection({ queryRows: [[candidate]] });
  const repo = new SessionRepository(connection);

  const result = repo.listGatewaySessionTargetCandidates(10, "cli");

  assert.equal(result.length, 1);
  assert.match(calls[0]!.sql, /WHERE s\.channel = \?/);
});

test("SessionRepository listGatewaySessionTargetCandidates applies tenant scope", () => {
  const candidate = {
    sessionId: "sess-1",
    taskId: "task-1",
    channel: "slack",
    sessionStatus: "open",
    externalSessionId: "ext-1",
    taskTitle: "Test task",
    latestMessage: null,
    latestMessageAt: null,
    lastSeenAt: now,
  };
  const { connection } = createMockConnection({ queryRows: [[candidate]] });
  const repo = new SessionRepository(connection);

  const result = repo.listGatewaySessionTargetCandidates(10, "slack", "tenant-a");

  assert.equal(result.length, 1);
  assert.match(calls[0]!.sql, /AND t\.tenant_id = \?/);
});
