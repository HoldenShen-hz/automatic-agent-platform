import assert from "node:assert/strict";
import test from "node:test";

import { AsyncMemoryRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/async-repositories/memory-repository.js";
import type { AsyncSqlConnection, AsyncQueryResult } from "../../../../../../src/platform/five-plane-state-evidence/truth/async-sql-database.js";
import type { MemoryRecord } from "../../../../../../src/platform/contracts/types/domain.js";

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

function memoryRecord(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: "mem-1",
    taskId: "task-1",
    sessionId: "session-1",
    agentId: "agent-1",
    executionId: "exec-1",
    memoryLayer: "working",
    scope: "task",
    contentJson: '{"workContext": "test"}',
    classification: null,
    sourceTrustLevel: "verified",
    qualityScore: 0.8,
    hitCount: 1,
    createdAt: now,
    lastAccessedAt: now,
    expiresAt: null,
    revokedAt: null,
    revocationReason: null,
    kind: "working",
    status: "active",
    importanceScore: 5,
    freshnessScore: 0.9,
    contentHash: "hash123",
    ...overrides,
  };
}

// === InsertMemory Tests ===

test("AsyncMemoryRepository insertMemory inserts memory", async () => {
  const memory = memoryRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncMemoryRepository(connection);

  await repo.insertMemory(memory);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO memories/);
});

test("AsyncMemoryRepository insertMemory uses correct parameter order", async () => {
  const memory = memoryRecord({ id: "my-mem", taskId: "task-x" });
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncMemoryRepository(connection);

  await repo.insertMemory(memory);

  assert.equal(calls[0]!.params[0], "my-mem");
  assert.equal(calls[0]!.params[1], "task-x");
});

// === GetMemory Tests ===

test("AsyncMemoryRepository getMemory returns memory when found", async () => {
  const memory = memoryRecord();
  const { connection, calls } = createConnection({ queryOneRows: [memory] });
  const repo = new AsyncMemoryRepository(connection);

  const result = await repo.getMemory("mem-1");

  assert.deepEqual(result, memory);
  assert.match(calls[0]?.sql ?? "", /FROM memories/);
  assert.match(calls[0]?.sql ?? "", /WHERE id = \$1/);
});

test("AsyncMemoryRepository getMemory returns null when not found", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncMemoryRepository(connection);

  const result = await repo.getMemory("nonexistent");

  assert.equal(result, null);
});

// === ListMemories Tests ===

test("AsyncMemoryRepository listMemories returns memories", async () => {
  const memory = memoryRecord();
  const { connection } = createConnection({ queryRows: [[memory]] });
  const repo = new AsyncMemoryRepository(connection);

  const result = await repo.listMemories({});

  assert.deepEqual(result, [memory]);
});

test("AsyncMemoryRepository listMemories filters by taskId", async () => {
  const { connection, calls } = createConnection({ queryRows: [[]] });
  const repo = new AsyncMemoryRepository(connection);

  await repo.listMemories({ taskId: "task-1" });

  assert.match(calls[0]!.sql, /task_id = \$1/);
  assert.deepEqual(calls[0]!.params, ["task-1"]);
});

test("AsyncMemoryRepository listMemories filters by sessionId", async () => {
  const { connection, calls } = createConnection({ queryRows: [[]] });
  const repo = new AsyncMemoryRepository(connection);

  await repo.listMemories({ sessionId: "session-1" });

  assert.match(calls[0]!.sql, /session_id = \$1/);
});

test("AsyncMemoryRepository listMemories filters by scopes", async () => {
  const { connection, calls } = createConnection({ queryRows: [[]] });
  const repo = new AsyncMemoryRepository(connection);

  await repo.listMemories({ scopes: ["task", "session"] });

  assert.match(calls[0]!.sql, /scope IN \(\$1, \$2\)/);
  assert.deepEqual(calls[0]!.params, ["task", "session"]);
});

test("AsyncMemoryRepository listMemories filters by memoryLayers", async () => {
  const { connection, calls } = createConnection({ queryRows: [[]] });
  const repo = new AsyncMemoryRepository(connection);

  await repo.listMemories({ memoryLayers: ["working", "episodic"] });

  assert.match(calls[0]!.sql, /memory_layer IN \(\$1, \$2\)/);
});

test("AsyncMemoryRepository listMemories filters by classifications", async () => {
  const { connection, calls } = createConnection({ queryRows: [[]] });
  const repo = new AsyncMemoryRepository(connection);

  await repo.listMemories({ classifications: ["fact", "preference"] });

  assert.match(calls[0]!.sql, /classification IN \(\$1, \$2\)/);
});

// === RecordMemoryAccess Tests ===

test("AsyncMemoryRepository recordMemoryAccess increments hit count", async () => {
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncMemoryRepository(connection);

  await repo.recordMemoryAccess("mem-1", now);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /UPDATE memories/);
  assert.match(calls[0]!.sql, /hit_count = hit_count \+ 1/);
  assert.match(calls[0]!.sql, /last_accessed_at = \$1/);
  assert.match(calls[0]!.sql, /WHERE id = \$2/);
});

// === RevokeMemory Tests ===

test("AsyncMemoryRepository revokeMemory revokes memory", async () => {
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncMemoryRepository(connection);

  await repo.revokeMemory("mem-1", now, "user_request");

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /UPDATE memories/);
  assert.match(calls[0]!.sql, /revoked_at = \$1/);
  assert.match(calls[0]!.sql, /revocation_reason = \$2/);
  assert.match(calls[0]!.sql, /WHERE id = \$3/);
});

// === FindMemoryByContentHash Tests ===

test("AsyncMemoryRepository findMemoryByContentHash returns memory", async () => {
  const memory = memoryRecord();
  const { connection, calls } = createConnection({ queryOneRows: [memory] });
  const repo = new AsyncMemoryRepository(connection);

  const result = await repo.findMemoryByContentHash("hash123", "task");

  assert.deepEqual(result, memory);
  assert.match(calls[0]?.sql ?? "", /content_hash = \$1/);
  assert.match(calls[0]?.sql ?? "", /scope = \$2/);
  assert.match(calls[0]?.sql ?? "", /status = 'active'/);
});

test("AsyncMemoryRepository findMemoryByContentHash returns null when not found", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncMemoryRepository(connection);

  const result = await repo.findMemoryByContentHash("nonexistent", "task");

  assert.equal(result, null);
});