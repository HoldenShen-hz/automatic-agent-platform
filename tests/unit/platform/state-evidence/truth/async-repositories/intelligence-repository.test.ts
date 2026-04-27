// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";

import { AsyncIntelligenceRepository } from "../../../../../../src/platform/state-evidence/truth/async-repositories/intelligence-repository.js";
import type { AsyncSqlConnection, AsyncQueryResult } from "../../../../../../src/platform/state-evidence/truth/async-sql-database.js";
import type { IntelItemRecord, IntelBriefRecord, PerceptionSourceRecord, ActionProposalRecord } from "../../../../../../src/platform/contracts/types/domain.js";

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

function perceptionSourceRecord(overrides: Partial<PerceptionSourceRecord> = {}): PerceptionSourceRecord {
  return {
    sourceId: "src-1",
    tenantId: "tenant-1",
    type: "rss",
    name: "Test Source",
    enabled: true,
    scheduleJson: "{}",
    filtersJson: "{}",
    priority: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function intelItemRecord(overrides: Partial<IntelItemRecord> = {}): IntelItemRecord {
  return {
    intelId: "intel-1",
    tenantId: "tenant-1",
    sourceId: "src-1",
    title: "Test Intel",
    summary: "Test summary",
    rawRef: "https://example.com",
    relevanceScore: 0.8,
    importance: 5,
    tagsJson: "[]",
    dedupeKey: "key-1",
    capturedAt: now,
    expiresAt: null,
    ...overrides,
  };
}

function intelBriefRecord(overrides: Partial<IntelBriefRecord> = {}): IntelBriefRecord {
  return {
    briefId: "brief-1",
    tenantId: "tenant-1",
    periodStart: now,
    periodEnd: now,
    sourceScopeJson: "{}",
    itemIdsJson: "[]",
    overallSummary: "Test brief",
    recommendedActionsJson: "[]",
    generatedAt: now,
    ...overrides,
  };
}

function actionProposalRecord(overrides: Partial<ActionProposalRecord> = {}): ActionProposalRecord {
  return {
    proposalId: "prop-1",
    tenantId: "tenant-1",
    briefId: "brief-1",
    intelId: "intel-1",
    taskId: "task-1",
    title: "Test Proposal",
    summary: "Test summary",
    actionType: "create_task",
    status: "pending",
    requiresApproval: false,
    proposalJson: "{}",
    createdAt: now,
    decidedAt: null,
    ...overrides,
  };
}

// === UpsertPerceptionSource Tests ===

test("AsyncIntelligenceRepository upsertPerceptionSource inserts source", async () => {
  const source = perceptionSourceRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncIntelligenceRepository(connection);

  await repo.upsertPerceptionSource(source);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO perception_sources/);
  assert.match(calls[0]!.sql, /ON CONFLICT\(source_id\) DO UPDATE SET/);
});

// === GetPerceptionSource Tests ===

test("AsyncIntelligenceRepository getPerceptionSource returns source when found", async () => {
  const source = perceptionSourceRecord();
  const { connection } = createConnection({ queryOneRows: [source] });
  const repo = new AsyncIntelligenceRepository(connection);

  const result = await repo.getPerceptionSource("src-1");

  assert.deepEqual(result, source);
});

test("AsyncIntelligenceRepository getPerceptionSource returns null when not found", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncIntelligenceRepository(connection);

  const result = await repo.getPerceptionSource("nonexistent");

  assert.equal(result, null);
});

// === ListPerceptionSources Tests ===

test("AsyncIntelligenceRepository listPerceptionSources returns sources", async () => {
  const source = perceptionSourceRecord();
  const { connection } = createConnection({ queryRows: [[source]] });
  const repo = new AsyncIntelligenceRepository(connection);

  const result = await repo.listPerceptionSources();

  assert.deepEqual(result, [source]);
});

test("AsyncIntelligenceRepository listPerceptionSources filters by enabledOnly", async () => {
  const { connection, calls } = createConnection({ queryRows: [[]] });
  const repo = new AsyncIntelligenceRepository(connection);

  await repo.listPerceptionSources(true);

  assert.match(calls[0]!.sql, /enabled = 1/);
});

// === InsertIntelItem Tests ===

test("AsyncIntelligenceRepository insertIntelItem inserts item", async () => {
  const item = intelItemRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncIntelligenceRepository(connection);

  await repo.insertIntelItem(item);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO intel_items/);
});

// === GetIntelItemBySourceAndDedupeKey Tests ===

test("AsyncIntelligenceRepository getIntelItemBySourceAndDedupeKey returns item", async () => {
  const item = intelItemRecord();
  const { connection } = createConnection({ queryOneRows: [item] });
  const repo = new AsyncIntelligenceRepository(connection);

  const result = await repo.getIntelItemBySourceAndDedupeKey("src-1", "key-1");

  assert.deepEqual(result, item);
});

test("AsyncIntelligenceRepository getIntelItemBySourceAndDedupeKey returns null when not found", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncIntelligenceRepository(connection);

  const result = await repo.getIntelItemBySourceAndDedupeKey("src-1", "nonexistent");

  assert.equal(result, null);
});

// === ListIntelItems Tests ===

test("AsyncIntelligenceRepository listIntelItems returns items", async () => {
  const item = intelItemRecord();
  const { connection } = createConnection({ queryRows: [[item]] });
  const repo = new AsyncIntelligenceRepository(connection);

  const result = await repo.listIntelItems({});

  assert.deepEqual(result, [item]);
});

test("AsyncIntelligenceRepository listIntelItems filters by sourceIds", async () => {
  const { connection, calls } = createConnection({ queryRows: [[]] });
  const repo = new AsyncIntelligenceRepository(connection);

  await repo.listIntelItems({ sourceIds: ["src-1", "src-2"] });

  assert.match(calls[0]!.sql, /source_id IN \(\$1, \$2\)/);
  assert.deepEqual(calls[0]!.params.slice(0, 2), ["src-1", "src-2"]);
});

test("AsyncIntelligenceRepository listIntelItems filters by date range", async () => {
  const { connection, calls } = createConnection({ queryRows: [[]] });
  const repo = new AsyncIntelligenceRepository(connection);

  await repo.listIntelItems({ since: "2026-04-01", until: "2026-04-23" });

  assert.match(calls[0]!.sql, /captured_at >= \$/);
  assert.match(calls[0]!.sql, /captured_at <= \$/);
});

// === ListIntelItemsByIds Tests ===

test("AsyncIntelligenceRepository listIntelItemsByIds returns items by ids", async () => {
  const item = intelItemRecord();
  const { connection } = createConnection({ queryRows: [[item]] });
  const repo = new AsyncIntelligenceRepository(connection);

  const result = await repo.listIntelItemsByIds(["intel-1", "intel-2"]);

  assert.deepEqual(result, [item]);
});

test("AsyncIntelligenceRepository listIntelItemsByIds returns empty for empty array", async () => {
  const { connection } = createConnection({ queryRows: [[]] });
  const repo = new AsyncIntelligenceRepository(connection);

  const result = await repo.listIntelItemsByIds([]);

  assert.deepEqual(result, []);
});

// === InsertIntelBrief Tests ===

test("AsyncIntelligenceRepository insertIntelBrief inserts brief", async () => {
  const brief = intelBriefRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncIntelligenceRepository(connection);

  await repo.insertIntelBrief(brief);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO intel_briefs/);
});

// === GetIntelBrief Tests ===

test("AsyncIntelligenceRepository getIntelBrief returns brief when found", async () => {
  const brief = intelBriefRecord();
  const { connection } = createConnection({ queryOneRows: [brief] });
  const repo = new AsyncIntelligenceRepository(connection);

  const result = await repo.getIntelBrief("brief-1");

  assert.deepEqual(result, brief);
});

test("AsyncIntelligenceRepository getIntelBrief returns null when not found", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncIntelligenceRepository(connection);

  const result = await repo.getIntelBrief("nonexistent");

  assert.equal(result, null);
});

// === ListIntelBriefs Tests ===

test("AsyncIntelligenceRepository listIntelBriefs returns briefs", async () => {
  const brief = intelBriefRecord();
  const { connection } = createConnection({ queryRows: [[brief]] });
  const repo = new AsyncIntelligenceRepository(connection);

  const result = await repo.listIntelBriefs(20);

  assert.deepEqual(result, [brief]);
});

// === InsertActionProposal Tests ===

test("AsyncIntelligenceRepository insertActionProposal inserts proposal", async () => {
  const proposal = actionProposalRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncIntelligenceRepository(connection);

  await repo.insertActionProposal(proposal);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO action_proposals/);
});

// === ListActionProposalsByBrief Tests ===

test("AsyncIntelligenceRepository listActionProposalsByBrief returns proposals", async () => {
  const proposal = actionProposalRecord();
  const { connection } = createConnection({ queryRows: [[proposal]] });
  const repo = new AsyncIntelligenceRepository(connection);

  const result = await repo.listActionProposalsByBrief("brief-1");

  assert.deepEqual(result, [proposal]);
});