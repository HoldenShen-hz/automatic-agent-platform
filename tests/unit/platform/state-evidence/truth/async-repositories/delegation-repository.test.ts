import assert from "node:assert/strict";
import test from "node:test";

import { AsyncDelegationRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/async-repositories/delegation-repository.js";
import type { AsyncSqlConnection, AsyncQueryResult } from "../../../../../../src/platform/five-plane-state-evidence/truth/async-sql-database.js";

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

function delegationRecord(overrides: Partial<import("../../../../../../src/platform/five-plane-state-evidence/truth/async-repositories/delegation-repository.js").DelegationRecord> = {}): import("../../../../../../src/platform/five-plane-state-evidence/truth/async-repositories/delegation-repository.js").DelegationRecord {
  return {
    delegationId: "dlg-1",
    parentAgentId: "agent-parent",
    childAgentId: "agent-child",
    delegationChainJson: "[]",
    status: "active",
    depth: 1,
    expiresAt: "2026-04-26T11:00:00.000Z",
    resultRef: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ─── insertDelegation ─────────────────────────────────────────────────────────

test("insertDelegation executes INSERT with correct SQL and params", async () => {
  const { connection, calls } = createConnection();
  const repo = new AsyncDelegationRepository(connection);

  const record = delegationRecord();

  await repo.insertDelegation(record);

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "execute");
  assert.ok(calls[0]!.sql.includes("INSERT INTO delegations"));
  assert.deepEqual(calls[0]!.params, [
    "dlg-1",
    "agent-parent",
    "agent-child",
    "[]",
    "active",
    1,
    "2026-04-26T11:00:00.000Z",
    null,
    now,
    now,
  ]);
});

test("insertDelegation handles all status values", async () => {
  const { connection, calls } = createConnection();
  const repo = new AsyncDelegationRepository(connection);

  const statuses = ["pending", "active", "completed", "failed", "cancelled", "expired"];

  for (const status of statuses) {
    const record = delegationRecord({ status });
    await repo.insertDelegation(record);
  }

  assert.equal(calls.length, 6);
  calls.forEach((call, i) => {
    assert.equal(call.params[4], statuses[i]);
  });
});

// ─── updateDelegation ─────────────────────────────────────────────────────────

test("updateDelegation updates status field", async () => {
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncDelegationRepository(connection);

  await repo.updateDelegation({
    delegationId: "dlg-1",
    status: "completed",
    updatedAt: now,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "execute");
  assert.ok(calls[0]!.sql.includes("UPDATE delegations"));
  assert.ok(calls[0]!.sql.includes("status = $"));
});

test("updateDelegation updates resultRef field", async () => {
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncDelegationRepository(connection);

  await repo.updateDelegation({
    delegationId: "dlg-1",
    resultRef: "output_ref_123",
    updatedAt: now,
  });

  assert.equal(calls.length, 1);
  assert.ok(calls[0]!.sql.includes("result_ref = $"));
});

test("updateDelegation updates both status and resultRef", async () => {
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncDelegationRepository(connection);

  await repo.updateDelegation({
    delegationId: "dlg-1",
    status: "failed",
    resultRef: "error_ref",
    updatedAt: now,
  });

  assert.equal(calls.length, 1);
  assert.ok(calls[0]!.sql.includes("status = $"));
  assert.ok(calls[0]!.sql.includes("result_ref = $"));
});

test("updateDelegation returns row count", async () => {
  const { connection } = createConnection({ executeResults: [5] });
  const repo = new AsyncDelegationRepository(connection);

  const count = await repo.updateDelegation({
    delegationId: "dlg-1",
    updatedAt: now,
  });

  assert.equal(count, 5);
});

// ─── getDelegation ────────────────────────────────────────────────────────────

test("getDelegation queries with correct SQL", async () => {
  const { connection, calls } = createConnection({
    queryOneRows: [delegationRecord()],
  });
  const repo = new AsyncDelegationRepository(connection);

  await repo.getDelegation("dlg-1");

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "queryOne");
  assert.ok(calls[0]!.sql.includes("SELECT"));
  assert.ok(calls[0]!.sql.includes("delegation_id"));
  assert.deepEqual(calls[0]!.params, ["dlg-1"]);
});

test("getDelegation returns delegation record", async () => {
  const record = delegationRecord({ delegationId: "dlg-query" });
  const { connection } = createConnection({ queryOneRows: [record] });
  const repo = new AsyncDelegationRepository(connection);

  const result = await repo.getDelegation("dlg-query");

  assert.ok(result !== undefined);
  assert.equal(result?.delegationId, "dlg-query");
});

test("getDelegation returns null when not found", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncDelegationRepository(connection);

  const result = await repo.getDelegation("nonexistent");

  assert.equal(result, null);
});

// ─── listDelegationsByParent ──────────────────────────────────────────────────

test("listDelegationsByParent queries with correct SQL", async () => {
  const { connection, calls } = createConnection({
    queryRows: [[delegationRecord(), delegationRecord()]],
  });
  const repo = new AsyncDelegationRepository(connection);

  await repo.listDelegationsByParent("agent-parent");

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "query");
  assert.ok(calls[0]!.sql.includes("WHERE parent_agent_id = $1"));
  assert.deepEqual(calls[0]!.params, ["agent-parent"]);
});

test("listDelegationsByParent returns array of delegations", async () => {
  const records = [delegationRecord({ delegationId: "dlg-a" }), delegationRecord({ delegationId: "dlg-b" })];
  const { connection } = createConnection({ queryRows: [records] });
  const repo = new AsyncDelegationRepository(connection);

  const result = await repo.listDelegationsByParent("agent-parent");

  assert.equal(result.length, 2);
  assert.equal(result[0]!.delegationId, "dlg-a");
  assert.equal(result[1]!.delegationId, "dlg-b");
});

test("listDelegationsByParent returns empty array when none found", async () => {
  const { connection } = createConnection({ queryRows: [[]] });
  const repo = new AsyncDelegationRepository(connection);

  const result = await repo.listDelegationsByParent("agent-no-delegations");

  assert.deepEqual(result, []);
});

// ─── listDelegationsByStatus ─────────────────────────────────────────────────

test("listDelegationsByStatus queries with correct SQL", async () => {
  const { connection, calls } = createConnection({
    queryRows: [[delegationRecord({ status: "active" })]],
  });
  const repo = new AsyncDelegationRepository(connection);

  await repo.listDelegationsByStatus("active");

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "query");
  assert.ok(calls[0]!.sql.includes("WHERE status = $1"));
  assert.deepEqual(calls[0]!.params, ["active"]);
});

test("listDelegationsByStatus returns delegations matching status", async () => {
  const records = [
    delegationRecord({ delegationId: "dlg-active-1", status: "active" }),
    delegationRecord({ delegationId: "dlg-active-2", status: "active" }),
  ];
  const { connection } = createConnection({ queryRows: [records] });
  const repo = new AsyncDelegationRepository(connection);

  const result = await repo.listDelegationsByStatus("active");

  assert.equal(result.length, 2);
  assert.ok(result.every((r) => r.status === "active"));
});

// ─── insertDelegationEvent ────────────────────────────────────────────────────

test("insertDelegationEvent executes INSERT with correct SQL and params", async () => {
  const { connection, calls } = createConnection();
  const repo = new AsyncDelegationRepository(connection);

  await repo.insertDelegationEvent({
    eventId: "evt-1",
    delegationId: "dlg-1",
    eventType: "delegation.created",
    payloadJson: '{"key":"value"}',
    createdAt: now,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "execute");
  assert.ok(calls[0]!.sql.includes("INSERT INTO delegation_events"));
  assert.deepEqual(calls[0]!.params, [
    "evt-1",
    "dlg-1",
    "delegation.created",
    '{"key":"value"}',
    now,
  ]);
});

// ─── Delete ───────────────────────────────────────────────────────────────────

test("deleteDelegation executes DELETE with delegation ID", async () => {
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncDelegationRepository(connection);

  await repo.deleteDelegation("dlg-1");

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "execute");
  assert.ok(calls[0]!.sql.includes("DELETE FROM delegations"));
  assert.deepEqual(calls[0]!.params, ["dlg-1"]);
});

test("deleteDelegation returns row count", async () => {
  const { connection } = createConnection({ executeResults: [3] });
  const repo = new AsyncDelegationRepository(connection);

  const count = await repo.deleteDelegation("dlg-1");

  assert.equal(count, 3);
});