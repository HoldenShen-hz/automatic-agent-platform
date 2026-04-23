// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";

import { AsyncDivisionRepository } from "../../../../../../src/platform/state-evidence/truth/async-repositories/division-repository.js";
import type { AsyncSqlConnection, AsyncQueryResult } from "../../../../../../src/platform/state-evidence/truth/async-sql-database.js";
import type { DataMovementJobRecord } from "../../../../../../src/platform/contracts/types/domain.js";

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

function dataMovementJobRecord(overrides: Partial<DataMovementJobRecord> = {}): DataMovementJobRecord {
  return {
    jobId: "job-1",
    tenantId: "tenant-a",
    organizationId: "org-1",
    workspaceId: "ws-1",
    sourceNamespaceId: "ns-source",
    targetNamespaceId: "ns-target",
    sourcePlane: "source-plane",
    targetPlane: "target-plane",
    movementType: "export",
    inputRefsJson: '["ref-1","ref-2"]',
    status: "in_progress",
    startedAt: now,
    finishedAt: null,
    reportJson: null,
    ...overrides,
  };
}

test("AsyncDivisionRepository listDataMovementJobRecords returns jobs without filters", async () => {
  const job = dataMovementJobRecord();
  const { connection, calls } = createConnection({ queryRows: [[job]] });
  const repo = new AsyncDivisionRepository(connection);

  const result = await repo.listDataMovementJobRecords();

  assert.deepEqual(result, [job]);
  assert.match(calls[0]!.sql, /FROM data_movement_jobs/);
  assert.match(calls[0]!.sql, /ORDER BY started_at DESC/);
  assert.match(calls[0]!.sql, /LIMIT \$1/);
});

test("AsyncDivisionRepository listDataMovementJobRecords filters by tenantId", async () => {
  const job = dataMovementJobRecord();
  const { connection, calls } = createConnection({ queryRows: [[job]] });
  const repo = new AsyncDivisionRepository(connection);

  const result = await repo.listDataMovementJobRecords({ tenantId: "tenant-a" });

  assert.deepEqual(result, [job]);
  assert.match(calls[0]!.sql, /tenant_id = \$1/);
  assert.deepEqual(calls[0]!.params, ["tenant-a", 100]);
});

test("AsyncDivisionRepository listDataMovementJobRecords filters by status", async () => {
  const job = dataMovementJobRecord();
  const { connection, calls } = createConnection({ queryRows: [[job]] });
  const repo = new AsyncDivisionRepository(connection);

  const result = await repo.listDataMovementJobRecords({ status: "in_progress" });

  assert.deepEqual(result, [job]);
  assert.match(calls[0]!.sql, /status = \$1/);
});

test("AsyncDivisionRepository listDataMovementJobRecords filters by movementType", async () => {
  const job = dataMovementJobRecord();
  const { connection, calls } = createConnection({ queryRows: [[job]] });
  const repo = new AsyncDivisionRepository(connection);

  const result = await repo.listDataMovementJobRecords({ movementType: "export" });

  assert.deepEqual(result, [job]);
  assert.match(calls[0]!.sql, /movement_type = \$1/);
});

test("AsyncDivisionRepository listDataMovementJobRecords combines multiple filters", async () => {
  const job = dataMovementJobRecord();
  const { connection, calls } = createConnection({ queryRows: [[job]] });
  const repo = new AsyncDivisionRepository(connection);

  const result = await repo.listDataMovementJobRecords({
    tenantId: "tenant-a",
    status: "in_progress",
    movementType: "export",
  });

  assert.deepEqual(result, [job]);
  assert.match(calls[0]!.sql, /tenant_id = \$1/);
  assert.match(calls[0]!.sql, /status = \$2/);
  assert.match(calls[0]!.sql, /movement_type = \$3/);
  assert.deepEqual(calls[0]!.params, ["tenant-a", "in_progress", "export", 100]);
});

test("AsyncDivisionRepository listDataMovementJobRecords respects custom limit", async () => {
  const job = dataMovementJobRecord();
  const { connection, calls } = createConnection({ queryRows: [[job]] });
  const repo = new AsyncDivisionRepository(connection);

  const result = await repo.listDataMovementJobRecords({ limit: 5 });

  assert.deepEqual(result, [job]);
  assert.match(calls[0]!.sql, /LIMIT \$1/);
  assert.deepEqual(calls[0]!.params, [5]);
});

test("AsyncDivisionRepository listDataMovementJobRecords handles null tenantId", async () => {
  const job = dataMovementJobRecord();
  const { connection, calls } = createConnection({ queryRows: [[job]] });
  const repo = new AsyncDivisionRepository(connection);

  const result = await repo.listDataMovementJobRecords({ tenantId: null });

  assert.deepEqual(result, [job]);
  assert.match(calls[0]!.sql, /tenant_id = \$1/);
});
